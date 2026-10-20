import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

import { env } from '../src/config/env.ts';
import { ECOMMERCE_PUBLIC_ROUTES } from '../src/config/publicRoutes.ts';
import { errorHandler } from '../src/utils/errorHandler.ts';
import { shipmozoRoutes } from '../src/routes/shipmozo.route.ts';
import { shipmozoTrackingSyncService } from '../src/services/shipmozo-tracking-sync.service.ts';

const SECRET = 'sit-scheduler-secret-0123456789';
const URL = '/v1/shipmozo/jobs/tracking-sync';

async function buildApp(t: test.TestContext, secret: string | undefined) {
  const original = env.SHIPMOZO_SCHEDULER_SECRET;
  (env as Record<string, unknown>).SHIPMOZO_SCHEDULER_SECRET = secret;
  const runBatch = mock.method(shipmozoTrackingSyncService, 'runBatch', async () => ({
    started_at: 1,
    processed: 2,
    results: [{ order_id: 188 }, { order_id: 189 }]
  }));
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  await app.register(shipmozoRoutes, { prefix: '/v1/shipmozo' });
  t.after(async () => {
    await app.close();
    mock.restoreAll();
    (env as Record<string, unknown>).SHIPMOZO_SCHEDULER_SECRET = original;
  });
  return { app, runBatch };
}

test('scheduler job route is public (no login); the secret header protects it', () => {
  assert.ok(ECOMMERCE_PUBLIC_ROUTES.includes(`POST ${URL}`));
});

test('scheduler job runs one tracking batch with the right secret', async (t) => {
  const { app, runBatch } = await buildApp(t, SECRET);
  const response = await app.inject({ method: 'POST', url: URL, headers: { 'x-scheduler-secret': SECRET } });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.success, true);
  assert.equal(body.data.processed, 2);
  assert.equal(runBatch.mock.callCount(), 1);
});

test('scheduler job rejects a missing or wrong secret without syncing', async (t) => {
  const { app, runBatch } = await buildApp(t, SECRET);
  for (const headers of [{}, { 'x-scheduler-secret': 'wrong' }, { 'x-scheduler-secret': `${SECRET}x` }]) {
    const response = await app.inject({ method: 'POST', url: URL, headers });
    assert.equal(response.statusCode, 401, JSON.stringify(headers));
    assert.equal(response.json().message, 'Invalid scheduler secret');
  }
  assert.equal(runBatch.mock.callCount(), 0);
});

test('scheduler job answers 503 when the secret is not configured', async (t) => {
  const { app, runBatch } = await buildApp(t, undefined);
  const response = await app.inject({ method: 'POST', url: URL, headers: { 'x-scheduler-secret': SECRET } });
  assert.equal(response.statusCode, 503);
  assert.equal(runBatch.mock.callCount(), 0);
});
