import test from 'node:test';
import assert from 'node:assert/strict';

import { buildProductNaming } from '../src/utils/productNaming.js';

const picklists = [
  {
    fieldname: 'brand',
    value: 'nivaana',
    label: 'Nivaana',
    parent: null,
  },
];

test('builds a product name from the brand label and remarks', () => {
  assert.deepEqual(
    buildProductNaming({
      product: { brand: 'nivaana', remarks: 'Sandalwood Premium' },
      picklists,
    }),
    { name: 'Nivaana - Sandalwood Premium', remarks: 'Sandalwood Premium' },
  );
});

test('requires non-empty remarks', () => {
  assert.throws(
    () => buildProductNaming({ product: { brand: 'nivaana', remarks: ' ' }, picklists }),
    /Remarks are required/,
  );
});

test('supports remarks up to 1000 characters and names up to 1200 characters', () => {
  const remarks = 'x'.repeat(1000);
  const result = buildProductNaming({
    product: { brand: 'nivaana', remarks },
    picklists,
  });

  assert.equal(result.remarks.length, 1000);
  assert.equal(result.name, `Nivaana - ${remarks}`);
});

test('rejects remarks longer than 1000 characters', () => {
  assert.throws(
    () => buildProductNaming({
      product: { brand: 'nivaana', remarks: 'x'.repeat(1001) },
      picklists,
    }),
    /exceed 1000 characters/,
  );
});
