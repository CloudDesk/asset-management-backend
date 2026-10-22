import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

import { env } from '../src/config/env.ts';
import { errorHandler } from '../src/utils/errorHandler.ts';
import { amazonSchedulerJobsRoutes } from '../src/routes/amazon-scheduler-jobs.route.ts';
import { amazonSchedulerJobsService } from '../src/services/amazon-scheduler-jobs.service.ts';
import { amazonOrderJobService } from '../src/services/amazon-order-job.service.ts';

const SECRET = 'sit-amazon-scheduler-secret-0123456789';
const PREFIX = '/api/channels/amazon/jobs';
const JOBS = [
  { path: 'order-sync', method: 'runOrderSync' as const, result: { scopes: 1, failed: 0, results: [] } },
  { path: 'listing-sync', method: 'runListingSync' as const, result: { skipped: false } },
  { path: 'retry-queue', method: 'runRetryQueue' as const, result: { processed: 3 } },
];

async function buildApp(t: test.TestContext, secret: string | undefined) {
  const original = env.AMAZON_SCHEDULER_SECRET;
  (env as Record<string, unknown>).AMAZON_SCHEDULER_SECRET = secret;
  const calls = Object.fromEntries(JOBS.map((job) => [
    job.method,
    mock.method(amazonSchedulerJobsService, job.method, async () => job.result),
  ]));
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  await app.register(amazonSchedulerJobsRoutes, { prefix: PREFIX });
  t.after(async () => {
    await app.close();
    mock.restoreAll();
    (env as Record<string, unknown>).AMAZON_SCHEDULER_SECRET = original;
  });
  return { app, calls };
}

test('each Amazon scheduler job runs once with the right secret and returns its result', async (t) => {
  const { app, calls } = await buildApp(t, SECRET);
  for (const job of JOBS) {
    const response = await app.inject({ method: 'POST', url: `${PREFIX}/${job.path}`, headers: { 'x-scheduler-secret': SECRET } });
    assert.equal(response.statusCode, 200, job.path);
    assert.deepEqual(response.json().data, job.result, job.path);
    assert.equal(calls[job.method].mock.callCount(), 1, job.path);
  }
});

test('Amazon scheduler jobs reject a missing or wrong secret without running', async (t) => {
  const { app, calls } = await buildApp(t, SECRET);
  for (const job of JOBS) {
    for (const headers of [{}, { 'x-scheduler-secret': 'wrong' }, { 'x-scheduler-secret': `${SECRET}x` }]) {
      const response = await app.inject({ method: 'POST', url: `${PREFIX}/${job.path}`, headers });
      assert.equal(response.statusCode, 401, `${job.path} ${JSON.stringify(headers)}`);
      assert.equal(response.json().message, 'Invalid scheduler secret');
    }
    assert.equal(calls[job.method].mock.callCount(), 0, job.path);
  }
});

test('Amazon scheduler jobs answer 503 when the secret is not configured', async (t) => {
  const { app, calls } = await buildApp(t, undefined);
  for (const job of JOBS) {
    const response = await app.inject({ method: 'POST', url: `${PREFIX}/${job.path}`, headers: { 'x-scheduler-secret': SECRET } });
    assert.equal(response.statusCode, 503, job.path);
    assert.equal(calls[job.method].mock.callCount(), 0, job.path);
  }
});

test('order sync enqueues without the background start and waits for the job result', async (t) => {
  t.after(() => mock.restoreAll());
  mock.method(amazonSchedulerJobsService, 'configuredScopes', async () => [{ sellerId: 'SELLER', marketplaceId: 'MKT' }]);
  mock.method(amazonOrderJobService, 'scheduledBackoff', async () => ({ skip: false, streak: 0 }));
  const enqueue = mock.method(amazonOrderJobService, 'enqueue', async () => ({ job: { id: '42', status: 'QUEUED' }, existing: false }));
  const run = mock.method(amazonOrderJobService, 'run', async () => undefined);
  mock.method(amazonOrderJobService, 'getJob', async () => ({ id: '42', status: 'FAILED', fetched: 0, errorMessage: 'invalid_client' }));

  const result = await amazonSchedulerJobsService.runOrderSync();

  assert.deepEqual(enqueue.mock.calls[0].arguments[1], { background: false });
  assert.equal(run.mock.callCount(), 1);
  assert.equal(run.mock.calls[0].arguments[0], 42n);
  assert.equal(result.failed, 1);
  assert.equal(result.results[0].errorMessage, 'invalid_client');
});

test('order sync does not start a second run when a job is already active', async (t) => {
  t.after(() => mock.restoreAll());
  mock.method(amazonSchedulerJobsService, 'configuredScopes', async () => [{ sellerId: 'SELLER', marketplaceId: 'MKT' }]);
  mock.method(amazonOrderJobService, 'scheduledBackoff', async () => ({ skip: false, streak: 0 }));
  mock.method(amazonOrderJobService, 'enqueue', async () => ({ job: { id: '7', status: 'RUNNING' }, existing: true }));
  const run = mock.method(amazonOrderJobService, 'run', async () => undefined);

  const result = await amazonSchedulerJobsService.runOrderSync();

  assert.equal(run.mock.callCount(), 0);
  assert.equal(result.results[0].skipped, true);
  assert.equal(result.failed, 0);
});

test('order sync skips a scope during credential backoff without creating a job (FIX-136)', async (t) => {
  t.after(() => mock.restoreAll());
  mock.method(amazonSchedulerJobsService, 'configuredScopes', async () => [{ sellerId: 'SELLER', marketplaceId: 'MKT' }]);
  mock.method(amazonOrderJobService, 'scheduledBackoff', async () => ({
    skip: true, streak: 3, waitMinutes: 60, retryAfter: new Date('2026-10-22T07:00:00Z'),
  }));
  const enqueue = mock.method(amazonOrderJobService, 'enqueue', async () => { throw new Error('must not enqueue'); });

  const result = await amazonSchedulerJobsService.runOrderSync();

  assert.equal(enqueue.mock.callCount(), 0);
  assert.equal(result.results[0].status, 'BACKOFF');
  assert.equal(result.results[0].skipped, true);
  assert.match(result.results[0].errorMessage ?? '', /3 in a row/);
});

