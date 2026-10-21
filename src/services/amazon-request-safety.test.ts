import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { AmazonProductionListingsClient, AmazonSpApiError } from './amazon-production-listings.client.js';

const shipment = { orderId: 'ORDER-1', marketplaceId: 'MARKET-1', packageReferenceId: '1',
  carrierCode: 'Other', trackingNumber: 'TRACK-1', shipDate: '2026-10-13T00:00:00Z', orderItems: [] };
const clientFor = (fetchImpl: typeof fetch) => new AmazonProductionListingsClient({
  sellerId: 'SELLER-1', marketplaceId: 'MARKET-1', baseUrl: 'https://sellingpartnerapi-eu.amazon.com',
  accessTokenProvider: { getAccessToken: async () => 'test', invalidate() {} },
  maxRetries: 2, sleep: async () => {}, fetchImpl,
});

test('does not resend shipment writes after network failure', async () => {
  let calls = 0;
  const client = clientFor(async () => { ++calls; throw new Error('timeout'); });
  await assert.rejects(() => client.confirmShipment(shipment),
    (error: unknown) => error instanceof AmazonSpApiError && error.code === 'AMAZON_WRITE_OUTCOME_UNKNOWN');
  assert.equal(calls, 1);
});

test('authorization-service failure before a write remains safe to retry', async () => {
  let writes = 0;
  const client = new AmazonProductionListingsClient({
    sellerId: 'SELLER', marketplaceId: 'MARKET',
    accessTokenProvider: { getAccessToken: async () => { throw new Error('Token service unavailable'); }, invalidate() {} },
    fetchImpl: async () => { ++writes; return new Response(null, { status: 204 }); },
  });
  await assert.rejects(() => client.confirmShipment(shipment),
    (error: unknown) => error instanceof AmazonSpApiError && error.code === 'AMAZON_WRITE_NOT_SENT');
  assert.equal(writes, 0);
});

test('keeps Amazon rejection details and does not retry an uncertain server response', async () => {
  let calls = 0;
  const client = clientFor(async () => { ++calls; return new Response(JSON.stringify({
    errors: [{ code: 'InternalFailure', message: 'Shipment processing failed' }],
  }), { status: 503 }); });
  await assert.rejects(() => client.confirmShipment(shipment),
    (error: unknown) => error instanceof AmazonSpApiError
      && error.code === 'AMAZON_WRITE_OUTCOME_UNKNOWN' && error.message.includes('Shipment processing failed'));
  assert.equal(calls, 1);
});

test('continues retrying safe reads after a transient failure', async () => {
  let calls = 0;
  const client = clientFor(async () => ++calls === 1 ? new Response('{}', { status: 503 })
    : new Response(JSON.stringify({ sku: 'SKU-1' }), { status: 200 }));
  assert.equal((await client.fetchListing('SKU-1')).sku, 'SKU-1');
  assert.equal(calls, 2);
});

test('keeps field validation messages from Amazon', async () => {
  const client = clientFor(async () => new Response(JSON.stringify({
    errors: [{ code: 'InvalidInput', message: 'Tracking number is invalid' }],
  }), { status: 400 }));
  await assert.rejects(() => client.confirmShipment(shipment),
    (error: unknown) => error instanceof AmazonSpApiError && error.statusCode === 400
      && error.message.includes('Tracking number is invalid'));
});

test('downloads and asynchronously decompresses an Amazon gzip report', async () => {
  const client = clientFor(async (input) => String(input).includes('/documents/')
    ? new Response(JSON.stringify({ url: 'https://report.example/download', compressionAlgorithm: 'GZIP' }))
    : new Response(gzipSync(Buffer.from('\uFEFFsku,quantity\nSKU-1,3'))));
  assert.equal(await client.downloadReportDocument('document-1'), 'sku,quantity\nSKU-1,3');
});

test('rejects oversized report downloads before buffering them', async () => {
  const client = clientFor(async (input) => String(input).includes('/documents/')
    ? new Response(JSON.stringify({ url: 'https://report.example/download' }))
    : new Response('report', { headers: { 'content-length': String(33 * 1024 * 1024) } }));
  await assert.rejects(() => client.downloadReportDocument('document-1'),
    (error: unknown) => error instanceof AmazonSpApiError && error.code === 'AMAZON_REPORT_TOO_LARGE');
});
