import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { NormalizedAmazonListing } from '../services/amazon-listing-normalizer.js';
import { buildCatalogWordStats, keyWords, scoreNameMatch, isSameAsin } from '../utils/amazonProductMatch.js';
import { calculateAmazonTargetQuantity } from '../utils/amazonStockTarget.js';

export type AmazonListingUpsertResult = {
  outcome: 'CREATED' | 'UPDATED' | 'UNCHANGED';
  isMapped: boolean;
};

export type AmazonListingAuditContext = {
  syncLogId?: string;
  requestedByUserId?: number;
  requestedByUserType?: string;
};

export type AmazonListingQuery = {
  sellerId: string;
  marketplaceId: string;
  search?: string | undefined;
  mappingStatus?: string | undefined;
  fulfilmentChannel?: string | undefined;
  listingStatus?: string | undefined;
  productId?: string | undefined;
  activeOnly?: boolean | undefined;
  page: number;
  limit: number;
};

export type AmazonImportSummary = {
  totalFetched: number;
  created: number;
  updated: number;
  unmapped: number;
  conflicts: number;
  inactive: number;
  failed: number;
};

export type AmazonListingMappingRepositoryResult =
  | { status: 'MAPPED'; listing: Record<string, unknown> }
  | { status: 'LISTING_NOT_FOUND' }
  | { status: 'PRODUCT_NOT_FOUND' }
  | { status: 'REMAP_REQUIRES_CONFIRMATION'; currentProductId: string };

export interface AmazonListingMappingPersistence {
  mapListing(input: {
    listingId: string;
    productId: string;
    unitsPerListing: number;
    allowRemap: boolean;
    sellerId: string;
    marketplaceId: string;
    requestedByUserId?: number;
    requestedByUserType?: string;
  }): Promise<AmazonListingMappingRepositoryResult>;
  unmapListing(input: {
    listingId: string;
    sellerId: string;
    marketplaceId: string;
    requestedByUserId?: number;
    requestedByUserType?: string;
  }): Promise<Record<string, unknown> | null>;
}

export interface AmazonListingPersistence {
  startSyncLog(input: {
    sellerId: string;
    marketplaceId: string;
    requestedByUserId?: number;
    requestedByUserType?: string;
  }): Promise<string>;
  finishSyncLog(
    id: string,
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED',
    summary: AmazonImportSummary,
    error?: { code: string; message: string }
  ): Promise<void>;
  upsertImportedListing(
    listing: NormalizedAmazonListing & { sellerSku: string },
    auditContext?: AmazonListingAuditContext
  ): Promise<AmazonListingUpsertResult>;
  markListingsMissingFromImport(input: {
    sellerId: string;
    marketplaceId: string;
    seenSellerSkus: string[];
    auditContext?: AmazonListingAuditContext;
  }): Promise<number>;
  listListings(query: AmazonListingQuery): Promise<{
    data: Array<Record<string, unknown>>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }>;
}

const importedFieldValues = (listing: NormalizedAmazonListing & { sellerSku: string }) => ({
  environment: listing.environment,
  asin: listing.asin,
  fnSku: listing.fnSku,
  title: listing.title,
  productType: listing.productType,
  listingStatus: listing.listingStatus,
  originalFulfilmentValue: listing.originalFulfilmentValue,
  fulfilmentChannel: listing.fulfilmentChannel,
  publishedQuantity: listing.publishedQuantity,
  fbaFulfillableQuantity: listing.fbaFulfillableQuantity,
  fbaReservedQuantity: listing.fbaReservedQuantity,
  fbaPendingOrderQuantity: listing.fbaPendingOrderQuantity,
  fbaTotalQuantity: listing.fbaTotalQuantity,
  price: listing.price,
  currency: listing.currency,
  amazonLastUpdatedAt: listing.amazonLastUpdatedAt,
});

