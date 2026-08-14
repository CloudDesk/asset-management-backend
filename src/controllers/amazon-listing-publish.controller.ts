import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  amazonAsinSelectionSchema,
  amazonCatalogSearchSchema,
  amazonEligibilityCheckSchema,
  amazonNoCatalogMatchSchema,
  amazonProductTypeSearchSchema,
  amazonProductTypeDefinitionSchema,
  amazonProductTypeSelectionSchema,
  amazonPublishDraftBootstrapSchema,
  amazonPublishDraftCancelSchema,
  amazonPublishDraftParamsSchema,
  amazonPublishDraftUpdateSchema,
  amazonPublishValidationSchema,
  amazonPublishSubmissionSchema,
  amazonPublishCorrectionSchema,
  amazonPublishProductParamsSchema,
} from '../schemas/amazon-listing-publish.schema.js';
import { amazonListingScopeService } from '../services/amazon-listing-scope.service.js';
import {
  AmazonListingPublishDraftError,
  amazonListingPublishDraftService,
} from '../services/amazon-listing-publish-draft.service.js';
import {
  AmazonListingPublishMediaError,
  amazonListingPublishMediaService,
} from '../services/amazon-listing-publish-media.service.js';
import { AmazonAuthorizationError } from '../services/amazon-lwa-token.service.js';
import { AmazonSpApiError } from '../services/amazon-production-listings.client.js';
import { AmazonProductionWriteDisabledError } from '../services/amazon-production-write-guard.service.js';
import { createSuccessResponse } from '../utils/errorHandler.js';
import { env } from '../config/env.js';

const errorResponse = (reply: FastifyReply, error: unknown) => {
  reply.request.log.error({ err: error }, 'Amazon publish draft operation failed');
  if (error instanceof ZodError) {
    return reply.code(400).send({
      success: false,
      message: 'Invalid Amazon publish draft request',
      details: error.errors.map((item) => `${item.path.join('.')}: ${item.message}`).join(', '),
      statusCode: 400,
      code: 'VALIDATION_ERROR',
    });
  }
  if (error instanceof AmazonListingPublishDraftError || error instanceof AmazonListingPublishMediaError
    || error instanceof AmazonAuthorizationError
    || error instanceof AmazonSpApiError || error instanceof AmazonProductionWriteDisabledError) {
    return reply.code(error.statusCode).send({
      success: false,
      message: error.message,
      details: error.message,
      statusCode: error.statusCode,
      code: error.code,
    });
  }
  const structured = error as {
    statusCode?: unknown;
    code?: unknown;
    message?: unknown;
  };
  if (
    Number.isInteger(structured?.statusCode)
    && Number(structured.statusCode) >= 400
    && Number(structured.statusCode) <= 599
    && typeof structured.code === 'string'
    && structured.code.startsWith('AMAZON_')
    && typeof structured.message === 'string'
  ) {
    return reply.code(Number(structured.statusCode)).send({
      success: false,
      message: structured.message,
      details: structured.message,
      statusCode: Number(structured.statusCode),
      code: structured.code,
    });
  }
  if (
    typeof structured?.code === 'string'
    && ['FST_REQ_FILE_TOO_LARGE', 'FST_FILES_LIMIT', 'FST_PARTS_LIMIT'].includes(structured.code)
  ) {
    return reply.code(400).send({
      success: false,
      message: 'Amazon images must be JPEG or PNG files no larger than 10MB',
      details: 'Amazon images must be JPEG or PNG files no larger than 10MB',
      statusCode: 400,
      code: 'AMAZON_DRAFT_IMAGE_MULTIPART_LIMIT',
    });
  }
  if (env.NODE_ENV === 'development' && error instanceof Error) {
    return reply.code(500).send({
      success: false,
      message: `Amazon publish draft operation failed: ${error.message}`,
      details: error.message,
      statusCode: 500,
      code: 'AMAZON_PUBLISH_DRAFT_UNEXPECTED_ERROR',
    });
  }
  return reply.code(500).send({
    success: false,
    message: 'Amazon publish draft operation failed',
    details: 'Amazon publish draft operation failed',
    statusCode: 500,
    code: 'AMAZON_PUBLISH_DRAFT_OPERATION_FAILED',
  });
};

export class AmazonListingPublishController {
  private user(request: FastifyRequest) {
    return (request as AuthenticatedRequest).user;
  }

  private resolveScope(request: FastifyRequest) {
    const user = this.user(request);
    return amazonListingScopeService.resolve(user?.id, user?.userType);
  }

