import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class PurchaseOrderService {
    /**
     * Find purchase orders with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic purchase order findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the dynamic filtering system that adapts to any database schema
            const { data: purchaseOrders, total } = await dynamicFindManyWithFilters('purchaseorder', filters, {
                skip,
                take,
                useAllColumns: true // Get all available columns
            });
            logger.info({
                purchaseOrderCount: purchaseOrders.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: purchaseOrders.length > 0 ? Object.keys(purchaseOrders[0]) : []
            }, 'Dynamic purchase order findMany with filters completed');
            return createPaginationResult(purchaseOrders, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in dynamic purchase order findMany operation');
            throw error;
        }
    }
    /**
     * Find purchase order by ID using dynamic operations
     */
    async findById(id) {
        try {
            logger.debug({ purchaseOrderId: id }, 'Starting dynamic purchase order findById operation');
            const purchaseOrder = await dynamicFindUnique('purchaseorder', { id });
            if (!purchaseOrder) {
                throw new Error('Purchase order not found');
            }
            logger.debug({
                purchaseOrderId: id,
                availableFields: Object.keys(purchaseOrder)
            }, 'Dynamic purchase order findById completed');
            return purchaseOrder;
        }
        catch (error) {
            logger.error({ error, purchaseOrderId: id }, 'Error in purchase order findById operation');
            throw error;
        }
    }
    /**
     * Create new purchase order with dynamic field support
     * Only uses fields that exist in the database schema
     */
    async create(data) {
        try {
            logger.debug({ originalData: data }, 'Starting dynamic purchase order create operation');
            // Auto-set timestamps if not provided
            const currentTimestamp = Date.now();
            const createData = {
                ...data,
                createddate: data.createddate || currentTimestamp,
                modifieddate: data.modifieddate || currentTimestamp,
                // Ensure po_status is set to 'in_progress' by default
                po_status: data.po_status || 'in_progress'
            };
            // Generate order number if not provided
            if (!createData.orderNumber && !createData.order_number) {
                const orderNumber = `PO-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
                createData.orderNumber = orderNumber;
                createData.order_number = orderNumber; // Also set snake_case version
            }
            const purchaseOrder = await dynamicCreate('purchaseorder', createData);
            if (!purchaseOrder) {
                throw new Error('Failed to create purchase order - no valid fields provided');
            }
            logger.info({
                purchaseOrderId: purchaseOrder.id,
                orderNumber: purchaseOrder.orderNumber || purchaseOrder.order_number,
                po_status: purchaseOrder.po_status,
                availableFields: Object.keys(purchaseOrder)
            }, 'Dynamic purchase order create completed');
            return purchaseOrder;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in purchase order create operation');
            throw error;
        }
    }
    /**
     * Update purchase order with dynamic field support
     */
    async update(id, data) {
        try {
            // Check if purchase order exists first
            await this.findById(id);
            logger.debug({ originalData: data, purchaseOrderId: id }, 'Starting dynamic purchase order update operation');
            const purchaseOrder = await dynamicUpdate('purchaseorder', { id }, data);
            if (!purchaseOrder) {
                throw new Error('Failed to update purchase order - no valid fields provided');
            }
            logger.info({
                purchaseOrderId: id,
                availableFields: Object.keys(purchaseOrder)
            }, 'Dynamic purchase order update completed');
            return purchaseOrder;
        }
        catch (error) {
            logger.error({ error, data, purchaseOrderId: id }, 'Error in purchase order update operation');
            throw error;
        }
    }
    /**
     * Delete purchase order by ID
     */
    async delete(id) {
        try {
            // Check if purchase order exists first
            await this.findById(id);
            logger.debug({ purchaseOrderId: id }, 'Starting dynamic purchase order delete operation');
            const success = await dynamicDelete('purchaseorder', { id });
            if (!success) {
                throw new Error('Failed to delete purchase order');
            }
            logger.info({ purchaseOrderId: id }, 'Dynamic purchase order delete completed successfully');
        }
        catch (error) {
            logger.error({ error, purchaseOrderId: id }, 'Error in purchase order delete operation');
            throw error;
        }
    }
    /**
     * Upsert purchase order - create if ID not provided, update if ID exists
     */
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing purchase order
                logger.debug({ purchaseOrderId: id, data: updateData }, 'Upserting existing purchase order');
                return this.update(id, updateData);
            }
            else {
                // Create new purchase order
                logger.debug({ data: updateData }, 'Upserting new purchase order');
                return this.create(updateData);
            }
        }
        catch (error) {
            logger.error({ error, data }, 'Error in purchase order upsert operation');
            throw error;
        }
    }
    /**
     * Find purchase orders by supplier ID
     */
    async findBySupplier(supplierId, page = 1, limit = 10) {
        try {
            logger.debug({ supplierId, page, limit }, 'Finding purchase orders by supplier');
            const filters = {
                supplier_id: supplierId,
                supplierId: supplierId // Try both naming conventions
            };
            const result = await this.findMany(filters, page, limit);
            logger.debug({
                supplierId,
                purchaseOrderCount: result.data.length,
                total: result.pagination.total
            }, 'Found purchase orders by supplier');
            return result;
        }
        catch (error) {
            logger.error({ error, supplierId }, 'Error finding purchase orders by supplier');
            throw error;
        }
    }
    /**
     * Update purchase order status
     */
    async updateStatus(id, status, notes) {
        try {
            logger.debug({ purchaseOrderId: id, status, notes }, 'Updating purchase order status');
            const updateData = {
                status,
                purchase_status: status // Also try snake_case
            };
            if (notes) {
                updateData.notes = notes;
                updateData.order_notes = notes; // Also try snake_case
            }
            // If status is delivered, set actual delivery date
            if (status.toLowerCase() === 'delivered') {
                const now = new Date().toISOString();
                updateData.actualDeliveryDate = now;
                updateData.actual_delivery_date = now; // Also try snake_case
            }
            const purchaseOrder = await this.update(id, updateData);
            logger.info({
                purchaseOrderId: id,
                newStatus: status,
                deliveryDateSet: status.toLowerCase() === 'delivered'
            }, 'Purchase order status updated successfully');
            return purchaseOrder;
        }
        catch (error) {
            logger.error({ error, purchaseOrderId: id, status }, 'Error updating purchase order status');
            throw error;
        }
    }
}
//# sourceMappingURL=purchaseorder.service.js.map