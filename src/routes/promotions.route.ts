import { FastifyInstance } from 'fastify';
import { PromotionsController } from '../controllers/promotions.controller.js';
import { PromotionEvaluationController } from '../controllers/promotion-evaluation.controller.js';
import { PromotionRedemptionController } from '../controllers/promotion-redemption.controller.js';
import { PromotionAssignmentController } from '../controllers/promotion-assignment.controller.js';

export async function promotionsRoutes(fastify: FastifyInstance) {
  const promotionsController = new PromotionsController();
  const evaluationController = new PromotionEvaluationController();
  const redemptionController = new PromotionRedemptionController();
  const assignmentController = new PromotionAssignmentController();

  // GET /v1/promotions - Get all promotions with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all promotions with pagination and filtering',
      tags: ['Promotions'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          search: { type: 'string', description: 'Search promotions by name, type, code, or status (case-insensitive partial match)' },
          userid: { type: 'string', description: 'Filter by user ID for personalized promotions' },
          channel: { type: 'string', description: 'Channel (web, mobile, etc.)' },
          geo: { type: 'string', description: 'Geographic region' },
          current_date: { type: 'string', format: 'date-time', description: 'Current date for filtering' },
          name: { type: 'string', description: 'Filter by promotion name' },
          type: { type: 'string', description: 'Filter by promotion type' },
          code: { type: 'string', description: 'Filter by promotion code' },
          auto_apply: { type: 'string', description: 'Filter by auto-apply status (true/false)' },
          status: { type: 'string', description: 'Filter by promotion status' },
          priority: { type: 'string', description: 'Filter by priority' },
          visibility: { type: 'string', description: 'Filter by visibility' },
          applicable_channel: { type: 'string', enum: ['all', 'web', 'mobile'], description: 'Filter by applicable app channel' },
          application_mode: { type: 'string', enum: ['automatic', 'click_to_apply', 'code_entry'], description: 'Filter by how customers apply the promotion' },
          stackable: { type: 'string', description: 'Filter by stackable status (true/false)' },
          budget_min: { type: 'string', description: 'Filter by minimum budget' },
          budget_max: { type: 'string', description: 'Filter by maximum budget' },
          timezone: { type: 'string', description: 'Filter by timezone' },
          discount_type: { type: 'string', description: 'Filter by discount type' },
          discount_value_min: { type: 'string', description: 'Filter by minimum discount value' },
          discount_value_max: { type: 'string', description: 'Filter by maximum discount value' },
          start_date_after: { type: 'string', description: 'Filter by start date after' },
          start_date_before: { type: 'string', description: 'Filter by start date before' },
          end_date_after: { type: 'string', description: 'Filter by end date after' },
          end_date_before: { type: 'string', description: 'Filter by end date before' },
          admin_mode: { type: 'string', description: 'Admin mode flag to bypass default filters' },
        },
        additionalProperties: true, // Allow any query parameters for dynamic filtering
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
                  id: { type: 'number', description: 'Promotion ID' },
                  name: { type: 'string', nullable: true, description: 'Promotion name' },
                  description: { type: 'string', nullable: true, description: 'Promotion description' },
                  type: { type: 'string', nullable: true, description: 'Promotion type' },
                  code: { type: 'string', nullable: true, description: 'Promotion code' },
                  auto_apply: { type: 'boolean', nullable: true, description: 'Auto-apply status' },
                  start_date: { type: 'number', nullable: true, description: 'Start date as Unix timestamp' },
                  end_date: { type: 'number', nullable: true, description: 'End date as Unix timestamp' },
                  status: { type: 'string', nullable: true, description: 'Promotion status' },
                  priority: { type: 'number', nullable: true, description: 'Priority' },
                  visibility: { type: 'string', nullable: true, description: 'Visibility' },
                  applicable_channel: { type: 'string', enum: ['all', 'web', 'mobile'], description: 'Applicable app channel' },
                  application_mode: { type: 'string', enum: ['automatic', 'click_to_apply', 'code_entry'], description: 'Promotion application method' },
                  max_redemptions: { type: 'number', nullable: true, description: 'Maximum redemptions' },
                  per_user_limit: { type: 'number', nullable: true, description: 'Per user limit' },
                  stackable: { type: 'boolean', nullable: true, description: 'Stackable status' },
                  budget: { type: 'number', nullable: true, description: 'Promotion budget' },
                  timezone: { type: 'string', nullable: true, description: 'Timezone' },
                  evaluation_expiry_minutes: { type: 'number', nullable: true, description: 'Evaluation expiry minutes' },
                  discount_type: { type: 'string', nullable: true, description: 'Discount type' },
                  discount_value: { type: 'number', nullable: true, description: 'Discount value' },
                  conditions: { type: 'array', nullable: true, description: 'Promotion conditions' },
                  action: {
                    type: 'object',
                    nullable: true,
                    description: 'Promotion action object',
                    properties: {
                      type: { type: 'string' },
                      value: { anyOf: [{ type: 'number' }, { type: 'boolean' }] },
                      max_discount: { type: 'number' },
                      buy_quantity: { type: 'number' },
                      get_quantity: { type: 'number' },
                      product_ids: { type: 'array', items: { type: 'string' } },
                      free_product_id: { type: 'string' },
                      min_purchase: { type: 'number' },
                      max_free_items: { type: 'number' },
                      min_order_value: { type: 'number' }
                    },
                    additionalProperties: true
                  },
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
                adminMode: { type: 'boolean' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, promotionsController.getPromotions.bind(promotionsController));

  fastify.get('/mine', promotionsController.getMyPromotions);
  fastify.get('/public', promotionsController.getPublicPromotions);




  // GET /v1/promotions/:id - Get promotion by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get promotion by ID',
      tags: ['Promotions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Promotion ID' },
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
  }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;

      // Validate ID format
      if (!id || id.trim() === '' || !/^\d+$/.test(id)) {
        const errorResponse = {
          success: false,
          message: 'Invalid promotion ID format. ID must be an integer.',
          details: `The provided ID '${id}' is not a valid integer format.`,
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }

      // Call the service method directly
      const promotion = await promotionsController.promotionsService.findById(id);

      const response = {
        success: true,
        message: 'Promotion retrieved successfully',
        data: promotion
      };
      return reply.code(200).send(response);
    } catch (error: any) {
      console.log('=== PROMOTION GET ERROR:', error.message);

      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Promotion with ID ${request.params.id} not found`,
          details: 'The requested promotion could not be found',
          statusCode: 404
        };
        return reply.code(404).send(errorResponse);
      }

      // Default error response
      const errorResponse = {
        success: false,
        message: 'Internal server error',
        details: 'Something went wrong on the server',
        statusCode: 500
      };
      return reply.code(500).send(errorResponse);
    }
  });

  // POST /v1/promotions - Create new promotion
  fastify.post('/', {
    schema: {
      description: 'Create a new promotion',
      tags: ['Promotions'],
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 255, description: 'Promotion name' },
          description: { type: 'string', description: 'Promotion description' },
          type: {
            type: 'string',
            enum: ['PERCENT_OFF_ITEM', 'FIXED_AMOUNT_OFF_ITEM', 'BOGO', 'PERCENT_OFF_CART', 'FIXED_AMOUNT_OFF_CART', 'FREE_SHIPPING', 'FREE_PRODUCT'],
            description: 'Promotion type'
          },
          code: { type: 'string', description: 'Promotion code' },
          auto_apply: { type: 'boolean', description: 'Auto-apply status' },
          start_date: { type: 'number', description: 'Start date as Unix timestamp (seconds since epoch)' },
          end_date: { type: 'number', description: 'End date as Unix timestamp (seconds since epoch)' },
          status: { type: 'string', enum: ['active', 'inactive'], description: 'Configured status. Expired is derived from Valid To.' },
          priority: { type: 'number', description: 'Priority' },
          visibility: { type: 'string', enum: ['public', 'private'], description: 'Visibility' },
          applicable_channel: { type: 'string', enum: ['all', 'web', 'mobile'], default: 'all', description: 'Applicable app channel' },
          application_mode: { type: 'string', enum: ['automatic', 'click_to_apply', 'code_entry'], default: 'click_to_apply', description: 'How customers apply the promotion' },
          max_redemptions: { type: 'number', description: 'Maximum redemptions' },
          per_user_limit: { type: 'number', description: 'Per user limit' },
          stackable: { type: 'boolean', description: 'Stackable status' },
          budget: { type: 'number', description: 'Promotion budget' },
          timezone: { type: 'string', description: 'Timezone' },
          evaluation_expiry_minutes: { type: 'number', description: 'Evaluation expiry minutes' },
          // Frontend-specific fields (for backward compatibility)
          discount_type: { type: 'string', description: 'Discount type (auto-mapped from promotion type)' },
          discount_value: { type: 'number', description: 'Discount value' },
          max_discount_cap: { type: 'number', description: 'Maximum discount cap (for percentage discounts)' },
          buy_quantity: { type: 'number', description: 'Buy quantity (for BOGO)' },
          get_quantity: { type: 'number', description: 'Get quantity (for BOGO)' },
          product_ids: { type: 'array', items: { type: 'string' }, description: 'Product IDs (for BOGO)' },
          free_product_id: { type: 'string', description: 'Free product ID (for FREE_PRODUCT)' },
          minimum_purchase: { type: 'number', description: 'Minimum purchase amount (for FREE_PRODUCT)' },
          max_free_items: { type: 'number', description: 'Maximum free items per order' },
          minimum_order_value: { type: 'number', description: 'Minimum order value (for FREE_SHIPPING)' },
          product_price: { type: 'number', description: 'Product price (for budget calculations)' },
          conditions: {
            type: 'array',
            description: 'Promotion conditions',
            items: {
              type: 'object',
              properties: {
                attribute: { type: 'string' },
                operator: { type: 'string', enum: ['GTE', 'GT', 'LTE', 'LT', 'EQ', 'IN', 'NOT_IN', 'CONTAINS', 'DATE_ADD_DAYS', 'DATE_SUBTRACT_DAYS'] },
                comparison: { type: 'string', enum: ['GTE', 'GT', 'LTE', 'LT', 'EQ'] },
                compare_with: { type: 'string' },
                value: {
                  description: 'Condition value - can be string, number, or array of strings',
                  anyOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'array', items: { type: 'string' } },
                    { type: 'boolean' }
                  ]
                }
              }
            }
          },
          // New single action object (recommended format)
          action: {
            type: 'object',
            description: 'Single promotion action object',
            properties: {
              type: { type: 'string', enum: ['PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FREE_SHIPPING', 'BOGO', 'FREE_PRODUCT'] },
              value: {
                description: 'Action value - can be number or boolean',
                anyOf: [
                  { type: 'number' },
                  { type: 'boolean' }
                ]
              },
              max_discount: { type: 'number', description: 'Maximum discount cap (for PERCENT_OFF)' },
              buy_quantity: { type: 'number', description: 'Buy quantity (for BOGO)' },
              get_quantity: { type: 'number', description: 'Get quantity (for BOGO)' },
              product_ids: { type: 'array', items: { type: 'string' }, description: 'Product IDs (for BOGO)' },
              free_product_id: { type: 'string', description: 'Free product ID (for FREE_PRODUCT)' },
              min_purchase: { type: 'number', description: 'Minimum purchase amount (for FREE_PRODUCT)' },
              max_free_items: { type: 'number', description: 'Maximum free items per order' },
              min_order_value: { type: 'number', description: 'Minimum order value (for FREE_SHIPPING)' }
            }
          },
          // Legacy actions array (deprecated but still supported)
          actions: {
            type: 'array',
            description: 'Legacy promotion actions array (deprecated - use action object instead)',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FREE_SHIPPING', 'BOGO'] },
                value: {
                  description: 'Action value - can be number or boolean',
                  anyOf: [
                    { type: 'number' },
                    { type: 'boolean' }
                  ]
                }
              }
            }
          },
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
  }, async (request: any, reply: any) => {
    try {
      // Validate required fields
      const body = request.body || {};

      if (body.name !== undefined && (!body.name || body.name.trim().length === 0)) {
        const errorResponse = {
          success: false,
          message: 'Validation failed: Promotion name cannot be empty',
          details: 'The promotion name field is required and cannot be empty',
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }

      const promotion = await promotionsController.promotionsService.create(body);

      const response = {
        success: true,
        message: 'Promotion created successfully',
        data: promotion
      };
      return reply.code(201).send(response);
    } catch (error: any) {
      console.log('=== PROMOTION CREATE ERROR:', error.message);

      if (error.message.includes('Validation failed') || error.message.includes('validation')) {
        const errorResponse = {
          success: false,
          message: 'Validation failed',
          details: error.message,
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }

      if (error.message.includes('Database') || error.message.includes('database')) {
        const errorResponse = {
          success: false,
          message: 'Database operation failed',
          details: 'Could not create promotion. Please check your data and try again.',
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }

      // Default error response
      const errorResponse = {
        success: false,
        message: 'Internal server error',
        details: 'Something went wrong while creating the promotion',
        statusCode: 500
      };
      return reply.code(500).send(errorResponse);
    }
  });

  // PUT /v1/promotions/:id - Update promotion
  fastify.put('/:id', {
    schema: {
      description: 'Update promotion by ID',
      tags: ['Promotions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Promotion ID' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 255, description: 'Promotion name' },
          description: { type: 'string', description: 'Promotion description' },
          type: {
            type: 'string',
            enum: ['PERCENT_OFF_ITEM', 'FIXED_AMOUNT_OFF_ITEM', 'BOGO', 'PERCENT_OFF_CART', 'FIXED_AMOUNT_OFF_CART', 'FREE_SHIPPING', 'FREE_PRODUCT'],
            description: 'Promotion type'
          },
          code: { type: 'string', description: 'Promotion code' },
          auto_apply: { type: 'boolean', description: 'Auto-apply status' },
          start_date: { type: 'number', description: 'Start date as Unix timestamp (seconds since epoch)' },
          end_date: { type: 'number', description: 'End date as Unix timestamp (seconds since epoch)' },
          status: { type: 'string', enum: ['active', 'inactive'], description: 'Configured status. Expired is derived from Valid To.' },
          priority: { type: 'number', description: 'Priority' },
          visibility: { type: 'string', enum: ['public', 'private'], description: 'Visibility' },
          applicable_channel: { type: 'string', enum: ['all', 'web', 'mobile'], description: 'Applicable app channel' },
          application_mode: { type: 'string', enum: ['automatic', 'click_to_apply', 'code_entry'], description: 'How customers apply the promotion' },
          max_redemptions: { type: 'number', description: 'Maximum redemptions' },
          per_user_limit: { type: 'number', description: 'Per user limit' },
          stackable: { type: 'boolean', description: 'Stackable status' },
          budget: { type: 'number', description: 'Promotion budget' },
          timezone: { type: 'string', description: 'Timezone' },
          evaluation_expiry_minutes: { type: 'number', description: 'Evaluation expiry minutes' },
          // Frontend-specific fields (for backward compatibility)
          discount_type: { type: 'string', description: 'Discount type (auto-mapped from promotion type)' },
          discount_value: { type: 'number', description: 'Discount value' },
          max_discount_cap: { type: 'number', description: 'Maximum discount cap (for percentage discounts)' },
          buy_quantity: { type: 'number', description: 'Buy quantity (for BOGO)' },
          get_quantity: { type: 'number', description: 'Get quantity (for BOGO)' },
          product_ids: { type: 'array', items: { type: 'string' }, description: 'Product IDs (for BOGO)' },
          free_product_id: { type: 'string', description: 'Free product ID (for FREE_PRODUCT)' },
          minimum_purchase: { type: 'number', description: 'Minimum purchase amount (for FREE_PRODUCT)' },
          max_free_items: { type: 'number', description: 'Maximum free items per order' },
          minimum_order_value: { type: 'number', description: 'Minimum order value (for FREE_SHIPPING)' },
          product_price: { type: 'number', description: 'Product price (for budget calculations)' },
          conditions: {
            type: 'array',
            description: 'Promotion conditions',
            items: {
              type: 'object',
              properties: {
                attribute: { type: 'string' },
                operator: { type: 'string', enum: ['GTE', 'GT', 'LTE', 'LT', 'EQ', 'IN', 'NOT_IN', 'CONTAINS', 'DATE_ADD_DAYS', 'DATE_SUBTRACT_DAYS'] },
                comparison: { type: 'string', enum: ['GTE', 'GT', 'LTE', 'LT', 'EQ'] },
                compare_with: { type: 'string' },
                value: {
                  description: 'Condition value - can be string, number, or array of strings',
                  anyOf: [
                    { type: 'string' },
                    { type: 'number' },
                    { type: 'array', items: { type: 'string' } },
                    { type: 'boolean' }
                  ]
                }
              }
            }
          },
          // New single action object (recommended format)
          action: {
            type: 'object',
            description: 'Single promotion action object',
            properties: {
              type: { type: 'string', enum: ['PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FREE_SHIPPING', 'BOGO', 'FREE_PRODUCT'] },
              value: {
                description: 'Action value - can be number or boolean',
                anyOf: [
                  { type: 'number' },
                  { type: 'boolean' }
                ]
              },
              max_discount: { type: 'number', description: 'Maximum discount cap (for PERCENT_OFF)' },
              buy_quantity: { type: 'number', description: 'Buy quantity (for BOGO)' },
              get_quantity: { type: 'number', description: 'Get quantity (for BOGO)' },
              product_ids: { type: 'array', items: { type: 'string' }, description: 'Product IDs (for BOGO)' },
              free_product_id: { type: 'string', description: 'Free product ID (for FREE_PRODUCT)' },
              min_purchase: { type: 'number', description: 'Minimum purchase amount (for FREE_PRODUCT)' },
              max_free_items: { type: 'number', description: 'Maximum free items per order' },
              min_order_value: { type: 'number', description: 'Minimum order value (for FREE_SHIPPING)' }
            }
          },
          // Legacy actions array (deprecated but still supported)
          actions: {
            type: 'array',
            description: 'Legacy promotion actions array (deprecated - use action object instead)',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FREE_SHIPPING', 'BOGO'] },
                value: {
                  description: 'Action value - can be number or boolean',
                  anyOf: [
                    { type: 'number' },
                    { type: 'boolean' }
                  ]
                }
              }
            }
          },
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
  }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      const body = request.body || {};

      // Validate ID format
      if (!id || id.trim() === '' || !/^\d+$/.test(id)) {
        const errorResponse = {
          success: false,
          message: 'Invalid promotion ID format. ID must be an integer.',
          details: `The provided ID '${id}' is not a valid integer format.`,
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }

      // Validate fields if provided
      if (body.name !== undefined && (!body.name || body.name.trim().length === 0)) {
        const errorResponse = {
          success: false,
          message: 'Validation failed: Promotion name cannot be empty',
          details: 'The promotion name field cannot be empty if provided',
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }

      const promotion = await promotionsController.promotionsService.update(id, body);

      const response = {
        success: true,
        message: 'Promotion updated successfully',
        data: promotion
      };
      return reply.code(200).send(response);
    } catch (error: any) {
      console.log('=== PROMOTION UPDATE ERROR:', error.message);

      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Promotion with ID ${request.params.id} not found`,
          details: 'The promotion you are trying to update does not exist',
          statusCode: 404
        };
        return reply.code(404).send(errorResponse);
      }

      if (error.message.includes('Validation failed') || error.message.includes('validation')) {
        const errorResponse = {
          success: false,
          message: 'Validation failed',
          details: error.message,
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }

      // Default error response
      const errorResponse = {
        success: false,
        message: 'Internal server error',
        details: 'Something went wrong while updating the promotion',
        statusCode: 500
      };
      return reply.code(500).send(errorResponse);
    }
  });

  fastify.post('/:id/vouchers', assignmentController.createVoucher);
  fastify.get('/:id/vouchers', assignmentController.listVouchers);
  fastify.patch('/vouchers/:assignmentId', assignmentController.updateVoucher);

  // DELETE /v1/promotions/:id - Delete promotion
  fastify.delete('/:id', {
    schema: {
      description: 'Delete promotion by ID',
      tags: ['Promotions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Promotion ID' },
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
  }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;

      // Validate ID format
      if (!id || id.trim() === '' || !/^\d+$/.test(id)) {
        const errorResponse = {
          success: false,
          message: 'Invalid promotion ID format. ID must be an integer.',
          details: `The provided ID '${id}' is not a valid integer format.`,
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }

      await promotionsController.promotionsService.delete(id);

      const response = {
        success: true,
        message: 'Promotion deleted successfully',
        data: null
      };
      return reply.code(200).send(response);
    } catch (error: any) {
      console.log('=== PROMOTION DELETE ERROR:', error.message);

      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Promotion with ID ${request.params.id} not found`,
          details: 'The promotion you are trying to delete does not exist',
          statusCode: 404
        };
        return reply.code(404).send(errorResponse);
      }

      // Default error response
      const errorResponse = {
        success: false,
        message: 'Internal server error',
        details: 'Something went wrong while deleting the promotion',
        statusCode: 500
      };
      return reply.code(500).send(errorResponse);
    }
  });

  // ========================================
  // PROMOTION EVALUATION ROUTES
  // ========================================

  // POST /v1/promotions/evaluate/specific - Evaluate specific promotion against user's cart
  fastify.post('/evaluate/specific', {
    schema: {
      description: 'Evaluate specific promotion against user cart with detailed breakdown',
      tags: ['Promotions', 'Evaluation'],
      body: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'User ID' },
          promotion_id: { type: 'number', description: 'Promotion ID to evaluate (optional if code provided)' },
          code: { type: 'string', description: 'Promotion code to evaluate (optional if promotion_id provided)' },
          cart_items: {
            type: 'array',
            description: 'User cart items (fetched from cart records)',
            items: {
              type: 'object',
              properties: {
                cart_record_id: { type: 'string', description: 'Cart record ID' },
                product_id: { type: 'string', description: 'Product ID' },
                quantity: { type: 'number', description: 'Quantity' },
                base_price: { type: 'number', description: 'Original product price' },
                product_discount: { type: 'number', description: 'Product-level discount' },
                price: { type: 'number', description: 'Final price after product discount only' },
                category: { type: 'string', description: 'Product category' },
                subcategory: { type: 'string', description: 'Product subcategory' },
                name: { type: 'string', description: 'Product name' }
              },
              required: ['cart_record_id', 'product_id', 'quantity', 'price', 'category']
            }
          },
          context: {
            type: 'object',
            properties: {
              channel: { type: 'string', enum: ['web', 'mobile', 'mobile_app'], description: 'Platform channel' },
              geo: { type: 'string', description: 'Geographic region' },
              payment_method: { type: 'string', description: 'Payment method' },
              user_agent: { type: 'string', description: 'User agent' },
              ip_address: { type: 'string', description: 'IP address' }
            },
            required: ['channel', 'geo']
          }
        },
        required: ['user_id', 'cart_items', 'context']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                evaluation_id: { type: 'string', description: 'Unique evaluation ID for redemption' },
                promotion_id: { type: 'number', description: 'Evaluated promotion ID' },
                promotion_name: { type: 'string', description: 'Promotion name' },
                is_eligible: { type: 'boolean', description: 'Whether promotion is applicable' },
                original_total: { type: 'number', description: 'Original cart total' },
                discounted_total: { type: 'number', description: 'Total after discount' },
                total_discount: { type: 'number', description: 'Total discount amount' },
                discount_breakdown: {
                  type: 'array',
                  description: 'Per-item discount breakdown',
                  items: {
                    type: 'object',
                    properties: {
                      cart_record_id: { type: 'string' },
                      product_id: { type: 'string' },
                      product_name: { type: 'string' },
                      category: { type: 'string' },
                      quantity: { type: 'number' },
                      original_price: { type: 'number' },
                      discount_per_item: { type: 'number' },
                      final_price_per_item: { type: 'number' },
                      total_discount: { type: 'number' }
                    }
                  }
                },
                ineligible_reason: { type: 'string', description: 'Reason if not eligible' },
                expires_at: { type: 'string', format: 'date-time', description: 'Evaluation expiry time' }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        }
      }
    }
  }, evaluationController.evaluatePromotion.bind(evaluationController));


  fastify.get('/evaluations/:id', {
    schema: {
      description: 'Get evaluation details by ID',
      tags: ['Promotions', 'Evaluation'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Evaluation ID (UUID)' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        }
      }
    }
  }, evaluationController.getEvaluation.bind(evaluationController));

  // ========================================
  // PROMOTION REDEMPTION ROUTES
  // ========================================

  // POST /v1/promotions/redeem - Redeem promotion after order placement
  fastify.post('/redeem', {
    schema: {
      description: 'Redeem promotion after successful order placement',
      tags: ['Promotions', 'Redemption'],
      body: {
        type: 'object',
        properties: {
          evaluation_id: { type: 'string', format: 'uuid', description: 'Evaluation ID' },
          order_id: { type: 'string', description: 'Order ID' },
          user_id: { type: 'string', description: 'User ID' }
        },
        required: ['evaluation_id', 'order_id', 'user_id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                redemption_id: { type: 'string' },
                order_id: { type: 'string' },
                total_discount_applied: { type: 'number' },
                redemption_details: { type: 'array' }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        }
      }
    }
  }, redemptionController.redeemPromotion.bind(redemptionController));

  // GET /v1/promotions/redemptions/order/:orderId - Get redemptions for order
  fastify.get('/redemptions/order/:orderId', {
    schema: {
      description: 'Get all redemptions for a specific order',
      tags: ['Promotions', 'Redemption'],
      params: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'Order ID' }
        },
        required: ['orderId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        }
      }
    }
  }, redemptionController.getRedemptionsForOrder.bind(redemptionController));

  // GET /v1/promotions/redemptions/:id - Get redemption by ID
  fastify.get('/redemptions/:id', {
    schema: {
      description: 'Get redemption details by ID',
      tags: ['Promotions', 'Redemption'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Redemption ID (UUID)' }
        },
        required: ['id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        }
      }
    }
  }, redemptionController.getRedemptionById.bind(redemptionController));

  // GET /v1/promotions/redemptions/user/:userId - Get user redemption history
  fastify.get('/redemptions/user/:userId', {
    schema: {
      description: 'Get user redemption history',
      tags: ['Promotions', 'Redemption'],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID' }
        },
        required: ['userId']
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                redemptions: { type: 'array' },
                pagination: { type: 'object' }
              }
            },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        }
      }
    }
  }, redemptionController.getUserRedemptionHistory.bind(redemptionController));

  // ========================================
  // PROMOTION OFFERS ROUTES
  // ========================================

  // POST /v1/promotions/offers - Get unified promotion offers (best + all eligible/ineligible)
  fastify.post('/offers', {
    schema: {
      description: 'Get unified promotion offers - best recommendation + all eligible/ineligible promotions',
      tags: ['Promotions', 'Offers'],
      body: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID' },
          cartItems: {
            type: 'array',
            description: 'Cart items',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string', description: 'Product ID' },
                qty: { type: 'number', description: 'Quantity' },
                category: { type: 'string', description: 'Product category' },
                price: { type: 'number', description: 'Product price' }
              },
              required: ['productId', 'qty', 'category', 'price']
            }
          },
          mode: {
            type: 'string',
            enum: ['phonepe', 'cod'],
            description: 'Payment mode'
          },
          channel: {
            type: 'string',
            enum: ['web', 'mobile', 'mobile_app'],
            description: 'Platform channel'
          },
          context: {
            type: 'object',
            properties: {
              channel: { type: 'string', enum: ['web', 'mobile', 'mobile_app'] },
              geo: { type: 'string' }
            }
          }
        },
        required: ['userId', 'cartItems', 'mode']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                bestCoupon: {
                  type: 'object',
                  nullable: true,
                  properties: {
                    promotion_id: { type: 'number' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    type: { type: 'string' },
                    code: { type: 'string' },
                    stackable: { type: 'boolean' },
                    priority: { type: 'number' },
                    start_date: { type: 'integer' },
                    end_date: { type: 'integer' },
                    promotionState: {
                      type: 'string',
                      enum: ['available', 'applied'],
                      description: 'State of promotion - available to apply or already applied'
                    },
                    evaluation_id: { type: 'string', description: 'Evaluation ID for remove operations (present if promotionState is applied)' },
                    applied_discount: { type: 'number', description: 'Applied discount amount (present if promotionState is applied)' },
                    discountInfo: {
                      type: 'object',
                      properties: {
                        originalTotal: { type: 'number' },
                        discountAmount: { type: 'number' },
                        discountedTotal: { type: 'number' },
                        discountPercentage: { type: 'number' },
                        savingsAmount: { type: 'number' }
                      }
                    },
                    cartInfo: {
                      type: 'object',
                      properties: {
                        totalItems: { type: 'number' },
                        categories: { type: 'array', items: { type: 'string' } },
                        totalValue: { type: 'number' }
                      }
                    },
                    mode: { type: 'string' },
                    expiresAt: { type: 'string' }
                  }
                },
                eligibleCoupons: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      promotion_id: { type: 'number' },
                      name: { type: 'string' },
                      description: { type: 'string' },
                      type: { type: 'string' },
                      code: { type: 'string' },
                      stackable: { type: 'boolean' },
                      priority: { type: 'number' },
                      start_date: { type: 'integer' },
                      end_date: { type: 'integer' },
                      discountInfo: {
                        type: 'object',
                        properties: {
                          originalTotal: { type: 'number' },
                          discountAmount: { type: 'number' },
                          discountedTotal: { type: 'number' },
                          discountPercentage: { type: 'number' },
                          savingsAmount: { type: 'number' }
                        }
                      },
                      cartInfo: {
                        type: 'object',
                        properties: {
                          totalItems: { type: 'number' },
                          categories: { type: 'array', items: { type: 'string' } },
                          totalValue: { type: 'number' }
                        }
                      },
                      mode: { type: 'string' },
                      expiresAt: { type: 'string' }
                    }
                  }
                },
                ineligibleCoupons: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      promotion_id: { type: 'number' },
                      name: { type: 'string' },
                      description: { type: 'string' },
                      type: { type: 'string' },
                      code: { type: 'string' },
                      stackable: { type: 'boolean' },
                      priority: { type: 'number' },
                      start_date: { type: 'integer' },
                      end_date: { type: 'integer' },
                      ineligibleReason: { type: 'string' },
                      ineligibleDetails: { type: 'object' }
                    }
                  }
                },
                stackablePromotions: {
                  type: 'array',
                  description: 'Stackable promotions user can apply or remove (includes both available and applied stackable promotions)',
                  items: {
                    type: 'object',
                    properties: {
                      promotion_id: { type: 'number' },
                      name: { type: 'string' },
                      description: { type: 'string' },
                      type: { type: 'string' },
                      code: { type: 'string' },
                      stackable: { type: 'boolean' },
                      priority: { type: 'number' },
                      start_date: { type: 'integer' },
                      end_date: { type: 'integer' },
                      promotionState: {
                        type: 'string',
                        enum: ['available', 'applied'],
                        description: 'State of promotion - available to apply or already applied'
                      },
                      evaluation_id: { type: 'string', description: 'Evaluation ID for remove operations (present if promotionState is applied)' },
                      applied_discount: { type: 'number', description: 'Applied discount amount (present if promotionState is applied)' },
                      action: {
                        type: 'object',
                        nullable: true,
                        description: 'Promotion action object',
                        properties: {
                          type: { type: 'string' },
                          value: { anyOf: [{ type: 'number' }, { type: 'boolean' }] },
                          max_discount: { type: 'number' },
                          buy_quantity: { type: 'number' },
                          get_quantity: { type: 'number' },
                          product_ids: { type: 'array', items: { type: 'string' } },
                          free_product_id: { type: 'string' },
                          min_purchase: { type: 'number' },
                          max_free_items: { type: 'number' },
                          min_order_value: { type: 'number' }
                        },
                        additionalProperties: true
                      },
                      discountInfo: {
                        type: 'object',
                        properties: {
                          originalTotal: { type: 'number' },
                          discountAmount: { type: 'number' },
                          discountedTotal: { type: 'number' },
                          discountPercentage: { type: 'number' },
                          savingsAmount: { type: 'number' }
                        }
                      },
                      cartInfo: {
                        type: 'object',
                        properties: {
                          totalItems: { type: 'number' },
                          categories: { type: 'array', items: { type: 'string' } },
                          totalValue: { type: 'number' }
                        }
                      },
                      mode: { type: 'string' },
                      expiresAt: { type: 'string' }
                    }
                  }
                },
                autoAppliedPromotions: {
                  type: 'array',
                  description: 'Promotions that are automatically applied (already active)',
                  items: {
                    type: 'object',
                    properties: {
                      promotion_id: { type: 'number' },
                      name: { type: 'string' },
                      description: { type: 'string' },
                      type: { type: 'string' },
                      code: { type: 'string' },
                      stackable: { type: 'boolean' },
                      priority: { type: 'number' },
                      start_date: { type: 'integer' },
                      end_date: { type: 'integer' },
                      action: {
                        type: 'object',
                        nullable: true,
                        description: 'Promotion action object',
                        properties: {
                          type: { type: 'string' },
                          value: { anyOf: [{ type: 'number' }, { type: 'boolean' }] },
                          max_discount: { type: 'number' },
                          buy_quantity: { type: 'number' },
                          get_quantity: { type: 'number' },
                          product_ids: { type: 'array', items: { type: 'string' } },
                          free_product_id: { type: 'string' },
                          min_purchase: { type: 'number' },
                          max_free_items: { type: 'number' },
                          min_order_value: { type: 'number' }
                        },
                        additionalProperties: true
                      },
                      discountInfo: {
                        type: 'object',
                        properties: {
                          originalTotal: { type: 'number' },
                          discountAmount: { type: 'number' },
                          discountedTotal: { type: 'number' },
                          discountPercentage: { type: 'number' },
                          savingsAmount: { type: 'number' }
                        }
                      },
                      cartInfo: {
                        type: 'object',
                        properties: {
                          totalItems: { type: 'number' },
                          categories: { type: 'array', items: { type: 'string' } },
                          totalValue: { type: 'number' }
                        }
                      },
                      mode: { type: 'string' },
                      expiresAt: { type: 'string' }
                    }
                  }
                },
                currentEvaluation: {
                  type: 'object',
                  nullable: true,
                  description: 'Current active evaluation with applied promotions details',
                  properties: {
                    evaluation_id: { type: 'string', description: 'Evaluation ID for promotion removal/modification' },
                    original_total: { type: 'number', description: 'Original cart total before promotions' },
                    discounted_total: { type: 'number', description: 'Final total after all promotions applied' },
                    applied_promotions: {
                      type: 'array',
                      description: 'Currently applied promotions with enhanced details',
                      items: {
                        type: 'object',
                        properties: {
                          promotion_id: { type: 'number' },
                          promotion_name: { type: 'string' },
                          promotion_type: { type: 'string' },
                          discount_amount: { type: 'number' },
                          is_auto: { type: 'boolean', description: 'Whether promotion was auto-applied' },
                          is_free_shipping: { type: 'boolean' },
                          is_stacked: { type: 'boolean', nullable: true, description: 'Whether promotion can stack with others' },

                          // BOGO-specific details
                          bogo_details: {
                            type: 'object',
                            nullable: true,
                            description: 'BOGO promotion details (present only for BOGO promotions)',
                            properties: {
                              buy_quantity: { type: 'number', description: 'How many items to buy' },
                              get_quantity: { type: 'number', description: 'How many items to get free' },
                              affected_products: {
                                type: 'array',
                                items: { type: 'string' },
                                description: 'Product IDs that got BOGO applied'
                              },
                              free_items_count: { type: 'number', description: 'Total free items granted' }
                            }
                          },

                          // FREE_PRODUCT-specific details
                          free_product_details: {
                            type: 'object',
                            nullable: true,
                            description: 'Free product details (present only for FREE_PRODUCT promotions)',
                            properties: {
                              free_product_id: { type: 'string', description: 'ID of the free product' },
                              max_free_items: { type: 'number', description: 'Maximum free items allowed' },
                              granted_items_count: { type: 'number', description: 'Number of free items actually granted' }
                            }
                          },

                          // Backward compatibility fields
                          breakdown: { type: 'object', nullable: true },
                          is_shipping_discount: { type: 'boolean', nullable: true },
                          shipping_info: { type: 'object', nullable: true }
                        },
                        additionalProperties: true
                      }
                    }
                  }
                },
                summary: {
                  type: 'object',
                  properties: {
                    totalPromotions: { type: 'number' },
                    eligibleCount: { type: 'number' },
                    ineligibleCount: { type: 'number' },
                    stackableCount: { type: 'number' },
                    autoAppliedCount: { type: 'number' },
                    appliedCount: { type: 'number', description: 'Number of currently applied promotions' },
                    hasActiveEvaluation: { type: 'boolean', description: 'Whether user has active evaluation' },
                    cartTotal: { type: 'number' },
                    cartItems: { type: 'number' },
                    categories: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        }
      }
    }
  }, promotionsController.getUnifiedPromotionOffers.bind(promotionsController));

  // POST /v1/promotions/evaluate/automatic - Evaluate automatic promotions
  fastify.post('/evaluate/automatic', {
    schema: {
      description: 'Evaluate automatic promotions based on cart total',
      tags: ['Promotions', 'Automatic'],
      body: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'User ID' },
          cart_items: {
            type: 'array',
            description: 'User cart items',
            items: {
              type: 'object',
              properties: {
                cart_record_id: { type: 'string', description: 'Cart record ID' },
                product_id: { type: 'string', description: 'Product ID' },
                quantity: { type: 'number', description: 'Quantity' },
                base_price: { type: 'number', description: 'Original product price' },
                product_discount: { type: 'number', description: 'Product-level discount' },
                price: { type: 'number', description: 'Final price after product discount only' },
                category: { type: 'string', description: 'Product category' },
                subcategory: { type: 'string', description: 'Product subcategory' },
                name: { type: 'string', description: 'Product name' }
              },
              required: ['cart_record_id', 'product_id', 'quantity', 'price', 'category']
            }
          },
          context: {
            type: 'object',
            properties: {
              channel: { type: 'string', enum: ['web', 'mobile', 'mobile_app'], description: 'Platform channel' },
              geo: { type: 'string', description: 'Geographic region' },
              payment_method: { type: 'string', description: 'Payment method' },
              user_agent: { type: 'string', description: 'User agent' },
              ip_address: { type: 'string', description: 'IP address' }
            },
            required: ['channel', 'geo']
          }
        },
        required: ['user_id', 'cart_items', 'context']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                evaluation_id: { type: 'string', description: 'Single evaluation ID for the cart session' },
                user_id: { type: 'string', description: 'User ID' },
                cart_signature: { type: 'string', description: 'Cart signature hash' },
                cart_data: { type: 'object', description: 'Cart data' },
                applied_promotions: {
                  type: 'array',
                  description: 'Array of applied automatic promotions',
                  items: {
                    type: 'object',
                    properties: {
                      promotion_id: { type: 'number' },
                      promotion_name: { type: 'string' },
                      promotion_type: { type: 'string' },
                      discount_amount: { type: 'number' },
                      is_auto: { type: 'boolean' },
                      is_free_shipping: { type: 'boolean', description: 'True if this is a free shipping promotion' },
                      is_stacked: { type: 'boolean', description: 'True if this promotion can stack with others' },

                      // BOGO-specific details
                      bogo_details: {
                        type: 'object',
                        nullable: true,
                        description: 'BOGO promotion details (present only for BOGO promotions)',
                        properties: {
                          buy_quantity: { type: 'number', description: 'How many items to buy' },
                          get_quantity: { type: 'number', description: 'How many items to get free' },
                          affected_products: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Product IDs that got BOGO applied'
                          },
                          free_items_count: { type: 'number', description: 'Total free items granted' }
                        }
                      },

                      // FREE_PRODUCT-specific details
                      free_product_details: {
                        type: 'object',
                        nullable: true,
                        description: 'Free product details (present only for FREE_PRODUCT promotions)',
                        properties: {
                          free_product_id: { type: 'string', description: 'ID of the free product' },
                          max_free_items: { type: 'number', description: 'Maximum free items allowed' },
                          granted_items_count: { type: 'number', description: 'Number of free items actually granted' }
                        }
                      },

                      // Backward compatibility fields
                      breakdown: { type: 'object', nullable: true },
                      is_shipping_discount: { type: 'boolean', nullable: true },
                      shipping_info: { type: 'object', nullable: true }
                    },
                    additionalProperties: true
                  }
                },
                status: { type: 'string', description: 'Evaluation status' },
                created_at: { type: 'string', description: 'UTC timestamp in milliseconds (BigInt)' },
                expires_at: { type: 'string', description: 'UTC timestamp in milliseconds (BigInt)' }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        }
      }
    }
  }, evaluationController.evaluateAutomaticPromotions.bind(evaluationController));

  // Validate the currently applied promotion before entering checkout.
  fastify.post('/evaluations/validate', {
    schema: {
      description: 'Revalidate a promotion evaluation against current dates, audience, limits, assignment, channel, and cart rules',
      tags: ['Promotions', 'Evaluation'],
      body: {
        type: 'object',
        properties: {
          evaluation_id: { type: 'string' },
          user_id: { type: 'string' }
        },
        required: ['evaluation_id', 'user_id'],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                is_valid: { type: 'boolean' },
                reason: { type: ['string', 'null'] },
                evaluation_id: { type: 'string' }
              },
              required: ['is_valid', 'evaluation_id']
            }
          }
        }
      }
    }
  }, evaluationController.validateEvaluationForCheckout.bind(evaluationController));

  // Get user's active evaluations
  fastify.get('/evaluations', {
    schema: {
      description: 'Get user\'s active evaluations',
      tags: ['Promotions'],
      querystring: {
        type: 'object',
        properties: {
          user_id: {
            type: 'string',
            description: 'User ID to get evaluations for'
          }
        },
        required: ['user_id'],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                evaluations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      evaluation_id: { type: 'string' },
                      user_id: { type: 'string' },
                      promotion_id: { type: 'number' },
                      original_total: { type: 'number' },
                      discounted_total: { type: 'number' },
                      applied_promotions: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            promotion_id: { type: 'number' },
                            promotion_name: { type: 'string' },
                            promotion_type: { type: 'string' },
                            discount_amount: { type: 'number' },
                            is_auto: { type: 'boolean' },
                            is_free_shipping: { type: 'boolean' },
                            is_stacked: { type: 'boolean', nullable: true },
                            bogo_details: { type: 'object', nullable: true },
                            free_product_details: { type: 'object', nullable: true }
                          },
                          additionalProperties: true
                        }
                      },
                      status: { type: 'string' },
                      created_at: { type: 'string' },
                      expires_at: { type: 'string' }
                    }
                  }
                },
                total_count: { type: 'number' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        }
      }
    }
  }, evaluationController.getUserActiveEvaluations.bind(evaluationController));

  // POST /v1/promotions/evaluate - Evaluate promotion or apply manual coupon
  fastify.post('/evaluate', {
    schema: {
      description: 'Evaluate specific promotion or apply manual coupon to existing evaluation',
      tags: ['Promotions', 'Evaluation'],
      body: {
        type: 'object',
        properties: {
          // Common fields
          user_id: { type: 'string', description: 'User ID (required for all operations)' },
          promotion_id: { type: 'number', description: 'Promotion ID to evaluate or apply' },
          code: { type: 'string', description: 'Promotion code to evaluate (optional if promotion_id provided)' },
          application_type: {
            type: 'string',
            enum: ['manual_coupon', 'stackable_promotion', 'preview_only'],
            description: 'Type of promotion application - manual_coupon: apply exclusive discount to evaluation, stackable_promotion: add stackable benefit to evaluation, preview_only: calculate preview without saving'
          },

          // Optional fields
          evaluation_id: { type: 'string', description: 'Existing evaluation ID (optional - backend will auto-detect if not provided)' },
          cart_items: {
            type: 'array',
            description: 'User cart items',
            items: {
              type: 'object',
              properties: {
                cart_record_id: { type: 'string', description: 'Cart record ID' },
                product_id: { type: 'string', description: 'Product ID' },
                quantity: { type: 'number', description: 'Quantity' },
                base_price: { type: 'number', description: 'Original product price' },
                product_discount: { type: 'number', description: 'Product-level discount' },
                price: { type: 'number', description: 'Final price after product discount only' },
                category: { type: 'string', description: 'Product category' },
                subcategory: { type: 'string', description: 'Product subcategory' },
                name: { type: 'string', description: 'Product name' }
              },
              required: ['cart_record_id', 'product_id', 'quantity', 'price', 'category']
            }
          },
          context: {
            type: 'object',
            properties: {
              channel: { type: 'string', enum: ['web', 'mobile', 'mobile_app'], description: 'Platform channel' },
              geo: { type: 'string', description: 'Geographic region' },
              payment_method: { type: 'string', description: 'Payment method' },
              user_agent: { type: 'string', description: 'User agent' },
              ip_address: { type: 'string', description: 'IP address' }
            },
            required: ['channel', 'geo']
          }
        },
        // Simplified requirements - user_id is always required, backend auto-detects evaluation
        anyOf: [
          {
            // Manual coupon or stackable promotion (backend finds active evaluation)
            required: ['user_id', 'cart_items', 'application_type'],
            properties: {
              application_type: { enum: ['manual_coupon', 'stackable_promotion'] }
            }
          },
          {
            // Preview promotion (standalone calculation)
            required: ['user_id', 'cart_items', 'context', 'application_type'],
            properties: {
              application_type: { const: 'preview_only' }
            }
          }
        ]
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                evaluation_id: { type: 'string' },
                promotion_id: { type: 'number', nullable: true },
                promotion_name: { type: 'string', nullable: true },
                promotion_type: { type: 'string', nullable: true },
                is_eligible: { type: 'boolean' },
                original_total: { type: 'number', nullable: true },
                discounted_total: { type: 'number', nullable: true },
                total_discount: { type: 'number', nullable: true },
                discount_breakdown: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      cart_record_id: { type: 'string' },
                      product_id: { type: 'string' },
                      product_name: { type: 'string' },
                      category: { type: 'string' },
                      quantity: { type: 'number' },
                      original_price: { type: 'number', nullable: true },
                      discount_per_item: { type: 'number', nullable: true },
                      final_price_per_item: { type: 'number', nullable: true },
                      total_discount: { type: 'number', nullable: true }
                    },
                    additionalProperties: true
                  }
                },
                applied_promotions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      promotion_id: { type: 'number', nullable: true },
                      promotion_name: { type: 'string', nullable: true },
                      promotion_type: { type: 'string', nullable: true },
                      is_auto: { type: 'boolean' },
                      is_free_shipping: { type: 'boolean' },
                      discount_amount: { type: 'number', nullable: true },
                      is_stacked: { type: 'boolean', nullable: true, description: 'True if this promotion can stack with others' },

                      // BOGO-specific details
                      bogo_details: {
                        type: 'object',
                        nullable: true,
                        description: 'BOGO promotion details (present only for BOGO promotions)',
                        properties: {
                          buy_quantity: { type: 'number', description: 'How many items to buy' },
                          get_quantity: { type: 'number', description: 'How many items to get free' },
                          affected_products: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Product IDs that got BOGO applied'
                          },
                          free_items_count: { type: 'number', description: 'Total free items granted' }
                        }
                      },

                      // FREE_PRODUCT-specific details
                      free_product_details: {
                        type: 'object',
                        nullable: true,
                        description: 'Free product details (present only for FREE_PRODUCT promotions)',
                        properties: {
                          free_product_id: { type: 'string', description: 'ID of the free product' },
                          max_free_items: { type: 'number', description: 'Maximum free items allowed' },
                          granted_items_count: { type: 'number', description: 'Number of free items actually granted' }
                        }
                      },

                      // Backward compatibility fields
                      breakdown: { type: 'object', nullable: true },
                      is_shipping_discount: { type: 'boolean', nullable: true },
                      shipping_info: { type: 'object', nullable: true }
                    },
                    additionalProperties: true
                  }
                },
                ineligible_reason: { type: 'string', nullable: true },
                expires_at: { type: 'string', format: 'date-time', nullable: true }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        }
      }
    }
  }, evaluationController.evaluatePromotion.bind(evaluationController));

  // POST /v1/promotions/evaluate/remove - Remove coupon from evaluation
  fastify.post('/evaluate/remove', {
    schema: {
      description: 'Remove coupon from evaluation',
      tags: ['Promotions', 'Manual Coupon'],
      body: {
        type: 'object',
        properties: {
          evaluation_id: { type: 'string', description: 'Evaluation ID' },
          promotion_id: { type: 'number', description: 'Promotion ID to remove' }
        },
        required: ['evaluation_id', 'promotion_id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                evaluation_id: { type: 'string' },
                applied_promotions: { type: 'array' },
                expires_at: { type: 'string', format: 'date-time' }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' }
          }
        }
      }
    }
  }, evaluationController.removeManualCoupon.bind(evaluationController));

}