  private actor(request: FastifyRequest) {
    const user = this.user(request);
    return {
      ...(user?.id !== undefined ? { requestedByUserId: user.id } : {}),
      ...(user?.userType ? { requestedByUserType: user.userType } : {}),
    };
  }

  bootstrap = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { productId } = amazonPublishProductParamsSchema.parse(request.params);
      const body = amazonPublishDraftBootstrapSchema.parse(request.body ?? {});
      const scope = await this.resolveScope(request);
      const data = await amazonListingPublishDraftService.bootstrap({
        productId,
        listingMode: body.listingMode,
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        actor: this.actor(request),
      });
      return reply.code(data.resumed ? 200 : 201).send(createSuccessResponse(
        data.resumed ? 'Amazon publish draft resumed' : 'Amazon publish draft created',
        data
      ));
    } catch (error) {
      return errorResponse(reply, error);
    }
  };

  get = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const scope = await this.resolveScope(request);
      const data = await amazonListingPublishDraftService.get(draftId, scope);
      return reply.code(200).send(createSuccessResponse('Amazon publish draft retrieved', data));
    } catch (error) {
      return errorResponse(reply, error);
    }
  };

  list = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = await amazonListingPublishDraftService.list(await this.resolveScope(request));
      return reply.code(200).send(createSuccessResponse('Amazon publish drafts retrieved', data));
    } catch (error) {
      return errorResponse(reply, error);
    }
  };

  cancel = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = amazonPublishDraftCancelSchema.parse(request.body);
      const scope = await this.resolveScope(request);
      const data = await amazonListingPublishDraftService.cancel(
        draftId,
        {
          draftRevision: body.draftRevision,
          ...(body.reason ? { reason: body.reason } : {}),
        },
        scope,
        this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon publish draft cancelled', data));
    } catch (error) {
      return errorResponse(reply, error);
    }
  };

  update = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = amazonPublishDraftUpdateSchema.parse(request.body);
      const scope = await this.resolveScope(request);
      const data = await amazonListingPublishDraftService.update(draftId, {
        draftRevision: body.draftRevision,
        ...(body.listingMode !== undefined ? { listingMode: body.listingMode } : {}),
        ...(body.sellerSku !== undefined ? { sellerSku: body.sellerSku } : {}),
        ...(body.mappedAttributes !== undefined ? { mappedAttributes: body.mappedAttributes } : {}),
      }, scope, this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon publish draft updated', data));
    } catch (error) {
      return errorResponse(reply, error);
    }
  };

  searchCatalog = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = amazonCatalogSearchSchema.parse(request.body);
      const data = await amazonListingPublishDraftService.searchCatalog(
        draftId, {
          draftRevision: body.draftRevision,
          ...(body.identifiers ? { identifiers: body.identifiers } : {}),
          ...(body.identifiersType ? { identifiersType: body.identifiersType } : {}),
          ...(body.keywords ? { keywords: body.keywords } : {}),
        }, await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon catalog candidates retrieved', data));
    } catch (error) { return errorResponse(reply, error); }
  };

  selectAsin = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = amazonAsinSelectionSchema.parse(request.body);
      const data = await amazonListingPublishDraftService.selectAsin(
        draftId, body, await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon ASIN selected', data));
    } catch (error) { return errorResponse(reply, error); }
  };

  confirmNoCatalogMatch = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = amazonNoCatalogMatchSchema.parse(request.body);
      const data = await amazonListingPublishDraftService.confirmNoCatalogMatch(
        draftId, body, await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('No Amazon catalog match confirmed', data));
    } catch (error) { return errorResponse(reply, error); }
  };

  searchProductTypes = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = amazonProductTypeSearchSchema.parse(request.body);
      const data = await amazonListingPublishDraftService.searchProductTypes(
        draftId, {
          draftRevision: body.draftRevision,
          ...(body.itemName ? { itemName: body.itemName } : {}),
          ...(body.keywords ? { keywords: body.keywords } : {}),
        }, await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon product types retrieved', data));
    } catch (error) { return errorResponse(reply, error); }
  };

  selectProductType = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = amazonProductTypeSelectionSchema.parse(request.body);
      const data = await amazonListingPublishDraftService.selectProductType(
        draftId, body, await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon product type selected', data));
    } catch (error) { return errorResponse(reply, error); }
  };

  loadProductTypeDefinition = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = amazonProductTypeDefinitionSchema.parse(request.body);
      const data = await amazonListingPublishDraftService.loadProductTypeDefinition(
        draftId, body, await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon product attributes loaded', data));
    } catch (error) { return errorResponse(reply, error); }
  };

  checkEligibility = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = amazonEligibilityCheckSchema.parse(request.body);
      const data = await amazonListingPublishDraftService.checkEligibility(
        draftId, body, await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon listing eligibility checked', data));
    } catch (error) { return errorResponse(reply, error); }
  };

  validateLocally = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = amazonPublishValidationSchema.parse(request.body);
      const data = await amazonListingPublishDraftService.validateLocally(
        draftId, body, await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon draft validated locally', data));
    } catch (error) { return errorResponse(reply, error); }
  };

  previewValidation = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = amazonPublishValidationSchema.parse(request.body);
      const data = await amazonListingPublishDraftService.previewValidation(
        draftId, body, await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon validation preview completed', data));
    } catch (error) { return errorResponse(reply, error); }
  };

  submit = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = amazonPublishSubmissionSchema.parse(request.body);
      const data = await amazonListingPublishDraftService.submit(
        draftId, body, await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon listing submitted for processing', data));
    } catch (error) { return errorResponse(reply, error); }
  };

  reconcileSubmission = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = amazonPublishValidationSchema.parse(request.body);
      const data = await amazonListingPublishDraftService.reconcileSubmission(
        draftId, body, await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon listing status reconciled', data));
    } catch (error) { return errorResponse(reply, error); }
  };

  reopenForCorrection = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = amazonPublishCorrectionSchema.parse(request.body);
      const data = await amazonListingPublishDraftService.reopenForCorrection(
        draftId, body, await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon correction draft reopened', data));
    } catch (error) { return errorResponse(reply, error); }
  };

  uploadImage = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const query = request.query as { draftRevision?: string | number };
      const draftRevision = Number(query?.draftRevision);
      if (!Number.isInteger(draftRevision) || draftRevision < 1) {
        throw new AmazonListingPublishMediaError(
          'A valid draftRevision query parameter is required',
          400,
          'AMAZON_DRAFT_IMAGE_REVISION_REQUIRED'
        );
      }
      const uploadedFile = (request.body as any)?.file;
      if (!uploadedFile?.toBuffer) {
        throw new AmazonListingPublishMediaError(
          'Upload one image using multipart/form-data with field name "file"',
          400,
          'AMAZON_DRAFT_IMAGE_FILE_REQUIRED'
        );
      }
      let buffer: Buffer;
      try {
        buffer = await uploadedFile.toBuffer();
      } catch (cause) {
        throw new AmazonListingPublishMediaError(
          'The image could not be read. Upload one JPEG or PNG file no larger than 10MB',
          400,
          'AMAZON_DRAFT_IMAGE_MULTIPART_READ_FAILED',
          cause
        );
      }
      const data = await amazonListingPublishMediaService.upload(
        draftId,
        draftRevision,
        await this.resolveScope(request),
        this.actor(request),
        {
          buffer,
          filename: uploadedFile.filename || 'amazon-listing-image',
          mimetype: uploadedFile.mimetype || '',
        }
      );
      return reply.code(201).send(createSuccessResponse('Amazon draft image uploaded', data));
    } catch (error) {
      return errorResponse(reply, error);
    }
  };

  detachImage = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { draftId: string; imageId: string };
      const body = amazonPublishValidationSchema.parse(request.body);
      const data = await amazonListingPublishMediaService.detach(
        params.draftId, params.imageId, body.draftRevision,
        await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon draft image removed', data));
    } catch (error) {
      return errorResponse(reply, error);
    }
  };

  restoreImage = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as { draftId: string; imageId: string };
      const body = amazonPublishValidationSchema.parse(request.body);
      const data = await amazonListingPublishMediaService.restore(
        params.draftId, params.imageId, body.draftRevision,
        await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon draft image restored', data));
    } catch (error) {
      return errorResponse(reply, error);
    }
  };

  reorderImages = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = request.body as { draftRevision: number; imageIds: string[] };
      const data = await amazonListingPublishMediaService.reorder(
        draftId, body.draftRevision, body.imageIds,
        await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon draft images reordered', data));
    } catch (error) {
      return errorResponse(reply, error);
    }
  };

  verifyImages = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { draftId } = amazonPublishDraftParamsSchema.parse(request.params);
      const body = amazonPublishValidationSchema.parse(request.body);
      const data = await amazonListingPublishMediaService.verify(
        draftId, body.draftRevision,
        await this.resolveScope(request), this.actor(request)
      );
      return reply.code(200).send(createSuccessResponse('Amazon draft image accessibility checked', data));
    } catch (error) {
      return errorResponse(reply, error);
    }
  };
}
