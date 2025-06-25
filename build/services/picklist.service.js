import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindMany, dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class PicklistService {
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic picklist findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the new dynamic filtering system
            const { data: picklists, total } = await dynamicFindManyWithFilters('picklist', filters, {
                skip,
                take,
                useAllColumns: true // Get all available columns
            });
            logger.info({
                picklistCount: picklists.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: picklists.length > 0 ? Object.keys(picklists[0]) : []
            }, 'Dynamic picklist findMany with filters completed');
            return createPaginationResult(picklists, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in dynamic picklist findMany operation');
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ picklistId: id }, 'Starting dynamic picklist findById operation');
            const picklist = await dynamicFindUnique('picklist', { id });
            if (!picklist) {
                throw new Error('Picklist item not found');
            }
            logger.debug({
                picklistId: id,
                availableFields: Object.keys(picklist)
            }, 'Dynamic picklist findById completed');
            return picklist;
        }
        catch (error) {
            logger.error({ error, picklistId: id }, 'Error in picklist findById operation');
            throw error;
        }
    }
    async findByObject(object) {
        try {
            logger.debug({ object }, 'Finding picklists by object');
            const picklists = await dynamicFindMany('picklist', {
                where: { object },
                orderBy: [{ label: 'asc' }],
            });
            logger.debug({ object, picklistCount: picklists.length }, 'Found picklists by object');
            return picklists;
        }
        catch (error) {
            logger.error({ error, object }, 'Error finding picklists by object');
            throw error;
        }
    }
    async findByFieldname(fieldname) {
        try {
            logger.debug({ fieldname }, 'Finding picklists by fieldname');
            const picklists = await dynamicFindMany('picklist', {
                where: { fieldname },
                orderBy: [{ label: 'asc' }],
            });
            logger.debug({ fieldname, picklistCount: picklists.length }, 'Found picklists by fieldname');
            return picklists;
        }
        catch (error) {
            logger.error({ error, fieldname }, 'Error finding picklists by fieldname');
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ originalData: data }, 'Starting dynamic picklist create operation');
            // Check if value already exists (basic check)
            try {
                const existing = await dynamicFindMany('picklist', {
                    where: {
                        value: data.value,
                        ...(data.object && { object: data.object }),
                        ...(data.fieldname && { fieldname: data.fieldname })
                    },
                    take: 1
                });
                if (existing.length > 0) {
                    throw new Error(`Picklist item with value '${data.value}' already exists`);
                }
            }
            catch (error) {
                if (!error.message.includes('already exists')) {
                    logger.warn({ error }, 'Could not check for existing picklist item, continuing with creation');
                }
                else {
                    throw error;
                }
            }
            const picklist = await dynamicCreate('picklist', data);
            if (!picklist) {
                throw new Error('Failed to create picklist - no valid fields provided');
            }
            logger.info({
                picklistId: picklist.id,
                availableFields: Object.keys(picklist)
            }, 'Dynamic picklist create completed');
            return picklist;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in picklist create operation');
            throw error;
        }
    }
    async update(id, data) {
        try {
            // Check if picklist exists
            await this.findById(id);
            // If updating value, check for duplicates
            if (data.value) {
                try {
                    const existing = await dynamicFindMany('picklist', {
                        where: {
                            value: data.value,
                        },
                        take: 10 // Get a few to check if any have different IDs
                    });
                    const duplicate = existing.find(item => item.id !== parseInt(id));
                    if (duplicate) {
                        throw new Error(`Picklist item with value '${data.value}' already exists`);
                    }
                }
                catch (error) {
                    if (!error.message.includes('already exists')) {
                        logger.warn({ error }, 'Could not check for duplicate picklist value, continuing with update');
                    }
                    else {
                        throw error;
                    }
                }
            }
            logger.debug({ originalData: data, picklistId: id }, 'Starting dynamic picklist update operation');
            const picklist = await dynamicUpdate('picklist', { id }, data);
            if (!picklist) {
                throw new Error('Failed to update picklist - no valid fields provided');
            }
            logger.info({
                picklistId: id,
                availableFields: Object.keys(picklist)
            }, 'Dynamic picklist update completed');
            return picklist;
        }
        catch (error) {
            logger.error({ error, data, picklistId: id }, 'Error in picklist update operation');
            throw error;
        }
    }
    async delete(id) {
        try {
            // Check if picklist exists
            await this.findById(id);
            logger.debug({ picklistId: id }, 'Starting dynamic picklist delete operation');
            const success = await dynamicDelete('picklist', { id });
            if (!success) {
                throw new Error('Failed to delete picklist');
            }
            logger.info({ picklistId: id }, 'Dynamic picklist delete completed successfully');
        }
        catch (error) {
            logger.error({ error, picklistId: id }, 'Error in picklist delete operation');
            throw error;
        }
    }
}
//# sourceMappingURL=picklist.service.js.map