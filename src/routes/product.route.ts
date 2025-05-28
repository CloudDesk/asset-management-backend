import { FastifyInstance } from 'fastify';
import { ProductController } from '../controllers/product.controller.js';

export async function productRoutes(fastify: FastifyInstance) {
  const productController = new ProductController();

  // GET /v1/products - Get all products with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all products with pagination and filtering',
      tags: ['Products'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          brand: { type: 'string', description: 'Filter by brand' },
          // name: { type: 'string', description: 'Filter by name' },
          // category: { type: 'string', description: 'Filter by category' },
          // status: { type: 'string', description: 'Filter by status' },
          // description: { type: 'string', description: 'Filter by description' },
          // minPrice: { type: 'string', description: 'Minimum price filter' },
          // maxPrice: { type: 'string', description: 'Maximum price filter' },
          // minStock: { type: 'string', description: 'Minimum stock filter' },
          // maxStock: { type: 'string', description: 'Maximum stock filter' },
          // createdAfter: { type: 'string', description: 'Created after date' },
          // createdBefore: { type: 'string', description: 'Created before date' },
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
                additionalProperties: true // Allow any fields in product objects
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
  }, productController.getProducts.bind(productController));

  // GET /v1/products/:id - Get product by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get product by ID',
      tags: ['Products'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product ID' },
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
              additionalProperties: true // Allow any fields in product object
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
      if (!/^\d+$/.test(id)) {
        const errorResponse = {
          success: false,
          message: 'Invalid ID format. ID must be an integer.',
          details: `The provided ID '${id}' is not a valid integer format.`,
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }
      
      // Call the service method directly
      const product = await productController.productService.findById(id);
      
      const response = {
        success: true,
        message: 'Product retrieved successfully',
        data: product
      };
      return reply.code(200).send(response);
    } catch (error: any) {
      console.log('=== PRODUCT GET ERROR:', error.message);
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Product with ID ${request.params.id} not found`,
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
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              additionalProperties: true // Allow any fields in product object
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
  }, productController.createProduct.bind(productController));

  // PUT /v1/products/:id - Update product
  fastify.put('/:id', {
    schema: {
      description: 'Update product by ID',
      tags: ['Products'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product ID' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        additionalProperties: true, // Allow any fields for dynamic updates
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              additionalProperties: true // Allow any fields in product object
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
      if (!/^\d+$/.test(id)) {
        const errorResponse = {
          success: false,
          message: 'Invalid ID format. ID must be an integer.',
          details: `The provided ID '${id}' is not a valid integer format.`,
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }
      
      // Update the product
      const product = await productController.productService.update(id, request.body);
      
      const response = {
        success: true,
        message: 'Product updated successfully',
        data: product
      };
      return reply.code(200).send(response);
    } catch (error: any) {
      console.log('=== PRODUCT PUT ERROR:', error.message);
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Product with ID ${request.params.id} not found`,
          details: 'The requested resource could not be found',
          statusCode: 404
        };
        return reply.code(404).send(errorResponse);
      }
      
      if (error.message.includes('already exists')) {
        const errorResponse = {
          success: false,
          message: error.message,
          details: 'Duplicate entry detected',
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
          id: { type: 'string', description: 'Product ID' },
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
      if (!/^\d+$/.test(id)) {
        const errorResponse = {
          success: false,
          message: 'Invalid ID format. ID must be an integer.',
          details: `The provided ID '${id}' is not a valid integer format.`,
          statusCode: 400
        };
        return reply.code(400).send(errorResponse);
      }
      
      // Delete the product
      await productController.productService.delete(id);
      
      const response = {
        success: true,
        message: 'Product deleted successfully'
      };
      return reply.code(200).send(response);
    } catch (error: any) {
      console.log('=== PRODUCT DELETE ERROR:', error.message);
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Product with ID ${request.params.id} not found`,
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

  // POST /v1/products/upsert - Upsert product
  fastify.post('/upsert', {
    schema: {
      description: 'Create or update product (upsert)',
      tags: ['Products'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
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
  }, productController.upsertProduct.bind(productController));
} 