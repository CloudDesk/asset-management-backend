import { SamplePurchaseOrderService } from '../services/samplepurchaseorder.service.js';
import { createSamplePurchaseOrderSchema, updateSamplePurchaseOrderSchema, upsertSamplePurchaseOrderSchema, samplePurchaseOrderParamsSchema } from '../schemas/samplepurchaseorder.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { formatSamplePurchaseOrderForAPI, formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';
export class SamplePurchaseOrderController {
    samplePurchaseOrderService = new SamplePurchaseOrderService();
    /**
     * Get sample purchase orders with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    getSamplePurchaseOrders = asyncHandler(async (request, reply) => {
        // Get all query parameters as filters (not just schema-validated ones)
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        // Remove pagination params from filters
        const { page: _, limit: __, ...filters } = allFilters;
        const result = await this.samplePurchaseOrderService.findMany(filters, page, limit);
        // Format all sample purchase orders in the result
        const formattedData = formatEntitiesForAPI(result.data, 'samplepurchaseorder');
        const response = createSuccessResponse('Sample purchase orders retrieved successfully', formattedData);
        return reply.code(200).send({
            ...response,
            pagination: result.pagination,
            meta: {
                filters: Object.keys(filters),
                total: result.pagination.total,
                filtered: Object.keys(filters).length > 0
            }
        });
    });
    /**
     * Get single sample purchase order by ID
     */
    getSamplePurchaseOrder = asyncHandler(async (request, reply) => {
        const { id } = samplePurchaseOrderParamsSchema.parse(request.params);
        const samplePurchaseOrder = await this.samplePurchaseOrderService.findById(id);
        const response = createSuccessResponse('Sample purchase order retrieved successfully', formatSamplePurchaseOrderForAPI(samplePurchaseOrder));
        return reply.code(200).send(response);
    });
    /**
     * Create new sample purchase order with dynamic field support
     */
    createSamplePurchaseOrder = asyncHandler(async (request, reply) => {
        const data = createSamplePurchaseOrderSchema.parse(request.body);
        const samplePurchaseOrder = await this.samplePurchaseOrderService.create(data);
        const response = createSuccessResponse('Sample purchase order created successfully', formatSamplePurchaseOrderForAPI(samplePurchaseOrder));
        return reply.code(201).send(response);
    });
    /**
     * Update sample purchase order with dynamic field support
     */
    updateSamplePurchaseOrder = asyncHandler(async (request, reply) => {
        const { id } = samplePurchaseOrderParamsSchema.parse(request.params);
        const data = updateSamplePurchaseOrderSchema.parse(request.body);
        const samplePurchaseOrder = await this.samplePurchaseOrderService.update(id, data);
        const response = createSuccessResponse('Sample purchase order updated successfully', formatSamplePurchaseOrderForAPI(samplePurchaseOrder));
        return reply.code(200).send(response);
    });
    /**
     * Delete sample purchase order by ID
     */
    deleteSamplePurchaseOrder = asyncHandler(async (request, reply) => {
        const { id } = samplePurchaseOrderParamsSchema.parse(request.params);
        await this.samplePurchaseOrderService.delete(id);
        const response = createSuccessResponse('Sample purchase order deleted successfully', null);
        return reply.code(200).send(response);
    });
    /**
     * Upsert sample purchase order - create or update based on ID presence
     */
    upsertSamplePurchaseOrder = asyncHandler(async (request, reply) => {
        const data = upsertSamplePurchaseOrderSchema.parse(request.body);
        const samplePurchaseOrder = await this.samplePurchaseOrderService.upsert(data);
        const message = data.id ? 'Sample purchase order updated successfully' : 'Sample purchase order created successfully';
        const response = createSuccessResponse(message, formatSamplePurchaseOrderForAPI(samplePurchaseOrder));
        return reply.code(200).send(response);
    });
    /**
     * Get sample purchase orders by supplier ID
     */
    getSamplePurchaseOrdersBySupplier = asyncHandler(async (request, reply) => {
        const { supplierId } = request.params;
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        const result = await this.samplePurchaseOrderService.findBySupplier(supplierId, page, limit);
        // Format the sample purchase orders data
        const formattedResult = {
            ...result,
            data: formatEntitiesForAPI(result.data, 'samplepurchaseorder')
        };
        const response = createSuccessResponse('Sample purchase orders by supplier retrieved successfully', {
            supplierId,
            ...formattedResult
        });
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=samplepurchaseorder.controller.js.map