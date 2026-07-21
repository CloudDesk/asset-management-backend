import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAmazonOrder } from './amazon-order-import.service.js';
import { AmazonProductionListingsClient } from './amazon-production-listings.client.js';

test('classifies FBA, Easy Ship, and merchant-fulfilled orders', () => {
  assert.equal(classifyAmazonOrder({ fulfillment: { fulfilledBy: 'AMAZON', fulfillmentStatus: 'SHIPPED' } }).fulfilmentType, 'FBA');
  assert.equal(classifyAmazonOrder({ programs: ['AMAZON_EASY_SHIP'], fulfillment: { fulfilledBy: 'MERCHANT' } }).fulfilmentType, 'EASY_SHIP');
  assert.equal(classifyAmazonOrder({ fulfillment: { fulfilledBy: 'MERCHANT', fulfillmentStatus: 'UNSHIPPED' } }).fulfilmentRoute, 'NIVAANA_SHIPPING');
  assert.equal(classifyAmazonOrder({ fulfillment: { fulfilledBy: 'MERCHANT', fulfillmentStatus: 'CANCELLED' } }).isCancelled, true);
});

test('requests Orders API v2026-01-01 without buyer or recipient PII datasets', async () => {
  let requestedUrl = '';
  const client = new AmazonProductionListingsClient({
    sellerId: 'SELLER-1', marketplaceId: 'A21TJRUUN4KGV',
    accessTokenProvider: { getAccessToken: async () => 'token', invalidate: () => undefined },
    fetchImpl: async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ orders: [], pagination: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  await client.searchOrders({ lastUpdatedAfter: '2026-07-01T00:00:00.000Z' });
  const parsed = new URL(requestedUrl);
  assert.equal(parsed.pathname, '/orders/2026-01-01/orders');
  assert.equal(parsed.searchParams.get('includedData'), 'FULFILLMENT,CANCELLATION');
  assert.equal(parsed.searchParams.has('BUYER'), false);
  assert.equal(parsed.searchParams.has('RECIPIENT'), false);
});

test('supports a createdAfter search for full order history backfill', async () => {
  let requestedUrl = '';
  const client = new AmazonProductionListingsClient({
    sellerId: 'SELLER-1', marketplaceId: 'A21TJRUUN4KGV',
    accessTokenProvider: { getAccessToken: async () => 'token', invalidate: () => undefined },
    fetchImpl: async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify({ orders: [], pagination: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  await client.searchOrders({ createdAfter: '2024-07-21T00:00:00.000Z' });
  const parsed = new URL(requestedUrl);
  assert.equal(parsed.searchParams.get('createdAfter'), '2024-07-21T00:00:00.000Z');
  assert.equal(parsed.searchParams.has('lastUpdatedAfter'), false);
});
