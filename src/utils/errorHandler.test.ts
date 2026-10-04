import assert from 'node:assert/strict';
import test from 'node:test';
import type { FastifyRequest } from 'fastify';

import { PasswordResetEmailError } from '../services/email.service.js';
import { isPrismaErrorCode, processError } from './errorHandler.js';

test('recognizes only Prisma P followed by four digit error codes', () => {
  assert.equal(isPrismaErrorCode('P2002'), true);
  assert.equal(isPrismaErrorCode('P2025'), true);
  assert.equal(isPrismaErrorCode('PASSWORD_RESET_EMAIL_FAILED'), false);
  assert.equal(isPrismaErrorCode('P20'), false);
  assert.equal(isPrismaErrorCode(undefined), false);
});

test('keeps password reset delivery failures out of database error handling', () => {
  const request = {
    method: 'POST',
    url: '/v1/auth/forgot-password',
    query: {},
    params: {},
    body: { useremail: 'admin@example.com' },
    headers: {},
    ip: '127.0.0.1',
  } as unknown as FastifyRequest;

  const response = processError(new PasswordResetEmailError(), request);

  assert.deepEqual(response, {
    success: false,
    message: 'Unable to send the password reset email. Please contact the administrator.',
    details: 'Unable to send the password reset email. Please contact the administrator.',
    statusCode: 503,
  });
});
