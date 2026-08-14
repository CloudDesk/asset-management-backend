import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { AmazonListingScope } from './amazon-listing-scope.service.js';
import { amazonProductionWriteGuardService } from './amazon-production-write-guard.service.js';

export type AmazonOfferChanges = {
  price?: number | undefined;
  currency?: string | undefined;
  quantity?: number | undefined;
  handlingTimeDays?: number | undefined;
  available?: boolean | undefined;
};
type Actor = { requestedByUserId?: number; requestedByUserType?: string };

export class AmazonOfferUpdateError extends Error {
  constructor(message: string, readonly statusCode: number, readonly code: string) {
    super(message);
    this.name = 'AmazonOfferUpdateError';
  }
}

const issueSeverity = (issue: unknown) => {
  if (!issue || typeof issue !== 'object') return 'ERROR';
  const value = String((issue as Record<string, unknown>).severity ?? 'ERROR').toUpperCase();
  return ['ERROR', 'WARNING', 'INFO'].includes(value) ? value : 'ERROR';
};

export class AmazonOfferUpdateService {
  private fail(message: string, statusCode = 409, code = 'AMAZON_OFFER_UPDATE_BLOCKED'): never {
    throw new AmazonOfferUpdateError(message, statusCode, code);
  }

  private async listing(listingId: string, scope: AmazonListingScope) {
    if (!/^[1-9]\d*$/.test(listingId)) this.fail('Invalid Amazon listing ID', 400, 'VALIDATION_ERROR');
    const listing = await prisma.marketplaceListing.findFirst({ where: {
      id: BigInt(listingId), marketplace: 'AMAZON', environment: 'PRODUCTION',
      sellerId: scope.sellerId, marketplaceId: scope.marketplaceId,
    } });
    if (!listing) this.fail('Amazon production listing not found', 404, 'AMAZON_LISTING_NOT_FOUND');
    return listing;
  }

  private patches(listing: Awaited<ReturnType<AmazonOfferUpdateService['listing']>>, changes: AmazonOfferChanges) {
    if (!listing.productType) this.fail('Amazon product type is missing; refresh the listing before updating it');
    if (listing.mappingStatus !== 'MAPPED' || !listing.productId) {
      this.fail('Map this Amazon listing to a Nivaana product before updating its offer');
    }
    if (listing.lastInventorySyncStatus === 'FAILED') {
      this.fail('Resolve listing or stock-sync issues before updating this offer');
    }
    const patches: Array<{ op: 'replace' | 'merge'; path: string; value: Array<Record<string, unknown>> }> = [];
    if (changes.price !== undefined) {
      const currency = changes.currency ?? listing.currency ?? 'INR';
      patches.push({ op: 'replace', path: '/attributes/purchasable_offer', value: [{
        marketplace_id: listing.marketplaceId, audience: 'ALL', currency,
        our_price: [{ schedule: [{ value_with_tax: changes.price }] }],
      }] });
    }
    const changesSellerAvailability = changes.quantity !== undefined || changes.handlingTimeDays !== undefined || changes.available !== undefined;
    if (changesSellerAvailability) {
      if (!['MFN', 'EASY_SHIP'].includes(listing.fulfilmentChannel)) {
        this.fail('Quantity, availability, and handling time can be updated only for seller-fulfilled listings');
      }
      let quantity = changes.quantity ?? listing.publishedQuantity;
      if (changes.available === false) quantity = 0;
      if (quantity === null || quantity === undefined) {
        this.fail('A quantity is required when updating seller-fulfilled availability or handling time');
      }
      if (changes.available === true && quantity === 0) {
        this.fail('Set a quantity greater than zero to make the listing available');
      }
      patches.push({ op: 'replace', path: '/attributes/fulfillment_availability', value: [{
        marketplace_id: listing.marketplaceId, fulfillment_channel_code: 'DEFAULT', quantity,
        ...(changes.handlingTimeDays !== undefined ? { lead_time_to_ship_max_days: changes.handlingTimeDays } : {}),
      }] });
    }
    return patches;
  }

  async preview(listingId: string, changes: AmazonOfferChanges, scope: AmazonListingScope, actor: Actor) {
    const listing = await this.listing(listingId, scope);
    if (!scope.client.patchListingOffer) this.fail('Amazon offer updates are unavailable', 503, 'AMAZON_OFFER_CLIENT_UNAVAILABLE');
    const patches = this.patches(listing, changes);
    const result = await scope.client.patchListingOffer({
      sellerSku: listing.sellerSku, productType: listing.productType!, patches, validationPreview: true,
    });
    const issues = result.issues as Prisma.InputJsonValue;
    const canApply = !result.issues.some((issue) => issueSeverity(issue) === 'ERROR');
    await prisma.amazonOfferUpdatePreview.updateMany({
      where: { listingId: listing.id, status: 'PENDING' }, data: { status: 'SUPERSEDED' },
    });
    const preview = await prisma.amazonOfferUpdatePreview.create({ data: {
      listingId: listing.id, sourceUpdatedAt: listing.updatedAt,
      operationType: 'OFFER',
      requestedChanges: changes as Prisma.InputJsonValue, amazonIssues: issues, canApply,
      expiresAt: new Date(Date.now() + 15 * 60_000), ...actor,
    } });
    return {
      id: String(preview.id), listingId, canApply, status: preview.status,
      expiresAt: preview.expiresAt.toISOString(), changes, amazonStatus: result.status,
      issues: result.issues,
      current: {
        price: listing.price?.toString() ?? null, currency: listing.currency,
        quantity: listing.publishedQuantity, handlingTimeDays: listing.pendingHandlingTimeDays,
      },
    };
  }

