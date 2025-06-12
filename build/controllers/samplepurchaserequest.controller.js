import { SamplePurchaseRequestService } from '../services/samplepurchaserequest.service.js';
import { createSamplePurchaseRequestSchema, updateSamplePurchaseRequestSchema, upsertSamplePurchaseRequestSchema, samplePurchaseRequestParamsSchema, samplePurchaseRequestQuerySchema } from '../schemas/samplepurchaserequest.schema.js';
import { createSuccessResponse, asyncHandler, ValidationError } from '../utils/errorHandler.js';
import { formatSamplePurchaseRequestForAPI, formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class SamplePurchaseRequestController {
    samplePurchaseRequestService = new SamplePurchaseRequestService();
    /**
     * Get sample purchase requests with optimized filtering and pagination
     * Supports any field that exists in the database with enhanced performance
     */
    getSamplePurchaseRequests = asyncHandler(async (request, reply) => {
        const startTime = Date.now();
        try {
            // Parse and validate query parameters with the optimized schema
            const queryParams = samplePurchaseRequestQuerySchema.parse(request.query || {});
            // Extract pagination and sorting parameters
            const { page, limit, sortBy, sortOrder, ...filters } = queryParams;
            // Remove empty/undefined filters for better performance
            const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([_, value]) => value !== undefined && value !== ''));
            logger.debug({
                filters: cleanFilters,
                page,
                limit,
                sortBy,
                sortOrder,
                requestId: request.id
            }, 'Processing getSamplePurchaseRequests request');
            const result = await this.samplePurchaseRequestService.findMany(cleanFilters, page, limit, sortBy, sortOrder);
            // Format all sample purchase requests in the result efficiently
            const formattedData = formatEntitiesForAPI(result.data, 'samplepurchaserequest');
            const response = createSuccessResponse('Sample purchase requests retrieved successfully', formattedData);
            // Add performance metrics and enhanced metadata
            const responseWithMeta = {
                ...response,
                pagination: result.pagination,
                meta: {
                    filters: Object.keys(cleanFilters),
                    total: result.pagination.total,
                    filtered: Object.keys(cleanFilters).length > 0,
                    sortBy,
                    sortOrder,
                    responseTime: Date.now() - startTime,
                    cached: false // This will be set by the service layer
                }
            };
            // Set appropriate cache headers for better performance
            reply.header('Cache-Control', 'public, max-age=60'); // 1 minute cache
            return reply.code(200).send(responseWithMeta);
        }
        catch (error) {
            logger.error({ error, requestId: request.id }, 'Error in getSamplePurchaseRequests');
            throw error;
        }
    });
    /**
     * Get single sample purchase request by ID with optimized caching
     */
    getSamplePurchaseRequest = asyncHandler(async (request, reply) => {
        const startTime = Date.now();
        try {
            const { id } = samplePurchaseRequestParamsSchema.parse(request.params);
            logger.debug({ samplePurchaseRequestId: id, requestId: request.id }, 'Processing getSamplePurchaseRequest request');
            const samplePurchaseRequest = await this.samplePurchaseRequestService.findById(id);
            const formattedData = formatSamplePurchaseRequestForAPI(samplePurchaseRequest);
            const response = createSuccessResponse('Sample purchase request retrieved successfully', formattedData);
            // Add performance metadata
            const responseWithMeta = {
                ...response,
                meta: {
                    responseTime: Date.now() - startTime,
                    cached: false // This will be set by the service layer
                }
            };
            // Set cache headers for individual records
            reply.header('Cache-Control', 'public, max-age=300'); // 5 minutes cache
            reply.header('ETag', `"${id}-${samplePurchaseRequest.modifieddate || samplePurchaseRequest.createddate}"`);
            return reply.code(200).send(responseWithMeta);
        }
        catch (error) {
            logger.error({ error, requestId: request.id }, 'Error in getSamplePurchaseRequest');
            throw error;
        }
    });
    /**
     * Create new sample purchase request with enhanced validation
     */
    createSamplePurchaseRequest = asyncHandler(async (request, reply) => {
        const startTime = Date.now();
        try {
            // Enhanced validation with the optimized schema
            const data = createSamplePurchaseRequestSchema.parse(request.body);
            logger.info({
                companyname: data.companyname,
                supplierid: data.supplierid,
                itemsCount: data.items?.length || 0,
                requestId: request.id
            }, 'Creating new sample purchase request');
            const samplePurchaseRequest = await this.samplePurchaseRequestService.create(data);
            const formattedData = formatSamplePurchaseRequestForAPI(samplePurchaseRequest);
            const response = createSuccessResponse('Sample purchase request created successfully', formattedData);
            // Add performance metadata
            const responseWithMeta = {
                ...response,
                meta: {
                    responseTime: Date.now() - startTime,
                    created: true
                }
            };
            // Set location header for the created resource
            reply.header('Location', `/v1/samplepurchaserequests/${samplePurchaseRequest.id}`);
            return reply.code(201).send(responseWithMeta);
        }
        catch (error) {
            logger.error({ error, requestId: request.id }, 'Error in createSamplePurchaseRequest');
            throw error;
        }
    });
    /**
     * Update sample purchase request with optimized validation
     */
    updateSamplePurchaseRequest = asyncHandler(async (request, reply) => {
        const startTime = Date.now();
        try {
            const { id } = samplePurchaseRequestParamsSchema.parse(request.params);
            const data = updateSamplePurchaseRequestSchema.parse(request.body);
            logger.info({
                samplePurchaseRequestId: id,
                updateFields: Object.keys(data),
                requestId: request.id
            }, 'Updating sample purchase request');
            const samplePurchaseRequest = await this.samplePurchaseRequestService.update(id, data);
            const formattedData = formatSamplePurchaseRequestForAPI(samplePurchaseRequest);
            const response = createSuccessResponse('Sample purchase request updated successfully', formattedData);
            // Add performance metadata
            const responseWithMeta = {
                ...response,
                meta: {
                    responseTime: Date.now() - startTime,
                    updated: true,
                    fieldsUpdated: Object.keys(data)
                }
            };
            // Update ETag for the modified resource
            reply.header('ETag', `"${id}-${samplePurchaseRequest.modifieddate}"`);
            return reply.code(200).send(responseWithMeta);
        }
        catch (error) {
            logger.error({ error, requestId: request.id }, 'Error in updateSamplePurchaseRequest');
            throw error;
        }
    });
    /**
     * Delete sample purchase request by ID with optimized logging
     */
    deleteSamplePurchaseRequest = asyncHandler(async (request, reply) => {
        const startTime = Date.now();
        try {
            const { id } = samplePurchaseRequestParamsSchema.parse(request.params);
            logger.info({
                samplePurchaseRequestId: id,
                requestId: request.id
            }, 'Deleting sample purchase request');
            await this.samplePurchaseRequestService.delete(id);
            const response = createSuccessResponse('Sample purchase request deleted successfully', null);
            // Add performance metadata
            const responseWithMeta = {
                ...response,
                meta: {
                    responseTime: Date.now() - startTime,
                    deleted: true
                }
            };
            return reply.code(200).send(responseWithMeta);
        }
        catch (error) {
            logger.error({ error, requestId: request.id }, 'Error in deleteSamplePurchaseRequest');
            throw error;
        }
    });
    /**
     * Upsert sample purchase request with enhanced logic
     */
    upsertSamplePurchaseRequest = asyncHandler(async (request, reply) => {
        const startTime = Date.now();
        try {
            const data = upsertSamplePurchaseRequestSchema.parse(request.body);
            const isUpdate = !!data.id;
            logger.info({
                operation: isUpdate ? 'update' : 'create',
                samplePurchaseRequestId: data.id,
                requestId: request.id
            }, 'Upserting sample purchase request');
            const samplePurchaseRequest = await this.samplePurchaseRequestService.upsert(data);
            const message = isUpdate
                ? 'Sample purchase request updated successfully'
                : 'Sample purchase request created successfully';
            const formattedData = formatSamplePurchaseRequestForAPI(samplePurchaseRequest);
            const response = createSuccessResponse(message, formattedData);
            // Add performance metadata
            const responseWithMeta = {
                ...response,
                meta: {
                    responseTime: Date.now() - startTime,
                    operation: isUpdate ? 'update' : 'create'
                }
            };
            // Set appropriate status code and headers
            const statusCode = isUpdate ? 200 : 201;
            if (!isUpdate) {
                reply.header('Location', `/v1/samplepurchaserequests/${samplePurchaseRequest.id}`);
            }
            return reply.code(statusCode).send(responseWithMeta);
        }
        catch (error) {
            logger.error({ error, requestId: request.id }, 'Error in upsertSamplePurchaseRequest');
            throw error;
        }
    });
    /**
     * Get sample purchase requests by supplier ID with enhanced performance
     */
    getSamplePurchaseRequestsBySupplier = asyncHandler(async (request, reply) => {
        const startTime = Date.now();
        try {
            const { supplierId } = request.params;
            // Validate supplier ID
            if (!supplierId || typeof supplierId !== 'string') {
                throw new ValidationError('Invalid supplier ID: must be a non-empty string');
            }
            // Parse query parameters with the optimized schema
            const queryParams = samplePurchaseRequestQuerySchema.parse(request.query || {});
            const { page, limit, sortBy, sortOrder } = queryParams;
            logger.debug({
                supplierId,
                page,
                limit,
                sortBy,
                sortOrder,
                requestId: request.id
            }, 'Processing getSamplePurchaseRequestsBySupplier request');
            const result = await this.samplePurchaseRequestService.findBySupplier(supplierId, page, limit, sortBy, sortOrder);
            // Format the sample purchase requests data efficiently
            const formattedData = formatEntitiesForAPI(result.data, 'samplepurchaserequest');
            const response = createSuccessResponse('Sample purchase requests by supplier retrieved successfully', {
                supplierId,
                data: formattedData,
                pagination: result.pagination,
                meta: {
                    total: result.pagination.total,
                    sortBy,
                    sortOrder,
                    responseTime: Date.now() - startTime,
                    cached: false // This will be set by the service layer
                }
            });
            // Set cache headers for supplier queries
            reply.header('Cache-Control', 'public, max-age=180'); // 3 minutes cache
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error, requestId: request.id }, 'Error in getSamplePurchaseRequestsBySupplier');
            throw error;
        }
    });
    /**
     * Get service statistics for monitoring and debugging
     */
    getStats = asyncHandler(async (request, reply) => {
        try {
            const stats = await this.samplePurchaseRequestService.getStats();
            const response = createSuccessResponse('Service statistics retrieved successfully', {
                service: 'SamplePurchaseRequestService',
                ...stats,
                timestamp: new Date().toISOString()
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error, requestId: request.id }, 'Error in getStats');
            throw error;
        }
    });
    /**
     * Clear service cache (for admin/debugging purposes)
     */
    clearCache = asyncHandler(async (request, reply) => {
        try {
            this.samplePurchaseRequestService.clearAllCache();
            const response = createSuccessResponse('Cache cleared successfully', {
                timestamp: new Date().toISOString()
            });
            logger.info({ requestId: request.id }, 'Cache cleared manually');
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error, requestId: request.id }, 'Error in clearCache');
            throw error;
        }
    });
}
//# sourceMappingURL=samplepurchaserequest.controller.js.map