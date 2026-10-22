import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

import { amazonListingQuerySchema } from '../src/schemas/amazon-listing.schema.ts';
import { AmazonListingImportService } from '../src/services/amazon-listing-import.service.ts';
import { amazonChannelRoutes } from '../src/routes/amazon-channel.route.ts';
import { errorHandler } from '../src/utils/errorHandler.ts';

test('listing query accepts a positive productId and rejects anything else', () => {
  assert.equal(amazonListingQuerySchema.parse({ productId: '49' }).productId, '49');
  assert.equal(amazonListingQuerySchema.parse({}).productId, undefined);
  for (const productId of ['abc', '0', '-1', '4.5']) {
    assert.throws(() => amazonListingQuerySchema.parse({ productId }), productId);
  }
});

test('the productId filter reaches the repository with the seller scope', async () => {
  const calls: unknown[] = [];
  const service = new AmazonListingImportService({
    repository: {
      listListings: async (query: unknown) => { calls.push(query); return { items: [], total: 0 }; },
    } as never,
    client: { getSellerId: () => 'SELLER', getMarketplaceId: () => 'MKT' } as never,
    enabled: true,
  });
  await service.listListings({ productId: '49', page: 1, limit: 20 });
  assert.deepEqual(calls[0], { productId: '49', page: 1, limit: 20, sellerId: 'SELLER', marketplaceId: 'MKT' });
});

test('GET /listings route schema allows productId (validation runs before login)', async (t) => {
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  await app.register(amazonChannelRoutes, { prefix: '/api/channels/amazon' });
  t.after(() => app.close());
  const valid = await app.inject({ method: 'GET', url: '/api/channels/amazon/listings?productId=49' });
  assert.equal(valid.statusCode, 401, 'valid productId passes validation and reaches the login check');
  const invalid = await app.inject({ method: 'GET', url: '/api/channels/amazon/listings?productId=abc' });
  assert.equal(invalid.statusCode, 400);
});

test('GET /listings route schema accepts activeOnly instead of dropping it (FIX-135)', async (t) => {
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  await app.register(amazonChannelRoutes, { prefix: '/api/channels/amazon' });
  t.after(() => app.close());
  assert.equal((await app.inject({ method: 'GET', url: '/api/channels/amazon/listings?activeOnly=false' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/api/channels/amazon/listings?activeOnly=maybe' })).statusCode, 400);
});
