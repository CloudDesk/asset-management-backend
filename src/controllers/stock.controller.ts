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
    try {
      // Parse and validate the request body with detailed error handling
      const validationResult = createStockSchema.safeParse(request.body);
      
      if (!validationResult.success) {
        const requestBody = request.body as Record<string, any>;
        const errors = validationResult.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          received: err.path.length > 0 && requestBody && typeof requestBody === 'object' && err.path[0] !== undefined ? requestBody[err.path[0]] : 'invalid'
        }));
        
        const errorResponse = {
          success: false,
          message: 'Validation failed for stock creation',
          details: 'Please check the provided data and try again',
          statusCode: 400,
          errors: errors,
          validationFailed: true
        };
        
        return reply.code(400).send(errorResponse);
      }
      
      const data = validationResult.data;
      
      // Additional business logic validation
      if (data.soldQuantity && data.availableQuantity && data.soldQuantity > data.availableQuantity) {
        const errorResponse = {
          success: false,
          message: 'Invalid stock quantities',
          details: 'Sold quantity cannot be greater than available quantity',
          statusCode: 400,
          businessLogicError: true
        };
        return reply.code(400).send(errorResponse);
      }
      
      // Ensure total quantity consistency if both are provided
      if (data.quantity && data.availableQuantity && data.soldQuantity) {
        const expectedTotal = data.availableQuantity + data.soldQuantity;
        if (data.quantity !== expectedTotal) {
          const errorResponse = {
            success: false,
            message: 'Inconsistent quantity values',
            details: `Total quantity (${data.quantity}) should equal available quantity (${data.availableQuantity}) + sold quantity (${data.soldQuantity}) = ${expectedTotal}`,
            statusCode: 400,
            businessLogicError: true
          };
          return reply.code(400).send(errorResponse);
        }
      }
      
      // Create the stock
      const stock = await this.stockService.create(data);
      
      const response = createSuccessResponse('Stock created successfully', formatStockForAPI(stock));
      return reply.code(201).send(response);
      
    } catch (error: any) {
      // Handle Fastify validation errors
      if (error.validation) {
        const errors = error.validation.map((err: any) => ({
          field: err.instancePath.replace('/', '') || err.schemaPath.split('/').pop(),
          message: err.message,
          received: 'invalid'
        }));
        
        const errorResponse = {
          success: false,
          message: 'Validation failed for stock creation',
          details: 'Please check the provided data and try again',
          statusCode: 400,
          errors: errors,
          validationFailed: true
        };
        return reply.code(400).send(errorResponse);
      }
      
      // Handle different types of errors with specific messages
      if (error.message.includes('already exists')) {
        const errorResponse = {
          success: false,
          message: 'Stock with this information already exists',
          details: 'A stock entry with the same product ID and serial number combination already exists',
          statusCode: 409,
          duplicateError: true
        };
        return reply.code(409).send(errorResponse);
      }
      
      if (error.message.includes('Product') && error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: 'Referenced product not found',
          details: 'The specified product ID does not exist in the system',
          statusCode: 404,
          referenceError: true
        };
        return reply.code(404).send(errorResponse);
      }
      
      if (error.message.includes('Failed to create stock')) {
        const errorResponse = {
          success: false,
          message: 'Stock creation failed',
          details: 'Unable to create stock with the provided data. Please verify all required fields are present.',
          statusCode: 400,
          creationError: true
        };
        return reply.code(400).send(errorResponse);
      }
      
      // Database constraint errors
      if (error.code === 'P2002' && error.meta?.target) {
        const errorResponse = {
          success: false,
          message: 'Duplicate entry detected',
          details: `A stock entry with the same ${error.meta.target.join(', ')} already exists`,
          statusCode: 409,
          constraintError: true
        };
        return reply.code(409).send(errorResponse);
      }
      
      // Generic database errors
      if (error.code && error.code.startsWith('P')) {
        const errorResponse = {
          success: false,
          message: 'Database operation failed',
          details: `Database error: ${error.message}. Please check your data and try again.`,
          statusCode: 400,
          databaseError: true
        };
        return reply.code(400).send(errorResponse);
      }
      
      // Log the error for debugging
      console.error('Stock creation error:', {
        error: error.message,
        stack: error.stack,
        requestBody: request.body
      });
      
      // Default error response
      const errorResponse = {
        success: false,
        message: 'Internal server error',
        details: 'An unexpected error occurred while creating the stock entry',
        statusCode: 500,
        internalError: true
      };
      return reply.code(500).send(errorResponse);
    }
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
} 