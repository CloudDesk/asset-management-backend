import assert from 'node:assert/strict';
import test from 'node:test';
import { PromotionRuleV3Schema, type PromotionRuleV3 } from '../src/schemas/promotions-v3.schema.js';
import { evaluateV3ItemPromotions } from '../src/services/promotion-v3-engine.js';
import type { PromotionV3CartLine, PromotionV3ItemCampaign } from '../src/services/promotion-v3-item-engine.js';

const line = (product_id: string, quantity: number, unit_price_paise: number): PromotionV3CartLine => ({
  cart_record_id: `cart-${product_id}`, product_id, quantity, unit_price_paise, facets: { CATEGORY: ['incense'] },
});

function rule(productIds: string[], value: number, units: number | undefined, policy: Partial<PromotionRuleV3['conflict_policy']>): PromotionRuleV3 {
  return PromotionRuleV3Schema.parse({
    schema_version: 3,
    qualifier: {
      scope: { include: [{ facet: 'PRODUCT', values: productIds }], exclude: [], group_operator: 'OR' },
      predicates: [{ field: 'ELIGIBLE_QUANTITY', operator: 'GTE', value: 1 }],
      aggregation: 'ACROSS_ELIGIBLE_PRODUCTS',
    },
    benefit: { type: 'PERCENT_OFF', value, allocation: units ? 'QUALIFYING_UNITS_ONLY' : 'REMAINING_AVAILABLE_UNITS', ...(units ? { units_per_application: units } : {}) },
    conflict_policy: {
      exclusive_group: 'MERCHANDISE_PROMOTIONS', stackable: true, item_reuse: false,
      selection_strategy: 'CAMPAIGN_PRIORITY', priority: 1, ...policy,
    },
    presentation: { title: `${value}% off` },
  });
}

const campaign = (promotion_id: number, promotionRule: PromotionRuleV3): PromotionV3ItemCampaign => ({
  promotion_id, rule_version: 1, name: `Offer ${promotion_id}`, rule: promotionRule,
});

test('allocates the higher-priority offer to two units and the compatible offer to remaining units', () => {
  const result = evaluateV3ItemPromotions(
    [line('dhoop', 3, 10_000), line('flask', 1, 20_000)],
    [
      campaign(1, rule(['dhoop'], 15, 2, { priority: 1 })),
      campaign(2, rule(['dhoop', 'flask'], 10, undefined, { priority: 2 })),
    ],
    { channel: 'web' },
  );
  assert.equal(result.discount_total, 6_000);
  assert.deepEqual(result.applied_promotions.map((item) => item.promotion_id), [1, 2]);
  assert.equal(result.adjustments.find((item) => item.promotion_id === 1)?.affected_quantity, 2);
  assert.equal(result.adjustments.filter((item) => item.promotion_id === 2).reduce((sum, item) => sum + item.affected_quantity, 0), 2);
});

test('selects the best customer value in single-promotion mode', () => {
  const result = evaluateV3ItemPromotions(
    [line('dhoop', 2, 10_000)],
    [
      campaign(10, rule(['dhoop'], 10, undefined, { stackable: false, selection_strategy: 'BEST_CUSTOMER_VALUE', priority: 1 })),
      campaign(20, rule(['dhoop'], 20, undefined, { stackable: false, selection_strategy: 'BEST_CUSTOMER_VALUE', priority: 5 })),
    ],
    { channel: 'web' },
  );
  assert.deepEqual(result.applied_promotions.map((item) => item.promotion_id), [20]);
  assert.deepEqual(result.eligible_alternatives.map((item) => item.promotion_id), [10]);
  assert.equal(result.discount_total, 4_000);
});

test('uses campaign priority and promotion id as deterministic tie-breakers', () => {
  const result = evaluateV3ItemPromotions(
    [line('dhoop', 1, 10_000)],
    [
      campaign(3, rule(['dhoop'], 50, undefined, { stackable: false, priority: 2 })),
      campaign(2, rule(['dhoop'], 10, undefined, { stackable: false, priority: 1 })),
      campaign(1, rule(['dhoop'], 10, undefined, { stackable: false, priority: 1 })),
    ],
    { channel: 'web' },
  );
  assert.deepEqual(result.applied_promotions.map((item) => item.promotion_id), [1]);
});

test('allows unit reuse only when every selected campaign explicitly enables it', () => {
  const reuse = { stackable: true, item_reuse: true, selection_strategy: 'CAMPAIGN_PRIORITY' as const };
  const result = evaluateV3ItemPromotions(
    [line('dhoop', 1, 10_000)],
    [campaign(1, rule(['dhoop'], 10, undefined, reuse)), campaign(2, rule(['dhoop'], 20, undefined, reuse))],
    { channel: 'web' },
  );
  assert.deepEqual(result.applied_promotions.map((item) => item.promotion_id), [1, 2]);
  assert.equal(result.discount_total, 3_000);
});