const importedSnapshot = (listing: {
  environment: string;
  asin: string | null;
  fnSku: string | null;
  title: string | null;
  productType: string | null;
  listingStatus: string;
  originalFulfilmentValue: string | null;
  fulfilmentChannel: string;
  publishedQuantity: number | null;
  fbaFulfillableQuantity: number | null;
  fbaReservedQuantity: number | null;
  fbaPendingOrderQuantity: number | null;
  fbaTotalQuantity: number | null;
  price: Prisma.Decimal | string | null;
  currency: string | null;
  amazonLastUpdatedAt: Date | null;
}): Record<string, string | number | null> => ({
  environment: listing.environment,
  asin: listing.asin,
  fnSku: listing.fnSku,
  title: listing.title,
  productType: listing.productType,
  listingStatus: listing.listingStatus,
  originalFulfilmentValue: listing.originalFulfilmentValue,
  fulfilmentChannel: listing.fulfilmentChannel,
  publishedQuantity: listing.publishedQuantity,
  fbaFulfillableQuantity: listing.fbaFulfillableQuantity,
  fbaReservedQuantity: listing.fbaReservedQuantity,
  fbaPendingOrderQuantity: listing.fbaPendingOrderQuantity,
  fbaTotalQuantity: listing.fbaTotalQuantity,
  price: listing.price === null ? null : listing.price.toString(),
  currency: listing.currency,
  amazonLastUpdatedAt: listing.amazonLastUpdatedAt?.toISOString() ?? null,
});

const changedSnapshotFields = (
  before: Record<string, string | number | null>,
  after: Record<string, string | number | null>
): string[] => Object.keys(after).filter((field) => before[field] !== after[field]);

const selectSnapshotFields = (
  snapshot: Record<string, string | number | null>,
  fields: string[]
): Prisma.InputJsonObject => Object.fromEntries(fields.map((field) => [field, snapshot[field] ?? null]));

const actorData = (context: AmazonListingAuditContext = {}) => ({
  ...(context.requestedByUserId !== undefined
    ? { requestedByUserId: context.requestedByUserId }
    : {}),
  ...(context.requestedByUserType !== undefined
    ? { requestedByUserType: context.requestedByUserType }
    : {}),
});

const mirrorFbaPlatformStock = async (
  transaction: Prisma.TransactionClient,
  listing: {
    fulfilmentChannel: string;
    productId: bigint | null;
    mappingStatus: string;
    publishedQuantity: number | null;
    fbaFulfillableQuantity: number | null;
    fbaPendingOrderQuantity: number | null;
    fbaReservedQuantity: number | null;
    fbaTotalQuantity: number | null;
  }
) => {
  if (
    listing.fulfilmentChannel !== 'FBA'
    || listing.productId === null
    || listing.mappingStatus !== 'MAPPED'
  ) return;

  const available = listing.fbaFulfillableQuantity ?? listing.publishedQuantity ?? 0;
  const ordered = listing.fbaPendingOrderQuantity ?? 0;
  const total = listing.fbaTotalQuantity
    ?? available + (listing.fbaReservedQuantity ?? 0);
  const stockData = {
    availableqty: available,
    orderedqty: ordered,
    totalqty: total,
    ecomqty: available,
    platformstatus: available > 5 ? 'in_stock' : available > 0 ? 'low_stock' : 'out_of_stock',
    modifieddate: BigInt(Date.now()),
  };
  const existingStock = await transaction.platformStock.findFirst({
    where: {
      productid: listing.productId,
      platform: { equals: 'amazon', mode: 'insensitive' },
    },
  });
  if (existingStock) {
    await transaction.platformStock.update({
      where: { id: existingStock.id },
      data: stockData,
    });
  } else {
    await transaction.platformStock.create({
      data: {
        productid: listing.productId,
        platform: 'amazon',
        soldqty: 0,
        lockqty: 0,
        createddate: BigInt(Date.now()),
        ...stockData,
      },
    });
  }
};

type FbaOrderAccounting = { ordered: number; sold: number };

