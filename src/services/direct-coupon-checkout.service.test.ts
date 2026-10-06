import assert from 'node:assert/strict';
import test from 'node:test';
import { DirectCouponCheckoutService, type DirectCouponCheckoutSnapshot } from './direct-coupon-checkout.service.js';
import { STANDALONE_COUPON_DESCRIPTION_PREFIX } from '../utils/couponWalletPolicy.js';

const baseAssignment = (overrides: Record<string, unknown> = {}) => ({
  id: 12,
  promotion_id: 44,
  assignment_type: 'customer',
  customer_id: 7,
  claimed_by_customer_id: null,
  claimed_at: null,
  voucher_code: 'NIV100',
  usage_limit: 1,
  used_count: 0,
  start_date: null,
  end_date: null,
  status: 'active',
  delivery_channel: 'all',
  reserved_by_customer_id: null,
  reservation_reference: null,
  reservation_expires_at: null,
  wallet_credit: null,
  redemptions: [],
  promotion: {
    id: 44,
    name: 'NIV 100',
    description: `${STANDALONE_COUPON_DESCRIPTION_PREFIX}NIV100`,
    visibility: 'private',
    status: 'active',
    start_date: null,
    end_date: null,
    max_redemptions: 1,
    per_user_limit: 1,
    budget: null,
    conditions: [],
    action: { type: 'FIXED_AMOUNT_OFF', value: 100 },
  },
  ...overrides,
});

const quoteDatabase = (assignment = baseAssignment()) => ({
  users: { findUnique: async () => ({ id: 7, isactive: true }) },
  promotion_assignments: { findFirst: async () => assignment },
  promotion_redemptions: {
    aggregate: async () => ({ _count: { _all: 0 }, _sum: { discount_amount: null } }),
    count: async () => 0,
  },
});

test('direct coupon is capped to merchandise remaining after promotions', async () => {
  const service = new DirectCouponCheckoutService(quoteDatabase() as any);
  const quote = await service.quote(7, 'niv100', 'web', 80, 72);

  assert.equal(quote.face_value, 100);
  assert.equal(quote.discount_amount, 72);
  assert.equal(quote.merchandise_remaining_after, 0);
});

test('direct coupon minimum uses original merchandise subtotal, not remaining balance', async () => {
  const assignment = baseAssignment({
    promotion: {
      ...baseAssignment().promotion,
      conditions: [{ attribute: 'cart.total_value', operator: 'GTE', value: 100 }],
    },
  });
  const service = new DirectCouponCheckoutService(quoteDatabase(assignment) as any);

  const eligible = await service.quote(7, 'NIV100', 'mobile', 120, 20);
  assert.equal(eligible.discount_amount, 20);
  await assert.rejects(
    () => service.quote(7, 'NIV100', 'mobile', 99.99, 20),
    /COUPON_MINIMUM_CART_NOT_MET/,
  );
});

test('direct coupon rejects wrong customer, claimed coupon and zero merchandise', async () => {
  await assert.rejects(
    () => new DirectCouponCheckoutService(
      quoteDatabase(baseAssignment({ customer_id: 8 })) as any,
    ).quote(7, 'NIV100', 'web', 100, 100),
    /COUPON_ASSIGNED_TO_ANOTHER_CUSTOMER/,
  );
  await assert.rejects(
    () => new DirectCouponCheckoutService(
      quoteDatabase(baseAssignment({ claimed_by_customer_id: 7, claimed_at: BigInt(Date.now()) })) as any,
    ).quote(7, 'NIV100', 'web', 100, 100),
    /COUPON_ALREADY_CLAIMED/,
  );
  await assert.rejects(
    () => new DirectCouponCheckoutService(quoteDatabase() as any)
      .quote(7, 'NIV100', 'web', 100, 0),
    /COUPON_NO_REMAINING_MERCHANDISE/,
  );
});

test('direct coupon reservation is atomic and records the payment reference', async () => {
  let lockData: any = null;
  const database: any = quoteDatabase();
  database.promotion_assignments.updateMany = async ({ data }: any) => {
    lockData = data;
    return { count: 1 };
  };
  database.$transaction = async (operation: any) => operation(database);
  const service = new DirectCouponCheckoutService(database);
  const reservation = await service.reserve(7, 'NIV100', 'web', 80, 72, 'TX-1');

  assert.equal(reservation.discount_amount, 72);
  assert.equal(reservation.reservation_reference, 'TX-1');
  assert.equal(lockData.reservation_reference, 'TX-1');
  assert.equal(lockData.reserved_by_customer_id, 7);
});

test('successful direct coupon consumption is idempotent for the same order', async () => {
  let redemption: any = null;
  let assignment = baseAssignment({
    reserved_by_customer_id: 7,
    reservation_reference: 'TX-1',
    reservation_expires_at: BigInt(Date.now() + 60_000),
  });
  const database: any = {
    $transaction: async (operation: any) => operation(database),
    promotion_redemptions: {
      findFirst: async () => redemption,
      create: async ({ data }: any) => {
        redemption = data;
        return data;
      },
    },
    promotion_assignments: {
      findUnique: async () => assignment,
      updateMany: async ({ data }: any) => {
        assignment = { ...assignment, used_count: 1, ...data };
        return { count: 1 };
      },
    },
    promotion_evaluations: { create: async ({ data }: any) => data },
  };
  const snapshot: DirectCouponCheckoutSnapshot = {
    assignment_id: 12,
    promotion_id: 44,
    customer_id: 7,
    channel: 'mobile',
    code: 'NIV100',
    name: 'NIV 100',
    face_value: 100,
    discount_amount: 72,
    minimum_cart_amount: 0,
    merchandise_subtotal: 80,
    merchandise_remaining_before: 72,
    merchandise_remaining_after: 0,
    reservation_reference: 'TX-1',
  };
  const service = new DirectCouponCheckoutService(database);

  const first = await service.consume('TX-1', 136, snapshot);
  const second = await service.consume('TX-1', 136, snapshot);

  assert.equal(first.consumed, true);
  assert.equal(second.consumed, false);
  assert.equal(second.redemption_id, first.redemption_id);
  assert.equal(redemption.order_id, '136');
  assert.equal(Number(redemption.discount_amount), 72);
});

test('failed payment release clears only an unconsumed matching reservation', async () => {
  let update: any = null;
  const database: any = {
    promotion_assignments: {
      updateMany: async (input: any) => {
        update = input;
        return { count: 1 };
      },
    },
  };
  const released = await new DirectCouponCheckoutService(database).release('TX-FAILED');

  assert.equal(released, 1);
  assert.equal(update.where.reservation_reference, 'TX-FAILED');
  assert.equal(update.where.used_count, 0);
  assert.equal(update.data.reservation_reference, null);
});