function orderRule(value: number, type: 'PERCENT_OFF' | 'FIXED_AMOUNT_OFF', threshold: number, priority = 1): PromotionRuleV3 {
  return PromotionRuleV3Schema.parse({
    schema_version: 3,
    qualifier: {
      scope: { include: [{ facet: 'ENTIRE_CART', values: ['*'] }], exclude: [], group_operator: 'OR' },
      predicates: [{ field: 'REMAINING_CART_VALUE', operator: 'GTE', value: threshold }],
    },
    benefit: { type, value, application_level: 'ORDER' },
    conflict_policy: { exclusive_group: `ORDER_${priority}`, stackable: true, priority },
    presentation: { title: 'Cart discount' },
  });
}

test('checks cart thresholds after item discounts instead of against the original subtotal', () => {
  const result = evaluateV3ItemPromotions(
    [line('dhoop', 1, 100_000)],
    [
      campaign(1, rule(['dhoop'], 15, undefined, { priority: 1 })),
      campaign(2, orderRule(10, 'PERCENT_OFF', 90_000)),
    ],
    { channel: 'web' },
  );
  assert.equal(result.original_merchandise_total, 100_000);
  assert.equal(result.remaining_cart_value, 85_000);
  assert.equal(result.discount_total, 15_000);
  assert.equal(result.order_adjustments.length, 0);
  assert.deepEqual(result.rejected_candidates.find((item) => item.promotion_id === 2)?.reason_codes, ['MINIMUM_VALUE_NOT_MET']);
  assert.deepEqual(result.progress.find((item) => item.promotion_id === 2), {
    promotion_id: 2, field: 'REMAINING_CART_VALUE', current: 85_000, required: 90_000, remaining: 5_000,
  });
});

test('keeps a fixed cart discount as a separate order adjustment', () => {
  const result = evaluateV3ItemPromotions(
    [line('dhoop', 1, 100_000)],
    [campaign(3, orderRule(12_500, 'FIXED_AMOUNT_OFF', 80_000))],
    { channel: 'web' },
  );
  assert.equal(result.adjustments.length, 0);
  assert.equal(result.order_adjustments.length, 1);
  assert.equal(result.item_discount_total, 0);
  assert.equal(result.order_discount_total, 12_500);
  assert.deepEqual(result.order_adjustments[0], {
    adjustment_id: result.order_adjustments[0]?.adjustment_id,
    promotion_id: 3,
    rule_version: 1,
    adjustment_type: 'ORDER_FIXED_DISCOUNT',
    basis_amount: 100_000,
    amount: 12_500,
    payable_amount: 87_500,
  });
  assert.equal(result.payable_merchandise_total, 87_500);
});

test('applies compatible order discounts sequentially to the changing remaining value', () => {
  const result = evaluateV3ItemPromotions(
    [line('dhoop', 1, 100_000)],
    [
      campaign(4, orderRule(10, 'PERCENT_OFF', 0, 1)),
      campaign(5, orderRule(5_000, 'FIXED_AMOUNT_OFF', 90_000, 2)),
    ],
    { channel: 'web' },
  );
  assert.deepEqual(result.order_adjustments.map((item) => [item.promotion_id, item.basis_amount, item.amount]), [
    [4, 100_000, 10_000],
    [5, 90_000, 5_000],
  ]);
  assert.equal(result.remaining_cart_value, 85_000);
});

function sameProductGiftRule(maximumSets: number | null = null): PromotionRuleV3 {
  return PromotionRuleV3Schema.parse({
    schema_version: 3,
    qualifier: {
      scope: { include: [{ facet: 'PRODUCT', values: ['dhoop'] }], exclude: [], group_operator: 'OR' },
      predicates: [{ field: 'ELIGIBLE_QUANTITY', operator: 'GTE', value: 3 }],
      aggregation: 'PER_PRODUCT',
    },
    benefit: { type: 'FREE_ITEM', quantity: 1, allocation: 'QUALIFYING_UNITS_ONLY' },
    reward: { mode: 'SAME_PRODUCT', product_ids: [], allowed_scope: null, fulfilment: 'AUTO_ADD' },
    repetition: { mode: 'PER_QUALIFYING_SET', maximum_sets_per_order: maximumSets },
    presentation: { title: 'Buy 3 Get 1 Free', progress_template: 'Add {remaining} more to get 1 free.' },
  });
}

test('normalizes Buy 3 Get 1 quantities without charging for the gift', () => {
  const expected = [
    [1, 1, 0, 1], [2, 2, 0, 2], [3, 3, 1, 4], [4, 3, 1, 4],
    [5, 4, 1, 5], [6, 5, 1, 6], [7, 6, 2, 8], [8, 6, 2, 8],
  ];
  for (const [inputQuantity, paid, free, total] of expected) {
    const result = evaluateV3ItemPromotions(
      [{ ...line('dhoop', inputQuantity!, 10_000), available_quantity: 100 }],
      [campaign(20, sameProductGiftRule())],
      { channel: 'web' },
    );
    assert.deepEqual(result.quantity_breakdown[0], { product_id: 'dhoop', paid_quantity: paid, free_quantity: free, total_quantity: total });
    assert.equal(result.payable_merchandise_total, paid! * 10_000);
  }
});

