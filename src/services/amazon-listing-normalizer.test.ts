import test from 'node:test';
import assert from 'node:assert/strict';

import { isIncompleteAmazonListing } from './amazon-listing-normalizer.ts';

// Seller Central's listing counts leave out listings without an offer price (e.g. NIV_CIH_PACK, 2026-10-22)
test('a listing without a price is incomplete unless it is deleted', () => {
  assert.equal(isIncompleteAmazonListing({ price: null, listingStatus: 'DISCOVERABLE' }), true);
  assert.equal(isIncompleteAmazonListing({ price: undefined, listingStatus: 'DISCOVERABLE' }), true);
  assert.equal(isIncompleteAmazonListing({ price: '179', listingStatus: 'DISCOVERABLE' }), false);
  assert.equal(isIncompleteAmazonListing({ price: 0, listingStatus: 'BUYABLE,DISCOVERABLE' }), false);
  assert.equal(isIncompleteAmazonListing({ price: null, listingStatus: 'DELETED' }), false);
});
