import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from '../models/prisma.js';
import { AmazonTokenCryptoService, amazonTokenCryptoService } from './amazon-token-crypto.service.js';

const AMAZON_LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';

type FetchLike = typeof fetch;
type AmazonUserType = 'inventoryusers' | 'users';

type OAuthState = {
  userId: number;
  userType: AmazonUserType;
  redirectUri: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

type LwaTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

export class AmazonConnectionError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code = 'AMAZON_CONNECTION_ERROR'
  ) {
    super(message);
    this.name = 'AmazonConnectionError';
  }
}

type AmazonConnectionServiceOptions = {
  fetchImpl?: FetchLike;
  tokenCrypto?: AmazonTokenCryptoService;
  now?: () => number;
  clientId?: string;
  clientSecret?: string;
  appId?: string;
  oauthVersion?: 'beta';
  redirectUri?: string;
  sellerCentralUrl?: string;
  marketplaceId?: string;
  stateSecret?: string;
  stateTtlSeconds?: number;
};

const required = (name: string, value?: string): string => {
  const normalized = value?.trim();
  if (!normalized) throw new AmazonConnectionError(`${name} is not configured`, 503, 'AMAZON_OAUTH_NOT_CONFIGURED');
  return normalized;
};

export class AmazonConnectionService {
  private readonly fetchImpl: FetchLike;
  private readonly tokenCrypto: AmazonTokenCryptoService;
  private readonly now: () => number;
  private readonly options: AmazonConnectionServiceOptions;

  constructor(options: AmazonConnectionServiceOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.tokenCrypto = options.tokenCrypto ?? amazonTokenCryptoService;
    this.now = options.now ?? Date.now;
    this.options = options;
  }

  initiateOAuth(userId: number, userType: AmazonUserType) {
    const redirectUri = required('AMAZON_REDIRECT_URI', this.options.redirectUri ?? env.AMAZON_REDIRECT_URI);
    const appId = required('AMAZON_SP_API_APP_ID', this.options.appId ?? env.AMAZON_SP_API_APP_ID);
    const sellerCentralUrl = this.options.sellerCentralUrl ?? env.AMAZON_SELLER_CENTRAL_URL;
    const state = this.createState({ userId, userType, redirectUri });
    const authorizationUrl = new URL('/apps/authorize/consent', sellerCentralUrl);
    authorizationUrl.searchParams.set('application_id', appId);
    authorizationUrl.searchParams.set('state', state);
    const oauthVersion = this.options.oauthVersion ?? env.AMAZON_OAUTH_VERSION;
    if (oauthVersion) authorizationUrl.searchParams.set('version', oauthVersion);

    return { authorizationUrl: authorizationUrl.toString(), state };
  }

  async completeOAuth(input: {
    userId: number;
    userType: AmazonUserType;
    code: string;
    sellingPartnerId: string;
    state: string;
  }) {
    const state = this.verifyState(input.state);
    if (state.userId !== input.userId || state.userType !== input.userType) {
      throw new AmazonConnectionError('Amazon authorization state does not belong to this user', 403, 'AMAZON_OAUTH_STATE_MISMATCH');
    }

    const tokens = await this.exchangeToken({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: state.redirectUri,
    });
    if (!tokens.refresh_token) {
      throw new AmazonConnectionError('Amazon did not return a refresh token', 502, 'AMAZON_REFRESH_TOKEN_MISSING');
    }

    const encryptedRefreshToken = this.tokenCrypto.encrypt(tokens.refresh_token);
    const sellerId = input.sellingPartnerId.trim();
    if (!sellerId) throw new AmazonConnectionError('Amazon seller ID is required');
    const marketplaceId = this.options.marketplaceId ?? env.AMAZON_MARKETPLACE_ID;
    const now = this.now();
    const existing = await prisma.amazonConnection.findFirst({
      where: { userId: input.userId, userType: input.userType, sellerId, marketplaceId },
      select: { id: true },
    });

    const connection = existing
      ? await prisma.amazonConnection.update({
          where: { id: existing.id },
          data: { refreshToken: encryptedRefreshToken, marketplaceId, updatedAt: now },
        })
      : await prisma.amazonConnection.create({
          data: {
            userId: input.userId,
            userType: input.userType,
            sellerId,
            refreshToken: encryptedRefreshToken,
            marketplaceId,
            createdAt: now,
            updatedAt: now,
          },
        });

    return this.serializeConnection(connection, 'HEALTHY');
  }

