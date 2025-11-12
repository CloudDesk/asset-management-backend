import { FastifyRequest, FastifyReply } from 'fastify';
import { AmazonService } from '../services/amazon.service.js';
import { UsersService } from '../services/users.service.js';
import { 
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export class AmazonController {
  public amazonService = new AmazonService();
  public usersService = new UsersService();

  getProducts = asyncHandler(async (
    request: FastifyRequest<{ 
      Params: { sellerId: string };
      Querystring: { marketplaceId?: string };
    }>, 
    reply: FastifyReply
  ) => {
    const { sellerId } = request.params;
    const { marketplaceId } = request.query;

    logger.info({ sellerId, marketplaceId }, 'Getting Amazon products');

    const products = await this.amazonService.getProducts(sellerId, marketplaceId);

    const response = createSuccessResponse('Products retrieved successfully', products);
    return reply.code(200).send(response);
  });

  getProductBySku = asyncHandler(async (
    request: FastifyRequest<{ 
      Params: { sellerId: string; sku: string };
      Querystring: { marketplaceId?: string };
    }>, 
    reply: FastifyReply
  ) => {
    const { sellerId, sku } = request.params;
    const { marketplaceId } = request.query;

    logger.info({ sellerId, sku, marketplaceId }, 'Getting Amazon product by SKU');

    const product = await this.amazonService.getProductBySku(sellerId, sku, marketplaceId);

    const response = createSuccessResponse('Product retrieved successfully', product);
    return reply.code(200).send(response);
  });

  /**
   * Search catalog items (Catalog Items API - search Amazon catalog)
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
        message: 'Missing required parameter',
        details: 'keywords is required',
        statusCode: 400,
      });
    }

    const marketplaceArray = marketplaceIds ? marketplaceIds.split(',') : undefined;

    logger.info({ keywords, marketplaceIds: marketplaceArray, pageSize, pageToken }, 'Searching Amazon catalog items');

    const items = await this.amazonService.searchCatalogItems(
      keywords,
      marketplaceArray,
      pageSize || 20,
      pageToken
    );

    const response = createSuccessResponse('Catalog items retrieved successfully', items);
    return reply.code(200).send(response);
  });

  /**
   * Get catalog item by ASIN (Catalog Items API)
   */
  getCatalogItem = asyncHandler(async (
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

    const marketplaceArray = marketplaceIds ? marketplaceIds.split(',') : undefined;
    const includedDataArray = includedData ? includedData.split(',') : undefined;

    logger.info({ asin, marketplaceIds: marketplaceArray, includedData: includedDataArray }, 'Getting Amazon catalog item by ASIN');

    const item = await this.amazonService.getCatalogItem(asin, marketplaceArray, includedDataArray);

    const response = createSuccessResponse('Catalog item retrieved successfully', item);
    return reply.code(200).send(response);
  });

  updateInventory = asyncHandler(async (
    request: FastifyRequest<{ 
      Params: { sellerId: string; sku: string };
      Body: { 
        quantity: number;
        fulfillmentChannelCode?: string;
      };
    }>, 
    reply: FastifyReply
  ) => {
    const { sellerId, sku } = request.params;
    const { quantity, fulfillmentChannelCode } = request.body;

    logger.info({ sellerId, sku, quantity, fulfillmentChannelCode }, 'Updating Amazon inventory');

    const result = await this.amazonService.updateInventory(
      sellerId,
      sku,
      quantity,
      fulfillmentChannelCode
    );

    const response = createSuccessResponse('Inventory updated successfully', result);
    return reply.code(200).send(response);
  });

  getOrders = asyncHandler(async (
    request: FastifyRequest<{ 
      Querystring: { 
        marketplaceId?: string;
        createdAfter?: string;
        createdBefore?: string;
        orderStatuses?: string;
      };
    }>, 
    reply: FastifyReply
  ) => {
    const { marketplaceId, createdAfter, createdBefore, orderStatuses } = request.query;

    const orderStatusArray = orderStatuses ? orderStatuses.split(',') : undefined;

    logger.info({ marketplaceId, createdAfter, createdBefore, orderStatusArray }, 'Getting Amazon orders');

    const orders = await this.amazonService.getOrders(
      marketplaceId,
      createdAfter,
      createdBefore,
      orderStatusArray
    );

    const response = createSuccessResponse('Orders retrieved successfully', orders);
    return reply.code(200).send(response);
  });

  getOrderItems = asyncHandler(async (
    request: FastifyRequest<{ 
      Params: { orderId: string };
    }>, 
    reply: FastifyReply
  ) => {
    const { orderId } = request.params;

    logger.info({ orderId }, 'Getting Amazon order items');

    const orderItems = await this.amazonService.getOrderItems(orderId);

    const response = createSuccessResponse('Order items retrieved successfully', orderItems);
    return reply.code(200).send(response);
  });

  confirmShipment = asyncHandler(async (
    request: FastifyRequest<{ 
      Params: { orderId: string };
      Body: {
        packageReferenceId: string;
        carrierCode: string;
        shippingMethod: string;
        trackingNumber: string;
        shipDate: string;
      };
    }>, 
    reply: FastifyReply
  ) => {
    const { orderId } = request.params;
    const packageDetail = request.body;

    logger.info({ orderId, packageDetail }, 'Confirming Amazon shipment');

    const result = await this.amazonService.confirmShipment(orderId, packageDetail);

    const response = createSuccessResponse('Shipment confirmed successfully', result);
    return reply.code(200).send(response);
  });

  // ============================================
  // Token Management Methods
  // ============================================

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
          note: 'Token is automatically refreshed 1 minute before expiry'
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
   * Get authenticated seller ID (the seller associated with the refresh token)
   * This is the sellerId that must be used in Listings Items API calls
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
          details: 'The sellerId could not be retrieved from Fees API or marketplaceParticipations. Make sure your refresh token is valid and has the necessary permissions.',
          statusCode: 404,
        });
      }
      
      return reply.code(200).send({
        success: true,
        message: 'Authenticated seller ID retrieved successfully',
        data: {
          sellerId,
          note: 'This is the sellerId associated with your refresh token. Use this sellerId in Listings Items API calls (e.g., GET /v1/amazon/products/{sellerId}).',
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
   * Get seller ID and marketplace information
   * Returns seller ID and marketplace participations
   */
  getSellerInfo = asyncHandler(async (
    request: FastifyRequest<{
      Querystring: {
        sellerId?: string; // Optional: manually provide sellerId if found from Amazon URL
      };
    }>,
    reply: FastifyReply
  ) => {
    logger.info('Getting Amazon seller information');

    try {
      const { sellerId: manualSellerId } = request.query;
      
      // If sellerId is provided manually (e.g., from Amazon URL), use it
      if (manualSellerId) {
        logger.info({ manualSellerId }, 'Using manually provided seller ID');
        const sellerInfo = await this.amazonService.getSellerInfo();
        const marketplaces = sellerInfo?.payload || [];
        
        return reply.code(200).send({
          success: true,
          message: 'Seller information retrieved successfully',
          data: {
            sellerId: manualSellerId,
            marketplaces: marketplaces.map((mp: any) => ({
              sellerId: manualSellerId,
              marketplaceId: mp.marketplace?.id || mp.marketplace?.marketplaceId,
              marketplaceName: mp.marketplace?.name,
              countryCode: mp.marketplace?.countryCode,
              defaultCurrencyCode: mp.marketplace?.defaultCurrencyCode,
              defaultLanguageCode: mp.marketplace?.defaultLanguageCode,
              domainName: mp.marketplace?.domainName,
              storeName: mp.storeName,
              participation: {
                isParticipating: mp.participation?.isParticipating,
                hasSuspendedListings: mp.participation?.hasSuspendedListings,
              },
            })),
            note: 'Seller ID provided manually. You can now use this sellerId to get products.',
          },
        });
      }
      
      const sellerInfo = await this.amazonService.getSellerInfo();
      
      // Log full response for debugging
      logger.debug({ sellerInfo }, 'Full seller info response from Amazon');
      
      // Extract seller ID from response
      // Response structure: { payload: [{ sellerId: "...", marketplace: {...}, participation: {...} }] }
      const firstParticipation = sellerInfo?.payload?.[0];
      // Try multiple possible locations for sellerId
      let sellerId = firstParticipation?.sellerId || 
                     firstParticipation?.seller?.sellerId || 
                     sellerInfo?.sellerId ||
                     sellerInfo?.payload?.[0]?.sellerId;
      
      // If sellerId is not in marketplaceParticipations response, try Fees API as fallback
      if (!sellerId) {
        logger.info('Seller ID not found in marketplaceParticipations, trying Fees API...');
        const marketplaceId = firstParticipation?.marketplace?.id || 'ATVPDKIKX0DER';
        sellerId = await this.amazonService.getSellerIdFromFeesApi(undefined, marketplaceId);
        
        if (sellerId) {
          logger.info({ sellerId }, 'Successfully retrieved seller ID from Fees API');
        } else {
          logger.warn({ 
            payload: sellerInfo?.payload,
            fullResponse: sellerInfo 
          }, 'Seller ID not found in both marketplaceParticipations and Fees API. You may need to find it manually in Seller Central.');
        }
      }
      
      const marketplaces = sellerInfo?.payload || [];
      
      return reply.code(200).send({
        success: true,
        message: 'Seller information retrieved successfully',
        data: {
          sellerId: sellerId || null,
          marketplaces: marketplaces.map((mp: any) => ({
            sellerId: mp.sellerId || sellerId, // Include sellerId from item or fallback
            marketplaceId: mp.marketplace?.id || mp.marketplace?.marketplaceId,
            marketplaceName: mp.marketplace?.name,
            countryCode: mp.marketplace?.countryCode,
            defaultCurrencyCode: mp.marketplace?.defaultCurrencyCode,
            defaultLanguageCode: mp.marketplace?.defaultLanguageCode,
            domainName: mp.marketplace?.domainName,
            storeName: mp.storeName, // Include storeName if available
            participation: {
              isParticipating: mp.participation?.isParticipating,
              hasSuspendedListings: mp.participation?.hasSuspendedListings,
            },
          })),
          fullResponse: sellerInfo, // Include full response for debugging
          note: sellerId ? undefined : 'Seller ID not found. You can provide it manually: GET /v1/amazon/auth/seller-info?sellerId=YOUR_SELLER_ID, or find it in Seller Central: Settings → Account Info, or from Amazon URL: https://www.amazon.in/sp?seller=YOUR_SELLER_ID',
        },
      });
    } catch (error: any) {
      logger.error({ error: error.message }, 'Error getting seller info');
      
      return reply.code(500).send({
        success: false,
        message: 'Failed to get seller information',
        details: error.message || 'An error occurred while retrieving seller information',
        statusCode: 500,
      });
    }
  });

  // ============================================
  // OAuth Flow Methods (Step 5)
  // ============================================

  /**
   * Initiate OAuth connection flow
   * Generates OAuth URL for user to authorize Amazon access
   */
  initiateOAuth = asyncHandler(async (
    request: AuthenticatedRequest & FastifyRequest<{
      Body: {
        redirectUri: string;
        state?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    // Get userId from authenticated user
    if (!request.user || !request.user.id) {
      return reply.code(401).send({
        success: false,
        message: 'Authentication required',
        details: 'Please provide a valid authentication token',
        statusCode: 401,
      });
    }

    const userId = request.user.id;
    const { redirectUri, state } = request.body;

    // Validate redirectUri
    if (!redirectUri) {
      return reply.code(400).send({
        success: false,
        message: 'Missing required field',
        details: 'redirectUri is required',
        statusCode: 400,
      });
    }

    // Generate state if not provided
    const finalState = state || this.amazonService.generateRandomState();

    // Generate OAuth URL
    const authorizationUrl = this.amazonService.generateOAuthUrl({
      redirectUri,
      state: finalState,
      userId,
    });

    logger.info({ userId, redirectUri }, 'OAuth initiation successful');

    return reply.code(200).send({
      success: true,
      message: 'OAuth URL generated successfully',
      data: {
        authorizationUrl,
        state: finalState, // Return state so frontend can verify it later
      },
    });
  });

  /**
   * Handle OAuth callback
   * Exchanges authorization code for refresh token and stores it
   */
  handleOAuthCallback = asyncHandler(async (
    request: AuthenticatedRequest & FastifyRequest<{
      Body: {
        code: string;
        sellingPartnerId?: string;
        state: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    // Get userId from authenticated user
    if (!request.user || !request.user.id) {
      return reply.code(401).send({
        success: false,
        message: 'Authentication required',
        details: 'Please provide a valid authentication token',
        statusCode: 401,
      });
    }

    const userId = request.user.id;
    const { code, sellingPartnerId, state } = request.body;

    // Validate required fields
    if (!code) {
      return reply.code(400).send({
        success: false,
        message: 'Missing required field',
        details: 'code is required',
        statusCode: 400,
      });
    }

    if (!state) {
      return reply.code(400).send({
        success: false,
        message: 'Missing required field',
        details: 'state is required',
        statusCode: 400,
      });
    }

    // Verify state (CSRF protection)
    if (!this.amazonService.verifyState(state, userId)) {
      logger.warn({ userId, state }, 'OAuth callback failed: Invalid state');
      return reply.code(400).send({
        success: false,
        message: 'Invalid state parameter',
        details: 'The state parameter does not match or has expired. Please try connecting again.',
        statusCode: 400,
      });
    }

    // Get redirect URI from environment or use default
    const redirectUri = process.env.AMAZON_REDIRECT_URI || 'http://localhost:5173/amazon/callback';

    try {
      // Exchange authorization code for refresh token
      const { refreshToken, sellerId } = await this.amazonService.exchangeCodeForRefreshToken({
        code,
        redirectUri,
      });

      // Use sellerId from redirect if provided, otherwise from token exchange
      const finalSellerId = sellingPartnerId || sellerId;

      logger.info({ userId, sellerId: finalSellerId }, 'OAuth code exchanged successfully');

      // Store refresh token in database (Step 4)
      // Note: userType defaults to "inventoryusers" - adjust if needed based on your auth system
      await this.usersService.storeAmazonRefreshToken(
        userId,
        refreshToken,
        finalSellerId,
        'inventoryusers', // TODO: Determine userType from request.user if available
        'A21TJRUUN4KGV' // India marketplace
      );

      return reply.code(200).send({
        success: true,
        message: 'Amazon account connected successfully',
        data: {
          sellerId: finalSellerId,
          // Note: Don't return refreshToken in response for security
        },
      });
    } catch (error: any) {
      logger.error({ error: error.message, userId }, 'OAuth callback error');

      // Handle specific errors
      if (error.message === 'AUTHORIZATION_CODE_EXPIRED') {
        return reply.code(400).send({
          success: false,
          message: 'Authorization code expired',
          details: 'The authorization code has expired. Please try connecting again.',
          statusCode: 400,
        });
      }

      return reply.code(500).send({
        success: false,
        message: 'Failed to connect Amazon account',
        details: error.message || 'An error occurred while connecting your Amazon account',
        statusCode: 500,
      });
    }
  });
}

