import { CartController } from '../controllers/cart.controller.js';
export async function cartRoutes(fastify) {
    const cartController = new CartController();
    // GET /v1/carts - Get all cart items with pagination and filtering
    fastify.get('/', {
        schema: {
            description: 'Get all cart items with pagination and filtering',
            tags: ['Cart'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                    productid: { type: 'string', description: 'Filter by product ID' },
                    userid: { type: 'string', description: 'Filter by user ID' },
                    quantity: { type: 'string', description: 'Filter by quantity' },
                    iscart: { type: 'string', description: 'Filter by cart status' },
                    iswishlist: { type: 'string', description: 'Filter by wishlist status' },
                    createdAfter: { type: 'string', description: 'Created after date' },
                    createdBefore: { type: 'string', description: 'Created before date' },
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
                                    id: { type: 'number' },
                                    productid: { type: 'number' },
                                    userid: { type: 'number' },
                                    quantity: { type: 'number' },
                                    iscart: { type: 'boolean' },
                                    iswishlist: { type: 'boolean' },
                                    createddate: { type: 'number' },
                                    modifieddate: { type: 'number' },
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
    }, cartController.getCarts.bind(cartController));
    // GET /v1/carts/:id - Get cart item by ID
    fastify.get('/:id', {
        schema: {
            description: 'Get cart item by ID',
            tags: ['Cart'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Cart item ID' },
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
                                id: { type: 'number' },
                                productid: { type: 'number' },
                                userid: { type: 'number' },
                                quantity: { type: 'number' },
                                iscart: { type: 'boolean' },
                                iswishlist: { type: 'boolean' },
                                createddate: { type: 'number' },
                                modifieddate: { type: 'number' },
                            },
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
    }, cartController.getCart.bind(cartController));
    // POST /v1/carts - Create new cart item
    fastify.post('/', {
        schema: {
            description: 'Create a new cart item',
            tags: ['Cart'],
            body: {
                type: 'object',
                properties: {
                    productid: { type: 'number', description: 'Product ID' },
                    userid: { type: 'number', description: 'User ID' },
                    quantity: { type: 'number', description: 'Quantity' },
                    iscart: { type: 'boolean', description: 'Is cart item' },
                    iswishlist: { type: 'boolean', description: 'Is wishlist item' },
                },
                additionalProperties: true,
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
    }, cartController.createCart.bind(cartController));
    // PUT /v1/carts/:id - Update cart item
    fastify.put('/:id', {
        schema: {
            description: 'Update a cart item',
            tags: ['Cart'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Cart item ID' },
                },
                required: ['id'],
            },
            body: {
                type: 'object',
                properties: {
                    productid: { type: 'number', description: 'Product ID' },
                    userid: { type: 'number', description: 'User ID' },
                    quantity: { type: 'number', description: 'Quantity' },
                    iscart: { type: 'boolean', description: 'Is cart item' },
                    iswishlist: { type: 'boolean', description: 'Is wishlist item' },
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
    }, cartController.updateCart.bind(cartController));
    // DELETE /v1/carts/:id - Delete cart item
    fastify.delete('/:id', {
        schema: {
            description: 'Delete a cart item',
            tags: ['Cart'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Cart item ID' },
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
    }, cartController.deleteCart.bind(cartController));
    // POST /v1/carts/upsert - Upsert cart item
    fastify.post('/upsert', {
        schema: {
            description: 'Create or update a cart item',
            tags: ['Cart'],
            body: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'Cart item ID (optional for create)' },
                    productid: { type: 'number', description: 'Product ID' },
                    userid: { type: 'number', description: 'User ID' },
                    quantity: { type: 'number', description: 'Quantity' },
                    iscart: { type: 'boolean', description: 'Is cart item' },
                    iswishlist: { type: 'boolean', description: 'Is wishlist item' },
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
    }, cartController.upsertCart.bind(cartController));
    // GET /v1/carts/user/:userId - Get cart items by user ID
    fastify.get('/user/:userId', {
        schema: {
            description: 'Get cart items by user ID',
            tags: ['Cart'],
            params: {
                type: 'object',
                properties: {
                    userId: { type: 'string', description: 'User ID' },
                },
                required: ['userId'],
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
                                additionalProperties: true
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
    }, cartController.getCartsByUserId.bind(cartController));
    // GET /v1/carts/wishlist/:userId - Get wishlist items by user ID
    fastify.get('/wishlist/:userId', {
        schema: {
            description: 'Get wishlist items by user ID',
            tags: ['Cart'],
            params: {
                type: 'object',
                properties: {
                    userId: { type: 'string', description: 'User ID' },
                },
                required: ['userId'],
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
                                additionalProperties: true
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
    }, cartController.getWishlistByUserId.bind(cartController));
    // DELETE /v1/carts/user/:userId/clear - Clear all cart items for a user
    fastify.delete('/user/:userId/clear', {
        schema: {
            description: 'Clear all cart items for a user',
            tags: ['Cart'],
            params: {
                type: 'object',
                properties: {
                    userId: { type: 'string', description: 'User ID' },
                },
                required: ['userId'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                deletedCount: { type: 'number' }
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
    }, cartController.clearCartByUserId.bind(cartController));
}
//# sourceMappingURL=cart.route.js.map