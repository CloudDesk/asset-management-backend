import { FastifyInstance } from 'fastify';
import { PromotionTargetLinkController } from '../controllers/promotion-target-link.controller.js';

export async function promotionTargetLinkRoutes(fastify: FastifyInstance) {
  const promotionTargetLinkController = new PromotionTargetLinkController();

  // GET /v1/promotion-target-link - Get all promotion target links with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all promotion target links with pagination and filtering',
      tags: ['Promotion Target Links'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          promotion_id: { type: 'string', description: 'Filter by promotion ID' },
          target_type: { type: 'string', description: 'Filter by target type' },
          target_id: { type: 'string', description: 'Filter by target ID' },
          target_label: { type: 'string', description: 'Filter by target label' },
          apply_scope: { type: 'string', description: 'Filter by apply scope' },
          is_active: { type: 'string', description: 'Filter by active status (true/false)' },
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
                properties: {
                  id: { type: 'number', description: 'Target link ID' },
                  promotion_id: { type: 'number', nullable: true, description: 'Promotion ID' },
                  target_type: { type: 'string', nullable: true, description: 'Target type' },
                  target_id: { type: 'string', nullable: true, description: 'Target ID' },
                  target_label: { type: 'string', nullable: true, description: 'Target label' },
                  apply_scope: { type: 'string', nullable: true, description: 'Apply scope' },
                  is_active: { type: 'boolean', nullable: true, description: 'Active status' },
                  createddate: { type: 'number', description: 'Creation timestamp' },
                  modifieddate: { type: 'number', description: 'Modification timestamp' },
                },
                additionalProperties: true
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
            meta: {
              type: 'object',
              properties: {
                filters: { type: 'array', items: { type: 'string' } },
                total: { type: 'number' },
                filtered: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
  }, promotionTargetLinkController.getPromotionTargetLinks.bind(promotionTargetLinkController));

  // GET /v1/promotion-target-link/:id - Get promotion target link by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get promotion target link by ID',
      tags: ['Promotion Target Links'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Promotion target link ID' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              additionalProperties: true
            },
            message: { type: 'string' },
          },
        },
      },
    },
  }, promotionTargetLinkController.getPromotionTargetLink.bind(promotionTargetLinkController));

  // POST /v1/promotion-target-link - Create new promotion target link
  fastify.post('/', {
    schema: {
      description: 'Create a new promotion target link',
      tags: ['Promotion Target Links'],
      body: {
        type: 'object',
        properties: {
          promotion_id: { type: 'number', description: 'Promotion ID' },
          target_type: { type: 'string', description: 'Target type' },
          target_id: { type: 'string', description: 'Target ID' },
          target_label: { type: 'string', description: 'Target label' },
          apply_scope: { type: 'string', description: 'Apply scope' },
          is_active: { type: 'boolean', description: 'Active status' },
        },
        additionalProperties: true
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
      },
    },
  }, promotionTargetLinkController.createPromotionTargetLink.bind(promotionTargetLinkController));

  // PUT /v1/promotion-target-link/:id - Update promotion target link
  fastify.put('/:id', {
    schema: {
      description: 'Update promotion target link by ID',
      tags: ['Promotion Target Links'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Promotion target link ID' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          promotion_id: { type: 'number', description: 'Promotion ID' },
          target_type: { type: 'string', description: 'Target type' },
          target_id: { type: 'string', description: 'Target ID' },
          target_label: { type: 'string', description: 'Target label' },
          apply_scope: { type: 'string', description: 'Apply scope' },
          is_active: { type: 'boolean', description: 'Active status' },
        },
        additionalProperties: true
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
      },
    },
  }, promotionTargetLinkController.updatePromotionTargetLink.bind(promotionTargetLinkController));

  // DELETE /v1/promotion-target-link/:id - Delete promotion target link
  fastify.delete('/:id', {
    schema: {
      description: 'Delete promotion target link by ID',
      tags: ['Promotion Target Links'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Promotion target link ID' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'null' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, promotionTargetLinkController.deletePromotionTargetLink.bind(promotionTargetLinkController));

  // POST /v1/promotion-target-link/upsert - Create or update promotion target link
  fastify.post('/upsert', {
    schema: {
      description: 'Create or update promotion target link (upsert)',
      tags: ['Promotion Target Links'],
      body: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Target link ID (for update)' },
          promotion_id: { type: 'number', description: 'Promotion ID' },
          target_type: { type: 'string', description: 'Target type' },
          target_id: { type: 'string', description: 'Target ID' },
          target_label: { type: 'string', description: 'Target label' },
          apply_scope: { type: 'string', description: 'Apply scope' },
          is_active: { type: 'boolean', description: 'Active status' },
        },
        additionalProperties: true
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
      },
    },
  }, promotionTargetLinkController.upsertPromotionTargetLink.bind(promotionTargetLinkController));
} 
