import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import type {
  ShipmozoPushOrderInput,
  ShipmozoRateInput,
  ShipmozoReturnOrderInput
} from '../schemas/shipmozo.schema.js';

export interface ShipmozoResponse<T = Record<string, unknown>> {
  result: string | number;
  message?: string;
  data?: T;
}

export interface ShipmozoAssignmentData {
  order_id?: string;
  refrence_id?: string;
  awb_number?: string;
  lr_number?: string;
  courier?: string;
  courier_company?: string;
  courier_company_service?: string;
  [key: string]: unknown;
}

export interface ShipmozoLabelResult {
  contentType: string;
  data: Buffer | unknown;
}

export interface ShipmozoServiceabilityResult {
  serviceable: boolean;
}

export function buildShipmozoPublicTrackingUrl(awbNumber: string): string {
  const normalizedAwb = String(awbNumber || '').trim();
  if (!normalizedAwb) return '';
  return `https://app.shipmozo.com/track-order?awb=${encodeURIComponent(normalizedAwb)}`;
}

export function buildShipmozoPushOrderPayload(
  payload: Omit<ShipmozoPushOrderInput, 'assignment_mode' | 'courier_id' | 'schedule_pickup'>
): Record<string, unknown> {
  return {
    ...payload,
    product_detail: payload.product_detail.map((product) => ({
      ...product,
      name: product.name.trim().slice(0, 200),
      discount: Number(product.discount),
      quantity: Number(product.quantity),
      unit_price: Number(product.unit_price)
    })),
    consignee_phone: String(payload.consignee_phone),
    consignee_alternate_phone: payload.consignee_alternate_phone
      ? String(payload.consignee_alternate_phone)
      : '',
    consignee_pin_code: String(payload.consignee_pin_code),
    cod_amount: payload.payment_type === 'COD' ? String(payload.cod_amount) : '',
    shipping_charges: payload.shipping_charges ? String(payload.shipping_charges) : '',
    weight: String(payload.weight),
    length: String(payload.length),
    width: String(payload.width),
    height: String(payload.height),
    ...(payload.warehouse_id ? { warehouse_id: String(payload.warehouse_id) } : {})
  };
}

export class ShipmozoApiError extends Error {
  readonly statusCode = 502;

  constructor(message: string) {
    super(message);
    this.name = 'ShipmozoApiError';
  }
}

export class ShipmozoService {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.SHIPMOZO_BASE_URL,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  isConfigured(): boolean {
    return Boolean(env.SHIPMOZO_PUBLIC_KEY && env.SHIPMOZO_PRIVATE_KEY);
  }

  private requireConfigured(): void {
    if (!this.isConfigured()) {
      throw new ShipmozoApiError(
        'Shipmozo credentials are not configured. Set SHIPMOZO_PUBLIC_KEY and SHIPMOZO_PRIVATE_KEY.'
      );
    }
  }

  private async request<T>(config: {
    method: 'GET' | 'POST';
    url: string;
    data?: unknown;
    params?: Record<string, unknown>;
    responseType?: 'json' | 'arraybuffer';
  }): Promise<AxiosResponse<T>> {
    this.requireConfigured();

    try {
      return await this.client.request<T>({
        ...config,
        headers: {
          'public-key': env.SHIPMOZO_PUBLIC_KEY!,
          'private-key': env.SHIPMOZO_PRIVATE_KEY!
        }
      });
    } catch (error) {
      const axiosError = error as AxiosError<any>;
      const upstreamMessage =
        axiosError.response?.data?.message ||
        axiosError.response?.data?.error ||
        axiosError.message;

      logger.error(
        {
          endpoint: config.url,
          method: config.method,
          upstreamStatus: axiosError.response?.status,
          upstreamMessage
        },
        'Shipmozo API request failed'
      );

      throw new ShipmozoApiError(`Shipmozo request failed: ${upstreamMessage}`);
    }
  }

  private unwrap<T>(response: AxiosResponse<ShipmozoResponse<T>>, operation: string): T {
    const body = response.data;
    if (String(body?.result) !== '1') {
      const providerDetails = this.describeProviderFailure(body?.data);
      const providerMessage = body?.message && body.message !== 'Error'
        ? body.message
        : providerDetails || 'the provider returned an unspecified error';
      logger.warn(
        { operation, providerResult: body?.result, providerMessage, providerData: body?.data },
        'Shipmozo rejected an API operation'
      );
      throw new ShipmozoApiError(`Shipmozo ${operation} failed: ${providerMessage}`);
    }
    return (body.data || {}) as T;
  }

