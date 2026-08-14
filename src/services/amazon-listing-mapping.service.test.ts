import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AmazonListingMappingPersistence,
  AmazonListingMappingRepositoryResult,
} from '../repositories/amazon-listing.repository.js';
import { bulkMapAmazonListingsSchema, mapAmazonListingSchema } from '../schemas/amazon-listing.schema.js';
import {
  AmazonListingMappingError,
  AmazonListingMappingService,
} from './amazon-listing-mapping.service.js';

const MARKETPLACE_ID = 'A21TJRUUN4KGV';
const SELLER_ID = 'TEST_SELLER';

const serializedListing = (overrides: Record<string, unknown> = {}) => ({
  id: '101',
  marketplace: 'AMAZON',
  environment: 'PRODUCTION',
  marketplaceId: MARKETPLACE_ID,
  sellerId: SELLER_ID,
  sellerSku: 'AMAZON-LONG-SELLER-SKU',
  productId: '98',
  mappingStatus: 'MAPPED',
  unitsPerListing: 1,
  mappedProduct: {
    id: '98',
    puc: 'OTH-0098',
    name: 'First Rains',
  },
  ...overrides,
});

class FakeMappingRepository implements AmazonListingMappingPersistence {
  readonly mapInputs: Array<Parameters<AmazonListingMappingPersistence['mapListing']>[0]> = [];
  readonly unmapInputs: Array<Parameters<AmazonListingMappingPersistence['unmapListing']>[0]> = [];

  mapResult: AmazonListingMappingRepositoryResult = {
    status: 'MAPPED',
    listing: serializedListing(),
  };
  unmapResult: Record<string, unknown> | null = serializedListing({
    productId: null,
    mappingStatus: 'UNMAPPED',
    unitsPerListing: 1,
    mappedProduct: null,
  });

  async mapListing(input: Parameters<AmazonListingMappingPersistence['mapListing']>[0]) {
    this.mapInputs.push(input);
    return this.mapResult;
  }

  async unmapListing(input: Parameters<AmazonListingMappingPersistence['unmapListing']>[0]) {
    this.unmapInputs.push(input);
    return this.unmapResult;
  }
}

const createService = (repository: FakeMappingRepository) => new AmazonListingMappingService({
  repository,
  connection: {
    getSellerId: () => SELLER_ID,
    getMarketplaceId: () => MARKETPLACE_ID,
  },
});

test('maps an imported Amazon seller SKU to an explicit Nivaana product', async () => {
  const repository = new FakeMappingRepository();
  const service = createService(repository);

  const listing = await service.mapListing({
    listingId: '101',
    productId: '98',
    unitsPerListing: 2,
    allowRemap: false,
  });

  assert.equal(listing.productId, '98');
  assert.deepEqual(repository.mapInputs, [{
    listingId: '101',
    productId: '98',
    unitsPerListing: 2,
    allowRemap: false,
    sellerId: SELLER_ID,
    marketplaceId: MARKETPLACE_ID,
  }]);
});

test('requires explicit confirmation before replacing a permanent mapping', async () => {
  const repository = new FakeMappingRepository();
  repository.mapResult = {
    status: 'REMAP_REQUIRES_CONFIRMATION',
    currentProductId: '40',
  };
  const service = createService(repository);

  await assert.rejects(
    service.mapListing({
      listingId: '101',
      productId: '98',
      unitsPerListing: 1,
      allowRemap: false,
    }),
    (error: unknown) => {
      assert.ok(error instanceof AmazonListingMappingError);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'AMAZON_LISTING_REMAP_CONFIRMATION_REQUIRED');
      return true;
    }
  );
});

test('passes an explicit remap confirmation to the repository', async () => {
  const repository = new FakeMappingRepository();
  const service = createService(repository);

  await service.mapListing({
    listingId: '101',
    productId: '98',
    unitsPerListing: 1,
    allowRemap: true,
  });

  assert.equal(repository.mapInputs[0]?.allowRemap, true);
});

test('returns a safe not-found error when the Nivaana product does not exist', async () => {
  const repository = new FakeMappingRepository();
  repository.mapResult = { status: 'PRODUCT_NOT_FOUND' };
  const service = createService(repository);

  await assert.rejects(
    service.mapListing({
      listingId: '101',
      productId: '999',
      unitsPerListing: 1,
      allowRemap: false,
    }),
    (error: unknown) => {
      assert.ok(error instanceof AmazonListingMappingError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, 'NIVAANA_PRODUCT_NOT_FOUND');
      return true;
    }
  );
});

test('returns a safe not-found error when the imported listing does not exist', async () => {
  const repository = new FakeMappingRepository();
  repository.mapResult = { status: 'LISTING_NOT_FOUND' };
  const service = createService(repository);

  await assert.rejects(
    service.mapListing({
      listingId: '999',
      productId: '98',
      unitsPerListing: 1,
      allowRemap: false,
    }),
    (error: unknown) => {
      assert.ok(error instanceof AmazonListingMappingError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, 'AMAZON_LISTING_NOT_FOUND');
      return true;
    }
  );
});

test('unmaps a listing without changing either Nivaana or Amazon inventory', async () => {
  const repository = new FakeMappingRepository();
  const service = createService(repository);

  const listing = await service.unmapListing('101');

  assert.equal(listing.mappingStatus, 'UNMAPPED');
  assert.deepEqual(repository.unmapInputs, [{
    listingId: '101',
    sellerId: SELLER_ID,
    marketplaceId: MARKETPLACE_ID,
  }]);
});

test('returns a safe not-found error when unmapping an unknown listing', async () => {
  const repository = new FakeMappingRepository();
  repository.unmapResult = null;
  const service = createService(repository);

  await assert.rejects(
    service.unmapListing('999'),
    (error: unknown) => {
      assert.ok(error instanceof AmazonListingMappingError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, 'AMAZON_LISTING_NOT_FOUND');
      return true;
    }
  );
});

test('validates mapping identifiers and units before persistence', () => {
  assert.deepEqual(mapAmazonListingSchema.parse({ productId: 98 }), {
    productId: '98',
    unitsPerListing: 1,
    allowRemap: false,
  });
  assert.throws(() => mapAmazonListingSchema.parse({ productId: '0' }));
  assert.throws(() => mapAmazonListingSchema.parse({ productId: '98', unitsPerListing: 0 }));
});

test('validates a bounded bulk mapping request', () => {
  assert.deepEqual(bulkMapAmazonListingsSchema.parse({
    items: [{ listingId: '101', productId: '98' }],
  }), {
    items: [{ listingId: '101', productId: '98', unitsPerListing: 1, allowRemap: false }],
  });
  assert.throws(() => bulkMapAmazonListingsSchema.parse({ items: [] }));
  assert.throws(() => bulkMapAmazonListingsSchema.parse({
    items: Array.from({ length: 101 }, (_, index) => ({ listingId: String(index + 1), productId: '98' })),
  }));
});
