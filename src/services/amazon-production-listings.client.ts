import { env } from '../config/env.js';
import {
  AmazonAccessTokenProvider,
  AmazonAuthorizationError,
  amazonLwaTokenService,
} from './amazon-lwa-token.service.js';
import { AmazonApiTelemetryRecorder, amazonApiTelemetryService } from './amazon-api-telemetry.service.js';

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
    reservedQuantity?: {
      totalReservedQuantity?: number;
      pendingCustomerOrderQuantity?: number;
    };
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
  fulfillment?: {
    fulfillmentStatus?: string;
    fulfilledBy?: string;
    shipByWindow?: { earliestDateTime?: string; latestDateTime?: string };
  };
  orderItems?: Array<{
    orderItemId?: string;
    quantityOrdered?: number;
    quantityShipped?: number;
    fulfillment?: { quantityFulfilled?: number };
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
    cancellation?: {
      requester?: string;
      cancelReason?: string;
      cancellationRequest?: { requester?: string; cancelReason?: string };
    };
  }>;
};

export type AmazonOrdersPage = { orders: AmazonRawOrder[]; nextToken: string | null };

export type AmazonPackageDimensions = { length: number; width: number; height: number; unit: 'cm' };
export type AmazonPackageWeight = { value: number; unit: 'grams' | 'g' };
export type AmazonEasyShipTimeSlot = {
  slotId: string;
  startTime?: string | undefined;
  endTime?: string | undefined;
  handoverMethod?: 'PICKUP' | 'DROPOFF' | undefined;
};
export type AmazonEasyShipPackage = {
  scheduledPackageId?: { amazonOrderId?: string; packageId?: string };
  packageDimensions?: AmazonPackageDimensions;
  packageWeight?: AmazonPackageWeight;
  packageTimeSlot?: AmazonEasyShipTimeSlot;
  packageIdentifier?: string;
  packageStatus?: string;
  trackingDetails?: { trackingId?: string };
  invoice?: { invoiceNumber?: string; invoiceDate?: string };
};

