import { prisma } from '../models/prisma.js';
import {
  FlipkartListing,
  FlipkartListingState,
  FlipkartSellerApiClient,
  getFlipkartSellerApiClient,
} from './flipkart-api.client.js';

const IMPORT_STATES: FlipkartListingState[] = [
  'ACTIVE', 'INACTIVE', 'READY_FOR_ACTIVATION', 'INACTIVATED_BY_FLIPKART', 'ARCHIVED',
];

export class FlipkartListingError extends Error {
  constructor(message: string, readonly statusCode = 400, readonly code = 'FLIPKART_LISTING_ERROR') {
    super(message);
    this.name = 'FlipkartListingError';
  }
}

export const normalizeFlipkartListing = (listing: FlipkartListing) => ({
  marketplace: 'FLIPKART',
  environment: 'MOCK',
  marketplaceId: 'IN',
  sellerId: listing.sellerId.trim(),
  sellerSku: listing.sku.trim(),
  title: listing.productName.trim(),
  productType: listing.vertical.trim() || null,
  listingStatus: listing.status,
  fulfilmentChannel: 'SELLER',
  publishedQuantity: listing.locations.reduce((total, location) => total + Math.max(0, Math.trunc(location.inventory)), 0),
  price: listing.sellingPrice.toFixed(2),
  currency: 'INR',
});

type Actor = { userId?: number; userType?: string };

export class FlipkartListingService {
  constructor(private readonly client: FlipkartSellerApiClient = getFlipkartSellerApiClient()) {}

