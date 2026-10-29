import test from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../src/models/prisma.ts';
import { FlipkartComboMappingService } from '../src/services/flipkart-combo-mapping.service.ts';
import { FlipkartListingError, proposeFlipkartCombo } from '../src/services/flipkart-listing.service.ts';
import { buildCatalogWordStats } from '../src/utils/amazonProductMatch.ts';

// "Map as combo" for Flipkart (FKT-PLAN-02b): same rules as Amazon, Flipkart stock row only, listing FSN.

const restores: Array<() => void> = [];
function replace(target: any, key: string, value: unknown) {
  const original = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { value, configurable: true, writable: true });
  restores.push(() => (original ? Object.defineProperty(target, key, original) : delete target[key]));
}
const restoreAll = () => { while (restores.length) restores.pop()!(); };

const product = (id: bigint, puc: string) => ({
  id, puc, shortname: `${puc} short`, brand: 'auora', category: 'home_fragrance', subcategory: 'wardrobe_fragrance',
  fragnancetype: null, hsn_code: '33074900', gst_rate: '18.00', iscombo: false,
});
const VANILLA = product(18n, 'AUO-0018');
const JUNGLE = product(23n, 'AUO-0023');

function fakeDatabase(options: { combos?: Array<{ id: bigint; puc: string; parts: Array<[bigint, number]> }>; mappedTo?: bigint | null; flipkartRow?: boolean } = {}) {
  const bundles = (options.combos ?? []).flatMap((combo) => combo.parts.map(([componentId, qty]) => ({
    bundleproductid: combo.id, componentproductid: componentId, requiredqty: qty,
  })));
  const createdRows: any[] = [];
  replace(prisma.marketplaceListing, 'findFirst', async () => ({ id: 201n, productId: options.mappedTo ?? null, price: '238.00', flipkartDetail: { flipkartProductId: 'AIRHGH6NZG4STYCA' } }));
  replace(prisma, '$queryRawUnsafe', async (_sql: string, ids: string[]) => [VANILLA, JUNGLE].filter((row) => ids.includes(String(row.id))));
  replace(prisma.productBundleMap, 'findMany', async ({ where }: any) => bundles.filter((row) =>
    (where.componentproductid ? where.componentproductid.in.map(String).includes(String(row.componentproductid)) : true)
    && (where.bundleproductid ? where.bundleproductid.in.map(String).includes(String(row.bundleproductid)) : true)));
  replace(prisma.product, 'findUnique', async ({ where }: any) => {
    const combo = (options.combos ?? []).find((item) => item.id === where.id);
    return combo ? { id: combo.id, puc: combo.puc, name: `${combo.puc} name` } : null;
  });
  replace(prisma.platformStock, 'findUnique', async () => (options.flipkartRow ? { id: 1n } : null));
  replace(prisma.platformStock, 'create', async ({ data }: any) => { createdRows.push(data); return data; });
  return { createdRows };
}

function service() {
  const created: Array<{ input: any; options: any }> = [];
  const mapped: any[] = [];
  const instance = new FlipkartComboMappingService({
    createProduct: async (input, options) => { created.push({ input, options }); return { id: 600, puc: 'AUO-0600', name: 'AUORA - Wardrobe Fragrance Sachets Combo Pack' }; },
    mapListing: (async (listingId: string, productId: string, units: number) => { mapped.push({ listingId, productId, units }); return { id: listingId, productId, unitsPerListing: units, mappingStatus: 'MAPPED' }; }) as any,
  });
  return { instance, created, mapped };
}

const request = (components: Array<[string, number]>, extra: Record<string, unknown> = {}) => ({
  listingId: '201', components: components.map(([productId, requiredQty]) => ({ productId, requiredQty })), allowRemap: false, ...extra,
});

test('new combo: created with a Flipkart stock row only and the listing FSN, then mapped with 1 unit', async (t) => {
  t.after(restoreAll);
  fakeDatabase();
  const { instance, created, mapped } = service();
  const result = await instance.mapAsCombo(request([['18', 2], ['23', 1]]));
  assert.equal(created.length, 1);
  assert.deepEqual(created[0]!.options.platforms, ['flipkart']);
  assert.equal(created[0]!.input.fsn, 'AIRHGH6NZG4STYCA');
  assert.equal(created[0]!.input.price, 238);
  assert.deepEqual(created[0]!.input.components, [{ productid: '18', requiredqty: 2 }, { productid: '23', requiredqty: 1 }]);
  assert.deepEqual(mapped, [{ listingId: '201', productId: '600', units: 1 }]);
  assert.equal(result.combo.created, true);
});