const serializeListing = (
  listing: any,
  fbaOrderAccounting: FbaOrderAccounting = { ordered: 0, sold: 0 }
): Record<string, unknown> => ({
  id: String(listing.id),
  marketplace: listing.marketplace,
  environment: listing.environment,
  marketplaceId: listing.marketplaceId,
  sellerId: listing.sellerId,
  sellerSku: listing.sellerSku,
  asin: listing.asin,
  fnSku: listing.fnSku,
  title: listing.title,
  productType: listing.productType,
  listingStatus: listing.listingStatus,
  originalFulfilmentValue: listing.originalFulfilmentValue,
  fulfilmentChannel: listing.fulfilmentChannel,
  publishedQuantity: listing.publishedQuantity,
  fbaInventory: listing.fulfilmentChannel === 'FBA' ? {
    available: listing.fbaFulfillableQuantity,
    reserved: listing.fbaReservedQuantity,
    pendingCustomerOrders: listing.fbaPendingOrderQuantity,
    total: listing.fbaTotalQuantity,
    trackedOrdered: fbaOrderAccounting.ordered,
    trackedSold: fbaOrderAccounting.sold,
    source: 'AMAZON_READ_ONLY',
  } : null,
  price: listing.price?.toString() ?? null,
  currency: listing.currency,
  amazonLastUpdatedAt: listing.amazonLastUpdatedAt?.toISOString() ?? null,
  productId: listing.productId === null ? null : String(listing.productId),
  mappingStatus: listing.mappingStatus,
  unitsPerListing: listing.unitsPerListing,
  mappedAt: listing.mappedAt?.toISOString() ?? null,
  inventorySyncMode: listing.inventorySyncMode,
  lastInventorySyncAt: listing.lastInventorySyncAt?.toISOString() ?? null,
  lastInventorySyncStatus: listing.lastInventorySyncStatus,
  lastSyncedQuantity: listing.lastSyncedQuantity,
  pendingOfferPrice: listing.pendingOfferPrice?.toString() ?? null,
  pendingOfferQuantity: listing.pendingOfferQuantity,
  pendingHandlingTimeDays: listing.pendingHandlingTimeDays,
  lastOfferUpdateAt: listing.lastOfferUpdateAt?.toISOString() ?? null,
  lastOfferUpdateStatus: listing.lastOfferUpdateStatus,
  lastOfferSubmissionId: listing.lastOfferSubmissionId,
  lastImportedAt: listing.lastImportedAt.toISOString(),
  createdAt: listing.createdAt.toISOString(),
  updatedAt: listing.updatedAt.toISOString(),
  mappedProduct: listing.product ? {
    id: String(listing.product.id),
    puc: listing.product.puc,
    name: listing.product.name,
  } : null,
});

const getFbaOrderAccounting = async (listingIds: bigint[]) => {
  if (listingIds.length === 0) return new Map<string, FbaOrderAccounting>();
  const grouped = await prisma.amazonOrderStockReservation.groupBy({
    by: ['listingId', 'status'],
    where: {
      listingId: { in: listingIds },
      inventoryOwnership: 'AMAZON_FBA',
      status: { in: ['RESERVED', 'SOLD'] },
    },
    _sum: { quantity: true },
  });
  const accounting = new Map<string, FbaOrderAccounting>();
  for (const row of grouped) {
    if (row.listingId === null) continue;
    const key = String(row.listingId);
    const current = accounting.get(key) ?? { ordered: 0, sold: 0 };
    const quantity = row._sum.quantity ?? 0;
    if (row.status === 'RESERVED') current.ordered += quantity;
    if (row.status === 'SOLD') current.sold += quantity;
    accounting.set(key, current);
  }
  return accounting;
};

const listingIssues = (listing: any) => {
  const issues: Array<{ code: string; severity: 'INFO' | 'WARNING' | 'ERROR'; message: string }> = [];
  if (listing.mappingStatus === 'UNMAPPED') {
    issues.push({ code: 'UNMAPPED_PRODUCT', severity: 'WARNING', message: 'No Nivaana product is mapped.' });
  }
  if (listing.mappingStatus === 'CONFLICT') {
    issues.push({ code: 'MAPPING_CONFLICT', severity: 'ERROR', message: 'This listing has conflicting imported data or mapping state.' });
  }
  if (!listing.asin) issues.push({ code: 'MISSING_ASIN', severity: 'WARNING', message: 'Amazon did not provide an ASIN.' });
  if (!listing.title) issues.push({ code: 'MISSING_TITLE', severity: 'INFO', message: 'Amazon did not provide a listing title.' });
  if (listing.publishedQuantity === null) {
    issues.push({ code: 'QUANTITY_UNAVAILABLE', severity: 'INFO', message: 'Published quantity is unavailable.' });
  }
  if (listing.fulfilmentChannel === 'UNKNOWN') {
    issues.push({ code: 'UNKNOWN_FULFILMENT', severity: 'WARNING', message: 'Fulfilment type could not be classified.' });
  }
  if (/(inactive|deleted|blocked|suppressed)/i.test(listing.listingStatus)) {
    issues.push({ code: 'INACTIVE_LISTING', severity: 'WARNING', message: `Amazon listing status is ${listing.listingStatus}.` });
  }
  return issues;
};

// Mapping suggestions (FIX-126): weaker ones are noise, and the dialog shows a short list
const SUGGESTION_MIN_SCORE = 25;
const SUGGESTION_LIMIT = 4;
const SUGGESTION_CATALOG_LIMIT = 5000;

