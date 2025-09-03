import { 
  CreatePromotionsInput, 
  UpdatePromotionsInput
} from '../schemas/promotions.schema.js';
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

export class PromotionsService {
  
  // Get public promotions for guest users
  async getPublicPromotions(options: { channel: string; geo: string; limit: number }): Promise<any[]> {
    try {
      logger.info({ options }, 'Getting public promotions for guest users');

      // Get attractive public promotions that are:
      // 1. Active and currently running
      // 2. Public visibility (not private)
      // 3. Auto-apply or general promotions (not user-specific)
      // 4. Ordered by priority and discount value
      const filters: FilterOptions = {
        is_active: 'true',
        status: 'active',
        visibility: 'public',
        auto_apply: 'true' // Show auto-apply promotions to guests
      };

      const { data: promotions } = await dynamicFindManyWithFilters('promotions', filters, {
        skip: 0,
        take: options.limit,
        useAllColumns: true
      });

      // Filter and format promotions for guest users
      const publicPromotions = promotions
        .filter((promo: any) => {
          // Additional filtering for guest-appropriate promotions
          const now = new Date();
          const startDate = promo.start_date ? new Date(promo.start_date) : null;
          const endDate = promo.end_date ? new Date(promo.end_date) : null;
          
          // Check if promotion is currently active
          if (startDate && startDate > now) return false;
          if (endDate && endDate < now) return false;
          
          return true;
        })
        .map((promo: any) => ({
          id: promo.id,
          name: promo.name,
          description: promo.description,
          type: promo.type,
          discount_value: promo.discount_value,
          discount_type: promo.discount_type,
          start_date: promo.start_date,
          end_date: promo.end_date,
          priority: promo.priority,
          is_active: promo.is_active,
          // Don't expose sensitive fields like budget, max_redemptions, etc.
        }))
        .sort((a: any, b: any) => {
          // Sort by priority (lower number = higher priority) then by discount value
          if (a.priority !== b.priority) {
            return (a.priority || 999) - (b.priority || 999);
          }
          return (b.discount_value || 0) - (a.discount_value || 0);
        });

      logger.info({ 
        totalPromotions: promotions.length,
        publicPromotions: publicPromotions.length,
        channel: options.channel,
        geo: options.geo
      }, 'Public promotions retrieved for guest users');

      return publicPromotions;
    } catch (error) {
      logger.error({ error, options }, 'Error getting public promotions for guest users');
      throw error;
    }
  }
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
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
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in dynamic promotions findMany operation');
      throw error;
    }
  }

  async findById(id: string) {
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
    } catch (error) {
      logger.error({ error, promotionId: id }, 'Error in promotion findById operation');
      throw error;
    }
  }

  async create(data: CreatePromotionsInput & Record<string, any>) {
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
    } catch (error) {
      logger.error({ error, data }, 'Error in promotion create operation');
      throw error;
    }
  }

  async update(id: string, data: UpdatePromotionsInput & Record<string, any>) {
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
    } catch (error) {
      logger.error({ error, promotionId: id, data }, 'Error in promotion update operation');
      throw error;
    }
  }

  async delete(id: string) {
    try {
      logger.debug({ promotionId: id }, 'Starting promotion delete operation');

      const success = await dynamicDelete('promotions', { id: parseInt(id) });

      if (!success) {
        throw new Error('Failed to delete promotion');
      }

      logger.info({ promotionId: id }, 'Promotion delete completed');

      return success;
    } catch (error) {
      logger.error({ error, promotionId: id }, 'Error in promotion delete operation');
      throw error;
    }
  }


} 