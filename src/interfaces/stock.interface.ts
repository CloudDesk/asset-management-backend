import { FastifyRequest } from 'fastify';

export interface StockRequest extends FastifyRequest {
  query: {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    filters?: Record<string, any>;
  };
  params: {
    id?: string;
  };
  body: {
    puc: string;
    quantity: number;
    isdeleted?: boolean;
    isarchive?: boolean;
    isewaste?: boolean;
  };
}

export interface StockServiceResponse {
  success: boolean;
  data: StockData[];
  total: number;
  page: number;
  limit: number;
}

export interface StockData {
  id: number;
  puc: string;
  quantity: number;
  isdeleted: boolean;
  isarchive: boolean;
  isewaste: boolean;
  created_at: string;
  updated_at: string;
}

export interface StockUpdateResponse {
  success: boolean;
  message: string;
}

export interface StockQueryParams {
  page?: number;
  count?: number;
  sortby?: string;
  displaysize?: string[];
  price?: string[];
  [key: string]: any;
}

export interface StockQuantityData {
  quantity: number;
  ecompublishedquantity: number;
  soldquantity: number;
  availablequantity: number;
  puc: string;
}

export interface StockBatchData {
  puc: string;
  location: string;
  quantity: number;
  ecompublishedquantity: number;
  soldquantity: number;
  availablequantity: number;
}

export interface StockLockData {
  id: number;
  lock_qty: number;
}

export interface StockRequest extends FastifyRequest {
  user?: {
    id: number;
    email: string;
    role: string;
  };
}

export interface StockRFIDData {
  rfid: string;
  productid: number;
  orderlinenumber: string;
} 