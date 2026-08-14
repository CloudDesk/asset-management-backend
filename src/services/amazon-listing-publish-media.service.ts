import axios from 'axios';
import FormData from 'form-data';
import Jimp from 'jimp';
import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../models/prisma.js';
import type {
  AmazonPublishActor,
  AmazonPublishScope,
} from '../repositories/amazon-listing-publish.repository.js';

const MAX_IMAGES = 9;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIN_IMAGE_EDGE = 500;
const MAX_IMAGE_EDGE = 10_000;
const EDITABLE_STATUSES = new Set([
  'DRAFT', 'MAPPED_OFFER_READY', 'CATALOG_SEARCHED', 'ASIN_SELECTED',
  'CATALOG_REVIEW_REQUIRED', 'NO_ASIN_MATCH', 'PRODUCT_TYPE_REVIEW_REQUIRED',
  'FULL_CATALOG_REQUIRED', 'PRODUCT_TYPE_SELECTED', 'ATTRIBUTES_REQUIRED', 'ATTRIBUTES_READY',
  'ELIGIBILITY_CHECKED', 'ELIGIBILITY_CONFIRMED', 'RESTRICTION_BLOCKED',
  'LOCAL_VALIDATED', 'VALIDATION_FAILED', 'AMAZON_VALIDATED',
]);

export const isAmazonDraftMediaEditableStatus = (status: string) => EDITABLE_STATUSES.has(status);

export const amazonPublishMediaScopeWhere = (scope: AmazonPublishScope) => ({
  sellerId: scope.sellerId,
  marketplaceId: scope.marketplaceId,
});

type UploadedImage = {
  buffer: Buffer;
  filename: string;
  mimetype: string;
};

export class AmazonListingPublishMediaError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    cause?: unknown
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'AmazonListingPublishMediaError';
  }
}

const imageFormat = (buffer: Buffer) => {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  return null;
};

const serializeImage = (image: any) => ({
  ...image,
  id: String(image.id),
  draftId: String(image.draftId),
  accessibilityCheckedAt: image.accessibilityCheckedAt?.toISOString() ?? null,
  createdAt: image.createdAt?.toISOString() ?? null,
  updatedAt: image.updatedAt?.toISOString() ?? null,
});

const imageAttributes = (
  mappedAttributes: unknown,
  images: Array<{ url: string }>,
  marketplaceId: string
) => {
  const attributes = {
    ...((mappedAttributes && typeof mappedAttributes === 'object' && !Array.isArray(mappedAttributes))
      ? mappedAttributes as Record<string, unknown>
      : {}),
  };
  delete attributes.main_product_image_locator;
  delete attributes.other_product_image_locator;
  for (let index = 1; index <= MAX_IMAGES - 1; index += 1) {
    delete attributes[`other_product_image_locator_${index}`];
  }
  if (images[0]) {
    attributes.main_product_image_locator = [{
      media_location: images[0].url,
      marketplace_id: marketplaceId,
    }];
  }
  images.slice(1, MAX_IMAGES).forEach((image, index) => {
    attributes[`other_product_image_locator_${index + 1}`] = [{
      media_location: image.url,
      marketplace_id: marketplaceId,
    }];
  });
  return attributes as Prisma.InputJsonValue;
};

const draftInclude = {
  images: { orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }] },
  attempts: { orderBy: { createdAt: 'desc' as const }, take: 10 },
  audits: { orderBy: { createdAt: 'desc' as const }, take: 50 },
};

export class AmazonListingPublishMediaService {
  async ensureCopiedImages(
    draftId: string,
    urls: string[],
    actor: AmazonPublishActor
  ) {
    const uniqueUrls = [...new Set(urls.map((url) => url.trim()).filter(Boolean))].slice(0, MAX_IMAGES);
    if (uniqueUrls.length === 0) return null;
    return prisma.$transaction(async (transaction) => {
      const existingCount = await transaction.amazonListingPublishImage.count({
        where: { draftId: BigInt(draftId) },
      });
      if (existingCount > 0) return null;
      await transaction.amazonListingPublishImage.createMany({
        data: uniqueUrls.map((url, index) => ({
          draftId: BigInt(draftId),
          sourceType: 'NIVAANA_COPY',
          sourceProductUrl: url,
          url,
          sortOrder: index,
          status: 'ACTIVE',
          accessibilityStatus: 'PENDING',
          validationErrors: [],
          ...(actor.requestedByUserId !== undefined ? { createdByUserId: actor.requestedByUserId } : {}),
          ...(actor.requestedByUserType ? { createdByUserType: actor.requestedByUserType } : {}),
        })),
      });
      return transaction.amazonListingPublishDraft.findUnique({
        where: { id: BigInt(draftId) },
        include: draftInclude,
      });
    });
  }

