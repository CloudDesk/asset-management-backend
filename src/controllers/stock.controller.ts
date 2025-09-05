import { FastifyRequest, FastifyReply } from 'fastify';
import { StockService } from '../services/stock.service.js';
import { 
  createStockSchema, 
  updateStockSchema, 
  upsertStockSchema,
  stockParamsSchema,
  rfidUpdateStockSchema,
  bulkRfidUpdateStockSchema,
  StockParams,
  RfidUpdateStockInput,
  BulkRfidUpdateStockInput
} from '../schemas/stock.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler,
  ValidationError
} from '../utils/errorHandler.js';
import { formatStockForAPI, formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';

export class StockController {
  public stockService = new StockService();

  getStocks = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters (not just schema-validated ones)
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.stockService.findMany(filters, page, limit);
    
    // Format all stocks in the result
    const formattedData = formatEntitiesForAPI(result.data, 'stock');
    
    const response = createSuccessResponse('Stocks retrieved successfully', formattedData);
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
    
    const response = createSuccessResponse('Stock retrieved successfully', formatStockForAPI(stock));
    return reply.code(200).send(response);
  });

  createStock = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createStockSchema.parse(request.body);
    
    const stock = await this.stockService.create(data);
    
    const response = createSuccessResponse('Stock created successfully', formatStockForAPI(stock));
    return reply.code(201).send(response);
  });

  updateStock = asyncHandler(async (request: FastifyRequest<{ Params: StockParams }>, reply: FastifyReply) => {
    const { id } = stockParamsSchema.parse(request.params);
    const data = updateStockSchema.parse(request.body);
    
    const stock = await this.stockService.update(id, data);
    
    const response = createSuccessResponse('Stock updated successfully', formatStockForAPI(stock));
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
    const response = createSuccessResponse(message, formatStockForAPI(stock));
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
    
    const response = createSuccessResponse('Stock quantities updated successfully', formatStockForAPI(stock));
    return reply.code(200).send(response);
  });

  updateStockByRfid = asyncHandler(async (request: FastifyRequest<{
    Body: RfidUpdateStockInput
  }>, reply: FastifyReply) => {
    const { rfid, orderlineid } = rfidUpdateStockSchema.parse(request.body);
    
    const stock = await this.stockService.updateByRfid(rfid, orderlineid);
    
    const response = createSuccessResponse(
      'Stock updated successfully via RFID scan', 
      formatStockForAPI(stock)
    );
    return reply.code(200).send(response);
  });

  bulkUpdateStockByRfid = asyncHandler(async (request: FastifyRequest<{
    Body: BulkRfidUpdateStockInput
  }>, reply: FastifyReply) => {
    const updates = bulkRfidUpdateStockSchema.parse(request.body);
    
    const result = await this.stockService.bulkUpdateByRfid(updates);
    
    // Format the successful stock results
    const formattedResults = result.results.map(item => {
      if (item.success && 'data' in item) {
        return {
          ...item,
          data: formatStockForAPI(item.data)
        };
      }
      return item;
    });
    
    const responseData = {
      ...result,
      results: formattedResults
    };
    
    // Determine response code based on results
    const responseCode = result.summary.failed === 0 ? 200 : 207; // 207 = Multi-Status
    
    const message = result.summary.failed === 0 
      ? `All ${result.summary.successful} stocks updated successfully via RFID scan`
      : `Bulk RFID update completed: ${result.summary.successful} successful, ${result.summary.failed} failed`;
    
    const response = createSuccessResponse(message, responseData);
    return reply.code(responseCode).send(response);
  });
} 
