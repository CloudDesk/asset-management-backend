import { SellingPartnerApiAuth } from '@sp-api-sdk/auth';
import { ListingsItemsApiClient } from '@sp-api-sdk/listings-items-api-2021-08-01';
import { CatalogItemsApiClient } from '@sp-api-sdk/catalog-items-api-2020-12-01';
import { SellersApiClient } from '@sp-api-sdk/sellers-api-v1';
import { OrdersApiClient } from '@sp-api-sdk/orders-api-v0';
import { FbaInventoryApiClient } from '@sp-api-sdk/fba-inventory-api-v1';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

/**
 * AmazonService using Official Amazon SP-API SDK
 * Phase 1: Authentication & Access Token Management ✅
 * Phase 2: Product Operations (Read) ✅
 * Phase 3: Order Operations (Read) ✅
 * 
 * The SDK handles all token refresh and management automatically.
 * Access tokens are cached internally by the SDK - no manual storage needed.
 */
export class AmazonService {
  // Legacy single auth instance (for backward compatibility)
  private auth: SellingPartnerApiAuth | null = null;
  private listingsClient: ListingsItemsApiClient | null = null;
  private catalogClient: CatalogItemsApiClient | null = null;
  private sellersClient: SellersApiClient | null = null;
  private ordersClient: OrdersApiClient | null = null;
  private fbaInventoryClient: FbaInventoryApiClient | null = null;
  
  // Per-seller auth instances (for temporary OAuth flow)
  private authInstances: Map<string, {
    auth: SellingPartnerApiAuth;
    marketplaceId: string;
    lastUsed: Date;
    environment: 'SANDBOX' | 'PRODUCTION';
    endpoint?: string;
  }> = new Map();
  
  // Default marketplace ID for India
  private readonly DEFAULT_MARKETPLACE_ID = env.AMAZON_MARKETPLACE_ID || 'A21TJRUUN4KGV';
  private readonly REGION = 'eu' as const; // India uses EU region endpoint

  /**
   * Initialize the SDK authentication instance
   * This is called lazily on first use
   */
  private getAuth(): SellingPartnerApiAuth {
    if (!this.auth) {
      if (!env.AMAZON_CLIENT_ID || !env.AMAZON_CLIENT_SECRET || !env.AMAZON_REFRESH_TOKEN) {
        throw new Error(
          'Amazon credentials not configured. Please set AMAZON_CLIENT_ID, AMAZON_CLIENT_SECRET, and AMAZON_REFRESH_TOKEN'
        );
      }

      this.auth = new SellingPartnerApiAuth({
        clientId: env.AMAZON_CLIENT_ID,
        clientSecret: env.AMAZON_CLIENT_SECRET,
        refreshToken: env.AMAZON_REFRESH_TOKEN,
      });

      logger.info('Amazon SP-API SDK authentication initialized');
    }

    return this.auth;
  }

