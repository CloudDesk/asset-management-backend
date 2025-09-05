import { FastifyRequest, FastifyReply } from 'fastify';
import { QuotesService } from '../services/quotes.service.js';
import { 
  createQuotesSchema, 
  updateQuotesSchema, 
  upsertQuotesSchema,
  quotesParamsSchema,
  QuotesParams
} from '../schemas/quotes.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';
import { formatEntityForAPI, formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';

export class QuotesController {
  public quotesService = new QuotesService();

  getQuotes = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters (not just schema-validated ones)
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.quotesService.findMany(filters, page, limit);
    
    // Format all quotes in the result
    const formattedData = formatEntitiesForAPI(result.data, 'quotes');
    
    const response = createSuccessResponse('Quotes retrieved successfully', formattedData);
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

  getQuote = asyncHandler(async (request: FastifyRequest<{ Params: QuotesParams }>, reply: FastifyReply) => {
    const { id } = quotesParamsSchema.parse(request.params);
    
    const quote = await this.quotesService.findById(id);
    
    const response = createSuccessResponse('Quote retrieved successfully', formatEntityForAPI(quote, 'quotes'));
    return reply.code(200).send(response);
  });

  createQuote = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createQuotesSchema.parse(request.body);
    
    const quote = await this.quotesService.create(data);
    
    const response = createSuccessResponse('Quote created successfully', formatEntityForAPI(quote, 'quotes'));
    return reply.code(201).send(response);
  });

  updateQuote = asyncHandler(async (request: FastifyRequest<{ Params: QuotesParams }>, reply: FastifyReply) => {
    const { id } = quotesParamsSchema.parse(request.params);
    const data = updateQuotesSchema.parse(request.body);
    
    const quote = await this.quotesService.update(id, data);
    
    const response = createSuccessResponse('Quote updated successfully', formatEntityForAPI(quote, 'quotes'));
    return reply.code(200).send(response);
  });

  deleteQuote = asyncHandler(async (request: FastifyRequest<{ Params: QuotesParams }>, reply: FastifyReply) => {
    const { id } = quotesParamsSchema.parse(request.params);
    
    await this.quotesService.delete(id);
    
    const response = createSuccessResponse('Quote deleted successfully', null);
    return reply.code(200).send(response);
  });

  upsertQuote = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = upsertQuotesSchema.parse(request.body);
    
    const quote = await this.quotesService.upsert(data);
    
    const message = data.id ? 'Quote updated successfully' : 'Quote created successfully';
    const response = createSuccessResponse(message, formatEntityForAPI(quote, 'quotes'));
    return reply.code(200).send(response);
  });

  getQuotesByPrNumber = asyncHandler(async (request: FastifyRequest<{ 
    Params: { prnumber: string };
    Querystring: Record<string, any>;
  }>, reply: FastifyReply) => {
    const { prnumber } = request.params;
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    const result = await this.quotesService.findByPrNumber(prnumber, page, limit);
    
    const formattedData = formatEntitiesForAPI(result.data, 'quotes');
    
    const response = createSuccessResponse('Quotes retrieved successfully', formattedData);
    return reply.code(200).send({
      ...response,
      pagination: result.pagination,
      meta: {
        prnumber,
        total: result.pagination.total,
        filtered: true
      }
    });
  });

  getQuotesByStatus = asyncHandler(async (request: FastifyRequest<{ 
    Params: { status: string };
    Querystring: Record<string, any>;
  }>, reply: FastifyReply) => {
    const { status } = request.params;
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    const result = await this.quotesService.findByStatus(status, page, limit);
    
    const formattedData = formatEntitiesForAPI(result.data, 'quotes');
    
    const response = createSuccessResponse('Quotes retrieved successfully', formattedData);
    return reply.code(200).send({
      ...response,
      pagination: result.pagination,
      meta: {
        status,
        total: result.pagination.total,
        filtered: true
      }
    });
  });

  getQuotesStats = asyncHandler(async (_request: FastifyRequest, reply: FastifyReply) => {
    const stats = await this.quotesService.getQuotesStats();
    
    const response = createSuccessResponse('Quotes statistics retrieved successfully', stats);
    return reply.code(200).send(response);
  });

  /**
   * Attach quote with automatic purchase request status update
   * Creates/updates quote and updates PR status to "Completed" if quote status is "closed_won"
   */
  attachQuoteWithPrStatusUpdate = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = upsertQuotesSchema.parse(request.body);
    
    const result = await this.quotesService.attachQuoteWithPrStatusUpdate(data);
    
    const response = createSuccessResponse('Quote attachment processed successfully', {
      quote: formatEntityForAPI(result.quote, 'quotes'),
      purchaseRequestUpdate: result.purchaseRequestUpdate,
      message: result.message
    });
    
    return reply.code(200).send(response);
  });
} 
