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
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';

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
    console.log(page,limit,"getpromotions page and limit")
    console.log(request.query,"ALLFILTERS")
    // Check for admin mode flag
    const { admin_mode, ...filtersWithoutAdmin } = allFilters;
    const adminModeRequested = admin_mode === 'true' || admin_mode === true;
    const authenticatedRequest = request as AuthenticatedRequest;
    if (
      adminModeRequested &&
      authenticatedRequest.user?.userType !== 'inventory'
    ) {
      return reply.code(403).send({
        success: false,
        message: 'Inventory user authentication is required for admin promotion access'
      });
    }
    const adminMode = adminModeRequested;
    
    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = filtersWithoutAdmin;
    if (
      !adminMode &&
      authenticatedRequest.user?.userType === 'ecommerce'
    ) {
      // Never trust a caller-provided userid for customer promotion visibility.
      filters.userid = String(authenticatedRequest.user.id);
    }
    
    const result = await this.promotionsService.findMany(filters, page, limit, adminMode);
    
    const response = createSuccessResponse('Promotions retrieved successfully', result.data);
    return reply.code(200).send({
      ...response,
      pagination: result.pagination,
      meta: {
        filters: Object.keys(filters),
        total: result.pagination.total,
        filtered: Object.keys(filters).length > 0,
        adminMode: adminMode
      }
    });
  });

  getPromotion = asyncHandler(async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    
    const promotion = await this.promotionsService.findById(id);
    
    const response = createSuccessResponse('Promotion retrieved successfully', promotion);
    return reply.code(200).send(response);
  });

  getMyPromotions = asyncHandler(async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user || request.user.userType !== 'ecommerce') {
      return reply.code(403).send({
        success: false,
        message: 'Customer authentication is required'
      });
    }

    const { channel = 'web' } = request.query as { channel?: string };
    const promotions = await this.promotionsService.getMyPromotions({
      userId: String(request.user.id),
      channel
    });
    return reply.code(200).send(createSuccessResponse('Customer promotions retrieved', promotions));
  });

  getPublicPromotions = asyncHandler(async (request: FastifyRequest<{
    Querystring: {
      channel?: string;
      geo?: string;
      limit?: string;
    };
  }>, reply: FastifyReply) => {
    const {
      channel = 'web',
      geo = 'IN',
      limit = '10'
    } = request.query || {};
    const parsedLimit = Math.min(Math.max(Number(limit) || 10, 1), 100);
    const promotions = await this.promotionsService.getPublicPromotions({
      channel,
      geo,
      limit: parsedLimit
    });

    return reply
      .code(200)
      .send(createSuccessResponse('Public promotions retrieved', promotions));
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
      channel?: 'web' | 'mobile' | 'mobile_app';
      context?: {
        channel?: 'web' | 'mobile' | 'mobile_app';
      };
    } 
  }>, reply: FastifyReply) => {
    const { userId, cartItems, mode, channel, context } = request.body;
    
    logger.info({ userId, cartItemsCount: cartItems.length, mode }, 'Getting unified promotion offers');
    
    const offers = await this.promotionsService.getUnifiedPromotionOffers({
      userId,
      cartItems,
      mode,
      channel: channel || context?.channel || 'web'
    });
    
    const response = createSuccessResponse('Unified promotion offers retrieved', offers);
    return reply.code(200).send(response);
  });

}
