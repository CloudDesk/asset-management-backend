import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindManyWithFilters, dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class PromotionsService {
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic promotions findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the dynamic filtering system
            const { data: promotions, total } = await dynamicFindManyWithFilters('promotions', filters, {
                skip,
                take,
                useAllColumns: true // Get all available columns
            });
            logger.info({
                promotionsCount: promotions.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: promotions.length > 0 ? Object.keys(promotions[0]) : []
            }, 'Dynamic promotions findMany with filters completed');
            return createPaginationResult(promotions, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in dynamic promotions findMany operation');
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ promotionId: id }, 'Starting dynamic promotion findById operation');
            const promotion = await dynamicFindUnique('promotions', { id: parseInt(id) });
            if (!promotion) {
                throw new Error('Promotion not found');
            }
            logger.debug({
                promotionId: id,
                availableFields: Object.keys(promotion)
            }, 'Dynamic promotion findById completed');
            return promotion;
        }
        catch (error) {
            logger.error({ error, promotionId: id }, 'Error in promotion findById operation');
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ data }, 'Starting dynamic promotion create operation');
            // Add timestamps
            const promotionData = {
                ...data,
                createddate: Date.now(),
                modifieddate: Date.now()
            };
            const promotion = await dynamicCreate('promotions', promotionData);
            if (!promotion) {
                throw new Error('Failed to create promotion - no valid fields provided');
            }
            logger.info({
                promotionId: promotion.id,
                availableFields: Object.keys(promotion)
            }, 'Dynamic promotion create completed');
            return promotion;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in promotion create operation');
            throw error;
        }
    }
    async update(id, data) {
        try {
            logger.debug({ promotionId: id, data }, 'Starting dynamic promotion update operation');
            // Add modified timestamp
            const updateData = {
                ...data,
                modifieddate: Date.now()
            };
            const promotion = await dynamicUpdate('promotions', { id: parseInt(id) }, updateData);
            if (!promotion) {
                throw new Error('Promotion not found or update failed');
            }
            logger.info({
                promotionId: id,
                availableFields: Object.keys(promotion)
            }, 'Dynamic promotion update completed');
            return promotion;
        }
        catch (error) {
            logger.error({ error, promotionId: id, data }, 'Error in promotion update operation');
            throw error;
        }
    }
    async delete(id) {
        try {
            logger.debug({ promotionId: id }, 'Starting promotion delete operation');
            const success = await dynamicDelete('promotions', { id: parseInt(id) });
            if (!success) {
                throw new Error('Failed to delete promotion');
            }
            logger.info({ promotionId: id }, 'Promotion delete completed');
            return success;
        }
        catch (error) {
            logger.error({ error, promotionId: id }, 'Error in promotion delete operation');
            throw error;
        }
    }
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing promotion
                logger.debug({ promotionId: id, data: updateData }, 'Upserting existing promotion');
                return this.update(id.toString(), updateData);
            }
            else {
                // Create new promotion
                logger.debug({ data: updateData }, 'Upserting new promotion');
                return this.create(updateData);
            }
        }
        catch (error) {
            logger.error({ error, data }, 'Error in promotion upsert operation');
            throw error;
        }
    }
}
//# sourceMappingURL=promotions.service.js.map