import { FastifyInstance } from 'fastify';
import { PicklistController } from '../controllers/picklist.controller.js';

export async function picklistRoutes(fastify: FastifyInstance) {
  const picklistController = new PicklistController();

  // GET /v1/picklists - Get all picklists with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all picklists with pagination and filtering',
      tags: ['Picklists'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          type: { type: 'string', description: 'Filter by type' },
          table: { type: 'string', description: 'Filter by table' },
          field: { type: 'string', description: 'Filter by field' },
          label: { type: 'string', description: 'Filter by label' },
          value: { type: 'string', description: 'Filter by value' },
          isActive: { type: 'string', description: 'Filter by active status' },
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
                additionalProperties: true // Allow any fields in picklist objects
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
  }, picklistController.getPicklists.bind(picklistController));

  // GET /v1/picklists/by-type - Get picklists by type
  fastify.get('/by-type', {
    schema: {
      description: 'Get picklists by type',
      tags: ['Picklists'],
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', description: 'Picklist type (required)' },
          table: { type: 'string', description: 'Filter by table' },
          field: { type: 'string', description: 'Filter by field' },
        },
        required: ['type'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array' },
          },
        },
      },
    },
  }, picklistController.getPicklistByType.bind(picklistController));

  // GET /v1/picklists/:id - Get picklist by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get picklist by ID',
      tags: ['Picklists'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Picklist ID' },
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
      const picklist = await picklistController.picklistService.findById(id);
      
      const response = {
        success: true,
        message: 'Picklist retrieved successfully',
        data: picklist
      };
      return reply.code(200).send(response);
    } catch (error: any) {
      console.log('=== PICKLIST GET ERROR:', error.message);
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Picklist with ID ${request.params.id} not found`,
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

  // POST /v1/picklists - Create new picklist
  fastify.post('/', {
    schema: {
      description: 'Create a new picklist item',
      tags: ['Picklists'],
      response: {
        201: {
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
  }, picklistController.createPicklist.bind(picklistController));

  // PUT /v1/picklists/:id - Update picklist
  fastify.put('/:id', {
    schema: {
      description: 'Update picklist by ID',
      tags: ['Picklists'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Picklist ID' },
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
      
      // Update the picklist
      const picklist = await picklistController.picklistService.update(id, request.body);
      
      const response = {
        success: true,
        message: 'Picklist updated successfully',
        data: picklist
      };
      return reply.code(200).send(response);
    } catch (error: any) {
      console.log('=== PICKLIST PUT ERROR:', error.message);
      
      if (error.message.includes('not found')) {
        const errorResponse = {
          success: false,
          message: `Picklist with ID ${request.params.id} not found`,
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

  // DELETE /v1/picklists/:id - Delete picklist
  fastify.delete('/:id', {
    schema: {
      description: 'Delete picklist by ID',
      tags: ['Picklists'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Picklist ID' },
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
      
      // Delete the picklist
      await picklistController.picklistService.delete(id);
      
      const response = {
        success: true,
        message: 'Picklist deleted successfully'
      };
      return reply.code(200).send(response);
    } catch (error: any) {
      const { handleDeleteError } = await import('../utils/dynamicDbOperations.js');
      return await handleDeleteError(error, 'picklist', request.params.id, reply);
    }
  });

  // PATCH /v1/picklists/:id/toggle - Toggle picklist active status
  fastify.patch('/:id/toggle', {
    schema: {
      description: 'Toggle picklist active status',
      tags: ['Picklists'],
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
            data: { type: 'object', additionalProperties: true },
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
  }, picklistController.toggleActive.bind(picklistController));

  // POST /v1/picklists/reorder - Reorder picklist items
  fastify.post('/reorder', {
    schema: {
      description: 'Reorder picklist items',
      tags: ['Picklists'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array' },
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
  }, picklistController.reorderPicklists.bind(picklistController));
} 