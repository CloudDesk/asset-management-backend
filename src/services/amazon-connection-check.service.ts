import { prisma } from '../models/prisma.js';
import { AmazonAuthorizationError, AmazonTokenRequestError } from './amazon-lwa-token.service.js';
import { amazonListingScopeService, type AmazonListingScope } from './amazon-listing-scope.service.js';

// Real Amazon connection status for the Channels page and Amazon Operations (FIX-131).
// "Configured" only meant the env values exist; this asks Amazon for a token and reads the latest syncs.

export type AmazonConnectionStatus = 'CONNECTED' | 'SYNC_FAILING' | 'AUTH_FAILED' | 'UNREACHABLE' | 'NOT_CONFIGURED';

export type AmazonTokenCheck =
  | { ok: true }
  | { ok: false; kind: 'NOT_CONFIGURED' | 'AUTH_FAILED' | 'UNREACHABLE'; message: string };

export type AmazonSyncRun = {
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  lastSuccessAt: string | null;
  /** First failed run after the last success (null when the latest run succeeded) */
  failingSince: string | null;
};

const FAILED_STATUSES = new Set(['FAILED']);
const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;

const MESSAGES: Record<AmazonConnectionStatus, string> = {
  CONNECTED: 'Amazon accepted the credentials and the latest imports succeeded.',
  SYNC_FAILING: 'Amazon accepted the credentials, but the latest import failed.',
  AUTH_FAILED: 'Amazon rejected the app credentials. Rotate the client secret in Seller Central → Develop Apps and update the backend.',
  UNREACHABLE: 'Could not reach Amazon to check the credentials. Try again shortly.',
  NOT_CONFIGURED: 'Amazon credentials are not set on the backend.',
};

export const classifyTokenError = (error: unknown): Extract<AmazonTokenCheck, { ok: false }> => {
  const message = error instanceof Error ? error.message : 'Amazon token check failed';
  if (error instanceof AmazonAuthorizationError) {
    return { ok: false, kind: /is not configured on the backend/.test(message) ? 'NOT_CONFIGURED' : 'AUTH_FAILED', message };
  }
  if (error instanceof AmazonTokenRequestError) return { ok: false, kind: 'UNREACHABLE', message };
  return { ok: false, kind: 'UNREACHABLE', message };
};

const earliest = (...values: Array<string | null>) =>
  values.filter((value): value is string => value !== null).sort()[0] ?? null;

export const deriveAmazonConnectionStatus = (
  token: AmazonTokenCheck,
  listingImport: AmazonSyncRun,
  orderImport: AmazonSyncRun,
) => {
  const failingSince = earliest(listingImport.failingSince, orderImport.failingSince);
  const status: AmazonConnectionStatus = !token.ok
    ? token.kind
    : FAILED_STATUSES.has(orderImport.lastStatus ?? '') || FAILED_STATUSES.has(listingImport.lastStatus ?? '')
      ? 'SYNC_FAILING'
      : 'CONNECTED';
  return {
    status,
    message: MESSAGES[status],
    reason: token.ok ? (orderImport.lastError ?? listingImport.lastError ?? null) : token.message,
    failingSince: status === 'CONNECTED' ? null : failingSince,
  };
};

type Deps = {
  resolveScope: (userId?: number, userType?: string) => Promise<AmazonListingScope>;
  loadSyncRuns: (scope: Pick<AmazonListingScope, 'sellerId' | 'marketplaceId'>) => Promise<{ listingImport: AmazonSyncRun; orderImport: AmazonSyncRun }>;
};

