import assert from 'node:assert/strict';
import test from 'node:test';
import { AmazonInventorySyncService } from './amazon-inventory-sync.service.js';

// FIX-137: the sandbox branch is gone; only AMAZON_ENVIRONMENT=PRODUCTION publishes stock

const productionCalls: string[] = [];
const serviceFor = (environment: 'SANDBOX' | 'PRODUCTION', enabled = true) => new AmazonInventorySyncService({
  enabled,
  environment,
  syncProduction: async (platformStockId) => { productionCalls.push(platformStockId); return { status: 'SYNCED', results: [] }; },
});

test('skips everything when automatic sync is disabled', async () => {
  productionCalls.length = 0;
  const result = await serviceFor('PRODUCTION', false).syncAfterPlatformStockChange({ id: 7, platform: 'amazon' });
  assert.equal(result.status, 'SKIPPED');
  assert.equal(productionCalls.length, 0);
});

test('ignores stock of other platforms', async () => {
  productionCalls.length = 0;
  const result = await serviceFor('PRODUCTION').syncAfterPlatformStockChange({ id: 7, platform: 'flipkart' });
  assert.equal(result.status, 'SKIPPED');
  assert.equal(productionCalls.length, 0);
});

test('outside production nothing is published (no sandbox call any more)', async () => {
  productionCalls.length = 0;
  const result = await serviceFor('SANDBOX').syncAfterPlatformStockChange({ id: 7, platform: 'amazon' });
  assert.equal(result.status, 'SKIPPED');
  assert.match(result.reason ?? '', /PRODUCTION/);
  assert.equal(productionCalls.length, 0);
});

test('production hands the platform stock to the guarded production sync', async () => {
  productionCalls.length = 0;
  const result = await serviceFor('PRODUCTION').syncAfterPlatformStockChange({ id: 7n, platform: 'Amazon' });
  assert.equal(result.status, 'SYNCED');
  assert.deepEqual(productionCalls, ['7']);
});

test('a missing platform stock id fails without calling Amazon', async () => {
  productionCalls.length = 0;
  const result = await serviceFor('PRODUCTION').syncAfterPlatformStockChange({ platform: 'amazon' });
  assert.equal(result.status, 'FAILED');
  assert.equal(productionCalls.length, 0);
});

test('production sync errors are reported as FAILED, not thrown', async () => {
  const service = new AmazonInventorySyncService({
    enabled: true,
    environment: 'PRODUCTION',
    syncProduction: async () => { throw new Error('Amazon production writes are disabled by the global kill switch'); },
  });
  const result = await service.syncAfterPlatformStockChange({ id: 7, platform: 'amazon' });
  assert.deepEqual([result.status, result.reason], ['FAILED', 'Amazon production writes are disabled by the global kill switch']);
});
