import assert from 'node:assert/strict';
import test from 'node:test';
import {
  capLegacyMerchandisePromotions,
  sumLegacyMerchandiseDiscounts,
} from './promotionDiscountCap.js';

test('caps stacked legacy promotion amounts and removes zero-value overflow', () => {
  const applied = capLegacyMerchandisePromotions([
    { promotion_id: 1, promotion_type: 'FIXED_AMOUNT_OFF_CART', discount_amount: 60 },
    { promotion_id: 2, promotion_type: 'FIXED_AMOUNT_OFF_CART', discount_amount: 50 },
    { promotion_id: 3, promotion_type: 'PERCENT_OFF_CART', discount_amount: 8 },
  ], 80);

  assert.deepEqual(applied.map((promotion) => ({
    id: promotion.promotion_id,
    amount: promotion.discount_amount,
  })), [
    { id: 1, amount: 60 },
    { id: 2, amount: 20 },
  ]);
  assert.equal(sumLegacyMerchandiseDiscounts(applied), 80);
});

test('does not let merchandise promotions consume the shipping balance', () => {
  const applied = capLegacyMerchandisePromotions([
    { promotion_id: 1, promotion_type: 'FIXED_AMOUNT_OFF_CART', discount_amount: 100 },
    { promotion_id: 2, promotion_type: 'FREE_SHIPPING', is_free_shipping: true, discount_amount: 150 },
  ], 80);

  assert.deepEqual(applied.map((promotion) => promotion.discount_amount), [80, 150]);
  assert.equal(sumLegacyMerchandiseDiscounts(applied), 80);
});

test('preserves zero-value non-monetary and shipping promotions only', () => {
  const applied = capLegacyMerchandisePromotions([
    { promotion_id: 1, promotion_type: 'FREE_PRODUCT', discount_amount: 0 },
    { promotion_id: 2, promotion_type: 'FREE_SHIPPING', is_free_shipping: true, discount_amount: 0 },
    { promotion_id: 3, promotion_type: 'PERCENT_OFF_CART', discount_amount: 0 },
  ], 0);

  assert.deepEqual(applied.map((promotion) => promotion.promotion_id), [1, 2]);
});

test('caps the persisted line breakdown to the same promotion total', () => {
  const result = capLegacyMerchandisePromotions([
    {
      promotion_id: 1,
      promotion_type: 'FIXED_AMOUNT_OFF_CART',
      discount_amount: 100,
      breakdown: [
        { product_id: '10', quantity: 1, original_price: 60, total_discount: 60 },
        { product_id: '20', quantity: 1, original_price: 40, total_discount: 40 },
      ],
    },
  ], 80);

  assert.equal(result[0].discount_amount, 80);
  assert.deepEqual(
    result[0].breakdown?.map((line) => line.total_discount),
    [48, 32],
  );
  assert.equal(
    result[0].breakdown?.reduce((sum, line) => sum + Number(line.total_discount), 0),
    80,
  );
});

test('keeps cent allocation exact when proportional shares require rounding', () => {
  const result = capLegacyMerchandisePromotions([
    {
      promotion_id: 1,
      promotion_type: 'FIXED_AMOUNT_OFF_CART',
      discount_amount: 1,
      breakdown: [
        { product_id: '10', quantity: 1, original_price: 1, total_discount: 1 },
        { product_id: '20', quantity: 1, original_price: 1, total_discount: 1 },
        { product_id: '30', quantity: 1, original_price: 1, total_discount: 1 },
      ],
    },
  ], 0.10);

  assert.deepEqual(
    result[0].breakdown?.map((line) => line.total_discount),
    [0.04, 0.03, 0.03],
  );
  assert.equal(
    result[0].breakdown?.reduce((sum, line) => sum + Number(line.total_discount), 0),
    0.1,
  );
});