  async upload(
    draftId: string,
    draftRevision: number,
    scope: AmazonPublishScope,
    actor: AmazonPublishActor,
    file: UploadedImage
  ) {
    const draftBeforeUpload = await prisma.amazonListingPublishDraft.findFirst({
      where: { id: BigInt(draftId), ...amazonPublishMediaScopeWhere(scope) },
    });
    this.assertEditable(draftBeforeUpload, draftRevision);
    const activeImageCount = await prisma.amazonListingPublishImage.count({
      where: { draftId: draftBeforeUpload.id, status: 'ACTIVE' },
    });
    if (activeImageCount >= MAX_IMAGES) {
      throw new AmazonListingPublishMediaError(
        `Amazon drafts support up to ${MAX_IMAGES} images`,
        409,
        'AMAZON_DRAFT_IMAGE_LIMIT_REACHED'
      );
    }

    const metadata = await this.validateUpload(file);
    const uploaded = await this.uploadToStorage(draftId, file);
    await this.assertPubliclyAccessible(uploaded.url);

    try {
      const saved = await prisma.$transaction(async (transaction) => {
        const draft = await transaction.amazonListingPublishDraft.findFirst({
          where: { id: BigInt(draftId), ...amazonPublishMediaScopeWhere(scope) },
        });
        this.assertEditable(draft, draftRevision);
        const activeImages = await transaction.amazonListingPublishImage.findMany({
          where: { draftId: draft!.id, status: 'ACTIVE' },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        });
        if (activeImages.length >= MAX_IMAGES) {
          throw new AmazonListingPublishMediaError(
            `Amazon drafts support up to ${MAX_IMAGES} images`,
            409,
            'AMAZON_DRAFT_IMAGE_LIMIT_REACHED'
          );
        }
        await transaction.amazonListingPublishImage.create({
          data: {
            draftId: draft!.id,
            sourceType: 'UPLOAD',
            url: uploaded.url,
            originalFileName: file.filename,
            contentType: metadata.contentType,
            sizeBytes: file.buffer.length,
            width: metadata.width,
            height: metadata.height,
            sortOrder: activeImages.length,
            status: 'ACTIVE',
            accessibilityStatus: 'VERIFIED',
            accessibilityCheckedAt: new Date(),
            validationErrors: [],
            ...(actor.requestedByUserId !== undefined ? { createdByUserId: actor.requestedByUserId } : {}),
            ...(actor.requestedByUserType ? { createdByUserType: actor.requestedByUserType } : {}),
          },
        });
        return this.finishMutation(transaction, draft!, scope, actor, 'AMAZON_DRAFT_IMAGE_UPLOADED', {
          filename: file.filename,
          width: metadata.width,
          height: metadata.height,
        });
      });
      return this.serializeResult(saved);
    } catch (error) {
      if (error instanceof AmazonListingPublishMediaError) throw error;
      throw new AmazonListingPublishMediaError(
        env.NODE_ENV === 'development' && error instanceof Error
          ? `The image was uploaded, but saving it to the Amazon draft failed: ${error.message}`
          : 'The image was uploaded, but saving it to the Amazon draft failed',
        500,
        'AMAZON_DRAFT_IMAGE_PERSISTENCE_FAILED',
        error
      );
    }
  }

  async detach(
    draftId: string,
    imageId: string,
    draftRevision: number,
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    return this.changeImageStatus(draftId, imageId, draftRevision, scope, actor, 'REMOVED');
  }

  async restore(
    draftId: string,
    imageId: string,
    draftRevision: number,
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    return this.changeImageStatus(draftId, imageId, draftRevision, scope, actor, 'ACTIVE');
  }

