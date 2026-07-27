import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { prisma } from '../models/prisma.js';
import { AmazonListingScope } from './amazon-listing-scope.service.js';
import { amazonListingScopeService } from './amazon-listing-scope.service.js';
import {
  isInactiveAmazonListing,
  normalizeAmazonListingStatus,
} from './amazon-listing-normalizer.js';
import { amazonProductionWriteGuardService } from './amazon-production-write-guard.service.js';

export type AmazonInventoryActor = {
  requestedByUserId?: number;
  requestedByUserType?: string;
};

export class AmazonProductionInventoryError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code: string
  ) {
    super(message);
    this.name = 'AmazonProductionInventoryError';
  }
}

export const calculateAmazonTargetQuantity = (availableQuantity: number, unitsPerListing: number) =>
  Math.floor(Math.max(0, Math.trunc(availableQuantity)) / Math.max(1, Math.trunc(unitsPerListing)));

type AmazonInventoryEligibleListing = {
  listingStatus: string;
  mappingStatus: string;
  productId: bigint | number | string | null;
  fulfilmentChannel: string;
  productType: string | null;
};

export const assertAmazonInventoryListingEligible = (listing: AmazonInventoryEligibleListing): void => {
  if (listing.mappingStatus !== 'MAPPED' || listing.productId === null) {
    throw new AmazonProductionInventoryError(
      'Map this Amazon listing before synchronizing stock',
      409,
      'AMAZON_LISTING_NOT_MAPPED'
    );
  }
  if (isInactiveAmazonListing(listing.listingStatus)) {
    throw new AmazonProductionInventoryError(
      `Amazon listing must be active before synchronizing stock; current status is ${listing.listingStatus}`,
      409,
      'AMAZON_LISTING_NOT_ACTIVE'
    );
  }
  if (!['MFN', 'EASY_SHIP'].includes(listing.fulfilmentChannel)) {
    throw new AmazonProductionInventoryError(
      listing.fulfilmentChannel === 'FBA'
        ? 'FBA inventory is read-only and cannot be published by Nivaana'
        : 'Inventory publishing is limited to seller-fulfilled listings',
      409,
      'AMAZON_INVENTORY_NOT_MFN'
    );
  }
  if (!listing.productType) {
    throw new AmazonProductionInventoryError(
      'Amazon product type is required before publishing inventory',
      409,
      'AMAZON_PRODUCT_TYPE_MISSING'
    );
  }
};

const serializeAttempt = (attempt: any) => ({
  id: String(attempt.id),
  operation: attempt.operation,
  status: attempt.status,
  amazonQuantity: attempt.amazonQuantity,
  nivaanaQuantity: attempt.nivaanaQuantity,
  targetQuantity: attempt.targetQuantity,
  previewId: attempt.previewId === null ? null : String(attempt.previewId),
  amazonSubmissionId: attempt.amazonSubmissionId,
  errorCode: attempt.errorCode,
  errorMessage: attempt.errorMessage,
  requestedByUserId: attempt.requestedByUserId,
  requestedByUserType: attempt.requestedByUserType,
  startedAt: attempt.startedAt.toISOString(),
  finishedAt: attempt.finishedAt?.toISOString() ?? null,
});

export class AmazonProductionInventoryService {
  private readonly skuQueues = new Map<string, Promise<unknown>>();

  private enqueueBySku<T>(sellerSku: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.skuQueues.get(sellerSku) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(operation);
    const tracked = run.finally(() => {
      if (this.skuQueues.get(sellerSku) === tracked) this.skuQueues.delete(sellerSku);
    });
    this.skuQueues.set(sellerSku, tracked);
    return tracked;
  }

  private actorData(actor: AmazonInventoryActor) {
    return {
      ...(actor.requestedByUserId !== undefined ? { requestedByUserId: actor.requestedByUserId } : {}),
      ...(actor.requestedByUserType !== undefined ? { requestedByUserType: actor.requestedByUserType } : {}),
    };
  }