test('existing combo with the same products is reused; a missing Flipkart stock row is added', async (t) => {
  t.after(restoreAll);
  const db = fakeDatabase({ combos: [{ id: 700n, puc: 'AUO-0700', parts: [[18n, 2], [23n, 1]] }] });
  const { instance, created, mapped } = service();
  const result = await instance.mapAsCombo(request([['23', 1], ['18', 2]]));
  assert.equal(created.length, 0);
  assert.equal(db.createdRows.length, 1);
  assert.equal(db.createdRows[0].platform, 'flipkart');
  assert.equal(db.createdRows[0].availableqty, 0);
  assert.equal(mapped[0].productId, '700');
  assert.equal(result.combo.created, false);
});

test('different quantities are a different combo', async (t) => {
  t.after(restoreAll);
  fakeDatabase({ combos: [{ id: 700n, puc: 'AUO-0700', parts: [[18n, 1], [23n, 1]] }] });
  const { instance, created } = service();
  await instance.mapAsCombo(request([['18', 2], ['23', 1]]));
  assert.equal(created.length, 1);
});

test('replacing an existing mapping needs confirmation; one product or duplicates are refused', async (t) => {
  t.after(restoreAll);
  fakeDatabase({ mappedTo: 18n });
  const { instance, created } = service();
  await assert.rejects(instance.mapAsCombo(request([['18', 2], ['23', 1]])), (error: unknown) =>
    error instanceof FlipkartListingError && error.code === 'FLIPKART_LISTING_REMAP_CONFIRMATION_REQUIRED');
  assert.equal(created.length, 0, 'nothing created before the confirmation');
  await assert.rejects(instance.mapAsCombo(request([['18', 2]])), (error: unknown) => error instanceof FlipkartListingError && error.code === 'FLIPKART_COMBO_TOO_FEW_PRODUCTS');
  await assert.rejects(instance.mapAsCombo(request([['18', 1], ['18', 1]])), (error: unknown) => error instanceof FlipkartListingError && error.code === 'FLIPKART_COMBO_DUPLICATE_PRODUCT');
  await instance.mapAsCombo(request([['18', 2], ['23', 1]], { allowRemap: true }));
  assert.equal(created.length, 1);
});

test('combo proposal from the title list counts repeated names', () => {
  const candidates = [
    { id: '18', puc: 'AUO-0018', name: 'AUORA - Vanilla' },
    { id: '23', puc: 'AUO-0023', name: 'AUORA - Jungle Vibe' },
    { id: '22', puc: 'AUO-0022', name: 'AUORA - Cool Aqua' },
    { id: '12', puc: 'NIV-0012', name: 'NIVAANA - Black Oudh - Value Pack - 30 Sticks' },
    { id: '39', puc: 'NIV-0039', name: 'NIVAANA - Black Oudh - TRY-ME-OUT Pack - 10 Sticks' },
    { id: '06', puc: 'NIV-0006', name: 'NIVAANA - Paradise Garden - Value Pack - 30 Sticks' },
  ];
  const stats = buildCatalogWordStats(candidates.map((item) => item.name));
  const auora = proposeFlipkartCombo('Auora Vanilla, Vanilla, Jungle Vibe Blocks Premium Fragrance Sachet Pack of 3 (3 x 1 Units)', candidates, stats);
  assert.deepEqual(auora.components.map((item) => [item.product.puc, item.quantity]), [['AUO-0018', 2], ['AUO-0023', 1]]);
  assert.equal(auora.itemCount, 3);
  assert.deepEqual(auora.unmatched, []);

  const incense = proposeFlipkartCombo('NIVAANA Premium Combo Incense Sticks Set Black Oudh, Paradise Garden (30 Units, Set of 2)', candidates, stats);
  assert.deepEqual(incense.components.map((item) => item.product.puc), ['NIV-0012', 'NIV-0006'], '30 in the title picks the 30-stick products');

  const unknown = proposeFlipkartCombo('Auora Vanilla, Pineapple Blocks Pack of 2', candidates, stats);
  assert.deepEqual(unknown.unmatched, ['Pineapple Blocks Pack of 2']);
});
