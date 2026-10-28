import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../models/prisma.js';
import {
  AmazonComboStockError,
  amazonAvailableByProduct,
  calculateComboAvailable,
  expandAmazonStockLines,
} from './amazon-combo-stock.service.js';
import { AmazonOrderRoutingService } from './amazon-order-routing.service.js';
import { AmazonProductionInventoryService } from './amazon-production-inventory.service.js';
import { AmazonReturnService } from './amazon-return.service.js';
import { env } from '../config/env.js';
import { amazonProductionWriteGuardService } from './amazon-production-write-guard.service.js';
import { amazonListingScopeService } from './amazon-listing-scope.service.js';

// AMZ-PLAN-27: a combo is virtual stock. C = 1 x A + 1 x B is available as min(A, B); an Amazon
// order for C reserves, sells and releases A and B; a returned C restocks A and B.

const A = 1n, B = 2n, C = 3n, SINGLE = 4n, EMPTY_COMBO = 5n;

type Stock = { id: bigint; productid: bigint; platform: string; availableqty: number; orderedqty: number; soldqty: number; platformstatus?: string };
type Row = Record<string, any>;

/** In-memory stand-in for the Prisma calls the Amazon stock code makes */
function fakeDatabase(stock: Record<string, number>) {
  const products = new Map<bigint, Row>([
    [A, { id: A, puc: 'NIV-A', iscombo: false, availablequantity: stock.A, orderedquantity: 0, soldquantity: 0 }],
    [B, { id: B, puc: 'NIV-B', iscombo: false, availablequantity: stock.B, orderedquantity: 0, soldquantity: 0 }],
    [C, { id: C, puc: 'NIV-C', iscombo: true, availablequantity: 0, orderedquantity: 0, soldquantity: 0 }],
    [SINGLE, { id: SINGLE, puc: 'NIV-S', iscombo: false, availablequantity: stock.SINGLE ?? 0, orderedquantity: 0, soldquantity: 0 }],
    [EMPTY_COMBO, { id: EMPTY_COMBO, puc: 'NIV-E', iscombo: true, availablequantity: 0, orderedquantity: 0, soldquantity: 0 }],
  ]);
  const bundle = [
    { id: 1n, bundleproductid: C, componentproductid: A, requiredqty: 1, isactive: true },
    { id: 2n, bundleproductid: C, componentproductid: B, requiredqty: stock.requiredB ?? 1, isactive: true },
    { id: 3n, bundleproductid: EMPTY_COMBO, componentproductid: A, requiredqty: 1, isactive: false },
  ];
  const stocks: Stock[] = [
    { id: 11n, productid: A, platform: 'amazon', availableqty: stock.A, orderedqty: 0, soldqty: stock.soldA ?? 0 },
    ...(stock.noStockRowB ? [] : [{ id: 12n, productid: B, platform: 'amazon', availableqty: stock.B, orderedqty: 0, soldqty: stock.soldB ?? 0 }]),
    { id: 13n, productid: C, platform: 'amazon', availableqty: 0, orderedqty: 0, soldqty: 0 },
    { id: 14n, productid: SINGLE, platform: 'amazon', availableqty: stock.SINGLE ?? 0, orderedqty: 0, soldqty: 0 },
  ];
  const reservations: Row[] = [];
  let nextId = 100n;

  const inList = (value: any, condition: any) => condition?.in ? condition.in.map(String).includes(String(value)) : String(value) === String(condition);
  const meets = (row: Row, where: Row = {}): boolean => Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') return (condition as Row[]).some((part) => meets(row, part));
    if (key === 'NOT') return !meets(row, condition);
    if (key === 'platform') return true;
    if (condition && typeof condition === 'object' && 'gte' in condition) return row[key] >= condition.gte;
    if (condition && typeof condition === 'object' && 'in' in condition) return inList(row[key], condition);
    if (condition && typeof condition === 'object' && 'notIn' in condition) return !condition.notIn.map(String).includes(String(row[key]));
    return String(row[key]) === String(condition);
  });
  const apply = (row: Row, data: Row) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'increment' in value) row[key] += value.increment;
      else if (value && typeof value === 'object' && 'decrement' in value) row[key] -= value.decrement;
      else row[key] = value;
    }
    return row;
  };

  const fake: Record<string, Record<string, (...args: any[]) => any>> = {
    product: {
      findMany: async ({ where }: any) => [...products.values()].filter((row) => meets(row, where)),
      findUnique: async ({ where }: any) => products.get(BigInt(where.id)) ?? null,
      update: async ({ where, data }: any) => apply(products.get(BigInt(where.id))!, data),
    },
    productBundleMap: {
      findMany: async ({ where }: any) => bundle.filter((row) => meets(row, where)),
    },
    platformStock: {
      findMany: async ({ where }: any) => stocks.filter((row) => meets(row, where)),
      findFirst: async ({ where }: any) => stocks.find((row) => meets(row, where)) ?? null,
      findUnique: async ({ where }: any) => stocks.find((row) => row.id === where.id) ?? null,
      updateMany: async ({ where, data }: any) => {
        const rows = stocks.filter((row) => meets(row, where));
        rows.forEach((row) => apply(row, data));
        return { count: rows.length };
      },
      update: async ({ where, data }: any) => apply(stocks.find((row) => row.id === where.id)!, data),
    },
    amazonOrderStockReservation: {
      updateMany: async ({ where, data }: any) => {
        const rows = reservations.filter((row) => meets(row, where));
        rows.forEach((row) => apply(row, data));
        return { count: rows.length };
      },
      findMany: async ({ where }: any) => reservations.filter((row) => meets(row, where)),
      findFirst: async ({ where }: any) => reservations.find((row) => meets(row, where)) ?? null,
      deleteMany: async ({ where }: any) => {
        const remove = reservations.filter((row) => meets(row, where));
        remove.forEach((row) => reservations.splice(reservations.indexOf(row), 1));
        return { count: remove.length };
      },
      update: async ({ where, data }: any) => apply(reservations.find((row) => row.id === where.id)!, data),
      upsert: async ({ where, create, update }: any) => {
        const key = where.orderId_amazonOrderItemId_productId;
        const found = key
          ? reservations.find((row) => row.orderId === key.orderId && row.amazonOrderItemId === key.amazonOrderItemId && row.productId === key.productId)
          : reservations.find((row) => row.id === where.id);
        if (found) return apply(found, update);
        const row = { id: nextId++, comboProductId: null, platformStockId: null, ...create };
        reservations.push(row);
        return row;
      },
    },
  };
  return { fake, products, stocks, reservations };
}

