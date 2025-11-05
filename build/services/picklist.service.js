import { prisma } from '../models/prisma.js';
import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindMany, dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class PicklistService {
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic picklist findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Extract sorting parameters from filters (remove them so they don't get used as WHERE clauses)
            const { sortorder, fieldnameOrder, objectOrder, ...actualFilters } = filters;
            const sortorderValue = Array.isArray(sortorder) ? sortorder[0] : sortorder;
            const sortorderDirection = sortorderValue?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            const fieldnameOrderValue = Array.isArray(fieldnameOrder) ? fieldnameOrder[0] : fieldnameOrder;
            const fieldnameDirection = fieldnameOrderValue?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            const objectOrderValue = Array.isArray(objectOrder) ? objectOrder[0] : objectOrder;
            const objectDirection = objectOrderValue?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
            // Determine sorting combination based on provided parameters
            // Combination 1 (default): fieldname (ASC fixed), sortorder (ASC/DESC)
            // Combination 2: fieldname (ASC/DESC), sortorder (ASC/DESC)
            // Combination 3: object (ASC/DESC), fieldname (ASC/DESC), sortorder (ASC/DESC)
            let orderByColumns = [];
            let orderDirections = [];
            if (objectOrderValue) {
                // Combination 3: object, fieldname, sortorder
                orderByColumns = ['object', 'fieldname', 'sortorder'];
                orderDirections = [objectDirection, fieldnameDirection, sortorderDirection];
            }
            else if (fieldnameOrderValue) {
                // Combination 2: fieldname, sortorder
                orderByColumns = ['fieldname', 'sortorder'];
                orderDirections = [fieldnameDirection, sortorderDirection];
            }
            else {
                // Combination 1 (default): fieldname (ASC fixed), sortorder
                orderByColumns = ['fieldname', 'sortorder'];
                orderDirections = ['ASC', sortorderDirection];
            }
            // Use the new dynamic filtering system
            const { data: picklists, total } = await dynamicFindManyWithFilters('picklist', actualFilters, {
                skip,
                take,
                useAllColumns: true, // Get all available columns
                orderBy: orderByColumns,
                orderDirection: orderDirections
            });
            const combination = objectOrderValue ? 3 : fieldnameOrderValue ? 2 : 1;
            logger.info({
                picklistCount: picklists.length,
                total,
                filtered: Object.keys(actualFilters).length > 0,
                appliedFilters: Object.keys(actualFilters),
                combination,
                orderBy: orderByColumns,
                orderDirections,
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
            // Use sortorder if available, fallback to label
            const picklists = await dynamicFindMany('picklist', {
                where: { object },
                orderBy: [{ sortorder: 'asc' }, { label: 'asc' }],
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
            // Use sortorder if available, fallback to label
            const picklists = await dynamicFindMany('picklist', {
                where: { fieldname },
                orderBy: [{ sortorder: 'asc' }, { label: 'asc' }],
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
    /**
     * Fetch picklists grouped by fieldName for a given object
     * Optimized query that fetches all records in one query and groups in memory
     *
     * @param object - Object name (e.g., 'product')
     * @param sortBy - Field to sort by: 'sortorder' (default) or 'label'
     * @param order - Sort direction: 'asc' (default) or 'desc'
     * @returns Object with fieldName as keys and arrays of picklist records as values
     */
    async findGroupedByObject(object, sortBy = 'sortorder', order = 'asc') {
        try {
            logger.debug({ object, sortBy, order }, 'Finding picklists grouped by fieldName');
            // Optimized raw SQL query - fetches all records in one query
            // Uses CASE to handle null sortorder values (nulls last)
            const orderDirection = order.toUpperCase();
            const sortColumn = sortBy === 'label' ? 'label' : 'sortorder';
            let orderByClause = '';
            if (sortBy === 'sortorder') {
                // Handle nulls: null values appear after sorted records
                orderByClause = `ORDER BY CASE WHEN sortorder IS NULL THEN 1 ELSE 0 END, sortorder ${orderDirection}`;
            }
            else {
                // For label sorting, handle nulls
                orderByClause = `ORDER BY CASE WHEN label IS NULL THEN 1 ELSE 0 END, label ${orderDirection}`;
            }
            const query = `
        SELECT 
          id,
          label,
          value,
          object,
          controlledvalue,
          fieldname,
          controlledlabel,
          controlledfieldname,
          parent,
          description,
          sortorder,
          createddate,
          modifieddate
        FROM picklist
        WHERE object = $1
        ${orderByClause}
      `;
            logger.debug({ query, object, sortBy, order }, 'Executing optimized grouped picklist query');
            const result = await prisma.$queryRawUnsafe(query, object);
            const picklists = Array.isArray(result) ? result.map((row) => {
                // Convert BigInt to number
                const converted = {};
                Object.keys(row).forEach(key => {
                    const value = row[key];
                    if (typeof value === 'bigint') {
                        converted[key] = Number(value);
                    }
                    else {
                        converted[key] = value;
                    }
                });
                return converted;
            }) : [];
            // Group by fieldName in memory (very efficient for reasonable dataset sizes)
            const grouped = {};
            for (const picklist of picklists) {
                const fieldName = picklist.fieldname || 'unknown';
                if (!grouped[fieldName]) {
                    grouped[fieldName] = [];
                }
                grouped[fieldName].push(picklist);
            }
            // Sort each group according to sortBy and order
            // Re-sort each group to ensure proper ordering within fieldName groups
            for (const fieldName in grouped) {
                const group = grouped[fieldName];
                if (group && group.length > 0) {
                    if (sortBy === 'sortorder') {
                        group.sort((a, b) => {
                            const aSort = a.sortorder ?? Number.MAX_SAFE_INTEGER;
                            const bSort = b.sortorder ?? Number.MAX_SAFE_INTEGER;
                            if (order === 'asc') {
                                return aSort - bSort;
                            }
                            else {
                                return bSort - aSort;
                            }
                        });
                    }
                    else {
                        // Sort by label
                        group.sort((a, b) => {
                            const aValue = (a.label || '').toLowerCase();
                            const bValue = (b.label || '').toLowerCase();
                            if (order === 'asc') {
                                return aValue.localeCompare(bValue);
                            }
                            else {
                                return bValue.localeCompare(aValue);
                            }
                        });
                    }
                }
            }
            logger.info({
                object,
                fieldNameCount: Object.keys(grouped).length,
                totalRecords: picklists.length,
                sortBy,
                order,
                fieldNames: Object.keys(grouped)
            }, 'Picklists grouped by fieldName completed');
            return grouped;
        }
        catch (error) {
            logger.error({ error, object, sortBy, order }, 'Error finding grouped picklists');
            throw error;
        }
    }
}
//# sourceMappingURL=picklist.service.js.map