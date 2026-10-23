import test from 'node:test';
import assert from 'node:assert/strict';

import { openAfter } from '../src/services/amazon-operations.service.ts';

// FIX-132: an import failure followed by a successful import of the same kind is resolved

test('only failures after the last successful import stay open', () => {
  const lastSuccess = new Date('2026-10-22T06:45:50.000Z');
  assert.deepEqual(openAfter('createdAt', lastSuccess), { createdAt: { gt: lastSuccess } });
  assert.deepEqual(openAfter('startedAt', lastSuccess), { startedAt: { gt: lastSuccess } });
});

test('with no successful import yet, every failure stays open', () => {
  assert.deepEqual(openAfter('createdAt', null), {});
  assert.deepEqual(openAfter('createdAt', undefined), {});
});
