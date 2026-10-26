import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../models/prisma.js';
import { amazonCarrierFor, isKnownAmazonCarrierCode } from '../utils/amazonCarrier.js';
import { canApplyShipmozoStatus, type NivaanaShipmentStatus } from '../utils/shipmozo-status.js';
import {
  asShipmozoWorkflowData,
  extractShipmozoOrderId,
  SHIPMOZO_OPERATION_STAGES,
} from '../utils/shipmozo-workflow.js';
import { ekartService, type CreateShipmentPayload } from './ekart.service.js';
import { AmazonListingScope } from './amazon-listing-scope.service.js';
import {
  AmazonFulfillmentError,
  amazonOrderFulfillmentService,
  type AmazonFulfillmentActor,
} from './amazon-order-fulfillment.service.js';
import { amazonProductionWriteGuardService } from './amazon-production-write-guard.service.js';
import { amazonTestOrderService, isAmazonTestOrderId } from './amazon-test-order.service.js';
import { buildShipmozoPublicTrackingUrl, shipmozoService } from './shipmozo.service.js';
import { shipmozoOperationService } from './shipmozo-operation.service.js';

/**
 * Amazon Self Ship "Ship now": book Ekart / Shipmozo (or save a manual courier), then confirm
 * the shipment to Amazon in the same call. Delivery status after that is kept in Nivaana only;
 * Amazon reads it from the courier. Flow and rules: docs/Amazon/Amazon_Order_Fulfillment.md §5.
 */

export type AmazonShippingProvider = 'EKART' | 'SHIPMOZO' | 'MANUAL';

export type AmazonShipNowInput = {
  provider: AmazonShippingProvider;
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  paymentType: 'PREPAID' | 'COD';
  codAmount?: number | undefined;
  /** Buyer address pasted from Seller Central; sent to the courier, never stored */
  address?: {
    name: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string | undefined;
    city: string;
    state: string;
    pincode: string;
  } | undefined;
  manual?: {
    carrierCode: string;
    courierName: string;
    trackingNumber: string;
    trackingLink?: string | undefined;
  } | undefined;
  shipmozo?: { warehouseId?: string | undefined; courierId?: string | undefined } | undefined;
  ekart?: { pickupAlias?: string | undefined } | undefined;
};

export const AMAZON_DELIVERY_STATUSES = [
  'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'rto_initiated', 'rto_delivered',
] as const satisfies readonly NivaanaShipmentStatus[];
export type AmazonDeliveryStatus = typeof AMAZON_DELIVERY_STATUSES[number];
const TERMINAL_DELIVERY_STATUSES = new Set<string>(['delivered', 'rto_delivered']);

/** Fulfilment steps from which Ship now may start (nothing booked yet) */
const SHIP_NOW_FROM = ['READY_TO_PICK', 'PICK_CREATED', 'PACKED', 'SHIPPING_SELECTED'];
/** Fulfilment steps after the parcel has left (delivery status may change) */
const SHIPPED_STATUSES = [
  'SHIPPED_INTERNAL', 'AMAZON_CONFIRMATION_PENDING', 'AMAZON_CONFIRMATION_FAILED',
  'AMAZON_CONFIRMATION_UNKNOWN', 'AMAZON_CONFIRMED',
];
const BOOKING_STATUS = 'BOOKING_COURIER';

const shipmozoNextSyncAt = () => new Date(Date.now() + env.SHIPMOZO_TRACKING_RECHECK_MINUTES * 60_000);
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
const roundMoney = (value: number) => Math.round(value * 100) / 100;
const findUrl = (value: unknown, depth = 0): string | null => {
  if (typeof value === 'string') return /^https?:\/\//.test(value.trim()) ? value.trim() : null;
  if (!value || typeof value !== 'object' || depth > 4) return null;
  for (const nested of Object.values(value as Record<string, unknown>)) {
    const found = findUrl(nested, depth + 1);
    if (found) return found;
  }
  return null;
};

export class AmazonOrderShippingService {
  private fail(message: string, statusCode = 409, code = 'AMAZON_FULFILLMENT_INVALID_STATE'): never {
    throw new AmazonFulfillmentError(message, statusCode, code);
  }

