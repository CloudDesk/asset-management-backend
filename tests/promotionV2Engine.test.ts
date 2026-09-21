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

test('auto-adds the same qualifying product after the paid Buy X quantity is reached', () => {
  const buyThreeGetOne = rule({
    qualifier: {
      scope: { include: [{ facet: 'PRODUCT', values: ['incense'] }], exclude: [], group_operator: 'OR' },
      metric: 'PER_PRODUCT_QUANTITY', aggregation: 'PER_PRODUCT', minimum_quantity: 3,
    },
    benefit: { type: 'FREE_ITEM', quantity: 1, target: 'SAME_PRODUCT_AS_QUALIFIER', fulfilment: 'AUTO_ADD', out_of_stock_policy: 'REMOVE_PROMOTION' },
  });
  const incense = line('incense', 3, 4_000);
  const quote = evaluatePromotionQuote([incense], [campaign(31, buyThreeGetOne)], [incense]);

  assert.equal(quote.applied_promotions[0]?.promotion_id, 31);
  assert.equal(quote.adjustments[0]?.product_id, 'incense');
  assert.equal(quote.adjustments[0]?.affected_quantity, 1);
  assert.equal(quote.adjustments[0]?.metadata.fulfilment, 'AUTO_ADD');
  assert.equal(quote.discount_total, 4_000);
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

test('combines overlapping promotions only when both allow combining and item reuse', () => {
  const stacking = {
    stackable: true,
    exclusive_group: 'MERCHANDISE_DISCOUNT',
    item_reuse: 'ALLOW' as const,
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

test('uses ascending priority when stackable promotions cannot reuse the same items', () => {
  const highPrecedence = rule({
    benefit: { type: 'PERCENT_OFF', value: 10, target: 'ALL_QUALIFYING_UNITS' },
    stacking: {
      stackable: true,
      exclusive_group: 'MERCHANDISE_DISCOUNT',
      item_reuse: 'DISALLOW',
      selection_strategy: 'BEST_CUSTOMER_VALUE',
      priority: 1,
    },
  });
  const lowPrecedence = rule({
    benefit: { type: 'PERCENT_OFF', value: 50, target: 'ALL_QUALIFYING_UNITS' },
    stacking: {
      stackable: true,
      exclusive_group: 'MERCHANDISE_DISCOUNT',
      item_reuse: 'DISALLOW',
      selection_strategy: 'BEST_CUSTOMER_VALUE',
      priority: 5,
    },
  });

  const quote = evaluatePromotionQuote(
    [line('A', 1, 10_000)],
    [campaign(1, highPrecedence), campaign(5, lowPrecedence)],
    [],
  );

  assert.deepEqual(quote.applied_promotions.map((item) => item.promotion_id), [1]);
  assert.equal(quote.discount_total, 1_000);
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

  const belowThreshold = evaluatePromotionQuote(
    [line('A', 1, 49_000)],
    [campaign(4, freeShipping)],
    [],
    { shippingAmount: 15_000 },
  );
  assert.deepEqual(belowThreshold.applied_promotions, []);
  assert.equal(belowThreshold.payable_total, 64_000);
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
