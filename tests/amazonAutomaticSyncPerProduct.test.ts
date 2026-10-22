import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AmazonProductionInventoryError,
  AmazonProductionInventoryService,
} from '../src/services/amazon-production-inventory.service.js';

// P7 / AMZ-PLAN-14: one Nivaana product, several seller-fulfilled listings → only one may be Automatic.
// Only the check is exercised: no database access (other listings are stubbed).

const serviceWith = (others: Array<{ sellerSku: string; inventorySyncMode: string }>) => {
  const service = new AmazonProductionInventoryService();
  (service as unknown as Record<string, unknown>).otherSellerFulfilledListings = async () => others;
  return service;
};

test('a second Automatic listing for the same product is refused and names the existing one', async () => {
  const service = serviceWith([
    { sellerSku: 'SINGLE-1', inventorySyncMode: 'AUTOMATIC' },
    { sellerSku: 'PACK-3', inventorySyncMode: 'MANUAL' },
  ]);
  await assert.rejects(service.assertOnlyAutomaticListing(9n, 2n), (error: unknown) =>
    error instanceof AmazonProductionInventoryError
    && error.statusCode === 409
    && error.code === 'AMAZON_AUTOMATIC_ALREADY_SET'
    && error.message.includes('SINGLE-1')
    && !error.message.includes('PACK-3'));
});

test('Automatic is allowed when the other listings are Manual or Off, or there are none', async () => {
  await serviceWith([
    { sellerSku: 'SINGLE-1', inventorySyncMode: 'MANUAL' },
    { sellerSku: 'PACK-3', inventorySyncMode: 'DISABLED' },
  ]).assertOnlyAutomaticListing(9n, 2n);
  await serviceWith([]).assertOnlyAutomaticListing(9n, 2n);
});
