import { productRoutes } from './product.route.js';
import { stockRoutes } from './stock.route.js';
import { picklistRoutes } from './picklist.route.js';
import { supplierRoutes } from './supplier.route.js';
import { purchaseOrderRoutes } from './purchaseorder.route.js';
import { purchaseRequestRoutes } from './purchaserequest.route.js';
import { quotesRoutes } from './quotes.route.js';
import { notesRoutes } from './notes.route.js';
import { usersRoutes } from './users.route.js';
import { inventoryUsersRoutes } from './inventoryusers.route.js';
import { authRoutes } from './auth.route.js';
import { poinvoiceRoutes } from './poinvoice.route.js';
import { addressRoutes } from './address.route.js';
import { samplePurchaseRequestRoutes } from './samplepurchaserequest.route.js';
import { cartRoutes } from './cart.route.js';
import { ordersRoutes } from './orders.route.js';
import { orderlineRoutes } from './orderline.route.js';
import { transactionRoutes } from './transaction.route.js';
import { requireAuthentication } from '../middleware/auth.middleware.js';
import { createSuccessResponse } from '../utils/errorHandler.js';
export async function routes(fastify) {
    // Health check endpoint (public)
    fastify.get('/health', {
        schema: {
            description: 'Health check endpoint - No authentication required',
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
    }, async (_request, reply) => {
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
        await fastify.register(authRoutes, { prefix: '/auth' });
        await fastify.register(productRoutes, { prefix: '/products' });
        await fastify.register(stockRoutes, { prefix: '/stocks' });
        await fastify.register(picklistRoutes, { prefix: '/picklists' });
        await fastify.register(supplierRoutes, { prefix: '/suppliers' });
        await fastify.register(purchaseOrderRoutes, { prefix: '/purchaseorders' });
        await fastify.register(purchaseRequestRoutes, { prefix: '/purchaserequests' });
        await fastify.register(quotesRoutes, { prefix: '/quotes' });
        await fastify.register(notesRoutes, { prefix: '/notes' });
        await fastify.register(usersRoutes, { prefix: '/users' });
        await fastify.register(inventoryUsersRoutes, { prefix: '/inventoryusers' });
        await fastify.register(poinvoiceRoutes, { prefix: '/poinvoices' });
        await fastify.register(addressRoutes, { prefix: '/addresses' });
        await fastify.register(samplePurchaseRequestRoutes, { prefix: '/samplepurchaserequests' });
        await fastify.register(cartRoutes, { prefix: '/carts' });
        await fastify.register(ordersRoutes, { prefix: '/orders' });
        await fastify.register(orderlineRoutes, { prefix: '/orderlines' });
        await fastify.register(transactionRoutes, { prefix: '/transactions' });
        await fastify.register(async function (fastify) {
            // Apply authentication middleware to all routes in this scope
            fastify.addHook('preHandler', requireAuthentication);
            // Register protected routes
        });
    }, { prefix: '/v1' });
}
//# sourceMappingURL=index.js.map