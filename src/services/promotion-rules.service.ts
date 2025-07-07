import { 
  CreatePromotionRulesInput, 
  UpdatePromotionRulesInput, 
  UpsertPromotionRulesInput
} from '../schemas/promotion-rules.schema.js';
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

export class PromotionRulesService {
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info({ filters, page, limit }, 'Starting dynamic promotion rules findMany with filters');

      const { skip, take } = getPrismaSkipTake(page, limit);

      const { data: promotionRules, total } = await dynamicFindManyWithFilters('promotion_rules', filters, {
        skip,
        take,
        useAllColumns: true
      });

      logger.info({
        promotionRulesCount: promotionRules.length, 
        total,
        filtered: Object.keys(filters).length > 0,
        appliedFilters: Object.keys(filters),
        availableFields: promotionRules.length > 0 ? Object.keys(promotionRules[0]) : []
      }, 'Dynamic promotion rules findMany with filters completed');

      return createPaginationResult(promotionRules, total, page, limit);
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in dynamic promotion rules findMany operation');
      throw error;
    }
  }

  async findById(id: string) {
    try {
      logger.debug({ promotionRuleId: id }, 'Starting dynamic promotion rule findById operation');

      const promotionRule = await dynamicFindUnique('promotion_rules', { id: parseInt(id) });

      if (!promotionRule) {
        throw new Error(`Promotion rule with ID ${id} not found`);
      }

      logger.debug({ 
        promotionRuleId: id, 
        availableFields: Object.keys(promotionRule) 
      }, 'Dynamic promotion rule findById completed');

      return promotionRule;
    } catch (error) {
      logger.error({ error, promotionRuleId: id }, 'Error in promotion rule findById operation');
      throw error;
    }
  }

  async create(data: CreatePromotionRulesInput & Record<string, any>) {
    try {
      logger.debug({ data }, 'Starting dynamic promotion rule create operation');

      // Validate required fields
      if (!data.promotion_id) {
        throw new Error('Promotion ID is required');
      }
      if (!data.rule_type || data.rule_type.trim() === '') {
        throw new Error('Rule type cannot be empty');
      }
      if (!data.operator || data.operator.trim() === '') {
        throw new Error('Operator cannot be empty');
      }
      if (data.value === undefined || data.value === null || data.value === '') {
        throw new Error('Value cannot be empty');
      }

      const promotionRuleData = {
        ...data,
        createddate: Date.now(),
        modifieddate: Date.now()
      };

      const promotionRule = await dynamicCreate('promotion_rules', promotionRuleData);

      if (!promotionRule) {
        throw new Error('Failed to create promotion rule - no valid fields provided');
      }

      logger.info({ 
        promotionRuleId: promotionRule.id, 
        availableFields: Object.keys(promotionRule) 
      }, 'Dynamic promotion rule create completed');

      return promotionRule;
    } catch (error) {
      logger.error({ error, data }, 'Error in promotion rule create operation');
      throw error;
    }
  }

  async update(id: string, data: UpdatePromotionRulesInput & Record<string, any>) {
    try {
      logger.debug({ promotionRuleId: id, data }, 'Starting dynamic promotion rule update operation');

      const updateData = {
        ...data,
        modifieddate: Date.now()
      };

      const promotionRule = await dynamicUpdate('promotion_rules', { id: parseInt(id) }, updateData);

      if (!promotionRule) {
        throw new Error('Promotion rule not found or update failed');
      }

      logger.info({ 
        promotionRuleId: id, 
        availableFields: Object.keys(promotionRule) 
      }, 'Dynamic promotion rule update completed');

      return promotionRule;
    } catch (error) {
      logger.error({ error, promotionRuleId: id, data }, 'Error in promotion rule update operation');
      throw error;
    }
  }

  async delete(id: string) {
    try {
      logger.debug({ promotionRuleId: id }, 'Starting promotion rule delete operation');

      const success = await dynamicDelete('promotion_rules', { id: parseInt(id) });

      if (!success) {
        throw new Error('Failed to delete promotion rule');
      }

      logger.info({ promotionRuleId: id }, 'Promotion rule delete completed');

      return success;
    } catch (error) {
      logger.error({ error, promotionRuleId: id }, 'Error in promotion rule delete operation');
      throw error;
    }
  }

  async upsert(data: UpsertPromotionRulesInput & Record<string, any>) {
    try {
      const { id, ...updateData } = data;

      if (id) {
        logger.debug({ promotionRuleId: id, data: updateData }, 'Upserting existing promotion rule');
        return this.update(id.toString(), updateData);
      } else {
        logger.debug({ data: updateData }, 'Upserting new promotion rule');
        return this.create(updateData);
      }
    } catch (error) {
      logger.error({ error, data }, 'Error in promotion rule upsert operation');
      throw error;
    }
  }
} 