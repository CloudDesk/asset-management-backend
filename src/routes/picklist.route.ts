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
          label: { type: 'string', description: 'Filter by label' },
          value: { type: 'string', description: 'Filter by value' },
          object: { type: 'string', description: 'Filter by object' },
          controlledvalue: { type: 'string', description: 'Filter by controlled value' },
          fieldname: { type: 'string', description: 'Filter by field name' },
          controlledlabel: { type: 'string', description: 'Filter by controlled label' },
          controlledfieldname: { type: 'string', description: 'Filter by controlled field name' },
          parent: { type: 'string', description: 'Filter by parent' },
          searchtext: {
            type: 'string',
            description: 'Search text to find records matching object, fieldname, label, value, or parent fields (case-insensitive). Example: /v1/picklists/?searchtext=category'
          },
          sortorder: { 
            type: 'string', 
            enum: ['ASC', 'DESC', 'asc', 'desc'],
            description: 'Sort direction for sortorder field (default: ASC). Always used as the last sort column. Records with null sortorder will appear after sorted records.' 
          },
          fieldnameOrder: {
            type: 'string',
            enum: ['ASC', 'DESC', 'asc', 'desc'],
            description: 'Sort direction for fieldname field (optional). When provided, overrides default fieldname ASC ordering. Used in combination 2 and 3.'
          },
          objectOrder: {
            type: 'string',
            enum: ['ASC', 'DESC', 'asc', 'desc'],
            description: 'Sort direction for object field (optional). When provided, enables combination 3: object first, then fieldname, then sortorder.'
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              description: 'Array of picklist records. Ordering depends on query parameters: Combination 1 (default): fieldname ASC, sortorder ASC/DESC. Combination 2: fieldname ASC/DESC, sortorder ASC/DESC. Combination 3: object ASC/DESC, fieldname ASC/DESC, sortorder ASC/DESC.',
            },
            pagination: {
              type: 'object',
              description: 'Pagination information',
              nullable: true,
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
              description: 'Metadata about the query',
              nullable: true,
              properties: {
                filters: { type: 'array', items: { type: 'string' } },
                total: { type: 'number' },
                filtered: { type: 'boolean' },
              },
            },
            message: { type: 'string' },
          },
          required: ['success'],
          additionalProperties: true,
        },
      },
    },
  }, picklistController.getPicklists.bind(picklistController));

  // GET /v1/picklists/:id - Get picklist by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get picklist by ID',
      tags: ['Picklists'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^\\d+$', description: 'Picklist ID (integer)' },
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
                id: { type: 'integer', description: 'Picklist ID' },
                label: { type: 'string', description: 'Display label' },
                value: { type: 'string', description: 'Stored value' },
                object: { type: 'string', description: 'Object reference' },
                controlledvalue: { type: 'string', description: 'Controlled value' },
                fieldname: { type: 'string', description: 'Field name' },
                controlledlabel: { type: 'string', description: 'Controlled label' },
                controlledfieldname: { type: 'string', description: 'Controlled field name' },
                parent: { type: 'string', description: 'Parent reference' },
                description: { type: 'string', description: 'Description' },
                sortorder: { type: 'integer', nullable: true, description: 'Sort order for display (null values sorted last)' },
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
      body: {
        type: 'object',
        properties: {
          label: { type: 'string', maxLength: 255, description: 'Display label (required)' },
          value: { type: 'string', maxLength: 255, description: 'Stored value (required)' },
          object: { type: 'string', maxLength: 255, description: 'Object reference' },
          controlledvalue: { type: 'string', maxLength: 255, description: 'Controlled value' },
          fieldname: { type: 'string', maxLength: 255, description: 'Field name' },
          controlledlabel: { type: 'string', maxLength: 255, description: 'Controlled label' },
          controlledfieldname: { type: 'string', maxLength: 255, description: 'Controlled field name' },
          parent: { type: 'string', maxLength: 20, description: 'Parent reference' },
          sortorder: { type: 'integer', description: 'Sort order for display' },
        },
        required: ['label', 'value'],
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              properties: {
                id: { type: 'integer', description: 'Picklist ID' },
                label: { type: 'string', description: 'Display label' },
                value: { type: 'string', description: 'Stored value' },
                object: { type: 'string', description: 'Object reference' },
                controlledvalue: { type: 'string', description: 'Controlled value' },
                fieldname: { type: 'string', description: 'Field name' },
                controlledlabel: { type: 'string', description: 'Controlled label' },
                controlledfieldname: { type: 'string', description: 'Controlled field name' },
                parent: { type: 'string', description: 'Parent reference' },
                description: { type: 'string', description: 'Description' },
                sortorder: { type: 'integer', nullable: true, description: 'Sort order for display (null values sorted last)' },
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
  }, picklistController.createPicklist.bind(picklistController));

  // PUT /v1/picklists/:id - Update picklist
  fastify.put('/:id', {
    schema: {
      description: 'Update picklist by ID',
      tags: ['Picklists'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^\\d+$', description: 'Picklist ID (integer)' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          label: { type: 'string', maxLength: 255, description: 'Display label' },
          value: { type: 'string', maxLength: 255, description: 'Stored value' },
          object: { type: 'string', maxLength: 255, description: 'Object reference' },
          controlledvalue: { type: 'string', maxLength: 255, description: 'Controlled value' },
          fieldname: { type: 'string', maxLength: 255, description: 'Field name' },
          controlledlabel: { type: 'string', maxLength: 255, description: 'Controlled label' },
          controlledfieldname: { type: 'string', maxLength: 255, description: 'Controlled field name' },
          parent: { type: 'string', maxLength: 20, description: 'Parent reference' },
          sortorder: { type: 'integer', description: 'Sort order for display' },
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
                id: { type: 'integer', description: 'Picklist ID' },
                label: { type: 'string', description: 'Display label' },
                value: { type: 'string', description: 'Stored value' },
                object: { type: 'string', description: 'Object reference' },
                controlledvalue: { type: 'string', description: 'Controlled value' },
                fieldname: { type: 'string', description: 'Field name' },
                controlledlabel: { type: 'string', description: 'Controlled label' },
                controlledfieldname: { type: 'string', description: 'Controlled field name' },
                parent: { type: 'string', description: 'Parent reference' },
                description: { type: 'string', description: 'Description' },
                sortorder: { type: 'integer', nullable: true, description: 'Sort order for display (null values sorted last)' },
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
  }, picklistController.updatePicklist.bind(picklistController));

  // DELETE /v1/picklists/:id - Delete picklist
  fastify.delete('/:id', {
    schema: {
      description: 'Delete picklist by ID',
      tags: ['Picklists'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^\\d+$', description: 'Picklist ID (integer)' },
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
  }, picklistController.deletePicklist.bind(picklistController));
} 

/**
 * v2 Picklist Routes - Enhanced with grouping support
 */
export async function picklistRoutesV2(fastify: FastifyInstance) {
  const picklistController = new PicklistController();

  // GET /v2/picklists - Get all picklists with optional grouping by fieldname
  fastify.get('/', {
    schema: {
      description: 'Get all picklists with optional grouping by fieldname (v2)',
      tags: ['Picklists v2'],
      // Note: Response schema validation is minimal to allow flexible grouped/flat formats
      // The data property can be either an object (grouped) or array (flat)
      response: {
        '2xx': {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            meta: {
              type: 'object',
              additionalProperties: true
            },
            pagination: {
              type: 'object',
              nullable: true,
              additionalProperties: true
            },
            message: { type: 'string' }
          },
          additionalProperties: true // Allow data property without strict validation
        }
      },
      querystring: {
        type: 'object',
        properties: {
          object: { 
            type: 'string', 
            description: 'Filter by object name (e.g., product, stock)' 
          },
          groupByFieldname: { 
            type: 'string', 
            enum: ['true', 'false'],
            description: 'Enable grouping by fieldname (default: false). When true, returns structured JSON grouped by fieldname.' 
          },
          groupByParent: {
            type: 'string',
            enum: ['true', 'false'],
            description: 'Enable nested grouping by parent within each fieldname (default: false). Requires groupByFieldname=true. When true, returns nested structure: { fieldname: { parent: [...] } }'
          },
          sortorder: { 
            type: 'string', 
            enum: ['ASC', 'DESC', 'asc', 'desc'],
            description: 'Sort direction for sortorder field within each group (default: ASC)' 
          },
          fieldnameOrder: {
            type: 'string',
            enum: ['ASC', 'DESC', 'asc', 'desc'],
            description: 'Sort direction for fieldname groups (default: ASC)'
          },
          limit: { 
            type: 'string', 
            description: 'Global limit (not per fieldname). Default: 1000' 
          },
          searchtext: {
            type: 'string',
            description: 'Case-insensitive text search on label, value, fieldname, object, or parent fields'
          },
          parent: { 
            type: 'string', 
            description: 'Filter by parent value (for dependent fields)' 
          },
          label: { type: 'string', description: 'Filter by label' },
          value: { type: 'string', description: 'Filter by value' },
          controlledvalue: { type: 'string', description: 'Filter by controlled value' },
          fieldname: { type: 'string', description: 'Filter by field name' },
          controlledlabel: { type: 'string', description: 'Filter by controlled label' },
          controlledfieldname: { type: 'string', description: 'Filter by controlled field name' },
        },
      },
    },
  }, picklistController.getPicklistsV2.bind(picklistController));

  // PUT /v2/picklists/bulk - Bulk update picklists (fieldname, parent, sortorder, label, value)
  fastify.put('/bulk', {
    schema: {
      description: 'Bulk update picklists - Update fieldname, parent dependencies, sortorder, label, and value',
      tags: ['Picklists v2'],
      body: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: {
              type: ['integer', 'string'],
              description: 'Picklist ID (required)'
            },
            fieldname: {
              type: 'string',
              nullable: true,
              description: 'Update fieldname (optional)'
            },
            parent: {
              type: 'string',
              nullable: true,
              description: 'Update parent dependency - set to null to remove parent (optional)'
            },
            sortorder: {
              type: 'integer',
              nullable: true,
              description: 'Update sort order - set to null to remove sortorder (optional)'
            },
            label: {
              type: 'string',
              nullable: true,
              maxLength: 255,
              description: 'Update display label - set to null to remove label (optional)'
            },
            value: {
              type: 'string',
              nullable: true,
              maxLength: 255,
              description: 'Update stored value - set to null to remove value (optional)'
            }
          },
          required: ['id'],
          additionalProperties: false
        },
        minItems: 1
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
                  id: { type: ['integer', 'string'] },
                  success: { type: 'boolean' },
                  data: {
                    type: 'object',
                    additionalProperties: true
                  },
                  error: { type: 'string', nullable: true }
                }
              }
            },
            summary: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                successful: { type: 'number' },
                failed: { type: 'number' }
              }
            },
            message: { type: 'string' }
          }
        },
        207: {
          type: 'object',
          description: 'Multi-Status - Some updates succeeded, some failed',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true
              }
            },
            summary: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                successful: { type: 'number' },
                failed: { type: 'number' }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, picklistController.bulkUpdatePicklistsV2.bind(picklistController));
} 