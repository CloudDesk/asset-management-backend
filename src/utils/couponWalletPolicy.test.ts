import assert from 'node:assert/strict';
import test from 'node:test';
import { claimCouponSchema, createQuickCouponSchema, updateQuickCouponSchema } from '../schemas/coupon-wallet.schema.js';
import { generatePersonalizedCouponCode } from '../services/coupon-wallet.service.js';

const baseCoupon = {
  discount_type: 'FIXED_AMOUNT_OFF' as const,
  discount_value: 100,
  assignment_type: 'customer' as const,
  customer_id: 42,
  delivery_channel: 'print' as const,
  stackable: false,
};

test('standalone wallet coupons must be personalized fixed-value credits', () => {
  assert.equal(createQuickCouponSchema.parse(baseCoupon).customer_id, 42);
  assert.equal(createQuickCouponSchema.safeParse({ ...baseCoupon, assignment_type: 'anyone' }).success, false);
  assert.equal(createQuickCouponSchema.safeParse({ ...baseCoupon, discount_type: 'PERCENT_OFF' }).success, false);
});

test('coupon groups issue personalized coupons and cannot share a supplied code', () => {
  const groupCoupon = { ...baseCoupon, assignment_type: 'coupon_group' as const, customer_id: undefined, coupon_group_id: 7 };
  assert.equal(createQuickCouponSchema.safeParse(groupCoupon).success, true);
  assert.equal(createQuickCouponSchema.safeParse({ ...groupCoupon, voucher_code: 'SHARED100' }).success, false);
});

test('only admin lifecycle states are accepted for unclaimed coupon editing', () => {
  const update = {
    ...baseCoupon,
    name: 'Printed wallet coupon',
    minimum_cart_amount: 500,
    status: 'inactive' as const,
  };
  assert.equal(updateQuickCouponSchema.safeParse(update).success, true);
  assert.equal(updateQuickCouponSchema.safeParse({ ...update, status: 'revoked' }).success, true);
  assert.equal(updateQuickCouponSchema.safeParse({ ...update, status: 'expired' }).success, false);
});

test('website claims identify their channel by default', () => {
  assert.equal(claimCouponSchema.parse({ code: 'CUSTOMER-100' }).channel, 'web');
});

test('generated personalized codes use the compact Nivaana prefix', () => {
  assert.match(generatePersonalizedCouponCode(), /^NV-[A-F0-9]{12}$/);
});
