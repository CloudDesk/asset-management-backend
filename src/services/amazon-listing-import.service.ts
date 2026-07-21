import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import {
  AmazonImportSummary,
  AmazonListingPersistence,
  AmazonListingQuery,
  amazonListingRepository,
} from '../repositories/amazon-listing.repository.js';
import {
  isInactiveAmazonListing,
  normalizeAmazonListing,
  NormalizedAmazonListing,
} from './amazon-listing-normalizer.js';
import {
  AmazonListingsReadClient,
  AmazonSpApiError,
  amazonProductionListingsClient,
} from './amazon-production-listings.client.js';
import { AmazonAuthorizationError } from './amazon-lwa-token.service.js';

export class AmazonListingImportDisabledError extends Error {
  readonly statusCode = 503;
  readonly code = 'AMAZON_LISTING_IMPORT_DISABLED';

  constructor() {
    super('Amazon production listing import is disabled');
    this.name = 'AmazonListingImportDisabledError';
  }
}

type ImportRequestContext = {
  requestedByUserId?: number;
  requestedByUserType?: string;
  sellerId?: string;
  marketplaceId?: string;
  client?: AmazonListingsReadClient;
};

type AmazonListingImportServiceOptions = {
  client?: AmazonListingsReadClient;
  repository?: AmazonListingPersistence;
  enabled?: boolean;
};

const emptySummary = (): AmazonImportSummary => ({
  totalFetched: 0,
  created: 0,
  updated: 0,
  unmapped: 0,
  conflicts: 0,
  inactive: 0,
  failed: 0,
});

const safeError = (error: unknown): { code: string; message: string; statusCode: number } => {
  if (error instanceof AmazonAuthorizationError) {
    return {
      code: error.code,
      message: 'Amazon authorization is invalid or has expired',
      statusCode: error.statusCode,
    };
  }
  if (error instanceof AmazonSpApiError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    };
  }
  if (error instanceof AmazonListingImportDisabledError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    };
  }

  return {
    code: 'AMAZON_LISTING_IMPORT_FAILED',
    message: 'Amazon production listing import failed',
    statusCode: 500,
  };
};

const listingSignature = (listing: NormalizedAmazonListing): string => JSON.stringify({
  ...listing,
  amazonLastUpdatedAt: listing.amazonLastUpdatedAt?.toISOString() ?? null,
});

export class AmazonListingImportService {
  private readonly client: AmazonListingsReadClient;
  private readonly repository: AmazonListingPersistence;
  private readonly enabled: boolean;
  private readonly runningImports = new Map<string, Promise<AmazonImportSummary>>();

  constructor(options: AmazonListingImportServiceOptions = {}) {
    this.client = options.client ?? amazonProductionListingsClient;
    this.repository = options.repository ?? amazonListingRepository;
    this.enabled = options.enabled ?? env.AMAZON_LISTING_IMPORT_ENABLED;
  }

  importListings(context: ImportRequestContext = {}): Promise<AmazonImportSummary> {
    if (!this.enabled) {
      throw new AmazonListingImportDisabledError();
    }

    const client = context.client ?? this.client;
    const sellerId = context.sellerId ?? client.getSellerId();
    const marketplaceId = context.marketplaceId ?? client.getMarketplaceId();
    const key = `${sellerId}|${marketplaceId}`;
    let runningImport = this.runningImports.get(key);
    if (!runningImport) {
      runningImport = this.runImport(context, client, sellerId, marketplaceId).finally(() => {
        this.runningImports.delete(key);
      });
      this.runningImports.set(key, runningImport);
    }
    return runningImport;
  }

  async listListings(
    filters: Omit<AmazonListingQuery, 'sellerId' | 'marketplaceId'>,
    scope?: Pick<AmazonListingQuery, 'sellerId' | 'marketplaceId'>
  ) {
    return this.repository.listListings({
      ...filters,
      sellerId: scope?.sellerId ?? this.client.getSellerId(),
      marketplaceId: scope?.marketplaceId ?? this.client.getMarketplaceId(),
    });
  }

