import test from 'node:test';
import assert from 'node:assert/strict';

import { FlipkartApiError, LiveFlipkartSellerApiClient } from '../src/services/flipkart-api.client.ts';
import { flipkartLooksLikeCombo, flipkartPackHint, isSameFsn, normalizeFlipkartListing } from '../src/services/flipkart-listing.service.ts';

type Call = { url: string; method: string; body: string | null };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const searchItem = (sku: string, index: number) => ({
  listingId: `LST${index}`, sellerId: 'SELLER1', productId: `FSN${String(index).padStart(13, '0')}`, sku, status: 'ACTIVE',
  product_name: `Listing ${sku}`, product_image_url: 'https://img/x.jpg', vertical: 'incense_stick',
  product_description: { ssp: 100, esp: 90, mrp: 150 },
});

const client = (handler: (call: Call) => Response | Promise<Response>, calls: Call[]) => new LiveFlipkartSellerApiClient({
  baseUrl: 'https://api.flipkart.test',
  accessToken: async () => 'token-1',
  sleep: async () => {},
  fetchImpl: (async (input: URL | string, init?: RequestInit) => {
    const call = { url: String(input), method: init?.method ?? 'GET', body: (init?.body as string) ?? null };
    calls.push(call);
    return handler(call);
  }) as typeof fetch,
});

test('live search merges listing details (price, tax, fulfilment, locations) fetched 10 SKUs per call', async () => {
  const calls: Call[] = [];
  const skus = Array.from({ length: 12 }, (_, index) => `SKU_${index}`);
  const api = client((call) => {
    if (call.url.endsWith('/listings/v3/product/search')) {
      return json({ totalListingsCount: 32, listingData: skus.map(searchItem) });
    }
    const requested = decodeURIComponent(call.url.split('/sellers/listings/v3/')[1]!).split(',');
    // SKU_11 is missing from the details answer: search data is used for it
    return json({ available: Object.fromEntries(requested.filter((sku) => sku !== 'SKU_11').map((sku) => [sku, {
      listing_id: `L-${sku}`, product_id: 'INSHEVBUPWBJGCHQ', product_title: `Title ${sku}`,
      price: { mrp: 150, selling_price: 126, currency: 'INR' }, tax: { hsn: '33074100', tax_code: 'GST_5' },
      listing_status: 'ACTIVE', fulfillment_profile: 'NON_FBF', fulfillment: { shipping_provider: 'FLIPKART', procurement_type: 'EXPRESS' },
      locations: [{ id: 'LOC1', status: 'ENABLED', inventory: 46 }],
    }])) });
  }, calls);

  const page = await api.searchListings({ state: 'ACTIVE', page: 0 });

  assert.equal(page.items.length, 12);
  assert.equal(page.hasMore, true, '12 of 32 read on batch 0');
  const detailCalls = calls.filter((call) => call.url.includes('/sellers/listings/v3/'));
  assert.deepEqual(detailCalls.map((call) => decodeURIComponent(call.url.split('/v3/')[1]!).split(',').length), [10, 2]);
  assert.deepEqual(JSON.parse(calls[0]!.body!), { batchNo: 0, internalState: 'ACTIVE' });
  const first = page.items[0]!;
  assert.equal(first.sellingPrice, 126);
  assert.equal(first.productId, 'INSHEVBUPWBJGCHQ');
  assert.equal(first.fulfilmentProfile, 'NON_FBF');
  assert.equal(first.hsn, '33074100');
  assert.deepEqual(first.locations, [{ id: 'LOC1', status: 'ENABLED', inventory: 46 }]);
  const missing = page.items.find((item) => item.sku === 'SKU_11')!;
  assert.equal(missing.sellingPrice, 100, 'falls back to search ssp');
  assert.deepEqual(missing.locations, []);
});

test('last batch reports no more pages', async () => {
  const api = client((call) => call.url.endsWith('/product/search')
    ? json({ totalListingsCount: 26, listingData: Array.from({ length: 6 }, (_, index) => searchItem(`S${index}`, index)) })
    : json({ available: {} }), []);
  const page = await api.searchListings({ state: 'INACTIVE', page: 1 });
  assert.equal(page.hasMore, false);
});

