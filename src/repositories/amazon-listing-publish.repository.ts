import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import type { NormalizedAmazonListing } from '../services/amazon-listing-normalizer.js';

export type AmazonPublishActor = {
  requestedByUserId?: number;
  requestedByUserType?: string;
};

export type AmazonPublishScope = {
  sellerId: string;
  marketplaceId: string;
};

export type AmazonPublishProduct = {
  id: bigint;
  name: string;
  puc: string;
  shortdescription: string | null;
  fulldescription: string | null;
  category: string | null;
  subcategory: string | null;
  subsubcategory: string | null;
  fragnancetype: string | null;
  large: string[];
  medium: string[];
  small: string[];
  brand: string | null;
  pack: string | null;
  price: Prisma.Decimal | null;
  availablequantity: number | null;
  productstatus: string | null;
  material: string | null;
  manufacturer: string | null;
  netform: string | null;
  netquantity: string | null;
  numberofitems: number | null;
  itemlength: string | null;
  itemthickness: string | null;
  modifieddate: bigint | null;
};

export type CreateAmazonPublishDraftInput = {
  productId: string;
  activeDraftKey: string;
  sellerId: string;
  marketplaceId: string;
  listingMode: string;
  sellerSku: string;
  sourceProductModifiedAt: bigint | null;
  sourceSnapshot: Prisma.InputJsonValue;
  mappedAttributes: Prisma.InputJsonValue;
  asin?: string;
  productType?: string;
  requirements?: string;
  status?: string;
  candidateResults?: Prisma.InputJsonValue;
  fulfilmentChannel?: string;
  actor: AmazonPublishActor;
};

export type CancelAmazonPublishDraftInput = AmazonPublishScope & AmazonPublishActor & {
  draftId: string;
  draftRevision: number;
  reason?: string;
};

export type CancelAmazonPublishDraftResult =
  | { status: 'CANCELLED'; draft: any }
  | { status: 'NOT_FOUND' }
  | { status: 'REVISION_CONFLICT'; currentRevision: number }
  | { status: 'NOT_CANCELLABLE'; draftStatus: string };

export type UpdateAmazonPublishDraftInput = AmazonPublishScope & AmazonPublishActor & {
  draftId: string;
  draftRevision: number;
  listingMode?: string;
  sellerSku?: string;
  mappedAttributes?: Prisma.InputJsonValue;
};

export type UpdateAmazonPublishDraftResult =
  | { status: 'UPDATED'; draft: any }
  | { status: 'NOT_FOUND' }
  | { status: 'REVISION_CONFLICT'; currentRevision: number }
  | { status: 'NOT_EDITABLE'; draftStatus: string };

export type TransitionAmazonPublishDraftInput = AmazonPublishScope & AmazonPublishActor & {
  draftId: string;
  draftRevision: number;
  operation: string;
  data: {
    status?: string;
    sellerSku?: string;
    listingMode?: string;
    asin?: string | null;
    productType?: string | null;
    requirements?: string;
    candidateResults?: Prisma.InputJsonValue;
    fulfilmentChannel?: string;
    schemaVersion?: string | null;
    schemaChecksum?: string | null;
    lastValidationStatus?: string | null;
    validatedPayloadHash?: string | null;
    lastSubmissionStatus?: string | null;
  };
  metadata?: Prisma.InputJsonValue;
};

export type RecordAcceptedAmazonPublishResult =
  | { status: 'RECORDED'; draft: any; listingId: string }
  | { status: 'NOT_FOUND' }
  | { status: 'REVISION_CONFLICT'; currentRevision: number }
  | { status: 'NOT_READY'; draftStatus: string };

export type RecordAmazonReconciliationResult =
  | { status: 'RECORDED'; draft: any; listingId: string }
  | { status: 'NOT_FOUND' }
  | { status: 'REVISION_CONFLICT'; currentRevision: number }
  | { status: 'NOT_SUBMITTED'; draftStatus: string };

export type ReopenAmazonCorrectionResult =
  | { status: 'REOPENED'; draft: any }
  | { status: 'NOT_FOUND' }
  | { status: 'REVISION_CONFLICT'; currentRevision: number }
  | { status: 'NOT_CORRECTABLE'; draftStatus: string };

