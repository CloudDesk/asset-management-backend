import { FastifyRequest, FastifyReply } from 'fastify';
import { StockService } from '../services/stock.service.js';
import { 
  createStockSchema, 
  updateStockSchema, 
  upsertStockSchema,
  stockParamsSchema,
  stockQuerySchema,
  StockParams,
  StockQuery
} from '../schemas/stock.schema.js';
import { getPaginationParams } from '../utils/pagination.js';

export class StockController {
  private stockService = new StockService();

  async getStocks(request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) {
    try {
      // Get all query parameters as filters (not just schema-validated ones)
      const allFilters: Record<string, any> = request.query || {};
      const { page, limit } = getPaginationParams(allFilters);
      
      // Remove pagination params from filters
      const { page: _, limit: __, ...filters } = allFilters;
      
      const result = await this.stockService.findMany(filters, page, limit);
      
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
        error: error instanceof Error ? error.message : 'Failed to fetch stocks',
      });
    }
  }

  async getStock(request: FastifyRequest<{ Params: StockParams }>, reply: FastifyReply) {
    try {
      const { id } = stockParamsSchema.parse(request.params);
      
      const stock = await this.stockService.findById(id);
      
      return reply.code(200).send({
        success: true,
        data: stock,
      });
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Stock not found' ? 404 : 400;
      return reply.code(statusCode).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch stock',
      });
    }
  }

  async createStock(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = createStockSchema.parse(request.body);
      
      const stock = await this.stockService.create(data);
      
      return reply.code(201).send({
        success: true,
        data: stock,
        message: 'Stock created successfully',
      });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create stock',
      });
    }
  }

  async updateStock(request: FastifyRequest<{ Params: StockParams }>, reply: FastifyReply) {
    try {
      const { id } = stockParamsSchema.parse(request.params);
      const data = updateStockSchema.parse(request.body);
      
      const stock = await this.stockService.update(id, data);
      
      return reply.code(200).send({
        success: true,
        data: stock,
        message: 'Stock updated successfully',
      });
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Stock not found' ? 404 : 400;
      return reply.code(statusCode).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update stock',
      });
    }
  }

  async deleteStock(request: FastifyRequest<{ Params: StockParams }>, reply: FastifyReply) {
    try {
      const { id } = stockParamsSchema.parse(request.params);
      
      await this.stockService.delete(id);
      
      return reply.code(200).send({
        success: true,
        message: 'Stock deleted successfully',
      });
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Stock not found' ? 404 : 400;
      return reply.code(statusCode).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete stock',
      });
    }
  }

  async upsertStock(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = upsertStockSchema.parse(request.body);
      
      const stock = await this.stockService.upsert(data);
      
      return reply.code(200).send({
        success: true,
        data: stock,
        message: data.id ? 'Stock updated successfully' : 'Stock created successfully',
      });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to upsert stock',
      });
    }
  }

  async updateQuantities(request: FastifyRequest<{ Params: StockParams }>, reply: FastifyReply) {
    try {
      const { id } = stockParamsSchema.parse(request.params);
      const quantities = request.body as {
        quantity?: number;
        availableQuantity?: number;
        soldQuantity?: number;
      };
      
      const stock = await this.stockService.updateQuantities(id, quantities);
      
      return reply.code(200).send({
        success: true,
        data: stock,
        message: 'Stock quantities updated successfully',
      });
    } catch (error) {
      const statusCode = error instanceof Error && error.message === 'Stock not found' ? 404 : 400;
      return reply.code(statusCode).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update stock quantities',
      });
    }
  }
} 