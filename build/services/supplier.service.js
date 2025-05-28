import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class SupplierService {
    /**
     * Find suppliers with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic supplier findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the dynamic filtering system that adapts to any database schema
            const { data: suppliers, total } = await dynamicFindManyWithFilters('supplier', filters, {
                skip,
                take,
                useAllColumns: true // Get all available columns
            });
            logger.info({
                supplierCount: suppliers.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: suppliers.length > 0 ? Object.keys(suppliers[0]) : []
            }, 'Dynamic supplier findMany with filters completed');
            return createPaginationResult(suppliers, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in dynamic supplier findMany operation');
            throw error;
        }
    }
    /**
     * Find supplier by ID using dynamic operations
     */
    async findById(id) {
        try {
            logger.debug({ supplierId: id }, 'Starting dynamic supplier findById operation');
            const supplier = await dynamicFindUnique('supplier', { id });
            if (!supplier) {
                throw new Error('Supplier not found');
            }
            logger.debug({
                supplierId: id,
                availableFields: Object.keys(supplier)
            }, 'Dynamic supplier findById completed');
            return supplier;
        }
        catch (error) {
            logger.error({ error, supplierId: id }, 'Error in supplier findById operation');
            throw error;
        }
    }
    /**
     * Create new supplier with dynamic field support
     * Only uses fields that exist in the database schema
     */
    async create(data) {
        try {
            logger.debug({ originalData: data }, 'Starting dynamic supplier create operation');
            const supplier = await dynamicCreate('supplier', data);
            if (!supplier) {
                throw new Error('Failed to create supplier - no valid fields provided');
            }
            logger.info({
                supplierId: supplier.id,
                availableFields: Object.keys(supplier)
            }, 'Dynamic supplier create completed');
            return supplier;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in supplier create operation');
            throw error;
        }
    }
    /**
     * Update supplier with dynamic field support
     */
    async update(id, data) {
        try {
            // Check if supplier exists first
            await this.findById(id);
            logger.debug({ originalData: data, supplierId: id }, 'Starting dynamic supplier update operation');
            const supplier = await dynamicUpdate('supplier', { id }, data);
            if (!supplier) {
                throw new Error('Failed to update supplier - no valid fields provided');
            }
            logger.info({
                supplierId: id,
                availableFields: Object.keys(supplier)
            }, 'Dynamic supplier update completed');
            return supplier;
        }
        catch (error) {
            logger.error({ error, data, supplierId: id }, 'Error in supplier update operation');
            throw error;
        }
    }
    /**
     * Delete supplier by ID
     */
    async delete(id) {
        try {
            // Check if supplier exists first
            await this.findById(id);
            logger.debug({ supplierId: id }, 'Starting dynamic supplier delete operation');
            const success = await dynamicDelete('supplier', { id });
            if (!success) {
                throw new Error('Failed to delete supplier');
            }
            logger.info({ supplierId: id }, 'Dynamic supplier delete completed successfully');
        }
        catch (error) {
            logger.error({ error, supplierId: id }, 'Error in supplier delete operation');
            throw error;
        }
    }
    /**
     * Upsert supplier - create if ID not provided, update if ID exists
     */
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing supplier
                logger.debug({ supplierId: id, data: updateData }, 'Upserting existing supplier');
                return this.update(id, updateData);
            }
            else {
                // Create new supplier
                logger.debug({ data: updateData }, 'Upserting new supplier');
                return this.create(updateData);
            }
        }
        catch (error) {
            logger.error({ error, data }, 'Error in supplier upsert operation');
            throw error;
        }
    }
    /**
     * Get supplier statistics and related data counts
     */
    async getSupplierStats(supplierId) {
        try {
            logger.debug({ supplierId }, 'Getting supplier statistics');
            // Get purchase orders count for this supplier
            const { total: purchaseOrdersCount } = await dynamicFindManyWithFilters('purchaseorder', { supplier_id: supplierId }, { skip: 0, take: 1 });
            // Get purchase requests count for this supplier
            const { total: purchaseRequestsCount } = await dynamicFindManyWithFilters('purchaserequest', { supplier_id: supplierId }, { skip: 0, take: 1 });
            const stats = {
                purchaseOrdersCount,
                purchaseRequestsCount,
                totalTransactions: purchaseOrdersCount + purchaseRequestsCount
            };
            logger.debug({ supplierId, stats }, 'Supplier statistics retrieved');
            return stats;
        }
        catch (error) {
            logger.error({ error, supplierId }, 'Error getting supplier statistics');
            // Return default stats on error
            return {
                purchaseOrdersCount: 0,
                purchaseRequestsCount: 0,
                totalTransactions: 0
            };
        }
    }
}
//# sourceMappingURL=supplier.service.js.map