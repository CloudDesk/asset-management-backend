import { env } from '../config/env.js';
import {
  AmazonAccessTokenProvider,
  AmazonAuthorizationError,
  amazonLwaTokenService,
} from './amazon-lwa-token.service.js';

type FetchLike = typeof fetch;

export type AmazonListingSummary = {
  marketplaceId?: string;
  asin?: string;
  productType?: string;
  itemName?: string;
  status?: string[] | string;
  statuses?: string[];
  lastUpdatedDate?: string;
};

export type AmazonListingOffer = {
  marketplaceId?: string;
  offerType?: string;
  price?: {
    currencyCode?: string;
    amount?: string | number;
  };
};

export type AmazonFulfilmentAvailability = {
  fulfillmentChannelCode?: string;
  quantity?: number;
};

export type AmazonRawListing = {
  sku?: string;
  summaries?: AmazonListingSummary[];
  offers?: AmazonListingOffer[];
  fulfillmentAvailability?: AmazonFulfilmentAvailability[];
  productTypes?: Array<{
    marketplaceId?: string;
    productType?: string;
  }>;
  attributes?: Record<string, unknown>;
};

export type AmazonFbaInventorySummary = {
  asin?: string;
  fnSku?: string;
  sellerSku?: string;
  productName?: string;
  lastUpdatedTime?: string;
  totalQuantity?: number;
  inventoryDetails?: {
    fulfillableQuantity?: number;
  };
};

export type AmazonListingsPage = {
  items: AmazonRawListing[];
  nextToken: string | null;
};

export type AmazonFbaInventoryPage = {
  items: AmazonFbaInventorySummary[];
  nextToken: string | null;
};

export type AmazonRawOrder = {
  orderId?: string;
  createdTime?: string;
  lastUpdatedTime?: string;
  programs?: string[];
  salesChannel?: { marketplaceId?: string };
  fulfillment?: { fulfillmentStatus?: string; fulfilledBy?: string };
  orderItems?: Array<{
    orderItemId?: string;
    quantityOrdered?: number;
    quantityShipped?: number;
    product?: {
      sellerSku?: string;
      asin?: string;
      title?: string;
      price?: {
        unitPrice?: {
          amount?: string;
          currencyCode?: string;
        };
      };
    };
    cancellation?: unknown;
  }>;
};

export type AmazonOrdersPage = { orders: AmazonRawOrder[]; nextToken: string | null };

type SearchListingsResponse = {
  items?: AmazonRawListing[];
  pagination?: {
    nextToken?: string;
  };
};

type FbaInventoryResponse = {
  payload?: {
    inventorySummaries?: AmazonFbaInventorySummary[];
    pagination?: {
      nextToken?: string;
    };
  };
};

export class AmazonSpApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = 'AmazonSpApiError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface AmazonListingsReadClient {
  getSellerId(): string;
  getMarketplaceId(): string;
  fetchListingsPage(pageToken?: string): Promise<AmazonListingsPage>;
  fetchFbaInventoryPage(nextToken?: string): Promise<AmazonFbaInventoryPage>;
  fetchListing?(sellerSku: string): Promise<AmazonRawListing>;
  patchMfnQuantity?(input: {
    sellerSku: string;
    productType: string;
    quantity: number;
  }): Promise<{ submissionId: string | null; status: string; issues: unknown[] }>;
  searchOrders?(input: {
    lastUpdatedAfter?: string;
    createdAfter?: string;
    paginationToken?: string;
  }): Promise<AmazonOrdersPage>;
}

type AmazonProductionListingsClientOptions = {
  accessTokenProvider?: AmazonAccessTokenProvider;
  fetchImpl?: FetchLike;
  sleep?: (milliseconds: number) => Promise<void>;
  baseUrl?: string;
  sellerId?: string;
  marketplaceId?: string;
  pageSize?: number;
  maxRetries?: number;
};

export class AmazonProductionListingsClient implements AmazonListingsReadClient {
  private readonly accessTokenProvider: AmazonAccessTokenProvider;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly configuredBaseUrl: string | undefined;
  private readonly configuredSellerId: string | undefined;
  private readonly configuredMarketplaceId: string | undefined;
  private readonly configuredPageSize: number | undefined;
  private readonly configuredMaxRetries: number | undefined;

