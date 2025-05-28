import { FastifyRequest, FastifyReply } from 'fastify';
import { StockService } from '../services/stock.service.js';
import { 
  createStockSchema, 
  updateStockSchema, 
  upsertStockSchema,
  stockParamsSchema,
  StockParams
} from '../schemas/stock.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';

export class StockController {
  public stockService = new StockService();

  getStocks = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters (not just schema-validated ones)
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.stockService.findMany(filters, page, limit);
    
    const response = createSuccessResponse('Stocks retrieved successfully', result.data);
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

  getStock = asyncHandler(async (request: FastifyRequest<{ Params: StockParams }>, reply: FastifyReply) => {
    const { id } = stockParamsSchema.parse(request.params);
    
    const stock = await this.stockService.findById(id);
    
    const response = createSuccessResponse('Stock retrieved successfully', stock);
    return reply.code(200).send(response);
  });

  createStock = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createStockSchema.parse(request.body);
    
    const stock = await this.stockService.create(data);
    
    const response = createSuccessResponse('Stock created successfully', stock);
    return reply.code(201).send(response);
  });

  updateStock = asyncHandler(async (request: FastifyRequest<{ Params: StockParams }>, reply: FastifyReply) => {
    const { id } = stockParamsSchema.parse(request.params);
    const data = updateStockSchema.parse(request.body);
    
    const stock = await this.stockService.update(id, data);
    
    const response = createSuccessResponse('Stock updated successfully', stock);
    return reply.code(200).send(response);
  });

  deleteStock = asyncHandler(async (request: FastifyRequest<{ Params: StockParams }>, reply: FastifyReply) => {
    const { id } = stockParamsSchema.parse(request.params);
    
    await this.stockService.delete(id);
    
    const response = createSuccessResponse('Stock deleted successfully', null);
    return reply.code(200).send(response);
  });

  upsertStock = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = upsertStockSchema.parse(request.body);
    
    const stock = await this.stockService.upsert(data);
    
    const message = data.id ? 'Stock updated successfully' : 'Stock created successfully';
    const response = createSuccessResponse(message, stock);
    return reply.code(200).send(response);
  });

  updateQuantities = asyncHandler(async (request: FastifyRequest<{ Params: StockParams }>, reply: FastifyReply) => {
    const { id } = stockParamsSchema.parse(request.params);
    const quantities = request.body as {
      quantity?: number;
      availableQuantity?: number;
      soldQuantity?: number;
    };
    
    const stock = await this.stockService.updateQuantities(id, quantities);
    
    const response = createSuccessResponse('Stock quantities updated successfully', stock);
    return reply.code(200).send(response);
  });
} 