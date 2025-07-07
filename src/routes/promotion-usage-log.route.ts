import { FastifyInstance } from 'fastify';
import { PromotionUsageLogController } from '../controllers/promotion-usage-log.controller.js';

export async function promotionUsageLogRoutes(fastify: FastifyInstance) {
  const promotionUsageLogController = new PromotionUsageLogController();

  // GET /v1/promotion-usage-log - Get all promotion usage logs with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all promotion usage logs with pagination and filtering',
      tags: ['Promotion Usage Logs'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          promotion_id: { type: 'string', description: 'Filter by promotion ID' },
          user_id: { type: 'string', description: 'Filter by user ID' },
          order_id: { type: 'string', description: 'Filter by order ID' },
          platform: { type: 'string', description: 'Filter by platform' },
          redemption_date_after: { type: 'string', description: 'Filter by redemption date after' },
          redemption_date_before: { type: 'string', description: 'Filter by redemption date before' },
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
                  id: { type: 'number', description: 'Usage log ID' },
                  promotion_id: { type: 'number', nullable: true, description: 'Promotion ID' },
                  user_id: { type: 'string', nullable: true, description: 'User ID' },
                  order_id: { type: 'string', nullable: true, description: 'Order ID' },
                  redemption_date: { type: 'string', nullable: true, description: 'Redemption date' },
                  discount_applied: { type: 'number', nullable: true, description: 'Discount applied' },
                  platform: { type: 'string', nullable: true, description: 'Platform' },
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
  }, promotionUsageLogController.getPromotionUsageLogs.bind(promotionUsageLogController));

  // GET /v1/promotion-usage-log/:id - Get promotion usage log by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get promotion usage log by ID',
      tags: ['Promotion Usage Logs'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Promotion usage log ID' },
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
  }, promotionUsageLogController.getPromotionUsageLog.bind(promotionUsageLogController));

  // POST /v1/promotion-usage-log - Create new promotion usage log
  fastify.post('/', {
    schema: {
      description: 'Create a new promotion usage log',
      tags: ['Promotion Usage Logs'],
      body: {
        type: 'object',
        properties: {
          promotion_id: { type: 'number', description: 'Promotion ID' },
          user_id: { type: 'string', description: 'User ID' },
          order_id: { type: 'string', description: 'Order ID' },
          redemption_date: { type: 'string', format: 'date-time', description: 'Redemption date' },
          discount_applied: { type: 'number', description: 'Discount applied' },
          platform: { type: 'string', description: 'Platform' },
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
  }, promotionUsageLogController.createPromotionUsageLog.bind(promotionUsageLogController));

  // PUT /v1/promotion-usage-log/:id - Update promotion usage log
  fastify.put('/:id', {
    schema: {
      description: 'Update promotion usage log by ID',
      tags: ['Promotion Usage Logs'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Promotion usage log ID' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          promotion_id: { type: 'number', description: 'Promotion ID' },
          user_id: { type: 'string', description: 'User ID' },
          order_id: { type: 'string', description: 'Order ID' },
          redemption_date: { type: 'string', format: 'date-time', description: 'Redemption date' },
          discount_applied: { type: 'number', description: 'Discount applied' },
          platform: { type: 'string', description: 'Platform' },
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
  }, promotionUsageLogController.updatePromotionUsageLog.bind(promotionUsageLogController));

  // DELETE /v1/promotion-usage-log/:id - Delete promotion usage log
  fastify.delete('/:id', {
    schema: {
      description: 'Delete promotion usage log by ID',
      tags: ['Promotion Usage Logs'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Promotion usage log ID' },
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
  }, promotionUsageLogController.deletePromotionUsageLog.bind(promotionUsageLogController));

  // POST /v1/promotion-usage-log/upsert - Create or update promotion usage log
  fastify.post('/upsert', {
    schema: {
      description: 'Create or update promotion usage log (upsert)',
      tags: ['Promotion Usage Logs'],
      body: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Usage log ID (for update)' },
          promotion_id: { type: 'number', description: 'Promotion ID' },
          user_id: { type: 'string', description: 'User ID' },
          order_id: { type: 'string', description: 'Order ID' },
          redemption_date: { type: 'string', format: 'date-time', description: 'Redemption date' },
          discount_applied: { type: 'number', description: 'Discount applied' },
          platform: { type: 'string', description: 'Platform' },
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
  }, promotionUsageLogController.upsertPromotionUsageLog.bind(promotionUsageLogController));
} 