  constructor(options: AmazonProductionListingsClientOptions = {}) {
    this.accessTokenProvider = options.accessTokenProvider ?? amazonLwaTokenService;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.configuredBaseUrl = options.baseUrl;
    this.configuredSellerId = options.sellerId;
    this.configuredMarketplaceId = options.marketplaceId;
    this.configuredPageSize = options.pageSize;
    this.configuredMaxRetries = options.maxRetries;
  }

  getSellerId(): string {
    return this.requiredConfig('AMAZON_SELLER_ID', this.configuredSellerId ?? env.AMAZON_SELLER_ID);
  }

  getMarketplaceId(): string {
    return this.requiredConfig(
      'AMAZON_MARKETPLACE_ID',
      this.configuredMarketplaceId ?? env.AMAZON_MARKETPLACE_ID
    );
  }

  async fetchListingsPage(pageToken?: string): Promise<AmazonListingsPage> {
    const sellerId = this.getSellerId();
    const marketplaceId = this.getMarketplaceId();
    const payload = await this.getJson<SearchListingsResponse>(
      `/listings/2021-08-01/items/${encodeURIComponent(sellerId)}`,
      {
        marketplaceIds: marketplaceId,
        includedData: 'summaries,offers,fulfillmentAvailability,productTypes,attributes',
        pageSize: String(this.configuredPageSize ?? env.AMAZON_LISTING_IMPORT_PAGE_SIZE),
        ...(pageToken ? { pageToken } : {}),
      }
    );

    return {
      items: payload.items ?? [],
      nextToken: payload.pagination?.nextToken ?? null,
    };
  }

  async fetchFbaInventoryPage(nextToken?: string): Promise<AmazonFbaInventoryPage> {
    const marketplaceId = this.getMarketplaceId();
    const payload = await this.getJson<FbaInventoryResponse>(
      '/fba/inventory/v1/summaries',
      {
        details: 'true',
        granularityType: 'Marketplace',
        granularityId: marketplaceId,
        marketplaceIds: marketplaceId,
        ...(nextToken ? { nextToken } : {}),
      }
    );

    return {
      items: payload.payload?.inventorySummaries ?? [],
      nextToken: payload.payload?.pagination?.nextToken ?? null,
    };
  }

  async fetchListing(sellerSku: string): Promise<AmazonRawListing> {
    return this.getJson<AmazonRawListing>(
      `/listings/2021-08-01/items/${encodeURIComponent(this.getSellerId())}/${encodeURIComponent(sellerSku)}`,
      {
        marketplaceIds: this.getMarketplaceId(),
        includedData: 'summaries,offers,fulfillmentAvailability,productTypes,attributes',
      }
    );
  }

  async patchMfnQuantity(input: {
    sellerSku: string;
    productType: string;
    quantity: number;
  }): Promise<{ submissionId: string | null; status: string; issues: unknown[] }> {
    const response = await this.requestJson<{
      submissionId?: string;
      status?: string;
      issues?: unknown[];
    }>(
      'PATCH',
      `/listings/2021-08-01/items/${encodeURIComponent(this.getSellerId())}/${encodeURIComponent(input.sellerSku)}`,
      { marketplaceIds: this.getMarketplaceId(), includedData: 'issues' },
      {
        productType: input.productType,
        patches: [{
          op: 'merge',
          path: '/attributes/fulfillment_availability',
          value: [{ fulfillment_channel_code: 'DEFAULT', quantity: input.quantity }],
        }],
      }
    );
    return {
      submissionId: response.submissionId ?? null,
      status: response.status ?? 'UNKNOWN',
      issues: response.issues ?? [],
    };
  }