  private actorData(actor: AmazonFulfillmentActor) {
    return {
      ...(actor.userId !== undefined ? { actorUserId: actor.userId } : {}),
      ...(actor.userType !== undefined ? { actorUserType: actor.userType } : {}),
    };
  }

  private async scopedOrder(orderId: string, scope: AmazonListingScope) {
    if (!/^\d+$/.test(orderId)) this.fail('Invalid Amazon order ID', 400, 'VALIDATION_ERROR');
    const order = await prisma.amazonMarketplaceOrder.findFirst({
      where: { id: BigInt(orderId), sellerId: scope.sellerId, marketplaceId: scope.marketplaceId },
      include: { items: { include: { product: true } }, routeHandoff: true, fulfillment: true },
    });
    if (!order) this.fail('Amazon order not found', 404, 'AMAZON_ORDER_NOT_FOUND');
    return order;
  }

  /** Every check that can fail before money is spent on a courier */
  private validateShipNow(order: Awaited<ReturnType<AmazonOrderShippingService['scopedOrder']>>, input: AmazonShipNowInput) {
    const isTest = isAmazonTestOrderId(order.amazonOrderId);
    if (order.fulfilmentType !== 'MFN') this.fail('Ship now is available only for Self Ship (MFN) orders');
    if (order.isCancelled) this.fail('Amazon cancelled this order');
    if (order.orderStatus.toUpperCase() === 'SHIPPED') this.fail('Amazon already shows this order as shipped');
    if (order.routeHandoff?.status !== 'STOCK_RESERVED') {
      this.fail(`Nivaana stock is not reserved for this order${order.routeHandoff?.blockedReason ? `: ${order.routeHandoff.blockedReason}` : ''}`);
    }
    const fulfillment = order.fulfillment;
    if (!fulfillment) this.fail('Amazon fulfillment workflow is not initialized; refresh the order');
    if (fulfillment.trackingNumber) {
      this.fail(`This order already has tracking number ${fulfillment.trackingNumber}`);
    }
    if (fulfillment.workflowStatus === BOOKING_STATUS) this.fail('A courier booking for this order is already in progress');
    if (!SHIP_NOW_FROM.includes(fulfillment.workflowStatus)) {
      this.fail(`Ship now is not available while fulfillment is ${fulfillment.workflowStatus}`);
    }
    if (isTest && input.provider !== 'MANUAL') {
      this.fail('Test orders can use Manual shipping only; Ekart and Shipmozo would book a real courier',
        409, 'AMAZON_TEST_ORDER_EXTERNAL_WRITE_BLOCKED');
    }
    if (input.provider === 'MANUAL') {
      if (!input.manual) this.fail('Courier and tracking number are required', 400, 'VALIDATION_ERROR');
      if (!isKnownAmazonCarrierCode(input.manual.carrierCode)) {
        this.fail(`Unknown Amazon courier code ${input.manual.carrierCode}`, 400, 'VALIDATION_ERROR');
      }
    } else if (!input.address) {
      this.fail('The buyer\'s name, phone and address are required to book a courier', 400, 'VALIDATION_ERROR');
    }
    if (input.provider === 'SHIPMOZO') {
      if (!env.SHIPMOZO_INTEGRATION_ENABLED) this.fail('Shipmozo is switched off in this environment', 409, 'SHIPMOZO_DISABLED');
      if (!shipmozoService.isConfigured()) this.fail('Shipmozo credentials are not configured', 503, 'SHIPMOZO_NOT_CONFIGURED');
    }
    if (input.paymentType === 'COD' && !(Number(input.codAmount) > 0)) {
      this.fail('COD amount is required for a Cash on Delivery order', 400, 'VALIDATION_ERROR');
    }
    const unmapped = order.items.filter((item) => !item.product);
    if (order.items.length === 0 || unmapped.length > 0) this.fail('Every item must be linked to a Nivaana product');
    return { isTest, fulfillment };
  }

