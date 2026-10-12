import { randomBytes } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import type { CouponWalletListInput, CreateQuickCouponInput, UpdateQuickCouponInput } from '../schemas/coupon-wallet.schema.js';
import { NotFoundError, ValidationError } from '../utils/errorHandler.js';
import { customerEmailNotificationService } from './customer-email-notification.service.js';
import {
  buildCouponClaimLockWhere,
  couponUseStateErrorCode,
  isStandaloneCouponPromotion,
  resolveStandaloneCouponUseState,
  STANDALONE_COUPON_DELIVERY_CHANNEL,
  STANDALONE_COUPON_DESCRIPTION_PREFIX,
  STANDALONE_COUPON_STACKABLE,
} from '../utils/couponWalletPolicy.js';

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const generatePersonalizedCouponCode = () => `NV-${randomBytes(6).toString('hex').toUpperCase()}`;

// Admin-facing coupon status. Fully used wins over expiry (nothing was lost);
// expired means the date passed with unused value.
const ADMIN_COUPON_STATUSES = ['not_used', 'added_to_wallet', 'partly_used', 'fully_used', 'expired', 'paused', 'cancelled'] as const;
type AdminCouponStatus = typeof ADMIN_COUPON_STATUSES[number];

export class CouponWalletService {
  private prisma = new PrismaClient();

