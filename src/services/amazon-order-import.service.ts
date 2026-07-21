import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { AmazonListingScope } from './amazon-listing-scope.service.js';
import { AmazonRawOrder } from './amazon-production-listings.client.js';

export type AmazonOrderActor = { requestedByUserId?: number; requestedByUserType?: string };
export type AmazonOrderImportOptions = { fullHistory?: boolean };

export class AmazonOrderImportError extends Error {
  constructor(message: string, readonly statusCode: number, readonly code: string) {
    super(message);
    this.name = 'AmazonOrderImportError';
  }
}

export const classifyAmazonOrder = (order: AmazonRawOrder) => {
  const programs = order.programs ?? [];
  const fulfilledBy = order.fulfillment?.fulfilledBy?.toUpperCase();
  const fulfilmentType = programs.includes('AMAZON_EASY_SHIP')
    ? 'EASY_SHIP'
    : fulfilledBy === 'AMAZON' ? 'FBA' : fulfilledBy === 'MERCHANT' ? 'MFN' : 'UNKNOWN';
  const fulfilmentRoute = fulfilmentType === 'FBA'
    ? 'FBA_RECONCILIATION'
    : fulfilmentType === 'EASY_SHIP' ? 'EASY_SHIP_HANDLING'
      : fulfilmentType === 'MFN' ? 'NIVAANA_SHIPPING' : 'BLOCKED';
  const orderStatus = order.fulfillment?.fulfillmentStatus?.toUpperCase() ?? 'UNKNOWN';
  return {
    fulfilmentType,
    fulfilmentRoute,
    orderStatus,
    isCancelled: /CANCELLED|CANCELED/.test(orderStatus),
  };
};

