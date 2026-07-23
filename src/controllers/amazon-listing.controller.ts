import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  amazonListingParamsSchema,
  amazonListingQuerySchema,
  amazonInventorySyncModeSchema,
  amazonInventoryBulkPreviewSchema,
  amazonInventoryBulkSyncSchema,
  amazonInventoryRetrySchema,
  amazonInventorySyncSchema,
  bulkMapAmazonListingsSchema,
  mapAmazonListingSchema,
} from '../schemas/amazon-listing.schema.js';
import {
  amazonListingImportService,
  sanitizeAmazonListingImportError,
} from '../services/amazon-listing-import.service.js';
import { createSuccessResponse } from '../utils/errorHandler.js';
import {
  AmazonListingMappingError,
  amazonListingMappingService,
} from '../services/amazon-listing-mapping.service.js';
import { amazonListingScopeService } from '../services/amazon-listing-scope.service.js';
import { amazonListingWorkspaceService } from '../services/amazon-listing-workspace.service.js';
import {
  AmazonProductionInventoryError,
  amazonProductionInventoryService,
} from '../services/amazon-production-inventory.service.js';
import { amazonOfferApplySchema, amazonOfferUpdateSchema } from '../schemas/amazon-offer.schema.js';
import { AmazonOfferUpdateError, amazonOfferUpdateService } from '../services/amazon-offer-update.service.js';
import { AmazonSpApiError } from '../services/amazon-production-listings.client.js';
import { AmazonAuthorizationError } from '../services/amazon-lwa-token.service.js';

const validationErrorResponse = (reply: FastifyReply, error: ZodError) => reply.code(400).send({
  success: false,
  message: 'Invalid Amazon listing request',
  details: error.errors.map((item) => `${item.path.join('.')}: ${item.message}`).join(', '),
  statusCode: 400,
  code: 'VALIDATION_ERROR',
});

const mappingErrorResponse = (reply: FastifyReply, error: unknown) => {
  if (error instanceof ZodError) return validationErrorResponse(reply, error);
  if (error instanceof AmazonListingMappingError) {
    return reply.code(error.statusCode).send({
      success: false,
      message: error.message,
      details: error.message,
      statusCode: error.statusCode,
      code: error.code,
    });
  }

  return reply.code(500).send({
    success: false,
    message: 'Amazon listing mapping failed',
    details: 'Amazon listing mapping failed',
    statusCode: 500,
    code: 'AMAZON_LISTING_MAPPING_FAILED',
  });
};

const inventoryErrorResponse = (reply: FastifyReply, error: unknown) => {
  if (error instanceof ZodError) return validationErrorResponse(reply, error);
  if (error instanceof AmazonProductionInventoryError) {
    return reply.code(error.statusCode).send({
      success: false,
      message: error.message,
      details: error.message,
      statusCode: error.statusCode,
      code: error.code,
    });
  }
  return reply.code(500).send({
    success: false,
    message: 'Amazon inventory operation failed',
    details: 'Amazon inventory operation failed',
    statusCode: 500,
    code: 'AMAZON_INVENTORY_OPERATION_FAILED',
  });
};

const offerErrorResponse = (reply: FastifyReply, error: unknown) => {
  if (error instanceof ZodError) return validationErrorResponse(reply, error);
  if (error instanceof AmazonOfferUpdateError || error instanceof AmazonSpApiError || error instanceof AmazonAuthorizationError) return reply.code(error.statusCode).send({
    success: false, message: error.message, details: error.message, statusCode: error.statusCode, code: error.code,
  });
  return reply.code(500).send({ success: false, message: 'Amazon offer operation failed', details: 'Amazon offer operation failed', statusCode: 500, code: 'AMAZON_OFFER_OPERATION_FAILED' });
};

export class AmazonListingController {
  private resolveScope(request: FastifyRequest) {
    const user = (request as AuthenticatedRequest).user;
    return amazonListingScopeService.resolve(user?.id, user?.userType);
  }

  private actor(request: FastifyRequest) {
    const user = (request as AuthenticatedRequest).user;
    return {
      ...(user?.id !== undefined ? { requestedByUserId: user.id } : {}),
      ...(user?.userType ? { requestedByUserType: user.userType } : {}),
    };
  }

