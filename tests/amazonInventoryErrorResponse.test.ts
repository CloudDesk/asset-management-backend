import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

import { AmazonListingController } from '../src/controllers/amazon-listing.controller.ts';
import { amazonListingScopeService } from '../src/services/amazon-listing-scope.service.ts';
import { amazonProductionInventoryService } from '../src/services/amazon-production-inventory.service.ts';
import { AmazonAuthorizationError } from '../src/services/amazon-lwa-token.service.ts';

// Stock Sync preview used to answer 500 "Amazon inventory operation failed" for Amazon credential errors
async function buildApp(t: test.TestContext, failure: Error) {
  mock.method(amazonListingScopeService, 'resolve', async () => ({ sellerId: 'SELLER', marketplaceId: 'MKT', client: {} }));
  mock.method(amazonProductionInventoryService, 'preview', async () => { throw failure; });
  const controller = new AmazonListingController();
  const app = Fastify();
  app.post('/listings/:listingId/inventory/preview', controller.previewInventorySync);
  t.after(async () => { await app.close(); mock.restoreAll(); });
  return app;
}

test('stock preview passes the Amazon credential error through with its code', async (t) => {
  const app = await buildApp(t, new AmazonAuthorizationError('Amazon rejected the configured credentials. (invalid_client: Client authentication failed)'));
  const response = await app.inject({ method: 'POST', url: '/listings/157/inventory/preview' });
  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.code, 'AMAZON_INVALID_AUTHORIZATION');
  assert.match(body.message, /invalid_client/);
});

test('unknown errors still answer the generic 500 without internal details', async (t) => {
  const app = await buildApp(t, new Error('database password is wrong'));
  const response = await app.inject({ method: 'POST', url: '/listings/157/inventory/preview' });
  assert.equal(response.statusCode, 500);
  assert.equal(response.json().message, 'Amazon inventory operation failed');
});
