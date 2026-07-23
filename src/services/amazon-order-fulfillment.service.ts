import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { AmazonListingScope } from './amazon-listing-scope.service.js';
import { amazonProductionWriteGuardService } from './amazon-production-write-guard.service.js';
import { AmazonEasyShipTimeSlot } from './amazon-production-listings.client.js';
import { amazonOrderRoutingService } from './amazon-order-routing.service.js';

export type AmazonFulfillmentActor = { userId?: number; userType?: string };

export class AmazonFulfillmentError extends Error {
  constructor(message: string, readonly statusCode: number, readonly code: string) {
    super(message);
    this.name = 'AmazonFulfillmentError';
  }
}

const progressedMfnStatuses = new Set([
  'PICK_CREATED', 'PACKED', 'SHIPPING_SELECTED', 'TRACKING_READY',
  'SHIPPED_INTERNAL', 'AMAZON_CONFIRMATION_FAILED', 'AMAZON_CONFIRMED',
]);

const serialize = (fulfillment: any) => ({
  ...fulfillment,
  id: String(fulfillment.id),
  orderId: String(fulfillment.orderId),
  packageLengthCm: fulfillment.packageLengthCm?.toString() ?? null,
  packageWidthCm: fulfillment.packageWidthCm?.toString() ?? null,
  packageHeightCm: fulfillment.packageHeightCm?.toString() ?? null,
  audits: (fulfillment.audits ?? []).map((audit: any) => ({
    ...audit,
    id: String(audit.id),
    orderId: String(audit.orderId),
    fulfillmentId: audit.fulfillmentId === null ? null : String(audit.fulfillmentId),
  })),
  exceptions: (fulfillment.exceptions ?? []).map((exception: any) => ({
    ...exception,
    id: String(exception.id),
    orderId: String(exception.orderId),
    fulfillmentId: exception.fulfillmentId === null ? null : String(exception.fulfillmentId),
  })),
});

export class AmazonOrderFulfillmentService {
  private fail(message: string, statusCode = 409, code = 'AMAZON_FULFILLMENT_INVALID_STATE'): never {
    throw new AmazonFulfillmentError(message, statusCode, code);
  }

  private async scopedOrder(orderId: string, scope: AmazonListingScope) {
    if (!/^\d+$/.test(orderId)) this.fail('Invalid Amazon order ID', 400, 'VALIDATION_ERROR');
    const order = await prisma.amazonMarketplaceOrder.findFirst({
      where: { id: BigInt(orderId), sellerId: scope.sellerId, marketplaceId: scope.marketplaceId },
      include: { items: true, routeHandoff: true, stockReservations: true, fulfillment: true },
    });
    if (!order) this.fail('Amazon order not found', 404, 'AMAZON_ORDER_NOT_FOUND');
    return order;
  }

  private actorData(actor: AmazonFulfillmentActor) {
    return {
      ...(actor.userId !== undefined ? { actorUserId: actor.userId } : {}),
      ...(actor.userType !== undefined ? { actorUserType: actor.userType } : {}),
    };
  }

  private async transition(orderId: bigint, action: string, allowed: string[], toStatus: string,
    data: Prisma.AmazonOrderFulfillmentUpdateInput, actor: AmazonFulfillmentActor) {
    return prisma.$transaction(async (transaction) => {
      const current = await transaction.amazonOrderFulfillment.findUnique({ where: { orderId } });
      if (!current) this.fail('Amazon fulfillment workflow is not initialized');
      if (current.workflowStatus === toStatus) return current;
      if (!allowed.includes(current.workflowStatus)) {
        this.fail(`${action} is not allowed while fulfillment is ${current.workflowStatus}`);
      }
      const updated = await transaction.amazonOrderFulfillment.update({
        where: { id: current.id }, data: { ...data, workflowStatus: toStatus, lastError: null },
      });
      await transaction.amazonOrderFulfillmentAudit.create({ data: {
        orderId, fulfillmentId: current.id, action, fromStatus: current.workflowStatus,
        toStatus, outcome: 'SUCCESS', ...this.actorData(actor),
      } });
      return updated;
    });
  }

