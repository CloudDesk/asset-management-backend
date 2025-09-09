import { FastifyRequest, FastifyReply } from 'fastify';
import { OrderlineService } from '../services/orderline.service.js';
import { 
  createOrderlineSchema, 
  updateOrderlineSchema, 
  upsertOrderlineSchema,
  orderlineParamsSchema,
  OrderlineParams
} from '../schemas/orderline.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';
import { formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';

export class OrderlineController {
  public orderlineService = new OrderlineService();

  getOrderlines = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters (not just schema-validated ones)
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.orderlineService.findMany(filters, page, limit);
    
    // Format all orderlines in the result
    const formattedData = formatEntitiesForAPI(result.data, 'orderline');
    
    const response = createSuccessResponse('Orderlines retrieved successfully', formattedData);
    return reply.code(200).send({
      ...response,
      pagination: result.pagination,
      meta: {
        filters: Object.keys(filters),
        total: result.pagination.total,
        filtered: Object.keys(filters).length > 0
      }
    });
  });

  getOrderline = asyncHandler(async (request: FastifyRequest<{ Params: OrderlineParams }>, reply: FastifyReply) => {
    const { id } = orderlineParamsSchema.parse(request.params);
    
    const orderline = await this.orderlineService.findById(id);
    
    const response = createSuccessResponse('Orderline retrieved successfully', formatEntitiesForAPI([orderline], 'orderline')[0]);
    return reply.code(200).send(response);
  });

  getOrderlineByOrderlineNumber = asyncHandler(async (request: FastifyRequest<{ Params: { orderlinenumber: string } }>, reply: FastifyReply) => {
    const { orderlinenumber } = request.params;
    
    const orderline = await this.orderlineService.findByOrderlineNumber(orderlinenumber);
    
    const response = createSuccessResponse('Orderline retrieved successfully', formatEntitiesForAPI([orderline], 'orderline')[0]);
    return reply.code(200).send(response);
  });

  getOrderlinesByOrderId = asyncHandler(async (request: FastifyRequest<{ Params: { orderid: string } }>, reply: FastifyReply) => {
    const { orderid } = request.params;
    
    const orderlines = await this.orderlineService.findByOrderId(parseInt(orderid));
    
    const response = createSuccessResponse('Orderlines retrieved successfully', formatEntitiesForAPI(orderlines, 'orderline'));
    return reply.code(200).send(response);
  });

  createOrderline = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createOrderlineSchema.parse(request.body);
    
    const orderline = await this.orderlineService.create(data);
    
    const response = createSuccessResponse('Orderline created successfully', formatEntitiesForAPI([orderline], 'orderline')[0]);
    return reply.code(201).send(response);
  });

  updateOrderline = asyncHandler(async (request: FastifyRequest<{ Params: OrderlineParams }>, reply: FastifyReply) => {
    const { id } = orderlineParamsSchema.parse(request.params);
    const data = updateOrderlineSchema.parse(request.body);
    
    const orderline = await this.orderlineService.update(id, data);
    
    const response = createSuccessResponse('Orderline updated successfully', formatEntitiesForAPI([orderline], 'orderline')[0]);
    return reply.code(200).send(response);
  });

  updateOrderlineStatus = asyncHandler(async (request: FastifyRequest<{ Params: OrderlineParams; Body: { status: string; additionalData?: Record<string, any> } }>, reply: FastifyReply) => {
    const { id } = orderlineParamsSchema.parse(request.params);
    const { status, additionalData } = request.body;
    
    if (!status) {
      return reply.code(400).send({
        success: false,
        message: 'Status is required',
        details: 'Please provide a valid status',
        statusCode: 400
      });
    }
    
    const orderline = await this.orderlineService.updateOrderlineStatus(id, status, additionalData);
    
    const response = createSuccessResponse('Orderline status updated successfully', formatEntitiesForAPI([orderline], 'orderline')[0]);
    return reply.code(200).send(response);
  });

  bulkUpdateOrderlineStatus = asyncHandler(async (request: FastifyRequest<{ Body: { orderlineIds: string[]; status: string; additionalData?: Record<string, any> } }>, reply: FastifyReply) => {
    const { orderlineIds, status, additionalData } = request.body;
    
    if (!orderlineIds || !Array.isArray(orderlineIds) || orderlineIds.length === 0) {
      return reply.code(400).send({
        success: false,
        message: 'Orderline IDs are required',
        details: 'Please provide an array of orderline IDs',
        statusCode: 400
      });
    }
    
    if (!status) {
      return reply.code(400).send({
        success: false,
        message: 'Status is required',
        details: 'Please provide a valid status',
        statusCode: 400
      });
    }
    
    const results = await this.orderlineService.bulkUpdateStatus(orderlineIds, status, additionalData);
    
    const response = createSuccessResponse('Bulk orderline status update completed', results);
    return reply.code(200).send(response);
  });

  deleteOrderline = asyncHandler(async (request: FastifyRequest<{ Params: OrderlineParams }>, reply: FastifyReply) => {
    const { id } = orderlineParamsSchema.parse(request.params);
    
    await this.orderlineService.delete(id);
    
    const response = createSuccessResponse('Orderline deleted successfully', null);
    return reply.code(200).send(response);
  });

  upsertOrderline = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = upsertOrderlineSchema.parse(request.body);
    
    const orderline = await this.orderlineService.upsert(data);
    
    const message = data.id ? 'Orderline updated successfully' : 'Orderline created successfully';
    const response = createSuccessResponse(message, formatEntitiesForAPI([orderline], 'orderline')[0]);
    return reply.code(200).send(response);
  });

  cancelOrderline = asyncHandler(async (request: FastifyRequest<{ Params: OrderlineParams; Body: { reason?: string; additionalData?: Record<string, any> } }>, reply: FastifyReply) => {
    const { id } = orderlineParamsSchema.parse(request.params);
    const { reason, additionalData } = request.body || {};
    
    // Prepare additional data including the cancellation reason
    const cancelData = {
      ...additionalData,
      ...(reason && { cancellation_reason: reason })
    };
    
    const orderline = await this.orderlineService.updateOrderlineStatus(id, 'cancelled', cancelData);
    
    const response = createSuccessResponse('Orderline cancelled successfully', formatEntitiesForAPI([orderline], 'orderline')[0]);
    return reply.code(200).send(response);
  });
} 