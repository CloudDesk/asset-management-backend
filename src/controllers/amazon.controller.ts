import { FastifyRequest, FastifyReply } from 'fastify';
import { AmazonService } from '../services/amazon.service.js';
import { asyncHandler, createSuccessResponse } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';

export class AmazonController {
  public amazonService = new AmazonService();

  /**
   * Get or refresh access token
   * Returns the current access token (refreshes if needed)
   */
  getAccessToken = asyncHandler(async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    logger.info('Getting Amazon access token');

    try {
      const accessToken = await this.amazonService.getAccessToken();
      
      return reply.code(200).send({
        success: true,
        message: 'Access token retrieved successfully',
        data: {
          accessToken,
          expiresIn: 3600, // Access tokens are valid for 1 hour
          note: 'Token is automatically refreshed by SDK. No manual storage needed - SDK caches it internally.'
        },
      });
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting access token');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to get access token',
        details: error.message || 'An error occurred while retrieving access token',
        statusCode: 500,
      });
    }
  });

  /**
   * Initialize Amazon SP-API authentication for a seller (temporary OAuth flow)
   * This creates and caches an auth instance for the seller
   * SDK will automatically handle token refresh after initialization
   * Uses sellerId and marketplaceId from environment variables
   */
  initializeAuth = asyncHandler(async (
    request: FastifyRequest<{
      Body: {
        refreshToken: string;
        clientId?: string;
        clientSecret?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { refreshToken, clientId, clientSecret } = request.body;

    logger.info('Initializing Amazon auth (using sellerId and marketplaceId from environment)');

    // Validate refreshToken format before processing
    if (!refreshToken || typeof refreshToken !== 'string') {
      return reply.code(400).send({
        success: false,
        message: 'Invalid refreshToken',
        details: 'refreshToken is required and must be a string. Please provide a valid Amazon refresh token (starts with "Atzr|").',
        statusCode: 400,
      });
    }

    const refreshTokenTrimmed = refreshToken.trim();
    
    // Quick validation: check if it's a URL (common mistake)
    if (refreshTokenTrimmed.startsWith('http://') || refreshTokenTrimmed.startsWith('https://')) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid refreshToken format',
        details: 'The provided refreshToken appears to be a URL. Please provide the actual Amazon refresh token (starts with "Atzr|"), not a URL. Example: "Atzr|IQEB..."',
        statusCode: 400,
      });
    }

    // Check if it looks like a valid Amazon token
    if (!refreshTokenTrimmed.startsWith('Atzr|') && !refreshTokenTrimmed.startsWith('Atza|')) {
      logger.warn({ 
        refreshTokenPrefix: refreshTokenTrimmed.substring(0, 20),
        refreshTokenLength: refreshTokenTrimmed.length 
      }, 'Refresh token does not start with expected Amazon prefix');
    }

    // Check minimum length
    if (refreshTokenTrimmed.length < 50) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid refreshToken format',
        details: `The provided refreshToken appears too short (${refreshTokenTrimmed.length} characters). Amazon refresh tokens are typically much longer (100+ characters). Please verify you are providing the correct token.`,
        statusCode: 400,
      });
    }

    try {
      // Initialize auth - sellerId and marketplaceId come from env
      // This will validate the token format AND test the token by getting an access token
      await this.amazonService.initializeAuthForSeller(
        refreshTokenTrimmed,
        clientId,
        clientSecret
      );

      // Get sellerId, marketplaceId, and environment from environment variables
      const { env } = await import('../config/env.js');
      const sellerId = env.AMAZON_SELLER_ID || 'Not set in environment';
      const marketplaceId = env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV';
      const environment = env.AMAZON_ENVIRONMENT || 'PRODUCTION';

      return reply.code(200).send({
        success: true,
        message: 'Amazon authentication initialized and validated successfully',
        data: {
          sellerId,
          marketplaceId,
          environment,
          initialized: true,
          validated: true,
          note: 'Refresh token validated successfully. SDK will automatically handle token refresh. No need to resend refresh_token after 1 hour. sellerId, marketplaceId, and environment are read from environment variables (AMAZON_SELLER_ID, AMAZON_MARKETPLACE_ID, AMAZON_ENVIRONMENT).',
        },
      });
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error initializing Amazon auth');
      
      // Return 400 for validation/format errors, 401 for invalid token, 500 for other errors
      let statusCode = 500;
      let errorMessage = error.message || 'An error occurred while initializing authentication';
      
      if (error.message?.includes('Invalid') || error.message?.includes('format')) {
        statusCode = 400;
      } else if (error.message?.includes('invalid_grant') || 
                 error.message?.includes('REFRESH_TOKEN_EXPIRED') ||
                 error.message?.includes('invalid_client') ||
                 error.message?.includes('unauthorized_client') ||
                 error.message?.includes('Invalid refresh token')) {
        statusCode = 401;
        errorMessage = 'Invalid or expired refresh token. Please verify your refresh token is correct and not expired.';
      }
      
      return reply.code(statusCode).send({
        success: false,
        message: 'Failed to initialize Amazon authentication',
        details: errorMessage,
        statusCode,
      });
    }
  });

  /**
   * Disconnect Amazon auth (uses sellerId from environment)
   * This is the recommended way to disconnect Amazon connection
   */
  disconnectAuth = asyncHandler(async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    logger.info('Disconnecting Amazon auth (using sellerId from environment)');

    try {
      // Get sellerId from environment
      const { env } = await import('../config/env.js');
      const sellerId = env.AMAZON_SELLER_ID;

      if (!sellerId) {
        return reply.code(400).send({
          success: false,
          message: 'AMAZON_SELLER_ID not configured',
          details: 'AMAZON_SELLER_ID is not set in environment variables. Cannot disconnect Amazon connection.',
          statusCode: 400,
        });
      }

      const disconnected = this.amazonService.clearAuthForSeller(sellerId);

      return reply.code(200).send({
        success: true,
        message: disconnected 
          ? 'Amazon connection disconnected successfully'
          : 'No Amazon connection found to disconnect',
        data: {
          sellerId,
          disconnected,
        },
      });
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error disconnecting Amazon auth');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to disconnect Amazon authentication',
        details: error.message || 'An error occurred while disconnecting authentication',
        statusCode: 500,
      });
    }
  });

  /**
   * Clear Amazon auth for a seller (legacy route - kept for backward compatibility)
   * Use disconnectAuth instead which uses sellerId from environment
   */
  clearAuth = asyncHandler(async (
    request: FastifyRequest<{
      Params: {
        sellerId: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { sellerId } = request.params;

    logger.info({ sellerId }, 'Clearing Amazon auth for seller (legacy route)');

    try {
      const cleared = this.amazonService.clearAuthForSeller(sellerId);

      return reply.code(200).send({
        success: true,
        message: cleared 
          ? 'Amazon authentication cleared successfully'
          : 'No Amazon authentication found to clear',
        data: {
          sellerId,
          cleared,
        },
      });
    } catch (error: any) {
      logger.error({ error: error.message, sellerId }, 'Error clearing Amazon auth');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to clear Amazon authentication',
        details: error.message || 'An error occurred while clearing authentication',
        statusCode: 500,
      });
    }
  });

  // ============================================
  // Phase 2: Product Operations (Read)
  // ============================================

  /**
   * Get listing item by SKU (seller's own listing)
   */
  getListingItemBySku = asyncHandler(async (
    request: FastifyRequest<{
      Params: { sellerId: string; sku: string };
      Querystring: { 
        marketplaceId?: string;
        includedData?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { sellerId, sku } = request.params;
    const { marketplaceId, includedData } = request.query;

    logger.info({ sellerId, sku, marketplaceId }, 'Getting listing item by SKU');

    try {
      const marketplaceIds = marketplaceId ? [marketplaceId] : undefined;
      const dataToInclude = includedData ? includedData.split(',') as any : undefined;

      const result = await this.amazonService.getListingItemBySku(
        sellerId,
        sku,
        marketplaceIds,
        dataToInclude
      );

      // Log what we received from service
      logger.debug({ 
        result,
        resultType: typeof result,
        resultKeys: result && typeof result === 'object' ? Object.keys(result) : [],
        resultString: JSON.stringify(result, null, 2).substring(0, 500)
      }, 'Controller received result from service');

      const response = createSuccessResponse('Listing item retrieved successfully', result);
      
      // Log what we're sending
      logger.debug({ 
        response,
        responseData: response.data,
        responseDataType: typeof response.data,
        responseDataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : []
      }, 'Controller sending response');

      return reply.code(200).send(response);
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting listing item by SKU');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to get listing item',
        details: error.message || 'An error occurred while retrieving listing item',
        statusCode: 500,
      });
    }
  });

  /**
   * Get all listings items for a seller (no filters)
   */
  getAllListingsItems = asyncHandler(async (
    request: FastifyRequest<{
      Params: { sellerId: string };
      Querystring: {
        marketplaceId?: string;
        pageSize?: number;
        pageToken?: string;
        includeInventory?: string; // 'true' or 'false' as string
      };
    }>,
    reply: FastifyReply
  ) => {
    const { sellerId } = request.params;
    const { marketplaceId, pageSize, pageToken, includeInventory } = request.query;

    logger.info({ sellerId, marketplaceId, pageSize, includeInventory }, 'Getting all listings items');

    try {
      const marketplaceIds = marketplaceId ? [marketplaceId] : undefined;
      const query: any = {};
      
      // Only add pagination if provided (no filters = get all)
      if (pageSize) query.pageSize = pageSize;
      if (pageToken) query.pageToken = pageToken;

      // Pass includeInventory flag to searchListingsItems to include fulfillmentAvailability
      const shouldIncludeInventory = includeInventory === 'true' || includeInventory === '1';
      let result = await this.amazonService.searchListingsItems(sellerId, marketplaceIds, query, shouldIncludeInventory);

      // Enrich with inventory if requested
      if (shouldIncludeInventory) {
        logger.info('Enriching listings with inventory data from fulfillmentAvailability');
        result = await this.amazonService.enrichListingsWithInventory(result, marketplaceIds);
      }

      return reply.code(200).send(createSuccessResponse('All listings items retrieved successfully', result));
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting all listings items');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to get all listings items',
        details: error.message || 'An error occurred while retrieving listings items',
        statusCode: 500,
      });
    }
  });

  /**
   * Search listings items (seller's own listings)
   */
  searchListingsItems = asyncHandler(async (
    request: FastifyRequest<{
      Params: { sellerId: string };
      Querystring: {
        marketplaceId?: string;
        keywords?: string;
        sellerSkus?: string;
        asins?: string;
        pageSize?: number;
        pageToken?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { sellerId } = request.params;
    const { marketplaceId, keywords, sellerSkus, asins, pageSize, pageToken } = request.query;

    logger.info({ sellerId, marketplaceId, keywords }, 'Searching listings items');

    try {
      const marketplaceIds = marketplaceId ? [marketplaceId] : undefined;
      const query: any = {};
      
      if (keywords) query.keywords = keywords.split(',');
      if (sellerSkus) query.sellerSkus = sellerSkus.split(',');
      if (asins) query.asins = asins.split(',');
      if (pageSize) query.pageSize = pageSize;
      if (pageToken) query.pageToken = pageToken;

      const result = await this.amazonService.searchListingsItems(sellerId, marketplaceIds, query);

      return reply.code(200).send(createSuccessResponse('Listings items retrieved successfully', result));
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error searching listings items');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to search listings items',
        details: error.message || 'An error occurred while searching listings items',
        statusCode: 500,
      });
    }
  });

  /**
   * Search catalog items (Amazon catalog search)
   */
  searchCatalogItems = asyncHandler(async (
    request: FastifyRequest<{
      Querystring: {
        keywords: string;
        marketplaceIds?: string;
        pageSize?: number;
        pageToken?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { keywords, marketplaceIds, pageSize, pageToken } = request.query;

    if (!keywords) {
      return reply.code(400).send({
        success: false,
        message: 'Keywords are required',
        details: 'Please provide keywords query parameter',
        statusCode: 400,
      });
    }

    logger.info({ keywords, marketplaceIds, pageSize }, 'Searching catalog items');

    try {
      const keywordsArray = keywords.split(',').map(k => k.trim());
      const marketplaceIdsArray = marketplaceIds ? marketplaceIds.split(',') : undefined;

      const result = await this.amazonService.searchCatalogItems(
        keywordsArray,
        marketplaceIdsArray,
        pageSize,
        pageToken
      );

      return reply.code(200).send(createSuccessResponse('Catalog items retrieved successfully', result));
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error searching catalog items');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to search catalog items',
        details: error.message || 'An error occurred while searching catalog items',
        statusCode: 500,
      });
    }
  });

  /**
   * Get seller account details
   */
  getAccountDetails = asyncHandler(async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    logger.info('Getting seller account details');

    try {
      const result = await this.amazonService.getAccountDetails();
      
      return reply.code(200).send(createSuccessResponse('Account details retrieved successfully', result));
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting account details');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to get account details',
        details: error.message || 'An error occurred while retrieving account details',
        statusCode: 500,
      });
    }
  });

  /**
   * Get authenticated seller ID (the seller associated with your refresh token)
   */
  getAuthenticatedSellerId = asyncHandler(async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    logger.info('Getting authenticated seller ID');

    try {
      const sellerId = await this.amazonService.getAuthenticatedSellerId();
      
      if (!sellerId) {
        return reply.code(404).send({
          success: false,
          message: 'Could not determine authenticated seller ID',
          details: 'The sellerId could not be retrieved programmatically. This is a known Amazon SP-API limitation - marketplaceParticipations does not return sellerId.',
          statusCode: 404,
          solution: {
            method1: 'Set AMAZON_SELLER_ID environment variable with your seller ID (e.g., APCBEZW09ZM60)',
            method2: 'Get sellerId from Amazon product URL: https://www.amazon.in/sp?seller=YOUR_SELLER_ID',
            method3: 'Get sellerId from Seller Central: Settings → Account Info',
            note: 'Once you have your sellerId, you can use it directly in API calls: GET /v1/amazon/listings/{sellerId}/{sku}'
          },
        });
      }
      
      return reply.code(200).send({
        success: true,
        message: 'Authenticated seller ID retrieved successfully',
        data: {
          sellerId,
          note: 'This is the sellerId associated with your refresh token. Use this sellerId in Listings Items API calls.',
        },
      });
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting authenticated seller ID');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to get authenticated seller ID',
        details: error.message || 'An error occurred while retrieving the authenticated seller ID',
        statusCode: 500,
      });
    }
  });

  /**
   * Get catalog item by ASIN
   */
  getCatalogItemByAsin = asyncHandler(async (
    request: FastifyRequest<{
      Params: { asin: string };
      Querystring: {
        marketplaceIds?: string;
        includedData?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { asin } = request.params;
    const { marketplaceIds, includedData } = request.query;

    logger.info({ asin, marketplaceIds }, 'Getting catalog item by ASIN');

    try {
      const marketplaceIdsArray = marketplaceIds ? marketplaceIds.split(',') : undefined;
      const dataToInclude = includedData ? includedData.split(',') as any : undefined;

      const result = await this.amazonService.getCatalogItemByAsin(
        asin,
        marketplaceIdsArray,
        dataToInclude
      );

      return reply.code(200).send(createSuccessResponse('Catalog item retrieved successfully', result));
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting catalog item by ASIN');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to get catalog item',
        details: error.message || 'An error occurred while retrieving catalog item',
        statusCode: 500,
      });
    }
  });

  // ============================================
  // Phase 3: Order Operations (Read)
  // ============================================

  /**
   * Get orders (list of orders)
   */
  getOrders = asyncHandler(async (
    request: FastifyRequest<{
      Querystring: {
        marketplaceIds?: string;
        createdAfter?: string;
        createdBefore?: string;
        lastUpdatedAfter?: string;
        lastUpdatedBefore?: string;
        orderStatuses?: string;
        fulfillmentChannels?: string;
        paymentMethods?: string;
        buyerEmail?: string;
        sellerOrderId?: string;
        maxResultsPerPage?: number;
        easyShipShipmentStatuses?: string;
        nextToken?: string;
        amazonOrderIds?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const {
      marketplaceIds,
      createdAfter,
      createdBefore,
      lastUpdatedAfter,
      lastUpdatedBefore,
      orderStatuses,
      fulfillmentChannels,
      paymentMethods,
      buyerEmail,
      sellerOrderId,
      maxResultsPerPage,
      easyShipShipmentStatuses,
      nextToken,
      amazonOrderIds,
    } = request.query;

    logger.info({ 
      marketplaceIds, 
      createdAfter, 
      maxResultsPerPage,
      nextToken: nextToken ? 'provided' : 'not provided'
    }, 'Getting orders');

    try {
      // Get sellerId from environment for seller-specific auth
      const { env } = await import('../config/env.js');
      const sellerId = env.AMAZON_SELLER_ID;

      const marketplaceIdsArray = marketplaceIds ? marketplaceIds.split(',') : undefined;
      const orderStatusesArray = orderStatuses ? orderStatuses.split(',') : undefined;
      const fulfillmentChannelsArray = fulfillmentChannels ? fulfillmentChannels.split(',') : undefined;
      const paymentMethodsArray = paymentMethods ? paymentMethods.split(',') : undefined;
      const easyShipShipmentStatusesArray = easyShipShipmentStatuses ? easyShipShipmentStatuses.split(',') : undefined;
      const amazonOrderIdsArray = amazonOrderIds ? amazonOrderIds.split(',') : undefined;

      const result = await this.amazonService.getOrders(
        marketplaceIdsArray,
        createdAfter,
        createdBefore,
        lastUpdatedAfter,
        lastUpdatedBefore,
        orderStatusesArray,
        fulfillmentChannelsArray,
        paymentMethodsArray,
        buyerEmail,
        sellerOrderId,
        maxResultsPerPage,
        easyShipShipmentStatusesArray,
        nextToken,
        amazonOrderIdsArray,
        sellerId // Pass sellerId to use seller-specific auth
      );

      return reply.code(200).send(createSuccessResponse('Orders retrieved successfully', result));
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting orders');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to get orders',
        details: error.message || 'An error occurred while retrieving orders',
        statusCode: 500,
      });
    }
  });

  /**
   * Get order by order ID
   */
  getOrder = asyncHandler(async (
    request: FastifyRequest<{
      Params: { orderId: string };
    }>,
    reply: FastifyReply
  ) => {
    const { orderId } = request.params;

    logger.info({ orderId }, 'Getting order by ID');

    try {
      // Get sellerId from environment for seller-specific auth
      const { env } = await import('../config/env.js');
      const sellerId = env.AMAZON_SELLER_ID;

      const result = await this.amazonService.getOrder(orderId, sellerId);

      return reply.code(200).send(createSuccessResponse('Order retrieved successfully', result));
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting order');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to get order',
        details: error.message || 'An error occurred while retrieving order',
        statusCode: 500,
      });
    }
  });

  /**
   * Get order items for a specific order
   */
  getOrderItems = asyncHandler(async (
    request: FastifyRequest<{
      Params: { orderId: string };
      Querystring: {
        nextToken?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { orderId } = request.params;
    const { nextToken } = request.query;

    logger.info({ orderId, nextToken: nextToken ? 'provided' : 'not provided' }, 'Getting order items');

    try {
      // Get sellerId from environment for seller-specific auth
      const { env } = await import('../config/env.js');
      const sellerId = env.AMAZON_SELLER_ID;

      const result = await this.amazonService.getOrderItems(orderId, nextToken, sellerId);

      return reply.code(200).send(createSuccessResponse('Order items retrieved successfully', result));
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting order items');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to get order items',
        details: error.message || 'An error occurred while retrieving order items',
        statusCode: 500,
      });
    }
  });

  // ============================================
  // Inventory Operations
  // ============================================

  /**
   * Get inventory summaries for SKUs
   */
  getInventorySummaries = asyncHandler(async (
    request: FastifyRequest<{
      Querystring: {
        marketplaceIds?: string;
        sellerSkus?: string;
        granularityType?: 'Marketplace' | 'Warehouse';
        granularityId?: string;
        details?: string;
        startDateTime?: string;
        nextToken?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const {
      marketplaceIds,
      sellerSkus,
      granularityType,
      granularityId,
      details,
      startDateTime,
      nextToken,
    } = request.query;

    logger.info({ 
      marketplaceIds, 
      sellerSkus: sellerSkus ? 'provided' : 'all',
      granularityType 
    }, 'Getting inventory summaries');

    try {
      const marketplaceIdsArray = marketplaceIds ? marketplaceIds.split(',') : undefined;
      const sellerSkusArray = sellerSkus ? sellerSkus.split(',') : undefined;
      const includeDetails = details === 'true' || details === '1' || details === undefined;

      // Get sellerId from environment for seller-specific auth
      const { env } = await import('../config/env.js');
      const sellerId = env.AMAZON_SELLER_ID;

      const result = await this.amazonService.getInventorySummaries(
        marketplaceIdsArray,
        sellerSkusArray,
        granularityType || 'Marketplace',
        granularityId,
        includeDetails,
        startDateTime,
        nextToken,
        sellerId // Pass sellerId to use seller-specific auth
      );

      return reply.code(200).send(createSuccessResponse('Inventory summaries retrieved successfully', result));
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting inventory summaries');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to get inventory summaries',
        details: error.message || 'An error occurred while retrieving inventory summaries',
        statusCode: 500,
      });
    }
  });

  // ============================================
  // Phase 4: Product Operations (Write - Update Inventory)
  // ============================================

  /**
   * Update inventory quantity for a product by SKU
   */
  updateInventoryQuantity = asyncHandler(async (
    request: FastifyRequest<{
      Params: { sellerId: string; sku: string };
      Body: {
        quantity: number;
        updateMode?: 'absolute' | 'additive';
        marketplaceId?: string;
        fulfillmentChannelCode?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    const { sellerId, sku } = request.params;
    const { quantity, updateMode = 'additive', marketplaceId, fulfillmentChannelCode = 'DEFAULT' } = request.body;

    if (quantity === undefined || quantity === null) {
      return reply.code(400).send({
        success: false,
        message: 'Quantity is required',
        details: 'Please provide quantity in the request body',
        statusCode: 400,
      });
    }

    logger.info({ 
      sellerId, 
      sku, 
      quantity, 
      updateMode,
      fulfillmentChannelCode 
    }, 'Updating inventory quantity');

    try {
      const marketplaceIds = marketplaceId ? [marketplaceId] : undefined;

      const result = await this.amazonService.updateInventoryQuantity(
        sellerId,
        sku,
        quantity,
        updateMode,
        marketplaceIds,
        fulfillmentChannelCode
      );

      return reply.code(200).send(createSuccessResponse('Inventory quantity updated successfully', result));
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error updating inventory quantity');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to update inventory quantity',
        details: error.message || 'An error occurred while updating inventory quantity',
        statusCode: 500,
      });
    }
  });
}
