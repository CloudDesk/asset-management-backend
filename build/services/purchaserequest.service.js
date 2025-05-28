import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class PurchaseRequestService {
    /**
     * Find purchase requests with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic purchase request findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the dynamic filtering system that adapts to any database schema
            const { data: purchaseRequests, total } = await dynamicFindManyWithFilters('purchaserequest', filters, {
                skip,
                take,
                useAllColumns: true // Get all available columns
            });
            logger.info({
                purchaseRequestCount: purchaseRequests.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: purchaseRequests.length > 0 ? Object.keys(purchaseRequests[0]) : []
            }, 'Dynamic purchase request findMany with filters completed');
            return createPaginationResult(purchaseRequests, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in dynamic purchase request findMany operation');
            throw error;
        }
    }
    /**
     * Find purchase request by ID using dynamic operations
     */
    async findById(id) {
        try {
            logger.debug({ purchaseRequestId: id }, 'Starting dynamic purchase request findById operation');
            const purchaseRequest = await dynamicFindUnique('purchaserequest', { id });
            if (!purchaseRequest) {
                throw new Error('Purchase request not found');
            }
            logger.debug({
                purchaseRequestId: id,
                availableFields: Object.keys(purchaseRequest)
            }, 'Dynamic purchase request findById completed');
            return purchaseRequest;
        }
        catch (error) {
            logger.error({ error, purchaseRequestId: id }, 'Error in purchase request findById operation');
            throw error;
        }
    }
    /**
     * Create new purchase request with dynamic field support
     * Only uses fields that exist in the database schema
     */
    async create(data) {
        try {
            logger.debug({ originalData: data }, 'Starting dynamic purchase request create operation');
            // Generate request number if not provided
            if (!data.requestNumber && !data.request_number) {
                const requestNumber = `PR-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
                data.requestNumber = requestNumber;
                data.request_number = requestNumber; // Also set snake_case version
            }
            // Set request date if not provided
            if (!data.requestDate && !data.request_date) {
                const now = new Date().toISOString();
                data.requestDate = now;
                data.request_date = now; // Also set snake_case version
            }
            const purchaseRequest = await dynamicCreate('purchaserequest', data);
            if (!purchaseRequest) {
                throw new Error('Failed to create purchase request - no valid fields provided');
            }
            logger.info({
                purchaseRequestId: purchaseRequest.id,
                requestNumber: purchaseRequest.requestNumber || purchaseRequest.request_number,
                availableFields: Object.keys(purchaseRequest)
            }, 'Dynamic purchase request create completed');
            return purchaseRequest;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in purchase request create operation');
            throw error;
        }
    }
    /**
     * Update purchase request with dynamic field support
     */
    async update(id, data) {
        try {
            // Check if purchase request exists first
            await this.findById(id);
            logger.debug({ originalData: data, purchaseRequestId: id }, 'Starting dynamic purchase request update operation');
            const purchaseRequest = await dynamicUpdate('purchaserequest', { id }, data);
            if (!purchaseRequest) {
                throw new Error('Failed to update purchase request - no valid fields provided');
            }
            logger.info({
                purchaseRequestId: id,
                availableFields: Object.keys(purchaseRequest)
            }, 'Dynamic purchase request update completed');
            return purchaseRequest;
        }
        catch (error) {
            logger.error({ error, data, purchaseRequestId: id }, 'Error in purchase request update operation');
            throw error;
        }
    }
    /**
     * Delete purchase request by ID
     */
    async delete(id) {
        try {
            // Check if purchase request exists first
            await this.findById(id);
            logger.debug({ purchaseRequestId: id }, 'Starting dynamic purchase request delete operation');
            const success = await dynamicDelete('purchaserequest', { id });
            if (!success) {
                throw new Error('Failed to delete purchase request');
            }
            logger.info({ purchaseRequestId: id }, 'Dynamic purchase request delete completed successfully');
        }
        catch (error) {
            logger.error({ error, purchaseRequestId: id }, 'Error in purchase request delete operation');
            throw error;
        }
    }
    /**
     * Upsert purchase request - create if ID not provided, update if ID exists
     */
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing purchase request
                logger.debug({ purchaseRequestId: id, data: updateData }, 'Upserting existing purchase request');
                return this.update(id, updateData);
            }
            else {
                // Create new purchase request
                logger.debug({ data: updateData }, 'Upserting new purchase request');
                return this.create(updateData);
            }
        }
        catch (error) {
            logger.error({ error, data }, 'Error in purchase request upsert operation');
            throw error;
        }
    }
    /**
     * Find purchase requests by supplier ID
     */
    async findBySupplier(supplierId, page = 1, limit = 10) {
        try {
            logger.debug({ supplierId, page, limit }, 'Finding purchase requests by supplier');
            const filters = {
                supplier_id: supplierId,
                supplierId: supplierId // Try both naming conventions
            };
            const result = await this.findMany(filters, page, limit);
            logger.debug({
                supplierId,
                purchaseRequestCount: result.data.length,
                total: result.pagination.total
            }, 'Found purchase requests by supplier');
            return result;
        }
        catch (error) {
            logger.error({ error, supplierId }, 'Error finding purchase requests by supplier');
            throw error;
        }
    }
    /**
     * Find purchase requests by requester
     */
    async findByRequester(requestedBy, page = 1, limit = 10) {
        try {
            logger.debug({ requestedBy, page, limit }, 'Finding purchase requests by requester');
            const filters = {
                requested_by: requestedBy,
                requestedBy: requestedBy // Try both naming conventions
            };
            const result = await this.findMany(filters, page, limit);
            logger.debug({
                requestedBy,
                purchaseRequestCount: result.data.length,
                total: result.pagination.total
            }, 'Found purchase requests by requester');
            return result;
        }
        catch (error) {
            logger.error({ error, requestedBy }, 'Error finding purchase requests by requester');
            throw error;
        }
    }
    /**
     * Approve purchase request
     */
    async approve(id, approvedBy, notes) {
        try {
            logger.debug({ purchaseRequestId: id, approvedBy, notes }, 'Approving purchase request');
            const updateData = {
                status: 'approved',
                request_status: 'approved', // Also try snake_case
                approvedBy,
                approved_by: approvedBy, // Also try snake_case
                approvedDate: new Date().toISOString(),
                approved_date: new Date().toISOString() // Also try snake_case
            };
            if (notes) {
                updateData.notes = notes;
                updateData.request_notes = notes; // Also try snake_case
            }
            const purchaseRequest = await this.update(id, updateData);
            logger.info({
                purchaseRequestId: id,
                approvedBy,
                approvedDate: updateData.approvedDate
            }, 'Purchase request approved successfully');
            return purchaseRequest;
        }
        catch (error) {
            logger.error({ error, purchaseRequestId: id, approvedBy }, 'Error approving purchase request');
            throw error;
        }
    }
    /**
     * Reject purchase request
     */
    async reject(id, rejectedBy, notes) {
        try {
            logger.debug({ purchaseRequestId: id, rejectedBy, notes }, 'Rejecting purchase request');
            const updateData = {
                status: 'rejected',
                request_status: 'rejected', // Also try snake_case
                approvedBy: rejectedBy, // Use same field for rejected by
                approved_by: rejectedBy, // Also try snake_case
                approvedDate: new Date().toISOString(), // Use same field for rejection date
                approved_date: new Date().toISOString() // Also try snake_case
            };
            if (notes) {
                updateData.notes = notes;
                updateData.request_notes = notes; // Also try snake_case
            }
            const purchaseRequest = await this.update(id, updateData);
            logger.info({
                purchaseRequestId: id,
                rejectedBy,
                rejectedDate: updateData.approvedDate
            }, 'Purchase request rejected successfully');
            return purchaseRequest;
        }
        catch (error) {
            logger.error({ error, purchaseRequestId: id, rejectedBy }, 'Error rejecting purchase request');
            throw error;
        }
    }
}
//# sourceMappingURL=purchaserequest.service.js.map