export type AmazonNotificationSubscription = {
  subscriptionId: string;
  destinationId: string;
  payloadVersion: string;
};

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
  patchListingOffer?(input: {
    sellerSku: string;
    productType: string;
    patches: Array<{ op: 'replace' | 'merge'; path: string; value: Array<Record<string, unknown>> }>;
    validationPreview?: boolean;
  }): Promise<{ submissionId: string | null; status: string; issues: unknown[] }>;
  searchOrders?(input: {
    lastUpdatedAfter?: string;
    createdAfter?: string;
    paginationToken?: string;
  }): Promise<AmazonOrdersPage>;
  confirmShipment?(input: {
    orderId: string;
    marketplaceId: string;
    packageReferenceId: string;
    carrierCode: string;
    carrierName?: string;
    shippingMethod?: string;
    trackingNumber: string;
    shipDate: string;
    orderItems: Array<{ orderItemId: string; quantity: number }>;
  }): Promise<void>;
  listEasyShipHandoverSlots?(input: {
    orderId: string;
    marketplaceId: string;
    dimensions: AmazonPackageDimensions;
    weight: AmazonPackageWeight;
  }): Promise<AmazonEasyShipTimeSlot[]>;
  createEasyShipScheduledPackage?(input: {
    orderId: string;
    marketplaceId: string;
    dimensions: AmazonPackageDimensions;
    weight: AmazonPackageWeight;
    timeSlot: AmazonEasyShipTimeSlot;
    packageIdentifier?: string;
    orderItems: Array<{ orderItemId: string; serialNumbers?: string[] }>;
  }): Promise<AmazonEasyShipPackage>;
  getEasyShipScheduledPackage?(orderId: string): Promise<AmazonEasyShipPackage>;
  updateEasyShipScheduledPackage?(input: {
    orderId: string;
    marketplaceId: string;
    packageId: string;
    timeSlot: AmazonEasyShipTimeSlot;
  }): Promise<AmazonEasyShipPackage[]>;
  getNotificationSubscription?(notificationType: string, payloadVersion: string): Promise<AmazonNotificationSubscription | null>;
  createNotificationSubscription?(notificationType: string, payloadVersion: string, destinationId: string): Promise<AmazonNotificationSubscription>;
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
  requestTimeoutMs?: number;
  telemetryRecorder?: AmazonApiTelemetryRecorder | null;
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
  private readonly requestTimeoutMs: number;
  private readonly telemetryRecorder: AmazonApiTelemetryRecorder | null;

  constructor(options: AmazonProductionListingsClientOptions = {}) {
    this.accessTokenProvider = options.accessTokenProvider ?? amazonLwaTokenService;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.configuredBaseUrl = options.baseUrl;
    this.configuredSellerId = options.sellerId;
    this.configuredMarketplaceId = options.marketplaceId;
    this.configuredPageSize = options.pageSize;
    this.configuredMaxRetries = options.maxRetries;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    this.telemetryRecorder = options.telemetryRecorder === undefined
      ? (options.fetchImpl ? null : amazonApiTelemetryService)
      : options.telemetryRecorder;
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
    return this.patchListingOffer({
      sellerSku: input.sellerSku, productType: input.productType,
      patches: [{
        op: 'merge', path: '/attributes/fulfillment_availability',
        value: [{ fulfillment_channel_code: 'DEFAULT', quantity: input.quantity }],
      }],
    });
  }

  async patchListingOffer(input: {
    sellerSku: string;
    productType: string;
    patches: Array<{ op: 'replace' | 'merge'; path: string; value: Array<Record<string, unknown>> }>;
    validationPreview?: boolean;
  }): Promise<{ submissionId: string | null; status: string; issues: unknown[] }> {
    const response = await this.requestJson<{
      submissionId?: string;
      status?: string;
      issues?: unknown[];
    }>(
      'PATCH',
      `/listings/2021-08-01/items/${encodeURIComponent(this.getSellerId())}/${encodeURIComponent(input.sellerSku)}`,
      {
        marketplaceIds: this.getMarketplaceId(), includedData: 'issues', issueLocale: 'en_IN',
        ...(input.validationPreview ? { mode: 'VALIDATION_PREVIEW' } : {}),
      },
      {
        productType: input.productType,
        patches: input.patches,
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

  async confirmShipment(input: {
    orderId: string;
    marketplaceId: string;
    packageReferenceId: string;
    carrierCode: string;
    carrierName?: string;
    shippingMethod?: string;
    trackingNumber: string;
    shipDate: string;
    orderItems: Array<{ orderItemId: string; quantity: number }>;
  }): Promise<void> {
    await this.requestJson<void>('POST', `/orders/v0/orders/${encodeURIComponent(input.orderId)}/shipmentConfirmation`, {}, {
      marketplaceId: input.marketplaceId,
      packageDetail: {
        packageReferenceId: input.packageReferenceId,
        carrierCode: input.carrierCode,
        ...(input.carrierName ? { carrierName: input.carrierName } : {}),
        ...(input.shippingMethod ? { shippingMethod: input.shippingMethod } : {}),
        trackingNumber: input.trackingNumber,
        shipDate: input.shipDate,
        orderItems: input.orderItems,
      },
    });
  }

  async listEasyShipHandoverSlots(input: {
    orderId: string;
    marketplaceId: string;
    dimensions: AmazonPackageDimensions;
    weight: AmazonPackageWeight;
  }): Promise<AmazonEasyShipTimeSlot[]> {
    const response = await this.requestJson<{ timeSlots?: AmazonEasyShipTimeSlot[] }>('POST', '/easyShip/2022-03-23/timeSlot', {}, {
      amazonOrderId: input.orderId,
      marketplaceId: input.marketplaceId,
      packageDimensions: input.dimensions,
      packageWeight: input.weight,
    });
    return response.timeSlots ?? [];
  }

  async createEasyShipScheduledPackage(input: {
    orderId: string;
    marketplaceId: string;
    dimensions: AmazonPackageDimensions;
    weight: AmazonPackageWeight;
    timeSlot: AmazonEasyShipTimeSlot;
    packageIdentifier?: string;
    orderItems: Array<{ orderItemId: string; serialNumbers?: string[] }>;
  }): Promise<AmazonEasyShipPackage> {
    return this.requestJson<AmazonEasyShipPackage>('POST', '/easyShip/2022-03-23/package', {}, {
      amazonOrderId: input.orderId,
      marketplaceId: input.marketplaceId,
      packageDetails: {
        packageDimensions: input.dimensions,
        packageWeight: input.weight,
        packageTimeSlot: input.timeSlot,
        packageItems: input.orderItems.map((item) => ({
          orderItemId: item.orderItemId,
          ...(item.serialNumbers?.length ? { orderItemSerialNumbers: item.serialNumbers } : {}),
        })),
        ...(input.packageIdentifier ? { packageIdentifier: input.packageIdentifier } : {}),
      },
    });
  }

  async getEasyShipScheduledPackage(orderId: string): Promise<AmazonEasyShipPackage> {
    return this.getJson<AmazonEasyShipPackage>('/easyShip/2022-03-23/package', {
      amazonOrderId: orderId,
      marketplaceId: this.getMarketplaceId(),
    });
  }

  async updateEasyShipScheduledPackage(input: {
    orderId: string;
    marketplaceId: string;
    packageId: string;
    timeSlot: AmazonEasyShipTimeSlot;
  }): Promise<AmazonEasyShipPackage[]> {
    const response = await this.requestJson<{ packages?: AmazonEasyShipPackage[] }>('PATCH', '/easyShip/2022-03-23/package', {}, {
      marketplaceId: input.marketplaceId,
      updatePackageDetailsList: [{
        scheduledPackageId: { amazonOrderId: input.orderId, packageId: input.packageId },
        packageTimeSlot: input.timeSlot,
      }],
    });
    return response.packages ?? [];
  }

  async getNotificationSubscription(notificationType: string, payloadVersion: string): Promise<AmazonNotificationSubscription | null> {
    try {
      const response = await this.getJson<any>(
        `/notifications/v1/subscriptions/${encodeURIComponent(notificationType)}`,
        { payloadVersion }
      );
      const payload = response?.payload ?? response;
      if (!payload?.subscriptionId) return null;
      return {
        subscriptionId: String(payload.subscriptionId),
        destinationId: String(payload.destinationId ?? ''),
        payloadVersion: String(payload.payloadVersion ?? payloadVersion),
      };
    } catch (error) {
      if (error instanceof AmazonSpApiError && error.statusCode === 404) return null;
      throw error;
    }
  }

  async createNotificationSubscription(notificationType: string, payloadVersion: string, destinationId: string): Promise<AmazonNotificationSubscription> {
    const response = await this.requestJson<any>(
      'POST',
      `/notifications/v1/subscriptions/${encodeURIComponent(notificationType)}`,
      {},
      { payloadVersion, destinationId }
    );
    const payload = response?.payload ?? response;
    if (!payload?.subscriptionId) {
      throw new AmazonSpApiError('Amazon did not return a notification subscription ID', 502, 'AMAZON_NOTIFICATION_SUBSCRIPTION_INVALID');
    }
    return {
      subscriptionId: String(payload.subscriptionId),
      destinationId: String(payload.destinationId ?? destinationId),
      payloadVersion: String(payload.payloadVersion ?? payloadVersion),
    };
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
    method: 'GET' | 'POST' | 'PATCH' | 'PUT',
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
          signal: AbortSignal.timeout(this.requestTimeoutMs),
          headers: {
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            'x-amz-access-token': accessToken,
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        });

        if (this.telemetryRecorder) {
          await this.telemetryRecorder.record({
            sellerId: this.getSellerId(),
            marketplaceId: this.getMarketplaceId(),
            method,
            path,
            statusCode: response.status,
            rateLimit: response.headers.get('x-amzn-ratelimit-limit'),
            requestId: response.headers.get('x-amzn-requestid'),
            retryAfter: response.headers.get('retry-after'),
          }).catch(() => undefined);
        }

        if (response.ok) {
          if (response.status === 204) return undefined as T;
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
