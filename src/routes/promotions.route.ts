import { FastifyInstance } from 'fastify';
import { PromotionsController } from '../controllers/promotions.controller.js';
import { PromotionEvaluationController } from '../controllers/promotion-evaluation.controller.js';
import { PromotionRedemptionController } from '../controllers/promotion-redemption.controller.js';

export async function promotionsRoutes(fastify: FastifyInstance) {
  const promotionsController = new PromotionsController();
  const evaluationController = new PromotionEvaluationController();
  const redemptionController = new PromotionRedemptionController();

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
          userid: { type: 'string', description: 'Filter by user ID for personalized promotions' },
          channel: { type: 'string', description: 'Channel (web, mobile, etc.)' },
          geo: { type: 'string', description: 'Geographic region' },
          current_date: { type: 'string', format: 'date-time', description: 'Current date for filtering' },
          name: { type: 'string', description: 'Filter by promotion name' },
          type: { type: 'string', description: 'Filter by promotion type' },
          code: { type: 'string', description: 'Filter by promotion code' },
          auto_apply: { type: 'string', description: 'Filter by auto-apply status (true/false)' },
          is_active: { type: 'string', description: 'Filter by active status (true/false)' },
          status: { type: 'string', description: 'Filter by promotion status' },
          priority: { type: 'string', description: 'Filter by priority' },
          visibility: { type: 'string', description: 'Filter by visibility' },
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
                  is_active: { type: 'boolean', nullable: true, description: 'Active status' },
                  start_date: { type: 'string', nullable: true, description: 'Start date' },
                  end_date: { type: 'string', nullable: true, description: 'End date' },
                  status: { type: 'string', nullable: true, description: 'Promotion status' },
                  priority: { type: 'number', nullable: true, description: 'Priority' },
                  visibility: { type: 'string', nullable: true, description: 'Visibility' },
                  max_redemptions: { type: 'number', nullable: true, description: 'Maximum redemptions' },
                  per_user_limit: { type: 'number', nullable: true, description: 'Per user limit' },
                  stackable: { type: 'boolean', nullable: true, description: 'Stackable status' },
                  budget: { type: 'number', nullable: true, description: 'Promotion budget' },
                  timezone: { type: 'string', nullable: true, description: 'Timezone' },
                  evaluation_expiry_minutes: { type: 'number', nullable: true, description: 'Evaluation expiry minutes' },
                  discount_type: { type: 'string', nullable: true, description: 'Discount type' },
                  discount_value: { type: 'number', nullable: true, description: 'Discount value' },
                  conditions: { type: 'array', nullable: true, description: 'Promotion conditions' },
                  actions: { type: 'array', nullable: true, description: 'Promotion actions' },
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
          is_active: { type: 'boolean', description: 'Active status' },
          start_date: { type: 'string', format: 'date-time', description: 'Start date' },
          end_date: { type: 'string', format: 'date-time', description: 'End date' },
          status: { type: 'string', enum: ['active', 'inactive'], description: 'Promotion status' },
          priority: { type: 'number', description: 'Priority' },
          visibility: { type: 'string', enum: ['public', 'private'], description: 'Visibility' },
          max_redemptions: { type: 'number', description: 'Maximum redemptions' },
          per_user_limit: { type: 'number', description: 'Per user limit' },
          stackable: { type: 'boolean', description: 'Stackable status' },
          budget: { type: 'number', description: 'Promotion budget' },
          timezone: { type: 'string', description: 'Timezone' },
          evaluation_expiry_minutes: { type: 'number', description: 'Evaluation expiry minutes' },
          discount_type: { type: 'string', description: 'Discount type' },
          discount_value: { type: 'number', description: 'Discount value' },
          conditions: { 
            type: 'array', 
            description: 'Promotion conditions',
            items: {
              type: 'object',
              properties: {
                attribute: { type: 'string' },
                operator: { type: 'string', enum: ['GTE', 'LTE', 'EQ', 'IN', 'NOT_IN', 'CONTAINS'] },
                value: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'array', items: { type: 'string' } }] }
              }
            }
          },
          actions: { 
            type: 'array', 
            description: 'Promotion actions',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FREE_SHIPPING', 'BOGO'] },
                value: { oneOf: [{ type: 'number' }, { type: 'boolean' }] }
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
          is_active: { type: 'boolean', description: 'Active status' },
          start_date: { type: 'string', format: 'date-time', description: 'Start date' },
          end_date: { type: 'string', format: 'date-time', description: 'End date' },
          status: { type: 'string', enum: ['active', 'inactive'], description: 'Promotion status' },
          priority: { type: 'number', description: 'Priority' },
          visibility: { type: 'string', enum: ['public', 'private'], description: 'Visibility' },
          max_redemptions: { type: 'number', description: 'Maximum redemptions' },
          per_user_limit: { type: 'number', description: 'Per user limit' },
          stackable: { type: 'boolean', description: 'Stackable status' },
          budget: { type: 'number', description: 'Promotion budget' },
          timezone: { type: 'string', description: 'Timezone' },
          evaluation_expiry_minutes: { type: 'number', description: 'Evaluation expiry minutes' },
          discount_type: { type: 'string', description: 'Discount type' },
          discount_value: { type: 'number', description: 'Discount value' },
          conditions: { 
            type: 'array', 
            description: 'Promotion conditions',
            items: {
              type: 'object',
              properties: {
                attribute: { type: 'string' },
                operator: { type: 'string', enum: ['GTE', 'LTE', 'EQ', 'IN', 'NOT_IN', 'CONTAINS'] },
                value: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'array', items: { type: 'string' } }] }
              }
            }
          },
          actions: { 
            type: 'array', 
            description: 'Promotion actions',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FREE_SHIPPING', 'BOGO'] },
                value: { oneOf: [{ type: 'number' }, { type: 'boolean' }] }
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

  // POST /v1/promotions/evaluate - Evaluate specific promotion against user's cart
  fastify.post('/evaluate', {
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
                price: { type: 'number', description: 'Product price' },
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

  // POST /v1/promotions/evaluate/remove - Remove/cancel evaluation
  fastify.post('/evaluate/remove', {
    schema: {
      description: 'Remove/cancel a promotion evaluation',
      tags: ['Promotions', 'Evaluation'],
      body: {
        type: 'object',
        properties: {
          evaluation_id: { type: 'string', description: 'Evaluation ID to remove' },
          user_id: { type: 'string', description: 'User ID' }
        },
        required: ['evaluation_id', 'user_id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
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
  }, evaluationController.removeEvaluation.bind(evaluationController));

  // GET /v1/promotions/evaluations/:id - Get evaluation details
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
                    discount_value: { type: 'number' },
                    discount_type: { type: 'string' },
                    priority: { type: 'number' },
                    start_date: { type: 'string' },
                    end_date: { type: 'string' },
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
                      discount_value: { type: 'number' },
                      discount_type: { type: 'string' },
                      priority: { type: 'number' },
                      start_date: { type: 'string' },
                      end_date: { type: 'string' },
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
                      discount_value: { type: 'number' },
                      discount_type: { type: 'string' },
                      priority: { type: 'number' },
                      start_date: { type: 'string' },
                      end_date: { type: 'string' },
                      ineligibleReason: { type: 'string' },
                      ineligibleDetails: { type: 'object' }
                    }
                  }
                },
                summary: {
                  type: 'object',
                  properties: {
                    totalPromotions: { type: 'number' },
                    eligibleCount: { type: 'number' },
                    ineligibleCount: { type: 'number' },
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

} 