  private async runImport(
    context: ImportRequestContext,
    client: AmazonListingsReadClient,
    sellerId: string,
    marketplaceId: string
  ): Promise<AmazonImportSummary> {
    const summary = emptySummary();
    const syncLogId = await this.repository.startSyncLog({
      sellerId,
      marketplaceId,
      ...(context.requestedByUserId !== undefined
        ? { requestedByUserId: context.requestedByUserId }
        : {}),
      ...(context.requestedByUserType !== undefined
        ? { requestedByUserType: context.requestedByUserType }
        : {}),
    });

    try {
      const fbaInventoryBySku = await this.fetchFbaInventoryBySku(client);
      const seenListings = new Map<string, string>();
      const seenPageTokens = new Set<string>();
      let pageToken: string | undefined;

      do {
        const page = await client.fetchListingsPage(pageToken);
        summary.totalFetched += page.items.length;

        for (const rawListing of page.items) {
          const sellerSku = rawListing.sku?.trim();
          const normalized = normalizeAmazonListing(rawListing, {
            sellerId,
            marketplaceId,
            ...(sellerSku && fbaInventoryBySku.has(sellerSku)
              ? { fbaInventory: fbaInventoryBySku.get(sellerSku)! }
              : {}),
          });

          if (!normalized.sellerSku) {
            summary.failed += 1;
            continue;
          }

          const key = `${normalized.marketplace}|${normalized.marketplaceId}|${normalized.sellerId}|${normalized.sellerSku}`;
          const signature = listingSignature(normalized);
          const previousSignature = seenListings.get(key);
          if (previousSignature !== undefined) {
            if (previousSignature !== signature) summary.conflicts += 1;
            continue;
          }
          seenListings.set(key, signature);

          try {
            const result = await this.repository.upsertImportedListing({
              ...normalized,
              sellerSku: normalized.sellerSku,
            }, {
              syncLogId,
              ...(context.requestedByUserId !== undefined
                ? { requestedByUserId: context.requestedByUserId }
                : {}),
              ...(context.requestedByUserType !== undefined
                ? { requestedByUserType: context.requestedByUserType }
                : {}),
            });
            if (result.outcome === 'CREATED') summary.created += 1;
            if (result.outcome === 'UPDATED') summary.updated += 1;
            if (!result.isMapped) summary.unmapped += 1;
            if (isInactiveAmazonListing(normalized.listingStatus)) summary.inactive += 1;
          } catch {
            summary.failed += 1;
          }
        }

        if (page.nextToken) {
          if (seenPageTokens.has(page.nextToken)) {
            throw new AmazonSpApiError(
              'Amazon returned a repeated listings pagination token',
              502,
              'AMAZON_PAGINATION_CONFLICT'
            );
          }
          seenPageTokens.add(page.nextToken);
          pageToken = page.nextToken;
        } else {
          pageToken = undefined;
        }
      } while (pageToken);

      const status = summary.failed > 0 || summary.conflicts > 0 ? 'PARTIAL' : 'SUCCESS';
      await this.repository.finishSyncLog(syncLogId, status, summary);
      logger.info(
        { sellerId, marketplaceId, status, ...summary },
        'Amazon production listings imported in read-only mode'
      );

      return summary;
    } catch (error) {
      const sanitized = safeError(error);
      await this.repository.finishSyncLog(syncLogId, 'FAILED', summary, {
        code: sanitized.code,
        message: sanitized.message,
      });
      logger.error(
        { sellerId, marketplaceId, code: sanitized.code, statusCode: sanitized.statusCode },
        'Amazon production listing import failed'
      );
      throw error;
    }
  }

  private async fetchFbaInventoryBySku(client: AmazonListingsReadClient) {
    const inventory = new Map<string, Awaited<ReturnType<AmazonListingsReadClient['fetchFbaInventoryPage']>>['items'][number]>();
    const seenTokens = new Set<string>();
    let nextToken: string | undefined;

    do {
      const page = await client.fetchFbaInventoryPage(nextToken);
      for (const item of page.items) {
        const sellerSku = item.sellerSku?.trim();
        if (sellerSku) inventory.set(sellerSku, item);
      }

      if (page.nextToken) {
        if (seenTokens.has(page.nextToken)) {
          throw new AmazonSpApiError(
            'Amazon returned a repeated FBA pagination token',
            502,
            'AMAZON_PAGINATION_CONFLICT'
          );
        }
        seenTokens.add(page.nextToken);
        nextToken = page.nextToken;
      } else {
        nextToken = undefined;
      }
    } while (nextToken);

    return inventory;
  }
}

export const amazonListingImportService = new AmazonListingImportService();
export const sanitizeAmazonListingImportError = safeError;
