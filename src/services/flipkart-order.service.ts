import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { FlipkartSellerApiClient, getFlipkartSellerApiClient } from './flipkart-api.client.js';
import { flipkartOrderRoutingService } from './flipkart-order-routing.service.js';

type Actor = { userId?: number; userType?: string };
type Action = 'PACK' | 'READY_TO_DISPATCH' | 'SELF_SHIP_DISPATCH' | 'REFRESH_TRACKING' | 'MARK_DELIVERED' | 'CANCEL';

export class FlipkartOrderError extends Error {
  constructor(message: string, readonly statusCode = 400, readonly code = 'FLIPKART_ORDER_ERROR') {
    super(message);
    this.name = 'FlipkartOrderError';
  }
}

const date = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new FlipkartOrderError(`Invalid Flipkart date: ${value}`, 502, 'FLIPKART_INVALID_DATE');
  return parsed;
};

const workflowFor = (status: string, fulfilmentType: string, hold: boolean, unmapped: boolean) => {
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'DELIVERED') return 'DELIVERED';
  if (unmapped) return 'BLOCKED_UNMAPPED';
  if (hold) return 'ON_HOLD';
  if (status === 'APPROVED') return 'READY_TO_PACK';
  if (status === 'PACKED') return fulfilmentType === 'SELF_SHIP' ? 'READY_SELF_SHIP' : 'READY_TO_DISPATCH';
  if (status === 'READY_TO_DISPATCH') return 'AWAITING_FLIPKART_PICKUP';
  if (status === 'SHIPPED') return 'IN_TRANSIT';
  return 'MONITORING';
};

const serialize = (shipment: any) => ({
  ...shipment,
  id: String(shipment.id),
  orderDate: shipment.orderDate.toISOString(),
  dispatchAfterDate: shipment.dispatchAfterDate?.toISOString() ?? null,
  dispatchByDate: shipment.dispatchByDate?.toISOString() ?? null,
  invoiceDate: shipment.invoiceDate?.toISOString() ?? null,
  tentativeDeliveryDate: shipment.tentativeDeliveryDate?.toISOString() ?? null,
  deliveredAt: shipment.deliveredAt?.toISOString() ?? null,
  lastImportedAt: shipment.lastImportedAt.toISOString(),
  createdAt: shipment.createdAt.toISOString(),
  updatedAt: shipment.updatedAt.toISOString(),
  items: (shipment.items ?? []).map((item: any) => ({ ...item, id: String(item.id), shipmentId: String(item.shipmentId), listingId: item.listingId ? String(item.listingId) : null, productId: item.productId ? String(item.productId) : null, sellingPrice: item.sellingPrice?.toString() ?? null })),
  actions: (shipment.actions ?? []).map((item: any) => ({ ...item, id: String(item.id), shipmentId: String(item.shipmentId), createdAt: item.createdAt.toISOString() })),
  trackingEvents: (shipment.trackingEvents ?? []).map((item: any) => ({ ...item, id: String(item.id), shipmentId: String(item.shipmentId), eventTime: item.eventTime.toISOString(), createdAt: item.createdAt.toISOString() })),
  stockReservations: (shipment.stockReservations ?? []).map((item: any) => ({ ...item, id: String(item.id), shipmentId: String(item.shipmentId), productId: String(item.productId), listingId: item.listingId ? String(item.listingId) : null, platformStockId: item.platformStockId ? String(item.platformStockId) : null, reservedAt: item.reservedAt?.toISOString() ?? null, releasedAt: item.releasedAt?.toISOString() ?? null, soldAt: item.soldAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() })),
});

export class FlipkartOrderService {
  constructor(private readonly client: FlipkartSellerApiClient = getFlipkartSellerApiClient()) {}

