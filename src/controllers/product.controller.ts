import { FastifyRequest, FastifyReply } from 'fastify';
import { ProductService } from '../services/product.service.js';
import { 
  createProductSchema, 
  updateProductSchema, 
  upsertProductSchema,
  productParamsSchema,
  productQuerySchema,
  ProductParams,
  ProductQuery
} from '../schemas/product.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, createErrorResponse } from '../utils/errorHandler.js';

export class ProductController {
  private productService = new ProductService();

  async getProducts(request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) {
    try {
      // Get all query parameters as filters (not just schema-validated ones)
      const allFilters: Record<string, any> = request.query || {};
      const { page, limit } = getPaginationParams(allFilters);
      
      // Remove pagination params from filters
      const { page: _, limit: __, ...filters } = allFilters;
      
      const result = await this.productService.findMany(filters, page, limit);
      
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
        error: error instanceof Error ? error.message : 'Failed to fetch products',
      });
    }
  }

  async getProduct(request: FastifyRequest<{ Params: ProductParams }>, reply: FastifyReply) {
    try {
      const { id } = productParamsSchema.parse(request.params);
      
      const product = await this.productService.findById(id);
      
      const response = createSuccessResponse('Product retrieved successfully', product);
      return reply.code(200).send(response);
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Product not found' ? 404 : 400;
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to fetch product',
        statusCode === 404 ? 'NOT_FOUND' : 'FETCH_ERROR'
      );
      return reply.code(statusCode).send(errorResponse);
    }
  }

  async createProduct(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = createProductSchema.parse(request.body);
      
      const product = await this.productService.create(data);
      
      const response = createSuccessResponse('Product created successfully', product);
      return reply.code(201).send(response);
    } catch (error) {
      const errorResponse = createErrorResponse(
        'Failed to create product',
        'CREATE_ERROR'
      );
      return reply.code(400).send(errorResponse);
    }
  }

  async updateProduct(request: FastifyRequest<{ Params: ProductParams }>, reply: FastifyReply) {
    try {
      const { id } = productParamsSchema.parse(request.params);
      const data = updateProductSchema.parse(request.body);
      
      const product = await this.productService.update(id, data);
      
      const response = createSuccessResponse('Product updated successfully', product);
      return reply.code(200).send(response);
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Product not found' ? 404 : 400;
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to update product',
        statusCode === 404 ? 'NOT_FOUND' : 'UPDATE_ERROR'
      );
      return reply.code(statusCode).send(errorResponse);
    }
  }

  async deleteProduct(request: FastifyRequest<{ Params: ProductParams }>, reply: FastifyReply) {
    try {
      const { id } = productParamsSchema.parse(request.params);
      
      await this.productService.delete(id);
      
      const response = createSuccessResponse('Product deleted successfully', null);
      return reply.code(200).send(response);
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Product not found' ? 404 : 400;
      const errorResponse = createErrorResponse(
        error instanceof Error ? error.message : 'Failed to delete product',
        statusCode === 404 ? 'NOT_FOUND' : 'DELETE_ERROR'
      );
      return reply.code(statusCode).send(errorResponse);
    }
  }

  async upsertProduct(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = upsertProductSchema.parse(request.body);
      
      const product = await this.productService.upsert(data);
      
      const message = data.id ? 'Product updated successfully' : 'Product created successfully';
      const response = createSuccessResponse(message, product);
      return reply.code(200).send(response);
    } catch (error) {
      const errorResponse = createErrorResponse(
        'Failed to upsert product',
        'UPSERT_ERROR'
      );
      return reply.code(400).send(errorResponse);
    }
  }
} 