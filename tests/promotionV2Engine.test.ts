import assert from 'node:assert/strict';
import test from 'node:test';
import { PromotionRuleV2Schema, type PromotionRuleV2 } from '../src/schemas/promotions-v2.schema.js';
import { evaluatePromotionQuote, type PromotionCampaign, type PromotionCartLine } from '../src/services/promotion-v2-engine.js';
import { convertLegacyPromotionRule } from '../src/utils/legacy-promotion-v2.js';

const line = (id: string, quantity: number, unitPricePaise: number, category = 'incense'): PromotionCartLine => ({
  id, quantity, unitPricePaise, stock: 100, facets: { CATEGORY: [category] },
});

const rule = (overrides: Partial<PromotionRuleV2>): PromotionRuleV2 => PromotionRuleV2Schema.parse({
  schema_version: 2,
  qualifier: {
    scope: { include: [{ facet: 'ENTIRE_CART', values: ['*'] }], exclude: [], group_operator: 'OR' },
    metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1,
  },
  benefit: { type: 'PERCENT_OFF', value: 10, target: 'ALL_QUALIFYING_UNITS' },
  ...overrides,
});

const campaign = (promotionId: number, promotionRule: PromotionRuleV2, name = `Offer ${promotionId}`): PromotionCampaign => ({
  promotionId, ruleVersion: 1, name, rule: promotionRule,
});

test('selects only the highest matching quantity tier', () => {
  const tiered = rule({
    benefit: undefined,
    tiers: [
      { minimum: 2, benefit: { type: 'PERCENT_OFF', value: 10, target: 'ALL_QUALIFYING_UNITS', fulfilment: 'AUTO_ADD', out_of_stock_policy: 'REMOVE_PROMOTION' } },
      { minimum: 3, benefit: { type: 'PERCENT_OFF', value: 15, target: 'ALL_QUALIFYING_UNITS', fulfilment: 'AUTO_ADD', out_of_stock_policy: 'REMOVE_PROMOTION' } },
    ],
  });
  const quote = evaluatePromotionQuote([line('1', 3, 10_000)], [campaign(1, tiered)], []);
  assert.equal(quote.discount_total, 4_500);
  assert.equal(quote.applied_promotions.length, 1);
});

test('reports next tier progress without applying a locked offer', () => {
  const tiered = rule({ benefit: undefined, tiers: [{ minimum: 2, benefit: { type: 'PERCENT_OFF', value: 10, target: 'ALL_QUALIFYING_UNITS', fulfilment: 'AUTO_ADD', out_of_stock_policy: 'REMOVE_PROMOTION' } }] });
  const quote = evaluatePromotionQuote([line('1', 1, 10_000)], [campaign(1, tiered)], []);
  assert.equal(quote.discount_total, 0);
  assert.deepEqual(quote.next_tier_progress[0], { promotion_id: 1, current: 1, next_minimum: 2, remaining: 1, metric: 'ELIGIBLE_QUANTITY' });
});

test('supports Buy 2 Get 1 as an auto-added gift and caps repetitions', () => {
  const b2g1 = rule({
    qualifier: {
      scope: { include: [{ facet: 'CATEGORY', values: ['incense'] }], exclude: [], group_operator: 'OR' },
      metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 2,
    },
    benefit: { type: 'FREE_ITEM', quantity: 1, target: 'SPECIFIC_PRODUCTS', product_ids: ['gift'], fulfilment: 'AUTO_ADD', out_of_stock_policy: 'REMOVE_PROMOTION' },
    repeat: 'PER_MULTIPLE', limits: { maximum_applications_per_order: 2 },
  });
  const gift = line('gift', 0, 5_000);
  const quote = evaluatePromotionQuote([line('paid', 5, 10_000)], [campaign(3, b2g1)], [gift]);
  assert.equal(quote.adjustments[0]?.type, 'FREE_ITEM');
  assert.equal(quote.adjustments[0]?.affected_quantity, 2);
  assert.equal(quote.discount_total, 10_000);
});

test('grants the configured free quantity only once when repetition is disabled', () => {
  const buyTwoGetOneOnce = rule({
    qualifier: {
      scope: { include: [{ facet: 'CATEGORY', values: ['incense'] }], exclude: [], group_operator: 'OR' },
      metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 2,
    },
    benefit: { type: 'FREE_ITEM', quantity: 1, target: 'SPECIFIC_PRODUCTS', product_ids: ['gift'], fulfilment: 'AUTO_ADD', out_of_stock_policy: 'REMOVE_PROMOTION' },
    repeat: 'ONCE',
  });
  const quote = evaluatePromotionQuote(
    [line('paid', 4, 10_000)],
    [campaign(4, buyTwoGetOneOnce)],
    [line('gift', 0, 5_000)],
  );
  assert.equal(quote.adjustments[0]?.type, 'FREE_ITEM');
  assert.equal(quote.adjustments[0]?.affected_quantity, 1);
  assert.equal(quote.discount_total, 5_000);
});

