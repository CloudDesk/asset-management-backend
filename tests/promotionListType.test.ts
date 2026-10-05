import assert from 'node:assert/strict';
import test from 'node:test';
import { isPromotionListType, PROMOTION_LIST_TYPES, promotionListType } from '../src/utils/promotionListType.js';

const scoped = (facet: string, benefit = 'PERCENT_OFF', extra: Record<string, unknown> = {}) => ({
  qualifier: { scope: { include: [{ facet }] }, minimum_quantity: 1 },
  benefit: { type: benefit },
  tiers: [],
  presentation: {},
  ...extra,
});

test('list types follow the create-form order, with OTHER last', () => {
  assert.deepEqual([...PROMOTION_LIST_TYPES], [
    'FREE_SHIPPING', 'FIXED_AMOUNT_OFF_CART', 'PERCENT_OFF_CART', 'PERCENT_OFF_SUBCATEGORIES',
    'PERCENT_OFF_CATEGORIES', 'PERCENT_OFF_PRODUCTS', 'FIXED_AMOUNT_OFF_PRODUCTS', 'OTHER',
  ]);
  assert.equal(isPromotionListType('PERCENT_OFF_ITEM'), false);
  assert.equal(isPromotionListType('PERCENT_OFF_CATEGORIES'), true);
});

test('free shipping and entire-cart offers use the saved type', () => {
  assert.equal(promotionListType('FREE_SHIPPING'), 'FREE_SHIPPING');
  assert.equal(promotionListType('FIXED_AMOUNT_OFF_CART'), 'FIXED_AMOUNT_OFF_CART');
  assert.equal(promotionListType('percent_off_cart'), 'PERCENT_OFF_CART');
  // Even if a rule exists, the saved cart type decides.
  assert.equal(promotionListType('FIXED_AMOUNT_OFF_CART', scoped('PRODUCT')), 'FIXED_AMOUNT_OFF_CART');
});

test('item offers are told apart by their rule template', () => {
  assert.equal(promotionListType('PERCENT_OFF_ITEM', { presentation: { template_type: 'PERCENT_OFF_PRODUCTS' } }), 'PERCENT_OFF_PRODUCTS');
  assert.equal(promotionListType('PERCENT_OFF_ITEM', { presentation: { template_type: 'PERCENT_OFF_CATEGORIES' } }), 'PERCENT_OFF_CATEGORIES');
  assert.equal(promotionListType('PERCENT_OFF_ITEM', { presentation: { template_type: 'PERCENT_OFF_SUBCATEGORIES' } }), 'PERCENT_OFF_SUBCATEGORIES');
  assert.equal(promotionListType('FIXED_AMOUNT_OFF_ITEM', { presentation: { template_type: 'FIXED_AMOUNT_OFF_PRODUCTS' } }), 'FIXED_AMOUNT_OFF_PRODUCTS');
});

test('rules without a template are inferred like the admin badge', () => {
  assert.equal(promotionListType('PERCENT_OFF_ITEM', scoped('CATEGORY')), 'PERCENT_OFF_CATEGORIES');
  assert.equal(promotionListType('PERCENT_OFF_ITEM', scoped('SUBCATEGORY')), 'PERCENT_OFF_SUBCATEGORIES');
  assert.equal(promotionListType('PERCENT_OFF_ITEM', scoped('PRODUCT')), 'PERCENT_OFF_PRODUCTS');
  assert.equal(promotionListType('FIXED_AMOUNT_OFF_ITEM', scoped('PRODUCT', 'FIXED_AMOUNT_OFF')), 'FIXED_AMOUNT_OFF_PRODUCTS');
});

test('types the form no longer creates are grouped as OTHER', () => {
  assert.equal(promotionListType('BOGO', { presentation: { template_type: 'BUY_X_GET_Y_FREE' } }), 'OTHER');
  assert.equal(promotionListType('BOGO'), 'OTHER');
  assert.equal(promotionListType('FREE_PRODUCT'), 'OTHER');
  assert.equal(promotionListType('PERCENT_OFF_ITEM', { presentation: { template_type: 'BUY_X_PERCENT_OFF' } }), 'OTHER');
  assert.equal(promotionListType('PERCENT_OFF_ITEM', { presentation: { template_type: 'QUANTITY_TIERED_PERCENT_OFF' } }), 'OTHER');
  assert.equal(promotionListType('PERCENT_OFF_ITEM', scoped('CATEGORY', 'PERCENT_OFF', { tiers: [{}] })), 'OTHER');
  assert.equal(promotionListType('PERCENT_OFF_ITEM'), 'OTHER');
  assert.equal(promotionListType('PERCENT_OFF_ITEM', scoped('ENTIRE_CART')), 'OTHER');
  assert.equal(promotionListType(null), 'OTHER');
});