export interface AmazonListingPublishPersistence {
  getProduct(productId: string): Promise<AmazonPublishProduct | null>;
  getMappedListing(productId: string, scope: AmazonPublishScope): Promise<any | null>;
  getActiveDraft(activeDraftKey: string): Promise<any | null>;
  listDrafts?(scope: AmazonPublishScope): Promise<any[]>;
  listPublishedProducts?(scope: AmazonPublishScope): Promise<any[]>;
  createDraft(input: CreateAmazonPublishDraftInput): Promise<any>;
  getDraft(draftId: string, scope: AmazonPublishScope): Promise<any | null>;
  ensureDraftImages?(draftId: string, urls: string[], actor: AmazonPublishActor): Promise<any | null>;
  findSellerSkuConflict?(draftId: string, sellerSku: string, scope: AmazonPublishScope): Promise<{
    type: 'DRAFT' | 'LISTING';
    id: string;
    productId: string;
  } | null>;
  updateDraft(input: UpdateAmazonPublishDraftInput): Promise<UpdateAmazonPublishDraftResult>;
  transitionDraft(input: TransitionAmazonPublishDraftInput): Promise<UpdateAmazonPublishDraftResult>;
  getProductTypeSchema?(cacheKey: string): Promise<any | null>;
  upsertProductTypeSchema?(input: {
    cacheKey: string;
    sellerId: string;
    marketplaceId: string;
    productType: string;
    requirements: string;
    productTypeVersion: string;
    resolvedVersion: string | null;
    schemaChecksum: string;
    definitionSchema: Prisma.InputJsonValue;
    propertyGroups?: Prisma.InputJsonValue;
    expiresAt: Date;
  }): Promise<any>;
  getValidationAttempt?(requestKey: string): Promise<any | null>;
  createValidationAttempt?(input: {
    draftId: string;
    operation: string;
    requestKey: string;
    draftRevision: number;
    payloadHash: string;
    requestPayload: Prisma.InputJsonValue;
    actor: AmazonPublishActor;
  }): Promise<any>;
  finishValidationAttempt?(input: {
    attemptId: string;
    status: string;
    responsePayload?: Prisma.InputJsonValue;
    amazonSubmissionId?: string | null;
    amazonStatus?: string | null;
    issues: Prisma.InputJsonValue;
    httpStatus?: number | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  }): Promise<any>;
  recordAcceptedSubmission?(input: AmazonPublishScope & AmazonPublishActor & {
    draftId: string;
    draftRevision: number;
    attemptId: string;
    payloadHash: string;
    amazonSubmissionId: string;
    responsePayload: Prisma.InputJsonValue;
    issues: Prisma.InputJsonValue;
    candidateResults: Prisma.InputJsonValue;
  }): Promise<RecordAcceptedAmazonPublishResult>;
  recordSubmissionReconciliation?(input: AmazonPublishScope & AmazonPublishActor & {
    draftId: string;
    draftRevision: number;
    state: 'PROCESSING' | 'LIVE' | 'NEEDS_ATTENTION';
    listing: NormalizedAmazonListing;
    issues: Prisma.InputJsonValue;
    candidateResults: Prisma.InputJsonValue;
  }): Promise<RecordAmazonReconciliationResult>;
  reopenForCorrection?(input: AmazonPublishScope & AmazonPublishActor & {
    draftId: string;
    draftRevision: number;
    reason: string;
    candidateResults: Prisma.InputJsonValue;
  }): Promise<ReopenAmazonCorrectionResult>;
  cancelDraft(input: CancelAmazonPublishDraftInput): Promise<CancelAmazonPublishDraftResult>;
}

const actorData = (actor: AmazonPublishActor) => ({
  ...(actor.requestedByUserId !== undefined ? { requestedByUserId: actor.requestedByUserId } : {}),
  ...(actor.requestedByUserType !== undefined ? { requestedByUserType: actor.requestedByUserType } : {}),
});

const createdByData = (actor: AmazonPublishActor) => ({
  ...(actor.requestedByUserId !== undefined ? { createdByUserId: actor.requestedByUserId } : {}),
  ...(actor.requestedByUserType !== undefined ? { createdByUserType: actor.requestedByUserType } : {}),
});

export class PrismaAmazonListingPublishRepository implements AmazonListingPublishPersistence {
  async reopenForCorrection(input: AmazonPublishScope & AmazonPublishActor & {
    draftId: string;
    draftRevision: number;
    reason: string;
    candidateResults: Prisma.InputJsonValue;
  }): Promise<ReopenAmazonCorrectionResult> {
    return prisma.$transaction(async (transaction) => {
      const current = await transaction.amazonListingPublishDraft.findFirst({
        where: {
          id: BigInt(input.draftId),
          sellerId: input.sellerId,
          marketplaceId: input.marketplaceId,
        },
      });
      if (!current) return { status: 'NOT_FOUND' as const };
      if (current.draftRevision !== input.draftRevision) {
        return { status: 'REVISION_CONFLICT' as const, currentRevision: current.draftRevision };
      }
      if (current.status !== 'NEEDS_ATTENTION') {
        return { status: 'NOT_CORRECTABLE' as const, draftStatus: current.status };
      }
      const updated = await transaction.amazonListingPublishDraft.update({
        where: { id: current.id },
        data: {
          status: 'ATTRIBUTES_REQUIRED',
          candidateResults: input.candidateResults,
          lastValidationStatus: null,
          validatedPayloadHash: null,
          draftRevision: { increment: 1 },
        },
      });
      await transaction.amazonListingPublishAudit.create({
        data: {
          draftId: updated.id,
          productId: updated.productId,
          sellerId: updated.sellerId,
          marketplaceId: updated.marketplaceId,
          sellerSku: updated.sellerSku,
          asin: updated.asin,
          operation: 'AMAZON_CORRECTION_DRAFT_REOPENED',
          beforeValues: {
            status: current.status,
            draftRevision: current.draftRevision,
            lastValidationStatus: current.lastValidationStatus,
          },
          afterValues: {
            status: updated.status,
            draftRevision: updated.draftRevision,
            lastValidationStatus: updated.lastValidationStatus,
          },
          metadata: { reason: input.reason },
          ...actorData(input),
        },
      });
      const draft = await transaction.amazonListingPublishDraft.findUniqueOrThrow({
        where: { id: current.id },
        include: {
          images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          attempts: { orderBy: { createdAt: 'desc' }, take: 10 },
          audits: { orderBy: { createdAt: 'desc' }, take: 50 },
        },
      });
      return { status: 'REOPENED' as const, draft };
    });
  }

