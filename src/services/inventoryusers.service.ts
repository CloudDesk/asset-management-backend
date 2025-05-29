import { 
  CreateInventoryUsersInput, 
  UpdateInventoryUsersInput, 
  UpsertInventoryUsersInput
} from '../schemas/inventoryusers.schema.js';
import { PaginationResult, createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
import { 
  dynamicFindManyWithFilters,
  dynamicFindUnique, 
  dynamicCreate, 
  dynamicUpdate, 
  dynamicDelete
} from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';

export class InventoryUsersService {
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info({ filters, page, limit }, 'Starting dynamic inventoryusers findMany with filters');

      const { skip, take } = getPrismaSkipTake(page, limit);

      // Use the new dynamic filtering system
      const { data: inventoryUsers, total } = await dynamicFindManyWithFilters('inventoryusers', filters, {
        skip,
        take,
        useAllColumns: true // Get all available columns
      });

      logger.info({
        inventoryUserCount: inventoryUsers.length, 
        total,
        filtered: Object.keys(filters).length > 0,
        appliedFilters: Object.keys(filters),
        availableFields: inventoryUsers.length > 0 ? Object.keys(inventoryUsers[0]) : []
      }, 'Dynamic inventoryusers findMany with filters completed');

      return createPaginationResult(inventoryUsers, total, page, limit);
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in dynamic inventoryusers findMany operation');
      throw error;
    }
  }

  async findById(id: string) {
    try {
      logger.debug({ inventoryUserId: id }, 'Starting dynamic inventoryusers findById operation');

      const inventoryUser = await dynamicFindUnique('inventoryusers', { id: parseInt(id) });

      if (!inventoryUser) {
        throw new Error('Inventory user not found');
      }

      logger.debug({ 
        inventoryUserId: id, 
        availableFields: Object.keys(inventoryUser) 
      }, 'Dynamic inventoryusers findById completed');

      return inventoryUser;
    } catch (error) {
      logger.error({ error, inventoryUserId: id }, 'Error in inventoryusers findById operation');
      throw error;
    }
  }

  async create(data: CreateInventoryUsersInput & Record<string, any>) {
    try {
      logger.debug({ originalData: data }, 'Starting dynamic inventoryusers create operation');

      // Add timestamps
      const inventoryUserData = {
        ...data,
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
      };

      const inventoryUser = await dynamicCreate('inventoryusers', inventoryUserData);

      if (!inventoryUser) {
        throw new Error('Failed to create inventory user - no valid fields provided');
      }

      logger.info({ 
        inventoryUserId: inventoryUser.id, 
        availableFields: Object.keys(inventoryUser) 
      }, 'Dynamic inventoryusers create completed');

      return inventoryUser;
    } catch (error) {
      logger.error({ error, data }, 'Error in inventoryusers create operation');
      throw error;
    }
  }

  async update(id: string, data: UpdateInventoryUsersInput & Record<string, any>) {
    try {
      // Check if inventory user exists
      await this.findById(id);

      logger.debug({ originalData: data, inventoryUserId: id }, 'Starting dynamic inventoryusers update operation');

      // Add modified timestamp
      const inventoryUserData = {
        ...data,
        modifieddate: BigInt(Date.now())
      };

      const inventoryUser = await dynamicUpdate('inventoryusers', { id: parseInt(id) }, inventoryUserData);

      if (!inventoryUser) {
        throw new Error('Failed to update inventory user - no valid fields provided');
      }

      logger.info({ 
        inventoryUserId: id, 
        availableFields: Object.keys(inventoryUser) 
      }, 'Dynamic inventoryusers update completed');

      return inventoryUser;
    } catch (error) {
      logger.error({ error, data, inventoryUserId: id }, 'Error in inventoryusers update operation');
      throw error;
    }
  }

  async delete(id: string) {
    try {
      // Check if inventory user exists
      await this.findById(id);

      logger.debug({ inventoryUserId: id }, 'Starting dynamic inventoryusers delete operation');

      const success = await dynamicDelete('inventoryusers', { id: parseInt(id) });

      if (!success) {
        throw new Error('Failed to delete inventory user');
      }

      logger.info({ inventoryUserId: id }, 'Dynamic inventoryusers delete completed successfully');
    } catch (error) {
      logger.error({ error, inventoryUserId: id }, 'Error in inventoryusers delete operation');
      throw error;
    }
  }

  async upsert(data: UpsertInventoryUsersInput & Record<string, any>) {
    try {
      const { id, ...updateData } = data;

      if (id) {
        // Update existing inventory user
        logger.debug({ inventoryUserId: id, data: updateData }, 'Upserting existing inventory user');
        return this.update(id.toString(), updateData);
      } else {
        // Create new inventory user
        logger.debug({ data: updateData }, 'Upserting new inventory user');
        return this.create(updateData);
      }
    } catch (error) {
      logger.error({ error, data }, 'Error in inventoryusers upsert operation');
      throw error;
    }
  }
} 