  private shipmentItems(order: Awaited<ReturnType<AmazonOrderShippingService['scopedOrder']>>) {
    return order.items.map((item) => {
      const product = item.product!;
      const quantity = Math.max(1, item.quantityOrdered);
      const unitPrice = Number(item.unitPrice ?? 0);
      return {
        name: String(item.title || product.name || product.shortname || product.puc).trim().slice(0, 200),
        sku: item.sellerSku || product.puc,
        quantity,
        unitPrice,
        lineTotal: roundMoney(unitPrice * quantity),
        hsn: String(product.hsn_code || '').trim(),
        gstRate: Number(product.gst_rate ?? 0),
        category: product.category || 'Other',
      };
    });
  }

  private async bookShipmozo(order: Awaited<ReturnType<AmazonOrderShippingService['scopedOrder']>>, input: AmazonShipNowInput) {
    const items = this.shipmentItems(order);
    const address = input.address!;
    const warehouseId = input.shipmozo?.warehouseId?.trim() || env.SHIPMOZO_WAREHOUSE_ID;
    const courierId = input.shipmozo?.courierId?.trim();
    const idempotencyKey = `amazon-forward:${order.amazonOrderId}`;
    await shipmozoOperationService.retireCancelled(idempotencyKey);
    const operation = await shipmozoOperationService.begin({
      idempotencyKey,
      providerOrderId: order.amazonOrderId,
      direction: 'forward',
      operationType: 'create_shipment',
      requestPayload: {
        source: 'AMAZON',
        amazon_order_id: order.amazonOrderId,
        payment_type: input.paymentType,
        product_count: items.length,
        weight: input.weightGrams,
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
        assignment_mode: courierId ? 'MANUAL' : 'AUTO',
      },
    });

    let workflowData = asShipmozoWorkflowData(operation.providerResponse);
    let assignment = asShipmozoWorkflowData(workflowData.assignment);
    let failureStage: string = SHIPMOZO_OPERATION_STAGES.pushOrderFailed;
    try {
      if ([SHIPMOZO_OPERATION_STAGES.initialized, SHIPMOZO_OPERATION_STAGES.pushOrderFailed].includes(operation.stage as any)) {
        const pushedOrder = await shipmozoService.pushOrder({
          order_id: order.amazonOrderId,
          order_date: order.purchaseDate.toISOString().slice(0, 10),
          consignee_name: address.name,
          consignee_phone: address.phone,
          consignee_alternate_phone: '',
          consignee_email: '',
          consignee_address_line_one: address.addressLine1,
          consignee_address_line_two: address.addressLine2 || '',
          consignee_pin_code: address.pincode,
          consignee_city: address.city,
          consignee_state: address.state,
          product_detail: items.map((item) => ({
            name: item.name,
            sku_number: item.sku,
            quantity: item.quantity,
            discount: 0,
            hsn: item.hsn,
            unit_price: item.unitPrice,
            product_category: item.category,
          })),
          payment_type: input.paymentType,
          cod_amount: input.paymentType === 'COD' ? Number(input.codAmount) : 0,
          shipping_charges: 0,
          weight: input.weightGrams,
          length: input.lengthCm,
          width: input.widthCm,
          height: input.heightCm,
          gst_ewaybill_number: '',
          gstin_number: '',
          ...(warehouseId ? { warehouse_id: warehouseId } : {}),
        });
        const shipmozoOrderId = extractShipmozoOrderId(pushedOrder);
        if (!shipmozoOrderId) throw new Error('Shipmozo accepted the order but did not return its internal order ID');
        workflowData = { shipmozo_order_id: shipmozoOrderId, push_order: pushedOrder };
        await shipmozoOperationService.stage(operation.id, SHIPMOZO_OPERATION_STAGES.orderPushed, {
          providerReference: String(pushedOrder.refrence_id || pushedOrder.reference_id || ''),
          providerResponse: workflowData,
        });
      }

      const shipmozoOrderId = extractShipmozoOrderId(workflowData);
      if (!shipmozoOrderId) throw new Error('Cannot resume Shipmozo shipment: internal order ID was not recorded');

      if (!Object.keys(assignment).length
        || [SHIPMOZO_OPERATION_STAGES.orderPushed, SHIPMOZO_OPERATION_STAGES.courierAssignmentFailed].includes(operation.stage as any)) {
        failureStage = SHIPMOZO_OPERATION_STAGES.courierAssignmentFailed;
        assignment = courierId
          ? await shipmozoService.assignCourier(shipmozoOrderId, courierId)
          : await shipmozoService.autoAssignOrder(shipmozoOrderId);
        workflowData = { ...workflowData, assignment };
        await shipmozoOperationService.stage(operation.id, SHIPMOZO_OPERATION_STAGES.courierAssigned, { providerResponse: workflowData });
      }

      // Ship now always asks for the pickup (the website form does the same)
      if (!workflowData.pickup) {
        failureStage = SHIPMOZO_OPERATION_STAGES.pickupSchedulingFailed;
        const pickup = await shipmozoService.schedulePickup(shipmozoOrderId);
        assignment = { ...assignment, ...pickup };
        workflowData = { ...workflowData, assignment, pickup };
        await shipmozoOperationService.stage(operation.id, SHIPMOZO_OPERATION_STAGES.pickupScheduled, { providerResponse: workflowData });
      }

      const awbNumber = String(assignment.awb_number || '').trim();
      if (!awbNumber) throw new Error('Shipmozo accepted the order but did not return an AWB. Check the order in Shipmozo before retrying.');
      const courierName = String(assignment.courier_company || assignment.courier || assignment.courier_company_service || '').trim();
      return {
        trackingNumber: awbNumber,
        courierName: courierName || 'Shipmozo courier',
        publicTrackingLink: buildShipmozoPublicTrackingUrl(awbNumber),
        providerOrderId: shipmozoOrderId,
        complete: async () => {
          await shipmozoOperationService.stage(operation.id, SHIPMOZO_OPERATION_STAGES.shipmentPersisted, {
            status: 'active',
            awbNumber,
            courierName,
            providerResponse: workflowData,
            nextSyncAt: Date.now(),
          });
        },
        failPersistence: async (error: unknown) => {
          await shipmozoOperationService.fail(operation.id, SHIPMOZO_OPERATION_STAGES.shipmentPersistenceFailed, error);
        },
      };
    } catch (error) {
      await shipmozoOperationService.fail(operation.id, failureStage, error);
      throw error;
    }
  }

