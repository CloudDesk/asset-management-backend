import { FastifyInstance } from 'fastify';
import { StorefrontPageSectionController } from '../controllers/storefront-page-section.controller.js';

const sectionResponseSchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: { type: 'number' },
    page_key: { type: 'string' },
    section_key: { type: 'string' },
    section_type: { type: 'string' },
    name: { type: 'string' },
    attributes: { type: 'object', additionalProperties: true },
    sort_order: { type: 'number' },
    is_active: { type: 'boolean' },
    schedule_start: { type: ['string', 'null'] },
    schedule_end: { type: ['string', 'null'] },
    version: { type: 'number' },
    createddate: { type: ['number', 'null'] },
    modifieddate: { type: ['number', 'null'] },
  },
};

export async function storefrontPageSectionRoutes(fastify: FastifyInstance) {
  const controller = new StorefrontPageSectionController();

  fastify.get('/homepage-config', {
    schema: {
      description: 'Get active storefront page config grouped by section key',
      tags: ['Storefront Page Sections'],
      querystring: {
        type: 'object',
        properties: {
          page_key: { type: 'string', default: 'home' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
      },
    },
  }, controller.getHomepageConfig.bind(controller));

  fastify.get('/', {
    schema: {
      description: 'List storefront page sections',
      tags: ['Storefront Page Sections'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string' },
          limit: { type: 'string' },
          page_key: { type: 'string' },
          section_key: { type: 'string' },
          section_type: { type: 'string' },
          is_active: { type: 'string' },
          search: { type: 'string' },
        },
        additionalProperties: false,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'array', items: sectionResponseSchema },
            pagination: { type: 'object', additionalProperties: true },
            meta: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
  }, controller.getSections.bind(controller));

  fastify.post('/media', {
    schema: {
      description: 'Upload storefront media to file storage service',
      tags: ['Storefront Page Sections'],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
      },
    },
  }, controller.uploadMedia.bind(controller));

  fastify.get('/:id', {
    schema: {
      description: 'Get storefront page section by ID',
      tags: ['Storefront Page Sections'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, controller.getSection.bind(controller));

  fastify.post('/', {
    schema: {
      description: 'Create storefront page section',
      tags: ['Storefront Page Sections'],
      body: {
        type: 'object',
        required: ['section_key', 'section_type', 'name'],
        properties: {
          page_key: { type: 'string' },
          section_key: { type: 'string' },
          section_type: { type: 'string' },
          name: { type: 'string' },
          attributes: { type: 'object', additionalProperties: true },
          sort_order: { type: 'number' },
          is_active: { type: 'boolean' },
          schedule_start: { type: ['string', 'null'] },
          schedule_end: { type: ['string', 'null'] },
          createdby: { type: ['number', 'null'] },
          modifiedby: { type: ['number', 'null'] },
        },
        additionalProperties: false,
      },
    },
  }, controller.createSection.bind(controller));

  fastify.put('/:id', {
    schema: {
      description: 'Update storefront page section',
      tags: ['Storefront Page Sections'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          page_key: { type: 'string' },
          section_key: { type: 'string' },
          section_type: { type: 'string' },
          name: { type: 'string' },
          attributes: { type: 'object', additionalProperties: true },
          sort_order: { type: 'number' },
          is_active: { type: 'boolean' },
          schedule_start: { type: ['string', 'null'] },
          schedule_end: { type: ['string', 'null'] },
          version: { type: 'number' },
          modifiedby: { type: ['number', 'null'] },
        },
        additionalProperties: false,
      },
    },
  }, controller.updateSection.bind(controller));

  fastify.delete('/:id', {
    schema: {
      description: 'Delete storefront page section',
      tags: ['Storefront Page Sections'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, controller.deleteSection.bind(controller));
}
