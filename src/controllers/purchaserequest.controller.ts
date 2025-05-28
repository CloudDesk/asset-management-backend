import { FastifyRequest, FastifyReply } from 'fastify';
import { PurchaseRequestService } from '../services/purchaserequest.service.js';
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
import { createSuccessResponse, createErrorResponse } from '../utils/errorHandler.js';

export class PurchaseRequestController {
  private purchaseRequestService = new PurchaseRequestService();

  /**
   * Get purchase requests with dynamic filtering and pagination
   * Supports any field that exists in the database
   */
  async getPurchaseRequests(request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) {
    try {
      // Get all query parameters as filters (not just schema-validated ones)
      const allFilters: Record<string, any> = request.query || {};
      const { page, limit } = getPaginationParams(allFilters);
      
      // Remove pagination params from filters
      const { page: _, limit: __, ...filters } = allFilters;
      
      const result = await this.purchaseRequestService.findMany(filters, page, limit);
      
      return reply.code(200).send({
        success: true,
        data: result.data,
        pagination: result.pagination,
        meta: {
          filters: Object.keys(filters),
          total: result.pagination.total,
          filtered: Object.keys(filters).length > 0
        }
      });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch purchase requests',
      });
    }
  }

  /**
   * Get single purchase request by ID
   */
  async getPurchaseRequest(request: FastifyRequest<{ Params: PurchaseRequestParams }>, reply: FastifyReply) {
    try {
      const { id } = purchaseRequestParamsSchema.parse(request.params);
      
      const purchaseRequest = await this.purchaseRequestService.findById(id);
      
      const response = createSuccessResponse('Purchase request retrieved successfully', purchaseRequest);
      return reply.code(200).send(response);
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Purchase request not found' ? 404 : 400;
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to fetch purchase request',
        statusCode === 404 ? 'NOT_FOUND' : 'FETCH_ERROR'
      );
      return reply.code(statusCode).send(errorResponse);
    }
  }

  /**
   * Create new purchase request with dynamic field support
   */
  async createPurchaseRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = createPurchaseRequestSchema.parse(request.body);
      
      const purchaseRequest = await this.purchaseRequestService.create(data);
      
      const response = createSuccessResponse('Purchase request created successfully', purchaseRequest);
      return reply.code(201).send(response);
    } catch (error) {
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to create purchase request',
        'CREATE_ERROR'
      );
      return reply.code(400).send(errorResponse);
    }
  }

  /**
   * Update purchase request with dynamic field support
   */
  async updatePurchaseRequest(request: FastifyRequest<{ Params: PurchaseRequestParams }>, reply: FastifyReply) {
    try {
      const { id } = purchaseRequestParamsSchema.parse(request.params);
      const data = updatePurchaseRequestSchema.parse(request.body);
      
      const purchaseRequest = await this.purchaseRequestService.update(id, data);
      
      const response = createSuccessResponse('Purchase request updated successfully', purchaseRequest);
      return reply.code(200).send(response);
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Purchase request not found' ? 404 : 400;
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to update purchase request',
        statusCode === 404 ? 'NOT_FOUND' : 'UPDATE_ERROR'
      );
      return reply.code(statusCode).send(errorResponse);
    }
  }

  /**
   * Delete purchase request by ID
   */
  async deletePurchaseRequest(request: FastifyRequest<{ Params: PurchaseRequestParams }>, reply: FastifyReply) {
    try {
      const { id } = purchaseRequestParamsSchema.parse(request.params);
      
      await this.purchaseRequestService.delete(id);
      
      const response = createSuccessResponse('Purchase request deleted successfully', null);
      return reply.code(200).send(response);
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Purchase request not found' ? 404 : 400;
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to delete purchase request',
        statusCode === 404 ? 'NOT_FOUND' : 'DELETE_ERROR'
      );
      return reply.code(statusCode).send(errorResponse);
    }
  }

  /**
   * Upsert purchase request - create or update based on ID presence
   */
  async upsertPurchaseRequest(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = upsertPurchaseRequestSchema.parse(request.body);
      
      const purchaseRequest = await this.purchaseRequestService.upsert(data);
      
      const message = data.id ? 'Purchase request updated successfully' : 'Purchase request created successfully';
      const response = createSuccessResponse(message, purchaseRequest);
      return reply.code(200).send(response);
    } catch (error) {
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to upsert purchase request',
        'UPSERT_ERROR'
      );
      return reply.code(400).send(errorResponse);
    }
  }

  /**
   * Get purchase requests by supplier ID
   */
  async getPurchaseRequestsBySupplier(request: FastifyRequest<{ 
    Params: { supplierId: string };
    Querystring: Record<string, any>
  }>, reply: FastifyReply) {
    try {
      const { supplierId } = request.params;
      const allFilters: Record<string, any> = request.query || {};
      const { page, limit } = getPaginationParams(allFilters);
      
      const result = await this.purchaseRequestService.findBySupplier(supplierId, page, limit);
      
      const response = createSuccessResponse('Purchase requests by supplier retrieved successfully', {
        supplierId,
        ...result
      });
      return reply.code(200).send(response);
    } catch (error) {
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to fetch purchase requests by supplier',
        'FETCH_ERROR'
      );
      return reply.code(400).send(errorResponse);
    }
  }

  /**
   * Get purchase requests by requester
   */
  async getPurchaseRequestsByRequester(request: FastifyRequest<{ 
    Params: { requestedBy: string };
    Querystring: Record<string, any>
  }>, reply: FastifyReply) {
    try {
      const { requestedBy } = request.params;
      const allFilters: Record<string, any> = request.query || {};
      const { page, limit } = getPaginationParams(allFilters);
      
      const result = await this.purchaseRequestService.findByRequester(requestedBy, page, limit);
      
      const response = createSuccessResponse('Purchase requests by requester retrieved successfully', {
        requestedBy,
        ...result
      });
      return reply.code(200).send(response);
    } catch (error) {
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to fetch purchase requests by requester',
        'FETCH_ERROR'
      );
      return reply.code(400).send(errorResponse);
    }
  }

  /**
   * Approve purchase request
   */
  async approvePurchaseRequest(request: FastifyRequest<{ 
    Params: PurchaseRequestParams;
    Body: { approvedBy: string; notes?: string }
  }>, reply: FastifyReply) {
    try {
      const { id } = purchaseRequestParamsSchema.parse(request.params);
      const { approvedBy, notes } = request.body;
      
      if (!approvedBy) {
        const errorResponse = createErrorResponse(
          'Approved by is required',
          'VALIDATION_ERROR'
        );
        return reply.code(400).send(errorResponse);
      }
      
      const purchaseRequest = await this.purchaseRequestService.approve(id, approvedBy, notes);
      
      const response = createSuccessResponse('Purchase request approved successfully', purchaseRequest);
      return reply.code(200).send(response);
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Purchase request not found' ? 404 : 400;
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to approve purchase request',
        statusCode === 404 ? 'NOT_FOUND' : 'APPROVAL_ERROR'
      );
      return reply.code(statusCode).send(errorResponse);
    }
  }

  /**
   * Reject purchase request
   */
  async rejectPurchaseRequest(request: FastifyRequest<{ 
    Params: PurchaseRequestParams;
    Body: { rejectedBy: string; notes?: string }
  }>, reply: FastifyReply) {
    try {
      const { id } = purchaseRequestParamsSchema.parse(request.params);
      const { rejectedBy, notes } = request.body;
      
      if (!rejectedBy) {
        const errorResponse = createErrorResponse(
          'Rejected by is required',
          'VALIDATION_ERROR'
        );
        return reply.code(400).send(errorResponse);
      }
      
      const purchaseRequest = await this.purchaseRequestService.reject(id, rejectedBy, notes);
      
      const response = createSuccessResponse('Purchase request rejected successfully', purchaseRequest);
      return reply.code(200).send(response);
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Purchase request not found' ? 404 : 400;
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to reject purchase request',
        statusCode === 404 ? 'NOT_FOUND' : 'REJECTION_ERROR'
      );
      return reply.code(statusCode).send(errorResponse);
    }
  }
} 