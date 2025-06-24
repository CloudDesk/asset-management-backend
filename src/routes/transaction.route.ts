import { FastifyInstance } from 'fastify';
import { TransactionController } from '../controllers/transaction.controller.js';

export async function transactionRoutes(fastify: FastifyInstance) {
  const transactionController = new TransactionController();

  // GET /v1/transactions - Get all transactions with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all transactions with pagination and filtering',
      tags: ['Transactions'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          transactionid: { type: 'string', description: 'Filter by transaction ID' },
          userid: { type: 'string', description: 'Filter by user ID' },
          merchanttransactionid: { type: 'string', description: 'Filter by merchant transaction ID' },
          name: { type: 'string', description: 'Filter by transaction name' },
          amount: { type: 'string', description: 'Filter by exact amount' },
          amountMin: { type: 'string', description: 'Filter by minimum amount' },
          amountMax: { type: 'string', description: 'Filter by maximum amount' },
          mobilenumber: { type: 'string', description: 'Filter by mobile number' },
          transactionfor: { type: 'string', description: 'Filter by transaction purpose' },
          createdAfter: { type: 'string', description: 'Created after timestamp' },
          createdBefore: { type: 'string', description: 'Created before timestamp' },
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
                  id: { type: 'number' },
                  transactionid: { type: 'string' },
                  transactiondata: { type: 'object', additionalProperties: true, description: 'JSON transaction data' },
                  userid: { type: 'number' },
                  productid: { type: 'array', items: { type: 'number' } },
                  merchanttransactionid: { type: 'string' },
                  name: { type: 'string' },
                  amount: { type: 'number' },
                  mobilenumber: { type: 'number' },
                  transactionfor: { type: 'string' },
                  createddate: { type: 'number' },
                  modifieddate: { type: 'number' },
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
  }, transactionController.getTransactions.bind(transactionController));

  // GET /v1/transactions/stats - Get transaction statistics
  fastify.get('/stats', {
    schema: {
      description: 'Get transaction statistics',
      tags: ['Transactions'],
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'Filter statistics by user ID' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                totalAmount: { type: 'number' },
                byTransactionFor: { type: 'object' },
                recentTransactions: { type: 'array', items: { type: 'object' } },
              },
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
  }, transactionController.getTransactionStats.bind(transactionController));

  // GET /v1/transactions/user/:userId - Get transactions for a specific user
  fastify.get('/user/:userId', {
    schema: {
      description: 'Get transactions for a specific user',
      tags: ['Transactions'],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'User ID' },
        },
        required: ['userId'],
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
                  id: { type: 'number' },
                  transactionid: { type: 'string' },
                  transactiondata: { type: 'object', additionalProperties: true },
                  userid: { type: 'number' },
                  productid: { type: 'array', items: { type: 'number' } },
                  merchanttransactionid: { type: 'string' },
                  name: { type: 'string' },
                  amount: { type: 'number' },
                  mobilenumber: { type: 'number' },
                  transactionfor: { type: 'string' },
                  createddate: { type: 'number' },
                  modifieddate: { type: 'number' },
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
                userId: { type: 'number' },
                total: { type: 'number' },
              },
            },
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
  }, transactionController.getUserTransactions.bind(transactionController));

  // GET /v1/transactions/id/:id - Get transaction by database ID
  fastify.get('/id/:id', {
    schema: {
      description: 'Get transaction by database ID',
      tags: ['Transactions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Database ID' },
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
                id: { type: 'number' },
                transactionid: { type: 'string' },
                transactiondata: { type: 'object', additionalProperties: true },
                userid: { type: 'number' },
                productid: { type: 'array', items: { type: 'number' } },
                merchanttransactionid: { type: 'string' },
                name: { type: 'string' },
                amount: { type: 'number' },
                mobilenumber: { type: 'number' },
                transactionfor: { type: 'string' },
                createddate: { type: 'number' },
                modifieddate: { type: 'number' },
              },
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
  }, transactionController.getTransaction.bind(transactionController));

  // GET /v1/transactions/:transactionid - Get transaction by transaction ID
  fastify.get('/:transactionid', {
    schema: {
      description: 'Get transaction by transaction ID',
      tags: ['Transactions'],
      params: {
        type: 'object',
        properties: {
          transactionid: { type: 'string', description: 'Transaction ID' },
        },
        required: ['transactionid'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              properties: {
                id: { type: 'number' },
                transactionid: { type: 'string' },
                transactiondata: { type: 'object', additionalProperties: true },
                userid: { type: 'number' },
                productid: { type: 'array', items: { type: 'number' } },
                merchanttransactionid: { type: 'string' },
                name: { type: 'string' },
                amount: { type: 'number' },
                mobilenumber: { type: 'number' },
                transactionfor: { type: 'string' },
                createddate: { type: 'number' },
                modifieddate: { type: 'number' },
              },
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
  }, transactionController.getTransactionByTransactionId.bind(transactionController));

  // POST /v1/transactions - Create new transaction
  fastify.post('/', {
    schema: {
      description: 'Create a new transaction',
      tags: ['Transactions'],
      body: {
        type: 'object',
        properties: {
          transactionid: { type: 'string', description: 'Unique transaction ID' },
          transactiondata: { type: 'object', additionalProperties: true, description: 'JSON transaction data' },
          userid: { type: 'number', description: 'User ID' },
          productid: { type: 'array', items: { type: 'number' }, description: 'Array of product IDs' },
          merchanttransactionid: { type: 'string', description: 'Merchant transaction ID' },
          name: { type: 'string', description: 'Transaction name' },
          amount: { type: 'number', description: 'Transaction amount' },
          mobilenumber: { type: 'number', description: 'Mobile number' },
          transactionfor: { type: 'string', description: 'Transaction purpose' },
        },
        required: ['transactionid'],
        additionalProperties: true,
      },
      response: {
        201: {
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
  }, transactionController.createTransaction.bind(transactionController));

  // PUT /v1/transactions/id/:id - Update transaction by database ID
  fastify.put('/id/:id', {
    schema: {
      description: 'Update transaction by database ID',
      tags: ['Transactions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Database ID' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          transactiondata: { type: 'object', additionalProperties: true, description: 'JSON transaction data' },
          userid: { type: 'number', description: 'User ID' },
          productid: { type: 'array', items: { type: 'number' }, description: 'Array of product IDs' },
          merchanttransactionid: { type: 'string', description: 'Merchant transaction ID' },
          name: { type: 'string', description: 'Transaction name' },
          amount: { type: 'number', description: 'Transaction amount' },
          mobilenumber: { type: 'number', description: 'Mobile number' },
          transactionfor: { type: 'string', description: 'Transaction purpose' },
        },
        additionalProperties: true,
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
  }, transactionController.updateTransaction.bind(transactionController));

  // PUT /v1/transactions/:transactionid - Update transaction by transaction ID
  fastify.put('/:transactionid', {
    schema: {
      description: 'Update transaction by transaction ID',
      tags: ['Transactions'],
      params: {
        type: 'object',
        properties: {
          transactionid: { type: 'string', description: 'Transaction ID' },
        },
        required: ['transactionid'],
      },
      body: {
        type: 'object',
        properties: {
          transactiondata: { type: 'object', additionalProperties: true, description: 'JSON transaction data' },
          userid: { type: 'number', description: 'User ID' },
          productid: { type: 'array', items: { type: 'number' }, description: 'Array of product IDs' },
          merchanttransactionid: { type: 'string', description: 'Merchant transaction ID' },
          name: { type: 'string', description: 'Transaction name' },
          amount: { type: 'number', description: 'Transaction amount' },
          mobilenumber: { type: 'number', description: 'Mobile number' },
          transactionfor: { type: 'string', description: 'Transaction purpose' },
        },
        additionalProperties: true,
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
  }, transactionController.updateTransactionByTransactionId.bind(transactionController));

  // POST /v1/transactions/upsert - Create or update transaction
  fastify.post('/upsert', {
    schema: {
      description: 'Create or update transaction (upsert)',
      tags: ['Transactions'],
      body: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Database ID (optional, for update)' },
          transactionid: { type: 'string', description: 'Transaction ID (optional, for update)' },
          transactiondata: { type: 'object', additionalProperties: true, description: 'JSON transaction data' },
          userid: { type: 'number', description: 'User ID' },
          productid: { type: 'array', items: { type: 'number' }, description: 'Array of product IDs' },
          merchanttransactionid: { type: 'string', description: 'Merchant transaction ID' },
          name: { type: 'string', description: 'Transaction name' },
          amount: { type: 'number', description: 'Transaction amount' },
          mobilenumber: { type: 'number', description: 'Mobile number' },
          transactionfor: { type: 'string', description: 'Transaction purpose' },
        },
        additionalProperties: true,
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
  }, transactionController.upsertTransaction.bind(transactionController));

  // DELETE /v1/transactions/id/:id - Delete transaction by database ID
  fastify.delete('/id/:id', {
    schema: {
      description: 'Delete transaction by database ID',
      tags: ['Transactions'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Database ID' },
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
  }, transactionController.deleteTransaction.bind(transactionController));

  // DELETE /v1/transactions/:transactionid - Delete transaction by transaction ID
  fastify.delete('/:transactionid', {
    schema: {
      description: 'Delete transaction by transaction ID',
      tags: ['Transactions'],
      params: {
        type: 'object',
        properties: {
          transactionid: { type: 'string', description: 'Transaction ID' },
        },
        required: ['transactionid'],
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
  }, transactionController.deleteTransactionByTransactionId.bind(transactionController));
} 