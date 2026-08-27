import { FastifyInstance } from 'fastify';
import { requireAuthentication } from '../middleware/auth.middleware.js';
import { requireFlipkartChannelRead } from '../middleware/flipkart-channel-permission.middleware.js';
import { requireFlipkartChannelPermission } from '../middleware/flipkart-channel-permission.middleware.js';
import {
  FlipkartConnectionError,
  flipkartConnectionService,
} from '../services/flipkart-connection.service.js';
import { createSuccessResponse } from '../utils/errorHandler.js';
import { FlipkartListingError, flipkartListingService } from '../services/flipkart-listing.service.js';
import { FlipkartInventoryError, flipkartInventoryService } from '../services/flipkart-inventory.service.js';
import { FlipkartOrderError, flipkartOrderService } from '../services/flipkart-order.service.js';

const listingError = (error: unknown, reply: any) => {
  if (error instanceof FlipkartListingError) return reply.code(error.statusCode).send({
    success: false, message: error.message, statusCode: error.statusCode, code: error.code,
  });
  throw error;
};

const inventoryError = (error: unknown, reply: any) => {
  if (error instanceof FlipkartInventoryError) return reply.code(error.statusCode).send({
    success: false, message: error.message, statusCode: error.statusCode, code: error.code,
  });
  throw error;
};

const orderError = (error: unknown, reply: any) => {
  if (error instanceof FlipkartOrderError) return reply.code(error.statusCode).send({ success: false, message: error.message, statusCode: error.statusCode, code: error.code });
  throw error;
};

