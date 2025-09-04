import { FastifyRequest, FastifyReply } from 'fastify';
import { PromotionEvaluationService } from '../services/promotion-evaluation.service.js';
import { evaluationRequestSchema, EvaluationRequest } from '../schemas/evaluation.schema.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';

export class PromotionEvaluationController {
  private evaluationService = new PromotionEvaluationService();

  // Evaluate promotion against cart
  evaluatePromotion = asyncHandler(async (request: FastifyRequest<{ Body: EvaluationRequest }>, reply: FastifyReply) => {
    const data = evaluationRequestSchema.parse(request.body);

    logger.info({ 
      promotionId: data.promotion_id, 
      userId: data.user_id,
      cartItems: data.cart_data.items.length 
    }, 'Evaluating promotion');

    const result = await this.evaluationService.evaluatePromotion(data);

    const response = createSuccessResponse('Promotion evaluated successfully', result);
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

  // Get evaluation by ID (helper method)
  private async getEvaluation(evaluationId: string) {
    // This would be implemented in the service
    // For now, return a placeholder
    return null;
  }
}