  private async loadContext(listingId: string, scope: AmazonListingScope) {
    const listing = await prisma.marketplaceListing.findFirst({
      where: {
        id: BigInt(listingId),
        marketplace: 'AMAZON',
        environment: 'PRODUCTION',
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
      },
      select: {
        id: true,
        sellerSku: true,
        productType: true,
        listingStatus: true,
        fulfilmentChannel: true,
        mappingStatus: true,
        productId: true,
        unitsPerListing: true,
        inventorySyncMode: true,
        lastInventorySyncAt: true,
        lastInventorySyncStatus: true,
        lastSyncedQuantity: true,
      },
    });
    if (!listing) throw new AmazonProductionInventoryError('Amazon listing was not found', 404, 'AMAZON_LISTING_NOT_FOUND');
    assertAmazonInventoryListingEligible(listing);

    const platformStock = await prisma.platformStock.findFirst({
      where: { productid: listing.productId!, platform: { equals: 'amazon', mode: 'insensitive' } },
      select: { availableqty: true },
    });
    if (!platformStock) {
      throw new AmazonProductionInventoryError('No Amazon platform stock exists for the mapped Nivaana product', 409, 'AMAZON_PLATFORM_STOCK_MISSING');
    }
    const nivaanaQuantity = Math.max(0, Math.trunc(platformStock.availableqty));
    const targetQuantity = calculateAmazonTargetQuantity(nivaanaQuantity, listing.unitsPerListing);
    return { listing, nivaanaQuantity, targetQuantity };
  }

  private async getRemoteQuantity(scope: AmazonListingScope, sellerSku: string): Promise<number> {
    if (!scope.client.fetchListing) {
      throw new AmazonProductionInventoryError('Amazon production inventory reader is unavailable', 503, 'AMAZON_INVENTORY_CLIENT_UNAVAILABLE');
    }
    const remote = await scope.client.fetchListing(sellerSku);
    const remoteStatus = normalizeAmazonListingStatus(remote.summaries);
    if (isInactiveAmazonListing(remoteStatus)) {
      throw new AmazonProductionInventoryError(
        `Amazon listing is no longer active; current Amazon status is ${remoteStatus}`,
        409,
        'AMAZON_LISTING_NOT_ACTIVE'
      );
    }
    const availability = remote.fulfillmentAvailability?.find((item) =>
      !item.fulfillmentChannelCode || item.fulfillmentChannelCode.toUpperCase() === 'DEFAULT'
    );
    return Math.max(0, Math.trunc(availability?.quantity ?? 0));
  }

  async preview(listingId: string, scope: AmazonListingScope, actor: AmazonInventoryActor = {}) {
    const context = await this.loadContext(listingId, scope);
    const amazonQuantity = await this.getRemoteQuantity(scope, context.listing.sellerSku);
    const attempt = await prisma.amazonInventorySyncAttempt.create({
      data: {
        listingId: context.listing.id,
        operation: 'PREVIEW',
        status: 'PREVIEWED',
        amazonQuantity,
        nivaanaQuantity: context.nivaanaQuantity,
        targetQuantity: context.targetQuantity,
        requestKey: randomUUID(),
        finishedAt: new Date(),
        ...this.actorData(actor),
      },
    });
    return {
      ...serializeAttempt(attempt),
      sellerSku: context.listing.sellerSku,
      unitsPerListing: context.listing.unitsPerListing,
      difference: context.targetQuantity - amazonQuantity,
      mismatch: context.targetQuantity !== amazonQuantity,
      inventorySyncMode: context.listing.inventorySyncMode,
      writesEnabled: env.AMAZON_PRODUCTION_WRITES_ENABLED,
      autoSyncEnabled: env.AMAZON_AUTO_SYNC_ENABLED && env.AMAZON_ENVIRONMENT === 'PRODUCTION',
      previewExpiresAt: new Date(attempt.createdAt.getTime() + 10 * 60 * 1000).toISOString(),
    };
  }

