import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPromotionsSchema,
  updatePromotionsSchema,
} from '../schemas/promotions.schema.js';

test('promotion payloads can explicitly clear optional limits', () => {
  assert.equal(createPromotionsSchema.parse({ max_redemptions: null }).max_redemptions, null);
  assert.equal(updatePromotionsSchema.parse({ max_redemptions: null }).max_redemptions, null);
});

test('promotion usage limits are unlimited when omitted or explicitly cleared', () => {
  assert.equal(createPromotionsSchema.parse({}).max_redemptions, undefined);
  assert.equal(createPromotionsSchema.parse({}).per_user_limit, undefined);
  assert.equal(updatePromotionsSchema.parse({ per_user_limit: null }).per_user_limit, null);
});

test('configured redemption limits must be positive integers', () => {
  assert.equal(createPromotionsSchema.parse({ max_redemptions: 5 }).max_redemptions, 5);
  assert.equal(createPromotionsSchema.safeParse({ max_redemptions: 0 }).success, false);
  assert.equal(createPromotionsSchema.safeParse({ per_user_limit: -1 }).success, false);
  assert.equal(createPromotionsSchema.parse({ per_user_limit: 10 }).per_user_limit, 10);
});

test('promotion monetary budget accepts null or a positive amount', () => {
  assert.equal(createPromotionsSchema.parse({ budget: null }).budget, null);
  assert.equal(createPromotionsSchema.parse({ budget: 100 }).budget, 100);
  assert.equal(createPromotionsSchema.safeParse({ budget: 0 }).success, false);
  assert.equal(createPromotionsSchema.safeParse({ budget: -1 }).success, false);
});
