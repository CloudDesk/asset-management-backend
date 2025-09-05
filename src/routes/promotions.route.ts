import { FastifyInstance } from 'fastify';
import { PromotionsController } from '../controllers/promotions.controller.js';

export async function promotionsRoutes(fastify: FastifyInstance) {
  const promotionsController = new PromotionsController();

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
          name: { type: 'string', description: 'Filter by promotion name' },
          type: { type: 'string', description: 'Filter by promotion type' },
          code: { type: 'string', description: 'Filter by promotion code' },
          auto_apply: { type: 'string', description: 'Filter by auto-apply status (true/false)' },
          status: { type: 'string', description: 'Filter by promotion status' },
          priority: { type: 'string', description: 'Filter by priority' },
          visibility: { type: 'string', description: 'Filter by visibility' },
          stackable: { type: 'string', description: 'Filter by stackable status (true/false)' },
          start_date_after: { type: 'string', description: 'Filter by start date after' },
          start_date_before: { type: 'string', description: 'Filter by start date before' },
          end_date_after: { type: 'string', description: 'Filter by end date after' },
          end_date_before: { type: 'string', description: 'Filter by end date before' },
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
                  id: { type: 'number', description: 'Promotion ID' },
                  name: { type: 'string', nullable: true, description: 'Promotion name' },
                  type: { type: 'string', nullable: true, description: 'Promotion type' },
                  code: { type: 'string', nullable: true, description: 'Promotion code' },
                  auto_apply: { type: 'boolean', nullable: true, description: 'Auto-apply status' },
                  start_date: { type: 'string', nullable: true, description: 'Start date' },
                  end_date: { type: 'string', nullable: true, description: 'End date' },
                  status: { type: 'string', nullable: true, description: 'Promotion status' },
                  priority: { type: 'number', nullable: true, description: 'Priority' },
                  visibility: { type: 'string', nullable: true, description: 'Visibility' },
                  max_redemptions: { type: 'number', nullable: true, description: 'Maximum redemptions' },
                  per_user_limit: { type: 'number', nullable: true, description: 'Per user limit' },
                  stackable: { type: 'boolean', nullable: true, description: 'Stackable status' },
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
  }, promotionsController.getPromotions.bind(promotionsController));

  // GET /v1/promotions/eligible - Evaluate promotion eligibility (GET version)
  fastify.get('/eligible', {
    schema: {
      description: 'Evaluate promotion eligibility for a user and cart (GET version)',
      tags: ['Promotions'],
      querystring: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'User ID' },
          platform: { type: 'string', description: 'Platform (web, mobile, etc.)' },
          code: { type: 'string', description: 'Promotion code' }
        },
        required: ['user_id', 'platform']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                eligible_promotions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      promotion_id: { type: 'number' },
                      name: { type: 'string' },
                      type: { type: 'string' },
                      description: { type: 'string' },
                      stackable: { type: 'boolean' },
                      actions: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: { type: 'string' },
                            target: { type: 'string' },
                            value: { type: ['number', 'string'] }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            message: { type: 'string' }
          }
        }
      }
    }
  }, promotionsController.evaluateEligibility.bind(promotionsController));

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
          type: { type: 'string', maxLength: 100, description: 'Promotion type' },
          code: { type: 'string', maxLength: 50, description: 'Promotion code' },
          auto_apply: { type: 'boolean', description: 'Auto-apply status' },
          start_date: { type: 'string', format: 'date-time', description: 'Start date' },
          end_date: { type: 'string', format: 'date-time', description: 'End date' },
          status: { type: 'string', maxLength: 50, description: 'Promotion status' },
          priority: { type: 'number', description: 'Priority' },
          visibility: { type: 'string', maxLength: 50, description: 'Visibility' },
          max_redemptions: { type: 'number', description: 'Maximum redemptions' },
          per_user_limit: { type: 'number', description: 'Per user limit' },
          stackable: { type: 'boolean', description: 'Stackable status' },
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
          type: { type: 'string', maxLength: 100, description: 'Promotion type' },
          code: { type: 'string', maxLength: 50, description: 'Promotion code' },
          auto_apply: { type: 'boolean', description: 'Auto-apply status' },
          start_date: { type: 'string', format: 'date-time', description: 'Start date' },
          end_date: { type: 'string', format: 'date-time', description: 'End date' },
          status: { type: 'string', maxLength: 50, description: 'Promotion status' },
          priority: { type: 'number', description: 'Priority' },
          visibility: { type: 'string', maxLength: 50, description: 'Visibility' },
          max_redemptions: { type: 'number', description: 'Maximum redemptions' },
          per_user_limit: { type: 'number', description: 'Per user limit' },
          stackable: { type: 'boolean', description: 'Stackable status' },
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

  // POST /v1/promotions/upsert - Create or update promotion
  fastify.post('/upsert', {
    schema: {
      description: 'Create or update promotion (upsert)',
      tags: ['Promotions'],
      body: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Promotion ID (for update)' },
          name: { type: 'string', description: 'Promotion name' },
          type: { type: 'string', description: 'Promotion type' },
          code: { type: 'string', description: 'Promotion code' },
          auto_apply: { type: 'boolean', description: 'Auto-apply status' },
          start_date: { type: 'string', format: 'date-time', description: 'Start date' },
          end_date: { type: 'string', format: 'date-time', description: 'End date' },
          status: { type: 'string', description: 'Promotion status' },
          priority: { type: 'number', description: 'Priority' },
          visibility: { type: 'string', description: 'Visibility' },
          max_redemptions: { type: 'number', description: 'Maximum redemptions' },
          per_user_limit: { type: 'number', description: 'Per user limit' },
          stackable: { type: 'boolean', description: 'Stackable status' },
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
  }, promotionsController.upsertPromotion.bind(promotionsController));

  // POST /v1/promotions/eligible - Evaluate promotion eligibility
  fastify.post('/eligible', {
    schema: {
      description: 'Evaluate promotion eligibility for a user and cart',
      tags: ['Promotions'],
      body: {
        type: 'object',
        properties: {
          user_id: { type: 'string', description: 'User ID' },
          platform: { type: 'string', description: 'Platform (web, mobile, etc.)' },
          cart: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product_id: { type: 'string', description: 'Product ID' },
                quantity: { type: 'number', description: 'Quantity' },
                price: { type: 'number', description: 'Price' }
              },
              required: ['product_id', 'quantity', 'price']
            },
            description: 'Cart items'
          },
          code: { type: 'string', description: 'Promotion code' }
        },
        required: ['user_id', 'platform']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                eligible_promotions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      promotion_id: { type: 'number' },
                      name: { type: 'string' },
                      type: { type: 'string' },
                      description: { type: 'string' },
                      stackable: { type: 'boolean' },
                      actions: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            type: { type: 'string' },
                            target: { type: 'string' },
                            value: { type: ['number', 'string'] }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            message: { type: 'string' }
          }
        }
      }
    }
  }, promotionsController.evaluateEligibility.bind(promotionsController));
} 