const loadSyncRunsFromDatabase: Deps['loadSyncRuns'] = async ({ sellerId, marketplaceId }) => {
  const listingWhere = { marketplace: 'AMAZON', environment: 'PRODUCTION', sellerId, marketplaceId };
  const orderWhere = { sellerId, marketplaceId };
  const [lastListing, lastListingOk, lastOrder, lastOrderOk] = await Promise.all([
    prisma.channelSyncLog.findFirst({ where: listingWhere, orderBy: { startedAt: 'desc' } }),
    prisma.channelSyncLog.findFirst({ where: { ...listingWhere, status: 'SUCCESS' }, orderBy: { startedAt: 'desc' } }),
    prisma.amazonOrderImportJob.findFirst({ where: { ...orderWhere, status: { in: ['COMPLETED', 'FAILED'] } }, orderBy: { createdAt: 'desc' } }),
    prisma.amazonOrderImportJob.findFirst({ where: { ...orderWhere, status: 'COMPLETED' }, orderBy: { createdAt: 'desc' } }),
  ]);
  const [firstListingFailure, firstOrderFailure] = await Promise.all([
    lastListing?.status === 'FAILED'
      ? prisma.channelSyncLog.findFirst({ where: { ...listingWhere, status: 'FAILED', ...(lastListingOk ? { startedAt: { gt: lastListingOk.startedAt } } : {}) }, orderBy: { startedAt: 'asc' } })
      : null,
    lastOrder?.status === 'FAILED'
      ? prisma.amazonOrderImportJob.findFirst({ where: { ...orderWhere, status: 'FAILED', ...(lastOrderOk ? { createdAt: { gt: lastOrderOk.createdAt } } : {}) }, orderBy: { createdAt: 'asc' } })
      : null,
  ]);
  return {
    listingImport: {
      lastRunAt: iso(lastListing?.startedAt),
      lastStatus: lastListing?.status ?? null,
      lastError: lastListing?.status === 'FAILED' ? lastListing.errorMessage?.slice(0, 300) ?? null : null,
      lastSuccessAt: iso(lastListingOk?.startedAt),
      failingSince: iso(firstListingFailure?.startedAt),
    },
    orderImport: {
      lastRunAt: iso(lastOrder?.createdAt),
      lastStatus: lastOrder?.status ?? null,
      lastError: lastOrder?.status === 'FAILED' ? lastOrder.errorMessage?.slice(0, 300) ?? null : null,
      lastSuccessAt: iso(lastOrderOk?.createdAt),
      failingSince: iso(firstOrderFailure?.createdAt),
    },
  };
};

export class AmazonConnectionCheckService {
  constructor(private readonly deps: Deps = {
    resolveScope: (userId, userType) => amazonListingScopeService.resolve(userId, userType),
    loadSyncRuns: loadSyncRunsFromDatabase,
  }) {}

  /** fresh = drop the cached access token first, so a just-broken secret shows up immediately */
  async check(input: { userId?: number; userType?: string; fresh?: boolean } = {}) {
    let scope: AmazonListingScope;
    try {
      scope = await this.deps.resolveScope(input.userId, input.userType);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Amazon seller account is not configured';
      const empty: AmazonSyncRun = { lastRunAt: null, lastStatus: null, lastError: null, lastSuccessAt: null, failingSince: null };
      return {
        checkedAt: new Date().toISOString(), source: null, sellerId: null, marketplaceId: null,
        status: 'NOT_CONFIGURED' as const, message: MESSAGES.NOT_CONFIGURED, reason: message, failingSince: null,
        listingImport: empty, orderImport: empty,
      };
    }

    let token: AmazonTokenCheck = { ok: true };
    try {
      if (!scope.accessTokenProvider) throw new AmazonTokenRequestError('Amazon token provider is unavailable', 503, 'AMAZON_TOKEN_PROVIDER_MISSING');
      if (input.fresh) scope.accessTokenProvider.invalidate();
      await scope.accessTokenProvider.getAccessToken();
    } catch (error) {
      token = classifyTokenError(error);
    }

    const { listingImport, orderImport } = await this.deps.loadSyncRuns(scope);
    return {
      checkedAt: new Date().toISOString(),
      source: scope.source,
      sellerId: scope.sellerId,
      marketplaceId: scope.marketplaceId,
      ...deriveAmazonConnectionStatus(token, listingImport, orderImport),
      listingImport,
      orderImport,
    };
  }
}

export const amazonConnectionCheckService = new AmazonConnectionCheckService();
