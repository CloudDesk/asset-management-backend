import { logger } from '../config/logger.js';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
export function createSuccessResponse(message, data = null) {
    return {
        success: true,
        message,
        data,
    };
}
export function createErrorResponse(message, details, statusCode = 400) {
    const response = {
        success: false,
        message: message || 'An error occurred',
        statusCode: statusCode || 500,
    };
    if (details !== undefined && details !== null && details !== '') {
        response.details = details;
    }
    return response;
}
// Custom error classes for better error handling
export class ValidationError extends Error {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    details;
    fields;
    constructor(message, details, fields) {
        super(message);
        this.name = 'ValidationError';
        if (details !== undefined) {
            this.details = details;
        }
        if (fields !== undefined) {
            this.fields = fields;
        }
    }
}
export class DatabaseError extends Error {
    statusCode = 400;
    code = 'DATABASE_ERROR';
    details;
    constructor(message, details, statusCode = 400) {
        super(message);
        this.name = 'DatabaseError';
        if (details !== undefined) {
            this.details = details;
        }
        this.statusCode = statusCode;
    }
}
export class NotFoundError extends Error {
    statusCode = 404;
    code = 'NOT_FOUND';
    constructor(message = 'Resource not found') {
        super(message);
        this.name = 'NotFoundError';
    }
}
export class InvalidFieldError extends Error {
    statusCode = 400;
    code = 'INVALID_FIELD';
    invalidFields;
    constructor(invalidFields) {
        const message = `Invalid field${invalidFields.length > 1 ? 's' : ''}: ${invalidFields.join(', ')}`;
        super(message);
        this.name = 'InvalidFieldError';
        this.invalidFields = invalidFields;
    }
}
// Enhanced function to parse Prisma errors with field-specific messages
function parsePrismaError(error, requestBody) {
    const errorCode = error.code;
    switch (errorCode) {
        case 'P2002': {
            // Unique constraint violation
            const target = error.meta?.target;
            let fieldName = 'field';
            let fieldValue = 'value';
            if (Array.isArray(target) && target.length > 0) {
                fieldName = target[0];
                // Try to get the actual value from request body
                if (requestBody && requestBody[fieldName] !== undefined) {
                    fieldValue = requestBody[fieldName];
                }
            }
            return {
                message: `The ${fieldName} '${fieldValue}' already exists. Please use a unique value.`,
                details: `Duplicate entry detected for field: ${fieldName}`,
                statusCode: 400
            };
        }
        case 'P2025': {
            // Record not found
            return {
                message: 'Record not found',
                details: 'The requested record does not exist or has been deleted',
                statusCode: 404
            };
        }
        case 'P2003': {
            // Foreign key constraint violation
            const fieldName = error.meta?.field_name || 'reference field';
            return {
                message: `Invalid ${fieldName} reference`,
                details: `The referenced ${fieldName} does not exist`,
                statusCode: 400
            };
        }
        case 'P2011': {
            // Null constraint violation
            const fieldName = error.meta?.constraint || 'field';
            return {
                message: `Required field missing: ${fieldName}`,
                details: `The field '${fieldName}' is required and cannot be null`,
                statusCode: 400
            };
        }
        case 'P2012': {
            // Missing required value
            const fieldName = error.meta?.path || 'field';
            return {
                message: `Missing required value for ${fieldName}`,
                details: `A required field value is missing: ${fieldName}`,
                statusCode: 400
            };
        }
        case 'P2010': {
            // Raw query failed - parse the underlying database error
            const rawMessage = error.meta?.message || error.message || '';
            // Handle unique constraint from raw query
            if (rawMessage.includes('already exists')) {
                const keyMatch = rawMessage.match(/Key \(([^)]+)\)=\(([^)]+)\)/);
                if (keyMatch) {
                    const fieldName = keyMatch[1];
                    const fieldValue = keyMatch[2];
                    return {
                        message: `The ${fieldName} '${fieldValue}' already exists. Please use a unique value.`,
                        details: `Duplicate entry detected for field: ${fieldName}`,
                        statusCode: 400
                    };
                }
            }
            // Handle type mismatch errors
            if (rawMessage.includes('is of type') && rawMessage.includes('but expression is of type')) {
                const columnMatch = rawMessage.match(/column "([^"]+)"/);
                const expectedTypeMatch = rawMessage.match(/is of type (\w+)/);
                const actualTypeMatch = rawMessage.match(/expression is of type (\w+)/);
                const column = columnMatch ? columnMatch[1] : 'field';
                const expectedType = expectedTypeMatch ? expectedTypeMatch[1] : 'expected type';
                const actualType = actualTypeMatch ? actualTypeMatch[1] : 'provided type';
                return {
                    message: `Invalid data type for ${column}`,
                    details: `Field '${column}' expects ${expectedType} but received ${actualType}`,
                    statusCode: 400
                };
            }
            // Handle value too long errors
            if (rawMessage.includes('value too long for type')) {
                const match = rawMessage.match(/value too long for type character varying\((\d+)\)/);
                const maxLength = match ? match[1] : 'unknown';
                return {
                    message: 'Field value too long',
                    details: `One of the fields exceeds the maximum length of ${maxLength} characters`,
                    statusCode: 400
                };
            }
            // Handle other constraint violations
            if (rawMessage.includes('violates')) {
                return {
                    message: 'Data constraint violation',
                    details: 'The provided data violates database constraints',
                    statusCode: 400
                };
            }
            // Fallback for P2010
            return {
                message: 'Database operation failed',
                details: 'An error occurred while processing your request',
                statusCode: 400
            };
        }
        case 'P2014': {
            // Required relation violation
            const relationName = error.meta?.relation_name || 'relation';
            return {
                message: `Invalid ${relationName} relationship`,
                details: `The change would violate the required ${relationName} relationship`,
                statusCode: 400
            };
        }
        case 'P2015': {
            // Related record not found
            const relationName = error.meta?.relation_name || 'related record';
            return {
                message: `Related ${relationName} not found`,
                details: `A required ${relationName} could not be found`,
                statusCode: 400
            };
        }
        case 'P2016': {
            // Query interpretation error
            return {
                message: 'Invalid query parameters',
                details: 'The provided query parameters could not be interpreted',
                statusCode: 400
            };
        }
        case 'P2017': {
            // Records not connected
            const relationName = error.meta?.relation_name || 'records';
            return {
                message: `${relationName} are not connected`,
                details: `The specified ${relationName} are not properly connected`,
                statusCode: 400
            };
        }
        case 'P2018': {
            // Required connected records not found
            const relationName = error.meta?.relation_name || 'connected records';
            return {
                message: `Required ${relationName} not found`,
                details: `The required connected ${relationName} could not be found`,
                statusCode: 400
            };
        }
        case 'P2019': {
            // Input error
            return {
                message: 'Invalid input data',
                details: 'The provided input data is invalid or malformed',
                statusCode: 400
            };
        }
        case 'P2020': {
            // Value out of range
            const fieldName = error.meta?.field_name || 'field';
            return {
                message: `Value out of range for ${fieldName}`,
                details: `The provided value for ${fieldName} is outside the acceptable range`,
                statusCode: 400
            };
        }
        case 'P2021': {
            // Table does not exist
            const tableName = error.meta?.table || 'table';
            return {
                message: 'Resource not available',
                details: `The requested resource (${tableName}) is not available`,
                statusCode: 404
            };
        }
        case 'P2022': {
            // Column does not exist
            const columnName = error.meta?.column || 'field';
            return {
                message: `Invalid field: ${columnName}`,
                details: `The field '${columnName}' does not exist`,
                statusCode: 400
            };
        }
        default: {
            // Generic Prisma error
            return {
                message: 'Database operation failed',
                details: `A database error occurred (${errorCode})`,
                statusCode: 400
            };
        }
    }
}
// Custom error processor that handles all error types
export function processError(error, request) {
    // Enhanced error logging with request context
    logger.error({
        error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: error.code,
            statusCode: error.statusCode,
            meta: error.meta,
        },
        request: {
            method: request.method,
            url: request.url,
            query: request.query,
            params: request.params,
            body: request.body,
            userAgent: request.headers['user-agent'],
            ip: request.ip,
        },
    }, `Error occurred: ${error.message}`);
    let statusCode = 500;
    let message = 'Internal server error';
    let details;
    // DEBUG: Add logging to see which condition is matched
    console.log('=== ERROR DEBUG ===');
    console.log('Error name:', error.name);
    console.log('Error constructor:', error.constructor.name);
    console.log('Is NotFoundError?', error instanceof NotFoundError);
    console.log('Error statusCode:', error.statusCode);
    console.log('Error message:', error.message);
    // Handle Prisma errors first (most specific)
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.log('=== MATCHED: PrismaClientKnownRequestError');
        const prismaError = parsePrismaError(error, request.body);
        statusCode = prismaError.statusCode;
        message = prismaError.message;
        details = prismaError.details;
    }
    // Handle Prisma validation errors
    else if (error instanceof Prisma.PrismaClientValidationError) {
        console.log('=== MATCHED: PrismaClientValidationError');
        statusCode = 400;
        message = 'Invalid data provided';
        details = 'The provided data does not match the expected format';
        // Try to extract more specific information from the validation error
        if (error.message.includes('Argument')) {
            const argMatch = error.message.match(/Argument `(\w+)`/);
            if (argMatch) {
                const fieldName = argMatch[1];
                message = `Invalid value for field: ${fieldName}`;
                details = `The field '${fieldName}' contains invalid data`;
            }
        }
    }
    // Handle Zod validation errors
    else if (error instanceof ZodError) {
        console.log('=== MATCHED: ZodError');
        statusCode = 400;
        message = 'Validation failed';
        details = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    }
    // Handle custom error classes
    else if (error instanceof ValidationError) {
        console.log('=== MATCHED: ValidationError');
        statusCode = error.statusCode;
        message = error.message;
        details = error.details;
    }
    else if (error instanceof DatabaseError) {
        console.log('=== MATCHED: DatabaseError');
        statusCode = error.statusCode;
        message = error.message;
        details = error.details;
    }
    else if (error instanceof NotFoundError) {
        console.log('=== MATCHED: NotFoundError');
        statusCode = error.statusCode;
        message = error.message;
        details = 'The requested resource could not be found';
    }
    else if (error instanceof InvalidFieldError) {
        console.log('=== MATCHED: InvalidFieldError');
        statusCode = error.statusCode;
        message = error.message;
        details = `The following fields are not valid: ${error.invalidFields.join(', ')}`;
    }
    // Handle legacy Prisma/Database errors (for backward compatibility)
    else if (error.code && error.code.startsWith('P')) {
        console.log('=== MATCHED: Legacy Prisma error');
        const prismaError = parsePrismaError(error, request.body);
        statusCode = prismaError.statusCode;
        message = prismaError.message;
        details = prismaError.details;
    }
    // Handle specific error messages
    else if (error.message === 'Not Found') {
        console.log('=== MATCHED: Not Found message');
        statusCode = 404;
        message = 'Resource not found';
        details = 'The requested resource could not be found';
    }
    // Handle errors with custom statusCode property
    else if (error.statusCode && typeof error.statusCode === 'number') {
        console.log('=== MATCHED: Custom statusCode property');
        statusCode = error.statusCode;
        message = error.message || 'An error occurred';
        details = error.message;
    }
    // Handle generic errors
    else {
        console.log('=== MATCHED: Generic error');
        // Don't expose internal error details in production
        if (process.env.NODE_ENV === 'production') {
            message = 'An unexpected error occurred';
            details = 'Please try again later or contact support';
        }
        else {
            message = error.message || 'Internal server error';
            details = error.message;
        }
    }
    console.log('=== FINAL RESULT ===');
    console.log('Final statusCode:', statusCode);
    console.log('Final message:', message);
    console.log('Final details:', details);
    return createErrorResponse(message, details, statusCode);
}
// Custom async handler that catches all errors and processes them consistently
export function asyncHandler(fn) {
    return async (request, reply) => {
        try {
            return await fn(request, reply);
        }
        catch (error) {
            // Process the error using our custom error processor
            const errorResponse = processError(error, request);
            // Send the error response directly
            return reply.code(errorResponse.statusCode).send(errorResponse);
        }
    };
}
// Utility function to validate fields against database schema
export function validateFields(inputData, validFields) {
    const validData = {};
    const invalidFields = [];
    for (const [key, value] of Object.entries(inputData)) {
        if (validFields.includes(key)) {
            validData[key] = value;
        }
        else {
            invalidFields.push(key);
        }
    }
    return { validData, invalidFields };
}
// Legacy error handler for Fastify (simplified)
export async function errorHandler(error, request, reply) {
    // Process the error using our custom error processor
    const errorResponse = processError(error, request);
    // Send the error response
    return reply.code(errorResponse.statusCode).send(errorResponse);
}
// Utility function to validate integer IDs
export function validateIntegerId(id, resourceName = 'Resource') {
    // Check if ID is a valid integer
    if (!/^\d+$/.test(id)) {
        throw new ValidationError('Invalid ID format. ID must be an integer.', `The provided ID '${id}' is not a valid integer format.`);
    }
    const numericId = parseInt(id, 10);
    // Check if ID is a positive number
    if (numericId <= 0) {
        throw new ValidationError('Invalid ID value. ID must be a positive integer.', `The provided ID '${id}' must be greater than 0.`);
    }
    return numericId;
}
// Utility function to create consistent error responses for route handlers
export function createRouteErrorResponse(error, resourceName, id) {
    console.log(`=== ${resourceName.toUpperCase()} ERROR:`, error.message);
    if (error.message.includes('not found')) {
        return {
            response: {
                success: false,
                message: `${resourceName} with ID ${id} not found`,
                details: 'The requested resource could not be found',
                statusCode: 404
            },
            statusCode: 404
        };
    }
    if (error.message.includes('already exists')) {
        return {
            response: {
                success: false,
                message: error.message,
                details: 'Duplicate entry detected',
                statusCode: 400
            },
            statusCode: 400
        };
    }
    // Default error response
    return {
        response: {
            success: false,
            message: 'Internal server error',
            details: 'Something went wrong on the server',
            statusCode: 500
        },
        statusCode: 500
    };
}
// Utility function to validate ID and return error response if invalid
export function validateRouteId(id, resourceName) {
    if (!/^\d+$/.test(id)) {
        return {
            isValid: false,
            errorResponse: {
                success: false,
                message: 'Invalid ID format. ID must be an integer.',
                details: `The provided ID '${id}' is not a valid integer format.`,
                statusCode: 400
            },
            statusCode: 400
        };
    }
    return { isValid: true };
}
//# sourceMappingURL=errorHandler.js.map