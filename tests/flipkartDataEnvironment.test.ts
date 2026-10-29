import test from 'node:test';
import assert from 'node:assert/strict';

import { env } from '../src/config/env.ts';
import { flipkartDataEnvironment } from '../src/services/flipkart-api.client.ts';

test('Flipkart screens read MOCK rows only in mock mode (FKT-PLAN-01)', () => {
  const original = env.FLIPKART_MOCK_MODE;
  try {
    env.FLIPKART_MOCK_MODE = true;
    assert.equal(flipkartDataEnvironment(), 'MOCK');
    env.FLIPKART_MOCK_MODE = false;
    assert.equal(flipkartDataEnvironment(), 'PRODUCTION');
  } finally {
    env.FLIPKART_MOCK_MODE = original;
  }
});
