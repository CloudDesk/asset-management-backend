import assert from 'node:assert/strict';
import test from 'node:test';
import { MockFlipkartSellerApiClient } from './flipkart-api.client.js';
import { calculateFlipkartTargetQuantity, FlipkartInventoryService } from './flipkart-inventory.service.js';

test('calculates listing units and applies safety buffer', () => {
  assert.equal(calculateFlipkartTargetQuantity(25, 2, 2), 10);
});

test('never publishes a negative quantity', () => {
  assert.equal(calculateFlipkartTargetQuantity(2, 2, 5), 0);
  assert.equal(calculateFlipkartTargetQuantity(-10, 1, 0), 0);
});

test('rejects invalid units per listing', () => {
  assert.throws(() => calculateFlipkartTargetQuantity(10, 0, 0));
});

test('platform-stock hook ignores stock owned by another channel', async () => {
  const service = new FlipkartInventoryService(new MockFlipkartSellerApiClient());
  const result = await service.syncAfterPlatformStockChange({ id: 1, platform: 'amazon' });
  assert.deepEqual(result, { status: 'SKIPPED', reason: 'Platform stock is not for Flipkart' });
});