  private async recordException(orderId: bigint, fulfillmentId: bigint, action: string, error: unknown,
    actor: AmazonFulfillmentActor, retryPayload?: Prisma.InputJsonValue) {
    const message = error instanceof Error ? error.message : 'Amazon fulfillment operation failed';
    const errorCode = error instanceof AmazonFulfillmentError ? error.code : 'AMAZON_EXTERNAL_OPERATION_FAILED';
    await prisma.$transaction([
      prisma.amazonOrderFulfillment.update({ where: { id: fulfillmentId }, data: { lastError: message } }),
      prisma.amazonOrderFulfillmentException.create({ data: {
        orderId, fulfillmentId, action, errorCode, message,
        ...(retryPayload !== undefined ? { retryPayload } : {}),
      } }),
      prisma.amazonOrderFulfillmentAudit.create({ data: {
        orderId, fulfillmentId, action, outcome: 'FAILED', details: { errorCode, message }, ...this.actorData(actor),
      } }),
    ]).catch(() => undefined);
  }

  async reconcile(orderId: bigint) {
    const order = await prisma.amazonMarketplaceOrder.findUnique({
      where: { id: orderId }, include: { routeHandoff: true, fulfillment: true },
    });
    if (!order) return null;
    const route = order.routeHandoff?.route ?? order.fulfilmentRoute;
    let status = order.isCancelled ? 'CANCELLED'
      : route === 'FBA_RECONCILIATION' ? 'READ_ONLY'
        : route === 'EASY_SHIP_HANDLING' ? 'READY_EASY_SHIP'
          : route === 'NIVAANA_SHIPPING' && order.routeHandoff?.status === 'STOCK_RESERVED' ? 'READY_TO_PICK'
            : 'BLOCKED';
    if (order.orderStatus === 'SHIPPED') {
      status = route === 'FBA_RECONCILIATION' ? 'READ_ONLY'
        : route === 'EASY_SHIP_HANDLING' ? 'AMAZON_MANAGED'
          : route === 'NIVAANA_SHIPPING' ? 'AMAZON_CONFIRMED' : status;
    }
    if (order.fulfillment && order.fulfillment.route === route && progressedMfnStatuses.has(order.fulfillment.workflowStatus)
      && !order.isCancelled && order.orderStatus !== 'SHIPPED') return order.fulfillment;
    return prisma.amazonOrderFulfillment.upsert({
      where: { orderId },
      create: {
        orderId, route, workflowStatus: status,
        amazonConfirmationStatus: route === 'NIVAANA_SHIPPING' ? 'PENDING' : 'NOT_REQUIRED',
      },
      update: {
        route, workflowStatus: status,
        amazonConfirmationStatus: route === 'NIVAANA_SHIPPING'
          ? (status === 'AMAZON_CONFIRMED' ? 'CONFIRMED' : 'PENDING') : 'NOT_REQUIRED',
      },
    });
  }

