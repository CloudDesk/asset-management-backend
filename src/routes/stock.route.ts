import { FastifyInstance } from 'fastify';
import { StockController } from '../controllers/stock.controller.js';

export async function stockRoutes(fastify: FastifyInstance) {
  const stockController = new StockController();

  // GET /v1/stocks - Get all stocks with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all stocks with pagination and filtering',
      tags: ['Stocks'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          puc: { type: 'string', description: 'Filter by product ID' },
          category: { type: 'string', description: 'Filter by category' },
          subcategory: { type: 'string', description: 'Filter by subcategory' },
          warehouseLocation: { type: 'string', description: 'Filter by warehouse location' },
          minQuantity: { type: 'string', description: 'Minimum quantity filter' },
          maxQuantity: { type: 'string', description: 'Maximum quantity filter' },
          minAvailable: { type: 'string', description: 'Minimum available quantity filter' },
          maxAvailable: { type: 'string', description: 'Maximum available quantity filter' },
          createdAfter: { type: 'string', description: 'Created after date' },
          createdBefore: { type: 'string', description: 'Created before date' },
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
                additionalProperties: true // Allow any fields in stock objects
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
          },
        },
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
          id: { type: 'string', format: 'uuid' },
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
              additionalProperties: true // Allow any fields in stock object
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, stockController.getStock.bind(stockController));

  // POST /v1/stocks - Create new stock
  fastify.post('/', {
    schema: {
      description: 'Create a new stock entry',
      tags: ['Stocks'],
      body: {
        type: 'object',
        properties: {
          productId: { 
            type: 'string', 
            format: 'uuid', 
            description: 'Product ID' 
          },
          batchNumber: { 
            type: 'string', 
            minLength: 1, 
            maxLength: 100, 
            description: 'Batch number' 
          },
          warehouseLocation: { 
            type: 'string', 
            minLength: 1, 
            maxLength: 100, 
            description: 'Warehouse location' 
          },
          quantity: { 
            type: 'integer', 
            minimum: 0, 
            description: 'Total quantity' 
          },
          availableQuantity: { 
            type: 'integer', 
            minimum: 0, 
            description: 'Available quantity' 
          },
          soldQuantity: { 
            type: 'integer', 
            minimum: 0, 
            description: 'Sold quantity' 
          },
        },
        required: ['productId', 'batchNumber', 'warehouseLocation', 'quantity', 'availableQuantity'],
        additionalProperties: true, // Allow dynamic fields
      },
      response: {
        201: {
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
  }, stockController.createStock.bind(stockController));

  // PUT /v1/stocks/:id - Update stock
  fastify.put('/:id', {
    schema: {
      description: 'Update stock by ID',
      tags: ['Stocks'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          batchNumber: { type: 'string', minLength: 1, maxLength: 100 },
          warehouseLocation: { type: 'string', minLength: 1, maxLength: 100 },
          quantity: { type: 'integer', minimum: 0 },
          availableQuantity: { type: 'integer', minimum: 0 },
          soldQuantity: { type: 'integer', minimum: 0 },
        },
        additionalProperties: true, // Allow dynamic fields
      },
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
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, stockController.updateStock.bind(stockController));

  // DELETE /v1/stocks/:id - Delete stock
  fastify.delete('/:id', {
    schema: {
      description: 'Delete stock by ID',
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
            message: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, stockController.deleteStock.bind(stockController));

  // POST /v1/stocks/upsert - Upsert stock
  fastify.post('/upsert', {
    schema: {
      description: 'Create or update stock (upsert)',
      tags: ['Stocks'],
      body: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          puc: { type: 'string', format: 'uuid' },
          category: { type: 'string', minLength: 1, maxLength: 100 },
          subcategory: { type: 'string', minLength: 1, maxLength: 100 },
          quantity: { type: 'integer', minimum: 0 },
          availableQuantity: { type: 'integer', minimum: 0 },
          soldQuantity: { type: 'integer', minimum: 0 },
        },
        required: ['productId', 'batchNumber', 'warehouseLocation', 'quantity', 'availableQuantity'],
        additionalProperties: true, // Allow dynamic fields
      },
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
      body: {
        type: 'object',
        properties: {
          quantity: { type: 'integer', minimum: 0 },
          availableQuantity: { type: 'integer', minimum: 0 },
          soldQuantity: { type: 'integer', minimum: 0 },
        },
        minProperties: 1,
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
            error: { type: 'string' },
          },
        },
      },
    },
  }, stockController.updateQuantities.bind(stockController));
} 