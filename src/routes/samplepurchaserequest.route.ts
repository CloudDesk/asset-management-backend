import { FastifyInstance } from 'fastify';
import { SamplePurchaseRequestController } from '../controllers/samplepurchaserequest.controller.js';
import { formatSamplePurchaseRequestForAPI } from '../utils/dynamicDbOperations.js';

export async function samplePurchaseRequestRoutes(fastify: FastifyInstance) {
  const samplePurchaseRequestController = new SamplePurchaseRequestController();
  
  // GET /v1/samplepurchaserequests - Get all sample purchase requests with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all sample purchase requests with pagination and filtering',
      tags: ['Sample Purchase Requests'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          companyname: { type: 'string', description: 'Filter by company name' },
          contactname: { type: 'string', description: 'Filter by contact name' },
          phonenumber: { type: 'string', description: 'Filter by phone number' },
          companymail: { type: 'string', description: 'Filter by company email' },
          gstnumber: { type: 'string', description: 'Filter by GST number' },
          companyaddress: { type: 'string', description: 'Filter by company address' },
          supplierid: { type: 'string', description: 'Filter by supplier ID' },
          createddate: { type: 'string', description: 'Filter by creation date (timestamp)' },
          modifieddate: { type: 'string', description: 'Filter by modification date (timestamp)' },
          createdby: { type: 'string', description: 'Filter by created by' },
          modifiedby: { type: 'string', description: 'Filter by modified by' },
        },
        additionalProperties: true, 
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
                  id: { type: 'number', description: 'Sample purchase request ID' },
                  companyname: { type: 'string', description: 'Company name' },
                  contactname: { type: 'string', description: 'Contact name' },
                  phonenumber: { type: 'number', description: 'Phone number' },
                  companymail: { type: 'string', description: 'Company email' },
                  gstnumber: { type: 'string', description: 'GST number' },
                  companyaddress: { type: 'string', description: 'Company address' },
                  supplierid: { type: 'number', description: 'Supplier ID' },
                  items: { 
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'number', description: 'Item ID' },
                        name: { type: 'string', description: 'Item name' },
                        quantity: { type: 'number', description: 'Item quantity' }
                      }
                    }
                  },
                  createddate: { type: 'number', description: 'Creation timestamp' },
                  modifieddate: { type: 'number', description: 'Modification timestamp' },
                  createdby: { type: 'string', description: 'Created by' },
                  modifiedby: { type: 'string', description: 'Modified by' },
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
  }, samplePurchaseRequestController.getSamplePurchaseRequests.bind(samplePurchaseRequestController));

  // GET /v1/samplepurchaserequests/:id - Get sample purchase request by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get sample purchase request by ID',
      tags: ['Sample Purchase Requests'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Sample purchase request ID' },
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
              additionalProperties: true // Allow any fields in sample purchase request object
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
      const samplePurchaseRequest = await samplePurchaseRequestController.samplePurchaseRequestService.findById(id);
      
      const response = {
        success: true,
        message: 'Sample purchase request retrieved successfully',
        data: formatSamplePurchaseRequestForAPI(samplePurchaseRequest)
      };
      return reply.code(200).send(response);
    } catch (error: any) {
      console.log('=== SAMPLE PURCHASE REQUEST GET ERROR:', error.message);
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Sample purchase request with ID ${request.params.id} not found`,
          details: 'The requested resource could not be found',
          statusCode: 404
        };
        return reply.code(404).send(errorResponse);
      }
      
      // Default error response
      const errorResponse = {
        success: false,
        message: 'Internal server error',
        details: error.message,
        statusCode: 500
      };
      return reply.code(500).send(errorResponse);
    }
  });

  // POST /v1/samplepurchaserequests - Create new sample purchase request
  fastify.post('/', {
    schema: {
      description: 'Create a new sample purchase request',
      tags: ['Sample Purchase Requests'],
      body: {
        type: 'object',
        properties: {
          companyname: { type: 'string', description: 'Company name' },
          contactname: { type: 'string', description: 'Contact name' },
          phonenumber: { type: 'number', description: 'Phone number' },
          companymail: { type: 'string', format: 'email', description: 'Company email' },
          gstnumber: { type: 'string', description: 'GST number' },
          companyaddress: { type: 'string', description: 'Company address' },
          supplierid: { type: 'number', description: 'Supplier ID' },
          items: { 
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number', description: 'Item ID' },
                name: { type: 'string', description: 'Item name' },
                quantity: { type: 'number', description: 'Item quantity' }
              },
              required: ['id', 'name', 'quantity']
            },
            minItems: 1
          },
          createdby: { type: 'string', description: 'Created by' },
          modifiedby: { type: 'string', description: 'Modified by' },
          createddate: { type: 'number', description: 'Creation timestamp' },
          modifieddate: { type: 'number', description: 'Modification timestamp' }
        },
        required: ['companyname', 'contactname', 'phonenumber', 'companymail', 'gstnumber', 'companyaddress', 'supplierid', 'items', 'createdby', 'modifiedby'],
        additionalProperties: true
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
  }, samplePurchaseRequestController.createSamplePurchaseRequest.bind(samplePurchaseRequestController));

  // PUT /v1/samplepurchaserequests/:id - Update sample purchase request
  fastify.put('/:id', {
    schema: {
      description: 'Update sample purchase request by ID',
      tags: ['Sample Purchase Requests'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Sample purchase request ID' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          companyname: { type: 'string', description: 'Company name' },
          contactname: { type: 'string', description: 'Contact name' },
          phonenumber: { type: 'number', description: 'Phone number' },
          companymail: { type: 'string', format: 'email', description: 'Company email' },
          gstnumber: { type: 'string', description: 'GST number' },
          companyaddress: { type: 'string', description: 'Company address' },
          supplierid: { type: 'number', description: 'Supplier ID' },
          items: { 
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number', description: 'Item ID' },
                name: { type: 'string', description: 'Item name' },
                quantity: { type: 'number', description: 'Item quantity' }
              },
              required: ['id', 'name', 'quantity']
            },
            minItems: 1
          },
          createdby: { type: 'string', description: 'Created by' },
          modifiedby: { type: 'string', description: 'Modified by' },
          createddate: { type: 'number', description: 'Creation timestamp' },
          modifieddate: { type: 'number', description: 'Modification timestamp' }
        },
        additionalProperties: true
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
  }, samplePurchaseRequestController.updateSamplePurchaseRequest.bind(samplePurchaseRequestController));

  // DELETE /v1/samplepurchaserequests/:id - Delete sample purchase request
  fastify.delete('/:id', {
    schema: {
      description: 'Delete sample purchase request by ID',
      tags: ['Sample Purchase Requests'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Sample purchase request ID' },
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
  }, samplePurchaseRequestController.deleteSamplePurchaseRequest.bind(samplePurchaseRequestController));

  // POST /v1/samplepurchaserequests/upsert - Upsert sample purchase request
  fastify.post('/upsert', {
    schema: {
      description: 'Create or update sample purchase request (upsert)',
      tags: ['Sample Purchase Requests'],
      body: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Sample purchase request ID (optional for create)' },
          companyname: { type: 'string', description: 'Company name' },
          contactname: { type: 'string', description: 'Contact name' },
          phonenumber: { type: 'number', description: 'Phone number' },
          companymail: { type: 'string', format: 'email', description: 'Company email' },
          gstnumber: { type: 'string', description: 'GST number' },
          companyaddress: { type: 'string', description: 'Company address' },
          supplierid: { type: 'number', description: 'Supplier ID' },
          items: { 
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'number', description: 'Item ID' },
                name: { type: 'string', description: 'Item name' },
                quantity: { type: 'number', description: 'Item quantity' }
              },
              required: ['id', 'name', 'quantity']
            },
            minItems: 1
          },
          createdby: { type: 'string', description: 'Created by' },
          modifiedby: { type: 'string', description: 'Modified by' },
          createddate: { type: 'number', description: 'Creation timestamp' },
          modifieddate: { type: 'number', description: 'Modification timestamp' }
        },
        additionalProperties: true
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
  }, samplePurchaseRequestController.upsertSamplePurchaseRequest.bind(samplePurchaseRequestController));

  // GET /v1/samplepurchaserequests/supplier/:supplierId - Get sample purchase requests by supplier
  fastify.get('/supplier/:supplierId', {
    schema: {
      description: 'Get sample purchase requests by supplier ID',
      tags: ['Sample Purchase Requests'],
      params: {
        type: 'object',
        properties: {
          supplierId: { type: 'string', description: 'Supplier ID' },
        },
        required: ['supplierId'],
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
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
              properties: {
                supplierId: { type: 'string' },
                data: {
                  type: 'array',
                  items: {
                    type: 'object',
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
  }, samplePurchaseRequestController.getSamplePurchaseRequestsBySupplier.bind(samplePurchaseRequestController));
} 