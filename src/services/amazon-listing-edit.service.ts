import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../models/prisma.js';
import { AmazonListingScope } from './amazon-listing-scope.service.js';
import { buildAmazonAttributeContract } from './amazon-listing-publish-draft.service.js';
import { normalizeAmazonListing } from './amazon-listing-normalizer.js';
import { amazonProductionWriteGuardService } from './amazon-production-write-guard.service.js';

type Actor = { requestedByUserId?: number; requestedByUserType?: string };
type AttributeGroups = Record<string, Array<Record<string, unknown>>>;

export class AmazonListingEditError extends Error {
  constructor(message: string, readonly statusCode: number, readonly code: string) {
    super(message);
    this.name = 'AmazonListingEditError';
  }
}

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)])
    );
  }
  return value;
};

export const hashAmazonListingAttributes = (attributes: Record<string, unknown>) =>
  createHash('sha256').update(JSON.stringify(stableValue(attributes))).digest('hex');

export const diffAmazonListingAttributes = (
  baseline: Record<string, unknown>,
  requested: AttributeGroups,
  allowed: Set<string>
) => {
  const invalidNames: string[] = [];
  const changedAttributes = Object.fromEntries(
    Object.entries(requested).filter(([name, value]) => {
      if (!allowed.has(name)) {
        invalidNames.push(name);
        return false;
      }
      return JSON.stringify(stableValue(baseline[name])) !== JSON.stringify(stableValue(value));
    })
  ) as AttributeGroups;
  return {
    invalidNames,
    changedAttributes,
    patches: Object.entries(changedAttributes).map(([name, value]) => ({
      op: 'replace' as const,
      path: `/attributes/${name}`,
      value,
    })),
  };
};

const hasError = (issues: unknown[]) => issues.some((issue) =>
  String((issue as Record<string, unknown> | null)?.severity ?? '').toUpperCase() === 'ERROR'
);

export class AmazonListingEditService {
  private fail(message: string, statusCode = 409, code = 'AMAZON_LISTING_EDIT_BLOCKED'): never {
    throw new AmazonListingEditError(message, statusCode, code);
  }

  private async listing(listingId: string, scope: AmazonListingScope) {
    if (!/^[1-9]\d*$/.test(listingId)) this.fail('Invalid Amazon listing ID', 400, 'VALIDATION_ERROR');
    const listing = await prisma.marketplaceListing.findFirst({
      where: {
        id: BigInt(listingId),
        marketplace: 'AMAZON',
        environment: 'PRODUCTION',
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
      },
    });
    if (!listing) this.fail('Amazon production listing not found', 404, 'AMAZON_LISTING_NOT_FOUND');
    if (listing.mappingStatus !== 'MAPPED' || !listing.productId) {
      this.fail('Map this Amazon listing to a Nivaana product before editing catalogue attributes');
    }
    if (!listing.productType) this.fail('Amazon product type is missing; import the listing again');
    if (!scope.client.fetchListing) this.fail('Amazon listing detail retrieval is unavailable', 503, 'AMAZON_LISTING_READ_UNAVAILABLE');
    return listing;
  }

  private async remote(listing: Awaited<ReturnType<AmazonListingEditService['listing']>>, scope: AmazonListingScope) {
    const remote = await scope.client.fetchListing!(listing.sellerSku);
    return {
      remote,
      attributes: (remote.attributes ?? {}) as Record<string, unknown>,
      baselineHash: hashAmazonListingAttributes(remote.attributes ?? {}),
    };
  }

  async bootstrap(listingId: string, scope: AmazonListingScope) {
    const listing = await this.listing(listingId, scope);
    const baseline = await this.remote(listing, scope);
    let attributeContract = null;
    if (scope.client.getProductTypeDefinition) {
      const definition = await scope.client.getProductTypeDefinition({
        productType: listing.productType!,
        requirements: 'LISTING_PRODUCT_ONLY',
      });
      attributeContract = buildAmazonAttributeContract(
        listing.productType!,
        'LISTING_PRODUCT_ONLY',
        definition.productTypeVersion?.version ?? null,
        definition.schema.checksum,
        definition.definitionSchema,
        definition.propertyGroups ?? {}
      );
    }
    return {
      listing: {
        id: listingId,
        sellerSku: listing.sellerSku,
        asin: listing.asin,
        title: listing.title,
        productType: listing.productType,
        listingStatus: listing.listingStatus,
        marketplaceId: listing.marketplaceId,
        amazonLastUpdatedAt: listing.amazonLastUpdatedAt?.toISOString() ?? null,
      },
      baselineHash: baseline.baselineHash,
      attributes: baseline.attributes,
      issues: baseline.remote.issues ?? [],
      attributeContract,
      protectedAttributes: ['purchasable_offer', 'fulfillment_availability'],
      note: 'Only intentionally changed attribute groups will be sent to Amazon.',
    };
  }

