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
          isactive: {
            type: 'string',
            enum: ['true', 'false', '1', '0'],
            description: 'Filter by active status (optional). true/1 = active items only, false/0 = inactive items only. If not provided, returns all items (backward compatible).'
          },
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
                isactive: { type: 'boolean', nullable: true, description: 'Active status - true = active, false = inactive/deleted (soft delete)' },
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
          parent: { type: 'string', maxLength: 255, description: 'Parent reference' },
          description: { type: 'string', maxLength: 255, description: 'Description' },
          sortorder: { type: 'integer', description: 'Sort order for display' },
          isactive: { type: 'boolean', nullable: true, description: 'Active status - true = active, false = inactive/deleted (soft delete). Defaults to true if not provided.' },
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
                isactive: { type: 'boolean', nullable: true, description: 'Active status - true = active, false = inactive/deleted (soft delete)' },
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

  // GET /v1/picklists/dependency-fieldnames - Get unique fieldnames by object
  fastify.get('/dependency-fieldnames', {
    schema: {
      description: 'Get unique fieldnames filtered by object - Returns array of unique fieldname strings',
      tags: ['Picklists'],
      querystring: {
        type: 'object',
        properties: {
          object: {
            type: 'string',
            description: 'Object name to filter by (e.g., product, stock). Required parameter.'
          }
        },
        required: ['object']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Array of unique fieldname strings'
            },
            message: { type: 'string' }
          },
          required: ['success', 'data']
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
  }, picklistController.getDependencyFieldnames.bind(picklistController));
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
          isactive: {
            type: 'string',
            enum: ['true', 'false', '1', '0'],
            description: 'Filter by active status (optional). true/1 = active items only, false/0 = inactive items only. If not provided, returns all items (backward compatible).'
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

  // PUT /v2/picklists/bulk - Bulk create/update picklists (handles both create and update in single call)
  fastify.put('/bulk', {
    schema: {
      description: 'Bulk create/update picklists - Create new items (when id is missing/null/negative) or update existing ones (when id is provided). Single API call for both operations.',
      tags: ['Picklists v2'],
      body: {
        type: 'array',
        items: {
        type: 'object',
        properties: {
            id: {
              type: ['integer', 'string', 'null'],
              nullable: true,
              description: 'Picklist ID - Required for UPDATE. Omit/null/negative for CREATE new item'
            },
            object: {
              type: 'string',
              maxLength: 255,
              description: 'Object reference - Required for CREATE, optional for UPDATE'
            },
            description: {
              type: 'string',
              nullable: true,
              maxLength: 255,
              description: 'Description - Optional for both CREATE and UPDATE'
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
            },
            controlledfieldname: {
              type: 'string',
              nullable: true,
              maxLength: 255,
              description: 'Update controlled field name - set to null to remove (optional)'
            },
            controlledlabel: {
              type: 'string',
              nullable: true,
              maxLength: 255,
              description: 'Update controlled label - set to null to remove (optional)'
            },
            controlledvalue: {
              type: 'string',
              nullable: true,
              maxLength: 255,
              description: 'Update controlled value - set to null to remove (optional)'
            },
            isactive: {
              type: 'boolean',
              nullable: true,
              description: 'Update active status - set to false to soft delete/disable item (optional). true = active, false = inactive/deleted'
            }
          },
          // No required fields at schema level - validation happens in service
          // For CREATE: label, value, object, fieldname are required
          // For UPDATE: id is required
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
                total: { type: 'number', description: 'Total number of items processed' },
                successful: { type: 'number', description: 'Number of successful operations (create + update)' },
                failed: { type: 'number', description: 'Number of failed operations' },
                created: { type: 'number', description: 'Number of items created' },
                updated: { type: 'number', description: 'Number of items updated' }
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