  async get(orderId: string, scope: AmazonListingScope) {
    const order = await this.scopedOrder(orderId, scope);
    if (!order.fulfillment) await this.reconcile(order.id);
    const fulfillment = await prisma.amazonOrderFulfillment.findUnique({
      where: { orderId: order.id },
      include: {
        audits: { orderBy: { createdAt: 'desc' }, take: 100 },
        exceptions: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    return fulfillment ? serialize(fulfillment) : null;
  }

  async createPickTask(orderId: string, scope: AmazonListingScope, actor: AmazonFulfillmentActor) {
    const order = await this.scopedOrder(orderId, scope);
    if (order.fulfilmentType !== 'MFN' || order.routeHandoff?.status !== 'STOCK_RESERVED') {
      this.fail('Pick tasks are available only for mapped MFN orders with reserved stock');
    }
    const reference = `AMZ-PICK-${order.amazonOrderId}`;
    const updated = await this.transition(order.id, 'CREATE_PICK_TASK', ['READY_TO_PICK'], 'PICK_CREATED', {
      pickTaskReference: reference, pickedAt: new Date(),
    }, actor);
    return serialize(updated);
  }

  async pack(orderId: string, scope: AmazonListingScope, input: {
    weightGrams: number; lengthCm: number; widthCm: number; heightCm: number; packageIdentifier?: string | undefined;
  }, actor: AmazonFulfillmentActor) {
    const order = await this.scopedOrder(orderId, scope);
    if (order.fulfilmentType !== 'MFN') this.fail('Nivaana packing is available only for MFN orders');
    const updated = await this.transition(order.id, 'PACK_ORDER', ['PICK_CREATED'], 'PACKED', {
      packedAt: new Date(), packageWeightGrams: input.weightGrams,
      packageLengthCm: input.lengthCm, packageWidthCm: input.widthCm, packageHeightCm: input.heightCm,
      ...(input.packageIdentifier ? { packageIdentifier: input.packageIdentifier } : {}),
    }, actor);
    return serialize(updated);
  }

  async selectShipping(orderId: string, scope: AmazonListingScope, input: {
    shippingMethod: string; logisticsPartner?: string | undefined;
  }, actor: AmazonFulfillmentActor) {
    const order = await this.scopedOrder(orderId, scope);
    if (order.fulfilmentType !== 'MFN') this.fail('Nivaana shipping is available only for MFN orders');
    return serialize(await this.transition(order.id, 'SELECT_SHIPPING_METHOD', ['PACKED'], 'SHIPPING_SELECTED', {
      shippingMethod: input.shippingMethod,
      ...(input.logisticsPartner ? { logisticsPartner: input.logisticsPartner } : {}),
    }, actor));
  }

  async attachDocuments(orderId: string, scope: AmazonListingScope, input: {
    invoiceUrl?: string | undefined; packingSlipUrl?: string | undefined; shippingLabelUrl?: string | undefined;
  }, actor: AmazonFulfillmentActor) {
    const order = await this.scopedOrder(orderId, scope);
    const current = order.fulfillment;
    if (!current || !['PACKED', 'SHIPPING_SELECTED', 'TRACKING_READY', 'SHIPPED_INTERNAL'].includes(current.workflowStatus)) {
      this.fail('Shipping documents can be attached only after packing');
    }
    const documentData = {
      ...(input.invoiceUrl ? { invoiceUrl: input.invoiceUrl } : {}),
      ...(input.packingSlipUrl ? { packingSlipUrl: input.packingSlipUrl } : {}),
      ...(input.shippingLabelUrl ? { shippingLabelUrl: input.shippingLabelUrl } : {}),
    };
    const updated = await prisma.amazonOrderFulfillment.update({ where: { id: current.id }, data: documentData });
    await prisma.amazonOrderFulfillmentAudit.create({ data: {
      orderId: order.id, fulfillmentId: current.id, action: 'GENERATE_SHIPPING_DOCUMENTS',
      fromStatus: current.workflowStatus, toStatus: current.workflowStatus, outcome: 'SUCCESS',
      details: { documentTypes: Object.keys(documentData) }, ...this.actorData(actor),
    } });
    return serialize(updated);
  }

  async addTracking(orderId: string, scope: AmazonListingScope, input: {
    courierCode: string; courierName: string; trackingNumber: string; shippingDate: string;
  }, actor: AmazonFulfillmentActor) {
    const order = await this.scopedOrder(orderId, scope);
    if (order.fulfilmentType !== 'MFN') this.fail('Tracking can be entered here only for MFN orders');
    return serialize(await this.transition(order.id, 'ADD_TRACKING', ['SHIPPING_SELECTED'], 'TRACKING_READY', {
      courierCode: input.courierCode, courierName: input.courierName,
      trackingNumber: input.trackingNumber, shippingDate: new Date(input.shippingDate),
    }, actor));
  }

  async markShipped(orderId: string, scope: AmazonListingScope, actor: AmazonFulfillmentActor) {
    const order = await this.scopedOrder(orderId, scope);
    if (order.fulfilmentType !== 'MFN') this.fail('Only MFN orders can be marked shipped in Nivaana');
    const current = order.fulfillment;
    if (!current?.trackingNumber || !current.courierCode || !current.shippingDate) {
      this.fail('Courier, tracking number, and shipping date are required before marking shipped');
    }
    return serialize(await this.transition(order.id, 'MARK_SHIPPED_IN_NIVAANA', ['TRACKING_READY'], 'SHIPPED_INTERNAL', {}, actor));
  }

  async shipAndConfirmToAmazon(orderId: string, scope: AmazonListingScope, actor: AmazonFulfillmentActor) {
    const writeStatus = await amazonProductionWriteGuardService.status(scope.sellerId, scope.marketplaceId);
    if (!writeStatus.effectiveEnabled) {
      this.fail('Amazon production writes are disabled by the global kill switch', 409, 'AMAZON_PRODUCTION_WRITES_DISABLED');
    }
    await this.markShipped(orderId, scope, actor);
    return this.confirmToAmazon(orderId, scope, actor);
  }

  async confirmToAmazon(orderId: string, scope: AmazonListingScope, actor: AmazonFulfillmentActor) {
    const writeStatus = await amazonProductionWriteGuardService.status(scope.sellerId, scope.marketplaceId);
    if (!writeStatus.effectiveEnabled) this.fail('Amazon production writes are disabled by the global kill switch', 409, 'AMAZON_PRODUCTION_WRITES_DISABLED');
    const order = await this.scopedOrder(orderId, scope);
    const current = order.fulfillment;
    if (order.fulfilmentType !== 'MFN' || !current || !['SHIPPED_INTERNAL', 'AMAZON_CONFIRMATION_FAILED'].includes(current.workflowStatus)) {
      this.fail('Amazon shipment confirmation is available only after an MFN order is shipped internally');
    }
    if (!current.trackingNumber || !current.courierCode || !current.shippingDate || !current.shippingMethod) {
      this.fail('Tracking and shipping details are incomplete');
    }
    if (!scope.client.confirmShipment) this.fail('Amazon shipment confirmation client is unavailable', 503, 'AMAZON_CONFIRMATION_UNAVAILABLE');
    await amazonOrderRoutingService.assertStockReservationReadyForShipment(order.id);
    try {
      await scope.client.confirmShipment({
        orderId: order.amazonOrderId, marketplaceId: order.marketplaceId,
        packageReferenceId: current.packageIdentifier || '1', carrierCode: current.courierCode,
        ...(current.courierName ? { carrierName: current.courierName } : {}),
        shippingMethod: current.shippingMethod, trackingNumber: current.trackingNumber,
        shipDate: current.shippingDate.toISOString(),
        orderItems: order.items.map((item) => ({ orderItemId: item.amazonOrderItemId, quantity: item.quantityOrdered })),
      });
      await amazonOrderRoutingService.finalizeReservationsAsSold(order.id);
      const updated = await this.transition(order.id, 'CONFIRM_SHIPMENT_TO_AMAZON', ['SHIPPED_INTERNAL', 'AMAZON_CONFIRMATION_FAILED'], 'AMAZON_CONFIRMED', {
        amazonConfirmationStatus: 'CONFIRMED', amazonConfirmedAt: new Date(),
      }, actor);
      return serialize(updated);
    } catch (error) {
      await prisma.amazonOrderFulfillment.update({ where: { id: current.id }, data: {
        workflowStatus: 'AMAZON_CONFIRMATION_FAILED', amazonConfirmationStatus: 'FAILED',
      } });
      await this.recordException(order.id, current.id, 'CONFIRM_SHIPMENT_TO_AMAZON', error, actor);
      throw error;
    }
  }

  private easyShipPackageInput(order: Awaited<ReturnType<AmazonOrderFulfillmentService['scopedOrder']>>, input: {
    weightGrams: number; lengthCm: number; widthCm: number; heightCm: number;
  }) {
    if (order.fulfilmentType !== 'EASY_SHIP') this.fail('Easy Ship actions are available only for Easy Ship orders');
    return {
      orderId: order.amazonOrderId, marketplaceId: order.marketplaceId,
      dimensions: { length: input.lengthCm, width: input.widthCm, height: input.heightCm, unit: 'cm' as const },
      weight: { value: input.weightGrams, unit: 'grams' as const },
    };
  }

  async listEasyShipSlots(orderId: string, scope: AmazonListingScope, input: {
    weightGrams: number; lengthCm: number; widthCm: number; heightCm: number;
  }, actor: AmazonFulfillmentActor) {
    const order = await this.scopedOrder(orderId, scope);
    if (!order.fulfillment || !['READY_EASY_SHIP', 'EASY_SHIP_FAILED', 'EASY_SHIP_SCHEDULED'].includes(order.fulfillment.workflowStatus)) {
      this.fail('Handover slots are unavailable for this Easy Ship order');
    }
    if (!scope.client.listEasyShipHandoverSlots) this.fail('Amazon Easy Ship client is unavailable', 503, 'AMAZON_EASY_SHIP_UNAVAILABLE');
    try {
      const slots = await scope.client.listEasyShipHandoverSlots(this.easyShipPackageInput(order, input));
      if (order.fulfillment) await prisma.amazonOrderFulfillmentAudit.create({ data: {
        orderId: order.id, fulfillmentId: order.fulfillment.id, action: 'LIST_EASY_SHIP_SLOTS', outcome: 'SUCCESS',
        details: { slots: slots.length }, ...this.actorData(actor),
      } });
      return slots;
    } catch (error) {
      if (order.fulfillment) await this.recordException(order.id, order.fulfillment.id, 'LIST_EASY_SHIP_SLOTS', error, actor, input);
      throw error;
    }
  }

  async scheduleEasyShip(orderId: string, scope: AmazonListingScope, input: {
    weightGrams: number; lengthCm: number; widthCm: number; heightCm: number;
    slot: AmazonEasyShipTimeSlot; packageIdentifier?: string | undefined;
  }, actor: AmazonFulfillmentActor) {
    const writeStatus = await amazonProductionWriteGuardService.status(scope.sellerId, scope.marketplaceId);
    if (!writeStatus.effectiveEnabled) this.fail('Amazon production writes are disabled by the global kill switch', 409, 'AMAZON_PRODUCTION_WRITES_DISABLED');
    const order = await this.scopedOrder(orderId, scope);
    if (!order.fulfillment || !['READY_EASY_SHIP', 'EASY_SHIP_FAILED'].includes(order.fulfillment.workflowStatus)) {
      this.fail('This Easy Ship order is not ready to schedule');
    }
    if (!scope.client.createEasyShipScheduledPackage) this.fail('Amazon Easy Ship client is unavailable', 503, 'AMAZON_EASY_SHIP_UNAVAILABLE');
    try {
      const result = await scope.client.createEasyShipScheduledPackage({
        ...this.easyShipPackageInput(order, input), timeSlot: input.slot,
        ...(input.packageIdentifier ? { packageIdentifier: input.packageIdentifier } : {}),
        orderItems: order.items.map((item) => ({ orderItemId: item.amazonOrderItemId })),
      });
      const handoverMethod = result.packageTimeSlot?.handoverMethod ?? input.slot.handoverMethod;
      const updated = await this.transition(order.id, 'SCHEDULE_EASY_SHIP_HANDOVER', ['READY_EASY_SHIP', 'EASY_SHIP_FAILED'], 'EASY_SHIP_SCHEDULED', {
        packageWeightGrams: input.weightGrams, packageLengthCm: input.lengthCm,
        packageWidthCm: input.widthCm, packageHeightCm: input.heightCm,
        ...(input.packageIdentifier ? { packageIdentifier: input.packageIdentifier } : {}),
        ...(result.scheduledPackageId?.packageId ? { easyShipPackageId: result.scheduledPackageId.packageId } : {}),
        easyShipSlotId: result.packageTimeSlot?.slotId ?? input.slot.slotId,
        ...(optionalDate(result.packageTimeSlot?.startTime ?? input.slot.startTime) ? { easyShipSlotStart: optionalDate(result.packageTimeSlot?.startTime ?? input.slot.startTime)! } : {}),
        ...(optionalDate(result.packageTimeSlot?.endTime ?? input.slot.endTime) ? { easyShipSlotEnd: optionalDate(result.packageTimeSlot?.endTime ?? input.slot.endTime)! } : {}),
        ...(handoverMethod ? { easyShipHandoverMethod: handoverMethod } : {}),
        easyShipStatus: result.packageStatus ?? 'SCHEDULED',
        ...(result.trackingDetails?.trackingId ? { trackingNumber: result.trackingDetails.trackingId } : {}),
      }, actor);
      return serialize(updated);
    } catch (error) {
      await prisma.amazonOrderFulfillment.update({ where: { id: order.fulfillment.id }, data: { workflowStatus: 'EASY_SHIP_FAILED' } });
      await this.recordException(order.id, order.fulfillment.id, 'SCHEDULE_EASY_SHIP_HANDOVER', error, actor, input as Prisma.InputJsonValue);
      throw error;
    }
  }

  async refreshEasyShip(orderId: string, scope: AmazonListingScope, actor: AmazonFulfillmentActor) {
    const order = await this.scopedOrder(orderId, scope);
    if (order.fulfilmentType !== 'EASY_SHIP' || !order.fulfillment?.easyShipPackageId
      || !['EASY_SHIP_SCHEDULED', 'EASY_SHIP_FAILED'].includes(order.fulfillment.workflowStatus)) {
      this.fail('Only a scheduled Easy Ship package can be refreshed');
    }
    if (!scope.client.getEasyShipScheduledPackage) this.fail('Amazon Easy Ship client is unavailable', 503, 'AMAZON_EASY_SHIP_UNAVAILABLE');
    let result;
    try {
      result = await scope.client.getEasyShipScheduledPackage(order.amazonOrderId);
    } catch (error) {
      await this.recordException(order.id, order.fulfillment.id, 'REFRESH_EASY_SHIP_HANDOVER', error, actor);
      throw error;
    }
    const updated = await prisma.amazonOrderFulfillment.update({ where: { id: order.fulfillment.id }, data: {
      ...(result.scheduledPackageId?.packageId ? { easyShipPackageId: result.scheduledPackageId.packageId } : {}),
      ...(result.packageStatus ? { easyShipStatus: result.packageStatus } : {}),
      ...(result.trackingDetails?.trackingId ? { trackingNumber: result.trackingDetails.trackingId } : {}),
      ...(result.packageTimeSlot?.slotId ? { easyShipSlotId: result.packageTimeSlot.slotId } : {}),
      ...(optionalDate(result.packageTimeSlot?.startTime) ? { easyShipSlotStart: optionalDate(result.packageTimeSlot?.startTime)! } : {}),
      ...(optionalDate(result.packageTimeSlot?.endTime) ? { easyShipSlotEnd: optionalDate(result.packageTimeSlot?.endTime)! } : {}),
      ...(result.packageTimeSlot?.handoverMethod ? { easyShipHandoverMethod: result.packageTimeSlot.handoverMethod } : {}),
      lastError: null,
    } });
    await prisma.amazonOrderFulfillmentAudit.create({ data: {
      orderId: order.id, fulfillmentId: order.fulfillment.id, action: 'REFRESH_EASY_SHIP_HANDOVER', outcome: 'SUCCESS',
      details: { packageStatus: result.packageStatus ?? null }, ...this.actorData(actor),
    } });
    return serialize(updated);
  }

  async rescheduleEasyShip(orderId: string, scope: AmazonListingScope, slot: AmazonEasyShipTimeSlot, actor: AmazonFulfillmentActor) {
    const writeStatus = await amazonProductionWriteGuardService.status(scope.sellerId, scope.marketplaceId);
    if (!writeStatus.effectiveEnabled) this.fail('Amazon production writes are disabled by the global kill switch', 409, 'AMAZON_PRODUCTION_WRITES_DISABLED');
    const order = await this.scopedOrder(orderId, scope);
    const current = order.fulfillment;
    if (order.fulfilmentType !== 'EASY_SHIP' || !current?.easyShipPackageId
      || !['EASY_SHIP_SCHEDULED', 'EASY_SHIP_FAILED'].includes(current.workflowStatus)) {
      this.fail('Easy Ship package is not available for rescheduling');
    }
    if (!scope.client.updateEasyShipScheduledPackage) this.fail('Amazon Easy Ship client is unavailable', 503, 'AMAZON_EASY_SHIP_UNAVAILABLE');
    let packages;
    try {
      packages = await scope.client.updateEasyShipScheduledPackage({
        orderId: order.amazonOrderId, marketplaceId: order.marketplaceId,
        packageId: current.easyShipPackageId, timeSlot: slot,
      });
    } catch (error) {
      await this.recordException(order.id, current.id, 'RESCHEDULE_EASY_SHIP_HANDOVER', error, actor, { slot });
      throw error;
    }
    const result = packages[0];
    const handoverMethod = result?.packageTimeSlot?.handoverMethod ?? slot.handoverMethod;
    const updated = await prisma.amazonOrderFulfillment.update({ where: { id: current.id }, data: {
      easyShipSlotId: result?.packageTimeSlot?.slotId ?? slot.slotId,
      ...(optionalDate(result?.packageTimeSlot?.startTime ?? slot.startTime) ? { easyShipSlotStart: optionalDate(result?.packageTimeSlot?.startTime ?? slot.startTime)! } : {}),
      ...(optionalDate(result?.packageTimeSlot?.endTime ?? slot.endTime) ? { easyShipSlotEnd: optionalDate(result?.packageTimeSlot?.endTime ?? slot.endTime)! } : {}),
      ...(handoverMethod ? { easyShipHandoverMethod: handoverMethod } : {}),
      easyShipStatus: result?.packageStatus ?? current.easyShipStatus,
      lastError: null,
    } });
    await prisma.amazonOrderFulfillmentAudit.create({ data: {
      orderId: order.id, fulfillmentId: current.id, action: 'RESCHEDULE_EASY_SHIP_HANDOVER', outcome: 'SUCCESS',
      details: { slotId: slot.slotId }, ...this.actorData(actor),
    } });
    return serialize(updated);
  }

  async resolveException(orderId: string, exceptionId: string, scope: AmazonListingScope, note: string,
    actor: AmazonFulfillmentActor) {
    const order = await this.scopedOrder(orderId, scope);
    if (!/^\d+$/.test(exceptionId)) this.fail('Invalid fulfillment exception ID', 400, 'VALIDATION_ERROR');
    const exception = await prisma.amazonOrderFulfillmentException.findFirst({
      where: { id: BigInt(exceptionId), orderId: order.id },
    });
    if (!exception) this.fail('Fulfillment exception not found', 404, 'AMAZON_FULFILLMENT_EXCEPTION_NOT_FOUND');
    if (exception.status === 'RESOLVED') return serializeException(exception);
    const resolved = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.amazonOrderFulfillmentException.update({
        where: { id: exception.id },
        data: {
          status: 'RESOLVED', resolutionNote: note, resolvedAt: new Date(),
          ...(actor.userId !== undefined ? { resolvedByUserId: actor.userId } : {}),
          ...(actor.userType ? { resolvedByUserType: actor.userType } : {}),
        },
      });
      await transaction.amazonOrderFulfillmentAudit.create({ data: {
        orderId: order.id, fulfillmentId: exception.fulfillmentId,
        action: 'RESOLVE_FULFILLMENT_EXCEPTION', outcome: 'SUCCESS',
        details: { exceptionId, originalAction: exception.action, note }, ...this.actorData(actor),
      } });
      return updated;
    });
    return serializeException(resolved);
  }

  async retryException(orderId: string, exceptionId: string, scope: AmazonListingScope, actor: AmazonFulfillmentActor) {
    const order = await this.scopedOrder(orderId, scope);
    if (!/^\d+$/.test(exceptionId)) this.fail('Invalid fulfillment exception ID', 400, 'VALIDATION_ERROR');
    const exception = await prisma.amazonOrderFulfillmentException.findFirst({
      where: { id: BigInt(exceptionId), orderId: order.id },
    });
    if (!exception) this.fail('Fulfillment exception not found', 404, 'AMAZON_FULFILLMENT_EXCEPTION_NOT_FOUND');
    if (exception.status !== 'OPEN') this.fail('Only open fulfillment exceptions can be retried');
    await prisma.amazonOrderFulfillmentException.update({
      where: { id: exception.id }, data: { retryCount: { increment: 1 }, lastRetriedAt: new Date() },
    });
    const payload = (exception.retryPayload ?? {}) as Record<string, any>;
    let result: unknown;
    switch (exception.action) {
      case 'CONFIRM_SHIPMENT_TO_AMAZON':
        result = await this.confirmToAmazon(orderId, scope, actor); break;
      case 'LIST_EASY_SHIP_SLOTS':
        result = await this.listEasyShipSlots(orderId, scope, payload as any, actor); break;
      case 'SCHEDULE_EASY_SHIP_HANDOVER':
        result = await this.scheduleEasyShip(orderId, scope, payload as any, actor); break;
      case 'REFRESH_EASY_SHIP_HANDOVER':
        result = await this.refreshEasyShip(orderId, scope, actor); break;
      case 'RESCHEDULE_EASY_SHIP_HANDOVER':
        result = await this.rescheduleEasyShip(orderId, scope, payload.slot as AmazonEasyShipTimeSlot, actor); break;
      default:
        this.fail(`Automatic retry is not supported for ${exception.action}`);
    }
    await prisma.amazonOrderFulfillmentException.update({
      where: { id: exception.id }, data: { status: 'RESOLVED', resolutionNote: 'Resolved by successful retry', resolvedAt: new Date(),
        ...(actor.userId !== undefined ? { resolvedByUserId: actor.userId } : {}),
        ...(actor.userType ? { resolvedByUserType: actor.userType } : {}),
      },
    });
    return { exceptionId, result };
  }
}

const serializeException = (exception: any) => ({
  ...exception, id: String(exception.id), orderId: String(exception.orderId),
  fulfillmentId: exception.fulfillmentId === null ? null : String(exception.fulfillmentId),
});

const optionalDate = (value?: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

export const amazonOrderFulfillmentService = new AmazonOrderFulfillmentService();
