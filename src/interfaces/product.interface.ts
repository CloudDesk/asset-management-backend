import { FastifyRequest } from 'fastify';

export interface ProductParams {
    id: number;
}

export interface ProductRequest extends FastifyRequest {
    params: ProductParams;
    body: any;
}

export interface ProductResponse {
    success: boolean;
    data?: any;
    error?: string;
}

export interface ProductServiceResponse {
    command: 'INSERT' | 'UPDATE' | 'DELETE';
    productid?: number;
    pathurldatas?: any;
    message?: string;
    data?: any;
}

export interface ProductFileResponse {
    result: ProductServiceResponse;
    productid?: number;
    pathurldatas?: any;
}

export interface ProductErrorResponse {
    errorMessage: string;
    errorDetails: any;
    statusCode: number;
}

export interface ProductQueryParams {
    page?: number;
    count?: number;
    [key: string]: any;
}

export interface ProductData {
    id?: number;
    quantity?: number;
    ecompublishedquantity?: number;
    soldquantity?: number;
    availablequantity?: number;
    puc?: string;
    orderedquantity?: number;
    [key: string]: any;
}

export interface BatchUpdateData {
    location: string;
    quantity: number;
    ecompublishedquantity: number;
    soldquantity: number;
    availablequantity: number;
    puc: string;
}

export interface ImageData {
    url: {
        Large: string[];
        Medium: string[];
        Small: string[];
    };
    path: string;
}

export type ProductServiceResult = ProductServiceResponse | ProductFileResponse | ProductErrorResponse; 