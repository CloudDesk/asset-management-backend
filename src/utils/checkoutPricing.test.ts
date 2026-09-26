import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCheckoutPricing,
  checkoutAmountsMatch,
  checkoutCartQuantitiesMatch,
  resolvePromotionRedemptionAmounts,
  uniqueCheckoutEvaluationIds,
} from './checkoutPricing.js';

test('accepts the same payment amount after paise normalization', () => {
  assert.equal(checkoutAmountsMatch(230, 230.001), true);
});

test('rejects even a one-paise stale payment amount', () => {
  assert.equal(checkoutAmountsMatch(229.99, 230), false);
  assert.equal(checkoutAmountsMatch(230.01, 230), false);
});

test('collapses repeated references to the same canonical evaluation', () => {
  assert.deepEqual(
    uniqueCheckoutEvaluationIds(['eval-1', 'eval-1']),
    ['eval-1'],
  );
  assert.deepEqual(
    uniqueCheckoutEvaluationIds(['eval-1', 'eval-2']),
    ['eval-1', 'eval-2'],
  );
});

test('matches quoted carts after aggregating repeated product lines', () => {
  assert.equal(checkoutCartQuantitiesMatch(
    [
      { productid: 10, quantity: 1 },
      { productid: 10, quantity: 2 },
      { productid: 20, quantity: 1 },
    ],
    [
      { product_id: '10', quantity: 3 },
      { product_id: '20', quantity: 1 },
    ],
  ), true);
});

test('rejects quoted carts with changed quantities, products, or invalid lines', () => {
  const order = [{ productid: 10, quantity: 2 }];
  assert.equal(checkoutCartQuantitiesMatch(order, [{ product_id: 10, quantity: 1 }]), false);
  assert.equal(checkoutCartQuantitiesMatch(order, [{ product_id: 20, quantity: 2 }]), false);
  assert.equal(checkoutCartQuantitiesMatch(order, [{ product_id: 10, quantity: 0 }]), false);
});

test('charges standard shipping when no shipping promotion applies', () => {
  const result = calculateCheckoutPricing({ merchandiseSubtotal: 80 });

  assert.equal(result.merchandise_payable, 80);
  assert.equal(result.shipping_payable, 150);
  assert.equal(result.payable_before_wallet, 230);
});

test('keeps shipping payable when promotions exhaust the merchandise subtotal', () => {
  const result = calculateCheckoutPricing({
    merchandiseSubtotal: 80,
    shippingAmount: 150,
    legacyPromotions: [
      { promotion_id: 1, promotion_type: 'FIXED_AMOUNT_OFF_CART', discount_amount: 80 },
      { promotion_id: 2, promotion_type: 'PERCENT_OFF_CART', discount_amount: 8 },
    ],
  });

  assert.equal(result.merchandise_discount, 80);
  assert.equal(result.shipping_discount, 0);
  assert.equal(result.payable_before_wallet, 150);
});

test('free shipping consumes only the shipping balance', () => {
  const result = calculateCheckoutPricing({
    merchandiseSubtotal: 80,
    shippingAmount: 150,
    legacyPromotions: [
      { promotion_id: 1, promotion_type: 'FIXED_AMOUNT_OFF_CART', discount_amount: 100 },
      { promotion_id: 2, promotion_type: 'FREE_SHIPPING', is_free_shipping: true, discount_amount: 0 },
    ],
  });

  assert.equal(result.merchandise_discount, 80);
  assert.equal(result.shipping_discount, 150);
  assert.equal(result.payable_before_wallet, 0);
});

test('records the authoritative free-shipping saving in redemption history', () => {
  const promotions = [
    { promotion_id: 18, promotion_type: 'PERCENT_OFF_CART', discount_amount: 29.9 },
    { promotion_id: 55, promotion_type: 'FREE_SHIPPING', is_free_shipping: true, discount_amount: 0 },
  ];
  const pricing = calculateCheckoutPricing({
    merchandiseSubtotal: 299,
    shippingAmount: 150,
    legacyPromotions: promotions,
  });

  const amounts = resolvePromotionRedemptionAmounts(promotions, pricing);

  assert.equal(amounts.get(18), 29.9);
  assert.equal(amounts.get(55), 150);
});

test('does not duplicate one shipping saving across multiple shipping promotions', () => {
  const promotions = [
    { promotion_id: 55, promotion_type: 'FREE_SHIPPING', is_free_shipping: true, discount_amount: 0 },
    { promotion_id: 56, promotion_type: 'FREE_SHIPPING', is_free_shipping: true, discount_amount: 0 },
  ];
  const amounts = resolvePromotionRedemptionAmounts(promotions, {
    shipping_discount: 150,
    applied_promotions: promotions,
  });

  assert.equal(amounts.get(55), 150);
  assert.equal(amounts.get(56), 0);
});

test('uses the capped V2 quote totals and rejects a stale cart', () => {
  const result = calculateCheckoutPricing({
    merchandiseSubtotal: 80,
    shippingAmount: 150,
    v2Quote: {
      merchandise_subtotal: 8_000,
      merchandise_discount_total: 8_000,
      shipping_amount: 15_000,
      shipping_discount_total: 0,
    },
  });
  assert.equal(result.payable_before_wallet, 150);

  assert.throws(() => calculateCheckoutPricing({
    merchandiseSubtotal: 81,
    shippingAmount: 150,
    v2Quote: {
      merchandise_subtotal: 8_000,
      merchandise_discount_total: 8_000,
      shipping_amount: 15_000,
      shipping_discount_total: 0,
    },
  }), /PROMOTION_CART_CHANGED/);
});