  async recordSubmissionReconciliation(input: AmazonPublishScope & AmazonPublishActor & {
    draftId: string;
    draftRevision: number;
    state: 'PROCESSING' | 'LIVE' | 'NEEDS_ATTENTION';
    listing: NormalizedAmazonListing;
    issues: Prisma.InputJsonValue;
    candidateResults: Prisma.InputJsonValue;
  }): Promise<RecordAmazonReconciliationResult> {
    return prisma.$transaction(async (transaction) => {
      const current = await transaction.amazonListingPublishDraft.findFirst({
        where: {
          id: BigInt(input.draftId),
          sellerId: input.sellerId,
          marketplaceId: input.marketplaceId,
        },
      });
      if (!current) return { status: 'NOT_FOUND' as const };
      if (current.draftRevision !== input.draftRevision) {
        return { status: 'REVISION_CONFLICT' as const, currentRevision: current.draftRevision };
      }
      if (!['SUBMITTED', 'NEEDS_ATTENTION'].includes(current.status)) {
        return { status: 'NOT_SUBMITTED' as const, draftStatus: current.status };
      }
      const unique = {
        marketplace: 'AMAZON',
        marketplaceId: input.marketplaceId,
        sellerId: input.sellerId,
        sellerSku: current.sellerSku!,
      };
      const existing = await transaction.marketplaceListing.findUnique({
        where: { marketplace_marketplaceId_sellerId_sellerSku: unique },
      });
      if (!existing) return { status: 'NOT_FOUND' as const };
      const isLive = input.state === 'LIVE';
      const listing = await transaction.marketplaceListing.update({
        where: { id: existing.id },
        data: {
          asin: input.listing.asin ?? existing.asin,
          title: input.listing.title ?? existing.title,
          productType: input.listing.productType ?? existing.productType,
          listingStatus: input.listing.listingStatus,
          originalFulfilmentValue: input.listing.originalFulfilmentValue,
          fulfilmentChannel: input.listing.fulfilmentChannel,
          publishedQuantity: input.listing.publishedQuantity,
          price: input.listing.price === null ? existing.price : new Prisma.Decimal(input.listing.price),
          currency: input.listing.currency ?? existing.currency,
          amazonLastUpdatedAt: input.listing.amazonLastUpdatedAt,
          mappingStatus: isLive ? 'MAPPED' : existing.mappingStatus === 'MAPPED' ? 'MAPPED' : 'PENDING',
          mappedAt: isLive ? existing.mappedAt ?? new Date() : existing.mappedAt,
          lastImportedAt: new Date(),
        },
      });
      const draftStatus = isLive ? 'LIVE' : input.state === 'NEEDS_ATTENTION' ? 'NEEDS_ATTENTION' : 'SUBMITTED';
      const updated = await transaction.amazonListingPublishDraft.update({
        where: { id: current.id },
        data: {
          status: draftStatus,
          lastSubmissionStatus: input.state,
          asin: input.listing.asin ?? current.asin,
          candidateResults: input.candidateResults,
          draftRevision: { increment: 1 },
          ...(isLive ? { activeDraftKey: null } : {}),
        },
      });
      await transaction.marketplaceListingAudit.create({
        data: {
          listingId: listing.id,
          ...unique,
          environment: 'PRODUCTION',
          operation: isLive ? 'PUBLISH_RECONCILED_LIVE' : 'PUBLISH_RECONCILED_STATUS',
          changedFields: ['listingStatus', 'asin', 'mappingStatus'],
          beforeValues: {
            listingStatus: existing.listingStatus,
            asin: existing.asin,
            mappingStatus: existing.mappingStatus,
          },
          afterValues: {
            listingStatus: listing.listingStatus,
            asin: listing.asin,
            mappingStatus: listing.mappingStatus,
            state: input.state,
            issues: input.issues,
          },
          previousProductId: existing.productId,
          productId: listing.productId,
          ...actorData(input),
        },
      });
      await transaction.amazonListingPublishAudit.create({
        data: {
          draftId: updated.id,
          productId: updated.productId,
          sellerId: updated.sellerId,
          marketplaceId: updated.marketplaceId,
          sellerSku: updated.sellerSku,
          asin: updated.asin,
          operation: 'AMAZON_SUBMISSION_RECONCILED',
          beforeValues: { status: current.status, draftRevision: current.draftRevision },
          afterValues: {
            status: updated.status,
            draftRevision: updated.draftRevision,
            amazonListingStatus: listing.listingStatus,
            state: input.state,
          },
          metadata: { issues: input.issues },
          ...actorData(input),
        },
      });
      const draft = await transaction.amazonListingPublishDraft.findUniqueOrThrow({
        where: { id: current.id },
        include: {
          images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          attempts: { orderBy: { createdAt: 'desc' }, take: 10 },
          audits: { orderBy: { createdAt: 'desc' }, take: 50 },
        },
      });
      return { status: 'RECORDED' as const, draft, listingId: String(listing.id) };
    });
  }

