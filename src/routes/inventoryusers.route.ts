import { FastifyInstance } from 'fastify';
import { InventoryUsersController } from '../controllers/inventoryusers.controller.js';

export async function inventoryUsersRoutes(fastify: FastifyInstance) {
  const inventoryUsersController = new InventoryUsersController();

  // GET /v1/inventoryusers - Get all inventory users with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all inventory users with pagination and filtering',
      tags: ['Inventory Users'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          useremail: { type: 'string', description: 'Filter by user email' },
          role: { type: 'string', description: 'Filter by role' },
          firstname: { type: 'string', description: 'Filter by first name' },
          lastname: { type: 'string', description: 'Filter by last name' },
          location: { type: 'string', description: 'Filter by location' },
          createdAfter: { type: 'string', description: 'Created after date' },
          createdBefore: { type: 'string', description: 'Created before date' },
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
                  useremail: { type: 'string' },
                  role: { type: 'string' },
                  firstname: { type: 'string' },
                  lastname: { type: 'string' },
                  location: { type: 'string' },
                  usersphonenumber: { type: 'number' },
                  fcmid: { type: 'string' },
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
  }, inventoryUsersController.getInventoryUsers.bind(inventoryUsersController));

  // GET /v1/inventoryusers/:id - Get inventory user by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get inventory user by ID',
      tags: ['Inventory Users'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Inventory User ID' },
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
                useremail: { type: 'string' },
                role: { type: 'string' },
                firstname: { type: 'string' },
                lastname: { type: 'string' },
                location: { type: 'string' },
                usersphonenumber: { type: 'number' },
                fcmid: { type: 'string' },
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
  }, inventoryUsersController.getInventoryUser.bind(inventoryUsersController));

  // POST /v1/inventoryusers - Create new inventory user
  fastify.post('/', {
    schema: {
      description: 'Create a new inventory user',
      tags: ['Inventory Users'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          useremail: { type: 'string', format: 'email', description: 'User email address' },
          userpassword: { type: 'string', description: 'User password' },
          role: { type: 'string', description: 'User role' },
          firstname: { type: 'string', description: 'First name' },
          lastname: { type: 'string', description: 'Last name' },
          location: { type: 'string', description: 'Location' },
          usersphonenumber: { type: 'number', description: 'Phone number' },
          fcmid: { type: 'string', description: 'FCM ID' },
        },
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
  }, inventoryUsersController.createInventoryUser.bind(inventoryUsersController));

  // PUT /v1/inventoryusers/:id - Update inventory user
  fastify.put('/:id', {
    schema: {
      description: 'Update inventory user by ID',
      tags: ['Inventory Users'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Inventory User ID' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          useremail: { type: 'string', format: 'email', description: 'User email address' },
          userpassword: { type: 'string', description: 'User password' },
          role: { type: 'string', description: 'User role' },
          firstname: { type: 'string', description: 'First name' },
          lastname: { type: 'string', description: 'Last name' },
          location: { type: 'string', description: 'Location' },
          usersphonenumber: { type: 'string', description: 'Phone number' },
          fcmid: { type: 'string', description: 'FCM ID' },
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
  }, inventoryUsersController.updateInventoryUser.bind(inventoryUsersController));

  // DELETE /v1/inventoryusers/:id - Delete inventory user
  fastify.delete('/:id', {
    schema: {
      description: 'Delete inventory user by ID',
      tags: ['Inventory Users'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Inventory User ID' },
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
  }, inventoryUsersController.deleteInventoryUser.bind(inventoryUsersController));

  // POST /v1/inventoryusers/upsert - Upsert inventory user
  fastify.post('/upsert', {
    schema: {
      description: 'Create or update inventory user (upsert)',
      tags: ['Inventory Users'],
      body: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Inventory User ID (for update)' },
          useremail: { type: 'string', format: 'email', description: 'User email address' },
          userpassword: { type: 'string', description: 'User password' },
          role: { type: 'string', description: 'User role' },
          firstname: { type: 'string', description: 'First name' },
          lastname: { type: 'string', description: 'Last name' },
          location: { type: 'string', description: 'Location' },
          usersphonenumber: { type: 'string', description: 'Phone number' },
          fcmid: { type: 'string', description: 'FCM ID' },
        },
        additionalProperties: true,
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
  }, inventoryUsersController.upsertInventoryUser.bind(inventoryUsersController));
} 
