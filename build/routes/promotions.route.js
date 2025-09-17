import { PromotionsController } from '../controllers/promotions.controller.js';
import { PromotionEvaluationController } from '../controllers/promotion-evaluation.controller.js';
import { PromotionRedemptionController } from '../controllers/promotion-redemption.controller.js';
export async function promotionsRoutes(fastify) {
    const promotionsController = new PromotionsController();
    const evaluationController = new PromotionEvaluationController();
    const redemptionController = new PromotionRedemptionController();
    // GET /v1/promotions - Get all promotions with pagination and filtering
    fastify.get('/', {
        schema: {
            description: 'Get all promotions with pagination and filtering',
            tags: ['Promotions'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                    userid: { type: 'string', description: 'Filter by user ID for personalized promotions' },
                    channel: { type: 'string', description: 'Channel (web, mobile, etc.)' },
                    geo: { type: 'string', description: 'Geographic region' },
                    current_date: { type: 'string', format: 'date-time', description: 'Current date for filtering' },
                    name: { type: 'string', description: 'Filter by promotion name' },
                    type: { type: 'string', description: 'Filter by promotion type' },
                    code: { type: 'string', description: 'Filter by promotion code' },
                    auto_apply: { type: 'string', description: 'Filter by auto-apply status (true/false)' },
                    is_active: { type: 'string', description: 'Filter by active status (true/false)' },
                    status: { type: 'string', description: 'Filter by promotion status' },
                    priority: { type: 'string', description: 'Filter by priority' },
                    visibility: { type: 'string', description: 'Filter by visibility' },
                    stackable: { type: 'string', description: 'Filter by stackable status (true/false)' },
                    budget_min: { type: 'string', description: 'Filter by minimum budget' },
                    budget_max: { type: 'string', description: 'Filter by maximum budget' },
                    timezone: { type: 'string', description: 'Filter by timezone' },
                    discount_type: { type: 'string', description: 'Filter by discount type' },
                    discount_value_min: { type: 'string', description: 'Filter by minimum discount value' },
                    discount_value_max: { type: 'string', description: 'Filter by maximum discount value' },
                    start_date_after: { type: 'string', description: 'Filter by start date after' },
                    start_date_before: { type: 'string', description: 'Filter by start date before' },
                    end_date_after: { type: 'string', description: 'Filter by end date after' },
                    end_date_before: { type: 'string', description: 'Filter by end date before' },
                    admin_mode: { type: 'string', description: 'Admin mode flag to bypass default filters' },
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
                                    id: { type: 'number', description: 'Promotion ID' },
                                    name: { type: 'string', nullable: true, description: 'Promotion name' },
                                    description: { type: 'string', nullable: true, description: 'Promotion description' },
                                    type: { type: 'string', nullable: true, description: 'Promotion type' },
                                    code: { type: 'string', nullable: true, description: 'Promotion code' },
                                    auto_apply: { type: 'boolean', nullable: true, description: 'Auto-apply status' },
                                    is_active: { type: 'boolean', nullable: true, description: 'Active status' },
                                    start_date: { type: 'number', nullable: true, description: 'Start date as Unix timestamp' },
                                    end_date: { type: 'number', nullable: true, description: 'End date as Unix timestamp' },
                                    status: { type: 'string', nullable: true, description: 'Promotion status' },
                                    priority: { type: 'number', nullable: true, description: 'Priority' },
                                    visibility: { type: 'string', nullable: true, description: 'Visibility' },
                                    max_redemptions: { type: 'number', nullable: true, description: 'Maximum redemptions' },
                                    per_user_limit: { type: 'number', nullable: true, description: 'Per user limit' },
                                    stackable: { type: 'boolean', nullable: true, description: 'Stackable status' },
                                    budget: { type: 'number', nullable: true, description: 'Promotion budget' },
                                    timezone: { type: 'string', nullable: true, description: 'Timezone' },
                                    evaluation_expiry_minutes: { type: 'number', nullable: true, description: 'Evaluation expiry minutes' },
                                    discount_type: { type: 'string', nullable: true, description: 'Discount type' },
                                    discount_value: { type: 'number', nullable: true, description: 'Discount value' },
                                    conditions: { type: 'array', nullable: true, description: 'Promotion conditions' },
                                    action: { type: 'object', nullable: true, description: 'Promotion action object' },
                                    createddate: { type: 'number', description: 'Creation timestamp' },
                                    modifieddate: { type: 'number', description: 'Modification timestamp' },
                                },
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
                        meta: {
                            type: 'object',
                            properties: {
                                filters: { type: 'array', items: { type: 'string' } },
                                total: { type: 'number' },
                                filtered: { type: 'boolean' },
                                adminMode: { type: 'boolean' },
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
    }, promotionsController.getPromotions.bind(promotionsController));
    // POST /v1/promotions - Create new promotion
    fastify.post('/', {
        schema: {
            description: 'Create a new promotion',
            tags: ['Promotions'],
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string', maxLength: 255, description: 'Promotion name' },
                    description: { type: 'string', description: 'Promotion description' },
                    type: {
                        type: 'string',
                        enum: ['PERCENT_OFF_ITEM', 'FIXED_AMOUNT_OFF_ITEM', 'BOGO', 'PERCENT_OFF_CART', 'FIXED_AMOUNT_OFF_CART', 'FREE_SHIPPING', 'FREE_PRODUCT'],
                        description: 'Promotion type'
                    },
                    code: { type: 'string', description: 'Promotion code' },
                    auto_apply: { type: 'boolean', description: 'Auto-apply status' },
                    is_active: { type: 'boolean', description: 'Active status' },
                    start_date: { type: 'number', description: 'Start date as Unix timestamp (seconds since epoch)' },
                    end_date: { type: 'number', description: 'End date as Unix timestamp (seconds since epoch)' },
                    status: { type: 'string', enum: ['active', 'inactive'], description: 'Promotion status' },
                    priority: { type: 'number', description: 'Priority' },
                    visibility: { type: 'string', enum: ['public', 'private'], description: 'Visibility' },
                    max_redemptions: { type: 'number', description: 'Maximum redemptions' },
                    per_user_limit: { type: 'number', description: 'Per user limit' },
                    stackable: { type: 'boolean', description: 'Stackable status' },
                    budget: { type: 'number', description: 'Promotion budget' },
                    timezone: { type: 'string', description: 'Timezone' },
                    evaluation_expiry_minutes: { type: 'number', description: 'Evaluation expiry minutes' },
                    // Frontend-specific fields (for backward compatibility)
                    discount_type: { type: 'string', description: 'Discount type (auto-mapped from promotion type)' },
                    discount_value: { type: 'number', description: 'Discount value' },
                    max_discount_cap: { type: 'number', description: 'Maximum discount cap (for percentage discounts)' },
                    buy_quantity: { type: 'number', description: 'Buy quantity (for BOGO)' },
                    get_quantity: { type: 'number', description: 'Get quantity (for BOGO)' },
                    product_ids: { type: 'array', items: { type: 'string' }, description: 'Product IDs (for BOGO)' },
                    free_product_id: { type: 'string', description: 'Free product ID (for FREE_PRODUCT)' },
                    minimum_purchase: { type: 'number', description: 'Minimum purchase amount (for FREE_PRODUCT)' },
                    max_free_items: { type: 'number', description: 'Maximum free items per order' },
                    minimum_order_value: { type: 'number', description: 'Minimum order value (for FREE_SHIPPING)' },
                    product_price: { type: 'number', description: 'Product price (for budget calculations)' },
                    conditions: {
                        type: 'array',
                        description: 'Promotion conditions',
                        items: {
                            type: 'object',
                            properties: {
                                attribute: { type: 'string' },
                                operator: { type: 'string', enum: ['GTE', 'LTE', 'EQ', 'IN', 'NOT_IN', 'CONTAINS'] },
                                value: {
                                    description: 'Condition value - can be string, number, or array of strings',
                                    anyOf: [
                                        { type: 'string' },
                                        { type: 'number' },
                                        { type: 'array', items: { type: 'string' } },
                                        { type: 'boolean' }
                                    ]
                                }
                            }
                        }
                    },
                    // New single action object (recommended format)
                    action: {
                        type: 'object',
                        description: 'Single promotion action object',
                        properties: {
                            type: { type: 'string', enum: ['PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FREE_SHIPPING', 'BOGO', 'FREE_PRODUCT'] },
                            value: {
                                description: 'Action value - can be number or boolean',
                                anyOf: [
                                    { type: 'number' },
                                    { type: 'boolean' }
                                ]
                            },
                            max_discount: { type: 'number', description: 'Maximum discount cap (for PERCENT_OFF)' },
                            buy_quantity: { type: 'number', description: 'Buy quantity (for BOGO)' },
                            get_quantity: { type: 'number', description: 'Get quantity (for BOGO)' },
                            product_ids: { type: 'array', items: { type: 'string' }, description: 'Product IDs (for BOGO)' },
                            free_product_id: { type: 'string', description: 'Free product ID (for FREE_PRODUCT)' },
                            min_purchase: { type: 'number', description: 'Minimum purchase amount (for FREE_PRODUCT)' },
                            max_free_items: { type: 'number', description: 'Maximum free items per order' },
                            min_order_value: { type: 'number', description: 'Minimum order value (for FREE_SHIPPING)' }
                        }
                    },
                    // Legacy actions array (deprecated but still supported)
                    actions: {
                        type: 'array',
                        description: 'Legacy promotion actions array (deprecated - use action object instead)',
                        items: {
                            type: 'object',
                            properties: {
                                type: { type: 'string', enum: ['PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FREE_SHIPPING', 'BOGO'] },
                                value: {
                                    description: 'Action value - can be number or boolean',
                                    anyOf: [
                                        { type: 'number' },
                                        { type: 'boolean' }
                                    ]
                                }
                            }
                        }
                    },
                },
                additionalProperties: true
            },
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
    }, async (request, reply) => {
        try {
            // Validate required fields
            const body = request.body || {};
            if (body.name !== undefined && (!body.name || body.name.trim().length === 0)) {
                const errorResponse = {
                    success: false,
                    message: 'Validation failed: Promotion name cannot be empty',
                    details: 'The promotion name field is required and cannot be empty',
                    statusCode: 400
                };
                return reply.code(400).send(errorResponse);
            }
            const promotion = await promotionsController.promotionsService.create(body);
            const response = {
                success: true,
                message: 'Promotion created successfully',
                data: promotion
            };
            return reply.code(201).send(response);
        }
        catch (error) {
            console.log('=== PROMOTION CREATE ERROR:', error.message);
            if (error.message.includes('Validation failed') || error.message.includes('validation')) {
                const errorResponse = {
                    success: false,
                    message: 'Validation failed',
                    details: error.message,
                    statusCode: 400
                };
                return reply.code(400).send(errorResponse);
            }
            if (error.message.includes('Database') || error.message.includes('database')) {
                const errorResponse = {
                    success: false,
                    message: 'Database operation failed',
                    details: 'Could not create promotion. Please check your data and try again.',
                    statusCode: 400
                };
                return reply.code(400).send(errorResponse);
            }
            // Default error response
            const errorResponse = {
                success: false,
                message: 'Internal server error',
                details: 'Something went wrong while creating the promotion',
                statusCode: 500
            };
            return reply.code(500).send(errorResponse);
        }
    });
    // PUT /v1/promotions/:id - Update promotion
    fastify.put('/:id', {
        schema: {
            description: 'Update promotion by ID',
            tags: ['Promotions'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Promotion ID' },
                },
                required: ['id'],
            },
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string', maxLength: 255, description: 'Promotion name' },
                    description: { type: 'string', description: 'Promotion description' },
                    type: {
                        type: 'string',
                        enum: ['PERCENT_OFF_ITEM', 'FIXED_AMOUNT_OFF_ITEM', 'BOGO', 'PERCENT_OFF_CART', 'FIXED_AMOUNT_OFF_CART', 'FREE_SHIPPING', 'FREE_PRODUCT'],
                        description: 'Promotion type'
                    },
                    code: { type: 'string', description: 'Promotion code' },
                    auto_apply: { type: 'boolean', description: 'Auto-apply status' },
                    is_active: { type: 'boolean', description: 'Active status' },
                    start_date: { type: 'number', description: 'Start date as Unix timestamp (seconds since epoch)' },
                    end_date: { type: 'number', description: 'End date as Unix timestamp (seconds since epoch)' },
                    status: { type: 'string', enum: ['active', 'inactive'], description: 'Promotion status' },
                    priority: { type: 'number', description: 'Priority' },
                    visibility: { type: 'string', enum: ['public', 'private'], description: 'Visibility' },
                    max_redemptions: { type: 'number', description: 'Maximum redemptions' },
                    per_user_limit: { type: 'number', description: 'Per user limit' },
                    stackable: { type: 'boolean', description: 'Stackable status' },
                    budget: { type: 'number', description: 'Promotion budget' },
                    timezone: { type: 'string', description: 'Timezone' },
                    evaluation_expiry_minutes: { type: 'number', description: 'Evaluation expiry minutes' },
                    // Frontend-specific fields (for backward compatibility)
                    discount_type: { type: 'string', description: 'Discount type (auto-mapped from promotion type)' },
                    discount_value: { type: 'number', description: 'Discount value' },
                    max_discount_cap: { type: 'number', description: 'Maximum discount cap (for percentage discounts)' },
                    buy_quantity: { type: 'number', description: 'Buy quantity (for BOGO)' },
                    get_quantity: { type: 'number', description: 'Get quantity (for BOGO)' },
                    product_ids: { type: 'array', items: { type: 'string' }, description: 'Product IDs (for BOGO)' },
                    free_product_id: { type: 'string', description: 'Free product ID (for FREE_PRODUCT)' },
                    minimum_purchase: { type: 'number', description: 'Minimum purchase amount (for FREE_PRODUCT)' },
                    max_free_items: { type: 'number', description: 'Maximum free items per order' },
                    minimum_order_value: { type: 'number', description: 'Minimum order value (for FREE_SHIPPING)' },
                    product_price: { type: 'number', description: 'Product price (for budget calculations)' },
                    conditions: {
                        type: 'array',
                        description: 'Promotion conditions',
                        items: {
                            type: 'object',
                            properties: {
                                attribute: { type: 'string' },
                                operator: { type: 'string', enum: ['GTE', 'LTE', 'EQ', 'IN', 'NOT_IN', 'CONTAINS'] },
                                value: {
                                    description: 'Condition value - can be string, number, or array of strings',
                                    anyOf: [
                                        { type: 'string' },
                                        { type: 'number' },
                                        { type: 'array', items: { type: 'string' } },
                                        { type: 'boolean' }
                                    ]
                                }
                            }
                        }
                    },
                    // New single action object (recommended format)
                    action: {
                        type: 'object',
                        description: 'Single promotion action object',
                        properties: {
                            type: { type: 'string', enum: ['PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FREE_SHIPPING', 'BOGO', 'FREE_PRODUCT'] },
                            value: {
                                description: 'Action value - can be number or boolean',
                                anyOf: [
                                    { type: 'number' },
                                    { type: 'boolean' }
                                ]
                            },
                            max_discount: { type: 'number', description: 'Maximum discount cap (for PERCENT_OFF)' },
                            buy_quantity: { type: 'number', description: 'Buy quantity (for BOGO)' },
                            get_quantity: { type: 'number', description: 'Get quantity (for BOGO)' },
                            product_ids: { type: 'array', items: { type: 'string' }, description: 'Product IDs (for BOGO)' },
                            free_product_id: { type: 'string', description: 'Free product ID (for FREE_PRODUCT)' },
                            min_purchase: { type: 'number', description: 'Minimum purchase amount (for FREE_PRODUCT)' },
                            max_free_items: { type: 'number', description: 'Maximum free items per order' },
                            min_order_value: { type: 'number', description: 'Minimum order value (for FREE_SHIPPING)' }
                        }
                    },
                    // Legacy actions array (deprecated but still supported)
                    actions: {
                        type: 'array',
                        description: 'Legacy promotion actions array (deprecated - use action object instead)',
                        items: {
                            type: 'object',
                            properties: {
                                type: { type: 'string', enum: ['PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FREE_SHIPPING', 'BOGO'] },
                                value: {
                                    description: 'Action value - can be number or boolean',
                                    anyOf: [
                                        { type: 'number' },
                                        { type: 'boolean' }
                                    ]
                                }
                            }
                        }
                    },
                },
                additionalProperties: true
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
    }, async (request, reply) => {
        try {
            const { id } = request.params;
            const body = request.body || {};
            // Validate ID format
            if (!id || id.trim() === '' || !/^\d+$/.test(id)) {
                const errorResponse = {
                    success: false,
                    message: 'Invalid promotion ID format. ID must be an integer.',
                    details: `The provided ID '${id}' is not a valid integer format.`,
                    statusCode: 400
                };
                return reply.code(400).send(errorResponse);
            }
            // Validate fields if provided
            if (body.name !== undefined && (!body.name || body.name.trim().length === 0)) {
                const errorResponse = {
                    success: false,
                    message: 'Validation failed: Promotion name cannot be empty',
                    details: 'The promotion name field cannot be empty if provided',
                    statusCode: 400
                };
                return reply.code(400).send(errorResponse);
            }
            const promotion = await promotionsController.promotionsService.update(id, body);
            const response = {
                success: true,
                message: 'Promotion updated successfully',
                data: promotion
            };
            return reply.code(200).send(response);
        }
        catch (error) {
            console.log('=== PROMOTION UPDATE ERROR:', error.message);
            if (error.message.includes('not found')) {
                const errorResponse = {
                    success: false,
                    message: `Promotion with ID ${request.params.id} not found`,
                    details: 'The promotion you are trying to update does not exist',
                    statusCode: 404
                };
                return reply.code(404).send(errorResponse);
            }
            if (error.message.includes('Validation failed') || error.message.includes('validation')) {
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
                details: 'Something went wrong while updating the promotion',
                statusCode: 500
            };
            return reply.code(500).send(errorResponse);
        }
    });
    // Rest of the routes remain the same...
    // (GET /:id, DELETE /:id, evaluation routes, redemption routes, etc.)
}
//# sourceMappingURL=promotions.route.js.map