  private async bookEkart(order: Awaited<ReturnType<AmazonOrderShippingService['scopedOrder']>>, input: AmazonShipNowInput) {
    const items = this.shipmentItems(order);
    const address = input.address!;
    const addresses = await ekartService.getAddresses();
    const alias = input.ekart?.pickupAlias?.trim();
    const pickup = (alias ? addresses.find((entry) => entry.alias.toLowerCase() === alias.toLowerCase()) : undefined) ?? addresses[0];
    if (!pickup) throw new Error('No Ekart pickup address is registered');
    const missingHsn = items.filter((item) => !item.hsn);
    if (missingHsn.length > 0) throw new Error(`HSN code missing on product(s): ${missingHsn.map((item) => item.sku).join(', ')}`);

    // Amazon prices include GST; split it out per line for Ekart's invoice fields
    const ekartItems = items.map((item) => {
      const taxable = roundMoney(item.lineTotal / (1 + item.gstRate / 100));
      return {
        product_name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        hsn_code: item.hsn,
        ...(taxable >= 1 ? { taxable_value: taxable, igst_tax_value: roundMoney(item.lineTotal - taxable) } : {}),
      };
    });
    const total = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
    const taxable = roundMoney(ekartItems.reduce((sum, item) => sum + (item.taxable_value ?? 0), 0));
    const topHsn = [...items].sort((left, right) => right.lineTotal - left.lineTotal)[0]!.hsn;
    const payload: CreateShipmentPayload = {
      seller_name: pickup.alias || 'Seller',
      seller_address: `${pickup.address_line1}${pickup.address_line2 ? `, ${pickup.address_line2}` : ''}, ${pickup.city}, ${pickup.state} - ${pickup.pincode}`,
      order_number: order.amazonOrderId,
      invoice_number: `AMZ-${order.amazonOrderId}`,
      invoice_date: new Date().toISOString().slice(0, 10),
      consignee_name: address.name,
      consignee_gst_amount: 0,
      products_desc: items.map((item) => `${item.name} (Qty: ${item.quantity})`).join(', ').slice(0, 500),
      payment_mode: input.paymentType === 'COD' ? 'COD' : 'Prepaid',
      total_amount: total,
      tax_value: roundMoney(total - taxable),
      taxable_amount: taxable,
      commodity_value: String(taxable),
      quantity: items.reduce((sum, item) => sum + item.quantity, 0),
      weight: input.weightGrams,
      length: input.lengthCm,
      width: input.widthCm,
      height: input.heightCm,
      ...(input.paymentType === 'COD' ? { cod_amount: Number(input.codAmount) } : {}),
      category_of_goods: items[0]!.category,
      pickup_location: { name: pickup.alias },
      return_location: { name: pickup.alias },
      drop_location: {
        location_type: 'Home',
        name: address.name,
        address: [address.addressLine1, address.addressLine2].filter(Boolean).join(', '),
        city: address.city,
        state: address.state,
        country: 'India',
        pin: Number(address.pincode),
        phone: Number(address.phone),
      },
    };
    const result = await ekartService.createForwardShipment(payload, { items: ekartItems, hsnCode: topHsn });
    if (!result.tracking_id) throw new Error('Ekart did not return a tracking ID');
    return {
      trackingNumber: String(result.tracking_id),
      courierName: 'Ekart Logistics',
      publicTrackingLink: `https://app.elite.ekartlogistics.in/track/${result.tracking_id}`,
      providerOrderId: null as string | null,
    };
  }

