import { FastifyInstance } from 'fastify';
import { StockController } from '../controllers/stock.controller.js';
import { getStockSchemas, getStockQuerySchema } from '../swagger/stock.swagger.js';
import { logger } from '../config/logger.js';
import { validateAndConvertData, filterDataBySchema, validateRequiredFields } from '../utils/dataValidation.js';

export async function stockRoutes(fastify: FastifyInstance) {
  const stockController = new StockController();

  // Generate dynamic schemas
  let schemas: any;
  let querySchema: any;
  
  try {
    [schemas, querySchema] = await Promise.all([
      getStockSchemas(),
      getStockQuerySchema()
    ]);
    logger.info('Dynamic stock schemas loaded successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to load dynamic stock schemas, using fallback');
    // Fallback schemas if dynamic generation fails
    schemas = {
      create: { type: 'object', additionalProperties: true },
      update: { type: 'object', additionalProperties: true },
      response: { type: 'object', additionalProperties: true },
      success: { type: 'object', additionalProperties: true },
      list: { type: 'object', additionalProperties: true },
      error: { type: 'object', additionalProperties: true }
    };
    querySchema = { type: 'object', additionalProperties: true };
  }

  // GET /v1/stocks - Get all stocks with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all stocks with pagination and filtering',
      tags: ['Stocks'],
      querystring: querySchema,
      response: {
        200: schemas.list,
        400: schemas.error,
        500: schemas.error,
      },
    },
  }, stockController.getStocks.bind(stockController));

  // GET /v1/stocks/:id - Get stock by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get stock by ID',
      tags: ['Stocks'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$', description: 'Stock ID (integer)' },
        },
        required: ['id'],
      },
      response: {
        200: schemas.success,
        400: schemas.error,
        404: schemas.error,
        500: schemas.error,
      },
    },
  }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      
      // Validate ID format (integer)
      if (!/^\d+$/.test(id)) {
        const errorResponse = {
          success: false,
          message: 'Invalid ID format. ID must be an integer.',
          details: `The provided ID '${id}' is not a valid integer format.`,
          statusCode: 400
        };
        logger.warn({ stockId: id, error: 'Invalid integer format' }, 'Stock GET request failed');
        return reply.code(400).send(errorResponse);
      }
      
      // Call the service method directly
      const stock = await stockController.stockService.findById(id);
      
      const response = {
        success: true,
        message: 'Stock retrieved successfully',
        data: stock
      };
      logger.info({ stockId: id }, 'Stock retrieved successfully');
      return reply.code(200).send(response);
    } catch (error: any) {
      logger.error({ error: error.message, stockId: request.params.id }, 'Stock GET error');
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Stock with ID ${request.params.id} not found.`,
          details: 'The requested resource could not be found',
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

  // POST /v1/stocks - Create new stock
  fastify.post('/', {
    schema: {
      description: 'Create a new stock entry',
      tags: ['Stocks'],
      body: schemas.create,
      response: {
        201: schemas.success,
        400: schemas.error,
        500: schemas.error,
      },
    },
  }, async (request: any, reply: any) => {
    try {
      let data = request.body;
      
      // Filter and validate data based on schema
      try {
        data = filterDataBySchema(data, schemas.create);
        data = validateAndConvertData(data, schemas.create);
      } catch (validationError: any) {
        const errorResponse = {
          success: false,
          message: 'Data validation failed',
          details: validationError.message,
          statusCode: 400
        };
        logger.warn({ validationError: validationError.message, data: request.body }, 'Stock creation failed - data validation error');
        return reply.code(400).send(errorResponse);
      }
      
      // Validate required fields
      const missingFields = validateRequiredFields(data, schemas.create);
      if (missingFields.length > 0) {
        const errorResponse = {
          success: false,
          message: `Field ${missingFields[0]} is required.`,
          details: `Missing required fields: ${missingFields.join(', ')}`,
          statusCode: 400
        };
        logger.warn({ missingFields, data }, 'Stock creation failed - missing required fields');
        return reply.code(400).send(errorResponse);
      }
      
      const stock = await stockController.stockService.create(data);
      
      const response = {
        success: true,
        message: 'Stock created successfully',
        data: stock
      };
      logger.info({ stockId: stock.id }, 'Stock created successfully');
      return reply.code(201).send(response);
    } catch (error: any) {
      logger.error({ error: error.message, data: request.body }, 'Stock creation error');
      
      // Handle unique constraint violations
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        const errorResponse = {
          success: false,
          message: 'Stock entry already exists.',
          details: 'A stock entry with this identifier already exists in the system',
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }
      
      // Handle validation errors
      if (error.message.includes('validation') || error.message.includes('invalid')) {
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
        details: 'Something went wrong on the server',
        statusCode: 500
      };
      return reply.code(500).send(errorResponse);
    }
  });

  // PUT /v1/stocks/:id - Update stock
  fastify.put('/:id', {
    schema: {
      description: 'Update stock by ID',
      tags: ['Stocks'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$', description: 'Stock ID (integer)' },
        },
        required: ['id'],
      },
      body: schemas.update,
      response: {
        200: schemas.success,
        400: schemas.error,
        404: schemas.error,
        500: schemas.error,
      },
    },
  }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      let data = request.body;
      
      // Validate ID format (integer)
      if (!/^\d+$/.test(id)) {
        const errorResponse = {
          success: false,
          message: 'Invalid ID format. ID must be an integer.',
          details: `The provided ID '${id}' is not a valid integer format.`,
          statusCode: 400
        };
        logger.warn({ stockId: id, error: 'Invalid integer format' }, 'Stock PUT request failed');
        return reply.code(400).send(errorResponse);
      }
      
      // Filter and validate data based on schema
      try {
        data = filterDataBySchema(data, schemas.update);
        data = validateAndConvertData(data, schemas.update);
      } catch (validationError: any) {
        const errorResponse = {
          success: false,
          message: 'Data validation failed',
          details: validationError.message,
          statusCode: 400
        };
        logger.warn({ validationError: validationError.message, data: request.body }, 'Stock update failed - data validation error');
        return reply.code(400).send(errorResponse);
      }
      
      const stock = await stockController.stockService.update(id, data);
      
      const response = {
        success: true,
        message: 'Stock updated successfully',
        data: stock
      };
      logger.info({ stockId: id }, 'Stock updated successfully');
      return reply.code(200).send(response);
    } catch (error: any) {
      logger.error({ error: error.message, stockId: request.params.id, data: request.body }, 'Stock update error');
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Stock with ID ${request.params.id} not found.`,
          details: 'The requested resource could not be found',
          statusCode: 404
        };
        return reply.code(404).send(errorResponse);
      }
      
      // Handle validation errors
      if (error.message.includes('validation') || error.message.includes('invalid')) {
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
        details: 'Something went wrong on the server',
        statusCode: 500
      };
      return reply.code(500).send(errorResponse);
    }
  });

  // DELETE /v1/stocks/:id - Delete stock
  fastify.delete('/:id', {
    schema: {
      description: 'Delete stock by ID',
      tags: ['Stocks'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$', description: 'Stock ID (integer)' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          },
          required: ['success', 'message']
        },
        400: schemas.error,
        404: schemas.error,
        500: schemas.error,
      },
    },
  }, async (request: any, reply: any) => {
    try {
      const { id } = request.params;
      
      // Validate ID format (integer)
      if (!/^\d+$/.test(id)) {
        const errorResponse = {
          success: false,
          message: 'Invalid ID format. ID must be an integer.',
          details: `The provided ID '${id}' is not a valid integer format.`,
          statusCode: 400
        };
        logger.warn({ stockId: id, error: 'Invalid integer format' }, 'Stock DELETE request failed');
        return reply.code(400).send(errorResponse);
      }
      
      await stockController.stockService.delete(id);
      
      const response = {
        success: true,
        message: 'Stock deleted successfully'
      };
      logger.info({ stockId: id }, 'Stock deleted successfully');
      return reply.code(200).send(response);
    } catch (error: any) {
      logger.error({ error: error.message, stockId: request.params.id }, 'Stock delete error');
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Stock with ID ${request.params.id} not found.`,
          details: 'The requested resource could not be found',
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

  // POST /v1/stocks/upsert - Upsert stock
  fastify.post('/upsert', {
    schema: {
      description: 'Create or update stock (upsert)',
      tags: ['Stocks'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              additionalProperties: true // Allow any fields in stock object
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
  }, stockController.upsertStock.bind(stockController));

  // PATCH /v1/stocks/:id/quantities - Update stock quantities only
  fastify.patch('/:id/quantities', {
    schema: {
      description: 'Update stock quantities only',
      tags: ['Stocks'],
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
            data: { type: 'object' },
            message: { type: 'string' },
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
  }, stockController.updateQuantities.bind(stockController));
} 