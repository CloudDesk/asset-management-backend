import { FastifyInstance } from 'fastify';
import { ShipmozoController } from '../controllers/shipmozo.controller.js';

const successResponse = {
  type: 'object',
  additionalProperties: true,
  properties: {
    success: { type: 'boolean' },
    message: { type: 'string' },
    data: {}
  }
};

export async function shipmozoRoutes(fastify: FastifyInstance) {
  const controller = new ShipmozoController();
  const tags = ['Shipmozo Logistics'];

  fastify.get('/connection-status', {
    schema: { tags, description: 'Check whether Shipmozo backend credentials are configured', response: { 200: successResponse } }
  }, controller.getConnectionStatus);

  fastify.get('/warehouses', {
    schema: {
      tags,
      description: 'Get Shipmozo warehouses',
      querystring: { type: 'object', properties: { page: { type: 'integer', minimum: 1 } } },
      response: { 200: successResponse }
    }
  }, controller.getWarehouses);

  fastify.get('/countries', {
    schema: {
      tags,
      description: 'Get countries supported by Shipmozo',
      response: { 200: successResponse }
    }
  }, controller.getCountries);

  fastify.get('/return-reasons', {
    schema: {
      tags,
      description: 'Get Shipmozo reverse-shipment return reasons',
      response: { 200: successResponse }
    }
  }, controller.getReturnReasons);

  fastify.get('/operations', {
    schema: {
      tags,
      description: 'List Shipmozo workflow and reconciliation records',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          direction: { type: 'string', enum: ['forward', 'reverse'] },
          order_id: { type: 'integer', minimum: 1 },
          return_request_id: { type: 'integer', minimum: 1 }
        }
      },
      response: { 200: successResponse }
    }
  }, controller.listOperations);

  fastify.post('/serviceability', {
    schema: {
      tags,
      description: 'Check Shipmozo pincode serviceability',
      body: {
        type: 'object',
        required: ['pickup_pincode', 'delivery_pincode'],
        properties: {
          pickup_pincode: { type: 'string' },
          delivery_pincode: { type: 'string' }
        }
      },
      response: { 200: successResponse }
    }
  }, controller.checkServiceability);

  fastify.post('/rates', {
    schema: { tags, description: 'Calculate Shipmozo shipping rates', body: { type: 'object', additionalProperties: true }, response: { 200: successResponse } }
  }, controller.calculateRates);

  fastify.post('/shipments/forward', {
    schema: {
      tags,
      description: 'Push a ready-for-dispatch Nivaana order to Shipmozo and assign a courier',
      body: { type: 'object', additionalProperties: true },
      response: { 200: successResponse }
    }
  }, controller.createForwardShipment);

  fastify.post('/returns', {
    schema: {
      tags,
      description: 'Push a reverse shipment to Shipmozo and optionally persist it against a Nivaana return request',
      body: { type: 'object', additionalProperties: true },
      response: { 200: successResponse }
    }
  }, controller.createReturnShipment);

  fastify.post('/pickups/schedule', {
    schema: {
      tags,
      description: 'Schedule a Shipmozo pickup and persist the returned AWB when a local order or return request is available',
      body: {
        type: 'object',
        required: ['order_id'],
        properties: {
          order_id: { type: 'string' },
          return_request_id: { type: 'integer', minimum: 1 }
        }
      },
      response: { 200: successResponse }
    }
  }, controller.schedulePickup);

  fastify.get('/shipments/:awbNumber/track', {
    schema: {
      tags,
      description: 'Track a Shipmozo shipment by AWB',
      params: { type: 'object', required: ['awbNumber'], properties: { awbNumber: { type: 'string' } } },
      response: { 200: successResponse }
    }
  }, controller.trackShipment);

  fastify.post('/tracking/sync', {
    schema: {
      tags,
      description: 'Run a bounded Shipmozo tracking synchronization batch',
      body: { type: 'object', properties: { limit: { type: 'integer', minimum: 1, maximum: 100 } } },
      response: { 200: successResponse }
    }
  }, controller.runTrackingSync);

  fastify.post('/webhook/track-status', {
    schema: {
      tags,
      description: 'Receive a Shipmozo status notification and reconcile authoritative tracking by AWB',
      headers: {
        type: 'object',
        properties: {
          'x-shipmozo-webhook-secret': { type: 'string' }
        }
      },
      body: {},
      response: { 200: successResponse }
    }
  }, controller.handleTrackingWebhook);

  fastify.post('/orders/:orderId/tracking/sync', {
    schema: {
      tags,
      description: 'Synchronize one Nivaana Shipmozo order from live tracking',
      params: { type: 'object', required: ['orderId'], properties: { orderId: { type: 'integer', minimum: 1 } } },
      response: { 200: successResponse }
    }
  }, controller.syncOrderTracking);

  fastify.post('/returns/:returnRequestId/tracking/sync', {
    schema: {
      tags,
      description: 'Synchronize one Shipmozo reverse shipment without auto-receiving inventory',
      params: { type: 'object', required: ['returnRequestId'], properties: { returnRequestId: { type: 'integer', minimum: 1 } } },
      response: { 200: successResponse }
    }
  }, controller.syncReturnTracking);

  fastify.get('/shipments/:awbNumber/label', {
    schema: {
      tags,
      description: 'Download a Shipmozo shipping label',
      params: { type: 'object', required: ['awbNumber'], properties: { awbNumber: { type: 'string' } } },
      querystring: { type: 'object', properties: { type: { type: 'string', enum: ['PDF'] } } }
    }
  }, controller.getLabel);

  fastify.get('/orders/:orderId', {
    schema: {
      tags,
      description: 'Get Shipmozo order details',
      params: { type: 'object', required: ['orderId'], properties: { orderId: { type: 'string' } } },
      response: { 200: successResponse }
    }
  }, controller.getOrderDetail);

  fastify.post('/shipments/cancel', {
    schema: {
      tags,
      description: 'Cancel a Shipmozo shipment',
      body: {
        type: 'object',
        required: ['order_id', 'awb_number'],
        properties: {
          order_id: { type: 'string' },
          awb_number: { type: 'string' }
        }
      },
      response: { 200: successResponse }
    }
  }, controller.cancelShipment);
}