  private async recordFailure(orderId: bigint, fulfillmentId: bigint, action: string, error: unknown, actor: AmazonFulfillmentActor) {
    const message = errorMessage(error);
    await prisma.$transaction([
      prisma.amazonOrderFulfillment.update({ where: { id: fulfillmentId }, data: { lastError: message } }),
      prisma.amazonOrderFulfillmentException.create({ data: {
        orderId, fulfillmentId, action, errorCode: error instanceof AmazonFulfillmentError ? error.code : 'COURIER_BOOKING_FAILED', message,
      } }),
      prisma.amazonOrderFulfillmentAudit.create({ data: {
        orderId, fulfillmentId, action, outcome: 'FAILED', details: { message }, ...this.actorData(actor),
      } }),
    ]).catch((recordError) => logger.error({ recordError, orderId: String(orderId) }, 'Failed to record Amazon Ship now failure'));
  }

  async shipNow(orderId: string, scope: AmazonListingScope, input: AmazonShipNowInput, actor: AmazonFulfillmentActor) {
    const order = await this.scopedOrder(orderId, scope);
    const { isTest, fulfillment } = this.validateShipNow(order, input);
    if (!isTest) {
      const writeStatus = await amazonProductionWriteGuardService.status(scope.sellerId, scope.marketplaceId);
      if (!writeStatus.effectiveEnabled) {
        this.fail('Amazon writes are disabled in this environment, so the shipment could not be confirmed to Amazon. Nothing was booked.',
          409, 'AMAZON_PRODUCTION_WRITES_DISABLED');
      }
      if (!scope.client.confirmShipment) this.fail('Amazon shipment confirmation client is unavailable', 503, 'AMAZON_CONFIRMATION_UNAVAILABLE');
    }

    // Lock the order so a second click cannot book a second courier
    const claimed = await prisma.amazonOrderFulfillment.updateMany({
      where: { id: fulfillment.id, workflowStatus: { in: SHIP_NOW_FROM }, trackingNumber: null },
      data: { workflowStatus: BOOKING_STATUS, lastError: null },
    });
    if (claimed.count !== 1) this.fail('This order is already being shipped', 409, 'AMAZON_SHIP_NOW_IN_PROGRESS');

    const action = `SHIP_NOW_${input.provider}`;
    let booking: {
      trackingNumber: string; courierName: string; publicTrackingLink: string | null; providerOrderId: string | null;
      complete?: () => Promise<void>; failPersistence?: (error: unknown) => Promise<void>;
    };
    try {
      if (input.provider === 'SHIPMOZO') booking = await this.bookShipmozo(order, input);
      else if (input.provider === 'EKART') booking = await this.bookEkart(order, input);
      else {
        booking = {
          trackingNumber: input.manual!.trackingNumber.trim(),
          courierName: input.manual!.courierName.trim() || input.manual!.carrierCode,
          publicTrackingLink: input.manual!.trackingLink?.trim() || null,
          providerOrderId: null,
        };
      }
    } catch (error) {
      await prisma.amazonOrderFulfillment.update({
        where: { id: fulfillment.id }, data: { workflowStatus: fulfillment.workflowStatus },
      });
      await this.recordFailure(order.id, fulfillment.id, action, error, actor);
      throw new AmazonFulfillmentError(`${input.provider === 'MANUAL' ? 'Saving the shipment' : `${input.provider === 'EKART' ? 'Ekart' : 'Shipmozo'} booking`} failed: ${errorMessage(error)}`,
        502, 'COURIER_BOOKING_FAILED');
    }

    const carrier = input.provider === 'MANUAL'
      ? { carrierCode: input.manual!.carrierCode, carrierName: booking.courierName }
      : amazonCarrierFor(booking.courierName);
    const now = new Date();
    try {
      await prisma.$transaction([
        prisma.amazonOrderFulfillment.update({ where: { id: fulfillment.id }, data: {
          workflowStatus: 'TRACKING_READY',
          shippingProvider: input.provider,
          providerOrderId: booking.providerOrderId,
          shippingMethod: 'Standard',
          logisticsPartner: input.provider === 'MANUAL' ? booking.courierName : input.provider,
          courierCode: carrier.carrierCode,
          courierName: carrier.carrierName,
          trackingNumber: booking.trackingNumber,
          publicTrackingLink: booking.publicTrackingLink,
          shippingDate: now,
          packageWeightGrams: input.weightGrams,
          packageLengthCm: input.lengthCm,
          packageWidthCm: input.widthCm,
          packageHeightCm: input.heightCm,
          pickedAt: fulfillment.pickedAt ?? now,
          packedAt: fulfillment.packedAt ?? now,
          deliveryStatus: 'shipped',
          deliveryStatusSource: input.provider,
          deliveryProviderStatus: null,
          deliveryUpdatedAt: now,
          deliveredAt: null,
          deliveryNextSyncAt: input.provider === 'SHIPMOZO' ? shipmozoNextSyncAt() : null,
          lastError: null,
        } }),
        prisma.amazonOrderFulfillmentAudit.create({ data: {
          orderId: order.id, fulfillmentId: fulfillment.id, action, fromStatus: fulfillment.workflowStatus,
          toStatus: 'TRACKING_READY', outcome: 'SUCCESS',
          details: { provider: input.provider, trackingNumber: booking.trackingNumber, courierName: booking.courierName,
            amazonCarrierCode: carrier.carrierCode, paymentType: input.paymentType },
          ...this.actorData(actor),
        } }),
      ]);
      await booking.complete?.();
    } catch (error) {
      await booking.failPersistence?.(error);
      // The courier is booked; keep the AWB visible so nobody books again
      await prisma.amazonOrderFulfillment.update({ where: { id: fulfillment.id }, data: { workflowStatus: fulfillment.workflowStatus } })
        .catch(() => undefined);
      await this.recordFailure(order.id, fulfillment.id, action,
        new Error(`Courier booked (${booking.courierName}, AWB ${booking.trackingNumber}) but Nivaana could not save it: ${errorMessage(error)}. Use Manual with this AWB.`), actor);
      throw new AmazonFulfillmentError(`Courier booked with AWB ${booking.trackingNumber}, but saving it failed. Use Ship now → Manual with this AWB.`,
        500, 'AMAZON_SHIP_NOW_SAVE_FAILED');
    }

    let amazonConfirmed = false;
    let amazonError: string | null = null;
    try {
      if (isTest) {
        await amazonOrderFulfillmentService.markShipped(orderId, scope, actor);
        await amazonTestOrderService.updateStatus(orderId, scope, 'SHIPPED');
      } else {
        await amazonOrderFulfillmentService.shipAndConfirmToAmazon(orderId, scope, actor);
      }
      amazonConfirmed = !isTest;
    } catch (error) {
      amazonError = errorMessage(error);
      logger.warn({ amazonOrderId: order.amazonOrderId, error: amazonError }, 'Amazon Ship now: courier booked, Amazon confirmation failed');
    }

    const updated = await amazonOrderFulfillmentService.get(orderId, scope);
    return {
      fulfillment: updated,
      provider: input.provider,
      trackingNumber: booking.trackingNumber,
      courierName: booking.courierName,
      amazonCarrierCode: carrier.carrierCode,
      amazonConfirmed,
      contactsAmazon: !isTest,
      amazonError,
    };
  }

