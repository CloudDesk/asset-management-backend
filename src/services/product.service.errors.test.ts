import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { ValidationError } from '../utils/errorHandler.js';
import { toFriendlyProductSaveError } from './product.service.js';

const rawQueryError = (message: string, code: string) =>
  new Prisma.PrismaClientKnownRequestError(message, {
    code: 'P2010',
    clientVersion: 'test',
    meta: { code, message },
  });

test('duplicate product from a raw SQL insert/update becomes a friendly 400', () => {
  const error = toFriendlyProductSaveError(rawQueryError(
    'duplicate key value violates unique constraint "product_puc_key" Key (puc)=(NIV-0082) already exists.',
    '23505'
  ));
  assert.ok(error instanceof ValidationError);
  assert.equal(error.statusCode, 400);
  assert.equal(error.message, 'This product already exists.');
  assert.doesNotMatch(`${error.message} ${error.details}`, /puc|duplicate key|constraint/i);
});

test('duplicate product from a Prisma update becomes a friendly 400', () => {
  const error = toFriendlyProductSaveError(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: { target: ['puc'] },
  }));
  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'This product already exists.');
});

test('text longer than the column allows becomes a friendly 400', () => {
  const error = toFriendlyProductSaveError(rawQueryError('value too long for type character varying(255)', '22001'));
  assert.ok(error instanceof ValidationError);
  assert.equal(error.message, 'Some of the text entered is too long.');
  assert.doesNotMatch(`${error.message} ${error.details}`, /varying|character/i);
});

test('validation errors and unknown errors pass through unchanged', () => {
  const validation = new ValidationError('HSN code and GST rate are required.');
  assert.equal(toFriendlyProductSaveError(validation), validation);

  const unknown = new Error('connection reset');
  assert.equal(toFriendlyProductSaveError(unknown), unknown);
});
