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
import { createSuccessResponse, createErrorResponse } from '../utils/errorHandler.js';

export class PurchaseOrderController {
  private purchaseOrderService = new PurchaseOrderService();

  /**
   * Get purchase orders with dynamic filtering and pagination
   * Supports any field that exists in the database
   */
  async getPurchaseOrders(request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) {
    try {
      // Get all query parameters as filters (not just schema-validated ones)
      const allFilters: Record<string, any> = request.query || {};
      const { page, limit } = getPaginationParams(allFilters);
      
      // Remove pagination params from filters
      const { page: _, limit: __, ...filters } = allFilters;
      
      const result = await this.purchaseOrderService.findMany(filters, page, limit);
      
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
        error: error instanceof Error ? error.message : 'Failed to fetch purchase orders',
      });
    }
  }

  /**
   * Get single purchase order by ID
   */
  async getPurchaseOrder(request: FastifyRequest<{ Params: PurchaseOrderParams }>, reply: FastifyReply) {
    try {
      const { id } = purchaseOrderParamsSchema.parse(request.params);
      
      const purchaseOrder = await this.purchaseOrderService.findById(id);
      
      const response = createSuccessResponse('Purchase order retrieved successfully', purchaseOrder);
      return reply.code(200).send(response);
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Purchase order not found' ? 404 : 400;
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to fetch purchase order',
        statusCode === 404 ? 'NOT_FOUND' : 'FETCH_ERROR'
      );
      return reply.code(statusCode).send(errorResponse);
    }
  }

  /**
   * Create new purchase order with dynamic field support
   */
  async createPurchaseOrder(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = createPurchaseOrderSchema.parse(request.body);
      
      const purchaseOrder = await this.purchaseOrderService.create(data);
      
      const response = createSuccessResponse('Purchase order created successfully', purchaseOrder);
      return reply.code(201).send(response);
    } catch (error) {
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to create purchase order',
        'CREATE_ERROR'
      );
      return reply.code(400).send(errorResponse);
    }
  }

  /**
   * Update purchase order with dynamic field support
   */
  async updatePurchaseOrder(request: FastifyRequest<{ Params: PurchaseOrderParams }>, reply: FastifyReply) {
    try {
      const { id } = purchaseOrderParamsSchema.parse(request.params);
      const data = updatePurchaseOrderSchema.parse(request.body);
      
      const purchaseOrder = await this.purchaseOrderService.update(id, data);
      
      const response = createSuccessResponse('Purchase order updated successfully', purchaseOrder);
      return reply.code(200).send(response);
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Purchase order not found' ? 404 : 400;
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to update purchase order',
        statusCode === 404 ? 'NOT_FOUND' : 'UPDATE_ERROR'
      );
      return reply.code(statusCode).send(errorResponse);
    }
  }

  /**
   * Delete purchase order by ID
   */
  async deletePurchaseOrder(request: FastifyRequest<{ Params: PurchaseOrderParams }>, reply: FastifyReply) {
    try {
      const { id } = purchaseOrderParamsSchema.parse(request.params);
      
      await this.purchaseOrderService.delete(id);
      
      const response = createSuccessResponse('Purchase order deleted successfully', null);
      return reply.code(200).send(response);
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Purchase order not found' ? 404 : 400;
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to delete purchase order',
        statusCode === 404 ? 'NOT_FOUND' : 'DELETE_ERROR'
      );
      return reply.code(statusCode).send(errorResponse);
    }
  }

  /**
   * Upsert purchase order - create or update based on ID presence
   */
  async upsertPurchaseOrder(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = upsertPurchaseOrderSchema.parse(request.body);
      
      const purchaseOrder = await this.purchaseOrderService.upsert(data);
      
      const message = data.id ? 'Purchase order updated successfully' : 'Purchase order created successfully';
      const response = createSuccessResponse(message, purchaseOrder);
      return reply.code(200).send(response);
    } catch (error) {
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to upsert purchase order',
        'UPSERT_ERROR'
      );
      return reply.code(400).send(errorResponse);
    }
  }

  /**
   * Get purchase orders by supplier ID
   */
  async getPurchaseOrdersBySupplier(request: FastifyRequest<{ 
    Params: { supplierId: string };
    Querystring: Record<string, any>
  }>, reply: FastifyReply) {
    try {
      const { supplierId } = request.params;
      const allFilters: Record<string, any> = request.query || {};
      const { page, limit } = getPaginationParams(allFilters);
      
      const result = await this.purchaseOrderService.findBySupplier(supplierId, page, limit);
      
      const response = createSuccessResponse('Purchase orders by supplier retrieved successfully', {
        supplierId,
        ...result
      });
      return reply.code(200).send(response);
    } catch (error) {
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to fetch purchase orders by supplier',
        'FETCH_ERROR'
      );
      return reply.code(400).send(errorResponse);
    }
  }

  /**
   * Update purchase order status
   */
  async updatePurchaseOrderStatus(request: FastifyRequest<{ 
    Params: PurchaseOrderParams;
    Body: { status: string; notes?: string }
  }>, reply: FastifyReply) {
    try {
      const { id } = purchaseOrderParamsSchema.parse(request.params);
      const { status, notes } = request.body;
      
      if (!status) {
        const errorResponse = createErrorResponse(
          'Status is required',
          'VALIDATION_ERROR'
        );
        return reply.code(400).send(errorResponse);
      }
      
      const purchaseOrder = await this.purchaseOrderService.updateStatus(id, status, notes);
      
      const response = createSuccessResponse('Purchase order status updated successfully', purchaseOrder);
      return reply.code(200).send(response);
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Purchase order not found' ? 404 : 400;
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to update purchase order status',
        statusCode === 404 ? 'NOT_FOUND' : 'UPDATE_ERROR'
      );
      return reply.code(statusCode).send(errorResponse);
    }
  }
} 