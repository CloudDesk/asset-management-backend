import { FastifyInstance } from 'fastify';
import { QuotesController } from '../controllers/quotes.controller.js';

export async function quotesRoutes(fastify: FastifyInstance) {
  const quotesController = new QuotesController();

  // GET /v1/quotes - Get all quotes with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all quotes with pagination and filtering',
      tags: ['Quotes'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          status: { type: 'string', description: 'Filter by status' },
          prnumber: { type: 'string', description: 'Filter by PR number' },
          quotenumber: { type: 'string', description: 'Filter by quote number' },
          createdAfter: { type: 'string', description: 'Created after date (timestamp)' },
          createdBefore: { type: 'string', description: 'Created before date (timestamp)' },
          modifiedAfter: { type: 'string', description: 'Modified after date (timestamp)' },
          modifiedBefore: { type: 'string', description: 'Modified before date (timestamp)' },
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
                  id: { type: 'number', description: 'Quote ID' },
                  createddate: { type: 'number', description: 'Creation timestamp' },
                  modifieddate: { type: 'number', description: 'Modification timestamp' },
                  status: { type: 'string', description: 'Quote status' },
                  prnumber: { type: 'string', description: 'Purchase request number' },
                  quoteurl: { type: 'string', description: 'Quote document URL' },
                  quotenumber: { type: 'string', description: 'Quote number' },
                },
                additionalProperties: true // Allow any additional fields
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
  }, quotesController.getQuotes.bind(quotesController));

  // GET /v1/quotes/:id - Get quote by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get quote by ID',
      tags: ['Quotes'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Quote ID' },
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
              properties: {
                id: { type: 'number', description: 'Quote ID' },
                createddate: { type: 'number', description: 'Creation timestamp' },
                modifieddate: { type: 'number', description: 'Modification timestamp' },
                status: { type: 'string', description: 'Quote status' },
                prnumber: { type: 'string', description: 'Purchase request number' },
                quoteurl: { type: 'string', description: 'Quote document URL' },
                quotenumber: { type: 'string', description: 'Quote number' },
              },
              additionalProperties: true // Allow any additional fields
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
  }, quotesController.getQuote.bind(quotesController));

  // POST /v1/quotes - Create new quote
  fastify.post('/', {
    schema: {
      description: 'Create a new quote',
      tags: ['Quotes'],
      body: {
        type: 'object',
        properties: {
          createddate: { type: 'number', description: 'Creation timestamp (optional, auto-generated if not provided)' },
          modifieddate: { type: 'number', description: 'Modification timestamp (optional, auto-generated if not provided)' },
          status: { type: 'string', maxLength: 500, description: 'Quote status' },
          prnumber: { type: 'string', maxLength: 500, description: 'Purchase request number' },
          quoteurl: { type: 'string', maxLength: 500, description: 'Quote document URL' },
          quotenumber: { type: 'string', maxLength: 500, description: 'Quote number' },
        },
        additionalProperties: true, // Allow any additional fields
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              properties: {
                id: { type: 'number', description: 'Quote ID' },
                createddate: { type: 'number', description: 'Creation timestamp' },
                modifieddate: { type: 'number', description: 'Modification timestamp' },
                status: { type: 'string', description: 'Quote status' },
                prnumber: { type: 'string', description: 'Purchase request number' },
                quoteurl: { type: 'string', description: 'Quote document URL' },
                quotenumber: { type: 'string', description: 'Quote number' },
              },
              additionalProperties: true // Allow any additional fields
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
  }, quotesController.createQuote.bind(quotesController));

  // PUT /v1/quotes/:id - Update quote
  fastify.put('/:id', {
    schema: {
      description: 'Update an existing quote',
      tags: ['Quotes'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Quote ID' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          createddate: { type: 'number', description: 'Creation timestamp' },
          modifieddate: { type: 'number', description: 'Modification timestamp (auto-updated)' },
          status: { type: 'string', maxLength: 500, description: 'Quote status' },
          prnumber: { type: 'string', maxLength: 500, description: 'Purchase request number' },
          quoteurl: { type: 'string', maxLength: 500, description: 'Quote document URL' },
          quotenumber: { type: 'string', maxLength: 500, description: 'Quote number' },
        },
        additionalProperties: true, // Allow any additional fields
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              properties: {
                id: { type: 'number', description: 'Quote ID' },
                createddate: { type: 'number', description: 'Creation timestamp' },
                modifieddate: { type: 'number', description: 'Modification timestamp' },
                status: { type: 'string', description: 'Quote status' },
                prnumber: { type: 'string', description: 'Purchase request number' },
                quoteurl: { type: 'string', description: 'Quote document URL' },
                quotenumber: { type: 'string', description: 'Quote number' },
              },
              additionalProperties: true // Allow any additional fields
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
  }, quotesController.updateQuote.bind(quotesController));

  // DELETE /v1/quotes/:id - Delete quote
  fastify.delete('/:id', {
    schema: {
      description: 'Delete a quote',
      tags: ['Quotes'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Quote ID' },
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
  }, quotesController.deleteQuote.bind(quotesController));

  // POST /v1/quotes/upsert - Create or update quote
  fastify.post('/upsert', {
    schema: {
      description: 'Create a new quote or update an existing one',
      tags: ['Quotes'],
      body: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Quote ID (optional for create, required for update)' },
          createddate: { type: 'number', description: 'Creation timestamp' },
          modifieddate: { type: 'number', description: 'Modification timestamp' },
          status: { type: 'string', maxLength: 500, description: 'Quote status' },
          prnumber: { type: 'string', maxLength: 500, description: 'Purchase request number' },
          quoteurl: { type: 'string', maxLength: 500, description: 'Quote document URL' },
          quotenumber: { type: 'string', maxLength: 500, description: 'Quote number' },
        },
        additionalProperties: true, // Allow any additional fields
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              properties: {
                id: { type: 'number', description: 'Quote ID' },
                createddate: { type: 'number', description: 'Creation timestamp' },
                modifieddate: { type: 'number', description: 'Modification timestamp' },
                status: { type: 'string', description: 'Quote status' },
                prnumber: { type: 'string', description: 'Purchase request number' },
                quoteurl: { type: 'string', description: 'Quote document URL' },
                quotenumber: { type: 'string', description: 'Quote number' },
              },
              additionalProperties: true // Allow any additional fields
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
  }, quotesController.upsertQuote.bind(quotesController));

  // GET /v1/quotes/prnumber/:prnumber - Get quotes by PR number
  fastify.get('/prnumber/:prnumber', {
    schema: {
      description: 'Get quotes by purchase request number',
      tags: ['Quotes'],
      params: {
        type: 'object',
        properties: {
          prnumber: { type: 'string', description: 'Purchase request number' },
        },
        required: ['prnumber'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
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
                  id: { type: 'number', description: 'Quote ID' },
                  createddate: { type: 'number', description: 'Creation timestamp' },
                  modifieddate: { type: 'number', description: 'Modification timestamp' },
                  status: { type: 'string', description: 'Quote status' },
                  prnumber: { type: 'string', description: 'Purchase request number' },
                  quoteurl: { type: 'string', description: 'Quote document URL' },
                  quotenumber: { type: 'string', description: 'Quote number' },
                },
                additionalProperties: true // Allow any additional fields
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
                prnumber: { type: 'string' },
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
  }, quotesController.getQuotesByPrNumber.bind(quotesController));

  // GET /v1/quotes/status/:status - Get quotes by status
  fastify.get('/status/:status', {
    schema: {
      description: 'Get quotes by status',
      tags: ['Quotes'],
      params: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Quote status' },
        },
        required: ['status'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
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
                  id: { type: 'number', description: 'Quote ID' },
                  createddate: { type: 'number', description: 'Creation timestamp' },
                  modifieddate: { type: 'number', description: 'Modification timestamp' },
                  status: { type: 'string', description: 'Quote status' },
                  prnumber: { type: 'string', description: 'Purchase request number' },
                  quoteurl: { type: 'string', description: 'Quote document URL' },
                  quotenumber: { type: 'string', description: 'Quote number' },
                },
                additionalProperties: true // Allow any additional fields
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
                status: { type: 'string' },
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
  }, quotesController.getQuotesByStatus.bind(quotesController));

  // GET /v1/quotes/stats - Get quotes statistics
  fastify.get('/stats', {
    schema: {
      description: 'Get quotes statistics',
      tags: ['Quotes'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              properties: {
                total: { type: 'number', description: 'Total number of quotes' },
                byStatus: { 
                  type: 'object',
                  description: 'Count of quotes by status',
                  additionalProperties: { type: 'number' }
                },
              },
            },
            message: { type: 'string' },
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
  }, quotesController.getQuotesStats.bind(quotesController));

  // POST /v1/quotes/attach-with-pr-update - Attach quote with automatic PR status update
  fastify.post('/attach-with-pr-update', {
    schema: {
      description: 'Create or update quote with automatic purchase request status update when closed_won',
      tags: ['Quotes'],
      body: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Quote ID (optional for create, required for update)' },
          createddate: { type: 'number', description: 'Creation timestamp (optional, auto-generated if not provided)' },
          modifieddate: { type: 'number', description: 'Modification timestamp (auto-updated)' },
          status: { 
            type: 'string', 
            maxLength: 500, 
            description: 'Quote status (when set to "closed_won", PR status will be updated to "Completed")',
            enum: ['in_progress', 'negotiation','closed_won', 'closed_lost']
          },
          prnumber: { 
            type: 'string', 
            maxLength: 500, 
            description: 'Purchase request number (required for PR status update)' 
          },
          quoteurl: { type: 'string', maxLength: 500, description: 'Quote document URL' },
          quotenumber: { type: 'string', maxLength: 500, description: 'Quote number' },
        },
        required: ['prnumber'], // prnumber is required for this endpoint
        additionalProperties: true, // Allow any additional fields
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              properties: {
                quote: {
                  type: 'object',
                  properties: {
                    id: { type: 'number', description: 'Quote ID' },
                    createddate: { type: 'number', description: 'Creation timestamp' },
                    modifieddate: { type: 'number', description: 'Modification timestamp' },
                    status: { type: 'string', description: 'Quote status' },
                    prnumber: { type: 'string', description: 'Purchase request number' },
                    quoteurl: { type: 'string', description: 'Quote document URL' },
                    quotenumber: { type: 'string', description: 'Quote number' },
                  },
                  additionalProperties: true // Allow any additional fields
                },
                purchaseRequestUpdate: { 
                  type: ['object', 'null'], 
                  description: 'Purchase request update result (null if no update was performed)',
                  additionalProperties: true
                },
                message: { 
                  type: 'object',
                  properties: {
                    quote: { type: 'string', description: 'Quote operation result message' },
                    purchaseRequest: { type: 'string', description: 'Purchase request operation result message' }
                  }
                }
              }
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
  }, quotesController.attachQuoteWithPrStatusUpdate.bind(quotesController));
} 
