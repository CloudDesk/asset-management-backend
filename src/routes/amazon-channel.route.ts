import { FastifyInstance } from 'fastify';
import { AmazonListingController } from '../controllers/amazon-listing.controller.js';
import { AmazonOrderController } from '../controllers/amazon-order.controller.js';
import { requireAuthentication } from '../middleware/auth.middleware.js';
import { requireAmazonChannelPermission } from '../middleware/amazon-channel-permission.middleware.js';
import { getAmazonIntegrationStatus } from '../services/amazon-integration-status.service.js';

export async function amazonChannelRoutes(fastify: FastifyInstance) {
  const controller = new AmazonListingController();
  const orderController = new AmazonOrderController();

  fastify.get('/status', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['read'])],
    schema: {
      description: 'Report the configured Amazon production and sandbox modes without exposing credentials',
      tags: ['Amazon Integration'],
      security: [{ bearerAuth: [] }],
    },
  }, async (_request, reply) => reply.code(200).send({
    success: true,
    message: 'Amazon integration status retrieved successfully',
    data: getAmazonIntegrationStatus(),
  }));

  fastify.post('/listings/import', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['import', 'create'])],
    schema: {
      description: 'Import Amazon India production listings into Nivaana in read-only Amazon mode',
      tags: ['Amazon Production Listings'],
      security: [{ bearerAuth: [] }],
    },
  }, controller.importListings);

  fastify.post('/orders/import', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['import', 'create'])],
    schema: {
      description: 'Import non-PII Amazon orders through Orders API v2026-01-01',
      tags: ['Amazon Order Hub'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          fullHistory: { type: 'boolean', default: false },
        },
        additionalProperties: false,
      },
    },
  }, orderController.importOrders);

  fastify.get('/orders', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['read'])],
    schema: {
      description: 'View imported Amazon orders, item mappings, fulfilment routes, and sync state',
      tags: ['Amazon Order Hub'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          search: { type: 'string', minLength: 1, maxLength: 255 },
          syncState: { type: 'string', minLength: 1, maxLength: 255 },
          fulfilmentType: { type: 'string', enum: ['FBA', 'EASY_SHIP', 'MFN', 'UNKNOWN'] },
        },
        additionalProperties: false,
      },
    },
  }, orderController.getOrders);

  fastify.get('/listings', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['read'])],
    schema: {
      description: 'List imported Amazon India production listings without exposing credentials',
      tags: ['Amazon Production Listings'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string', minLength: 1, maxLength: 255 },
          mappingStatus: { type: 'string', enum: ['UNMAPPED', 'MAPPED', 'CONFLICT'] },
          fulfilmentChannel: { type: 'string', enum: ['MFN', 'EASY_SHIP', 'FBA', 'UNKNOWN'] },
          listingStatus: { type: 'string', minLength: 1, maxLength: 255 },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        additionalProperties: false,
      },
    },
  }, controller.getListings);

  fastify.get('/listings/:listingId', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['read'])],
    schema: {
      description: 'Get scoped Amazon listing details and operational issues',
      tags: ['Amazon Production Listings'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['listingId'],
        properties: { listingId: { type: 'string', pattern: '^[1-9]\\d*$' } },
        additionalProperties: false,
      },
    },
  }, controller.getListingDetails);

  fastify.get('/listings/:listingId/suggestions', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['read'])],
    schema: {
      description: 'Suggest Nivaana products for an imported Amazon listing',
      tags: ['Amazon Production Listings'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['listingId'],
        properties: { listingId: { type: 'string', pattern: '^[1-9]\\d*$' } },
        additionalProperties: false,
      },
    },
  }, controller.getSuggestions);

  fastify.get('/listings/:listingId/audits', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['read'])],
    schema: {
      description: 'Get mapping, remapping, edit, and unmapping history for a listing',
      tags: ['Amazon Production Listings'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['listingId'],
        properties: { listingId: { type: 'string', pattern: '^[1-9]\\d*$' } },
        additionalProperties: false,
      },
    },
  }, controller.getMappingAudits);

  fastify.post('/listings/bulk-map', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['create', 'edit', 'modifyall'])],
    schema: {
      description: 'Map up to 100 imported Amazon listings without changing inventory',
      tags: ['Amazon Production Listings'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: {
              type: 'object',
              required: ['listingId', 'productId'],
              properties: {
                listingId: { type: 'string', pattern: '^[1-9]\\d*$' },
                productId: { anyOf: [{ type: 'string', pattern: '^[1-9]\\d*$' }, { type: 'integer', minimum: 1 }] },
                unitsPerListing: { type: 'integer', minimum: 1, maximum: 10_000, default: 1 },
                allowRemap: { type: 'boolean', default: false },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    },
  }, controller.bulkMapListings);

  fastify.post('/listings/inventory/bulk-preview', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['read'])],
    schema: {
      description: 'Preview MFN inventory changes for up to 25 listings without modifying Amazon',
      tags: ['Amazon Production Inventory'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['listingIds'],
        properties: {
          listingIds: { type: 'array', minItems: 1, maxItems: 25, uniqueItems: true, items: { type: 'string', pattern: '^[1-9]\\d*$' } },
        },
        additionalProperties: false,
      },
    },
  }, controller.bulkPreviewInventorySync);

  fastify.post('/listings/inventory/bulk-sync', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['edit', 'modifyall'])],
    schema: {
      description: 'Publish up to 25 explicitly previewed MFN inventory updates',
      tags: ['Amazon Production Inventory'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['items'],
        properties: {
          items: {
            type: 'array', minItems: 1, maxItems: 25,
            items: {
              type: 'object', required: ['listingId', 'previewId'],
              properties: {
                listingId: { type: 'string', pattern: '^[1-9]\\d*$' },
                previewId: { type: 'string', pattern: '^[1-9]\\d*$' },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    },
  }, controller.bulkSyncInventoryNow);

  fastify.post('/listings/:listingId/inventory/preview', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['read'])],
    schema: {
      description: 'Preview the exact MFN inventory change without modifying Amazon',
      tags: ['Amazon Production Inventory'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['listingId'],
        properties: { listingId: { type: 'string', pattern: '^[1-9]\\d*$' } },
        additionalProperties: false,
      },
    },
  }, controller.previewInventorySync);

  fastify.post('/listings/:listingId/inventory/sync', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['edit', 'modifyall'])],
    schema: {
      description: 'Publish one previously previewed MFN inventory quantity to Amazon',
      tags: ['Amazon Production Inventory'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['listingId'],
        properties: { listingId: { type: 'string', pattern: '^[1-9]\\d*$' } },
        additionalProperties: false,
      },
      body: {
        type: 'object',
        required: ['previewId'],
        properties: { previewId: { type: 'string', pattern: '^[1-9]\\d*$' } },
        additionalProperties: false,
      },
    },
  }, controller.syncInventoryNow);

  fastify.patch('/listings/:listingId/inventory/mode', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['edit', 'modifyall'])],
    schema: {
      description: 'Enable manual MFN inventory sync or pause inventory publishing for a listing',
      tags: ['Amazon Production Inventory'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['listingId'],
        properties: { listingId: { type: 'string', pattern: '^[1-9]\\d*$' } },
        additionalProperties: false,
      },
      body: {
        type: 'object',
        required: ['mode'],
        properties: { mode: { type: 'string', enum: ['DISABLED', 'MANUAL', 'AUTOMATIC'] } },
        additionalProperties: false,
      },
    },
  }, controller.setInventorySyncMode);

  fastify.get('/listings/:listingId/inventory/history', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['read'])],
    schema: {
      description: 'View MFN inventory preview and publishing attempt history',
      tags: ['Amazon Production Inventory'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['listingId'],
        properties: { listingId: { type: 'string', pattern: '^[1-9]\\d*$' } },
        additionalProperties: false,
      },
    },
  }, controller.getInventorySyncHistory);

  fastify.post('/listings/:listingId/inventory/retry', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['edit', 'modifyall'])],
    schema: {
      description: 'Retry a failed MFN inventory update after creating a fresh safety preview',
      tags: ['Amazon Production Inventory'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object', required: ['listingId'],
        properties: { listingId: { type: 'string', pattern: '^[1-9]\\d*$' } },
        additionalProperties: false,
      },
      body: {
        type: 'object', required: ['attemptId'],
        properties: { attemptId: { type: 'string', pattern: '^[1-9]\\d*$' } },
        additionalProperties: false,
      },
    },
  }, controller.retryInventorySync);

  fastify.post('/listings/:listingId/map', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['create', 'edit', 'modifyall'])],
    schema: {
      description: 'Map an imported Amazon production listing to a Nivaana product without changing stock',
      tags: ['Amazon Production Listings'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['listingId'],
        properties: {
          listingId: { type: 'string', pattern: '^[1-9]\\d*$' },
        },
        additionalProperties: false,
      },
      body: {
        type: 'object',
        required: ['productId'],
        properties: {
          productId: {
            anyOf: [
              { type: 'string', pattern: '^[1-9]\\d*$' },
              { type: 'integer', minimum: 1 },
            ],
          },
          unitsPerListing: { type: 'integer', minimum: 1, maximum: 10_000, default: 1 },
          allowRemap: { type: 'boolean', default: false },
        },
        additionalProperties: false,
      },
    },
  }, controller.mapListing);

  fastify.delete('/listings/:listingId/map', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['delete', 'edit', 'modifyall'])],
    schema: {
      description: 'Remove a Nivaana product mapping from an imported Amazon production listing without changing stock',
      tags: ['Amazon Production Listings'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['listingId'],
        properties: {
          listingId: { type: 'string', pattern: '^[1-9]\\d*$' },
        },
        additionalProperties: false,
      },
    },
  }, controller.unmapListing);
}