test('chooses the greatest saving for overlapping units deterministically', () => {
  const productLine = line('A', 3, 10_000);
  const tenPercent = rule({ benefit: { type: 'PERCENT_OFF', value: 10, target: 'ALL_QUALIFYING_UNITS', fulfilment: 'AUTO_ADD', out_of_stock_policy: 'REMOVE_PROMOTION' } });
  const fifteenPercent = rule({ benefit: { type: 'PERCENT_OFF', value: 15, target: 'ALL_QUALIFYING_UNITS', fulfilment: 'AUTO_ADD', out_of_stock_policy: 'REMOVE_PROMOTION' } });
  const b2g1 = rule({ qualifier: { scope: { include: [{ facet: 'PRODUCT', values: ['A'] }], exclude: [], group_operator: 'OR' }, metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 2 }, benefit: { type: 'FREE_ITEM', quantity: 1, target: 'SAME_PRODUCT_AS_QUALIFIER', fulfilment: 'DISCOUNT_EXISTING', out_of_stock_policy: 'REMOVE_PROMOTION' } });
  const quote = evaluatePromotionQuote([productLine], [campaign(20, tenPercent), campaign(10, fifteenPercent), campaign(30, b2g1)], [productLine]);
  assert.deepEqual(quote.applied_promotions.map((item) => item.promotion_id), [30]);
  assert.equal(quote.discount_total, 10_000);
  assert.equal(quote.eligible_alternatives.length, 2);
});

test('combines overlapping promotions only when both allow combining', () => {
  const stacking = {
    stackable: true,
    exclusive_group: 'MERCHANDISE_DISCOUNT',
    item_reuse: 'DISALLOW' as const,
    selection_strategy: 'BEST_CUSTOMER_VALUE' as const,
    priority: 1,
  };
  const tenPercent = rule({
    benefit: { type: 'PERCENT_OFF', value: 10, target: 'ALL_QUALIFYING_UNITS' },
    stacking,
  });
  const twentyPercent = rule({
    benefit: { type: 'PERCENT_OFF', value: 20, target: 'ALL_QUALIFYING_UNITS' },
    stacking,
  });
  const product = line('A', 1, 10_000);

  const combined = evaluatePromotionQuote(
    [product],
    [campaign(1, tenPercent), campaign(2, twentyPercent)],
    [],
  );
  assert.deepEqual(combined.applied_promotions.map((item) => item.promotion_id), [1, 2]);
  assert.equal(combined.discount_total, 3_000);

  const exclusive = evaluatePromotionQuote(
    [product],
    [campaign(1, { ...tenPercent, stacking: { ...stacking, stackable: false } }), campaign(2, twentyPercent)],
    [],
  );
  assert.deepEqual(exclusive.applied_promotions.map((item) => item.promotion_id), [2]);
  assert.equal(exclusive.discount_total, 2_000);
});

test('caps stacked merchandise promotions at the merchandise subtotal', () => {
  const stacking = {
    stackable: true,
    exclusive_group: 'MERCHANDISE_DISCOUNT',
    item_reuse: 'ALLOW' as const,
    selection_strategy: 'BEST_CUSTOMER_VALUE' as const,
    priority: 1,
  };
  const fixedAmount = rule({
    benefit: { type: 'FIXED_AMOUNT_OFF', value: 6_000, target: 'ALL_QUALIFYING_UNITS' },
    stacking,
  });
  const secondFixedAmount = rule({
    benefit: { type: 'FIXED_AMOUNT_OFF', value: 5_000, target: 'ALL_QUALIFYING_UNITS' },
    stacking,
  });

  const quote = evaluatePromotionQuote(
    [line('A', 2, 4_000)],
    [campaign(1, fixedAmount), campaign(2, secondFixedAmount)],
    [],
    { shippingAmount: 15_000 },
  );

  assert.equal(quote.merchandise_subtotal, 8_000);
  assert.equal(quote.merchandise_discount_total, 8_000);
  assert.equal(quote.merchandise_payable, 0);
  assert.equal(quote.shipping_discount_total, 0);
  assert.equal(quote.shipping_payable, 15_000);
  assert.equal(quote.payable_total, 15_000);
  assert.equal(quote.applied_promotions.reduce((sum, item) => sum + item.saving, 0), 8_000);
  assert.equal(quote.adjustments.reduce((sum, item) => sum + item.amount, 0), 8_000);
});

test('caps an oversized fixed cart discount across multiple product lines without losing value', () => {
  const fixedAmount = rule({
    benefit: { type: 'FIXED_AMOUNT_OFF', value: 10_000, target: 'ALL_QUALIFYING_UNITS' },
    stacking: {
      stackable: true,
      exclusive_group: 'MERCHANDISE_DISCOUNT',
      item_reuse: 'ALLOW',
      selection_strategy: 'BEST_CUSTOMER_VALUE',
      priority: 1,
    },
  });

  const quote = evaluatePromotionQuote(
    [line('A', 1, 4_000), line('B', 1, 4_000)],
    [campaign(42, fixedAmount, 'NIV 100')],
    [],
    { shippingAmount: 15_000 },
  );

  assert.equal(quote.merchandise_subtotal, 8_000);
  assert.equal(quote.merchandise_discount_total, 8_000);
  assert.equal(quote.merchandise_payable, 0);
  assert.equal(quote.shipping_discount_total, 0);
  assert.equal(quote.shipping_payable, 15_000);
  assert.equal(quote.payable_total, 15_000);
  assert.deepEqual(quote.adjustments.map((item) => item.amount), [4_000, 4_000]);
  assert.deepEqual(quote.adjustments.map((item) => item.payable_amount), [0, 0]);
});

