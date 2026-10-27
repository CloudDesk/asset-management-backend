import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { amazonInventorySyncService } from './amazon-inventory-sync.service.js';
import { AmazonComboStockError, expandAmazonStockLines, loadComboComponents } from './amazon-combo-stock.service.js';

export type AmazonOrderRoutingDecision = {
  route: 'FBA_RECONCILIATION' | 'EASY_SHIP_HANDLING' | 'NIVAANA_SHIPPING' | 'BLOCKED';
  status: 'TRACK_FBA_STOCK' | 'RESERVE_STOCK' | 'BLOCKED_UNMAPPED' | 'BLOCKED_ITEMS_MISSING' | 'BLOCKED_ROUTE' | 'CANCELLED';
  syncState: string;
  blockedReason: string | null;
};

export const deriveAmazonOrderRoutingDecision = (input: {
  isCancelled: boolean;
  hasUnmappedItems: boolean;
  /** Stored order items; an order without any can be neither mapped nor shipped from Nivaana */
  items?: readonly unknown[];
  fulfilmentType: string;
}): AmazonOrderRoutingDecision => {
  if (input.isCancelled) {
    return { route: 'BLOCKED', status: 'CANCELLED', syncState: 'CANCELLED', blockedReason: 'Amazon cancelled this order' };
  }
  if (input.items !== undefined && input.items.length === 0) {
    return { route: 'BLOCKED', status: 'BLOCKED_ITEMS_MISSING', syncState: 'BLOCKED_ITEMS_MISSING', blockedReason: 'Amazon sent this order without its items; import the order again' };
  }
  if (input.hasUnmappedItems) {
    return { route: 'BLOCKED', status: 'BLOCKED_UNMAPPED', syncState: 'BLOCKED_UNMAPPED', blockedReason: 'At least one Amazon SKU is not mapped to a Nivaana product' };
  }
  if (input.fulfilmentType === 'FBA') {
    return { route: 'FBA_RECONCILIATION', status: 'TRACK_FBA_STOCK', syncState: 'READ_ONLY_RECONCILIATION', blockedReason: null };
  }
  if (input.fulfilmentType === 'EASY_SHIP') {
    return { route: 'EASY_SHIP_HANDLING', status: 'RESERVE_STOCK', syncState: 'EASY_SHIP_READY', blockedReason: null };
  }
  if (input.fulfilmentType === 'MFN') {
    return { route: 'NIVAANA_SHIPPING', status: 'RESERVE_STOCK', syncState: 'READY_FOR_NIVAANA', blockedReason: null };
  }
  return { route: 'BLOCKED', status: 'BLOCKED_ROUTE', syncState: 'BLOCKED_ROUTE', blockedReason: 'Amazon fulfillment type is unknown' };
};

const platformStatus = (available: number) => available > 5 ? 'in_stock' : available > 0 ? 'low_stock' : 'out_of_stock';
export const isAmazonOrderFinalStatus = (status: string) => (
  ['SHIPPED', 'COMPLETED', 'DELIVERED', 'RETURNED'].includes(status.trim().toUpperCase())
);

export const calculateFbaSoldDelta = (
  previous: { status: string; quantity: number } | null,
  nextQuantity: number,
  sold: boolean
) => (sold ? nextQuantity : 0) - (previous?.status === 'SOLD' ? previous.quantity : 0);

type StockLine = { amazonOrderItemId: string; listingId: bigint | null; productId: bigint; quantity: number; comboProductId: bigint | null };
type ReservationTransaction = Prisma.TransactionClient;

/** PUC for stock messages ("Insufficient … for product NIV-0096"), the id when the product is gone */
const productLabel = async (transaction: ReservationTransaction, productId: bigint) =>
  (await transaction.product.findUnique({ where: { id: productId }, select: { puc: true } }))?.puc ?? String(productId);

/**
 * Seller rows that hold no stock (FAILED / RELEASED) and no longer match the order's stock lines,
 * e.g. the combo's own row once it reserves per component; they would otherwise block shipping.
 */
const removeStaleSellerRows = (transaction: ReservationTransaction, orderId: bigint, lines: StockLine[]) =>
  transaction.amazonOrderStockReservation.deleteMany({
    where: {
      orderId,
      inventoryOwnership: 'SELLER',
      status: { in: ['FAILED', 'RELEASED'] },
      ...(lines.length > 0
        ? { NOT: { OR: lines.map((line) => ({ amazonOrderItemId: line.amazonOrderItemId, productId: line.productId })) } }
        : {}),
    },
  });

