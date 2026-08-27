import { createHash } from 'node:crypto';
import { logger } from '../config/logger.js';
import { prisma } from '../models/prisma.js';
import { FlipkartSellerApiClient, getFlipkartSellerApiClient } from './flipkart-api.client.js';

export class FlipkartInventoryError extends Error {
  constructor(message: string, readonly statusCode = 400, readonly code = 'FLIPKART_INVENTORY_ERROR') {
    super(message);
    this.name = 'FlipkartInventoryError';
  }
}

export const calculateFlipkartTargetQuantity = (available: number, unitsPerListing: number, safetyBuffer: number) => {
  if (!Number.isInteger(unitsPerListing) || unitsPerListing < 1) throw new Error('unitsPerListing must be positive');
  const normalizedAvailable = Math.max(0, Math.trunc(Number.isFinite(available) ? available : 0));
  const normalizedBuffer = Math.max(0, Math.trunc(Number.isFinite(safetyBuffer) ? safetyBuffer : 0));
  return Math.max(0, Math.floor(normalizedAvailable / unitsPerListing) - normalizedBuffer);
};

type Actor = { userId?: number; userType?: string };
type SyncMode = 'DRY_RUN' | 'AUTOMATIC';

export type FlipkartInventoryReconcileResult = {
  status: 'SYNCED' | 'SKIPPED' | 'FAILED';
  total?: number;
  succeeded?: number;
  failed?: number;
  reason?: string;
};

export class FlipkartInventoryService {
  private readonly listingQueues = new Map<string, Promise<unknown>>();

  constructor(private readonly client: FlipkartSellerApiClient = getFlipkartSellerApiClient()) {}

  async preview(listingId: string, safetyBuffer: number, actor: Actor = {}) {
    const listing = await prisma.marketplaceListing.findFirst({
      where: { id: BigInt(listingId), marketplace: 'FLIPKART' },
      include: { flipkartDetail: { include: { locations: true } } },
    });
    if (!listing) throw new FlipkartInventoryError('Flipkart listing not found', 404, 'FLIPKART_LISTING_NOT_FOUND');

    const issues: Array<{ code: string; message: string }> = [];
    if (listing.mappingStatus !== 'MAPPED' || !listing.productId) issues.push({ code: 'LISTING_UNMAPPED', message: 'Map this SKU to a Nivaana product first' });
    if (!listing.flipkartDetail) issues.push({ code: 'FLIPKART_DETAILS_MISSING', message: 'Flipkart listing details are missing' });
    if (listing.listingStatus !== 'ACTIVE') issues.push({ code: 'LISTING_INACTIVE', message: 'Only active listings can publish inventory' });
    const location = listing.flipkartDetail?.locations.find((item) => item.status === 'ACTIVE') ?? listing.flipkartDetail?.locations[0];
    if (!location) issues.push({ code: 'LOCATION_MISSING', message: 'No Flipkart seller location is mapped' });
    else if (location.status !== 'ACTIVE') issues.push({ code: 'LOCATION_INACTIVE', message: 'The Flipkart seller location is inactive' });

    const platformStock = listing.productId ? await prisma.platformStock.findUnique({
      where: { productid_platform: { productid: listing.productId, platform: 'flipkart' } },
    }) : null;
    if (listing.productId && !platformStock) issues.push({ code: 'PLATFORM_STOCK_MISSING', message: 'The product has no Flipkart platform stock' });
    const nivaanaQuantity = platformStock?.availableqty ?? 0;
    const targetQuantity = calculateFlipkartTargetQuantity(nivaanaQuantity, listing.unitsPerListing, safetyBuffer);
    const preview = await prisma.flipkartInventoryPreview.create({ data: {
      listingId: listing.id,
      ...(location ? { listingLocationId: location.id } : {}),
      sourceUpdatedAt: listing.updatedAt,
      remoteQuantity: location?.publishedQuantity ?? listing.publishedQuantity,
      nivaanaQuantity,
      safetyBuffer,
      targetQuantity,
      issues,
      canApply: issues.length === 0,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      ...(actor.userId !== undefined ? { requestedByUserId: actor.userId } : {}),
      ...(actor.userType ? { requestedByUserType: actor.userType } : {}),
    } });
    return this.serializePreview(preview);
  }

