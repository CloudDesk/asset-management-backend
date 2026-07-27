import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AmazonProductionInventoryError,
  assertAmazonInventoryListingEligible,
  calculateAmazonTargetQuantity,
  resolveAmazonInventoryConfirmation,
} from './amazon-production-inventory.service.js';
import { AmazonProductionListingsClient } from './amazon-production-listings.client.js';
import {
  amazonInventoryBulkPreviewSchema,
  amazonInventoryBulkSyncSchema,
  amazonInventoryRetrySchema,
  amazonInventorySyncModeSchema,
} from '../schemas/amazon-listing.schema.js';
import { amazonOfferApplySchema, amazonOfferUpdateSchema } from '../schemas/amazon-offer.schema.js';
import { normalizeAmazonOperation } from './amazon-api-telemetry.service.js';

test('calculates Amazon listing quantity from Nivaana units per listing', () => {
  assert.equal(calculateAmazonTargetQuantity(11, 2), 5);
  assert.equal(calculateAmazonTargetQuantity(-4, 1), 0);
  assert.equal(calculateAmazonTargetQuantity(7.9, 0), 7);
});

test('waits for Amazon live quantity before marking an accepted submission successful', () => {
  const submittedAt = new Date('2026-07-27T09:00:00.000Z');
  assert.equal(
    resolveAmazonInventoryConfirmation(31, 30, submittedAt, new Date('2026-07-27T09:05:00.000Z')),
    'PENDING'
  );
  assert.equal(
    resolveAmazonInventoryConfirmation(31, 31, submittedAt, new Date('2026-07-27T09:05:00.000Z')),
    'CONFIRMED'
  );
  assert.equal(
    resolveAmazonInventoryConfirmation(31, 30, submittedAt, new Date('2026-07-27T09:15:00.000Z')),
    'TIMED_OUT'
  );
});

test('allows stock handoff only for active mapped seller-fulfilled listings', () => {
  for (const listingStatus of ['BUYABLE', 'DISCOVERABLE', 'ACTIVE', 'BUYABLE,DISCOVERABLE']) {
    assert.doesNotThrow(() => assertAmazonInventoryListingEligible({
      listingStatus,
      mappingStatus: 'MAPPED',
      productId: 42n,
      fulfilmentChannel: 'MFN',
      productType: 'PRODUCT',
    }));
  }
  assert.doesNotThrow(() => assertAmazonInventoryListingEligible({
    listingStatus: 'BUYABLE',
    mappingStatus: 'MAPPED',
    productId: 42n,
    fulfilmentChannel: 'EASY_SHIP',
    productType: 'PRODUCT',
  }));
});

