import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAmazonOrder } from './amazon-order-import.service.js';
import { amazonOrderQuerySchema } from '../schemas/amazon-order.schema.js';
import { AmazonProductionListingsClient } from './amazon-production-listings.client.js';
import {
  calculateFbaSoldDelta,
  deriveAmazonOrderRoutingDecision,
  isAmazonOrderFinalStatus,
} from './amazon-order-routing.service.js';

test('classifies FBA, Easy Ship, and merchant-fulfilled orders', () => {
  assert.equal(classifyAmazonOrder({ fulfillment: { fulfilledBy: 'AMAZON', fulfillmentStatus: 'SHIPPED' } }).fulfilmentType, 'FBA');
  assert.equal(classifyAmazonOrder({ programs: ['AMAZON_EASY_SHIP'], fulfillment: { fulfilledBy: 'MERCHANT' } }).fulfilmentType, 'EASY_SHIP');
  assert.equal(classifyAmazonOrder({ fulfillment: { fulfilledBy: 'MERCHANT', fulfillmentStatus: 'UNSHIPPED' } }).fulfilmentRoute, 'NIVAANA_SHIPPING');
  assert.equal(classifyAmazonOrder({ fulfillment: { fulfilledBy: 'MERCHANT', fulfillmentStatus: 'CANCELLED' } }).isCancelled, true);
});

test('accepts an Amazon order-status query filter', () => {
  assert.deepEqual(
    amazonOrderQuerySchema.parse({ orderStatus: 'SHIPPED', page: '1', limit: '20' }),
    { orderStatus: 'SHIPPED', page: 1, limit: 20 }
  );
});

test('requests buyer information without recipient address data', async () => {
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
  assert.equal(parsed.searchParams.get('includedData'), 'BUYER,FULFILLMENT,CANCELLATION');
  assert.equal(parsed.searchParams.get('includedData')?.includes('BUYER'), true);
  assert.equal(parsed.searchParams.get('includedData')?.includes('RECIPIENT'), false);
});