  /** Fix the courier sent to Amazon after Amazon rejected the confirmation, before retrying it */
  async updateCourier(orderId: string, scope: AmazonListingScope, input: { carrierCode: string; courierName: string }, actor: AmazonFulfillmentActor) {
    const order = await this.scopedOrder(orderId, scope);
    const fulfillment = order.fulfillment;
    if (!fulfillment || !['AMAZON_CONFIRMATION_FAILED', 'SHIPPED_INTERNAL', 'TRACKING_READY'].includes(fulfillment.workflowStatus)) {
      this.fail('The courier can be changed only before Amazon accepted the shipment');
    }
    if (!isKnownAmazonCarrierCode(input.carrierCode)) this.fail(`Unknown Amazon courier code ${input.carrierCode}`, 400, 'VALIDATION_ERROR');
    await prisma.$transaction([
      prisma.amazonOrderFulfillment.update({ where: { id: fulfillment.id }, data: {
        courierCode: input.carrierCode, courierName: input.courierName.trim() || input.carrierCode,
      } }),
      prisma.amazonOrderFulfillmentAudit.create({ data: {
        orderId: order.id, fulfillmentId: fulfillment.id, action: 'UPDATE_AMAZON_COURIER',
        fromStatus: fulfillment.workflowStatus, toStatus: fulfillment.workflowStatus, outcome: 'SUCCESS',
        details: { from: { code: fulfillment.courierCode, name: fulfillment.courierName }, to: input },
        ...this.actorData(actor),
      } }),
    ]);
    return amazonOrderFulfillmentService.get(orderId, scope);
  }

