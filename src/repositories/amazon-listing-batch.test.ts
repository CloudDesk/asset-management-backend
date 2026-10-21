import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../models/prisma.js';
import { AmazonListingRepository } from './amazon-listing.repository.js';

test('default mapping results exclude deleted history while explicit history filters retain it', async () => {
  const originalFind = prisma.marketplaceListing.findMany;
  const originalCount = prisma.marketplaceListing.count;
  const date = new Date('2026-10-14T00:00:00Z');
  const rows = ['BUYABLE', 'SUPPRESSED', 'DELETED'].map((listingStatus, index) => ({
    id: BigInt(index + 1), sellerSku: `SKU-${index}`, listingStatus, fulfilmentChannel: 'MFN',
    productId: null, mappingStatus: 'UNMAPPED', lastImportedAt: date, createdAt: date, updatedAt: date,
  }));
  const matching = (where: any) => rows.filter(row =>
    (!where.NOT?.listingStatus || !row.listingStatus.includes('DELETED'))
    && (!where.listingStatus || row.listingStatus.includes(where.listingStatus.contains.toUpperCase())));
  try {
    prisma.marketplaceListing.findMany = (async ({ where }: any) => matching(where)) as any;
    prisma.marketplaceListing.count = (async ({ where }: any) => matching(where).length) as any;
    const repository = new AmazonListingRepository();
    const base = { sellerId: 'SELLER', marketplaceId: 'MARKET', mappingStatus: 'UNMAPPED' as const, page: 1, limit: 20 };
    const current = await repository.listListings(base);
    assert.equal(current.pagination.total, 2);
    assert.deepEqual(current.data.map(row => row.listingStatus), ['BUYABLE', 'SUPPRESSED']);
    const history = await repository.listListings({ ...base, listingStatus: 'DELETED' });
    assert.equal(history.pagination.total, 1);
    assert.equal(history.data[0]?.listingStatus, 'DELETED');
    const all = await repository.listListings({ ...base, activeOnly: false });
    assert.equal(all.pagination.total, 3);
  } finally {
    prisma.marketplaceListing.findMany = originalFind;
    prisma.marketplaceListing.count = originalCount;
  }
});

test('missing listings are updated in bounded batches with one audit per listing', async () => {
  const restores: Array<() => void> = [];
  const replace = (target: any, key: string, value: any) => {
    const original = target[key]; target[key] = value; restores.push(() => { target[key] = original; });
  };
  const missing = Array.from({ length: 700 }, (_, index) => ({ id: BigInt(index + 1),
    marketplace: 'AMAZON', environment: 'PRODUCTION', marketplaceId: 'MARKET', sellerId: 'SELLER',
    sellerSku: `SKU-${index}`, fulfilmentChannel: index % 2 ? 'MFN' : 'FBA',
    listingStatus: 'BUYABLE', publishedQuantity: 7, fbaFulfillableQuantity: 7,
    fbaReservedQuantity: 2, fbaPendingOrderQuantity: 1, fbaTotalQuantity: 10,
    inventorySyncMode: 'AUTO', productId: 1n }));
  const audits: any[] = [];
  const updates: any[] = [];
  try {
    replace(prisma.marketplaceListing, 'findMany', async () => missing);
    replace(prisma, '$transaction', async (work: any) => work(prisma));
    replace(prisma.marketplaceListing, 'updateMany', async (input: any) => { updates.push(input); return { count: input.where.id.in.length }; });
    replace(prisma.marketplaceListingAudit, 'createMany', async ({ data }: any) => {
      assert.ok(data.length <= 500); audits.push(...data); return { count: data.length };
    });
    const count = await new AmazonListingRepository().markListingsMissingFromImport({
      sellerId: 'SELLER', marketplaceId: 'MARKET', seenSellerSkus: [],
    });
    assert.equal(count, 700);
    assert.equal(audits.length, 700);
    assert.equal(new Set(audits.map((audit) => String(audit.listingId))).size, 700);
    assert.equal(updates.length, 4);
    assert.equal(updates.reduce((total, update) => total + update.where.id.in.length, 0), 700);
    assert.equal(updates[0].data.fbaFulfillableQuantity, 0);
    assert.equal(updates[1].data.fbaFulfillableQuantity, null);
    assert.equal(audits[0].beforeValues.publishedQuantity, 7);
  } finally { restores.reverse().forEach((restore) => restore()); }
});