const validDate = (value: string | undefined, fallback: Date) => {
  const parsed = value ? new Date(value) : fallback;
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const serializeOrder = (order: any) => ({
  id: String(order.id),
  amazonOrderId: order.amazonOrderId,
  marketplaceId: order.marketplaceId,
  purchaseDate: order.purchaseDate.toISOString(),
  lastUpdateDate: order.lastUpdateDate.toISOString(),
  orderStatus: order.orderStatus,
  fulfilmentType: order.fulfilmentType,
  fulfilmentRoute: order.fulfilmentRoute,
  syncState: order.syncState,
  hasUnmappedItems: order.hasUnmappedItems,
  isCancelled: order.isCancelled,
  programs: order.programs,
  lastImportedAt: order.lastImportedAt.toISOString(),
  items: (order.items ?? []).map((item: any) => ({
    id: String(item.id),
    amazonOrderItemId: item.amazonOrderItemId,
    sellerSku: item.sellerSku,
    asin: item.asin,
    title: item.title,
    quantityOrdered: item.quantityOrdered,
    quantityShipped: item.quantityShipped,
    unitPrice: item.unitPrice == null ? null : item.unitPrice.toString(),
    currency: item.currency,
    listingId: item.listingId === null ? null : String(item.listingId),
    productId: item.productId === null ? null : String(item.productId),
    unitsPerListing: item.unitsPerListing,
    mappingStatus: item.mappingStatus,
    mappedProduct: item.product ? { id: String(item.product.id), puc: item.product.puc, name: item.product.name } : null,
  })),
});

export class AmazonOrderImportService {
  async importOrders(
    scope: AmazonListingScope,
    actor: AmazonOrderActor = {},
    options: AmazonOrderImportOptions = {}
  ) {
    if (!scope.client.searchOrders) {
      throw new AmazonOrderImportError('Amazon Orders API client is unavailable', 503, 'AMAZON_ORDERS_CLIENT_UNAVAILABLE');
    }
    const latest = await prisma.amazonMarketplaceOrder.findFirst({
      where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId },
      orderBy: { lastUpdateDate: 'desc' },
      select: { lastUpdateDate: true },
    });
    const now = new Date();
    const historyStart = new Date(now);
    historyStart.setUTCFullYear(historyStart.getUTCFullYear() - 2);
    const lastUpdatedAfter = new Date((latest?.lastUpdateDate.getTime() ?? now.getTime() - 7 * 24 * 60 * 60 * 1000) - 2 * 60 * 1000).toISOString();
    const searchStart = options.fullHistory ? historyStart.toISOString() : lastUpdatedAfter;
    let paginationToken: string | undefined;
    let fetched = 0;
    let created = 0;
    let updated = 0;
    let unmapped = 0;
    let cancelled = 0;

    do {
      const page = await scope.client.searchOrders({
        ...(options.fullHistory ? { createdAfter: searchStart } : { lastUpdatedAfter: searchStart }),
        ...(paginationToken ? { paginationToken } : {}),
      });
      for (const raw of page.orders) {
        const outcome = await this.upsertOrder(raw, scope, actor);
        fetched += 1;
        if (outcome.created) created += 1; else updated += 1;
        if (outcome.hasUnmappedItems) unmapped += 1;
        if (outcome.isCancelled) cancelled += 1;
      }
      paginationToken = page.nextToken ?? undefined;
    } while (paginationToken);

    return {
      fetched,
      created,
      updated,
      unmapped,
      cancelled,
      mode: options.fullHistory ? 'FULL_HISTORY' : 'INCREMENTAL',
      searchStart,
    };
  }

  private async upsertOrder(raw: AmazonRawOrder, scope: AmazonListingScope, _actor: AmazonOrderActor) {
    if (!raw.orderId) throw new AmazonOrderImportError('Amazon returned an order without an order ID', 502, 'AMAZON_ORDER_INVALID');
    const now = new Date();
    const classification = classifyAmazonOrder(raw);
    const skus = [...new Set((raw.orderItems ?? []).flatMap((item) => item.product?.sellerSku ? [item.product.sellerSku] : []))];
    const listings = skus.length === 0 ? [] : await prisma.marketplaceListing.findMany({
      where: {
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        marketplace: 'AMAZON',
        environment: 'PRODUCTION',
        sellerSku: { in: skus },
      },
      select: { id: true, sellerSku: true, productId: true, mappingStatus: true, unitsPerListing: true },
    });
    const bySku = new Map(listings.map((listing) => [listing.sellerSku, listing]));
    const items = (raw.orderItems ?? []).map((item, index) => {
      const listing = item.product?.sellerSku ? bySku.get(item.product.sellerSku) : undefined;
      const mapped = listing?.mappingStatus === 'MAPPED' && listing.productId !== null;
      return {
        amazonOrderItemId: item.orderItemId ?? `${raw.orderId}-${index + 1}`,
        sellerSku: item.product?.sellerSku ?? null,
        asin: item.product?.asin ?? null,
        title: item.product?.title ?? null,
        quantityOrdered: Math.max(0, Math.trunc(item.quantityOrdered ?? 0)),
        quantityShipped: Math.max(0, Math.trunc(item.quantityShipped ?? 0)),
        unitPrice: item.product?.price?.unitPrice?.amount ?? null,
        currency: item.product?.price?.unitPrice?.currencyCode ?? null,
        listingId: listing?.id ?? null,
        productId: mapped ? listing.productId : null,
        unitsPerListing: listing?.unitsPerListing ?? 1,
        mappingStatus: mapped ? 'MAPPED' : 'UNMAPPED',
      };
    });
    const hasUnmappedItems = items.some((item) => item.mappingStatus !== 'MAPPED');
    const syncState = classification.isCancelled ? 'CANCELLED'
      : hasUnmappedItems ? 'BLOCKED_UNMAPPED'
        : classification.fulfilmentType === 'FBA' ? 'READ_ONLY_RECONCILIATION'
          : classification.fulfilmentType === 'EASY_SHIP' ? 'EASY_SHIP_READY'
            : classification.fulfilmentType === 'MFN' ? 'READY_FOR_NIVAANA' : 'BLOCKED_ROUTE';
    const existing = await prisma.amazonMarketplaceOrder.findUnique({
      where: { sellerId_marketplaceId_amazonOrderId: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, amazonOrderId: raw.orderId } },
      select: { id: true },
    });
    await prisma.$transaction(async (transaction) => {
      const order = await transaction.amazonMarketplaceOrder.upsert({
        where: { sellerId_marketplaceId_amazonOrderId: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, amazonOrderId: raw.orderId! } },
        create: {
          sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, amazonOrderId: raw.orderId!,
          purchaseDate: validDate(raw.createdTime, now), lastUpdateDate: validDate(raw.lastUpdatedTime, now),
          orderStatus: classification.orderStatus, fulfilmentType: classification.fulfilmentType,
          fulfilmentRoute: classification.fulfilmentRoute, syncState, hasUnmappedItems,
          isCancelled: classification.isCancelled, programs: (raw.programs ?? []) as Prisma.InputJsonValue,
        },
        update: {
          purchaseDate: validDate(raw.createdTime, now), lastUpdateDate: validDate(raw.lastUpdatedTime, now),
          orderStatus: classification.orderStatus, fulfilmentType: classification.fulfilmentType,
          fulfilmentRoute: classification.fulfilmentRoute, syncState, hasUnmappedItems,
          isCancelled: classification.isCancelled, programs: (raw.programs ?? []) as Prisma.InputJsonValue,
          lastImportedAt: now,
        },
        select: { id: true },
      });
      await transaction.amazonMarketplaceOrderItem.deleteMany({ where: { orderId: order.id } });
      if (items.length > 0) await transaction.amazonMarketplaceOrderItem.createMany({ data: items.map((item) => ({ ...item, orderId: order.id })) });
    });
    return { created: !existing, hasUnmappedItems, isCancelled: classification.isCancelled };
  }

  async listOrders(scope: AmazonListingScope, input: {
    page: number;
    limit: number;
    syncState?: string | undefined;
    fulfilmentType?: string | undefined;
    search?: string | undefined;
  }) {
    const where: Prisma.AmazonMarketplaceOrderWhereInput = {
      sellerId: scope.sellerId,
      marketplaceId: scope.marketplaceId,
      ...(input.syncState ? { syncState: input.syncState } : {}),
      ...(input.fulfilmentType ? { fulfilmentType: input.fulfilmentType } : {}),
      ...(input.search ? { OR: [
        { amazonOrderId: { contains: input.search, mode: 'insensitive' } },
        { items: { some: { sellerSku: { contains: input.search, mode: 'insensitive' } } } },
      ] } : {}),
    };
    const [orders, total] = await Promise.all([
      prisma.amazonMarketplaceOrder.findMany({
        where, skip: (input.page - 1) * input.limit, take: input.limit,
        orderBy: [{ purchaseDate: 'desc' }, { id: 'desc' }],
        include: { items: { include: { product: { select: { id: true, puc: true, name: true } } } } },
      }),
      prisma.amazonMarketplaceOrder.count({ where }),
    ]);
    const totalPages = Math.ceil(total / input.limit);
    return { data: orders.map(serializeOrder), pagination: { page: input.page, limit: input.limit, total, totalPages, hasNext: input.page < totalPages, hasPrev: input.page > 1 } };
  }
}

export const amazonOrderImportService = new AmazonOrderImportService();
