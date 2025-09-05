import { 
  CreatePromotionTargetLinkInput, 
  UpdatePromotionTargetLinkInput, 
  UpsertPromotionTargetLinkInput
} from '../schemas/promotion-target-link.schema.js';
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

export class PromotionTargetLinkService {
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info({ filters, page, limit }, 'Starting dynamic promotion target links findMany with filters');

      const { skip, take } = getPrismaSkipTake(page, limit);

      const { data: promotionTargetLinks, total } = await dynamicFindManyWithFilters('promotion_target_link', filters, {
        skip,
        take,
        useAllColumns: true
      });

      logger.info({
        promotionTargetLinksCount: promotionTargetLinks.length, 
        total,
        filtered: Object.keys(filters).length > 0,
        appliedFilters: Object.keys(filters),
        availableFields: promotionTargetLinks.length > 0 ? Object.keys(promotionTargetLinks[0]) : []
      }, 'Dynamic promotion target links findMany with filters completed');

      return createPaginationResult(promotionTargetLinks, total, page, limit);
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in dynamic promotion target links findMany operation');
      throw error;
    }
  }

  async findById(id: string) {
    try {
      logger.debug({ promotionTargetLinkId: id }, 'Starting dynamic promotion target link findById operation');

      const promotionTargetLink = await dynamicFindUnique('promotion_target_link', { id: parseInt(id) });

      if (!promotionTargetLink) {
        throw new Error('Promotion target link not found');
      }

      logger.debug({ 
        promotionTargetLinkId: id, 
        availableFields: Object.keys(promotionTargetLink) 
      }, 'Dynamic promotion target link findById completed');

      return promotionTargetLink;
    } catch (error) {
      logger.error({ error, promotionTargetLinkId: id }, 'Error in promotion target link findById operation');
      throw error;
    }
  }

  async create(data: CreatePromotionTargetLinkInput & Record<string, any>) {
    try {
      logger.debug({ data }, 'Starting dynamic promotion target link create operation');

      const promotionTargetLinkData = {
        ...data,
        createddate: Date.now(),
        modifieddate: Date.now()
      };

      const promotionTargetLink = await dynamicCreate('promotion_target_link', promotionTargetLinkData);

      if (!promotionTargetLink) {
        throw new Error('Failed to create promotion target link - no valid fields provided');
      }

      logger.info({ 
        promotionTargetLinkId: promotionTargetLink.id, 
        availableFields: Object.keys(promotionTargetLink) 
      }, 'Dynamic promotion target link create completed');

      return promotionTargetLink;
    } catch (error) {
      logger.error({ error, data }, 'Error in promotion target link create operation');
      throw error;
    }
  }

  async update(id: string, data: UpdatePromotionTargetLinkInput & Record<string, any>) {
    try {
      logger.debug({ promotionTargetLinkId: id, data }, 'Starting dynamic promotion target link update operation');

      const updateData = {
        ...data,
        modifieddate: Date.now()
      };

      const promotionTargetLink = await dynamicUpdate('promotion_target_link', { id: parseInt(id) }, updateData);

      if (!promotionTargetLink) {
        throw new Error('Promotion target link not found or update failed');
      }

      logger.info({ 
        promotionTargetLinkId: id, 
        availableFields: Object.keys(promotionTargetLink) 
      }, 'Dynamic promotion target link update completed');

      return promotionTargetLink;
    } catch (error) {
      logger.error({ error, promotionTargetLinkId: id, data }, 'Error in promotion target link update operation');
      throw error;
    }
  }

  async delete(id: string) {
    try {
      logger.debug({ promotionTargetLinkId: id }, 'Starting promotion target link delete operation');

      const success = await dynamicDelete('promotion_target_link', { id: parseInt(id) });

      if (!success) {
        throw new Error('Failed to delete promotion target link');
      }

      logger.info({ promotionTargetLinkId: id }, 'Promotion target link delete completed');

      return success;
    } catch (error) {
      logger.error({ error, promotionTargetLinkId: id }, 'Error in promotion target link delete operation');
      throw error;
    }
  }

  async upsert(data: UpsertPromotionTargetLinkInput & Record<string, any>) {
    try {
      const { id, ...updateData } = data;

      if (id) {
        logger.debug({ promotionTargetLinkId: id, data: updateData }, 'Upserting existing promotion target link');
        return this.update(id.toString(), updateData);
      } else {
        logger.debug({ data: updateData }, 'Upserting new promotion target link');
        return this.create(updateData);
      }
    } catch (error) {
      logger.error({ error, data }, 'Error in promotion target link upsert operation');
      throw error;
    }
  }
} 
