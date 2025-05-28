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
  dynamicFindManyWithFilters
} from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
import { PicklistType } from '../config/dynamicFieldConfig.js';

export class PicklistService {
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
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

  async findByType(type: PicklistType, table?: string, field?: string) {
    try {
      const where: any = { type, isActive: true };
      
      if (table) where.table = table;
      if (field) where.field = field;

      logger.debug({ type, table, field }, 'Finding picklists by type');

      const picklists = await dynamicFindMany('picklist', {
        where,
        orderBy: [{ ordering: 'asc' }, { label: 'asc' }],
      });

      logger.debug({ type, picklistCount: picklists.length }, 'Found picklists by type');
      return picklists;
    } catch (error) {
      logger.error({ error, type, table, field }, 'Error finding picklists by type');
      throw error;
    }
  }

  async create(data: CreatePicklistInput) {
    try {
      logger.debug({ originalData: data }, 'Starting dynamic picklist create operation');

      // Check if value already exists for this type (if we can)
      try {
        const existing = await dynamicFindMany('picklist', {
          where: {
            type: data.type,
            value: data.value,
          },
          take: 1
        });

        if (existing.length > 0) {
          throw new Error(`Picklist item with value '${data.value}' already exists for type '${data.type}'`);
        }
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          logger.warn({ error }, 'Could not check for existing picklist item, continuing with creation');
        } else {
          throw error;
        }
      }

      // Get the next ordering value if not provided
      if (data.ordering === undefined || data.ordering === 0) {
        try {
          const lastItems = await dynamicFindMany('picklist', {
            where: { type: data.type, table: data.table, field: data.field },
            orderBy: { ordering: 'desc' },
            take: 1
          });
          data.ordering = (lastItems[0]?.ordering || 0) + 1;
        } catch (error) {
          logger.warn({ error }, 'Could not get last ordering value, using default');
          data.ordering = 1;
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

          const duplicate = existing.find(item => item.id !== id);
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

  async reorder(type: PicklistType, table: string, field: string, itemOrders: { id: string; ordering: number }[]) {
    try {
      logger.debug({ type, table, field, itemOrders }, 'Starting picklist reorder operation');

      // Validate all items exist and belong to the same type/table/field
      const items = await dynamicFindMany('picklist', {
        where: {
          type,
          table,
          field,
        },
      });

      const requestedIds = itemOrders.map(item => item.id);
      const foundItems = items.filter(item => requestedIds.includes(item.id));

      if (foundItems.length !== itemOrders.length) {
        throw new Error('Some picklist items not found or do not belong to the specified type/table/field');
      }

      // Update ordering for each item
      const updatePromises = itemOrders.map(item =>
        dynamicUpdate('picklist', { id: item.id }, { ordering: item.ordering })
      );

      await Promise.all(updatePromises);

      logger.info({ type, table, field, itemCount: itemOrders.length }, 'Picklist reorder completed');

      return await this.findByType(type, table, field);
    } catch (error) {
      logger.error({ error, type, table, field, itemOrders }, 'Error in picklist reorder operation');
      throw error;
    }
  }

  async toggleActive(id: string) {
    try {
      const picklist = await this.findById(id);

      logger.debug({ picklistId: id, currentActive: picklist.isActive }, 'Toggling picklist active status');

      const updatedPicklist = await dynamicUpdate('picklist', { id }, { 
        isActive: !picklist.isActive,
        is_active: !picklist.isActive // Also try snake_case
      });

      if (!updatedPicklist) {
        throw new Error('Failed to toggle picklist active status');
      }

      logger.info({ 
        picklistId: id, 
        newActive: updatedPicklist.isActive || updatedPicklist.is_active 
      }, 'Picklist active status toggled');

      return updatedPicklist;
    } catch (error) {
      logger.error({ error, picklistId: id }, 'Error toggling picklist active status');
      throw error;
    }
  }
} 