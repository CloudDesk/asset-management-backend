import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import type {
  CreateCustomerGroupInput,
  CreatePromotionAssignmentInput,
  UpdateCustomerGroupInput,
  UpdatePromotionAssignmentInput
} from '../schemas/promotion-assignment.schema.js';

export class PromotionAssignmentService {
  private prisma = new PrismaClient();

  private toUnixSeconds(value?: string | null): bigint | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return BigInt(Math.floor(new Date(value).getTime() / 1000));
  }

  private normalizeCode(value: string): string {
    return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  }

  private async ensureCodeAvailable(code: string, assignmentId?: number): Promise<void> {
    const [promotion, assignment] = await Promise.all([
      this.prisma.promotions.findFirst({ where: { code: { equals: code, mode: 'insensitive' } }, select: { id: true } }),
      this.prisma.promotion_assignments.findFirst({
        where: {
          voucher_code: { equals: code, mode: 'insensitive' },
          ...(assignmentId ? { id: { not: assignmentId } } : {})
        },
        select: { id: true }
      })
    ]);
    if (promotion || assignment) throw new Error('Voucher code already exists');
  }

  private async generateVoucherCode(prefix: string): Promise<string> {
    const normalizedPrefix = this.normalizeCode(prefix).slice(0, 30) || 'VOUCHER';
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix = randomBytes(4).toString('hex').toUpperCase();
      const code = `${normalizedPrefix}-${suffix}`;
      const existing = await this.prisma.promotion_assignments.findUnique({
        where: { voucher_code: code },
        select: { id: true }
      });
      if (!existing) {
        const publicCode = await this.prisma.promotions.findFirst({
          where: { code: { equals: code, mode: 'insensitive' } },
          select: { id: true }
        });
        if (!publicCode) return code;
      }
    }
    throw new Error('Unable to generate a unique voucher code');
  }

  async createVoucher(promotionId: number, input: CreatePromotionAssignmentInput) {
    const promotion = await this.prisma.promotions.findUnique({
      where: { id: promotionId },
      select: { id: true, name: true, code: true, start_date: true, end_date: true }
    });
    if (!promotion) throw new Error('Promotion not found');

    if (input.assignment_type === 'customer') {
      const customer = await this.prisma.users.findUnique({ where: { id: input.customer_id! } });
      if (!customer) throw new Error('Customer not found');
    } else {
      const group = await this.prisma.customer_groups.findUnique({ where: { id: input.customer_group_id! } });
      if (!group) throw new Error('Customer group not found');
    }

    const requestedCode = input.voucher_code ? this.normalizeCode(input.voucher_code) : null;
    if (requestedCode && requestedCode.length < 4) throw new Error('Voucher code must contain at least 4 valid characters');
    if (requestedCode) await this.ensureCodeAvailable(requestedCode);

    const voucherCode = requestedCode || await this.generateVoucherCode(input.prefix || promotion.code || promotion.name || 'VOUCHER');
    const now = BigInt(Date.now());

    const assignmentData = {
        promotion_id: promotionId,
        assignment_type: input.assignment_type,
        customer_id: input.assignment_type === 'customer' ? input.customer_id! : null,
        customer_group_id: input.assignment_type === 'customer_group' ? input.customer_group_id! : null,
        voucher_code: voucherCode,
        usage_limit: input.usage_limit ?? null,
        start_date: this.toUnixSeconds(input.start_date) ?? promotion.start_date,
        end_date: this.toUnixSeconds(input.end_date) ?? promotion.end_date,
        status: 'active',
        createddate: now,
        modifieddate: now
    };

    return this.prisma.promotion_assignments.create({
      data: assignmentData,
      include: {
        customer: { select: { id: true, firstname: true, lastname: true, useremail: true } },
        customer_group: { select: { id: true, name: true, code: true } }
      }
    });
  }

  async listVouchers(promotionId: number) {
    return this.prisma.promotion_assignments.findMany({
      where: { promotion_id: promotionId },
      include: {
        customer: { select: { id: true, firstname: true, lastname: true, useremail: true } },
        customer_group: { select: { id: true, name: true, code: true } }
      },
      orderBy: { id: 'desc' }
    });
  }

  async updateVoucher(assignmentId: number, input: UpdatePromotionAssignmentInput) {
    const existing = await this.prisma.promotion_assignments.findUnique({
      where: { id: assignmentId }
    });
    if (!existing) throw new Error('Promotion voucher not found');

    const nextType = input.assignment_type || existing.assignment_type;
    const nextCustomerId =
      nextType === 'customer'
        ? input.customer_id ?? existing.customer_id
        : null;
    const nextGroupId =
      nextType === 'customer_group'
        ? input.customer_group_id ?? existing.customer_group_id
        : null;
    if (nextType === 'customer' && !nextCustomerId) throw new Error('Customer is required');
    if (nextType === 'customer_group' && !nextGroupId) throw new Error('Customer group is required');

    const isTargetOrCodeChange =
      nextType !== existing.assignment_type ||
      nextCustomerId !== existing.customer_id ||
      nextGroupId !== existing.customer_group_id ||
      (input.voucher_code !== undefined &&
        this.normalizeCode(input.voucher_code) !== existing.voucher_code);
    if (isTargetOrCodeChange) {
      const redemptionCount = await this.prisma.promotion_redemptions.count({
        where: { assignment_id: assignmentId }
      });
      if (redemptionCount > 0) {
        throw new Error('Voucher target or code cannot be changed after redemption');
      }
    }

    if (nextCustomerId) {
      const customer = await this.prisma.users.findUnique({
        where: { id: nextCustomerId },
        select: { id: true }
      });
      if (!customer) throw new Error('Customer not found');
    }
    if (nextGroupId) {
      const group = await this.prisma.customer_groups.findUnique({
        where: { id: nextGroupId },
        select: { id: true }
      });
      if (!group) throw new Error('Customer group not found');
    }

    const data: any = { modifieddate: BigInt(Date.now()) };
    if (input.status !== undefined) data.status = input.status;
    data.assignment_type = nextType;
    data.customer_id = nextCustomerId;
    data.customer_group_id = nextGroupId;
    if (input.voucher_code !== undefined) {
      const code = this.normalizeCode(input.voucher_code);
      await this.ensureCodeAvailable(code, assignmentId);
      data.voucher_code = code;
    }
    if (input.usage_limit !== undefined) data.usage_limit = input.usage_limit;
    if (input.start_date !== undefined) data.start_date = this.toUnixSeconds(input.start_date);
    if (input.end_date !== undefined) data.end_date = this.toUnixSeconds(input.end_date);

    return this.prisma.promotion_assignments.update({
      where: { id: assignmentId },
      data,
      include: {
        customer: { select: { id: true, firstname: true, lastname: true, useremail: true } },
        customer_group: { select: { id: true, name: true, code: true } }
      }
    });
  }

  async createGroup(input: CreateCustomerGroupInput) {
    const code = this.normalizeCode(input.code);
    return this.prisma.customer_groups.create({
      data: {
        name: input.name,
        code,
        description: input.description ?? null,
        status: 'active',
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      }
    });
  }

  async listGroups() {
    return this.prisma.customer_groups.findMany({
      include: { _count: { select: { members: true, assignments: true } } },
      orderBy: { id: 'desc' }
    });
  }

  async updateGroup(groupId: number, input: UpdateCustomerGroupInput) {
    const data: any = { modifieddate: BigInt(Date.now()) };
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.status !== undefined) data.status = input.status;
    return this.prisma.customer_groups.update({
      where: { id: groupId },
      data
    });
  }

  async addGroupMembers(groupId: number, customerIds: number[]) {
    const group = await this.prisma.customer_groups.findUnique({ where: { id: groupId } });
    if (!group) throw new Error('Customer group not found');

    const customers = await this.prisma.users.findMany({
      where: { id: { in: customerIds } },
      select: { id: true }
    });
    if (customers.length !== new Set(customerIds).size) throw new Error('One or more customers were not found');

    const now = BigInt(Date.now());
    await this.prisma.customer_group_members.createMany({
      data: customers.map(({ id }) => ({
        customer_group_id: groupId,
        customer_id: id,
        status: 'active',
        createddate: now,
        modifieddate: now
      })),
      skipDuplicates: true
    });

    return this.getGroup(groupId);
  }

  async removeGroupMember(groupId: number, customerId: number) {
    await this.prisma.customer_group_members.delete({
      where: {
        customer_group_id_customer_id: {
          customer_group_id: groupId,
          customer_id: customerId
        }
      }
    });
  }

  async getGroup(groupId: number) {
    const group = await this.prisma.customer_groups.findUnique({
      where: { id: groupId },
      include: {
        members: {
          include: {
            customer: { select: { id: true, firstname: true, lastname: true, useremail: true } }
          }
        }
      }
    });
    if (!group) throw new Error('Customer group not found');
    return group;
  }
}
