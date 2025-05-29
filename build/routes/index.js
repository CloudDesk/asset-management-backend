import { productRoutes } from './product.route.js';
import { stockRoutes } from './stock.route.js';
import { picklistRoutes } from './picklist.route.js';
import { supplierRoutes } from './supplier.route.js';
import { purchaseOrderRoutes } from './purchaseorder.route.js';
import { purchaseRequestRoutes } from './purchaserequest.route.js';
import { quotesRoutes } from './quotes.route.js';
import { createSuccessResponse } from '../utils/errorHandler.js';
export async function routes(fastify) {
    // Health check endpoint
    fastify.get('/health', {
        schema: {
            description: 'Health check endpoint',
            tags: ['Health'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: {
                            type: 'object',
                            properties: {
                                status: { type: 'string' },
                                timestamp: { type: 'string' },
                                uptime: { type: 'number' },
                                environment: { type: 'string' },
                            },
                        },
                        errors: { type: 'null' },
                    },
                },
            },
        },
    }, async (request, reply) => {
        const healthData = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
        };
        const response = createSuccessResponse('Health check successful', healthData);
        return reply.code(200).send(response);
    });
    // API v1 routes
    await fastify.register(async function (fastify) {
        await fastify.register(productRoutes, { prefix: '/products' });
        await fastify.register(stockRoutes, { prefix: '/stocks' });
        await fastify.register(picklistRoutes, { prefix: '/picklists' });
        await fastify.register(supplierRoutes, { prefix: '/suppliers' });
        await fastify.register(purchaseOrderRoutes, { prefix: '/purchaseorders' });
        await fastify.register(purchaseRequestRoutes, { prefix: '/purchaserequests' });
        await fastify.register(quotesRoutes, { prefix: '/quotes' });
    }, { prefix: '/v1' });
}
//# sourceMappingURL=index.js.map