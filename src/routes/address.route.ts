import { FastifyInstance } from 'fastify';
import { AddressController } from '../controllers/address.controller.js';

export async function addressRoutes(fastify: FastifyInstance) {
  const addressController = new AddressController();

  // GET /v1/addresses - Get all addresses with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all addresses with pagination and filtering',
      tags: ['Addresses'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          // Actual database fields for filtering
          userid: { type: 'string', description: 'Filter by user ID' },
          name: { type: 'string', description: 'Filter by name' },
          mobilenumber: { type: 'string', description: 'Filter by mobile number' },
          pincode: { type: 'string', description: 'Filter by pincode' },
          doornumber: { type: 'string', description: 'Filter by door number' },
          address: { type: 'string', description: 'Filter by address' },
          landmark: { type: 'string', description: 'Filter by landmark' },
          state: { type: 'string', description: 'Filter by state' },
          city: { type: 'string', description: 'Filter by city' },
          isdefaultaddress: { type: 'string', description: 'Filter by default address status (true/false)' }
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
                  id: { type: 'number', description: 'Address ID' },
                  userid: { type: 'number', nullable: true, description: 'User ID' },
                  name: { type: 'string', nullable: true, description: 'Name' },
                  mobilenumber: { type: 'number', nullable: true, description: 'Mobile number' },
                  pincode: { type: 'number', nullable: true, description: 'Pincode' },
                  doornumber: { type: 'string', nullable: true, description: 'Door number' },
                  address: { type: 'string', nullable: true, description: 'Address' },
                  landmark: { type: 'string', nullable: true, description: 'Landmark' },
                  state: { type: 'string', nullable: true, description: 'State' },
                  city: { type: 'string', nullable: true, description: 'City' },
                  isdefaultaddress: { type: 'boolean', nullable: true, description: 'Whether this is the default address' }
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
  }, addressController.getAddresses.bind(addressController));

  // GET /v1/addresses/default/:userId - Get default address for user
  fastify.get('/default/:userId',
    {
      schema: {
        description: 'Get default address for a user',
        tags: ['Addresses'],
        params: {
          type: 'object',
          properties: {
            userId: { type: 'string', description: 'User ID' },
          },
          required: ['userId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'number', description: 'Address ID' },
                  userid: { type: 'number', nullable: true, description: 'User ID' },
                  name: { type: 'string', nullable: true, description: 'Name' },
                  mobilenumber: { type: 'number', nullable: true, description: 'Mobile number' },
                  pincode: { type: 'number', nullable: true, description: 'Pincode' },
                  doornumber: { type: 'string', nullable: true, description: 'Door number' },
                  address: { type: 'string', nullable: true, description: 'Address' },
                  landmark: { type: 'string', nullable: true, description: 'Landmark' },
                  state: { type: 'string', nullable: true, description: 'State' },
                  city: { type: 'string', nullable: true, description: 'City' },
                  isdefaultaddress: { type: 'boolean', description: 'Whether this is the default address' }
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
    }, addressController.getDefaultAddress.bind(addressController));

  // GET /v1/addresses/:id - Get address by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get address by ID',
      tags: ['Addresses'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Address ID' },
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
                id: { type: 'number', description: 'Address ID' },
                userid: { type: 'number', nullable: true, description: 'User ID' },
                name: { type: 'string', nullable: true, description: 'Name' },
                mobilenumber: { type: 'number', nullable: true, description: 'Mobile number' },
                pincode: { type: 'number', nullable: true, description: 'Pincode' },
                doornumber: { type: 'string', nullable: true, description: 'Door number' },
                address: { type: 'string', nullable: true, description: 'Address' },
                landmark: { type: 'string', nullable: true, description: 'Landmark' },
                state: { type: 'string', nullable: true, description: 'State' },
                city: { type: 'string', nullable: true, description: 'City' },
                isdefaultaddress: { type: 'boolean', nullable: true, description: 'Whether this is the default address' }
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
  }, addressController.getAddress.bind(addressController));

  // POST /v1/addresses - Create new address
  fastify.post('/', {
    schema: {
      description: 'Create a new address',
      tags: ['Addresses'],
      body: {
        type: 'object',
        properties: {
          userid: { type: 'number', description: 'User ID' },
          name: { type: 'string', minLength: 2, maxLength: 100, description: 'Name' },
          mobilenumber: { type: 'number', description: 'Mobile number' },
          pincode: { type: 'number', description: 'Pincode' },
          doornumber: { type: 'string', maxLength: 100, description: 'Door number' },
          address: { type: 'string', description: 'Address' },
          landmark: { type: 'string', maxLength: 100, description: 'Landmark' },
          state: { type: 'string', maxLength: 100, description: 'State' },
          city: { type: 'string', maxLength: 100, description: 'City' },
          isdefaultaddress: { type: 'boolean', description: 'Whether this should be the default address' }
        },
        required: ['name'],
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
                id: { type: 'number', description: 'Address ID' },
                userid: { type: 'number', nullable: true, description: 'User ID' },
                name: { type: 'string', nullable: true, description: 'Name' },
                mobilenumber: { type: 'number', nullable: true, description: 'Mobile number' },
                pincode: { type: 'number', nullable: true, description: 'Pincode' },
                doornumber: { type: 'string', nullable: true, description: 'Door number' },
                address: { type: 'string', nullable: true, description: 'Address' },
                landmark: { type: 'string', nullable: true, description: 'Landmark' },
                state: { type: 'string', nullable: true, description: 'State' },
                city: { type: 'string', nullable: true, description: 'City' },
                isdefaultaddress: { type: 'boolean', nullable: true, description: 'Whether this is the default address' }
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
  }, addressController.createAddress.bind(addressController));

  // PUT /v1/addresses/:id - Update address
  fastify.put('/:id', {
    schema: {
      description: 'Update an existing address',
      tags: ['Addresses'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Address ID' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          userid: { type: 'number', description: 'User ID' },
          name: { type: 'string', maxLength: 100, description: 'Name' },
          mobilenumber: { type: 'number', description: 'Mobile number' },
          pincode: { type: 'number', description: 'Pincode' },
          doornumber: { type: 'string', maxLength: 100, description: 'Door number' },
          address: { type: 'string', description: 'Address' },
          landmark: { type: 'string', maxLength: 100, description: 'Landmark' },
          state: { type: 'string', maxLength: 100, description: 'State' },
          city: { type: 'string', maxLength: 100, description: 'City' },
          modifieddate: { type: 'number', description: 'Modification timestamp (optional, auto-generated if not provided)' },
          isdefaultaddress: { type: 'boolean', description: 'Whether this should be the default address' }
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
                id: { type: 'number', description: 'Address ID' },
                userid: { type: 'number', nullable: true, description: 'User ID' },
                name: { type: 'string', nullable: true, description: 'Name' },
                mobilenumber: { type: 'number', nullable: true, description: 'Mobile number' },
                pincode: { type: 'number', nullable: true, description: 'Pincode' },
                doornumber: { type: 'string', nullable: true, description: 'Door number' },
                address: { type: 'string', nullable: true, description: 'Address' },
                landmark: { type: 'string', nullable: true, description: 'Landmark' },
                state: { type: 'string', nullable: true, description: 'State' },
                city: { type: 'string', nullable: true, description: 'City' },
                isdefaultaddress: { type: 'boolean', nullable: true, description: 'Whether this is the default address' }
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
  }, addressController.updateAddress.bind(addressController));

  // DELETE /v1/addresses/:id - Delete address
  fastify.delete('/:id', {
    schema: {
      description: 'Delete an address',
      tags: ['Addresses'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Address ID' },
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
  }, addressController.deleteAddress.bind(addressController));
}
