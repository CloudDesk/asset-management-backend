import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { ekartAuthService } from './ekart-auth.service.js';

export interface CreateShipmentPayload {
  seller_name: string;
  seller_address: string;
  seller_gst_tin: string;
  order_number: string;
  invoice_number: string;
  invoice_date: string;
  consignee_name: string;
  products_desc: string;
  payment_mode: 'COD' | 'Prepaid' | 'Pickup';
  total_amount: number;
  tax_value: number;
  taxable_amount: number;
  commodity_value: string;
  quantity: number;
  weight: number;
  drop_location: {
    location_type?: 'Home' | 'Office' | undefined;
    name: string;
    address: string;
    city: string;
    state: string;
    country?: string | undefined;
    pin: number;
    phone: number;
  };
  // Optional fields
  seller_gst_amount?: number | undefined;
  consignee_gst_amount?: number | undefined;
  integrated_gst_amount?: number | undefined;
  consignee_gst_tin?: string | undefined;
  ewbn?: string | undefined;
  document_number?: string | undefined;
  document_date?: string | undefined;
  hsn_code?: string | undefined;
  category_of_goods?: string | undefined;
  cod_amount?: number | undefined;
  templateName?: string | undefined;
  length?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
  return_reason?: string | undefined;
  pickup_location?: {
    name: string;
  } | undefined;
  return_location?: {
    name: string;
  } | undefined;
  qc_details?: {
    qc_shipment: boolean;
    product_name: string;
    product_desc?: string | undefined;
    product_sku?: string | undefined;
    product_color?: string | undefined;
    product_size?: string | undefined;
    brand_name?: string | undefined;
    product_category?: string | undefined;
    ean_barcode?: string | undefined;
    serial_number?: string | undefined;
    imei_number?: string | undefined;
    product_images?: string[] | undefined;
  } | undefined;
  items?: Array<{
    product_name: string;
    sku: string;
    taxable_value: number;
    description?: string | undefined;
    quantity: number;
    length: number;
    height: number;
    breadth: number;
    weight: number;
    hsn_code?: string | undefined;
    cgst_tax_value?: number | undefined;
    sgst_tax_value?: number | undefined;
    igst_tax_value?: number | undefined;
  }> | undefined;
  what3words_address?: string | undefined;
}

export interface CreateShipmentResponse {
  status: boolean;
  remark: string;
  tracking_id: string;
  vendor: string;
  barcodes: {
    wbn: string;
    order: string;
    cod?: string;
  };
}

export interface EkartErrorResponse {
  statusCode: number;
  code: string;
  message: string;
  description: string;
  severity: string;
}

export interface TrackShipmentResponse {
  _id: string;
  track: {
    status: string;
    ctime: number;
    pickupTime?: number;
    desc: string;
    location: string;
    ndrStatus?: string;
    attempts?: number;
    ndrActions?: string[];
    details: Array<{
      status: string;
      ctime: number;
      desc: string;
      location: string;
      ndrStatus?: string;
    }>;
  };
  edd: number;
  order_number: string;
}

export interface ShippingRatesPayload {
  pickupPincode: number;
  dropPincode: number;
  invoiceAmount: number;
  weight: number;
  length: number;
  height: number;
  width: number;
  serviceType: string;
  codAmount: number;
  packages: Array<{
    length: number;
    height: number;
    width: number;
    count: string;
  }>;
}

export interface ShippingRatesResponse {
  type: string;
  zone: string;
  volumetricWeight: string;
  billingWeight: string;
  shippingCharge: string;
  rtoCharge: string;
  fuelSurcharge: string;
  codCharge: string;
  qcCharge: string;
  taxes: string;
  total: string;
  rid: string;
  rSnapshotId: string;
}

export class EkartService {
  private baseURL: string;
  private authService: typeof ekartAuthService;

  constructor() {
    this.baseURL = env.EKART_BASE_URL || 'https://app.elite.ekartlogistics.in/api';
    this.authService = ekartAuthService;

    logger.info('EkartService initialized');
  }

