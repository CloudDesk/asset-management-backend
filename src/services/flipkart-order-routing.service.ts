import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { flipkartInventoryService } from './flipkart-inventory.service.js';

const platformStatus = (available: number) => available > 5 ? 'in_stock' : available > 0 ? 'low_stock' : 'out_of_stock';
export const isFlipkartShipmentFinal = (status: string) => ['SHIPPED', 'DELIVERED'].includes(status.trim().toUpperCase());

type DesiredReservation = {
  orderItemId: string;
  listingId: bigint | null;
  productId: bigint;
  quantity: number;
};

export class FlipkartOrderRoutingService {
  private async reconcilePlatformStocks(stockIds: bigint[]) {
    const unique = [...new Set(stockIds.map(String))];
    await Promise.allSettled(unique.map((stockId) => flipkartInventoryService.syncPlatformStockById(stockId)));
  }

  private desired(items: Array<{ orderItemId: string; listingId: bigint | null; productId: bigint | null; quantity: number; unitsPerListing: number }>): DesiredReservation[] {
    return items.filter((item): item is typeof item & { productId: bigint } => item.productId !== null).map((item) => ({
      orderItemId: item.orderItemId,
      listingId: item.listingId,
      productId: item.productId,
      quantity: Math.max(0, item.quantity) * Math.max(1, item.unitsPerListing),
    })).filter((item) => item.quantity > 0);
  }

  private async updateStatuses(transaction: Prisma.TransactionClient, platformStockId: bigint, productId: bigint) {
    const stock = await transaction.platformStock.findUnique({ where: { id: platformStockId } });
    if (stock) await transaction.platformStock.update({ where: { id: stock.id }, data: { platformstatus: platformStatus(stock.availableqty) } });
    const product = await transaction.product.findUnique({ where: { id: productId }, select: { availablequantity: true } });
    if (product) await transaction.product.update({ where: { id: productId }, data: { productstatus: platformStatus(Number(product.availablequantity ?? 0)) } });
  }

