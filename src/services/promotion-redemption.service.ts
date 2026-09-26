import { Prisma, PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger.js';
import {
  RedemptionRequest, 
  RedemptionResponse, 
  RedemptionDetail 
} from '../schemas/redemption.schema.js';
import { isPromotionChannelEligible } from '../utils/promotionChannel.js';
import { resolvePromotionRedemptionAmounts, type CheckoutPricing } from '../utils/checkoutPricing.js';

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
        const redemptionAmounts = await this.resolveRedemptionAmounts(
          evaluation,
          request,
          transaction,
        );
        await this.validateEvaluationUsage(evaluation, request.user_id, transaction, redemptionAmounts);
        const redemptionDetails = await this.createRedemptionRecords(
          evaluation,
          request,
          transaction,
          redemptionAmounts,
        );
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

  async reconcileRecordedRedemptionAmounts(
    evaluationId: string,
    orderId: number,
  ): Promise<number> {
    return this.prisma.$transaction(async (transaction) => {
      const evaluation = await transaction.promotion_evaluations.findUnique({
        where: { evaluation_id: evaluationId },
      });
      if (!evaluation) throw new Error('Evaluation not found');

      const request = {
        evaluation_id: evaluationId,
        order_id: String(orderId),
        user_id: String(evaluation.user_id || ''),
      };
      const resolvedAmounts = await this.resolveRedemptionAmounts(
        evaluation,
        request,
        transaction,
      );
      const redemptions = await transaction.promotion_redemptions.findMany({
        where: { evaluation_id: evaluationId, order_id: String(orderId) },
      });
      let updated = 0;

      for (const redemption of redemptions) {
        if (!redemption.promotion_id) continue;
        const expectedAmount = resolvedAmounts.get(redemption.promotion_id);
        if (expectedAmount === undefined || Number(redemption.discount_amount || 0) === expectedAmount) {
          continue;
        }
        const currentData = redemption.redemption_data && typeof redemption.redemption_data === 'object' && !Array.isArray(redemption.redemption_data)
          ? redemption.redemption_data as Prisma.JsonObject
          : {};
        await transaction.promotion_redemptions.update({
          where: { id: redemption.id },
          data: {
            discount_amount: expectedAmount,
            redemption_data: {
              ...currentData,
              recorded_discount_amount: expectedAmount,
              amount_reconciled: true,
              amount_reconciled_at: new Date().toISOString(),
            },
            modifieddate: this.getUtcTimestamp(),
          },
        });
        updated += 1;
      }

      return updated;
    });
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

  private async resolveRedemptionAmounts(
    evaluation: any,
    request: RedemptionRequest,
    database: Prisma.TransactionClient,
  ): Promise<Map<number, number>> {
    const orderId = Number(request.order_id);
    let checkoutPricing: Partial<CheckoutPricing> | null = null;

    if (Number.isInteger(orderId) && orderId > 0) {
      const order = await database.orders.findUnique({
        where: { id: orderId },
        select: {
          transaction: {
            select: { transactiondata: true },
          },
        },
      });
      const transactionData = order?.transaction?.transactiondata;
      if (transactionData && typeof transactionData === 'object' && !Array.isArray(transactionData)) {
        const storedPricing = (transactionData as Prisma.JsonObject).checkout_pricing;
        if (storedPricing && typeof storedPricing === 'object' && !Array.isArray(storedPricing)) {
          checkoutPricing = storedPricing as unknown as Partial<CheckoutPricing>;
        }
      }
    }

    return resolvePromotionRedemptionAmounts(
      (evaluation.applied_promotions as any[]) || [],
      checkoutPricing,
    );
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
    database: Prisma.TransactionClient,
    redemptionAmounts: Map<number, number>,
  ): Promise<void> {
    const appliedPromotions = (evaluation.applied_promotions as any[]) || [];
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));

    for (const applied of appliedPromotions) {
      const promotion = await database.promotions.findUnique({
        where: { id: applied.promotion_id },
        select: { id: true, status: true, max_redemptions: true, per_user_limit: true, budget: true }
      });
      if (!promotion || promotion.status !== 'active') throw new Error('PROMOTION_NOT_ACTIVE');

      const campaignUsage = await database.promotion_redemptions.aggregate({
        where: { promotion_id: promotion.id },
        _count: { _all: true },
        _sum: { discount_amount: true }
      });
      if (promotion.max_redemptions && campaignUsage._count._all >= promotion.max_redemptions) {
        throw new Error('PROMOTION_MAX_REDEMPTIONS_REACHED');
      }

      if (promotion.per_user_limit) {
        const userUsage = await database.promotion_redemptions.count({
          where: { promotion_id: promotion.id, user_id: userId }
        });
        if (userUsage >= promotion.per_user_limit) throw new Error('PROMOTION_PER_USER_LIMIT_REACHED');
      }
      const usedBudget = Number(campaignUsage._sum.discount_amount ?? 0);
      const currentDiscount = Number(
        redemptionAmounts.get(Number(applied.promotion_id)) ?? applied.discount_amount ?? 0,
      );
      if (Number(promotion.budget ?? 0) > 0 && usedBudget + currentDiscount > Number(promotion.budget)) {
        throw new Error('PROMOTION_BUDGET_EXHAUSTED');
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
    database: Prisma.TransactionClient,
    redemptionAmounts: Map<number, number>,
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
      const recordedDiscount = Number(
        redemptionAmounts.get(Number(promotion.promotion_id)) ?? promotion.discount_amount ?? 0,
      );

        await database.promotion_redemptions.create({
          data: {
            id: redemptionId,
            evaluation_id: evaluation.evaluation_id,
            order_id: request.order_id,
            user_id: request.user_id,
            promotion_id: promotion.promotion_id,
            assignment_id: promotion.assignment_id || null,
            voucher_code: promotion.voucher_code || null,
            discount_amount: recordedDiscount,
            redeemed_at: nowUtc,    // UTC timestamp as bigint
            redemption_data: {
              promotion_name: promotion.promotion_name,
              assignment_id: promotion.assignment_id || null,
              voucher_code: promotion.voucher_code || null,
              evaluation_id: evaluation.evaluation_id,
              benefit_type: promotion.is_free_shipping === true || promotion.promotion_type === 'FREE_SHIPPING'
                ? 'shipping'
                : 'merchandise',
              recorded_discount_amount: recordedDiscount,
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
        discount_amount: recordedDiscount,
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

  async getAllRedemptionHistory(filters: {
    page?: number;
    limit?: number;
    search?: string;
    promotionType?: string;
    status?: string;
    redeemedFrom?: number;
    redeemedTo?: number;
  }) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 10));
    const skip = (page - 1) * limit;
    const search = filters.search?.trim();
    const where: Prisma.promotion_redemptionsWhereInput = {};

    if (filters.promotionType) {
      where.promotion = { is: { type: filters.promotionType } };
    }
    if (filters.status) {
      where.evaluation = { is: { status: filters.status } };
    }
    if (filters.redeemedFrom !== undefined || filters.redeemedTo !== undefined) {
      where.redeemed_at = {
        ...(filters.redeemedFrom !== undefined ? { gte: BigInt(filters.redeemedFrom) } : {}),
        ...(filters.redeemedTo !== undefined ? { lte: BigInt(filters.redeemedTo) } : {}),
      };
    }

    if (search) {
      const [matchingOrders, matchingUsers] = await Promise.all([
        this.prisma.orders.findMany({
          where: {
            OR: [
              { orderid: { contains: search, mode: 'insensitive' } },
              { users: { is: { OR: [
                { firstname: { contains: search, mode: 'insensitive' } },
                { lastname: { contains: search, mode: 'insensitive' } },
                { useremail: { contains: search, mode: 'insensitive' } },
              ] } } },
            ],
          },
          select: { id: true, orderid: true },
        }),
        this.prisma.users.findMany({
          where: {
            OR: [
              { firstname: { contains: search, mode: 'insensitive' } },
              { lastname: { contains: search, mode: 'insensitive' } },
              { useremail: { contains: search, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
        }),
      ]);
      const orderIdentifiers = matchingOrders.flatMap((order) =>
        [String(order.id), order.orderid].filter((value): value is string => Boolean(value))
      );
      const userIdentifiers = matchingUsers.map((user) => String(user.id));
      where.OR = [
        { promotion: { is: { name: { contains: search, mode: 'insensitive' } } } },
        { promotion: { is: { code: { contains: search, mode: 'insensitive' } } } },
        ...(orderIdentifiers.length > 0 ? [{ order_id: { in: orderIdentifiers } }] : []),
        ...(userIdentifiers.length > 0 ? [{ user_id: { in: userIdentifiers } }] : []),
      ];
    }

    const [redemptions, total] = await Promise.all([
      this.prisma.promotion_redemptions.findMany({
        where,
        include: {
          promotion: {
            select: {
              id: true,
              name: true,
              type: true,
              code: true,
              application_mode: true,
              auto_apply: true,
            },
          },
          evaluation: {
            select: {
              evaluation_id: true,
              status: true,
              context: true,
            },
          },
        },
        orderBy: [{ redeemed_at: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.promotion_redemptions.count({ where }),
    ]);

    return {
      redemptions: await this.enrichRedemptionHistory(redemptions),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + limit < total,
        hasPrev: page > 1,
      },
    };
  }

  private async enrichRedemptionHistory(redemptions: any[]) {
    if (redemptions.length === 0) return [];

    const orderIdentifiers = [...new Set(
      redemptions.map((redemption) => redemption.order_id).filter(Boolean) as string[]
    )];
    const numericOrderIds = orderIdentifiers
      .filter((value) => /^\d+$/.test(value))
      .map(Number);
    const directUserIds = [...new Set(
      redemptions
        .map((redemption) => redemption.user_id)
        .filter((value): value is string => Boolean(value) && /^\d+$/.test(value))
        .map(Number)
    )];

    const [orders, users] = await Promise.all([
      this.prisma.orders.findMany({
        where: {
          OR: [
            ...(orderIdentifiers.length > 0 ? [{ orderid: { in: orderIdentifiers } }] : []),
            ...(numericOrderIds.length > 0 ? [{ id: { in: numericOrderIds } }] : []),
          ],
        },
        select: {
          id: true,
          orderid: true,
          userid: true,
          orderstatus: true,
          createddate: true,
          original_total: true,
          productamount: true,
          orderamount: true,
          promotion_discount_total: true,
          shipping_cost: true,
          users: {
            select: {
              id: true,
              firstname: true,
              lastname: true,
              useremail: true,
              usermobilenumber: true,
            },
          },
        },
      }),
      directUserIds.length > 0
        ? this.prisma.users.findMany({
          where: { id: { in: directUserIds } },
          select: {
            id: true,
            firstname: true,
            lastname: true,
            useremail: true,
            usermobilenumber: true,
          },
        })
        : Promise.resolve([]),
    ]);

    const orderByIdentifier = new Map<string, typeof orders[number]>();
    for (const order of orders) {
      orderByIdentifier.set(String(order.id), order);
      if (order.orderid) orderByIdentifier.set(order.orderid, order);
    }
    const userById = new Map(users.map((user) => [String(user.id), user]));

    return redemptions.map((redemption) => {
      const order = redemption.order_id
        ? orderByIdentifier.get(String(redemption.order_id))
        : undefined;
      const customer = order?.users ?? (
        redemption.user_id ? userById.get(String(redemption.user_id)) : undefined
      );
      const snapshot = redemption.redemption_data && typeof redemption.redemption_data === 'object'
        ? redemption.redemption_data as Record<string, any>
        : {};
      const customerName = customer
        ? [customer.firstname, customer.lastname].filter(Boolean).join(' ').trim()
          || customer.useremail
          || `Customer #${customer.id}`
        : redemption.user_id
          ? `Customer #${redemption.user_id}`
          : 'Customer unavailable';

      return {
        id: redemption.id,
        evaluation_id: redemption.evaluation_id,
        promotion_id: redemption.promotion_id,
        promotion_name: snapshot.promotion_name ?? redemption.promotion?.name ?? `Promotion #${redemption.promotion_id}`,
        promotion_code: redemption.promotion?.code ?? null,
        promotion_type: redemption.promotion?.type ?? 'PROMOTION',
        application_mode: redemption.promotion?.application_mode
          ?? (redemption.promotion?.auto_apply ? 'automatic' : null),
        order_internal_id: order?.id ?? null,
        order_number: order?.orderid ?? redemption.order_id ?? null,
        order_status: order?.orderstatus ?? null,
        customer_id: customer?.id ?? (redemption.user_id ? Number(redemption.user_id) || null : null),
        customer_name: customerName,
        customer_email: customer?.useremail ?? null,
        customer_mobile: customer?.usermobilenumber?.toString() ?? null,
        order_date: order?.createddate ? Number(order.createddate) : null,
        original_order_value: Number(order?.original_total ?? order?.productamount ?? 0),
        total_promotion_discount: Number(order?.promotion_discount_total ?? 0),
        discount_amount: Number(redemption.discount_amount ?? 0),
        final_amount_paid: Number(order?.orderamount ?? 0),
        shipping_fee: Number(order?.shipping_cost ?? 0),
        redemption_status: redemption.evaluation?.status ?? 'redeemed',
        redeemed_at: Number(redemption.redeemed_at),
        redemption_data: redemption.redemption_data ?? null,
        evaluation_context: redemption.evaluation?.context ?? null,
        order_available: Boolean(order),
      };
    });
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
              code: true,
              application_mode: true,
              auto_apply: true,
            }
          },
          evaluation: {
            select: {
              evaluation_id: true,
              user_id: true,
              created_at: true,
              status: true,
              context: true,
            }
          }
        }
      });

      if (!redemption) {
        return null;
      }

      const [enriched] = await this.enrichRedemptionHistory([redemption]);
      if (!enriched) return null;

      const couponReservations = enriched.order_internal_id
        ? await this.prisma.wallet_reservations.findMany({
          where: {
            order_id: enriched.order_internal_id,
            // Only consumed coupon credit reduced the final paid amount. A
            // reversed reservation has already been restored and must not be
            // presented as an applied coupon.
            status: 'consumed',
            credit: { is: { source_type: 'coupon' } },
          },
          include: {
            credit: {
              select: {
                id: true,
                label: true,
                assignment: {
                  select: {
                    voucher_code: true,
                    promotion: { select: { name: true } },
                  },
                },
              },
            },
          },
          orderBy: { id: 'asc' },
        })
        : [];

      return {
        ...enriched,
        coupons_applied: couponReservations.map((reservation) => ({
          reservation_id: reservation.id,
          coupon_name: reservation.credit.assignment?.promotion?.name
            ?? reservation.credit.label
            ?? null,
          coupon_code: reservation.credit.assignment?.voucher_code ?? null,
          amount: Number(reservation.amount),
          status: reservation.status,
        })),
        coupon_discount_total: couponReservations.reduce(
          (total, reservation) => total + Number(reservation.amount),
          0,
        ),
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

  /** Log promotion usage after redemption without mutating configured status. */
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
      const usage = await this.prisma.promotion_redemptions.aggregate({
        where: { promotion_id: promotionId },
        _count: { _all: true },
        _sum: { discount_amount: true }
      });

      logger.info({
        promotionId,
        promotionName: promotion.name,
        currentRedemptions: usage._count._all,
        totalBudgetUsed: Number(usage._sum.discount_amount ?? 0),
        maxRedemptions: promotion.max_redemptions,
        perUserLimit: promotion.per_user_limit,
        budget: promotion.budget == null ? null : Number(promotion.budget)
      }, 'Promotion usage statistics calculated');

      logger.info({
        promotionId,
        promotionName: promotion.name,
        discountAmount,
        currentRedemptions: usage._count._all,
        configuredStatusUnchanged: true
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