  /**
   * Base method to make authenticated API requests
   * Automatically handles token management
   */
  private async apiRequest<T>(
    endpoint: string,
    options: {
      method?: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
      data?: any;
      headers?: Record<string, string>;
      responseType?: 'json' | 'arraybuffer' | 'blob' | 'text';
    } = {}
  ): Promise<AxiosResponse<T>> {
    const { method = 'GET', data, headers = {}, responseType = 'json' } = options;

    try {
      // Ensure we have a valid token
      const authHeader = await this.authService.getAuthHeader();

      // Make request with Bearer token
      const response = await axios.request<T>({
        url: `${this.baseURL}${endpoint}`,
        method,
        data,
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          ...headers
        },
        responseType
      });

      return response;
    } catch (error: any) {
      // Handle 401 - token might have expired during request
      if (error.response?.status === 401) {
        logger.info('🔄 Got 401, refreshing token and retrying...');
        await this.authService.connect(); // Force refresh
        const newAuthHeader = await this.authService.getAuthHeader();

        // Retry request with new token
        return axios.request<T>({
          url: `${this.baseURL}${endpoint}`,
          method,
          data,
          headers: {
            'Authorization': newAuthHeader,
            'Content-Type': 'application/json',
            ...headers
          },
          responseType
        });
      }

      // Log and rethrow other errors
      logger.error(
        {
          endpoint,
          method,
          status: error.response?.status,
          error: error.message,
          data: error.response?.data
        },
        'Ekart API request failed'
      );

      throw error;
    }
  }

  /**
   * Create Forward Shipment (Seller → Customer)
   */
  async createForwardShipment(payload: CreateShipmentPayload): Promise<CreateShipmentResponse> {
    logger.info({ orderNumber: payload.order_number }, 'Creating forward shipment');

    const response = await this.apiRequest<CreateShipmentResponse>(
      '/v1/package/create',
      {
        method: 'POST',
        data: payload
      }
    );

    if (!response.data.status) {
      throw new Error(response.data.remark || 'Failed to create shipment');
    }

    logger.info(
      {
        trackingId: response.data.tracking_id,
        orderNumber: payload.order_number
      },
      '✅ Forward shipment created successfully'
    );

    return response.data;
  }

  /**
   * Create Reverse Shipment (Customer → Seller)
   */
  async createReverseShipment(payload: CreateShipmentPayload): Promise<CreateShipmentResponse> {
    if (payload.payment_mode !== 'Pickup') {
      throw new Error('Reverse shipments must have payment_mode = "Pickup"');
    }

    if (!payload.return_reason) {
      throw new Error('return_reason is required for reverse shipments');
    }

    logger.info({ orderNumber: payload.order_number }, 'Creating reverse shipment');

    const response = await this.apiRequest<CreateShipmentResponse>(
      '/v1/package/create',
      {
        method: 'POST',
        data: payload
      }
    );

    if (!response.data.status) {
      throw new Error(response.data.remark || 'Failed to create reverse shipment');
    }

    logger.info(
      {
        trackingId: response.data.tracking_id,
        orderNumber: payload.order_number
      },
      '✅ Reverse shipment created successfully'
    );

    return response.data;
  }

  /**
   * Download Label (PDF)
   */
  async downloadLabel(trackingIds: string[]): Promise<Buffer> {
    logger.info({ trackingIds }, 'Downloading labels');

    const response = await this.apiRequest<Buffer>(
      '/v1/package/label',
      {
        method: 'POST',
        data: { ids: trackingIds },
        responseType: 'arraybuffer'
      }
    );

    logger.info(
      { count: trackingIds.length },
      '✅ Labels downloaded successfully'
    );

    return Buffer.from(response.data);
  }

  /**
   * Track Shipment
   */
  async trackShipment(trackingId: string): Promise<TrackShipmentResponse> {
    logger.info({ trackingId }, 'Tracking shipment');

    const response = await this.apiRequest<TrackShipmentResponse>(
      `/v1/track/${trackingId}`,
      {
        method: 'GET'
      }
    );

    logger.info(
      {
        trackingId,
        status: response.data.track.status
      },
      '✅ Shipment tracking retrieved'
    );

    return response.data;
  }

  /**
   * Cancel Shipment
   */
  async cancelShipment(trackingId: string): Promise<{ status: boolean; remark: string; tracking_id: string }> {
    logger.info({ trackingId }, 'Cancelling shipment');

    const response = await this.apiRequest<{ status: boolean; remark: string; tracking_id: string }>(
      `/v1/package/cancel?tracking_id=${trackingId}`,
      {
        method: 'DELETE'
      }
    );

    if (!response.data.status) {
      throw new Error(response.data.remark || 'Failed to cancel shipment');
    }

    logger.info({ trackingId }, '✅ Shipment cancelled successfully');

    return response.data;
  }

  /**
   * Get Shipping Rates
   */
  async getShippingRates(payload: ShippingRatesPayload): Promise<ShippingRatesResponse> {
    logger.info(
      {
        pickupPincode: payload.pickupPincode,
        dropPincode: payload.dropPincode
      },
      'Getting shipping rates'
    );

    const response = await this.apiRequest<ShippingRatesResponse>(
      '/data/pricing/estimate',
      {
        method: 'POST',
        data: payload
      }
    );

    logger.info(
      {
        total: response.data.total,
        zone: response.data.zone
      },
      '✅ Shipping rates retrieved'
    );

    return response.data;
  }
}

// Export singleton instance
export const ekartService = new EkartService();

