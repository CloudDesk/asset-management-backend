import { Prisma, PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger.js';
import {
  RedemptionRequest, 
  RedemptionResponse, 
  RedemptionDetail 
} from '../schemas/redemption.schema.js';
import { isPromotionChannelEligible } from '../utils/promotionChannel.js';

export class PromotionRedemptionService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Main redemption method
  async redeemPromotion(request: RedemptionRequest): Promise<RedemptionResponse> {
    try {
      logger.info({ request }, 'Starting promotion redemption');

      const transactionResult = await this.prisma.$transaction(async (transaction) => {
        const evaluation = await transaction.promotion_evaluations.findUnique({
          where: { evaluation_id: request.evaluation_id }
        });
        if (!evaluation) throw new Error('Evaluation not found');
        if (evaluation.status !== 'active') throw new Error('Evaluation is no longer active');
        if (new Date(Number(evaluation.expires_at.toString())) < new Date()) {
          throw new Error('Evaluation has expired');
        }

        const existingRedemption = await transaction.promotion_redemptions.findFirst({
          where: { evaluation_id: request.evaluation_id }
        });
        if (existingRedemption) throw new Error('Evaluation has already been redeemed');
        if (evaluation.user_id !== request.user_id) {
          throw new Error('User not authorized to redeem this evaluation');
        }

        await this.validateEvaluationChannels(evaluation, transaction);
        await this.validateEvaluationUsage(evaluation, request.user_id, transaction);
        const redemptionDetails = await this.createRedemptionRecords(evaluation, request, transaction);
        await this.updateEvaluationStatus(request.evaluation_id, 'redeemed', transaction);
        return { evaluation, redemptionDetails };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      const { evaluation, redemptionDetails } = transactionResult;

      // 6. Update promotion usage counters
      await this.updatePromotionCounters(evaluation);
      for (const detail of redemptionDetails) {
        await this.updatePromotionUsageTracking(detail.promotion_id, detail.discount_amount);
      }

      // 7. Build response
      const response: RedemptionResponse = {
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

    } catch (error) {
      logger.error({ error, request }, 'Error in promotion redemption');
      throw error;
    }
  }

  // Get evaluation by ID
  private async getEvaluation(evaluationId: string) {
    return await this.prisma.promotion_evaluations.findUnique({
      where: { evaluation_id: evaluationId }
    });
  }

  // Get redemption by evaluation ID
  private async getRedemptionByEvaluation(evaluationId: string) {
    return await this.prisma.promotion_redemptions.findFirst({
      where: { evaluation_id: evaluationId }
    });
  }

  private async validateEvaluationChannels(
    evaluation: any,
    database: Prisma.TransactionClient | PrismaClient = this.prisma
  ): Promise<void> {
    const appliedPromotions = (evaluation.applied_promotions as any[]) || [];
    const promotionIds = appliedPromotions
      .map((promotion: any) => promotion.promotion_id)
      .filter((promotionId: unknown): promotionId is number => typeof promotionId === 'number');

    if (promotionIds.length === 0) return;

    const evaluationContext = evaluation.context as { channel?: string } | null;
    const promotions = await database.promotions.findMany({
      where: { id: { in: promotionIds } },
      select: { id: true, applicable_channel: true }
    });

    const ineligiblePromotion = promotions.find((promotion) =>
      !isPromotionChannelEligible(promotion.applicable_channel, evaluationContext?.channel)
    );

    if (ineligiblePromotion) {
      throw new Error('CHANNEL_NOT_ELIGIBLE');
    }
  }

  private async validateEvaluationUsage(
    evaluation: any,
    userId: string,
    database: Prisma.TransactionClient
  ): Promise<void> {
    const appliedPromotions = (evaluation.applied_promotions as any[]) || [];
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));

    for (const applied of appliedPromotions) {
      const promotion = await database.promotions.findUnique({
        where: { id: applied.promotion_id },
        select: { id: true, status: true, max_redemptions: true, per_user_limit: true }
      });
      if (!promotion || promotion.status !== 'active') throw new Error('PROMOTION_NOT_ACTIVE');

      if (promotion.max_redemptions) {
        const totalUsage = await database.promotion_redemptions.count({
          where: { promotion_id: promotion.id }
        });
        if (totalUsage >= promotion.max_redemptions) throw new Error('PROMOTION_MAX_REDEMPTIONS_REACHED');
      }

      if (promotion.per_user_limit) {
        const userUsage = await database.promotion_redemptions.count({
          where: { promotion_id: promotion.id, user_id: userId }
        });
        if (userUsage >= promotion.per_user_limit) throw new Error('PROMOTION_PER_USER_LIMIT_REACHED');
      }

      if (applied.assignment_id) {
        const assignment = await database.promotion_assignments.findUnique({
          where: { id: applied.assignment_id }
        });
        if (!assignment || assignment.status !== 'active') throw new Error('VOUCHER_NOT_ACTIVE');
        if (assignment.start_date && assignment.start_date > nowSeconds) throw new Error('VOUCHER_NOT_STARTED');
        if (assignment.end_date && assignment.end_date < nowSeconds) throw new Error('VOUCHER_EXPIRED');
        if (assignment.customer_id && assignment.customer_id !== Number(userId)) {
          throw new Error('VOUCHER_NOT_ASSIGNED_TO_CUSTOMER');
        }
        if (assignment.customer_group_id) {
          const membership = await database.customer_group_members.findFirst({
            where: {
              customer_group_id: assignment.customer_group_id,
              customer_id: Number(userId),
              status: 'active',
              customer_group: { status: 'active' }
            },
            select: { id: true }
          });
          if (!membership) throw new Error('CUSTOMER_GROUP_NOT_ELIGIBLE');
        }
        if (
          assignment.assignment_type === 'anyone' &&
          assignment.claimed_by_customer_id &&
          assignment.claimed_by_customer_id !== Number(userId)
        ) {
          throw new Error('VOUCHER_CLAIMED_BY_ANOTHER_CUSTOMER');
        }
        if (assignment.usage_limit) {
          const assignmentUsage = await database.promotion_redemptions.count({
            where: { assignment_id: assignment.id }
          });
          if (assignmentUsage >= assignment.usage_limit) throw new Error('VOUCHER_USAGE_LIMIT_REACHED');
        }
      }
    }
  }

  // Create redemption records
  private async createRedemptionRecords(
    evaluation: any,
    request: RedemptionRequest,
    database: Prisma.TransactionClient
  ): Promise<RedemptionDetail[]> {
    const redemptionDetails: RedemptionDetail[] = [];
    const appliedPromotions = evaluation.applied_promotions as any[];
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

        await database.promotion_redemptions.create({
          data: {
            id: redemptionId,
            evaluation_id: evaluation.evaluation_id,
            order_id: request.order_id,
            user_id: request.user_id,
            promotion_id: promotion.promotion_id,
            assignment_id: promotion.assignment_id || null,
            voucher_code: promotion.voucher_code || null,
            discount_amount: promotion.discount_amount,
            redeemed_at: nowUtc,    // UTC timestamp as bigint
            redemption_data: {
              promotion_name: promotion.promotion_name,
              assignment_id: promotion.assignment_id || null,
              voucher_code: promotion.voucher_code || null,
              evaluation_id: evaluation.evaluation_id,
              redeemed_at: new Date(Number(nowUtc.toString())).toISOString() // ISO string for compatibility
            },
            createddate: nowUtc,               // UTC timestamp
            modifieddate: nowUtc               // UTC timestamp
          }
        });

        if (promotion.assignment_id) {
          const assignment = await database.promotion_assignments.findUnique({
            where: { id: promotion.assignment_id },
            select: { assignment_type: true, claimed_by_customer_id: true }
          });
          if (!assignment) throw new Error('VOUCHER_NOT_ACTIVE');

          if (assignment.assignment_type === 'anyone') {
            const claimed = await database.promotion_assignments.updateMany({
              where: {
                id: promotion.assignment_id,
                OR: [
                  { claimed_by_customer_id: null },
                  { claimed_by_customer_id: Number(request.user_id) }
                ]
              },
              data: {
                claimed_by_customer_id: Number(request.user_id),
                claimed_at: nowUtc,
                used_count: { increment: 1 },
                modifieddate: nowUtc
              }
            });
            if (claimed.count !== 1) throw new Error('VOUCHER_CLAIMED_BY_ANOTHER_CUSTOMER');
          } else {
            await database.promotion_assignments.update({
              where: { id: promotion.assignment_id },
              data: { used_count: { increment: 1 }, modifieddate: nowUtc }
            });
          }
        }

      redemptionDetails.push({
        promotion_id: promotion.promotion_id,
        discount_amount: promotion.discount_amount,
        redeemed_at: new Date(Number(nowUtc.toString())).toISOString()
      });
    }

    return redemptionDetails;
  }

  // Update evaluation status
  private async updateEvaluationStatus(
    evaluationId: string,
    status: string,
    database: Prisma.TransactionClient | PrismaClient = this.prisma
  ) {
    logger.info({
      evaluationId,
      newStatus: status,
      previousStatus: 'active'
    }, 'Updating evaluation status from active to redeemed');

    await database.promotion_evaluations.update({
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
  private async updatePromotionCounters(evaluation: any) {
    const appliedPromotions = evaluation.applied_promotions as any[];

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
  async getRedemptionsForOrder(orderId: string) {
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

      return redemptions.map((redemption: any) => ({
        id: redemption.id,
        promotion_id: redemption.promotion_id,
        promotion_name: redemption.promotion?.name,
        promotion_type: redemption.promotion?.type,
        promotion_code: redemption.promotion?.code,
        discount_amount: redemption.discount_amount,
        redeemed_at: redemption.redeemed_at,
        redemption_data: redemption.redemption_data
      }));

    } catch (error) {
      logger.error({ error, orderId }, 'Error getting redemptions for order');
      throw error;
    }
  }

  // Get redemption by ID
  async getRedemptionById(redemptionId: string) {
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

    } catch (error) {
      logger.error({ error, redemptionId }, 'Error getting redemption by ID');
      throw error;
    }
  }

  // Get user redemption history
  async getUserRedemptionHistory(userId: string, page: number = 1, limit: number = 10) {
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
        redemptions: redemptions.map((redemption: any) => ({
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

    } catch (error) {
      logger.error({ error, userId }, 'Error getting user redemption history');
      throw error;
    }
  }

  // Add helper method
  private getUtcTimestamp(): bigint {
    return BigInt(new Date().getTime());
  }

  /**
   * Update promotion usage tracking after redemption
   * This method updates budget consumption and usage counts
   */
  private async updatePromotionUsageTracking(promotionId: number, discountAmount: number): Promise<void> {
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

    } catch (error: any) {
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