  async importMockOrders(actor: Actor = {}) {
    if (this.client.mode !== 'MOCK') throw new FlipkartOrderError('Pre-approval order imports are restricted to mock mode', 409, 'FLIPKART_MOCK_MODE_REQUIRED');
    const job = await prisma.flipkartOrderImportJob.create({ data: { status: 'RUNNING', ...(actor.userId !== undefined ? { requestedByUserId: actor.userId } : {}), ...(actor.userType ? { requestedByUserType: actor.userType } : {}) } });
    let fetched = 0; let created = 0; let updated = 0; let unmapped = 0;
    try {
      const shipments = await this.client.searchShipments();
      for (const raw of shipments) {
        const skus = raw.items.map((item) => item.sku);
        const listings = await prisma.marketplaceListing.findMany({ where: { marketplace: 'FLIPKART', environment: 'MOCK', sellerSku: { in: skus } }, select: { id: true, sellerSku: true, productId: true, mappingStatus: true, unitsPerListing: true } });
        const bySku = new Map(listings.map((listing) => [listing.sellerSku, listing]));
        const items = raw.items.map((item) => {
          const listing = bySku.get(item.sku);
          const mapped = listing?.mappingStatus === 'MAPPED' && listing.productId !== null;
          return { orderItemId: item.orderItemId, sellerSku: item.sku, listingId: listing?.id ?? null, productId: mapped ? listing.productId : null, flipkartListingId: item.listingId, fsn: item.fsn, title: item.title, quantity: Math.max(1, Math.trunc(item.quantity)), unitsPerListing: listing?.unitsPerListing ?? 1, sellingPrice: item.sellingPrice, currency: item.currency, mappingStatus: mapped ? 'MAPPED' : 'UNMAPPED' };
        });
        const hasUnmapped = items.some((item) => item.mappingStatus !== 'MAPPED');
        if (hasUnmapped) unmapped += 1;
        const existing = await prisma.flipkartShipment.findUnique({ where: { environment_sellerId_shipmentId: { environment: 'MOCK', sellerId: raw.sellerId, shipmentId: raw.shipmentId } }, select: { id: true, shipmentStatus: true } });
        const orderId = raw.items[0]?.orderId ?? raw.shipmentId;
        const shipment = await prisma.flipkartShipment.upsert({
          where: { environment_sellerId_shipmentId: { environment: 'MOCK', sellerId: raw.sellerId, shipmentId: raw.shipmentId } },
          create: { sellerId: raw.sellerId, shipmentId: raw.shipmentId, orderId, locationId: raw.locationId, fulfilmentType: raw.fulfilmentType, shipmentStatus: raw.status, workflowStatus: workflowFor(raw.status, raw.fulfilmentType, raw.hold, hasUnmapped), syncState: hasUnmapped ? 'BLOCKED_UNMAPPED' : 'READY', hold: raw.hold, buyerName: raw.buyerName, buyerAddress: raw.buyerAddress as Prisma.InputJsonValue, orderDate: date(raw.orderDate), dispatchAfterDate: date(raw.dispatchAfterDate), dispatchByDate: date(raw.dispatchByDate), trackingId: raw.trackingId ?? null, deliveryPartner: raw.deliveryPartner ?? null },
          update: { locationId: raw.locationId, hold: raw.hold, buyerName: raw.buyerName, buyerAddress: raw.buyerAddress as Prisma.InputJsonValue, dispatchAfterDate: date(raw.dispatchAfterDate), dispatchByDate: date(raw.dispatchByDate), syncState: hasUnmapped ? 'BLOCKED_UNMAPPED' : 'READY', workflowStatus: workflowFor(existing?.shipmentStatus ?? raw.status, raw.fulfilmentType, raw.hold, hasUnmapped), lastImportedAt: new Date() },
        });
        await prisma.flipkartShipmentItem.deleteMany({ where: { shipmentId: shipment.id } });
        await prisma.flipkartShipmentItem.createMany({ data: items.map((item) => ({ ...item, shipmentId: shipment.id })) });
        await flipkartOrderRoutingService.reconcile(shipment.id);
        fetched += 1; existing ? updated += 1 : created += 1;
      }
      const finished = await prisma.flipkartOrderImportJob.update({ where: { id: job.id }, data: { status: 'SUCCESS', fetched, created, updated, unmapped, finishedAt: new Date() } });
      return { ...finished, id: String(finished.id), startedAt: finished.startedAt.toISOString(), finishedAt: finished.finishedAt?.toISOString() ?? null, createdAt: finished.createdAt.toISOString() };
    } catch (error) {
      await prisma.flipkartOrderImportJob.update({ where: { id: job.id }, data: { status: 'FAILED', fetched, created, updated, unmapped, failed: 1, errorMessage: error instanceof Error ? error.message : 'Unknown import error', finishedAt: new Date() } });
      throw error;
    }
  }

