import { ProductController } from '../controllers/product.controller.js';
export async function productRoutes(fastify) {
    const productController = new ProductController();
    // GET /v1/products - Get all products with pagination and filtering
    fastify.get('/', {
        schema: {
            description: 'Get all products with pagination and filtering',
            tags: ['Products'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                    brand: { type: 'string', description: 'Filter by brand' },
                    // name: { type: 'string', description: 'Filter by name' },
                    // category: { type: 'string', description: 'Filter by category' },
                    // status: { type: 'string', description: 'Filter by status' },
                    // description: { type: 'string', description: 'Filter by description' },
                    // minPrice: { type: 'string', description: 'Minimum price filter' },
                    // maxPrice: { type: 'string', description: 'Maximum price filter' },
                    // minStock: { type: 'string', description: 'Minimum stock filter' },
                    // maxStock: { type: 'string', description: 'Maximum stock filter' },
                    // createdAfter: { type: 'string', description: 'Created after date' },
                    // createdBefore: { type: 'string', description: 'Created before date' },
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
                                additionalProperties: true // Allow any fields in product objects
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
    }, productController.getProducts.bind(productController));
    // GET /v1/products/:id - Get product by ID
    fastify.get('/:id', {
        schema: {
            description: 'Get product by ID',
            tags: ['Products'],
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
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in product object
                        },
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
    }, productController.getProduct.bind(productController));
    // POST /v1/products - Create new product
    fastify.post('/', {
        schema: {
            description: 'Create a new product',
            tags: ['Products'],
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in product object
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
    }, productController.createProduct.bind(productController));
    // PUT /v1/products/:id - Update product
    fastify.put('/:id', {
        schema: {
            description: 'Update product by ID',
            tags: ['Products'],
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
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in product object
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
    }, productController.updateProduct.bind(productController));
    // DELETE /v1/products/:id - Delete product
    fastify.delete('/:id', {
        schema: {
            description: 'Delete product by ID',
            tags: ['Products'],
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
    }, productController.deleteProduct.bind(productController));
    // POST /v1/products/upsert - Upsert product
    fastify.post('/upsert', {
        schema: {
            description: 'Create or update product (upsert)',
            tags: ['Products'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: { type: 'object' },
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
    }, productController.upsertProduct.bind(productController));
}
//# sourceMappingURL=product.route.js.map