test('does not let stacked merchandise offers exceed a multi-line subtotal', () => {
  const stacking = {
    stackable: true,
    exclusive_group: 'MERCHANDISE_DISCOUNT',
    item_reuse: 'ALLOW' as const,
    selection_strategy: 'BEST_CUSTOMER_VALUE' as const,
    priority: 1,
  };
  const fixedAmount = rule({
    benefit: { type: 'FIXED_AMOUNT_OFF', value: 10_000, target: 'ALL_QUALIFYING_UNITS' },
    stacking,
  });
  const tenPercent = rule({
    benefit: { type: 'PERCENT_OFF', value: 10, target: 'ALL_QUALIFYING_UNITS' },
    stacking,
  });

  const quote = evaluatePromotionQuote(
    [line('A', 1, 4_000), line('B', 1, 4_000)],
    [campaign(18, tenPercent), campaign(42, fixedAmount, 'NIV 100')],
    [],
    { shippingAmount: 15_000 },
  );

  assert.equal(quote.merchandise_discount_total, 8_000);
  assert.equal(quote.merchandise_payable, 0);
  assert.equal(quote.shipping_payable, 15_000);
  assert.equal(quote.payable_total, 15_000);
  assert.deepEqual(quote.applied_promotions, [{ promotion_id: 42, name: 'NIV 100', saving: 8_000 }]);
});

test('preserves proportional allocation when a fixed discount is below the subtotal', () => {
  const fixedAmount = rule({
    benefit: { type: 'FIXED_AMOUNT_OFF', value: 5_000, target: 'ALL_QUALIFYING_UNITS' },
  });

  const quote = evaluatePromotionQuote(
    [line('A', 1, 3_000), line('B', 1, 5_000)],
    [campaign(1, fixedAmount)],
    [],
  );

  assert.equal(quote.merchandise_discount_total, 5_000);
  assert.equal(quote.merchandise_payable, 3_000);
  assert.deepEqual(
    Object.fromEntries(quote.adjustments.map((item) => [item.product_id, item.amount])),
    { A: 1_875, B: 3_125 },
  );
});

test('keeps free shipping separate from a fully discounted cart', () => {
  const merchandiseOffer = rule({
    benefit: { type: 'FIXED_AMOUNT_OFF', value: 10_000, target: 'ALL_QUALIFYING_UNITS' },
    stacking: { stackable: true, exclusive_group: 'MERCHANDISE_DISCOUNT' },
  });
  const freeShipping = convertLegacyPromotionRule({
    type: 'FREE_SHIPPING',
    conditions: [{ attribute: 'cart.total_value', operator: 'GTE', value: '80' }],
    action: { type: 'FREE_SHIPPING', value: 0 },
    stackable: true,
    name: 'Free Shipping Over ₹80',
  });

  const quote = evaluatePromotionQuote(
    [line('A', 2, 4_000)],
    [campaign(1, merchandiseOffer), campaign(2, freeShipping)],
    [],
    { shippingAmount: 15_000 },
  );

  assert.equal(quote.merchandise_discount_total, 8_000);
  assert.equal(quote.shipping_discount_total, 15_000);
  assert.equal(quote.gift_savings_total, 0);
  assert.equal(quote.payable_total, 0);
  assert.equal(quote.discount_total, 23_000);
});

test('keeps stackable legacy free shipping with a merchandise promotion', () => {
  const merchandiseOffer = rule({
    benefit: { type: 'PERCENT_OFF', value: 30, target: 'ALL_QUALIFYING_UNITS' },
    stacking: { stackable: true, exclusive_group: 'MERCHANDISE_DISCOUNT' },
  });
  const freeShipping = convertLegacyPromotionRule({
    type: 'FREE_SHIPPING',
    conditions: [{ attribute: 'cart.total_value', operator: 'GTE', value: '500' }],
    action: { type: 'FREE_SHIPPING', value: 0 },
    stackable: true,
    priority: 1,
    name: 'Free Shipping Over ₹500',
  });
  const quote = evaluatePromotionQuote(
    [line('A', 1, 50_000)],
    [campaign(33, merchandiseOffer), campaign(4, freeShipping)],
    [],
    { shippingAmount: 15_000 },
  );

  assert.equal(freeShipping.qualifier.metric, 'CART_SUBTOTAL');
  assert.deepEqual(quote.applied_promotions.map((item) => item.promotion_id).sort((a, b) => a - b), [4, 33]);
  assert.equal(quote.discount_total, 30_000);
  assert.equal(quote.payable_total, 35_000);
});