  async release(shipmentId: bigint, reason: string, reconcile = true) {
    const result = await prisma.$transaction(async (transaction) => {
      const reservations = await transaction.flipkartOrderStockReservation.findMany({ where: { shipmentId, status: 'RESERVED' } });
      let released = 0;
      const stockIds: bigint[] = [];
      for (const reservation of reservations) {
        if (reservation.platformStockId === null) throw new Error(`Flipkart reservation ${reservation.id} is not linked to platform stock`);
        const stockUpdate = await transaction.platformStock.updateMany({ where: { id: reservation.platformStockId, orderedqty: { gte: reservation.quantity } }, data: { availableqty: { increment: reservation.quantity }, orderedqty: { decrement: reservation.quantity }, modifieddate: BigInt(Date.now()) } });
        if (stockUpdate.count !== 1) throw new Error(`Unable to release Flipkart reservation ${reservation.id}`);
        const product = await transaction.product.findUnique({ where: { id: reservation.productId }, select: { availablequantity: true, orderedquantity: true } });
        if (!product) throw new Error(`Product ${reservation.productId} was not found`);
        await transaction.product.update({ where: { id: reservation.productId }, data: { availablequantity: Number(product.availablequantity ?? 0) + reservation.quantity, orderedquantity: Math.max(0, Number(product.orderedquantity ?? 0) - reservation.quantity), modifieddate: BigInt(Date.now()) } });
        await transaction.flipkartOrderStockReservation.update({ where: { id: reservation.id }, data: { status: 'RELEASED', releasedAt: new Date(), errorMessage: reason } });
        await this.updateStatuses(transaction, reservation.platformStockId, reservation.productId);
        stockIds.push(reservation.platformStockId);
        released += 1;
      }
      return { released, stockIds };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (reconcile) await this.reconcilePlatformStocks(result.stockIds);
    return { released: result.released, stockIds: result.stockIds.map(String) };
  }

  private async recordFailures(shipmentId: bigint, desired: DesiredReservation[], reason: string) {
    for (const item of desired) await prisma.flipkartOrderStockReservation.upsert({
      where: { shipmentId_orderItemId: { shipmentId, orderItemId: item.orderItemId } },
      create: { shipmentId, orderItemId: item.orderItemId, productId: item.productId, listingId: item.listingId, quantity: item.quantity, status: 'FAILED', errorMessage: reason },
      update: { productId: item.productId, listingId: item.listingId, platformStockId: null, quantity: item.quantity, status: 'FAILED', errorMessage: reason, reservedAt: null, releasedAt: null, soldAt: null },
    });
  }

  async reserve(shipment: { id: bigint; items: Array<{ orderItemId: string; listingId: bigint | null; productId: bigint | null; quantity: number; unitsPerListing: number }> }) {
    const desired = this.desired(shipment.items);
    const existing = await prisma.flipkartOrderStockReservation.findMany({ where: { shipmentId: shipment.id } });
    const exactActive = desired.length === existing.length && desired.every((item) => existing.some((reservation) => reservation.orderItemId === item.orderItemId && reservation.productId === item.productId && reservation.quantity === item.quantity && ['RESERVED', 'SOLD'].includes(reservation.status)));
    if (exactActive) {
      await this.reconcilePlatformStocks(existing.flatMap((item) => item.platformStockId ? [item.platformStockId] : []));
      return { success: true, reason: null, reserved: existing.filter((item) => item.status === 'RESERVED').length, alreadySold: existing.filter((item) => item.status === 'SOLD').length };
    }
    if (existing.some((item) => item.status === 'SOLD')) return { success: false, reason: 'A sold Flipkart reservation cannot be remapped or resized', reserved: 0, alreadySold: existing.filter((item) => item.status === 'SOLD').length };
    const released = existing.some((item) => item.status === 'RESERVED')
      ? await this.release(shipment.id, 'Flipkart order quantities or mappings changed', false)
      : { released: 0, stockIds: [] as string[] };
    try {
      const result = await prisma.$transaction(async (transaction) => {
        let reservedCount = 0;
        const stockIds: bigint[] = [];
        for (const item of desired) {
          const stock = await transaction.platformStock.findFirst({ where: { productid: item.productId, platform: { equals: 'flipkart', mode: 'insensitive' } } });
          if (!stock) throw new Error(`Flipkart platform stock is missing for product ${item.productId}`);
          const product = await transaction.product.findUnique({ where: { id: item.productId }, select: { availablequantity: true, orderedquantity: true } });
          if (!product || Number(product.availablequantity ?? 0) < item.quantity) throw new Error(`Insufficient Nivaana stock for product ${item.productId}`);
          const stockUpdate = await transaction.platformStock.updateMany({ where: { id: stock.id, availableqty: { gte: item.quantity } }, data: { availableqty: { decrement: item.quantity }, orderedqty: { increment: item.quantity }, modifieddate: BigInt(Date.now()) } });
          if (stockUpdate.count !== 1) throw new Error(`Insufficient Flipkart platform stock for product ${item.productId}`);
          await transaction.product.update({ where: { id: item.productId }, data: { availablequantity: Number(product.availablequantity ?? 0) - item.quantity, orderedquantity: Number(product.orderedquantity ?? 0) + item.quantity, modifieddate: BigInt(Date.now()) } });
          await transaction.flipkartOrderStockReservation.upsert({ where: { shipmentId_orderItemId: { shipmentId: shipment.id, orderItemId: item.orderItemId } }, create: { shipmentId: shipment.id, orderItemId: item.orderItemId, productId: item.productId, listingId: item.listingId, platformStockId: stock.id, quantity: item.quantity, status: 'RESERVED', reservedAt: new Date() }, update: { productId: item.productId, listingId: item.listingId, platformStockId: stock.id, quantity: item.quantity, status: 'RESERVED', errorMessage: null, reservedAt: new Date(), releasedAt: null, soldAt: null } });
          await this.updateStatuses(transaction, stock.id, item.productId);
          stockIds.push(stock.id);
          reservedCount += 1;
        }
        return { reservedCount, stockIds };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      await this.reconcilePlatformStocks([...released.stockIds.map(BigInt), ...result.stockIds]);
      return { success: true, reason: null, reserved: result.reservedCount, alreadySold: 0 };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Flipkart stock reservation failed';
      await this.recordFailures(shipment.id, desired, reason);
      await this.reconcilePlatformStocks(released.stockIds.map(BigInt));
      return { success: false, reason, reserved: 0, alreadySold: 0 };
    }
  }

  async finalizeAsSold(shipmentId: bigint) {
    const result = await prisma.$transaction(async (transaction) => {
      const reservations = await transaction.flipkartOrderStockReservation.findMany({ where: { shipmentId } });
      if (reservations.length === 0) throw new Error('This Flipkart shipment has no Nivaana stock reservation');
      const invalid = reservations.find((reservation) => !['RESERVED', 'SOLD'].includes(reservation.status));
      if (invalid) throw new Error(`Flipkart stock reservation is ${invalid.status.toLowerCase()}`);
      let converted = 0; let alreadySold = 0;
      const stockIds: bigint[] = [];
      for (const reservation of reservations) {
        if (reservation.status === 'SOLD') { alreadySold += 1; continue; }
        if (reservation.platformStockId === null) throw new Error(`Flipkart reservation ${reservation.id} is not linked to platform stock`);
        const stockUpdate = await transaction.platformStock.updateMany({ where: { id: reservation.platformStockId, orderedqty: { gte: reservation.quantity } }, data: { orderedqty: { decrement: reservation.quantity }, soldqty: { increment: reservation.quantity }, modifieddate: BigInt(Date.now()) } });
        if (stockUpdate.count !== 1) throw new Error(`Unable to convert Flipkart reservation ${reservation.id} to sold`);
        const product = await transaction.product.findUnique({ where: { id: reservation.productId }, select: { orderedquantity: true, soldquantity: true } });
        if (!product) throw new Error(`Product ${reservation.productId} was not found`);
        await transaction.product.update({ where: { id: reservation.productId }, data: { orderedquantity: Math.max(0, Number(product.orderedquantity ?? 0) - reservation.quantity), soldquantity: Number(product.soldquantity ?? 0) + reservation.quantity, modifieddate: BigInt(Date.now()) } });
        await transaction.flipkartOrderStockReservation.update({ where: { id: reservation.id }, data: { status: 'SOLD', soldAt: new Date(), errorMessage: null } });
        await this.updateStatuses(transaction, reservation.platformStockId, reservation.productId);
        stockIds.push(reservation.platformStockId);
        converted += 1;
      }
      return { converted, alreadySold, stockIds };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    await this.reconcilePlatformStocks(result.stockIds);
    return { converted: result.converted, alreadySold: result.alreadySold, stockIds: result.stockIds.map(String) };
  }

  async assertReadyForShipment(shipmentId: bigint) {
    const reservations = await prisma.flipkartOrderStockReservation.findMany({ where: { shipmentId } });
    if (reservations.length === 0) throw new Error('This Flipkart shipment has no Nivaana stock reservation');
    const invalid = reservations.find((reservation) => !['RESERVED', 'SOLD'].includes(reservation.status));
    if (invalid) throw new Error(`Nivaana stock reservation is ${invalid.status.toLowerCase()}; resolve inventory before fulfilment`);
  }

  async reconcile(shipmentId: bigint) {
    const shipment = await prisma.flipkartShipment.findUnique({ where: { id: shipmentId }, include: { items: true, stockReservations: true } });
    if (!shipment) return null;
    const unmapped = shipment.items.some((item) => item.mappingStatus !== 'MAPPED' || item.productId === null);
    if (shipment.shipmentStatus === 'CANCELLED') {
      const result = await this.release(shipment.id, 'Flipkart shipment cancelled');
      await prisma.flipkartShipment.update({ where: { id: shipment.id }, data: { syncState: 'CANCELLED', workflowStatus: 'CANCELLED', lastError: null } });
      return { state: 'CANCELLED', ...result };
    }
    if (unmapped) {
      if (shipment.stockReservations.some((item) => item.status === 'RESERVED')) await this.release(shipment.id, 'Flipkart shipment mapping was removed');
      await prisma.flipkartShipment.update({ where: { id: shipment.id }, data: { syncState: 'BLOCKED_UNMAPPED', workflowStatus: 'BLOCKED_UNMAPPED', lastError: 'Map every Flipkart SKU to a Nivaana product' } });
      return { state: 'BLOCKED_UNMAPPED' };
    }
    if (isFlipkartShipmentFinal(shipment.shipmentStatus)) {
      let active = shipment.stockReservations.some((item) => ['RESERVED', 'SOLD'].includes(item.status));
      if (!active) {
        const reserved = await this.reserve(shipment);
        active = reserved.success;
        if (!active) {
          await prisma.flipkartShipment.update({ where: { id: shipment.id }, data: { syncState: 'BLOCKED_STOCK', workflowStatus: 'BLOCKED_STOCK', lastError: reserved.reason } });
          return { state: 'BLOCKED_STOCK', reason: reserved.reason };
        }
      }
      try {
        const sold = await this.finalizeAsSold(shipment.id);
        await prisma.flipkartShipment.update({ where: { id: shipment.id }, data: { syncState: 'STOCK_SOLD', workflowStatus: shipment.shipmentStatus === 'DELIVERED' ? 'DELIVERED' : 'IN_TRANSIT', lastError: null } });
        return { state: 'STOCK_SOLD', ...sold };
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Flipkart sold-stock conversion failed';
        await prisma.flipkartShipment.update({ where: { id: shipment.id }, data: { syncState: 'BLOCKED_STOCK', workflowStatus: 'BLOCKED_STOCK', lastError: reason } });
        return { state: 'BLOCKED_STOCK', reason };
      }
    }
    const reservation = await this.reserve(shipment);
    await prisma.flipkartShipment.update({ where: { id: shipment.id }, data: reservation.success ? { syncState: 'STOCK_RESERVED', workflowStatus: shipment.hold ? 'ON_HOLD' : shipment.shipmentStatus === 'APPROVED' ? 'READY_TO_PACK' : shipment.shipmentStatus === 'PACKED' ? (shipment.fulfilmentType === 'SELF_SHIP' ? 'READY_SELF_SHIP' : 'READY_TO_DISPATCH') : 'AWAITING_FLIPKART_PICKUP', lastError: null } : { syncState: 'BLOCKED_STOCK', workflowStatus: 'BLOCKED_STOCK', lastError: reservation.reason } });
    return { state: reservation.success ? 'STOCK_RESERVED' : 'BLOCKED_STOCK', ...reservation };
  }
}

export const flipkartOrderRoutingService = new FlipkartOrderRoutingService();
