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
    }, picklistController.getPicklist.bind(picklistController));
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
    }, picklistController.updatePicklist.bind(picklistController));
    // DELETE /v1/picklists/:id - Delete picklist
    fastify.delete('/:id', {
        schema: {
            description: 'Delete picklist by ID',
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
    }, picklistController.deletePicklist.bind(picklistController));
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
//# sourceMappingURL=picklist.route.js.map