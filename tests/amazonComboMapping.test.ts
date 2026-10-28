import test from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

import { prisma } from '../src/models/prisma.ts';
import { amazonChannelRoutes } from '../src/routes/amazon-channel.route.ts';
import { errorHandler } from '../src/utils/errorHandler.ts';
import { AmazonComboMappingService } from '../src/services/amazon-combo-mapping.service.ts';
import { AmazonListingMappingError } from '../src/services/amazon-listing-mapping.service.ts';

// "Map as combo" (AMZ-PLAN-27): an Amazon listing that sells several products is mapped to the combo with
// exactly those products, created for Amazon only when it does not exist yet.

const restores: Array<() => void> = [];
function replace(target: any, key: string, value: unknown) {
  const original = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { value, configurable: true, writable: true });
  restores.push(() => (original ? Object.defineProperty(target, key, original) : delete target[key]));
}
const restoreAll = () => { while (restores.length) restores.pop()!(); };

const product = (id: bigint, puc: string, extra: Record<string, unknown> = {}) => ({
  id, puc, shortname: `${puc} short`, brand: 'nivaana', category: 'pooja_essentials', subcategory: 'dhoop_sticks',
  fragnancetype: null, hsn_code: '33074100', gst_rate: '5.00', iscombo: false, ...extra,
});
const VAISHNAVI = product(96n, 'NIV-0096');
const EVENING = product(97n, 'NIV-0097');
const JASMINE = product(78n, 'NIV-0078');

/** Fake database: products, combos (bundle rows) and one Amazon listing */
function fakeDatabase(options: { combos?: Array<{ id: bigint; puc: string; parts: Array<[bigint, number]> }>; mappedTo?: bigint | null; products?: any[]; noListing?: boolean } = {}) {
  const products = options.products ?? [VAISHNAVI, EVENING, JASMINE];
  const bundles = (options.combos ?? []).flatMap((combo) => combo.parts.map(([componentId, qty]) => ({
    bundleproductid: combo.id, componentproductid: componentId, requiredqty: qty,
  })));
  replace(prisma.marketplaceListing, 'findFirst', async () => (options.noListing ? null : { id: 101n, productId: options.mappedTo ?? null, price: '349.00', asin: 'B0HKZPJHMK' }));
  replace(prisma, '$queryRawUnsafe', async (_sql: string, ids: string[]) => products.filter((row) => ids.includes(String(row.id))));
  replace(prisma.productBundleMap, 'findMany', async ({ where }: any) => bundles.filter((row) =>
    (where.componentproductid ? where.componentproductid.in.map(String).includes(String(row.componentproductid)) : true)
    && (where.bundleproductid ? where.bundleproductid.in.map(String).includes(String(row.bundleproductid)) : true)));
  replace(prisma.product, 'findUnique', async ({ where }: any) => {
    const combo = (options.combos ?? []).find((item) => item.id === where.id);
    return combo ? { id: combo.id, puc: combo.puc, name: `${combo.puc} name` } : null;
  });
}

function service() {
  const created: Array<{ input: any; options: any }> = [];
  const mapped: any[] = [];
  const instance = new AmazonComboMappingService({
    createProduct: async (input, options) => { created.push({ input, options }); return { id: 500, puc: 'NIV-0500', name: 'NIVAANA - Dhoop Sticks Combo Pack' }; },
    mapListing: async (input: any) => { mapped.push(input); return { id: '101', productId: input.productId } as any; },
  });
  return { instance, created, mapped };
}

const request = (components: Array<[string, number]>, extra: Record<string, unknown> = {}) => ({
  listingId: '101', components: components.map(([productId, requiredQty]) => ({ productId, requiredQty })),
  unitsPerListing: 1, allowRemap: false, sellerId: 'S', marketplaceId: 'M', ...extra,
});

test('POST /listings/:id/map-combo: body is checked before login', async (t) => {
  const app = Fastify();
  app.setErrorHandler(errorHandler);
  await app.register(amazonChannelRoutes, { prefix: '/api/channels/amazon' });
  t.after(() => app.close());
  const post = (payload: unknown) => app.inject({ method: 'POST', url: '/api/channels/amazon/listings/101/map-combo', payload });
  assert.equal((await post({ components: [{ productId: '96' }, { productId: '97', requiredQty: 2 }] })).statusCode, 401);
  assert.equal((await post({ components: [{ productId: '96' }] })).statusCode, 400, 'one product is not a combo');
  assert.equal((await post({ components: [{ productId: 'abc' }, { productId: '97' }] })).statusCode, 400);
  // Fastify drops unknown body fields (removeAdditional); the controller's strict Zod schema rejects them after login
  assert.equal((await post({ components: [{ productId: '96' }, { productId: '97' }], extra: true })).statusCode, 401);
});

test('reuses the combo with exactly these products and quantities; nothing is created', async () => {
  try {
    fakeDatabase({ combos: [{ id: 300n, puc: 'NIV-0300', parts: [[96n, 1], [97n, 1]] }] });
    const { instance, created, mapped } = service();
    const result = await instance.mapAsCombo(request([['97', 1], ['96', 1]]));
    assert.equal(created.length, 0);
    assert.equal(mapped[0].productId, '300');
    assert.deepEqual(result.combo, { id: '300', puc: 'NIV-0300', name: 'NIV-0300 name', created: false });
  } finally { restoreAll(); }
});

