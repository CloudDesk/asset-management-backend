import { FastifyInstance } from 'fastify';
import { AmazonListingController } from '../controllers/amazon-listing.controller.js';
import { requireAuthentication } from '../middleware/auth.middleware.js';

export async function amazonChannelRoutes(fastify: FastifyInstance) {
  const controller = new AmazonListingController();

  fastify.post('/listings/import', {
    preHandler: requireAuthentication,
    schema: {
      description: 'Import Amazon India production listings into Nivaana in read-only Amazon mode',
      tags: ['Amazon Production Listings'],
      security: [{ bearerAuth: [] }],
    },
  }, controller.importListings);

  fastify.get('/listings', {
    preHandler: requireAuthentication,
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

  fastify.post('/listings/:listingId/map', {
    preHandler: requireAuthentication,
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
    preHandler: requireAuthentication,
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