  async reorder(
    draftId: string,
    draftRevision: number,
    imageIds: string[],
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    return prisma.$transaction(async (transaction) => {
      const draft = await transaction.amazonListingPublishDraft.findFirst({
        where: { id: BigInt(draftId), ...amazonPublishMediaScopeWhere(scope) },
      });
      this.assertEditable(draft, draftRevision);
      const active = await transaction.amazonListingPublishImage.findMany({
        where: { draftId: draft!.id, status: 'ACTIVE' },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      });
      const currentIds = active.map((image) => String(image.id)).sort();
      const requestedIds = [...new Set(imageIds)].sort();
      if (
        currentIds.length !== requestedIds.length
        || currentIds.some((id, index) => id !== requestedIds[index])
      ) {
        throw new AmazonListingPublishMediaError(
          'Image order must contain every active Amazon draft image exactly once',
          400,
          'AMAZON_DRAFT_IMAGE_ORDER_INVALID'
        );
      }
      for (const [sortOrder, id] of imageIds.entries()) {
        await transaction.amazonListingPublishImage.update({
          where: { id: BigInt(id) },
          data: { sortOrder },
        });
      }
      return this.finishMutation(transaction, draft!, scope, actor, 'AMAZON_DRAFT_IMAGES_REORDERED', {
        imageIds,
      });
    }).then((draft) => this.serializeResult(draft));
  }