  async list(filters: { search?: string; status?: string; fulfilmentType?: string } = {}) {
    const where: Prisma.FlipkartShipmentWhereInput = {
      environment: 'MOCK',
      ...(filters.status ? { shipmentStatus: filters.status } : {}),
      ...(filters.fulfilmentType ? { fulfilmentType: filters.fulfilmentType } : {}),
      ...(filters.search ? { OR: [{ shipmentId: { contains: filters.search, mode: 'insensitive' } }, { orderId: { contains: filters.search, mode: 'insensitive' } }, { buyerName: { contains: filters.search, mode: 'insensitive' } }, { items: { some: { sellerSku: { contains: filters.search, mode: 'insensitive' } } } }] } : {}),
    };
    const shipments = await prisma.flipkartShipment.findMany({ where, include: { items: true, stockReservations: true, actions: { orderBy: { createdAt: 'desc' }, take: 5 }, trackingEvents: { orderBy: { eventTime: 'desc' }, take: 5 } }, orderBy: { orderDate: 'desc' } });
    return shipments.map(serialize);
  }

  async get(id: string) {
    const shipment = await prisma.flipkartShipment.findFirst({ where: { id: BigInt(id), environment: 'MOCK' }, include: { items: true, stockReservations: true, actions: { orderBy: { createdAt: 'desc' } }, trackingEvents: { orderBy: { eventTime: 'desc' } } } });
    if (!shipment) throw new FlipkartOrderError('Flipkart shipment not found', 404, 'FLIPKART_SHIPMENT_NOT_FOUND');
    return serialize(shipment);
  }