test('blocks inactive, unmapped, FBA, and incomplete listings before stock handoff', () => {
  const base = {
    listingStatus: 'BUYABLE',
    mappingStatus: 'MAPPED',
    productId: 42n as bigint | null,
    fulfilmentChannel: 'MFN',
    productType: 'PRODUCT' as string | null,
  };
  const expected: Array<[Partial<typeof base>, string]> = [
    [{ listingStatus: 'SUPPRESSED' }, 'AMAZON_LISTING_NOT_ACTIVE'],
    [{ listingStatus: 'UNKNOWN' }, 'AMAZON_LISTING_NOT_ACTIVE'],
    [{ mappingStatus: 'PENDING' }, 'AMAZON_LISTING_NOT_MAPPED'],
    [{ productId: null }, 'AMAZON_LISTING_NOT_MAPPED'],
    [{ fulfilmentChannel: 'FBA' }, 'AMAZON_INVENTORY_NOT_MFN'],
    [{ productType: null }, 'AMAZON_PRODUCT_TYPE_MISSING'],
  ];

  for (const [changes, code] of expected) {
    assert.throws(
      () => assertAmazonInventoryListingEligible({ ...base, ...changes }),
      (error) => error instanceof AmazonProductionInventoryError && error.code === code
    );
  }
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

test('uses Amazon validation preview for price and MFN availability patches', async () => {
  let capturedUrl = '';
  let capturedBody: any;
  const client = new AmazonProductionListingsClient({
    sellerId: 'SELLER-1', marketplaceId: 'A21TJRUUN4KGV',
    accessTokenProvider: { getAccessToken: async () => 'token', invalidate: () => undefined },
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ status: 'VALID', issues: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  await client.patchListingOffer({
    sellerSku: 'SKU-1', productType: 'PRODUCT', validationPreview: true,
    patches: [
      { op: 'replace', path: '/attributes/purchasable_offer', value: [{ marketplace_id: 'A21TJRUUN4KGV', currency: 'INR', audience: 'ALL', our_price: [{ schedule: [{ value_with_tax: 499 }] }] }] },
      { op: 'replace', path: '/attributes/fulfillment_availability', value: [{ marketplace_id: 'A21TJRUUN4KGV', fulfillment_channel_code: 'DEFAULT', quantity: 5, lead_time_to_ship_max_days: 2 }] },
    ],
  });
  assert.equal(new URL(capturedUrl).searchParams.get('mode'), 'VALIDATION_PREVIEW');
  assert.equal(capturedBody.patches[0].path, '/attributes/purchasable_offer');
  assert.equal(capturedBody.patches[1].value[0].lead_time_to_ship_max_days, 2);
});

test('uses PUT VALIDATION_PREVIEW for a complete listing payload without persisting it', async () => {
  let capturedUrl = '';
  let capturedMethod = '';
  let capturedBody: any;
  const client = new AmazonProductionListingsClient({
    sellerId: 'SELLER-1', marketplaceId: 'A21TJRUUN4KGV',
    accessTokenProvider: { getAccessToken: async () => 'token', invalidate: () => undefined },
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      capturedMethod = String(init?.method);
      capturedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ status: 'VALID', issues: [], identifiers: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  await client.previewListingItem({
    sellerSku: 'SKU-1',
    productType: 'INCENSE',
    requirements: 'LISTING',
    attributes: { item_name: [{ value: 'First Rain', marketplace_id: 'A21TJRUUN4KGV' }] },
  });
  const url = new URL(capturedUrl);
  assert.equal(capturedMethod, 'PUT');
  assert.equal(url.searchParams.get('mode'), 'VALIDATION_PREVIEW');
  assert.equal(url.searchParams.get('includedData'), 'issues,identifiers');
  assert.equal(capturedBody.requirements, 'LISTING');
  assert.equal(capturedBody.attributes.item_name[0].value, 'First Rain');
});

test('submits a real PUT without the validation-preview mode', async () => {
  let capturedUrl = '';
  let capturedMethod = '';
  const client = new AmazonProductionListingsClient({
    sellerId: 'SELLER-1', marketplaceId: 'A21TJRUUN4KGV',
    accessTokenProvider: { getAccessToken: async () => 'token', invalidate: () => undefined },
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      capturedMethod = String(init?.method);
      return new Response(JSON.stringify({
        submissionId: 'submission-1', status: 'ACCEPTED', issues: [],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  const response = await client.submitListingItem({
    sellerSku: 'SKU-1',
    productType: 'INCENSE',
    requirements: 'LISTING',
    attributes: { item_name: [{ value: 'First Rain' }] },
  });
  const url = new URL(capturedUrl);
  assert.equal(capturedMethod, 'PUT');
  assert.equal(url.searchParams.has('mode'), false);
  assert.equal(url.searchParams.get('includedData'), 'issues');
  assert.equal(response.status, 'ACCEPTED');
});

test('requires explicit offer changes and production confirmation', () => {
  assert.deepEqual(amazonOfferUpdateSchema.parse({ price: 499, currency: 'inr' }), { price: 499, currency: 'INR' });
  assert.throws(() => amazonOfferUpdateSchema.parse({}));
  assert.deepEqual(amazonOfferApplySchema.parse({ previewId: '12', confirmed: true }), { previewId: '12', confirmed: true });
  assert.throws(() => amazonOfferApplySchema.parse({ previewId: '12', confirmed: false }));
});

test('captures Amazon rate-limit telemetry without exposing the access token', async () => {
  const observations: any[] = [];
  const client = new AmazonProductionListingsClient({
    sellerId: 'SELLER-1', marketplaceId: 'A21TJRUUN4KGV',
    accessTokenProvider: { getAccessToken: async () => 'secret-token', invalidate: () => undefined },
    telemetryRecorder: { record: async (observation) => { observations.push(observation); } },
    fetchImpl: async () => new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'x-amzn-RateLimit-Limit': '5.0', 'x-amzn-RequestId': 'request-1' },
    }),
  });
  await client.fetchListingsPage();
  assert.equal(observations[0].rateLimit, '5.0');
  assert.equal(observations[0].requestId, 'request-1');
  assert.equal(JSON.stringify(observations).includes('secret-token'), false);
  assert.match(normalizeAmazonOperation('GET', '/listings/2021-08-01/items/SELLER-1'), /:resource/);
});

test('fails a stalled Amazon request instead of leaving an import running forever', async () => {
  const client = new AmazonProductionListingsClient({
    sellerId: 'SELLER-1',
    marketplaceId: 'A21TJRUUN4KGV',
    maxRetries: 0,
    requestTimeoutMs: 5,
    accessTokenProvider: { getAccessToken: async () => 'token', invalidate: () => undefined },
    fetchImpl: async (_input, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new Error('aborted')));
    }),
  });

  await assert.rejects(
    client.searchOrders({ createdAfter: new Date().toISOString() }),
    /could not be reached/
  );
});

test('gets and creates Amazon notification subscriptions through Notifications API v1', async () => {
  const requests: Array<{ url: string; method: string; body?: string }> = [];
  const responses = [
    new Response(JSON.stringify({ payload: { subscriptionId: 'sub-existing', destinationId: 'dest-sqs', payloadVersion: '1.0' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    new Response(JSON.stringify({ payload: { subscriptionId: 'sub-created', destinationId: 'dest-sqs', payloadVersion: '1.0' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ];
  const client = new AmazonProductionListingsClient({
    sellerId: 'SELLER-1', marketplaceId: 'A21TJRUUN4KGV',
    accessTokenProvider: { getAccessToken: async () => 'token', invalidate: () => undefined },
    fetchImpl: async (input, init) => {
      requests.push({ url: String(input), method: String(init?.method), ...(init?.body ? { body: String(init.body) } : {}) });
      return responses.shift()!;
    },
  });
  const existing = await client.getNotificationSubscription('ORDER_CHANGE', '1.0');
  const created = await client.createNotificationSubscription('ORDER_CHANGE', '1.0', 'dest-sqs');
  assert.equal(existing?.subscriptionId, 'sub-existing');
  assert.equal(created.subscriptionId, 'sub-created');
  assert.match(requests[0].url, /notifications\/v1\/subscriptions\/ORDER_CHANGE\?payloadVersion=1.0/);
  assert.deepEqual(JSON.parse(requests[1].body!), {
    payloadVersion: '1.0',
    destinationId: 'dest-sqs',
    processingDirective: {
      eventFilter: {
        eventFilterType: 'ORDER_CHANGE',
        orderChangeTypes: ['OrderStatusChange', 'BuyerRequestedChange'],
      },
    },
  });
});