  async searchOrders(input: {
    lastUpdatedAfter?: string;
    createdAfter?: string;
    paginationToken?: string;
  }): Promise<AmazonOrdersPage> {
    if (!input.lastUpdatedAfter && !input.createdAfter) {
      throw new AmazonSpApiError(
        'An Amazon order search start date is required',
        400,
        'AMAZON_ORDER_SEARCH_DATE_REQUIRED'
      );
    }
    const response = await this.getJson<{
      orders?: AmazonRawOrder[];
      pagination?: { nextToken?: string };
    }>('/orders/2026-01-01/orders', {
      marketplaceIds: this.getMarketplaceId(),
      ...(input.createdAfter
        ? { createdAfter: input.createdAfter }
        : { lastUpdatedAfter: input.lastUpdatedAfter! }),
      maxResultsPerPage: '100',
      includedData: 'FULFILLMENT,CANCELLATION',
      ...(input.paginationToken ? { paginationToken: input.paginationToken } : {}),
    });
    return { orders: response.orders ?? [], nextToken: response.pagination?.nextToken ?? null };
  }

  private requiredConfig(name: string, value?: string): string {
    const normalized = value?.trim();
    if (!normalized) {
      throw new AmazonSpApiError(`${name} is not configured on the backend`, 503, 'AMAZON_CONFIGURATION_ERROR');
    }
    return normalized;
  }

  private getProductionBaseUrl(): string {
    const configured = this.requiredConfig(
      'AMAZON_PRODUCTION_SP_API_BASE_URL',
      this.configuredBaseUrl ?? env.AMAZON_PRODUCTION_SP_API_BASE_URL
    ).replace(/\/$/, '');
    const parsed = new URL(configured);

    if (parsed.protocol !== 'https:' || parsed.hostname !== 'sellingpartnerapi-eu.amazon.com') {
      throw new AmazonSpApiError(
        'Amazon production listing importer refused an unexpected SP-API endpoint',
        503,
        'AMAZON_ENDPOINT_REJECTED'
      );
    }

    return configured;
  }

  private async getJson<T>(path: string, query: Record<string, string>): Promise<T> {
    return this.requestJson<T>('GET', path, query);
  }

  private async requestJson<T>(
    method: 'GET' | 'PATCH',
    path: string,
    query: Record<string, string>,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = new URL(`${this.getProductionBaseUrl()}${path}`);
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }

    const maxRetries = this.configuredMaxRetries ?? env.AMAZON_LISTING_IMPORT_MAX_RETRIES;
    let lastNetworkError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const accessToken = await this.accessTokenProvider.getAccessToken();
        const response = await this.fetchImpl(url, {
          method,
          headers: {
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            'x-amz-access-token': accessToken,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });

        if (response.ok) {
          return await response.json() as T;
        }

        if (response.status === 401 || response.status === 403) {
          this.accessTokenProvider.invalidate();
          throw new AmazonAuthorizationError();
        }

        const retryable = response.status === 429 || response.status === 500 || response.status === 503;
        if (retryable && attempt < maxRetries) {
          await this.sleep(this.retryDelayMilliseconds(response.headers.get('retry-after'), attempt));
          continue;
        }

        throw new AmazonSpApiError(
          'Amazon SP-API listing request failed',
          response.status >= 400 && response.status < 600 ? response.status : 502,
          retryable ? 'AMAZON_RETRY_EXHAUSTED' : 'AMAZON_REQUEST_FAILED'
        );
      } catch (error) {
        if (error instanceof AmazonAuthorizationError || error instanceof AmazonSpApiError) {
          throw error;
        }

        lastNetworkError = error;
        if (attempt < maxRetries) {
          await this.sleep(this.retryDelayMilliseconds(null, attempt));
          continue;
        }
      }
    }

    throw new AmazonSpApiError(
      lastNetworkError ? 'Amazon SP-API could not be reached' : 'Amazon SP-API request failed',
      502,
      'AMAZON_NETWORK_ERROR'
    );
  }

  private retryDelayMilliseconds(retryAfter: string | null, attempt: number): number {
    if (retryAfter) {
      const seconds = Number.parseFloat(retryAfter);
      if (Number.isFinite(seconds)) {
        return Math.min(Math.max(seconds * 1000, 0), 30_000);
      }

      const dateDelay = Date.parse(retryAfter) - Date.now();
      if (Number.isFinite(dateDelay) && dateDelay > 0) {
        return Math.min(dateDelay, 30_000);
      }
    }

    return Math.min(500 * (2 ** attempt), 10_000);
  }
}

export const amazonProductionListingsClient = new AmazonProductionListingsClient();
