import assert from 'node:assert/strict';
import test from 'node:test';
import { PromotionRuleSchema, PromotionRuleV3Schema, PromotionQuantityBreakdownSchema } from './promotions-v3.schema.js';

const buyThreeGetOne = {
  schema_version: 3,
  qualifier: {
    scope: { include: [{ facet: 'PRODUCT', values: ['42'] }], exclude: [], group_operator: 'OR' },
    predicates: [{ field: 'ELIGIBLE_QUANTITY', operator: 'GTE', value: 3 }],
    aggregation: 'PER_PRODUCT',
  },
  benefit: { type: 'FREE_ITEM', quantity: 1, allocation: 'QUALIFYING_UNITS_ONLY' },
  reward: { mode: 'SAME_PRODUCT', product_ids: [], allowed_scope: null, fulfilment: 'AUTO_ADD' },
  repetition: { mode: 'PER_QUALIFYING_SET', maximum_sets_per_order: null },
  conflict_policy: {
    exclusive_group: 'MERCHANDISE_PROMOTIONS', maximum_promotions_from_group: null,
    stackable: false, item_reuse: false, selection_strategy: 'CAMPAIGN_PRIORITY', priority: 1,
  },
  availability_policy: { when_gift_unavailable: 'REMOVE_AND_NOTIFY' },
  presentation: {
    title: 'Buy 3 Get 1 Free',
    progress_template: 'Add {remaining} more to get {free_quantity} free.',
    applied_template: '{free_quantity} free item has been added.',
  },
} as const;

test('accepts the canonical version 3 Buy X Get Y contract', () => {
  const parsed = PromotionRuleV3Schema.parse(buyThreeGetOne);
  assert.equal(parsed.schema_version, 3);
  assert.equal(parsed.reward?.mode, 'SAME_PRODUCT');
});

test('keeps schema version 2 readable during migration', () => {
  const parsed = PromotionRuleSchema.parse({
    schema_version: 2,
    qualifier: {
      scope: { include: [{ facet: 'ENTIRE_CART', values: ['*'] }], exclude: [], group_operator: 'OR' },
      metric: 'ELIGIBLE_QUANTITY', aggregation: 'ACROSS_ELIGIBLE_PRODUCTS', minimum_quantity: 1,
    },
    benefit: { type: 'PERCENT_OFF', value: 10 },
  });
  assert.equal(parsed.schema_version, 2);
});

test('rejects a free-item rule without reward configuration', () => {
  const invalid = { ...buyThreeGetOne, reward: undefined };
  assert.throws(() => PromotionRuleV3Schema.parse(invalid));
});

test('restricts surprise gifts to authenticated packing fulfilment', () => {
  const invalid = {
    ...buyThreeGetOne,
    reward: { mode: 'PACKER_SELECTED_SURPRISE_GIFT', product_ids: [], allowed_scope: null, fulfilment: 'AUTO_ADD' },
  };
  assert.throws(() => PromotionRuleV3Schema.parse(invalid));
});

test('enforces paid, free, and total quantity reconciliation', () => {
  assert.doesNotThrow(() => PromotionQuantityBreakdownSchema.parse({ product_id: '42', paid_quantity: 3, free_quantity: 1, total_quantity: 4 }));
  assert.throws(() => PromotionQuantityBreakdownSchema.parse({ product_id: '42', paid_quantity: 3, free_quantity: 1, total_quantity: 3 }));
});

test('requires strictly increasing quantity tiers and no competing base benefit', () => {
  const tiered = {
    ...buyThreeGetOne,
    benefit: undefined,
    reward: undefined,
    tiers: [
      { minimum_quantity: 2, benefit: { type: 'PERCENT_OFF', value: 10 } },
      { minimum_quantity: 3, benefit: { type: 'PERCENT_OFF', value: 15 } },
    ],
    repetition: { mode: 'ONCE', maximum_sets_per_order: null },
  };
  assert.doesNotThrow(() => PromotionRuleV3Schema.parse(tiered));
  assert.throws(() => PromotionRuleV3Schema.parse({ ...tiered, tiers: [...tiered.tiers].reverse() }));
  assert.throws(() => PromotionRuleV3Schema.parse({ ...tiered, benefit: { type: 'PERCENT_OFF', value: 5 } }));
});

test('requires order-level discounts to target only the entire cart', () => {
  assert.throws(() => PromotionRuleV3Schema.parse({
    ...buyThreeGetOne,
    reward: undefined,
    repetition: { mode: 'ONCE', maximum_sets_per_order: null },
    benefit: { type: 'FIXED_AMOUNT_OFF', value: 1_000, application_level: 'ORDER' },
  }), /entire cart/i);
});

test('accepts a fixed order discount without item allocation settings', () => {
  const parsed = PromotionRuleV3Schema.parse({
    ...buyThreeGetOne,
    reward: undefined,
    repetition: { mode: 'ONCE', maximum_sets_per_order: null },
    qualifier: {
      scope: { include: [{ facet: 'ENTIRE_CART', values: ['*'] }], exclude: [], group_operator: 'OR' },
      predicates: [{ field: 'REMAINING_CART_VALUE', operator: 'GTE', value: 90_000 }],
    },
    benefit: { type: 'FIXED_AMOUNT_OFF', value: 5_000, application_level: 'ORDER' },
  });
  assert.equal(parsed.benefit?.application_level, 'ORDER');
});
