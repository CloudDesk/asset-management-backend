import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AmazonListingController } from '../controllers/amazon-listing.controller.js';
import { AmazonOrderController } from '../controllers/amazon-order.controller.js';
import { requireAuthentication } from '../middleware/auth.middleware.js';
import { requireAmazonChannelPermission } from '../middleware/amazon-channel-permission.middleware.js';
import { getAmazonIntegrationStatus } from '../services/amazon-integration-status.service.js';
import { timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { amazonOrderNotificationSchema } from '../schemas/amazon-order.schema.js';
import { amazonOrderNotificationService } from '../services/amazon-order-notification.service.js';
import { createSuccessResponse } from '../utils/errorHandler.js';

const requireAmazonNotificationSecret = async (request: FastifyRequest, reply: FastifyReply) => {
  const expected = env.AMAZON_NOTIFICATION_INGEST_SECRET;
  if (!expected) return reply.code(503).send({ success: false, message: 'Amazon notification ingestion is not configured' });
  const provided = request.headers['x-amazon-notification-secret'];
  if (typeof provided !== 'string') return reply.code(401).send({ success: false, message: 'Invalid Amazon notification credentials' });
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  if (expectedBytes.length !== providedBytes.length || !timingSafeEqual(expectedBytes, providedBytes)) {
    return reply.code(401).send({ success: false, message: 'Invalid Amazon notification credentials' });
  }
};

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

  fastify.get('/orders/import-jobs/latest', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['read'])],
    schema: { tags: ['Amazon Order Hub'], security: [{ bearerAuth: [] }] },
  }, orderController.getLatestImportJob);

  fastify.get<{ Params: { jobId: string } }>('/orders/import-jobs/:jobId', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['read'])],
    schema: {
      tags: ['Amazon Order Hub'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['jobId'], properties: { jobId: { type: 'string', pattern: '^\\d+$' } } },
    },
  }, orderController.getImportJob);

  fastify.post('/orders/notifications', {
    preHandler: [requireAmazonNotificationSecret],
    schema: {
      description: 'Receive a normalized Amazon order notification from the configured secure notification relay',
      tags: ['Amazon Order Hub'],
      headers: {
        type: 'object',
        required: ['x-amazon-notification-secret'],
        properties: { 'x-amazon-notification-secret': { type: 'string', minLength: 32 } },
      },
      body: {
        type: 'object',
        required: ['notificationId', 'notificationType', 'sellerId', 'marketplaceId', 'eventTime', 'payload'],
        properties: {
          notificationId: { type: 'string', minLength: 1, maxLength: 255 },
          notificationType: { type: 'string', minLength: 1, maxLength: 100 },
          sellerId: { type: 'string', minLength: 1, maxLength: 255 },
          marketplaceId: { type: 'string', minLength: 1, maxLength: 50 },
          eventTime: { type: 'string', format: 'date-time' },
          payload: {},
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const input = amazonOrderNotificationSchema.parse(request.body);
    const data = await amazonOrderNotificationService.ingest(input as {
      notificationId: string;
      notificationType: string;
      sellerId: string;
      marketplaceId: string;
      eventTime: string;
      payload: unknown;
    });
    return reply.code(data.duplicate ? 200 : 202).send(createSuccessResponse(data.duplicate ? 'Amazon order notification already received' : 'Amazon order notification queued', data));
  });

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
          orderStatus: { type: 'string', minLength: 1, maxLength: 50 },
          syncState: { type: 'string', minLength: 1, maxLength: 255 },
          fulfilmentType: { type: 'string', enum: ['FBA', 'EASY_SHIP', 'MFN', 'UNKNOWN'] },
        },
        additionalProperties: false,
      },
    },
  }, orderController.getOrders);

  const fulfillmentParams = {
    type: 'object', required: ['orderId'],
    properties: { orderId: { type: 'string', pattern: '^[1-9]\\d*$' } },
    additionalProperties: false,
  } as const;
  const fulfillmentWrite = [requireAuthentication, requireAmazonChannelPermission(['edit', 'modifyall'])];
  const packageBody = {
    type: 'object', required: ['weightGrams', 'lengthCm', 'widthCm', 'heightCm'],
    properties: {
      weightGrams: { type: 'integer', minimum: 11, maximum: 1000000 },
      lengthCm: { type: 'number', exclusiveMinimum: 0, maximum: 100000 },
      widthCm: { type: 'number', exclusiveMinimum: 0, maximum: 100000 },
      heightCm: { type: 'number', exclusiveMinimum: 0, maximum: 100000 },
    }, additionalProperties: false,
  } as const;
  const slotSchema = {
    type: 'object', required: ['slotId'],
    properties: {
      slotId: { type: 'string', minLength: 1, maxLength: 255 },
      startTime: { type: 'string', format: 'date-time' },
      endTime: { type: 'string', format: 'date-time' },
      handoverMethod: { type: 'string', enum: ['PICKUP', 'DROPOFF'] },
    }, additionalProperties: false,
  } as const;

  fastify.get('/orders/:orderId/fulfillment', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['read'])],
    schema: { tags: ['Amazon Fulfillment'], security: [{ bearerAuth: [] }], params: fulfillmentParams },
  }, orderController.getFulfillment);

  fastify.post('/orders/:orderId/fulfillment/pick', {
    preHandler: fulfillmentWrite,
    schema: { tags: ['Amazon Fulfillment'], security: [{ bearerAuth: [] }], params: fulfillmentParams },
  }, orderController.createPickTask);

  fastify.post('/orders/:orderId/fulfillment/pack', {
    preHandler: fulfillmentWrite,
    schema: { tags: ['Amazon Fulfillment'], security: [{ bearerAuth: [] }], params: fulfillmentParams,
      body: { ...packageBody, properties: { ...packageBody.properties, packageIdentifier: { type: 'string', minLength: 1, maxLength: 255 } } } },
  }, orderController.packOrder);

  fastify.post('/orders/:orderId/fulfillment/shipping-method', {
    preHandler: fulfillmentWrite,
    schema: { tags: ['Amazon Fulfillment'], security: [{ bearerAuth: [] }], params: fulfillmentParams,
      body: { type: 'object', required: ['shippingMethod'], properties: {
        shippingMethod: { type: 'string', minLength: 1, maxLength: 100 },
        logisticsPartner: { type: 'string', minLength: 1, maxLength: 255 },
      }, additionalProperties: false } },
  }, orderController.selectShipping);

  fastify.post('/orders/:orderId/fulfillment/documents', {
    preHandler: fulfillmentWrite,
    schema: { tags: ['Amazon Fulfillment'], security: [{ bearerAuth: [] }], params: fulfillmentParams,
      body: { type: 'object', minProperties: 1, properties: {
        invoiceUrl: { type: 'string', format: 'uri', maxLength: 2000 },
        packingSlipUrl: { type: 'string', format: 'uri', maxLength: 2000 },
        shippingLabelUrl: { type: 'string', format: 'uri', maxLength: 2000 },
      }, additionalProperties: false } },
  }, orderController.attachDocuments);

  fastify.post('/orders/:orderId/fulfillment/tracking', {
    preHandler: fulfillmentWrite,
    schema: { tags: ['Amazon Fulfillment'], security: [{ bearerAuth: [] }], params: fulfillmentParams,
      body: { type: 'object', required: ['courierCode', 'courierName', 'trackingNumber', 'shippingDate'], properties: {
        courierCode: { type: 'string', minLength: 1, maxLength: 100 },
        courierName: { type: 'string', minLength: 1, maxLength: 255 },
        trackingNumber: { type: 'string', minLength: 1, maxLength: 255 },
        shippingDate: { type: 'string', format: 'date-time' },
      }, additionalProperties: false } },
  }, orderController.addTracking);

  fastify.post('/orders/:orderId/fulfillment/mark-shipped', {
    preHandler: fulfillmentWrite,
    schema: { tags: ['Amazon Fulfillment'], security: [{ bearerAuth: [] }], params: fulfillmentParams },
  }, orderController.markShipped);

  fastify.post('/orders/:orderId/fulfillment/ship-and-confirm', {
    preHandler: fulfillmentWrite,
    schema: {
      description: 'Mark an eligible MFN order shipped in Nivaana and immediately confirm the shipment to Amazon',
      tags: ['Amazon Fulfillment'],
      security: [{ bearerAuth: [] }],
      params: fulfillmentParams,
    },
  }, orderController.shipAndConfirm);

  fastify.post('/orders/:orderId/fulfillment/confirm-amazon', {
    preHandler: fulfillmentWrite,
    schema: { tags: ['Amazon Fulfillment'], security: [{ bearerAuth: [] }], params: fulfillmentParams },
  }, orderController.confirmShipment);

  fastify.post('/orders/:orderId/fulfillment/easy-ship/slots', {
    preHandler: fulfillmentWrite,
    schema: { tags: ['Amazon Fulfillment'], security: [{ bearerAuth: [] }], params: fulfillmentParams, body: packageBody },
  }, orderController.listEasyShipSlots);

  fastify.post('/orders/:orderId/fulfillment/easy-ship/schedule', {
    preHandler: fulfillmentWrite,
    schema: { tags: ['Amazon Fulfillment'], security: [{ bearerAuth: [] }], params: fulfillmentParams,
      body: { ...packageBody, required: [...packageBody.required, 'slot'], properties: {
        ...packageBody.properties, slot: slotSchema, packageIdentifier: { type: 'string', minLength: 1, maxLength: 255 },
      } } },
  }, orderController.scheduleEasyShip);

  fastify.post('/orders/:orderId/fulfillment/easy-ship/refresh', {
    preHandler: fulfillmentWrite,
    schema: { tags: ['Amazon Fulfillment'], security: [{ bearerAuth: [] }], params: fulfillmentParams },
  }, orderController.refreshEasyShip);

  fastify.post('/orders/:orderId/fulfillment/easy-ship/reschedule', {
    preHandler: fulfillmentWrite,
    schema: { tags: ['Amazon Fulfillment'], security: [{ bearerAuth: [] }], params: fulfillmentParams,
      body: { type: 'object', required: ['slot'], properties: { slot: slotSchema }, additionalProperties: false } },
  }, orderController.rescheduleEasyShip);

  const fulfillmentExceptionParams = {
    type: 'object', required: ['orderId', 'exceptionId'], properties: {
      orderId: { type: 'string', pattern: '^\\d+$' }, exceptionId: { type: 'string', pattern: '^\\d+$' },
    }, additionalProperties: false,
  } as const;
  fastify.post('/orders/:orderId/fulfillment/exceptions/:exceptionId/retry', {
    preHandler: fulfillmentWrite,
    schema: { tags: ['Amazon Fulfillment'], security: [{ bearerAuth: [] }], params: fulfillmentExceptionParams },
  }, orderController.retryFulfillmentException);
  fastify.post('/orders/:orderId/fulfillment/exceptions/:exceptionId/resolve', {
    preHandler: fulfillmentWrite,
    schema: { tags: ['Amazon Fulfillment'], security: [{ bearerAuth: [] }], params: fulfillmentExceptionParams,
      body: { type: 'object', required: ['note'], properties: { note: { type: 'string', minLength: 1, maxLength: 2000 } }, additionalProperties: false } },
  }, orderController.resolveFulfillmentException);

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

  fastify.post('/listings/:listingId/offer/preview', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['read'])],
    schema: {
      description: 'Validate an Amazon offer update without changing the live listing', tags: ['Amazon Offer Updates'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['listingId'], properties: { listingId: { type: 'string', pattern: '^[1-9]\\d*$' } }, additionalProperties: false },
      body: { type: 'object', minProperties: 1, properties: {
        price: { type: 'number', exclusiveMinimum: 0, maximum: 100000000 },
        currency: { type: 'string', minLength: 3, maxLength: 3 },
        quantity: { type: 'integer', minimum: 0, maximum: 1000000 },
        handlingTimeDays: { type: 'integer', minimum: 0, maximum: 30 },
        available: { type: 'boolean' },
      }, additionalProperties: false },
    },
  }, controller.previewOfferUpdate);

  fastify.post('/listings/:listingId/offer/apply', {
    preHandler: [requireAuthentication, requireAmazonChannelPermission(['edit', 'modifyall'])],
    schema: {
      description: 'Submit a previously validated and explicitly confirmed Amazon offer update', tags: ['Amazon Offer Updates'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', required: ['listingId'], properties: { listingId: { type: 'string', pattern: '^[1-9]\\d*$' } }, additionalProperties: false },
      body: { type: 'object', required: ['previewId', 'confirmed'], properties: {
        previewId: { anyOf: [{ type: 'string', pattern: '^[1-9]\\d*$' }, { type: 'integer', minimum: 1 }] },
        confirmed: { type: 'boolean', const: true },
      }, additionalProperties: false },
    },
  }, controller.applyOfferUpdate);

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
