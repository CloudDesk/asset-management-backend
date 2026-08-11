import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProductShortName, PRODUCT_SHORT_NAME_MAX_LENGTH } from '../src/utils/productShortName.js';

test('uses remarks as the editable short-name source', () => {
  assert.equal(
    buildProductShortName({
      name: 'NIVAANA - Kasturi - Value Pack - 30 Sticks',
      remarks: 'Kasturi - Value Pack - 30 Sticks',
      puc: 'NIV-0004',
    }),
    'Kasturi - Value Pack - 30 Sticks',
  );
});

test('condenses pipe-delimited marketing copy and retains quantity', () => {
  assert.equal(
    buildProductShortName({
      name: 'NIVAANA - Butter Bliss',
      remarks: 'Butter Bliss Premium Glycerine Bathing Bar | Moisturising Bath Soap | 100g',
      puc: 'NIV-0068',
    }),
    'Butter Bliss Premium Glycerine Bathing Bar - 100g',
  );
});

test('keeps generated values within the database limit', () => {
  const result = buildProductShortName({
    name: 'NIVAANA - Long Product',
    remarks: `${'Long descriptive product copy '.repeat(12)}final text`,
    puc: 'NIV-9999',
  });

  assert.ok(result.length <= PRODUCT_SHORT_NAME_MAX_LENGTH);
  assert.match(result, / - NIV-9999$/);
});
