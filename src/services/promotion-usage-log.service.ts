import { 
  CreatePromotionUsageLogInput, 
  UpdatePromotionUsageLogInput, 
  UpsertPromotionUsageLogInput
} from '../schemas/promotion-usage-log.schema.js';
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

export class PromotionUsageLogService {
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info({ filters, page, limit }, 'Starting dynamic promotion usage logs findMany with filters');

      const { skip, take } = getPrismaSkipTake(page, limit);

      const { data: promotionUsageLogs, total } = await dynamicFindManyWithFilters('promotion_usage_log', filters, {
        skip,
        take,
        useAllColumns: true
      });

      logger.info({
        promotionUsageLogsCount: promotionUsageLogs.length, 
        total,
        filtered: Object.keys(filters).length > 0,
        appliedFilters: Object.keys(filters),
        availableFields: promotionUsageLogs.length > 0 ? Object.keys(promotionUsageLogs[0]) : []
      }, 'Dynamic promotion usage logs findMany with filters completed');

      return createPaginationResult(promotionUsageLogs, total, page, limit);
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in dynamic promotion usage logs findMany operation');
      throw error;
    }
  }

  async findById(id: string) {
    try {
      logger.debug({ promotionUsageLogId: id }, 'Starting dynamic promotion usage log findById operation');

      const promotionUsageLog = await dynamicFindUnique('promotion_usage_log', { id: parseInt(id) });

      if (!promotionUsageLog) {
        throw new Error('Promotion usage log not found');
      }

      logger.debug({ 
        promotionUsageLogId: id, 
        availableFields: Object.keys(promotionUsageLog) 
      }, 'Dynamic promotion usage log findById completed');

      return promotionUsageLog;
    } catch (error) {
      logger.error({ error, promotionUsageLogId: id }, 'Error in promotion usage log findById operation');
      throw error;
    }
  }

  async create(data: CreatePromotionUsageLogInput & Record<string, any>) {
    try {
      logger.debug({ data }, 'Starting dynamic promotion usage log create operation');

      const promotionUsageLogData = {
        ...data,
        createddate: Date.now(),
        modifieddate: Date.now()
      };

      const promotionUsageLog = await dynamicCreate('promotion_usage_log', promotionUsageLogData);

      if (!promotionUsageLog) {
        throw new Error('Failed to create promotion usage log - no valid fields provided');
      }

      logger.info({ 
        promotionUsageLogId: promotionUsageLog.id, 
        availableFields: Object.keys(promotionUsageLog) 
      }, 'Dynamic promotion usage log create completed');

      return promotionUsageLog;
    } catch (error) {
      logger.error({ error, data }, 'Error in promotion usage log create operation');
      throw error;
    }
  }

  async update(id: string, data: UpdatePromotionUsageLogInput & Record<string, any>) {
    try {
      logger.debug({ promotionUsageLogId: id, data }, 'Starting dynamic promotion usage log update operation');

      const updateData = {
        ...data,
        modifieddate: Date.now()
      };

      const promotionUsageLog = await dynamicUpdate('promotion_usage_log', { id: parseInt(id) }, updateData);

      if (!promotionUsageLog) {
        throw new Error('Promotion usage log not found or update failed');
      }

      logger.info({ 
        promotionUsageLogId: id, 
        availableFields: Object.keys(promotionUsageLog) 
      }, 'Dynamic promotion usage log update completed');

      return promotionUsageLog;
    } catch (error) {
      logger.error({ error, promotionUsageLogId: id, data }, 'Error in promotion usage log update operation');
      throw error;
    }
  }

  async delete(id: string) {
    try {
      logger.debug({ promotionUsageLogId: id }, 'Starting promotion usage log delete operation');

      const success = await dynamicDelete('promotion_usage_log', { id: parseInt(id) });

      if (!success) {
        throw new Error('Failed to delete promotion usage log');
      }

      logger.info({ promotionUsageLogId: id }, 'Promotion usage log delete completed');

      return success;
    } catch (error) {
      logger.error({ error, promotionUsageLogId: id }, 'Error in promotion usage log delete operation');
      throw error;
    }
  }

  async upsert(data: UpsertPromotionUsageLogInput & Record<string, any>) {
    try {
      const { id, ...updateData } = data;

      if (id) {
        logger.debug({ promotionUsageLogId: id, data: updateData }, 'Upserting existing promotion usage log');
        return this.update(id.toString(), updateData);
      } else {
        logger.debug({ data: updateData }, 'Upserting new promotion usage log');
        return this.create(updateData);
      }
    } catch (error) {
      logger.error({ error, data }, 'Error in promotion usage log upsert operation');
      throw error;
    }
  }
} 