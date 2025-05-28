import { FastifyInstance } from 'fastify';
import { PicklistController } from '../controllers/picklist.controller.js';

export async function picklistRoutes(fastify: FastifyInstance) {
  const picklistController = new PicklistController();

  // GET /v1/picklists - Get all picklists with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all picklists with pagination and filtering',
      tags: ['Picklists'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          type: { type: 'string', description: 'Filter by type' },
          table: { type: 'string', description: 'Filter by table' },
          field: { type: 'string', description: 'Filter by field' },
          label: { type: 'string', description: 'Filter by label' },
          value: { type: 'string', description: 'Filter by value' },
          isActive: { type: 'string', description: 'Filter by active status' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true // Allow any fields in picklist objects
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' },
                hasNext: { type: 'boolean' },
                hasPrev: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, picklistController.getPicklists.bind(picklistController));

  // GET /v1/picklists/by-type - Get picklists by type
  fastify.get('/by-type', {
    schema: {
      description: 'Get picklists by type',
      tags: ['Picklists'],
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Picklist type (required)' },
          table: { type: 'string', description: 'Filter by table' },
          field: { type: 'string', description: 'Filter by field' },
        },
        required: ['type'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array' },
          },
        },
      },
    },
  }, picklistController.getPicklistByType.bind(picklistController));

  // GET /v1/picklists/:id - Get picklist by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get picklist by ID',
      tags: ['Picklists'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, picklistController.getPicklist.bind(picklistController));

  // POST /v1/picklists - Create new picklist
  fastify.post('/', {
    schema: {
      description: 'Create a new picklist item',
      tags: ['Picklists'],
      body: {
        type: 'object',
        properties: {
          type: { 
            type: 'string', 
            minLength: 1, 
            description: 'Picklist type' 
          },
          table: { 
            type: 'string', 
            minLength: 1, 
            maxLength: 100, 
            description: 'Database table name' 
          },
          field: { 
            type: 'string', 
            minLength: 1, 
            maxLength: 100, 
            description: 'Database field name' 
          },
          label: { 
            type: 'string', 
            minLength: 1, 
            maxLength: 255, 
            description: 'Display label' 
          },
          value: { 
            type: 'string', 
            minLength: 1, 
            maxLength: 255, 
            description: 'Picklist value' 
          },
          ordering: { 
            type: 'integer', 
            minimum: 0, 
            description: 'Display order' 
          },
        },
        required: ['type', 'table', 'field', 'label', 'value'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, picklistController.createPicklist.bind(picklistController));

  // PUT /v1/picklists/:id - Update picklist
  fastify.put('/:id', {
    schema: {
      description: 'Update picklist by ID',
      tags: ['Picklists'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          table: { type: 'string', minLength: 1, maxLength: 100 },
          field: { type: 'string', minLength: 1, maxLength: 100 },
          label: { type: 'string', minLength: 1, maxLength: 255 },
          value: { type: 'string', minLength: 1, maxLength: 255 },
          isActive: { type: 'boolean' },
          ordering: { type: 'integer', minimum: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            message: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, picklistController.updatePicklist.bind(picklistController));

  // DELETE /v1/picklists/:id - Delete picklist
  fastify.delete('/:id', {
    schema: {
      description: 'Delete picklist by ID',
      tags: ['Picklists'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, picklistController.deletePicklist.bind(picklistController));

  // PATCH /v1/picklists/:id/toggle - Toggle picklist active status
  fastify.patch('/:id/toggle', {
    schema: {
      description: 'Toggle picklist active status',
      tags: ['Picklists'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            message: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, picklistController.toggleActive.bind(picklistController));

  // POST /v1/picklists/reorder - Reorder picklist items
  fastify.post('/reorder', {
    schema: {
      description: 'Reorder picklist items',
      tags: ['Picklists'],
      body: {
        type: 'object',
        properties: {
          type: { type: 'string', minLength: 1 },
          table: { type: 'string', minLength: 1 },
          field: { type: 'string', minLength: 1 },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', format: 'uuid' },
                ordering: { type: 'integer', minimum: 0 },
              },
              required: ['id', 'ordering'],
            },
          },
        },
        required: ['type', 'table', 'field', 'items'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, picklistController.reorderPicklists.bind(picklistController));
} 