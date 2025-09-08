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


  // Get unified promotion offers (best recommendation + all eligible/ineligible)
  getUnifiedPromotionOffers = asyncHandler(async (request: FastifyRequest<{ 
    Body: { 
      userId: string; 
      cartItems: Array<{ 
        productId: string; 
        qty: number; 
        category: string; 
        price: number; 
      }>; 
      mode: 'phonepe' | 'cod'; 
    } 
  }>, reply: FastifyReply) => {
    const { userId, cartItems, mode } = request.body;
    
    logger.info({ userId, cartItemsCount: cartItems.length, mode }, 'Getting unified promotion offers');
    
    const offers = await this.promotionsService.getUnifiedPromotionOffers({
      userId,
      cartItems,
      mode
    });
    
    const response = createSuccessResponse('Unified promotion offers retrieved', offers);
    return reply.code(200).send(response);
  });

<<<<<<< HEAD
  evaluateEligibility = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Log the incoming request
      logger.info({ 
        body: request.body,
        query: request.query,
        method: request.method,
        url: request.url
      }, 'Processing promotion eligibility request');

      let data: PromotionEligibilityInput;

      // Handle GET requests
      if (request.method === 'GET') {
        const queryParams = promotionEligibilityQuerySchema.parse(request.query);
        data = {
          user_id: queryParams.user_id,
          platform: queryParams.platform,
          code: queryParams.code
        };
      } 
      // Handle POST requests
      else {
        data = promotionEligibilitySchema.parse(request.body);
      }
      
      // Evaluate eligibility
      const result = await this.promotionEvaluationService.evaluateEligibility(data);
      
      // Log successful response
      logger.info({
        eligible_count: result.eligible_promotions?.length || 0,
        user_id: data.user_id,
        method: request.method
      }, 'Successfully evaluated promotion eligibility');
      
      const response = createSuccessResponse('Promotion eligibility evaluated successfully', result);
      return reply.code(200).send(response);
      
    } catch (error: any) {
      // Log the error with full context
      logger.error({
        error: {
          name: error.name,
          message: error.message,
          code: error.code,
          details: error.details
        },
        request: {
          body: request.body,
          query: request.query,
          method: request.method,
          url: request.url
        }
      }, 'Error evaluating promotion eligibility');

      // Handle specific error types
      if (error instanceof ZodError) {
        throw new ValidationError(
          'Invalid promotion eligibility request data',
          error.errors.map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ')
        );
      }
      
      if (error.code === 'P2025') {
        throw new DatabaseError(
          'Referenced promotion or rule not found',
          'One or more promotions or rules referenced in the request do not exist',
          404
        );
      }
      
      if (error.code === 'P2003') {
        throw new DatabaseError(
          'Invalid promotion reference',
          'One or more promotion references are invalid',
          400
        );
      }
      
      // Re-throw other errors to be handled by the global error handler
      throw error;
    }
  });
} 
=======
} 
>>>>>>> promotion-v3