  async preview(
    listingId: string,
    input: { baselineHash: string; changedAttributes: AttributeGroups },
    scope: AmazonListingScope,
    actor: Actor
  ) {
    const listing = await this.listing(listingId, scope);
    const baseline = await this.remote(listing, scope);
    if (baseline.baselineHash !== input.baselineHash) {
      this.fail('Amazon changed this listing after it was loaded; reload the latest baseline', 409, 'AMAZON_LISTING_BASELINE_STALE');
    }
    const schema = scope.client.getProductTypeDefinition
      ? await scope.client.getProductTypeDefinition({
          productType: listing.productType!,
          requirements: 'LISTING_PRODUCT_ONLY',
        })
      : null;
    const contract = schema
      ? buildAmazonAttributeContract(
          listing.productType!,
          'LISTING_PRODUCT_ONLY',
          schema.productTypeVersion?.version ?? null,
          schema.schema.checksum,
          schema.definitionSchema,
          schema.propertyGroups ?? {}
        )
      : null;
    const allowed = contract
      ? new Set(contract.fields.map((field) => field.name))
      : new Set(Object.keys(baseline.attributes));
    const difference = diffAmazonListingAttributes(baseline.attributes, input.changedAttributes, allowed);
    if (difference.invalidNames[0]) {
      this.fail(`Attribute ${difference.invalidNames[0]} is not valid for ${listing.productType}`, 400, 'AMAZON_ATTRIBUTE_NOT_ALLOWED');
    }
    const changedAttributes = difference.changedAttributes;
    if (Object.keys(changedAttributes).length === 0) {
      this.fail('No intentional attribute changes remain after comparison with Amazon', 400, 'AMAZON_LISTING_EDIT_NO_CHANGES');
    }
    if (!scope.client.patchListingOffer) this.fail('Amazon listing patch validation is unavailable', 503, 'AMAZON_LISTING_PATCH_UNAVAILABLE');
    const patches = difference.patches;
    const result = await scope.client.patchListingOffer({
      sellerSku: listing.sellerSku,
      productType: listing.productType!,
      patches,
      validationPreview: true,
    });
    const canApply = !hasError(result.issues);
    await prisma.amazonOfferUpdatePreview.updateMany({
      where: { listingId: listing.id, operationType: 'LISTING_EDIT', status: 'PENDING' },
      data: { status: 'SUPERSEDED' },
    });
    const preview = await prisma.amazonOfferUpdatePreview.create({
      data: {
        listingId: listing.id,
        sourceUpdatedAt: listing.updatedAt,
        operationType: 'LISTING_EDIT',
        requestedChanges: {
          baselineHash: input.baselineHash,
          changedAttributes,
          patches,
        } as Prisma.InputJsonValue,
        amazonIssues: result.issues as Prisma.InputJsonValue,
        canApply,
        expiresAt: new Date(Date.now() + 15 * 60_000),
        ...actor,
      },
    });
    return {
      previewId: String(preview.id),
      canApply,
      expiresAt: preview.expiresAt.toISOString(),
      amazonStatus: result.status,
      issues: result.issues,
      changedAttributeNames: Object.keys(changedAttributes),
      changedAttributes,
    };
  }