function useFake(fake: Record<string, Record<string, (...args: any[]) => any>>, extra: Array<[any, string, any]> = []) {
  const restore: Array<() => void> = [];
  const replace = (target: any, key: string, value: any) => {
    const old = Object.getOwnPropertyDescriptor(target, key);
    Object.defineProperty(target, key, { value, configurable: true, writable: true });
    restore.push(() => (old ? Object.defineProperty(target, key, old) : delete target[key]));
  };
  for (const [model, methods] of Object.entries(fake)) {
    for (const [method, impl] of Object.entries(methods)) replace((prisma as any)[model], method, impl);
  }
  replace(prisma, '$transaction', async (work: any) => (typeof work === 'function' ? work(prisma) : Promise.all(work)));
  for (const [target, key, value] of extra) replace(target, key, value);
  return () => { while (restore.length) restore.pop()!(); };
}

const stockOf = (stocks: Stock[], productId: bigint) => stocks.find((row) => row.productid === productId)!;
const comboOrder = (quantityOrdered: number, productId = C, unitsPerListing = 1) => ({
  id: 7n,
  items: [{ amazonOrderItemId: 'ITEM-1', listingId: 50n, productId, quantityOrdered, unitsPerListing }],
});

test('combo stock is the lowest component stock divided by its quantity per combo', () => {
  assert.equal(calculateComboAvailable([{ available: 15, requiredQty: 1 }, { available: 10, requiredQty: 1 }]), 10);
  assert.equal(calculateComboAvailable([{ available: 15, requiredQty: 1 }, { available: 10, requiredQty: 2 }]), 5);
  assert.equal(calculateComboAvailable([{ available: -3, requiredQty: 1 }, { available: 10, requiredQty: 1 }]), 0);
  assert.equal(calculateComboAvailable([]), 0);
});