  /** Team sets the delivery status by hand (any value, so mistakes can be corrected). Nivaana only. */
  async updateDeliveryStatusManually(orderId: string, scope: AmazonListingScope,
    input: { status: AmazonDeliveryStatus; note?: string | undefined }, actor: AmazonFulfillmentActor) {
    const order = await this.scopedOrder(orderId, scope);
    const fulfillment = order.fulfillment;
    if (order.fulfilmentType !== 'MFN') this.fail('Amazon updates the delivery status of FBA and Easy Ship orders');
    if (!fulfillment?.trackingNumber || !SHIPPED_STATUSES.includes(fulfillment.workflowStatus)) {
      this.fail('Delivery status can be updated only after the order is shipped');
    }
    await this.applyDeliveryStatus(fulfillment.id, {
      status: input.status, source: 'MANUAL', force: true, ...(input.note ? { note: input.note } : {}), actor,
    });
    return amazonOrderFulfillmentService.get(orderId, scope);
  }

  /**
   * Store a delivery status on the Amazon fulfilment. Courier updates (force = false) never move
   * the status backwards; a manual update may. Returns whether the status changed.
   */
  async applyDeliveryStatus(fulfillmentId: bigint, update: {
    status: string | null; source: 'EKART' | 'SHIPMOZO' | 'MANUAL'; providerStatus?: string | null | undefined;
    force?: boolean; note?: string; actor?: AmazonFulfillmentActor; nextSyncAt?: Date | null;
  }) {
    const current = await prisma.amazonOrderFulfillment.findUnique({ where: { id: fulfillmentId } });
    if (!current) return { changed: false, status: null };
    const previous = current.deliveryStatus ?? 'shipped';
    const next = update.status && (AMAZON_DELIVERY_STATUSES as readonly string[]).includes(update.status)
      ? update.status as AmazonDeliveryStatus : null;
    const applies = Boolean(next && next !== current.deliveryStatus
      && (update.force || canApplyShipmozoStatus(previous, next)));
    const now = new Date();
    const data: Prisma.AmazonOrderFulfillmentUpdateInput = {
      ...(update.providerStatus !== undefined ? { deliveryProviderStatus: update.providerStatus?.slice(0, 255) ?? null } : {}),
      ...(update.nextSyncAt !== undefined ? { deliveryNextSyncAt: update.nextSyncAt } : {}),
    };
    if (applies) {
      Object.assign(data, {
        deliveryStatus: next,
        deliveryStatusSource: update.source,
        deliveryUpdatedAt: now,
        // A manual correction away from Delivered clears the delivered date
        deliveredAt: next === 'delivered' ? now : update.force ? null : current.deliveredAt,
        ...(TERMINAL_DELIVERY_STATUSES.has(next!) ? { deliveryNextSyncAt: null } : {}),
      });
    }
    if (Object.keys(data).length > 0) {
      await prisma.amazonOrderFulfillment.update({ where: { id: fulfillmentId }, data });
    }
    if (applies) {
      await prisma.amazonOrderFulfillmentAudit.create({ data: {
        orderId: current.orderId, fulfillmentId, action: 'DELIVERY_STATUS', fromStatus: current.deliveryStatus, toStatus: next,
        outcome: 'SUCCESS',
        details: { source: update.source, providerStatus: update.providerStatus ?? null, ...(update.note ? { note: update.note } : {}) },
        ...(update.actor ? this.actorData(update.actor) : {}),
      } });
    }
    return { changed: applies, status: applies ? next : current.deliveryStatus };
  }