export class AmazonOrderRoutingService {
  private async reconcilePlatformStocks(stockIds: bigint[]) {
    const unique = [...new Set(stockIds.map(String))];
    await Promise.allSettled(unique.map((stockId) => amazonInventorySyncService.syncPlatformStockById(stockId)));
  }

  private async releaseReservations(orderId: bigint, reason: string, reconcile = true) {
    const stockIds = await prisma.$transaction(async (transaction) => {
      const reservations = await transaction.amazonOrderStockReservation.findMany({
        where: {
          orderId,
          OR: [
            { status: 'RESERVED' },
            { status: 'SOLD', inventoryOwnership: 'AMAZON_FBA' },
          ],
        },
      });
      const changedStockIds: bigint[] = [];
      for (const reservation of reservations) {
        if (reservation.platformStockId !== null) {
          const released = await transaction.platformStock.updateMany({
            where: { id: reservation.platformStockId, orderedqty: { gte: reservation.quantity } },
            data: {
              availableqty: { increment: reservation.quantity },
              orderedqty: { decrement: reservation.quantity },
              modifieddate: BigInt(Date.now()),
            },
          });
          if (released.count !== 1) throw new Error(`Unable to release stock reservation ${reservation.id}`);
          changedStockIds.push(reservation.platformStockId);
          const stock = await transaction.platformStock.findUnique({ where: { id: reservation.platformStockId } });
          if (stock) {
            await transaction.platformStock.update({
              where: { id: stock.id },
              data: { platformstatus: platformStatus(stock.availableqty) },
            });
          }
          const product = await transaction.product.findUnique({
            where: { id: reservation.productId },
            select: { availablequantity: true, orderedquantity: true },
          });
          if (product) {
            const available = Number(product.availablequantity ?? 0) + reservation.quantity;
            await transaction.product.update({
              where: { id: reservation.productId },
              data: {
                availablequantity: available,
                orderedquantity: Math.max(0, Number(product.orderedquantity ?? 0) - reservation.quantity),
                productstatus: platformStatus(available),
                modifieddate: BigInt(Date.now()),
              },
            });
          }
        } else if (reservation.inventoryOwnership === 'AMAZON_FBA' && reservation.status === 'SOLD') {
          const fbaStock = await transaction.platformStock.findFirst({
            where: {
              productid: reservation.productId,
              platform: { equals: 'amazon', mode: 'insensitive' },
              soldqty: { gte: reservation.quantity },
            },
          });
          if (fbaStock) {
            await transaction.platformStock.update({
              where: { id: fbaStock.id },
              data: {
                soldqty: { decrement: reservation.quantity },
                modifieddate: BigInt(Date.now()),
              },
            });
          }
        }
        await transaction.amazonOrderStockReservation.update({
          where: { id: reservation.id },
          data: { status: 'RELEASED', releasedAt: new Date(), errorMessage: reason },
        });
      }
      return changedStockIds;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (reconcile) await this.reconcilePlatformStocks(stockIds);
    return stockIds;
  }

  private async reserveSellerStock(order: {
    id: bigint;
    items: Array<{
      amazonOrderItemId: string;
      listingId: bigint | null;
      productId: bigint | null;
      quantityOrdered: number;
      unitsPerListing: number;
    }>;
  }, reconcile = true) {
    const items = order.items.map((item) => ({
      amazonOrderItemId: item.amazonOrderItemId,
      listingId: item.listingId,
      productId: item.productId!,
      quantity: item.quantityOrdered * Math.max(1, item.unitsPerListing),
    })).filter((item) => item.quantity > 0);

    // A combo item reserves each component (virtual stock, AMZ-PLAN-27); a single product reserves itself
    let desired: StockLine[];
    let expansionError: string | null = null;
    try {
      const combos = await loadComboComponents(items.map((item) => item.productId));
      desired = items.flatMap((item) => expandAmazonStockLines(item.productId, item.quantity, combos)
        .map((line) => ({ amazonOrderItemId: item.amazonOrderItemId, listingId: item.listingId, ...line })));
    } catch (error) {
      if (!(error instanceof AmazonComboStockError)) throw error;
      expansionError = error.message;
      desired = items.map((item) => ({ ...item, comboProductId: null }));
    }

    const existing = await prisma.amazonOrderStockReservation.findMany({
      where: { orderId: order.id, status: 'RESERVED', inventoryOwnership: 'SELLER' },
    });
    const alreadyReserved = expansionError === null && desired.length === existing.length && desired.every((item) => existing.some((reservation) =>
      reservation.amazonOrderItemId === item.amazonOrderItemId
      && reservation.productId === item.productId
      && reservation.quantity === item.quantity
      && reservation.comboProductId === item.comboProductId
    ));
    if (alreadyReserved) return { success: true, reason: null, stockIds: [] as bigint[] };

    const releasedStockIds = existing.length > 0
      ? await this.releaseReservations(order.id, 'Amazon order quantities or mappings changed', false)
      : [];

    try {
      if (expansionError !== null) throw new Error(expansionError);
      const reservedStockIds = await prisma.$transaction(async (transaction) => {
        await removeStaleSellerRows(transaction, order.id, desired);
        const changedStockIds: bigint[] = [];
        for (const item of desired) {
          const stock = await transaction.platformStock.findFirst({
            where: { productid: item.productId, platform: { equals: 'amazon', mode: 'insensitive' } },
          });
          if (!stock) throw new Error(`Amazon platform stock is missing for product ${await productLabel(transaction, item.productId)}`);
          const reserved = await transaction.platformStock.updateMany({
            where: { id: stock.id, availableqty: { gte: item.quantity } },
            data: {
              availableqty: { decrement: item.quantity },
              orderedqty: { increment: item.quantity },
              modifieddate: BigInt(Date.now()),
            },
          });
          if (reserved.count !== 1) throw new Error(`Insufficient Amazon platform stock for product ${await productLabel(transaction, item.productId)}`);
          changedStockIds.push(stock.id);
          const updatedStock = await transaction.platformStock.findUnique({ where: { id: stock.id } });
          if (updatedStock) {
            await transaction.platformStock.update({
              where: { id: stock.id },
              data: { platformstatus: platformStatus(updatedStock.availableqty) },
            });
          }
          const product = await transaction.product.findUnique({
            where: { id: item.productId },
            select: { availablequantity: true, orderedquantity: true },
          });
          if (!product || Number(product.availablequantity ?? 0) < item.quantity) {
            throw new Error(`Insufficient product stock for product ${await productLabel(transaction, item.productId)}`);
          }
          const productAvailable = Number(product.availablequantity ?? 0) - item.quantity;
          await transaction.product.update({
            where: { id: item.productId },
            data: {
              availablequantity: productAvailable,
              orderedquantity: Number(product.orderedquantity ?? 0) + item.quantity,
              productstatus: platformStatus(productAvailable),
              modifieddate: BigInt(Date.now()),
            },
          });
          await transaction.amazonOrderStockReservation.upsert({
            where: { orderId_amazonOrderItemId_productId: { orderId: order.id, amazonOrderItemId: item.amazonOrderItemId, productId: item.productId } },
            create: {
              orderId: order.id,
              amazonOrderItemId: item.amazonOrderItemId,
              productId: item.productId,
              comboProductId: item.comboProductId,
              listingId: item.listingId,
              platformStockId: stock.id,
              quantity: item.quantity,
              inventoryOwnership: 'SELLER',
              status: 'RESERVED',
              reservedAt: new Date(),
            },
            update: {
              comboProductId: item.comboProductId,
              listingId: item.listingId,
              platformStockId: stock.id,
              quantity: item.quantity,
              inventoryOwnership: 'SELLER',
              status: 'RESERVED',
              errorMessage: null,
              reservedAt: new Date(),
              releasedAt: null,
              soldAt: null,
            },
          });
        }
        return changedStockIds;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      const stockIds = [...releasedStockIds, ...reservedStockIds];
      if (reconcile) await this.reconcilePlatformStocks(stockIds);
      return { success: true, reason: null, stockIds };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Amazon seller stock reservation failed';
      await prisma.$transaction(async (transaction) => {
        await removeStaleSellerRows(transaction, order.id, desired);
        for (const item of desired) {
          await transaction.amazonOrderStockReservation.upsert({
            where: { orderId_amazonOrderItemId_productId: { orderId: order.id, amazonOrderItemId: item.amazonOrderItemId, productId: item.productId } },
            create: {
              orderId: order.id,
              amazonOrderItemId: item.amazonOrderItemId,
              productId: item.productId,
              comboProductId: item.comboProductId,
              listingId: item.listingId,
              quantity: item.quantity,
              inventoryOwnership: 'SELLER',
              status: 'FAILED',
              errorMessage: reason,
            },
            update: {
              comboProductId: item.comboProductId,
              listingId: item.listingId,
              platformStockId: null,
              quantity: item.quantity,
              inventoryOwnership: 'SELLER',
              status: 'FAILED',
              errorMessage: reason,
              reservedAt: null,
              releasedAt: null,
              soldAt: null,
            },
          });
        }
      });
      if (reconcile) await this.reconcilePlatformStocks(releasedStockIds);
      return { success: false, reason, stockIds: releasedStockIds };
    }
  }

  private async trackFbaStock(order: {
    id: bigint;
    items: Array<{
      amazonOrderItemId: string;
      listingId: bigint | null;
      productId: bigint | null;
      quantityOrdered: number;
      unitsPerListing: number;
    }>;
  }, sold: boolean) {
    const desired = order.items.map((item) => ({
      amazonOrderItemId: item.amazonOrderItemId,
      listingId: item.listingId,
      productId: item.productId!,
      quantity: item.quantityOrdered * Math.max(1, item.unitsPerListing),
    })).filter((item) => item.quantity > 0 && item.listingId !== null);
    const desiredItemIds = desired.map((item) => item.amazonOrderItemId);

    await prisma.$transaction(async (transaction) => {
      await transaction.amazonOrderStockReservation.updateMany({
        where: {
          orderId: order.id,
          inventoryOwnership: 'AMAZON_FBA',
          status: 'RESERVED',
          ...(desiredItemIds.length > 0
            ? { amazonOrderItemId: { notIn: desiredItemIds } }
            : {}),
        },
        data: {
          status: 'RELEASED',
          releasedAt: new Date(),
          errorMessage: 'FBA order items or mappings changed',
        },
      });

      for (const item of desired) {
        // FBA keeps one row per order item on the mapped product (combo included: Amazon owns the stock)
        const previous = await transaction.amazonOrderStockReservation.findFirst({
          where: { orderId: order.id, amazonOrderItemId: item.amazonOrderItemId },
          select: { id: true, status: true, quantity: true },
        });
        const soldDelta = calculateFbaSoldDelta(previous, item.quantity, sold);
        await transaction.amazonOrderStockReservation.upsert({
          where: { id: previous?.id ?? -1n },
          create: {
            orderId: order.id,
            amazonOrderItemId: item.amazonOrderItemId,
            productId: item.productId,
            listingId: item.listingId,
            platformStockId: null,
            quantity: item.quantity,
            inventoryOwnership: 'AMAZON_FBA',
            status: sold ? 'SOLD' : 'RESERVED',
            reservedAt: sold ? null : new Date(),
            soldAt: sold ? new Date() : null,
          },
          update: {
            productId: item.productId,
            listingId: item.listingId,
            platformStockId: null,
            quantity: item.quantity,
            inventoryOwnership: 'AMAZON_FBA',
            status: sold ? 'SOLD' : 'RESERVED',
            reservedAt: sold ? null : new Date(),
            releasedAt: null,
            soldAt: sold ? new Date() : null,
            errorMessage: null,
          },
        });
        if (soldDelta !== 0) {
          const stock = await transaction.platformStock.findFirst({
            where: {
              productid: item.productId,
              platform: { equals: 'amazon', mode: 'insensitive' },
              ...(soldDelta < 0 ? { soldqty: { gte: Math.abs(soldDelta) } } : {}),
            },
          });
          if (stock) {
            await transaction.platformStock.update({
              where: { id: stock.id },
              data: {
                soldqty: soldDelta > 0
                  ? { increment: soldDelta }
                  : { decrement: Math.abs(soldDelta) },
                modifieddate: BigInt(Date.now()),
              },
            });
          }
        }
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return { tracked: desired.length, sold };
  }

  async assertStockReservationReadyForShipment(orderId: bigint) {
    const reservations = await prisma.amazonOrderStockReservation.findMany({
      where: { orderId },
      select: { status: true, platformStockId: true },
    });
    if (reservations.length === 0) {
      throw new Error('This MFN order has no Nivaana stock reservation and cannot be confirmed as shipped');
    }
    const invalid = reservations.find((reservation) => !['RESERVED', 'SOLD'].includes(reservation.status));
    if (invalid) {
      throw new Error(`Nivaana stock reservation is ${invalid.status.toLowerCase()}; resolve stock before shipping`);
    }
    if (reservations.some((reservation) => reservation.platformStockId === null)) {
      throw new Error('A Nivaana stock reservation is not linked to platform stock');
    }
  }

  async finalizeReservationsAsSold(orderId: bigint, requireReservation = true, reconcile = true) {
    const result = await prisma.$transaction(async (transaction) => {
      const reservations = await transaction.amazonOrderStockReservation.findMany({ where: { orderId } });
      if (requireReservation && reservations.length === 0) {
        throw new Error('This MFN order has no Nivaana stock reservation');
      }
      const invalid = reservations.find((reservation) => !['RESERVED', 'SOLD'].includes(reservation.status));
      if (requireReservation && invalid) {
        throw new Error(`Nivaana stock reservation is ${invalid.status.toLowerCase()}`);
      }

      const stockIds: bigint[] = [];
      let converted = 0;
      let alreadySold = 0;
      for (const reservation of reservations) {
        if (reservation.status === 'SOLD') {
          alreadySold += 1;
          continue;
        }
        if (reservation.status !== 'RESERVED' || reservation.platformStockId === null) continue;
        const updated = await transaction.platformStock.updateMany({
          where: { id: reservation.platformStockId, orderedqty: { gte: reservation.quantity } },
          data: {
            orderedqty: { decrement: reservation.quantity },
            soldqty: { increment: reservation.quantity },
            modifieddate: BigInt(Date.now()),
          },
        });
        if (updated.count !== 1) {
          throw new Error(`Unable to convert stock reservation ${reservation.id} to sold quantity`);
        }
        const product = await transaction.product.findUnique({
          where: { id: reservation.productId },
          select: { orderedquantity: true, soldquantity: true },
        });
        if (!product) throw new Error(`Product ${reservation.productId} was not found`);
        await transaction.product.update({
          where: { id: reservation.productId },
          data: {
            orderedquantity: Math.max(0, Number(product.orderedquantity ?? 0) - reservation.quantity),
            soldquantity: Number(product.soldquantity ?? 0) + reservation.quantity,
            modifieddate: BigInt(Date.now()),
          },
        });
        await transaction.amazonOrderStockReservation.update({
          where: { id: reservation.id },
          data: { status: 'SOLD', soldAt: new Date(), errorMessage: null },
        });
        stockIds.push(reservation.platformStockId);
        converted += 1;
      }
      return { converted, alreadySold, stockIds };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (reconcile) await this.reconcilePlatformStocks(result.stockIds);
    return {
      converted: result.converted,
      alreadySold: result.alreadySold,
      stockIds: result.stockIds.map(String),
    };
  }

  async reconcile(orderId: bigint, options: { syncAmazonInventory?: boolean } = {}) {
    const order = await prisma.amazonMarketplaceOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return null;

    const decision = deriveAmazonOrderRoutingDecision(order);
    const syncAmazonInventory = options.syncAmazonInventory ?? true;
    let handoffStatus: string = decision.status;
    let syncState = decision.syncState;
    let blockedReason = decision.blockedReason;

    if (decision.status === 'TRACK_FBA_STOCK') {
      const final = isAmazonOrderFinalStatus(order.orderStatus);
      const tracked = await this.trackFbaStock(order, final);
      handoffStatus = final ? 'STOCK_SOLD_READ_ONLY' : 'READY_READ_ONLY';
      syncState = final ? 'SHIPPED' : 'READ_ONLY_RECONCILIATION';
      blockedReason = tracked.tracked > 0
        ? null
        : 'FBA inventory is read-only; no mapped FBA order items were available to track';
    } else if (decision.status !== 'RESERVE_STOCK') {
      await this.releaseReservations(order.id, decision.status, syncAmazonInventory);
    } else if (isAmazonOrderFinalStatus(order.orderStatus)) {
      const sold = await this.finalizeReservationsAsSold(order.id, false, syncAmazonInventory);
      const hasTrackedStock = sold.converted > 0 || sold.alreadySold > 0;
      handoffStatus = hasTrackedStock ? 'STOCK_SOLD' : 'HISTORICAL_SHIPPED';
      syncState = 'SHIPPED';
      blockedReason = hasTrackedStock
        ? null
        : 'Imported after shipment; Nivaana stock was not changed because no prior reservation exists';
    } else {
      const reservation = await this.reserveSellerStock(order, syncAmazonInventory);
      handoffStatus = reservation.success ? 'STOCK_RESERVED' : 'BLOCKED_STOCK';
      syncState = reservation.success
        ? order.fulfilmentType === 'EASY_SHIP' ? 'EASY_SHIP_READY' : 'READY_FOR_NIVAANA'
        : 'BLOCKED_STOCK';
      blockedReason = reservation.reason;
    }

    const [, handoff] = await prisma.$transaction([
      prisma.amazonMarketplaceOrder.update({ where: { id: order.id }, data: { syncState } }),
      prisma.amazonOrderRouteHandoff.upsert({
        where: { orderId: order.id },
        create: {
          orderId: order.id,
          route: decision.route,
          status: handoffStatus,
          blockedReason,
          lastEvaluatedAt: new Date(),
        },
        update: {
          route: decision.route,
          status: handoffStatus,
          blockedReason,
          lastEvaluatedAt: new Date(),
        },
      }),
    ]);
    return handoff;
  }
}

export const amazonOrderRoutingService = new AmazonOrderRoutingService();