export class AmazonListingRepository implements AmazonListingPersistence, AmazonListingMappingPersistence {
  async startSyncLog(input: {
    sellerId: string;
    marketplaceId: string;
    requestedByUserId?: number;
    requestedByUserType?: string;
  }): Promise<string> {
    const log = await prisma.channelSyncLog.create({
      data: {
        marketplace: 'AMAZON',
        environment: 'PRODUCTION',
        operation: 'LISTING_IMPORT',
        status: 'RUNNING',
        marketplaceId: input.marketplaceId,
        sellerId: input.sellerId,
        requestedByUserId: input.requestedByUserId ?? null,
        requestedByUserType: input.requestedByUserType ?? null,
      },
      select: { id: true },
    });

    return String(log.id);
  }

  async finishSyncLog(
    id: string,
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED',
    summary: AmazonImportSummary,
    error?: { code: string; message: string }
  ): Promise<void> {
    await prisma.channelSyncLog.update({
      where: { id: BigInt(id) },
      data: {
        status,
        ...summary,
        errorCode: error?.code ?? null,
        errorMessage: error?.message ?? null,
        finishedAt: new Date(),
      },
    });
  }

  async upsertImportedListing(
    listing: NormalizedAmazonListing & { sellerSku: string },
    auditContext: AmazonListingAuditContext = {}
  ): Promise<AmazonListingUpsertResult> {
    const unique = {
      marketplace: listing.marketplace,
      marketplaceId: listing.marketplaceId,
      sellerId: listing.sellerId,
      sellerSku: listing.sellerSku,
    };
    const where = { marketplace_marketplaceId_sellerId_sellerSku: unique };
    const importedValues = importedFieldValues(listing);

    const existing = await prisma.marketplaceListing.findUnique({ where });
    if (!existing) {
      try {
        await prisma.$transaction(async (transaction) => {
          const created = await transaction.marketplaceListing.create({
            data: {
              ...unique,
              ...importedValues,
              productId: null,
              mappingStatus: 'UNMAPPED',
              lastImportedAt: new Date(),
            },
            select: { id: true },
          });
          const after = importedSnapshot(importedValues);
          await transaction.marketplaceListingAudit.create({
            data: {
              listingId: created.id,
              ...(auditContext.syncLogId ? { syncLogId: BigInt(auditContext.syncLogId) } : {}),
              ...unique,
              environment: listing.environment,
              operation: 'IMPORT_CREATED',
              changedFields: Object.keys(after),
              afterValues: after,
              ...actorData(auditContext),
            },
          });
        });
        return { outcome: 'CREATED', isMapped: false };
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
          throw error;
        }
        return this.upsertImportedListing(listing, auditContext);
      }
    }