test('a combo order line becomes one line per component; a single product stays as it is', () => {
  const combos = new Map([[String(C), [{ productId: A, requiredQty: 1 }, { productId: B, requiredQty: 2 }]], [String(EMPTY_COMBO), []]]);
  assert.deepEqual(expandAmazonStockLines(C, 3, combos), [
    { productId: A, quantity: 3, comboProductId: C },
    { productId: B, quantity: 6, comboProductId: C },
  ]);
  assert.deepEqual(expandAmazonStockLines(SINGLE, 2, combos), [{ productId: SINGLE, quantity: 2, comboProductId: null }]);
  assert.throws(() => expandAmazonStockLines(EMPTY_COMBO, 1, combos), AmazonComboStockError);
});

test('Amazon stock per product: combos from components (inactive ones ignored), singles from their own stock', async () => {
  const db = fakeDatabase({ A: 15, B: 10, SINGLE: 7 });
  const restore = useFake(db.fake);
  try {
    const { available } = await amazonAvailableByProduct([C, SINGLE, EMPTY_COMBO]);
    assert.equal(available.get(String(C)), 10);
    assert.equal(available.get(String(SINGLE)), 7);
    assert.equal(available.get(String(EMPTY_COMBO)), 0);
  } finally { restore(); }
});

test('Stock Sync target for a combo listing comes from its components', async () => {
  const db = fakeDatabase({ A: 15, B: 10 });
  const listing = { id: 50n, sellerSku: 'COMBO', productType: 'X', listingStatus: 'BUYABLE,DISCOVERABLE', fulfilmentChannel: 'MFN',
    mappingStatus: 'MAPPED', productId: C, unitsPerListing: 1, inventorySyncMode: 'MANUAL', price: 299 };
  const restore = useFake({ ...db.fake, marketplaceListing: { findFirst: async () => listing } });
  try {
    const context = await (new AmazonProductionInventoryService() as any).loadContext('50', { sellerId: 'S', marketplaceId: 'M' });
    assert.equal(context.nivaanaQuantity, 10);
    assert.equal(context.targetQuantity, 10);
    listing.productId = EMPTY_COMBO;
    await assert.rejects(
      (new AmazonProductionInventoryService() as any).loadContext('50', { sellerId: 'S', marketplaceId: 'M' }),
      (error: any) => error.code === 'AMAZON_COMBO_NO_COMPONENTS',
    );
  } finally { restore(); }
});