  async dryRun(previewId: string, confirmed: boolean, actor: Actor = {}) {
    return this.applyPreview(previewId, confirmed, actor, 'DRY_RUN');
  }

  private async applyPreview(previewId: string, confirmed: boolean, actor: Actor, mode: SyncMode) {
    if (!confirmed) throw new FlipkartInventoryError('Dry run requires explicit confirmation', 400, 'CONFIRMATION_REQUIRED');
    if (this.client.mode !== 'MOCK') throw new FlipkartInventoryError('Pre-approval publishing is restricted to mock mode', 409, 'FLIPKART_MOCK_MODE_REQUIRED');
    const preview = await prisma.flipkartInventoryPreview.findUnique({
      where: { id: BigInt(previewId) },
      include: { listing: { include: { flipkartDetail: true } }, listingLocation: true },
    });
    if (!preview) throw new FlipkartInventoryError('Inventory preview not found', 404, 'PREVIEW_NOT_FOUND');
    if (!preview.canApply) throw new FlipkartInventoryError('Inventory preview contains blocking issues', 409, 'PREVIEW_BLOCKED');
    if (preview.status !== 'PENDING') throw new FlipkartInventoryError('Inventory preview was already used', 409, 'PREVIEW_ALREADY_USED');
    if (preview.expiresAt <= new Date()) throw new FlipkartInventoryError('Inventory preview expired', 409, 'PREVIEW_EXPIRED');
    if (!preview.listingLocation || !preview.listing.flipkartDetail) throw new FlipkartInventoryError('Listing location details are missing', 409, 'LOCATION_MISSING');
    if (preview.listing.updatedAt.getTime() !== preview.sourceUpdatedAt.getTime()) throw new FlipkartInventoryError('Listing changed after preview; create a new preview', 409, 'PREVIEW_STALE');

    const requestKey = createHash('sha256').update(`flipkart:${mode}:${preview.id}:${preview.sourceUpdatedAt.toISOString()}:${preview.targetQuantity}`).digest('hex');
    const existing = await prisma.flipkartInventorySyncAttempt.findUnique({ where: { requestKey } });
    if (existing) return this.serializeAttempt(existing);
    const attempt = await prisma.flipkartInventorySyncAttempt.create({ data: {
      listingId: preview.listingId, previewId: preview.id, mode, status: 'PROCESSING',
      remoteQuantity: preview.remoteQuantity, nivaanaQuantity: preview.nivaanaQuantity, targetQuantity: preview.targetQuantity, requestKey,
      ...(actor.userId !== undefined ? { requestedByUserId: actor.userId } : {}), ...(actor.userType ? { requestedByUserType: actor.userType } : {}),
    } });
    try {
      const response = await this.client.updateInventory([{ sku: preview.listing.sellerSku, productId: preview.listing.flipkartDetail.flipkartProductId,
        locations: [{ id: preview.listingLocation.externalLocationId, inventory: preview.targetQuantity }] }]);
      const item = response.results[0];
      const succeeded = item?.status === 'SUCCESS';
      const now = new Date();
      const updates: any[] = [
        prisma.flipkartInventorySyncAttempt.update({ where: { id: attempt.id }, data: {
          status: succeeded ? 'SIMULATED_SUCCESS' : 'SIMULATED_FAILURE', externalRequestId: response.requestId,
          responsePayload: response as any, errorCode: item?.errors[0]?.code ?? null, errorMessage: item?.errors[0]?.description ?? null, finishedAt: now,
        } }),
        prisma.flipkartInventoryPreview.update({ where: { id: preview.id }, data: { status: 'SIMULATED', consumedAt: now } }),
        prisma.marketplaceListing.update({ where: { id: preview.listingId }, data: {
          ...(succeeded ? { publishedQuantity: preview.targetQuantity, lastSyncedQuantity: preview.targetQuantity } : {}),
          lastInventorySyncAt: now, lastInventorySyncStatus: succeeded ? 'SIMULATED_SUCCESS' : 'SIMULATED_FAILURE',
        } }),
      ];
      if (succeeded && preview.listingLocationId) updates.push(prisma.flipkartListingLocation.update({
        where: { id: preview.listingLocationId }, data: { publishedQuantity: preview.targetQuantity },
      }));
      const [updated] = await prisma.$transaction(updates);
      return this.serializeAttempt(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Flipkart inventory error';
      await prisma.$transaction([
        prisma.flipkartInventorySyncAttempt.update({ where: { id: attempt.id }, data: { status: 'FAILED', errorMessage: message, finishedAt: new Date() } }),
        prisma.marketplaceListing.update({ where: { id: preview.listingId }, data: { lastInventorySyncAt: new Date(), lastInventorySyncStatus: 'FAILED' } }),
      ]);
      throw error;
    }
  }

  async history() {
    const attempts = await prisma.flipkartInventorySyncAttempt.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    return attempts.map((attempt) => this.serializeAttempt(attempt));
  }

  async setMode(listingId: string, mode: 'DISABLED' | 'MANUAL' | 'AUTOMATIC') {
    const listing = await prisma.marketplaceListing.findFirst({
      where: { id: BigInt(listingId), marketplace: 'FLIPKART', environment: 'MOCK' },
      select: { id: true, productId: true, mappingStatus: true, listingStatus: true },
    });
    if (!listing) throw new FlipkartInventoryError('Flipkart listing not found', 404, 'FLIPKART_LISTING_NOT_FOUND');
    if (mode !== 'DISABLED' && (listing.mappingStatus !== 'MAPPED' || !listing.productId)) {
      throw new FlipkartInventoryError('Map the Flipkart listing before enabling stock synchronization', 409, 'FLIPKART_LISTING_UNMAPPED');
    }
    if (mode !== 'DISABLED' && listing.listingStatus !== 'ACTIVE') {
      throw new FlipkartInventoryError('Only active Flipkart listings can synchronize stock', 409, 'FLIPKART_LISTING_INACTIVE');
    }
    const updated = await prisma.marketplaceListing.update({ where: { id: listing.id }, data: { inventorySyncMode: mode } });
    let reconciliation: FlipkartInventoryReconcileResult | null = null;
    if (mode === 'AUTOMATIC' && listing.productId) {
      const stock = await prisma.platformStock.findFirst({ where: { productid: listing.productId, platform: { equals: 'flipkart', mode: 'insensitive' } }, select: { id: true } });
      if (stock) reconciliation = await this.syncAfterPlatformStockChange({ id: stock.id, platform: 'flipkart' });
    }
    return { listingId: String(updated.id), inventorySyncMode: updated.inventorySyncMode, reconciliation };
  }

  async syncAfterPlatformStockChange(platformStock: Record<string, unknown> | null): Promise<FlipkartInventoryReconcileResult> {
    if (String(platformStock?.platform ?? '').trim().toLowerCase() !== 'flipkart') {
      return { status: 'SKIPPED', reason: 'Platform stock is not for Flipkart' };
    }
    const id = platformStock?.id;
    if (id === null || id === undefined) return { status: 'FAILED', reason: 'Flipkart platform stock has no identifier' };
    try {
      return await this.syncPlatformStockById(String(id));
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Flipkart inventory reconciliation failed';
      logger.error({ platformStockId: String(id), error: reason }, 'Flipkart inventory reconciliation failed after Nivaana stock change');
      return { status: 'FAILED', reason };
    }
  }

  async syncPlatformStockById(platformStockId: string | number | bigint): Promise<FlipkartInventoryReconcileResult> {
    const stock = await prisma.platformStock.findUnique({ where: { id: BigInt(platformStockId) }, select: { id: true, productid: true, platform: true } });
    if (!stock) throw new FlipkartInventoryError(`PlatformStock ${platformStockId} was not found`, 404, 'PLATFORM_STOCK_NOT_FOUND');
    if (stock.platform.trim().toLowerCase() !== 'flipkart') return { status: 'SKIPPED', reason: 'Platform stock is not for Flipkart' };
    const listings = await prisma.marketplaceListing.findMany({ where: {
      marketplace: 'FLIPKART', environment: 'MOCK', productId: stock.productid,
      mappingStatus: 'MAPPED', listingStatus: 'ACTIVE', inventorySyncMode: 'AUTOMATIC',
    }, select: { id: true, sellerSku: true } });
    if (listings.length === 0) return { status: 'SKIPPED', reason: 'No automatic mapped Flipkart listing uses this stock' };
    const results = await Promise.all(listings.map((listing) => this.enqueueListing(String(listing.id), async () => {
      const preview = await this.preview(String(listing.id), 0, { userType: 'system' });
      if (!preview.canApply) throw new FlipkartInventoryError(`Flipkart listing ${listing.sellerSku} is blocked`, 409, 'FLIPKART_PREVIEW_BLOCKED');
      return this.applyPreview(preview.id, true, { userType: 'system' }, 'AUTOMATIC');
    })));
    const failed = results.filter((result) => !['SIMULATED_SUCCESS'].includes(result.status)).length;
    return { status: failed === 0 ? 'SYNCED' : 'FAILED', total: results.length, succeeded: results.length - failed, failed,
      ...(failed > 0 ? { reason: `${failed} Flipkart inventory update(s) failed` } : {}) };
  }

  private enqueueListing<T>(listingId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.listingQueues.get(listingId) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(operation);
    const tracked = run.finally(() => { if (this.listingQueues.get(listingId) === tracked) this.listingQueues.delete(listingId); });
    this.listingQueues.set(listingId, tracked);
    return tracked;
  }

  async syncAllDryRun(safetyBuffer: number, actor: Actor = {}) {
    const listings = await prisma.marketplaceListing.findMany({ where: { marketplace: 'FLIPKART', environment: 'MOCK', mappingStatus: 'MAPPED', listingStatus: 'ACTIVE' }, orderBy: { sellerSku: 'asc' } });
    const results: Array<{ listingId: string; sellerSku: string; status: string; targetQuantity?: number; issues?: unknown; error?: string }> = [];
    for (const listing of listings) {
      try {
        const preview = await this.preview(String(listing.id), safetyBuffer, actor);
        if (!preview.canApply) {
          results.push({ listingId: String(listing.id), sellerSku: listing.sellerSku, status: 'BLOCKED', targetQuantity: preview.targetQuantity, issues: preview.issues });
          continue;
        }
        const attempt = await this.dryRun(preview.id, true, actor);
        results.push({ listingId: String(listing.id), sellerSku: listing.sellerSku, status: attempt.status, targetQuantity: preview.targetQuantity });
      } catch (error) {
        results.push({ listingId: String(listing.id), sellerSku: listing.sellerSku, status: 'FAILED', error: error instanceof Error ? error.message : 'Unknown stock-sync error' });
      }
    }
    return { mode: 'DRY_RUN', total: listings.length, succeeded: results.filter((item) => item.status === 'SIMULATED_SUCCESS').length, blocked: results.filter((item) => item.status === 'BLOCKED').length, failed: results.filter((item) => item.status === 'FAILED' || item.status === 'SIMULATED_FAILURE').length, results };
  }

  private serializePreview(value: any) { return { ...value, id: String(value.id), listingId: String(value.listingId), listingLocationId: value.listingLocationId ? String(value.listingLocationId) : null }; }
  private serializeAttempt(value: any) { return { ...value, id: String(value.id), listingId: String(value.listingId), previewId: value.previewId ? String(value.previewId) : null }; }
}

export const flipkartInventoryService = new FlipkartInventoryService();