  /**
   * Get or refresh Amazon SP-API access token using SDK
   * The SDK automatically handles token refresh and caching
   * 
   * @returns Access token string
   */
  async getAccessToken(): Promise<string> {
    try {
      const auth = this.getAuth();
      
      // SDK automatically handles token refresh and caching
      // The getAccessToken method automatically refreshes when needed
      const accessToken = await auth.getAccessToken();
      
      logger.debug('Amazon access token retrieved successfully (via SDK)');
      return accessToken;
    } catch (error: any) {
      logger.error({ error: error.message || error }, 'Error getting access token from SDK');
      
      // Check for specific error types
      if (error.message?.includes('invalid_grant') || error.message?.includes('REFRESH_TOKEN_EXPIRED')) {
        throw new Error('REFRESH_TOKEN_EXPIRED');
      }
      
      throw new Error(`Failed to get access token: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get the SDK auth instance (for use with other SDK clients)
   * This allows other services to use the same auth instance
   * 
   * @returns SellingPartnerApiAuth instance
   */
  getAuthInstance(): SellingPartnerApiAuth {
    return this.getAuth();
  }

  /**
   * Initialize or get auth instance for a seller (temporary OAuth flow)
   * Uses sellerId and marketplaceId from environment variables
   * IMPORTANT: Uses refreshToken from frontend, NOT from environment variables
   * Uses AMAZON_ENVIRONMENT from environment variables (not from API request)
   * Validates the token by attempting to get an access token before returning success
   * 
   * @param refreshToken - Amazon refresh token (from frontend) - REQUIRED, uses this instead of env.AMAZON_REFRESH_TOKEN
   * @param clientId - Optional: Override default client ID
   * @param clientSecret - Optional: Override default client secret
   * @returns SellingPartnerApiAuth instance
   * @throws Error if token is invalid or cannot be used to get access token
   */
  async initializeAuthForSeller(
    refreshToken: string,
    clientId?: string,
    clientSecret?: string
  ): Promise<SellingPartnerApiAuth> {
    // Get sellerId and marketplaceId from environment variables
    const sellerId = env.AMAZON_SELLER_ID;
    const marketplaceId = env.AMAZON_MARKETPLACE_ID || this.DEFAULT_MARKETPLACE_ID;
    
    // Determine environment to provide appropriate error message
    const currentEnvType = env.AMAZON_ENVIRONMENT || 'PRODUCTION';
    const isCurrentSandbox = currentEnvType === 'SANDBOX';

    if (!sellerId) {
      if (isCurrentSandbox) {
        throw new Error(
          'AMAZON_SELLER_ID environment variable is required. ' +
          'In sandbox, you can use any mock seller ID (e.g., "A1MOCKSELLER123") - it doesn\'t need to be valid. ' +
          'Alternatively, check the Swagger model JSON for the API to find example seller IDs from x-amzn-api-sandbox static examples. ' +
          'Set AMAZON_SELLER_ID in your .env file.'
        );
      } else {
        throw new Error(
          'AMAZON_SELLER_ID environment variable is required. ' +
          'Get your seller ID from: 1) Amazon product URL (seller= parameter), 2) Seller Central account info, or 3) Set AMAZON_SELLER_ID in your .env file.'
        );
      }
    }

    // Validate that refreshToken is provided (from frontend)
      if (!refreshToken) {
      throw new Error(
        'refreshToken is required. Please provide refreshToken from frontend. This method uses the refreshToken from the request, NOT from environment variables.'
      );
    }

    // Validate refreshToken format
    // Amazon refresh tokens typically start with "Atzr|" and are base64-like strings
    const refreshTokenTrimmed = refreshToken.trim();
    
    // Check if it looks like a URL (common mistake)
    if (refreshTokenTrimmed.startsWith('http://') || refreshTokenTrimmed.startsWith('https://')) {
      throw new Error(
        'Invalid refreshToken format: URL detected. Please provide the actual Amazon refresh token (starts with "Atzr|"), not a URL.'
      );
    }
    
    // Check if it starts with expected Amazon token prefix
    if (!refreshTokenTrimmed.startsWith('Atzr|') && !refreshTokenTrimmed.startsWith('Atza|')) {
      logger.warn({ 
        refreshTokenPrefix: refreshTokenTrimmed.substring(0, 10),
        refreshTokenLength: refreshTokenTrimmed.length 
      }, 'Refresh token does not start with expected Amazon prefix (Atzr| or Atza|)');
      // Note: We still allow it to proceed as some tokens might have different formats
      // But we log a warning
    }
    
    // Check minimum length (Amazon tokens are typically long)
    if (refreshTokenTrimmed.length < 50) {
      throw new Error(
        `Invalid refreshToken format: Token appears too short (${refreshTokenTrimmed.length} characters). Amazon refresh tokens are typically much longer. Please verify you are providing the correct token.`
      );
    }

    // Validate required credentials
    const finalClientId = clientId || env.AMAZON_CLIENT_ID;
    const finalClientSecret = clientSecret || env.AMAZON_CLIENT_SECRET;

    if (!finalClientId || !finalClientSecret) {
      throw new Error(
        'Amazon credentials not provided. Please provide refreshToken, and either clientId/clientSecret or set AMAZON_CLIENT_ID/AMAZON_CLIENT_SECRET in environment variables.'
      );
    }

    // Check if we already have an auth instance for this seller
    // If exists, we'll replace it with the new refreshToken (frontend may have updated it)
    const cached = this.authInstances.get(sellerId);
    if (cached) {
      logger.info({ sellerId }, 'Replacing existing auth instance with new refreshToken from frontend');
      // Clear the old instance to create a new one with the new refreshToken
      this.authInstances.delete(sellerId);
    }

    // Determine environment (sandbox vs production) from environment variable
    // Always use AMAZON_ENVIRONMENT from env, not from API request
    const envType = env.AMAZON_ENVIRONMENT || 'PRODUCTION';
    const isSandbox = envType === 'SANDBOX';
    
    // Determine endpoint based on environment
    // Sandbox uses sandbox.sellingpartnerapi-na.amazon.com for SP-API
    // Production uses sellingpartnerapi-eu.amazon.com (for India/EU region)
    // Note: LWA (Login with Amazon) endpoint for getting access tokens is different:
    // - Sandbox LWA: https://api.sandbox.sellingpartnerapi.amazon.com
    // - Production LWA: https://api.sellingpartnerapi.amazon.com
    let endpoint: string | undefined;
    let lwaEndpoint: string | undefined;
    if (isSandbox) {
      // Sandbox endpoints
      // For India marketplace (A21TJRUUN4KGV), use EU sandbox endpoint
      // Reference: https://developer-docs.amazon.com/sp-api/docs/sp-api-sandbox#sp-api-static-sandbox
      // Europe region includes: Spain, UK, France, Netherlands, Germany, Italy, Sweden, Poland, Egypt, Turkey, UAE, and India
      endpoint = 'https://sandbox.sellingpartnerapi-eu.amazon.com'; // SP-API endpoint (EU region for India)
      lwaEndpoint = 'https://api.sandbox.sellingpartnerapi.amazon.com'; // LWA endpoint for access tokens
    } else {
      // Production endpoints
      endpoint = 'https://sellingpartnerapi-eu.amazon.com'; // SP-API endpoint (EU region for India)
      lwaEndpoint = 'https://api.sellingpartnerapi.amazon.com'; // LWA endpoint for access tokens
    }

    logger.debug({ 
      sellerId,
      environment: envType,
      endpoint,
      lwaEndpoint,
      isSandbox
    }, 'Creating auth instance with environment-specific endpoints');

    // Create new auth instance with refreshToken from FRONTEND (not from env)
    // This is the key difference - we use the refreshToken parameter, not env.AMAZON_REFRESH_TOKEN
    // Use trimmed token
    
    // IMPORTANT: The SDK's SellingPartnerApiAuth uses a hardcoded LWA endpoint
    // For sandbox, we need to set an environment variable that the SDK might read
    // OR we need to check if the SDK supports a custom endpoint parameter
    // 
    // The SDK might read: process.env.AMAZON_SP_API_ENDPOINT or similar
    // Let's try setting it temporarily for this auth instance
    const originalEndpoint = process.env.AMAZON_SP_API_ENDPOINT;
    const originalLwaEndpoint = process.env.AMAZON_LWA_ENDPOINT;
    
    try {
      // Set environment variables that SDK might read for sandbox
      if (isSandbox && lwaEndpoint) {
        // Try setting environment variables that SDK might use
        process.env.AMAZON_SP_API_ENDPOINT = endpoint;
        process.env.AMAZON_LWA_ENDPOINT = lwaEndpoint;
        // Some SDKs use these variable names
        process.env.AMAZON_ENDPOINT = lwaEndpoint;
        process.env.LWA_ENDPOINT = lwaEndpoint;
      }
      
      const authConfig: any = {
        clientId: finalClientId,
        clientSecret: finalClientSecret,
        refreshToken: refreshTokenTrimmed, // ← Uses refreshToken from frontend, NOT env.AMAZON_REFRESH_TOKEN
      };
      
      // Try passing endpoint parameters (SDK might support these)
      if (lwaEndpoint) {
        // Try various parameter names that different SDK versions might use
        authConfig.endpoint = lwaEndpoint;
        authConfig.accessTokenEndpoint = lwaEndpoint;
        authConfig.lwaEndpoint = lwaEndpoint;
        authConfig.baseUrl = lwaEndpoint;
        authConfig.authEndpoint = lwaEndpoint;
      }
      
      logger.debug({ 
        authConfigKeys: Object.keys(authConfig),
        lwaEndpoint,
        isSandbox
      }, 'Creating auth instance with sandbox configuration');
      
      const auth = new SellingPartnerApiAuth(authConfig);

      logger.debug({ 
        sellerId,
        refreshTokenLength: refreshTokenTrimmed.length,
        refreshTokenPrefix: refreshTokenTrimmed.substring(0, 10) + '...'
      }, 'Creating auth instance with frontend refreshToken - validating token now...');

      // CRITICAL: Validate the token by attempting to get an access token
      // This ensures the refresh token is actually valid before we cache it
      // Keep environment variables set during validation
      // 
      // IMPORTANT: For sandbox, the SDK's hardcoded LWA endpoint (https://api.amazon.com/auth/)
      // might not work. We need to manually validate for sandbox if SDK fails.
      let accessToken: string;
      try {
        // Try using SDK first (works for production, might work for sandbox if LWA endpoint is same)
        accessToken = await auth.getAccessToken();
        
        if (!accessToken || accessToken.length === 0) {
          throw new Error('Failed to get access token - refresh token may be invalid');
        }

        logger.info({ 
          sellerId,
          accessTokenLength: accessToken.length,
          accessTokenPrefix: accessToken.substring(0, 10) + '...',
          environment: envType
        }, 'Refresh token validated successfully - access token retrieved via SDK');
      } catch (error: any) {
        logger.warn({ 
          error: error.message || error,
          sellerId,
          refreshTokenPrefix: refreshTokenTrimmed.substring(0, 10) + '...',
          isSandbox,
          lwaEndpoint,
          note: 'SDK getAccessToken failed, might need manual LWA request for sandbox'
        }, 'SDK token validation failed, attempting manual validation for sandbox');
        
        // For sandbox, try manual LWA token request if SDK fails
        // The SDK uses https://api.amazon.com/auth/ which might not work for sandbox
        if (isSandbox && error.message?.includes('400')) {
          try {
            logger.info({ sellerId, isSandbox }, 'Attempting manual LWA token request for sandbox');
            
            // Manual LWA token request for sandbox
            // Use the same endpoint as production (LWA endpoint is global)
            // But verify credentials are correct
            const lwaTokenUrl = 'https://api.amazon.com/auth/o2/token';
            
            // Use URLSearchParams for form-encoded data
            const params = new URLSearchParams();
            params.append('grant_type', 'refresh_token');
            params.append('refresh_token', refreshTokenTrimmed);
            params.append('client_id', finalClientId);
            params.append('client_secret', finalClientSecret);
            
            // @ts-ignore - node-fetch types not available, but it's installed
            const fetch = (await import('node-fetch')).default;
            const response = await fetch(lwaTokenUrl, {
              method: 'POST',
              body: params.toString(),
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              logger.error({ 
                status: response.status,
                statusText: response.statusText,
                errorText,
                sellerId,
                isSandbox
              }, 'Manual LWA token request failed');
              throw new Error(`LWA token request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            const tokenData = await response.json() as { access_token: string; expires_in: number };
            accessToken = tokenData.access_token;
            
            if (!accessToken || accessToken.length === 0) {
              throw new Error('Manual LWA request succeeded but no access token in response');
            }
            
            logger.info({ 
              sellerId,
              accessTokenLength: accessToken.length,
              accessTokenPrefix: accessToken.substring(0, 10) + '...',
              environment: envType,
              method: 'manual'
            }, 'Refresh token validated successfully - access token retrieved via manual LWA request');
          } catch (manualError: any) {
            logger.error({ 
              error: manualError.message || manualError,
              sellerId,
              refreshTokenPrefix: refreshTokenTrimmed.substring(0, 10) + '...',
              isSandbox
            }, 'Manual LWA token request also failed');
            
            // Restore original environment variables before throwing error
            if (originalEndpoint !== undefined) {
              process.env.AMAZON_SP_API_ENDPOINT = originalEndpoint;
            } else {
              delete process.env.AMAZON_SP_API_ENDPOINT;
            }
            if (originalLwaEndpoint !== undefined) {
              process.env.AMAZON_LWA_ENDPOINT = originalLwaEndpoint;
            } else {
              delete process.env.AMAZON_LWA_ENDPOINT;
            }
            if (isSandbox) {
              delete process.env.AMAZON_ENDPOINT;
              delete process.env.LWA_ENDPOINT;
            }
            
            // Check for specific error types
            if (manualError.message?.includes('invalid_grant') || 
                manualError.message?.includes('REFRESH_TOKEN_EXPIRED') ||
                manualError.message?.includes('invalid_client') ||
                manualError.message?.includes('unauthorized_client')) {
              throw new Error(
                `Invalid refresh token: ${manualError.message || 'The refresh token is invalid, expired, or does not match the provided client credentials. Please verify your refresh token is correct and matches the sandbox environment.'}`
              );
            }
            
            throw new Error(
              `Failed to validate refresh token (both SDK and manual methods failed): ${manualError.message || 'Unable to get access token. Please verify your refresh token is correct and not expired. For sandbox, ensure you are using sandbox app credentials.'}`
            );
          }
        } else {
          // For production or non-400 errors, restore env vars and throw
          // Restore original environment variables before throwing error
          if (originalEndpoint !== undefined) {
            process.env.AMAZON_SP_API_ENDPOINT = originalEndpoint;
          } else {
            delete process.env.AMAZON_SP_API_ENDPOINT;
          }
          if (originalLwaEndpoint !== undefined) {
            process.env.AMAZON_LWA_ENDPOINT = originalLwaEndpoint;
          } else {
            delete process.env.AMAZON_LWA_ENDPOINT;
          }
          if (isSandbox) {
            delete process.env.AMAZON_ENDPOINT;
            delete process.env.LWA_ENDPOINT;
          }
          
          // Check for specific error types
          if (error.message?.includes('invalid_grant') || 
              error.message?.includes('REFRESH_TOKEN_EXPIRED') ||
              error.message?.includes('invalid_client') ||
              error.message?.includes('unauthorized_client')) {
            throw new Error(
              `Invalid refresh token: ${error.message || 'The refresh token is invalid, expired, or does not match the provided client credentials. Please verify your refresh token is correct.'}`
            );
          }
          
          throw new Error(
            `Failed to validate refresh token: ${error.message || 'Unable to get access token. Please verify your refresh token is correct and not expired.'}`
          );
        }
      }

