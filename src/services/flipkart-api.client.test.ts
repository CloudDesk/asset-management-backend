import assert from 'node:assert/strict';
import test from 'node:test';
import { MockFlipkartSellerApiClient } from './flipkart-api.client.js';

test('mock listing search is deterministic and state-aware', async () => {
  const client = new MockFlipkartSellerApiClient();
  const active = await client.searchListings({ state: 'ACTIVE', page: 0 });
  const inactive = await client.searchListings({ state: 'INACTIVE', page: 0 });
  assert.equal(active.items.length, 2);
  assert.equal(inactive.items.length, 1);
  assert.equal(active.hasMore, false);
  assert.equal((await client.searchListings({ state: 'ACTIVE', page: 1 })).items.length, 0);
});

test('mock inventory update reports per-SKU success and failure', async () => {
  const client = new MockFlipkartSellerApiClient();
  const response = await client.updateInventory([
    { sku: 'NV-MOCK-INCENSE-001', productId: 'FKP-NIVAANA-0001', locations: [{ id: 'LOC-MOCK-BLR-01', inventory: 8 }] },
    { sku: 'UNKNOWN', productId: 'UNKNOWN', locations: [{ id: 'LOC-MOCK-BLR-01', inventory: 2 }] },
  ]);
  assert.equal(response.results[0]?.status, 'SUCCESS');
  assert.equal(response.results[1]?.status, 'FAILURE');
  assert.equal(response.results[1]?.errors[0]?.code, 'SKU_NOT_FOUND');
  const refreshed = await client.searchListings({ state: 'ACTIVE', page: 0 });
  assert.equal(refreshed.items.find((item) => item.sku === 'NV-MOCK-INCENSE-001')?.locations[0]?.inventory, 8);
});

test('mock inventory update enforces Flipkart batch limit', async () => {
  const client = new MockFlipkartSellerApiClient();
  await assert.rejects(client.updateInventory(Array.from({ length: 11 }, (_, index) => ({
    sku: `SKU-${index}`,
    productId: `PRODUCT-${index}`,
    locations: [{ id: 'LOCATION', inventory: 1 }],
  }))));
});

test('mock shipment client exposes Standard and Self Ship orders', async () => {
  const client = new MockFlipkartSellerApiClient();
  const shipments = await client.searchShipments();
  assert.equal(shipments.length, 3);
  assert.ok(shipments.some((shipment) => shipment.fulfilmentType === 'STANDARD'));
  assert.ok(shipments.some((shipment) => shipment.fulfilmentType === 'SELF_SHIP'));
});

test('mock Standard shipment follows pack and ready-to-dispatch transitions', async () => {
  const client = new MockFlipkartSellerApiClient();
  const packed = await client.packShipment({ shipmentId: 'FKS-MOCK-1001', locationId: 'LOC-MOCK-BLR-01', invoiceNumber: 'INV-1', invoiceDate: new Date().toISOString() });
  assert.equal(packed.status, 'PACKED');
  const dispatched = await client.dispatchShipment({ shipmentId: 'FKS-MOCK-1001', locationId: 'LOC-MOCK-BLR-01' });
  assert.equal(dispatched.status, 'READY_TO_DISPATCH');
  const tracking = await client.getTracking('FKS-MOCK-1001');
  assert.equal(tracking.status, 'SHIPPED');
  assert.ok(tracking.trackingId);
});

test('mock shipment cancellation returns a terminal cancelled state', async () => {
  const client = new MockFlipkartSellerApiClient();
  const cancelled = await client.cancelShipment({ shipmentId: 'FKS-MOCK-1002', reason: 'Buyer requested cancellation' });
  assert.equal(cancelled.status, 'CANCELLED');
});
