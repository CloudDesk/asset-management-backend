import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AmazonImportSummary,
  AmazonListingPersistence,
  AmazonListingQuery,
  AmazonListingUpsertResult,
} from '../repositories/amazon-listing.repository.js';
import {
  classifyAmazonFulfilment,
  isInactiveAmazonListing,
  normalizeAmazonListing,
  normalizeAmazonListingStatus,
  NormalizedAmazonListing,
} from './amazon-listing-normalizer.js';
import { AmazonListingImportService } from './amazon-listing-import.service.js';
import { AmazonAuthorizationError, AmazonAccessTokenProvider } from './amazon-lwa-token.service.js';
import {
  AmazonFbaInventoryPage,
  AmazonListingsPage,
  AmazonListingsReadClient,
  AmazonProductionListingsClient,
  AmazonRawListing,
} from './amazon-production-listings.client.js';

const MARKETPLACE_ID = 'A21TJRUUN4KGV';
const SELLER_ID = 'TEST_SELLER';

test('normalizes Amazon listing statuses and recognizes active inventory targets', () => {
  assert.equal(normalizeAmazonListingStatus([{ statuses: ['buyable', 'DISCOVERABLE'] }]), 'BUYABLE,DISCOVERABLE');
  assert.equal(normalizeAmazonListingStatus([{ status: 'active' }]), 'ACTIVE');
  assert.equal(normalizeAmazonListingStatus([]), 'UNKNOWN');
  assert.equal(isInactiveAmazonListing('BUYABLE'), false);
  assert.equal(isInactiveAmazonListing('DISCOVERABLE,SUPPRESSED'), false);
  assert.equal(isInactiveAmazonListing('SUPPRESSED'), true);
  assert.equal(isInactiveAmazonListing('UNKNOWN'), true);
});

const rawListing = (
  sku: string | undefined,
  options: { title?: string; fulfilmentCode?: string; statuses?: string[] } = {}
): AmazonRawListing => ({
  ...(sku === undefined ? {} : { sku }),
  summaries: [{
    marketplaceId: MARKETPLACE_ID,
    asin: 'B0TESTASIN',
    itemName: options.title ?? 'Test listing',
    productType: 'HOME',
    statuses: options.statuses ?? ['BUYABLE'],
    lastUpdatedDate: '2026-07-20T08:00:00.000Z',
  }],
  fulfillmentAvailability: [{
    fulfillmentChannelCode: options.fulfilmentCode ?? 'DEFAULT',
    quantity: 5,
  }],
  offers: [{
    marketplaceId: MARKETPLACE_ID,
    price: { amount: '199.00', currencyCode: 'INR' },
  }],
});

class FakeListingsClient implements AmazonListingsReadClient {
  readonly requestedPageTokens: Array<string | undefined> = [];

  constructor(private readonly pages: AmazonListingsPage[]) {}

  getSellerId(): string {
    return SELLER_ID;
  }

  getMarketplaceId(): string {
    return MARKETPLACE_ID;
  }

  async fetchListingsPage(pageToken?: string): Promise<AmazonListingsPage> {
    this.requestedPageTokens.push(pageToken);
    const index = pageToken ? Number(pageToken.replace('page-', '')) : 0;
    return this.pages[index] ?? { items: [], nextToken: null };
  }

  async fetchFbaInventoryPage(): Promise<AmazonFbaInventoryPage> {
    return { items: [], nextToken: null };
  }
}

class FakeListingRepository implements AmazonListingPersistence {
  readonly records = new Map<string, NormalizedAmazonListing & { sellerSku: string }>();
  readonly completedLogs: Array<{
    status: string;
    summary: AmazonImportSummary;
    error?: { code: string; message: string };
  }> = [];

  async startSyncLog(): Promise<string> {
    return String(this.completedLogs.length + 1);
  }

  async finishSyncLog(
    _id: string,
    status: 'SUCCESS' | 'PARTIAL' | 'FAILED',
    summary: AmazonImportSummary,
    error?: { code: string; message: string }
  ): Promise<void> {
    this.completedLogs.push({
      status,
      summary: { ...summary },
      ...(error ? { error } : {}),
    });
  }

  async upsertImportedListing(
    listing: NormalizedAmazonListing & { sellerSku: string }
  ): Promise<AmazonListingUpsertResult> {
    const key = `${listing.marketplace}|${listing.marketplaceId}|${listing.sellerId}|${listing.sellerSku}`;
    const existing = this.records.get(key);
    if (!existing) {
      this.records.set(key, listing);
      return { outcome: 'CREATED', isMapped: false };
    }

    const serialize = (value: NormalizedAmazonListing) => JSON.stringify({
      ...value,
      amazonLastUpdatedAt: value.amazonLastUpdatedAt?.toISOString() ?? null,
    });
    if (serialize(existing) === serialize(listing)) {
      return { outcome: 'UNCHANGED', isMapped: false };
    }

    this.records.set(key, listing);
    return { outcome: 'UPDATED', isMapped: false };
  }

  async listListings(_query: AmazonListingQuery) {
    return {
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      },
    };
  }
}

test('imports every listings page', async () => {
  const client = new FakeListingsClient([
    { items: [rawListing('SKU-1')], nextToken: 'page-1' },
    { items: [rawListing('SKU-2')], nextToken: null },
  ]);
  const repository = new FakeListingRepository();
  const service = new AmazonListingImportService({ client, repository, enabled: true });

  const summary = await service.importListings();

  assert.equal(summary.totalFetched, 2);
  assert.equal(summary.created, 2);
  assert.equal(summary.unmapped, 2);
  assert.deepEqual(client.requestedPageTokens, [undefined, 'page-1']);
  assert.equal(repository.records.size, 2);
});

