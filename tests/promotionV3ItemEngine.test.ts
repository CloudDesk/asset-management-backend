import assert from 'node:assert/strict';
import test from 'node:test';
import { PromotionRuleV3Schema, type PromotionRuleV3 } from '../src/schemas/promotions-v3.schema.js';
import { evaluateV3ItemPromotion, type PromotionV3CartLine } from '../src/services/promotion-v3-item-engine.js';

const line = (product_id: string, quantity: number, unit_price_paise: number): PromotionV3CartLine => ({
  cart_record_id: `cart-${product_id}`,
  product_id,
  quantity,
  unit_price_paise,
  facets: { CATEGORY: ['incense'], SUBCATEGORY: ['dhoop'] },
});

function rule(overrides: Partial<PromotionRuleV3> = {}): PromotionRuleV3 {
  return PromotionRuleV3Schema.parse({
    schema_version: 3,
    qualifier: {
      scope: { include: [{ facet: 'PRODUCT', values: ['dhoop'] }], exclude: [], group_operator: 'OR' },
      predicates: [{ field: 'ELIGIBLE_QUANTITY', operator: 'GTE', value: 2 }],
      aggregation: 'ACROSS_ELIGIBLE_PRODUCTS',
    },
    benefit: { type: 'PERCENT_OFF', value: 15, allocation: 'QUALIFYING_UNITS_ONLY', units_per_application: 2 },
    presentation: { title: '15% off two Dhoop Sticks' },
    ...overrides,
  });
}

test('discounts exactly two of three qualifying units', () => {
  const result = evaluateV3ItemPromotion(
    [line('dhoop', 3, 10_000)],
    { promotion_id: 1, rule_version: 1, rule: rule() },
    { channel: 'web' },
  );
  assert.equal(result.eligible, true);
  assert.equal(result.affected_quantity, 2);
  assert.equal(result.discount_total, 3_000);
  assert.deepEqual(result.adjustments[0]?.unit_keys, ['cart-dhoop:unit:0', 'cart-dhoop:unit:1']);
});

test('requires every configured predicate and returns quantity progress', () => {
  const multiPredicateRule = rule({
    qualifier: {
      scope: { include: [{ facet: 'PRODUCT', values: ['dhoop'] }], exclude: [], group_operator: 'OR' },
      predicates: [
        { field: 'ELIGIBLE_QUANTITY', operator: 'GTE', value: 2 },
        { field: 'CART_SUBTOTAL', operator: 'GTE', value: 30_000 },
        { field: 'CHANNEL', operator: 'IN', value: ['web', 'mobile'] },
      ],
      aggregation: 'ACROSS_ELIGIBLE_PRODUCTS',
    },
  });
  const result = evaluateV3ItemPromotion(
    [line('dhoop', 1, 10_000)],
    { promotion_id: 2, rule_version: 1, rule: multiPredicateRule },
    { channel: 'web' },
  );
  assert.equal(result.eligible, false);
  assert.deepEqual(result.reason_codes.sort(), ['MINIMUM_QUANTITY_NOT_MET', 'MINIMUM_VALUE_NOT_MET']);
  assert.deepEqual(result.progress, [
    { field: 'ELIGIBLE_QUANTITY', current: 1, required: 2, remaining: 1 },
    { field: 'CART_SUBTOTAL', current: 10_000, required: 30_000, remaining: 20_000 },
  ]);
});

test('selects the cheapest logical unit deterministically', () => {
  const cheapestRule = rule({
    qualifier: {
      scope: { include: [{ facet: 'CATEGORY', values: ['incense'] }], exclude: [], group_operator: 'OR' },
      predicates: [{ field: 'ELIGIBLE_QUANTITY', operator: 'GTE', value: 2 }],
      aggregation: 'ACROSS_ELIGIBLE_PRODUCTS',
    },
    benefit: { type: 'PERCENT_OFF', value: 50, allocation: 'CHEAPEST_ELIGIBLE_UNIT', units_per_application: 1 },
  });
  const result = evaluateV3ItemPromotion(
    [line('expensive', 1, 20_000), line('cheap', 1, 5_000)],
    { promotion_id: 3, rule_version: 1, rule: cheapestRule },
    { channel: 'mobile' },
  );
  assert.equal(result.discount_total, 2_500);
  assert.equal(result.adjustments[0]?.product_id, 'cheap');
});

