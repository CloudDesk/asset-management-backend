import assert from 'node:assert/strict';
import test from 'node:test';
import { getPaginationParams } from './pagination.js';

test('uses the default 100-record maximum', () => {
  assert.deepEqual(getPaginationParams({ page: '2', limit: '1000' }), {
    page: 2,
    limit: 100,
  });
});

test('allows a caller-specific maximum', () => {
  assert.deepEqual(getPaginationParams({ page: '1', limit: '1000' }, 1000), {
    page: 1,
    limit: 1000,
  });
});

test('still normalizes invalid page and limit values', () => {
  assert.deepEqual(getPaginationParams({ page: '0', limit: '0' }, 1000), {
    page: 1,
    limit: 10,
  });
});