test('rate limits are retried; a rejected token stops with a clear error', async () => {
  let searches = 0;
  const retried = client((call) => {
    if (call.url.endsWith('/product/search')) {
      searches += 1;
      return searches === 1 ? json({ message: 'slow down' }, 429) : json({ totalListingsCount: 0, listingData: [] });
    }
    return json({ available: {} });
  }, []);
  assert.equal((await retried.searchListings({ state: 'ACTIVE', page: 0 })).items.length, 0);
  assert.equal(searches, 2);

  const rejected = client(() => json({ error: 'unauthorized' }, 401), []);
  await assert.rejects(rejected.searchListings({ state: 'ACTIVE', page: 0 }), (error: unknown) =>
    error instanceof FlipkartApiError && error.code === 'FLIPKART_API_UNAUTHORIZED');
});

test('stock and order calls are not built yet in live mode', async () => {
  const api = client(() => json({}), []);
  await assert.rejects(api.updateInventory([]), (error: unknown) => error instanceof FlipkartApiError && error.statusCode === 501);
});

test('pack size hint from SKU or title', () => {
  assert.equal(flipkartPackHint('Auora_VaniVaniJungle_Pack3'), 3);
  assert.equal(flipkartPackHint('Nivaana_BlackOudh_Single'), 1);
  assert.equal(flipkartPackHint('NV-ROSE', 'Rose incense (Pack of 2)'), 2);
  assert.equal(flipkartPackHint('NV-ROSE', 'Rose incense 100 sticks'), null);
  assert.equal(flipkartPackHint('Nivaana_10P_KasOudhGarden_P3'), 3);
  assert.equal(flipkartPackHint('Nivaana_CedarOudhCanopy_3Unit'), 3);
  assert.equal(flipkartPackHint('Nivaana_KesFloralParadise_Unit3'), 3);
  assert.equal(flipkartPackHint('DM_COMM_001', 'Diffuser (1 Units)'), null);
});

test('FSN match ignores case and spaces; empty never matches', () => {
  assert.equal(isSameFsn(' inshevbupwbjgchq ', 'INSHEVBUPWBJGCHQ'), true);
  assert.equal(isSameFsn(null, 'INSHEVBUPWBJGCHQ'), false);
  assert.equal(isSameFsn('', ''), false);
});

test('live listings are stored as PRODUCTION; FBF listings are Flipkart-fulfilled', () => {
  const base = { listingId: 'L', sellerId: 'S', productId: 'F', sku: 'SKU', status: 'ACTIVE' as const, productName: 'N', vertical: 'v', mrp: 1, sellingPrice: 1, locations: [] };
  assert.equal(normalizeFlipkartListing(base, 'PRODUCTION').environment, 'PRODUCTION');
  assert.equal(normalizeFlipkartListing({ ...base, fulfilmentProfile: 'NON_FBF' }, 'PRODUCTION').fulfilmentChannel, 'SELLER');
  assert.equal(normalizeFlipkartListing({ ...base, fulfilmentProfile: 'FBF' }, 'PRODUCTION').fulfilmentChannel, 'FLIPKART');
});

test('mixed listings are flagged as combos; quantities in brackets are not', () => {
  assert.equal(flipkartLooksLikeCombo('Auora_VaniVaniJungle_Pack3', 'Auora Vanilla, Vanilla, Jungle Vibe Blocks Premium Fragrance Sachet Pack'), true);
  assert.equal(flipkartLooksLikeCombo('DS_BR_SB_100_Pack2', 'NIVAANA SpiritualBliss & BlissfulRose Premium Dhoop Sticks'), true);
  assert.equal(flipkartLooksLikeCombo('Kraftella_LionComboBlack', 'KRAFTELLA Decorative Showpiece - 17 cm (Resin, Black)'), true);
  assert.equal(flipkartLooksLikeCombo('Nivaana_BlackOudh_Single', 'NIVAANA Premium Agarbatti Fragrance Sticks Black Oudh (30 Units, Set of 1)'), false);
  assert.equal(flipkartLooksLikeCombo('Nivaana_DiffuserOil_Teakwood_Pack1', 'NIVAANA TeakWood Aroma Oil, Diffuser, Refill Premium | (10 ml)'), false);
  assert.equal(flipkartLooksLikeCombo('NIV_HCH_PINK_P1', 'NIVAANA Ceramic Incense Holder for Dhoop Cups & Sambrani (Pink)'), false);
  assert.equal(flipkartLooksLikeCombo('Nivaana_KesFloralParadise_Unit3', 'NIVAANA Incense Sticks Kesar Chandan, Floral Valley, Paradise Garden (3 Units, Set of 3)'), true);
});