    const before = importedSnapshot(existing);
    const after = importedSnapshot(importedValues);
    const changedFields = changedSnapshotFields(before, after);
    const changed = changedFields.length > 0;

    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.marketplaceListing.update({
        where,
        data: {
          ...(changed ? importedValues : {}),
          ...(listing.fulfilmentChannel === 'FBA' ? { inventorySyncMode: 'DISABLED' } : {}),
          lastImportedAt: new Date(),
        },
      });
      await mirrorFbaPlatformStock(transaction, updated);
      if (changed) {
        await transaction.marketplaceListingAudit.create({
          data: {
            listingId: existing.id,
            ...(auditContext.syncLogId ? { syncLogId: BigInt(auditContext.syncLogId) } : {}),
            ...unique,
            environment: listing.environment,
            operation: 'IMPORT_UPDATED',
            changedFields,
            beforeValues: selectSnapshotFields(before, changedFields),
            afterValues: selectSnapshotFields(after, changedFields),
            previousProductId: existing.productId,
            productId: existing.productId,
            ...actorData(auditContext),
          },
        });
      }
    });

    return {
      outcome: changed ? 'UPDATED' : 'UNCHANGED',
      isMapped: existing.productId !== null && existing.mappingStatus === 'MAPPED',
    };
  }

  async markListingsMissingFromImport(input: {
    sellerId: string;
    marketplaceId: string;
    seenSellerSkus: string[];
    auditContext?: AmazonListingAuditContext;
  }): Promise<number> {
    const missing = await prisma.marketplaceListing.findMany({
      where: {
        marketplace: 'AMAZON',
        environment: 'PRODUCTION',
        marketplaceId: input.marketplaceId,
        sellerId: input.sellerId,
        NOT: { listingStatus: { equals: 'DELETED', mode: 'insensitive' } },
        ...(input.seenSellerSkus.length > 0
          ? { sellerSku: { notIn: input.seenSellerSkus } }
          : {}),
      },
    });
    if (missing.length === 0) return 0;

    await prisma.$transaction(async (transaction) => {
      for (let offset = 0; offset < missing.length; offset += 500) {
        const batch = missing.slice(offset, offset + 500);
        const changedFields = [
          'listingStatus',
          'publishedQuantity',
          'fbaFulfillableQuantity',
          'fbaReservedQuantity',
          'fbaPendingOrderQuantity',
          'fbaTotalQuantity',
          'inventorySyncMode',
        ];
        for (const isFba of [true, false]) {
          const ids = batch.filter((listing) => (listing.fulfilmentChannel === 'FBA') === isFba).map((listing) => listing.id);
          if (ids.length === 0) continue;
          await transaction.marketplaceListing.updateMany({
            where: { id: { in: ids } },
            data: {
              listingStatus: 'DELETED',
              publishedQuantity: 0,
              fbaFulfillableQuantity: isFba ? 0 : null,
              fbaReservedQuantity: isFba ? 0 : null,
              fbaPendingOrderQuantity: isFba ? 0 : null,
              fbaTotalQuantity: isFba ? 0 : null,
              inventorySyncMode: 'DISABLED',
              lastImportedAt: new Date(),
            },
          });
        }
        await transaction.marketplaceListingAudit.createMany({
          data: batch.map((listing) => ({
            listingId: listing.id,
            ...(input.auditContext?.syncLogId
              ? { syncLogId: BigInt(input.auditContext.syncLogId) }
              : {}),
            marketplace: listing.marketplace,
            environment: listing.environment,
            marketplaceId: listing.marketplaceId,
            sellerId: listing.sellerId,
            sellerSku: listing.sellerSku,
            operation: 'IMPORT_DELETED',
            changedFields,
            beforeValues: {
              listingStatus: listing.listingStatus,
              publishedQuantity: listing.publishedQuantity,
              fbaFulfillableQuantity: listing.fbaFulfillableQuantity,
              fbaReservedQuantity: listing.fbaReservedQuantity,
              fbaPendingOrderQuantity: listing.fbaPendingOrderQuantity,
              fbaTotalQuantity: listing.fbaTotalQuantity,
              inventorySyncMode: listing.inventorySyncMode,
            },
            afterValues: {
              listingStatus: 'DELETED',
              publishedQuantity: 0,
              fbaFulfillableQuantity: listing.fulfilmentChannel === 'FBA' ? 0 : null,
              fbaReservedQuantity: listing.fulfilmentChannel === 'FBA' ? 0 : null,
              fbaPendingOrderQuantity: listing.fulfilmentChannel === 'FBA' ? 0 : null,
              fbaTotalQuantity: listing.fulfilmentChannel === 'FBA' ? 0 : null,
              inventorySyncMode: 'DISABLED',
            },
            previousProductId: listing.productId,
            productId: listing.productId,
            ...actorData(input.auditContext),
          })),
        });
      }
    });

    return missing.length;
  }

  async listListings(query: AmazonListingQuery) {
    const where: Prisma.MarketplaceListingWhereInput = {
      marketplace: 'AMAZON',
      environment: 'PRODUCTION',
      marketplaceId: query.marketplaceId,
      sellerId: query.sellerId,
    };

    if (query.mappingStatus) where.mappingStatus = query.mappingStatus;
    if (query.fulfilmentChannel) where.fulfilmentChannel = query.fulfilmentChannel;
    if (query.productId) where.productId = BigInt(query.productId);
    if (query.listingStatus) {
      where.listingStatus = { contains: query.listingStatus, mode: 'insensitive' };
    }
    // Default catalogue/mapping requests show current listings. An explicit
    // status filter or activeOnly=false still provides access to history.
    if (query.activeOnly ?? !query.listingStatus) {
      where.NOT = {
        listingStatus: { contains: 'DELETED', mode: 'insensitive' },
      };
    }
    if (query.search) {
      where.OR = [
        { sellerSku: { contains: query.search, mode: 'insensitive' } },
        { asin: { contains: query.search, mode: 'insensitive' } },
        { fnSku: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
      prisma.marketplaceListing.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        include: {
          product: {
            select: { id: true, puc: true, name: true },
          },
        },
      }),
      prisma.marketplaceListing.count({ where }),
    ]);
    const fbaAccounting = await getFbaOrderAccounting(
      items.filter((item) => item.fulfilmentChannel === 'FBA').map((item) => item.id)
    );
    // Stock Sync columns: Nivaana "amazon" platform stock and the quantity a sync would publish
    const sellerFulfilledProductIds = [...new Set(items.flatMap((item) =>
      item.productId !== null && item.mappingStatus === 'MAPPED' && item.fulfilmentChannel !== 'FBA' ? [item.productId] : []))];
    const platformStocks = sellerFulfilledProductIds.length === 0 ? [] : await prisma.platformStock.findMany({
      where: { productid: { in: sellerFulfilledProductIds }, platform: { equals: 'amazon', mode: 'insensitive' } },
      select: { productid: true, availableqty: true },
    });
    const amazonStockByProduct = new Map(platformStocks.map((stock) => [String(stock.productid), Math.max(0, Math.trunc(stock.availableqty))]));
    const totalPages = Math.ceil(total / query.limit);

    return {
      data: items.map((item) => {
        const available = item.productId === null ? undefined : amazonStockByProduct.get(String(item.productId));
        return {
          ...serializeListing(item, fbaAccounting.get(String(item.id))),
          nivaanaStock: available === undefined ? null : {
            available,
            target: calculateAmazonTargetQuantity(available, item.unitsPerListing),
          },
        };
      }),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNext: query.page < totalPages,
        hasPrev: query.page > 1,
      },
    };
  }

  async getListingDetails(input: { listingId: string; sellerId: string; marketplaceId: string }) {
    const listing = await prisma.marketplaceListing.findFirst({
      where: {
        id: BigInt(input.listingId),
        marketplace: 'AMAZON',
        environment: 'PRODUCTION',
        sellerId: input.sellerId,
        marketplaceId: input.marketplaceId,
      },
      include: { product: { select: { id: true, puc: true, name: true } } },
    });
    if (!listing) return null;
    const fbaAccounting = listing.fulfilmentChannel === 'FBA'
      ? await getFbaOrderAccounting([listing.id])
      : new Map<string, FbaOrderAccounting>();
    return {
      ...serializeListing(listing, fbaAccounting.get(String(listing.id))),
      issues: listingIssues(listing),
    };
  }

  async suggestProducts(input: { listingId: string; sellerId: string; marketplaceId: string }) {
    const listing = await prisma.marketplaceListing.findFirst({
      where: {
        id: BigInt(input.listingId),
        marketplace: 'AMAZON',
        environment: 'PRODUCTION',
        sellerId: input.sellerId,
        marketplaceId: input.marketplaceId,
      },
      select: { sellerSku: true, asin: true, title: true, productId: true },
    });
    if (!listing) return null;

    const relatedMappings = await prisma.marketplaceListing.findMany({
      where: {
        marketplace: 'AMAZON',
        productId: { not: null },
        OR: [
          ...(listing.asin ? [{ asin: listing.asin }] : []),
          { sellerSku: { equals: listing.sellerSku, mode: 'insensitive' as const } },
        ],
      },
      select: { productId: true },
      take: 20,
    });
    const historicalIds = [...new Set(
      relatedMappings.flatMap((item) => item.productId === null ? [] : [item.productId])
    )];
    // Whole catalogue: word frequencies need every product name, and every product can be scored
    const products = await prisma.product.findMany({
      select: { id: true, puc: true, name: true, productstatus: true, asin: true },
      orderBy: { id: 'asc' },
      take: SUGGESTION_CATALOG_LIMIT,
    });
    const catalogStats = buildCatalogWordStats(products.map((product) => product.name));
    const listingWords = keyWords(`${listing.sellerSku} ${listing.title ?? ''}`, catalogStats);

    return products
      .map((product) => {
        const reasons: string[] = [];
        let score = 0;
        if (product.id === listing.productId) {
          score += 100;
          reasons.push('Current mapping');
        }
        // Same ASIN on the product (D4): the strongest signal, enough for HIGH on its own
        if (isSameAsin(product.asin, listing.asin)) {
          score += 90;
          reasons.push('Same ASIN');
        }
        if (product.puc.toLowerCase() === listing.sellerSku.toLowerCase()) {
          score += 80;
          reasons.push('Exact SKU and PUC match');
        } else if (
          product.puc.toLowerCase().includes(listing.sellerSku.toLowerCase())
          || listing.sellerSku.toLowerCase().includes(product.puc.toLowerCase())
        ) {
          score += 45;
          reasons.push('Similar SKU and PUC');
        }
        if (historicalIds.some((id) => id === product.id)) {
          score += 35;
          reasons.push('Previously mapped signal');
        }
        const nameMatch = scoreNameMatch(product.name, listingWords, catalogStats);
        if (nameMatch.score > 0) {
          score += nameMatch.score;
          reasons.push(`Name match ${nameMatch.matched.length}/${nameMatch.total}: ${nameMatch.matched.join(', ')}`);
        }
        return {
          product: { id: String(product.id), puc: product.puc, name: product.name, status: product.productstatus },
          score: Math.min(score, 100),
          confidence: score >= 80 ? 'HIGH' : score >= 45 ? 'MEDIUM' : 'LOW',
          reasons,
        };
      })
      .filter((suggestion) => suggestion.score >= SUGGESTION_MIN_SCORE)
      // Equal scores: the shorter (more specific) product name first
      .sort((left, right) => right.score - left.score
        || left.product.name.length - right.product.name.length
        || left.product.name.localeCompare(right.product.name))
      .slice(0, SUGGESTION_LIMIT);
  }

  async listMappingAudits(input: { listingId: string; sellerId: string; marketplaceId: string }) {
    const listing = await prisma.marketplaceListing.findFirst({
      where: {
        id: BigInt(input.listingId),
        marketplace: 'AMAZON',
        environment: 'PRODUCTION',
        sellerId: input.sellerId,
        marketplaceId: input.marketplaceId,
      },
      select: { id: true },
    });
    if (!listing) return null;
    const audits = await prisma.marketplaceListingAudit.findMany({
      where: {
        listingId: listing.id,
        operation: { in: ['MAPPED', 'REMAPPED', 'MAPPING_UPDATED', 'UNMAPPED'] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    // Names for the history: who changed it (Inventory staff or Ecom user) and which products
    const userIds = (type: 'inventory' | 'ecommerce') => [...new Set(audits.flatMap((audit) =>
      audit.requestedByUserId !== null && (audit.requestedByUserType ?? 'inventory') === type ? [audit.requestedByUserId] : []))];
    const productIds = [...new Set(audits.flatMap((audit) =>
      [audit.previousProductId, audit.productId].filter((id): id is bigint => id !== null)))];
    const [inventoryUsers, ecommerceUsers, products] = await Promise.all([
      userIds('inventory').length
        ? prisma.inventoryusers.findMany({ where: { id: { in: userIds('inventory') } }, select: { id: true, firstname: true, lastname: true } })
        : [],
      userIds('ecommerce').length
        ? prisma.users.findMany({ where: { id: { in: userIds('ecommerce') } }, select: { id: true, firstname: true, lastname: true } })
        : [],
      productIds.length
        ? prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, puc: true, name: true } })
        : [],
    ]);
    const fullName = (user: { firstname: string | null; lastname: string | null }) =>
      [user.firstname, user.lastname].map((part) => part?.trim()).filter(Boolean).join(' ') || null;
    const inventoryNames = new Map(inventoryUsers.map((user) => [user.id, fullName(user)]));
    const ecommerceNames = new Map(ecommerceUsers.map((user) => [user.id, fullName(user)]));
    const productById = new Map(products.map((product) => [product.id, { id: String(product.id), puc: product.puc, name: product.name }]));

    return audits.map((audit) => ({
      id: String(audit.id),
      operation: audit.operation,
      changedFields: audit.changedFields,
      beforeValues: audit.beforeValues,
      afterValues: audit.afterValues,
      previousProductId: audit.previousProductId === null ? null : String(audit.previousProductId),
      productId: audit.productId === null ? null : String(audit.productId),
      previousProduct: audit.previousProductId === null ? null : productById.get(audit.previousProductId) ?? null,
      product: audit.productId === null ? null : productById.get(audit.productId) ?? null,
      requestedByUserId: audit.requestedByUserId,
      requestedByUserType: audit.requestedByUserType,
      requestedByName: audit.requestedByUserId === null ? null
        : ((audit.requestedByUserType ?? 'inventory') === 'ecommerce' ? ecommerceNames : inventoryNames).get(audit.requestedByUserId) ?? null,
      createdAt: audit.createdAt.toISOString(),
    }));
  }

  async mapListing(input: {
    listingId: string;
    productId: string;
    unitsPerListing: number;
    allowRemap: boolean;
    sellerId: string;
    marketplaceId: string;
    requestedByUserId?: number;
    requestedByUserType?: string;
  }): Promise<AmazonListingMappingRepositoryResult> {
    return prisma.$transaction(async (transaction) => {
      const listing = await transaction.marketplaceListing.findFirst({
        where: {
          id: BigInt(input.listingId),
          marketplace: 'AMAZON',
          environment: 'PRODUCTION',
          marketplaceId: input.marketplaceId,
          sellerId: input.sellerId,
        },
        select: {
          id: true,
          marketplace: true,
          environment: true,
          marketplaceId: true,
          sellerId: true,
          sellerSku: true,
          productId: true,
          mappingStatus: true,
          unitsPerListing: true,
          mappedAt: true,
        },
      });

      if (!listing) return { status: 'LISTING_NOT_FOUND' } as const;

      const product = await transaction.product.findUnique({
        where: { id: BigInt(input.productId) },
        select: { id: true },
      });
      if (!product) return { status: 'PRODUCT_NOT_FOUND' } as const;

      if (
        listing.productId !== null
        && listing.productId !== product.id
        && !input.allowRemap
      ) {
        return {
          status: 'REMAP_REQUIRES_CONFIRMATION',
          currentProductId: String(listing.productId),
        } as const;
      }

      const mapped = await transaction.marketplaceListing.update({
        where: { id: BigInt(input.listingId) },
        data: {
          productId: product.id,
          mappingStatus: 'MAPPED',
          unitsPerListing: input.unitsPerListing,
          mappedAt: new Date(),
        },
        include: {
          product: {
            select: { id: true, puc: true, name: true },
          },
        },
      });
      await mirrorFbaPlatformStock(transaction, mapped);

      const before = {
        productId: listing.productId === null ? null : String(listing.productId),
        mappingStatus: listing.mappingStatus,
        unitsPerListing: listing.unitsPerListing,
        mappedAt: listing.mappedAt?.toISOString() ?? null,
      };
      const after = {
        productId: String(product.id),
        mappingStatus: mapped.mappingStatus,
        unitsPerListing: mapped.unitsPerListing,
        mappedAt: mapped.mappedAt?.toISOString() ?? null,
      };
      const changedFields = changedSnapshotFields(before, after);
      await transaction.marketplaceListingAudit.create({
        data: {
          listingId: listing.id,
          marketplace: listing.marketplace,
          environment: listing.environment,
          marketplaceId: listing.marketplaceId,
          sellerId: listing.sellerId,
          sellerSku: listing.sellerSku,
          operation: listing.productId === null
            ? 'MAPPED'
            : listing.productId === product.id
              ? 'MAPPING_UPDATED'
              : 'REMAPPED',
          changedFields,
          beforeValues: before,
          afterValues: after,
          previousProductId: listing.productId,
          productId: product.id,
          ...actorData(input),
        },
      });

      return { status: 'MAPPED', listing: serializeListing(mapped) } as const;
    });
  }

  async unmapListing(input: {
    listingId: string;
    sellerId: string;
    marketplaceId: string;
    requestedByUserId?: number;
    requestedByUserType?: string;
  }): Promise<Record<string, unknown> | null> {
    return prisma.$transaction(async (transaction) => {
      const listing = await transaction.marketplaceListing.findFirst({
        where: {
          id: BigInt(input.listingId),
          marketplace: 'AMAZON',
          environment: 'PRODUCTION',
          marketplaceId: input.marketplaceId,
          sellerId: input.sellerId,
        },
        select: {
          id: true,
          marketplace: true,
          environment: true,
          marketplaceId: true,
          sellerId: true,
          sellerSku: true,
          productId: true,
          mappingStatus: true,
          unitsPerListing: true,
          mappedAt: true,
        },
      });
      if (!listing) return null;

      const unmapped = await transaction.marketplaceListing.update({
        where: { id: listing.id },
        data: {
          productId: null,
          mappingStatus: 'UNMAPPED',
          unitsPerListing: 1,
          mappedAt: null,
        },
        include: {
          product: {
            select: { id: true, puc: true, name: true },
          },
        },
      });

      const before = {
        productId: listing.productId === null ? null : String(listing.productId),
        mappingStatus: listing.mappingStatus,
        unitsPerListing: listing.unitsPerListing,
        mappedAt: listing.mappedAt?.toISOString() ?? null,
      };
      const after = {
        productId: null,
        mappingStatus: unmapped.mappingStatus,
        unitsPerListing: unmapped.unitsPerListing,
        mappedAt: null,
      };
      await transaction.marketplaceListingAudit.create({
        data: {
          listingId: listing.id,
          marketplace: listing.marketplace,
          environment: listing.environment,
          marketplaceId: listing.marketplaceId,
          sellerId: listing.sellerId,
          sellerSku: listing.sellerSku,
          operation: 'UNMAPPED',
          changedFields: changedSnapshotFields(before, after),
          beforeValues: before,
          afterValues: after,
          previousProductId: listing.productId,
          productId: null,
          ...actorData(input),
        },
      });

      return serializeListing(unmapped);
    });
  }
}

export const amazonListingRepository = new AmazonListingRepository();
