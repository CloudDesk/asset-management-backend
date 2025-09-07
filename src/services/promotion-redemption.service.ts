import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger.js';
import { 
  RedemptionRequest, 
  RedemptionResponse, 
  RedemptionDetail 
} from '../schemas/redemption.schema.js';

export class PromotionRedemptionService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Main redemption method
  async redeemPromotion(request: RedemptionRequest): Promise<RedemptionResponse> {
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

      if (new Date(evaluation.expires_at) < new Date()) {
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

  // Create redemption records
  private async createRedemptionRecords(evaluation: any, request: RedemptionRequest): Promise<RedemptionDetail[]> {
    const redemptionDetails: RedemptionDetail[] = [];
    const appliedPromotions = evaluation.applied_promotions as any[];
    const nowUtc = this.getUtcTimestamp();

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
          redeemed_at: nowUtc,               // UTC timestamp
          redemption_data: {
            promotion_name: promotion.promotion_name,
            evaluation_id: evaluation.evaluation_id,
            redeemed_at: new Date(Number(nowUtc)).toISOString() // ISO string for compatibility
          },
          createddate: nowUtc,               // UTC timestamp
          modifieddate: nowUtc               // UTC timestamp
        }
      });

      redemptionDetails.push({
        promotion_id: promotion.promotion_id,
        discount_amount: promotion.discount_amount,
        redeemed_at: new Date(Number(nowUtc)).toISOString()
      });
    }

    return redemptionDetails;
  }

  // Update evaluation status
  private async updateEvaluationStatus(evaluationId: string, status: string) {
    await this.prisma.promotion_evaluations.update({
      where: { evaluation_id: evaluationId },
      data: { 
        status,
        modifieddate: BigInt(Date.now())
      }
    });
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

      return redemptions.map(redemption => ({
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
        redemptions: redemptions.map(redemption => ({
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
}
