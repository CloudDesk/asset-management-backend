import { PrismaClient } from '@prisma/client';
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
import { getTimezoneFromGeo } from '../utils/geoUtils.js';
import { logger } from '../config/logger.js';

export class PromotionsService {
  private prisma = new PrismaClient();
  
  // Get public promotions for guest users
  async getPublicPromotions(options: { channel: string; geo: string; limit: number }): Promise<any[]> {
    try {
      logger.info({ options }, 'Getting public promotions for guest users');

      // Convert geo code to timezone
      const timezone = getTimezoneFromGeo(options.geo);
      logger.info({ geo: options.geo, timezone }, 'Geo to timezone mapping');

      // Get attractive public promotions that are:
      // 1. Active and currently running
      // 2. Public visibility (not private)
      // 3. Auto-apply or general promotions (not user-specific)
      // 4. Ordered by priority and discount value
      const filters: FilterOptions = {
        is_active: 'true',
        status: 'active',
        visibility: 'public',
        auto_apply: 'true', // Show auto-apply promotions to guests
        timezone: timezone // Filter by timezone
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
          
          // Date filtering for active promotions
          
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

  // Get personalized promotions for identified users
  async getIdentifiedUserPromotions(options: {
    userId: string;
    currentDate?: string;
    channel: string;
    geo: string;
    limit: number;
  }): Promise<any[]> {
    try {
      logger.info({ options }, 'Getting personalized promotions for identified user');

      const currentDate = options.currentDate || new Date().toISOString();
      
      // Convert geo code to timezone
      const timezone = getTimezoneFromGeo(options.geo);
      logger.info({ geo: options.geo, timezone }, 'Geo to timezone mapping');
      
      // Get user segments for personalized targeting
      const userSegments = await this.getUserSegments(options.userId);
      
      // Build filters with date constraints
      const filters: FilterOptions = {
        is_active: 'true',
        status: 'active',
        timezone: timezone // Filter by timezone
      };

      // Add date filtering
      if (currentDate) {
        filters.start_date_lte = currentDate;
        filters.end_date_gte = currentDate;
      }

      const { data: promotions } = await dynamicFindManyWithFilters('promotions', filters, {
        skip: 0,
        take: options.limit,
        useAllColumns: true
      });

      // Filter promotions based on user segments and visibility
      const personalizedPromotions = promotions
        .filter((promo: any) => {
          return this.isPromotionCurrentlyActive(promo);
        })
        .filter((promo: any) => {
          return this.isPromotionApplicableToUser(promo, userSegments);
        })
        .map((promo: any) => this.formatPromotionForDisplay(promo))
        .sort((a: any, b: any) => {
          return (a.priority || 999) - (b.priority || 999);
        });

      logger.info({ 
        userId: options.userId,
        totalPromotions: promotions.length,
        personalizedPromotions: personalizedPromotions.length,
        userSegments
      }, 'Personalized promotions retrieved for identified user');

      return personalizedPromotions;
    } catch (error) {
      logger.error({ error, options }, 'Error getting personalized promotions');
      throw error;
    }
  }

  // Get user segments for personalization
  async getUserSegments(userId: string): Promise<string[]> {
    try {
      const user = await this.prisma.users.findUnique({
        where: { id: parseInt(userId) },
        select: {
          id: true,
          createddate: true,
          firstname: true,
          usermobilenumber: true
        }
      });

      if (!user) {
        return ['guest'];
      }

      const segments: string[] = ['authenticated_user'];
      
      // Check if new user (created within 30 days)
      const daysSinceCreation = Math.floor(
        (Date.now() - Number(user.createddate)) / (1000 * 60 * 60 * 24)
      );
      
      if (daysSinceCreation <= 30) {
        segments.push('new_user');
      }

      // Check order count
      const orderCount = await this.getUserOrderCount(userId);
      if (orderCount === 0) {
        segments.push('first_order');
      }

      logger.info({ userId, segments }, 'User segments determined');

      return segments;
    } catch (error) {
      logger.error({ error, userId }, 'Error getting user segments');
      return ['authenticated_user'];
    }
  }

  // Check if promotion is currently active
  private isPromotionCurrentlyActive(promotion: any): boolean {
    const now = new Date();
    const startDate = promotion.start_date ? new Date(promotion.start_date) : null;
    const endDate = promotion.end_date ? new Date(promotion.end_date) : null;
    
    if (startDate && startDate > now) return false;
    if (endDate && endDate < now) return false;
    
    return true;
  }

  // Check if promotion is applicable to user
  private isPromotionApplicableToUser(promotion: any, userSegments: string[]): boolean {
    if (!promotion.conditions) {
      return promotion.visibility === 'public';
    }

    const conditions = Array.isArray(promotion.conditions) ? 
      promotion.conditions : JSON.parse(promotion.conditions);

    return conditions.every((condition: any) => {
      return this.evaluateCondition(condition, userSegments);
    });
  }

  // Evaluate individual condition
  private evaluateCondition(condition: any, userSegments: string[]): boolean {
    switch (condition.attribute) {
      case 'user.segment':
        return condition.value.some((segment: string) => userSegments.includes(segment));
      
      case 'user.created_date':
        return this.evaluateDateCondition(condition);
      
      case 'user.order_count':
        return this.evaluateOrderCountCondition(condition);
      
      default:
        return true;
    }
  }

  // Evaluate date condition
  private evaluateDateCondition(condition: any): boolean {
    // Implementation for date-based conditions
    // This would need to be implemented based on your date calculation logic
    return true;
  }

  // Evaluate order count condition
  private evaluateOrderCountCondition(condition: any): boolean {
    // Implementation for order count conditions
    // This would need to be implemented based on your order tracking logic
    return true;
  }

  // Format promotion for display
  private formatPromotionForDisplay(promotion: any): any {
    return {
      id: promotion.id,
      name: promotion.name,
      description: promotion.description,
      type: promotion.type,
      code: promotion.code,
      auto_apply: promotion.auto_apply,
      discount_type: promotion.discount_type,
      discount_value: promotion.discount_value,
      start_date: promotion.start_date,
      end_date: promotion.end_date,
      priority: promotion.priority,
      is_active: promotion.is_active,
      // Don't expose sensitive fields like budget, conditions, actions
    };
  }

  // Get user order count
  private async getUserOrderCount(userId: string): Promise<number> {
    try {
      const count = await this.prisma.orders.count({
        where: { userid: parseInt(userId) }
      });
      return count;
    } catch (error) {
      logger.error({ error, userId }, 'Error getting user order count');
      return 0;
    }
  }
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info({ filters, page, limit }, 'Starting dynamic promotions findMany with filters');

      // Handle userid filtering for personalized promotions
      const { userid, channel = 'web', geo = 'IN', current_date, ...otherFilters } = filters;
      
      // Convert geo code to timezone
      const geoString = Array.isArray(geo) ? (geo[0] || 'IN') : (geo || 'IN');
      const timezone = getTimezoneFromGeo(geoString);
      
      // Build base filters
      const baseFilters: FilterOptions = {
        is_active: 'true',
        status: 'active',
        timezone: timezone,
        ...otherFilters
      };

      // Add date filtering if current_date provided
      if (current_date) {
        baseFilters.start_date_lte = current_date;
        baseFilters.end_date_gte = current_date;
      }

      let finalPromotions: any[] = [];
      let total = 0;

      if (userid) {
        // Identified user - get personalized promotions
        logger.info({ userid }, 'Getting personalized promotions for identified user');
        
        // Get user segments for personalization
        const userIdString = Array.isArray(userid) ? (userid[0] || '') : (userid || '');
        const userSegments = await this.getUserSegments(userIdString);
        
        // Get all active promotions first
        const { data: allPromotions } = await dynamicFindManyWithFilters('promotions', baseFilters, {
          skip: 0,
          take: 1000, // Get more to filter by user segments
          useAllColumns: true
        });

        // Filter promotions based on user segments and visibility
        const personalizedPromotions = allPromotions
          .filter((promo: any) => this.isPromotionCurrentlyActive(promo))
          .filter((promo: any) => this.isPromotionApplicableToUser(promo, userSegments))
          .map((promo: any) => this.formatPromotionForDisplay(promo))
          .sort((a: any, b: any) => (a.priority || 999) - (b.priority || 999));

        finalPromotions = personalizedPromotions.slice(0, limit);
        total = personalizedPromotions.length;
        
        logger.info({ 
          userid,
          totalPromotions: allPromotions.length,
          personalizedPromotions: finalPromotions.length,
          userSegments
        }, 'Personalized promotions retrieved for identified user');
      } else {
        // Guest user - get public promotions
        logger.info('Getting public promotions for guest user');
        
        const publicFilters: FilterOptions = {
          ...baseFilters,
          visibility: 'public',
          auto_apply: 'true'
        };

        const { data: promotions, total: promotionTotal } = await dynamicFindManyWithFilters('promotions', publicFilters, {
          skip: 0,
          take: limit,
          useAllColumns: true
        });

        // Filter and format promotions for guest users
        finalPromotions = promotions
          .filter((promo: any) => this.isPromotionCurrentlyActive(promo))
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

        total = finalPromotions.length;
        
        logger.info({ 
          totalPromotions: promotions.length,
          publicPromotions: finalPromotions.length,
          channel,
          geo
        }, 'Public promotions retrieved for guest user');
      }

      logger.info({
        promotionsCount: finalPromotions.length, 
        total,
        filtered: Object.keys(filters).length > 0,
        appliedFilters: Object.keys(filters),
        userType: userid ? 'identified' : 'guest'
      }, 'Dynamic promotions findMany with filters completed');

      return createPaginationResult(finalPromotions, total, page, limit);
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