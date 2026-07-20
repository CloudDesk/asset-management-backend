import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  amazonListingParamsSchema,
  amazonListingQuerySchema,
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

export class AmazonListingController {
  importListings = async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as AuthenticatedRequest).user;
      const summary = await amazonListingImportService.importListings({
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
      const result = await amazonListingImportService.listListings(query);

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
      const listing = await amazonListingMappingService.mapListing({
        listingId,
        productId: body.productId,
        unitsPerListing: body.unitsPerListing,
        allowRemap: body.allowRemap,
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
      const listing = await amazonListingMappingService.unmapListing(listingId, {
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
}
