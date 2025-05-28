import { PurchaseRequestService } from '../services/purchaserequest.service.js';
import { createPurchaseRequestSchema, updatePurchaseRequestSchema, upsertPurchaseRequestSchema, purchaseRequestParamsSchema } from '../schemas/purchaserequest.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, asyncHandler, ValidationError } from '../utils/errorHandler.js';
export class PurchaseRequestController {
    purchaseRequestService = new PurchaseRequestService();
    /**
     * Get purchase requests with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    getPurchaseRequests = asyncHandler(async (request, reply) => {
        // Get all query parameters as filters (not just schema-validated ones)
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        // Remove pagination params from filters
        const { page: _, limit: __, ...filters } = allFilters;
        const result = await this.purchaseRequestService.findMany(filters, page, limit);
        const response = createSuccessResponse('Purchase requests retrieved successfully', result.data);
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
     * Get single purchase request by ID
     */
    getPurchaseRequest = asyncHandler(async (request, reply) => {
        const { id } = purchaseRequestParamsSchema.parse(request.params);
        const purchaseRequest = await this.purchaseRequestService.findById(id);
        const response = createSuccessResponse('Purchase request retrieved successfully', purchaseRequest);
        return reply.code(200).send(response);
    });
    /**
     * Create new purchase request with dynamic field support
     */
    createPurchaseRequest = asyncHandler(async (request, reply) => {
        const data = createPurchaseRequestSchema.parse(request.body);
        const purchaseRequest = await this.purchaseRequestService.create(data);
        const response = createSuccessResponse('Purchase request created successfully', purchaseRequest);
        return reply.code(201).send(response);
    });
    /**
     * Update purchase request with dynamic field support
     */
    updatePurchaseRequest = asyncHandler(async (request, reply) => {
        const { id } = purchaseRequestParamsSchema.parse(request.params);
        const data = updatePurchaseRequestSchema.parse(request.body);
        const purchaseRequest = await this.purchaseRequestService.update(id, data);
        const response = createSuccessResponse('Purchase request updated successfully', purchaseRequest);
        return reply.code(200).send(response);
    });
    /**
     * Delete purchase request by ID
     */
    deletePurchaseRequest = asyncHandler(async (request, reply) => {
        const { id } = purchaseRequestParamsSchema.parse(request.params);
        await this.purchaseRequestService.delete(id);
        const response = createSuccessResponse('Purchase request deleted successfully', null);
        return reply.code(200).send(response);
    });
    /**
     * Upsert purchase request - create or update based on ID presence
     */
    upsertPurchaseRequest = asyncHandler(async (request, reply) => {
        const data = upsertPurchaseRequestSchema.parse(request.body);
        const purchaseRequest = await this.purchaseRequestService.upsert(data);
        const message = data.id ? 'Purchase request updated successfully' : 'Purchase request created successfully';
        const response = createSuccessResponse(message, purchaseRequest);
        return reply.code(200).send(response);
    });
    /**
     * Get purchase requests by supplier ID
     */
    getPurchaseRequestsBySupplier = asyncHandler(async (request, reply) => {
        const { supplierId } = request.params;
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        const result = await this.purchaseRequestService.findBySupplier(supplierId, page, limit);
        const response = createSuccessResponse('Purchase requests by supplier retrieved successfully', {
            supplierId,
            ...result
        });
        return reply.code(200).send(response);
    });
    /**
     * Get purchase requests by requester
     */
    getPurchaseRequestsByRequester = asyncHandler(async (request, reply) => {
        const { requestedBy } = request.params;
        const allFilters = request.query || {};
        const { page, limit } = getPaginationParams(allFilters);
        const result = await this.purchaseRequestService.findByRequester(requestedBy, page, limit);
        const response = createSuccessResponse('Purchase requests by requester retrieved successfully', {
            requestedBy,
            ...result
        });
        return reply.code(200).send(response);
    });
    /**
     * Approve purchase request
     */
    approvePurchaseRequest = asyncHandler(async (request, reply) => {
        const { id } = purchaseRequestParamsSchema.parse(request.params);
        const { approvedBy, notes } = request.body;
        if (!approvedBy) {
            throw new ValidationError('Approved by is required');
        }
        const purchaseRequest = await this.purchaseRequestService.approve(id, approvedBy, notes);
        const response = createSuccessResponse('Purchase request approved successfully', purchaseRequest);
        return reply.code(200).send(response);
    });
    /**
     * Reject purchase request
     */
    rejectPurchaseRequest = asyncHandler(async (request, reply) => {
        const { id } = purchaseRequestParamsSchema.parse(request.params);
        const { rejectedBy, notes } = request.body;
        if (!rejectedBy) {
            throw new ValidationError('Rejected by is required');
        }
        const purchaseRequest = await this.purchaseRequestService.reject(id, rejectedBy, notes);
        const response = createSuccessResponse('Purchase request rejected successfully', purchaseRequest);
        return reply.code(200).send(response);
    });
}
//# sourceMappingURL=purchaserequest.controller.js.map