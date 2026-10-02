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

test('maps targeted V2 promotions only to their persisted product adjustments', () => {
  const promotions = [
    {
      promotion_id: 71,
      promotion_name: 'FLAT 100 OFF',
      coupon_code: null,
      discount_type: 'FIXED_AMOUNT_OFF_CART',
      merchandise_discount: 100,
      free_item_discount: 0,
      shipping_discount: 0,
      discount_amount: 100,
    },
    {
      promotion_id: 72,
      promotion_name: 'FLAT 10 % OFF',
      coupon_code: null,
      discount_type: 'PERCENT_OFF_CART',
      merchandise_discount: 322.5,
      free_item_discount: 0,
      shipping_discount: 0,
      discount_amount: 322.5,
    },
    {
      promotion_id: 75,
      promotion_name: '10% off Incense Rituals Category',
      coupon_code: null,
      discount_type: 'PERCENTAGE_OFF_CATEGORIES',
      merchandise_discount: 30,
      free_item_discount: 0,
      shipping_discount: 0,
      discount_amount: 30,
    },
    {
      promotion_id: 70,
      promotion_name: 'Free Shipping',
      coupon_code: null,
      discount_type: 'FREE_SHIPPING',
      merchandise_discount: 0,
      free_item_discount: 0,
      shipping_discount: 150,
      discount_amount: 150,
    },
  ];
  const result = buildLinePromotionBreakdowns(
    [
      { id: 205, productid: 75, quantity: 1, promotion_discount_amount: 23.10 },
      { id: 206, productid: 76, quantity: 1, promotion_discount_amount: 46.21 },
      { id: 207, productid: 71, quantity: 1, promotion_discount_amount: 366.82 },
      { id: 208, productid: 27, quantity: 1, promotion_discount_amount: 16.37 },
    ],
    promotions,
    [{ adjustments: [
      { promotionId: 71, adjustmentType: 'FIXED_AMOUNT_DISCOUNT', productId: 71, amount: 86.82 },
      { promotionId: 71, adjustmentType: 'FIXED_AMOUNT_DISCOUNT', productId: 76, amount: 6.21 },
      { promotionId: 71, adjustmentType: 'FIXED_AMOUNT_DISCOUNT', productId: 27, amount: 3.87 },
      { promotionId: 71, adjustmentType: 'FIXED_AMOUNT_DISCOUNT', productId: 75, amount: 3.10 },
      { promotionId: 72, adjustmentType: 'PERCENT_DISCOUNT', productId: 71, amount: 280 },
      { promotionId: 72, adjustmentType: 'PERCENT_DISCOUNT', productId: 76, amount: 20 },
      { promotionId: 72, adjustmentType: 'PERCENT_DISCOUNT', productId: 27, amount: 12.5 },
      { promotionId: 72, adjustmentType: 'PERCENT_DISCOUNT', productId: 75, amount: 10 },
      { promotionId: 75, adjustmentType: 'PERCENT_DISCOUNT', productId: 76, amount: 20 },
      { promotionId: 75, adjustmentType: 'PERCENT_DISCOUNT', productId: 75, amount: 10 },
      { promotionId: 70, adjustmentType: 'FREE_SHIPPING', amount: 150 },
    ] }],
  );

  assert.deepEqual(result.get(207)?.map((row) => [row.promotion_id, row.discount_amount, row.allocation_method]), [
    [71, 86.82, 'EXACT'],
    [72, 280, 'EXACT'],
  ]);
  assert.deepEqual(result.get(205)?.map((row) => [row.promotion_id, row.discount_amount]), [
    [71, 3.1],
    [72, 10],
    [75, 10],
  ]);
  assert.deepEqual(result.get(206)?.map((row) => [row.promotion_id, row.discount_amount]), [
    [71, 6.21],
    [72, 20],
    [75, 20],
  ]);
  assert.equal(result.get(207)?.some((row) => row.promotion_id === 75), false);
  assert.equal([...result.values()].flat().some((row) => row.promotion_id === 70), false);
});

