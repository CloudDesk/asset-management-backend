import { PromotionActionsController } from '../controllers/promotion-actions.controller.js';
export async function promotionActionsRoutes(fastify) {
    const promotionActionsController = new PromotionActionsController();
    // GET /v1/promotion-actions - Get all promotion actions with pagination and filtering
    fastify.get('/', {
        schema: {
            description: 'Get all promotion actions with pagination and filtering',
            tags: ['Promotion Actions'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                    promotion_id: { type: 'string', description: 'Filter by promotion ID' },
                    action_type: { type: 'string', description: 'Filter by action type' },
                    target: { type: 'string', description: 'Filter by target' },
                    value_type: { type: 'string', description: 'Filter by value type' },
                    reward_product_id: { type: 'string', description: 'Filter by reward product ID' },
                    check_inventory: { type: 'string', description: 'Filter by inventory check status (true/false)' },
                    execution_group: { type: 'string', description: 'Filter by execution group' },
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
                                properties: {
                                    id: { type: 'number', description: 'Action ID' },
                                    promotion_id: { type: 'number', nullable: true, description: 'Promotion ID' },
                                    action_type: { type: 'string', nullable: true, description: 'Action type' },
                                    target: { type: 'string', nullable: true, description: 'Target' },
                                    value_type: { type: 'string', nullable: true, description: 'Value type' },
                                    value: { type: 'number', nullable: true, description: 'Value' },
                                    reward_product_id: { type: 'number', nullable: true, description: 'Reward product ID' },
                                    min_combo_size: { type: 'number', nullable: true, description: 'Minimum combo size' },
                                    apply_to_product_ids: { type: 'array', items: { type: 'number' }, description: 'Product IDs' },
                                    max_discount_cap: { type: 'number', nullable: true, description: 'Maximum discount cap' },
                                    check_inventory: { type: 'boolean', nullable: true, description: 'Check inventory' },
                                    execution_group: { type: 'string', nullable: true, description: 'Execution group' },
                                    action_order: { type: 'number', nullable: true, description: 'Action order' },
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
                            },
                        },
                    },
                },
            },
        },
    }, promotionActionsController.getPromotionActions.bind(promotionActionsController));
    // GET /v1/promotion-actions/:id - Get promotion action by ID
    fastify.get('/:id', {
        schema: {
            description: 'Get promotion action by ID',
            tags: ['Promotion Actions'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Promotion action ID' },
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
            },
        },
    }, promotionActionsController.getPromotionAction.bind(promotionActionsController));
    // POST /v1/promotion-actions - Create new promotion action
    fastify.post('/', {
        schema: {
            description: 'Create a new promotion action',
            tags: ['Promotion Actions'],
            body: {
                type: 'object',
                properties: {
                    promotion_id: { type: 'number', description: 'Promotion ID' },
                    action_type: { type: 'string', description: 'Action type' },
                    target: { type: 'string', description: 'Target' },
                    value_type: { type: 'string', description: 'Value type' },
                    value: { type: 'number', description: 'Value' },
                    reward_product_id: { type: 'number', description: 'Reward product ID' },
                    min_combo_size: { type: 'number', description: 'Minimum combo size' },
                    apply_to_product_ids: { type: 'array', items: { type: 'number' }, description: 'Product IDs' },
                    max_discount_cap: { type: 'number', description: 'Maximum discount cap' },
                    check_inventory: { type: 'boolean', description: 'Check inventory' },
                    execution_group: { type: 'string', description: 'Execution group' },
                    action_order: { type: 'number', description: 'Action order' },
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
            },
        },
    }, promotionActionsController.createPromotionAction.bind(promotionActionsController));
    // PUT /v1/promotion-actions/:id - Update promotion action
    fastify.put('/:id', {
        schema: {
            description: 'Update promotion action by ID',
            tags: ['Promotion Actions'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Promotion action ID' },
                },
                required: ['id'],
            },
            body: {
                type: 'object',
                properties: {
                    promotion_id: { type: 'number', description: 'Promotion ID' },
                    action_type: { type: 'string', description: 'Action type' },
                    target: { type: 'string', description: 'Target' },
                    value_type: { type: 'string', description: 'Value type' },
                    value: { type: 'number', description: 'Value' },
                    reward_product_id: { type: 'number', description: 'Reward product ID' },
                    min_combo_size: { type: 'number', description: 'Minimum combo size' },
                    apply_to_product_ids: { type: 'array', items: { type: 'number' }, description: 'Product IDs' },
                    max_discount_cap: { type: 'number', description: 'Maximum discount cap' },
                    check_inventory: { type: 'boolean', description: 'Check inventory' },
                    execution_group: { type: 'string', description: 'Execution group' },
                    action_order: { type: 'number', description: 'Action order' },
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
            },
        },
    }, promotionActionsController.updatePromotionAction.bind(promotionActionsController));
    // DELETE /v1/promotion-actions/:id - Delete promotion action
    fastify.delete('/:id', {
        schema: {
            description: 'Delete promotion action by ID',
            tags: ['Promotion Actions'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Promotion action ID' },
                },
                required: ['id'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: { type: 'null' },
                        message: { type: 'string' },
                    },
                },
            },
        },
    }, promotionActionsController.deletePromotionAction.bind(promotionActionsController));
    // POST /v1/promotion-actions/upsert - Create or update promotion action
    fastify.post('/upsert', {
        schema: {
            description: 'Create or update promotion action (upsert)',
            tags: ['Promotion Actions'],
            body: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'Action ID (for update)' },
                    promotion_id: { type: 'number', description: 'Promotion ID' },
                    action_type: { type: 'string', description: 'Action type' },
                    target: { type: 'string', description: 'Target' },
                    value_type: { type: 'string', description: 'Value type' },
                    value: { type: 'number', description: 'Value' },
                    reward_product_id: { type: 'number', description: 'Reward product ID' },
                    min_combo_size: { type: 'number', description: 'Minimum combo size' },
                    apply_to_product_ids: { type: 'array', items: { type: 'number' }, description: 'Product IDs' },
                    max_discount_cap: { type: 'number', description: 'Maximum discount cap' },
                    check_inventory: { type: 'boolean', description: 'Check inventory' },
                    execution_group: { type: 'string', description: 'Execution group' },
                    action_order: { type: 'number', description: 'Action order' },
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
            },
        },
    }, promotionActionsController.upsertPromotionAction.bind(promotionActionsController));
}
//# sourceMappingURL=promotion-actions.route.js.map