  async sync(
    listingId: string,
    previewId: string,
    scope: AmazonListingScope,
    actor: AmazonInventoryActor = {},
    operation: 'MANUAL' | 'BULK' | 'RETRY' | 'AUTOMATIC' = 'MANUAL'
  ) {
    const writeStatus = await amazonProductionWriteGuardService.status(scope.sellerId, scope.marketplaceId);
    if (!writeStatus.effectiveEnabled) {
      throw new AmazonProductionInventoryError('Amazon production writes are disabled by the global kill switch', 409, 'AMAZON_PRODUCTION_WRITES_DISABLED');
    }
    const context = await this.loadContext(listingId, scope);
    const requiredMode = operation === 'AUTOMATIC' ? 'AUTOMATIC' : 'MANUAL';
    if (context.listing.inventorySyncMode !== requiredMode) {
      throw new AmazonProductionInventoryError(
        requiredMode === 'AUTOMATIC' ? 'Automatic sync is not enabled for this listing' : 'Enable manual sync for this listing before publishing',
        409,
        requiredMode === 'AUTOMATIC' ? 'AMAZON_AUTOMATIC_SYNC_DISABLED' : 'AMAZON_MANUAL_SYNC_DISABLED'
      );
    }
    if (operation === 'AUTOMATIC' && (!env.AMAZON_AUTO_SYNC_ENABLED || env.AMAZON_ENVIRONMENT !== 'PRODUCTION')) {
      throw new AmazonProductionInventoryError('Amazon automatic sync is disabled globally', 409, 'AMAZON_AUTOMATIC_SYNC_DISABLED');
    }
    const preview = await prisma.amazonInventorySyncAttempt.findFirst({
      where: {
        id: BigInt(previewId),
        listingId: context.listing.id,
        operation: 'PREVIEW',
        status: 'PREVIEWED',
      },
    });
    if (!preview) throw new AmazonProductionInventoryError('A valid stock preview is required', 409, 'AMAZON_PREVIEW_REQUIRED');
    if (Date.now() - preview.createdAt.getTime() > 10 * 60 * 1000) {
      throw new AmazonProductionInventoryError('The stock preview expired; preview again before publishing', 409, 'AMAZON_PREVIEW_EXPIRED');
    }
    if (preview.targetQuantity !== context.targetQuantity || preview.nivaanaQuantity !== context.nivaanaQuantity) {
      throw new AmazonProductionInventoryError('Nivaana stock changed after the preview; preview again', 409, 'AMAZON_PREVIEW_STALE');
    }
    const amazonQuantity = await this.getRemoteQuantity(scope, context.listing.sellerSku);
    if (amazonQuantity !== preview.amazonQuantity) {
      throw new AmazonProductionInventoryError('Amazon stock changed after the preview; preview again', 409, 'AMAZON_PREVIEW_STALE');
    }
    if (!scope.client.patchMfnQuantity) {
      throw new AmazonProductionInventoryError('Amazon production inventory publisher is unavailable', 503, 'AMAZON_INVENTORY_CLIENT_UNAVAILABLE');
    }

    let attempt;
    try {
      attempt = await prisma.amazonInventorySyncAttempt.create({
        data: {
          listingId: context.listing.id,
          operation,
          status: 'PENDING',
          amazonQuantity,
          nivaanaQuantity: context.nivaanaQuantity,
          targetQuantity: context.targetQuantity,
          requestKey: randomUUID(),
          previewId: preview.id,
          ...this.actorData(actor),
        },
      });
    } catch {
      throw new AmazonProductionInventoryError('This preview has already been used', 409, 'AMAZON_PREVIEW_ALREADY_USED');
    }

    try {
      const result = await scope.client.patchMfnQuantity({
        sellerSku: context.listing.sellerSku,
        productType: context.listing.productType!,
        quantity: context.targetQuantity,
      });
      if (result.status !== 'ACCEPTED') {
        throw new AmazonProductionInventoryError('Amazon did not accept the inventory update', 502, 'AMAZON_INVENTORY_REJECTED');
      }
      const finishedAt = new Date();
      const [updatedAttempt] = await prisma.$transaction([
        prisma.amazonInventorySyncAttempt.update({
          where: { id: attempt.id },
          data: { status: 'SUCCEEDED', amazonSubmissionId: result.submissionId, finishedAt },
        }),
        prisma.marketplaceListing.update({
          where: { id: context.listing.id },
          data: {
            publishedQuantity: context.targetQuantity,
            lastInventorySyncAt: finishedAt,
            lastInventorySyncStatus: 'SUCCEEDED',
            lastSyncedQuantity: context.targetQuantity,
          },
        }),
      ]);
      return serializeAttempt(updatedAttempt);
    } catch (error: any) {
      const code = error instanceof AmazonProductionInventoryError ? error.code : error?.code ?? 'AMAZON_INVENTORY_SYNC_FAILED';
      const message = error?.message ?? 'Amazon inventory synchronization failed';
      await prisma.$transaction([
        prisma.amazonInventorySyncAttempt.update({
          where: { id: attempt.id },
          data: { status: 'FAILED', errorCode: code, errorMessage: message, finishedAt: new Date() },
        }),
        prisma.marketplaceListing.update({
          where: { id: context.listing.id },
          data: { lastInventorySyncAt: new Date(), lastInventorySyncStatus: 'FAILED' },
        }),
      ]);
      throw error;
    }
  }

