import { PurchaseRequestController } from '../controllers/purchaserequest.controller.js';
import { getPurchaseRequestSchemas, getPurchaseRequestQuerySchema } from '../swagger/purchaserequest.swagger.js';
import { logger } from '../config/logger.js';
import { validateAndConvertData, filterDataBySchema, validateRequiredFields } from '../utils/dataValidation.js';
export async function purchaseRequestRoutes(fastify) {
    const purchaseRequestController = new PurchaseRequestController();
    // Generate dynamic schemas
    let schemas;
    let querySchema;
    try {
        [schemas, querySchema] = await Promise.all([
            getPurchaseRequestSchemas(),
            getPurchaseRequestQuerySchema()
        ]);
        logger.info('Dynamic purchase request schemas loaded successfully');
    }
    catch (error) {
        logger.error({ error }, 'Failed to load dynamic purchase request schemas, using fallback');
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
    // GET /v1/purchaserequests - Get all purchase requests with pagination and filtering
    fastify.get('/', {
        schema: {
            description: 'Get all purchase requests with pagination and filtering',
            tags: ['Purchase Requests'],
            querystring: querySchema,
            response: {
                200: schemas.list,
                400: schemas.error,
                500: schemas.error,
            },
        },
    }, purchaseRequestController.getPurchaseRequests.bind(purchaseRequestController));
    // GET /v1/purchaserequests/:id - Get purchase request by ID
    fastify.get('/:id', {
        schema: {
            description: 'Get purchase request by ID',
            tags: ['Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', pattern: '^[0-9]+$', description: 'Purchase request ID (integer)' },
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
                logger.warn({ purchaseRequestId: id, error: 'Invalid integer format' }, 'Purchase request GET request failed');
                return reply.code(400).send(errorResponse);
            }
            // Call the service method directly
            const purchaseRequest = await purchaseRequestController.purchaseRequestService.findById(id);
            const response = {
                success: true,
                message: 'Purchase request retrieved successfully',
                data: purchaseRequest
            };
            logger.info({ purchaseRequestId: id }, 'Purchase request retrieved successfully');
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error: error.message, purchaseRequestId: request.params.id }, 'Purchase request GET error');
            if (error.message.includes('not found')) {
                const errorResponse = {
                    success: false,
                    message: `Purchase request with ID ${request.params.id} not found.`,
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
    // POST /v1/purchaserequests - Create new purchase request
    fastify.post('/', {
        schema: {
            description: 'Create a new purchase request',
            tags: ['Purchase Requests'],
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
                logger.warn({ validationError: validationError.message, data: request.body }, 'Purchase request creation failed - data validation error');
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
                logger.warn({ missingFields, data }, 'Purchase request creation failed - missing required fields');
                return reply.code(400).send(errorResponse);
            }
            const purchaseRequest = await purchaseRequestController.purchaseRequestService.create(data);
            const response = {
                success: true,
                message: 'Purchase request created successfully',
                data: purchaseRequest
            };
            logger.info({ purchaseRequestId: purchaseRequest.id }, 'Purchase request created successfully');
            return reply.code(201).send(response);
        }
        catch (error) {
            logger.error({ error: error.message, data: request.body }, 'Purchase request creation error');
            // Handle unique constraint violations
            if (error.message.includes('unique') || error.message.includes('duplicate')) {
                const errorResponse = {
                    success: false,
                    message: 'Purchase request already exists.',
                    details: 'A purchase request with this identifier already exists in the system',
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
    // PUT /v1/purchaserequests/:id - Update purchase request
    fastify.put('/:id', {
        schema: {
            description: 'Update purchase request by ID',
            tags: ['Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', pattern: '^[0-9]+$', description: 'Purchase request ID (integer)' },
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
                logger.warn({ purchaseRequestId: id, error: 'Invalid integer format' }, 'Purchase request PUT request failed');
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
                logger.warn({ validationError: validationError.message, data: request.body }, 'Purchase request update failed - data validation error');
                return reply.code(400).send(errorResponse);
            }
            const purchaseRequest = await purchaseRequestController.purchaseRequestService.update(id, data);
            const response = {
                success: true,
                message: 'Purchase request updated successfully',
                data: purchaseRequest
            };
            logger.info({ purchaseRequestId: id }, 'Purchase request updated successfully');
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error: error.message, purchaseRequestId: request.params.id, data: request.body }, 'Purchase request update error');
            if (error.message.includes('not found')) {
                const errorResponse = {
                    success: false,
                    message: `Purchase request with ID ${request.params.id} not found.`,
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
    // DELETE /v1/purchaserequests/:id - Delete purchase request
    fastify.delete('/:id', {
        schema: {
            description: 'Delete purchase request by ID',
            tags: ['Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', pattern: '^[0-9]+$', description: 'Purchase request ID (integer)' },
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
                logger.warn({ purchaseRequestId: id, error: 'Invalid integer format' }, 'Purchase request DELETE request failed');
                return reply.code(400).send(errorResponse);
            }
            await purchaseRequestController.purchaseRequestService.delete(id);
            const response = {
                success: true,
                message: 'Purchase request deleted successfully'
            };
            logger.info({ purchaseRequestId: id }, 'Purchase request deleted successfully');
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error: error.message, purchaseRequestId: request.params.id }, 'Purchase request delete error');
            if (error.message.includes('not found')) {
                const errorResponse = {
                    success: false,
                    message: `Purchase request with ID ${request.params.id} not found.`,
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
    // GET /v1/purchaserequests/user/:userId - Get purchase requests by user
    fastify.get('/user/:userId', {
        schema: {
            description: 'Get purchase requests by user (requested by)',
            tags: ['Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    userId: { type: 'string', description: 'User ID' },
                },
                required: ['userId'],
            },
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                    prstatus: { type: 'string', description: 'Filter by PR status' },
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
                                additionalProperties: true // Allow any fields in purchase request objects
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
    }, purchaseRequestController.getPurchaseRequestsByRequester.bind(purchaseRequestController));
    // GET /v1/purchaserequests/supplier/:supplierId - Get purchase requests by supplier
    fastify.get('/supplier/:supplierId', {
        schema: {
            description: 'Get purchase requests by supplier ID',
            tags: ['Purchase Requests'],
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
                    prstatus: { type: 'string', description: 'Filter by PR status' },
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
                                additionalProperties: true // Allow any fields in purchase request objects
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
    }, purchaseRequestController.getPurchaseRequestsBySupplier.bind(purchaseRequestController));
    // PUT /v1/purchaserequests/:id/approve - Approve purchase request
    fastify.put('/:id/approve', {
        schema: {
            description: 'Approve purchase request',
            tags: ['Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Purchase request ID' },
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
                            additionalProperties: true // Allow any fields in purchase request object
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
    }, purchaseRequestController.approvePurchaseRequest.bind(purchaseRequestController));
    // PUT /v1/purchaserequests/:id/reject - Reject purchase request
    fastify.put('/:id/reject', {
        schema: {
            description: 'Reject purchase request',
            tags: ['Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Purchase request ID' },
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
                            additionalProperties: true // Allow any fields in purchase request object
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
    }, purchaseRequestController.rejectPurchaseRequest.bind(purchaseRequestController));
}
//# sourceMappingURL=purchaserequest.route.js.map