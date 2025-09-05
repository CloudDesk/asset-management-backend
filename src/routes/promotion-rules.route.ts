import { FastifyInstance } from 'fastify';
import { PromotionRulesController } from '../controllers/promotion-rules.controller.js';

export async function promotionRulesRoutes(fastify: FastifyInstance) {
  const promotionRulesController = new PromotionRulesController();

  // GET /v1/promotion-rules - Get all promotion rules with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all promotion rules with pagination and filtering',
      tags: ['Promotion Rules'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          promotion_id: { type: 'string', description: 'Filter by promotion ID' },
          rule_group: { type: 'string', description: 'Filter by rule group' },
          logic_group: { type: 'string', description: 'Filter by logic group' },
          condition_key: { type: 'string', description: 'Filter by condition key' },
          operator: { type: 'string', description: 'Filter by operator' },
          condition_value: { type: 'string', description: 'Filter by condition value' },
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
                  id: { type: 'number', description: 'Rule ID' },
                  promotion_id: { type: 'number', nullable: true, description: 'Promotion ID' },
                  rule_group: { type: 'string', nullable: true, description: 'Rule group' },
                  logic_group: { type: 'string', nullable: true, description: 'Logic group' },
                  condition_key: { type: 'string', nullable: true, description: 'Condition key' },
                  operator: { type: 'string', nullable: true, description: 'Operator' },
                  condition_value: { type: 'string', nullable: true, description: 'Condition value' },
                  is_active: { type: 'boolean', nullable: true, description: 'Active status' },
                  rule_order: { type: 'number', nullable: true, description: 'Rule order' },
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
  }, promotionRulesController.getPromotionRules.bind(promotionRulesController));

  // GET /v1/promotion-rules/:id - Get promotion rule by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get promotion rule by ID',
      tags: ['Promotion Rules'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Promotion rule ID' },
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
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        404: {
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
  }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      
      // Validate ID format
      if (!id || id.trim() === '' || !/^\d+$/.test(id)) {
        const errorResponse = {
          success: false,
          message: 'Invalid promotion rule ID format. ID must be an integer.',
          details: `The provided ID '${id}' is not a valid integer format.`,
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }
      
      const result = await promotionRulesController.getPromotionRule(request, reply);
      return result;
    } catch (error: any) {
      console.log('=== PROMOTION RULE GET ERROR:', error.message);
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Promotion rule with ID ${request.params.id} not found`,
          details: 'The requested promotion rule could not be found',
          statusCode: 404
        };
        return reply.code(404).send(errorResponse);
      }
      
      const errorResponse = {
        success: false,
        message: 'Internal server error',
        details: 'Something went wrong while retrieving the promotion rule',
        statusCode: 500
      };
      return reply.code(500).send(errorResponse);
    }
  });

  // POST /v1/promotion-rules - Create new promotion rule
  fastify.post('/', {
    schema: {
      description: 'Create a new promotion rule',
      tags: ['Promotion Rules'],
      body: {
        type: 'object',
        properties: {
          promotion_id: { type: 'number', description: 'Promotion ID' },
          rule_group: { type: 'string', description: 'Rule group' },
          logic_group: { type: 'string', description: 'Logic group' },
          condition_key: { type: 'string', description: 'Condition key' },
          operator: { type: 'string', description: 'Operator' },
          condition_value: { type: 'string', description: 'Condition value' },
          is_active: { type: 'boolean', description: 'Active status' },
          rule_order: { type: 'number', description: 'Rule order' },
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
        400: {
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
  }, async (request: any, reply: any) => {
    try {
      const result = await promotionRulesController.createPromotionRule(request, reply);
      return result;
    } catch (error: any) {
      console.log('=== PROMOTION RULE CREATE ERROR:', error.message);
      
      // Handle validation errors
      if (error.message.includes('required') || 
          error.message.includes('cannot be empty') ||
          error.message.includes('must be')) {
        const errorResponse = {
          success: false,
          message: 'Validation failed',
          details: error.message,
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }
      
      // Handle foreign key constraint errors
      if (error.message.includes('Invalid field reference') || 
          error.message.includes('foreign key constraint')) {
        const errorResponse = {
          success: false,
          message: 'Invalid promotion ID',
          details: 'The specified promotion does not exist',
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }
      
      const errorResponse = {
        success: false,
        message: 'Internal server error',
        details: 'Something went wrong while creating the promotion rule',
        statusCode: 500
      };
      return reply.code(500).send(errorResponse);
    }
  });

  // PUT /v1/promotion-rules/:id - Update promotion rule
  fastify.put('/:id', {
    schema: {
      description: 'Update promotion rule by ID',
      tags: ['Promotion Rules'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Promotion rule ID' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          promotion_id: { type: 'number', description: 'Promotion ID' },
          rule_group: { type: 'string', description: 'Rule group' },
          logic_group: { type: 'string', description: 'Logic group' },
          condition_key: { type: 'string', description: 'Condition key' },
          operator: { type: 'string', description: 'Operator' },
          condition_value: { type: 'string', description: 'Condition value' },
          is_active: { type: 'boolean', description: 'Active status' },
          rule_order: { type: 'number', description: 'Rule order' },
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
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        404: {
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
  }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      
      // Validate ID format
      if (!id || id.trim() === '' || !/^\d+$/.test(id)) {
        const errorResponse = {
          success: false,
          message: 'Invalid promotion rule ID format. ID must be an integer.',
          details: `The provided ID '${id}' is not a valid integer format.`,
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }
      
      const result = await promotionRulesController.updatePromotionRule(request, reply);
      return result;
    } catch (error: any) {
      console.log('=== PROMOTION RULE UPDATE ERROR:', error.message);
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Promotion rule with ID ${request.params.id} not found`,
          details: 'The promotion rule you are trying to update does not exist',
          statusCode: 404
        };
        return reply.code(404).send(errorResponse);
      }
      
      const errorResponse = {
        success: false,
        message: 'Internal server error',
        details: 'Something went wrong while updating the promotion rule',
        statusCode: 500
      };
      return reply.code(500).send(errorResponse);
    }
  });

  // DELETE /v1/promotion-rules/:id - Delete promotion rule
  fastify.delete('/:id', {
    schema: {
      description: 'Delete promotion rule by ID',
      tags: ['Promotion Rules'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Promotion rule ID' },
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
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        404: {
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
  }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      
      // Validate ID format
      if (!id || id.trim() === '' || !/^\d+$/.test(id)) {
        const errorResponse = {
          success: false,
          message: 'Invalid promotion rule ID format. ID must be an integer.',
          details: `The provided ID '${id}' is not a valid integer format.`,
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }
      
      const result = await promotionRulesController.deletePromotionRule(request, reply);
      return result;
    } catch (error: any) {
      console.log('=== PROMOTION RULE DELETE ERROR:', error.message);
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Promotion rule with ID ${request.params.id} not found`,
          details: 'The promotion rule you are trying to delete does not exist',
          statusCode: 404
        };
        return reply.code(404).send(errorResponse);
      }
      
      const errorResponse = {
        success: false,
        message: 'Internal server error',
        details: 'Something went wrong while deleting the promotion rule',
        statusCode: 500
      };
      return reply.code(500).send(errorResponse);
    }
  });

  // POST /v1/promotion-rules/upsert - Create or update promotion rule
  fastify.post('/upsert', {
    schema: {
      description: 'Create or update promotion rule (upsert)',
      tags: ['Promotion Rules'],
      body: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Rule ID (for update)' },
          promotion_id: { type: 'number', description: 'Promotion ID' },
          rule_group: { type: 'string', description: 'Rule group' },
          logic_group: { type: 'string', description: 'Logic group' },
          condition_key: { type: 'string', description: 'Condition key' },
          operator: { type: 'string', description: 'Operator' },
          condition_value: { type: 'string', description: 'Condition value' },
          is_active: { type: 'boolean', description: 'Active status' },
          rule_order: { type: 'number', description: 'Rule order' },
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
  }, promotionRulesController.upsertPromotionRule.bind(promotionRulesController));
} 
