import { PrismaClient } from '@prisma/client';
import type { CouponWalletListInput } from '../schemas/coupon-wallet.schema.js';

export class CouponWalletService {
  private prisma = new PrismaClient();

  private walletStatus(assignment: any, redemptionCount: number) {
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    const nowMs = BigInt(Date.now());
    if (assignment.status !== 'active') return assignment.status === 'expired' ? 'expired' : 'revoked';
    if (assignment.end_date && assignment.end_date < nowSeconds) return 'expired';
    if (assignment.start_date && assignment.start_date > nowSeconds) return 'scheduled';
    if (assignment.usage_limit && redemptionCount >= assignment.usage_limit) return 'redeemed';
    if (assignment.reservation_expires_at && assignment.reservation_expires_at > nowMs) return 'reserved';
    return 'available';
  }

  private formatCoupon(assignment: any) {
    const redemptions = assignment.redemptions || [];
    const status = this.walletStatus(assignment, redemptions.length);
    return {
      id: assignment.id,
      code: assignment.voucher_code,
      ownership_mode: assignment.assignment_type,
      status,
      usage_limit: assignment.usage_limit,
      used_count: redemptions.length,
      start_date: assignment.start_date,
      end_date: assignment.end_date,
      claimed_at: assignment.claimed_at,
      dispatched_order_id: assignment.dispatched_order_id,
      reservation_expires_at: assignment.reservation_expires_at,
      promotion: assignment.promotion,
      customer: assignment.customer,
      claimed_customer: assignment.claimed_customer,
      customer_group: assignment.customer_group,
      last_redemption: redemptions[0] || null,
    };
  }

  private include = {
    promotion: { select: { id: true, name: true, description: true, type: true, action: true, conditions: true, applicable_channel: true } },
    customer: { select: { id: true, firstname: true, lastname: true, useremail: true, usermobilenumber: true } },
    claimed_customer: { select: { id: true, firstname: true, lastname: true, useremail: true, usermobilenumber: true } },
    customer_group: { select: { id: true, name: true, code: true } },
    redemptions: { select: { id: true, order_id: true, user_id: true, discount_amount: true, redeemed_at: true }, orderBy: { redeemed_at: 'desc' as const } },
  };

  async getCustomerWallet(customerId: number) {
    const assignments = await this.prisma.promotion_assignments.findMany({
      where: {
        OR: [
          { assignment_type: 'customer', customer_id: customerId },
          { assignment_type: 'anyone', claimed_by_customer_id: customerId },
          {
            assignment_type: 'customer_group',
            customer_group: { members: { some: { customer_id: customerId, status: 'active' } } },
          },
        ],
      },
      include: this.include,
      orderBy: { id: 'desc' },
    });
    return assignments.map((assignment) => this.formatCoupon(assignment));
  }

  async claimCoupon(customerId: number, rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    return this.prisma.$transaction(async (database) => {
      const assignment = await database.promotion_assignments.findFirst({
        where: { voucher_code: { equals: code, mode: 'insensitive' } },
        include: this.include,
      });
      if (!assignment) throw new Error('COUPON_NOT_FOUND');

      const currentStatus = this.walletStatus(assignment, assignment.redemptions.length);
      if (currentStatus !== 'available' && currentStatus !== 'scheduled') {
        throw new Error(`COUPON_${currentStatus.toUpperCase()}`);
      }

      if (assignment.assignment_type === 'customer' && assignment.customer_id !== customerId) {
        throw new Error('COUPON_ASSIGNED_TO_ANOTHER_CUSTOMER');
      }
      if (assignment.assignment_type === 'customer_group') {
        const membership = await database.customer_group_members.findFirst({
          where: { customer_group_id: assignment.customer_group_id!, customer_id: customerId, status: 'active' },
          select: { id: true },
        });
        if (!membership) throw new Error('COUPON_ASSIGNED_TO_ANOTHER_CUSTOMER');
      }
      if (assignment.assignment_type === 'anyone') {
        if (assignment.claimed_by_customer_id && assignment.claimed_by_customer_id !== customerId) {
          throw new Error('COUPON_ALREADY_CLAIMED');
        }
        if (!assignment.claimed_by_customer_id) {
          const updated = await database.promotion_assignments.updateMany({
            where: { id: assignment.id, claimed_by_customer_id: null },
            data: { claimed_by_customer_id: customerId, claimed_at: BigInt(Date.now()), modifieddate: BigInt(Date.now()) },
          });
          if (updated.count !== 1) throw new Error('COUPON_ALREADY_CLAIMED');
        }
      }

      const saved = await database.promotion_assignments.findUniqueOrThrow({
        where: { id: assignment.id },
        include: this.include,
      });
      return this.formatCoupon(saved);
    });
  }

  async listAdminCoupons(input: CouponWalletListInput) {
    const skip = (input.page - 1) * input.limit;
    const where: any = {};
    if (input.ownership_mode) where.assignment_type = input.ownership_mode;
    if (input.customer_id) {
      where.OR = [
        { customer_id: input.customer_id },
        { claimed_by_customer_id: input.customer_id },
      ];
    }
    if (input.search) {
      const searchConditions = [
        { voucher_code: { contains: input.search, mode: 'insensitive' } },
        { promotion: { name: { contains: input.search, mode: 'insensitive' } } },
        { customer: { useremail: { contains: input.search, mode: 'insensitive' } } },
        { claimed_customer: { useremail: { contains: input.search, mode: 'insensitive' } } },
      ];
      where.AND = [{ OR: searchConditions }];
    }

    const [rows, total] = await Promise.all([
      this.prisma.promotion_assignments.findMany({ where, include: this.include, orderBy: { id: 'desc' }, skip, take: input.limit }),
      this.prisma.promotion_assignments.count({ where }),
    ]);
    const formatted = rows.map((row) => this.formatCoupon(row));
    const filtered = input.status ? formatted.filter((coupon) => coupon.status === input.status) : formatted;
    return {
      coupons: filtered,
      pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) },
    };
  }
}
