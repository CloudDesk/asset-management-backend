import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPromotionsSchema,
  updatePromotionsSchema,
} from '../schemas/promotions.schema.js';

test('single-customer promotion payloads can explicitly clear a legacy campaign cap', () => {
  assert.equal(createPromotionsSchema.parse({ max_redemptions: null }).max_redemptions, null);
  assert.equal(updatePromotionsSchema.parse({ max_redemptions: null }).max_redemptions, null);
});

test('promotion payloads can explicitly use an unlimited per-customer cap', () => {
  assert.equal(createPromotionsSchema.parse({ per_user_limit: null }).per_user_limit, null);
  assert.equal(updatePromotionsSchema.parse({ per_user_limit: null }).per_user_limit, null);
});
