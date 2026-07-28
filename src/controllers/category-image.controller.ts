import { randomUUID } from 'crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { CategoryImageService } from '../services/category-image.service.js';
import { storageService } from '../services/storage.service.js';
import {
  categoryImageParamsSchema,
  categoryImageQuerySchema,
  updateCategoryImageSchema,
} from '../schemas/category-image.schema.js';
import { asyncHandler, createSuccessResponse, ValidationError } from '../utils/errorHandler.js';
import { checkPermission } from '../utils/permissionChecker.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { logger } from '../config/logger.js';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const getMultipartFieldValue = (field: any): string | undefined => {
  if (field === undefined || field === null) return undefined;
  if (typeof field === 'string') return field;
  if (typeof field.value === 'string') return field.value;
  return undefined;
};

const sanitizePathSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';

export class CategoryImageController {
  private categoryImageService = new CategoryImageService();

  private async authorize(
    request: AuthenticatedRequest,
    reply: FastifyReply,
    action: 'read' | 'create' | 'edit' | 'delete'
  ) {
    if (!request.user || request.user.userType !== 'inventory') {
      return reply.code(403).send({
        success: false,
        message: 'Inventory administrator access required',
        statusCode: 403,
      });
    }

    const permission = await checkPermission(request.user.id, 'picklist', action);
    if (!permission.allowed) {
      return reply.code(403).send({
        success: false,
        message: 'Insufficient permission to manage category images',
        details: permission.reason,
        statusCode: 403,
      });
    }
  }

  list = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    if (await this.authorize(request as AuthenticatedRequest, reply, 'read')) return;

    const query = categoryImageQuerySchema.parse(request.query || {});
    const records = await this.categoryImageService.list(query);
    return reply.code(200).send(
      createSuccessResponse('Category images retrieved successfully', records)
    );
  });

  get = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    if (await this.authorize(request as AuthenticatedRequest, reply, 'read')) return;

    const { picklistId } = categoryImageParamsSchema.parse(request.params);
    const record = await this.categoryImageService.getByPicklistId(Number(picklistId));
    return reply.code(200).send(
      createSuccessResponse('Category image retrieved successfully', record)
    );
  });

  upload = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const { picklistId } = categoryImageParamsSchema.parse(request.params);
    const existingRecord = await this.categoryImageService.getByPicklistId(Number(picklistId));
    const action = existingRecord.image ? 'edit' : 'create';

    if (await this.authorize(authenticatedRequest, reply, action)) return;

    const body = request.body as any;
    const uploadedFile = body?.file;

    if (!uploadedFile) {
      throw new ValidationError(
        'No image uploaded',
        'Upload multipart/form-data using the field name "file"'
      );
    }

    const mimetype = uploadedFile.mimetype || '';
    if (!ALLOWED_IMAGE_TYPES.has(mimetype)) {
      throw new ValidationError('Only JPEG, PNG, and WebP images are supported');
    }

    const fileBuffer = await uploadedFile.toBuffer();
    if (fileBuffer.length === 0) {
      throw new ValidationError('The uploaded image is empty');
    }
    if (fileBuffer.length > MAX_IMAGE_BYTES) {
      throw new ValidationError('Image must be 5 MB or smaller');
    }

    const fieldname = sanitizePathSegment(existingRecord.fieldname || 'category');
    const value = sanitizePathSegment(existingRecord.value || String(picklistId));
    const basePath = `storefront-taxonomy/${fieldname}/${value}/${randomUUID()}`;
    const variants = await storageService.uploadCategoryImageVariants(
      fileBuffer,
      uploadedFile.filename || `${value}-image`,
      mimetype,
      basePath
    );

    try {
      const alttext = getMultipartFieldValue(body?.alttext);
      const imageInput: Parameters<CategoryImageService['upsertImage']>[1] = {
        imageurl: variants.mobile.url,
        objectkey: variants.mobile.objectKey,
        thumbnailurl: variants.thumbnail.url,
        thumbnailkey: variants.thumbnail.objectKey,
        bucket: variants.mobile.bucket,
        width: variants.mobile.width,
        height: variants.mobile.height,
        filesize: variants.mobile.size,
        mimetype: variants.mobile.mimetype,
      };

      if (alttext !== undefined) {
        imageInput.alttext = alttext;
      }
      if (authenticatedRequest.user?.id !== undefined) {
        imageInput.userid = authenticatedRequest.user.id;
      }

      const record = await this.categoryImageService.upsertImage(
        Number(picklistId),
        imageInput
      );

      let oldObjectsDeleted = true;
      const oldObjectKeys = existingRecord.image
        ? [
            existingRecord.image.objectkey,
            existingRecord.image.thumbnailkey,
          ].filter((key): key is string => Boolean(key))
        : [];

      if (oldObjectKeys.length > 0) {
        try {
          await storageService.deleteCategoryImageObjects(
            existingRecord.image.bucket,
            oldObjectKeys
          );
        } catch (cleanupError) {
          oldObjectsDeleted = false;
          logger.error(
            {
              cleanupError,
              picklistId,
              bucket: existingRecord.image.bucket,
              oldObjectKeys,
            },
            'Category image replaced, but old GCP objects could not be deleted'
          );
        }
      }

      return reply.code(existingRecord.image ? 200 : 201).send(
        createSuccessResponse(
          existingRecord.image
            ? 'Category image replaced successfully'
            : 'Category image uploaded successfully',
          {
            ...record,
            storageCleanup: {
              oldObjectsDeleted,
            },
          }
        )
      );
    } catch (error) {
      await storageService.deleteCategoryImageObjects(
        variants.mobile.bucket,
        [variants.mobile.objectKey, variants.thumbnail.objectKey]
      ).catch(() => undefined);
      throw error;
    }
  });

  update = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const authenticatedRequest = request as AuthenticatedRequest;
    if (await this.authorize(authenticatedRequest, reply, 'edit')) return;

    const { picklistId } = categoryImageParamsSchema.parse(request.params);
    const data = updateCategoryImageSchema.parse(request.body);
    const image = await this.categoryImageService.updateMetadata(
      Number(picklistId),
      data,
      authenticatedRequest.user?.id
    );

    return reply.code(200).send(
      createSuccessResponse('Category image metadata updated successfully', image)
    );
  });

  delete = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    if (await this.authorize(request as AuthenticatedRequest, reply, 'delete')) return;

    const { picklistId } = categoryImageParamsSchema.parse(request.params);
    const deleted = await this.categoryImageService.deleteImage(Number(picklistId));
    const objectKeys = [
      deleted.objectkey,
      deleted.thumbnailkey,
    ].filter((key): key is string => Boolean(key));

    let objectsDeleted = true;
    try {
      await storageService.deleteCategoryImageObjects(
        deleted.bucket,
        objectKeys
      );
    } catch (cleanupError) {
      objectsDeleted = false;
      logger.error(
        {
          cleanupError,
          picklistId,
          bucket: deleted.bucket,
          objectKeys,
        },
        'Category image database record deleted, but GCP cleanup failed'
      );
    }

    return reply.code(200).send(
      createSuccessResponse(
        objectsDeleted
          ? 'Category image and GCP objects deleted successfully'
          : 'Category image record deleted, but some GCP objects require cleanup',
        {
          deleted,
          storageCleanup: {
            objectsDeleted,
          },
        }
      )
    );
  });
}