  async setMode(listingId: string, mode: 'DISABLED' | 'MANUAL' | 'AUTOMATIC', scope: AmazonListingScope) {
    await this.loadContext(listingId, scope);
    if (mode === 'AUTOMATIC' && (
      !env.AMAZON_AUTO_SYNC_ENABLED
      || !env.AMAZON_PRODUCTION_WRITES_ENABLED
      || env.AMAZON_ENVIRONMENT !== 'PRODUCTION'
    )) {
      throw new AmazonProductionInventoryError(
        'Enable both Amazon automatic sync and production writes before selecting automatic mode',
        409,
        'AMAZON_AUTOMATIC_SYNC_GLOBALLY_DISABLED'
      );
    }
    const listing = await prisma.marketplaceListing.update({
      where: { id: BigInt(listingId) },
      data: { inventorySyncMode: mode },
      select: { id: true, inventorySyncMode: true },
    });
    return { listingId: String(listing.id), inventorySyncMode: listing.inventorySyncMode };
  }

  async history(listingId: string, scope: AmazonListingScope) {
    await this.loadContext(listingId, scope);
    const attempts = await prisma.amazonInventorySyncAttempt.findMany({
      where: { listingId: BigInt(listingId) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return attempts.map(serializeAttempt);
  }

  async bulkPreview(listingIds: string[], scope: AmazonListingScope, actor: AmazonInventoryActor = {}) {
    const uniqueIds = [...new Set(listingIds)];
    const results: Array<Record<string, unknown>> = [];
    for (const listingId of uniqueIds) {
      try {
        results.push({ listingId, success: true, preview: await this.preview(listingId, scope, actor) });
      } catch (error: any) {
        results.push({
          listingId,
          success: false,
          code: error?.code ?? 'AMAZON_INVENTORY_PREVIEW_FAILED',
          message: error?.message ?? 'Inventory preview failed',
        });
      }
    }
    return {
      total: uniqueIds.length,
      succeeded: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
      results,
    };
  }

  async bulkSync(
    items: Array<{ listingId: string; previewId: string }>,
    scope: AmazonListingScope,
    actor: AmazonInventoryActor = {}
  ) {
    const results: Array<Record<string, unknown>> = [];
    for (const item of items) {
      try {
        results.push({
          listingId: item.listingId,
          success: true,
          attempt: await this.sync(item.listingId, item.previewId, scope, actor, 'BULK'),
        });
      } catch (error: any) {
        results.push({
          listingId: item.listingId,
          success: false,
          code: error?.code ?? 'AMAZON_INVENTORY_SYNC_FAILED',
          message: error?.message ?? 'Inventory synchronization failed',
        });
      }
    }
    return {
      total: items.length,
      succeeded: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
      results,
    };
  }

  async retry(
    listingId: string,
    failedAttemptId: string,
    scope: AmazonListingScope,
    actor: AmazonInventoryActor = {}
  ) {
    const failedAttempt = await prisma.amazonInventorySyncAttempt.findFirst({
      where: {
        id: BigInt(failedAttemptId),
        listingId: BigInt(listingId),
        status: 'FAILED',
        operation: { in: ['MANUAL', 'BULK', 'RETRY'] },
        listing: {
          sellerId: scope.sellerId,
          marketplaceId: scope.marketplaceId,
          marketplace: 'AMAZON',
          environment: 'PRODUCTION',
        },
      },
      select: { id: true },
    });
    if (!failedAttempt) {
      throw new AmazonProductionInventoryError('Failed inventory attempt was not found', 404, 'AMAZON_FAILED_ATTEMPT_NOT_FOUND');
    }
    const preview = await this.preview(listingId, scope, actor);
    return this.sync(listingId, preview.id, scope, actor, 'RETRY');
  }

  async syncAutomaticPlatformStock(platformStockId: string) {
    if (
      !env.AMAZON_AUTO_SYNC_ENABLED
      || !env.AMAZON_PRODUCTION_WRITES_ENABLED
      || env.AMAZON_ENVIRONMENT !== 'PRODUCTION'
    ) {
      return { status: 'SKIPPED' as const, reason: 'Amazon automatic production sync is disabled' };
    }
    const platformStock = await prisma.platformStock.findUnique({
      where: { id: BigInt(platformStockId) },
      select: { productid: true, platform: true },
    });
    if (!platformStock) throw new Error(`PlatformStock ${platformStockId} was not found`);
    if (platformStock.platform.trim().toLowerCase() !== 'amazon') {
      return { status: 'SKIPPED' as const, reason: 'Platform stock is not for Amazon' };
    }
    const listings = await prisma.marketplaceListing.findMany({
      where: {
        marketplace: 'AMAZON',
        environment: 'PRODUCTION',
        productId: platformStock.productid,
        mappingStatus: 'MAPPED',
        fulfilmentChannel: { in: ['MFN', 'EASY_SHIP'] },
        inventorySyncMode: 'AUTOMATIC',
      },
      select: { id: true, sellerId: true, marketplaceId: true, sellerSku: true },
    });
    if (listings.length === 0) {
      return { status: 'SKIPPED' as const, reason: 'No automatic seller-fulfilled listing is mapped to this stock' };
    }

    const results: Array<Record<string, unknown>> = [];
    for (const listing of listings) {
      try {
        await amazonProductionWriteGuardService.assertEnabled(listing.sellerId, listing.marketplaceId);
        const scope = await amazonListingScopeService.resolveForSeller(listing.sellerId, listing.marketplaceId);
        const attempt = await this.enqueueBySku(listing.sellerSku, async () => {
          const preview = await this.preview(String(listing.id), scope);
          if (!preview.mismatch) return preview;
          return this.sync(String(listing.id), preview.id, scope, {}, 'AUTOMATIC');
        });
        results.push({ listingId: String(listing.id), success: true, attempt });
      } catch (error: any) {
        results.push({ listingId: String(listing.id), success: false, message: error?.message ?? 'Automatic sync failed' });
      }
    }
    const failed = results.filter((result) => !result.success).length;
    return {
      status: failed === results.length ? 'FAILED' as const : 'SYNCED' as const,
      ...(failed > 0 ? { reason: `${results.length - failed} automatic sync(s) succeeded; ${failed} failed` } : {}),
      results,
    };
  }
}

export const amazonProductionInventoryService = new AmazonProductionInventoryService();
