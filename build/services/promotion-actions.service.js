import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindManyWithFilters, dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class PromotionActionsService {
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic promotion actions findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            const { data: promotionActions, total } = await dynamicFindManyWithFilters('promotion_actions', filters, {
                skip,
                take,
                useAllColumns: true
            });
            logger.info({
                promotionActionsCount: promotionActions.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: promotionActions.length > 0 ? Object.keys(promotionActions[0]) : []
            }, 'Dynamic promotion actions findMany with filters completed');
            return createPaginationResult(promotionActions, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in dynamic promotion actions findMany operation');
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ promotionActionId: id }, 'Starting dynamic promotion action findById operation');
            const promotionAction = await dynamicFindUnique('promotion_actions', { id: parseInt(id) });
            if (!promotionAction) {
                throw new Error('Promotion action not found');
            }
            logger.debug({
                promotionActionId: id,
                availableFields: Object.keys(promotionAction)
            }, 'Dynamic promotion action findById completed');
            return promotionAction;
        }
        catch (error) {
            logger.error({ error, promotionActionId: id }, 'Error in promotion action findById operation');
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ data }, 'Starting dynamic promotion action create operation');
            const promotionActionData = {
                ...data,
                createddate: Date.now(),
                modifieddate: Date.now()
            };
            const promotionAction = await dynamicCreate('promotion_actions', promotionActionData);
            if (!promotionAction) {
                throw new Error('Failed to create promotion action - no valid fields provided');
            }
            logger.info({
                promotionActionId: promotionAction.id,
                availableFields: Object.keys(promotionAction)
            }, 'Dynamic promotion action create completed');
            return promotionAction;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in promotion action create operation');
            throw error;
        }
    }
    async update(id, data) {
        try {
            logger.debug({ promotionActionId: id, data }, 'Starting dynamic promotion action update operation');
            const updateData = {
                ...data,
                modifieddate: Date.now()
            };
            const promotionAction = await dynamicUpdate('promotion_actions', { id: parseInt(id) }, updateData);
            if (!promotionAction) {
                throw new Error('Promotion action not found or update failed');
            }
            logger.info({
                promotionActionId: id,
                availableFields: Object.keys(promotionAction)
            }, 'Dynamic promotion action update completed');
            return promotionAction;
        }
        catch (error) {
            logger.error({ error, promotionActionId: id, data }, 'Error in promotion action update operation');
            throw error;
        }
    }
    async delete(id) {
        try {
            logger.debug({ promotionActionId: id }, 'Starting promotion action delete operation');
            const success = await dynamicDelete('promotion_actions', { id: parseInt(id) });
            if (!success) {
                throw new Error('Failed to delete promotion action');
            }
            logger.info({ promotionActionId: id }, 'Promotion action delete completed');
            return success;
        }
        catch (error) {
            logger.error({ error, promotionActionId: id }, 'Error in promotion action delete operation');
            throw error;
        }
    }
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                logger.debug({ promotionActionId: id, data: updateData }, 'Upserting existing promotion action');
                return this.update(id.toString(), updateData);
            }
            else {
                logger.debug({ data: updateData }, 'Upserting new promotion action');
                return this.create(updateData);
            }
        }
        catch (error) {
            logger.error({ error, data }, 'Error in promotion action upsert operation');
            throw error;
        }
    }
}
//# sourceMappingURL=promotion-actions.service.js.map