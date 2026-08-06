import { FastifyInstance } from 'fastify';
import { InstoreOrderController } from '../controllers/instore-order.controller.js';

export async function instoreOrderRoutes(fastify: FastifyInstance) {
  const controller = new InstoreOrderController();

  fastify.get('/customers', {
    schema: {
      description: 'Search existing customers for a new in-store order',
      tags: ['In-store Orders'],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string', maxLength: 100 },
          limit: { type: 'number', minimum: 1, maximum: 50 },
        },
      },
    },
  }, controller.searchCustomers.bind(controller));

  fastify.get('/products', {
    schema: {
      description: 'Search products with prioritized NIVAPP in-store availability',
      tags: ['In-store Orders'],
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string', maxLength: 100 },
          limit: { type: 'number', minimum: 1, maximum: 50 },
        },
      },
    },
  }, controller.searchProducts.bind(controller));

  fastify.post('/', {
    schema: {
      description: 'Atomically complete an in-store sale and consume NIVAPP stock',
      tags: ['In-store Orders'],
      body: {
        type: 'object',
        required: ['client_reference', 'customer', 'items', 'payment_method'],
        additionalProperties: false,
        properties: {
          client_reference: { type: 'string', minLength: 8, maxLength: 100 },
          customer: {
            type: 'object',
            additionalProperties: false,
            properties: {
              customer_id: { type: 'number' },
              name: { type: 'string' },
              mobile: { type: 'string' },
            },
          },
          items: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: {
              type: 'object',
              required: ['product_id', 'quantity'],
              additionalProperties: false,
              properties: {
                product_id: { type: 'number' },
                quantity: { type: 'number', minimum: 1, maximum: 100 },
              },
            },
          },
          manual_discount: {
            type: 'object',
            additionalProperties: false,
            properties: {
              type: { type: 'string', enum: ['none', 'fixed', 'percentage'] },
              value: { type: 'number', minimum: 0 },
              reason: { type: 'string', maxLength: 500 },
            },
          },
          payment_method: { type: 'string', enum: ['cash', 'card', 'upi'] },
          payment_reference: { type: 'string', maxLength: 500 },
          store_location: { type: 'string', maxLength: 500 },
        },
      },
    },
  }, controller.create.bind(controller));
}
