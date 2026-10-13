import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateV2OrderlinePromotions, quoteLineAmounts, type V2PromotionLine } from './orderlinePromotionAllocation.js';

const line = (id: number, productId: string, productAmount: number, storedPromotionAmount: number, productDiscountAmount = 0): V2PromotionLine =>
  ({ id, productId, productAmount, productDiscountAmount, storedPromotionAmount });
const payable = (lines: V2PromotionLine[], allocation: Map<number, number>) =>
  Object.fromEntries(lines.map((item) => [item.id, Math.round((item.productAmount - item.productDiscountAmount - allocation.get(item.id)!) * 100) / 100]));

// Order 175 (dev, 2026-10-12): CAR DIFUSER 25% on 89, Home Diffuser 25% on 90,
// NIV100 on all, FESTIVE SALES 10% only on 44, Free Shipping.
const order175Adjustments = [
  { type: 'FREE_SHIPPING', amount: 15000 },
  { type: 'PERCENT_DISCOUNT', product_id: '89', amount: 70000 },
  { type: 'PERCENT_DISCOUNT', product_id: '90', amount: 45000 },
  { type: 'FIXED_AMOUNT_DISCOUNT', product_id: '44', amount: 107 },
  { type: 'FIXED_AMOUNT_DISCOUNT', product_id: '89', amount: 6021 },
  { type: 'FIXED_AMOUNT_DISCOUNT', product_id: '90', amount: 3872 },
  { type: 'PERCENT_DISCOUNT', product_id: '44', amount: 500 },
];
const order175Lines = [line(263, '89', 2800, 760.21), line(264, '90', 1800, 488.72), line(265, '44', 50, 6.07)];

test('order 175 keeps the quote amount on each line', () => {
  const allocation = allocateV2OrderlinePromotions(order175Lines, order175Adjustments, 1255)!;
  assert.deepEqual(Object.fromEntries(allocation), { 263: 760.21, 264: 488.72, 265: 6.07 });
  assert.deepEqual(payable(order175Lines, allocation), { 263: 2039.79, 264: 1311.28, 265: 43.93 });
});

// Plan TC-P02 cart: Diffuser A 1,000 x 2 + Candle 500; P1 25% Diffusers, P2 10% cart, P3 Rs. 100.
const planAdjustments = [
  { type: 'PERCENT_DISCOUNT', product_id: 'A', amount: 25000 },
  { type: 'PERCENT_DISCOUNT', product_id: 'A', amount: 25000 },
  { type: 'FIXED_AMOUNT_DISCOUNT', product_id: 'A', amount: 8000 },
  { type: 'FIXED_AMOUNT_DISCOUNT', product_id: 'C', amount: 2000 },
  { type: 'PERCENT_DISCOUNT', product_id: 'C', amount: 5000 },
];
const planLines = [line(1, 'A', 2000, 580), line(2, 'C', 500, 70)];

test('TC-N16 / TC-N17: item-wise amounts and per-unit refund values', () => {
  const allocation = allocateV2OrderlinePromotions(planLines, planAdjustments, 650)!;
  const lines = payable(planLines, allocation);
  assert.deepEqual(lines, { 1: 1420, 2: 430 });
  assert.equal(lines[1]! / 2, 710);
  assert.equal(lines[2]! / 1, 430);
});

test('TC-N19: a direct coupon is spread on what is left after promotions; promotion amounts unchanged', () => {
  const allocation = allocateV2OrderlinePromotions(planLines, planAdjustments, 750)!;
  // Rs. 100 coupon on Rs. 1,420 + Rs. 430 left: 76.75 + 23.25.
  assert.deepEqual(Object.fromEntries(allocation), { 1: 656.75, 2: 93.25 });
  const lines = payable(planLines, allocation);
  assert.equal(lines[1]! + lines[2]!, 1750);
});

test('a product (MRP) discount is not available for the coupon share', () => {
  const lines = [line(1, 'A', 2000, 580, 200), line(2, 'C', 500, 70)];
  const allocation = allocateV2OrderlinePromotions(lines, planAdjustments, 750)!;
  // Left after discounts: 1,220 and 430 -> 73.93 (rounded down) + 26.07.
  assert.deepEqual(Object.fromEntries(allocation), { 1: 653.93, 2: 96.07 });
});

test('only line discounts count: free shipping and auto-added gifts are not on any line', () => {
  const amounts = quoteLineAmounts([
    { type: 'FREE_SHIPPING', amount: 15000 },
    { type: 'FREE_ITEM', product_id: 'G', amount: 30000, metadata: { fulfilment: 'AUTO_ADD' } },
    { type: 'FREE_ITEM', product_id: 'A', amount: 10000, metadata: { fulfilment: 'DISCOUNT_EXISTING' } },
    { type: 'PERCENT_DISCOUNT', product_id: 'A', amount: 500 },
  ]);
  assert.deepEqual(Object.fromEntries(amounts), { A: 10500 });
});

test('a paisa of rounding between the lines and the header lands on the last line', () => {
  const allocation = allocateV2OrderlinePromotions(planLines, planAdjustments, 649.99)!;
  assert.deepEqual(Object.fromEntries(allocation), { 1: 580, 2: 69.99 });
});

test('falls back to the proportional split when the lines do not hold the quote amounts', () => {
  // Lines already flattened by the old proportional pass.
  const flattened = [line(263, '89', 2800, 754.03), line(264, '90', 1800, 484.73), line(265, '44', 50, 16.24)];
  assert.equal(allocateV2OrderlinePromotions(flattened, order175Adjustments, 1255), undefined);
  // A quoted product with no order line.
  assert.equal(allocateV2OrderlinePromotions(order175Lines.slice(0, 2), order175Adjustments, 1255), undefined);
  // Header lower than the quote amounts.
  assert.equal(allocateV2OrderlinePromotions(planLines, planAdjustments, 600), undefined);
  // Coupon larger than what is left on the lines.
  assert.equal(allocateV2OrderlinePromotions(planLines, planAdjustments, 2600), undefined);
  assert.equal(allocateV2OrderlinePromotions([], planAdjustments, 650), undefined);
});

test('an order with no promotion keeps zero on every line', () => {
  const lines = [line(1, 'A', 1000, 0), line(2, 'C', 500, 0)];
  const allocation = allocateV2OrderlinePromotions(lines, [{ type: 'FREE_SHIPPING', amount: 15000 }], 0)!;
  assert.deepEqual(Object.fromEntries(allocation), { 1: 0, 2: 0 });
});
