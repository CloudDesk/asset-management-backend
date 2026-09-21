import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyReply } from 'fastify';
import type { AuthenticatedRequest } from './auth.middleware.js';
import { requireAuthentication } from './auth.middleware.js';
import { optionalSmartAuthentication } from './smartAuth.middleware.js';
import { isPublicRoute } from '../config/publicRoutes.js';

function requestWithToken(token: string): AuthenticatedRequest {
  return {
    headers: { authorization: `Bearer ${token}` },
    query: {},
    ip: '127.0.0.1',
    url: '/v2/promotions/evaluations',
    method: 'POST',
  } as AuthenticatedRequest;
}

function replyRecorder(): {
  reply: FastifyReply;
  status: () => number | undefined;
  payload: () => unknown;
} {
  let responseStatus: number | undefined;
  let responsePayload: unknown;
  const reply = {
    code(code: number) {
      responseStatus = code;
      return this;
    },
    send(payload: unknown) {
      responsePayload = payload;
      return this;
    },
  } as unknown as FastifyReply;

  return {
    reply,
    status: () => responseStatus,
    payload: () => responsePayload,
  };
}

test('optional authentication ignores an invalid bearer token', async () => {
  const request = requestWithToken('definitely-invalid-token');
  const recorder = replyRecorder();

  await optionalSmartAuthentication(request, recorder.reply);

  assert.equal(recorder.status(), undefined);
  assert.equal(recorder.payload(), undefined);
  assert.equal(request.user, undefined);
});

test('strict authentication still rejects an invalid bearer token', async () => {
  const request = requestWithToken('definitely-invalid-token');
  const recorder = replyRecorder();

  await requireAuthentication(request, recorder.reply);

  assert.equal(recorder.status(), 401);
  assert.deepEqual(recorder.payload(), {
    success: false,
    message: 'Invalid or expired token',
    details: 'Your authentication token is invalid or has expired. Please sign in again',
    statusCode: 401,
    tokenStatus: 'invalid_or_expired',
    suggestion: 'Please sign in again to get a new token',
  });
});

test('promotion evaluation routes are public for guest carts', () => {
  assert.equal(isPublicRoute('POST', '/v2/promotions/evaluations'), true);
  assert.equal(isPublicRoute('POST', '/v2/promotions/evaluations/evaluation-1/selections'), true);
  assert.equal(isPublicRoute('DELETE', '/v2/promotions/evaluations/evaluation-1/selections/42'), true);
  assert.equal(isPublicRoute('POST', '/v2/promotions/evaluations/evaluation-1/gift-selection'), true);
  assert.equal(isPublicRoute('POST', '/v2/promotions/evaluations/evaluation-1/validate'), true);
});