test('aggregates multiple unit adjustments onto one quantity orderline', () => {
  const promotion = {
    promotion_id: 80,
    promotion_name: 'Selected products',
    coupon_code: null,
    discount_type: 'FIXED_AMOUNT_OFF_SELECTED_PRODUCTS',
    merchandise_discount: 50,
    free_item_discount: 0,
    shipping_discount: 0,
    discount_amount: 50,
  };
  const result = buildLinePromotionBreakdowns(
    [{ id: 10, productid: 99, quantity: 2, promotion_discount_amount: 50 }],
    [promotion],
    [{ adjustments: [
      { promotionId: 80, adjustmentType: 'FIXED_AMOUNT_DISCOUNT', productId: 99, amount: 25 },
      { promotionId: 80, adjustmentType: 'FIXED_AMOUNT_DISCOUNT', productId: 99, amount: 25 },
    ] }],
  );

  assert.deepEqual(result.get(10), [{
    promotion_id: 80,
    promotion_name: 'Selected products',
    coupon_code: null,
    discount_type: 'FIXED_AMOUNT_OFF_SELECTED_PRODUCTS',
    discount_amount: 50,
    allocation_method: 'EXACT',
  }]);
});

for (const [promotionId, discountType] of [
  [84, 'PERCENTAGE_OFF_SUBCATEGORIES'],
  [85, 'PERCENTAGE_OFF_CATEGORIES'],
  [86, 'PERCENTAGE_OFF_SELECTED_PRODUCTS'],
  [87, 'FIXED_AMOUNT_OFF_SELECTED_PRODUCTS'],
] as const) {
  test(`keeps ${discountType} on its eligible orderline`, () => {
    const promotion = {
      promotion_id: promotionId,
      promotion_name: discountType,
      coupon_code: null,
      discount_type: discountType,
      merchandise_discount: 25,
      free_item_discount: 0,
      shipping_discount: 0,
      discount_amount: 25,
    };
    const result = buildLinePromotionBreakdowns(
      [
        { id: 20, productid: 201, promotion_discount_amount: 25 },
        { id: 21, productid: 202, promotion_discount_amount: 0 },
      ],
      [promotion],
      [{ adjustments: [{
        promotionId,
        adjustmentType: discountType.startsWith('FIXED') ? 'FIXED_AMOUNT_DISCOUNT' : 'PERCENT_DISCOUNT',
        productId: 201,
        amount: 25,
      }] }],
    );

    assert.equal(result.get(20)?.[0]?.promotion_id, promotionId);
    assert.equal(result.get(20)?.[0]?.discount_amount, 25);
    assert.equal(result.has(21), false);
  });
}

test('caps an exact adjustment at the persisted line discount so display totals cannot go negative', () => {
  const promotion = {
    promotion_id: 81,
    promotion_name: 'Large selected-product offer',
    coupon_code: null,
    discount_type: 'FIXED_AMOUNT_OFF_SELECTED_PRODUCTS',
    merchandise_discount: 500,
    free_item_discount: 0,
    shipping_discount: 0,
    discount_amount: 500,
  };
  const result = buildLinePromotionBreakdowns(
    [{ id: 11, productid: 100, quantity: 1, promotion_discount_amount: 100 }],
    [promotion],
    [{ adjustments: [
      { promotionId: 81, adjustmentType: 'FIXED_AMOUNT_DISCOUNT', productId: 100, amount: 500 },
    ] }],
  );

  assert.equal(result.get(11)?.[0]?.discount_amount, 100);
});

test('uses exact mappings and proportional legacy fallback together without changing line totals', () => {
  const exactPromotion = {
    promotion_id: 82,
    promotion_name: 'Category offer',
    coupon_code: null,
    discount_type: 'PERCENTAGE_OFF_CATEGORIES',
    merchandise_discount: 30,
    free_item_discount: 0,
    shipping_discount: 0,
    discount_amount: 30,
  };
  const legacyPromotion = {
    promotion_id: 83,
    promotion_name: 'Legacy cart offer',
    coupon_code: null,
    discount_type: 'FIXED_AMOUNT_OFF_CART',
    merchandise_discount: 20,
    free_item_discount: 0,
    shipping_discount: 0,
    discount_amount: 20,
  };
  const result = buildLinePromotionBreakdowns(
    [
      { id: 12, productid: 101, promotion_discount_amount: 40 },
      { id: 13, productid: 102, promotion_discount_amount: 10 },
    ],
    [exactPromotion, legacyPromotion],
    [{ adjustments: [
      { promotionId: 82, adjustmentType: 'PERCENT_DISCOUNT', productId: 101, amount: 30 },
    ] }],
  );

  assert.deepEqual(result.get(12)?.map((row) => [row.promotion_id, row.discount_amount, row.allocation_method]), [
    [82, 30, 'EXACT'],
    [83, 10, 'PROPORTIONAL'],
  ]);
  assert.deepEqual(result.get(13)?.map((row) => [row.promotion_id, row.discount_amount, row.allocation_method]), [
    [83, 10, 'PROPORTIONAL'],
  ]);
});
