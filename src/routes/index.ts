import { FastifyInstance } from 'fastify';
import { productRoutes } from './product.route.js';
import { stockRoutes } from './stock.route.js';
import { platformStockRoutes } from './platformStock.route.js';
import { picklistRoutes, picklistRoutesV2 } from './picklist.route.js';
import { supplierRoutes } from './supplier.route.js';
import { purchaseOrderRoutes } from './purchaseorder.route.js';
import { purchaseRequestRoutes } from './purchaserequest.route.js';
import { quotesRoutes } from './quotes.route.js';
import { notesRoutes } from './notes.route.js';
import { usersRoutes } from './users.route.js';
import { inventoryUsersRoutes } from './inventoryusers.route.js';
import { roleRoutes } from './role.route.js';
import { permissionSetRoutes } from './permissionset.route.js';
import { authRoutes } from './auth.route.js';
import { mobileAuthRoutes } from './mobile-auth.route.js';
import { poinvoiceRoutes } from './poinvoice.route.js';
import { addressRoutes } from './address.route.js';
import { samplePurchaseRequestRoutes } from './samplepurchaserequest.route.js';
import { cartRoutes } from './cart.route.js';
import { ordersRoutes } from './orders.route.js';
import { orderlineRoutes } from './orderline.route.js';
import { transactionRoutes } from './transaction.route.js';
import { phonePeRoutes } from './phonepe.route.js';
import { promotionsRoutes } from './promotions.route.js';
import { ratingRoutes } from './rating.route.js';
import { smsRoutes } from './sms.route.js';
import { ekartRoutes } from './ekart.route.js';
import { smartAuthentication } from '../middleware/smartAuth.middleware.js';
import { createSuccessResponse } from '../utils/errorHandler.js';
import { permissionRoutes } from './permission.route.js';

export async function routes(fastify: FastifyInstance) {
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

  // ============================================================================
  // API v1 routes
  // ============================================================================
  await fastify.register(async function (fastify) {

    // -------------------------------------------------------------------------
    // ROUTE REGISTRATION - All routes inherit smart authentication
    // -------------------------------------------------------------------------
    // All routes registered below are automatically protected by the
    // smartAuthentication hook (applied at the end of this scope).
    // 
    // Routes are public or protected based on src/config/publicRoutes.ts
    // -------------------------------------------------------------------------

    // Authentication routes
    await fastify.register(authRoutes, { prefix: '/auth' });
    await fastify.register(mobileAuthRoutes, { prefix: '/mobile-auth' });

    // Application routes
    await fastify.register(productRoutes, { prefix: '/products' });
    await fastify.register(stockRoutes, { prefix: '/stocks' });
    await fastify.register(platformStockRoutes, { prefix: '/platform-stocks' });
    await fastify.register(picklistRoutes, { prefix: '/picklists' });
    await fastify.register(supplierRoutes, { prefix: '/suppliers' });
    await fastify.register(purchaseOrderRoutes, { prefix: '/purchaseorders' });
    await fastify.register(purchaseRequestRoutes, { prefix: '/purchaserequests' });
    await fastify.register(quotesRoutes, { prefix: '/quotes' });
    await fastify.register(notesRoutes, { prefix: '/notes' });
    await fastify.register(usersRoutes, { prefix: '/users' });
    await fastify.register(inventoryUsersRoutes, { prefix: '/inventoryusers' });
    await fastify.register(roleRoutes, { prefix: '/roles' });
    await fastify.register(permissionSetRoutes, { prefix: '/permission-sets' });
    await fastify.register(permissionRoutes, { prefix: '/permissions' });
    await fastify.register(poinvoiceRoutes, { prefix: '/poinvoices' });
    await fastify.register(addressRoutes, { prefix: '/addresses' });
    await fastify.register(samplePurchaseRequestRoutes, { prefix: '/samplepurchaserequests' });
    await fastify.register(cartRoutes, { prefix: '/carts' });
    await fastify.register(ordersRoutes, { prefix: '/orders' });
    await fastify.register(orderlineRoutes, { prefix: '/orderlines' });
    await fastify.register(transactionRoutes, { prefix: '/transactions' });
    await fastify.register(phonePeRoutes, { prefix: '/phonepe' });
    await fastify.register(promotionsRoutes, { prefix: '/promotions' });
    await fastify.register(ratingRoutes, { prefix: '/ratings' });
    await fastify.register(smsRoutes, { prefix: '/sms' });
    await fastify.register(ekartRoutes, { prefix: '/ekart' });

    // -------------------------------------------------------------------------
    // SMART AUTHENTICATION - Applied to ALL /v1 routes
    // -------------------------------------------------------------------------
    // The smartAuthentication middleware automatically determines if a route
    // requires authentication by checking against the public routes whitelist.
    // 
    // - Public routes (defined in src/config/publicRoutes.ts): Skip auth
    // - All other routes: Require authentication
    //
    // This provides centralized route protection without manual preHandler
    // configuration on each route.
    // -------------------------------------------------------------------------
    fastify.addHook('preHandler', smartAuthentication);

  }, { prefix: '/v1' });

  // API v2 routes
  await fastify.register(async function (fastify) {
    await fastify.register(picklistRoutesV2, { prefix: '/picklists' });
    fastify.addHook('preHandler', smartAuthentication);
  }, { prefix: '/v2' });
} 