test('combines free shipping with a non-stackable manual fixed-cart offer', () => {
  const manualCartOffer = convertLegacyPromotionRule({
    type: 'FIXED_AMOUNT_OFF_CART',
    conditions: [{ attribute: 'cart.total_value', operator: 'GTE', value: '799' }],
    action: { type: 'FIXED_AMOUNT_OFF', value: 149 },
    stackable: false,
    name: '149 Off',
  });
  const freeShipping = convertLegacyPromotionRule({
    type: 'FREE_SHIPPING',
    conditions: [{ attribute: 'cart.total_value', operator: 'GTE', value: '250' }],
    action: { type: 'FREE_SHIPPING', value: 0 },
    stackable: true,
    name: 'Free Shipping',
  });

  const quote = evaluatePromotionQuote(
    [line('A', 1, 50_000), line('B', 1, 22_000), line('C', 2, 5_000)],
    [campaign(61, manualCartOffer, '149 Off'), campaign(70, freeShipping, 'Free Shipping')],
    [],
    { shippingAmount: 15_000 },
  );

  assert.deepEqual(
    quote.applied_promotions.map((item) => item.promotion_id).sort((a, b) => a - b),
    [61, 70],
  );
  assert.equal(quote.merchandise_discount_total, 14_900);
  assert.equal(quote.shipping_discount_total, 15_000);
  assert.equal(quote.discount_total, 29_900);
  assert.equal(quote.payable_total, 67_100);
});

test('reports the full saving for an atomized eligible alternative', () => {
  const stacking = {
    stackable: true,
    exclusive_group: 'MERCHANDISE_DISCOUNT',
    item_reuse: 'DISALLOW' as const,
    selection_strategy: 'BEST_CUSTOMER_VALUE' as const,
    priority: 1,
  };
  const manualCartOffer = convertLegacyPromotionRule({
    type: 'FIXED_AMOUNT_OFF_CART',
    conditions: [{ attribute: 'cart.total_value', operator: 'GTE', value: '799' }],
    action: { type: 'FIXED_AMOUNT_OFF', value: 149 },
    stackable: false,
    name: '149 Off',
  });
  const automaticTwentyPercent = rule({
    benefit: { type: 'PERCENT_OFF', value: 20, target: 'ALL_QUALIFYING_UNITS' },
    stacking,
  });

  const quote = evaluatePromotionQuote(
    [line('A', 1, 50_000), line('B', 1, 22_000), line('C', 2, 5_000)],
    [
      campaign(61, manualCartOffer, '149 Off'),
      campaign(71, automaticTwentyPercent, '20% Off'),
      campaign(72, automaticTwentyPercent, 'Another 20% Off'),
    ],
    [],
  );

  assert.deepEqual(quote.applied_promotions.map((item) => item.promotion_id), [71, 72]);
  assert.deepEqual(quote.eligible_alternatives, [{ promotion_id: 61, name: '149 Off', saving: 14_900 }]);
  assert.ok(quote.rejected_candidates.some((item) =>
    item.promotion_id === 61 && item.reason_code === 'CONFLICTED_WITH_BETTER_OFFER'
  ));
});

test('evaluates a bridged legacy fixed-cart offer in the canonical V2 engine', () => {
  const legacyManualCartOffer = convertLegacyPromotionRule({
    type: 'FIXED_AMOUNT_OFF_CART',
    conditions: [{ attribute: 'cart.total_value', operator: 'GTE', value: '500' }],
    action: { type: 'FIXED_AMOUNT_OFF', value: 100 },
    stackable: true,
    name: 'Legacy Manual Rs. 100 Off',
  });
  const quote = evaluatePromotionQuote(
    [line('A', 1, 100_000)],
    [campaign(70, legacyManualCartOffer)],
    [],
    { shippingAmount: 15_000 },
  );

  assert.deepEqual(quote.applied_promotions, [{
    promotion_id: 70,
    name: 'Offer 70',
    saving: 10_000,
  }]);
  assert.equal(quote.merchandise_discount_total, 10_000);
  assert.equal(quote.shipping_payable, 15_000);
});

test('does not let shipping unlock a merchandise-value promotion', () => {
  const freeShipping = convertLegacyPromotionRule({
    type: 'FREE_SHIPPING',
    conditions: [{ attribute: 'cart.total_value', operator: 'GTE', value: '100' }],
    action: { type: 'FREE_SHIPPING', value: 0 },
    name: 'Free Shipping Over Rs. 100',
  });
  const quote = evaluatePromotionQuote(
    [line('A', 1, 4_000)],
    [campaign(4, freeShipping)],
    [],
    { shippingAmount: 15_000 },
  );

  assert.equal(quote.applied_promotions.length, 0);
  assert.equal(quote.discount_total, 0);
  assert.equal(quote.payable_total, 19_000);
  assert.ok(quote.rejected_candidates.some((item) =>
    item.promotion_id === 4 && item.reason_code === 'MINIMUM_VALUE_NOT_MET'
  ));
});

test('ORDER_TOTAL qualification also excludes shipping', () => {
  const freeShipping = rule({
    qualifier: {
      scope: { include: [{ facet: 'ENTIRE_CART', values: ['*'] }], exclude: [], group_operator: 'OR' },
      metric: 'ORDER_TOTAL', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_value: 10_000,
    },
    benefit: { type: 'FREE_SHIPPING', target: 'ALL_QUALIFYING_UNITS' },
  });
  const quote = evaluatePromotionQuote(
    [line('A', 1, 4_000)],
    [campaign(5, freeShipping)],
    [],
    { shippingAmount: 15_000 },
  );

  assert.equal(quote.applied_promotions.length, 0);
  assert.equal(quote.payable_total, 19_000);
});