test('a combo order reserves each component, sells them on shipment and releases them on cancel', async () => {
  const db = fakeDatabase({ A: 15, B: 10, requiredB: 2 });
  const restore = useFake(db.fake);
  try {
    const service = new AmazonOrderRoutingService() as any;
    const reserved = await service.reserveSellerStock(comboOrder(2), false);
    assert.equal(reserved.success, true);
    assert.deepEqual(db.reservations.map((row) => [row.productId, row.quantity, row.comboProductId, row.status]), [
      [A, 2, C, 'RESERVED'],
      [B, 4, C, 'RESERVED'],
    ]);
    assert.deepEqual([stockOf(db.stocks, A).availableqty, stockOf(db.stocks, A).orderedqty], [13, 2]);
    assert.deepEqual([stockOf(db.stocks, B).availableqty, stockOf(db.stocks, B).orderedqty], [6, 4]);
    assert.equal(db.products.get(B)!.availablequantity, 6);
    assert.equal(stockOf(db.stocks, C).availableqty, 0, 'the combo itself holds no stock');

    // Re-importing the same order changes nothing
    assert.deepEqual(await service.reserveSellerStock(comboOrder(2), false), { success: true, reason: null, stockIds: [] });
    assert.equal(stockOf(db.stocks, A).availableqty, 13);

    await service.finalizeReservationsAsSold(7n, true, false);
    assert.deepEqual([stockOf(db.stocks, A).orderedqty, stockOf(db.stocks, A).soldqty], [0, 2]);
    assert.deepEqual([stockOf(db.stocks, B).orderedqty, stockOf(db.stocks, B).soldqty], [0, 4]);
    assert.deepEqual(db.reservations.map((row) => row.status), ['SOLD', 'SOLD']);
  } finally { restore(); }

  const cancel = fakeDatabase({ A: 15, B: 10 });
  const restoreCancel = useFake(cancel.fake);
  try {
    const service = new AmazonOrderRoutingService() as any;
    await service.reserveSellerStock(comboOrder(3), false);
    assert.deepEqual([stockOf(cancel.stocks, A).availableqty, stockOf(cancel.stocks, B).availableqty], [12, 7]);
    await service.releaseReservations(7n, 'CANCELLED', false);
    assert.deepEqual([stockOf(cancel.stocks, A).availableqty, stockOf(cancel.stocks, A).orderedqty], [15, 0]);
    assert.deepEqual([stockOf(cancel.stocks, B).availableqty, stockOf(cancel.stocks, B).orderedqty], [10, 0]);
    assert.deepEqual(cancel.reservations.map((row) => row.status), ['RELEASED', 'RELEASED']);
  } finally { restoreCancel(); }
});

test('one short component blocks the whole combo order, names it, and moves no stock', async () => {
  const db = fakeDatabase({ A: 15, B: 1 });
  const restore = useFake(db.fake);
  try {
    const result = await (new AmazonOrderRoutingService() as any).reserveSellerStock(comboOrder(2), false);
    assert.equal(result.success, false);
    assert.match(result.reason, /Insufficient Amazon platform stock for product NIV-B/);
    assert.deepEqual(db.reservations.map((row) => [row.productId, row.status]), [[A, 'FAILED'], [B, 'FAILED']]);
    // The fake has no rollback, so the stock check is what matters: the transaction throws before B moves
    assert.equal(stockOf(db.stocks, B).availableqty, 1);
  } finally { restore(); }
});

test('a combo without active components fails with a clear reason; a single product reserves as before', async () => {
  const db = fakeDatabase({ A: 15, B: 10, SINGLE: 5 });
  const restore = useFake(db.fake);
  try {
    const service = new AmazonOrderRoutingService() as any;
    const empty = await service.reserveSellerStock(comboOrder(1, EMPTY_COMBO), false);
    assert.equal(empty.success, false);
    assert.match(empty.reason, /no active components/);
    assert.deepEqual(db.reservations.map((row) => [row.productId, row.status]), [[EMPTY_COMBO, 'FAILED']]);

    // Mapping fixed to a single product: the stale combo row is removed, the single product reserved
    const single = await service.reserveSellerStock(comboOrder(2, SINGLE, 2), false);
    assert.equal(single.success, true);
    assert.deepEqual(db.reservations.map((row) => [row.productId, row.quantity, row.comboProductId, row.status]), [[SINGLE, 4, null, 'RESERVED']]);
    assert.equal(stockOf(db.stocks, SINGLE).availableqty, 1);
  } finally { restore(); }
});

test('a returned combo restocks every component', async () => {
  const db = fakeDatabase({ A: 5, B: 5, soldA: 3, soldB: 3 });
  const returnEvent: Row = { id: 9n, fulfilmentType: 'FBM', inventoryAction: 'AWAITING_RECEIPT', productId: C, quantity: 2,
    amazonOrderId: 'O', amazonRmaId: null, returnDate: new Date(), sellerSku: 'COMBO', asin: null, fnSku: null, amazonStatus: null,
    disposition: null, reason: null, fulfillmentCenterId: null, customerComments: null, product: null, listing: null };
  const restore = useFake({
    ...db.fake,
    amazonReturnEvent: {
      findFirst: async () => returnEvent,
      update: async ({ data }: any) => Object.assign(returnEvent, data),
    },
  });
  try {
    const service = new AmazonReturnService();
    await service.receive('9', { sellerId: 'S', marketplaceId: 'M' } as any, { quantityReceived: 2, qcDisposition: 'RESTOCKABLE' }, {});
    assert.deepEqual([stockOf(db.stocks, A).availableqty, stockOf(db.stocks, A).soldqty], [7, 1]);
    assert.deepEqual([stockOf(db.stocks, B).availableqty, stockOf(db.stocks, B).soldqty], [7, 1]);
    assert.equal(stockOf(db.stocks, C).availableqty, 0);
    assert.equal(returnEvent.inventoryAction, 'RESTOCKED');
  } finally { restore(); }
});

