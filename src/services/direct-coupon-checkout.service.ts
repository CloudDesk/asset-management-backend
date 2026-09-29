import { Prisma, PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { ValidationError } from '../utils/errorHandler.js';
import {
  couponUseStateErrorCode,
  isStandaloneCouponPromotion,
  resolveStandaloneCouponUseState,
} from '../utils/couponWalletPolicy.js';

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export interface DirectCouponAllocation {
  assignment_id: number;
  promotion_id: number;
  code: string;
  name: string;
  face_value: number;
  discount_amount: number;
  minimum_cart_amount: number;
  merchandise_subtotal: number;
  merchandise_remaining_before: number;
  merchandise_remaining_after: number;
  reservation_reference?: string;
  reservation_expires_at?: string;
}

export interface DirectCouponCheckoutSnapshot extends DirectCouponAllocation {
  customer_id: number;
  channel: 'web' | 'mobile';
}

interface ValidationOptions {
  reservationReference?: string;
}

export class DirectCouponCheckoutService {
  constructor(private readonly prisma: PrismaClient = new PrismaClient()) {}

  private normalizeCode(value: string) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  }

  private include = {
    promotion: true,
    wallet_credit: { select: { id: true } },
    redemptions: {
      select: { id: true, order_id: true, user_id: true, discount_amount: true },
      orderBy: { redeemed_at: 'desc' as const },
    },
  };

  private async validate(
    database: Prisma.TransactionClient | PrismaClient,
    customerId: number,
    rawCode: string,
    channel: 'web' | 'mobile',
    merchandiseSubtotal: number,
    merchandiseRemaining: number,
    options: ValidationOptions = {},
  ): Promise<{ assignment: any; allocation: DirectCouponAllocation }> {
    const code = this.normalizeCode(rawCode);
    const subtotal = money(Number(merchandiseSubtotal));
    const remaining = money(Number(merchandiseRemaining));
    if (!code || !Number.isFinite(subtotal) || subtotal < 0 || !Number.isFinite(remaining) || remaining < 0) {
      throw new ValidationError('INVALID_DIRECT_COUPON_QUOTE');
    }
    if (remaining > subtotal) throw new ValidationError('INVALID_DIRECT_COUPON_REMAINING_AMOUNT');

    const [customer, assignment] = await Promise.all([
      database.users.findUnique({ where: { id: customerId }, select: { id: true, isactive: true } }),
      database.promotion_assignments.findFirst({
        where: { voucher_code: { equals: code, mode: 'insensitive' } },
        include: this.include,
      }),
    ]);
    if (!customer?.isactive) throw new ValidationError('CUSTOMER_ACCOUNT_INACTIVE');
    if (!assignment) throw new ValidationError('COUPON_NOT_FOUND');
    if (!isStandaloneCouponPromotion(assignment.promotion)) {
      throw new ValidationError('COUPON_NOT_STANDALONE');
    }
    if (assignment.assignment_type !== 'customer' || assignment.customer_id !== customerId) {
      throw new ValidationError('COUPON_ASSIGNED_TO_ANOTHER_CUSTOMER');
    }
    if (assignment.delivery_channel !== 'all' && assignment.delivery_channel !== channel) {
      throw new ValidationError('COUPON_NOT_AVAILABLE_ON_THIS_CHANNEL');
    }

    const now = Date.now();
    const nowSeconds = BigInt(Math.floor(now / 1000));
    const sameActiveReservation = Boolean(
      options.reservationReference &&
      assignment.reservation_reference === options.reservationReference &&
      assignment.reserved_by_customer_id === customerId &&
      assignment.reservation_expires_at &&
      assignment.reservation_expires_at > BigInt(now),
    );
    const state = resolveStandaloneCouponUseState({
      ...assignment,
      redemption_count: assignment.redemptions.length,
    }, now);
    if (state !== 'available' && !(state === 'reserved' && sameActiveReservation)) {
      throw new ValidationError(couponUseStateErrorCode(state));
    }
    if (assignment.promotion.status !== 'active') {
      throw new ValidationError(
        assignment.promotion.status === 'revoked' ? 'COUPON_REVOKED' : 'COUPON_INACTIVE',
      );
    }
    if (assignment.promotion.start_date && assignment.promotion.start_date > nowSeconds) {
      throw new ValidationError('COUPON_SCHEDULED');
    }
    if (assignment.promotion.end_date && assignment.promotion.end_date < nowSeconds) {
      throw new ValidationError('COUPON_EXPIRED');
    }

    const action = assignment.promotion.action as { type?: string; value?: number; max_discount?: number } | null;
    const configuredValue = Number(action?.value || 0);
    const configuredMaximum = Number(action?.max_discount || 0);
    const faceValue = money(
      configuredMaximum > 0 ? Math.min(configuredValue, configuredMaximum) : configuredValue,
    );
    if (action?.type !== 'FIXED_AMOUNT_OFF' || !Number.isFinite(faceValue) || faceValue <= 0) {
      throw new ValidationError('COUPON_HAS_INVALID_VALUE');
    }
    const minimumCondition = Array.isArray(assignment.promotion.conditions)
      ? (assignment.promotion.conditions as Array<{ attribute?: string; operator?: string; value?: number }>).find(
          (condition) => condition.attribute === 'cart.total_value' && condition.operator === 'GTE',
        )
      : undefined;
    const minimumCartAmount = money(Number(minimumCondition?.value || 0));
    if (!Number.isFinite(minimumCartAmount) || minimumCartAmount < 0) {
      throw new ValidationError('COUPON_HAS_INVALID_MINIMUM_CART_AMOUNT');
    }
    if (subtotal < minimumCartAmount) throw new ValidationError('COUPON_MINIMUM_CART_NOT_MET');
    if (remaining <= 0) throw new ValidationError('COUPON_NO_REMAINING_MERCHANDISE');

    if (assignment.usage_limit && assignment.used_count >= assignment.usage_limit) {
      throw new ValidationError('COUPON_ALREADY_REDEEMED');
    }
    const promotionUsage = await database.promotion_redemptions.aggregate({
      where: { promotion_id: assignment.promotion_id },
      _count: { _all: true },
      _sum: { discount_amount: true },
    });
    if (
      assignment.promotion.max_redemptions &&
      promotionUsage._count._all >= assignment.promotion.max_redemptions
    ) throw new ValidationError('COUPON_MAX_REDEMPTIONS_REACHED');
    if (assignment.promotion.per_user_limit) {
      const customerUsage = await database.promotion_redemptions.count({
        where: { promotion_id: assignment.promotion_id, user_id: String(customerId) },
      });
      if (customerUsage >= assignment.promotion.per_user_limit) {
        throw new ValidationError('COUPON_PER_USER_LIMIT_REACHED');
      }
    }

    const discountAmount = money(Math.min(faceValue, remaining));
    const usedBudget = money(Number(promotionUsage._sum.discount_amount || 0));
    const budget = Number(assignment.promotion.budget || 0);
    if (budget > 0 && usedBudget + discountAmount > budget) {
      throw new ValidationError('COUPON_BUDGET_EXHAUSTED');
    }

    return {
      assignment,
      allocation: {
        assignment_id: assignment.id,
        promotion_id: assignment.promotion_id,
        code: assignment.voucher_code,
        name: assignment.promotion.name || 'Nivaana coupon',
        face_value: faceValue,
        discount_amount: discountAmount,
        minimum_cart_amount: minimumCartAmount,
        merchandise_subtotal: subtotal,
        merchandise_remaining_before: remaining,
        merchandise_remaining_after: money(remaining - discountAmount),
      },
    };
  }

  async quote(
    customerId: number,
    rawCode: string,
    channel: 'web' | 'mobile',
    merchandiseSubtotal: number,
    merchandiseRemaining: number,
  ): Promise<DirectCouponAllocation> {
    const { allocation } = await this.validate(
      this.prisma,
      customerId,
      rawCode,
      channel,
      merchandiseSubtotal,
      merchandiseRemaining,
    );
    return allocation;
  }

  async reserve(
    customerId: number,
    rawCode: string,
    channel: 'web' | 'mobile',
    merchandiseSubtotal: number,
    merchandiseRemaining: number,
    merchantTransactionId: string,
  ): Promise<DirectCouponCheckoutSnapshot> {
    return this.prisma.$transaction(async (database) => {
      const { assignment, allocation } = await this.validate(
        database,
        customerId,
        rawCode,
        channel,
        merchandiseSubtotal,
        merchandiseRemaining,
        { reservationReference: merchantTransactionId },
      );
      const now = Date.now();
      const reservationExpiresAt = BigInt(
        now + Math.max(Number(process.env.DIRECT_COUPON_RESERVATION_MINUTES || 15), 1) * 60_000,
      );
      const locked = await database.promotion_assignments.updateMany({
        where: {
          id: assignment.id,
          customer_id: customerId,
          claimed_by_customer_id: null,
          claimed_at: null,
          status: 'active',
          used_count: 0,
          wallet_credit: null,
          redemptions: { none: {} },
          OR: [
            { reservation_reference: null },
            { reservation_expires_at: null },
            { reservation_expires_at: { lte: BigInt(now) } },
            { reservation_reference: merchantTransactionId, reserved_by_customer_id: customerId },
          ],
        },
        data: {
          reserved_by_customer_id: customerId,
          reservation_reference: merchantTransactionId,
          reservation_expires_at: reservationExpiresAt,
          modifieddate: BigInt(now),
        },
      });
      if (locked.count !== 1) throw new ValidationError('COUPON_NO_LONGER_AVAILABLE');

      return {
        ...allocation,
        customer_id: customerId,
        channel,
        reservation_reference: merchantTransactionId,
        reservation_expires_at: reservationExpiresAt.toString(),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async consume(
    merchantTransactionId: string,
    orderId: number,
    snapshot: DirectCouponCheckoutSnapshot | null | undefined,
  ): Promise<{ consumed: boolean; redemption_id: string | null }> {
    if (!snapshot || snapshot.discount_amount <= 0) return { consumed: false, redemption_id: null };

    try {
      return await this.prisma.$transaction(async (database) => {
      const existing = await database.promotion_redemptions.findFirst({
        where: { assignment_id: snapshot.assignment_id },
        select: { id: true, order_id: true, discount_amount: true },
      });
      if (existing) {
        if (
          existing.order_id === String(orderId) &&
          money(Number(existing.discount_amount || 0)) === money(snapshot.discount_amount)
        ) return { consumed: false, redemption_id: existing.id };
        throw new Error('DIRECT_COUPON_ALREADY_REDEEMED');
      }

      const assignment = await database.promotion_assignments.findUnique({
        where: { id: snapshot.assignment_id },
        include: { promotion: true, wallet_credit: { select: { id: true } } },
      });
      if (!assignment || !isStandaloneCouponPromotion(assignment.promotion)) {
        throw new Error('DIRECT_COUPON_NOT_FOUND');
      }
      if (
        assignment.customer_id !== snapshot.customer_id ||
        assignment.reserved_by_customer_id !== snapshot.customer_id ||
        assignment.reservation_reference !== merchantTransactionId ||
        assignment.claimed_by_customer_id ||
        assignment.wallet_credit
      ) throw new Error('DIRECT_COUPON_RESERVATION_MISMATCH');

      const now = BigInt(Date.now());
      const consumed = await database.promotion_assignments.updateMany({
        where: {
          id: snapshot.assignment_id,
          customer_id: snapshot.customer_id,
          reserved_by_customer_id: snapshot.customer_id,
          reservation_reference: merchantTransactionId,
          claimed_by_customer_id: null,
          claimed_at: null,
          used_count: 0,
          wallet_credit: null,
          redemptions: { none: {} },
        },
        data: {
          used_count: { increment: 1 },
          reserved_by_customer_id: null,
          reservation_reference: null,
          reservation_expires_at: null,
          modifieddate: now,
        },
      });
      if (consumed.count !== 1) throw new Error('DIRECT_COUPON_NO_LONGER_AVAILABLE');

      const evaluationId = uuidv4();
      const redemptionId = uuidv4();
      const appliedPromotion = {
        promotion_id: snapshot.promotion_id,
        promotion_name: snapshot.name,
        promotion_type: 'FIXED_AMOUNT_OFF_CART',
        assignment_id: snapshot.assignment_id,
        voucher_code: snapshot.code,
        discount_amount: snapshot.discount_amount,
        is_auto: false,
        is_direct_coupon: true,
      };
      await database.promotion_evaluations.create({
        data: {
          evaluation_id: evaluationId,
          user_id: String(snapshot.customer_id),
          original_total: new Prisma.Decimal(snapshot.merchandise_subtotal),
          discounted_total: new Prisma.Decimal(snapshot.merchandise_remaining_after),
          applied_promotions: [appliedPromotion],
          context: {
            schema_version: 1,
            source: 'direct_coupon_checkout',
            channel: snapshot.channel,
            merchant_transaction_id: merchantTransactionId,
            order_id: orderId,
          },
          created_at: now,
          expires_at: now,
          status: 'redeemed',
          createddate: now,
          modifieddate: now,
        },
      });
      await database.promotion_redemptions.create({
        data: {
          id: redemptionId,
          evaluation_id: evaluationId,
          order_id: String(orderId),
          user_id: String(snapshot.customer_id),
          promotion_id: snapshot.promotion_id,
          assignment_id: snapshot.assignment_id,
          voucher_code: snapshot.code,
          discount_amount: new Prisma.Decimal(snapshot.discount_amount),
          redeemed_at: now,
          redemption_data: {
            source: 'direct_coupon_checkout',
            merchant_transaction_id: merchantTransactionId,
            promotion_name: snapshot.name,
            face_value: snapshot.face_value,
            recorded_discount_amount: snapshot.discount_amount,
            benefit_type: 'merchandise',
          },
          createddate: now,
          modifieddate: now,
        },
      });
        return { consumed: true, redemption_id: redemptionId };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error: any) {
      if (error?.code === 'P2034' || error?.code === 'P2002') {
        const existing = await this.prisma.promotion_redemptions.findFirst({
          where: { assignment_id: snapshot.assignment_id, order_id: String(orderId) },
          select: { id: true, discount_amount: true },
        });
        if (
          existing &&
          money(Number(existing.discount_amount || 0)) === money(snapshot.discount_amount)
        ) return { consumed: false, redemption_id: existing.id };
      }
      throw error;
    }
  }

  async release(merchantTransactionId: string): Promise<number> {
    if (!merchantTransactionId) return 0;
    const released = await this.prisma.promotion_assignments.updateMany({
      where: { reservation_reference: merchantTransactionId, used_count: 0 },
      data: {
        reserved_by_customer_id: null,
        reservation_reference: null,
        reservation_expires_at: null,
        modifieddate: BigInt(Date.now()),
      },
    });
    return released.count;
  }
}