test('applies compatible offers to different products', () => {
  const offerA = rule({ qualifier: { scope: { include: [{ facet: 'PRODUCT', values: ['A'] }], exclude: [], group_operator: 'OR' }, metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1 } });
  const offerB = rule({ qualifier: { scope: { include: [{ facet: 'PRODUCT', values: ['B'] }], exclude: [], group_operator: 'OR' }, metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1 }, benefit: { type: 'PERCENT_OFF', value: 20, target: 'ALL_QUALIFYING_UNITS', fulfilment: 'AUTO_ADD', out_of_stock_policy: 'REMOVE_PROMOTION' } });
  const quote = evaluatePromotionQuote([line('A', 1, 10_000), line('B', 1, 10_000)], [campaign(1, offerA), campaign(2, offerB)], []);
  assert.deepEqual(quote.applied_promotions.map((item) => item.promotion_id), [1, 2]);
  assert.equal(quote.discount_total, 3_000);
});

test('applies a fixed amount only to selected products', () => {
  const fixedProductOffer = rule({
    qualifier: {
      scope: { include: [{ facet: 'PRODUCT', values: ['A'] }], exclude: [], group_operator: 'OR' },
      metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1,
    },
    benefit: { type: 'FIXED_AMOUNT_OFF', value: 1_000, target: 'ALL_QUALIFYING_UNITS' },
  });
  const quote = evaluatePromotionQuote(
    [line('A', 1, 10_000), line('B', 1, 20_000)],
    [campaign(1, fixedProductOffer)],
    [],
  );

  assert.equal(quote.discount_total, 1_000);
  assert.deepEqual(quote.adjustments.map((item) => item.product_id), ['A']);
});

test('caps a targeted percentage once across all selected categories', () => {
  const cappedCategoryOffer = rule({
    qualifier: {
      scope: { include: [{ facet: 'CATEGORY', values: ['incense', 'gifts'] }], exclude: [], group_operator: 'OR' },
      metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1,
    },
    benefit: { type: 'PERCENT_OFF', value: 20, target: 'ALL_QUALIFYING_UNITS' },
    limits: { maximum_discount_amount: 5_000 },
  });
  const incense = line('A', 1, 20_000, 'incense');
  const gift = line('B', 1, 30_000, 'gifts');
  const unrelated = line('C', 1, 40_000, 'decor');

  const quote = evaluatePromotionQuote(
    [incense, gift, unrelated],
    [campaign(1, cappedCategoryOffer)],
    [],
  );

  assert.equal(quote.discount_total, 5_000);
  assert.deepEqual(
    quote.adjustments
      .map((item) => ({ productId: item.product_id, amount: item.amount }))
      .sort((left, right) => String(left.productId).localeCompare(String(right.productId))),
    [{ productId: 'A', amount: 2_000 }, { productId: 'B', amount: 3_000 }],
  );
});

test('keeps the calculated targeted percentage when it is below the cap', () => {
  const cappedProductOffer = rule({
    qualifier: {
      scope: { include: [{ facet: 'PRODUCT', values: ['A'] }], exclude: [], group_operator: 'OR' },
      metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1,
    },
    benefit: { type: 'PERCENT_OFF', value: 10, target: 'ALL_QUALIFYING_UNITS' },
    limits: { maximum_discount_amount: 5_000 },
  });

  const quote = evaluatePromotionQuote(
    [line('A', 1, 20_000), line('B', 1, 20_000)],
    [campaign(1, cappedProductOffer)],
    [],
  );

  assert.equal(quote.discount_total, 2_000);
  assert.deepEqual(quote.adjustments.map((item) => item.product_id), ['A']);
});

test('caps a subcategory percentage and leaves unrelated lines unchanged', () => {
  const cappedSubcategoryOffer = rule({
    qualifier: {
      scope: { include: [{ facet: 'SUBCATEGORY', values: ['sticks'] }], exclude: [], group_operator: 'OR' },
      metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1,
    },
    benefit: { type: 'PERCENT_OFF', value: 25, target: 'ALL_QUALIFYING_UNITS' },
    limits: { maximum_discount_amount: 1_500 },
  });
  const eligible = {
    ...line('A', 2, 5_000),
    facets: { CATEGORY: ['incense'], SUBCATEGORY: ['sticks'] },
  };
  const unrelated = {
    ...line('B', 1, 10_000),
    facets: { CATEGORY: ['incense'], SUBCATEGORY: ['cones'] },
  };

  const quote = evaluatePromotionQuote(
    [eligible, unrelated],
    [campaign(1, cappedSubcategoryOffer)],
    [],
  );

  assert.equal(quote.discount_total, 1_500);
  assert.deepEqual([...new Set(quote.adjustments.map((item) => item.product_id))], ['A']);
  assert.equal(
    quote.adjustments.reduce((sum, item) => sum + item.amount, 0),
    1_500,
  );
});

