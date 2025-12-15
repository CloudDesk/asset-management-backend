import { prisma } from '../models/prisma.js';
import { 
  CreatePicklistInput, 
  UpdatePicklistInput 
} from '../schemas/picklist.schema.js';
import { PaginationResult, createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { buildPicklistFilters, FilterOptions } from '../utils/filterBuilder.js';
import { 
  dynamicFindMany, 
  dynamicCount, 
  dynamicFindUnique, 
  dynamicCreate, 
  dynamicUpdate, 
  dynamicDelete,
  dynamicFindManyWithFilters,
  formatEntitiesForAPI,
  formatPicklistForAPI
} from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';

export class PicklistService {
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info({ filters, page, limit }, 'Starting dynamic picklist findMany with filters');

      const { skip, take } = getPrismaSkipTake(page, limit);

      // Extract sorting parameters and isactive from filters (remove them so they don't get used as WHERE clauses)
      const { sortorder, fieldnameOrder, objectOrder, isactive, ...actualFilters } = filters;
      
      // Handle isactive filter if provided (for soft delete support)
      // Keep as string to match FilterOptions type
      if (isactive !== undefined) {
        const isactiveValue = Array.isArray(isactive) ? isactive[0] : isactive;
        actualFilters.isactive = (isactiveValue === 'true' || isactiveValue === '1') ? 'true' : 'false';
      }
      
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
      let orderByColumns: string[] = [];
      let orderDirections: ('ASC' | 'DESC')[] = [];

      if (objectOrderValue) {
        // Combination 3: object, fieldname, sortorder
        orderByColumns = ['object', 'fieldname', 'sortorder'];
        orderDirections = [objectDirection, fieldnameDirection, sortorderDirection];
      } else if (fieldnameOrderValue) {
        // Combination 2: fieldname, sortorder
        orderByColumns = ['fieldname', 'sortorder'];
        orderDirections = [fieldnameDirection, sortorderDirection];
      } else {
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
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in dynamic picklist findMany operation');
      throw error;
    }
  }

  async findById(id: string) {
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
    } catch (error) {
      logger.error({ error, picklistId: id }, 'Error in picklist findById operation');
      throw error;
    }
  }

  async findByObject(object: string) {
    try {
      logger.debug({ object }, 'Finding picklists by object');

      // Use sortorder if available, fallback to label
      const picklists = await dynamicFindMany('picklist', {
        where: { object },
        orderBy: [{ sortorder: 'asc' }, { label: 'asc' }],
      });

      logger.debug({ object, picklistCount: picklists.length }, 'Found picklists by object');
      return picklists;
    } catch (error) {
      logger.error({ error, object }, 'Error finding picklists by object');
      throw error;
    }
  }

  async findByFieldname(fieldname: string) {
    try {
      logger.debug({ fieldname }, 'Finding picklists by fieldname');

      // Use sortorder if available, fallback to label
      const picklists = await dynamicFindMany('picklist', {
        where: { fieldname },
        orderBy: [{ sortorder: 'asc' }, { label: 'asc' }],
      });

      logger.debug({ fieldname, picklistCount: picklists.length }, 'Found picklists by fieldname');
      return picklists;
    } catch (error) {
      logger.error({ error, fieldname }, 'Error finding picklists by fieldname');
      throw error;
    }
  }

  async create(data: CreatePicklistInput) {
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
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          logger.warn({ error }, 'Could not check for existing picklist item, continuing with creation');
        } else {
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
    } catch (error) {
      logger.error({ error, data }, 'Error in picklist create operation');
      throw error;
    }
  }

  async update(id: string, data: UpdatePicklistInput) {
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
        } catch (error: any) {
          if (!error.message.includes('already exists')) {
            logger.warn({ error }, 'Could not check for duplicate picklist value, continuing with update');
          } else {
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
    } catch (error) {
      logger.error({ error, data, picklistId: id }, 'Error in picklist update operation');
      throw error;
    }
  }

  async delete(id: string) {
    try {
      // Check if picklist exists
      await this.findById(id);

      logger.debug({ picklistId: id }, 'Starting dynamic picklist delete operation');

      const success = await dynamicDelete('picklist', { id });

      if (!success) {
        throw new Error('Failed to delete picklist');
      }

      logger.info({ picklistId: id }, 'Dynamic picklist delete completed successfully');
    } catch (error) {
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
  async findGroupedByObject(
    object: string,
    sortBy: 'sortorder' | 'label' = 'sortorder',
    order: 'asc' | 'desc' = 'asc'
  ): Promise<Record<string, any[]>> {
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
      } else {
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
      const picklists = Array.isArray(result) ? result.map((row: any) => {
        // Convert BigInt to number
        const converted: any = {};
        Object.keys(row).forEach(key => {
          const value = row[key];
          if (typeof value === 'bigint') {
            converted[key] = Number(value);
          } else {
            converted[key] = value;
          }
        });
        return converted;
      }) : [];

      // Group by fieldName in memory (very efficient for reasonable dataset sizes)
      const grouped: Record<string, any[]> = {};
      
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
              } else {
                return bSort - aSort;
              }
            });
          } else {
            // Sort by label
            group.sort((a, b) => {
              const aValue = (a.label || '').toLowerCase();
              const bValue = (b.label || '').toLowerCase();
              if (order === 'asc') {
                return aValue.localeCompare(bValue);
              } else {
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
    } catch (error) {
      logger.error({ error, object, sortBy, order }, 'Error finding grouped picklists');
      throw error;
    }
  }

  /**
   * v2: Get picklists with optional grouping by fieldname and/or parent
   * Supports both flat and grouped response formats
   * 
   * @param filters - Filter options including object, searchtext, parent, etc.
   * @param groupByFieldname - If true, returns grouped by fieldname; if false, returns flat array
   * @param groupByParent - If true (and groupByFieldname is true), groups by parent within each fieldname
   * @param sortorder - Sort direction for sortorder field (ASC/DESC)
   * @param fieldnameOrder - Sort direction for fieldname groups (ASC/DESC)
   * @param limit - Global limit (not per fieldname)
   * @returns Object with grouped/flat data and metadata
   */
  async findManyV2(
    filters: FilterOptions,
    groupByFieldname: boolean = false,
    groupByParent: boolean = false,
    sortorder: 'ASC' | 'DESC' = 'ASC',
    fieldnameOrder: 'ASC' | 'DESC' = 'ASC',
    limit: number = 1000
  ): Promise<{
    grouped?: Record<string, any[] | Record<string, any[] | Record<string, any[]>>>;
    flat?: any[];
    meta: {
      object?: string;
      grouped: boolean;
      groupedByParent?: boolean;
      groupCount?: number;
      totalRecords: number;
    };
    pagination?: PaginationResult<any>['pagination'];
  }> {
    try {
      logger.info({ 
        filters, 
        groupByFieldname, 
        groupByParent,
        sortorder, 
        fieldnameOrder, 
        limit 
      }, 'Starting v2 picklist findMany');

      // Extract filters (remove grouping and sorting params from WHERE clause)
      const { 
        groupByFieldname: _, 
        groupByParent: __,
        sortorder: ___, 
        fieldnameOrder: ____, 
        limit: _____,
        page: ______,
        isactive: _______,
        ...actualFilters 
      } = filters;
      
      // Handle isactive filter if provided (for soft delete support)
      // Keep as string to match FilterOptions type
      if (_______ !== undefined) {
        const isactiveValue = Array.isArray(_______) ? _______[0] : _______;
        actualFilters.isactive = (isactiveValue === 'true' || isactiveValue === '1') ? 'true' : 'false';
      }

      // Build WHERE conditions
      const whereConditions: any = {};

      if (actualFilters.object) {
        whereConditions.object = actualFilters.object;
      }

      if (actualFilters.parent) {
        whereConditions.parent = actualFilters.parent;
      }

      // Handle searchtext - search across label, value, fieldname, object, parent
      if (actualFilters.searchtext) {
        const searchText = actualFilters.searchtext;
        whereConditions.OR = [
          { label: { contains: searchText, mode: 'insensitive' } },
          { value: { contains: searchText, mode: 'insensitive' } },
          { fieldname: { contains: searchText, mode: 'insensitive' } },
          { object: { contains: searchText, mode: 'insensitive' } },
          { parent: { contains: searchText, mode: 'insensitive' } },
        ];
      }

      // Filter by isactive if provided (for soft delete support)
      // Note: Only filter if explicitly provided - don't set default to avoid breaking if field doesn't exist yet
      // null values are treated as false (inactive/deleted)
      if (actualFilters.isactive !== undefined) {
        const isactiveValue = Array.isArray(actualFilters.isactive) ? actualFilters.isactive[0] : actualFilters.isactive;
        // Convert string to boolean - handle 'true', '1', or actual boolean true
        const isActiveValue = typeof isactiveValue === 'boolean' 
          ? isactiveValue 
          : (isactiveValue === 'true' || isactiveValue === '1');
        
        // Build isactive condition: null means false (inactive), true means active
        const isactiveCondition = isActiveValue
          ? { isactive: true } // Active: only true
          : { OR: [{ isactive: false }, { isactive: null }] }; // Inactive: false OR null
        
        // If there's already an OR from searchtext, wrap both in AND
        if (whereConditions.OR) {
          whereConditions.AND = [
            { OR: whereConditions.OR },
            isactiveCondition
          ];
          delete whereConditions.OR;
        } else {
          // No existing OR, just add the isactive condition
          Object.assign(whereConditions, isactiveCondition);
        }
        
        // Remove from actualFilters so it doesn't get processed again
        delete actualFilters.isactive;
      }

      // Apply other filters
      Object.keys(actualFilters).forEach(key => {
        if (!['object', 'parent', 'searchtext'].includes(key) && actualFilters[key] !== undefined) {
          whereConditions[key] = actualFilters[key];
        }
      });

      // Build orderBy
      const orderBy: any[] = [];
      
      // Always order by fieldname first (for grouping consistency)
      orderBy.push({ fieldname: fieldnameOrder.toLowerCase() });
      
      // Then by sortorder (handle nulls last)
      if (sortorder === 'DESC') {
        orderBy.push({ sortorder: 'desc' });
      } else {
        orderBy.push({ sortorder: 'asc' });
      }

      // Fetch all records (up to limit) - no pagination for grouped mode
      const picklists = await prisma.picklist.findMany({
        where: Object.keys(whereConditions).length > 0 ? whereConditions : undefined,
        orderBy,
        take: limit || 1000,
      });

      // Format picklists for API
      const formattedPicklists = formatEntitiesForAPI(picklists, 'picklist');

      const totalRecords = formattedPicklists.length;

      // If grouping is requested, group by fieldname (and optionally by parent)
      if (groupByFieldname) {
        if (groupByParent) {
          // Nested grouping: fieldname -> controlledfieldname -> parent -> items
          // This allows items with same parent but different controlledfieldname to be in separate sections
          const grouped: Record<string, Record<string, Record<string, any[]>>> = {};
          
          for (const picklist of formattedPicklists) {
            const fieldName = picklist.fieldname || 'unknown';
            // Handle null, empty string, or undefined controlledfieldname values
            const controlledFieldName = picklist.controlledfieldname;
            const controlledFieldKey = (controlledFieldName && String(controlledFieldName).trim() !== '') 
              ? String(controlledFieldName) 
              : 'null';
            
            // Handle null, empty string, or undefined parent values
            const parentValue = picklist.parent;
            const parentKey = (parentValue && String(parentValue).trim() !== '') 
              ? String(parentValue) 
              : 'null';
            
            if (!grouped[fieldName]) {
              grouped[fieldName] = {};
            }
            if (!grouped[fieldName][controlledFieldKey]) {
              grouped[fieldName][controlledFieldKey] = {};
            }
            if (!grouped[fieldName][controlledFieldKey][parentKey]) {
              grouped[fieldName][controlledFieldKey][parentKey] = [];
            }
            grouped[fieldName][controlledFieldKey][parentKey].push(picklist);
          }

          // Sort each parent group by sortorder
          for (const fieldName in grouped) {
            const fieldGroup = grouped[fieldName];
            for (const controlledFieldKey in fieldGroup) {
              const controlledFieldGroup = fieldGroup[controlledFieldKey];
              for (const parentKey in controlledFieldGroup) {
                const parentGroup = controlledFieldGroup[parentKey];
                if (parentGroup && parentGroup.length > 0) {
                  parentGroup.sort((a, b) => {
                    const aSort = a.sortorder ?? Number.MAX_SAFE_INTEGER;
                    const bSort = b.sortorder ?? Number.MAX_SAFE_INTEGER;
                    if (sortorder === 'ASC') {
                      return aSort - bSort;
                    } else {
                      return bSort - aSort;
                    }
                  });
                }
              }
            }
          }

          logger.info({
            object: actualFilters.object,
            groupCount: Object.keys(grouped).length,
            totalRecords,
            grouped: true,
            groupedByParent: true
          }, 'v2 picklist findMany grouped by fieldname and parent completed');

          return {
            grouped,
            meta: {
              ...(actualFilters.object && { object: actualFilters.object as string }),
              grouped: true,
              groupedByParent: true,
              groupCount: Object.keys(grouped).length,
              totalRecords
            }
          };
        } else {
          // Simple grouping: fieldname -> items
          const grouped: Record<string, any[]> = {};
          
          for (const picklist of formattedPicklists) {
            const fieldName = picklist.fieldname || 'unknown';
            if (!grouped[fieldName]) {
              grouped[fieldName] = [];
            }
            grouped[fieldName].push(picklist);
          }

          // Sort each group by sortorder (already sorted from query, but ensure consistency)
          for (const fieldName in grouped) {
            const group = grouped[fieldName];
            if (group && group.length > 0) {
              group.sort((a, b) => {
                const aSort = a.sortorder ?? Number.MAX_SAFE_INTEGER;
                const bSort = b.sortorder ?? Number.MAX_SAFE_INTEGER;
                if (sortorder === 'ASC') {
                  return aSort - bSort;
                } else {
                  return bSort - aSort;
                }
              });
            }
          }

          logger.info({
            object: actualFilters.object,
            groupCount: Object.keys(grouped).length,
            totalRecords,
            grouped: true
          }, 'v2 picklist findMany grouped by fieldname completed');

          return {
            grouped,
            meta: {
              ...(actualFilters.object && { object: actualFilters.object as string }),
              grouped: true,
              groupedByParent: false,
              groupCount: Object.keys(grouped).length,
              totalRecords
            }
          };
        }
      }

      // Flat response (legacy compatible)
      logger.info({
        totalRecords,
        grouped: false
      }, 'v2 picklist findMany flat completed');

      return {
        flat: formattedPicklists,
        meta: {
          ...(actualFilters.object && { object: actualFilters.object as string }),
          grouped: false,
          totalRecords
        },
        pagination: {
          page: 1,
          limit: limit || 1000,
          total: totalRecords,
          totalPages: Math.ceil(totalRecords / (limit || 1000)),
          hasNext: false,
          hasPrev: false
        }
      };
    } catch (error) {
      logger.error({ error, filters, groupByFieldname, groupByParent }, 'Error in v2 picklist findMany operation');
      throw error;
    }
  }

  /**
   * v2: Bulk create/update picklists - Create new items or update existing ones
   * Handles both create (when id is missing/null/negative) and update operations
   * Useful for reordering and reorganizing picklist items in a single API call
   * 
   * @param updates - Array of picklist items:
   *   - For CREATE: id is missing/null/negative, requires: label, value, object, fieldname
   *   - For UPDATE: id is provided (positive number), updates only provided fields
   * @returns Summary of create/update results
   */
  async bulkUpdateV2(
    updates: Array<{
      id?: number | string | null;
      fieldname?: string;
      parent?: string | null;
      sortorder?: number | null;
      label?: string | null;
      value?: string | null;
      object?: string;
      description?: string | null;
      controlledfieldname?: string | null;
      controlledlabel?: string | null;
      controlledvalue?: string | null;
      isactive?: boolean | null;
    }>
  ): Promise<{
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
    results: Array<{
      id: number | string;
      success: boolean;
      operation?: 'create' | 'update';
      data?: any;
      error?: string;
    }>;
  }> {
    try {
      logger.info({ updateCount: updates.length }, 'Starting v2 bulk picklist update operation');

      const results = [];
      let successCount = 0;
      let failureCount = 0;

      // Process each item (create or update)
      for (const item of updates) {
        try {
          const { 
            id, 
            fieldname, 
            parent, 
            sortorder, 
            label, 
            value,
            object,
            description,
            controlledfieldname,
            controlledlabel,
            controlledvalue,
            isactive
          } = item;

          // Determine if this is a CREATE or UPDATE operation
          // CREATE: id is missing, null, negative, or 0
          const isCreate = !id || id === null || (typeof id === 'number' && id <= 0) || (typeof id === 'string' && (id === '' || parseInt(id) <= 0));

          if (isCreate) {
            // CREATE operation
            // Validate required fields for creation
            if (!label || !value || !object || !fieldname) {
              throw new Error('For new items, label, value, object, and fieldname are required');
            }

            // Build create data object
            const createData: any = {
              label: label === null || label === '' ? null : label,
              value: value === null || value === '' ? null : value,
              object: object,
              fieldname: fieldname,
            };

            // Add optional fields
            if (parent !== undefined) {
              createData.parent = parent === null || parent === '' ? null : parent;
            }
            if (sortorder !== undefined) {
              createData.sortorder = sortorder === null ? null : sortorder;
            }
            if (description !== undefined) {
              createData.description = description === null || description === '' ? null : description;
            }
            if (controlledfieldname !== undefined) {
              createData.controlledfieldname = controlledfieldname === null || controlledfieldname === '' ? null : controlledfieldname;
            }
            if (controlledlabel !== undefined) {
              createData.controlledlabel = controlledlabel === null || controlledlabel === '' ? null : controlledlabel;
            }
            if (controlledvalue !== undefined) {
              createData.controlledvalue = controlledvalue === null || controlledvalue === '' ? null : controlledvalue;
            }
            if (isactive !== undefined) {
              // Handle boolean isactive field
              // null means false (inactive/deleted), false means false, true means true
              createData.isactive = isactive === null ? false : Boolean(isactive);
            } else {
              // Default to true for new items if not specified
              createData.isactive = true;
            }

            // Set timestamps
            const currentTimestamp = Date.now();
            createData.createddate = currentTimestamp;
            createData.modifieddate = currentTimestamp;

            // Create the picklist
            const created = await dynamicCreate('picklist', createData);

            if (!created) {
              throw new Error('Failed to create picklist');
            }

            // Format the response
            const formatted = formatPicklistForAPI(created);

            results.push({
              id: created.id,
              success: true,
              operation: 'create' as const,
              data: formatted
            });
            successCount++;

            logger.debug({ createdId: created.id, createData }, 'Individual picklist create successful');

          } else {
            // UPDATE operation
            // Build update data object (only include provided fields)
            const updateData: any = {};
            if (fieldname !== undefined) {
              updateData.fieldname = fieldname;
            }
            if (parent !== undefined) {
              // Handle null explicitly - allow setting parent to null
              updateData.parent = parent === null || parent === '' ? null : parent;
            }
            if (sortorder !== undefined) {
              updateData.sortorder = sortorder === null ? null : sortorder;
            }
            if (label !== undefined) {
              // Handle null explicitly - allow setting label to null
              updateData.label = label === null || label === '' ? null : label;
            }
            if (value !== undefined) {
              // Handle null explicitly - allow setting value to null
              updateData.value = value === null || value === '' ? null : value;
            }
            if (description !== undefined) {
              updateData.description = description === null || description === '' ? null : description;
            }
            if (controlledfieldname !== undefined) {
              // Handle null explicitly - allow setting controlledfieldname to null
              updateData.controlledfieldname = controlledfieldname === null || controlledfieldname === '' ? null : controlledfieldname;
            }
            if (controlledlabel !== undefined) {
              // Handle null explicitly - allow setting controlledlabel to null
              updateData.controlledlabel = controlledlabel === null || controlledlabel === '' ? null : controlledlabel;
            }
            if (controlledvalue !== undefined) {
              // Handle null explicitly - allow setting controlledvalue to null
              updateData.controlledvalue = controlledvalue === null || controlledvalue === '' ? null : controlledvalue;
            }
            if (isactive !== undefined) {
              // Handle boolean isactive field
              // null means false (inactive/deleted), false means false, true means true
              updateData.isactive = isactive === null ? false : Boolean(isactive);
            }

            // Update modifieddate
            updateData.modifieddate = Date.now();

            // If no fields to update, skip
            if (Object.keys(updateData).length === 0) {
              results.push({
                id,
                success: false,
                operation: 'update' as const,
                error: 'No fields provided to update'
              });
              failureCount++;
              continue;
            }

            // Update the picklist
            const updated = await dynamicUpdate('picklist', { id: String(id) }, updateData);

            if (!updated) {
              throw new Error('Picklist not found or update failed');
            }

            // Format the response
            const formatted = formatPicklistForAPI(updated);

            results.push({
              id,
              success: true,
              operation: 'update' as const,
              data: formatted
            });
            successCount++;

            logger.debug({ id, updateData }, 'Individual picklist update successful');
          }

        } catch (error: any) {
          logger.error({ error, item }, 'Error processing picklist item');
          const isCreate = !item.id || item.id === null || (typeof item.id === 'number' && item.id <= 0) || (typeof item.id === 'string' && (item.id === '' || parseInt(item.id) <= 0));
          results.push({
            id: item.id || 'new',
            success: false,
            operation: (isCreate ? 'create' : 'update') as 'create' | 'update',
            error: error.message || 'Operation failed'
          });
          failureCount++;
        }
      }

      logger.info({
        total: updates.length,
        successful: successCount,
        failed: failureCount
      }, 'v2 bulk picklist update completed');

      return {
        summary: {
          total: updates.length,
          successful: successCount,
          failed: failureCount
        },
        results
      };
    } catch (error) {
      logger.error({ error, updates }, 'Error in v2 bulk picklist update operation');
      throw error;
    }
  }

  /**
   * Get unique fieldnames filtered by object
   * Returns an array of unique fieldname values for a given object
   * 
   * @param object - Object name to filter by (e.g., 'product', 'stock')
   * @returns Array of unique fieldname strings
   */
  async getUniqueFieldnamesByObject(object: string): Promise<string[]> {
    try {
      logger.debug({ object }, 'Getting unique fieldnames by object');

      // Use Prisma to get distinct fieldnames
      const picklists = await prisma.picklist.findMany({
        where: {
          object: object,
          fieldname: {
            not: null
          }
        },
        select: {
          fieldname: true
        },
        distinct: ['fieldname'],
        orderBy: {
          fieldname: 'asc'
        }
      });

      // Extract fieldnames and filter out any null values (safety check)
      const fieldnames = picklists
        .map(p => p.fieldname)
        .filter((fieldname): fieldname is string => fieldname !== null && fieldname !== undefined);

      logger.info({ 
        object, 
        fieldnameCount: fieldnames.length,
        fieldnames 
      }, 'Unique fieldnames retrieved by object');

      return fieldnames;
    } catch (error) {
      logger.error({ error, object }, 'Error getting unique fieldnames by object');
      throw error;
    }
  }
} 