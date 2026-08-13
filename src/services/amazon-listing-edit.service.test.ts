import assert from 'node:assert/strict';
import test from 'node:test';
import {
  diffAmazonListingAttributes,
  hashAmazonListingAttributes,
} from './amazon-listing-edit.service.js';
import {
  amazonListingEditApplySchema,
  amazonListingEditPreviewSchema,
} from '../schemas/amazon-offer.schema.js';

test('attribute baseline hashes are stable across object key order', () => {
  const left = hashAmazonListingAttributes({
    item_name: [{ marketplace_id: 'A21TJRUUN4KGV', value: 'First Rain' }],
    brand: [{ value: 'Nivaana' }],
  });
  const right = hashAmazonListingAttributes({
    brand: [{ value: 'Nivaana' }],
    item_name: [{ value: 'First Rain', marketplace_id: 'A21TJRUUN4KGV' }],
  });
  assert.equal(left, right);
  assert.match(left, /^[a-f0-9]{64}$/);
});

test('diff emits patches only for intentionally changed attribute groups', () => {
  const result = diffAmazonListingAttributes(
    {
      item_name: [{ value: 'First Rain' }],
      brand: [{ value: 'Nivaana' }],
      color: [{ value: 'Brown' }],
    },
    {
      item_name: [{ value: 'First Rain' }],
      brand: [{ value: 'NIVAANA' }],
    },
    new Set(['item_name', 'brand', 'color'])
  );
  assert.deepEqual(Object.keys(result.changedAttributes), ['brand']);
  assert.deepEqual(result.patches, [{
    op: 'replace',
    path: '/attributes/brand',
    value: [{ value: 'NIVAANA' }],
  }]);
});

test('diff reports attributes outside the product type contract', () => {
  const result = diffAmazonListingAttributes({}, { unknown_field: [{ value: 'x' }] }, new Set(['brand']));
  assert.deepEqual(result.invalidNames, ['unknown_field']);
  assert.deepEqual(result.patches, []);
});

test('listing edit request contracts protect offer and inventory attributes', () => {
  const baselineHash = 'a'.repeat(64);
  assert.deepEqual(amazonListingEditPreviewSchema.parse({
    baselineHash,
    changedAttributes: { brand: [{ value: 'Nivaana' }] },
  }), {
    baselineHash,
    changedAttributes: { brand: [{ value: 'Nivaana' }] },
  });
  assert.throws(() => amazonListingEditPreviewSchema.parse({
    baselineHash,
    changedAttributes: { purchasable_offer: [{ value: 100 }] },
  }));
  assert.deepEqual(amazonListingEditApplySchema.parse({
    previewId: '42',
    baselineHash,
    confirmed: true,
  }), {
    previewId: '42',
    baselineHash,
    confirmed: true,
  });
});
