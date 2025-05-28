import { PicklistController } from '../controllers/picklist.controller.js';
import { getPicklistSchemas, getPicklistQuerySchema } from '../swagger/picklist.swagger.js';
import { logger } from '../config/logger.js';
import { validateAndConvertData, filterDataBySchema, validateRequiredFields } from '../utils/dataValidation.js';
export async function picklistRoutes(fastify) {
    const picklistController = new PicklistController();
    // Generate dynamic schemas
    let schemas;
    let querySchema;
    try {
        [schemas, querySchema] = await Promise.all([
            getPicklistSchemas(),
            getPicklistQuerySchema()
        ]);
        logger.info('Dynamic picklist schemas loaded successfully');
    }
    catch (error) {
        logger.error({ error }, 'Failed to load dynamic picklist schemas, using fallback');
        // Fallback schemas if dynamic generation fails
        schemas = {
            create: { type: 'object', additionalProperties: true },
            update: { type: 'object', additionalProperties: true },
            response: { type: 'object', additionalProperties: true },
            success: { type: 'object', additionalProperties: true },
            list: { type: 'object', additionalProperties: true },
            error: { type: 'object', additionalProperties: true }
        };
        querySchema = { type: 'object', additionalProperties: true };
    }
    // GET /v1/picklists - Get all picklists with pagination and filtering
    fastify.get('/', {
        schema: {
            description: 'Get all picklists with pagination and filtering',
            tags: ['Picklists'],
            querystring: querySchema,
            response: {
                200: schemas.list,
                400: schemas.error,
                500: schemas.error,
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
                400: schemas.error,
                500: schemas.error,
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
                    id: { type: 'string', pattern: '^[0-9]+$', description: 'Picklist ID (integer)' },
                },
                required: ['id'],
            },
            response: {
                200: schemas.success,
                400: schemas.error,
                404: schemas.error,
                500: schemas.error,
            },
        },
    }, async (request, reply) => {
        try {
            const { id } = request.params;
            // Validate ID format (integer)
            if (!/^\d+$/.test(id)) {
                const errorResponse = {
                    success: false,
                    message: 'Invalid ID format. ID must be an integer.',
                    details: `The provided ID '${id}' is not a valid integer format.`,
                    statusCode: 400
                };
                logger.warn({ picklistId: id, error: 'Invalid integer format' }, 'Picklist GET request failed');
                return reply.code(400).send(errorResponse);
            }
            // Call the service method directly
            const picklist = await picklistController.picklistService.findById(id);
            const response = {
                success: true,
                message: 'Picklist retrieved successfully',
                data: picklist
            };
            logger.info({ picklistId: id }, 'Picklist retrieved successfully');
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error: error.message, picklistId: request.params.id }, 'Picklist GET error');
            if (error.message.includes('not found')) {
                const errorResponse = {
                    success: false,
                    message: `Picklist with ID ${request.params.id} not found.`,
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
            body: schemas.create,
            response: {
                201: schemas.success,
                400: schemas.error,
                500: schemas.error,
            },
        },
    }, async (request, reply) => {
        try {
            let data = request.body;
            // Filter and validate data based on schema
            try {
                data = filterDataBySchema(data, schemas.create);
                data = validateAndConvertData(data, schemas.create);
            }
            catch (validationError) {
                const errorResponse = {
                    success: false,
                    message: 'Data validation failed',
                    details: validationError.message,
                    statusCode: 400
                };
                logger.warn({ validationError: validationError.message, data: request.body }, 'Picklist creation failed - data validation error');
                return reply.code(400).send(errorResponse);
            }
            // Validate required fields
            const missingFields = validateRequiredFields(data, schemas.create);
            if (missingFields.length > 0) {
                const errorResponse = {
                    success: false,
                    message: `Field ${missingFields[0]} is required.`,
                    details: `Missing required fields: ${missingFields.join(', ')}`,
                    statusCode: 400
                };
                logger.warn({ missingFields, data }, 'Picklist creation failed - missing required fields');
                return reply.code(400).send(errorResponse);
            }
            const picklist = await picklistController.picklistService.create(data);
            const response = {
                success: true,
                message: 'Picklist created successfully',
                data: picklist
            };
            logger.info({ picklistId: picklist.id }, 'Picklist created successfully');
            return reply.code(201).send(response);
        }
        catch (error) {
            logger.error({ error: error.message, data: request.body }, 'Picklist creation error');
            // Handle unique constraint violations
            if (error.message.includes('unique') || error.message.includes('duplicate')) {
                const errorResponse = {
                    success: false,
                    message: 'Picklist already exists.',
                    details: 'A picklist with this identifier already exists in the system',
                    statusCode: 400
                };
                return reply.code(400).send(errorResponse);
            }
            // Handle validation errors
            if (error.message.includes('validation') || error.message.includes('invalid')) {
                const errorResponse = {
                    success: false,
                    message: 'Validation failed',
                    details: error.message,
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
    // PUT /v1/picklists/:id - Update picklist
    fastify.put('/:id', {
        schema: {
            description: 'Update picklist by ID',
            tags: ['Picklists'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', pattern: '^[0-9]+$', description: 'Picklist ID (integer)' },
                },
                required: ['id'],
            },
            body: schemas.update,
            response: {
                200: schemas.success,
                400: schemas.error,
                404: schemas.error,
                500: schemas.error,
            },
        },
    }, async (request, reply) => {
        try {
            const { id } = request.params;
            let data = request.body;
            // Validate ID format (integer)
            if (!/^\d+$/.test(id)) {
                const errorResponse = {
                    success: false,
                    message: 'Invalid ID format. ID must be an integer.',
                    details: `The provided ID '${id}' is not a valid integer format.`,
                    statusCode: 400
                };
                logger.warn({ picklistId: id, error: 'Invalid integer format' }, 'Picklist PUT request failed');
                return reply.code(400).send(errorResponse);
            }
            // Filter and validate data based on schema
            try {
                data = filterDataBySchema(data, schemas.update);
                data = validateAndConvertData(data, schemas.update);
            }
            catch (validationError) {
                const errorResponse = {
                    success: false,
                    message: 'Data validation failed',
                    details: validationError.message,
                    statusCode: 400
                };
                logger.warn({ validationError: validationError.message, data: request.body }, 'Picklist update failed - data validation error');
                return reply.code(400).send(errorResponse);
            }
            const picklist = await picklistController.picklistService.update(id, data);
            const response = {
                success: true,
                message: 'Picklist updated successfully',
                data: picklist
            };
            logger.info({ picklistId: id }, 'Picklist updated successfully');
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error: error.message, picklistId: request.params.id, data: request.body }, 'Picklist update error');
            if (error.message.includes('not found')) {
                const errorResponse = {
                    success: false,
                    message: `Picklist with ID ${request.params.id} not found.`,
                    details: 'The requested resource could not be found',
                    statusCode: 404
                };
                return reply.code(404).send(errorResponse);
            }
            // Handle validation errors
            if (error.message.includes('validation') || error.message.includes('invalid')) {
                const errorResponse = {
                    success: false,
                    message: 'Validation failed',
                    details: error.message,
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
                    id: { type: 'string', pattern: '^[0-9]+$', description: 'Picklist ID (integer)' },
                },
                required: ['id'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' }
                    },
                    required: ['success', 'message']
                },
                400: schemas.error,
                404: schemas.error,
                500: schemas.error,
            },
        },
    }, async (request, reply) => {
        try {
            const { id } = request.params;
            // Validate ID format (integer)
            if (!/^\d+$/.test(id)) {
                const errorResponse = {
                    success: false,
                    message: 'Invalid ID format. ID must be an integer.',
                    details: `The provided ID '${id}' is not a valid integer format.`,
                    statusCode: 400
                };
                logger.warn({ picklistId: id, error: 'Invalid integer format' }, 'Picklist DELETE request failed');
                return reply.code(400).send(errorResponse);
            }
            await picklistController.picklistService.delete(id);
            const response = {
                success: true,
                message: 'Picklist deleted successfully'
            };
            logger.info({ picklistId: id }, 'Picklist deleted successfully');
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error: error.message, picklistId: request.params.id }, 'Picklist delete error');
            if (error.message.includes('not found')) {
                const errorResponse = {
                    success: false,
                    message: `Picklist with ID ${request.params.id} not found.`,
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