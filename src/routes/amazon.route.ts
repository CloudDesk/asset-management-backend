import { FastifyInstance } from 'fastify';
import { AmazonController } from '../controllers/amazon.controller.js';
import { requireAuthentication } from '../middleware/auth.middleware.js';

export async function amazonRoutes(fastify: FastifyInstance) {
  const amazonController = new AmazonController();

  // GET /v1/amazon/products/:sellerId - Get product list
  fastify.get('/products/:sellerId', {
    schema: {
      description: 'Get all products for a seller',
      tags: ['Amazon SP-API'],
      params: {
        type: 'object',
        properties: {
          sellerId: { type: 'string', description: 'Amazon Seller ID' },
        },
        required: ['sellerId'],
      },
      querystring: {
        type: 'object',
        properties: {
          marketplaceId: { type: 'string', description: 'Marketplace ID (default: A21TJRUUN4KGV for India)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, amazonController.getProducts.bind(amazonController));

  // GET /v1/amazon/products/:sellerId/:sku - Get product by SKU
  fastify.get('/products/:sellerId/:sku', {
    schema: {
      description: 'Get product by SKU (Listings Items API - seller\'s own listing)',
      tags: ['Amazon SP-API'],
      params: {
        type: 'object',
        properties: {
          sellerId: { type: 'string', description: 'Amazon Seller ID' },
          sku: { type: 'string', description: 'Product SKU' },
        },
        required: ['sellerId', 'sku'],
      },
      querystring: {
        type: 'object',
        properties: {
          marketplaceId: { type: 'string', description: 'Marketplace ID (default: A21TJRUUN4KGV for India)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, amazonController.getProductBySku.bind(amazonController));

  // GET /v1/amazon/catalog/search - Search catalog items
  fastify.get('/catalog/search', {
    schema: {
      description: 'Search Amazon catalog items (Catalog Items API - search Amazon catalog)',
      tags: ['Amazon SP-API'],
      querystring: {
        type: 'object',
        properties: {
          keywords: { 
            type: 'string', 
            description: 'Comma-delimited list of words or identifiers to search for (required)' 
          },
          marketplaceIds: { 
            type: 'string', 
            description: 'Comma-separated marketplace IDs (default: A21TJRUUN4KGV for India)' 
          },
          pageSize: { 
            type: 'number', 
            description: 'Number of results per page (max 20, default 20)' 
          },
          pageToken: { 
            type: 'string', 
            description: 'Token for pagination' 
          },
        },
        required: ['keywords'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, amazonController.searchCatalogItems.bind(amazonController));

  // GET /v1/amazon/catalog/items/:asin - Get catalog item by ASIN
  fastify.get('/catalog/items/:asin', {
    schema: {
      description: 'Get catalog item by ASIN (Catalog Items API)',
      tags: ['Amazon SP-API'],
      params: {
        type: 'object',
        properties: {
          asin: { type: 'string', description: 'Amazon Standard Identification Number (ASIN)' },
        },
        required: ['asin'],
      },
      querystring: {
        type: 'object',
        properties: {
          marketplaceIds: { 
            type: 'string', 
            description: 'Comma-separated marketplace IDs (default: A21TJRUUN4KGV for India)' 
          },
          includedData: { 
            type: 'string', 
            description: 'Comma-separated list of data sets to include (e.g., summaries,attributes)' 
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, amazonController.getCatalogItem.bind(amazonController));

  // PATCH /v1/amazon/inventory/:sellerId/:sku - Update inventory
  fastify.patch('/inventory/:sellerId/:sku', {
    schema: {
      description: 'Update product inventory',
      tags: ['Amazon SP-API'],
      params: {
        type: 'object',
        properties: {
          sellerId: { type: 'string', description: 'Amazon Seller ID' },
          sku: { type: 'string', description: 'Product SKU' },
        },
        required: ['sellerId', 'sku'],
      },
      body: {
        type: 'object',
        properties: {
          quantity: { type: 'number', description: 'Inventory quantity' },
          fulfillmentChannelCode: { type: 'string', description: 'Fulfillment channel code (default: DEFAULT)' },
        },
        required: ['quantity'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, amazonController.updateInventory.bind(amazonController));

  // GET /v1/amazon/orders - Get orders
  fastify.get('/orders', {
    schema: {
      description: 'Get orders from Amazon',
      tags: ['Amazon SP-API'],
      querystring: {
        type: 'object',
        properties: {
          marketplaceId: { type: 'string', description: 'Marketplace ID (default: A21TJRUUN4KGV for India)' },
          createdAfter: { type: 'string', description: 'ISO 8601 date string (e.g., 2025-01-01T00:00:00Z)' },
          createdBefore: { type: 'string', description: 'ISO 8601 date string' },
          orderStatuses: { type: 'string', description: 'Comma-separated order statuses (e.g., Unshipped,Shipped)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, amazonController.getOrders.bind(amazonController));

  // GET /v1/amazon/orders/:orderId/items - Get order items
  fastify.get('/orders/:orderId/items', {
    schema: {
      description: 'Get items for a specific order',
      tags: ['Amazon SP-API'],
      params: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'Amazon Order ID' },
        },
        required: ['orderId'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, amazonController.getOrderItems.bind(amazonController));

  // ============================================
  // Token Management Routes
  // ============================================

  // GET /v1/amazon/auth/token - Get or refresh access token
  fastify.get('/auth/token', {
    schema: {
      description: 'Get or refresh Amazon SP-API access token',
      tags: ['Amazon SP-API'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                accessToken: { type: 'string', description: 'Access token for SP-API calls' },
                expiresIn: { type: 'number', description: 'Token expiry time in seconds (3600 = 1 hour)' },
                note: { type: 'string', description: 'Additional information about token' },
              },
            },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, amazonController.getAccessToken.bind(amazonController));

  // GET /v1/amazon/auth/authenticated-seller-id - Get the authenticated seller ID
  fastify.get('/auth/authenticated-seller-id', {
    schema: {
      description: 'Get the authenticated seller ID (the seller associated with your refresh token). This is the sellerId that must be used in Listings Items API calls.',
      tags: ['Amazon SP-API'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                sellerId: { type: 'string', description: 'The authenticated seller ID' },
                note: { type: 'string', description: 'Usage instructions' },
              },
            },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, amazonController.getAuthenticatedSellerId.bind(amazonController));

  // GET /v1/amazon/auth/seller-info - Get seller ID and marketplace information
  fastify.get('/auth/seller-info', {
    schema: {
      description: 'Get Amazon seller ID and marketplace participations. You can also provide sellerId manually as query parameter if found from Amazon URL.',
      tags: ['Amazon SP-API'],
      querystring: {
        type: 'object',
        properties: {
          sellerId: {
            type: 'string',
            description: 'Optional: Manually provide seller ID if found from Amazon URL (e.g., from https://www.amazon.in/sp?seller=APCBEZW09ZM60)'
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                sellerId: { type: 'string', description: 'Amazon Seller ID' },
                sellerInfo: { type: 'object', description: 'Seller information' },
                marketplaces: { type: 'array', description: 'List of marketplaces the seller participates in' },
              },
            },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, amazonController.getSellerInfo.bind(amazonController));

  // ============================================
  // OAuth Flow Routes (Step 5)
  // ============================================

  // POST /v1/amazon/auth/initiate - Initiate OAuth connection
  fastify.post('/auth/initiate', {
    preHandler: requireAuthentication,
    schema: {
      description: 'Initiate Amazon OAuth connection',
      tags: ['Amazon SP-API'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          redirectUri: {
            type: 'string',
            description: 'Redirect URI for OAuth callback (must match registered URI)',
          },
          state: {
            type: 'string',
            description: 'Optional state parameter for CSRF protection (auto-generated if not provided)',
          },
        },
        required: ['redirectUri'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                authorizationUrl: { type: 'string' },
                state: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, amazonController.initiateOAuth.bind(amazonController));

  // POST /v1/amazon/auth/callback - Handle OAuth callback
  fastify.post('/auth/callback', {
    preHandler: requireAuthentication,
    schema: {
      description: 'Handle Amazon OAuth callback',
      tags: ['Amazon SP-API'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'Authorization code from Amazon (spapi_oauth_code)',
          },
          sellingPartnerId: {
            type: 'string',
            description: 'Optional: Seller ID from Amazon redirect (selling_partner_id)',
          },
          state: {
            type: 'string',
            description: 'State parameter for CSRF protection',
          },
        },
        required: ['code', 'state'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                sellerId: { type: 'string' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, amazonController.handleOAuthCallback.bind(amazonController));

  // POST /v1/amazon/orders/:orderId/shipment - Confirm shipment
  fastify.post('/orders/:orderId/shipment', {
    schema: {
      description: 'Confirm shipment for an order',
      tags: ['Amazon SP-API'],
      params: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'Amazon Order ID' },
        },
        required: ['orderId'],
      },
      body: {
        type: 'object',
        properties: {
          packageReferenceId: { type: 'string', description: 'Package reference ID' },
          carrierCode: { type: 'string', description: 'Carrier code (e.g., BlueDart, Delhivery)' },
          shippingMethod: { type: 'string', description: 'Shipping method' },
          trackingNumber: { type: 'string', description: 'Tracking number' },
          shipDate: { type: 'string', description: 'Ship date in ISO 8601 format' },
        },
        required: ['packageReferenceId', 'carrierCode', 'shippingMethod', 'trackingNumber', 'shipDate'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, amazonController.confirmShipment.bind(amazonController));
}