  async getConnectionStatus(userId: number, userType: AmazonUserType) {
    const connection = await prisma.amazonConnection.findFirst({
      where: { userId, userType },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    if (!connection) return null;
    const latestSuccessfulSync = await prisma.channelSyncLog.findFirst({
      where: {
        marketplace: 'AMAZON',
        environment: 'PRODUCTION',
        sellerId: connection.sellerId,
        marketplaceId: connection.marketplaceId,
        status: 'SUCCESS',
      },
      orderBy: { finishedAt: 'desc' },
      select: { finishedAt: true },
    });
    const lastSuccessfulSyncAt = latestSuccessfulSync?.finishedAt?.toISOString() ?? null;

    try {
      const refreshToken = this.tokenCrypto.decrypt(connection.refreshToken);
      await this.exchangeToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
      return this.serializeConnection(connection, 'HEALTHY', lastSuccessfulSyncAt);
    } catch {
      return this.serializeConnection(connection, 'NEEDS_ATTENTION', lastSuccessfulSyncAt);
    }
  }

  async disconnect(userId: number, userType: AmazonUserType): Promise<boolean> {
    const result = await prisma.amazonConnection.deleteMany({ where: { userId, userType } });
    return result.count > 0;
  }

  private async exchangeToken(grant: Record<string, string>): Promise<LwaTokenResponse> {
    const clientId = required('AMAZON_CLIENT_ID', this.options.clientId ?? env.AMAZON_CLIENT_ID);
    const clientSecret = required('AMAZON_CLIENT_SECRET', this.options.clientSecret ?? env.AMAZON_CLIENT_SECRET);
    const response = await this.fetchImpl(AMAZON_LWA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8', Accept: 'application/json' },
      body: new URLSearchParams({ ...grant, client_id: clientId, client_secret: clientSecret }),
    });
    if (!response.ok) {
      throw new AmazonConnectionError('Amazon authorization is invalid or has expired', 401, 'AMAZON_INVALID_AUTHORIZATION');
    }
    return response.json() as Promise<LwaTokenResponse>;
  }

  private createState(input: Pick<OAuthState, 'userId' | 'userType' | 'redirectUri'>): string {
    const issuedAt = this.now();
    const ttl = (this.options.stateTtlSeconds ?? env.AMAZON_OAUTH_STATE_TTL_SECONDS) * 1000;
    const payload: OAuthState = {
      ...input,
      issuedAt,
      expiresAt: issuedAt + ttl,
      nonce: randomBytes(18).toString('base64url'),
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.sign(encoded)}`;
  }

  private verifyState(value: string): OAuthState {
    const [encoded, signature] = value.split('.');
    if (!encoded || !signature) throw new AmazonConnectionError('Invalid Amazon authorization state', 400, 'AMAZON_OAUTH_STATE_INVALID');
    const expected = Buffer.from(this.sign(encoded), 'base64url');
    const actual = Buffer.from(signature, 'base64url');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new AmazonConnectionError('Invalid Amazon authorization state', 400, 'AMAZON_OAUTH_STATE_INVALID');
    }

    let payload: OAuthState;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as OAuthState;
    } catch {
      throw new AmazonConnectionError('Invalid Amazon authorization state', 400, 'AMAZON_OAUTH_STATE_INVALID');
    }
    if (payload.expiresAt < this.now()) {
      throw new AmazonConnectionError('Amazon authorization request expired; reconnect Amazon', 400, 'AMAZON_OAUTH_STATE_EXPIRED');
    }
    return payload;
  }

  private sign(value: string): string {
    const secret = required(
      'AMAZON_TOKEN_ENCRYPTION_KEY',
      this.options.stateSecret ?? env.AMAZON_TOKEN_ENCRYPTION_KEY
    );
    return createHmac('sha256', secret).update(value).digest('base64url');
  }

  private serializeConnection(
    connection: { sellerId: string; marketplaceId: string; createdAt: bigint | null; updatedAt: bigint | null },
    tokenHealth: 'HEALTHY' | 'NEEDS_ATTENTION',
    lastSuccessfulSyncAt: string | null = null
  ) {
    return {
      sellerId: connection.sellerId,
      marketplaceId: connection.marketplaceId,
      authorizationMode: 'OAUTH' as const,
      tokenHealth,
      connectedAt: connection.createdAt === null ? null : new Date(Number(connection.createdAt)).toISOString(),
      updatedAt: connection.updatedAt === null ? null : new Date(Number(connection.updatedAt)).toISOString(),
      lastSuccessfulSyncAt,
    };
  }
}

export const amazonConnectionService = new AmazonConnectionService();
export type { AmazonUserType };