  async recordAcceptedSubmission(input: AmazonPublishScope & AmazonPublishActor & {
    draftId: string;
    draftRevision: number;
    attemptId: string;
    payloadHash: string;
    amazonSubmissionId: string;
    responsePayload: Prisma.InputJsonValue;
    issues: Prisma.InputJsonValue;
    candidateResults: Prisma.InputJsonValue;
  }): Promise<RecordAcceptedAmazonPublishResult> {
    return prisma.$transaction(async (transaction) => {
      const current = await transaction.amazonListingPublishDraft.findFirst({
        where: {
          id: BigInt(input.draftId),
          sellerId: input.sellerId,
          marketplaceId: input.marketplaceId,
        },
      });
      if (!current) return { status: 'NOT_FOUND' as const };
      if (current.draftRevision !== input.draftRevision) {
        return { status: 'REVISION_CONFLICT' as const, currentRevision: current.draftRevision };
      }
      if (current.status !== 'AMAZON_VALIDATED' || current.validatedPayloadHash !== input.payloadHash) {
        return { status: 'NOT_READY' as const, draftStatus: current.status };
      }

      const attributes = current.mappedAttributes as Record<string, any>;
      const title = attributes.item_name?.[0]?.value;
      const quantity = attributes.fulfillment_availability?.[0]?.quantity;
      const price = attributes.purchasable_offer?.[0]?.our_price?.[0]?.schedule?.[0]?.value_with_tax;
      const unique = {
        marketplace: 'AMAZON',
        marketplaceId: input.marketplaceId,
        sellerId: input.sellerId,
        sellerSku: current.sellerSku!,
      };
      const existingListing = await transaction.marketplaceListing.findUnique({
        where: { marketplace_marketplaceId_sellerId_sellerSku: unique },
      });
      const listing = await transaction.marketplaceListing.upsert({
        where: { marketplace_marketplaceId_sellerId_sellerSku: unique },
        create: {
          ...unique,
          environment: 'PRODUCTION',
          asin: current.asin,
          title: typeof title === 'string' ? title : null,
          productType: current.productType,
          listingStatus: 'SUBMISSION_ACCEPTED',
          fulfilmentChannel: current.fulfilmentChannel,
          publishedQuantity: typeof quantity === 'number' ? Math.max(0, Math.trunc(quantity)) : null,
          price: typeof price === 'number' || typeof price === 'string' ? new Prisma.Decimal(price) : null,
          currency: attributes.purchasable_offer?.[0]?.currency ?? 'INR',
          productId: current.productId,
          mappingStatus: 'PENDING',
          lastImportedAt: new Date(),
        },
        update: {
          asin: current.asin ?? existingListing?.asin ?? null,
          title: typeof title === 'string' ? title : existingListing?.title ?? null,
          productType: current.productType ?? existingListing?.productType ?? null,
          listingStatus: 'SUBMISSION_ACCEPTED',
          publishedQuantity: typeof quantity === 'number'
            ? Math.max(0, Math.trunc(quantity))
            : existingListing?.publishedQuantity ?? null,
          price: typeof price === 'number' || typeof price === 'string'
            ? new Prisma.Decimal(price)
            : existingListing?.price ?? null,
          currency: attributes.purchasable_offer?.[0]?.currency ?? existingListing?.currency ?? 'INR',
          productId: current.productId,
          mappingStatus: existingListing?.mappingStatus === 'MAPPED' ? 'MAPPED' : 'PENDING',
        },
      });

      await transaction.amazonListingPublishAttempt.update({
        where: { id: BigInt(input.attemptId) },
        data: {
          status: 'SUCCEEDED',
          responsePayload: input.responsePayload,
          amazonSubmissionId: input.amazonSubmissionId,
          amazonStatus: 'ACCEPTED',
          issues: input.issues,
          httpStatus: 200,
          finishedAt: new Date(),
        },
      });
      const updated = await transaction.amazonListingPublishDraft.update({
        where: { id: current.id },
        data: {
          status: 'SUBMITTED',
          lastSubmissionStatus: 'ACCEPTED',
          candidateResults: input.candidateResults,
          draftRevision: { increment: 1 },
          approvedByUserId: input.requestedByUserId ?? null,
          approvedByUserType: input.requestedByUserType ?? null,
        },
      });
      await transaction.marketplaceListingAudit.create({
        data: {
          listingId: listing.id,
          ...unique,
          environment: 'PRODUCTION',
          operation: 'PUBLISH_SUBMISSION_ACCEPTED',
          changedFields: ['listingStatus', 'productId', 'mappingStatus'],
          beforeValues: existingListing ? {
            listingStatus: existingListing.listingStatus,
            productId: existingListing.productId === null ? null : String(existingListing.productId),
            mappingStatus: existingListing.mappingStatus,
          } : Prisma.JsonNull,
          afterValues: {
            listingStatus: listing.listingStatus,
            productId: String(current.productId),
            mappingStatus: listing.mappingStatus,
            amazonSubmissionId: input.amazonSubmissionId,
          },
          previousProductId: existingListing?.productId ?? null,
          productId: current.productId,
          ...actorData(input),
        },
      });
      await transaction.amazonListingPublishAudit.create({
        data: {
          draftId: updated.id,
          productId: updated.productId,
          sellerId: updated.sellerId,
          marketplaceId: updated.marketplaceId,
          sellerSku: updated.sellerSku,
          asin: updated.asin,
          operation: 'AMAZON_LISTING_SUBMITTED',
          beforeValues: { status: current.status, draftRevision: current.draftRevision },
          afterValues: {
            status: updated.status,
            draftRevision: updated.draftRevision,
            amazonSubmissionId: input.amazonSubmissionId,
            marketplaceListingId: String(listing.id),
          },
          ...actorData(input),
        },
      });
      const draft = await transaction.amazonListingPublishDraft.findUniqueOrThrow({
        where: { id: current.id },
        include: {
          images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          attempts: { orderBy: { createdAt: 'desc' }, take: 10 },
          audits: { orderBy: { createdAt: 'desc' }, take: 50 },
        },
      });
      return { status: 'RECORDED' as const, draft, listingId: String(listing.id) };
    });
  }

