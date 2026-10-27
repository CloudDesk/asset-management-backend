import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../models/prisma.js';
import { AmazonListingScopeService } from './amazon-listing-scope.service.js';
import { amazonProductionListingsClient } from './amazon-production-listings.client.js';
import { amazonTokenCryptoService } from './amazon-token-crypto.service.js';
import { AmazonOrderImportService } from './amazon-order-import.service.js';
import { normalizeAmazonListing } from './amazon-listing-normalizer.js';

test('a user without a personal connection retains the configured shared-account scope', async () => {
  const original = prisma.amazonConnection.findFirst;
  try {
    prisma.amazonConnection.findFirst = (async () => null) as any;
    const scope = await new AmazonListingScopeService().resolve(17, 'inventory');
    assert.equal(scope.source, 'ENVIRONMENT_FALLBACK');
    assert.equal(scope.client, amazonProductionListingsClient);
    assert.equal(scope.sellerId, amazonProductionListingsClient.getSellerId());
    assert.equal(scope.marketplaceId, amazonProductionListingsClient.getMarketplaceId());
  } finally { prisma.amazonConnection.findFirst = original; }
});

test('a personal OAuth connection remains preferred over the shared account', async () => {
  const original = prisma.amazonConnection.findFirst;
  const originalDecrypt = amazonTokenCryptoService.decrypt;
  try {
    prisma.amazonConnection.findFirst = (async (input: any) => {
      assert.deepEqual(input.where, { userId: 17, userType: 'users' });
      return { sellerId: 'PERSONAL-SELLER', marketplaceId: 'PERSONAL-MARKET', refreshToken: 'encrypted' };
    }) as any;
    amazonTokenCryptoService.decrypt = () => 'test-refresh-token';
    const scope = await new AmazonListingScopeService().resolve(17, 'ecommerce');
    assert.equal(scope.source, 'OAUTH');
    assert.equal(scope.sellerId, 'PERSONAL-SELLER');
    assert.equal(scope.marketplaceId, 'PERSONAL-MARKET');
    assert.notEqual(scope.client, amazonProductionListingsClient);
  } finally {
    prisma.amazonConnection.findFirst = original;
    amazonTokenCryptoService.decrypt = originalDecrypt;
  }
});

test('connection lookup errors are not hidden by switching to the shared account', async () => {
  const original = prisma.amazonConnection.findFirst;
  try {
    prisma.amazonConnection.findFirst = (async () => { throw new Error('Connection lookup unavailable'); }) as any;
    await assert.rejects(() => new AmazonListingScopeService().resolve(17, 'inventory'), /Connection lookup unavailable/);
  } finally { prisma.amazonConnection.findFirst = original; }
});

test('background shared-account scope skips user lookup and rejects a different seller', async () => {
  const original = prisma.amazonConnection.findFirst;
  let lookups = 0;
  try {
    prisma.amazonConnection.findFirst = (async () => { ++lookups; return null; }) as any;
    const service = new AmazonListingScopeService();
    const scope = await service.resolve();
    assert.equal(scope.source, 'ENVIRONMENT_FALLBACK');
    assert.equal(lookups, 0);
    await assert.rejects(() => service.resolveForSeller(`${scope.sellerId}-other`, scope.marketplaceId),
      /No Amazon OAuth connection is available/);
  } finally { prisma.amazonConnection.findFirst = original; }
});

test('a broken order does not prevent subsequent orders from being imported', async () => {
  const original = prisma.amazonMarketplaceOrder.findFirst;
  const seen: string[] = [];
  try {
    prisma.amazonMarketplaceOrder.findFirst = (async () => null) as any;
    const service = new AmazonOrderImportService();
    (service as any).upsertOrder = async (order: any) => {
      seen.push(order.orderId);
      if (order.orderId === 'BAD') throw new Error('Invalid order');
      return { created: true, hasUnmappedItems: false, isCancelled: false };
    };
    await assert.rejects(() => service.importOrders({ sellerId: 'SELLER', marketplaceId: 'MARKET',
      source: 'OAUTH', client: { searchOrders: async () => ({ orders: [{ orderId: 'BAD' }, { orderId: 'GOOD' }], nextToken: null }) } as any,
    }), /1 failed orders out of 2/);
    assert.deepEqual(seen, ['BAD', 'GOOD']);
  } finally { prisma.amazonMarketplaceOrder.findFirst = original; }
});

test('FBA total stock is not advertised as sellable stock', () => {
  const listing = normalizeAmazonListing({ sku: 'SKU', fulfillmentAvailability: [{
    fulfillmentChannelCode: 'AMAZON_IN', quantity: 100,
  }] }, { sellerId: 'SELLER', marketplaceId: 'MARKET', fbaInventory: { totalQuantity: 100 } });
  assert.equal(listing.fulfilmentChannel, 'FBA');
  assert.equal(listing.publishedQuantity, 0);
});
