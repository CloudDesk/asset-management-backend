import { FastifyRequest, FastifyReply } from 'fastify';
import { PromotionsService } from '../services/promotions.service.js';
import { 
  createPromotionsSchema, 
  updatePromotionsSchema,
  CreatePromotionsInput,
  UpdatePromotionsInput
} from '../schemas/promotions.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';

export class PromotionsController {
  public promotionsService = new PromotionsService();

  // Get user segments for debugging
  getUserSegments = asyncHandler(async (request: FastifyRequest<{ 
    Params: { userId: string } 
  }>, reply: FastifyReply) => {
    const { userId } = request.params;
    
    const segments = await this.promotionsService.getUserSegments(userId);
    
    const response = createSuccessResponse('User segments retrieved', segments);
    return reply.code(200).send(response);
  });

  getPromotions = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;
    
    const result = await this.promotionsService.findMany(filters, page, limit);
    
    const response = createSuccessResponse('Promotions retrieved successfully', result.data);
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

  getPromotion = asyncHandler(async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    
    const promotion = await this.promotionsService.findById(id);
    
    const response = createSuccessResponse('Promotion retrieved successfully', promotion);
    return reply.code(200).send(response);
  });

  createPromotion = asyncHandler(async (request: FastifyRequest<{ Body: CreatePromotionsInput }>, reply: FastifyReply) => {
    const data = createPromotionsSchema.parse(request.body);
    
    const promotion = await this.promotionsService.create(data);
    
    const response = createSuccessResponse('Promotion created successfully', promotion);
    return reply.code(201).send(response);
  });

  updatePromotion = asyncHandler(async (request: FastifyRequest<{ Params: { id: string }; Body: UpdatePromotionsInput }>, reply: FastifyReply) => {
    const { id } = request.params;
    const data = updatePromotionsSchema.parse(request.body);
    
    const promotion = await this.promotionsService.update(id, data);
    
    const response = createSuccessResponse('Promotion updated successfully', promotion);
    return reply.code(200).send(response);
  });

  deletePromotion = asyncHandler(async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    
    await this.promotionsService.delete(id);
    
    const response = createSuccessResponse('Promotion deleted successfully', null);
    return reply.code(200).send(response);
  });


} 