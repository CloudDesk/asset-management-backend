import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  amazonEasyShipPackageSchema, amazonEasyShipRescheduleSchema, amazonEasyShipScheduleSchema,
  amazonOrderDocumentsSchema, amazonOrderImportSchema, amazonOrderPackSchema, amazonOrderQuerySchema,
  amazonOrderShippingMethodSchema, amazonOrderTrackingSchema, amazonTestOrderCreateSchema,
  amazonTestOrderStatusSchema,
  amazonFulfillmentExceptionResolutionSchema,
} from '../schemas/amazon-order.schema.js';
import { amazonListingScopeService } from '../services/amazon-listing-scope.service.js';
import { AmazonOrderImportError, amazonOrderImportService } from '../services/amazon-order-import.service.js';
import { amazonOrderJobService } from '../services/amazon-order-job.service.js';
import { AmazonFulfillmentError, amazonOrderFulfillmentService } from '../services/amazon-order-fulfillment.service.js';
import { createSuccessResponse } from '../utils/errorHandler.js';
import { amazonTestOrderService } from '../services/amazon-test-order.service.js';

const sendError = (reply: FastifyReply, error: unknown) => {
  if (error instanceof ZodError) return reply.code(400).send({ success: false, message: 'Invalid Amazon order request', code: 'VALIDATION_ERROR' });
  const known = error instanceof AmazonOrderImportError || error instanceof AmazonFulfillmentError
    ? error : new AmazonOrderImportError('Amazon order operation failed', 500, 'AMAZON_ORDER_OPERATION_FAILED');
  return reply.code(known.statusCode).send({ success: false, message: known.message, details: known.message, statusCode: known.statusCode, code: known.code });
};

export class AmazonOrderController {
  private resolveScope(request: FastifyRequest) {
    const user = (request as AuthenticatedRequest).user;
    return amazonListingScopeService.resolve(user?.id, user?.userType);
  }

  private actor(request: FastifyRequest) {
    const user = (request as AuthenticatedRequest).user;
    return { ...(user?.id !== undefined ? { userId: user.id } : {}), ...(user?.userType ? { userType: user.userType } : {}) };
  }

  private orderId(request: FastifyRequest) {
    return (request.params as { orderId?: string }).orderId ?? '';
  }

