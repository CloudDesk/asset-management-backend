import { SamplePurchaseRequestService } from '../services/samplepurchaserequest.service.js';
import { createSamplePurchaseRequestSchema, updateSamplePurchaseRequestSchema, upsertSamplePurchaseRequestSchema, samplePurchaseRequestParamsSchema } from '../schemas/samplepurchaserequest.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { formatSamplePurchaseRequestForAPI, formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';
export class SamplePurchaseRequestController {
    samplePurchaseRequestService = new SamplePurchaseRequestService();
    /**
     * Get sample purchase requests with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    getSamplePurchaseRequests = asyncHandler(async (request, reply) => {
        // Get all query parameters as filters (not just schema-validated ones)
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        // Remove pagination params from filters
        const { page: _, limit: __, ...filters } = allFilters;
        const result = await this.samplePurchaseRequestService.findMany(filters, page, limit);
        // Format all sample purchase requests in the result
        const formattedData = formatEntitiesForAPI(result.data, 'samplepurchaserequest');
        const response = createSuccessResponse('Sample purchase requests retrieved successfully', formattedData);
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
     * Get single sample purchase request by ID
     */
    getSamplePurchaseRequest = asyncHandler(async (request, reply) => {
        const { id } = samplePurchaseRequestParamsSchema.parse(request.params);
        const samplePurchaseRequest = await this.samplePurchaseRequestService.findById(id);
        const response = createSuccessResponse('Sample purchase request retrieved successfully', formatSamplePurchaseRequestForAPI(samplePurchaseRequest));
        return reply.code(200).send(response);
    });
    /**
     * Create new sample purchase request with dynamic field support
     */
    createSamplePurchaseRequest = asyncHandler(async (request, reply) => {
        const data = createSamplePurchaseRequestSchema.parse(request.body);
        const samplePurchaseRequest = await this.samplePurchaseRequestService.create(data);
        const response = createSuccessResponse('Sample purchase request created successfully', formatSamplePurchaseRequestForAPI(samplePurchaseRequest));
        return reply.code(201).send(response);
    });
    /**
     * Update sample purchase request with dynamic field support
     */
    updateSamplePurchaseRequest = asyncHandler(async (request, reply) => {
        const { id } = samplePurchaseRequestParamsSchema.parse(request.params);
        const data = updateSamplePurchaseRequestSchema.parse(request.body);
        const samplePurchaseRequest = await this.samplePurchaseRequestService.update(id, data);
        const response = createSuccessResponse('Sample purchase request updated successfully', formatSamplePurchaseRequestForAPI(samplePurchaseRequest));
        return reply.code(200).send(response);
    });
    /**
     * Delete sample purchase request by ID
     */
    deleteSamplePurchaseRequest = asyncHandler(async (request, reply) => {
        const { id } = samplePurchaseRequestParamsSchema.parse(request.params);
        await this.samplePurchaseRequestService.delete(id);
        const response = createSuccessResponse('Sample purchase request deleted successfully', null);
        return reply.code(200).send(response);
    });
    /**
     * Upsert sample purchase request - create or update based on ID presence
     */
    upsertSamplePurchaseRequest = asyncHandler(async (request, reply) => {
        const data = upsertSamplePurchaseRequestSchema.parse(request.body);
        const samplePurchaseRequest = await this.samplePurchaseRequestService.upsert(data);
        const message = data.id ? 'Sample purchase request updated successfully' : 'Sample purchase request created successfully';
        const response = createSuccessResponse(message, formatSamplePurchaseRequestForAPI(samplePurchaseRequest));
        return reply.code(200).send(response);
    });
    /**
     * Get sample purchase requests by supplier ID
     */
    getSamplePurchaseRequestsBySupplier = asyncHandler(async (request, reply) => {
        const { supplierId } = request.params;
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        const result = await this.samplePurchaseRequestService.findBySupplier(supplierId, page, limit);
        // Format the sample purchase requests data
        const formattedResult = {
            ...result,
            data: formatEntitiesForAPI(result.data, 'samplepurchaserequest')
        };
        const response = createSuccessResponse('Sample purchase requests by supplier retrieved successfully', {
            supplierId,
            ...formattedResult
        });
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=samplepurchaserequest.controller.js.map