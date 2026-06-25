import { FastifyReply, FastifyRequest } from 'fastify';
import axios from 'axios';
import FormData from 'form-data';
import { StorefrontPageSectionService } from '../services/storefront-page-section.service.js';
import {
  createStorefrontPageSectionSchema,
  storefrontPageSectionParamsSchema,
  updateStorefrontPageSectionSchema,
} from '../schemas/storefront-page-section.schema.js';
import { asyncHandler, createSuccessResponse } from '../utils/errorHandler.js';
import { getPaginationParams } from '../utils/pagination.js';
import { env } from '../config/env.js';

const getMultipartFieldValue = (field: any, fallback = ''): string => {
  if (field === undefined || field === null) return fallback;
  if (typeof field === 'string') return field;
  if (typeof field.value === 'string') return field.value;
  return fallback;
};

export class StorefrontPageSectionController {
  private storefrontPageSectionService = new StorefrontPageSectionService();

  getSections = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    const allFilters = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);
    const { page: _page, limit: _limit, is_active, ...restFilters } = allFilters;

    const filters = {
      ...restFilters,
      ...(is_active !== undefined ? { is_active: is_active === 'true' || is_active === true } : {}),
    };

    const result = await this.storefrontPageSectionService.findMany(filters, page, limit);
    const response = createSuccessResponse('Storefront page sections retrieved successfully', result.data);

    return reply.code(200).send({
      ...response,
      pagination: result.pagination,
      meta: {
        filters: Object.keys(filters),
        total: result.pagination.total,
        filtered: Object.keys(filters).length > 0,
      },
    });
  });

  getSection = asyncHandler(async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = storefrontPageSectionParamsSchema.parse(request.params);
    const section = await this.storefrontPageSectionService.findById(id);
    const response = createSuccessResponse('Storefront page section retrieved successfully', section);
    return reply.code(200).send(response);
  });

  getHomepageConfig = asyncHandler(async (request: FastifyRequest<{ Querystring: { page_key?: string } }>, reply: FastifyReply) => {
    const pageKey = request.query?.page_key || 'home';
    const config = await this.storefrontPageSectionService.getActivePageConfig(pageKey);
    const response = createSuccessResponse('Storefront page config retrieved successfully', config);
    return reply.code(200).send(response);
  });

  createSection = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const data = createStorefrontPageSectionSchema.parse(request.body);
    const section = await this.storefrontPageSectionService.create(data);
    const response = createSuccessResponse('Storefront page section created successfully', section);
    return reply.code(201).send(response);
  });

  uploadMedia = asyncHandler(async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as any;
    const uploadedFile = body?.file;

    if (!uploadedFile) {
      return reply.code(400).send({
        success: false,
        message: 'No file uploaded',
        details: 'Please upload media using multipart/form-data with field name "file"',
        statusCode: 400,
      });
    }

    const mimetype = uploadedFile.mimetype || '';
    const isImage = mimetype.startsWith('image/');
    const isVideo = mimetype.startsWith('video/');

    if (!isImage && !isVideo) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid file type',
        details: 'Only image and video files are supported for storefront media',
        statusCode: 400,
      });
    }

    const fileBuffer = await uploadedFile.toBuffer();
    const maxBytes = isVideo ? 60 * 1024 * 1024 : 8 * 1024 * 1024;

    if (fileBuffer.length === 0) {
      return reply.code(400).send({
        success: false,
        message: 'Empty file uploaded',
        details: 'The uploaded media file appears to be empty',
        statusCode: 400,
      });
    }

    if (fileBuffer.length > maxBytes) {
      return reply.code(400).send({
        success: false,
        message: 'File too large',
        details: isVideo ? 'Videos must be 60MB or smaller' : 'Images must be 8MB or smaller',
        statusCode: 400,
      });
    }

    const storageBackendUrl = env.STORAGE_BACKEND_URL || 'http://localhost:4500';
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: uploadedFile.filename || 'storefront-media',
      contentType: mimetype,
    });
    formData.append('section', getMultipartFieldValue(body?.section, 'home'));
    formData.append('field', getMultipartFieldValue(body?.field, 'media'));

    const storageResponse = await axios.post(
      `${storageBackendUrl}/storefront/media`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
        timeout: 90000,
      }
    );

    const uploaded = storageResponse.data?.data?.files?.find((file: any) => file?.success && file?.url);

    if (!storageResponse.data?.success || !uploaded?.url) {
      return reply.code(502).send({
        success: false,
        message: 'Storage backend upload failed',
        details: storageResponse.data?.message || 'Invalid response from storage backend',
        data: storageResponse.data,
        statusCode: 502,
      });
    }

    const response = createSuccessResponse('Storefront media uploaded successfully', {
      url: uploaded.url,
      filename: uploaded.filename,
      content_type: uploaded.contentType || mimetype,
      size: uploaded.size || fileBuffer.length,
      files: storageResponse.data.data.files,
    });

    return reply.code(200).send(response);
  });

  updateSection = asyncHandler(async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = storefrontPageSectionParamsSchema.parse(request.params);
    const data = updateStorefrontPageSectionSchema.parse(request.body);
    const section = await this.storefrontPageSectionService.update(id, data);
    const response = createSuccessResponse('Storefront page section updated successfully', section);
    return reply.code(200).send(response);
  });

  deleteSection = asyncHandler(async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = storefrontPageSectionParamsSchema.parse(request.params);
    await this.storefrontPageSectionService.delete(id);
    const response = createSuccessResponse('Storefront page section deleted successfully', null);
    return reply.code(200).send(response);
  });
}
