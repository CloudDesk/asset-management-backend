import assert from 'node:assert/strict';
import test from 'node:test';
import {
  amazonPublishMediaScopeWhere,
  isAmazonDraftMediaEditableStatus,
} from './amazon-listing-publish-media.service.js';

test('removes runtime Amazon client fields before building Prisma filters', () => {
  const runtimeScope = {
    sellerId: 'SELLER',
    marketplaceId: 'MARKETPLACE',
    client: { fetchImpl: () => undefined, accessToken: 'must-not-reach-prisma' },
    source: 'ENVIRONMENT_FALLBACK',
  };
  assert.deepEqual(amazonPublishMediaScopeWhere(runtimeScope), {
    sellerId: 'SELLER',
    marketplaceId: 'MARKETPLACE',
  });
});

test('allows image changes throughout the current pre-submission listing workflow', () => {
  [
    'DRAFT',
    'CATALOG_REVIEW_REQUIRED',
    'NO_ASIN_MATCH',
    'PRODUCT_TYPE_REVIEW_REQUIRED',
    'ATTRIBUTES_REQUIRED',
    'ELIGIBILITY_CONFIRMED',
    'RESTRICTION_BLOCKED',
    'LOCAL_VALIDATED',
    'VALIDATION_FAILED',
    'AMAZON_VALIDATED',
  ].forEach((status) => assert.equal(
    isAmazonDraftMediaEditableStatus(status),
    true,
    `${status} should permit draft image changes`
  ));
});

test('blocks image changes after production submission or completion', () => {
  ['SUBMITTED', 'LIVE', 'NEEDS_ATTENTION', 'CANCELLED'].forEach((status) => assert.equal(
    isAmazonDraftMediaEditableStatus(status),
    false,
    `${status} should not permit draft image changes`
  ));
});