test('rejects a promotion when the current order exceeds its remaining budget', () => {
  const tenPercent = rule({
    benefit: { type: 'PERCENT_OFF', value: 10, target: 'ALL_QUALIFYING_UNITS' },
  });
  const limitedCampaign = {
    ...campaign(1, tenPercent),
    remainingBudgetPaise: 999,
  };
  const quote = evaluatePromotionQuote(
    [line('A', 1, 10_000)],
    [limitedCampaign],
    [],
  );

  assert.equal(quote.discount_total, 0);
  assert.ok(quote.rejected_candidates.some((item) =>
    item.promotion_id === 1 && item.reason_code === 'BUDGET_EXHAUSTED'
  ));
});

test('allows a promotion when its current discount exactly fits the remaining budget', () => {
  const tenPercent = rule({
    benefit: { type: 'PERCENT_OFF', value: 10, target: 'ALL_QUALIFYING_UNITS' },
  });
  const limitedCampaign = {
    ...campaign(1, tenPercent),
    remainingBudgetPaise: 1_000,
  };
  const quote = evaluatePromotionQuote(
    [line('A', 1, 10_000)],
    [limitedCampaign],
    [],
  );

  assert.equal(quote.discount_total, 1_000);
});

test('rejects invalid or ambiguous tier definitions', () => {
  assert.throws(() => rule({ benefit: undefined, tiers: [
    { minimum: 3, benefit: { type: 'PERCENT_OFF', value: 15, target: 'ALL_QUALIFYING_UNITS', fulfilment: 'AUTO_ADD', out_of_stock_policy: 'REMOVE_PROMOTION' } },
    { minimum: 2, benefit: { type: 'PERCENT_OFF', value: 10, target: 'ALL_QUALIFYING_UNITS', fulfilment: 'AUTO_ADD', out_of_stock_policy: 'REMOVE_PROMOTION' } },
  ] }));
});

test('rejects targeting facets outside the approved scope', () => {
  for (const facet of ['FRAGRANCE', 'BRAND', 'COLLECTION', 'TAG', 'SUBSUBCATEGORY']) {
    assert.throws(() => rule({ qualifier: {
      scope: { include: [{ facet: facet as 'PRODUCT', values: ['excluded'] }], exclude: [], group_operator: 'OR' },
      metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1,
    } }));
  }
});

test('supports category and subcategory include/exclude selectors', () => {
  const scoped = rule({ qualifier: {
    scope: { include: [{ facet: 'CATEGORY', values: ['incense'] }], exclude: [{ facet: 'SUBCATEGORY', values: ['cones'] }], group_operator: 'AND' },
    metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1,
  } });
  const eligible = { ...line('A', 1, 10_000), facets: { CATEGORY: ['incense'], SUBCATEGORY: ['sticks'] } };
  const excluded = { ...line('B', 1, 10_000), facets: { CATEGORY: ['incense'], SUBCATEGORY: ['cones'] } };
  const quote = evaluatePromotionQuote([eligible, excluded], [campaign(1, scoped)], []);
  assert.equal(quote.discount_total, 1_000);
  assert.deepEqual(quote.adjustments.map((item) => item.product_id), ['A']);
});

test('evaluates per-product quantity independently', () => {
  const perProduct = rule({ qualifier: {
    scope: { include: [{ facet: 'CATEGORY', values: ['incense'] }], exclude: [], group_operator: 'OR' },
    metric: 'PER_PRODUCT_QUANTITY', aggregation: 'PER_PRODUCT', minimum_quantity: 2,
  } });
  const quote = evaluatePromotionQuote([line('A', 2, 10_000), line('B', 1, 20_000)], [campaign(1, perProduct)], []);
  assert.equal(quote.discount_total, 2_000);
  assert.ok(quote.rejected_candidates.some((item) => item.reason_code === 'MINIMUM_QUANTITY_NOT_MET'));
});

test('allocates an overlapping category offer to remaining products', () => {
  const productOffer = rule({ qualifier: { scope: { include: [{ facet: 'PRODUCT', values: ['A'] }], exclude: [], group_operator: 'OR' }, metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1 }, benefit: { type: 'PERCENT_OFF', value: 20, target: 'ALL_QUALIFYING_UNITS' } });
  const categoryOffer = rule({ qualifier: { scope: { include: [{ facet: 'CATEGORY', values: ['incense'] }], exclude: [], group_operator: 'OR' }, metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1 }, benefit: { type: 'PERCENT_OFF', value: 10, target: 'ALL_QUALIFYING_UNITS' } });
  const quote = evaluatePromotionQuote([line('A', 1, 10_000), line('B', 1, 10_000)], [campaign(1, productOffer), campaign(2, categoryOffer)], []);
  assert.equal(quote.discount_total, 3_000);
  assert.deepEqual(quote.applied_promotions.map((item) => item.promotion_id), [1, 2]);
});

test('requires paid plus free units when discounting an existing BOGO item', () => {
  const bogo = rule({ qualifier: { scope: { include: [{ facet: 'PRODUCT', values: ['A'] }], exclude: [], group_operator: 'OR' }, metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1 }, benefit: { type: 'FREE_ITEM', quantity: 1, target: 'SAME_PRODUCT_AS_QUALIFIER', fulfilment: 'DISCOUNT_EXISTING' } });
  assert.equal(evaluatePromotionQuote([line('A', 1, 10_000)], [campaign(1, bogo)], [line('A', 0, 10_000)]).discount_total, 0);
  assert.equal(evaluatePromotionQuote([line('A', 2, 10_000)], [campaign(1, bogo)], [line('A', 0, 10_000)]).discount_total, 10_000);
});