test('continues importing without buyer data when the restricted role is unavailable', async () => {
  const requestedData: string[] = [];
  const client = new AmazonProductionListingsClient({
    sellerId: 'SELLER-1', marketplaceId: 'A21TJRUUN4KGV',
    accessTokenProvider: { getAccessToken: async () => 'token', invalidate: () => undefined },
    fetchImpl: async (input) => {
      const includedData = new URL(String(input)).searchParams.get('includedData') ?? '';
      requestedData.push(includedData);
      if (includedData.includes('BUYER')) {
        return new Response(JSON.stringify({ errors: [{ code: 'Unauthorized' }] }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ orders: [], pagination: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });
  await client.searchOrders({ lastUpdatedAfter: '2026-07-01T00:00:00.000Z' });
  assert.deepEqual(requestedData, ['BUYER,FULFILLMENT,CANCELLATION', 'FULFILLMENT,CANCELLATION']);
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

test('routes mapped orders without exposing invalid fulfillment actions', () => {
  assert.deepEqual(
    deriveAmazonOrderRoutingDecision({ isCancelled: false, hasUnmappedItems: false, fulfilmentType: 'FBA' }),
    { route: 'FBA_RECONCILIATION', status: 'TRACK_FBA_STOCK', syncState: 'READ_ONLY_RECONCILIATION', blockedReason: null }
  );
  assert.equal(
    deriveAmazonOrderRoutingDecision({ isCancelled: false, hasUnmappedItems: false, fulfilmentType: 'EASY_SHIP' }).status,
    'RESERVE_STOCK'
  );
  assert.equal(
    deriveAmazonOrderRoutingDecision({ isCancelled: false, hasUnmappedItems: false, fulfilmentType: 'MFN' }).status,
    'RESERVE_STOCK'
  );
});

test('cancellation and unmapped safety gates take precedence over routing', () => {
  assert.equal(
    deriveAmazonOrderRoutingDecision({ isCancelled: true, hasUnmappedItems: false, fulfilmentType: 'MFN' }).status,
    'CANCELLED'
  );
  assert.equal(
    deriveAmazonOrderRoutingDecision({ isCancelled: false, hasUnmappedItems: true, fulfilmentType: 'MFN' }).status,
    'BLOCKED_UNMAPPED'
  );
});

test('treats only completed shipment states as final stock-sale states', () => {
  assert.equal(isAmazonOrderFinalStatus('SHIPPED'), true);
  assert.equal(isAmazonOrderFinalStatus('delivered'), true);
  assert.equal(isAmazonOrderFinalStatus('COMPLETED'), true);
  assert.equal(isAmazonOrderFinalStatus('UNSHIPPED'), false);
  assert.equal(isAmazonOrderFinalStatus('CANCELLED'), false);
});

test('updates FBA sold accounting idempotently and reverses it on cancellation', () => {
  assert.equal(calculateFbaSoldDelta(null, 2, true), 2);
  assert.equal(calculateFbaSoldDelta({ status: 'RESERVED', quantity: 2 }, 2, true), 2);
  assert.equal(calculateFbaSoldDelta({ status: 'SOLD', quantity: 2 }, 2, true), 0);
  assert.equal(calculateFbaSoldDelta({ status: 'SOLD', quantity: 2 }, 3, true), 1);
  assert.equal(calculateFbaSoldDelta({ status: 'SOLD', quantity: 2 }, 2, false), -2);
});

test('confirms an MFN shipment with the Amazon-required package and tracking fields', async () => {
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;
  const client = new AmazonProductionListingsClient({
    sellerId: 'SELLER-1', marketplaceId: 'A21TJRUUN4KGV',
    accessTokenProvider: { getAccessToken: async () => 'token', invalidate: () => undefined },
    fetchImpl: async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return new Response(null, { status: 204 });
    },
  });
  await client.confirmShipment({
    orderId: '123-1234567-1234567', marketplaceId: 'A21TJRUUN4KGV', packageReferenceId: '1',
    carrierCode: 'BLUEDART', carrierName: 'Blue Dart', shippingMethod: 'Surface',
    trackingNumber: 'TRACK-1', shipDate: '2026-07-22T10:00:00.000Z',
    orderItems: [{ orderItemId: 'ITEM-1', quantity: 2 }],
  });
  assert.equal(new URL(requestedUrl).pathname, '/orders/v0/orders/123-1234567-1234567/shipmentConfirmation');
  assert.equal(requestedInit?.method, 'POST');
  const body = JSON.parse(String(requestedInit?.body));
  assert.equal(body.packageDetail.trackingNumber, 'TRACK-1');
  assert.deepEqual(body.packageDetail.orderItems, [{ orderItemId: 'ITEM-1', quantity: 2 }]);
});

test('uses the official Easy Ship time-slot endpoint and package measurements', async () => {
  let requestedUrl = '';
  let requestedInit: RequestInit | undefined;
  const client = new AmazonProductionListingsClient({
    sellerId: 'SELLER-1', marketplaceId: 'A21TJRUUN4KGV',
    accessTokenProvider: { getAccessToken: async () => 'token', invalidate: () => undefined },
    fetchImpl: async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return new Response(JSON.stringify({ timeSlots: [{ slotId: 'SLOT-1', handoverMethod: 'PICKUP' }] }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  const slots = await client.listEasyShipHandoverSlots({
    orderId: '123-1234567-1234567', marketplaceId: 'A21TJRUUN4KGV',
    dimensions: { length: 20, width: 15, height: 10, unit: 'cm' },
    weight: { value: 500, unit: 'grams' },
  });
  assert.equal(new URL(requestedUrl).pathname, '/easyShip/2022-03-23/timeSlot');
  assert.equal(requestedInit?.method, 'POST');
  assert.equal(JSON.parse(String(requestedInit?.body)).packageWeight.value, 500);
  assert.equal(slots[0]?.slotId, 'SLOT-1');
});
