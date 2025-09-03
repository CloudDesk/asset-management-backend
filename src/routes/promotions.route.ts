import { FastifyInstance } from 'fastify';
import { PromotionsController } from '../controllers/promotions.controller.js';
import { 
  createPromotionsSchema,
  updatePromotionsSchema,
  promotionsQuerySchema,
  promotionsParamsSchema
} from '../schemas/promotions.schema.js';

export async function promotionsRoutes(fastify: FastifyInstance) {
  const promotionsController = new PromotionsController();

  // GET /v1/promotions - Get all promotions with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all promotions with pagination and filtering',
      tags: ['Promotions'],
      querystring: promotionsQuerySchema,
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
      },
    },
  }, promotionsController.getPromotions.bind(promotionsController));



  // GET /v1/promotions/:id - Get promotion by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get promotion by ID',
      tags: ['Promotions'],
      params: promotionsParamsSchema,
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
      body: createPromotionsSchema,
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
      params: promotionsParamsSchema,
      body: updatePromotionsSchema,
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
      params: promotionsParamsSchema,
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


} 