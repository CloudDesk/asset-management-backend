import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class PoinvoiceService {
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic poinvoice findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the new dynamic filtering system
            const { data: poinvoices, total } = await dynamicFindManyWithFilters('poinvoice', filters, {
                skip,
                take,
                useAllColumns: true // Get all available columns
            });
            logger.info({
                poinvoiceCount: poinvoices.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: poinvoices.length > 0 ? Object.keys(poinvoices[0]) : []
            }, 'Dynamic poinvoice findMany with filters completed');
            return createPaginationResult(poinvoices, total, page, limit);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error: errorMessage, filters, page, limit }, 'Error in dynamic poinvoice findMany operation');
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ poinvoiceId: id }, 'Starting dynamic poinvoice findById operation');
            const poinvoice = await dynamicFindUnique('poinvoice', { id });
            if (!poinvoice) {
                throw new Error('Poinvoice not found');
            }
            logger.debug({
                poinvoiceId: id,
                availableFields: Object.keys(poinvoice)
            }, 'Dynamic poinvoice findById completed');
            return poinvoice;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error: errorMessage, poinvoiceId: id }, 'Error in poinvoice findById operation');
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ originalData: data }, 'Starting dynamic poinvoice create operation');
            // Auto-set created and modified dates if not provided
            const currentTimestamp = Date.now();
            const createData = {
                ...data,
                createddate: data.createddate || currentTimestamp,
                modifieddate: data.modifieddate || currentTimestamp,
            };
            const poinvoice = await dynamicCreate('poinvoice', createData);
            if (!poinvoice) {
                throw new Error('Failed to create poinvoice - no valid fields provided');
            }
            logger.info({
                poinvoiceId: poinvoice.id,
                availableFields: Object.keys(poinvoice)
            }, 'Dynamic poinvoice create completed');
            return poinvoice;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error: errorMessage, data }, 'Error in poinvoice create operation');
            throw error;
        }
    }
    async update(id, data) {
        try {
            // Check if poinvoice exists
            await this.findById(id);
            logger.debug({ originalData: data, poinvoiceId: id }, 'Starting dynamic poinvoice update operation');
            // Auto-set modified date
            const updateData = {
                ...data,
                modifieddate: data.modifieddate || Date.now(),
            };
            const poinvoice = await dynamicUpdate('poinvoice', { id }, updateData);
            if (!poinvoice) {
                throw new Error('Failed to update poinvoice - no valid fields provided');
            }
            logger.info({
                poinvoiceId: id,
                availableFields: Object.keys(poinvoice)
            }, 'Dynamic poinvoice update completed');
            return poinvoice;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error: errorMessage, data, poinvoiceId: id }, 'Error in poinvoice update operation');
            throw error;
        }
    }
    async delete(id) {
        try {
            // Check if poinvoice exists
            await this.findById(id);
            logger.debug({ poinvoiceId: id }, 'Starting dynamic poinvoice delete operation');
            const success = await dynamicDelete('poinvoice', { id });
            if (!success) {
                throw new Error('Failed to delete poinvoice');
            }
            logger.info({ poinvoiceId: id }, 'Dynamic poinvoice delete completed successfully');
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error: errorMessage, poinvoiceId: id }, 'Error in poinvoice delete operation');
            throw error;
        }
    }
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing poinvoice
                logger.debug({ poinvoiceId: id, data: updateData }, 'Upserting existing poinvoice');
                return this.update(id, updateData);
            }
            else {
                // Create new poinvoice
                logger.debug({ data: updateData }, 'Upserting new poinvoice');
                return this.create(updateData);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error({ error: errorMessage, data }, 'Error in poinvoice upsert operation');
            throw error;
        }
    }
}
//# sourceMappingURL=poinvoice.service.js.map