import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { flipkartConnectionService } from './flipkart-connection.service.js';

export type FlipkartListingState =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'READY_FOR_ACTIVATION'
  | 'ARCHIVED'
  | 'INACTIVATED_BY_FLIPKART';

export type FlipkartListingLocation = {
  id: string;
  // Mock data uses ACTIVE / INACTIVE; the live API returns ENABLED / DISABLED
  status: string;
  inventory: number;
};

export type FlipkartListing = {
  listingId: string;
  sellerId: string;
  productId: string;
  sku: string;
  status: FlipkartListingState;
  productName: string;
  vertical: string;
  mrp: number;
  sellingPrice: number;
  locations: FlipkartListingLocation[];
  // Live listing details (FKT-PLAN-02); absent in mock data
  fulfilmentProfile?: string | null;
  shippingProvider?: string | null;
  procurementType?: string | null;
  hsn?: string | null;
  taxCode?: string | null;
  productUrl?: string | null;
  imageUrl?: string | null;
  raw?: unknown;
};

export type FlipkartListingPage = {
  items: FlipkartListing[];
  page: number;
  hasMore: boolean;
};

export type FlipkartInventoryUpdateItem = {
  sku: string;
  productId: string;
  locations: Array<{ id: string; inventory: number }>;
};

export type FlipkartInventoryUpdateResult = {
  requestId: string;
  results: Array<{
    sku: string;
    status: 'SUCCESS' | 'FAILURE';
    errors: Array<{ code: string; description: string; path?: string }>;
  }>;
};

export type FlipkartShipmentItem = {
  orderItemId: string;
  orderId: string;
  listingId: string;
  sku: string;
  fsn: string;
  title: string;
  quantity: number;
  sellingPrice: number;
  currency: string;
};

export type FlipkartShipment = {
  shipmentId: string;
  sellerId: string;
  locationId: string;
  fulfilmentType: 'STANDARD' | 'SELF_SHIP';
  status: 'APPROVED' | 'PACKED' | 'READY_TO_DISPATCH' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  hold: boolean;
  orderDate: string;
  dispatchAfterDate: string;
  dispatchByDate: string;
  buyerName: string;
  buyerAddress: { addressLine1: string; city: string; state: string; pincode: string };
  trackingId?: string;
  deliveryPartner?: string;
  items: FlipkartShipmentItem[];
};

export type FlipkartShipmentActionResult = {
  requestId: string;
  shipmentId: string;
  processingStatus: 'SUCCESS' | 'FAILURE';
  status: FlipkartShipment['status'];
  errorCode?: string;
  errorMessage?: string;
  trackingId?: string;
};

export type FlipkartTrackingSnapshot = {
  shipmentId: string;
  status: FlipkartShipment['status'];
  trackingId: string | null;
  deliveryPartner: string | null;
  events: Array<{ id: string; code: string; status: string; description: string; location?: string; eventTime: string }>;
};

export interface FlipkartSellerApiClient {
  readonly mode: 'MOCK' | 'PRODUCTION';
  searchListings(input: { state: FlipkartListingState; page: number }): Promise<FlipkartListingPage>;
  updateInventory(items: FlipkartInventoryUpdateItem[]): Promise<FlipkartInventoryUpdateResult>;
  searchShipments(): Promise<FlipkartShipment[]>;
  packShipment(input: { shipmentId: string; locationId: string; invoiceNumber: string; invoiceDate: string }): Promise<FlipkartShipmentActionResult>;
  dispatchShipment(input: { shipmentId: string; locationId: string }): Promise<FlipkartShipmentActionResult>;
  selfShipDispatch(input: { shipmentId: string; locationId: string; invoiceNumber: string; invoiceDate: string; deliveryPartner: string; deliveryPartnerCode: string; trackingId: string; tentativeDeliveryDate: string }): Promise<FlipkartShipmentActionResult>;
  markSelfShipDelivered(input: { shipmentId: string; locationId: string; deliveryDate: string }): Promise<FlipkartShipmentActionResult>;
  cancelShipment(input: { shipmentId: string; reason: string }): Promise<FlipkartShipmentActionResult>;
  getTracking(shipmentId: string): Promise<FlipkartTrackingSnapshot>;
}

