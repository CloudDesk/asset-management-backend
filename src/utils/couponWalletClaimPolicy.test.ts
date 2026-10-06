import assert from 'node:assert/strict';
import test from 'node:test';
import { CouponWalletService } from '../services/coupon-wallet.service.js';
import {
  buildCouponClaimLockWhere,
  couponUseStateErrorCode,
  resolveStandaloneCouponUseState,
} from './couponWalletPolicy.js';

const activeAssignment = (overrides: Record<string, unknown> = {}) => ({
  id: 71,
  promotion_id: 81,
  assignment_type: 'customer',
  customer_id: 42,
  claimed_by_customer_id: null,
  claimed_at: null,
  voucher_code: 'NV-CLAIM-ONCE',
  usage_limit: 1,
  used_count: 0,
  start_date: null,
  end_date: null,
  status: 'active',
  delivery_channel: 'all',
  reservation_reference: null,
  reservation_expires_at: null,
  promotion: {
    id: 81,
    name: 'Claim once',
    description: 'Private discount rule created for coupon NV-CLAIM-ONCE',
    visibility: 'private',
    status: 'active',
    action: { type: 'FIXED_AMOUNT_OFF', value: 100 },
    conditions: [],
  },
  customer: { id: 42 },
  claimed_customer: null,
  customer_group: null,
  source_coupon_group: null,
  wallet_credit: null,
  redemptions: [],
  ...overrides,
});

test('claimed and directly redeemed coupons have stable distinct error codes', () => {
  assert.equal(
    couponUseStateErrorCode(resolveStandaloneCouponUseState({ status: 'active', claimed_at: 1n }) as 'claimed'),
    'COUPON_ALREADY_CLAIMED',
  );
  assert.equal(
    couponUseStateErrorCode(resolveStandaloneCouponUseState({ status: 'active', used_count: 1 }) as 'redeemed'),
    'COUPON_ALREADY_REDEEMED',
  );
});

test('an active direct-checkout reservation blocks wallet claim eligibility', () => {
  const state = resolveStandaloneCouponUseState({
    status: 'active',
    reservation_reference: 'CHECKOUT-1',
    reservation_expires_at: BigInt(Date.now() + 60_000),
  });
  assert.equal(state, 'reserved');
  assert.equal(couponUseStateErrorCode(state), 'COUPON_RESERVED');
});

test('an expired checkout reservation no longer blocks wallet claim eligibility', () => {
  assert.equal(resolveStandaloneCouponUseState({
    status: 'active',
    reservation_reference: 'CHECKOUT-OLD',
    reservation_expires_at: BigInt(Date.now() - 1),
  }), 'available');
});

test('claim lock excludes used coupons and active checkout reservations', () => {
  const now = 1_790_000_000_000;
  assert.deepEqual(buildCouponClaimLockWhere(71, 42, now), {
    id: 71,
    customer_id: 42,
    claimed_by_customer_id: null,
    claimed_at: null,
    status: 'active',
    used_count: 0,
    OR: [
      { reservation_reference: null },
      { reservation_expires_at: null },
      { reservation_expires_at: { lte: BigInt(now) } },
    ],
  });
});

test('two concurrent wallet claims create exactly one credit', async () => {
  let locked = false;
  let walletCreateCount = 0;
  let claimedAt: bigint | null = null;
  const assignment = activeAssignment();
  const database = {
    users: {
      findUnique: async () => ({ id: 42, isactive: true }),
    },
    promotion_assignments: {
      findFirst: async () => assignment,
      updateMany: async () => {
        if (locked) return { count: 0 };
        locked = true;
        claimedAt = BigInt(Date.now());
        return { count: 1 };
      },
      findUnique: async () => activeAssignment({
        claimed_by_customer_id: locked ? 42 : null,
        claimed_at: locked ? claimedAt : null,
      }),
      findUniqueOrThrow: async () => activeAssignment({
        claimed_by_customer_id: 42,
        claimed_at: claimedAt,
        wallet_credit: {
          id: 91,
          original_amount: 100,
          remaining_amount: 100,
          minimum_cart_amount: 0,
          status: 'active',
          expires_at: null,
          reservations: [],
        },
      }),
    },
    wallet_credits: {
      create: async () => {
        walletCreateCount += 1;
        return { id: 91 };
      },
    },
  };
  const service = new CouponWalletService() as any;
  service.prisma = {
    $transaction: async (callback: (transaction: unknown) => unknown) => callback(database),
  };

  const results = await Promise.allSettled([
    service.claimCoupon(42, 'NV-CLAIM-ONCE', 'web'),
    service.claimCoupon(42, 'NV-CLAIM-ONCE', 'mobile'),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(walletCreateCount, 1);
  const rejected = results.find((result) => result.status === 'rejected') as PromiseRejectedResult;
  assert.match(String(rejected.reason?.message), /COUPON_ALREADY_CLAIMED/);
});

test('a coupon reserved for direct checkout cannot be claimed into wallet', async () => {
  let lockAttempted = false;
  const database = {
    users: { findUnique: async () => ({ id: 42, isactive: true }) },
    promotion_assignments: {
      findFirst: async () => activeAssignment({
        reservation_reference: 'DIRECT-CHECKOUT-1',
        reservation_expires_at: BigInt(Date.now() + 60_000),
      }),
      updateMany: async () => {
        lockAttempted = true;
        return { count: 1 };
      },
    },
  };
  const service = new CouponWalletService() as any;
  service.prisma = {
    $transaction: async (callback: (transaction: unknown) => unknown) => callback(database),
  };

  await assert.rejects(
    () => service.claimCoupon(42, 'NV-CLAIM-ONCE', 'web'),
    /COUPON_RESERVED/,
  );
  assert.equal(lockAttempted, false);
});

test('a direct-checkout reservation winning after validation returns the reserved state', async () => {
  const database = {
    users: { findUnique: async () => ({ id: 42, isactive: true }) },
    promotion_assignments: {
      findFirst: async () => activeAssignment(),
      updateMany: async () => ({ count: 0 }),
      findUnique: async () => activeAssignment({
        reservation_reference: 'DIRECT-CHECKOUT-RACE',
        reservation_expires_at: BigInt(Date.now() + 60_000),
      }),
    },
  };
  const service = new CouponWalletService() as any;
  service.prisma = {
    $transaction: async (callback: (transaction: unknown) => unknown) => callback(database),
  };

  await assert.rejects(
    () => service.claimCoupon(42, 'NV-CLAIM-ONCE', 'mobile'),
    /COUPON_RESERVED/,
  );
});
