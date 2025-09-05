import { FastifyInstance } from 'fastify';
import { SupplierController } from '../controllers/supplier.controller.js';
import { formatSupplierForAPI } from '../utils/dynamicDbOperations.js';

export async function supplierRoutes(fastify: FastifyInstance) {
  const supplierController = new SupplierController();

  // GET /v1/suppliers - Get all suppliers with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all suppliers with pagination and filtering',
      tags: ['Suppliers'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          id: { type: 'string', description: 'Filter by supplier ID' },
          suppliername: { type: 'string', description: 'Filter by supplier name' },
          suppliercode: { type: 'string', description: 'Filter by supplier code' },
          suppliertype: { type: 'string', description: 'Filter by supplier type (local/International)' },
          supplieremail: { type: 'string', description: 'Filter by supplier email' },
          supplierphonenumber: { type: 'string', description: 'Filter by supplier phone number' },
          supplierlandline: { type: 'string', description: 'Filter by supplier landline' },
          city: { type: 'string', description: 'Filter by city' },
          state: { type: 'string', description: 'Filter by state' },
          country: { type: 'string', description: 'Filter by country' },
          gstnumber: { type: 'string', description: 'Filter by GST number' },
          doornumber: { type: 'string', description: 'Filter by door number' },
          streetname: { type: 'string', description: 'Filter by street name' },
          pincode: { type: 'string', description: 'Filter by pincode' },
          isdeleted: { type: 'string', description: 'Filter by deletion status' },
          createddate: { type: 'string', description: 'Filter by creation date (timestamp)' },
          modifieddate: { type: 'string', description: 'Filter by modification date (timestamp)' },
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
                  id: { type: 'number', description: 'Supplier ID' },
                  suppliername: { type: 'string', description: 'Supplier name' },
                  suppliercode: { type: 'string', description: 'Supplier code' },
                  suppliertype: { type: 'string', description: 'Supplier type (local/International)' },
                  supplieremail: { type: 'string', description: 'Supplier email' },
                  supplierphonenumber: { type: 'number', nullable: true, description: 'Supplier phone number' },
                  supplierlandline: { type: 'number', nullable: true, description: 'Supplier landline' },
                  city: { type: 'string', nullable: true, description: 'City' },
                  state: { type: 'string', nullable: true, description: 'State' },
                  country: { type: 'string', nullable: true, description: 'Country' },
                  gstnumber: { type: 'string', nullable: true, description: 'GST number' },
                  doornumber: { type: 'string', nullable: true, description: 'Door number' },
                  streetname: { type: 'string', nullable: true, description: 'Street name' },
                  pincode: { type: 'number', nullable: true, description: 'Pincode' },
                  isdeleted: { type: 'boolean', nullable: true, description: 'Deletion status' },
                  createddate: { type: 'number', description: 'Creation timestamp' },
                  modifieddate: { type: 'number', description: 'Modification timestamp' },
                },
                additionalProperties: true // Allow additional dynamic fields
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
  }, supplierController.getSuppliers.bind(supplierController));

  // GET /v1/suppliers/:id - Get supplier by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get supplier by ID',
      tags: ['Suppliers'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Supplier ID' },
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
                id: { type: 'number', description: 'Supplier ID' },
                suppliername: { type: 'string', description: 'Supplier name' },
                suppliercode: { type: 'string', description: 'Supplier code' },
                suppliertype: { type: 'string', description: 'Supplier type (local/International)' },
                supplieremail: { type: 'string', description: 'Supplier email' },
                supplierphonenumber: { type: 'number', nullable: true, description: 'Supplier phone number' },
                supplierlandline: { type: 'number', nullable: true, description: 'Supplier landline' },
                city: { type: 'string', nullable: true, description: 'City' },
                state: { type: 'string', nullable: true, description: 'State' },
                country: { type: 'string', nullable: true, description: 'Country' },
                gstnumber: { type: 'string', nullable: true, description: 'GST number' },
                doornumber: { type: 'string', nullable: true, description: 'Door number' },
                streetname: { type: 'string', nullable: true, description: 'Street name' },
                pincode: { type: 'number', nullable: true, description: 'Pincode' },
                isdeleted: { type: 'boolean', nullable: true, description: 'Deletion status' },
                createddate: { type: 'number', description: 'Creation timestamp' },
                modifieddate: { type: 'number', description: 'Modification timestamp' },
              },
              additionalProperties: true // Allow additional dynamic fields
            },
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
      
      // Call the controller method directly
      const supplier = await supplierController.supplierService.findById(id);
      
      const response = {
        success: true,
        message: 'Supplier retrieved successfully',
        data: formatSupplierForAPI(supplier)
      };
      return reply.code(200).send(response);
    } catch (error: any) {
      console.log('=== DIRECT ERROR HANDLER:', error.message);
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Supplier with ID ${request.params.id} not found`,
          details: 'The requested resource could not be found',
          statusCode: 404
        };
        console.log('=== SENDING ERROR RESPONSE:', JSON.stringify(errorResponse));
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

  // POST /v1/suppliers - Create new supplier
  fastify.post('/', {
    schema: {
      description: 'Create a new supplier',
      tags: ['Suppliers'],
      body: {
        type: 'object',
        properties: {
          suppliername: { type: 'string', minLength: 1, maxLength: 255, description: 'Supplier name' },
          suppliercode: { type: 'string', maxLength: 50, description: 'Supplier code' },
          suppliertype: { type: 'string', enum: ['local', 'International'], description: 'Supplier type' },
          supplieremail: { type: 'string', format: 'email', description: 'Supplier email address' },
          supplierphonenumber: { type: 'number', description: 'Supplier phone number' },
          supplierlandline: { type: 'number', description: 'Supplier landline number' },
          city: { type: 'string', maxLength: 100, description: 'City' },
          state: { type: 'string', maxLength: 100, description: 'State' },
          country: { type: 'string', maxLength: 100, description: 'Country' },
          gstnumber: { type: 'string', maxLength: 50, description: 'GST number' },
          doornumber: { type: 'string', maxLength: 50, description: 'Door number' },
          streetname: { type: 'string', maxLength: 255, description: 'Street name' },
          pincode: { type: 'number', description: 'PIN code' },
          isdeleted: { type: 'boolean', description: 'Deletion status' },
        },
        additionalProperties: true, // Allow additional dynamic fields
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              additionalProperties: true // Allow any fields in supplier object
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
  }, supplierController.createSupplier.bind(supplierController));

  // PUT /v1/suppliers/:id - Update supplier
  fastify.put('/:id', {
    schema: {
      description: 'Update supplier by ID',
      tags: ['Suppliers'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Supplier ID' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          suppliername: { type: 'string', minLength: 1, maxLength: 255, description: 'Supplier name' },
          suppliercode: { type: 'string', maxLength: 50, description: 'Supplier code' },
          suppliertype: { type: 'string', enum: ['local', 'International'], description: 'Supplier type' },
          supplieremail: { type: 'string', format: 'email', description: 'Supplier email address' },
          supplierphonenumber: { type: 'number', description: 'Supplier phone number' },
          supplierlandline: { type: 'number', description: 'Supplier landline number' },
          city: { type: 'string', maxLength: 100, description: 'City' },
          state: { type: 'string', maxLength: 100, description: 'State' },
          country: { type: 'string', maxLength: 100, description: 'Country' },
          gstnumber: { type: 'string', maxLength: 50, description: 'GST number' },
          doornumber: { type: 'string', maxLength: 50, description: 'Door number' },
          streetname: { type: 'string', maxLength: 255, description: 'Street name' },
          pincode: { type: 'number', description: 'PIN code' },
          isdeleted: { type: 'boolean', description: 'Deletion status' },
        },
        additionalProperties: true, // Allow additional dynamic fields
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              additionalProperties: true // Allow any fields in supplier object
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
      
      // Update the supplier
      const supplier = await supplierController.supplierService.update(id, request.body);
      
      const response = {
        success: true,
        message: 'Supplier updated successfully',
        data: supplier
      };
      return reply.code(200).send(response);
    } catch (error: any) {
      console.log('=== PUT ERROR:', error.message);
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Supplier with ID ${request.params.id} not found`,
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

  // DELETE /v1/suppliers/:id - Delete supplier
  fastify.delete('/:id', {
    schema: {
      description: 'Delete supplier by ID',
      tags: ['Suppliers'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Supplier ID' },
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
        409: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            message: { type: "string" },
            details: { type: "string" },
            statusCode: { type: "number" },
            errorCode: { type: "string" },
            blockingRecords: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  table: { type: "string", description: "Table name containing the blocking record" },
                  recordId: { type: ["string", "number"], description: "ID of the blocking record" },
                  details: {
                    type: "object",
                    description: "Detailed information about the blocking record",
                    additionalProperties: true
                  }
                }
              }
            },
            constraintInfo: {
              type: "object",
              properties: {
                constraintName: { type: "string", description: "Foreign key constraint name" },
                referencedTable: { type: "string", description: "Table being referenced" }
              }
            }
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
      
      // Delete the supplier
      await supplierController.supplierService.delete(id);
      
      const response = {
        success: true,
        message: 'Supplier deleted successfully'
      };
      return reply.code(200).send(response);
    } catch (error: any) {
      const { handleDeleteError } = await import('../utils/dynamicDbOperations.js');
      return await handleDeleteError(error, 'supplier', request.params.id, reply);
    }
  });

  // POST /v1/suppliers/upsert - Upsert supplier
  fastify.post('/upsert', {
    schema: {
      description: 'Create or update supplier (upsert operation)',
      tags: ['Suppliers'],
      body: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Supplier ID (optional for create, required for update)' },
          suppliername: { type: 'string', minLength: 1, maxLength: 255, description: 'Supplier name' },
          suppliercode: { type: 'string', maxLength: 50, description: 'Supplier code' },
          suppliertype: { type: 'string', enum: ['local', 'International'], description: 'Supplier type' },
          supplieremail: { type: 'string', format: 'email', description: 'Supplier email address' },
          supplierphonenumber: { type: 'number', description: 'Supplier phone number' },
          supplierlandline: { type: 'number', description: 'Supplier landline number' },
          city: { type: 'string', maxLength: 100, description: 'City' },
          state: { type: 'string', maxLength: 100, description: 'State' },
          country: { type: 'string', maxLength: 100, description: 'Country' },
          gstnumber: { type: 'string', maxLength: 50, description: 'GST number' },
          doornumber: { type: 'string', maxLength: 50, description: 'Door number' },
          streetname: { type: 'string', maxLength: 255, description: 'Street name' },
          pincode: { type: 'number', description: 'PIN code' },
          isdeleted: { type: 'boolean', description: 'Deletion status' },
        },
        additionalProperties: true, // Allow additional dynamic fields
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              additionalProperties: true // Allow any fields in supplier object
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
  }, supplierController.upsertSupplier.bind(supplierController));

  // GET /v1/suppliers/:id/stats - Get supplier statistics
  fastify.get('/:id/stats', {
    schema: {
      description: 'Get supplier statistics (purchase orders, requests, etc.)',
      tags: ['Suppliers'],
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
              additionalProperties: true
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
  }, supplierController.getSupplierStats.bind(supplierController));

  // Test endpoint to verify server is using updated code
  fastify.get('/test-error', {
    schema: {
      description: 'Test error handling',
      tags: ['Suppliers'],
      response: {
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' },
            details: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const errorResponse = {
      success: false,
      message: "Test error message",
      statusCode: 404,
      details: "This is a test error response"
    };
    return reply.code(404).send(errorResponse);
  });
} 
