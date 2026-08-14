import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../models/prisma.js';
import { env } from '../config/env.js';
import { amazonOperationsService, summarizeAmazonOperationsError } from './amazon-operations.service.js';

test('removes technical database details from operation failures', () => {
  const result = summarizeAmazonOperationsError(
    '\u001b[31mInvalid `prisma.amazonOrderStockReservation.findMany()` invocation in D:\\Nivaana\\backend\\service.ts. The column `listingId` does not exist in the current database.',
    'ORDER_IMPORT',
  );
  assert.equal(result.errorCode, 'DATABASE_UPDATE_REQUIRED');
  assert.equal(result.retryable, false);
  assert.equal(result.userMessage.includes('Prisma'), false);
  assert.equal(result.userMessage.includes('D:\\'), false);
  assert.equal(result.recommendedAction.includes('database updates'), true);
});

test('turns temporary Amazon limits into a retryable operator message', () => {
  const result = summarizeAmazonOperationsError('Amazon API returned 429: request throttled', 'ORDER_IMPORT');
  assert.equal(result.errorCode, 'AMAZON_BUSY');
  assert.equal(result.retryable, true);
  assert.match(result.userMessage, /temporarily limited/);
});

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