test('a component stock change re-syncs its own listing and the listings of combos that contain it (P3)', async () => {
  const db = fakeDatabase({ A: 15, B: 10 });
  const listings = [
    { id: 60n, sellerId: 'S', marketplaceId: 'M', sellerSku: 'A-SINGLE', productId: A },
    { id: 61n, sellerId: 'S', marketplaceId: 'M', sellerSku: 'C-COMBO', productId: C },
  ];
  let listingQuery: any;
  const restore = useFake({
    ...db.fake,
    productBundleMap: {
      findMany: async ({ where }: any) => (where.componentproductid === A ? [{ bundleproductid: C }] : []),
    },
    marketplaceListing: {
      findMany: async ({ where }: any) => { listingQuery = where; return listings.filter((listing) => where.productId.in.includes(listing.productId)); },
    },
  }, [
    [env, 'AMAZON_AUTO_SYNC_ENABLED', true],
    [env, 'AMAZON_PRODUCTION_WRITES_ENABLED', true],
    [env, 'AMAZON_ENVIRONMENT', 'PRODUCTION'],
    [amazonProductionWriteGuardService, 'assertEnabled', async () => {}],
    [amazonListingScopeService, 'resolveForSeller', async () => ({ sellerId: 'S', marketplaceId: 'M' })],
  ]);
  try {
    const service = new AmazonProductionInventoryService() as any;
    const synced: string[] = [];
    service.preview = async (listingId: string) => { synced.push(listingId); return { mismatch: false }; };
    const result = await service.syncAutomaticPlatformStock('11'); // A's Amazon stock row
    assert.deepEqual(listingQuery.productId.in.map(String), [String(A), String(C)]);
    assert.deepEqual(synced.sort(), ['60', '61']);
    assert.equal(result.status, 'SYNCED');

    // Two Automatic listings on the combo: the combo is reported, A's own listing still syncs
    listings.push({ id: 62n, sellerId: 'S', marketplaceId: 'M', sellerSku: 'C-COMBO-2', productId: C });
    synced.length = 0;
    const shared = await service.syncAutomaticPlatformStock('11');
    assert.deepEqual(synced, ['60']);
    assert.match(String(shared.results.find((entry: any) => !entry.success)?.message), /C-COMBO, C-COMBO-2/);
  } finally { restore(); }
});

test('nothing is sent while automatic sending is switched off', async () => {
  const restore = useFake({}, [[env, 'AMAZON_AUTO_SYNC_ENABLED', false]]);
  try {
    const result = await (new AmazonProductionInventoryService() as any).syncAutomaticPlatformStock('11');
    assert.equal(result.status, 'SKIPPED');
  } finally { restore(); }
});

test('pack size and quantity per combo multiply: Stock Sync target and the reserved units', async () => {
  const db = fakeDatabase({ A: 15, B: 10, requiredB: 2 });
  const listing = { id: 50n, sellerSku: 'COMBO-P2', productType: 'X', listingStatus: 'BUYABLE,DISCOVERABLE', fulfilmentChannel: 'MFN',
    mappingStatus: 'MAPPED', productId: C, unitsPerListing: 2, inventorySyncMode: 'MANUAL', price: 299 };
  const restore = useFake({ ...db.fake, marketplaceListing: { findFirst: async () => listing } });
  try {
    const context = await (new AmazonProductionInventoryService() as any).loadContext('50', { sellerId: 'S', marketplaceId: 'M' });
    assert.equal(context.nivaanaQuantity, 5, 'min(15, 10 ÷ 2)');
    assert.equal(context.targetQuantity, 2, '5 combos ÷ 2 per Amazon unit');
    // 1 Amazon unit = 2 combos = 2 × A and 4 × B
    const result = await (new AmazonOrderRoutingService() as any).reserveSellerStock(comboOrder(1, C, 2), false);
    assert.equal(result.success, true);
    assert.deepEqual(db.reservations.map((row) => [row.productId, row.quantity]), [[A, 2], [B, 4]]);
  } finally { restore(); }
});

