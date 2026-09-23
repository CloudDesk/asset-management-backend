import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildLinePromotionBreakdowns,
  buildOrderCostBreakdown,
} from './order-cost-breakdown.js';

test('builds separate V2 merchandise, free-item, and shipping promotion rows', () => {
  const result = buildOrderCostBreakdown(
    {
      original_total: 1200,
      orderamount: 900,
      discountamount: 150,
      promotion_discount_total: 100,
      shipping_cost: 0,
      total_gst_amount: 137.29,
    },
    [{ original_price: 1200, quantity: 1, product_discount_amount: 50 }],
    [
      { promotion_id: 11, discount_amount: 100, promotion: { name: 'Festival offer', type: 'CART', code: 'FESTIVE' } },
      { promotion_id: 12, discount_amount: 150, promotion: { name: 'Delivery and gift', type: 'STACKABLE' } },
    ],
    [{
      applied_promotions: [
        { promotion_id: 11, name: 'Festival offer' },
        { promotion_id: 12, name: 'Delivery and gift' },
      ],
      adjustments: [
        { promotionId: 11, adjustmentType: 'PERCENT_DISCOUNT', amount: 100, promotion: { name: 'Festival offer', code: 'FESTIVE' } },
        { promotionId: 12, adjustmentType: 'FREE_ITEM', amount: 100, promotion: { name: 'Delivery and gift' } },
        { promotionId: 12, adjustmentType: 'FREE_SHIPPING', amount: 50, promotion: { name: 'Delivery and gift' } },
      ],
    }],
  );

  assert.deepEqual(result.promotions, [
    {
      promotion_id: 11,
      promotion_name: 'Festival offer',
      coupon_code: 'FESTIVE',
      discount_type: 'CART',
      merchandise_discount: 100,
      free_item_discount: 0,
      shipping_discount: 0,
      discount_amount: 100,
    },
    {
      promotion_id: 12,
      promotion_name: 'Delivery and gift',
      coupon_code: null,
      discount_type: 'STACKABLE',
      merchandise_discount: 0,
      free_item_discount: 100,
      shipping_discount: 50,
      discount_amount: 150,
    },
  ]);
  assert.equal(result.product_discount, 50);
  assert.equal(result.promotion_discount, 250);
  assert.equal(result.free_item_discount, 100);
  assert.equal(result.shipping_discount, 50);
  assert.equal(result.total_discount, 300);
  assert.equal(result.taxes, 137.29);
  assert.equal(result.final_payable_amount, 900);
});

test('keeps legacy coupon identity and falls back to a combined row for old orders', () => {
  const coupon = buildOrderCostBreakdown(
    { original_total: 500, orderamount: 450, discountamount: 50, promotion_discount_total: 50 },
    [],
    [{
      promotion_id: 7,
      discount_amount: 50,
      voucher_code: 'SAVE50',
      redemption_data: { promotion_name: 'Save fifty', voucher_code: 'SAVE50' },
      promotion: { name: 'Renamed promotion', type: 'FIXED_AMOUNT' },
    }],
    [],
  );
  assert.equal(coupon.promotions[0]?.promotion_name, 'Save fifty');
  assert.equal(coupon.promotions[0]?.coupon_code, 'SAVE50');
  assert.equal(coupon.promotions[0]?.merchandise_discount, 50);

  const oldOrder = buildOrderCostBreakdown(
    { original_total: 500, orderamount: 475, discountamount: 25, promotion_discount_total: 25 },
    [],
    [],
    [],
  );
  assert.equal(oldOrder.promotions[0]?.discount_type, 'LEGACY_COMBINED');
  assert.equal(oldOrder.promotions[0]?.discount_amount, 25);
});

test('reports the remaining payable amount after wallet credit', () => {
  const result = buildOrderCostBreakdown(
    {
      original_total: 260,
      orderamount: 234,
      promotion_discount_total: 126,
      discountamount: 126,
      shipping_cost: 150,
      wallet_discount_total: 50,
    },
    [],
    [],
    [],
  );

  assert.equal(result.final_payable_amount, 234);
});

test('allocates each promotion across lines while preserving line and promotion totals', () => {
  const promotions = [
    {
      promotion_id: 18,
      promotion_name: '10% Off Festive Offer',
      coupon_code: null,
      discount_type: 'PERCENT_OFF_CART',
      merchandise_discount: 26,
      free_item_discount: 0,
      shipping_discount: 0,
      discount_amount: 26,
    },
    {
      promotion_id: 42,
      promotion_name: 'NIV 100',
      coupon_code: null,
      discount_type: 'FIXED_AMOUNT_OFF_CART',
      merchandise_discount: 100,
      free_item_discount: 0,
      shipping_discount: 0,
      discount_amount: 100,
    },
  ];
  const result = buildLinePromotionBreakdowns(
    [
      { id: 1, promotion_discount_amount: 48.46 },
      { id: 2, promotion_discount_amount: 19.39 },
      { id: 3, promotion_discount_amount: 58.15 },
    ],
    promotions,
  );

  assert.deepEqual(result.get(2)?.map((row) => ({
    name: row.promotion_name,
    amount: row.discount_amount,
  })), [
    { name: '10% Off Festive Offer', amount: 4 },
    { name: 'NIV 100', amount: 15.39 },
  ]);

  for (const [lineId, expected] of [[1, 48.46], [2, 19.39], [3, 58.15]] as const) {
    const total = result.get(lineId)?.reduce((sum, row) => sum + row.discount_amount, 0) ?? 0;
    assert.equal(Math.round(total * 100) / 100, expected);
  }

  for (const promotion of promotions) {
    const total = [...result.values()].flat()
      .filter((row) => row.promotion_id === promotion.promotion_id)
      .reduce((sum, row) => sum + row.discount_amount, 0);
    assert.equal(Math.round(total * 100) / 100, promotion.discount_amount);
  }
});