test('keeps V2 merchandise and free-shipping balances independent', () => {
  const result = calculateCheckoutPricing({
    merchandiseSubtotal: 80,
    v2Quote: {
      merchandise_subtotal: 8_000,
      merchandise_discount_total: 8_000,
      shipping_amount: 15_000,
      shipping_discount_total: 15_000,
    },
  });

  assert.equal(result.merchandise_discount, 80);
  assert.equal(result.shipping_discount, 150);
  assert.equal(result.payable_before_wallet, 0);
});

test('applies a partial merchandise discount without reducing shipping', () => {
  const result = calculateCheckoutPricing({
    merchandiseSubtotal: 100,
    legacyPromotions: [
      { promotion_id: 1, promotion_type: 'FIXED_AMOUNT_OFF_CART', discount_amount: 40 },
    ],
  });

  assert.equal(result.merchandise_payable, 60);
  assert.equal(result.shipping_payable, 150);
  assert.equal(result.payable_before_wallet, 210);
});

test('deduplicates the same legacy promotion before calculating totals', () => {
  const promotion = {
    promotion_id: 1,
    promotion_type: 'FIXED_AMOUNT_OFF_CART',
    discount_amount: 30,
  };
  const result = calculateCheckoutPricing({
    merchandiseSubtotal: 100,
    legacyPromotions: [promotion, { ...promotion }],
  });

  assert.equal(result.merchandise_discount, 30);
  assert.equal(result.payable_before_wallet, 220);
});

test('ignores invalid negative legacy discounts', () => {
  const result = calculateCheckoutPricing({
    merchandiseSubtotal: 100,
    legacyPromotions: [
      { promotion_id: 1, promotion_type: 'FIXED_AMOUNT_OFF_CART', discount_amount: -50 },
    ],
  });

  assert.equal(result.merchandise_discount, 0);
  assert.equal(result.payable_before_wallet, 250);
});

test('rounds fractional currency values to paise', () => {
  const result = calculateCheckoutPricing({
    merchandiseSubtotal: 99.999,
    shippingAmount: 149.999,
    legacyPromotions: [
      { promotion_id: 1, promotion_type: 'PERCENT_OFF_CART', discount_amount: 33.335 },
    ],
  });

  assert.equal(result.merchandise_subtotal, 100);
  assert.equal(result.merchandise_discount, 33.34);
  assert.equal(result.shipping_amount, 150);
  assert.equal(result.payable_before_wallet, 216.66);
});

test('rejects a V2 quote created with a different shipping amount', () => {
  assert.throws(() => calculateCheckoutPricing({
    merchandiseSubtotal: 100,
    shippingAmount: 150,
    v2Quote: {
      merchandise_subtotal: 10_000,
      merchandise_discount_total: 0,
      shipping_amount: 0,
      shipping_discount_total: 0,
    },
  }), /PROMOTION_SHIPPING_CHANGED/);
});

test('derives separated V2 totals from adjustments when summary fields are absent', () => {
  const result = calculateCheckoutPricing({
    merchandiseSubtotal: 100,
    v2Quote: {
      merchandise_subtotal: 10_000,
      shipping_amount: 15_000,
      adjustments: [
        { type: 'FIXED_AMOUNT_OFF_CART', amount: 4_000 },
        { type: 'FREE_SHIPPING', amount: 15_000 },
      ],
    },
  });

  assert.equal(result.merchandise_discount, 40);
  assert.equal(result.shipping_discount, 150);
  assert.equal(result.payable_before_wallet, 60);
});

test('caps oversized V2 merchandise and shipping discounts independently', () => {
  const result = calculateCheckoutPricing({
    merchandiseSubtotal: 80,
    v2Quote: {
      merchandise_subtotal: 8_000,
      merchandise_discount_total: 20_000,
      shipping_amount: 15_000,
      shipping_discount_total: 30_000,
    },
  });

  assert.equal(result.merchandise_discount, 80);
  assert.equal(result.shipping_discount, 150);
  assert.equal(result.payable_before_wallet, 0);
});

test('does not treat an auto-added free gift as a merchandise discount', () => {
  const result = calculateCheckoutPricing({
    merchandiseSubtotal: 100,
    v2Quote: {
      merchandise_subtotal: 10_000,
      shipping_amount: 15_000,
      adjustments: [
        { type: 'FREE_ITEM', amount: 5_000, metadata: { fulfilment: 'AUTO_ADD' } },
      ],
    },
  });

  assert.equal(result.merchandise_discount, 0);
  assert.equal(result.payable_before_wallet, 250);
});

test('counts a free-existing-item adjustment against merchandise only', () => {
  const result = calculateCheckoutPricing({
    merchandiseSubtotal: 100,
    v2Quote: {
      merchandise_subtotal: 10_000,
      shipping_amount: 15_000,
      adjustments: [
        { type: 'FREE_ITEM', amount: 4_000, metadata: { fulfilment: 'DISCOUNT_EXISTING' } },
      ],
    },
  });

  assert.equal(result.merchandise_discount, 40);
  assert.equal(result.shipping_payable, 150);
  assert.equal(result.payable_before_wallet, 210);
});

test('supports a zero merchandise subtotal without allowing a monetary overflow', () => {
  const result = calculateCheckoutPricing({
    merchandiseSubtotal: 0,
    legacyPromotions: [
      { promotion_id: 1, promotion_type: 'FIXED_AMOUNT_OFF_CART', discount_amount: 100 },
    ],
  });

  assert.equal(result.merchandise_discount, 0);
  assert.equal(result.shipping_payable, 150);
  assert.equal(result.payable_before_wallet, 150);
});
