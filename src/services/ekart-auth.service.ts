import axios, { AxiosInstance } from 'axios';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

interface TokenCache {
  access_token: string | null;
  token_type: string;
  expires_at: number | null;
}

interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string; // "core:all"
}

export class EkartAuthService {
  private clientId: string;
  private username: string;
  private password: string;
  private baseURL: string;
  private tokenCache: TokenCache;
  private bufferTime: number = 60 * 60 * 1000; // 1 hour buffer

  constructor() {
    this.clientId = env.EKART_CLIENT_ID || '';
    this.username = env.EKART_USERNAME || '';
    this.password = env.EKART_PASSWORD || '';
    this.baseURL = env.EKART_BASE_URL || 'https://app.elite.ekartlogistics.in/api';

    // Validate credentials
    if (!this.clientId || !this.username || !this.password) {
      const missingVars = [];
      if (!this.clientId) missingVars.push('EKART_CLIENT_ID');
      if (!this.username) missingVars.push('EKART_USERNAME');
      if (!this.password) missingVars.push('EKART_PASSWORD');

      logger.warn(
        { missingVars },
        'Ekart credentials not fully configured. Some features may not work.'
      );
    }

    // Initialize token cache
    this.tokenCache = {
      access_token: null,
      token_type: 'Bearer',
      expires_at: null
    };

    logger.info('EkartAuthService initialized');
  }

  /**
   * Step 1: Initial connection to get token
   * Call this once at startup or when token expires
   */
  async connect(): Promise<TokenCache> {
    try {
      if (!this.clientId || !this.username || !this.password) {
        throw new Error(
          'Ekart credentials not configured. Please set EKART_CLIENT_ID, EKART_USERNAME, and EKART_PASSWORD in environment variables.'
        );
      }

      logger.info({ clientId: this.clientId }, 'Connecting to Ekart API...');

      // Use client ID as-is from environment (including EKART_ prefix if present)
      // Correct endpoint format: /integrations/v2/auth/token/{client_id}
      // Reference: https://app.elite.ekartlogistics.in/api/docs#operation/get_access_token_v2
      const authUrl = `https://app.elite.ekartlogistics.in/integrations/v2/auth/token/${this.clientId}`;
      
      logger.info({ 
        authUrl, 
        clientId: this.clientId
      }, 'Attempting authentication with official endpoint...');

      const response = await axios.post<AuthResponse>(
        authUrl,
        {
          username: this.username,
          password: this.password
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.data.access_token) {
        throw new Error('Invalid response from Ekart auth API');
      }

      // Store token with expiry
      this.tokenCache = {
        access_token: response.data.access_token,
        token_type: response.data.token_type || 'Bearer',
        expires_at: Date.now() + (response.data.expires_in * 1000)
      };

      logger.info(
        {
          expiresIn: response.data.expires_in,
          tokenType: this.tokenCache.token_type
        },
        '✅ Connected to Ekart. Token obtained successfully'
      );

      return this.tokenCache;
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          status: error.response?.status,
          data: error.response?.data
        },
        '❌ Ekart connection failed'
      );

      if (error.response?.status === 401) {
        throw new Error('Invalid Ekart credentials. Please check EKART_USERNAME and EKART_PASSWORD.');
      }

      if (error.response?.status === 404) {
        const attemptedUrl = `https://app.elite.ekartlogistics.in/integrations/v2/auth/token/${this.clientId}`;
        throw new Error(
          `Ekart authentication endpoint not found (404). ` +
          `Attempted URL: ${attemptedUrl}. ` +
          `Please verify: 1) EKART_CLIENT_ID is correct (use the exact value provided by Ekart), ` +
          `2) Your Ekart account has API access enabled, ` +
          `3) Client ID format matches what Ekart provided during onboarding. ` +
          `Official docs: https://app.elite.ekartlogistics.in/api/docs#operation/get_access_token_v2 ` +
          `Original error: ${error.response?.data?.description || error.message}`
        );
      }

      throw new Error(
        `Failed to connect to Ekart: ${error.message || 'Unknown error'}`
      );
    }
  }

  /**
   * Step 2: Get valid token (auto-refresh if needed)
   * This is called automatically before each API request
   */
  async getValidToken(): Promise<string> {
    const now = Date.now();

    // Check if token exists and is still valid (with buffer time)
    if (
      this.tokenCache.access_token &&
      this.tokenCache.expires_at &&
      (this.tokenCache.expires_at - this.bufferTime) > now
    ) {
      logger.debug('Using cached Ekart token');
      return this.tokenCache.access_token;
    }

    // Token expired or doesn't exist - reconnect
    logger.info('🔄 Token expired or missing. Reconnecting to Ekart...');
    await this.connect();
    return this.tokenCache.access_token!;
  }

  /**
   * Force token refresh
   */
  async refreshToken(): Promise<TokenCache> {
    logger.info('Force refreshing Ekart token...');
    return this.connect();
  }

  /**
   * Get authorization header
   */
  async getAuthHeader(): Promise<string> {
    const token = await this.getValidToken();
    return `${this.tokenCache.token_type} ${token}`;
  }

  /**
   * Check if token is valid
   */
  isTokenValid(): boolean {
    if (!this.tokenCache.access_token || !this.tokenCache.expires_at) {
      return false;
    }

    const now = Date.now();
    return (this.tokenCache.expires_at - this.bufferTime) > now;
  }

  /**
   * Get token expiry info
   */
  getTokenInfo(): { expiresAt: number | null; isValid: boolean; expiresIn: number | null } {
    const now = Date.now();
    const expiresAt = this.tokenCache.expires_at;
    const isValid = this.isTokenValid();
    const expiresIn = expiresAt ? Math.max(0, Math.floor((expiresAt - now) / 1000)) : null;

    return {
      expiresAt,
      isValid,
      expiresIn
    };
  }
}

// Export singleton instance
export const ekartAuthService = new EkartAuthService();

