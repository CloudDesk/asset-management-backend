import { PicklistController } from '../controllers/picklist.controller.js';
export async function picklistRoutes(fastify) {
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
    }, async (request, reply) => {
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
        }
        catch (error) {
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
//# sourceMappingURL=picklist.route.js.map