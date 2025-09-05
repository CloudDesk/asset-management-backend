import { FastifyRequest, FastifyReply } from 'fastify';
import { PurchaseRequestService } from '../services/purchaseRequest.service.js';
import { 
  createPurchaseRequestSchema, 
  updatePurchaseRequestSchema, 
  upsertPurchaseRequestSchema,
  purchaseRequestParamsSchema,
  purchaseRequestQuerySchema,
  PurchaseRequestParams,
  PurchaseRequestQuery
} from '../schemas/purchaserequest.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse, 
  createErrorResponse,
  asyncHandler,
  ValidationError,
  NotFoundError
} from '../utils/errorHandler.js';
import { formatPurchaseRequestForAPI, formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';

export class PurchaseRequestController {
  public purchaseRequestService = new PurchaseRequestService();

  /**
   * Get purchase requests with dynamic filtering and pagination
   * Supports any field that exists in the database
   */
  getPurchaseRequests = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters (not just schema-validated ones)
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.purchaseRequestService.findMany(filters, page, limit);
    
    // Format all purchase requests in the result
    const formattedData = formatEntitiesForAPI(result.data, 'purchaserequest');
    
    const response = createSuccessResponse('Purchase requests retrieved successfully', formattedData);
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
   * Get single purchase request by ID
   */
  getPurchaseRequest = asyncHandler(async (request: FastifyRequest<{ Params: PurchaseRequestParams }>, reply: FastifyReply) => {
    const { id } = purchaseRequestParamsSchema.parse(request.params);
    
    const purchaseRequest = await this.purchaseRequestService.findById(id);
    
    const response = createSuccessResponse('Purchase request retrieved successfully', formatPurchaseRequestForAPI(purchaseRequest));
    return reply.code(200).send(response);
  });

  /**
   * Create new purchase request with dynamic field support
   */
  createPurchaseRequest = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createPurchaseRequestSchema.parse(request.body);
    
    const purchaseRequest = await this.purchaseRequestService.create(data);
    
    const response = createSuccessResponse('Purchase request created successfully', formatPurchaseRequestForAPI(purchaseRequest));
    return reply.code(201).send(response);
  });

  /**
   * Update purchase request with dynamic field support
   */
  updatePurchaseRequest = asyncHandler(async (request: FastifyRequest<{ Params: PurchaseRequestParams }>, reply: FastifyReply) => {
    const { id } = purchaseRequestParamsSchema.parse(request.params);
    const data = updatePurchaseRequestSchema.parse(request.body);
    
    const purchaseRequest = await this.purchaseRequestService.update(id, data);
    
    const response = createSuccessResponse('Purchase request updated successfully', formatPurchaseRequestForAPI(purchaseRequest));
    return reply.code(200).send(response);
  });

  /**
   * Delete purchase request by ID
   */
  deletePurchaseRequest = asyncHandler(async (request: FastifyRequest<{ Params: PurchaseRequestParams }>, reply: FastifyReply) => {
    const { id } = purchaseRequestParamsSchema.parse(request.params);
    
    await this.purchaseRequestService.delete(id);
    
    const response = createSuccessResponse('Purchase request deleted successfully', null);
    return reply.code(200).send(response);
  });

  /**
   * Upsert purchase request - create or update based on ID presence
   */
  upsertPurchaseRequest = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = upsertPurchaseRequestSchema.parse(request.body);
    
    const purchaseRequest = await this.purchaseRequestService.upsert(data);
    
    const message = data.id ? 'Purchase request updated successfully' : 'Purchase request created successfully';
    const response = createSuccessResponse(message, formatPurchaseRequestForAPI(purchaseRequest));
    return reply.code(200).send(response);
  });

  /**
   * Get purchase requests by supplier ID
   */
  getPurchaseRequestsBySupplier = asyncHandler(async (request: FastifyRequest<{ 
    Params: { supplierId: string };
    Querystring: Record<string, any>
  }>, reply: FastifyReply) => {
    const { supplierId } = request.params;
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    const result = await this.purchaseRequestService.findBySupplier(supplierId, page, limit);
    
    // Format the purchase requests data
    const formattedResult = {
      ...result,
      data: formatEntitiesForAPI(result.data, 'purchaserequest')
    };
    
    const response = createSuccessResponse('Purchase requests by supplier retrieved successfully', {
      supplierId,
      ...formattedResult
    });
    return reply.code(200).send(response);
  });

  /**
   * Get purchase requests by requester
   */
  getPurchaseRequestsByRequester = asyncHandler(async (request: FastifyRequest<{ 
    Params: { requestedBy: string };
    Querystring: Record<string, any>
  }>, reply: FastifyReply) => {
    const { requestedBy } = request.params;
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    const result = await this.purchaseRequestService.findByRequester(requestedBy, page, limit);
    
    // Format the purchase requests data
    const formattedResult = {
      ...result,
      data: formatEntitiesForAPI(result.data, 'purchaserequest')
    };
    
    const response = createSuccessResponse('Purchase requests by requester retrieved successfully', {
      requestedBy,
      ...formattedResult
    });
    return reply.code(200).send(response);
  });

  /**
   * Approve purchase request
   */
  approvePurchaseRequest = asyncHandler(async (request: FastifyRequest<{ 
    Params: PurchaseRequestParams;
    Body: { approvedBy: string; notes?: string }
  }>, reply: FastifyReply) => {
    const { id } = purchaseRequestParamsSchema.parse(request.params);
    const { approvedBy, notes } = request.body;
    
    if (!approvedBy) {
      throw new ValidationError('Approved by is required');
    }
    
    const purchaseRequest = await this.purchaseRequestService.approve(id, approvedBy, notes);
    
    const response = createSuccessResponse('Purchase request approved successfully', formatPurchaseRequestForAPI(purchaseRequest));
    return reply.code(200).send(response);
  });

  /**
   * Reject purchase request
   */
  rejectPurchaseRequest = asyncHandler(async (request: FastifyRequest<{ 
    Params: PurchaseRequestParams;
    Body: { rejectedBy: string; notes?: string }
  }>, reply: FastifyReply) => {
    const { id } = purchaseRequestParamsSchema.parse(request.params);
    const { rejectedBy, notes } = request.body;
    
    if (!rejectedBy) {
      throw new ValidationError('Rejected by is required');
    }
    
    const purchaseRequest = await this.purchaseRequestService.reject(id, rejectedBy, notes);
    
    const response = createSuccessResponse('Purchase request rejected successfully', formatPurchaseRequestForAPI(purchaseRequest));
    return reply.code(200).send(response);
  });
} 
