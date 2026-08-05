import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import type { CreateCouponGroupInput, UpdateCouponGroupInput } from '../schemas/coupon-group.schema.js';
import { NotFoundError, ValidationError } from '../utils/errorHandler.js';

export class CouponGroupService {
  private prisma = new PrismaClient();

  private normalizeCode(value: string) {
    return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
  }

  private async uniqueCode(value: string) {
    const base = this.normalizeCode(value) || 'COUPON-GROUP';
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base.slice(0, 92)}-${randomBytes(3).toString('hex').toUpperCase()}`;
      const exists = await this.prisma.coupon_groups.findUnique({ where: { code: candidate }, select: { id: true } });
      if (!exists) return candidate;
    }
    throw new ValidationError('Unable to generate a unique coupon group code');
  }

  async create(input: CreateCouponGroupInput) {
    const now = BigInt(Date.now());
    const code = await this.uniqueCode(input.code || input.name);
    return this.prisma.coupon_groups.create({
      data: { name: input.name, code, description: input.description || null, status: 'active', createddate: now, modifieddate: now },
      include: { _count: { select: { members: { where: { status: 'active' } } } } },
    });
  }

  async list() {
    return this.prisma.coupon_groups.findMany({
      include: { _count: { select: { members: { where: { status: 'active' } }, issued_assignments: true } } },
      orderBy: [{ createddate: 'desc' }, { id: 'desc' }],
    });
  }

  async listCustomerCandidates(groupId: number, search = '', limit = 10) {
    const group = await this.prisma.coupon_groups.findUnique({ where: { id: groupId }, select: { id: true } });
    if (!group) throw new NotFoundError('Coupon group not found');
    const normalizedSearch = search.trim();
    const numericSearch = /^\d+$/.test(normalizedSearch) ? BigInt(normalizedSearch) : null;
    return this.prisma.users.findMany({
      where: {
        isactive: true,
        coupon_group_members: { none: { coupon_group_id: groupId, status: 'active' } },
        ...(normalizedSearch ? {
          OR: [
            { firstname: { contains: normalizedSearch, mode: 'insensitive' as const } },
            { lastname: { contains: normalizedSearch, mode: 'insensitive' as const } },
            { useremail: { contains: normalizedSearch, mode: 'insensitive' as const } },
            ...(numericSearch ? [{ id: Number(normalizedSearch) || -1 }, { usermobilenumber: numericSearch }] : []),
          ],
        } : {}),
      },
      select: { id: true, firstname: true, lastname: true, useremail: true, usermobilenumber: true, createddate: true },
      orderBy: [{ createddate: 'desc' }, { id: 'desc' }],
      take: Math.min(Math.max(limit, 1), 10),
    });
  }

  async get(groupId: number) {
    const group = await this.prisma.coupon_groups.findUnique({
      where: { id: groupId },
      include: {
        members: {
          where: { status: 'active' },
          orderBy: { id: 'desc' },
          include: { customer: { select: { id: true, firstname: true, lastname: true, useremail: true, usermobilenumber: true, isactive: true } } },
        },
        _count: { select: { members: { where: { status: 'active' } }, issued_assignments: true } },
      },
    });
    if (!group) throw new NotFoundError('Coupon group not found');
    return group;
  }

  async update(groupId: number, input: UpdateCouponGroupInput) {
    const existing = await this.prisma.coupon_groups.findUnique({ where: { id: groupId }, select: { id: true } });
    if (!existing) throw new NotFoundError('Coupon group not found');
    return this.prisma.coupon_groups.update({
      where: { id: groupId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        modifieddate: BigInt(Date.now()),
      },
      include: { _count: { select: { members: { where: { status: 'active' } }, issued_assignments: true } } },
    });
  }

  async addMembers(groupId: number, customerIds: number[]) {
    const uniqueIds = [...new Set(customerIds)];
    return this.prisma.$transaction(async (database) => {
      const group = await database.coupon_groups.findUnique({ where: { id: groupId }, select: { id: true, status: true } });
      if (!group) throw new NotFoundError('Coupon group not found');
      if (group.status !== 'active') throw new ValidationError('Inactive coupon groups cannot receive members');
      const customers = await database.users.findMany({ where: { id: { in: uniqueIds }, isactive: true }, select: { id: true } });
      if (customers.length !== uniqueIds.length) throw new ValidationError('One or more active customers were not found');
      const now = BigInt(Date.now());
      for (const customer of customers) {
        await database.coupon_group_members.upsert({
          where: { coupon_group_id_customer_id: { coupon_group_id: groupId, customer_id: customer.id } },
          create: { coupon_group_id: groupId, customer_id: customer.id, status: 'active', createddate: now, modifieddate: now },
          update: { status: 'active', modifieddate: now },
        });
      }
      return database.coupon_groups.findUniqueOrThrow({
        where: { id: groupId },
        include: {
          members: { where: { status: 'active' }, include: { customer: { select: { id: true, firstname: true, lastname: true, useremail: true, usermobilenumber: true, isactive: true } } } },
          _count: { select: { members: { where: { status: 'active' } }, issued_assignments: true } },
        },
      });
    });
  }

  async removeMember(groupId: number, customerId: number) {
    const result = await this.prisma.coupon_group_members.updateMany({
      where: { coupon_group_id: groupId, customer_id: customerId, status: 'active' },
      data: { status: 'inactive', modifieddate: BigInt(Date.now()) },
    });
    if (result.count !== 1) throw new NotFoundError('Active coupon group member not found');
  }

  async removeMembers(groupId: number, customerIds: number[]) {
    const uniqueIds = [...new Set(customerIds)];
    const group = await this.prisma.coupon_groups.findUnique({ where: { id: groupId }, select: { id: true } });
    if (!group) throw new NotFoundError('Coupon group not found');
    const result = await this.prisma.coupon_group_members.updateMany({
      where: { coupon_group_id: groupId, customer_id: { in: uniqueIds }, status: 'active' },
      data: { status: 'inactive', modifieddate: BigInt(Date.now()) },
    });
    if (result.count === 0) throw new NotFoundError('Active coupon group members not found');
    return this.get(groupId);
  }
}
