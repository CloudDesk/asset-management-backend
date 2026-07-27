import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';

type JsonRecord = Record<string, unknown>;

export type AmazonFbaInventorySnapshot = {
  sellerSku: string;
  fnSku: string | null;
  asin: string | null;
  marketplaceId: string;
  itemName: string | null;
  fulfillable: number;
  inboundWorking: number;
  inboundShipped: number;
  inboundReceiving: number;
  unfulfillable: number;
  researching: number;
  reservedWarehouseProcessing: number;
  reservedWarehouseTransfer: number;
  pendingCustomerOrder: number;
  futureSupplyBuyable: number;
  pendingCustomerOrderInTransit: number;
  reserved: number;
  inbound: number;
  total: number;
};

const record = (value: unknown): JsonRecord | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : null;

const first = (source: JsonRecord | null, keys: string[]): unknown => {
  if (!source) return undefined;
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
};

const text = (source: JsonRecord | null, keys: string[]): string | null => {
  const value = first(source, keys);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const quantity = (source: JsonRecord | null, keys: string[]): number => {
  const value = Number(first(source, keys) ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
};

const values = (source: JsonRecord | null, keys: string[]): unknown[] => {
  const value = first(source, keys);
  return Array.isArray(value) ? value : [];
};

export const parseAmazonFbaInventoryNotification = (
  payload: unknown,
  fallbackMarketplaceId?: string
): AmazonFbaInventorySnapshot[] => {
  const root = record(payload);
  const sellerSku = text(root, ['SKU', 'Sku', 'sku', 'SellerSKU', 'sellerSku']);
  if (!sellerSku) throw new Error('FBA inventory notification is missing the seller SKU');

  const fnSku = text(root, ['FNSKU', 'FnSku', 'fnSku']);
  const asin = text(root, ['ASIN', 'Asin', 'asin']);
  const marketplaceInventory = values(root, [
    'FulfillmentInventoryByMarketplace',
    'fulfillmentInventoryByMarketplace',
  ]);
  if (marketplaceInventory.length === 0) {
    throw new Error('FBA inventory notification contains no marketplace inventory');
  }

  return marketplaceInventory.map((value) => {
    const marketplace = record(value);
    const marketplaceId = text(marketplace, ['MarketplaceId', 'marketplaceId'])
      ?? fallbackMarketplaceId
      ?? '';
    if (!marketplaceId) throw new Error('FBA inventory notification is missing the marketplace ID');

    const inventory = record(first(marketplace, ['FulfillmentInventory', 'fulfillmentInventory']));
    const inboundBreakdown = record(first(inventory, ['InboundQuantityBreakdown', 'inboundQuantityBreakdown']));
    const reservedBreakdown = record(first(inventory, ['ReservedQuantityBreakdown', 'reservedQuantityBreakdown']));
    const fulfillable = quantity(inventory, ['Fulfillable', 'fulfillable']);
    const inboundWorking = quantity(inboundBreakdown, ['Working', 'working']);
    const inboundShipped = quantity(inboundBreakdown, ['Shipped', 'shipped']);
    const inboundReceiving = quantity(inboundBreakdown, ['Receiving', 'receiving']);
    const unfulfillable = quantity(inventory, ['Unfulfillable', 'unfulfillable']);
    const researching = quantity(inventory, ['Researching', 'researching']);
    const reservedWarehouseProcessing = quantity(reservedBreakdown, ['WarehouseProcessing', 'warehouseProcessing']);
    const reservedWarehouseTransfer = quantity(reservedBreakdown, ['WarehouseTransfer', 'warehouseTransfer']);
    const pendingCustomerOrder = quantity(reservedBreakdown, ['PendingCustomerOrder', 'pendingCustomerOrder']);
    const futureSupplyBuyable = quantity(inventory, ['FutureSupplyBuyable', 'futureSupplyBuyable']);
    const pendingCustomerOrderInTransit = quantity(inventory, [
      'PendingCustomerOrderInTransit',
      'pendingCustomerOrderInTransit',
    ]);
    const reserved = reservedWarehouseProcessing + reservedWarehouseTransfer + pendingCustomerOrder;
    const inbound = inboundWorking + inboundShipped + inboundReceiving;

    return {
      sellerSku,
      fnSku,
      asin,
      marketplaceId,
      itemName: text(marketplace, ['ItemName', 'itemName']),
      fulfillable,
      inboundWorking,
      inboundShipped,
      inboundReceiving,
      unfulfillable,
      researching,
      reservedWarehouseProcessing,
      reservedWarehouseTransfer,
      pendingCustomerOrder,
      futureSupplyBuyable,
      pendingCustomerOrderInTransit,
      reserved,
      inbound,
      total: fulfillable + reserved + unfulfillable + researching,
    };
  });
};

const platformStatus = (available: number) =>
  available > 5 ? 'in_stock' : available > 0 ? 'low_stock' : 'out_of_stock';

export const mirrorStoredAmazonFbaInventory = async (scope: {
  sellerId: string;
  marketplaceId: string;
}) => {
  const listings = await prisma.marketplaceListing.findMany({
    where: {
      marketplace: 'AMAZON',
      environment: 'PRODUCTION',
      sellerId: scope.sellerId,
      marketplaceId: scope.marketplaceId,
      fulfilmentChannel: 'FBA',
      mappingStatus: 'MAPPED',
      productId: { not: null },
    },
    select: {
      productId: true,
      publishedQuantity: true,
      fbaFulfillableQuantity: true,
      fbaPendingOrderQuantity: true,
      fbaReservedQuantity: true,
      fbaTotalQuantity: true,
    },
  });

  for (const listing of listings) {
    if (listing.productId === null) continue;
    const available = listing.fbaFulfillableQuantity ?? listing.publishedQuantity ?? 0;
    const ordered = listing.fbaPendingOrderQuantity ?? 0;
    const total = listing.fbaTotalQuantity
      ?? available + (listing.fbaReservedQuantity ?? 0);
    const existingStock = await prisma.platformStock.findFirst({
      where: {
        productid: listing.productId,
        platform: { equals: 'amazon', mode: 'insensitive' },
      },
    });
    const data = {
      availableqty: available,
      orderedqty: ordered,
      totalqty: total,
      ecomqty: available,
      platformstatus: platformStatus(available),
      modifieddate: BigInt(Date.now()),
    };
    if (existingStock) {
      await prisma.platformStock.update({ where: { id: existingStock.id }, data });
    } else {
      await prisma.platformStock.create({
        data: {
          productid: listing.productId,
          platform: 'amazon',
          soldqty: 0,
          lockqty: 0,
          createddate: BigInt(Date.now()),
          ...data,
        },
      });
    }
  }

  return { mirrored: listings.length };
};

export class AmazonFbaInventoryNotificationService {
  async reconcile(input: {
    sellerId: string;
    marketplaceId: string;
    eventTime: string;
    payload: unknown;
  }) {
    const snapshots = parseAmazonFbaInventoryNotification(input.payload, input.marketplaceId)
      .filter((snapshot) => snapshot.marketplaceId === input.marketplaceId);
    if (snapshots.length === 0) {
      throw new Error(`FBA inventory notification has no data for marketplace ${input.marketplaceId}`);
    }

    const results = [];
    for (const snapshot of snapshots) {
      const listing = await prisma.marketplaceListing.findFirst({
        where: {
          marketplace: 'AMAZON',
          environment: 'PRODUCTION',
          sellerId: input.sellerId,
          marketplaceId: snapshot.marketplaceId,
          sellerSku: snapshot.sellerSku,
        },
      });
      if (!listing) {
        results.push({ sellerSku: snapshot.sellerSku, status: 'UNMAPPED_LISTING' });
        continue;
      }

      const observedAt = new Date(input.eventTime);
      await prisma.$transaction(async (transaction) => {
        await transaction.marketplaceListing.update({
          where: { id: listing.id },
          data: {
            fulfilmentChannel: 'FBA',
            inventorySyncMode: 'DISABLED',
            publishedQuantity: snapshot.fulfillable,
            fbaFulfillableQuantity: snapshot.fulfillable,
            fbaReservedQuantity: snapshot.reserved,
            fbaPendingOrderQuantity: snapshot.pendingCustomerOrder,
            fbaTotalQuantity: snapshot.total,
            amazonLastUpdatedAt: observedAt,
            lastImportedAt: new Date(),
          },
        });

        await transaction.marketplaceListingAudit.create({
          data: {
            listingId: listing.id,
            marketplace: 'AMAZON',
            environment: 'PRODUCTION',
            marketplaceId: snapshot.marketplaceId,
            sellerId: input.sellerId,
            sellerSku: snapshot.sellerSku,
            operation: 'FBA_INVENTORY_NOTIFICATION',
            changedFields: [
              'publishedQuantity',
              'fbaFulfillableQuantity',
              'fbaReservedQuantity',
              'fbaPendingOrderQuantity',
              'fbaTotalQuantity',
            ],
            afterValues: snapshot as unknown as Prisma.InputJsonValue,
            previousProductId: listing.productId,
            productId: listing.productId,
            requestedByUserType: 'AMAZON_NOTIFICATION',
          },
        });

        if (listing.productId !== null && listing.mappingStatus === 'MAPPED') {
          const existingStock = await transaction.platformStock.findFirst({
            where: {
              productid: listing.productId,
              platform: { equals: 'amazon', mode: 'insensitive' },
            },
          });
          const stockData = {
            availableqty: snapshot.fulfillable,
            orderedqty: snapshot.pendingCustomerOrder,
            totalqty: snapshot.total,
            ecomqty: snapshot.fulfillable + snapshot.futureSupplyBuyable,
            platformstatus: platformStatus(snapshot.fulfillable),
            modifieddate: BigInt(Date.now()),
          };
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
        }
      });
      results.push({
        sellerSku: snapshot.sellerSku,
        status: 'UPDATED',
        fulfillable: snapshot.fulfillable,
        reserved: snapshot.reserved,
        pendingCustomerOrder: snapshot.pendingCustomerOrder,
        total: snapshot.total,
      });
    }

    return {
      processed: results.length,
      updated: results.filter((result) => result.status === 'UPDATED').length,
      unmapped: results.filter((result) => result.status === 'UNMAPPED_LISTING').length,
      results,
    };
  }
}

export const amazonFbaInventoryNotificationService = new AmazonFbaInventoryNotificationService();