      // Cache it only after successful validation
      this.authInstances.set(sellerId, {
        auth,
        marketplaceId,
        lastUsed: new Date(),
        environment: envType,
        endpoint,
      });

      // Restore original environment variables after successful validation
      if (originalEndpoint !== undefined) {
        process.env.AMAZON_SP_API_ENDPOINT = originalEndpoint;
      } else {
        delete process.env.AMAZON_SP_API_ENDPOINT;
      }
      if (originalLwaEndpoint !== undefined) {
        process.env.AMAZON_LWA_ENDPOINT = originalLwaEndpoint;
      } else {
        delete process.env.AMAZON_LWA_ENDPOINT;
      }
      if (isSandbox) {
        delete process.env.AMAZON_ENDPOINT;
        delete process.env.LWA_ENDPOINT;
      }

      logger.info({ 
        sellerId, 
        marketplaceId,
        refreshTokenSource: 'frontend',
        refreshTokenLength: refreshTokenTrimmed.length,
        environment: envType,
        note: 'Using refreshToken from frontend request, NOT from environment variables. Token validated successfully.'
      }, 'Auth instance created and cached for seller');
      
      return auth;
    } catch (error: any) {
      // Restore original environment variables on error
      if (originalEndpoint !== undefined) {
        process.env.AMAZON_SP_API_ENDPOINT = originalEndpoint;
      } else {
        delete process.env.AMAZON_SP_API_ENDPOINT;
      }
      if (originalLwaEndpoint !== undefined) {
        process.env.AMAZON_LWA_ENDPOINT = originalLwaEndpoint;
      } else {
        delete process.env.AMAZON_LWA_ENDPOINT;
      }
      if (isSandbox) {
        delete process.env.AMAZON_ENDPOINT;
        delete process.env.LWA_ENDPOINT;
      }
      throw error;
    }
  }

  /**
   * Get auth instance for a specific seller
   * Throws error if not initialized
   * 
   * @param sellerId - Amazon Seller ID
   * @returns SellingPartnerApiAuth instance
   */
  getAuthForSeller(sellerId: string): SellingPartnerApiAuth {
    const cached = this.authInstances.get(sellerId);
    if (!cached) {
      throw new Error(
        `Auth not initialized for seller: ${sellerId}. Please call initializeAuthForSeller first.`
      );
    }
    cached.lastUsed = new Date();
    return cached.auth;
  }

  /**
   * Clear auth instance for a seller (called on logout)
   * 
   * @param sellerId - Amazon Seller ID
   * @returns true if auth was cleared, false if not found
   */
  clearAuthForSeller(sellerId: string): boolean {
    const deleted = this.authInstances.delete(sellerId);
    if (deleted) {
      logger.info({ sellerId }, 'Amazon auth instance cleared for seller');
    } else {
      logger.debug({ sellerId }, 'No auth instance found to clear for seller');
    }
    return deleted;
  }

  /**
   * Check if auth is initialized for a seller
   * 
   * @param sellerId - Amazon Seller ID
   * @returns true if initialized, false otherwise
   */
  isAuthInitializedForSeller(sellerId: string): boolean {
    return this.authInstances.has(sellerId);
  }

  /**
   * Get Listings Items API client (lazy initialization)
   * Uses the same auth instance - SDK handles token caching automatically
   */
  private getListingsClient(): ListingsItemsApiClient {
    if (!this.listingsClient) {
      this.listingsClient = new ListingsItemsApiClient({
        auth: this.getAuth(),
        region: this.REGION,
      });
      logger.debug('Listings Items API client initialized');
    }
    return this.listingsClient;
  }

  /**
   * Get Listings Items API client for a specific seller
   * Uses seller-specific auth if available, otherwise falls back to legacy auth
   * 
   * @param sellerId - Optional seller ID. If provided and auth exists, uses seller-specific auth
   * @returns ListingsItemsApiClient
   */
  private getListingsClientForSeller(sellerId?: string): ListingsItemsApiClient {
    if (sellerId && this.isAuthInitializedForSeller(sellerId)) {
      const cached = this.authInstances.get(sellerId);
      if (cached) {
        const auth = cached.auth;
        // For sandbox, use 'eu' region for India marketplace (sandbox endpoint is sandbox.sellingpartnerapi-eu.amazon.com)
        // Reference: https://developer-docs.amazon.com/sp-api/docs/sp-api-sandbox#sp-api-static-sandbox
        // Europe sandbox region includes: Spain, UK, France, Netherlands, Germany, Italy, Sweden, Poland, Egypt, Turkey, UAE, and India
        // For production, use the appropriate region based on marketplace (India uses 'eu')
        const region = cached.environment === 'SANDBOX' ? 'eu' : this.REGION;
        
        logger.debug({ 
          sellerId, 
          environment: cached.environment,
          region,
          endpoint: cached.endpoint,
          marketplaceId: cached.marketplaceId,
          note: 'Creating Listings client with seller-specific auth'
        }, 'Listings client configuration');
        
        const config: any = {
          auth,
          region,
        };
        // For sandbox, configure the SDK to use sandbox endpoint
        // The SDK's ClientConfiguration interface supports 'sandbox?: boolean'
        // Reference: node_modules/@sp-api-sdk/common/dist/types/axios.d.ts
        if (cached.environment === 'SANDBOX') {
          // Set sandbox flag - the SDK will use this to construct the sandbox endpoint
          // The SDK's createAxiosInstance function uses 'sandbox' to determine the endpoint
          config.sandbox = true;
          logger.debug({ 
            sellerId,
            environment: cached.environment,
            region,
            sandbox: true,
            expectedEndpoint: cached.endpoint,
            note: 'Configuring Listings client for sandbox mode using sandbox: true'
          }, 'Configuring Listings client for sandbox');
        }
        return new ListingsItemsApiClient(config);
      }
    }
    // Fall back to legacy client
    return this.getListingsClient();
  }

  /**
   * Get Catalog Items API client (lazy initialization)
   * Uses the same auth instance - SDK handles token caching automatically
   */
  private getCatalogClient(): CatalogItemsApiClient {
    if (!this.catalogClient) {
      this.catalogClient = new CatalogItemsApiClient({
        auth: this.getAuth(),
        region: this.REGION,
      });
      logger.debug('Catalog Items API client initialized');
    }
    return this.catalogClient;
  }

  /**
   * Get Catalog Items API client for a specific seller
   * Uses seller-specific auth if available, otherwise falls back to legacy auth
   * 
   * @param sellerId - Optional seller ID. If provided and auth exists, uses seller-specific auth
   * @returns CatalogItemsApiClient
   */
  private getCatalogClientForSeller(sellerId?: string): CatalogItemsApiClient {
    if (sellerId && this.isAuthInitializedForSeller(sellerId)) {
      const auth = this.getAuthForSeller(sellerId);
      return new CatalogItemsApiClient({
        auth,
        region: this.REGION,
      });
    }
    // Fall back to legacy client
    return this.getCatalogClient();
  }

  /**
   * Get Sellers API client (lazy initialization)
   * Uses the same auth instance - SDK handles token caching automatically
   */
  private getSellersClient(): SellersApiClient {
    if (!this.sellersClient) {
      this.sellersClient = new SellersApiClient({
        auth: this.getAuth(),
        region: this.REGION,
      });
      logger.debug('Sellers API client initialized');
    }
    return this.sellersClient;
  }

  /**
   * Get Sellers API client for a specific seller
   * Uses seller-specific auth if available, otherwise falls back to legacy auth
   * 
   * @param sellerId - Optional seller ID. If provided and auth exists, uses seller-specific auth
   * @returns SellersApiClient
   */
  private getSellersClientForSeller(sellerId?: string): SellersApiClient {
    if (sellerId && this.isAuthInitializedForSeller(sellerId)) {
      const auth = this.getAuthForSeller(sellerId);
      return new SellersApiClient({
        auth,
        region: this.REGION,
      });
    }
    // Fall back to legacy client
    return this.getSellersClient();
  }

  /**
   * Get Orders API client (lazy initialization)
   * Uses the same auth instance - SDK handles token caching automatically
   */
  private getOrdersClient(): OrdersApiClient {
    if (!this.ordersClient) {
      this.ordersClient = new OrdersApiClient({
        auth: this.getAuth(),
        region: this.REGION,
      });
      logger.debug('Orders API client initialized');
    }
    return this.ordersClient;
  }

  /**
   * Get Orders API client for a specific seller
   * Uses seller-specific auth if available, otherwise falls back to legacy auth
   * 
   * @param sellerId - Optional seller ID. If provided and auth exists, uses seller-specific auth
   * @returns OrdersApiClient
   */
  private getOrdersClientForSeller(sellerId?: string): OrdersApiClient {
    if (sellerId && this.isAuthInitializedForSeller(sellerId)) {
      const cached = this.authInstances.get(sellerId);
      if (cached) {
        const auth = cached.auth;
        // For sandbox, use 'eu' region for India marketplace (sandbox endpoint is sandbox.sellingpartnerapi-eu.amazon.com)
        // Reference: https://developer-docs.amazon.com/sp-api/docs/sp-api-sandbox#sp-api-static-sandbox
        // Europe sandbox region includes: Spain, UK, France, Netherlands, Germany, Italy, Sweden, Poland, Egypt, Turkey, UAE, and India
        // For production, use the appropriate region based on marketplace (India uses 'eu')
        const region = cached.environment === 'SANDBOX' ? 'eu' : this.REGION;
        
        logger.debug({ 
          sellerId, 
          environment: cached.environment,
          region,
          endpoint: cached.endpoint,
          marketplaceId: cached.marketplaceId,
          note: 'Creating Orders client with seller-specific auth'
        }, 'Orders client configuration');
        
        const config: any = {
          auth,
          region,
        };
        // For sandbox, configure the SDK to use sandbox endpoint
        // The SDK's ClientConfiguration interface supports 'sandbox?: boolean'
        // Reference: node_modules/@sp-api-sdk/common/dist/types/axios.d.ts
        if (cached.environment === 'SANDBOX') {
          // Set sandbox flag - the SDK will use this to construct the sandbox endpoint
          // The SDK's createAxiosInstance function uses 'sandbox' to determine the endpoint
          config.sandbox = true;
          logger.debug({ 
            sellerId,
            environment: cached.environment,
            region,
            sandbox: true,
            expectedEndpoint: cached.endpoint,
            note: 'Configuring Orders client for sandbox mode using sandbox: true'
          }, 'Configuring Orders client for sandbox');
        }
        return new OrdersApiClient(config);
      }
    }
    // Fall back to legacy client
    return this.getOrdersClient();
  }

  /**
   * Get FBA Inventory API client (lazy initialization)
   * Uses the same auth instance - SDK handles token caching automatically
   */
  private getFbaInventoryClient(): FbaInventoryApiClient {
    if (!this.fbaInventoryClient) {
      this.fbaInventoryClient = new FbaInventoryApiClient({
        auth: this.getAuth(),
        region: this.REGION,
      });
      logger.debug('FBA Inventory API client initialized');
    }
    return this.fbaInventoryClient;
  }

  /**
   * Get FBA Inventory API client for a specific seller
   * Uses seller-specific auth if available, otherwise falls back to legacy auth
   * 
   * @param sellerId - Optional seller ID. If provided and auth exists, uses seller-specific auth
   * @returns FbaInventoryApiClient
   */
  private getFbaInventoryClientForSeller(sellerId?: string): FbaInventoryApiClient {
    if (sellerId && this.isAuthInitializedForSeller(sellerId)) {
      const auth = this.getAuthForSeller(sellerId);
      return new FbaInventoryApiClient({
        auth,
        region: this.REGION,
      });
    }
    // Fall back to legacy client
    return this.getFbaInventoryClient();
  }

  /**
   * Get seller account details
   * Note: getAccount is only available in EU marketplace (which includes India)
   * @returns Account details including sellerId, companyName, etc.
   */
  async getAccountDetails(): Promise<any> {
    try {
      const client = this.getSellersClient();
      
      logger.info('Getting seller account details');
      
      // Try getAccount (available in EU marketplace, which includes India)
      const response = await client.getAccount();
      
      logger.debug({ 
        responseData: response.data,
        responseStatus: response.status 
      }, 'Account details response');
      
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message || error }, 'Error getting account details');
      throw new Error(`Failed to get account details: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get authenticated seller ID from marketplace participations or Fees API
   * This is the sellerId associated with your refresh token
   */
  async getAuthenticatedSellerId(): Promise<string | null> {
    try {
      // Method 1: Try marketplace participations first
      try {
        const client = this.getSellersClient();
        
        logger.info('Getting authenticated seller ID from marketplace participations');
        
        const response = await client.getMarketplaceParticipations();
        
        logger.debug({ 
          responseData: response.data,
          responseStatus: response.status 
        }, 'Marketplace participations response');
        
        // Extract sellerId from response
        // Response structure: { payload: [{ marketplace: {...}, participation: {...} }] }
        const payload = response.data?.payload;
        if (payload && Array.isArray(payload) && payload.length > 0) {
          // Try to find sellerId in the response structure
          const firstItem = payload[0] as any;
          const sellerId = firstItem?.sellerId || 
                           firstItem?.seller?.sellerId ||
                           (response.data as any)?.sellerId ||
                           null;
          
          if (sellerId) {
            logger.info({ sellerId }, 'Authenticated seller ID retrieved from marketplace participations');
            return sellerId;
          }
          
          // Log full structure for debugging
          logger.debug({ 
            payloadStructure: payload[0],
            fullResponse: response.data 
          }, 'Marketplace participations structure - sellerId not found in expected location');
        }
      } catch (mpError: any) {
        logger.warn({ error: mpError.message }, 'Marketplace participations failed, trying Fees API');
      }

      // Method 2: Try listings search (may not work - requires sellerId)
      const sellerIdFromListings = await this.tryGetSellerIdFromListingsSearch();
      if (sellerIdFromListings) {
        logger.info({ sellerId: sellerIdFromListings }, 'Authenticated seller ID retrieved from listings search');
        return sellerIdFromListings;
      }
      
      // Method 3: Check if sellerId is in environment variables (manual setup)
      const sellerIdFromEnv = env.AMAZON_SELLER_ID;
      if (sellerIdFromEnv) {
        logger.info({ sellerId: sellerIdFromEnv }, 'Authenticated seller ID retrieved from environment variable AMAZON_SELLER_ID');
        return sellerIdFromEnv;
      }
      
      logger.warn({
        note: 'MarketplaceParticipations API does not return sellerId. This is a known Amazon SP-API limitation.',
        solution: 'SellerId must be obtained manually from: 1) Amazon product URL (seller= parameter), 2) Seller Central account info, or 3) Set AMAZON_SELLER_ID environment variable'
      }, 'Seller ID not found - must be obtained manually');
      return null;
    } catch (error: any) {
      logger.error({ error: error.message || error }, 'Error getting authenticated seller ID');
      return null;
    }
  }

  /**
   * Try to get sellerId by attempting a Listings API search
   * This is a workaround since marketplaceParticipations doesn't return sellerId
   * Note: This may not work if you don't have any listings
   */
  private async tryGetSellerIdFromListingsSearch(): Promise<string | null> {
    try {
      // Try to search listings with a very generic query
      // If this works, we might be able to extract sellerId from the response
      // But this requires sellerId as a parameter, so it's circular...
      // This method is kept for potential future use
      logger.debug('Attempting to get sellerId from listings search (may not work)');
      return null;
    } catch (error: any) {
      logger.debug({ error: error.message }, 'Could not get sellerId from listings search');
      return null;
    }
  }

  // ============================================
  // Phase 2: Product Operations (Read)
  // ============================================

  /**
   * Get listing item by SKU (seller's own listing)
   * @param sellerId - Amazon Seller ID
   * @param sku - Product SKU
   * @param marketplaceIds - Marketplace IDs (default: India)
   * @param includedData - Data to include (default: ['summaries'])
   */
  async getListingItemBySku(
    sellerId: string,
    sku: string,
    marketplaceIds?: string[],
    includedData?: ('summaries' | 'attributes' | 'issues' | 'offers' | 'fulfillmentAvailability' | 'procurement')[]
  ): Promise<any> {
    try {
      const client = this.getListingsClientForSeller(sellerId);
      const marketplaces = marketplaceIds || [this.DEFAULT_MARKETPLACE_ID];
      const dataToInclude = includedData || ['summaries'];

      logger.info({ sellerId, sku, marketplaces }, 'Getting listing item by SKU');

      // Verify sellerId matches authenticated seller (warning only)
      const authenticatedSellerId = await this.getAuthenticatedSellerId();
      if (authenticatedSellerId && sellerId !== authenticatedSellerId) {
        logger.warn({ 
          providedSellerId: sellerId,
          authenticatedSellerId,
          note: 'Provided sellerId does not match authenticated seller. This may cause empty responses.'
        }, 'SellerId mismatch detected');
      }

      const response = await client.getListingsItem({
        sellerId,
        sku,
        marketplaceIds: marketplaces,
        includedData: dataToInclude,
      });

      // Log full response for debugging
      logger.debug({ 
        sellerId, 
        sku, 
        marketplaces,
        responseStatus: response.status,
        responseStatusText: response.statusText,
        responseData: response.data,
        responseDataKeys: response.data ? Object.keys(response.data) : [],
        responseDataString: JSON.stringify(response.data, null, 2),
        responseHeaders: response.headers
      }, 'Listing item API response - full details');

      // Check if response data is empty, null, or has no meaningful content
      const responseData = response.data;
      
      // Log what we're about to check
      logger.debug({ 
        hasResponseData: !!responseData,
        isObject: typeof responseData === 'object',
        keysCount: responseData && typeof responseData === 'object' ? Object.keys(responseData).length : 0,
        hasSku: responseData?.sku ? true : false,
        hasSummaries: responseData?.summaries ? true : false,
        hasAttributes: responseData?.attributes ? true : false,
        responseDataType: typeof responseData
      }, 'Checking response data validity');
      
      if (!responseData || 
          (typeof responseData === 'object' && Object.keys(responseData).length === 0) ||
          (responseData && typeof responseData === 'object' && !responseData.sku && !responseData.summaries && !responseData.attributes)) {
        logger.warn({ 
          sellerId, 
          sku, 
          marketplaces,
          responseData,
          note: 'Empty or invalid response - SKU may not exist for this seller, or sellerId may not match authenticated seller'
        }, 'Listing item returned empty/invalid data');
        
        // Try to search for the SKU to see if it exists
        try {
          logger.info({ sellerId, sku }, 'Attempting to search for SKU to verify existence');
          const searchResult = await this.searchListingsItems(sellerId, marketplaces, { sellerSkus: [sku] });
          
          if (searchResult && searchResult.items && searchResult.items.length > 0) {
            logger.info({ sellerId, sku, foundItems: searchResult.items.length }, 'SKU found via search - returning search result');
            return searchResult.items[0];
          }
        } catch (searchError: any) {
          logger.debug({ searchError: searchError.message }, 'Search fallback failed');
        }
        
        // Return helpful error message
      return {
          sku,
        sellerId,
          marketplaceIds: marketplaces,
          message: 'No listing found for this SKU',
          note: 'The SKU may not exist for this seller, or the sellerId may not match the authenticated seller account. Verify: 1) SKU exists in Seller Central, 2) sellerId matches your authenticated account, 3) SKU is active in the specified marketplace',
          troubleshooting: {
            step1: 'Verify the SKU exists in Seller Central inventory',
            step2: 'Check that sellerId matches the authenticated seller (use GET /v1/amazon/auth/token to verify)',
            step3: 'Ensure the SKU is active in marketplace A21TJRUUN4KGV (India)',
            step4: 'Try using searchListingsItems endpoint to find all your listings first'
          }
        };
      }

      // Log what we're returning
      logger.debug({ 
        returningData: responseData,
        dataKeys: Object.keys(responseData || {}),
        dataString: JSON.stringify(responseData, null, 2).substring(0, 500)
      }, 'Returning listing item data from service');

      return responseData;
    } catch (error: any) {
      logger.error({ error: error.message || error, sellerId, sku }, 'Error getting listing item by SKU');
      throw new Error(`Failed to get listing item: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Search listings items (seller's own listings)
   * @param sellerId - Amazon Seller ID
   * @param marketplaceIds - Marketplace IDs (default: India)
   * @param query - Search query parameters
   * @param includeInventory - Whether to include fulfillmentAvailability data (for inventory info)
   */
  async searchListingsItems(
    sellerId: string,
    marketplaceIds?: string[],
    query?: {
      keywords?: string[];
      sellerSkus?: string[];
      asins?: string[];
      pageSize?: number;
      pageToken?: string;
    },
    includeInventory: boolean = false
  ): Promise<any> {
    const marketplaces = marketplaceIds || [this.DEFAULT_MARKETPLACE_ID];
    
    // Build request params outside try block so it's available in catch
    const requestParams: any = {
      sellerId,
      marketplaceIds: marketplaces,
      ...query,
    };

    // Add includedData if inventory is requested
    if (includeInventory) {
      requestParams.includedData = ['summaries', 'fulfillmentAvailability'];
    }

    try {
      const client = this.getListingsClientForSeller(sellerId);

      logger.info({ sellerId, marketplaces, query, includeInventory }, 'Searching listings items');

      // Log the actual request being made (for debugging sandbox endpoint)
      const cachedForLog = this.authInstances.get(sellerId);
      logger.debug({ 
        requestParams,
        sellerId,
        environment: cachedForLog?.environment,
        endpoint: cachedForLog?.endpoint,
        note: 'About to call searchListingsItems - check if SDK is using sandbox endpoint'
      }, 'Making searchListingsItems API call');
      
      const response = await client.searchListingsItems(requestParams);

      logger.debug({ 
        status: response.status,
        statusText: response.statusText,
        dataKeys: response.data ? Object.keys(response.data) : [],
        note: 'Listings items search completed'
      }, 'Listings items search completed successfully');
      return response.data;
    } catch (error: any) {
      const cached = this.authInstances.get(sellerId);
      const isSandbox = cached?.environment === 'SANDBOX';
      
      logger.error({ 
        error: error.message || error, 
        sellerId,
        environment: cached?.environment,
        region: cached?.environment === 'SANDBOX' ? 'eu' : this.REGION,
        endpoint: cached?.endpoint,
        requestParams,
        note: isSandbox ? 'Sandbox environment - 400/403 errors often indicate parameter mismatch' : 'Production environment'
      }, 'Error searching listings items');
      
      // Provide helpful error message for sandbox errors
      if (isSandbox) {
        if (error.message?.includes('400') || error.message?.includes('Bad Request')) {
          throw new Error(
            `Failed to search listings items: 400 Bad Request. ` +
            `SANDBOX environment detected. ` +
            `Sandbox requires specific request parameters. ` +
            `The searchListingsItems method might not be supported in sandbox, or requires additional parameters. ` +
            `For sandbox, try using getListingsItem with identifiersType and identifiers parameters instead: ` +
            `GET /listings/2021-08-01/items/{sellerId}?identifiersType=SKU&identifiers={SKU}&marketplaceIds={marketplaceId}. ` +
            `Alternatively, check the Swagger model JSON for Listings Items API (2021-08-01) - look for "x-amzn-api-sandbox" → "static" array to find example request parameters. ` +
            `Reference: https://developer-docs.amazon.com/sp-api/docs/sp-api-sandbox#sp-api-static-sandbox`
          );
        } else if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
          throw new Error(
            `Failed to search listings items: 403 Forbidden. ` +
            `SANDBOX environment detected. ` +
            `Sandbox uses pattern matching - your request parameters must match predefined test cases. ` +
            `The 403 error likely means your request doesn't match the sandbox's expected patterns. ` +
            `Solutions: 1) Check the Swagger model JSON for Listings Items API (2021-08-01) - look for "x-amzn-api-sandbox" → "static" array to find example request parameters, ` +
            `2) Use the exact seller ID, SKUs, and other parameters from the Swagger examples, ` +
            `3) For sandbox, sellerId doesn't need to be valid but must match the pattern in Swagger examples, ` +
            `4) Reference: https://developer-docs.amazon.com/sp-api/docs/sp-api-sandbox#sp-api-static-sandbox`
          );
        } else {
          throw new Error(
            `Failed to search listings items: ${error.message || 'Unknown error'}. ` +
            `SANDBOX environment detected. ` +
            `Sandbox may require specific parameters or use different endpoint formats. ` +
            `Check the Swagger model JSON for Listings Items API (2021-08-01) for sandbox-specific requirements.`
          );
        }
      } else {
        // Production error handling
        if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
          throw new Error(
            `Failed to search listings items: 403 Forbidden. ` +
            `This may indicate: 1) Seller ID "${sellerId}" doesn't match authenticated account, ` +
            `2) App missing required roles/permissions, ` +
            `3) Seller account doesn't have access to marketplace.`
          );
        }
        throw new Error(`Failed to search listings items: ${error.message || 'Unknown error'}`);
      }
    }
  }

  /**
   * Search catalog items (Amazon catalog search)
   * @param keywords - Search keywords
   * @param marketplaceIds - Marketplace IDs (default: India)
   * @param pageSize - Number of results per page (max 20)
   * @param pageToken - Token for pagination
   */
  async searchCatalogItems(
    keywords: string[],
    marketplaceIds?: string[],
    pageSize?: number,
    pageToken?: string
  ): Promise<any> {
    try {
      const client = this.getCatalogClient();
      const marketplaces = marketplaceIds || [this.DEFAULT_MARKETPLACE_ID];
      const size = pageSize || 20;

      logger.info({ keywords, marketplaces, pageSize: size }, 'Searching catalog items');

      const requestParams: any = {
        keywords,
        marketplaceIds: marketplaces,
        pageSize: size,
      };
      
      if (pageToken) {
        requestParams.pageToken = pageToken;
      }

      const response = await client.searchCatalogItems(requestParams);

      logger.debug('Catalog items search completed successfully');
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message || error, keywords }, 'Error searching catalog items');
      throw new Error(`Failed to search catalog items: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get catalog item by ASIN
   * @param asin - Amazon Standard Identification Number
   * @param marketplaceIds - Marketplace IDs (default: India)
   * @param includedData - Data to include (default: ['summaries', 'attributes'])
   */
  async getCatalogItemByAsin(
    asin: string,
    marketplaceIds?: string[],
    includedData?: ('summaries' | 'attributes' | 'dimensions' | 'identifiers' | 'images' | 'productTypes' | 'relationships' | 'salesRanks' | 'vendorDetails')[]
  ): Promise<any> {
    try {
      const client = this.getCatalogClient();
      const marketplaces = marketplaceIds || [this.DEFAULT_MARKETPLACE_ID];
      const dataToInclude = includedData || ['summaries', 'attributes'];

      logger.info({ asin, marketplaces }, 'Getting catalog item by ASIN');

      const response = await client.getCatalogItem({
        asin,
        marketplaceIds: marketplaces,
        includedData: dataToInclude as any, // SDK enum types
      });

      // Log full response for debugging
      logger.debug({ 
        asin, 
        marketplaces,
        responseStatus: response.status,
        responseStatusText: response.statusText,
        responseData: response.data,
        responseDataKeys: response.data ? Object.keys(response.data) : [],
        responseDataString: JSON.stringify(response.data, null, 2),
        responseHeaders: response.headers
      }, 'Catalog item API response - full details');

      // Check if response data is empty, null, or has no meaningful content
      const responseData = response.data;
      if (!responseData || 
          (typeof responseData === 'object' && Object.keys(responseData).length === 0) ||
          (responseData && typeof responseData === 'object' && !responseData.asin && !responseData.summaries && !responseData.attributes)) {
        logger.warn({ 
          asin, 
          marketplaces,
          responseData,
          note: 'Empty or invalid response - ASIN may not exist in this marketplace, or may not be available via Catalog API'
        }, 'Catalog item returned empty/invalid data');
        
        // Try searching catalog to see if ASIN exists
        try {
          logger.info({ asin }, 'Attempting to search catalog for ASIN to verify existence');
          const searchResult = await this.searchCatalogItems([asin], marketplaces, 1);
          
          if (searchResult && searchResult.items && searchResult.items.length > 0) {
            logger.info({ asin, foundItems: searchResult.items.length }, 'ASIN found via search - returning search result');
            return searchResult.items[0];
          }
        } catch (searchError: any) {
          logger.debug({ searchError: searchError.message }, 'Catalog search fallback failed');
        }
        
        // Return helpful error message
        return {
          asin,
          marketplaceIds: marketplaces,
          message: 'No catalog item found for this ASIN',
          note: 'The ASIN may not exist in this marketplace, or may not be available via the Catalog Items API',
          troubleshooting: {
            step1: 'Verify the ASIN exists on Amazon.in',
            step2: 'Check that the ASIN is available in the India marketplace (A21TJRUUN4KGV)',
            step3: 'Some products may not be accessible via Catalog API - try using the product URL directly',
            step4: 'Try using searchCatalogItems endpoint with keywords from the product'
          }
        };
      }

      return responseData;
    } catch (error: any) {
      logger.error({ error: error.message || error, asin }, 'Error getting catalog item by ASIN');
      throw new Error(`Failed to get catalog item: ${error.message || 'Unknown error'}`);
    }
  }

  // ============================================
  // Phase 3: Order Operations (Read)
  // ============================================

  /**
   * Get orders (list of orders)
   * @param marketplaceIds - Marketplace IDs (default: India)
   * @param createdAfter - Get orders created after this date (ISO 8601 format)
   * @param createdBefore - Get orders created before this date (ISO 8601 format)
   * @param lastUpdatedAfter - Get orders updated after this date (ISO 8601 format)
   * @param lastUpdatedBefore - Get orders updated before this date (ISO 8601 format)
   * @param orderStatuses - Filter by order statuses (e.g., ['Unshipped', 'PartiallyShipped'])
   * @param fulfillmentChannels - Filter by fulfillment channels (e.g., ['MFN', 'AFN'])
   * @param paymentMethods - Filter by payment methods (e.g., ['COD', 'CreditCard'])
   * @param buyerEmail - Filter by buyer email
   * @param sellerOrderId - Filter by seller order ID
   * @param maxResultsPerPage - Maximum number of results per page (1-100, default: 100)
   * @param easyShipShipmentStatuses - Filter by Easy Ship shipment statuses
   * @param nextToken - Token for pagination
   * @param amazonOrderIds - Filter by specific Amazon order IDs
   */
  async getOrders(
    marketplaceIds?: string[],
    createdAfter?: string,
    createdBefore?: string,
    lastUpdatedAfter?: string,
    lastUpdatedBefore?: string,
    orderStatuses?: string[],
    fulfillmentChannels?: string[],
    paymentMethods?: string[],
    buyerEmail?: string,
    sellerOrderId?: string,
    maxResultsPerPage?: number,
    easyShipShipmentStatuses?: string[],
    nextToken?: string,
    amazonOrderIds?: string[],
    sellerId?: string
  ): Promise<any> {
    try {
      // Use seller-specific client if sellerId is provided and auth is initialized
      const client = this.getOrdersClientForSeller(sellerId || env.AMAZON_SELLER_ID);
      const marketplaces = marketplaceIds || [this.DEFAULT_MARKETPLACE_ID];

      logger.info({ 
        marketplaces, 
        createdAfter, 
        createdBefore,
        maxResultsPerPage,
        nextToken: nextToken ? 'provided' : 'not provided'
      }, 'Getting orders');

      // SDK expects camelCase parameter names
      const requestParams: any = {
        marketplaceIds: marketplaces,
      };

      if (createdAfter) requestParams.createdAfter = createdAfter;
      if (createdBefore) requestParams.createdBefore = createdBefore;
      if (lastUpdatedAfter) requestParams.lastUpdatedAfter = lastUpdatedAfter;
      if (lastUpdatedBefore) requestParams.lastUpdatedBefore = lastUpdatedBefore;
      if (orderStatuses && orderStatuses.length > 0) requestParams.orderStatuses = orderStatuses;
      if (fulfillmentChannels && fulfillmentChannels.length > 0) requestParams.fulfillmentChannels = fulfillmentChannels;
      if (paymentMethods && paymentMethods.length > 0) requestParams.paymentMethods = paymentMethods;
      if (buyerEmail) requestParams.buyerEmail = buyerEmail;
      if (sellerOrderId) requestParams.sellerOrderId = sellerOrderId;
      if (maxResultsPerPage) requestParams.maxResultsPerPage = maxResultsPerPage;
      if (easyShipShipmentStatuses && easyShipShipmentStatuses.length > 0) requestParams.easyShipShipmentStatuses = easyShipShipmentStatuses;
      if (nextToken) requestParams.nextToken = nextToken;
      if (amazonOrderIds && amazonOrderIds.length > 0) requestParams.amazonOrderIds = amazonOrderIds;

      const response = await client.getOrders(requestParams);

      logger.debug('Orders retrieved successfully');
      return response.data;
    } catch (error: any) {
      const sellerIdForLog = sellerId || env.AMAZON_SELLER_ID;
      const cached = sellerIdForLog ? this.authInstances.get(sellerIdForLog) : null;
      const isSandbox = cached?.environment === 'SANDBOX';
      
      logger.error({ 
        error: error.message || error,
        sellerId: sellerIdForLog,
        environment: cached?.environment,
        region: cached?.environment === 'SANDBOX' ? 'eu' : this.REGION,
        endpoint: cached?.endpoint,
        note: isSandbox ? 'Sandbox environment - 403 errors often occur with production seller IDs' : 'Production environment'
      }, 'Error getting orders');
      
      // Provide helpful error message for 403 in sandbox
      if (error.message?.includes('403') || error.message?.includes('Forbidden')) {
        if (isSandbox) {
          throw new Error(
            `Failed to get orders: 403 Forbidden. ` +
            `SANDBOX environment detected. ` +
            `Sandbox uses pattern matching - your request parameters must match predefined test cases. ` +
            `For Orders API in sandbox, try using CreatedAfter="TEST_CASE_200" parameter. ` +
            `The 403 error likely means your request doesn't match the sandbox's expected patterns. ` +
            `Solutions: 1) Check the Swagger model JSON for Orders API (v0) - look for "x-amzn-api-sandbox" → "static" array to find example request parameters, ` +
            `2) Use the exact parameters from the Swagger examples (e.g., CreatedAfter="TEST_CASE_200"), ` +
            `3) For sandbox, sellerId doesn't need to be valid but request must match sandbox patterns, ` +
            `4) Reference: https://developer-docs.amazon.com/sp-api/docs/sp-api-sandbox#sp-api-static-sandbox`
          );
        } else {
          throw new Error(
            `Failed to get orders: 403 Forbidden. ` +
            `This may indicate: 1) Seller ID "${sellerIdForLog}" doesn't match authenticated account, ` +
            `2) App missing required roles/permissions, ` +
            `3) Seller account doesn't have access to marketplace.`
          );
        }
      }
      
      throw new Error(`Failed to get orders: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get order by order ID
   * @param orderId - Amazon Order ID
   * @param sellerId - Optional seller ID to use seller-specific auth
   */
  async getOrder(orderId: string, sellerId?: string): Promise<any> {
    try {
      // Use seller-specific client if sellerId is provided and auth is initialized
      const client = this.getOrdersClientForSeller(sellerId || env.AMAZON_SELLER_ID);

      logger.info({ orderId }, 'Getting order by ID');

      const response = await client.getOrder({
        orderId,
      });

      logger.debug('Order retrieved successfully');
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message || error, orderId }, 'Error getting order');
      throw new Error(`Failed to get order: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get order items for a specific order
   * @param orderId - Amazon Order ID
   * @param nextToken - Token for pagination
   * @param sellerId - Optional seller ID to use seller-specific auth
   */
  async getOrderItems(orderId: string, nextToken?: string, sellerId?: string): Promise<any> {
    try {
      // Use seller-specific client if sellerId is provided and auth is initialized
      const client = this.getOrdersClientForSeller(sellerId || env.AMAZON_SELLER_ID);

      logger.info({ orderId, nextToken: nextToken ? 'provided' : 'not provided' }, 'Getting order items');

      // SDK expects camelCase parameter names
      const requestParams: any = {
        orderId,
      };

      if (nextToken) {
        requestParams.nextToken = nextToken;
      }

      const response = await client.getOrderItems(requestParams);

      logger.debug('Order items retrieved successfully');
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message || error, orderId }, 'Error getting order items');
      throw new Error(`Failed to get order items: ${error.message || 'Unknown error'}`);
    }
  }

  // ============================================
  // Inventory Operations
  // ============================================

  /**
   * Get inventory summaries for SKUs (FBA inventory)
   * @param marketplaceIds - Marketplace IDs (default: India)
   * @param sellerSkus - List of seller SKUs to get inventory for (optional - if not provided, returns all)
   * @param granularityType - Granularity type: 'Marketplace' or 'Warehouse' (default: 'Marketplace')
   * @param granularityId - Granularity ID (marketplace ID or warehouse ID)
   * @param details - Whether to include detailed inventory information (default: true)
   * @param startDateTime - Start date time for inventory query (ISO 8601 format)
   * @param sellerSkus - List of seller SKUs
   * @param nextToken - Token for pagination
   */
  async getInventorySummaries(
    marketplaceIds?: string[],
    sellerSkus?: string[],
    granularityType: 'Marketplace' | 'Warehouse' = 'Marketplace',
    granularityId?: string,
    details: boolean = true,
    startDateTime?: string,
    nextToken?: string,
    sellerId?: string
  ): Promise<any> {
    try {
      // Use seller-specific client if sellerId is provided and auth is initialized
      const client = this.getFbaInventoryClientForSeller(sellerId || env.AMAZON_SELLER_ID);
      const marketplaces = marketplaceIds || [this.DEFAULT_MARKETPLACE_ID];
      // granularityId is required - use first marketplace ID as default
      const granularity = granularityId || marketplaces[0];

      logger.info({ 
        marketplaces, 
        sellerSkus: sellerSkus ? sellerSkus.length : 'all',
        granularityType,
        granularityId: granularity,
        details
      }, 'Getting inventory summaries');

      // SDK expects camelCase parameter names
      // Required parameters: granularityType, granularityId, marketplaceIds
      const requestParams: any = {
        granularityType: granularityType as any, // SDK uses enum type
        granularityId: granularity,
        marketplaceIds: marketplaces,
        details,
      };

      if (sellerSkus && sellerSkus.length > 0) {
        requestParams.sellerSkus = sellerSkus;
      }
      if (startDateTime) {
        requestParams.startDateTime = startDateTime;
      }
      if (nextToken) {
        requestParams.nextToken = nextToken;
      }

      const response = await client.getInventorySummaries(requestParams);

      logger.debug('Inventory summaries retrieved successfully');
      return response.data;
    } catch (error: any) {
      logger.error({ error: error.message || error }, 'Error getting inventory summaries');
      throw new Error(`Failed to get inventory summaries: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Enrich listings items with inventory data
   * This method extracts inventory information from fulfillmentAvailability data in listings
   * and optionally supplements with FBA Inventory API for FBA products
   * @param listingsData - The listings data from searchListingsItems (should include fulfillmentAvailability)
   * @param marketplaceIds - Marketplace IDs
   * @returns Enriched listings data with inventory information
   */
  async enrichListingsWithInventory(
    listingsData: any,
    marketplaceIds?: string[]
  ): Promise<any> {
    try {
      if (!listingsData || !listingsData.items || !Array.isArray(listingsData.items)) {
        logger.warn('Invalid listings data structure for inventory enrichment');
        return listingsData;
      }

      const items = listingsData.items;

      if (items.length === 0) {
        logger.debug('No items found in listings data');
        return listingsData;
      }

      logger.info({ itemCount: items.length }, 'Enriching listings with inventory data from fulfillmentAvailability');

      // Extract inventory from fulfillmentAvailability data in listings
      const enrichedItems = items.map((item: any) => {
        // Check if fulfillmentAvailability is present in the item
        if (item.fulfillmentAvailability && Array.isArray(item.fulfillmentAvailability)) {
          // fulfillmentAvailability is an array of fulfillment options
          const fulfillmentOptions = item.fulfillmentAvailability;
          
          // Find the default or first fulfillment option
          const defaultFulfillment = fulfillmentOptions.find((f: any) => f.fulfillmentChannelCode === 'DEFAULT') || fulfillmentOptions[0];
          
          if (defaultFulfillment) {
            const fulfillmentChannelCode = defaultFulfillment.fulfillmentChannelCode || 'DEFAULT';
            const quantity = defaultFulfillment.quantity || 0;
            
            // Determine fulfillment method
            // DEFAULT usually means MFN (Merchant Fulfilled Network)
            // AFN (Amazon Fulfilled Network) would have fulfillmentChannelCode = 'AMAZON_NA' or similar
            let fulfilledBy = 'MFN';
            if (fulfillmentChannelCode === 'AMAZON_NA' || 
                fulfillmentChannelCode === 'AMAZON_EU' || 
                fulfillmentChannelCode === 'AMAZON_IN' ||
                fulfillmentChannelCode?.includes('AMAZON')) {
              fulfilledBy = 'AFN';
            } else if (fulfillmentChannelCode === 'DEFAULT') {
              fulfilledBy = 'MFN';
            }

            item.inventory = {
              fulfilledBy,
              quantity: quantity,
              fulfillmentChannelCode: fulfillmentChannelCode,
            };

            // If it's AFN, try to get additional details from FBA Inventory API
            if (fulfilledBy === 'AFN' && item.sku) {
              // We could fetch additional FBA details here, but for now use what we have
              logger.debug({ sku: item.sku, quantity }, 'AFN product with quantity from fulfillmentAvailability');
            }
          } else {
            // No fulfillment availability data found
            item.inventory = {
              fulfilledBy: 'MFN',
              quantity: 0,
              note: 'No fulfillment availability data found',
            };
          }
        } else {
          // No fulfillmentAvailability in response - try to get from FBA Inventory API as fallback
          // This handles cases where fulfillmentAvailability wasn't included in the request
          item.inventory = {
            fulfilledBy: 'MFN',
            quantity: null,
            note: 'Fulfillment availability not included in listings data. Try including fulfillmentAvailability in includedData.',
          };
        }
        
        return item;
      });

      return {
        ...listingsData,
        items: enrichedItems,
      };
    } catch (error: any) {
      logger.error({ error: error.message || error }, 'Error enriching listings with inventory');
      // Return original data if enrichment fails
      return listingsData;
    }
  }

  // ============================================
  // Phase 4: Product Operations (Write - Update Inventory)
  // ============================================

  /**
   * Update inventory quantity for a product by SKU
   * @param sellerId - Amazon Seller ID
   * @param sku - Product SKU
   * @param quantity - New quantity (absolute) or quantity to add/subtract (additive)
   * @param updateMode - 'absolute' (set to exact quantity) or 'additive' (add to existing quantity)
   * @param marketplaceIds - Marketplace IDs (default: India)
   * @param fulfillmentChannelCode - Fulfillment channel code (default: 'DEFAULT' for MFN)
   * @returns Updated listing item
   */
  async updateInventoryQuantity(
    sellerId: string,
    sku: string,
    quantity: number,
    updateMode: 'absolute' | 'additive' = 'additive',
    marketplaceIds?: string[],
    fulfillmentChannelCode: string = 'DEFAULT'
  ): Promise<any> {
    try {
      const client = this.getListingsClientForSeller(sellerId);
      const marketplaces = marketplaceIds || [this.DEFAULT_MARKETPLACE_ID];

      logger.info({ 
        sellerId, 
        sku, 
        quantity, 
        updateMode, 
        marketplaces,
        fulfillmentChannelCode 
      }, 'Updating inventory quantity');

      let finalQuantity = quantity;

      // If additive mode, get current quantity first
      if (updateMode === 'additive') {
        try {
          // Get current listing with fulfillmentAvailability
          const currentListing = await client.getListingsItem({
            sellerId,
            sku,
            marketplaceIds: marketplaces,
            includedData: ['fulfillmentAvailability'],
          });

          // Extract current quantity from fulfillmentAvailability
          const fulfillmentAvailability = currentListing.data?.fulfillmentAvailability;
          if (fulfillmentAvailability && Array.isArray(fulfillmentAvailability)) {
            const currentFulfillment = fulfillmentAvailability.find(
              (f: any) => f.fulfillmentChannelCode === fulfillmentChannelCode
            ) || fulfillmentAvailability[0];

            const currentQuantity = currentFulfillment?.quantity || 0;
            finalQuantity = currentQuantity + quantity;

            logger.info({ 
              sku, 
              currentQuantity, 
              quantityToAdd: quantity, 
              finalQuantity 
            }, 'Calculated additive quantity');
          } else {
            logger.warn({ sku }, 'No fulfillmentAvailability found, using provided quantity as absolute');
            // If no current data, treat as absolute update
            finalQuantity = quantity;
          }
        } catch (error: any) {
          logger.warn({ 
            error: error.message, 
            sku 
          }, 'Failed to get current quantity, using provided quantity as absolute');
          // If we can't get current quantity, treat as absolute update
          finalQuantity = quantity;
        }
      }

      // Get product type from current listing (required for PATCH)
      let productType = 'PRODUCT'; // Default fallback
      try {
        const currentListing = await client.getListingsItem({
          sellerId,
          sku,
          marketplaceIds: marketplaces,
          includedData: ['summaries'],
        });

        // Try to extract product type from summaries
        const summaries = currentListing.data?.summaries;
        if (summaries && Array.isArray(summaries) && summaries.length > 0) {
          productType = summaries[0]?.productType || 'PRODUCT';
        }
      } catch (error: any) {
        logger.warn({ error: error.message, sku }, 'Could not get product type, using default');
      }

      // Update inventory using PATCH
      const response = await client.patchListingsItem({
        sellerId,
        sku,
        marketplaceIds: marketplaces,
        body: {
          productType: productType,
          patches: [
            {
              op: 'replace',
              path: '/attributes/fulfillment_availability',
              value: [
                {
                  fulfillment_channel_code: fulfillmentChannelCode,
                  quantity: finalQuantity,
                },
              ],
            },
          ],
        },
      });

      logger.info({ 
        sku, 
        finalQuantity, 
        updateMode,
        fulfillmentChannelCode 
      }, 'Inventory quantity updated successfully');

      return {
        ...response.data,
        sku,
        quantity: finalQuantity,
        updateMode,
        fulfillmentChannelCode,
        previousQuantity: updateMode === 'additive' ? finalQuantity - quantity : undefined,
      };
    } catch (error: any) {
      logger.error({ 
        error: error.message || error, 
        sellerId, 
        sku, 
        quantity, 
        updateMode 
      }, 'Error updating inventory quantity');
      throw new Error(`Failed to update inventory quantity: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Refresh access token using refresh token (user-specific)
   * This method is kept for backward compatibility but now uses SDK
   * 
   * @param refreshToken - Refresh token from database
   * @returns Access token
   */
  async refreshAccessTokenForUser(refreshToken: string): Promise<string> {
    try {
      if (!refreshToken) {
        throw new Error('Refresh token is required');
      }

      // Create a temporary auth instance with the provided refresh token
      const tempAuth = new SellingPartnerApiAuth({
        clientId: env.AMAZON_CLIENT_ID!,
        clientSecret: env.AMAZON_CLIENT_SECRET!,
        refreshToken: refreshToken,
      });

      const accessToken = await tempAuth.getAccessToken();
      logger.info('Amazon access token refreshed successfully (via SDK)');
      return accessToken;
    } catch (error: any) {
      logger.error({ error: error.message || error }, 'Error refreshing Amazon access token');
      
      // Check if refresh token is expired/revoked
      if (error.message?.includes('invalid_grant') || error.message?.includes('REFRESH_TOKEN_EXPIRED')) {
        throw new Error('REFRESH_TOKEN_EXPIRED');
      }
      
      throw new Error(`Failed to refresh Amazon access token: ${error.message || 'Unknown error'}`);
    }
  }
}