  async importMockListings(actor: Actor = {}) {
    if (this.client.mode !== 'MOCK') {
      throw new FlipkartListingError('Pre-approval listing imports are restricted to mock mode', 409, 'FLIPKART_MOCK_MODE_REQUIRED');
    }

    const connection = await prisma.flipkartConnection.upsert({
      where: { environment_connectionType: { environment: 'MOCK', connectionType: 'SELF_ACCESS' } },
      create: { environment: 'MOCK', status: 'SIMULATED', sellerId: 'MOCK-NIVAANA-SELLER' },
      update: { status: 'SIMULATED', sellerId: 'MOCK-NIVAANA-SELLER' },
    });
    const job = await prisma.flipkartImportJob.create({
      data: {
        connectionId: connection.id,
        environment: 'MOCK',
        mode: 'MOCK',
        status: 'RUNNING',
        startedAt: new Date(),
        ...(actor.userId !== undefined ? { requestedByUserId: actor.userId } : {}),
        ...(actor.userType ? { requestedByUserType: actor.userType } : {}),
      },
    });

    let fetched = 0;
    let created = 0;
    let updated = 0;
    let pagesProcessed = 0;
    try {
      for (const state of IMPORT_STATES) {
        let page = 0;
        do {
          const result = await this.client.searchListings({ state, page });
          pagesProcessed += 1;
          for (const raw of result.items) {
            const normalized = normalizeFlipkartListing(raw);
            const existing = await prisma.marketplaceListing.findUnique({
              where: { marketplace_marketplaceId_sellerId_sellerSku: {
                marketplace: 'FLIPKART', marketplaceId: 'IN', sellerId: normalized.sellerId, sellerSku: normalized.sellerSku,
              } },
              select: { id: true },
            });
            const listing = await prisma.marketplaceListing.upsert({
              where: { marketplace_marketplaceId_sellerId_sellerSku: {
                marketplace: 'FLIPKART', marketplaceId: 'IN', sellerId: normalized.sellerId, sellerSku: normalized.sellerSku,
              } },
              create: normalized,
              update: { ...normalized, lastImportedAt: new Date() },
            });
            existing ? updated += 1 : created += 1;
            fetched += 1;

            await prisma.flipkartListingDetail.upsert({
              where: { listingId: listing.id },
              create: {
                listingId: listing.id,
                flipkartListingId: raw.listingId,
                flipkartProductId: raw.productId,
                vertical: raw.vertical,
                mrp: raw.mrp,
                sellingPrice: raw.sellingPrice,
                rawPayload: raw as any,
              },
              update: {
                flipkartListingId: raw.listingId,
                flipkartProductId: raw.productId,
                vertical: raw.vertical,
                mrp: raw.mrp,
                sellingPrice: raw.sellingPrice,
                rawPayload: raw as any,
              },
            });

            for (const rawLocation of raw.locations) {
              const sellerLocation = await prisma.flipkartSellerLocation.upsert({
                where: { connectionId_externalLocationId: { connectionId: connection.id, externalLocationId: rawLocation.id } },
                create: { connectionId: connection.id, externalLocationId: rawLocation.id, name: 'Mock Bengaluru Warehouse', status: rawLocation.status, lastImportedAt: new Date() },
                update: { status: rawLocation.status, lastImportedAt: new Date() },
              });
              await prisma.flipkartListingLocation.upsert({
                where: { listingId_externalLocationId: { listingId: listing.id, externalLocationId: rawLocation.id } },
                create: { listingId: listing.id, sellerLocationId: sellerLocation.id, externalLocationId: rawLocation.id, status: rawLocation.status, publishedQuantity: rawLocation.inventory, lastImportedAt: new Date() },
                update: { sellerLocationId: sellerLocation.id, status: rawLocation.status, publishedQuantity: rawLocation.inventory, lastImportedAt: new Date() },
              });
            }
          }
          if (!result.hasMore) break;
          page += 1;
        } while (true);
      }

      const finished = await prisma.flipkartImportJob.update({
        where: { id: job.id },
        data: { status: 'SUCCESS', fetched, created, updated, unmapped: fetched, pagesProcessed, finishedAt: new Date() },
      });
      return this.serializeJob(finished);
    } catch (error) {
      await prisma.flipkartImportJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', fetched, created, updated, pagesProcessed, errorMessage: error instanceof Error ? error.message : 'Unknown import error', finishedAt: new Date() },
      });
      throw error;
    }
  }

  async list() {
    const listings = await prisma.marketplaceListing.findMany({
      where: { marketplace: 'FLIPKART', environment: 'MOCK' },
      include: { flipkartDetail: { include: { locations: true } }, product: { select: { id: true, name: true, puc: true } } },
      orderBy: { sellerSku: 'asc' },
    });
    return listings.map((listing) => ({ ...listing, id: String(listing.id), productId: listing.productId ? String(listing.productId) : null,
      product: listing.product ? { ...listing.product, id: String(listing.product.id) } : null,
      flipkartDetail: listing.flipkartDetail ? { ...listing.flipkartDetail, listingId: String(listing.flipkartDetail.listingId), locations: listing.flipkartDetail.locations.map((location) => ({ ...location, id: String(location.id), listingId: String(location.listingId), sellerLocationId: location.sellerLocationId ? String(location.sellerLocationId) : null })) } : null,
    }));
  }

  async map(listingId: string, productId: string, unitsPerListing: number, actor: Actor = {}) {
    const [listing, product, platformStock] = await Promise.all([
      prisma.marketplaceListing.findFirst({ where: { id: BigInt(listingId), marketplace: 'FLIPKART' } }),
      prisma.product.findUnique({ where: { id: BigInt(productId) }, select: { id: true } }),
      prisma.platformStock.findUnique({ where: { productid_platform: { productid: BigInt(productId), platform: 'flipkart' } }, select: { id: true } }),
    ]);
    if (!listing) throw new FlipkartListingError('Flipkart listing not found', 404, 'FLIPKART_LISTING_NOT_FOUND');
    if (!product) throw new FlipkartListingError('Nivaana product not found', 404, 'PRODUCT_NOT_FOUND');
    if (!platformStock) throw new FlipkartListingError('Product has no Flipkart platform stock', 409, 'FLIPKART_PLATFORM_STOCK_MISSING');
    if (!Number.isInteger(unitsPerListing) || unitsPerListing < 1) throw new FlipkartListingError('unitsPerListing must be a positive integer');
    const beforeProductId = listing.productId;
    const updated = await prisma.$transaction(async (tx) => {
      const mappingChanged = listing.productId !== BigInt(productId) || listing.unitsPerListing !== unitsPerListing;
      const result = await tx.marketplaceListing.update({ where: { id: listing.id }, data: {
        productId: BigInt(productId), unitsPerListing, mappingStatus: 'MAPPED', mappedAt: new Date(),
        ...(mappingChanged ? { inventorySyncMode: 'DISABLED' } : {}),
      } });
      await tx.marketplaceListingAudit.create({ data: {
        listingId: listing.id, marketplace: 'FLIPKART', environment: listing.environment, marketplaceId: listing.marketplaceId,
        sellerId: listing.sellerId, sellerSku: listing.sellerSku, operation: 'MAP', changedFields: ['productId', 'unitsPerListing'],
        beforeValues: { productId: beforeProductId ? String(beforeProductId) : null, unitsPerListing: listing.unitsPerListing },
        afterValues: { productId, unitsPerListing, ...(mappingChanged ? { inventorySyncMode: 'DISABLED' } : {}) }, previousProductId: beforeProductId, productId: BigInt(productId),
        ...(actor.userId !== undefined ? { requestedByUserId: actor.userId } : {}), ...(actor.userType ? { requestedByUserType: actor.userType } : {}),
      } });
      return result;
    });
    return { id: String(updated.id), productId: String(updated.productId), unitsPerListing: updated.unitsPerListing, mappingStatus: updated.mappingStatus };
  }

  private serializeJob(job: { id: bigint; connectionId: bigint | null; [key: string]: unknown }) {
    return { ...job, id: String(job.id), connectionId: job.connectionId ? String(job.connectionId) : null };
  }
}

export const flipkartListingService = new FlipkartListingService();