  importOrders = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as AuthenticatedRequest).user;
      const input = amazonOrderImportSchema.parse(request.body ?? {});
      const scope = await this.resolveScope(request);
      const data = await amazonOrderJobService.enqueue({
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        fullHistory: input.fullHistory,
        trigger: 'MANUAL',
        ...(user?.id !== undefined ? { requestedByUserId: user.id } : {}),
        ...(user?.userType !== undefined ? { requestedByUserType: user.userType } : {}),
      });
      return reply.code(202).send(createSuccessResponse(data.existing ? 'Amazon order import is already running' : 'Amazon order import queued', data.job));
    } catch (error) { return sendError(reply, error); }
  };

  getImportJob = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      reply.header('Cache-Control', 'no-store');
      const scope = await this.resolveScope(request);
      const jobId = (request.params as { jobId?: string }).jobId ?? '';
      const job = await amazonOrderJobService.getJob(jobId, scope.sellerId, scope.marketplaceId);
      if (!job) return reply.code(404).send({ success: false, message: 'Amazon order import job not found' });
      return reply.code(200).send(createSuccessResponse('Amazon order import job retrieved', job));
    } catch (error) { return sendError(reply, error); }
  };

  getLatestImportJob = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      reply.header('Cache-Control', 'no-store');
      const scope = await this.resolveScope(request);
      const job = await amazonOrderJobService.getLatestJob(scope.sellerId, scope.marketplaceId);
      return reply.code(200).send(createSuccessResponse('Latest Amazon order import job retrieved', job));
    } catch (error) { return sendError(reply, error); }
  };

  getOrders = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = amazonOrderQuerySchema.parse(request.query ?? {});
      const result = await amazonOrderImportService.listOrders(await this.resolveScope(request), query);
      return reply.code(200).send({
        ...createSuccessResponse('Amazon orders retrieved successfully', result.data),
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) { return sendError(reply, error); }
  };

  createTestOrder = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = amazonTestOrderCreateSchema.parse(request.body);
      const data = await amazonTestOrderService.create(await this.resolveScope(request), input);
      return reply.code(201).send(createSuccessResponse('Amazon test order created', data));
    } catch (error) { return sendError(reply, error); }
  };

  updateTestOrderStatus = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = amazonTestOrderStatusSchema.parse(request.body);
      const data = await amazonTestOrderService.updateStatus(this.orderId(request), await this.resolveScope(request), input.status);
      return reply.code(200).send(createSuccessResponse(`Amazon test order marked ${input.status.toLowerCase()}`, data));
    } catch (error) { return sendError(reply, error); }
  };

  getFulfillment = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await amazonOrderFulfillmentService.get(this.orderId(request), await this.resolveScope(request));
      return reply.code(200).send(createSuccessResponse('Amazon fulfillment retrieved', data));
    } catch (error) { return sendError(reply, error); }
  };

  createPickTask = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await amazonOrderFulfillmentService.createPickTask(this.orderId(request), await this.resolveScope(request), this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon MFN pick task created', data));
    } catch (error) { return sendError(reply, error); }
  };

  packOrder = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = amazonOrderPackSchema.parse(request.body);
      const data = await amazonOrderFulfillmentService.pack(this.orderId(request), await this.resolveScope(request), input, this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon MFN order packed', data));
    } catch (error) { return sendError(reply, error); }
  };

  selectShipping = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = amazonOrderShippingMethodSchema.parse(request.body);
      const data = await amazonOrderFulfillmentService.selectShipping(this.orderId(request), await this.resolveScope(request), input, this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon MFN shipping method selected', data));
    } catch (error) { return sendError(reply, error); }
  };

  attachDocuments = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = amazonOrderDocumentsSchema.parse(request.body);
      const data = await amazonOrderFulfillmentService.attachDocuments(this.orderId(request), await this.resolveScope(request), input, this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon fulfillment documents attached', data));
    } catch (error) { return sendError(reply, error); }
  };

  addTracking = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = amazonOrderTrackingSchema.parse(request.body);
      const data = await amazonOrderFulfillmentService.addTracking(this.orderId(request), await this.resolveScope(request), input, this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon MFN tracking added', data));
    } catch (error) { return sendError(reply, error); }
  };

  markShipped = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await amazonOrderFulfillmentService.markShipped(this.orderId(request), await this.resolveScope(request), this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon order marked shipped in Nivaana', data));
    } catch (error) { return sendError(reply, error); }
  };

  shipAndConfirm = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await amazonOrderFulfillmentService.shipAndConfirmToAmazon(
        this.orderId(request),
        await this.resolveScope(request),
        this.actor(request),
      );
      return reply.code(200).send(createSuccessResponse('Nivaana shipment marked shipped and confirmed to Amazon', data));
    } catch (error) { return sendError(reply, error); }
  };

  confirmShipment = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await amazonOrderFulfillmentService.confirmToAmazon(this.orderId(request), await this.resolveScope(request), this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon shipment confirmed', data));
    } catch (error) { return sendError(reply, error); }
  };

  listEasyShipSlots = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = amazonEasyShipPackageSchema.parse(request.body);
      const data = await amazonOrderFulfillmentService.listEasyShipSlots(this.orderId(request), await this.resolveScope(request), input, this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon Easy Ship slots retrieved', data));
    } catch (error) { return sendError(reply, error); }
  };

  scheduleEasyShip = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = amazonEasyShipScheduleSchema.parse(request.body);
      const data = await amazonOrderFulfillmentService.scheduleEasyShip(this.orderId(request), await this.resolveScope(request), input, this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon Easy Ship handover scheduled', data));
    } catch (error) { return sendError(reply, error); }
  };

  refreshEasyShip = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await amazonOrderFulfillmentService.refreshEasyShip(this.orderId(request), await this.resolveScope(request), this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon Easy Ship handover refreshed', data));
    } catch (error) { return sendError(reply, error); }
  };

  rescheduleEasyShip = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const input = amazonEasyShipRescheduleSchema.parse(request.body);
      const data = await amazonOrderFulfillmentService.rescheduleEasyShip(this.orderId(request), await this.resolveScope(request), input.slot, this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon Easy Ship handover rescheduled', data));
    } catch (error) { return sendError(reply, error); }
  };

  retryFulfillmentException = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const exceptionId = (request.params as { exceptionId?: string }).exceptionId ?? '';
      const data = await amazonOrderFulfillmentService.retryException(this.orderId(request), exceptionId, await this.resolveScope(request), this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon fulfillment operation retried', data));
    } catch (error) { return sendError(reply, error); }
  };

  resolveFulfillmentException = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const exceptionId = (request.params as { exceptionId?: string }).exceptionId ?? '';
      const input = amazonFulfillmentExceptionResolutionSchema.parse(request.body);
      const data = await amazonOrderFulfillmentService.resolveException(this.orderId(request), exceptionId, await this.resolveScope(request), input.note, this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon fulfillment exception resolved', data));
    } catch (error) { return sendError(reply, error); }
  };
}