test('caps repeating gifts and returns a non-editable automatic gift', () => {
  const result = evaluateV3ItemPromotions(
    [{ ...line('dhoop', 10, 10_000), available_quantity: 100 }],
    [campaign(21, sameProductGiftRule(2))],
    { channel: 'web' },
  );
  assert.equal(result.gifts[0]?.free_quantity, 2);
  assert.equal(result.gifts[0]?.editable, false);
  assert.equal(result.quantity_breakdown[0]?.total_quantity, 10);
});

test('leaves paid quantity unchanged and rejects the gift when stock is unavailable', () => {
  const result = evaluateV3ItemPromotions(
    [{ ...line('dhoop', 3, 10_000), available_quantity: 3 }],
    [campaign(22, sameProductGiftRule())],
    { channel: 'web' },
  );
  assert.equal(result.discount_total, 0);
  assert.equal(result.gifts.length, 0);
  assert.deepEqual(result.quantity_breakdown[0], { product_id: 'dhoop', paid_quantity: 3, free_quantity: 0, total_quantity: 3 });
  assert.deepEqual(result.rejected_candidates[0]?.reason_codes, ['GIFT_OUT_OF_STOCK']);
});

function advancedGiftRule(mode: 'SPECIFIC_PRODUCT' | 'CHEAPEST_ELIGIBLE_CART_UNIT' | 'PACKER_SELECTED_SURPRISE_GIFT'): PromotionRuleV3 {
  return PromotionRuleV3Schema.parse({
    schema_version: 3,
    qualifier: {
      scope: { include: [{ facet: 'CATEGORY', values: ['incense'] }], exclude: [], group_operator: 'OR' },
      predicates: [{ field: 'ELIGIBLE_QUANTITY', operator: 'GTE', value: 2 }],
      aggregation: 'ACROSS_ELIGIBLE_PRODUCTS',
    },
    benefit: { type: 'FREE_ITEM', quantity: 1 },
    reward: {
      mode,
      product_ids: mode === 'SPECIFIC_PRODUCT' ? ['gift'] : [],
      allowed_scope: mode === 'PACKER_SELECTED_SURPRISE_GIFT' ? { include: [{ facet: 'CATEGORY', values: ['gifts'] }], exclude: [], group_operator: 'OR' } : null,
      fulfilment: mode === 'CHEAPEST_ELIGIBLE_CART_UNIT' ? 'DISCOUNT_EXISTING' : mode === 'PACKER_SELECTED_SURPRISE_GIFT' ? 'PACKING_SELECTION' : 'AUTO_ADD',
    },
    presentation: { title: 'Free gift' },
  });
}

test('auto-adds a configured gift only when authoritative stock is available', () => {
  const result = evaluateV3ItemPromotions(
    [line('paid', 2, 10_000)],
    [campaign(30, advancedGiftRule('SPECIFIC_PRODUCT'))],
    { channel: 'web', reward_catalog: [{ ...line('gift', 0, 4_000), available_quantity: 1 }] },
  );
  assert.equal(result.gifts[0]?.product_id, 'gift');
  assert.equal(result.gifts[0]?.free_quantity, 1);
  assert.equal(result.discount_total, 4_000);
  assert.equal(result.payable_merchandise_total, 20_000);
});

test('makes the cheapest eligible existing cart unit free', () => {
  const result = evaluateV3ItemPromotions(
    [line('expensive', 1, 20_000), line('cheap', 1, 5_000)],
    [campaign(31, advancedGiftRule('CHEAPEST_ELIGIBLE_CART_UNIT'))],
    { channel: 'web' },
  );
  assert.equal(result.adjustments[0]?.product_id, 'cheap');
  assert.equal(result.adjustments[0]?.adjustment_type, 'FREE_ITEM');
  assert.equal(result.discount_total, 5_000);
  assert.deepEqual(result.quantity_breakdown.find((item) => item.product_id === 'cheap'), { product_id: 'cheap', paid_quantity: 0, free_quantity: 1, total_quantity: 1 });
});

test('creates a pending packing entitlement without exposing a product choice', () => {
  const result = evaluateV3ItemPromotions(
    [line('paid', 2, 10_000)],
    [campaign(32, advancedGiftRule('PACKER_SELECTED_SURPRISE_GIFT'))],
    { channel: 'mobile' },
  );
  assert.equal(result.adjustments.length, 0);
  assert.equal(result.gift_entitlements[0]?.status, 'PENDING_PACKING');
  assert.equal(result.gift_entitlements[0]?.gift_quantity, 1);
  assert.equal(result.applied_promotions[0]?.promotion_id, 32);
});
