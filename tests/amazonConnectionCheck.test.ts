import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

import {
  AmazonConnectionCheckService,
  classifyTokenError,
  deriveAmazonConnectionStatus,
  type AmazonSyncRun,
} from '../src/services/amazon-connection-check.service.ts';
import { AmazonAuthorizationError, AmazonTokenRequestError } from '../src/services/amazon-lwa-token.service.ts';
import { amazonChannelRoutes } from '../src/routes/amazon-channel.route.ts';
import { errorHandler } from '../src/utils/errorHandler.ts';

const ok: AmazonSyncRun = { lastRunAt: '2026-10-22T06:46:00.000Z', lastStatus: 'COMPLETED', lastError: null, lastSuccessAt: '2026-10-22T06:46:00.000Z', failingSince: null };
const failed = (since: string, error = 'invalid_client'): AmazonSyncRun => ({ lastRunAt: '2026-10-22T06:45:00.000Z', lastStatus: 'FAILED', lastError: error, lastSuccessAt: '2026-10-14T12:45:00.000Z', failingSince: since });

test('token errors are classified: missing value, rejected credentials, temporary', () => {
  assert.equal(classifyTokenError(new AmazonAuthorizationError('AMAZON_CLIENT_SECRET is not configured on the backend')).kind, 'NOT_CONFIGURED');
  assert.equal(classifyTokenError(new AmazonAuthorizationError('Amazon rejected the configured credentials. (invalid_client)')).kind, 'AUTH_FAILED');
  assert.equal(classifyTokenError(new AmazonTokenRequestError('Could not reach Amazon authorization.', 502, 'AMAZON_AUTH_NETWORK_ERROR')).kind, 'UNREACHABLE');
});

test('accepted token and successful imports → CONNECTED', () => {
  const result = deriveAmazonConnectionStatus({ ok: true }, ok, ok);
  assert.equal(result.status, 'CONNECTED');
  assert.equal(result.failingSince, null);
});

test('rejected credentials → AUTH_FAILED with the earliest failure time', () => {
  const result = deriveAmazonConnectionStatus(
    { ok: false, kind: 'AUTH_FAILED', message: 'invalid_client: Client authentication failed' },
    failed('2026-10-14T11:33:00.000Z'),
    failed('2026-10-14T13:00:00.000Z'),
  );
  assert.equal(result.status, 'AUTH_FAILED');
  assert.equal(result.failingSince, '2026-10-14T11:33:00.000Z');
  assert.match(result.reason ?? '', /invalid_client/);
});

test('accepted token but the latest import failed → SYNC_FAILING with that error', () => {
  const result = deriveAmazonConnectionStatus({ ok: true }, ok, failed('2026-10-22T05:00:00.000Z', 'QuotaExceeded'));
  assert.equal(result.status, 'SYNC_FAILING');
  assert.equal(result.reason, 'QuotaExceeded');
});

test('check drops the cached token when fresh, and reports NOT_CONFIGURED when no seller account resolves', async () => {
  let invalidated = 0;
  const service = new AmazonConnectionCheckService({
    resolveScope: async () => ({
      sellerId: 'SELLER', marketplaceId: 'MKT', client: {} as never, source: 'ENVIRONMENT_FALLBACK',
      accessTokenProvider: { getAccessToken: async () => 'token', invalidate: () => { invalidated += 1; } },
    }),
    loadSyncRuns: async () => ({ listingImport: ok, orderImport: ok }),
  });
  assert.equal((await service.check({ fresh: true })).status, 'CONNECTED');
  assert.equal(invalidated, 1);
  assert.equal((await service.check()).status, 'CONNECTED');
  assert.equal(invalidated, 1);

  const missing = new AmazonConnectionCheckService({
    resolveScope: async () => { throw new Error('AMAZON_SELLER_ID is not configured'); },
    loadSyncRuns: async () => ({ listingImport: ok, orderImport: ok }),
  });
  assert.equal((await missing.check()).status, 'NOT_CONFIGURED');
});

test('GET /connection-check needs login and validates fresh', async (t) => {
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  await app.register(amazonChannelRoutes, { prefix: '/api/channels/amazon' });
  t.after(() => app.close());
  assert.equal((await app.inject({ method: 'GET', url: '/api/channels/amazon/connection-check' })).statusCode, 401);
  assert.equal((await app.inject({ method: 'GET', url: '/api/channels/amazon/connection-check?fresh=maybe' })).statusCode, 400);
});
