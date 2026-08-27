import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

export type FlipkartListingState =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'READY_FOR_ACTIVATION'
  | 'ARCHIVED'
  | 'INACTIVATED_BY_FLIPKART';

export type FlipkartListingLocation = {
  id: string;
  status: 'ACTIVE' | 'INACTIVE';
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

class UnavailableProductionFlipkartClient implements FlipkartSellerApiClient {
  readonly mode = 'PRODUCTION' as const;
  private unavailable(): never {
    throw new Error('Production Flipkart APIs are unavailable until Flipkart approves the Self Access application');
  }
  async searchListings(_input: { state: FlipkartListingState; page: number }): Promise<FlipkartListingPage> { return this.unavailable(); }
  async updateInventory(_items: FlipkartInventoryUpdateItem[]): Promise<FlipkartInventoryUpdateResult> { return this.unavailable(); }
  async searchShipments(): Promise<FlipkartShipment[]> { return this.unavailable(); }
  async packShipment(_input: Parameters<FlipkartSellerApiClient['packShipment']>[0]): Promise<FlipkartShipmentActionResult> { return this.unavailable(); }
  async dispatchShipment(_input: Parameters<FlipkartSellerApiClient['dispatchShipment']>[0]): Promise<FlipkartShipmentActionResult> { return this.unavailable(); }
  async selfShipDispatch(_input: Parameters<FlipkartSellerApiClient['selfShipDispatch']>[0]): Promise<FlipkartShipmentActionResult> { return this.unavailable(); }
  async markSelfShipDelivered(_input: Parameters<FlipkartSellerApiClient['markSelfShipDelivered']>[0]): Promise<FlipkartShipmentActionResult> { return this.unavailable(); }
  async cancelShipment(_input: Parameters<FlipkartSellerApiClient['cancelShipment']>[0]): Promise<FlipkartShipmentActionResult> { return this.unavailable(); }
  async getTracking(_shipmentId: string): Promise<FlipkartTrackingSnapshot> { return this.unavailable(); }
}

export const getFlipkartSellerApiClient = (): FlipkartSellerApiClient =>
  env.FLIPKART_MOCK_MODE ? new MockFlipkartSellerApiClient() : new UnavailableProductionFlipkartClient();
