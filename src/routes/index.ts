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
import { testRoutes } from './test.route.js';
import { requireAuthentication } from '../middleware/auth.middleware.js';
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
    // PUBLIC ROUTES - No authentication required
    // -------------------------------------------------------------------------
    // Auth routes: /v1/auth/* (signin, register, forgot-password, etc.)
    await fastify.register(authRoutes, { prefix: '/auth' });

    // Mobile auth routes: /v1/mobile-auth/* (for ecommerce users)
    await fastify.register(mobileAuthRoutes, { prefix: '/mobile-auth' });

    // Test routes: /v1/test/public, /v1/test/protected, etc.
    // These demonstrate public vs protected route patterns
    await fastify.register(testRoutes, { prefix: '' });

    // All routes below are currently PUBLIC (no auth middleware applied)
    // TODO: Move routes that require authentication into the protected scope below
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
    // PROTECTED ROUTES - Authentication required via requireAuthentication
    // -------------------------------------------------------------------------
    // Purpose: Any route registered in this scope will automatically have the
    // requireAuthentication middleware applied via the preHandler hook.
    // 
    // This means ALL routes here require a valid JWT Bearer token.
    // If authentication fails, the middleware returns 401 Unauthorized.
    //
    // Usage: Move routes that need auth protection here, or register new ones.
    // Example:
    //   await fastify.register(adminRoutes, { prefix: '/admin' });
    // -------------------------------------------------------------------------
    await fastify.register(async function (fastify) {
      // Apply authentication middleware to ALL routes in this scope
      fastify.addHook('preHandler', requireAuthentication);

      // Register protected routes here
      // Example: Admin-only routes, user profile management, etc.

    });

  }, { prefix: '/v1' });

  // API v2 routes
  await fastify.register(async function (fastify) {
    await fastify.register(picklistRoutesV2, { prefix: '/picklists' });
  }, { prefix: '/v2' });
} 