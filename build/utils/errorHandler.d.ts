import { FastifyRequest, FastifyReply } from 'fastify';
export interface ErrorResponse {
    success: false;
    message: string;
    details?: string;
    statusCode: number;
}
export interface SuccessResponse<T = unknown> {
    success: true;
    message: string;
    data: T | null;
}
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse;
export declare function createSuccessResponse<T>(message: string, data?: T | null): SuccessResponse<T>;
export declare function createErrorResponse(message: string, details?: string, statusCode?: number): ErrorResponse;
export declare class ValidationError extends Error {
    statusCode: number;
    code: string;
    details?: string;
    fields?: string[];
    constructor(message: string, details?: string, fields?: string[]);
}
export declare class DatabaseError extends Error {
    statusCode: number;
    code: string;
    details?: string;
    constructor(message: string, details?: string, statusCode?: number);
}
export declare class NotFoundError extends Error {
    statusCode: number;
    code: string;
    constructor(message?: string);
}
export declare class InvalidFieldError extends Error {
    statusCode: number;
    code: string;
    invalidFields: string[];
    constructor(invalidFields: string[]);
}
export declare function processError(error: any, request: FastifyRequest): ErrorResponse;
export declare function asyncHandler(fn: Function): (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
export declare function validateFields(inputData: Record<string, any>, validFields: string[]): {
    validData: Record<string, any>;
    invalidFields: string[];
};
export declare function errorHandler(error: any, request: FastifyRequest, reply: FastifyReply): Promise<void>;
export declare function validateIntegerId(id: string, resourceName?: string): number;
export declare function createRouteErrorResponse(error: any, resourceName: string, id?: string): {
    response: any;
    statusCode: number;
};
export declare function validateRouteId(id: string, resourceName: string): {
    isValid: boolean;
    errorResponse?: any;
    statusCode?: number;
};
//# sourceMappingURL=errorHandler.d.ts.map