import { FastifyRequest, FastifyReply } from 'fastify';
import { PromotionEvaluationService } from '../services/promotion-evaluation.service.js';
import { evaluationRequestSchema, EvaluationRequest } from '../schemas/evaluation.schema.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';

export class PromotionEvaluationController {
  private evaluationService = new PromotionEvaluationService();

  // Evaluate specific promotion against user's cart
  evaluatePromotion = asyncHandler(async (request: FastifyRequest<{
    Body: {
      user_id: string;
      promotion_id?: number;
      code?: string;
      cart_items: Array<{
        cart_record_id: string;
        product_id: string;
        quantity: number;
        price: number;
        category: string;
        subcategory?: string;
        name?: string;
      }>;
      context: {
        channel: 'web' | 'mobile' | 'mobile_app';
        geo: string;
        payment_method?: string;
        user_agent?: string;
        ip_address?: string;
      };
    }
  }>, reply: FastifyReply) => {
    const { user_id, promotion_id, code, cart_items, context } = request.body;
    
    // Validate that either promotion_id or code is provided
    if (!promotion_id && !code) {
      return reply.code(400).send({
        success: false,
        message: 'Either promotion_id or code must be provided',
        details: 'Please provide either a promotion ID or a promotion code to evaluate'
      });
    }

    if (promotion_id && code) {
      return reply.code(400).send({
        success: false,
        message: 'Cannot provide both promotion_id and code',
        details: 'Please provide either promotion_id or code, not both'
      });
    }
    
    logger.info({ 
      user_id, 
      promotion_id, 
      code,
      cartItemsCount: cart_items.length,
      channel: context.channel,
      geo: context.geo
    }, 'Evaluating specific promotion against user cart');

    const evaluation = await this.evaluationService.evaluateSpecificPromotion({
      user_id,
      ...(promotion_id && { promotion_id }),
      ...(code && { code }),
      cart_items,
      context
    });

    const response = createSuccessResponse('Promotion evaluation completed', evaluation);
    return reply.code(200).send(response);
  });

  // Remove/cancel evaluation
  removeEvaluation = asyncHandler(async (request: FastifyRequest<{
    Body: {
      evaluation_id: string;
      user_id: string;
    }
  }>, reply: FastifyReply) => {
    const { evaluation_id, user_id } = request.body;
    
    logger.info({ evaluation_id, user_id }, 'Removing evaluation');

    const result = await this.evaluationService.removeEvaluation(evaluation_id, user_id);

    const response = createSuccessResponse('Evaluation removed successfully', result);
    return reply.code(200).send(response);
  });

  // Get evaluation details
  getEvaluation = asyncHandler(async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid evaluation ID format',
        details: 'Evaluation ID must be a valid UUID'
      });
    }

    const evaluation = await this.evaluationService.getEvaluation(id);

    if (!evaluation) {
      return reply.code(404).send({
        success: false,
        message: 'Evaluation not found',
        details: 'The requested evaluation could not be found'
      });
    }

    const response = createSuccessResponse('Evaluation retrieved successfully', evaluation);
    return reply.code(200).send(response);
  });

  // Evaluate automatic promotions
  evaluateAutomaticPromotions = asyncHandler(async (request: FastifyRequest<{
    Body: {
      user_id: string;
      cart_items: Array<{
        cart_record_id: string;
        product_id: string;
        quantity: number;
        price: number;
        category: string;
        subcategory?: string;
        name?: string;
      }>;
      context: {
        channel: 'web' | 'mobile' | 'mobile_app';
        geo: string;
        payment_method?: string;
        user_agent?: string;
        ip_address?: string;
      };
      current_total?: number;
    }
  }>, reply: FastifyReply) => {
    const { user_id, cart_items, context, current_total } = request.body;

    logger.info({
      user_id,
      cartItemsCount: cart_items.length,
      current_total,
      channel: context.channel,
      geo: context.geo
    }, 'Evaluating automatic promotions');

    const result = await this.evaluationService.evaluateAutomaticPromotions({
      user_id,
      cart_items,
      context,
      ...(current_total && { current_total })
    });

    const response = createSuccessResponse('Automatic promotions evaluated successfully', result);
    return reply.code(200).send(response);
  });

  // Get user's active evaluations
  getUserActiveEvaluations = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const { user_id } = request.query as { user_id: string };

    if (!user_id) {
      const errorResponse = createErrorResponse('User ID is required', 'USER_ID_REQUIRED');
      return reply.code(400).send(errorResponse);
    }

    const result = await this.evaluationService.getUserActiveEvaluations(user_id);

    const response = createSuccessResponse('User active evaluations retrieved successfully', result);
    return reply.code(200).send(response);
  });

}