test('returns deterministic totals and promotion order regardless of input ordering', () => {
  const offers = [campaign(2, rule({ benefit: { type: 'PERCENT_OFF', value: 5, target: 'ALL_QUALIFYING_UNITS' } })), campaign(1, rule({ benefit: { type: 'PERCENT_OFF', value: 10, target: 'ALL_QUALIFYING_UNITS' } }))];
  const forward = evaluatePromotionQuote([line('B', 2, 5_000), line('A', 1, 10_000)], offers, []);
  const reverse = evaluatePromotionQuote([line('A', 1, 10_000), line('B', 2, 5_000)], [...offers].reverse(), []);
  assert.equal(forward.discount_total, reverse.discount_total);
  assert.deepEqual(forward.applied_promotions.map((item) => item.promotion_id), reverse.applied_promotions.map((item) => item.promotion_id));
});

test('evaluates more than one hundred active promotions without changing the best-value rule', () => {
  const offers = Array.from({ length: 120 }, (_, index) => campaign(index + 1, rule({ benefit: { type: 'PERCENT_OFF', value: (index % 100) + 1, target: 'ALL_QUALIFYING_UNITS' } })));
  const quote = evaluatePromotionQuote([line('A', 1, 10_000)], offers, []);
  assert.equal(quote.discount_total, 10_000);
  assert.deepEqual(quote.applied_promotions.map((item) => item.promotion_id), [100]);
});

// --- Whole-order (cart-level) offers: applied in full or not at all -------
// Mirrors the reported cart: 5 incense lines (Rs. 1,270) and 4 other lines
// (Rs. 2,284). "Flat 100 On 1299" is a non-stackable FIXED_AMOUNT_OFF_CART
// offer; "10% off Incense Rituals" is an automatic stackable category offer.
const wholeOrderCart = (): PromotionCartLine[] => [
  line('69', 3, 5_000), line('66', 1, 10_000), line('58', 1, 12_000), line('55', 1, 50_000), line('76', 2, 20_000),
  line('27', 1, 12_500, 'home'), line('21', 1, 6_000, 'home'), line('18', 1, 29_900, 'home'), line('72', 1, 180_000, 'home'),
];
const legacyCartOffer = (value: number, stackable: boolean, name: string) => convertLegacyPromotionRule({
  type: 'FIXED_AMOUNT_OFF_CART',
  conditions: [{ attribute: 'cart.total_value', operator: 'GTE', value: '1299' }],
  action: { type: 'FIXED_AMOUNT_OFF', value },
  stackable,
  name,
});
const wholeOrder = (promotionId: number, promotionRule: PromotionRuleV2, name: string): PromotionCampaign => ({
  ...campaign(promotionId, promotionRule, name), appliesToWholeOrder: true,
});
const incenseTenPercent = rule({
  qualifier: { scope: { include: [{ facet: 'CATEGORY', values: ['incense'] }], exclude: [], group_operator: 'OR' }, metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1 },
  benefit: { type: 'PERCENT_OFF', value: 10, target: 'ALL_QUALIFYING_UNITS' },
  stacking: { stackable: true, exclusive_group: 'MERCHANDISE_DISCOUNT', item_reuse: 'DISALLOW', selection_strategy: 'BEST_CUSTOMER_VALUE', priority: 1 },
});

test('whole-order non-stackable offer is not applied partially when a better offer covers some items', () => {
  const quote = evaluatePromotionQuote(
    wholeOrderCart(),
    [wholeOrder(77, legacyCartOffer(100, false, 'Flat 100 On 1299'), 'Flat 100 On 1299'), campaign(75, incenseTenPercent, '10% off Incense')],
    [],
  );
  // Rs. 127 (10% on incense) beats Rs. 100: Flat 100 is not applied at all (previously Rs. 64.24 was applied).
  assert.deepEqual(quote.applied_promotions.map((item) => item.promotion_id), [75]);
  assert.equal(quote.merchandise_discount_total, 12_700);
  assert.equal(quote.adjustments.some((adjustment) => adjustment.promotion_id === 77), false);
  assert.deepEqual(quote.eligible_alternatives, [{ promotion_id: 77, name: 'Flat 100 On 1299', saving: 10_000 }]);
  assert.ok(quote.rejected_candidates.some((item) => item.promotion_id === 77 && item.reason_code === 'CONFLICTED_WITH_BETTER_OFFER'));
});

