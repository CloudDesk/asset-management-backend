import { FastifyReply, FastifyRequest } from 'fastify';
import axios from 'axios';
import FormData from 'form-data';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../models/prisma.js';
import {
  shipmozoCancelSchema,
  shipmozoLabelSchema,
  shipmozoPushOrderSchema,
  shipmozoRateSchema,
  shipmozoReturnOrderSchema,
  shipmozoSchedulePickupSchema,
  shipmozoServiceabilitySchema,
  shipmozoTrackSchema,
  shipmozoWarehouseQuerySchema,
  type ShipmozoPushOrderInput
} from '../schemas/shipmozo.schema.js';
import { OrderlineService } from '../services/orderline.service.js';
import { OrdersService } from '../services/orders.service.js';
import { buildShipmozoPublicTrackingUrl, shipmozoService } from '../services/shipmozo.service.js';
import { shipmozoOperationService } from '../services/shipmozo-operation.service.js';
import { shipmozoTrackingSyncService } from '../services/shipmozo-tracking-sync.service.js';
import { asyncHandler, createSuccessResponse, ValidationError } from '../utils/errorHandler.js';
import { dynamicUpdate } from '../utils/dynamicDbOperations.js';
import { normalizeShipmozoTracking } from '../utils/shipmozo-status.js';
import { extractShipmozoWebhookAwb } from '../utils/shipmozo-status.js';
import {
  asShipmozoWorkflowData,
  extractShipmozoOrderId,
  SHIPMOZO_OPERATION_STAGES
} from '../utils/shipmozo-workflow.js';

export class ShipmozoController {
  private readonly ordersService = new OrdersService();
  private readonly orderlineService = new OrderlineService();

  private async resolveShipmozoOrderId(
    orderId: string,
    direction?: 'forward' | 'reverse'
  ): Promise<{ orderId: string; operation: Awaited<ReturnType<typeof shipmozoOperationService.findLatest>> }> {
    const operation = await shipmozoOperationService.findLatest({
      providerOrderId: orderId,
      ...(direction ? { direction } : {})
    });
    return {
      orderId: extractShipmozoOrderId(operation?.providerResponse) || orderId,
      operation
    };
  }

  getConnectionStatus = asyncHandler(async (_request: FastifyRequest, reply: FastifyReply) => {
    const configured = shipmozoService.isConfigured();
    return reply.code(200).send(createSuccessResponse('Shipmozo configuration status', {
      configured,
      base_url: env.SHIPMOZO_BASE_URL,
      default_warehouse_configured: Boolean(env.SHIPMOZO_WAREHOUSE_ID),
      message: configured
        ? 'Shipmozo credentials are configured'
        : 'Shipmozo credentials are not configured'
    }));
  });

