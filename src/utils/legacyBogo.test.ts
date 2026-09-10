import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateLegacyBogoDiscounts } from './legacyBogo.js';

const buyThreeGetOne = { buy_quantity: 3, get_quantity: 1, max_free_items: 1 };

test('Buy 3 Get 1 discounts one ₹135 unit when displayed quantity is four', () => {
  const allocations = allocateLegacyBogoDiscounts(buyThreeGetOne, [
    { product_id: '58', quantity: 4, price: 135 },
  ]);
  assert.equal(allocations.reduce((sum, allocation) => sum + allocation.discount, 0), 135);
  assert.equal(allocations[0]?.freeItems, 1);
});

test('Buy 3 Get 1 discounts one ₹45 unit when displayed quantity is four', () => {
  const allocations = allocateLegacyBogoDiscounts(buyThreeGetOne, [
    { product_id: '33', quantity: 4, price: 45 },
  ]);
  assert.equal(allocations.reduce((sum, allocation) => sum + allocation.discount, 0), 45);
});

test('Buy 3 Get 1 does not discount a cart containing only three displayed units', () => {
  assert.deepEqual(allocateLegacyBogoDiscounts(buyThreeGetOne, [
    { product_id: '58', quantity: 3, price: 135 },
  ]), []);
});

test('maximum free items is enforced across the order using the highest-priced line', () => {
  const allocations = allocateLegacyBogoDiscounts(buyThreeGetOne, [
    { product_id: '33', quantity: 4, price: 45 },
    { product_id: '58', quantity: 4, price: 135 },
  ]);
  assert.deepEqual(allocations.map(({ item, freeItems, discount }) => ({ product_id: item.product_id, freeItems, discount })), [
    { product_id: '58', freeItems: 1, discount: 135 },
  ]);
});

test('legacy Buy 1 Get 1 defaults still require two displayed units', () => {
  assert.deepEqual(allocateLegacyBogoDiscounts({}, [{ product_id: '1', quantity: 1, price: 100 }]), []);
  assert.equal(allocateLegacyBogoDiscounts({}, [{ product_id: '1', quantity: 2, price: 100 }])[0]?.discount, 100);
});