test('prevents duplicate seller SKU records across pages', async () => {
  const client = new FakeListingsClient([
    { items: [rawListing('SKU-DUPLICATE')], nextToken: 'page-1' },
    { items: [rawListing('SKU-DUPLICATE')], nextToken: null },
  ]);
  const repository = new FakeListingRepository();
  const service = new AmazonListingImportService({ client, repository, enabled: true });

  const summary = await service.importListings();

  assert.equal(summary.totalFetched, 2);
  assert.equal(summary.created, 1);
  assert.equal(summary.conflicts, 0);
  assert.equal(repository.records.size, 1);
});

test('updates an existing imported listing without creating a duplicate', async () => {
  const repository = new FakeListingRepository();
  await new AmazonListingImportService({
    client: new FakeListingsClient([{ items: [rawListing('SKU-UPDATE')], nextToken: null }]),
    repository,
    enabled: true,
  }).importListings();

  const summary = await new AmazonListingImportService({
    client: new FakeListingsClient([{
      items: [rawListing('SKU-UPDATE', { title: 'Updated title' })],
      nextToken: null,
    }]),
    repository,
    enabled: true,
  }).importListings();

  assert.equal(summary.created, 0);
  assert.equal(summary.updated, 1);
  assert.equal(repository.records.size, 1);
});

test('classifies Amazon fulfilment values without relying on the Nivaana PUC', () => {
  assert.equal(classifyAmazonFulfilment('AMAZON_EU', false), 'FBA');
  assert.equal(classifyAmazonFulfilment('merchant_shipping_group=Easy Ship', false), 'EASY_SHIP');
  assert.equal(classifyAmazonFulfilment('DEFAULT', false), 'MFN');
  assert.equal(classifyAmazonFulfilment('unrecognized-channel', false), 'UNKNOWN');
});

test('normalizes Amazon-managed FBA quantities without treating them as publishable seller stock', () => {
  const listing = normalizeAmazonListing(rawListing('FBA-SKU'), {
    sellerId: SELLER_ID,
    marketplaceId: MARKETPLACE_ID,
    fbaInventory: {
      sellerSku: 'FBA-SKU',
      totalQuantity: 31,
      inventoryDetails: {
        fulfillableQuantity: 20,
        reservedQuantity: {
          totalReservedQuantity: 11,
          pendingCustomerOrderQuantity: 4,
        },
      },
    },
  });

  assert.equal(listing.fulfilmentChannel, 'FBA');
  assert.equal(listing.fbaFulfillableQuantity, 20);
  assert.equal(listing.fbaReservedQuantity, 11);
  assert.equal(listing.fbaPendingOrderQuantity, 4);
  assert.equal(listing.fbaTotalQuantity, 31);
});

test('counts a listing with no seller SKU as failed and does not persist it', async () => {
  const repository = new FakeListingRepository();
  const service = new AmazonListingImportService({
    client: new FakeListingsClient([{ items: [rawListing(undefined)], nextToken: null }]),
    repository,
    enabled: true,
  });

  const summary = await service.importListings();

  assert.equal(summary.totalFetched, 1);
  assert.equal(summary.failed, 1);
  assert.equal(summary.created, 0);
  assert.equal(repository.records.size, 0);
  assert.equal(repository.completedLogs[0]?.status, 'PARTIAL');
});

class FakeTokenProvider implements AmazonAccessTokenProvider {
  invalidated = false;

  async getAccessToken(): Promise<string> {
    return 'test-access-token';
  }

  invalidate(): void {
    this.invalidated = true;
  }
}

test('retries a throttled Amazon read request', async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    if (calls === 1) {
      return new Response(JSON.stringify({ errors: [{ code: 'QuotaExceeded' }] }), {
        status: 429,
        headers: { 'retry-after': '0' },
      });
    }
    return new Response(JSON.stringify({ items: [], pagination: {} }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  const client = new AmazonProductionListingsClient({
    accessTokenProvider: new FakeTokenProvider(),
    fetchImpl,
    sleep: async () => undefined,
    baseUrl: 'https://sellingpartnerapi-eu.amazon.com',
    sellerId: SELLER_ID,
    marketplaceId: MARKETPLACE_ID,
    maxRetries: 2,
  });

  await client.fetchListingsPage();
  assert.equal(calls, 2);
});

test('rejects invalid Amazon authorization without returning credentials', async () => {
  const tokenProvider = new FakeTokenProvider();
  const fetchImpl = (async () => new Response('{}', { status: 401 })) as typeof fetch;
  const client = new AmazonProductionListingsClient({
    accessTokenProvider: tokenProvider,
    fetchImpl,
    sleep: async () => undefined,
    baseUrl: 'https://sellingpartnerapi-eu.amazon.com',
    sellerId: SELLER_ID,
    marketplaceId: MARKETPLACE_ID,
    maxRetries: 0,
  });

  await assert.rejects(
    () => client.fetchListingsPage(),
    (error: unknown) => error instanceof AmazonAuthorizationError
      && !error.message.includes('test-access-token')
  );
  assert.equal(tokenProvider.invalidated, true);
});

test('repeated imports are idempotent', async () => {
  const repository = new FakeListingRepository();
  const client = new FakeListingsClient([{ items: [rawListing('SKU-IDEMPOTENT')], nextToken: null }]);
  const service = new AmazonListingImportService({ client, repository, enabled: true });

  const first = await service.importListings();
  const second = await service.importListings();

  assert.equal(first.created, 1);
  assert.equal(second.created, 0);
  assert.equal(second.updated, 0);
  assert.equal(second.unmapped, 1);
  assert.equal(repository.records.size, 1);
});
