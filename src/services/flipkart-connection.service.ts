import { env } from '../config/env.js';
import { prisma } from '../models/prisma.js';

type FetchLike = typeof fetch;

type FlipkartTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

type FlipkartListingSearchResponse = {
  listingData?: Array<{ sellerId?: string }>;
};

export type FlipkartConnectionResult = {
  connected: true;
  environment: 'SANDBOX' | 'PRODUCTION';
  sellerId: string | null;
  sellerIdSource: 'CONFIGURATION' | 'LISTING_DISCOVERY' | 'NOT_DISCOVERED';
  tokenType: string;
  scope: string | null;
  expiresInSeconds: number;
  inventoryWritesEnabled: boolean;
};

export class FlipkartConnectionError extends Error {
  constructor(
    message: string,
    readonly statusCode = 502,
    readonly code = 'FLIPKART_CONNECTION_ERROR'
  ) {
    super(message);
    this.name = 'FlipkartConnectionError';
  }
}

type FlipkartConnectionServiceOptions = {
  fetchImpl?: FetchLike;
  appId?: string;
  appSecret?: string;
  sellerId?: string;
  environment?: 'SANDBOX' | 'PRODUCTION';
  apiBaseUrl?: string;
  inventoryWritesEnabled?: boolean;
  now?: () => number;
};

const required = (name: string, value?: string): string => {
  const normalized = value?.trim();
  if (!normalized) {
    throw new FlipkartConnectionError(
      `${name} is not configured`,
      503,
      'FLIPKART_NOT_CONFIGURED'
    );
  }
  return normalized;
};

const LISTING_STATES = [
  'ACTIVE',
  'INACTIVE',
  'READY_FOR_ACTIVATION',
  'INACTIVATED_BY_FLIPKART',
  'ARCHIVED',
] as const;

export type FlipkartSavedConnection = {
  status: 'CONNECTED' | 'FAILED';
  sellerId: string | null;
  lastAuthenticatedAt: string | null;
  tokenExpiresAt: string | null;
  lastCheckedAt: string;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
};

export class FlipkartConnectionService {
  private readonly fetchImpl: FetchLike;
  private readonly options: FlipkartConnectionServiceOptions;
  private readonly now: () => number;
  private cachedToken: { value: string; expiresAt: number; metadata: FlipkartTokenResponse } | null = null;

  constructor(options: FlipkartConnectionServiceOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.options = options;
    this.now = options.now ?? Date.now;
  }

  configurationStatus() {
    const missingConfiguration = [
      [this.options.appId ?? env.FLIPKART_APP_ID, 'FLIPKART_APP_ID'],
      [this.options.appSecret ?? env.FLIPKART_APP_SECRET, 'FLIPKART_APP_SECRET'],
    ].filter(([value]) => !value?.trim()).map(([, name]) => name as string);

    return {
      status: missingConfiguration.length === 0 ? 'CONFIGURED' as const : 'INCOMPLETE' as const,
      environment: this.options.environment ?? env.FLIPKART_ENVIRONMENT,
      sellerId: (this.options.sellerId ?? env.FLIPKART_SELLER_ID)?.trim() || null,
      sellerIdRequired: false,
      connectionType: 'SELF_ACCESS' as const,
      mockMode: env.FLIPKART_MOCK_MODE,
      inventoryWritesEnabled: this.options.inventoryWritesEnabled ?? env.FLIPKART_INVENTORY_WRITES_ENABLED,
      missingConfiguration,
    };
  }

  async testConnection(): Promise<FlipkartConnectionResult> {
    const token = await this.getAccessToken();
    const configuredSellerId = (this.options.sellerId ?? env.FLIPKART_SELLER_ID)?.trim();
    const discoveredSellerId = configuredSellerId ? null : await this.discoverSellerId(token.value);

    return {
      connected: true,
      environment: this.options.environment ?? env.FLIPKART_ENVIRONMENT,
      sellerId: configuredSellerId || discoveredSellerId,
      sellerIdSource: configuredSellerId
        ? 'CONFIGURATION'
        : discoveredSellerId
          ? 'LISTING_DISCOVERY'
          : 'NOT_DISCOVERED',
      tokenType: token.metadata.token_type?.trim() || 'bearer',
      scope: token.metadata.scope?.trim() || null,
      expiresInSeconds: Math.max(0, Math.trunc(token.metadata.expires_in ?? 0)),
      inventoryWritesEnabled: this.options.inventoryWritesEnabled ?? env.FLIPKART_INVENTORY_WRITES_ENABLED,
    };
  }

  // Last saved "Test connection" result for the configured environment (FKT-PLAN-01).
  async savedConnection(): Promise<FlipkartSavedConnection | null> {
    const row = await prisma.flipkartConnection.findUnique({
      where: { environment_connectionType: { environment: this.options.environment ?? env.FLIPKART_ENVIRONMENT, connectionType: 'SELF_ACCESS' } },
    });
    if (!row) return null;
    return {
      status: row.status === 'CONNECTED' ? 'CONNECTED' : 'FAILED',
      sellerId: row.sellerId,
      lastAuthenticatedAt: row.lastAuthenticatedAt?.toISOString() ?? null,
      tokenExpiresAt: row.tokenExpiresAt?.toISOString() ?? null,
      lastCheckedAt: row.updatedAt.toISOString(),
      lastErrorCode: row.lastErrorCode,
      lastErrorMessage: row.lastErrorMessage,
    };
  }