  private normalizeCode(value: string) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  }

  private toUnixSeconds(value?: string) {
    return value ? BigInt(Math.floor(new Date(value).getTime() / 1000)) : null;
  }

  private async ensureCodeAvailable(database: any, code: string) {
    const [promotion, assignment] = await Promise.all([
      database.promotions.findFirst({ where: { code: { equals: code, mode: 'insensitive' } }, select: { id: true } }),
      database.promotion_assignments.findFirst({ where: { voucher_code: { equals: code, mode: 'insensitive' } }, select: { id: true } }),
    ]);
    if (promotion || assignment) throw new Error('Coupon code already exists');
  }

  private async generateCode(database: any) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const code = generatePersonalizedCouponCode();
      const assignment = await database.promotion_assignments.findUnique({ where: { voucher_code: code }, select: { id: true } });
      if (!assignment) return code;
    }
    throw new Error('Unable to generate a unique coupon code');
  }

  private walletStatus(assignment: any, redemptionCount: number) {
    return resolveStandaloneCouponUseState({
      ...assignment,
      redemption_count: redemptionCount,
    });
  }

  private adminDisplayStatus(
    assignment: any,
    status: string,
    walletCredit: { original_amount: number; remaining_amount: number } | null,
    redemptionCount: number,
  ): AdminCouponStatus {
    if (assignment.status === 'revoked') return 'cancelled';
    if (!['active', 'expired'].includes(assignment.status)) return 'paused';
    const fullyUsed = walletCredit
      ? walletCredit.remaining_amount <= 0
      : redemptionCount > 0 || Number(assignment.used_count || 0) > 0;
    if (fullyUsed) return 'fully_used';
    if (status === 'expired') return 'expired';
    if (walletCredit) return walletCredit.remaining_amount >= walletCredit.original_amount ? 'added_to_wallet' : 'partly_used';
    if (status === 'claimed') return 'added_to_wallet';
    return 'not_used';
  }

  private formatCoupon(assignment: any) {
    const redemptions = assignment.redemptions || [];
    const walletCreditExpired = Boolean(
      assignment.wallet_credit?.expires_at && assignment.wallet_credit.expires_at < BigInt(Math.floor(Date.now() / 1000)),
    );
    const walletCredit = assignment.wallet_credit
      ? {
          id: assignment.wallet_credit.id,
          original_amount: Number(assignment.wallet_credit.original_amount),
          remaining_amount: Number(assignment.wallet_credit.remaining_amount),
          available_amount: Math.max(
            Number(assignment.wallet_credit.remaining_amount) -
              (assignment.wallet_credit.reservations || []).reduce(
                (total: number, reservation: { amount: unknown }) => total + Number(reservation.amount),
                0,
              ),
            0,
          ),
          minimum_cart_amount: Number(assignment.wallet_credit.minimum_cart_amount),
          status: walletCreditExpired ? 'expired' : assignment.wallet_credit.status,
          expires_at: assignment.wallet_credit.expires_at,
        }
      : null;
    const status = this.walletStatus(assignment, redemptions.length);
    return {
      id: assignment.id,
      code: assignment.voucher_code,
      ownership_mode: assignment.assignment_type,
      status,
      display_status: this.adminDisplayStatus(assignment, status, walletCredit, redemptions.length),
      administrative_status: assignment.status,
      usage_limit: assignment.usage_limit,
      used_count: redemptions.length,
      start_date: assignment.start_date,
      end_date: assignment.end_date,
      claimed_at: assignment.claimed_at,
      dispatched_order_id: assignment.dispatched_order_id,
      delivery_channel: assignment.delivery_channel,
      reservation_expires_at: assignment.reservation_expires_at,
      promotion: assignment.promotion,
      customer: assignment.customer,
      claimed_customer: assignment.claimed_customer,
      customer_group: assignment.customer_group,
      source_coupon_group: assignment.source_coupon_group,
      wallet_credit: walletCredit,
      last_redemption: redemptions[0] || null,
    };
  }

  private include = {
    promotion: { select: { id: true, name: true, description: true, type: true, action: true, conditions: true, applicable_channel: true, stackable: true, visibility: true, status: true } },
    customer: { select: { id: true, firstname: true, lastname: true, useremail: true, usermobilenumber: true } },
    claimed_customer: { select: { id: true, firstname: true, lastname: true, useremail: true, usermobilenumber: true } },
    customer_group: { select: { id: true, name: true, code: true } },
    source_coupon_group: { select: { id: true, name: true, code: true } },
    wallet_credit: {
      select: {
        id: true,
        original_amount: true,
        remaining_amount: true,
        minimum_cart_amount: true,
        status: true,
        expires_at: true,
        reservations: {
          where: { status: 'reserved' },
          select: { amount: true },
        },
      },
    },
    redemptions: { select: { id: true, order_id: true, user_id: true, discount_amount: true, redeemed_at: true }, orderBy: { redeemed_at: 'desc' as const } },
  };

  async getCustomerWallet(customerId: number, channel: 'web' | 'mobile') {
    await this.prisma.wallet_reservations.updateMany({
      where: { status: 'reserved', expires_at: { lte: BigInt(Date.now()) } },
      data: { status: 'released', modifieddate: BigInt(Date.now()) },
    });
    const assignments = await this.prisma.promotion_assignments.findMany({
      where: {
        promotion: { is: { visibility: 'private', description: { startsWith: STANDALONE_COUPON_DESCRIPTION_PREFIX } } },
        AND: [
          { OR: [
            { assignment_type: 'customer', customer_id: customerId },
            { claimed_by_customer_id: customerId },
          ] },
          { OR: [
            { claimed_by_customer_id: customerId },
            { delivery_channel: { in: ['all', channel] } },
          ] },
        ],
      },
      include: this.include,
      orderBy: { id: 'desc' },
      });
    let directRefundCredits: any[] = [];
    try {
      directRefundCredits = await this.prisma.wallet_credits.findMany({
          where: {
            customer_id: customerId,
            assignment_id: null,
            source_type: { in: ['cancellation_refund', 'return_refund'] },
          },
          include: {
            reservations: {
              where: { status: 'reserved', expires_at: { gt: BigInt(Date.now()) } },
              select: { amount: true },
            },
          },
          orderBy: { id: 'desc' },
        });
    } catch (error: any) {
      if (error?.code !== 'P2021' && error?.code !== 'P2022') throw error;
      // Coupon wallet remains usable until the additive refund-credit columns
      // are deployed. Refund credits become visible after migration.
      directRefundCredits = [];
    }
    const coupons = assignments.map((assignment) => this.formatCoupon(assignment));
    const refundCredits = directRefundCredits.map((credit: any) => {
      const reserved = credit.reservations.reduce((sum: number, reservation: any) => sum + Number(reservation.amount), 0);
      const availableAmount = Math.max(money(Number(credit.remaining_amount) - reserved), 0);
      return {
        id: -credit.id,
        code: credit.source_reference || `REFUND-${credit.id}`,
        status: 'claimed',
        start_date: credit.createddate,
        end_date: credit.expires_at,
        claimed_at: credit.createddate,
        promotion: { name: credit.label || 'Nivaana refund credit', action: null, conditions: [] },
        wallet_credit: {
          id: credit.id,
          original_amount: Number(credit.original_amount),
          remaining_amount: Number(credit.remaining_amount),
          available_amount: availableAmount,
          minimum_cart_amount: Number(credit.minimum_cart_amount),
          status: credit.status,
          expires_at: credit.expires_at,
          source_type: credit.source_type,
        },
      };
    });
    const availableCredits = [...coupons, ...refundCredits].filter((coupon) => {
      const credit = coupon.wallet_credit;
      return Boolean(
        credit &&
        ['active', 'partially_used'].includes(credit.status) &&
        Number(credit.available_amount || 0) > 0
      );
    });
    const balance = availableCredits.reduce((total, coupon) => {
      return total + Number(coupon.wallet_credit?.available_amount || 0);
    }, 0);
    return {
      balance,
      available_coupons: coupons.filter((coupon) => coupon.status === 'available' || coupon.status === 'scheduled'),
      // Used and expired credits remain available through wallet activity,
      // but are not returned as spendable wallet cards.
      credits: availableCredits,
    };
  }

  async getCustomerWalletActivity(customerId: number, page = 1, limit = 10, creditId?: number) {
    const credits = await this.prisma.wallet_credits.findMany({
      where: {
        customer_id: customerId,
        ...(creditId ? { id: creditId } : {}),
      },
      include: {
        assignment: {
          select: {
            voucher_code: true,
            promotion: { select: { name: true } },
          },
        },
        reservations: {
          where: { status: { in: ['consumed', 'reversed'] } },
          select: {
            id: true,
            amount: true,
            status: true,
            order_id: true,
            merchant_transaction_id: true,
            createddate: true,
            consumed_at: true,
            reversed_at: true,
          },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: [{ createddate: 'asc' }, { id: 'asc' }],
    });

    const activity = credits.flatMap((credit) => {
      let remaining = Number(credit.original_amount);
      const events: any[] = credit.reservations.flatMap((reservation) => {
        const redemption = {
          id: `redemption-${reservation.id}`,
          type: 'order_redemption' as const,
          amount: -Number(reservation.amount),
          wallet_credit_id: credit.id,
          coupon_code: credit.assignment?.voucher_code || credit.source_reference || `REFUND-${credit.id}`,
          coupon_name: credit.assignment?.promotion?.name || credit.label || 'Nivaana refund credit',
          order_id: reservation.order_id,
          merchant_transaction_id: reservation.merchant_transaction_id,
          occurred_at: (reservation.consumed_at || reservation.createddate).toString(),
          credit_balance_after: 0,
        };
        if (reservation.status !== 'reversed') return [redemption];
        return [redemption, {
          id: `reversal-${reservation.id}`,
          type: 'cancellation_reversal' as const,
          amount: Number(reservation.amount),
          wallet_credit_id: credit.id,
          coupon_code: credit.assignment?.voucher_code || credit.source_reference || `REFUND-${credit.id}`,
          coupon_name: credit.assignment?.promotion?.name || credit.label || 'Nivaana refund credit',
          order_id: reservation.order_id,
          merchant_transaction_id: reservation.merchant_transaction_id,
          occurred_at: (reservation.reversed_at || reservation.createddate).toString(),
          credit_balance_after: 0,
        }];
      });
      if (!credit.assignment && ['cancellation_refund', 'return_refund'].includes(credit.source_type)) {
        events.push({
          id: `refund-credit-${credit.id}`,
          type: 'refund_credit',
          amount: Number(credit.original_amount),
          wallet_credit_id: credit.id,
          coupon_code: credit.source_reference || `REFUND-${credit.id}`,
          coupon_name: credit.label || 'Nivaana refund credit',
          order_id: credit.source_order_id,
          merchant_transaction_id: null,
          occurred_at: credit.createddate.toString(),
          credit_balance_after: 0,
        });
      }
      return events
        .sort((left, right) => Number(left.occurred_at) - Number(right.occurred_at))
        .map((event) => {
          remaining = Math.max(0, Math.min(
            Number(credit.original_amount),
            Math.round((remaining + event.amount) * 100) / 100,
          ));
          return { ...event, credit_balance_after: remaining };
        });
    }).sort((left, right) => Number(right.occurred_at) - Number(left.occurred_at));

    const safePage = Math.max(page, 1);
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const start = (safePage - 1) * safeLimit;
    return {
      activity: activity.slice(start, start + safeLimit),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: activity.length,
        totalPages: Math.max(1, Math.ceil(activity.length / safeLimit)),
      },
    };
  }

  private async validateCouponForClaim(database: any, customerId: number, rawCode: string, channel: 'web' | 'mobile') {
    const code = this.normalizeCode(rawCode);
    const [customer, assignment] = await Promise.all([
      database.users.findUnique({ where: { id: customerId }, select: { id: true, isactive: true } }),
      database.promotion_assignments.findFirst({
        where: { voucher_code: { equals: code, mode: 'insensitive' } },
        include: this.include,
      }),
    ]);
    if (!customer?.isactive) throw new ValidationError('CUSTOMER_ACCOUNT_INACTIVE');
    if (!assignment) throw new ValidationError('COUPON_NOT_FOUND');
    if (
      assignment.promotion.visibility !== 'private' ||
      !isStandaloneCouponPromotion(assignment.promotion)
    ) throw new ValidationError('COUPON_NOT_WALLET_CREDIT');
    if (assignment.assignment_type !== 'customer' || assignment.customer_id !== customerId) {
      throw new ValidationError('COUPON_ASSIGNED_TO_ANOTHER_CUSTOMER');
    }
    if (assignment.promotion.status && assignment.promotion.status !== 'active') {
      const promotionStatus = assignment.promotion.status === 'revoked' ? 'REVOKED' : 'INACTIVE';
      throw new ValidationError(`COUPON_${promotionStatus}`);
    }
    if (
      assignment.delivery_channel !== 'all' &&
      assignment.delivery_channel !== channel &&
      assignment.delivery_channel !== 'print'
    ) throw new ValidationError('COUPON_NOT_AVAILABLE_ON_THIS_CHANNEL');

    const currentStatus = this.walletStatus(assignment, assignment.redemptions.length);
    if (currentStatus !== 'available') {
      throw new ValidationError(couponUseStateErrorCode(currentStatus));
    }

    const action = assignment.promotion.action as { type?: string; value?: number } | null;
    const amount = Number(action?.value || 0);
    if (action?.type !== 'FIXED_AMOUNT_OFF' || !Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError('COUPON_NOT_WALLET_CREDIT');
    }
    const minimumCondition = Array.isArray(assignment.promotion.conditions)
      ? (assignment.promotion.conditions as Array<{ attribute?: string; operator?: string; value?: number }>).find(
          (condition) => condition.attribute === 'cart.total_value' && condition.operator === 'GTE',
        )
      : undefined;
    const minimumCartAmount = Number(minimumCondition?.value || 0);
    if (!Number.isFinite(minimumCartAmount) || minimumCartAmount < 0) {
      throw new ValidationError('COUPON_HAS_INVALID_MINIMUM_CART_AMOUNT');
    }
    return { assignment, amount, minimumCartAmount };
  }

  async previewCoupon(customerId: number, rawCode: string, channel: 'web' | 'mobile') {
    return this.prisma.$transaction(async (database) => {
      const { assignment, amount, minimumCartAmount } = await this.validateCouponForClaim(database, customerId, rawCode, channel);
      return {
        id: assignment.id,
        code: assignment.voucher_code,
        name: assignment.promotion.name || 'Nivaana wallet coupon',
        amount,
        minimum_cart_amount: minimumCartAmount,
        valid_from: assignment.start_date,
        valid_until: assignment.end_date,
        delivery_channel: assignment.delivery_channel,
        status: 'available',
        personalized_for_current_customer: true,
      };
    });
  }

  async claimCoupon(customerId: number, rawCode: string, channel: 'web' | 'mobile') {
    return this.prisma.$transaction(async (database) => {
      const { assignment, amount, minimumCartAmount } = await this.validateCouponForClaim(database, customerId, rawCode, channel);
      const now = BigInt(Date.now());
      const locked = await database.promotion_assignments.updateMany({
        where: buildCouponClaimLockWhere(assignment.id, customerId, Number(now)),
        data: {
          claimed_by_customer_id: customerId,
          claimed_at: now,
          reserved_by_customer_id: null,
          reservation_reference: null,
          reservation_expires_at: null,
          modifieddate: now,
        },
      });
      if (locked.count !== 1) {
        // Another claim or direct-checkout reservation may have won after the
        // initial read. Re-read the assignment so the losing request receives
        // the correct stable state instead of an inaccurate duplicate message.
        const latest = await database.promotion_assignments.findUnique({
          where: { id: assignment.id },
          include: this.include,
        });
        if (latest) {
          const latestStatus = this.walletStatus(latest, latest.redemptions.length);
          if (latestStatus !== 'available') {
            throw new ValidationError(couponUseStateErrorCode(latestStatus));
          }
        }
        throw new ValidationError('COUPON_ALREADY_CLAIMED');
      }

      await database.wallet_credits.create({
        data: {
          customer_id: customerId,
          assignment_id: assignment.id,
          source_type: 'coupon',
          original_amount: new Prisma.Decimal(amount),
          remaining_amount: new Prisma.Decimal(amount),
          minimum_cart_amount: new Prisma.Decimal(minimumCartAmount),
          status: 'active',
          expires_at: assignment.end_date,
          createddate: now,
          modifieddate: now,
        },
      });

      const saved = await database.promotion_assignments.findUniqueOrThrow({
        where: { id: assignment.id },
        include: this.include,
      });
      return this.formatCoupon(saved);
    });
  }

  async createQuickCoupon(input: CreateQuickCouponInput) {
    const result = await this.prisma.$transaction(async (database) => {
      let customerIds: number[] = [];
      if (input.assignment_type === 'customer') {
        const customer = await database.users.findUnique({ where: { id: input.customer_id! }, select: { id: true } });
        if (!customer) throw new Error('Customer not found');
        customerIds = [customer.id];
      } else {
        const group = await database.coupon_groups.findFirst({
          where: { id: input.coupon_group_id!, status: 'active' },
          include: { members: { where: { status: 'active' }, select: { customer_id: true } } },
        });
        if (!group) throw new Error('Coupon group not found or inactive');
        customerIds = [...new Set(group.members.map((member: { customer_id: number }) => member.customer_id))];
        if (customerIds.length === 0) throw new Error('Coupon group has no active customers');
      }

      const now = BigInt(Date.now());
      const startDate = this.toUnixSeconds(input.start_date);
      const endDate = this.toUnixSeconds(input.end_date);
      const created = [];

      for (const customerId of customerIds) {
        let code: string;
        if (input.voucher_code) {
          code = this.normalizeCode(input.voucher_code);
          if (code.length < 4) throw new Error('Coupon code must contain at least 4 valid characters');
          await this.ensureCodeAvailable(database, code);
        } else {
          code = await this.generateCode(database);
        }
        const promotion = await database.promotions.create({
          data: {
            name: input.name || `Wallet coupon ${code}`,
            description: `${STANDALONE_COUPON_DESCRIPTION_PREFIX}${code}`,
            type: 'FIXED_AMOUNT_OFF_CART',
            code: null,
            auto_apply: false,
            start_date: startDate,
            end_date: endDate,
            status: 'active',
            visibility: 'private',
            applicable_channel: 'all',
            application_mode: 'code_entry',
            max_redemptions: 1,
            per_user_limit: 1,
            stackable: STANDALONE_COUPON_STACKABLE,
            conditions: input.minimum_cart_amount
              ? [{ attribute: 'cart.total_value', operator: 'GTE', value: input.minimum_cart_amount }]
              : [],
            action: { type: 'FIXED_AMOUNT_OFF', value: input.discount_value },
            createddate: now,
            modifieddate: now,
          },
        });
        const assignment = await database.promotion_assignments.create({
          data: {
            promotion_id: promotion.id,
            assignment_type: 'customer',
            customer_id: customerId,
            source_coupon_group_id: input.assignment_type === 'coupon_group' ? input.coupon_group_id! : null,
            voucher_code: code,
            usage_limit: 1,
            start_date: startDate,
            end_date: endDate,
            status: 'active',
            delivery_channel: STANDALONE_COUPON_DELIVERY_CHANNEL,
            dispatched_order_id: input.dispatched_order_id?.trim() || null,
            createddate: now,
            modifieddate: now,
          },
          include: this.include,
        });
        created.push(this.formatCoupon(assignment));
      }
      return { coupons: created, issued_count: created.length };
    });

    for (const coupon of result.coupons) {
      if (!coupon.customer?.id) continue;
      customerEmailNotificationService.queuePromotionVoucher({
        customerIds: [coupon.customer.id],
        promotionName: coupon.promotion?.name || 'Nivaana voucher',
        voucherCode: coupon.code,
        startDate: coupon.start_date,
        endDate: coupon.end_date,
        usageLimit: coupon.usage_limit,
      });
    }

    return result;
  }

  async updateQuickCoupon(assignmentId: number, input: UpdateQuickCouponInput) {
    return this.prisma.$transaction(async (database) => {
      const existing = await database.promotion_assignments.findUnique({ where: { id: assignmentId }, include: this.include });
      if (!existing) throw new Error('Coupon not found');
      if (
        existing.promotion.visibility !== 'private' ||
        !isStandaloneCouponPromotion(existing.promotion)
      ) throw new Error('Only standalone coupons can be edited from the coupon wallet');
      if (existing.claimed_at || existing.wallet_credit || existing.redemptions.length > 0) {
        throw new Error('Claimed or used coupons cannot be edited');
      }
      if (existing.status === 'revoked' && input.status !== 'revoked') {
        throw new Error('Revoked coupons cannot be reactivated');
      }
      const customer = await database.users.findUnique({ where: { id: input.customer_id! }, select: { id: true } });
      if (!customer) throw new Error('Customer not found');

      const now = BigInt(Date.now());
      const startDate = this.toUnixSeconds(input.start_date || undefined);
      const endDate = this.toUnixSeconds(input.end_date || undefined);
      await database.promotions.update({
        where: { id: existing.promotion_id },
        data: {
          name: input.name,
          type: 'FIXED_AMOUNT_OFF_CART',
          start_date: startDate,
          end_date: endDate,
          status: input.status,
          applicable_channel: 'all',
          stackable: STANDALONE_COUPON_STACKABLE,
          conditions: input.minimum_cart_amount
            ? [{ attribute: 'cart.total_value', operator: 'GTE', value: input.minimum_cart_amount }]
            : [],
          action: { type: 'FIXED_AMOUNT_OFF', value: input.discount_value },
          modifieddate: now,
        },
      });
      const updated = await database.promotion_assignments.update({
        where: { id: assignmentId },
        data: {
          assignment_type: 'customer',
          customer_id: input.customer_id!,
          customer_group_id: null,
          start_date: startDate,
          end_date: endDate,
          status: input.status,
          delivery_channel: STANDALONE_COUPON_DELIVERY_CHANNEL,
          dispatched_order_id: input.dispatched_order_id?.trim() || null,
          modifieddate: now,
        },
        include: this.include,
      });
      return this.formatCoupon(updated);
    });
  }

  // Prisma where-clause for an admin status; mirrors adminDisplayStatus
  private adminStatusWhere(status: AdminCouponStatus, now = Date.now()): any {
    const nowSeconds = BigInt(Math.floor(now / 1000));
    const live = { status: { in: ['active', 'expired'] } };
    const expired = { OR: [{ status: 'expired' }, { end_date: { lt: nowSeconds } }] };
    // Explicit (not NOT(expired)): NOT (end_date < now) is NULL in SQL when end_date is null
    const notExpired = { AND: [{ status: 'active' }, { OR: [{ end_date: null }, { end_date: { gte: nowSeconds } }] }] };
    const claimed = { OR: [
      { claimed_by_customer_id: { not: null } },
      { claimed_at: { not: null } },
      { wallet_credit: { isNot: null } },
    ] };
    const fullyUsed = { OR: [
      { wallet_credit: { is: { remaining_amount: { lte: 0 } } } },
      { AND: [{ wallet_credit: { is: null } }, { OR: [{ redemptions: { some: {} } }, { used_count: { gt: 0 } }] }] },
    ] };
    const fullBalance = { remaining_amount: { gte: this.prisma.wallet_credits.fields.original_amount } };

    switch (status) {
      case 'cancelled':
        return { status: 'revoked' };
      case 'paused':
        return { status: { notIn: ['active', 'expired', 'revoked'] } };
      case 'fully_used':
        return { AND: [live, fullyUsed] };
      case 'expired':
        return { AND: [live, { NOT: fullyUsed }, expired] };
      case 'added_to_wallet':
        return { AND: [notExpired, { NOT: fullyUsed }, claimed,
          { OR: [{ wallet_credit: { is: null } }, { wallet_credit: { is: fullBalance } }] }] };
      case 'partly_used':
        return { AND: [notExpired, { NOT: fullyUsed },
          { wallet_credit: { isNot: null } }, { NOT: { wallet_credit: { is: fullBalance } } }] };
      case 'not_used':
        return { AND: [notExpired, { NOT: fullyUsed }, { NOT: claimed }] };
    }
  }

  async listAdminCoupons(input: CouponWalletListInput) {
    const skip = (input.page - 1) * input.limit;
    const conditions: any[] = [];
    const standalonePromotionFilter = {
      visibility: 'private',
      description: { startsWith: STANDALONE_COUPON_DESCRIPTION_PREFIX },
    };
    if (input.scope === 'standalone') conditions.push({ promotion: { is: standalonePromotionFilter } });
    else if (input.scope === 'promotion') conditions.push({ NOT: { promotion: { is: standalonePromotionFilter } } });
    if (input.ownership_mode) conditions.push({ assignment_type: input.ownership_mode });
    if (input.source === 'coupon_group') conditions.push({ source_coupon_group_id: { not: null } });
    else if (input.source === 'customer') conditions.push({ source_coupon_group_id: null });
    if (input.customer_id) conditions.push({ OR: [{ customer_id: input.customer_id }, { claimed_by_customer_id: input.customer_id }] });
    if (input.search) {
      conditions.push({ OR: [
        { voucher_code: { contains: input.search, mode: 'insensitive' } },
        { promotion: { name: { contains: input.search, mode: 'insensitive' } } },
        { customer: { useremail: { contains: input.search, mode: 'insensitive' } } },
        { claimed_customer: { useremail: { contains: input.search, mode: 'insensitive' } } },
      ] });
    }
    const now = Date.now();
    const baseWhere = { AND: [...conditions] };
    const where = input.status
      ? { AND: [...conditions, this.adminStatusWhere(input.status, now)] }
      : baseWhere;
    const [rows, total, statusCountValues] = await Promise.all([
      this.prisma.promotion_assignments.findMany({ where, include: this.include, orderBy: { id: 'desc' }, skip, take: input.limit }),
      this.prisma.promotion_assignments.count({ where }),
      Promise.all(ADMIN_COUPON_STATUSES.map((status) =>
        this.prisma.promotion_assignments.count({ where: { AND: [...conditions, this.adminStatusWhere(status, now)] } }))),
    ]);
    const statusCounts = Object.fromEntries(
      ADMIN_COUPON_STATUSES.map((status, index) => [status, statusCountValues[index]]),
    ) as Record<AdminCouponStatus, number>;
    return {
      coupons: rows.map((row) => this.formatCoupon(row)),
      pagination: { page: input.page, limit: input.limit, total, totalPages: Math.max(1, Math.ceil(total / input.limit)) },
      status_counts: { all: statusCountValues.reduce((sum, count) => sum + count, 0), ...statusCounts },
    };
  }

  // Admin timeline for one coupon: issue, wallet credit, order usage/reversals, expiry, with running balance
  async getAdminCouponHistory(assignmentId: number) {
    const assignment = await this.prisma.promotion_assignments.findUnique({
      where: { id: assignmentId },
      include: {
        ...this.include,
        wallet_credit: {
          select: {
            id: true,
            original_amount: true,
            remaining_amount: true,
            minimum_cart_amount: true,
            status: true,
            expires_at: true,
            createddate: true,
            reservations: {
              select: { id: true, amount: true, status: true, order_id: true, createddate: true, consumed_at: true, reversed_at: true, expires_at: true },
              orderBy: { id: 'asc' },
            },
          },
        },
      },
    });
    if (!assignment) throw new NotFoundError('Coupon not found');

    const credit = assignment.wallet_credit;
    // Refunds (return / cancellation) put value back on the same credit via refund wallet allocations
    const allocations = credit
      ? await this.prisma.refundWalletAllocation.findMany({
          where: { sourceCreditId: credit.id, allocationType: 'coupon_restore', status: { in: ['completed', 'skipped_expired'] } },
          orderBy: { id: 'asc' },
        })
      : [];
    const operations = allocations.length
      ? await this.prisma.refundOperation.findMany({
          where: { id: { in: [...new Set(allocations.map((allocation) => allocation.refundOperationId))] } },
          select: { id: true, operationNumber: true, triggerType: true, orderId: true },
        })
      : [];
    const operationById = new Map(operations.map((operation) => [operation.id, operation]));
    const redemptionOrderId = (value: string | null) => (value && /^\d+$/.test(value) ? Number(value) : null);
    const orderIds = [...new Set([
      ...(credit?.reservations || []).map((reservation) => reservation.order_id),
      ...operations.map((operation) => operation.orderId),
      ...(assignment.redemptions || []).map((redemption) => redemptionOrderId(redemption.order_id)),
    ].filter((id): id is number => typeof id === 'number'))];
    const orders = orderIds.length
      ? await this.prisma.orders.findMany({ where: { id: { in: orderIds } }, select: { id: true, orderid: true, orderstatus: true } })
      : [];
    const orderById = new Map(orders.map((order) => [order.id, order]));
    const orderRef = (id: number | null) => {
      const order = id ? orderById.get(id) : undefined;
      return { order_id: id, order_number: order?.orderid || null, order_status: order?.orderstatus || null };
    };
    // Timestamps are stored in seconds (coupon dates) or milliseconds (wallet rows); normalise to ms
    const toMs = (value: bigint | number | null | undefined) => {
      if (value === null || value === undefined) return null;
      const numeric = Number(value);
      return numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    };
    const nowMs = Date.now();

    type HistoryEvent = {
      id: string;
      type: 'issued' | 'added_to_wallet' | 'used_in_order' | 'order_reversal' | 'refund_restored' | 'refund_skipped_expired' | 'credit_expired' | 'promotion_redemption';
      occurred_at: number | null;
      amount: number | null;
      balance_after: number | null;
      order_id: number | null;
      order_number: string | null;
      order_status: string | null;
      reference?: string | null;
    };
    const noOrder = { order_id: null, order_number: null, order_status: null };
    const events: HistoryEvent[] = [{
      id: `issued-${assignment.id}`,
      type: 'issued',
      occurred_at: toMs(assignment.createddate),
      amount: null,
      balance_after: null,
      ...noOrder,
    }];

    let used = 0;
    let held = 0;
    if (credit) {
      const original = Number(credit.original_amount);
      const walletEvents: HistoryEvent[] = [{
        id: `credit-${credit.id}`,
        type: 'added_to_wallet',
        occurred_at: toMs(assignment.claimed_at) ?? toMs(credit.createddate),
        amount: original,
        balance_after: null,
        ...noOrder,
      }];
      // A completed cancellation refund also marks its reservation reversed; count it once (as the refund)
      const refundedReservationIds = new Set(allocations
        .filter((allocation) => allocation.status === 'completed' && allocation.reservationId
          && operationById.get(allocation.refundOperationId)?.triggerType === 'cancellation')
        .map((allocation) => allocation.reservationId));
      for (const reservation of credit.reservations) {
        const amount = Number(reservation.amount);
        if (reservation.status === 'reserved' && toMs(reservation.expires_at)! > nowMs) held += amount;
        if (!['consumed', 'reversed'].includes(reservation.status)) continue;
        walletEvents.push({
          id: `used-${reservation.id}`,
          type: 'used_in_order',
          occurred_at: toMs(reservation.consumed_at ?? reservation.createddate),
          amount: -amount,
          balance_after: null,
          ...orderRef(reservation.order_id),
        });
        if (reservation.status === 'reversed' && !refundedReservationIds.has(reservation.id)) {
          walletEvents.push({
            id: `reversal-${reservation.id}`,
            type: 'order_reversal',
            occurred_at: toMs(reservation.reversed_at ?? reservation.createddate),
            amount,
            balance_after: null,
            ...orderRef(reservation.order_id),
          });
        } else if (reservation.status === 'consumed') {
          used += amount;
        }
      }
      for (const allocation of allocations) {
        const operation = operationById.get(allocation.refundOperationId);
        const completed = allocation.status === 'completed';
        walletEvents.push({
          id: `refund-${allocation.id}`,
          type: completed ? 'refund_restored' : 'refund_skipped_expired',
          occurred_at: toMs(allocation.modifieddate),
          amount: completed ? Number(allocation.amount) : null,
          balance_after: null,
          ...orderRef(operation?.orderId ?? null),
          reference: operation ? `${operation.triggerType === 'cancellation' ? 'Cancellation' : 'Return'} refund ${operation.operationNumber}` : null,
        });
      }
      walletEvents.sort((left, right) => (left.occurred_at ?? 0) - (right.occurred_at ?? 0));
      let balance = 0;
      for (const event of walletEvents) {
        if (event.amount === null) continue;
        balance = Math.max(0, Math.min(original, Math.round((balance + (event.amount ?? 0)) * 100) / 100));
        event.balance_after = balance;
      }
      const expiresAt = toMs(credit.expires_at);
      if (expiresAt !== null && expiresAt < nowMs && balance > 0) {
        walletEvents.push({
          id: `expired-${credit.id}`,
          type: 'credit_expired',
          occurred_at: expiresAt,
          amount: -balance,
          balance_after: 0,
          ...noOrder,
        });
      }
      events.push(...walletEvents);
    }

    for (const redemption of assignment.redemptions || []) {
      events.push({
        id: `redemption-${redemption.id}`,
        type: 'promotion_redemption',
        occurred_at: toMs(redemption.redeemed_at),
        amount: redemption.discount_amount === null ? null : -Number(redemption.discount_amount),
        balance_after: null,
        ...(redemptionOrderId(redemption.order_id) !== null
          ? orderRef(redemptionOrderId(redemption.order_id))
          : { order_id: null, order_number: redemption.order_id || null, order_status: null }),
      });
    }

    events.sort((left, right) => (left.occurred_at ?? 0) - (right.occurred_at ?? 0));
    const refunded = allocations
      .filter((allocation) => allocation.status === 'completed')
      .reduce((sum, allocation) => sum + Number(allocation.amount), 0);
    const creditExpired = Boolean(credit?.expires_at && toMs(credit.expires_at)! < nowMs);
    return {
      coupon: this.formatCoupon(assignment),
      summary: credit
        ? {
            credited: Number(credit.original_amount),
            used: Math.round(used * 100) / 100,
            refunded: Math.round(refunded * 100) / 100,
            balance: creditExpired ? 0 : Number(credit.remaining_amount),
            held: Math.round(held * 100) / 100,
            expired_amount: creditExpired ? Number(credit.remaining_amount) : 0,
            credit_status: creditExpired ? 'expired' : credit.status,
            expires_at: credit.expires_at,
            minimum_cart_amount: Number(credit.minimum_cart_amount),
          }
        : null,
      events,
    };
  }
}