test('applies a fixed discount once across the configured affected quantity', () => {
  const fixedRule = rule({
    benefit: { type: 'FIXED_AMOUNT_OFF', value: 1_500, allocation: 'QUALIFYING_UNITS_ONLY', units_per_application: 2 },
  });
  const result = evaluateV3ItemPromotion(
    [line('dhoop', 3, 1_000)],
    { promotion_id: 4, rule_version: 1, rule: fixedRule },
    { channel: 'web' },
  );
  assert.equal(result.affected_quantity, 2);
  assert.equal(result.discount_total, 1_500);
  assert.equal(result.adjustments[0]?.payable_amount, 500);
});

test('leaves previously consumed unit keys available to later promotions only when unlocked', () => {
  const cart = [line('dhoop', 3, 10_000)];
  const first = evaluateV3ItemPromotion(cart, { promotion_id: 5, rule_version: 1, rule: rule() }, { channel: 'web' });
  const second = evaluateV3ItemPromotion(
    cart,
    { promotion_id: 6, rule_version: 1, rule: rule({ benefit: { type: 'PERCENT_OFF', value: 10, allocation: 'REMAINING_AVAILABLE_UNITS' } }) },
    { channel: 'web', unavailable_unit_keys: new Set(first.adjustments.flatMap((adjustment) => adjustment.unit_keys)) },
  );
  assert.equal(second.affected_quantity, 1);
  assert.equal(second.discount_total, 1_000);
  assert.deepEqual(second.adjustments[0]?.unit_keys, ['cart-dhoop:unit:2']);
});

test('selects only the highest matching quantity tier and reports the next tier', () => {
  const tieredRule = rule({
    benefit: undefined,
    tiers: [
      { minimum_quantity: 2, benefit: { type: 'PERCENT_OFF', value: 10, allocation: 'ALL_ELIGIBLE_UNITS' } },
      { minimum_quantity: 3, benefit: { type: 'PERCENT_OFF', value: 15, allocation: 'ALL_ELIGIBLE_UNITS' } },
      { minimum_quantity: 5, benefit: { type: 'PERCENT_OFF', value: 20, allocation: 'ALL_ELIGIBLE_UNITS' } },
    ],
  });
  const result = evaluateV3ItemPromotion(
    [line('dhoop', 3, 10_000)],
    { promotion_id: 7, rule_version: 1, rule: tieredRule },
    { channel: 'web' },
  );
  assert.equal(result.discount_total, 4_500);
  assert.equal(result.matched_tier_minimum, 3);
  assert.deepEqual(result.progress, [{ field: 'ELIGIBLE_QUANTITY', current: 3, required: 5, remaining: 2 }]);
});

test('returns progress to the first tier without applying a discount', () => {
  const tieredRule = rule({
    benefit: undefined,
    tiers: [
      { minimum_quantity: 2, benefit: { type: 'PERCENT_OFF', value: 10, allocation: 'ALL_ELIGIBLE_UNITS' } },
      { minimum_quantity: 3, benefit: { type: 'PERCENT_OFF', value: 15, allocation: 'ALL_ELIGIBLE_UNITS' } },
    ],
  });
  const result = evaluateV3ItemPromotion(
    [line('dhoop', 1, 10_000)],
    { promotion_id: 8, rule_version: 1, rule: tieredRule },
    { channel: 'web' },
  );
  assert.equal(result.eligible, false);
  assert.equal(result.discount_total, 0);
  assert.deepEqual(result.progress, [{ field: 'ELIGIBLE_QUANTITY', current: 1, required: 2, remaining: 1 }]);
});