  async apply(listingId: string, previewId: string, scope: AmazonListingScope, actor: Actor) {
    const writeStatus = await amazonProductionWriteGuardService.status(scope.sellerId, scope.marketplaceId);
    if (!writeStatus.effectiveEnabled) this.fail('Amazon production writes are disabled by the global kill switch', 409, 'AMAZON_PRODUCTION_WRITES_DISABLED');
    const listing = await this.listing(listingId, scope);
    const preview = await prisma.amazonOfferUpdatePreview.findFirst({ where: {
      id: BigInt(previewId), listingId: listing.id, operationType: 'OFFER',
    } });
    if (!preview) this.fail('Offer update preview not found', 404, 'AMAZON_OFFER_PREVIEW_NOT_FOUND');
    if (preview.status !== 'PENDING' || preview.expiresAt <= new Date()) this.fail('Offer update preview has expired; create a new preview');
    if (!preview.canApply) this.fail('Amazon validation errors must be resolved before applying this update');
    if (preview.sourceUpdatedAt.getTime() !== listing.updatedAt.getTime()) this.fail('Listing changed after preview; create a new preview');
    if (!scope.client.patchListingOffer) this.fail('Amazon offer updates are unavailable', 503, 'AMAZON_OFFER_CLIENT_UNAVAILABLE');
    const changes = preview.requestedChanges as AmazonOfferChanges;
    const patches = this.patches(listing, changes);
    try {
      const result = await scope.client.patchListingOffer({ sellerSku: listing.sellerSku, productType: listing.productType!, patches });
      const hasErrors = result.issues.some((issue) => issueSeverity(issue) === 'ERROR');
      await prisma.$transaction([
        prisma.amazonOfferUpdatePreview.update({ where: { id: preview.id }, data: { status: hasErrors ? 'REJECTED' : 'CONSUMED', consumedAt: new Date() } }),
        prisma.marketplaceListing.update({ where: { id: listing.id }, data: {
          ...(changes.price !== undefined ? { pendingOfferPrice: changes.price } : {}),
          ...(changes.quantity !== undefined || changes.available !== undefined
            ? { pendingOfferQuantity: changes.available === false ? 0 : changes.quantity ?? listing.publishedQuantity } : {}),
          ...(changes.handlingTimeDays !== undefined ? { pendingHandlingTimeDays: changes.handlingTimeDays } : {}),
          lastOfferUpdateAt: new Date(), lastOfferUpdateStatus: hasErrors ? 'REJECTED' : result.status,
          lastOfferSubmissionId: result.submissionId,
        } }),
        prisma.marketplaceListingAudit.create({ data: {
          listingId: listing.id, marketplace: listing.marketplace, environment: listing.environment,
          marketplaceId: listing.marketplaceId, sellerId: listing.sellerId, sellerSku: listing.sellerSku,
          operation: hasErrors ? 'OFFER_UPDATE_REJECTED' : 'OFFER_UPDATE_SUBMITTED',
          changedFields: Object.keys(changes),
          beforeValues: { price: listing.price?.toString() ?? null, quantity: listing.publishedQuantity },
          afterValues: changes as Prisma.InputJsonValue,
          productId: listing.productId, ...actor,
        } }),
      ]);
      return { listingId, previewId, status: hasErrors ? 'REJECTED' : result.status, submissionId: result.submissionId, issues: result.issues };
    } catch (error) {
      await prisma.marketplaceListingAudit.create({ data: {
        listingId: listing.id, marketplace: listing.marketplace, environment: listing.environment,
        marketplaceId: listing.marketplaceId, sellerId: listing.sellerId, sellerSku: listing.sellerSku,
        operation: 'OFFER_UPDATE_FAILED', changedFields: Object.keys(changes),
        beforeValues: { price: listing.price?.toString() ?? null, quantity: listing.publishedQuantity },
        afterValues: changes as Prisma.InputJsonValue, productId: listing.productId,
        ...actor,
      } }).catch(() => undefined);
      throw error;
    }
  }
}

export const amazonOfferUpdateService = new AmazonOfferUpdateService();