  importListings = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as AuthenticatedRequest).user;
      const scope = await this.resolveScope(request);
      const summary = await amazonListingImportService.importListings({
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        client: scope.client,
        ...(user?.id !== undefined ? { requestedByUserId: user.id } : {}),
        ...(user?.userType !== undefined ? { requestedByUserType: user.userType } : {}),
      });

      return reply.code(200).send(
        createSuccessResponse('Amazon production listings imported successfully', summary)
      );
    } catch (error) {
      const sanitized = sanitizeAmazonListingImportError(error);
      return reply.code(sanitized.statusCode).send({
        success: false,
        message: sanitized.message,
        details: sanitized.message,
        statusCode: sanitized.statusCode,
        code: sanitized.code,
      });
    }
  };

  getListings = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = amazonListingQuerySchema.parse(
        (request.query ?? {}) as Record<string, unknown>
      );
      const scope = await this.resolveScope(request);
      const result = await amazonListingImportService.listListings(query, scope);

      return reply.code(200).send({
        ...createSuccessResponse('Amazon production listings retrieved successfully', result.data),
        pagination: result.pagination,
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return validationErrorResponse(reply, error);
      }
      const sanitized = sanitizeAmazonListingImportError(error);
      return reply.code(sanitized.statusCode).send({
        success: false,
        message: sanitized.message,
        details: sanitized.message,
        statusCode: sanitized.statusCode,
        code: sanitized.code,
      });
    }
  };

  mapListing = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { listingId } = amazonListingParamsSchema.parse(request.params);
      const body = mapAmazonListingSchema.parse(request.body);
      const user = (request as AuthenticatedRequest).user;
      const scope = await this.resolveScope(request);
      const listing = await amazonListingMappingService.mapListing({
        listingId,
        productId: body.productId,
        unitsPerListing: body.unitsPerListing,
        allowRemap: body.allowRemap,
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        ...(user?.id !== undefined ? { requestedByUserId: user.id } : {}),
        ...(user?.userType !== undefined ? { requestedByUserType: user.userType } : {}),
      });

      return reply.code(200).send(
        createSuccessResponse('Amazon listing mapped to Nivaana product successfully', listing)
      );
    } catch (error) {
      return mappingErrorResponse(reply, error);
    }
  };

  unmapListing = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { listingId } = amazonListingParamsSchema.parse(request.params);
      const user = (request as AuthenticatedRequest).user;
      const scope = await this.resolveScope(request);
      const listing = await amazonListingMappingService.unmapListing(listingId, {
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        ...(user?.id !== undefined ? { requestedByUserId: user.id } : {}),
        ...(user?.userType !== undefined ? { requestedByUserType: user.userType } : {}),
      });

      return reply.code(200).send(
        createSuccessResponse('Amazon listing unmapped successfully', listing)
      );
    } catch (error) {
      return mappingErrorResponse(reply, error);
    }
  };

  getListingDetails = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { listingId } = amazonListingParamsSchema.parse(request.params);
      const data = await amazonListingWorkspaceService.getDetails(listingId, await this.resolveScope(request));
      return reply.code(200).send(createSuccessResponse('Amazon listing details retrieved successfully', data));
    } catch (error) {
      return mappingErrorResponse(reply, error);
    }
  };

  getSuggestions = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { listingId } = amazonListingParamsSchema.parse(request.params);
      const data = await amazonListingWorkspaceService.getSuggestions(listingId, await this.resolveScope(request));
      return reply.code(200).send(createSuccessResponse('Amazon product suggestions retrieved successfully', data));
    } catch (error) {
      return mappingErrorResponse(reply, error);
    }
  };

  getMappingAudits = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { listingId } = amazonListingParamsSchema.parse(request.params);
      const data = await amazonListingWorkspaceService.getAudits(listingId, await this.resolveScope(request));
      return reply.code(200).send(createSuccessResponse('Amazon mapping audit retrieved successfully', data));
    } catch (error) {
      return mappingErrorResponse(reply, error);
    }
  };

  previewOfferUpdate = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { listingId } = amazonListingParamsSchema.parse(request.params);
      const changes = amazonOfferUpdateSchema.parse(request.body);
      const data = await amazonOfferUpdateService.preview(listingId, changes, await this.resolveScope(request), this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon offer update validated', data));
    } catch (error) { return offerErrorResponse(reply, error); }
  };

  applyOfferUpdate = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { listingId } = amazonListingParamsSchema.parse(request.params);
      const input = amazonOfferApplySchema.parse(request.body);
      const data = await amazonOfferUpdateService.apply(listingId, input.previewId, await this.resolveScope(request), this.actor(request));
      return reply.code(200).send(createSuccessResponse('Amazon offer update submitted', data));
    } catch (error) { return offerErrorResponse(reply, error); }
  };

  bulkMapListings = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = bulkMapAmazonListingsSchema.parse(request.body);
      const user = (request as AuthenticatedRequest).user;
      const data = await amazonListingWorkspaceService.bulkMap(body.items, await this.resolveScope(request), {
        ...(user?.id !== undefined ? { requestedByUserId: user.id } : {}),
        ...(user?.userType !== undefined ? { requestedByUserType: user.userType } : {}),
      });
      return reply.code(200).send(createSuccessResponse('Amazon bulk mapping completed', data));
    } catch (error) {
      return mappingErrorResponse(reply, error);
    }
  };

  previewInventorySync = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { listingId } = amazonListingParamsSchema.parse(request.params);
      const user = (request as AuthenticatedRequest).user;
      const data = await amazonProductionInventoryService.preview(listingId, await this.resolveScope(request), {
        ...(user?.id !== undefined ? { requestedByUserId: user.id } : {}),
        ...(user?.userType !== undefined ? { requestedByUserType: user.userType } : {}),
      });
      return reply.code(200).send(createSuccessResponse('Amazon stock sync preview created', data));
    } catch (error) {
      return inventoryErrorResponse(reply, error);
    }
  };

  syncInventoryNow = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { listingId } = amazonListingParamsSchema.parse(request.params);
      const { previewId } = amazonInventorySyncSchema.parse(request.body);
      const user = (request as AuthenticatedRequest).user;
      const data = await amazonProductionInventoryService.sync(listingId, previewId, await this.resolveScope(request), {
        ...(user?.id !== undefined ? { requestedByUserId: user.id } : {}),
        ...(user?.userType !== undefined ? { requestedByUserType: user.userType } : {}),
      });
      return reply.code(200).send(createSuccessResponse('Amazon MFN stock synchronized successfully', data));
    } catch (error) {
      return inventoryErrorResponse(reply, error);
    }
  };

  setInventorySyncMode = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { listingId } = amazonListingParamsSchema.parse(request.params);
      const { mode } = amazonInventorySyncModeSchema.parse(request.body);
      const data = await amazonProductionInventoryService.setMode(listingId, mode, await this.resolveScope(request));
      return reply.code(200).send(createSuccessResponse('Amazon inventory sync mode updated', data));
    } catch (error) {
      return inventoryErrorResponse(reply, error);
    }
  };

  getInventorySyncHistory = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { listingId } = amazonListingParamsSchema.parse(request.params);
      const data = await amazonProductionInventoryService.history(listingId, await this.resolveScope(request));
      return reply.code(200).send(createSuccessResponse('Amazon inventory sync history retrieved', data));
    } catch (error) {
      return inventoryErrorResponse(reply, error);
    }
  };

  bulkPreviewInventorySync = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { listingIds } = amazonInventoryBulkPreviewSchema.parse(request.body);
      const user = (request as AuthenticatedRequest).user;
      const data = await amazonProductionInventoryService.bulkPreview(listingIds, await this.resolveScope(request), {
        ...(user?.id !== undefined ? { requestedByUserId: user.id } : {}),
        ...(user?.userType !== undefined ? { requestedByUserType: user.userType } : {}),
      });
      return reply.code(200).send(createSuccessResponse('Amazon bulk stock preview completed', data));
    } catch (error) {
      return inventoryErrorResponse(reply, error);
    }
  };

  bulkSyncInventoryNow = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { items } = amazonInventoryBulkSyncSchema.parse(request.body);
      const user = (request as AuthenticatedRequest).user;
      const data = await amazonProductionInventoryService.bulkSync(items, await this.resolveScope(request), {
        ...(user?.id !== undefined ? { requestedByUserId: user.id } : {}),
        ...(user?.userType !== undefined ? { requestedByUserType: user.userType } : {}),
      });
      return reply.code(200).send(createSuccessResponse('Amazon bulk MFN stock synchronization completed', data));
    } catch (error) {
      return inventoryErrorResponse(reply, error);
    }
  };

  retryInventorySync = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { listingId } = amazonListingParamsSchema.parse(request.params);
      const { attemptId } = amazonInventoryRetrySchema.parse(request.body);
      const user = (request as AuthenticatedRequest).user;
      const data = await amazonProductionInventoryService.retry(listingId, attemptId, await this.resolveScope(request), {
        ...(user?.id !== undefined ? { requestedByUserId: user.id } : {}),
        ...(user?.userType !== undefined ? { requestedByUserType: user.userType } : {}),
      });
      return reply.code(200).send(createSuccessResponse('Amazon inventory synchronization retried successfully', data));
    } catch (error) {
      return inventoryErrorResponse(reply, error);
    }
  };
}