  async getValidationAttempt(requestKey: string) {
    return prisma.amazonListingPublishAttempt.findUnique({ where: { requestKey } });
  }

  async createValidationAttempt(input: {
    draftId: string;
    operation: string;
    requestKey: string;
    draftRevision: number;
    payloadHash: string;
    requestPayload: Prisma.InputJsonValue;
    actor: AmazonPublishActor;
  }) {
    return prisma.amazonListingPublishAttempt.upsert({
      where: { requestKey: input.requestKey },
      update: {},
      create: {
        draftId: BigInt(input.draftId),
        operation: input.operation,
        status: 'STARTED',
        requestKey: input.requestKey,
        draftRevision: input.draftRevision,
        payloadHash: input.payloadHash,
        requestPayload: input.requestPayload,
        issues: [],
        ...actorData(input.actor),
      },
    });
  }

  async finishValidationAttempt(input: {
    attemptId: string;
    status: string;
    responsePayload?: Prisma.InputJsonValue;
    amazonSubmissionId?: string | null;
    amazonStatus?: string | null;
    issues: Prisma.InputJsonValue;
    httpStatus?: number | null;
    errorCode?: string | null;
    errorMessage?: string | null;
  }) {
    return prisma.amazonListingPublishAttempt.update({
      where: { id: BigInt(input.attemptId) },
      data: {
        status: input.status,
        ...(input.responsePayload !== undefined ? { responsePayload: input.responsePayload } : {}),
        amazonSubmissionId: input.amazonSubmissionId ?? null,
        amazonStatus: input.amazonStatus ?? null,
        issues: input.issues,
        httpStatus: input.httpStatus ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        finishedAt: new Date(),
      },
    });
  }
  async getMappedListing(productId: string, scope: AmazonPublishScope) {
    return prisma.marketplaceListing.findFirst({
      where: {
        productId: BigInt(productId),
        marketplace: 'AMAZON',
        environment: 'PRODUCTION',
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        mappingStatus: 'MAPPED',
      },
      orderBy: [{ mappedAt: 'desc' }, { updatedAt: 'desc' }],
      select: {
        id: true,
        sellerSku: true,
        asin: true,
        title: true,
        productType: true,
        listingStatus: true,
        fulfilmentChannel: true,
        publishedQuantity: true,
        price: true,
        currency: true,
        amazonLastUpdatedAt: true,
        mappedAt: true,
      },
    });
  }

  async getProductTypeSchema(cacheKey: string) {
    return prisma.amazonProductTypeSchemaCache.findFirst({
      where: { cacheKey, expiresAt: { gt: new Date() } },
    });
  }

  async upsertProductTypeSchema(input: {
    cacheKey: string;
    sellerId: string;
    marketplaceId: string;
    productType: string;
    requirements: string;
    productTypeVersion: string;
    resolvedVersion: string | null;
    schemaChecksum: string;
    definitionSchema: Prisma.InputJsonValue;
    propertyGroups?: Prisma.InputJsonValue;
    expiresAt: Date;
  }) {
    return prisma.amazonProductTypeSchemaCache.upsert({
      where: { cacheKey: input.cacheKey },
      create: input,
      update: {
        resolvedVersion: input.resolvedVersion,
        schemaChecksum: input.schemaChecksum,
        definitionSchema: input.definitionSchema,
        ...(input.propertyGroups ? { propertyGroups: input.propertyGroups } : {}),
        fetchedAt: new Date(),
        expiresAt: input.expiresAt,
      },
    });
  }

