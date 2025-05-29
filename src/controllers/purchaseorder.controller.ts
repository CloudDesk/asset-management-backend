import { FastifyRequest, FastifyReply } from 'fastify';
import { PurchaseOrderService } from '../services/purchaseorder.service.js';
import { 
  createPurchaseOrderSchema, 
  updatePurchaseOrderSchema, 
  upsertPurchaseOrderSchema,
  purchaseOrderParamsSchema,
  purchaseOrderQuerySchema,
  PurchaseOrderParams,
  PurchaseOrderQuery
} from '../schemas/purchaseorder.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse, 
  createErrorResponse,
  asyncHandler,
  ValidationError,
  NotFoundError
} from '../utils/errorHandler.js';
import { formatPurchaseOrderForAPI, formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';

export class PurchaseOrderController {
  public purchaseOrderService = new PurchaseOrderService();

  /**
   * Get purchase orders with dynamic filtering and pagination
   * Supports any field that exists in the database
   */
  getPurchaseOrders = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters (not just schema-validated ones)
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.purchaseOrderService.findMany(filters, page, limit);
    
    // Format all purchase orders in the result
    const formattedData = formatEntitiesForAPI(result.data, 'purchaseorder');
    
    const response = createSuccessResponse('Purchase orders retrieved successfully', formattedData);
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

  /**
   * Get single purchase order by ID
   */
  getPurchaseOrder = asyncHandler(async (request: FastifyRequest<{ Params: PurchaseOrderParams }>, reply: FastifyReply) => {
    const { id } = purchaseOrderParamsSchema.parse(request.params);
    
    const purchaseOrder = await this.purchaseOrderService.findById(id);
    
    const response = createSuccessResponse('Purchase order retrieved successfully', formatPurchaseOrderForAPI(purchaseOrder));
    return reply.code(200).send(response);
  });

  /**
   * Create new purchase order with dynamic field support
   */
  createPurchaseOrder = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createPurchaseOrderSchema.parse(request.body);
    
    const purchaseOrder = await this.purchaseOrderService.create(data);
    
    const response = createSuccessResponse('Purchase order created successfully', formatPurchaseOrderForAPI(purchaseOrder));
    return reply.code(201).send(response);
  });

  /**
   * Update purchase order with dynamic field support
   */
  updatePurchaseOrder = asyncHandler(async (request: FastifyRequest<{ Params: PurchaseOrderParams }>, reply: FastifyReply) => {
    const { id } = purchaseOrderParamsSchema.parse(request.params);
    const data = updatePurchaseOrderSchema.parse(request.body);
    
    const purchaseOrder = await this.purchaseOrderService.update(id, data);
    
    const response = createSuccessResponse('Purchase order updated successfully', formatPurchaseOrderForAPI(purchaseOrder));
    return reply.code(200).send(response);
  });

  /**
   * Delete purchase order by ID
   */
  deletePurchaseOrder = asyncHandler(async (request: FastifyRequest<{ Params: PurchaseOrderParams }>, reply: FastifyReply) => {
    const { id } = purchaseOrderParamsSchema.parse(request.params);
    
    await this.purchaseOrderService.delete(id);
    
    const response = createSuccessResponse('Purchase order deleted successfully', null);
    return reply.code(200).send(response);
  });

  /**
   * Upsert purchase order - create or update based on ID presence
   */
  upsertPurchaseOrder = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = upsertPurchaseOrderSchema.parse(request.body);
    
    const purchaseOrder = await this.purchaseOrderService.upsert(data);
    
    const message = data.id ? 'Purchase order updated successfully' : 'Purchase order created successfully';
    const response = createSuccessResponse(message, formatPurchaseOrderForAPI(purchaseOrder));
    return reply.code(200).send(response);
  });

  /**
   * Get purchase orders by supplier ID
   */
  getPurchaseOrdersBySupplier = asyncHandler(async (request: FastifyRequest<{ 
    Params: { supplierId: string };
    Querystring: Record<string, any>
  }>, reply: FastifyReply) => {
    const { supplierId } = request.params;
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    const result = await this.purchaseOrderService.findBySupplier(supplierId, page, limit);
    
    // Format the purchase orders data
    const formattedResult = {
      ...result,
      data: formatEntitiesForAPI(result.data, 'purchaseorder')
    };
    
    const response = createSuccessResponse('Purchase orders by supplier retrieved successfully', {
      supplierId,
      ...formattedResult
    });
    return reply.code(200).send(response);
  });

  /**
   * Update purchase order status
   */
  updatePurchaseOrderStatus = asyncHandler(async (request: FastifyRequest<{ 
    Params: PurchaseOrderParams;
    Body: { status: string; notes?: string }
  }>, reply: FastifyReply) => {
    const { id } = purchaseOrderParamsSchema.parse(request.params);
    const { status, notes } = request.body;
    
    if (!status) {
      throw new ValidationError('Status is required');
    }
    
    const purchaseOrder = await this.purchaseOrderService.updateStatus(id, status, notes);
    
    const response = createSuccessResponse('Purchase order status updated successfully', formatPurchaseOrderForAPI(purchaseOrder));
    return reply.code(200).send(response);
  });
} 