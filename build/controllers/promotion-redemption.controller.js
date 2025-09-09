import { PromotionRedemptionService } from '../services/promotion-redemption.service.js';
import { redemptionRequestSchema } from '../schemas/redemption.schema.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';
export class PromotionRedemptionController {
    redemptionService = new PromotionRedemptionService();
    // Redeem promotion after order placement
    redeemPromotion = asyncHandler(async (request, reply) => {
        const data = redemptionRequestSchema.parse(request.body);
        logger.info({
            evaluationId: data.evaluation_id,
            orderId: data.order_id,
            userId: data.user_id
        }, 'Redeeming promotion');
        const result = await this.redemptionService.redeemPromotion(data);
        const response = createSuccessResponse('Promotion redeemed successfully', result);
        return reply.code(200).send(response);
    });
    // Get redemptions for an order
    getRedemptionsForOrder = asyncHandler(async (request, reply) => {
        const { orderId } = request.params;
        logger.info({ orderId }, 'Getting redemptions for order');
        const redemptions = await this.redemptionService.getRedemptionsForOrder(orderId);
        const response = createSuccessResponse('Redemptions retrieved successfully', redemptions);
        return reply.code(200).send(response);
    });
    // Get redemption by ID
    getRedemptionById = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        // Validate UUID format
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
            return reply.code(400).send({
                success: false,
                message: 'Invalid redemption ID format',
                details: 'Redemption ID must be a valid UUID'
            });
        }
        logger.info({ redemptionId: id }, 'Getting redemption by ID');
        const redemption = await this.redemptionService.getRedemptionById(id);
        if (!redemption) {
            return reply.code(404).send({
                success: false,
                message: 'Redemption not found',
                details: 'The requested redemption could not be found'
            });
        }
        const response = createSuccessResponse('Redemption retrieved successfully', redemption);
        return reply.code(200).send(response);
    });
    // Get user redemption history
    getUserRedemptionHistory = asyncHandler(async (request, reply) => {
        const { userId } = request.params;
        const page = parseInt(request.query.page || '1');
        const limit = parseInt(request.query.limit || '10');
        logger.info({ userId, page, limit }, 'Getting user redemption history');
        const result = await this.redemptionService.getUserRedemptionHistory(userId, page, limit);
        const response = createSuccessResponse('User redemption history retrieved successfully', result);
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=promotion-redemption.controller.js.map