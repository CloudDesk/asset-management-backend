import { FastifyInstance } from 'fastify';
import { AmazonController } from '../controllers/amazon.controller.js';

export async function amazonRoutes(fastify: FastifyInstance) {
  const amazonController = new AmazonController();

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

  // GET /v1/amazon/auth/account - Get seller account details
  fastify.get('/auth/account', {
    schema: {
      description: 'Get seller account details including business type, selling plan, marketplace participations, and contact information. Available in EU marketplace (includes India).',
      tags: ['Amazon SP-API'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              additionalProperties: true, // Allow any properties in data object
            },
          },
          additionalProperties: false,
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
  }, amazonController.getAccountDetails.bind(amazonController));

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

  // ============================================
  // Phase 2: Product Operations (Read) Routes
  // ============================================

  // GET /v1/amazon/listings/:sellerId/:sku - Get listing item by SKU
  fastify.get('/listings/:sellerId/:sku', {
    schema: {
      description: 'Get listing item by SKU (seller\'s own listing)',
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
          includedData: { type: 'string', description: 'Comma-separated data to include (e.g., summaries,attributes)' },
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
              additionalProperties: true, // Allow any properties in data object (sku, summaries, etc.)
            },
          },
          additionalProperties: false, // But don't allow extra top-level properties
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
  }, amazonController.getListingItemBySku.bind(amazonController));

  // GET /v1/amazon/listings/:sellerId - Get all listings for a seller
  fastify.get('/listings/:sellerId', {
    schema: {
      description: 'Get all listings items for a seller (no filters - returns all products)',
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
          pageSize: { type: 'number', description: 'Number of results per page (default: 20, max: 100)' },
          pageToken: { type: 'string', description: 'Token for pagination (from previous response)' },
          includeInventory: { 
            type: 'string', 
            description: 'Include inventory data (fulfillment method and quantity). Set to "true" or "1" to enable. Note: This will make additional API calls and may slow down the response.' 
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
              additionalProperties: true, // Allow any properties in data object
            },
          },
          additionalProperties: false,
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
  }, amazonController.getAllListingsItems.bind(amazonController));

  // GET /v1/amazon/listings/:sellerId/search - Search listings items
  fastify.get('/listings/:sellerId/search', {
    schema: {
      description: 'Search listings items (seller\'s own listings) with filters',
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
          keywords: { type: 'string', description: 'Comma-separated keywords to search for' },
          sellerSkus: { type: 'string', description: 'Comma-separated seller SKUs to filter by' },
          asins: { type: 'string', description: 'Comma-separated ASINs to filter by' },
          pageSize: { type: 'number', description: 'Number of results per page' },
          pageToken: { type: 'string', description: 'Token for pagination' },
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
              additionalProperties: true, // Allow any properties in data object
            },
          },
          additionalProperties: false,
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
  }, amazonController.searchListingsItems.bind(amazonController));

  // GET /v1/amazon/catalog/search - Search catalog items
  fastify.get('/catalog/search', {
    schema: {
      description: 'Search Amazon catalog items',
      tags: ['Amazon SP-API'],
      querystring: {
        type: 'object',
        properties: {
          keywords: { 
            type: 'string', 
            description: 'Comma-separated keywords to search for (required)' 
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
      description: 'Get catalog item by ASIN',
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
            description: 'Comma-separated data to include (e.g., summaries,attributes)' 
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
  }, amazonController.getCatalogItemByAsin.bind(amazonController));

  // ============================================
  // Phase 3: Order Operations (Read) Routes
  // ============================================

  // GET /v1/amazon/orders - Get orders (list of orders)
  fastify.get('/orders', {
    schema: {
      description: 'Get orders (list of orders) with optional filters. Supports pagination using nextToken.',
      tags: ['Amazon SP-API'],
      querystring: {
        type: 'object',
        properties: {
          marketplaceIds: { 
            type: 'string', 
            description: 'Comma-separated marketplace IDs (default: A21TJRUUN4KGV for India)' 
          },
          createdAfter: { 
            type: 'string', 
            description: 'Get orders created after this date (ISO 8601 format, e.g., 2025-01-01T00:00:00Z)' 
          },
          createdBefore: { 
            type: 'string', 
            description: 'Get orders created before this date (ISO 8601 format)' 
          },
          lastUpdatedAfter: { 
            type: 'string', 
            description: 'Get orders updated after this date (ISO 8601 format)' 
          },
          lastUpdatedBefore: { 
            type: 'string', 
            description: 'Get orders updated before this date (ISO 8601 format)' 
          },
          orderStatuses: { 
            type: 'string', 
            description: 'Comma-separated order statuses (e.g., Unshipped,PartiallyShipped,Shipped,Canceled)' 
          },
          fulfillmentChannels: { 
            type: 'string', 
            description: 'Comma-separated fulfillment channels (MFN, AFN)' 
          },
          paymentMethods: { 
            type: 'string', 
            description: 'Comma-separated payment methods (COD, CreditCard, etc.)' 
          },
          buyerEmail: { 
            type: 'string', 
            description: 'Filter by buyer email' 
          },
          sellerOrderId: { 
            type: 'string', 
            description: 'Filter by seller order ID' 
          },
          maxResultsPerPage: { 
            type: 'number', 
            description: 'Maximum number of results per page (1-100, default: 100)' 
          },
          easyShipShipmentStatuses: { 
            type: 'string', 
            description: 'Comma-separated Easy Ship shipment statuses' 
          },
          nextToken: { 
            type: 'string', 
            description: 'Token for pagination (from previous response)' 
          },
          amazonOrderIds: { 
            type: 'string', 
            description: 'Comma-separated Amazon order IDs to filter by' 
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
              additionalProperties: true, // Allow any properties in data object
            },
          },
          additionalProperties: false,
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

  // GET /v1/amazon/orders/:orderId - Get order by order ID
  fastify.get('/orders/:orderId', {
    schema: {
      description: 'Get order details by Amazon Order ID',
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
            data: {
              type: 'object',
              additionalProperties: true, // Allow any properties in data object
            },
          },
          additionalProperties: false,
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
  }, amazonController.getOrder.bind(amazonController));

  // GET /v1/amazon/orders/:orderId/items - Get order items
  fastify.get('/orders/:orderId/items', {
    schema: {
      description: 'Get order items for a specific order. Supports pagination using nextToken.',
      tags: ['Amazon SP-API'],
      params: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'Amazon Order ID' },
        },
        required: ['orderId'],
      },
      querystring: {
        type: 'object',
        properties: {
          nextToken: { 
            type: 'string', 
            description: 'Token for pagination (from previous response)' 
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
              additionalProperties: true, // Allow any properties in data object
            },
          },
          additionalProperties: false,
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
  // Inventory Operations Routes
  // ============================================

  // GET /v1/amazon/inventory/summaries - Get inventory summaries
  fastify.get('/inventory/summaries', {
    schema: {
      description: 'Get inventory summaries for SKUs (FBA inventory). Returns fulfillment method (AFN/MFN) and quantity information.',
      tags: ['Amazon SP-API'],
      querystring: {
        type: 'object',
        properties: {
          marketplaceIds: { 
            type: 'string', 
            description: 'Comma-separated marketplace IDs (default: A21TJRUUN4KGV for India)' 
          },
          sellerSkus: { 
            type: 'string', 
            description: 'Comma-separated seller SKUs to get inventory for (optional - if not provided, returns all)' 
          },
          granularityType: { 
            type: 'string', 
            enum: ['Marketplace', 'Warehouse'],
            description: 'Granularity type: Marketplace or Warehouse (default: Marketplace)' 
          },
          granularityId: { 
            type: 'string', 
            description: 'Granularity ID (marketplace ID or warehouse ID)' 
          },
          details: { 
            type: 'string', 
            description: 'Whether to include detailed inventory information (default: true). Set to "true" or "1".' 
          },
          startDateTime: { 
            type: 'string', 
            description: 'Start date time for inventory query (ISO 8601 format)' 
          },
          nextToken: { 
            type: 'string', 
            description: 'Token for pagination (from previous response)' 
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
              additionalProperties: true, // Allow any properties in data object
            },
          },
          additionalProperties: false,
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
  }, amazonController.getInventorySummaries.bind(amazonController));

  // ============================================
  // Phase 4: Product Operations (Write - Update Inventory) Routes
  // ============================================

  // PATCH /v1/amazon/listings/:sellerId/:sku/inventory - Update inventory quantity
  fastify.patch('/listings/:sellerId/:sku/inventory', {
    schema: {
      description: 'Update inventory quantity for a product by SKU. Supports both absolute (set exact quantity) and additive (add to existing quantity) update modes.',
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
        required: ['quantity'],
        properties: {
          quantity: { 
            type: 'number', 
            description: 'Quantity to set (absolute mode) or add/subtract (additive mode). Can be negative for subtraction.',
            examples: [10, -5, 50]
          },
          updateMode: { 
            type: 'string', 
            enum: ['absolute', 'additive'],
            description: 'Update mode: "absolute" sets the exact quantity, "additive" adds to existing quantity (default: "additive")',
            default: 'additive'
          },
          marketplaceId: { 
            type: 'string', 
            description: 'Marketplace ID (default: A21TJRUUN4KGV for India)' 
          },
          fulfillmentChannelCode: { 
            type: 'string', 
            description: 'Fulfillment channel code (default: "DEFAULT" for MFN). Use "AMAZON_NA", "AMAZON_EU", "AMAZON_IN" for FBA.',
            default: 'DEFAULT'
          },
        },
        additionalProperties: false,
        examples: [
          {
            quantity: 10,
            updateMode: 'additive',
            description: 'Add 10 to existing quantity (if current is 50, result is 60)'
          },
          {
            quantity: 100,
            updateMode: 'absolute',
            description: 'Set quantity to exactly 100'
          },
          {
            quantity: -5,
            updateMode: 'additive',
            description: 'Subtract 5 from existing quantity (if current is 50, result is 45)'
          }
        ]
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
                sku: { type: 'string' },
                quantity: { type: 'number', description: 'Final quantity after update' },
                updateMode: { type: 'string' },
                fulfillmentChannelCode: { type: 'string' },
                previousQuantity: { type: 'number', description: 'Previous quantity (only shown in additive mode)' },
              },
              additionalProperties: true,
            },
          },
          additionalProperties: false,
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
  }, amazonController.updateInventoryQuantity.bind(amazonController));
}