  getWarehouses = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { page } = shipmozoWarehouseQuerySchema.parse(request.query);
    const data = await shipmozoService.getWarehouses(page);
    return reply.code(200).send(createSuccessResponse('Shipmozo warehouses retrieved successfully', data));
  });

  getCountries = asyncHandler(async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await shipmozoService.getCountries();
    return reply.code(200).send(createSuccessResponse('Shipmozo countries retrieved successfully', data));
  });

  getReturnReasons = asyncHandler(async (_request: FastifyRequest, reply: FastifyReply) => {
    const data = await shipmozoService.getReturnReasons();
    return reply.code(200).send(createSuccessResponse('Shipmozo return reasons retrieved successfully', data));
  });

  checkServiceability = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = shipmozoServiceabilitySchema.parse(request.body);
    const data = await shipmozoService.checkServiceability(payload);
    return reply.code(200).send(createSuccessResponse('Shipmozo serviceability retrieved successfully', data));
  });

  calculateRates = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = shipmozoRateSchema.parse(request.body);
    const data = await shipmozoService.calculateRates(payload);
    return reply.code(200).send(createSuccessResponse('Shipmozo rates retrieved successfully', data));
  });

  createForwardShipment = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = shipmozoPushOrderSchema.parse(request.body);
    const order = await this.ordersService.findByOrderIdString(payload.order_id);

    if (!order) {
      throw new ValidationError(`Nivaana order ${payload.order_id} was not found`);
    }
    if (order.orderstatus !== 'ready_for_dispatch') {
      throw new ValidationError(
        `Order must be ready_for_dispatch before creating a Shipmozo shipment. Current status: ${order.orderstatus}`
      );
    }
    if (order.tracking_id) {
      throw new ValidationError(
        `Order already has tracking ID ${order.tracking_id}. Cancel or reconcile the existing shipment before retrying.`
      );
    }

    const warehouseId = payload.warehouse_id?.trim() || env.SHIPMOZO_WAREHOUSE_ID;
    const {
      assignment_mode: requestedAssignmentMode,
      courier_id: courierId,
      schedule_pickup: shouldSchedulePickup,
      warehouse_id: _requestWarehouseId,
      ...orderPayload
    } = payload;
    void _requestWarehouseId;
    const assignmentMode = courierId ? 'MANUAL' : (requestedAssignmentMode || 'AUTO');

    const operation = await shipmozoOperationService.begin({
      idempotencyKey: `forward:${payload.order_id}`,
      providerOrderId: payload.order_id,
      orderId: order.id,
      direction: 'forward',
      operationType: 'create_shipment',
      requestPayload: {
        order_id: payload.order_id,
        payment_type: payload.payment_type,
        product_count: payload.product_detail.length,
        weight: payload.weight,
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
        assignment_mode: assignmentMode,
        ...(courierId ? { courier_id: courierId } : {})
      }
    });

    let workflowData = asShipmozoWorkflowData(operation.providerResponse);
    let pushedOrder = asShipmozoWorkflowData(workflowData.push_order);
    let assignment = asShipmozoWorkflowData(workflowData.assignment);
    let failureStage: string = SHIPMOZO_OPERATION_STAGES.pushOrderFailed;
    try {
      if ([SHIPMOZO_OPERATION_STAGES.initialized, SHIPMOZO_OPERATION_STAGES.pushOrderFailed].includes(operation.stage as any)) {
        pushedOrder = await shipmozoService.pushOrder({
          ...orderPayload,
          ...(warehouseId ? { warehouse_id: warehouseId } : {})
        } as Omit<ShipmozoPushOrderInput, 'assignment_mode' | 'courier_id' | 'schedule_pickup'>);
        const shipmozoOrderId = extractShipmozoOrderId(pushedOrder);
        if (!shipmozoOrderId) {
          throw new Error('Shipmozo accepted the order but did not return its internal order ID');
        }
        workflowData = { shipmozo_order_id: shipmozoOrderId, push_order: pushedOrder };
        await shipmozoOperationService.stage(operation.id, SHIPMOZO_OPERATION_STAGES.orderPushed, {
          providerReference: String(pushedOrder.refrence_id || pushedOrder.reference_id || ''),
          providerResponse: workflowData
        });
      }

      const shipmozoOrderId = extractShipmozoOrderId(workflowData);
      if (!shipmozoOrderId) {
        throw new Error('Cannot resume Shipmozo shipment: internal order ID was not recorded');
      }

      if ([SHIPMOZO_OPERATION_STAGES.orderPushed, SHIPMOZO_OPERATION_STAGES.courierAssignmentFailed].includes(operation.stage as any)
        || !Object.keys(assignment).length) {
        failureStage = SHIPMOZO_OPERATION_STAGES.courierAssignmentFailed;
        assignment = assignmentMode === 'MANUAL'
          ? await shipmozoService.assignCourier(shipmozoOrderId, courierId!)
          : await shipmozoService.autoAssignOrder(shipmozoOrderId);
        workflowData = { ...workflowData, assignment };
        await shipmozoOperationService.stage(operation.id, SHIPMOZO_OPERATION_STAGES.courierAssigned, {
          providerResponse: workflowData
        });
      }

      const pickupAlreadyCompleted = [
        SHIPMOZO_OPERATION_STAGES.pickupScheduled,
        SHIPMOZO_OPERATION_STAGES.shipmentPersistenceFailed
      ].includes(operation.stage as any) && Boolean(workflowData.pickup);
      if ((shouldSchedulePickup || !assignment.awb_number) && !pickupAlreadyCompleted) {
        failureStage = SHIPMOZO_OPERATION_STAGES.pickupSchedulingFailed;
        const pickup = await shipmozoService.schedulePickup(shipmozoOrderId);
        assignment = { ...assignment, ...pickup };
        workflowData = { ...workflowData, assignment, pickup };
        await shipmozoOperationService.stage(operation.id, SHIPMOZO_OPERATION_STAGES.pickupScheduled, {
          providerResponse: workflowData
        });
      }

      const awbNumber = String(assignment.awb_number || '').trim();
      if (!awbNumber) {
        throw new Error(
          'Shipmozo accepted the order but did not return an AWB. Reconcile the order in Shipmozo before retrying.'
        );
      }

      const courierName = String(
        assignment.courier_company || assignment.courier || assignment.courier_company_service || ''
      ).trim();
      const publicTrackingLink = buildShipmozoPublicTrackingUrl(awbNumber);
      const shipmentMetadata = {
      provider: 'SHIPMOZO',
      provider_order_id: shipmozoOrderId,
      merchant_order_id: payload.order_id,
      reference_id: pushedOrder.refrence_id || assignment.refrence_id,
      warehouse_id: warehouseId || null,
      courier_id: courierId || null,
      courier_name: courierName || null,
      assignment_mode: assignmentMode,
      pickup_scheduled: shouldSchedulePickup || Boolean(assignment.lr_number),
      lr_number: assignment.lr_number || null
      };

      failureStage = SHIPMOZO_OPERATION_STAGES.shipmentPersistenceFailed;
      await dynamicUpdate('orders', { id: order.id }, {
      tracking_id: awbNumber,
      vendor: 'SHIPMOZO',
      public_tracking_link: publicTrackingLink,
      barcodes: shipmentMetadata,
      shipment_created_at: Date.now(),
      modifieddate: Date.now()
      });

      const { data: orderlines } = await this.orderlineService.findMany(
      { orderid: order.id.toString() },
      1,
      1000
      );
      for (const orderline of orderlines || []) {
        await this.orderlineService.update(orderline.id.toString(), { tracking_id: awbNumber });
      }
      await shipmozoOperationService.stage(operation.id, SHIPMOZO_OPERATION_STAGES.shipmentPersisted, {
        status: 'active',
        awbNumber,
        courierName,
        providerReference: String(pushedOrder.refrence_id || assignment.refrence_id || ''),
        providerResponse: workflowData,
        nextSyncAt: Date.now()
      });
      logger.info(
      { orderId: order.id, orderNumber: payload.order_id, awbNumber, courierName },
      'Shipmozo shipment created and stored'
      );

      return reply.code(200).send(createSuccessResponse('Shipmozo shipment created successfully', {
      order_id: payload.order_id,
      shipmozo_order_id: shipmozoOrderId,
      tracking_id: awbNumber,
      vendor: 'SHIPMOZO',
      public_tracking_link: publicTrackingLink,
      courier_name: courierName || null,
      shipment_metadata: shipmentMetadata
      }));
    } catch (error) {
      await shipmozoOperationService.fail(operation.id, failureStage, error);
      throw error;
    }
  });

  createReturnShipment = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = shipmozoReturnOrderSchema.parse(request.body);
    const warehouseId = payload.warehouse_id?.trim() || env.SHIPMOZO_WAREHOUSE_ID;

    if (payload.return_request_id) {
      const returnRequest = await prisma.returnRequest.findUnique({
        where: { id: payload.return_request_id }
      });
      if (!returnRequest) {
        throw new ValidationError(`Return request ${payload.return_request_id} was not found`);
      }
      if (returnRequest.requestReviewStatus !== 'approved') {
        throw new ValidationError('Return request must be approved before creating a Shipmozo return order');
      }
      if (returnRequest.reverseShipmentTrackingId) {
        throw new ValidationError(
          `Return request already has reverse tracking ID ${returnRequest.reverseShipmentTrackingId}`
        );
      }
    }

    const {
      return_request_id: returnRequestId,
      schedule_pickup: shouldSchedulePickup,
      warehouse_id: _requestWarehouseId,
      ...returnPayload
    } = payload;
    void _requestWarehouseId;
    const operation = await shipmozoOperationService.begin({
      idempotencyKey: `reverse:${payload.order_id}`,
      providerOrderId: payload.order_id,
      ...(returnRequestId !== undefined ? { returnRequestId } : {}),
      direction: 'reverse',
      operationType: 'create_return',
      requestPayload: {
        order_id: payload.order_id,
        return_request_id: returnRequestId,
        product_count: payload.product_detail.length,
        weight: payload.weight,
        ...(warehouseId ? { warehouse_id: warehouseId } : {}),
        return_reason_id: payload.return_reason_id,
        customer_request: payload.customer_request
      }
    });
    let failureStage: string = SHIPMOZO_OPERATION_STAGES.pushReturnFailed;
    try {
      let workflowData = asShipmozoWorkflowData(operation.providerResponse);
      let pushedOrder = asShipmozoWorkflowData(workflowData.push_order);
      if ([SHIPMOZO_OPERATION_STAGES.initialized, SHIPMOZO_OPERATION_STAGES.pushOrderFailed, 'push_return_failed'].includes(operation.stage as any)) {
        pushedOrder = await shipmozoService.pushReturnOrder({
          ...returnPayload,
          ...(warehouseId ? { warehouse_id: warehouseId } : {})
        });
        const shipmozoOrderId = extractShipmozoOrderId(pushedOrder);
        if (!shipmozoOrderId) {
          throw new Error('Shipmozo accepted the return but did not return its internal order ID');
        }
        workflowData = { shipmozo_order_id: shipmozoOrderId, push_order: pushedOrder };
        await shipmozoOperationService.stage(operation.id, 'return_pushed', {
          providerReference: String(pushedOrder.refrence_id || pushedOrder.reference_id || ''),
          providerResponse: workflowData
        });
      }

      const shipmozoOrderId = extractShipmozoOrderId(workflowData);
      if (!shipmozoOrderId) throw new Error('Cannot resume Shipmozo return: internal order ID was not recorded');
      let pickupData = asShipmozoWorkflowData(workflowData.pickup);
      const pickupAlreadyCompleted = [
        SHIPMOZO_OPERATION_STAGES.pickupScheduled,
        SHIPMOZO_OPERATION_STAGES.shipmentPersistenceFailed
      ].includes(operation.stage as any) && Boolean(Object.keys(pickupData).length);
      if (shouldSchedulePickup && !pickupAlreadyCompleted) {
        failureStage = SHIPMOZO_OPERATION_STAGES.pickupSchedulingFailed;
        pickupData = await shipmozoService.schedulePickup(shipmozoOrderId);
        workflowData = { ...workflowData, pickup: pickupData };
        await shipmozoOperationService.stage(operation.id, 'pickup_scheduled', {
          providerResponse: workflowData
        });
      }
      const awbNumber = String(pickupData.awb_number || '').trim();

      if (returnRequestId) {
        await prisma.returnRequest.update({
        where: { id: returnRequestId },
        data: {
          reverseShipmentProvider: 'SHIPMOZO',
          ...(awbNumber ? { reverseShipmentTrackingId: awbNumber, status: 'pickup_created' } : {}),
          logisticsProviderSource: 'configured_provider',
          pickupCreatedBy: 'admin',
          modifieddate: Math.floor(Date.now() / 1000)
        }
        });
      }
      failureStage = SHIPMOZO_OPERATION_STAGES.shipmentPersistenceFailed;
      await shipmozoOperationService.stage(operation.id, awbNumber ? 'return_persisted' : 'awaiting_pickup', {
        status: awbNumber ? 'active' : 'pending',
        ...(awbNumber ? { awbNumber } : {}),
        providerReference: String(pushedOrder.refrence_id || pushedOrder.reference_id || ''),
        providerResponse: workflowData,
        nextSyncAt: awbNumber ? Date.now() : null
      });
      logger.info(
      { shipmozoOrderId: payload.order_id, returnRequestId, awbNumber: awbNumber || null },
      'Shipmozo return order created'
      );

      return reply.code(200).send(createSuccessResponse('Shipmozo return order created successfully', {
      order_id: payload.order_id,
      shipmozo_order_id: shipmozoOrderId,
      reference_id: pushedOrder.refrence_id || pushedOrder.reference_id || null,
      tracking_id: awbNumber || null,
      vendor: 'SHIPMOZO',
      pickup_scheduled: shouldSchedulePickup,
      provider_response: pushedOrder,
      ...(shouldSchedulePickup ? { pickup_response: pickupData } : {})
      }));
    } catch (error) {
      await shipmozoOperationService.fail(operation.id, failureStage, error);
      throw error;
    }
  });

  schedulePickup = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = shipmozoSchedulePickupSchema.parse(request.body);
    const returnRequest = payload.return_request_id
      ? await prisma.returnRequest.findUnique({ where: { id: payload.return_request_id } })
      : null;
    if (payload.return_request_id && !returnRequest) {
      throw new ValidationError(`Return request ${payload.return_request_id} was not found`);
    }
    if (
      returnRequest?.reverseShipmentTrackingId &&
      String(returnRequest.reverseShipmentProvider || '').toUpperCase() !== 'SHIPMOZO'
    ) {
      throw new ValidationError(
        `Return request already has a ${returnRequest.reverseShipmentProvider || 'different provider'} reverse shipment`
      );
    }

    const direction = payload.return_request_id ? 'reverse' : 'forward';
    const resolved = await this.resolveShipmozoOrderId(payload.order_id, direction);
    const pickup = await shipmozoService.schedulePickup(resolved.orderId);
    const awbNumber = String(pickup.awb_number || '').trim();

    if (!awbNumber) {
      throw new Error('Shipmozo scheduled the pickup but did not return an AWB number');
    }

    if (payload.return_request_id) {
      if (
        returnRequest?.reverseShipmentTrackingId &&
        returnRequest.reverseShipmentTrackingId !== awbNumber
      ) {
        throw new ValidationError(
          `Return request already has a different reverse tracking ID: ${returnRequest.reverseShipmentTrackingId}`
        );
      }
      await prisma.returnRequest.update({
        where: { id: payload.return_request_id },
        data: {
          reverseShipmentTrackingId: awbNumber,
          reverseShipmentProvider: 'SHIPMOZO',
          logisticsProviderSource: 'configured_provider',
          pickupCreatedBy: 'admin',
          status: 'pickup_created',
          modifieddate: Math.floor(Date.now() / 1000)
        }
      });
    } else {
      const order = await this.ordersService.findByOrderIdString(payload.order_id);
      if (order) {
        if (order.tracking_id && order.tracking_id !== awbNumber) {
          throw new ValidationError(`Order already has a different tracking ID: ${order.tracking_id}`);
        }
        await dynamicUpdate('orders', { id: order.id }, {
          tracking_id: awbNumber,
          vendor: 'SHIPMOZO',
          shipment_created_at: order.shipment_created_at || Date.now(),
          modifieddate: Date.now()
        });
        const { data: orderlines } = await this.orderlineService.findMany(
          { orderid: order.id.toString() },
          1,
          1000
        );
        for (const orderline of orderlines || []) {
          await this.orderlineService.update(orderline.id.toString(), { tracking_id: awbNumber });
        }
      }
    }

    const existingOperation = resolved.operation;
    const pickupOperation = existingOperation || await shipmozoOperationService.begin({
      idempotencyKey: `${direction}:${payload.order_id}`,
      providerOrderId: payload.order_id,
      ...(payload.return_request_id ? { returnRequestId: payload.return_request_id } : {}),
      direction,
      operationType: 'schedule_pickup',
      requestPayload: { provider_order_id: payload.order_id }
    });
    await shipmozoOperationService.stage(pickupOperation.id, 'pickup_scheduled', {
      status: 'active',
      awbNumber,
      providerResponse: {
        ...asShipmozoWorkflowData(pickupOperation.providerResponse),
        pickup
      },
      nextSyncAt: Date.now()
    });

    return reply.code(200).send(createSuccessResponse('Shipmozo pickup scheduled successfully', {
      order_id: payload.order_id,
      tracking_id: awbNumber,
      vendor: 'SHIPMOZO',
      pickup
    }));
  });

  trackShipment = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { awbNumber } = shipmozoTrackSchema.parse(request.params);
    const data = await shipmozoService.trackOrder(awbNumber);
    return reply.code(200).send(createSuccessResponse('Shipmozo tracking retrieved successfully', {
      tracking_id: awbNumber,
      normalized: normalizeShipmozoTracking(data),
      tracking: data
    }));
  });

  syncOrderTracking = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { orderId?: string };
    const orderId = Number(params.orderId);
    if (!Number.isInteger(orderId) || orderId <= 0) throw new ValidationError('A valid numeric orderId is required');
    const result = await shipmozoTrackingSyncService.syncOrder(orderId);
    return reply.code(200).send(createSuccessResponse('Shipmozo order tracking synchronized successfully', result));
  });

  syncReturnTracking = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { returnRequestId?: string };
    const returnRequestId = Number(params.returnRequestId);
    if (!Number.isInteger(returnRequestId) || returnRequestId <= 0) {
      throw new ValidationError('A valid numeric returnRequestId is required');
    }
    const result = await shipmozoTrackingSyncService.syncReturn(returnRequestId);
    return reply.code(200).send(createSuccessResponse('Shipmozo return tracking synchronized successfully', result));
  });

  runTrackingSync = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const body = (request.body || {}) as { limit?: number };
    const limit = body.limit === undefined ? env.SHIPMOZO_TRACKING_SYNC_BATCH_SIZE : Number(body.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new ValidationError('limit must be an integer between 1 and 100');
    }
    const result = await shipmozoTrackingSyncService.runBatch(limit);
    return reply.code(200).send(createSuccessResponse('Shipmozo tracking batch completed', result));
  });

  handleTrackingWebhook = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const configuredSecret = env.SHIPMOZO_WEBHOOK_SECRET;
    const providedSecret = String(
      request.headers['x-shipmozo-webhook-secret'] ||
      request.headers['x-webhook-secret'] ||
      ''
    ).trim();

    if (!configuredSecret) {
      logger.error('Shipmozo webhook received before SHIPMOZO_WEBHOOK_SECRET was configured');
      return reply.code(503).send({ success: false, message: 'Webhook is not configured', statusCode: 503 });
    }
    if (providedSecret !== configuredSecret) {
      logger.warn({ secretProvided: Boolean(providedSecret) }, 'Rejected Shipmozo webhook with invalid secret');
      return reply.code(401).send({ success: false, message: 'Invalid webhook secret', statusCode: 401 });
    }

    const awbNumber = extractShipmozoWebhookAwb(request.body);
    if (!awbNumber) {
      logger.warn({ payload: request.body }, 'Shipmozo webhook did not contain an AWB number');
      return reply.code(200).send(createSuccessResponse('Shipmozo webhook ignored: AWB number missing', {
        accepted: true,
        ignored: true
      }));
    }

    // Treat the webhook as a change notification only. Re-fetch the signed,
    // authoritative tracking state using the AWB before updating Nivaana.
    const result = await shipmozoTrackingSyncService.syncByAwb(awbNumber);
    return reply.code(200).send(createSuccessResponse('Shipmozo webhook processed successfully', result));
  });

  listOperations = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const query = (request.query || {}) as Record<string, string>;
    const result = await shipmozoOperationService.list({
      status: query.status || undefined,
      direction: query.direction || undefined,
      orderId: query.order_id ? Number(query.order_id) : undefined,
      returnRequestId: query.return_request_id ? Number(query.return_request_id) : undefined
    });
    return reply.code(200).send(createSuccessResponse('Shipmozo operations retrieved successfully', result));
  });

  getOrderDetail = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as { orderId?: string };
    const orderId = String(params.orderId || '').trim();
    if (!orderId) throw new ValidationError('orderId is required');
    const resolved = await this.resolveShipmozoOrderId(orderId);
    const data = await shipmozoService.getOrderDetail(resolved.orderId);
    return reply.code(200).send(createSuccessResponse('Shipmozo order retrieved successfully', data));
  });

  getLabel = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, unknown>;
    const query = request.query as Record<string, unknown>;
    const { awbNumber, type } = shipmozoLabelSchema.parse({ ...query, ...params });
    const label = await shipmozoService.getOrderLabel(awbNumber, type);
    const providerLabel = Array.isArray(label.data) ? label.data[0] : label.data;
    const providerLabelUrl = providerLabel && typeof providerLabel === 'object'
      ? String((providerLabel as Record<string, unknown>).label || (providerLabel as Record<string, unknown>).label_url || '').trim()
      : '';
    let pdfBuffer: Buffer;

    if (Buffer.isBuffer(label.data)) {
      pdfBuffer = label.data;
    } else if (providerLabelUrl) {
      const providerFile = await axios.get<ArrayBuffer>(providerLabelUrl, {
        responseType: 'arraybuffer',
        timeout: 30_000
      });
      pdfBuffer = Buffer.from(providerFile.data);
    } else {
      throw new Error('Shipmozo did not return a downloadable label PDF');
    }

    if (pdfBuffer.length < 4 || pdfBuffer.subarray(0, 4).toString('ascii') !== '%PDF') {
      throw new Error('Shipmozo returned an invalid label file');
    }

    const order = await this.ordersService.findByTrackingId(awbNumber);
    if (!order || String(order.vendor || '').toUpperCase() !== 'SHIPMOZO') {
      return reply.type('application/pdf').send(pdfBuffer);
    }

    const storageBackendUrl = process.env.STORAGE_BACKEND_URL || 'http://localhost:4500';
    let labelUrl = providerLabelUrl;
    let labelPersisted = false;

    try {
      const formData = new FormData();
      formData.append('file', pdfBuffer, {
        filename: 'label.pdf',
        contentType: 'application/pdf'
      });
      const storageResponse = await axios.post(
        `${storageBackendUrl}/shipping/label/${encodeURIComponent(awbNumber)}`,
        formData,
        { headers: formData.getHeaders(), timeout: 30_000 }
      );
      const storedLabelUrl = String(storageResponse.data?.data?.url || '').trim();
      if (!storageResponse.data?.success || !storedLabelUrl) {
        throw new Error('Storage backend did not return a Shipmozo label URL');
      }

      labelUrl = storedLabelUrl;
      labelPersisted = true;
      await dynamicUpdate('orders', { id: order.id }, {
        label_url: storedLabelUrl,
        label_downloaded_at: Date.now(),
        modifieddate: Date.now()
      });
    } catch (error) {
      logger.warn(
        {
          awbNumber,
          storageBackendUrl,
          error: error instanceof Error ? error.message : String(error)
        },
        'Shipmozo label could not be persisted; returning the provider URL'
      );
      if (!labelUrl) throw error;
    }
    const operation = await shipmozoOperationService.findLatest({ awbNumber, direction: 'forward' });
    if (operation && labelPersisted) {
      await shipmozoOperationService.stage(operation.id, 'label_stored', {
        status: operation.status,
        providerResponse: {
          ...asShipmozoWorkflowData(operation.providerResponse),
          label_url: labelUrl
        },
        nextSyncAt: operation.nextSyncAt === null ? null : Number(operation.nextSyncAt)
      });
    }
    return reply.code(200).send(createSuccessResponse(
      labelPersisted ? 'Shipmozo label stored successfully' : 'Shipmozo label generated successfully',
      {
      tracking_id: awbNumber,
      order_id: order.id,
      label_url: labelUrl,
      label_persisted: labelPersisted
      }
    ));
  });

  cancelShipment = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const payload = shipmozoCancelSchema.parse(request.body);
    const resolved = await this.resolveShipmozoOrderId(payload.order_id);
    const data = await shipmozoService.cancelOrder(resolved.orderId, payload.awb_number);
    const operation = resolved.operation || await shipmozoOperationService.findLatest({
      awbNumber: payload.awb_number
    });
    if (operation) await shipmozoOperationService.complete(operation.id, 'shipment_cancelled', 'cancelled');
    const order = await prisma.orders.findFirst({
      where: {
        tracking_id: payload.awb_number,
        vendor: { equals: 'SHIPMOZO', mode: 'insensitive' }
      },
      include: { orderline: true }
    });
    if (order) {
      const timestamp = Date.now();
      const existingMetadata = order.barcodes && typeof order.barcodes === 'object' && !Array.isArray(order.barcodes)
        ? order.barcodes as Record<string, any>
        : {};
      await prisma.$transaction([
        prisma.orders.update({
          where: { id: order.id },
          data: {
            tracking_id: null,
            vendor: null,
            public_tracking_link: null,
            shipment_created_at: null,
            label_url: null,
            label_downloaded_at: null,
            label_printed_at: null,
            shipment_tracking_status: 'Cancelled',
            barcodes: {
              ...existingMetadata,
              cancellation: {
                provider: 'SHIPMOZO',
                status: 'confirmed',
                tracking_id: payload.awb_number,
                confirmed_at: timestamp,
                confirmation_source: 'cancel_api'
              }
            },
            modifieddate: timestamp
          }
        }),
        prisma.orderline.updateMany({
          where: { orderid: order.id },
          data: { tracking_id: null, modifieddate: timestamp }
        })
      ]);
    }
    return reply.code(200).send(createSuccessResponse('Shipmozo shipment cancelled successfully', data));
  });
}