test('a component without an Amazon stock row: combo shows 0 and its order is blocked with the PUC', async () => {
  const db = fakeDatabase({ A: 15, B: 10, noStockRowB: 1 });
  const restore = useFake(db.fake);
  try {
    const { available } = await amazonAvailableByProduct([C]);
    assert.equal(available.get(String(C)), 0);
    const result = await (new AmazonOrderRoutingService() as any).reserveSellerStock(comboOrder(1), false);
    assert.equal(result.success, false);
    assert.match(result.reason, /Amazon platform stock is missing for product NIV-B/);
  } finally { restore(); }
});

test('FBA combo orders stay on the combo row (Amazon owns the stock); components are not touched', async () => {
  const db = fakeDatabase({ A: 15, B: 10 });
  const restore = useFake(db.fake);
  try {
    await (new AmazonOrderRoutingService() as any).trackFbaStock(comboOrder(1), true);
    assert.deepEqual(db.reservations.map((row) => [row.productId, row.inventoryOwnership, row.status]), [[C, 'AMAZON_FBA', 'SOLD']]);
    assert.equal(stockOf(db.stocks, C).soldqty, 1);
    assert.deepEqual([stockOf(db.stocks, A).availableqty, stockOf(db.stocks, A).soldqty], [15, 0]);
    assert.deepEqual([stockOf(db.stocks, B).availableqty, stockOf(db.stocks, B).soldqty], [10, 0]);
  } finally { restore(); }
});

test('listing details: a combo listing shows its products with their stock; a single product has no combo detail', async () => {
  const { fake } = fakeDatabase({ A: 15, B: 10, SINGLE: 4 });
  const { AmazonListingRepository } = await import('../repositories/amazon-listing.repository.js');
  const listingRow = (productId: bigint, puc: string, iscombo: boolean) => ({
    id: 178n, marketplace: 'AMAZON', environment: 'PRODUCTION', sellerId: 'S', marketplaceId: 'M', sellerSku: 'I6-BN4F-MVX7',
    asin: 'B0HKZPJHMK', title: 'Dhoop combo', status: 'ACTIVE', fulfilmentChannel: 'MFN', mappingStatus: 'MAPPED', productId,
    unitsPerListing: 1, publishedQuantity: 50, price: '199.00', currency: 'INR', issues: [], lastImportedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    product: { id: productId, puc, name: `${puc} name`, iscombo },
  });
  let row: Row = listingRow(C, 'NIV-C', true);
  const restore = useFake({ ...fake, marketplaceListing: { findFirst: async () => row } });
  try {
    const repository = new AmazonListingRepository();
    const details: any = await repository.getListingDetails({ listingId: '178', sellerId: 'S', marketplaceId: 'M' });
    assert.equal(details.mappedProduct.iscombo, true);
    assert.equal(details.nivaanaStock.available, 10);
    assert.equal(details.nivaanaStock.target, 10);
    assert.deepEqual(details.nivaanaStock.combo.components.map((part: any) => [part.puc, part.requiredQty, part.available]),
      [['NIV-A', 1, 15], ['NIV-B', 1, 10]]);

    row = listingRow(SINGLE, 'NIV-S', false);
    const single: any = await repository.getListingDetails({ listingId: '178', sellerId: 'S', marketplaceId: 'M' });
    assert.equal(single.nivaanaStock.available, 4);
    assert.equal(single.nivaanaStock.combo, null);
  } finally { restore(); }
});