  private describeProviderFailure(value: unknown): string {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) {
      return value.map((item) => this.describeProviderFailure(item)).filter(Boolean).join('; ').slice(0, 500);
    }
    if (!value || typeof value !== 'object') return '';
    const record = value as Record<string, unknown>;
    for (const key of ['message', 'error', 'errors', 'detail', 'details', 'info']) {
      const detail = this.describeProviderFailure(record[key]);
      if (detail) return detail;
    }
    const entries = Object.entries(record)
      .map(([key, item]) => {
        const detail = this.describeProviderFailure(item);
        return detail ? `${key}: ${detail}` : '';
      })
      .filter(Boolean);
    return entries.join('; ').slice(0, 500);
  }

  async getWarehouses(page?: number): Promise<unknown> {
    const response = await this.request<ShipmozoResponse>({
      method: 'GET',
      url: '/get-warehouses',
      ...(page ? { params: { page } } : {})
    });
    return this.unwrap(response, 'warehouse lookup');
  }

  async getCountries(): Promise<unknown> {
    const response = await this.request<ShipmozoResponse>({
      method: 'GET',
      url: '/countries'
    });
    return this.unwrap(response, 'countries lookup');
  }

  async getReturnReasons(): Promise<unknown> {
    const response = await this.request<ShipmozoResponse>({
      method: 'GET',
      url: '/get-return-reason'
    });
    return this.unwrap(response, 'return reasons lookup');
  }

  async checkServiceability(
    payload: { pickup_pincode: string; delivery_pincode: string }
  ): Promise<ShipmozoServiceabilityResult> {
    const response = await this.request<ShipmozoResponse<ShipmozoServiceabilityResult>>({
      method: 'POST',
      url: '/pincode-serviceability',
      data: payload
    });
    const data = this.unwrap(response, 'serviceability check');

    if (typeof data.serviceable !== 'boolean') {
      throw new ShipmozoApiError('Shipmozo returned an invalid serviceability response');
    }

    return data;
  }

  async calculateRates(payload: ShipmozoRateInput): Promise<unknown> {
    const response = await this.request<ShipmozoResponse>({
      method: 'POST',
      url: '/rate-calculator',
      data: payload
    });
    return this.unwrap(response, 'rate calculation');
  }

  async pushOrder(payload: Omit<ShipmozoPushOrderInput, 'assignment_mode' | 'courier_id' | 'schedule_pickup'>): Promise<Record<string, unknown>> {
    // Shipmozo documents these values as strings even though the Nivaana UI
    // handles them as numbers. Keep its wire contract exact and bound product
    // names so catalog marketing copy cannot make the provider reject an order.
    const requestPayload = buildShipmozoPushOrderPayload(payload);
    const response = await this.request<ShipmozoResponse<Record<string, unknown>>>({
      method: 'POST',
      url: '/push-order',
      data: requestPayload
    });
    return this.unwrap(response, 'order creation');
  }

  async pushReturnOrder(
    payload: Omit<ShipmozoReturnOrderInput, 'return_request_id' | 'schedule_pickup'>
  ): Promise<Record<string, unknown>> {
    const response = await this.request<ShipmozoResponse<Record<string, unknown>>>({
      method: 'POST',
      url: '/push-return-order',
      data: payload
    });
    return this.unwrap(response, 'return order creation');
  }

  async autoAssignOrder(orderId: string): Promise<ShipmozoAssignmentData> {
    const response = await this.request<ShipmozoResponse<ShipmozoAssignmentData>>({
      method: 'POST',
      url: '/auto-assign-order',
      data: { order_id: orderId }
    });
    return this.unwrap(response, 'automatic courier assignment');
  }

  async assignCourier(orderId: string, courierId: string): Promise<ShipmozoAssignmentData> {
    const response = await this.request<ShipmozoResponse<ShipmozoAssignmentData>>({
      method: 'POST',
      url: '/assign-courier',
      data: { order_id: orderId, courier_id: courierId }
    });
    return this.unwrap(response, 'courier assignment');
  }

  async schedulePickup(orderId: string): Promise<ShipmozoAssignmentData> {
    const response = await this.request<ShipmozoResponse<ShipmozoAssignmentData>>({
      method: 'POST',
      url: '/schedule-pickup',
      data: { order_id: orderId }
    });
    return this.unwrap(response, 'pickup scheduling');
  }

  async trackOrder(awbNumber: string): Promise<unknown> {
    const response = await this.request<ShipmozoResponse>({
      method: 'GET',
      url: '/track-order',
      params: { awb_number: awbNumber }
    });
    return this.unwrap(response, 'tracking lookup');
  }

  async getOrderDetail(orderId: string): Promise<unknown> {
    const response = await this.request<ShipmozoResponse>({
      method: 'GET',
      url: `/get-order-detail/${encodeURIComponent(orderId)}`
    });
    return this.unwrap(response, 'order lookup');
  }

  async getOrderLabel(awbNumber: string, type = 'PDF'): Promise<ShipmozoLabelResult> {
    const response = await this.request<unknown>({
      method: 'GET',
      url: `/get-order-label/${encodeURIComponent(awbNumber)}`,
      params: { type_of_label: type },
      responseType: 'arraybuffer'
    });
    const contentType = String(response.headers['content-type'] || 'application/octet-stream');
    const buffer = Buffer.from(response.data as ArrayBuffer);

    if (contentType.includes('application/json')) {
      const parsed = JSON.parse(buffer.toString('utf8')) as ShipmozoResponse;
      if (String(parsed.result) !== '1') {
        throw new ShipmozoApiError(parsed.message || 'Shipmozo label generation failed');
      }
      return { contentType, data: parsed.data || parsed };
    }

    return { contentType, data: buffer };
  }

  async cancelOrder(orderId: string, awbNumber: string): Promise<unknown> {
    const response = await this.request<ShipmozoResponse>({
      method: 'POST',
      url: '/cancel-order',
      data: { order_id: orderId, awb_number: awbNumber }
    });
    return this.unwrap(response, 'order cancellation');
  }
}

export const shipmozoService = new ShipmozoService();
