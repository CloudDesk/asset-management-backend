import { FastifyInstance } from 'fastify';
import { AmazonListingPublishController } from '../controllers/amazon-listing-publish.controller.js';
import { requireAuthentication } from '../middleware/auth.middleware.js';
import { requireAmazonOperationalCapability } from '../middleware/amazon-channel-permission.middleware.js';

const positiveIdParams = (name: string) => ({
  type: 'object',
  required: [name],
  properties: {
    [name]: { type: 'string', pattern: '^[1-9]\\d*$' },
  },
  additionalProperties: false,
});

export async function amazonListingPublishRoutes(fastify: FastifyInstance) {
  const controller = new AmazonListingPublishController();

  fastify.get('/publish-drafts', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'List scoped Amazon publishing drafts and published product mappings',
      tags: ['Amazon Listing Publish'],
      security: [{ bearerAuth: [] }],
    },
  }, controller.list);

  fastify.post('/products/:productId/publish-drafts/bootstrap', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Create or resume an Amazon publish draft prefilled from a Nivaana product without writing to Amazon',
      tags: ['Amazon Listing Publish'],
      security: [{ bearerAuth: [] }],
      params: positiveIdParams('productId'),
      body: {
        type: 'object',
        properties: {
          listingMode: {
            type: 'string',
            enum: ['UNDECIDED', 'MAP_EXISTING', 'OFFER_ONLY', 'FULL_CATALOG'],
            default: 'UNDECIDED',
          },
        },
        additionalProperties: false,
      },
    },
  }, controller.bootstrap);

  fastify.get('/publish-drafts/:draftId', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Retrieve a scoped Amazon publish draft with readiness, attempts, and audit history',
      tags: ['Amazon Listing Publish'],
      security: [{ bearerAuth: [] }],
      params: positiveIdParams('draftId'),
    },
  }, controller.get);

  fastify.patch('/publish-drafts/:draftId', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Save editable Amazon draft values without publishing to Amazon',
      tags: ['Amazon Listing Publish'],
      security: [{ bearerAuth: [] }],
      params: positiveIdParams('draftId'),
      body: {
        type: 'object', required: ['draftRevision'],
        properties: {
          draftRevision: { type: 'integer', minimum: 1 },
          listingMode: { type: 'string', enum: ['UNDECIDED', 'MAP_EXISTING', 'OFFER_ONLY', 'FULL_CATALOG'] },
          sellerSku: { type: 'string', minLength: 1, maxLength: 40, pattern: '^[A-Za-z0-9_-]+$' },
          mappedAttributes: { type: 'object', additionalProperties: true },
        },
        additionalProperties: false,
      },
    },
  }, controller.update);

  fastify.delete('/publish-drafts/:draftId', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Cancel an Amazon publish draft using optimistic revision protection',
      tags: ['Amazon Listing Publish'],
      security: [{ bearerAuth: [] }],
      params: positiveIdParams('draftId'),
      body: {
        type: 'object',
        required: ['draftRevision'],
        properties: {
          draftRevision: { type: 'integer', minimum: 1 },
          reason: { type: 'string', minLength: 1, maxLength: 500 },
        },
        additionalProperties: false,
      },
    },
  }, controller.cancel);

  const revisionBody = {
    draftRevision: { type: 'integer', minimum: 1 },
  };

  fastify.post('/publish-drafts/:draftId/catalog-search', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Search Amazon catalog candidates and store the read-only results on the draft',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: positiveIdParams('draftId'),
      body: {
        type: 'object', required: ['draftRevision'],
        properties: {
          ...revisionBody,
          identifiers: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'string', minLength: 1 } },
          identifiersType: { type: 'string', enum: ['ASIN', 'EAN', 'GTIN', 'ISBN', 'JAN', 'MINSAN', 'SKU', 'UPC'] },
          keywords: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'string', minLength: 1 } },
        },
        additionalProperties: false,
      },
    },
  }, controller.searchCatalog);

  fastify.post('/publish-drafts/:draftId/select-asin', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Select an ASIN from the latest draft candidates for offer-only listing',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: positiveIdParams('draftId'),
      body: { type: 'object', required: ['draftRevision', 'asin'], properties: { ...revisionBody, asin: { type: 'string', pattern: '^[A-Z0-9]{10}$' } }, additionalProperties: false },
    },
  }, controller.selectAsin);

  fastify.post('/publish-drafts/:draftId/no-catalog-match', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Confirm that catalog candidates do not match and switch the draft to full catalog creation',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: positiveIdParams('draftId'),
      body: { type: 'object', required: ['draftRevision', 'confirmed'], properties: { ...revisionBody, confirmed: { type: 'boolean', const: true } }, additionalProperties: false },
    },
  }, controller.confirmNoCatalogMatch);

  fastify.post('/publish-drafts/:draftId/product-types/search', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Retrieve and persist Amazon product type recommendations for a full catalog draft',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: positiveIdParams('draftId'),
      body: {
        type: 'object', required: ['draftRevision'],
        properties: {
          ...revisionBody,
          itemName: { type: 'string', minLength: 1, maxLength: 500 },
          keywords: { type: 'array', minItems: 1, maxItems: 20, items: { type: 'string', minLength: 1 } },
        },
        additionalProperties: false,
      },
    },
  }, controller.searchProductTypes);

  fastify.post('/publish-drafts/:draftId/product-types/select', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Select an Amazon product type from the latest recommendations',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: positiveIdParams('draftId'),
      body: { type: 'object', required: ['draftRevision', 'productType'], properties: { ...revisionBody, productType: { type: 'string', minLength: 1, maxLength: 100 } }, additionalProperties: false },
    },
  }, controller.selectProductType);

  fastify.post('/publish-drafts/:draftId/product-type-definition', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Fetch the selected Amazon Product Type Definition and build the complete editable attribute contract',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: positiveIdParams('draftId'),
      body: {
        type: 'object',
        required: ['draftRevision'],
        properties: { ...revisionBody },
        additionalProperties: false,
      },
    },
  }, controller.loadProductTypeDefinition);

  fastify.post('/publish-drafts/:draftId/eligibility/check', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Check Amazon listing restrictions for an existing ASIN, or record the pre-ASIN limitation for a new catalogue product',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: positiveIdParams('draftId'),
      body: {
        type: 'object',
        required: ['draftRevision'],
        properties: {
          ...revisionBody,
          conditionType: {
            type: 'string',
            enum: [
              'new_new', 'new_open_box', 'new_oem', 'refurbished_refurbished',
              'used_like_new', 'used_very_good', 'used_good', 'used_acceptable',
              'collectible_like_new', 'collectible_very_good', 'collectible_good',
              'collectible_acceptable', 'club_club',
            ],
            default: 'new_new',
          },
        },
        additionalProperties: false,
      },
    },
  }, controller.checkEligibility);

  fastify.post('/publish-drafts/:draftId/validation/local', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Validate the exact draft payload against the cached Amazon product-type schema without calling Amazon',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: positiveIdParams('draftId'),
      body: {
        type: 'object',
        required: ['draftRevision'],
        properties: { ...revisionBody },
        additionalProperties: false,
      },
    },
  }, controller.validateLocally);

  fastify.post('/publish-drafts/:draftId/validation/preview', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Run Amazon Listings Items VALIDATION_PREVIEW without creating or changing a listing',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: positiveIdParams('draftId'),
      body: {
        type: 'object',
        required: ['draftRevision'],
        properties: { ...revisionBody },
        additionalProperties: false,
      },
    },
  }, controller.previewValidation);

  fastify.post('/publish-drafts/:draftId/submit', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_publish')],
    schema: {
      description: 'Submit the exact Amazon-validated payload for production processing after explicit SKU confirmation',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: positiveIdParams('draftId'),
      body: {
        type: 'object',
        required: ['draftRevision', 'confirmed', 'confirmationText', 'idempotencyKey'],
        properties: {
          ...revisionBody,
          confirmed: { type: 'boolean', const: true },
          confirmationText: { type: 'string', minLength: 1, maxLength: 255 },
          idempotencyKey: { type: 'string', format: 'uuid' },
        },
        additionalProperties: false,
      },
    },
  }, controller.submit);

  fastify.post('/publish-drafts/:draftId/reconcile', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_publish')],
    schema: {
      description: 'Read the submitted SKU from Amazon and reconcile pending, live, or blocking-issue status',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: positiveIdParams('draftId'),
      body: {
        type: 'object',
        required: ['draftRevision'],
        properties: { ...revisionBody },
        additionalProperties: false,
      },
    },
  }, controller.reconcileSubmission);

  fastify.post('/publish-drafts/:draftId/correction/reopen', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_publish')],
    schema: {
      description: 'Reopen a needs-attention submission for correction while preserving submission history',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: positiveIdParams('draftId'),
      body: {
        type: 'object',
        required: ['draftRevision', 'confirmed', 'reason'],
        properties: {
          ...revisionBody,
          confirmed: { type: 'boolean', const: true },
          reason: { type: 'string', minLength: 3, maxLength: 500 },
        },
        additionalProperties: false,
      },
    },
  }, controller.reopenForCorrection);

  const draftImageParams = {
    type: 'object',
    required: ['draftId', 'imageId'],
    properties: {
      draftId: { type: 'string', pattern: '^[1-9]\\d*$' },
      imageId: { type: 'string', pattern: '^[1-9]\\d*$' },
    },
    additionalProperties: false,
  };

  fastify.post('/publish-drafts/:draftId/images', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Upload a JPEG or PNG owned by the Amazon draft without changing the Nivaana product',
      tags: ['Amazon Listing Publish'],
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      params: positiveIdParams('draftId'),
      querystring: {
        type: 'object',
        required: ['draftRevision'],
        properties: { draftRevision: { type: 'string', pattern: '^[1-9]\\d*$' } },
        additionalProperties: false,
      },
    },
  }, controller.uploadImage);

  fastify.delete('/publish-drafts/:draftId/images/:imageId', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Detach an image from the Amazon draft while retaining it for recovery',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: draftImageParams,
      body: {
        type: 'object', required: ['draftRevision'],
        properties: { ...revisionBody },
        additionalProperties: false,
      },
    },
  }, controller.detachImage);

  fastify.post('/publish-drafts/:draftId/images/:imageId/restore', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Restore a previously detached Amazon draft image',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: draftImageParams,
      body: {
        type: 'object', required: ['draftRevision'],
        properties: { ...revisionBody },
        additionalProperties: false,
      },
    },
  }, controller.restoreImage);

  fastify.put('/publish-drafts/:draftId/images/order', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Set the Amazon image order; the first image becomes the main image',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: positiveIdParams('draftId'),
      body: {
        type: 'object',
        required: ['draftRevision', 'imageIds'],
        properties: {
          ...revisionBody,
          imageIds: {
            type: 'array', minItems: 1, maxItems: 9, uniqueItems: true,
            items: { type: 'string', pattern: '^[1-9]\\d*$' },
          },
        },
        additionalProperties: false,
      },
    },
  }, controller.reorderImages);

  fastify.post('/publish-drafts/:draftId/images/verify', {
    preHandler: [requireAuthentication, requireAmazonOperationalCapability('amazon_listing_draft')],
    schema: {
      description: 'Verify that active Amazon draft image URLs are publicly accessible',
      tags: ['Amazon Listing Publish'], security: [{ bearerAuth: [] }], params: positiveIdParams('draftId'),
      body: {
        type: 'object', required: ['draftRevision'],
        properties: { ...revisionBody },
        additionalProperties: false,
      },
    },
  }, controller.verifyImages);
}
