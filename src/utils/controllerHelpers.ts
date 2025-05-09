import { FastifyReply } from 'fastify';
import { ServiceResult } from '../interfaces/shared.interface.js';

/**
 * Sends a success response with the provided data
 */
export const sendSuccessResponse = (reply: FastifyReply, data: unknown): void => {
    console.log(data, ' Data is in controller ');
    reply.send(data);
};

/**
 * Sends an error response with the provided status code and error message
 */
export const sendErrorResponse = (reply: FastifyReply, statusCode: number, error: unknown): void => {
    reply.status(statusCode).send(error instanceof Error ? error.message : String(error));
};

/**
 * Handles errors in controller methods
 */
export const handleControllerError = (error: unknown, reply: FastifyReply, methodName: string): void => {
    console.error(`ERROR IN Controller ${methodName}:`, error);
    sendErrorResponse(reply, 500, error);
};

/**
 * Checks if a service operation was successful
 */
export const isSuccessfulOperation = (result: ServiceResult): boolean => {
    if ('command' in result) {
        return result.command === 'INSERT' || result.command === 'UPDATE';
    }
    return false;
};

/**
 * Gets the appropriate operation message based on the command
 */
export const getOperationMessage = (command: string): string => {
    return command === 'UPDATE' ? 'Updated successfully' : 'Created successfully';
};

/**
 * Validates required fields in a request body
 */
export const validateRequiredFields = (body: Record<string, any>, requiredFields: string[]): string | null => {
    const missingFields = requiredFields.filter(field => !body[field]);
    return missingFields.length > 0 
        ? `Missing required fields: ${missingFields.join(', ')}` 
        : null;
};

/**
 * Formats a response with consistent structure
 */
export const formatResponse = <T>(data: T, message?: string) => {
    return {
        success: true,
        data,
        ...(message && { message })
    };
};

/**
 * Handles pagination parameters
 */
export const handlePagination = (page?: number, limit?: number) => {
    const defaultPage = 1;
    const defaultLimit = 10;
    const maxLimit = 100;

    return {
        page: Math.max(1, page || defaultPage),
        limit: Math.min(maxLimit, limit || defaultLimit)
    };
}; 