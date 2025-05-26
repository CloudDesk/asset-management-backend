import { QueryResult } from "pg";

export interface ProductParams {
  id: number;
}

export interface ProductQueryParams {
  page?: number;
  count?: number;
  [key: string]: any;
}

export interface ProductResponse {
  product?: string;
  error?: any[];
}

export interface ProductImageData {
  url: {
    Large: string[];
    Medium: string[];
    Small: string[];
  };
  path?: string;
}

export interface ProductQuantityData {
  quantity: number;
  ecompublishedquantity: number;
  soldquantity: number;
  availablequantity: number;
  puc: string;
  orderedquantity?: number;
}

export interface ProductBatchData {
  location: string;
  quantity: number;
  ecompublishedquantity: number;
  soldquantity: number;
  availablequantity: number;
  puc: string;
}

export interface ProductLockData {
  productid: number;
  quantity?: number;
}

export interface ProductServiceResponse {
  success?: boolean;
  rows?: any[];
  errorMessage?: string;
  errorDetails?: string;
  statusCode?: number;
  productid?: number;
  pathurldatas?: string[];
  command?: string;
  result?: {
    command?: string;
  };
  product?: any;
  cart?: string;
}

export interface ProductControllerResponse {
  status: number;
  data: any;
  message?: string;
} 