  // Runs the connection test and keeps the outcome, so the Overview can show it
  // without calling Flipkart on every page load. Errors are saved and re-thrown.
  async testAndSave(): Promise<FlipkartConnectionResult> {
    const environment = this.options.environment ?? env.FLIPKART_ENVIRONMENT;
    const where = { environment_connectionType: { environment, connectionType: 'SELF_ACCESS' } };
    try {
      const result = await this.testConnection();
      const now = new Date(this.now());
      const data = {
        status: 'CONNECTED',
        lastAuthenticatedAt: now,
        tokenExpiresAt: new Date(now.getTime() + result.expiresInSeconds * 1000),
        lastErrorCode: null,
        lastErrorMessage: null,
        ...(result.sellerId ? { sellerId: result.sellerId } : {}),
      };
      await prisma.flipkartConnection.upsert({ where, create: { environment, connectionType: 'SELF_ACCESS', ...data }, update: data });
      return result;
    } catch (error) {
      const data = {
        status: 'FAILED',
        lastErrorCode: error instanceof FlipkartConnectionError ? error.code : 'FLIPKART_CONNECTION_ERROR',
        lastErrorMessage: error instanceof Error ? error.message : 'Flipkart connection test failed',
      };
      await prisma.flipkartConnection.upsert({ where, create: { environment, connectionType: 'SELF_ACCESS', ...data }, update: data });
      throw error;
    }
  }

  // Bearer token for Seller API calls (cached until a minute before expiry)
  async accessToken(): Promise<string> {
    return (await this.getAccessToken()).value;
  }

  private async getAccessToken() {
    if (this.cachedToken && this.cachedToken.expiresAt - 60_000 > this.now()) {
      return this.cachedToken;
    }

    const appId = required('FLIPKART_APP_ID', this.options.appId ?? env.FLIPKART_APP_ID);
    const appSecret = required('FLIPKART_APP_SECRET', this.options.appSecret ?? env.FLIPKART_APP_SECRET);
    const baseUrl = this.options.apiBaseUrl ?? env.FLIPKART_API_BASE_URL;
    const url = new URL('/oauth-service/oauth/token', baseUrl);
    url.searchParams.set('grant_type', 'client_credentials');
    url.searchParams.set('scope', 'Seller_Api');

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
          Accept: 'application/json',
        },
      });
    } catch {
      throw new FlipkartConnectionError(
        'Could not reach Flipkart authentication service',
        502,
        'FLIPKART_AUTH_UNREACHABLE'
      );
    }

    if (!response.ok) {
      throw new FlipkartConnectionError(
        response.status === 401 || response.status === 403
          ? 'Flipkart App ID or App Secret is invalid'
          : 'Flipkart authentication service rejected the connection',
        response.status === 401 || response.status === 403 ? 401 : 502,
        'FLIPKART_AUTHENTICATION_FAILED'
      );
    }

    const metadata = await response.json() as FlipkartTokenResponse;
    const value = metadata.access_token?.trim();
    if (!value) {
      throw new FlipkartConnectionError(
        'Flipkart authentication response did not contain an access token',
        502,
        'FLIPKART_TOKEN_MISSING'
      );
    }

    const expiresInSeconds = Math.max(0, Math.trunc(metadata.expires_in ?? 0));
    this.cachedToken = {
      value,
      expiresAt: this.now() + expiresInSeconds * 1000,
      metadata,
    };
    return this.cachedToken;
  }

  private async discoverSellerId(accessToken: string): Promise<string | null> {
    const baseUrl = this.options.apiBaseUrl ?? env.FLIPKART_API_BASE_URL;
    const url = new URL('/listings/v3/product/search', baseUrl);

    for (const internalState of LISTING_STATES) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ batchNo: 0, internalState }),
        });
      } catch {
        throw new FlipkartConnectionError(
          'Authenticated with Flipkart, but listing discovery could not be reached',
          502,
          'FLIPKART_LISTING_DISCOVERY_UNREACHABLE'
        );
      }

      if (!response.ok) {
        throw new FlipkartConnectionError(
          response.status === 401 || response.status === 403
            ? 'Flipkart token was rejected by the Listing API'
            : 'Flipkart Listing API rejected seller discovery',
          response.status === 401 || response.status === 403 ? 401 : 502,
          'FLIPKART_LISTING_DISCOVERY_FAILED'
        );
      }

      const payload = await response.json() as FlipkartListingSearchResponse;
      const sellerId = payload.listingData
        ?.map((listing) => listing.sellerId?.trim())
        .find((value): value is string => Boolean(value));
      if (sellerId) return sellerId;
    }

    return null;
  }
}

export const flipkartConnectionService = new FlipkartConnectionService();
