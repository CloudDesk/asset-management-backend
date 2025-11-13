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
        amazonOrderIdsArray
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
      const result = await this.amazonService.getOrder(orderId);

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
      const result = await this.amazonService.getOrderItems(orderId, nextToken);

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

      const result = await this.amazonService.getInventorySummaries(
        marketplaceIdsArray,
        sellerSkusArray,
        granularityType || 'Marketplace',
        granularityId,
        includeDetails,
        startDateTime,
        nextToken
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
