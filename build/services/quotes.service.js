import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters, dynamicCount } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class QuotesService {
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic quotes findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the dynamic filtering system
            const { data: quotes, total } = await dynamicFindManyWithFilters('quotes', filters, {
                skip,
                take,
                useAllColumns: true // Get all available columns
            });
            logger.info({
                quotesCount: quotes.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: quotes.length > 0 ? Object.keys(quotes[0]) : []
            }, 'Dynamic quotes findMany with filters completed');
            return createPaginationResult(quotes, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in dynamic quotes findMany operation');
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ quotesId: id }, 'Starting dynamic quotes findById operation');
            const quote = await dynamicFindUnique('quotes', { id: parseInt(id) });
            if (!quote) {
                throw new Error('Quote not found');
            }
            logger.debug({
                quotesId: id,
                availableFields: Object.keys(quote)
            }, 'Dynamic quotes findById completed');
            return quote;
        }
        catch (error) {
            logger.error({ error, quotesId: id }, 'Error in quotes findById operation');
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ originalData: data }, 'Starting dynamic quotes create operation');
            // Add timestamps
            const now = Date.now();
            const createData = {
                ...data,
                createddate: data.createddate || now,
                modifieddate: data.modifieddate || now
            };
            const quote = await dynamicCreate('quotes', createData);
            if (!quote) {
                throw new Error('Failed to create quote - no valid fields provided');
            }
            logger.info({
                quotesId: quote.id,
                availableFields: Object.keys(quote)
            }, 'Dynamic quotes create completed');
            return quote;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in quotes create operation');
            throw error;
        }
    }
    async update(id, data) {
        try {
            // Check if quote exists
            await this.findById(id);
            logger.debug({ originalData: data, quotesId: id }, 'Starting dynamic quotes update operation');
            // Add modified timestamp
            const updateData = {
                ...data,
                modifieddate: Date.now()
            };
            const quote = await dynamicUpdate('quotes', { id: parseInt(id) }, updateData);
            if (!quote) {
                throw new Error('Failed to update quote - no valid fields provided');
            }
            logger.info({
                quotesId: id,
                availableFields: Object.keys(quote)
            }, 'Dynamic quotes update completed');
            return quote;
        }
        catch (error) {
            logger.error({ error, data, quotesId: id }, 'Error in quotes update operation');
            throw error;
        }
    }
    async delete(id) {
        try {
            // Check if quote exists
            await this.findById(id);
            logger.debug({ quotesId: id }, 'Starting dynamic quotes delete operation');
            const success = await dynamicDelete('quotes', { id: parseInt(id) });
            if (!success) {
                throw new Error('Failed to delete quote');
            }
            logger.info({ quotesId: id }, 'Dynamic quotes delete completed successfully');
        }
        catch (error) {
            logger.error({ error, quotesId: id }, 'Error in quotes delete operation');
            throw error;
        }
    }
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing quote
                logger.debug({ quotesId: id, data: updateData }, 'Upserting existing quote');
                return this.update(id.toString(), updateData);
            }
            else {
                // Create new quote
                logger.debug({ data: updateData }, 'Upserting new quote');
                return this.create(updateData);
            }
        }
        catch (error) {
            logger.error({ error, data }, 'Error in quotes upsert operation');
            throw error;
        }
    }
    async findByPrNumber(prnumber, page = 1, limit = 10) {
        try {
            logger.debug({ prnumber, page, limit }, 'Finding quotes by PR number');
            const filters = { prnumber };
            return this.findMany(filters, page, limit);
        }
        catch (error) {
            logger.error({ error, prnumber }, 'Error finding quotes by PR number');
            throw error;
        }
    }
    async findByStatus(status, page = 1, limit = 10) {
        try {
            logger.debug({ status, page, limit }, 'Finding quotes by status');
            const filters = { status };
            return this.findMany(filters, page, limit);
        }
        catch (error) {
            logger.error({ error, status }, 'Error finding quotes by status');
            throw error;
        }
    }
    async getQuotesStats() {
        try {
            logger.debug('Getting quotes statistics');
            // Get total count
            const total = await dynamicCount('quotes');
            // Get counts by status
            const statusCounts = await dynamicFindManyWithFilters('quotes', {}, {
                useAllColumns: false
            });
            const stats = {
                total,
                byStatus: statusCounts.data.reduce((acc, quote) => {
                    const status = quote.status || 'unknown';
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                }, {})
            };
            logger.debug({ stats }, 'Quotes statistics retrieved');
            return stats;
        }
        catch (error) {
            logger.error({ error }, 'Error getting quotes statistics');
            throw error;
        }
    }
}
//# sourceMappingURL=quotes.service.js.map