export const MOCK_FLIPKART_LISTINGS: FlipkartListing[] = [
  {
    listingId: 'LST-NIVAANA-INCENSE-001',
    sellerId: 'MOCK-NIVAANA-SELLER',
    productId: 'FKP-NIVAANA-0001',
    sku: 'NV-MOCK-INCENSE-001',
    status: 'ACTIVE',
    productName: 'Nivaana Premium Incense Sticks',
    vertical: 'Incense Stick',
    mrp: 499,
    sellingPrice: 399,
    locations: [{ id: 'LOC-MOCK-BLR-01', status: 'ACTIVE', inventory: 12 }],
  },
  {
    listingId: 'LST-NIVAANA-CANDLE-002',
    sellerId: 'MOCK-NIVAANA-SELLER',
    productId: 'FKP-NIVAANA-0002',
    sku: 'NV-MOCK-CANDLE-002',
    status: 'ACTIVE',
    productName: 'Nivaana Aromatherapy Candle',
    vertical: 'Candle',
    mrp: 799,
    sellingPrice: 649,
    locations: [{ id: 'LOC-MOCK-BLR-01', status: 'ACTIVE', inventory: 5 }],
  },
  {
    listingId: 'LST-NIVAANA-DIFFUSER-003',
    sellerId: 'MOCK-NIVAANA-SELLER',
    productId: 'FKP-NIVAANA-0003',
    sku: 'NV-MOCK-DIFFUSER-003',
    status: 'INACTIVE',
    productName: 'Nivaana Reed Diffuser',
    vertical: 'Home Fragrance',
    mrp: 999,
    sellingPrice: 849,
    locations: [{ id: 'LOC-MOCK-BLR-01', status: 'INACTIVE', inventory: 0 }],
  },
];

