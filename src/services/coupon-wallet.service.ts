import { randomBytes } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import type { CouponWalletListInput, CreateQuickCouponInput, UpdateQuickCouponInput } from '../schemas/coupon-wallet.schema.js';
import { ValidationError } from '../utils/errorHandler.js';

const STANDALONE_DESCRIPTION_PREFIX = 'Private discount rule created for coupon ';

export const generatePersonalizedCouponCode = () => `NV-${randomBytes(6).toString('hex').toUpperCase()}`;

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
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    const nowMs = BigInt(Date.now());
    if (assignment.status === 'revoked') return 'revoked';
    if (assignment.status === 'inactive') return 'inactive';
    if (assignment.status === 'expired') return 'expired';
    if (assignment.status !== 'active') return 'inactive';
    if (assignment.end_date && assignment.end_date < nowSeconds) return 'expired';
    if (assignment.start_date && assignment.start_date > nowSeconds) return 'scheduled';
    if (assignment.claimed_at || assignment.wallet_credit) return 'claimed';
    if (assignment.usage_limit && redemptionCount >= assignment.usage_limit) return 'redeemed';
    if (assignment.reservation_expires_at && assignment.reservation_expires_at > nowMs) return 'reserved';
    return 'available';
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
    return {
      id: assignment.id,
      code: assignment.voucher_code,
      ownership_mode: assignment.assignment_type,
      status: this.walletStatus(assignment, redemptions.length),
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
      include: {
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
        promotion: { is: { visibility: 'private', description: { startsWith: STANDALONE_DESCRIPTION_PREFIX } } },
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
    const coupons = assignments.map((assignment) => this.formatCoupon(assignment));
    const availableCredits = coupons.filter((coupon) => {
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
      const events = credit.reservations.flatMap((reservation) => {
        const redemption = {
          id: `redemption-${reservation.id}`,
          type: 'order_redemption' as const,
          amount: -Number(reservation.amount),
          wallet_credit_id: credit.id,
          coupon_code: credit.assignment.voucher_code,
          coupon_name: credit.assignment.promotion.name || 'Nivaana wallet coupon',
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
          coupon_code: credit.assignment.voucher_code,
          coupon_name: credit.assignment.promotion.name || 'Nivaana wallet coupon',
          order_id: reservation.order_id,
          merchant_transaction_id: reservation.merchant_transaction_id,
          occurred_at: (reservation.reversed_at || reservation.createddate).toString(),
          credit_balance_after: 0,
        }];
      });
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
      !assignment.promotion.description?.startsWith(STANDALONE_DESCRIPTION_PREFIX)
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
    if (currentStatus !== 'available') throw new ValidationError(`COUPON_${currentStatus.toUpperCase()}`);
    if (assignment.claimed_by_customer_id || assignment.claimed_at || assignment.wallet_credit) {
      throw new ValidationError('COUPON_ALREADY_CLAIMED');
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
        where: {
          id: assignment.id,
          customer_id: customerId,
          claimed_by_customer_id: null,
          claimed_at: null,
          status: 'active',
        },
        data: { claimed_by_customer_id: customerId, claimed_at: now, modifieddate: now },
      });
      if (locked.count !== 1) throw new ValidationError('COUPON_ALREADY_CLAIMED');

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
    return this.prisma.$transaction(async (database) => {
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
            description: `${STANDALONE_DESCRIPTION_PREFIX}${code}`,
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
            stackable: input.stackable,
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
            delivery_channel: input.delivery_channel,
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
  }

  async updateQuickCoupon(assignmentId: number, input: UpdateQuickCouponInput) {
    return this.prisma.$transaction(async (database) => {
      const existing = await database.promotion_assignments.findUnique({ where: { id: assignmentId }, include: this.include });
      if (!existing) throw new Error('Coupon not found');
      if (
        existing.promotion.visibility !== 'private' ||
        !existing.promotion.description?.startsWith(STANDALONE_DESCRIPTION_PREFIX)
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
          stackable: input.stackable,
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
          delivery_channel: input.delivery_channel,
          dispatched_order_id: input.dispatched_order_id?.trim() || null,
          modifieddate: now,
        },
        include: this.include,
      });
      return this.formatCoupon(updated);
    });
  }

  async listAdminCoupons(input: CouponWalletListInput) {
    const skip = (input.page - 1) * input.limit;
    const where: any = {};
    const standalonePromotionFilter = {
      visibility: 'private',
      description: { startsWith: STANDALONE_DESCRIPTION_PREFIX },
    };
    if (input.scope === 'standalone') where.promotion = { is: standalonePromotionFilter };
    else if (input.scope === 'promotion') where.NOT = { promotion: { is: standalonePromotionFilter } };
    if (input.ownership_mode) where.assignment_type = input.ownership_mode;
    if (input.customer_id) where.OR = [{ customer_id: input.customer_id }, { claimed_by_customer_id: input.customer_id }];
    if (input.search) {
      where.AND = [{ OR: [
        { voucher_code: { contains: input.search, mode: 'insensitive' } },
        { promotion: { name: { contains: input.search, mode: 'insensitive' } } },
        { customer: { useremail: { contains: input.search, mode: 'insensitive' } } },
        { claimed_customer: { useremail: { contains: input.search, mode: 'insensitive' } } },
      ] }];
    }
    const [rows, total] = await Promise.all([
      this.prisma.promotion_assignments.findMany({ where, include: this.include, orderBy: { id: 'desc' }, skip, take: input.limit }),
      this.prisma.promotion_assignments.count({ where }),
    ]);
    const formatted = rows.map((row) => this.formatCoupon(row));
    const filtered = input.status ? formatted.filter((coupon) => coupon.status === input.status) : formatted;
    return {
      coupons: filtered,
      pagination: { page: input.page, limit: input.limit, total, totalPages: Math.max(1, Math.ceil(total / input.limit)) },
    };
  }
}
