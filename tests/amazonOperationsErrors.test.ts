import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { ZodError, z } from 'zod';

import { operationsErrorResponse } from '../src/routes/amazon-operations.route.ts';
import { AmazonOperationsError } from '../src/services/amazon-operations.service.ts';
import { AmazonAuthorizationError } from '../src/services/amazon-lwa-token.service.ts';
import { AmazonProductionWriteDisabledError } from '../src/services/amazon-production-write-guard.service.ts';

// FIX-135: Operations API used to send any error's raw message with status 400
async function respond(t: test.TestContext, error: unknown) {
  const app = Fastify();
  app.get('/x', async (_request, reply) => operationsErrorResponse(reply, error));
  t.after(() => app.close());
  const response = await app.inject({ method: 'GET', url: '/x' });
  return { status: response.statusCode, body: response.json() };
}

test('user-facing Operations errors keep their status, message and code', async (t) => {
  const notFound = await respond(t, new AmazonOperationsError('Retry job was not found', 404, 'AMAZON_RETRY_NOT_FOUND'));
  assert.deepEqual([notFound.status, notFound.body.message, notFound.body.code], [404, 'Retry job was not found', 'AMAZON_RETRY_NOT_FOUND']);
  const unsupported = await respond(t, new AmazonOperationsError('This failure requires a fresh preview or manual correction and cannot be queued.', 400, 'AMAZON_RETRY_NOT_SUPPORTED'));
  assert.equal(unsupported.status, 400);
});

test('Amazon credential and write-switch errors pass through', async (t) => {
  const auth = await respond(t, new AmazonAuthorizationError('Amazon rejected the configured credentials. (invalid_client)'));
  assert.deepEqual([auth.status, auth.body.code], [401, 'AMAZON_INVALID_AUTHORIZATION']);
  const writes = await respond(t, new AmazonProductionWriteDisabledError('backend environment switch is off'));
  assert.equal(writes.body.code, 'AMAZON_PRODUCTION_WRITES_DISABLED');
});

test('unknown errors answer a generic 500 without the internal message', async (t) => {
  const result = await respond(t, new Error('Invalid `prisma.amazonRetryJob.findFirst()` invocation: connection refused at 10.0.0.5'));
  assert.equal(result.status, 500);
  assert.equal(result.body.message, 'Amazon operations request failed');
  assert.ok(!JSON.stringify(result.body).includes('prisma'));
});

test('validation errors answer 400', async (t) => {
  let zodError: unknown;
  try { z.object({ limit: z.number() }).parse({ limit: 'x' }); } catch (error) { zodError = error; }
  assert.ok(zodError instanceof ZodError);
  const result = await respond(t, zodError);
  assert.deepEqual([result.status, result.body.code], [400, 'VALIDATION_ERROR']);
});
