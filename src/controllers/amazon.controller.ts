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
  // OAuth Flow Methods (Step 5)
  // ============================================

  /**
   * Initiate OAuth connection flow
   * Generates OAuth URL for user to authorize Amazon access
   */
  initiateOAuth = asyncHandler(async (
    request: AuthenticatedRequest<{
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
    request: AuthenticatedRequest<{
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