  async perform(id: string, action: Action, payload: Record<string, unknown>, actor: Actor = {}) {
    const shipment = await prisma.flipkartShipment.findFirst({ where: { id: BigInt(id), environment: 'MOCK' }, include: { items: true } });
    if (!shipment) throw new FlipkartOrderError('Flipkart shipment not found', 404, 'FLIPKART_SHIPMENT_NOT_FOUND');
    if (action !== 'CANCEL') {
      if (shipment.items.some((item) => item.mappingStatus !== 'MAPPED')) throw new FlipkartOrderError('Map every shipment SKU before fulfilment', 409, 'FLIPKART_ORDER_UNMAPPED');
      if (shipment.hold) throw new FlipkartOrderError('Flipkart has placed this shipment on hold', 409, 'FLIPKART_SHIPMENT_ON_HOLD');
      try { await flipkartOrderRoutingService.assertReadyForShipment(shipment.id); }
      catch (error) { throw new FlipkartOrderError(error instanceof Error ? error.message : 'Flipkart stock reservation is not ready', 409, 'FLIPKART_STOCK_NOT_RESERVED'); }
    }
    const requireText = (key: string) => { const value = String(payload[key] ?? '').trim(); if (!value) throw new FlipkartOrderError(`${key} is required`); return value; };
    const fromStatus = shipment.shipmentStatus;
    let result;
    let update: Prisma.FlipkartShipmentUpdateInput = {};
    if (action === 'PACK') {
      if (fromStatus !== 'APPROVED') throw new FlipkartOrderError('Only approved shipments can be packed', 409, 'INVALID_SHIPMENT_TRANSITION');
      const invoiceNumber = requireText('invoiceNumber'); const invoiceDate = requireText('invoiceDate');
      result = await this.client.packShipment({ shipmentId: shipment.shipmentId, locationId: shipment.locationId, invoiceNumber, invoiceDate });
      update = { shipmentStatus: 'PACKED', workflowStatus: shipment.fulfilmentType === 'SELF_SHIP' ? 'READY_SELF_SHIP' : 'READY_TO_DISPATCH', invoiceNumber, invoiceDate: date(invoiceDate) };
    } else if (action === 'READY_TO_DISPATCH') {
      if (shipment.fulfilmentType !== 'STANDARD' || fromStatus !== 'PACKED') throw new FlipkartOrderError('Only packed Standard shipments can be marked ready to dispatch', 409, 'INVALID_SHIPMENT_TRANSITION');
      result = await this.client.dispatchShipment({ shipmentId: shipment.shipmentId, locationId: shipment.locationId });
      update = { shipmentStatus: 'READY_TO_DISPATCH', workflowStatus: 'AWAITING_FLIPKART_PICKUP' };
    } else if (action === 'SELF_SHIP_DISPATCH') {
      if (shipment.fulfilmentType !== 'SELF_SHIP' || fromStatus !== 'PACKED') throw new FlipkartOrderError('Only packed Self Ship shipments can be dispatched', 409, 'INVALID_SHIPMENT_TRANSITION');
      const input = { shipmentId: shipment.shipmentId, locationId: shipment.locationId, invoiceNumber: shipment.invoiceNumber ?? requireText('invoiceNumber'), invoiceDate: shipment.invoiceDate?.toISOString() ?? requireText('invoiceDate'), deliveryPartner: requireText('deliveryPartner'), deliveryPartnerCode: requireText('deliveryPartnerCode'), trackingId: requireText('trackingId'), tentativeDeliveryDate: requireText('tentativeDeliveryDate') };
      result = await this.client.selfShipDispatch(input);
      update = { shipmentStatus: 'SHIPPED', workflowStatus: 'IN_TRANSIT', deliveryPartner: input.deliveryPartner, deliveryPartnerCode: input.deliveryPartnerCode, trackingId: input.trackingId, tentativeDeliveryDate: date(input.tentativeDeliveryDate) };
    } else if (action === 'MARK_DELIVERED') {
      if (shipment.fulfilmentType !== 'SELF_SHIP' || fromStatus !== 'SHIPPED') throw new FlipkartOrderError('Only shipped Self Ship shipments can be marked delivered', 409, 'INVALID_SHIPMENT_TRANSITION');
      const deliveryDate = requireText('deliveryDate');
      result = await this.client.markSelfShipDelivered({ shipmentId: shipment.shipmentId, locationId: shipment.locationId, deliveryDate });
      update = { shipmentStatus: 'DELIVERED', workflowStatus: 'DELIVERED', deliveredAt: date(deliveryDate) };
    } else if (action === 'REFRESH_TRACKING') {
      const tracking = await this.client.getTracking(shipment.shipmentId);
      result = { requestId: `tracking-${Date.now()}`, shipmentId: shipment.shipmentId, processingStatus: 'SUCCESS' as const, status: tracking.status, trackingId: tracking.trackingId ?? undefined };
      update = { shipmentStatus: tracking.status, workflowStatus: workflowFor(tracking.status, shipment.fulfilmentType, false, false), trackingId: tracking.trackingId, deliveryPartner: tracking.deliveryPartner, ...(tracking.status === 'DELIVERED' ? { deliveredAt: new Date() } : {}) };
      for (const event of tracking.events) await prisma.flipkartTrackingEvent.upsert({ where: { externalEventId: event.id }, create: { shipmentId: shipment.id, externalEventId: event.id, eventCode: event.code, status: event.status, description: event.description, location: event.location ?? null, eventTime: date(event.eventTime) }, update: { status: event.status, description: event.description, location: event.location ?? null, eventTime: date(event.eventTime) } });
    } else {
      if (['SHIPPED', 'DELIVERED', 'CANCELLED'].includes(fromStatus)) throw new FlipkartOrderError('This Flipkart shipment can no longer be cancelled', 409, 'INVALID_SHIPMENT_TRANSITION');
      const reason = requireText('reason');
      result = await this.client.cancelShipment({ shipmentId: shipment.shipmentId, reason });
      update = { shipmentStatus: 'CANCELLED', workflowStatus: 'CANCELLED', syncState: 'CANCELLED' };
    }
    if (result.processingStatus !== 'SUCCESS') throw new FlipkartOrderError(result.errorMessage ?? 'Flipkart action failed', 502, result.errorCode ?? 'FLIPKART_ACTION_FAILED');
    await prisma.$transaction([
      prisma.flipkartShipment.update({ where: { id: shipment.id }, data: update }),
      prisma.flipkartFulfillmentAction.create({ data: { shipmentId: shipment.id, action, fromStatus, toStatus: result.status, outcome: 'SIMULATED_SUCCESS', requestPayload: payload as Prisma.InputJsonValue, responsePayload: result as Prisma.InputJsonValue, externalRequestId: result.requestId, ...(actor.userId !== undefined ? { requestedByUserId: actor.userId } : {}), ...(actor.userType ? { requestedByUserType: actor.userType } : {}) } }),
    ]);
    await flipkartOrderRoutingService.reconcile(shipment.id);
    return this.get(id);
  }

  async activity() {
    const actions = await prisma.flipkartFulfillmentAction.findMany({ include: { shipment: { select: { shipmentId: true, orderId: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
    return actions.map((item) => ({ ...item, id: String(item.id), shipmentId: String(item.shipmentId), createdAt: item.createdAt.toISOString() }));
  }
}

export const flipkartOrderService = new FlipkartOrderService();
