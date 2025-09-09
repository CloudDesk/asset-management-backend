import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger.js';
export class PromotionRedemptionService {
    prisma;
    constructor() {
        this.prisma = new PrismaClient();
    }
    // Main redemption method
    async redeemPromotion(request) {
        try {
            logger.info({ request }, 'Starting promotion redemption');
            // 1. Validate evaluation exists and is still valid
            const evaluation = await this.getEvaluation(request.evaluation_id);
            if (!evaluation) {
                throw new Error('Evaluation not found');
            }
            if (evaluation.status !== 'active') {
                throw new Error('Evaluation is no longer active');
            }
            if (new Date(Number(evaluation.expires_at.toString())) < new Date()) {
                throw new Error('Evaluation has expired');
            }
            // 2. Check if already redeemed
            const existingRedemption = await this.getRedemptionByEvaluation(request.evaluation_id);
            if (existingRedemption) {
                throw new Error('Evaluation has already been redeemed');
            }
            // 3. Validate user ownership
            if (evaluation.user_id !== request.user_id) {
                throw new Error('User not authorized to redeem this evaluation');
            }
            // 4. Create redemption records
            const redemptionDetails = await this.createRedemptionRecords(evaluation, request);
            // 5. Update evaluation status
            await this.updateEvaluationStatus(request.evaluation_id, 'redeemed');
            // 6. Update promotion usage counters
            await this.updatePromotionCounters(evaluation);
            // 7. Build response
            const response = {
                success: true,
                redemption_id: redemptionDetails[0]?.promotion_id?.toString() || '',
                order_id: request.order_id,
                total_discount_applied: redemptionDetails.reduce((sum, detail) => sum + detail.discount_amount, 0),
                redemption_details: redemptionDetails.map(detail => ({
                    promotion_id: detail.promotion_id,
                    discount_amount: detail.discount_amount,
                    redeemed_at: detail.redeemed_at
                }))
            };
            logger.info({
                redemptionId: response.redemption_id,
                totalDiscount: response.total_discount_applied
            }, 'Promotion redemption completed');
            return response;
        }
        catch (error) {
            logger.error({ error, request }, 'Error in promotion redemption');
            throw error;
        }
    }
    // Get evaluation by ID
    async getEvaluation(evaluationId) {
        return await this.prisma.promotion_evaluations.findUnique({
            where: { evaluation_id: evaluationId }
        });
    }
    // Get redemption by evaluation ID
    async getRedemptionByEvaluation(evaluationId) {
        return await this.prisma.promotion_redemptions.findFirst({
            where: { evaluation_id: evaluationId }
        });
    }
    // Create redemption records
    async createRedemptionRecords(evaluation, request) {
        const redemptionDetails = [];
        const appliedPromotions = evaluation.applied_promotions;
        const nowUtc = this.getUtcTimestamp();
        logger.info({
            evaluationId: evaluation.evaluation_id,
            orderId: request.order_id,
            userId: request.user_id,
            cartSignature: evaluation.cart_signature,
            appliedPromotionsCount: appliedPromotions.length,
            appliedPromotions: appliedPromotions.map(p => ({
                promotion_id: p.promotion_id,
                promotion_name: p.promotion_name,
                promotion_type: p.promotion_type,
                is_auto: p.is_auto,
                is_free_shipping: p.is_free_shipping,
                discount_amount: p.discount_amount
            })),
            originalTotal: evaluation.original_total,
            discountedTotal: evaluation.discounted_total
        }, 'Creating redemption records for multiple promotions in single evaluation');
        for (const promotion of appliedPromotions) {
            const redemptionId = uuidv4();
            await this.prisma.promotion_redemptions.create({
                data: {
                    id: redemptionId,
                    evaluation_id: evaluation.evaluation_id,
                    order_id: request.order_id,
                    user_id: request.user_id,
                    promotion_id: promotion.promotion_id,
                    discount_amount: promotion.discount_amount,
                    redeemed_at: nowUtc, // UTC timestamp as bigint
                    redemption_data: {
                        promotion_name: promotion.promotion_name,
                        evaluation_id: evaluation.evaluation_id,
                        redeemed_at: new Date(Number(nowUtc.toString())).toISOString() // ISO string for compatibility
                    },
                    createddate: nowUtc, // UTC timestamp
                    modifieddate: nowUtc // UTC timestamp
                }
            });
            // Update promotion usage tracking (budget, usage counts)
            await this.updatePromotionUsageTracking(promotion.promotion_id, promotion.discount_amount);
            redemptionDetails.push({
                promotion_id: promotion.promotion_id,
                discount_amount: promotion.discount_amount,
                redeemed_at: new Date(Number(nowUtc.toString())).toISOString()
            });
        }
        return redemptionDetails;
    }
    // Update evaluation status
    async updateEvaluationStatus(evaluationId, status) {
        logger.info({
            evaluationId,
            newStatus: status,
            previousStatus: 'active'
        }, 'Updating evaluation status from active to redeemed');
        await this.prisma.promotion_evaluations.update({
            where: { evaluation_id: evaluationId },
            data: {
                status,
                modifieddate: BigInt(Date.now())
            }
        });
        logger.info({
            evaluationId,
            status
        }, 'Evaluation status updated successfully');
    }
    // Update promotion usage counters
    async updatePromotionCounters(evaluation) {
        const appliedPromotions = evaluation.applied_promotions;
        for (const promotion of appliedPromotions) {
            // Update promotion usage count if needed
            // This could involve updating a usage counter in the promotions table
            // or maintaining separate usage tracking tables
            logger.info({
                promotionId: promotion.promotion_id,
                discountAmount: promotion.discount_amount
            }, 'Promotion usage recorded');
        }
    }
    // Get redemptions for an order
    async getRedemptionsForOrder(orderId) {
        try {
            const redemptions = await this.prisma.promotion_redemptions.findMany({
                where: { order_id: orderId },
                include: {
                    promotion: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            code: true
                        }
                    }
                },
                orderBy: { redeemed_at: 'desc' }
            });
            return redemptions.map((redemption) => ({
                id: redemption.id,
                promotion_id: redemption.promotion_id,
                promotion_name: redemption.promotion?.name,
                promotion_type: redemption.promotion?.type,
                promotion_code: redemption.promotion?.code,
                discount_amount: redemption.discount_amount,
                redeemed_at: redemption.redeemed_at,
                redemption_data: redemption.redemption_data
            }));
        }
        catch (error) {
            logger.error({ error, orderId }, 'Error getting redemptions for order');
            throw error;
        }
    }
    // Get redemption by ID
    async getRedemptionById(redemptionId) {
        try {
            const redemption = await this.prisma.promotion_redemptions.findUnique({
                where: { id: redemptionId },
                include: {
                    promotion: {
                        select: {
                            id: true,
                            name: true,
                            type: true,
                            code: true
                        }
                    },
                    evaluation: {
                        select: {
                            evaluation_id: true,
                            user_id: true,
                            created_at: true
                        }
                    }
                }
            });
            if (!redemption) {
                return null;
            }
            return {
                id: redemption.id,
                evaluation_id: redemption.evaluation_id,
                order_id: redemption.order_id,
                user_id: redemption.user_id,
                promotion_id: redemption.promotion_id,
                promotion_name: redemption.promotion?.name,
                promotion_type: redemption.promotion?.type,
                promotion_code: redemption.promotion?.code,
                discount_amount: redemption.discount_amount,
                redeemed_at: redemption.redeemed_at,
                redemption_data: redemption.redemption_data,
                evaluation: redemption.evaluation
            };
        }
        catch (error) {
            logger.error({ error, redemptionId }, 'Error getting redemption by ID');
            throw error;
        }
    }
    // Get user redemption history
    async getUserRedemptionHistory(userId, page = 1, limit = 10) {
        try {
            const skip = (page - 1) * limit;
            const [redemptions, total] = await Promise.all([
                this.prisma.promotion_redemptions.findMany({
                    where: { user_id: userId },
                    include: {
                        promotion: {
                            select: {
                                id: true,
                                name: true,
                                type: true,
                                code: true
                            }
                        }
                    },
                    orderBy: { redeemed_at: 'desc' },
                    skip,
                    take: limit
                }),
                this.prisma.promotion_redemptions.count({
                    where: { user_id: userId }
                })
            ]);
            return {
                redemptions: redemptions.map((redemption) => ({
                    id: redemption.id,
                    promotion_id: redemption.promotion_id,
                    promotion_name: redemption.promotion?.name,
                    promotion_type: redemption.promotion?.type,
                    promotion_code: redemption.promotion?.code,
                    discount_amount: redemption.discount_amount,
                    redeemed_at: redemption.redeemed_at,
                    order_id: redemption.order_id
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                    hasNext: skip + limit < total,
                    hasPrev: page > 1
                }
            };
        }
        catch (error) {
            logger.error({ error, userId }, 'Error getting user redemption history');
            throw error;
        }
    }
    // Add helper method
    getUtcTimestamp() {
        return BigInt(new Date().getTime());
    }
    /**
     * Update promotion usage tracking after redemption
     * This method updates budget consumption and usage counts
     */
    async updatePromotionUsageTracking(promotionId, discountAmount) {
        try {
            logger.info({
                promotionId,
                discountAmount
            }, 'Updating promotion usage tracking');
            // Get current promotion data
            const promotion = await this.prisma.promotions.findUnique({
                where: { id: promotionId },
                select: {
                    id: true,
                    budget: true,
                    max_redemptions: true,
                    per_user_limit: true,
                    name: true
                }
            });
            if (!promotion) {
                logger.warn({ promotionId }, 'Promotion not found for usage tracking update');
                return;
            }
            // Calculate current usage statistics
            const currentRedemptions = await this.prisma.promotion_redemptions.count({
                where: { promotion_id: promotionId }
            });
            const currentBudgetUsed = await this.prisma.promotion_redemptions.aggregate({
                where: { promotion_id: promotionId },
                _sum: { discount_amount: true }
            });
            const totalBudgetUsed = Number(currentBudgetUsed._sum.discount_amount || 0);
            const remainingBudget = promotion.budget ? Number(promotion.budget) - totalBudgetUsed : null;
            logger.info({
                promotionId,
                promotionName: promotion.name,
                currentRedemptions,
                totalBudgetUsed,
                remainingBudget,
                maxRedemptions: promotion.max_redemptions,
                perUserLimit: promotion.per_user_limit,
                budget: promotion.budget ? Number(promotion.budget) : null
            }, 'Promotion usage statistics calculated');
            // Check if promotion should be deactivated due to limits
            let shouldDeactivate = false;
            let deactivationReason = '';
            if (promotion.max_redemptions && currentRedemptions >= promotion.max_redemptions) {
                shouldDeactivate = true;
                deactivationReason = 'Maximum redemptions reached';
            }
            if (promotion.budget && remainingBudget !== null && remainingBudget <= 0) {
                shouldDeactivate = true;
                deactivationReason = 'Budget exhausted';
            }
            // Update promotion status if needed
            if (shouldDeactivate) {
                await this.prisma.promotions.update({
                    where: { id: promotionId },
                    data: {
                        is_active: false,
                        status: 'exhausted',
                        modifieddate: BigInt(Date.now())
                    }
                });
                logger.warn({
                    promotionId,
                    promotionName: promotion.name,
                    reason: deactivationReason,
                    currentRedemptions,
                    totalBudgetUsed,
                    remainingBudget
                }, 'Promotion deactivated due to limits reached');
            }
            logger.info({
                promotionId,
                promotionName: promotion.name,
                discountAmount,
                currentRedemptions,
                totalBudgetUsed,
                remainingBudget,
                isActive: !shouldDeactivate
            }, 'Promotion usage tracking updated successfully');
        }
        catch (error) {
            logger.error({
                error: error.message,
                stack: error.stack,
                promotionId,
                discountAmount
            }, 'Error updating promotion usage tracking');
            // Don't throw error - this is tracking only, shouldn't fail redemption
        }
    }
}
//# sourceMappingURL=promotion-redemption.service.js.map