import { FastifyInstance } from 'fastify';
import { CategoryImageController } from '../controllers/category-image.controller.js';

export async function categoryImageRoutes(fastify: FastifyInstance) {
  const controller = new CategoryImageController();

  fastify.get('/', {
    schema: {
      description: 'List product category and subcategory picklists with managed images',
      tags: ['Category Images'],
      querystring: {
        type: 'object',
        properties: {
          fieldname: { type: 'string', enum: ['category', 'subcategory'] },
          isactive: { type: 'string', enum: ['true', 'false'] },
          search: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, controller.list);

  fastify.get('/:picklistId', {
    schema: {
      description: 'Get the managed image for a category or subcategory picklist',
      tags: ['Category Images'],
      params: {
        type: 'object',
        required: ['picklistId'],
        properties: {
          picklistId: { type: 'string', pattern: '^\\d+$' },
        },
      },
    },
  }, controller.get);

  const uploadSchema = {
    description: 'Upload or replace a category or subcategory image',
    tags: ['Category Images'],
    consumes: ['multipart/form-data'],
    params: {
      type: 'object',
      required: ['picklistId'],
      properties: {
        picklistId: { type: 'string', pattern: '^\\d+$' },
      },
    },
  };

  fastify.post('/:picklistId/image', {
    schema: uploadSchema,
  }, controller.upload);

  fastify.put('/:picklistId/image', {
    schema: uploadSchema,
  }, controller.upload);

  fastify.patch('/:picklistId', {
    schema: {
      description: 'Update category image alt text or active status',
      tags: ['Category Images'],
      params: {
        type: 'object',
        required: ['picklistId'],
        properties: {
          picklistId: { type: 'string', pattern: '^\\d+$' },
        },
      },
      body: {
        type: 'object',
        properties: {
          alttext: { type: ['string', 'null'], maxLength: 255 },
          isactive: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  }, controller.update);

  fastify.delete('/:picklistId/image', {
    schema: {
      description: 'Delete a category image record and its physical GCP objects',
      tags: ['Category Images'],
      params: {
        type: 'object',
        required: ['picklistId'],
        properties: {
          picklistId: { type: 'string', pattern: '^\\d+$' },
        },
      },
    },
  }, controller.delete);
}