  async getProduct(productId: string): Promise<AmazonPublishProduct | null> {
    return prisma.product.findUnique({
      where: { id: BigInt(productId) },
      select: {
        id: true,
        name: true,
        puc: true,
        shortdescription: true,
        fulldescription: true,
        category: true,
        subcategory: true,
        subsubcategory: true,
        fragnancetype: true,
        large: true,
        medium: true,
        small: true,
        brand: true,
        pack: true,
        price: true,
        availablequantity: true,
        productstatus: true,
        material: true,
        manufacturer: true,
        netform: true,
        netquantity: true,
        numberofitems: true,
        itemlength: true,
        itemthickness: true,
        modifieddate: true,
      },
    });
  }

  async getActiveDraft(activeDraftKey: string) {
    return prisma.amazonListingPublishDraft.findUnique({
      where: { activeDraftKey },
      include: {
        images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        attempts: { orderBy: { createdAt: 'desc' }, take: 10 },
        audits: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
  }

  async listDrafts(scope: AmazonPublishScope) {
    return prisma.amazonListingPublishDraft.findMany({
      where: {
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        status: { not: 'CANCELLED' },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 500,
      include: {
        product: {
          select: { id: true, puc: true, name: true },
        },
        images: {
          where: { status: 'ACTIVE' },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          take: 1,
        },
      },
    });
  }

  async listPublishedProducts(scope: AmazonPublishScope) {
    return prisma.marketplaceListing.findMany({
      where: {
        marketplace: 'AMAZON',
        environment: 'PRODUCTION',
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        mappingStatus: 'MAPPED',
        productId: { not: null },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        productId: true,
        sellerSku: true,
        asin: true,
        title: true,
        listingStatus: true,
        updatedAt: true,
      },
    });
  }

  async createDraft(input: CreateAmazonPublishDraftInput) {
    return prisma.$transaction(async (transaction) => {
      const draft = await transaction.amazonListingPublishDraft.create({
        data: {
          productId: BigInt(input.productId),
          activeDraftKey: input.activeDraftKey,
          sellerId: input.sellerId,
          marketplaceId: input.marketplaceId,
          listingMode: input.listingMode,
          sellerSku: input.sellerSku,
          ...(input.asin ? { asin: input.asin } : {}),
          ...(input.productType ? { productType: input.productType } : {}),
          ...(input.requirements ? { requirements: input.requirements } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.fulfilmentChannel ? { fulfilmentChannel: input.fulfilmentChannel } : {}),
          sourceProductModifiedAt: input.sourceProductModifiedAt,
          sourceSnapshot: input.sourceSnapshot,
          candidateResults: input.candidateResults ?? { catalog: [], productTypes: [] },
          mappedAttributes: input.mappedAttributes,
          ...createdByData(input.actor),
        },
      });
      await transaction.amazonListingPublishAudit.create({
        data: {
          draftId: draft.id,
          productId: draft.productId,
          sellerId: draft.sellerId,
          marketplaceId: draft.marketplaceId,
          sellerSku: draft.sellerSku,
          operation: 'PUBLISH_DRAFT_CREATED',
          afterValues: {
            status: draft.status,
            listingMode: draft.listingMode,
            draftRevision: draft.draftRevision,
          },
          metadata: { source: 'NIVAANA_PRODUCT' },
          ...actorData(input.actor),
        },
      });
      return transaction.amazonListingPublishDraft.findUniqueOrThrow({
        where: { id: draft.id },
        include: {
          images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          attempts: { orderBy: { createdAt: 'desc' }, take: 10 },
          audits: { orderBy: { createdAt: 'desc' }, take: 50 },
        },
      });
    });
  }

  async getDraft(draftId: string, scope: AmazonPublishScope) {
    return prisma.amazonListingPublishDraft.findFirst({
      where: {
        id: BigInt(draftId),
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
      },
      include: {
        images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
        attempts: { orderBy: { createdAt: 'desc' }, take: 10 },
        audits: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
  }

  async ensureDraftImages(draftId: string, urls: string[], actor: AmazonPublishActor) {
    const uniqueUrls = [...new Set(urls.map((url) => url.trim()).filter(Boolean))].slice(0, 9);
    if (uniqueUrls.length === 0) return null;
    return prisma.$transaction(async (transaction) => {
      const existingCount = await transaction.amazonListingPublishImage.count({
        where: { draftId: BigInt(draftId) },
      });
      if (existingCount > 0) return null;
      await transaction.amazonListingPublishImage.createMany({
        data: uniqueUrls.map((url, sortOrder) => ({
          draftId: BigInt(draftId),
          sourceType: 'NIVAANA_COPY',
          sourceProductUrl: url,
          url,
          sortOrder,
          status: 'ACTIVE',
          accessibilityStatus: 'PENDING',
          validationErrors: [],
          ...(actor.requestedByUserId !== undefined ? { createdByUserId: actor.requestedByUserId } : {}),
          ...(actor.requestedByUserType ? { createdByUserType: actor.requestedByUserType } : {}),
        })),
      });
      return transaction.amazonListingPublishDraft.findUnique({
        where: { id: BigInt(draftId) },
        include: {
          images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          attempts: { orderBy: { createdAt: 'desc' }, take: 10 },
          audits: { orderBy: { createdAt: 'desc' }, take: 50 },
        },
      });
    });
  }

  async findSellerSkuConflict(draftId: string, sellerSku: string, scope: AmazonPublishScope) {
    const current = await prisma.amazonListingPublishDraft.findFirst({
      where: { id: BigInt(draftId), ...scope },
      select: { productId: true },
    });
    if (!current) return null;
    const competingDraft = await prisma.amazonListingPublishDraft.findFirst({
      where: {
        id: { not: BigInt(draftId) },
        ...scope,
        sellerSku,
        status: { not: 'CANCELLED' },
      },
      select: { id: true, productId: true },
    });
    if (competingDraft) {
      return { type: 'DRAFT' as const, id: String(competingDraft.id), productId: String(competingDraft.productId) };
    }
    const competingListing = await prisma.marketplaceListing.findFirst({
      where: {
        marketplace: 'AMAZON',
        environment: 'PRODUCTION',
        ...scope,
        sellerSku,
        OR: [{ productId: null }, { productId: { not: current.productId } }],
      },
      select: { id: true, productId: true },
    });
    return competingListing
      ? {
          type: 'LISTING' as const,
          id: String(competingListing.id),
          productId: competingListing.productId === null ? 'UNMAPPED' : String(competingListing.productId),
        }
      : null;
  }

  async updateDraft(input: UpdateAmazonPublishDraftInput): Promise<UpdateAmazonPublishDraftResult> {
    return prisma.$transaction(async (transaction) => {
      const current = await transaction.amazonListingPublishDraft.findFirst({
        where: { id: BigInt(input.draftId), sellerId: input.sellerId, marketplaceId: input.marketplaceId },
      });
      if (!current) return { status: 'NOT_FOUND' as const };
      if (current.draftRevision !== input.draftRevision) {
        return { status: 'REVISION_CONFLICT' as const, currentRevision: current.draftRevision };
      }
      if (['SUBMITTED', 'ACCEPTED', 'NEEDS_ATTENTION', 'LIVE', 'CANCELLED'].includes(current.status)) {
        return { status: 'NOT_EDITABLE' as const, draftStatus: current.status };
      }
      const result = await transaction.amazonListingPublishDraft.updateMany({
        where: { id: current.id, draftRevision: input.draftRevision },
        data: {
          ...(input.listingMode !== undefined ? { listingMode: input.listingMode } : {}),
          ...(input.sellerSku !== undefined ? { sellerSku: input.sellerSku } : {}),
          ...(input.mappedAttributes !== undefined ? { mappedAttributes: input.mappedAttributes } : {}),
          draftRevision: { increment: 1 },
          lastValidationStatus: null,
          validatedPayloadHash: null,
        },
      });
      if (result.count !== 1) {
        const latest = await transaction.amazonListingPublishDraft.findUniqueOrThrow({ where: { id: current.id } });
        return { status: 'REVISION_CONFLICT' as const, currentRevision: latest.draftRevision };
      }
      const updated = await transaction.amazonListingPublishDraft.findUniqueOrThrow({ where: { id: current.id } });
      await transaction.amazonListingPublishAudit.create({
        data: {
          draftId: updated.id, productId: updated.productId, sellerId: updated.sellerId,
          marketplaceId: updated.marketplaceId, sellerSku: updated.sellerSku, asin: updated.asin,
          operation: 'PUBLISH_DRAFT_UPDATED',
          beforeValues: { listingMode: current.listingMode, sellerSku: current.sellerSku, draftRevision: current.draftRevision },
          afterValues: { listingMode: updated.listingMode, sellerSku: updated.sellerSku, draftRevision: updated.draftRevision },
          metadata: { changedFields: [
            ...(input.listingMode !== undefined ? ['listingMode'] : []),
            ...(input.sellerSku !== undefined ? ['sellerSku'] : []),
            ...(input.mappedAttributes !== undefined ? ['mappedAttributes'] : []),
          ] },
          ...actorData(input),
        },
      });
      const draft = await transaction.amazonListingPublishDraft.findUniqueOrThrow({
        where: { id: current.id },
        include: {
          images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          attempts: { orderBy: { createdAt: 'desc' }, take: 10 },
          audits: { orderBy: { createdAt: 'desc' }, take: 50 },
        },
      });
      return { status: 'UPDATED' as const, draft };
    });
  }

  async transitionDraft(input: TransitionAmazonPublishDraftInput): Promise<UpdateAmazonPublishDraftResult> {
    return prisma.$transaction(async (transaction) => {
      const current = await transaction.amazonListingPublishDraft.findFirst({
        where: { id: BigInt(input.draftId), sellerId: input.sellerId, marketplaceId: input.marketplaceId },
      });
      if (!current) return { status: 'NOT_FOUND' as const };
      if (current.draftRevision !== input.draftRevision) {
        return { status: 'REVISION_CONFLICT' as const, currentRevision: current.draftRevision };
      }
      if (['SUBMITTED', 'ACCEPTED', 'NEEDS_ATTENTION', 'LIVE', 'CANCELLED'].includes(current.status)) {
        return { status: 'NOT_EDITABLE' as const, draftStatus: current.status };
      }
      const changed = await transaction.amazonListingPublishDraft.updateMany({
        where: { id: current.id, draftRevision: input.draftRevision },
        data: {
          ...input.data,
          draftRevision: { increment: 1 },
          ...(input.data.lastValidationStatus === undefined ? { lastValidationStatus: null } : {}),
          ...(input.data.validatedPayloadHash === undefined ? { validatedPayloadHash: null } : {}),
        },
      });
      if (changed.count !== 1) {
        const latest = await transaction.amazonListingPublishDraft.findUniqueOrThrow({ where: { id: current.id } });
        return { status: 'REVISION_CONFLICT' as const, currentRevision: latest.draftRevision };
      }
      const updated = await transaction.amazonListingPublishDraft.findUniqueOrThrow({ where: { id: current.id } });
      await transaction.amazonListingPublishAudit.create({
        data: {
          draftId: updated.id,
          productId: updated.productId,
          sellerId: updated.sellerId,
          marketplaceId: updated.marketplaceId,
          sellerSku: updated.sellerSku,
          asin: updated.asin,
          operation: input.operation,
          beforeValues: {
            status: current.status,
            listingMode: current.listingMode,
            sellerSku: current.sellerSku,
            asin: current.asin,
            productType: current.productType,
            draftRevision: current.draftRevision,
          },
          afterValues: {
            status: updated.status,
            listingMode: updated.listingMode,
            sellerSku: updated.sellerSku,
            asin: updated.asin,
            productType: updated.productType,
            draftRevision: updated.draftRevision,
          },
          ...(input.metadata ? { metadata: input.metadata } : {}),
          ...actorData(input),
        },
      });
      const draft = await transaction.amazonListingPublishDraft.findUniqueOrThrow({
        where: { id: current.id },
        include: {
          images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          attempts: { orderBy: { createdAt: 'desc' }, take: 10 },
          audits: { orderBy: { createdAt: 'desc' }, take: 50 },
        },
      });
      return { status: 'UPDATED' as const, draft };
    });
  }

  async cancelDraft(input: CancelAmazonPublishDraftInput): Promise<CancelAmazonPublishDraftResult> {
    return prisma.$transaction(async (transaction) => {
      const current = await transaction.amazonListingPublishDraft.findFirst({
        where: {
          id: BigInt(input.draftId),
          sellerId: input.sellerId,
          marketplaceId: input.marketplaceId,
        },
      });
      if (!current) return { status: 'NOT_FOUND' as const };
      if (current.draftRevision !== input.draftRevision) {
        return { status: 'REVISION_CONFLICT' as const, currentRevision: current.draftRevision };
      }
      if (['SUBMITTED', 'ACCEPTED', 'NEEDS_ATTENTION', 'LIVE', 'CANCELLED'].includes(current.status)) {
        return { status: 'NOT_CANCELLABLE' as const, draftStatus: current.status };
      }

      const updated = await transaction.amazonListingPublishDraft.updateMany({
        where: {
          id: current.id,
          draftRevision: input.draftRevision,
          sellerId: input.sellerId,
          marketplaceId: input.marketplaceId,
        },
        data: {
          status: 'CANCELLED',
          activeDraftKey: null,
          draftRevision: { increment: 1 },
          cancelledAt: new Date(),
          ...(input.requestedByUserId !== undefined ? { cancelledByUserId: input.requestedByUserId } : {}),
          ...(input.requestedByUserType !== undefined ? { cancelledByUserType: input.requestedByUserType } : {}),
        },
      });
      if (updated.count !== 1) {
        const latest = await transaction.amazonListingPublishDraft.findUniqueOrThrow({ where: { id: current.id } });
        return { status: 'REVISION_CONFLICT' as const, currentRevision: latest.draftRevision };
      }

      await transaction.amazonListingPublishAudit.create({
        data: {
          draftId: current.id,
          productId: current.productId,
          sellerId: current.sellerId,
          marketplaceId: current.marketplaceId,
          sellerSku: current.sellerSku,
          asin: current.asin,
          operation: 'PUBLISH_DRAFT_CANCELLED',
          beforeValues: { status: current.status, draftRevision: current.draftRevision },
          afterValues: { status: 'CANCELLED', draftRevision: current.draftRevision + 1 },
          ...(input.reason ? { metadata: { reason: input.reason } } : {}),
          ...actorData(input),
        },
      });
      const draft = await transaction.amazonListingPublishDraft.findUniqueOrThrow({
        where: { id: current.id },
        include: {
          images: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
          attempts: { orderBy: { createdAt: 'desc' }, take: 10 },
          audits: { orderBy: { createdAt: 'desc' }, take: 50 },
        },
      });
      return { status: 'CANCELLED' as const, draft };
    });
  }
}

export const amazonListingPublishRepository = new PrismaAmazonListingPublishRepository();