test('whole-order non-stackable offer applies in full and replaces a smaller conflicting offer', () => {
  // Automatic offer saving only Rs. 50 (10% on the Rs. 500 incense pack).
  const smallAutomatic = rule({
    qualifier: { scope: { include: [{ facet: 'PRODUCT', values: ['55'] }], exclude: [], group_operator: 'OR' }, metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1 },
    benefit: { type: 'PERCENT_OFF', value: 10, target: 'ALL_QUALIFYING_UNITS' },
    stacking: { stackable: true, exclusive_group: 'MERCHANDISE_DISCOUNT', item_reuse: 'DISALLOW', selection_strategy: 'BEST_CUSTOMER_VALUE', priority: 1 },
  });
  const quote = evaluatePromotionQuote(
    wholeOrderCart(),
    [wholeOrder(77, legacyCartOffer(100, false, 'Flat 100 On 1299'), 'Flat 100 On 1299'), campaign(80, smallAutomatic, '10% off pack')],
    [],
  );
  assert.deepEqual(quote.applied_promotions, [{ promotion_id: 77, name: 'Flat 100 On 1299', saving: 10_000 }]);
  assert.equal(quote.merchandise_discount_total, 10_000);
});

test('whole-order stackable offer still combines in full with stackable item offers', () => {
  const quote = evaluatePromotionQuote(
    wholeOrderCart(),
    [wholeOrder(61, legacyCartOffer(149, true, '149 Off'), '149 Off'), campaign(75, incenseTenPercent, '10% off Incense')],
    [],
  );
  assert.deepEqual(quote.applied_promotions.map((item) => item.promotion_id), [61, 75]);
  assert.equal(quote.merchandise_discount_total, 14_900 + 12_700);
});

test('whole-order non-stackable offer still combines with free shipping', () => {
  const freeShipping = convertLegacyPromotionRule({
    type: 'FREE_SHIPPING',
    conditions: [{ attribute: 'cart.total_value', operator: 'GTE', value: '250' }],
    action: { type: 'FREE_SHIPPING', value: 0 },
    stackable: true,
    name: 'Free Shipping',
  });
  const quote = evaluatePromotionQuote(
    wholeOrderCart(),
    [wholeOrder(77, legacyCartOffer(100, false, 'Flat 100 On 1299'), 'Flat 100 On 1299'), campaign(70, freeShipping, 'Free Shipping')],
    [],
    { shippingAmount: 15_000 },
  );
  assert.deepEqual(quote.applied_promotions.map((item) => item.promotion_id).sort((a, b) => a - b), [70, 77]);
  assert.equal(quote.merchandise_discount_total, 10_000);
  assert.equal(quote.shipping_discount_total, 15_000);
});

test('whole-order percentage cart offer is also all or nothing', () => {
  const percentCart = convertLegacyPromotionRule({
    type: 'PERCENT_OFF_CART',
    conditions: [{ attribute: 'cart.total_value', operator: 'GTE', value: '1000' }],
    action: { type: 'PERCENT_OFF', value: 2 },
    stackable: false,
    name: '2% Off Cart',
  });
  const quote = evaluatePromotionQuote(
    wholeOrderCart(),
    [wholeOrder(62, percentCart, '2% Off Cart'), campaign(75, incenseTenPercent, '10% off Incense')],
    [],
  );
  // 2% of Rs. 3,554 = Rs. 71.08 < Rs. 127, so the cart offer is not applied partially.
  assert.deepEqual(quote.applied_promotions.map((item) => item.promotion_id), [75]);
  assert.equal(quote.adjustments.some((adjustment) => adjustment.promotion_id === 62), false);
});

test('item-level offers without the whole-order flag keep per-item selection', () => {
  const nonStackableItem = rule({
    qualifier: { scope: { include: [{ facet: 'CATEGORY', values: ['home'] }], exclude: [], group_operator: 'OR' }, metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1 },
    benefit: { type: 'PERCENT_OFF', value: 5, target: 'ALL_QUALIFYING_UNITS' },
    stacking: { stackable: false, exclusive_group: 'MERCHANDISE_DISCOUNT', item_reuse: 'DISALLOW', selection_strategy: 'BEST_CUSTOMER_VALUE', priority: 1 },
  });
  const quote = evaluatePromotionQuote(wholeOrderCart(), [campaign(79, nonStackableItem, '5% Home'), campaign(75, incenseTenPercent, '10% off Incense')], []);
  // Different items, no overlap: both apply exactly as before.
  assert.deepEqual(quote.applied_promotions.map((item) => item.promotion_id), [75, 79]);
});

test('identifies whole-order promotion types', async () => {
  const { isWholeOrderPromotionType } = await import('../src/utils/legacy-promotion-v2.js');
  assert.equal(isWholeOrderPromotionType('FIXED_AMOUNT_OFF_CART'), true);
  assert.equal(isWholeOrderPromotionType('percent_off_cart'), true);
  assert.equal(isWholeOrderPromotionType('PERCENT_OFF_ITEM'), false);
  assert.equal(isWholeOrderPromotionType('FIXED_AMOUNT_OFF_ITEM'), false);
  assert.equal(isWholeOrderPromotionType('FREE_SHIPPING'), false);
  assert.equal(isWholeOrderPromotionType('BOGO'), false);
  assert.equal(isWholeOrderPromotionType(null), false);
  // Admin template keys and scope facets are never whole-order promotion types.
  for (const value of ['PERCENT_OFF_PRODUCTS', 'FIXED_AMOUNT_OFF_PRODUCTS', 'PERCENT_OFF_CATEGORIES', 'PERCENT_OFF_SUBCATEGORIES', 'FREE_PRODUCT', 'ENTIRE_CART']) {
    assert.equal(isWholeOrderPromotionType(value), false, value);
  }
});
