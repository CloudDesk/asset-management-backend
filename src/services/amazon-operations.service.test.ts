import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../models/prisma.js';
import { env } from '../config/env.js';
import { amazonOperationsService } from './amazon-operations.service.js';

test('builds the Amazon operations dashboard without calling Amazon', async () => {
  const connection = await prisma.amazonConnection.findFirst({ select: { sellerId: true, marketplaceId: true } });
  const scope = connection ?? { sellerId: env.AMAZON_SELLER_ID || 'TEST_SELLER', marketplaceId: env.AMAZON_MARKETPLACE_ID };
  const result = await amazonOperationsService.dashboard({ ...scope, client: {} as any });
  assert.equal(result.scope.sellerId, scope.sellerId);
  assert.equal(typeof result.counts.listings, 'number');
  assert.equal(typeof result.health.writes.effectiveEnabled, 'boolean');
  assert.ok(Array.isArray(result.activities));
  assert.ok(Array.isArray(result.failures));
  assert.ok(Array.isArray(result.retries));
});
