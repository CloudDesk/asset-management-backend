import { FastifyInstance } from 'fastify';
import { ProductController } from '../controllers/product.controller.js';
import { getProductSchemas, getProductQuerySchema } from '../swagger/product.swagger.js';
import { logger } from '../config/logger.js';

export async function productRoutes(fastify: FastifyInstance) {
  const productController = new ProductController();

  // Generate dynamic schemas
  let schemas: any;
  let querySchema: any;
  
  try {
    [schemas, querySchema] = await Promise.all([
      getProductSchemas(),
      getProductQuerySchema()
    ]);
    logger.info('Dynamic product schemas loaded successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to load dynamic product schemas, using fallback');
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

  // GET /v1/products - Get all products with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all products with pagination and filtering',
      tags: ['Products'],
      querystring: querySchema,
      response: {
        200: schemas.list,
        400: schemas.error,
        500: schemas.error,
      },
    },
  }, productController.getProducts.bind(productController));

  // GET /v1/products/:id - Get product by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get product by ID',
      tags: ['Products'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$', description: 'Product ID (integer)' },
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
        logger.warn({ productId: id, error: 'Invalid integer format' }, 'Product GET request failed');
        return reply.code(400).send(errorResponse);
      }
      
      // Call the service method directly
      const product = await productController.productService.findById(id);
      
      const response = {
        success: true,
        message: 'Product retrieved successfully',
        data: product
      };
      logger.info({ productId: id }, 'Product retrieved successfully');
      return reply.code(200).send(response);
    } catch (error: any) {
      logger.error({ error: error.message, productId: request.params.id }, 'Product GET error');
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Product with ID ${request.params.id} not found.`,
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

  // POST /v1/products - Create new product
  fastify.post('/', {
    schema: {
      description: 'Create a new product',
      tags: ['Products'],
      body: schemas.create,
      response: {
        201: schemas.success,
        400: schemas.error,
        500: schemas.error,
      },
    },
  }, async (request: any, reply: any) => {
    try {
      const data = request.body;
      
      // Validate required fields based on schema
      const requiredFields = schemas.create.required || [];
      const missingFields = requiredFields.filter((field: string) => !data[field]);
      
      if (missingFields.length > 0) {
        const errorResponse = {
          success: false,
          message: `Field ${missingFields[0]} is required.`,
          details: `Missing required fields: ${missingFields.join(', ')}`,
          statusCode: 400
        };
        logger.warn({ missingFields, data }, 'Product creation failed - missing required fields');
        return reply.code(400).send(errorResponse);
      }
      
      const product = await productController.productService.create(data);
      
      const response = {
        success: true,
        message: 'Product created successfully',
        data: product
      };
      logger.info({ productId: product.id }, 'Product created successfully');
      return reply.code(201).send(response);
    } catch (error: any) {
      logger.error({ error: error.message, data: request.body }, 'Product creation error');
      
      // Handle unique constraint violations
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        const errorResponse = {
          success: false,
          message: 'Product code already exists.',
          details: 'A product with this identifier already exists in the system',
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

  // PUT /v1/products/:id - Update product
  fastify.put('/:id', {
    schema: {
      description: 'Update product by ID',
      tags: ['Products'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$', description: 'Product ID (integer)' },
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
      const data = request.body;
      
      // Validate ID format (integer)
      if (!/^\d+$/.test(id)) {
        const errorResponse = {
          success: false,
          message: 'Invalid ID format. ID must be an integer.',
          details: `The provided ID '${id}' is not a valid integer format.`,
          statusCode: 400
        };
        logger.warn({ productId: id, error: 'Invalid integer format' }, 'Product UPDATE request failed');
        return reply.code(400).send(errorResponse);
      }
      
      // Check if at least one field is provided for update
      if (!data || Object.keys(data).length === 0) {
        const errorResponse = {
          success: false,
          message: 'At least one field is required for update.',
          details: 'Request body cannot be empty',
          statusCode: 400
        };
        logger.warn({ productId: id, error: 'Empty update data' }, 'Product UPDATE request failed');
        return reply.code(400).send(errorResponse);
      }
      
      const product = await productController.productService.update(id, data);
      
      const response = {
        success: true,
        message: 'Product updated successfully',
        data: product
      };
      logger.info({ productId: id }, 'Product updated successfully');
      return reply.code(200).send(response);
    } catch (error: any) {
      logger.error({ error: error.message, productId: request.params.id, data: request.body }, 'Product update error');
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Product with ID ${request.params.id} not found.`,
          details: 'The requested resource could not be found',
          statusCode: 404
        };
        return reply.code(404).send(errorResponse);
      }
      
      // Handle unique constraint violations
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        const errorResponse = {
          success: false,
          message: 'Product code already exists.',
          details: 'A product with this identifier already exists in the system',
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

  // DELETE /v1/products/:id - Delete product
  fastify.delete('/:id', {
    schema: {
      description: 'Delete product by ID',
      tags: ['Products'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[0-9]+$', description: 'Product ID (integer)' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'null' }
          }
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
        logger.warn({ productId: id, error: 'Invalid integer format' }, 'Product DELETE request failed');
        return reply.code(400).send(errorResponse);
      }
      
      await productController.productService.delete(id);
      
      const response = {
        success: true,
        message: 'Product deleted successfully',
        data: null
      };
      logger.info({ productId: id }, 'Product deleted successfully');
      return reply.code(200).send(response);
    } catch (error: any) {
      logger.error({ error: error.message, productId: request.params.id }, 'Product delete error');
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Product with ID ${request.params.id} not found.`,
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
} 