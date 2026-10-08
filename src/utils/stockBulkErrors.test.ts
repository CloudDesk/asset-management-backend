import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { errorHandler } from './errorHandler.js';
import { formatBulkStockValidationError, toFriendlyStockInsertError } from './stockBulkErrors.js';

test('raw database insert errors become plain messages', () => {
  assert.match(
    toFriendlyStockInsertError('Raw query failed. Code: `23505`. Message: duplicate key value violates unique constraint "stock_sku_key"'),
    /^Some of these stock items already exist\./
  );
  assert.match(toFriendlyStockInsertError('value too long for type character varying(255)'), /^Some of the text entered is too long\./);
  assert.match(toFriendlyStockInsertError('insert violates foreign key constraint "fk_puc"'), /^This product could not be found\./);
  assert.equal(toFriendlyStockInsertError('connection reset'), 'These stock items could not be saved. Please try again.');
  assert.equal(toFriendlyStockInsertError(undefined), 'These stock items could not be saved. Please try again.');
});

test('schema issues are described with form labels', () => {
  assert.equal(
    formatBulkStockValidationError([{ instancePath: '/0/instances', keyword: 'maximum', params: { limit: 10000 } }]).message,
    'Quantity can be at most 10,000.'
  );
  assert.equal(
    formatBulkStockValidationError([
      { instancePath: '/0/batchno', keyword: 'maxLength', params: { limit: 255 } },
      { instancePath: '/0', keyword: 'required', params: { missingProperty: 'platform' } },
    ]).message,
    'Batch number must be 255 characters or fewer. Platform is required.'
  );
  assert.equal(
    formatBulkStockValidationError([{ instancePath: '', keyword: 'minItems', params: { limit: 1 } }]).message,
    'Please add the stock details before saving.'
  );
});

test('bulk-insert style route returns the friendly message as a 400', async (t) => {
  const app = Fastify();
  t.after(() => app.close());
  app.setErrorHandler(errorHandler);
  app.post('/bulk-insert', {
    schemaErrorFormatter: (errors) => formatBulkStockValidationError(errors),
    schema: {
      body: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          properties: {
            puc: { type: 'string', maxLength: 255 },
            platform: { type: 'string', maxLength: 100 },
            batchno: { type: 'string', maxLength: 255, nullable: true },
            instances: { type: 'number', minimum: 1, maximum: 10000 },
          },
          required: ['puc', 'platform', 'instances'],
        },
      },
    },
  }, async () => ({ ok: true }));

  const response = await app.inject({
    method: 'POST',
    url: '/bulk-insert',
    payload: [{ puc: 'NIV-0082', platform: 'nivapp', instances: 20000 }],
  });

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.success, false);
  assert.equal(body.message, 'Quantity can be at most 10,000.');
  assert.doesNotMatch(body.message, /body\/|instances/);
});
