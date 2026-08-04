import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { PromotionAssignmentService } from '../services/promotion-assignment.service.js';

type AssignmentRecord = {
  id: number;
  promotion_id: number;
  assignment_type: string;
  customer_id: number | null;
  customer_group_id: number | null;
  voucher_code: string;
  usage_limit: number | null;
  used_count: number;
  start_date: bigint | null;
  end_date: bigint | null;
  status: string;
  promotion: { name: string; code: string | null; per_user_limit: number | null };
};

const makeService = (customerUsage: Record<number, number>) => {
  const original: AssignmentRecord = {
    id: 9,
    promotion_id: 13,
    assignment_type: 'customer',
    customer_id: 54,
    customer_group_id: null,
    voucher_code: 'PROMO-OLD',
    usage_limit: 2,
    used_count: 1,
    start_date: 1n,
    end_date: 2n,
    status: 'active',
    promotion: { name: 'Promotion', code: null, per_user_limit: 2 },
  };
  const updates: Array<Record<string, unknown>> = [];
  const creates: Array<Record<string, unknown>> = [];

  const database = {
    promotion_assignments: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) =>
        'id' in where ? original : null,
      findFirst: async () => null,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { ...original, ...data };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        creates.push(data);
        return { id: 10, used_count: 0, ...data };
      },
    },
    promotions: { findFirst: async () => null },
    users: { findUnique: async () => ({ id: 55 }) },
    customer_groups: { findUnique: async () => null },
    promotion_redemptions: {
      count: async ({ where }: { where: { user_id?: string } }) =>
        where.user_id ? customerUsage[Number(where.user_id)] || 0 : 0,
    },
  };
  const prisma = {
    $transaction: async <T>(operation: (transaction: typeof database) => Promise<T>) =>
      operation(database),
  } as unknown as PrismaClient;

  return {
    service: new PromotionAssignmentService(prisma),
    original,
    updates,
    creates,
  };
};

test('customer replacement preserves the old assignment and issues a new code', async () => {
  const { service, original, updates, creates } = makeService({ 54: 1, 55: 0 });

  const replacement = await service.updateVoucher(9, {
    assignment_type: 'customer',
    customer_id: 55,
    customer_group_id: null,
    voucher_code: original.voucher_code,
    usage_limit: 2,
    status: 'active',
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.status, 'inactive');
  assert.equal(creates.length, 1);
  assert.equal(creates[0]?.customer_id, 55);
  assert.equal(creates[0]?.usage_limit, 2);
  assert.notEqual(creates[0]?.voucher_code, original.voucher_code);
  assert.equal(replacement.customer_id, 55);
});

test('an exhausted customer cannot be assigned again', async () => {
  const { service, updates, creates } = makeService({ 54: 2, 55: 2 });

  await assert.rejects(
    service.updateVoucher(9, {
      assignment_type: 'customer',
      customer_id: 55,
      usage_limit: 2,
      status: 'active',
    }),
    /usage limit \(2\/2\)/
  );
  assert.equal(updates.length, 0);
  assert.equal(creates.length, 0);
});
