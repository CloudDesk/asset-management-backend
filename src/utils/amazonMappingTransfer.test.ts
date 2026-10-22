import test from 'node:test';
import assert from 'node:assert/strict';

import { listingKey, planMappingTransfer, stepsToApply, type ExportedAmazonMapping, type TargetListing } from './amazonMappingTransfer.ts';

const row = (sellerSku: string, puc: string, unitsPerListing = 1): ExportedAmazonMapping => ({
  sellerId: 'S1', marketplaceId: 'M1', sellerSku, fulfilmentChannel: 'MFN', puc, productName: puc, unitsPerListing,
});

// Target database: its own listing and product IDs
const listings = new Map<string, TargetListing>([
  [listingKey('S1', 'M1', 'NEW-1'), { id: '501', productId: null, unitsPerListing: 1 }],
  [listingKey('S1', 'M1', 'SAME-1'), { id: '502', productId: '77', unitsPerListing: 1 }],
  [listingKey('S1', 'M1', 'PACK-2'), { id: '503', productId: '77', unitsPerListing: 1 }],
  [listingKey('S1', 'M1', 'OTHER-1'), { id: '504', productId: '88', unitsPerListing: 1 }],
  [listingKey('S1', 'M1', 'NOPROD-1'), { id: '505', productId: null, unitsPerListing: 1 }],
]);
const products = new Map([['KRA-0049', '77'], ['NIV-0008', '99']]);

const plan = planMappingTransfer([
  row('NEW-1', 'kra-0049'),
  row('SAME-1', 'KRA-0049'),
  row('PACK-2', 'KRA-0049', 2),
  row('OTHER-1', 'NIV-0008'),
  row('NOPROD-1', 'XXX-0001'),
  row('GONE-1', 'KRA-0049'),
], listings, products);

test('matches by seller SKU and PUC, never by source IDs', () => {
  assert.deepEqual(plan.map((step) => [step.mapping.sellerSku, step.action, step.listingId ?? null, step.productId ?? null]), [
    ['NEW-1', 'MAP', '501', '77'],
    ['SAME-1', 'UNCHANGED', '502', '77'],
    ['PACK-2', 'UPDATE', '503', '77'],
    ['OTHER-1', 'CONFLICT', '504', '99'],
    ['NOPROD-1', 'PRODUCT_MISSING', '505', null],
    ['GONE-1', 'LISTING_MISSING', null, null],
  ]);
});

test('apply writes new and changed mappings; a different existing mapping only with --remap', () => {
  assert.deepEqual(stepsToApply(plan, false).map((step) => step.mapping.sellerSku), ['NEW-1', 'PACK-2']);
  assert.deepEqual(stepsToApply(plan, true).map((step) => step.mapping.sellerSku), ['NEW-1', 'PACK-2', 'OTHER-1']);
});
