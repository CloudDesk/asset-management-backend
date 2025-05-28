import { SupplierService } from '../services/supplier.service.js';
import { createSupplierSchema, updateSupplierSchema, upsertSupplierSchema, supplierParamsSchema } from '../schemas/supplier.schema.js';
import { createSuccessResponse, asyncHandler, ValidationError } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';
export class SupplierController {
    supplierService = new SupplierService();
    /**
     * Get all suppliers with dynamic filtering and pagination
     */
    getSuppliers = asyncHandler(async (request, reply) => {
        const { page = '1', limit = '10', ...filters } = request.query;
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
     * Get supplier by ID
     */
    getSupplier = asyncHandler(async (request, reply) => {
        const { id } = supplierParamsSchema.parse(request.params);
        const supplier = await this.supplierService.findById(id);
        const response = createSuccessResponse('Supplier retrieved successfully', supplier);
        return reply.code(200).send(response);
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
     * Update supplier by ID
     */
    updateSupplier = asyncHandler(async (request, reply) => {
        const { id } = supplierParamsSchema.parse(request.params);
        const data = updateSupplierSchema.parse(request.body);
        const supplier = await this.supplierService.update(id, data);
        const response = createSuccessResponse('Supplier updated successfully', supplier);
        return reply.code(200).send(response);
    });
    /**
     * Delete supplier by ID
     */
    deleteSupplier = asyncHandler(async (request, reply) => {
        const { id } = supplierParamsSchema.parse(request.params);
        await this.supplierService.delete(id);
        const response = createSuccessResponse('Supplier deleted successfully', null);
        return reply.code(200).send(response);
    });
    /**
     * Upsert supplier - create or update based on ID presence
     */
    upsertSupplier = asyncHandler(async (request, reply) => {
        const data = upsertSupplierSchema.parse(request.body);
        const supplier = await this.supplierService.upsert(data);
        const message = data.id ? 'Supplier updated successfully' : 'Supplier created successfully';
        const response = createSuccessResponse(message, supplier);
        return reply.code(200).send(response);
    });
    /**
     * Get supplier statistics
     */
    getSupplierStats = asyncHandler(async (request, reply) => {
        const { id } = supplierParamsSchema.parse(request.params);
        const stats = await this.supplierService.getSupplierStats(id);
        const response = createSuccessResponse('Supplier statistics retrieved successfully', stats);
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=supplier.controller.js.map