test('creates the combo (Amazon stock row only) when no combo has exactly these products', async () => {
  try {
    // Existing combos differ: one has an extra product, one has another quantity
    fakeDatabase({ combos: [
      { id: 300n, puc: 'NIV-0300', parts: [[96n, 1], [97n, 1], [78n, 1]] },
      { id: 301n, puc: 'NIV-0301', parts: [[96n, 2], [97n, 1]] },
    ] });
    const { instance, created, mapped } = service();
    const result = await instance.mapAsCombo(request([['96', 1], ['97', 1]]));
    assert.equal(created.length, 1);
    assert.deepEqual(created[0]!.options, { platforms: ['amazon'] });
    const input = created[0]!.input;
    assert.deepEqual(input.components, [{ productid: '96', requiredqty: 1 }, { productid: '97', requiredqty: 1 }]);
    assert.equal(input.iscombo, true);
    assert.equal(input.subcategory, 'dhoop_sticks');
    assert.equal(input.hsn_code, '33074100');
    assert.equal(input.gst_rate, 5);
    assert.equal(input.pack, 'pack_of_2');
    assert.equal(input.price, 349);
    assert.equal(input.asin, 'B0HKZPJHMK');
    assert.match(input.remarks, /^Dhoop Sticks Combo Pack \| /);
    assert.equal(mapped[0].productId, '500');
    assert.equal(result.combo.created, true);
  } finally { restoreAll(); }
});

test('asks before replacing a mapping, and creates nothing until confirmed', async () => {
  try {
    fakeDatabase({ mappedTo: 96n });
    const { instance, created } = service();
    await assert.rejects(instance.mapAsCombo(request([['96', 1], ['97', 1]])),
      (error: any) => error instanceof AmazonListingMappingError && error.code === 'AMAZON_LISTING_REMAP_CONFIRMATION_REQUIRED');
    assert.equal(created.length, 0);
    await instance.mapAsCombo(request([['96', 1], ['97', 1]], { allowRemap: true }));
    assert.equal(created.length, 1);
  } finally { restoreAll(); }
});

test('listing already mapped to the same combo: saved again without asking; unknown listing: 404', async () => {
  try {
    fakeDatabase({ mappedTo: 300n, combos: [{ id: 300n, puc: 'NIV-0300', parts: [[96n, 1], [97n, 1]] }] });
    const { instance, created, mapped } = service();
    await instance.mapAsCombo(request([['96', 1], ['97', 1]]));
    assert.equal(created.length, 0);
    assert.equal(mapped[0].productId, '300');
  } finally { restoreAll(); }
  try {
    fakeDatabase({ noListing: true });
    await assert.rejects(service().instance.mapAsCombo(request([['96', 1], ['97', 1]])),
      (error: any) => error.statusCode === 404 && error.code === 'AMAZON_LISTING_NOT_FOUND');
  } finally { restoreAll(); }
});

test('refuses combos that cannot be made safely', async () => {
  try {
    fakeDatabase({ products: [VAISHNAVI, EVENING, product(200n, 'NIV-0200', { iscombo: true }), product(85n, 'NIV-0085', { hsn_code: '34011190', gst_rate: '18.00' })] });
    const { instance, created } = service();
    const code = async (components: Array<[string, number]>) => {
      try { await instance.mapAsCombo(request(components)); return 'ok'; } catch (error: any) { return `${error.statusCode} ${error.code}`; }
    };
    assert.equal(await code([['96', 1], ['96', 2]]), '400 AMAZON_COMBO_DUPLICATE_PRODUCT');
    assert.equal(await code([['96', 1], ['999', 1]]), '404 NIVAANA_PRODUCT_NOT_FOUND');
    assert.equal(await code([['96', 1], ['200', 1]]), '409 AMAZON_COMBO_INVALID', 'a combo inside a combo');
    assert.equal(await code([['96', 1], ['85', 1]]), '409 AMAZON_COMBO_INVALID', 'different HSN / GST');
    assert.equal(created.length, 0);
  } finally { restoreAll(); }
});

test('product create: Amazon-only combos get only an Amazon stock row; the product form still gets all three', async () => {
  const { ProductService } = await import('../src/services/product.service.ts');
  try {
    const asked: string[] = [];
    // Every row "already exists", so this only records which platforms would be created
    replace(prisma.platformStock, 'findUnique', async ({ where }: any) => { asked.push(where.productid_platform.platform); return { id: 1n }; });
    const service = new ProductService() as any;
    await service.createDefaultPlatformStocks(5, ['amazon']);
    assert.deepEqual(asked, ['amazon']);
    asked.length = 0;
    await service.createDefaultPlatformStocks(5);
    assert.deepEqual(asked, ['amazon', 'flipkart', 'nivapp']);
  } finally { restoreAll(); }
});
