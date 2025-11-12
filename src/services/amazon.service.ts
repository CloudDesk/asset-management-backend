import axios, { AxiosRequestConfig } from 'axios';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import crypto from 'crypto';

interface AmazonAccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface AmazonTokenExchangeResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export class AmazonService {
  private cachedToken: string | null = null;
  private tokenExpiry: number | null = null;
  private readonly AMAZON_LWA_TOKEN_URL = 'https://api.amazon.com/auth/o2/token';
  
  // User-specific access token cache (userId -> { token, expiresAt })
  private userAccessTokenCache = new Map<string, { token: string; expiresAt: number }>();
  
  // State storage for OAuth CSRF protection (state -> userId, expires in 10 minutes)
  private stateStore = new Map<string, { userId: number; expiresAt: number }>();

  /**
   * Get or refresh Amazon SP-API access token
   */
  async getAccessToken(): Promise<string> {
    const now = Date.now();
    
    // Refresh 1 minute before expiry (tokens valid for 1 hour)
    if (!this.cachedToken || !this.tokenExpiry || now >= this.tokenExpiry - 60000) {
      logger.debug('Refreshing Amazon access token');
      this.cachedToken = await this.refreshAccessToken();
      this.tokenExpiry = now + 3600000; // 1 hour
    }
    
    return this.cachedToken;
  }

