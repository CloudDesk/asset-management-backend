import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateAmazonTargetQuantity } from './amazon-production-inventory.service.js';
import { AmazonProductionListingsClient } from './amazon-production-listings.client.js';
import {
  amazonInventoryBulkPreviewSchema,
  amazonInventoryBulkSyncSchema,
  amazonInventoryRetrySchema,
  amazonInventorySyncModeSchema,
} from '../schemas/amazon-listing.schema.js';

test('calculates Amazon listing quantity from Nivaana units per listing', () => {
  assert.equal(calculateAmazonTargetQuantity(11, 2), 5);
  assert.equal(calculateAmazonTargetQuantity(-4, 1), 0);
  assert.equal(calculateAmazonTargetQuantity(7.9, 0), 7);
});

test('publishes MFN quantity through a merge patch for the DEFAULT channel', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const client = new AmazonProductionListingsClient({
    sellerId: 'SELLER-1',
    marketplaceId: 'A21TJRUUN4KGV',
    accessTokenProvider: {
      getAccessToken: async () => 'test-token',
      invalidate: () => undefined,
    },
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(JSON.stringify({ submissionId: 'submission-1', status: 'ACCEPTED', issues: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  const result = await client.patchMfnQuantity({ sellerSku: 'SKU / 1', productType: 'PRODUCT', quantity: 12 });

  assert.equal(result.status, 'ACCEPTED');
  assert.match(capturedUrl, /SELLER-1\/SKU%20%2F%201/);
  assert.match(capturedUrl, /marketplaceIds=A21TJRUUN4KGV/);
  assert.equal(capturedInit?.method, 'PATCH');
  assert.equal((capturedInit?.headers as Record<string, string>)['x-amz-access-token'], 'test-token');
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    productType: 'PRODUCT',
    patches: [{
      op: 'merge',
      path: '/attributes/fulfillment_availability',
      value: [{ fulfillment_channel_code: 'DEFAULT', quantity: 12 }],
    }],
  });
});

test('validates bounded bulk previews, bulk syncs, and failed-attempt retries', () => {
  assert.deepEqual(amazonInventoryBulkPreviewSchema.parse({ listingIds: ['1', '2'] }), { listingIds: ['1', '2'] });
  assert.deepEqual(amazonInventoryBulkSyncSchema.parse({ items: [{ listingId: '1', previewId: '9' }] }), {
    items: [{ listingId: '1', previewId: '9' }],
  });
  assert.deepEqual(amazonInventoryRetrySchema.parse({ attemptId: '12' }), { attemptId: '12' });
  assert.deepEqual(amazonInventorySyncModeSchema.parse({ mode: 'AUTOMATIC' }), { mode: 'AUTOMATIC' });
  assert.throws(() => amazonInventoryBulkPreviewSchema.parse({ listingIds: Array.from({ length: 26 }, (_, index) => String(index + 1)) }));
});