  async verify(
    draftId: string,
    draftRevision: number,
    scope: AmazonPublishScope,
    actor: AmazonPublishActor
  ) {
    const draft = await prisma.amazonListingPublishDraft.findFirst({
      where: { id: BigInt(draftId), ...amazonPublishMediaScopeWhere(scope) },
      include: { images: { where: { status: 'ACTIVE' }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
    });
    this.assertEditable(draft, draftRevision);
    const results = await Promise.all(draft!.images.map(async (image) => {
      try {
        await this.assertPubliclyAccessible(image.url);
        return { id: image.id, status: 'VERIFIED', error: null };
      } catch (error) {
        return {
          id: image.id,
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Image URL is not publicly accessible',
        };
      }
    }));
    return prisma.$transaction(async (transaction) => {
      const latest = await transaction.amazonListingPublishDraft.findFirst({
        where: { id: BigInt(draftId), ...amazonPublishMediaScopeWhere(scope) },
      });
      this.assertEditable(latest, draftRevision);
      for (const result of results) {
        await transaction.amazonListingPublishImage.update({
          where: { id: result.id },
          data: {
            accessibilityStatus: result.status,
            accessibilityError: result.error,
            accessibilityCheckedAt: new Date(),
            validationErrors: result.error ? [result.error] : [],
          },
        });
      }
      return this.finishMutation(transaction, latest!, scope, actor, 'AMAZON_DRAFT_IMAGES_VERIFIED', {
        verified: results.filter((result) => result.status === 'VERIFIED').length,
        failed: results.filter((result) => result.status === 'FAILED').length,
      });
    }).then((updated) => this.serializeResult(updated));
  }

  private async changeImageStatus(
    draftId: string,
    imageId: string,
    draftRevision: number,
    scope: AmazonPublishScope,
    actor: AmazonPublishActor,
    status: 'ACTIVE' | 'REMOVED'
  ) {
    return prisma.$transaction(async (transaction) => {
      const draft = await transaction.amazonListingPublishDraft.findFirst({
        where: { id: BigInt(draftId), ...amazonPublishMediaScopeWhere(scope) },
      });
      this.assertEditable(draft, draftRevision);
      const image = await transaction.amazonListingPublishImage.findFirst({
        where: { id: BigInt(imageId), draftId: draft!.id },
      });
      if (!image) {
        throw new AmazonListingPublishMediaError('Amazon draft image not found', 404, 'AMAZON_DRAFT_IMAGE_NOT_FOUND');
      }
      if (image.status === status) {
        throw new AmazonListingPublishMediaError(
          status === 'ACTIVE' ? 'Amazon draft image is already active' : 'Amazon draft image is already removed',
          409,
          'AMAZON_DRAFT_IMAGE_STATUS_UNCHANGED'
        );
      }
      if (status === 'ACTIVE') {
        const activeCount = await transaction.amazonListingPublishImage.count({
          where: { draftId: draft!.id, status: 'ACTIVE' },
        });
        if (activeCount >= MAX_IMAGES) {
          throw new AmazonListingPublishMediaError(
            `Amazon drafts support up to ${MAX_IMAGES} images`,
            409,
            'AMAZON_DRAFT_IMAGE_LIMIT_REACHED'
          );
        }
        await transaction.amazonListingPublishImage.update({
          where: { id: image.id },
          data: { status, sortOrder: activeCount },
        });
      } else {
        await transaction.amazonListingPublishImage.update({
          where: { id: image.id },
          data: { status },
        });
      }
      return this.finishMutation(
        transaction,
        draft!,
        scope,
        actor,
        status === 'ACTIVE' ? 'AMAZON_DRAFT_IMAGE_RESTORED' : 'AMAZON_DRAFT_IMAGE_DETACHED',
        { imageId }
      );
    }).then((draft) => this.serializeResult(draft));
  }

  private async finishMutation(
    transaction: Prisma.TransactionClient,
    draft: any,
    scope: AmazonPublishScope,
    actor: AmazonPublishActor,
    operation: string,
    metadata: Record<string, unknown>
  ) {
    const images = await transaction.amazonListingPublishImage.findMany({
      where: { draftId: draft.id, status: 'ACTIVE' },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    const changed = await transaction.amazonListingPublishDraft.updateMany({
      where: {
        id: draft.id,
        ...amazonPublishMediaScopeWhere(scope),
        draftRevision: draft.draftRevision,
      },
      data: {
        mappedAttributes: imageAttributes(draft.mappedAttributes, images, draft.marketplaceId),
        draftRevision: { increment: 1 },
        lastValidationStatus: null,
        validatedPayloadHash: null,
      },
    });
    if (changed.count !== 1) {
      throw new AmazonListingPublishMediaError(
        'Amazon publish draft changed; reload before changing images',
        409,
        'AMAZON_PUBLISH_DRAFT_REVISION_CONFLICT'
      );
    }
    await transaction.amazonListingPublishAudit.create({
      data: {
        draftId: draft.id,
        productId: draft.productId,
        sellerId: draft.sellerId,
        marketplaceId: draft.marketplaceId,
        sellerSku: draft.sellerSku,
        asin: draft.asin,
        operation,
        beforeValues: { draftRevision: draft.draftRevision },
        afterValues: { draftRevision: draft.draftRevision + 1, activeImageCount: images.length },
        metadata: metadata as Prisma.InputJsonValue,
        ...(actor.requestedByUserId !== undefined ? { requestedByUserId: actor.requestedByUserId } : {}),
        ...(actor.requestedByUserType ? { requestedByUserType: actor.requestedByUserType } : {}),
      },
    });
    return transaction.amazonListingPublishDraft.findUniqueOrThrow({
      where: { id: draft.id },
      include: draftInclude,
    });
  }

  private assertEditable(draft: any, draftRevision: number): asserts draft {
    if (!draft) {
      throw new AmazonListingPublishMediaError('Amazon publish draft not found', 404, 'AMAZON_PUBLISH_DRAFT_NOT_FOUND');
    }
    if (draft.draftRevision !== draftRevision) {
      throw new AmazonListingPublishMediaError(
        `Amazon publish draft changed; reload revision ${draft.draftRevision}`,
        409,
        'AMAZON_PUBLISH_DRAFT_REVISION_CONFLICT'
      );
    }
    if (!isAmazonDraftMediaEditableStatus(draft.status)) {
      throw new AmazonListingPublishMediaError(
        `Amazon publish draft images cannot be edited while status is ${draft.status}`,
        409,
        'AMAZON_PUBLISH_DRAFT_NOT_EDITABLE'
      );
    }
  }

  private async validateUpload(file: UploadedImage) {
    if (file.buffer.length === 0) {
      throw new AmazonListingPublishMediaError('The uploaded image is empty', 400, 'AMAZON_DRAFT_IMAGE_EMPTY');
    }
    if (file.buffer.length > MAX_IMAGE_BYTES) {
      throw new AmazonListingPublishMediaError('Amazon images must be 10MB or smaller', 400, 'AMAZON_DRAFT_IMAGE_TOO_LARGE');
    }
    const detectedType = imageFormat(file.buffer);
    if (!detectedType || !['image/jpeg', 'image/png'].includes(file.mimetype) || detectedType !== file.mimetype) {
      throw new AmazonListingPublishMediaError(
        'Upload a genuine JPEG or PNG image; the file content must match its MIME type',
        400,
        'AMAZON_DRAFT_IMAGE_TYPE_INVALID'
      );
    }
    let image: Jimp;
    try {
      image = await Jimp.read(file.buffer);
    } catch {
      throw new AmazonListingPublishMediaError('The uploaded image could not be decoded', 400, 'AMAZON_DRAFT_IMAGE_INVALID');
    }
    const { width, height } = image.bitmap;
    if (
      width < MIN_IMAGE_EDGE || height < MIN_IMAGE_EDGE
      || width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE
    ) {
      throw new AmazonListingPublishMediaError(
        `Amazon images must be between ${MIN_IMAGE_EDGE} and ${MAX_IMAGE_EDGE} pixels on each side`,
        400,
        'AMAZON_DRAFT_IMAGE_DIMENSIONS_INVALID'
      );
    }
    return { contentType: detectedType, width, height };
  }

  private async uploadToStorage(draftId: string, file: UploadedImage) {
    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.filename || 'amazon-listing-image',
      contentType: file.mimetype,
    });
    formData.append('section', 'amazon-listing-drafts');
    formData.append('field', `draft-${draftId}`);
    try {
      const response = await axios.post(
        `${env.STORAGE_BACKEND_URL || 'http://localhost:4500'}/storefront/media`,
        formData,
        { headers: formData.getHeaders(), timeout: 90_000 }
      );
      const uploaded = response.data?.data?.files?.find((item: any) => item?.success && item?.url);
      if (!uploaded?.url) throw new Error(response.data?.message || 'Storage returned no public URL');
      return { url: String(uploaded.url) };
    } catch (error) {
      throw new AmazonListingPublishMediaError(
        error instanceof Error ? `Amazon image upload failed: ${error.message}` : 'Amazon image upload failed',
        502,
        'AMAZON_DRAFT_IMAGE_STORAGE_FAILED'
      );
    }
  }

  private async assertPubliclyAccessible(url: string) {
    try {
      const response = await axios.head(url, {
        timeout: 10_000,
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400,
      });
      const contentType = String(response.headers['content-type'] ?? '');
      if (contentType && !contentType.toLowerCase().startsWith('image/')) {
        throw new Error(`URL returned ${contentType} instead of an image`);
      }
    } catch (error) {
      throw new AmazonListingPublishMediaError(
        error instanceof Error ? `Image URL is not publicly accessible: ${error.message}` : 'Image URL is not publicly accessible',
        422,
        'AMAZON_DRAFT_IMAGE_NOT_PUBLIC'
      );
    }
  }

  private serializeResult(draft: any) {
    return {
      ...draft,
      id: String(draft.id),
      productId: String(draft.productId),
      sourceProductModifiedAt: draft.sourceProductModifiedAt === null ? null : String(draft.sourceProductModifiedAt),
      createdAt: draft.createdAt?.toISOString() ?? null,
      updatedAt: draft.updatedAt?.toISOString() ?? null,
      cancelledAt: draft.cancelledAt?.toISOString() ?? null,
      images: draft.images.map(serializeImage),
      attempts: draft.attempts.map((attempt: any) => ({
        ...attempt,
        id: String(attempt.id),
        draftId: String(attempt.draftId),
        startedAt: attempt.startedAt?.toISOString() ?? null,
        finishedAt: attempt.finishedAt?.toISOString() ?? null,
        createdAt: attempt.createdAt?.toISOString() ?? null,
      })),
      audits: draft.audits.map((audit: any) => ({
        ...audit,
        id: String(audit.id),
        draftId: String(audit.draftId),
        productId: String(audit.productId),
        createdAt: audit.createdAt?.toISOString() ?? null,
      })),
    };
  }
}

export const amazonListingPublishMediaService = new AmazonListingPublishMediaService();