  /**
   * Refresh access token using refresh token (legacy - uses env variable)
   * @deprecated Use refreshAccessTokenForUser() for user-specific tokens
   */
  private async refreshAccessToken(): Promise<string> {
    try {
      if (!env.AMAZON_CLIENT_ID || !env.AMAZON_CLIENT_SECRET || !env.AMAZON_REFRESH_TOKEN) {
        throw new Error('Amazon credentials not configured. Please set AMAZON_CLIENT_ID, AMAZON_CLIENT_SECRET, and AMAZON_REFRESH_TOKEN');
      }

      return await this.refreshAccessTokenForUser(env.AMAZON_REFRESH_TOKEN);
    } catch (error: any) {
      logger.error({ error: error.response?.data || error.message }, 'Error refreshing Amazon access token');
      throw new Error(`Failed to refresh Amazon access token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Refresh access token using refresh token (user-specific)
   * @param refreshToken - Refresh token from database
   * @returns Access token
   */
  async refreshAccessTokenForUser(refreshToken: string): Promise<string> {
    try {
      if (!env.AMAZON_CLIENT_ID || !env.AMAZON_CLIENT_SECRET) {
        throw new Error('Amazon credentials not configured. Please set AMAZON_CLIENT_ID and AMAZON_CLIENT_SECRET');
      }

      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }

      // Amazon LWA token endpoint (same for sandbox and production)
      const tokenUrl = 'https://api.amazon.com/auth/o2/token';

      const response = await axios.post<AmazonAccessTokenResponse>(
        tokenUrl,
        {
          grant_type: 'refresh_token', // For authorized operations
          refresh_token: refreshToken,
          client_id: env.AMAZON_CLIENT_ID,
          client_secret: env.AMAZON_CLIENT_SECRET,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
console.log(response.data,"RESPONSE_DATA")
      logger.info('Amazon access token refreshed successfully');
      return response.data.access_token;
    } catch (error: any) {
      logger.error({ error: error.response?.data || error.message }, 'Error refreshing Amazon access token');
      
      // Check if refresh token is expired/revoked
      // Amazon returns 'invalid_grant' (HTTP 400) when refresh token is expired or revoked
      if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
        throw new Error('REFRESH_TOKEN_EXPIRED'); // Special error for expired/revoked refresh token
      }
      
      throw new Error(`Failed to refresh Amazon access token: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Sign request (deprecated - AWS SigV4 signing removed from SP-API as of Oct 2, 2023)
   * This method is kept for backward compatibility but no longer performs signing
   * SP-API now only requires x-amz-access-token header
   */
  private async signRequest(request: AxiosRequestConfig): Promise<AxiosRequestConfig> {
    // AWS SigV4 signing was removed from SP-API as of October 2, 2023
    // SP-API now only requires the x-amz-access-token header (added in makeApiCall)
    // This method is kept for backward compatibility but returns request as-is
    return request;
  }

  /**
   * Make authenticated API call to Amazon SP-API
   */
  private async makeApiCall<T>(config: AxiosRequestConfig): Promise<T> {
    try {
      const accessToken = await this.getAccessToken();
      const baseURL = env.AMAZON_SP_API_BASE_URL || 
        (env.AMAZON_ENVIRONMENT === 'PRODUCTION' 
          ? 'https://sellingpartnerapi-eu.amazon.com'
          : 'https://sandbox.sellingpartnerapi-eu.amazon.com');

      const requestConfig: AxiosRequestConfig = {
        ...config,
        url: `${baseURL}${config.url}`,
        headers: {
          ...config.headers,
          'x-amz-access-token': accessToken,
        },
      };

      // Sign with SigV4 if AWS credentials are available
      const signedConfig = await this.signRequest(requestConfig);

      const response = await axios(signedConfig);
      return response.data;
    } catch (error: any) {
      logger.error(
        { 
          error: error.response?.data || error.message,
          url: config.url,
          method: config.method 
        },
        'Error making Amazon API call'
      );
      throw new Error(
        `Amazon API call failed: ${error.response?.data?.errors?.[0]?.message || error.message}`
      );
    }
  }

  /**
   * Get the authenticated seller ID (the seller associated with the refresh token)
   * This is the sellerId that must be used in Listings Items API calls
   */
  async getAuthenticatedSellerId(): Promise<string | null> {
    try {
      // Try Fees API first (most reliable)
      const sellerId = await this.getSellerIdFromFeesApi();
      if (sellerId) {
        return sellerId;
      }
      
      // Fallback: Try marketplaceParticipations
      const sellerInfo = await this.getSellerInfo();
      const firstParticipation = sellerInfo?.payload?.[0];
      return firstParticipation?.sellerId || 
             firstParticipation?.seller?.sellerId || 
             sellerInfo?.sellerId ||
             null;
    } catch (error: any) {
      logger.warn({ error: error.message }, 'Could not get authenticated seller ID');
      return null;
    }
  }

  /**
   * Get product list (Listings Items API - seller's own listings)
   * Note: This endpoint requires sellerId to match the authenticated seller
   * 
   * ⚠️ IMPORTANT: The sellerId in the path MUST match the seller associated with your refresh token.
   * If you get "Could not match input arguments", the sellerId doesn't match.
   * 
   * Alternative: If this endpoint fails, consider using Reports API or Catalog Items API
   */
  async getProducts(sellerId: string, marketplaceId?: string): Promise<any> {
    const marketplace = marketplaceId || env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV';
    
    // Verify sellerId matches authenticated seller
    const authenticatedSellerId = await this.getAuthenticatedSellerId();
    if (authenticatedSellerId && sellerId !== authenticatedSellerId) {
      logger.warn(
        { 
          providedSellerId: sellerId,
          authenticatedSellerId,
          hint: 'The sellerId in the request does not match the authenticated seller. Use the authenticated sellerId instead.'
        },
        'SellerId mismatch detected'
      );
      // Continue anyway - let Amazon API return the error for clarity
    }
    
    // Listings Items API endpoint format
    // GET /listings/2021-08-01/items/{sellerId}?marketplaceIds={marketplaceId}
    // Note: sellerId in path must match the authenticated seller
    const params = new URLSearchParams();
    params.append('marketplaceIds', marketplace);
    
    const url = `/listings/2021-08-01/items/${sellerId}?${params.toString()}`;
    logger.debug({ url, sellerId, marketplace, authenticatedSellerId }, 'Calling Listings Items API');
    
    try {
      return await this.makeApiCall({
        method: 'GET',
        url,
      });
    } catch (error: any) {
      // If Listings Items API fails, log detailed error with authenticated sellerId
      logger.error(
        { 
          error: error.message,
          url,
          providedSellerId: sellerId,
          authenticatedSellerId,
          marketplace,
          hint: authenticatedSellerId 
            ? `The sellerId must match the authenticated seller (${authenticatedSellerId}). Use the authenticated sellerId instead of ${sellerId}.`
            : 'The sellerId must match the authenticated seller. If this fails, try using Catalog Items API or Reports API instead.'
        },
        'Listings Items API call failed'
      );
      throw error;
    }
  }

  /**
   * Get product by SKU (Listings Items API - seller's own listing)
   * Note: This endpoint requires sellerId to match the authenticated seller
   */
  async getProductBySku(sellerId: string, sku: string, marketplaceId?: string): Promise<any> {
    const marketplace = marketplaceId || env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV';
    
    // Listings Items API endpoint format
    const params = new URLSearchParams();
    params.append('marketplaceIds', marketplace);
    
    return this.makeApiCall({
      method: 'GET',
      url: `/listings/2021-08-01/items/${sellerId}/${sku}?${params.toString()}`,
    });
  }

  /**
   * Search catalog items (Catalog Items API - search Amazon catalog)
   * @param keywords - Comma-delimited list of words or identifiers to search for
   * @param marketplaceIds - List of marketplace identifiers
   * @param pageSize - Number of results per page (max 20, default 20)
   * @param pageToken - Token for pagination
   * @returns Catalog items matching search criteria
   */
  async searchCatalogItems(
    keywords: string,
    marketplaceIds?: string[],
    pageSize: number = 20,
    pageToken?: string
  ): Promise<any> {
    const marketplace = marketplaceIds || [env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV'];
    const params = new URLSearchParams({
      keywords,
      marketplaceIds: marketplace.join(','),
      pageSize: Math.min(pageSize, 20).toString(), // Max 20
    });

    if (pageToken) {
      params.append('pageToken', pageToken);
    }

    return this.makeApiCall({
      method: 'GET',
      url: `/catalog/2020-12-01/items?${params.toString()}`,
    });
  }

  /**
   * Get catalog item by ASIN (Catalog Items API)
   * @param asin - The Amazon Standard Identification Number (ASIN) of the item
   * @param marketplaceIds - List of marketplace identifiers
   * @param includedData - Optional: Comma-separated list of data sets to include (e.g., 'summaries,attributes')
   * @returns Catalog item details
   */
  async getCatalogItem(
    asin: string,
    marketplaceIds?: string[],
    includedData?: string[]
  ): Promise<any> {
    const marketplace = marketplaceIds || [env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV'];
    const params = new URLSearchParams({
      marketplaceIds: marketplace.join(','),
    });

    if (includedData && includedData.length > 0) {
      params.append('includedData', includedData.join(','));
    }

    return this.makeApiCall({
      method: 'GET',
      url: `/catalog/2020-12-01/items/${asin}?${params.toString()}`,
    });
  }

  /**
   * Update inventory
   */
  async updateInventory(
    sellerId: string,
    sku: string,
    quantity: number,
    fulfillmentChannelCode: string = 'DEFAULT'
  ): Promise<any> {
    return this.makeApiCall({
      method: 'PATCH',
      url: `/listings/2021-08-01/items/${sellerId}/${sku}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        productType: 'PRODUCT',
        patches: [
          {
            op: 'replace',
            path: '/attributes/fulfillment_availability',
            value: [
              {
                fulfillment_channel_code: fulfillmentChannelCode,
                quantity: quantity,
              },
            ],
          },
        ],
      },
    });
  }

  /**
   * Get orders
   */
  async getOrders(
    marketplaceId?: string,
    createdAfter?: string,
    createdBefore?: string,
    orderStatuses?: string[]
  ): Promise<any> {
    const marketplace = marketplaceId || env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV';
    const params = new URLSearchParams({
      MarketplaceIds: marketplace,
    });

    if (createdAfter) params.append('CreatedAfter', createdAfter);
    if (createdBefore) params.append('CreatedBefore', createdBefore);
    if (orderStatuses && orderStatuses.length > 0) {
      orderStatuses.forEach(status => params.append('OrderStatuses', status));
    }

    return this.makeApiCall({
      method: 'GET',
      url: `/orders/v0/orders?${params.toString()}`,
    });
  }

  /**
   * Get order items
   */
  async getOrderItems(orderId: string): Promise<any> {
    return this.makeApiCall({
      method: 'GET',
      url: `/orders/v0/orders/${orderId}/orderItems`,
    });
  }

  /**
   * Confirm shipment
   */
  async confirmShipment(
    orderId: string,
    packageDetail: {
      packageReferenceId: string;
      carrierCode: string;
      shippingMethod: string;
      trackingNumber: string;
      shipDate: string;
    }
  ): Promise<any> {
    return this.makeApiCall({
      method: 'POST',
      url: `/orders/v0/orders/${orderId}/shipmentConfirmation`,
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        packageDetail,
      },
    });
  }

  // ============================================
  // OAuth Flow Methods (Step 2)
  // ============================================

  /**
   * Generate OAuth authorization URL
   * @param params - OAuth parameters
   * @returns Authorization URL for Amazon Seller Central
   */
  generateOAuthUrl(params: {
    redirectUri: string;
    state: string;
    userId: number;
  }): string {
    const { redirectUri, state, userId } = params;

    // Store state-user mapping for CSRF protection (expires in 10 minutes)
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
    this.stateStore.set(state, { userId, expiresAt });

    // Clean up expired states periodically
    this.cleanupExpiredStates();

    // Get Seller Central URL based on marketplace
    // India: sellercentral.amazon.in
    // US: sellercentral.amazon.com
    // EU: sellercentral-europe.amazon.com
    const sellerCentralUrl = env.AMAZON_SELLER_CENTRAL_URL || 'https://sellercentral.amazon.in';

    // Generate OAuth URL
    const urlParams = new URLSearchParams({
      application_id: env.AMAZON_CLIENT_ID || '',
      state: state, // CSRF protection
      redirect_uri: redirectUri,
      version: 'beta',
    });

    const authorizationUrl = `${sellerCentralUrl}/apps/authorize/consent?${urlParams.toString()}`;
    
    logger.info({ userId, state }, 'Generated Amazon OAuth authorization URL');
    
    return authorizationUrl;
  }

  /**
   * Verify state parameter (CSRF protection)
   * @param state - State parameter from OAuth callback
   * @param userId - User ID to verify against
   * @returns true if state is valid, false otherwise
   */
  verifyState(state: string, userId: number): boolean {
    const stored = this.stateStore.get(state);
    
    if (!stored) {
      logger.warn({ state, userId }, 'OAuth state not found or expired');
      return false;
    }

    // Check if expired
    if (Date.now() > stored.expiresAt) {
      logger.warn({ state, userId }, 'OAuth state expired');
      this.stateStore.delete(state);
      return false;
    }

    // Verify user ID matches
    if (stored.userId !== userId) {
      logger.warn({ state, userId, storedUserId: stored.userId }, 'OAuth state user ID mismatch');
      this.stateStore.delete(state);
      return false;
    }

    // Remove used state (one-time use)
    this.stateStore.delete(state);
    
    logger.info({ state, userId }, 'OAuth state verified successfully');
    return true;
  }

  /**
   * Exchange authorization code for refresh token
   * @param params - Code exchange parameters
   * @returns Refresh token and seller ID
   */
  async exchangeCodeForRefreshToken(params: {
    code: string;
    redirectUri: string;
  }): Promise<{ refreshToken: string; sellerId: string }> {
    try {
      if (!env.AMAZON_CLIENT_ID || !env.AMAZON_CLIENT_SECRET) {
        throw new Error('Amazon credentials not configured');
      }

      // Exchange authorization code for refresh token
      // Note: Same endpoint for sandbox and production
      const tokenUrl = 'https://api.amazon.com/auth/o2/token';

      logger.info('Exchanging authorization code for refresh token');

      const response = await axios.post<AmazonTokenExchangeResponse>(
        tokenUrl,
        {
          grant_type: 'authorization_code',
          code: params.code,
          client_id: env.AMAZON_CLIENT_ID,
          client_secret: env.AMAZON_CLIENT_SECRET,
          redirect_uri: params.redirectUri,
        },
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const { refresh_token, access_token } = response.data;

      // Get seller ID using the access token
      // Note: We can get seller ID from the redirect parameter (selling_partner_id)
      // or by making an API call. For now, we'll need to get it from the redirect.
      // If not provided, we'll need to make an API call to get it.
      const sellerId = await this.getSellerIdFromToken(access_token);

      logger.info('Successfully exchanged authorization code for refresh token');

      return {
        refreshToken: refresh_token,
        sellerId,
      };
    } catch (error: any) {
      logger.error(
        { error: error.response?.data || error.message },
        'Error exchanging code for refresh token'
      );

      // Check for specific error types
      if (error.response?.data?.error === 'invalid_grant') {
        throw new Error('AUTHORIZATION_CODE_EXPIRED');
      }

      throw new Error(
        `Failed to exchange code: ${error.response?.data?.error_description || error.message}`
      );
    }
  }

  /**
   * Get seller ID using Fees API (alternative method when marketplaceParticipations doesn't return sellerId)
   * @param accessToken - Access token (optional, will use cached token if not provided)
   * @param marketplaceId - Marketplace ID (default: ATVPDKIKX0DER for US)
   * @param asin - Any valid ASIN to use for the fees estimate request
   * @returns Seller ID
   */
  async getSellerIdFromFeesApi(
    accessToken?: string,
    marketplaceId: string = 'ATVPDKIKX0DER',
    asin: string = 'B08WJ81ZS1' // Example ASIN - any valid ASIN works
  ): Promise<string | null> {
    try {
      const token = accessToken || await this.getAccessToken();
      const baseURL = env.AMAZON_SP_API_BASE_URL || 
        (env.AMAZON_ENVIRONMENT === 'PRODUCTION' 
          ? 'https://sellingpartnerapi-eu.amazon.com'
          : 'https://sandbox.sellingpartnerapi-eu.amazon.com');

      // Use Fees API to get sellerId
      const response = await axios.post(
        `${baseURL}/products/fees/v0/feesEstimate`,
        {
          FeesEstimateRequest: {
            MarketplaceId: marketplaceId,
            IsAmazonFulfilled: true,
            PriceToEstimateFees: {
              ListingPrice: {
                CurrencyCode: 'USD',
                Amount: 10
              },
              Shipping: {
                CurrencyCode: 'USD',
                Amount: 0
              }
            },
            Identifier: asin
          }
        },
        {
          headers: {
            'x-amz-access-token': token,
            'Content-Type': 'application/json',
          },
        }
      );

      // Extract sellerId from response
      const sellerId = response.data?.FeesEstimateResult?.FeesEstimateIdentifier?.SellerId;
      return sellerId || null;
    } catch (error: any) {
      logger.warn(
        { error: error.response?.data || error.message },
        'Could not get seller ID from Fees API'
      );
      return null;
    }
  }

  /**
   * Get seller ID and marketplace participations
   * Makes an API call to get seller information
   * @param accessToken - Access token (optional, will use cached token if not provided)
   * @returns Seller ID and marketplace information
   */
  async getSellerInfo(accessToken?: string): Promise<any> {
    try {
      const token = accessToken || await this.getAccessToken();
      const baseURL = env.AMAZON_SP_API_BASE_URL || 
        (env.AMAZON_ENVIRONMENT === 'PRODUCTION' 
          ? 'https://sellingpartnerapi-eu.amazon.com'
          : 'https://sandbox.sellingpartnerapi-eu.amazon.com');

      const response = await axios.get(
        `${baseURL}/sellers/v1/marketplaceParticipations`,
        {
          headers: {
            'x-amz-access-token': token,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error(
        { error: error.response?.data || error.message },
        'Error getting seller info'
      );
      throw new Error(
        `Failed to get seller info: ${error.response?.data?.errors?.[0]?.message || error.message}`
      );
    }
  }

  /**
   * Get seller ID from access token
   * Makes a test API call to get seller information
   * @param accessToken - Access token
   * @returns Seller ID
   */
  private async getSellerIdFromToken(accessToken: string): Promise<string> {
    try {
      // Make a simple API call to get seller information
      // Using the Sellers API to get seller ID
      const baseURL = env.AMAZON_SP_API_BASE_URL || 
        (env.AMAZON_ENVIRONMENT === 'PRODUCTION' 
          ? 'https://sellingpartnerapi-eu.amazon.com'
          : 'https://sandbox.sellingpartnerapi-eu.amazon.com');

      const response = await axios.get(
        `${baseURL}/sellers/v1/marketplaceParticipations`,
        {
          headers: {
            'x-amz-access-token': accessToken,
          },
        }
      );

      // Extract seller ID from response
      // The response structure: { payload: [{ seller: { sellerId: "..." } }] }
      const sellerId = response.data?.payload?.[0]?.seller?.sellerId;
      
      if (!sellerId) {
        logger.warn('Could not extract seller ID from API response');
        // Return a placeholder - will need to be provided from redirect
        return 'UNKNOWN_SELLER_ID';
      }

      return sellerId;
    } catch (error: any) {
      logger.warn(
        { error: error.response?.data || error.message },
        'Could not get seller ID from token, will use from redirect parameter'
      );
      // Return placeholder - seller ID should come from redirect parameter
      return 'UNKNOWN_SELLER_ID';
    }
  }

  /**
   * Clean up expired states from state store
   * Called periodically to prevent memory leaks
   */
  private cleanupExpiredStates(): void {
    const now = Date.now();
    for (const [state, data] of this.stateStore.entries()) {
      if (now > data.expiresAt) {
        this.stateStore.delete(state);
      }
    }
  }

  /**
   * Generate random state string for OAuth
   * @returns Random state string
   */
  generateRandomState(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // ============================================
  // User-Specific Token Methods (Step 3)
  // ============================================

  /**
   * Get access token for a specific user (auto-refreshes if needed)
   * This method requires a refresh token to be provided (from database)
   * 
   * @param userId - User ID
   * @param refreshToken - Refresh token from database (encrypted, should be decrypted before passing)
   * @returns Access token
   */
  async getAccessTokenForUser(userId: number, refreshToken: string): Promise<string> {
    const userIdStr = userId.toString();
    const now = Date.now();
    
    // Check cache for valid access token (refresh 5 minutes before expiry)
    const cached = this.userAccessTokenCache.get(userIdStr);
    if (cached && now < cached.expiresAt - (5 * 60 * 1000)) {
      logger.debug({ userId }, 'Using cached access token');
      return cached.token;
    }
    
    // Refresh access token using refresh token
    logger.info({ userId }, 'Refreshing access token for user');
    const accessToken = await this.refreshAccessTokenForUser(refreshToken);
    
    // Cache access token (55 minutes - refresh before 1 hour expiry)
    this.userAccessTokenCache.set(userIdStr, {
      token: accessToken,
      expiresAt: now + (55 * 60 * 1000) // 55 minutes
    });
    
    return accessToken;
  }

  /**
   * Make SP-API call for a specific user
   * Automatically handles token refresh and uses user's refresh token
   * 
   * @param userId - User ID
   * @param refreshToken - Refresh token from database (encrypted, should be decrypted before passing)
   * @param config - Axios request configuration
   * @returns API response data
   */
  async callSpApiForUser<T>(
    userId: number,
    refreshToken: string,
    config: AxiosRequestConfig
  ): Promise<T> {
    try {
      // Get access token for this user
      const accessToken = await this.getAccessTokenForUser(userId, refreshToken);
      
      // Determine base URL
      const baseURL = env.AMAZON_SP_API_BASE_URL || 
        (env.AMAZON_ENVIRONMENT === 'PRODUCTION' 
          ? 'https://sellingpartnerapi-eu.amazon.com'
          : 'https://sandbox.sellingpartnerapi-eu.amazon.com');

      const requestConfig: AxiosRequestConfig = {
        ...config,
        url: `${baseURL}${config.url}`,
        headers: {
          ...config.headers,
          'x-amz-access-token': accessToken,
        },
      };

      // Sign with SigV4 if AWS credentials are available
      const signedConfig = await this.signRequest(requestConfig);

      const response = await axios(signedConfig);
      return response.data;
    } catch (error: any) {
      logger.error(
        { 
          error: error.response?.data || error.message,
          userId,
          url: config.url,
          method: config.method 
        },
        'Error making Amazon API call for user'
      );
      
      // Re-throw REFRESH_TOKEN_EXPIRED error as-is
      if (error.message === 'REFRESH_TOKEN_EXPIRED') {
        throw error;
      }
      
      throw new Error(
        `Amazon API call failed: ${error.response?.data?.errors?.[0]?.message || error.message}`
      );
    }
  }

  /**
   * Get products for a specific user
   * @param userId - User ID
   * @param refreshToken - Refresh token from database
   * @param sellerId - Seller ID
   * @param marketplaceId - Marketplace ID (optional)
   * @returns Products data
   */
  async getProductsForUser(
    userId: number,
    refreshToken: string,
    sellerId: string,
    marketplaceId?: string
  ): Promise<any> {
    const marketplace = marketplaceId || env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV';
    return this.callSpApiForUser(
      userId,
      refreshToken,
      {
        method: 'GET',
        url: `/listings/2021-08-01/items/${sellerId}?marketplaceIds=${marketplace}`,
      }
    );
  }

  /**
   * Get orders for a specific user
   * @param userId - User ID
   * @param refreshToken - Refresh token from database
   * @param marketplaceId - Marketplace ID (optional)
   * @param createdAfter - Filter orders created after this date
   * @param createdBefore - Filter orders created before this date
   * @param orderStatuses - Filter by order statuses
   * @returns Orders data
   */
  async getOrdersForUser(
    userId: number,
    refreshToken: string,
    marketplaceId?: string,
    createdAfter?: string,
    createdBefore?: string,
    orderStatuses?: string[]
  ): Promise<any> {
    const marketplace = marketplaceId || env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV';
    const params = new URLSearchParams({
      MarketplaceIds: marketplace,
    });

    if (createdAfter) params.append('CreatedAfter', createdAfter);
    if (createdBefore) params.append('CreatedBefore', createdBefore);
    if (orderStatuses && orderStatuses.length > 0) {
      orderStatuses.forEach(status => params.append('OrderStatuses', status));
    }

    return this.callSpApiForUser(
      userId,
      refreshToken,
      {
        method: 'GET',
        url: `/orders/v0/orders?${params.toString()}`,
      }
    );
  }

  /**
   * Update inventory for a specific user
   * @param userId - User ID
   * @param refreshToken - Refresh token from database
   * @param sellerId - Seller ID
   * @param sku - Product SKU
   * @param quantity - Quantity to set
   * @param fulfillmentChannelCode - Fulfillment channel code
   * @returns Update response
   */
  async updateInventoryForUser(
    userId: number,
    refreshToken: string,
    sellerId: string,
    sku: string,
    quantity: number,
    fulfillmentChannelCode: string = 'DEFAULT'
  ): Promise<any> {
    return this.callSpApiForUser(
      userId,
      refreshToken,
      {
        method: 'PATCH',
        url: `/listings/2021-08-01/items/${sellerId}/${sku}`,
        headers: {
          'Content-Type': 'application/json',
        },
        data: {
          productType: 'PRODUCT',
          patches: [
            {
              op: 'replace',
              path: '/attributes/fulfillment_availability',
              value: [
                {
                  fulfillment_channel_code: fulfillmentChannelCode,
                  quantity: quantity,
                },
              ],
            },
          ],
        },
      }
    );
  }

  /**
   * Clear access token cache for a user (useful when refresh token is revoked)
   * @param userId - User ID
   */
  clearUserTokenCache(userId: number): void {
    this.userAccessTokenCache.delete(userId.toString());
    logger.info({ userId }, 'Cleared access token cache for user');
  }
}