const mockNow = Date.now();
export const MOCK_FLIPKART_SHIPMENTS: FlipkartShipment[] = [
  {
    shipmentId: 'FKS-MOCK-1001', sellerId: 'MOCK-NIVAANA-SELLER', locationId: 'LOC-MOCK-BLR-01',
    fulfilmentType: 'STANDARD', status: 'APPROVED', hold: false,
    orderDate: new Date(mockNow - 4 * 60 * 60 * 1000).toISOString(),
    dispatchAfterDate: new Date(mockNow - 2 * 60 * 60 * 1000).toISOString(),
    dispatchByDate: new Date(mockNow + 20 * 60 * 60 * 1000).toISOString(), buyerName: 'Simulated Buyer One',
    buyerAddress: { addressLine1: 'Mock Address 1', city: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
    items: [{ orderItemId: 'FKOI-MOCK-1001-1', orderId: 'FKO-MOCK-1001', listingId: 'LST-NIVAANA-INCENSE-001', sku: 'NV-MOCK-INCENSE-001', fsn: 'FSN-MOCK-INCENSE', title: 'Nivaana Premium Incense Sticks', quantity: 2, sellingPrice: 399, currency: 'INR' }],
  },
  {
    shipmentId: 'FKS-MOCK-1002', sellerId: 'MOCK-NIVAANA-SELLER', locationId: 'LOC-MOCK-BLR-01',
    fulfilmentType: 'SELF_SHIP', status: 'APPROVED', hold: false,
    orderDate: new Date(mockNow - 24 * 60 * 60 * 1000).toISOString(),
    dispatchAfterDate: new Date(mockNow - 22 * 60 * 60 * 1000).toISOString(),
    dispatchByDate: new Date(mockNow + 5 * 60 * 60 * 1000).toISOString(), buyerName: 'Simulated Buyer Two',
    buyerAddress: { addressLine1: 'Mock Address 2', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
    items: [{ orderItemId: 'FKOI-MOCK-1002-1', orderId: 'FKO-MOCK-1002', listingId: 'LST-NIVAANA-CANDLE-002', sku: 'NV-MOCK-CANDLE-002', fsn: 'FSN-MOCK-CANDLE', title: 'Nivaana Aromatherapy Candle', quantity: 1, sellingPrice: 649, currency: 'INR' }],
  },
  {
    shipmentId: 'FKS-MOCK-1003', sellerId: 'MOCK-NIVAANA-SELLER', locationId: 'LOC-MOCK-BLR-01',
    fulfilmentType: 'STANDARD', status: 'SHIPPED', hold: false,
    orderDate: new Date(mockNow - 3 * 24 * 60 * 60 * 1000).toISOString(),
    dispatchAfterDate: new Date(mockNow - 3 * 24 * 60 * 60 * 1000).toISOString(),
    dispatchByDate: new Date(mockNow - 2 * 24 * 60 * 60 * 1000).toISOString(), buyerName: 'Simulated Buyer Three',
    buyerAddress: { addressLine1: 'Mock Address 3', city: 'Hyderabad', state: 'Telangana', pincode: '500001' },
    trackingId: 'FKTRACK-MOCK-1003', deliveryPartner: 'Ekart Mock',
    items: [{ orderItemId: 'FKOI-MOCK-1003-1', orderId: 'FKO-MOCK-1003', listingId: 'LST-NIVAANA-DIFFUSER-003', sku: 'NV-MOCK-DIFFUSER-003', fsn: 'FSN-MOCK-DIFFUSER', title: 'Nivaana Reed Diffuser', quantity: 1, sellingPrice: 849, currency: 'INR' }],
  },
];

export class MockFlipkartSellerApiClient implements FlipkartSellerApiClient {
  readonly mode = 'MOCK' as const;

  async searchListings(input: { state: FlipkartListingState; page: number }): Promise<FlipkartListingPage> {
    const matches = MOCK_FLIPKART_LISTINGS.filter((listing) => listing.status === input.state);
    return { items: input.page === 0 ? matches : [], page: input.page, hasMore: false };
  }

  async updateInventory(items: FlipkartInventoryUpdateItem[]): Promise<FlipkartInventoryUpdateResult> {
    if (items.length > 10) throw new Error('Flipkart inventory batches cannot exceed 10 SKUs');
    return {
      requestId: `mock-${randomUUID()}`,
      results: items.map((item) => {
        const invalidLocation = item.locations.find((location) => !location.id.trim());
        const invalidQuantity = item.locations.find((location) => !Number.isInteger(location.inventory) || location.inventory < 0);
        const mockListing = MOCK_FLIPKART_LISTINGS.find((listing) => listing.sku === item.sku);
        const unknownSku = !mockListing;
        const errors = [
          ...(unknownSku ? [{ code: 'SKU_NOT_FOUND', description: 'The SKU does not exist in the mock seller account' }] : []),
          ...(invalidLocation ? [{ code: 'LOCATION_REQUIRED', description: 'A location ID is required', path: 'locations[].id' }] : []),
          ...(invalidQuantity ? [{ code: 'INVALID_INVENTORY', description: 'Inventory must be a non-negative integer', path: 'locations[].inventory' }] : []),
        ];
        if (errors.length === 0 && mockListing) {
          for (const locationUpdate of item.locations) {
            const location = mockListing.locations.find((entry) => entry.id === locationUpdate.id);
            if (location) location.inventory = locationUpdate.inventory;
          }
        }
        return { sku: item.sku, status: errors.length === 0 ? 'SUCCESS' as const : 'FAILURE' as const, errors };
      }),
    };
  }

  async searchShipments(): Promise<FlipkartShipment[]> {
    return structuredClone(MOCK_FLIPKART_SHIPMENTS);
  }

  private action(shipmentId: string, status: FlipkartShipment['status'], trackingId?: string): FlipkartShipmentActionResult {
    const shipment = MOCK_FLIPKART_SHIPMENTS.find((item) => item.shipmentId === shipmentId);
    if (!shipment) return { requestId: `mock-${randomUUID()}`, shipmentId, processingStatus: 'FAILURE', status, errorCode: 'SHIPMENT_NOT_FOUND', errorMessage: 'Shipment does not exist in the mock seller account' };
    shipment.status = status;
    if (trackingId) shipment.trackingId = trackingId;
    return { requestId: `mock-${randomUUID()}`, shipmentId, processingStatus: 'SUCCESS', status, ...(trackingId ? { trackingId } : {}) };
  }

  async packShipment(input: { shipmentId: string }): Promise<FlipkartShipmentActionResult> { return this.action(input.shipmentId, 'PACKED'); }
  async dispatchShipment(input: { shipmentId: string }): Promise<FlipkartShipmentActionResult> { return this.action(input.shipmentId, 'READY_TO_DISPATCH'); }
  async selfShipDispatch(input: { shipmentId: string; trackingId: string }): Promise<FlipkartShipmentActionResult> { return this.action(input.shipmentId, 'SHIPPED', input.trackingId); }
  async markSelfShipDelivered(input: { shipmentId: string }): Promise<FlipkartShipmentActionResult> { return this.action(input.shipmentId, 'DELIVERED'); }
  async cancelShipment(input: { shipmentId: string }): Promise<FlipkartShipmentActionResult> { return this.action(input.shipmentId, 'CANCELLED'); }
  async getTracking(shipmentId: string): Promise<FlipkartTrackingSnapshot> {
    const shipment = MOCK_FLIPKART_SHIPMENTS.find((item) => item.shipmentId === shipmentId);
    if (!shipment) throw new Error('Shipment does not exist in the mock seller account');
    const nextStatus = shipment.status === 'READY_TO_DISPATCH' ? 'SHIPPED' : shipment.status === 'SHIPPED' ? 'DELIVERED' : shipment.status;
    shipment.status = nextStatus;
    const trackingId = shipment.trackingId ?? (nextStatus === 'SHIPPED' ? `FKTRACK-${shipment.shipmentId}` : null);
    if (trackingId) shipment.trackingId = trackingId;
    return { shipmentId, status: nextStatus, trackingId, deliveryPartner: shipment.deliveryPartner ?? (trackingId ? 'Ekart Mock' : null), events: [
      { id: `${shipmentId}-${nextStatus}`, code: nextStatus, status: nextStatus, description: `Simulated Flipkart tracking status: ${nextStatus}`, location: 'Bengaluru', eventTime: new Date().toISOString() },
    ] };
  }
}

export class FlipkartApiError extends Error {
  constructor(message: string, readonly statusCode = 502, readonly code = 'FLIPKART_API_ERROR') {
    super(message);
    this.name = 'FlipkartApiError';
  }
}

type LiveClientOptions = {
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  accessToken: () => Promise<string>;
  sleep?: (ms: number) => Promise<void>;
};

// Listing search returns 20 listings per batch; listing details take up to 10 SKUs per call
const SEARCH_BATCH_SIZE = 20;
const DETAILS_BATCH_SIZE = 10;
const RETRY_DELAYS_MS = [1000, 2000, 4000];
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

type SearchListing = {
  listingId?: string; sellerId?: string; productId?: string; sku?: string; status?: string;
  product_name?: string; product_image_url?: string; vertical?: string;
  product_description?: { ssp?: number; esp?: number; mrp?: number };
};
type ListingDetails = {
  listing_id?: string; product_id?: string; product_title?: string; product_url?: string;
  price?: { mrp?: number; selling_price?: number; currency?: string };
  tax?: { hsn?: string; tax_code?: string };
  listing_status?: string;
  fulfillment_profile?: string;
  fulfillment?: { shipping_provider?: string; procurement_type?: string };
  locations?: Array<{ id?: string; status?: string; inventory?: number }>;
};

const toNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

// Live Seller API (Self Access). Listing reads work today; stock and order calls arrive in
// FKT-PLAN-03 / 04 / 05 and fail clearly until then.
export class LiveFlipkartSellerApiClient implements FlipkartSellerApiClient {
  readonly mode = 'PRODUCTION' as const;
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: LiveClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? env.FLIPKART_API_BASE_URL;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await this.options.accessToken();
    for (let attempt = 0; ; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetchImpl(new URL(path, this.baseUrl), {
          ...init,
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
        });
      } catch {
        if (attempt < RETRY_DELAYS_MS.length) { await this.sleep(RETRY_DELAYS_MS[attempt]!); continue; }
        throw new FlipkartApiError('Could not reach the Flipkart Seller API', 502, 'FLIPKART_API_UNREACHABLE');
      }
      if (response.ok) return await response.json() as T;
      if (RETRYABLE_STATUS.has(response.status) && attempt < RETRY_DELAYS_MS.length) {
        await this.sleep(RETRY_DELAYS_MS[attempt]!);
        continue;
      }
      const body = await response.text().catch(() => '');
      if (response.status === 401 || response.status === 403) {
        throw new FlipkartApiError('Flipkart rejected the access token; run Test connection', 401, 'FLIPKART_API_UNAUTHORIZED');
      }
      throw new FlipkartApiError(`Flipkart Seller API returned ${response.status}${body ? `: ${body.slice(0, 300)}` : ''}`, 502, 'FLIPKART_API_ERROR');
    }
  }

  async searchListings(input: { state: FlipkartListingState; page: number }): Promise<FlipkartListingPage> {
    const result = await this.call<{ totalListingsCount?: number; listingData?: SearchListing[] }>(
      '/listings/v3/product/search',
      { method: 'POST', body: JSON.stringify({ batchNo: input.page, internalState: input.state }) },
    );
    const found = (result.listingData ?? []).filter((item) => item.sku?.trim());
    const details = await this.listingDetails(found.map((item) => item.sku!.trim()));
    const items = found.map((item): FlipkartListing => {
      const sku = item.sku!.trim();
      const detail = details.get(sku);
      return {
        listingId: detail?.listing_id ?? item.listingId ?? '',
        sellerId: item.sellerId ?? '',
        productId: detail?.product_id ?? item.productId ?? '',
        sku,
        status: (detail?.listing_status ?? item.status ?? input.state) as FlipkartListingState,
        productName: detail?.product_title ?? item.product_name ?? sku,
        vertical: item.vertical ?? '',
        mrp: toNumber(detail?.price?.mrp ?? item.product_description?.mrp),
        sellingPrice: toNumber(detail?.price?.selling_price ?? item.product_description?.ssp),
        locations: (detail?.locations ?? []).flatMap((location) => location.id
          ? [{ id: location.id, status: location.status ?? 'UNKNOWN', inventory: Math.max(0, Math.trunc(toNumber(location.inventory))) }]
          : []),
        fulfilmentProfile: detail?.fulfillment_profile ?? null,
        shippingProvider: detail?.fulfillment?.shipping_provider ?? null,
        procurementType: detail?.fulfillment?.procurement_type ?? null,
        hsn: detail?.tax?.hsn ?? null,
        taxCode: detail?.tax?.tax_code ?? null,
        productUrl: detail?.product_url ?? null,
        imageUrl: item.product_image_url ?? null,
        raw: { search: item, details: detail ?? null },
      };
    });
    const total = result.totalListingsCount ?? 0;
    return { items, page: input.page, hasMore: found.length > 0 && input.page * SEARCH_BATCH_SIZE + (result.listingData?.length ?? 0) < total };
  }

  private async listingDetails(skus: string[]) {
    const details = new Map<string, ListingDetails>();
    for (let index = 0; index < skus.length; index += DETAILS_BATCH_SIZE) {
      const batch = skus.slice(index, index + DETAILS_BATCH_SIZE);
      const result = await this.call<{ available?: Record<string, ListingDetails> }>(
        `/sellers/listings/v3/${batch.map(encodeURIComponent).join(',')}`,
      );
      for (const [sku, detail] of Object.entries(result.available ?? {})) details.set(sku, detail);
    }
    return details;
  }

  private notBuilt(plan: string): never {
    throw new FlipkartApiError(`This Flipkart action is not built yet (${plan})`, 501, 'FLIPKART_NOT_IMPLEMENTED');
  }
  async updateInventory(_items: FlipkartInventoryUpdateItem[]): Promise<FlipkartInventoryUpdateResult> { return this.notBuilt('FKT-PLAN-03'); }
  async searchShipments(): Promise<FlipkartShipment[]> { return this.notBuilt('FKT-PLAN-04'); }
  async packShipment(_input: Parameters<FlipkartSellerApiClient['packShipment']>[0]): Promise<FlipkartShipmentActionResult> { return this.notBuilt('FKT-PLAN-05'); }
  async dispatchShipment(_input: Parameters<FlipkartSellerApiClient['dispatchShipment']>[0]): Promise<FlipkartShipmentActionResult> { return this.notBuilt('FKT-PLAN-05'); }
  async selfShipDispatch(_input: Parameters<FlipkartSellerApiClient['selfShipDispatch']>[0]): Promise<FlipkartShipmentActionResult> { return this.notBuilt('FKT-PLAN-05'); }
  async markSelfShipDelivered(_input: Parameters<FlipkartSellerApiClient['markSelfShipDelivered']>[0]): Promise<FlipkartShipmentActionResult> { return this.notBuilt('FKT-PLAN-05'); }
  async cancelShipment(_input: Parameters<FlipkartSellerApiClient['cancelShipment']>[0]): Promise<FlipkartShipmentActionResult> { return this.notBuilt('FKT-PLAN-05'); }
  async getTracking(_shipmentId: string): Promise<FlipkartTrackingSnapshot> { return this.notBuilt('FKT-PLAN-05'); }
}

// Rows written by the mock client are tagged MOCK; screens only show rows of the
// current mode so simulated data never mixes with the live seller account.
export const flipkartDataEnvironment = (): 'MOCK' | 'PRODUCTION' =>
  env.FLIPKART_MOCK_MODE ? 'MOCK' : 'PRODUCTION';

export const getFlipkartSellerApiClient = (): FlipkartSellerApiClient =>
  env.FLIPKART_MOCK_MODE
    ? new MockFlipkartSellerApiClient()
    : new LiveFlipkartSellerApiClient({ accessToken: () => flipkartConnectionService.accessToken() });