export async function flipkartChannelRoutes(fastify: FastifyInstance) {
  fastify.post('/listings/import/mock', {
    preHandler: [requireAuthentication, requireFlipkartChannelPermission(['import', 'create'])],
    schema: { description: 'Import documented simulated Flipkart listings without contacting Flipkart', tags: ['Flipkart Mock Integration'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      return reply.code(201).send(createSuccessResponse('Mock Flipkart listings imported successfully', await flipkartListingService.importMockListings({ userId: user?.id, userType: user?.userType })));
    } catch (error) { return listingError(error, reply); }
  });

  fastify.get('/listings', {
    preHandler: [requireAuthentication, requireFlipkartChannelRead],
    schema: { description: 'List imported Flipkart listings and Nivaana mappings', tags: ['Flipkart Integration'], security: [{ bearerAuth: [] }] },
  }, async (_request, reply) => reply.code(200).send(createSuccessResponse('Flipkart listings retrieved successfully', await flipkartListingService.list())));

  fastify.post('/listings/:listingId/map', {
    preHandler: [requireAuthentication, requireFlipkartChannelPermission(['create', 'edit', 'modifyall'])],
    schema: {
      description: 'Map an imported Flipkart SKU to Nivaana inventory', tags: ['Flipkart Integration'], security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['listingId'], properties: { listingId: { type: 'string', pattern: '^\\d+$' } } },
      body: { type: 'object', required: ['productId'], additionalProperties: false, properties: { productId: { type: 'string', pattern: '^\\d+$' }, unitsPerListing: { type: 'integer', minimum: 1, maximum: 1000, default: 1 } } },
    },
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const params = request.params as { listingId: string };
      const body = request.body as { productId: string; unitsPerListing?: number };
      return reply.code(200).send(createSuccessResponse('Flipkart listing mapped successfully', await flipkartListingService.map(params.listingId, body.productId, body.unitsPerListing ?? 1, { userId: user?.id, userType: user?.userType })));
    } catch (error) { return listingError(error, reply); }
  });

  fastify.post('/inventory/preview', {
    preHandler: [requireAuthentication, requireFlipkartChannelPermission(['edit', 'modifyall'])],
    schema: {
      description: 'Create an expiring Flipkart inventory preview without making an external write', tags: ['Flipkart Mock Integration'], security: [{ bearerAuth: [] }],
      body: { type: 'object', required: ['listingId'], additionalProperties: false, properties: { listingId: { type: 'string', pattern: '^\\d+$' }, safetyBuffer: { type: 'integer', minimum: 0, maximum: 100000, default: 0 } } },
    },
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const body = request.body as { listingId: string; safetyBuffer?: number };
      return reply.code(201).send(createSuccessResponse('Flipkart inventory preview created', await flipkartInventoryService.preview(body.listingId, body.safetyBuffer ?? 0, { userId: user?.id, userType: user?.userType })));
    } catch (error) { return inventoryError(error, reply); }
  });

  fastify.post('/listings/:listingId/inventory-sync-mode', {
    preHandler: [requireAuthentication, requireFlipkartChannelPermission(['edit', 'modifyall'])],
    schema: {
      description: 'Configure guarded Flipkart inventory synchronization for a mapped listing', tags: ['Flipkart Integration'], security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['listingId'], properties: { listingId: { type: 'string', pattern: '^\\d+$' } } },
      body: { type: 'object', required: ['mode'], additionalProperties: false, properties: { mode: { type: 'string', enum: ['DISABLED', 'MANUAL', 'AUTOMATIC'] } } },
    },
  }, async (request, reply) => {
    try {
      const params = request.params as { listingId: string };
      const body = request.body as { mode: 'DISABLED' | 'MANUAL' | 'AUTOMATIC' };
      return reply.code(200).send(createSuccessResponse('Flipkart inventory synchronization mode updated', await flipkartInventoryService.setMode(params.listingId, body.mode)));
    } catch (error) { return inventoryError(error, reply); }
  });

  fastify.post('/inventory/dry-run', {
    preHandler: [requireAuthentication, requireFlipkartChannelPermission(['edit', 'modifyall'])],
    schema: {
      description: 'Apply a confirmed preview to the mock Flipkart adapter only', tags: ['Flipkart Mock Integration'], security: [{ bearerAuth: [] }],
      body: { type: 'object', required: ['previewId', 'confirmed'], additionalProperties: false, properties: { previewId: { type: 'string', pattern: '^\\d+$' }, confirmed: { type: 'boolean', const: true } } },
    },
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const body = request.body as { previewId: string; confirmed: boolean };
      return reply.code(200).send(createSuccessResponse('Flipkart inventory dry run completed', await flipkartInventoryService.dryRun(body.previewId, body.confirmed, { userId: user?.id, userType: user?.userType })));
    } catch (error) { return inventoryError(error, reply); }
  });

  fastify.get('/inventory/history', {
    preHandler: [requireAuthentication, requireFlipkartChannelRead],
    schema: { description: 'List mock Flipkart inventory attempts', tags: ['Flipkart Mock Integration'], security: [{ bearerAuth: [] }] },
  }, async (_request, reply) => reply.code(200).send(createSuccessResponse('Flipkart inventory history retrieved', await flipkartInventoryService.history())));

  fastify.post('/inventory/sync-all/dry-run', {
    preHandler: [requireAuthentication, requireFlipkartChannelPermission(['edit', 'modifyall'])],
    schema: {
      description: 'Preview and apply inventory for every eligible mapped listing through the mock adapter only', tags: ['Flipkart Mock Integration'], security: [{ bearerAuth: [] }],
      body: { type: 'object', additionalProperties: false, properties: { safetyBuffer: { type: 'integer', minimum: 0, maximum: 100000, default: 0 }, confirmed: { type: 'boolean', const: true } }, required: ['confirmed'] },
    },
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const body = request.body as { safetyBuffer?: number; confirmed: true };
      return reply.code(200).send(createSuccessResponse('Flipkart stock synchronization dry run completed', await flipkartInventoryService.syncAllDryRun(body.safetyBuffer ?? 0, { userId: user?.id, userType: user?.userType })));
    } catch (error) { return inventoryError(error, reply); }
  });

  fastify.post('/orders/import/mock', {
    preHandler: [requireAuthentication, requireFlipkartChannelPermission(['import', 'create'])],
    schema: { description: 'Import simulated Flipkart shipments without contacting Flipkart', tags: ['Flipkart Mock Integration'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      return reply.code(201).send(createSuccessResponse('Mock Flipkart orders imported successfully', await flipkartOrderService.importMockOrders({ userId: user?.id, userType: user?.userType })));
    } catch (error) { return orderError(error, reply); }
  });

  fastify.get('/orders', {
    preHandler: [requireAuthentication, requireFlipkartChannelRead],
    schema: { description: 'List imported Flipkart shipments', tags: ['Flipkart Integration'], security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    const query = request.query as { search?: string; status?: string; fulfilmentType?: string };
    return reply.code(200).send(createSuccessResponse('Flipkart orders retrieved successfully', await flipkartOrderService.list(query)));
  });

  fastify.get('/orders/:shipmentId', {
    preHandler: [requireAuthentication, requireFlipkartChannelRead],
    schema: { description: 'Get an imported Flipkart shipment', tags: ['Flipkart Integration'], security: [{ bearerAuth: [] }], params: { type: 'object', properties: { shipmentId: { type: 'string', pattern: '^\\d+$' } }, required: ['shipmentId'] } },
  }, async (request, reply) => {
    try { return reply.code(200).send(createSuccessResponse('Flipkart shipment retrieved successfully', await flipkartOrderService.get((request.params as { shipmentId: string }).shipmentId))); }
    catch (error) { return orderError(error, reply); }
  });

  fastify.post('/orders/:shipmentId/actions', {
    preHandler: [requireAuthentication, requireFlipkartChannelPermission(['edit', 'modifyall'])],
    schema: {
      description: 'Run a validated Flipkart shipment action through the mock adapter', tags: ['Flipkart Mock Integration'], security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { shipmentId: { type: 'string', pattern: '^\\d+$' } }, required: ['shipmentId'] },
      body: { type: 'object', required: ['action'], properties: { action: { type: 'string', enum: ['PACK', 'READY_TO_DISPATCH', 'SELF_SHIP_DISPATCH', 'REFRESH_TRACKING', 'MARK_DELIVERED', 'CANCEL'] }, invoiceNumber: { type: 'string' }, invoiceDate: { type: 'string' }, deliveryPartner: { type: 'string' }, deliveryPartnerCode: { type: 'string' }, trackingId: { type: 'string' }, tentativeDeliveryDate: { type: 'string' }, deliveryDate: { type: 'string' }, reason: { type: 'string' } } },
    },
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const body = request.body as { action: 'PACK' | 'READY_TO_DISPATCH' | 'SELF_SHIP_DISPATCH' | 'REFRESH_TRACKING' | 'MARK_DELIVERED' | 'CANCEL'; [key: string]: unknown };
      const { action, ...payload } = body;
      return reply.code(200).send(createSuccessResponse('Flipkart shipment action completed in mock mode', await flipkartOrderService.perform((request.params as { shipmentId: string }).shipmentId, action, payload, { userId: user?.id, userType: user?.userType })));
    } catch (error) { return orderError(error, reply); }
  });

  fastify.get('/orders/activity', {
    preHandler: [requireAuthentication, requireFlipkartChannelRead],
    schema: { description: 'List Flipkart fulfillment action history', tags: ['Flipkart Integration'], security: [{ bearerAuth: [] }] },
  }, async (_request, reply) => reply.code(200).send(createSuccessResponse('Flipkart order activity retrieved', await flipkartOrderService.activity())));

  fastify.get('/status', {
    preHandler: [requireAuthentication, requireFlipkartChannelRead],
    schema: {
      description: 'Return Flipkart self-access configuration status without exposing credentials',
      tags: ['Flipkart Integration'],
      security: [{ bearerAuth: [] }],
    },
  }, async (_request, reply) => reply.code(200).send(createSuccessResponse(
    'Flipkart integration status retrieved successfully',
    flipkartConnectionService.configurationStatus()
  )));

  fastify.post('/connection/test', {
    preHandler: [requireAuthentication, requireFlipkartChannelRead],
    schema: {
      description: 'Authenticate with Flipkart and discover the seller ID from an existing listing when available',
      tags: ['Flipkart Integration'],
      security: [{ bearerAuth: [] }],
    },
  }, async (_request, reply) => {
    try {
      const result = await flipkartConnectionService.testConnection();
      return reply.code(200).send(createSuccessResponse(
        result.sellerId
          ? 'Flipkart connected and seller ID discovered successfully'
          : 'Flipkart connected successfully; seller ID could not be discovered because no listings were found',
        result
      ));
    } catch (error) {
      if (error instanceof FlipkartConnectionError) {
        return reply.code(error.statusCode).send({
          success: false,
          message: error.message,
          statusCode: error.statusCode,
          code: error.code,
        });
      }
      throw error;
    }
  });
}