  async apply(
    listingId: string,
    input: { previewId: string; baselineHash: string },
    scope: AmazonListingScope,
    actor: Actor
  ) {
    if (!env.AMAZON_LISTING_EDIT_ENABLED) {
      this.fail('Amazon existing-listing editing is disabled by the backend feature switch', 409, 'AMAZON_LISTING_EDIT_DISABLED');
    }
    await amazonProductionWriteGuardService.assertEnabled(scope.sellerId, scope.marketplaceId);
    const listing = await this.listing(listingId, scope);
    const preview = await prisma.amazonOfferUpdatePreview.findFirst({
      where: {
        id: BigInt(input.previewId),
        listingId: listing.id,
        operationType: 'LISTING_EDIT',
      },
    });
    if (!preview) this.fail('Amazon listing edit preview not found', 404, 'AMAZON_LISTING_EDIT_PREVIEW_NOT_FOUND');
    if (preview.status !== 'PENDING' || preview.expiresAt <= new Date()) {
      this.fail('Amazon listing edit preview expired; validate the changes again');
    }
    if (!preview.canApply) this.fail('Resolve Amazon validation errors before applying this edit');
    if (preview.sourceUpdatedAt.getTime() !== listing.updatedAt.getTime()) {
      this.fail('The local listing changed after preview; validate the changes again');
    }
    const requested = preview.requestedChanges as {
      baselineHash: string;
      changedAttributes: AttributeGroups;
      patches: Array<{ op: 'replace'; path: string; value: Array<Record<string, unknown>> }>;
    };
    if (requested.baselineHash !== input.baselineHash) this.fail('The confirmed Amazon baseline does not match this preview');
    const current = await this.remote(listing, scope);
    if (current.baselineHash !== requested.baselineHash) {
      this.fail('Amazon changed this listing after preview; reload before applying edits', 409, 'AMAZON_LISTING_BASELINE_STALE');
    }
    if (!scope.client.patchListingOffer) this.fail('Amazon listing patch is unavailable', 503, 'AMAZON_LISTING_PATCH_UNAVAILABLE');
    const result = await scope.client.patchListingOffer({
      sellerSku: listing.sellerSku,
      productType: listing.productType!,
      patches: requested.patches,
    });
    const rejected = hasError(result.issues);
    await prisma.$transaction([
      prisma.amazonOfferUpdatePreview.update({
        where: { id: preview.id },
        data: { status: rejected ? 'REJECTED' : 'CONSUMED', consumedAt: new Date() },
      }),
      prisma.marketplaceListing.update({
        where: { id: listing.id },
        data: {
          lastOfferUpdateAt: new Date(),
          lastOfferUpdateStatus: rejected ? 'EDIT_REJECTED' : 'EDIT_SUBMITTED',
          lastOfferSubmissionId: result.submissionId,
        },
      }),
      prisma.marketplaceListingAudit.create({
        data: {
          listingId: listing.id,
          marketplace: listing.marketplace,
          environment: listing.environment,
          marketplaceId: listing.marketplaceId,
          sellerId: listing.sellerId,
          sellerSku: listing.sellerSku,
          operation: rejected ? 'LISTING_EDIT_REJECTED' : 'LISTING_EDIT_SUBMITTED',
          changedFields: Object.keys(requested.changedAttributes),
          beforeValues: Object.fromEntries(Object.keys(requested.changedAttributes).map((name) => [name, current.attributes[name]])) as Prisma.InputJsonValue,
          afterValues: requested.changedAttributes as Prisma.InputJsonValue,
          productId: listing.productId,
          ...actor,
        },
      }),
    ]);
    return {
      status: rejected ? 'REJECTED' : 'SUBMITTED',
      submissionId: result.submissionId,
      amazonStatus: result.status,
      issues: result.issues,
      changedAttributeNames: Object.keys(requested.changedAttributes),
    };
  }

  async reconcile(listingId: string, scope: AmazonListingScope, actor: Actor) {
    const listing = await this.listing(listingId, scope);
    const baseline = await this.remote(listing, scope);
    const normalized = normalizeAmazonListing(baseline.remote, {
      sellerId: scope.sellerId,
      marketplaceId: scope.marketplaceId,
    });
    const issues = baseline.remote.issues ?? [];
    await prisma.$transaction([
      prisma.marketplaceListing.update({
        where: { id: listing.id },
        data: {
          asin: normalized.asin,
          title: normalized.title,
          productType: normalized.productType,
          listingStatus: normalized.listingStatus,
          price: normalized.price,
          currency: normalized.currency,
          publishedQuantity: normalized.publishedQuantity,
          amazonLastUpdatedAt: normalized.amazonLastUpdatedAt,
          lastImportedAt: new Date(),
          lastOfferUpdateStatus: hasError(issues) ? 'EDIT_NEEDS_ATTENTION' : 'EDIT_RECONCILED',
        },
      }),
      prisma.marketplaceListingAudit.create({
        data: {
          listingId: listing.id,
          marketplace: listing.marketplace,
          environment: listing.environment,
          marketplaceId: listing.marketplaceId,
          sellerId: listing.sellerId,
          sellerSku: listing.sellerSku,
          operation: hasError(issues) ? 'LISTING_EDIT_NEEDS_ATTENTION' : 'LISTING_EDIT_RECONCILED',
          changedFields: ['listingStatus', 'attributes', 'issues'],
          afterValues: {
            baselineHash: baseline.baselineHash,
            listingStatus: normalized.listingStatus,
            issues,
          } as Prisma.InputJsonValue,
          productId: listing.productId,
          ...actor,
        },
      }),
    ]);
    return {
      state: hasError(issues) ? 'NEEDS_ATTENTION' : 'RECONCILED',
      baselineHash: baseline.baselineHash,
      listingStatus: normalized.listingStatus,
      attributes: baseline.attributes,
      issues,
    };
  }
}

export const amazonListingEditService = new AmazonListingEditService();
