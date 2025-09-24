import { PromotionEvaluationService } from '../services/promotion-evaluation.service.js';
import { createSuccessResponse, asyncHandler, createErrorResponse } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';
export class PromotionEvaluationController {
    evaluationService = new PromotionEvaluationService();
    // Evaluate specific promotion against user's cart
    evaluatePromotion = asyncHandler(async (request, reply) => {
        const { user_id, evaluation_id, promotion_id, code, application_type, cart_items, context } = request.body;
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
            evaluation_id,
            promotion_id,
            code,
            application_type,
            cartItemsCount: cart_items.length,
            channel: context?.channel,
            geo: context?.geo
        }, 'Evaluating promotion with application type');
        // Handle different application types
        let evaluation;
        switch (application_type) {
            case 'manual_coupon':
            case 'stackable_promotion':
                // Auto-detect evaluation_id if not provided
                let targetEvaluationId = evaluation_id;
                if (!targetEvaluationId) {
                    // Find user's active evaluation
                    const activeEvaluations = await this.evaluationService.getUserActiveEvaluations(user_id);
                    if (activeEvaluations?.evaluations?.length && activeEvaluations.evaluations.length > 0) {
                        targetEvaluationId = activeEvaluations.evaluations[0]?.evaluation_id;
                        logger.info({
                            userId: user_id,
                            autoDetectedEvaluationId: targetEvaluationId,
                            applicationType: application_type
                        }, 'Auto-detected evaluation ID for promotion application');
                    }
                    else {
                        return reply.code(400).send({
                            success: false,
                            message: 'No active evaluation found',
                            details: 'Please create an evaluation first by calling /evaluate/automatic or provide evaluation_id'
                        });
                    }
                }
                // Apply promotion to evaluation
                if (!promotion_id) {
                    return reply.code(400).send({
                        success: false,
                        message: 'promotion_id is required for manual_coupon or stackable_promotion',
                        details: 'Please provide a valid promotion_id'
                    });
                }
                if (!targetEvaluationId) {
                    return reply.code(400).send({
                        success: false,
                        message: 'evaluation_id is required for manual_coupon or stackable_promotion',
                        details: 'Could not determine evaluation_id for promotion application'
                    });
                }
                evaluation = await this.evaluationService.applyManualCoupon({
                    evaluation_id: typeof targetEvaluationId === 'string' ? targetEvaluationId : String(targetEvaluationId),
                    promotion_id: typeof promotion_id === 'string' ? Number(promotion_id) : promotion_id,
                    cart_items
                });
                break;
            case 'preview_only':
            default:
                // Preview promotion calculation (no database changes)
                if (!user_id || !context) {
                    return reply.code(400).send({
                        success: false,
                        message: 'user_id and context are required for preview_only',
                        details: 'Please provide user_id and context for promotion preview'
                    });
                }
                evaluation = await this.evaluationService.evaluateSpecificPromotion({
                    user_id,
                    ...(promotion_id && { promotion_id }),
                    ...(code && { code }),
                    cart_items,
                    context
                });
                break;
        }
        const response = createSuccessResponse('Promotion evaluation completed', evaluation);
        return reply.code(200).send(response);
    });
    // Remove/cancel evaluation
    removeEvaluation = asyncHandler(async (request, reply) => {
        const { evaluation_id, user_id } = request.body;
        logger.info({ evaluation_id, user_id }, 'Removing evaluation');
        const result = await this.evaluationService.removeEvaluation(evaluation_id, user_id);
        const response = createSuccessResponse('Evaluation removed successfully', result);
        return reply.code(200).send(response);
    });
    // Get evaluation details
    getEvaluation = asyncHandler(async (request, reply) => {
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
    evaluateAutomaticPromotions = asyncHandler(async (request, reply) => {
        const { user_id, cart_items, context, current_total } = request.body;
        logger.info({
            user_id,
            cartItemsCount: cart_items.length,
            current_total,
            channel: context.channel,
            geo: context.geo
        }, 'Evaluating automatic promotions - New Flow');
        // Generate cart signature
        const cartSignature = this.evaluationService.generateCartSignature(cart_items);
        // Check for existing active evaluation with same cart signature
        const existingEvaluation = await this.evaluationService.findActiveEvaluationByCartSignature(user_id, cartSignature);
        if (existingEvaluation) {
            logger.info({
                evaluationId: existingEvaluation.evaluation_id,
                cartSignature
            }, 'Found existing active evaluation for cart signature');
            const response = createSuccessResponse('Active evaluation found', existingEvaluation);
            return reply.code(200).send(response);
        }
        // Create new evaluation with automatic promotions
        const result = await this.evaluationService.createAutomaticEvaluation({
            user_id,
            cart_items,
            context,
            cart_signature: cartSignature
        });
        const response = createSuccessResponse('Automatic evaluation created successfully', result);
        return reply.code(200).send(response);
    });
    // Get user's active evaluations
    getUserActiveEvaluations = asyncHandler(async (request, reply) => {
        const { user_id } = request.query;
        if (!user_id) {
            const errorResponse = createErrorResponse('User ID is required', 'USER_ID_REQUIRED');
            return reply.code(400).send(errorResponse);
        }
        const result = await this.evaluationService.getUserActiveEvaluations(user_id);
        const response = createSuccessResponse('User active evaluations retrieved successfully', result);
        return reply.code(200).send(response);
    });
    // Apply manual coupon to existing evaluation
    applyManualCoupon = asyncHandler(async (request, reply) => {
        const { evaluation_id, promotion_id, cart_items } = request.body;
        logger.info({
            evaluationId: evaluation_id,
            promotionId: promotion_id,
            cartItemsCount: cart_items.length
        }, 'Applying manual coupon to evaluation');
        const result = await this.evaluationService.applyManualCoupon({
            evaluation_id,
            promotion_id,
            cart_items
        });
        const response = createSuccessResponse('Manual coupon applied successfully', result);
        return reply.code(200).send(response);
    });
    // Remove manual coupon from evaluation
    removeManualCoupon = asyncHandler(async (request, reply) => {
        const { evaluation_id, promotion_id } = request.body;
        logger.info({
            evaluationId: evaluation_id,
            promotionId: promotion_id
        }, 'Removing manual coupon from evaluation');
        const result = await this.evaluationService.removeManualCoupon({
            evaluation_id,
            promotion_id
        });
        const response = createSuccessResponse('Manual coupon removed successfully', result);
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=promotion-evaluation.controller.js.map