  /** Courier label for an Ekart / Shipmozo Amazon shipment: a PDF, or Shipmozo's label link */
  async getLabel(orderId: string, scope: AmazonListingScope): Promise<{ pdf: Buffer; contentType: string } | { labelUrl: string }> {
    const order = await this.scopedOrder(orderId, scope);
    const fulfillment = order.fulfillment;
    if (!fulfillment?.trackingNumber || !['EKART', 'SHIPMOZO'].includes(fulfillment.shippingProvider ?? '')) {
      this.fail('Labels are available only for orders shipped with Ekart or Shipmozo from Nivaana');
    }
    try {
      if (fulfillment.shippingProvider === 'EKART') {
        return { pdf: Buffer.from(await ekartService.downloadLabel([fulfillment.trackingNumber])), contentType: 'application/pdf' };
      }
      const label = await shipmozoService.getOrderLabel(fulfillment.trackingNumber);
      if (Buffer.isBuffer(label.data)) return { pdf: label.data, contentType: label.contentType };
      const labelUrl = findUrl(label.data);
      if (!labelUrl) throw new Error('Shipmozo did not return a label');
      return { labelUrl };
    } catch (error) {
      if (error instanceof AmazonFulfillmentError) throw error;
      throw new AmazonFulfillmentError(`Label download failed: ${errorMessage(error)}`, 502, 'COURIER_LABEL_FAILED');
    }
  }

  /** Amazon Self Ship fulfilment shipped with this provider and AWB, if any */
  async findByAwb(provider: 'EKART' | 'SHIPMOZO', awbNumber: string) {
    const trackingNumber = String(awbNumber || '').trim();
    if (!trackingNumber) return null;
    return prisma.amazonOrderFulfillment.findFirst({
      where: { trackingNumber, shippingProvider: provider },
      orderBy: { id: 'desc' },
    });
  }
}

export const amazonOrderShippingService = new AmazonOrderShippingService();
