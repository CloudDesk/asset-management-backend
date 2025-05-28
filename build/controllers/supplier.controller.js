import { SupplierService } from '../services/supplier.service.js';
import { createSupplierSchema, updateSupplierSchema, upsertSupplierSchema } from '../schemas/supplier.schema.js';
import { createSuccessResponse, asyncHandler, ValidationError, NotFoundError, validateIntegerId } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';
export class SupplierController {
    supplierService = new SupplierService();
    /**
     * Get all suppliers with dynamic filtering and pagination
     */
    getSuppliers = asyncHandler(async (request, reply) => {
        // Safely extract and normalize query parameters
        const queryParams = request.query;
        // Helper function to safely extract string values from query parameters
        const getStringParam = (value) => {
            if (value === undefined || value === null)
                return undefined;
            if (typeof value === 'string')
                return value;
            if (Array.isArray(value))
                return value[0]?.toString();
            if (typeof value === 'object')
                return value.toString();
            return value.toString();
        };
        const page = getStringParam(queryParams.page) || '1';
        const limit = getStringParam(queryParams.limit) || '10';
        // Extract and normalize all other filters
        const filters = {};
        for (const [key, value] of Object.entries(queryParams)) {
            if (key !== 'page' && key !== 'limit') {
                const stringValue = getStringParam(value);
                if (stringValue !== undefined && stringValue !== '') {
                    filters[key] = stringValue;
                }
            }
        }
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        if (isNaN(pageNum) || pageNum < 1) {
            throw new ValidationError('Invalid page number', 'Page must be a positive integer');
        }
        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            throw new ValidationError('Invalid limit', 'Limit must be between 1 and 100');
        }
        const result = await this.supplierService.findMany(filters, pageNum, limitNum);
        const response = createSuccessResponse('Suppliers retrieved successfully', result.data);
        return reply.code(200).send({
            ...response,
            pagination: result.pagination,
            meta: {
                filters: Object.keys(filters),
                total: result.pagination.total,
                filtered: Object.keys(filters).length > 0
            },
        });
    });
    /**
     * Get supplier by ID with proper validation
     */
    getSupplier = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        console.log('=== DEBUG: getSupplier called with ID:', id);
        // Validate ID format
        validateIntegerId(id, 'Supplier');
        try {
            const supplier = await this.supplierService.findById(id);
            const response = createSuccessResponse('Supplier retrieved successfully', supplier);
            return reply.code(200).send(response);
        }
        catch (error) {
            console.log('=== DEBUG: Error caught in getSupplier:', error.message);
            // Debug: Manual error handling to see what's happening
            if (error instanceof NotFoundError) {
                console.log('=== DEBUG: NotFoundError detected');
                // Try a simple direct response
                const simpleError = {
                    success: false,
                    message: "TESTING: " + error.message,
                    statusCode: 404,
                    details: 'TESTING: The requested resource could not be found'
                };
                console.log('=== DEBUG: Sending error response:', JSON.stringify(simpleError));
                return reply.code(404).send(simpleError);
            }
            // Re-throw other errors to be handled by asyncHandler
            throw error;
        }
    });
    /**
     * Create new supplier with dynamic field support
     */
    createSupplier = asyncHandler(async (request, reply) => {
        // Log the incoming request for debugging
        logger.debug({
            body: request.body,
            url: request.url,
            method: request.method
        }, 'Supplier create request received');
        const data = createSupplierSchema.parse(request.body);
        const supplier = await this.supplierService.create(data);
        const response = createSuccessResponse('Supplier created successfully', supplier);
        return reply.code(201).send(response);
    });
    /**
     * Update supplier by ID with proper validation
     */
    updateSupplier = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        // Validate ID format
        validateIntegerId(id, 'Supplier');
        const data = updateSupplierSchema.parse(request.body);
        const supplier = await this.supplierService.update(id, data);
        const response = createSuccessResponse('Supplier updated successfully', supplier);
        return reply.code(200).send(response);
    });
    /**
     * Delete supplier by ID with proper validation
     */
    deleteSupplier = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        // Validate ID format
        validateIntegerId(id, 'Supplier');
        await this.supplierService.delete(id);
        const response = createSuccessResponse('Supplier deleted successfully', null);
        return reply.code(200).send(response);
    });
    /**
     * Upsert supplier - create or update based on ID presence
     */
    upsertSupplier = asyncHandler(async (request, reply) => {
        const data = upsertSupplierSchema.parse(request.body);
        // If ID is provided, validate its format
        if (data.id) {
            validateIntegerId(data.id, 'Supplier');
        }
        const supplier = await this.supplierService.upsert(data);
        const message = data.id ? 'Supplier updated successfully' : 'Supplier created successfully';
        const response = createSuccessResponse(message, supplier);
        return reply.code(200).send(response);
    });
    /**
     * Get supplier statistics with proper validation
     */
    getSupplierStats = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        // Validate ID format
        validateIntegerId(id, 'Supplier');
        const stats = await this.supplierService.getSupplierStats(id);
        const response = createSuccessResponse('Supplier statistics retrieved successfully', stats);
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=supplier.controller.js.map