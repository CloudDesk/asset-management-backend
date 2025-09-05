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
    // If no conditions, check if it's public or hhaas user-specific targeting
    if (!promotion.conditions || promotion.conditions.length === 0) {
      // For identified users, show both public and private promotions without conditions
      return true;
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
        return true; // Simplified for now
      
      case 'user.order_count':
        return true; // Simplified for now
      
      default:
        return true;
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
        
        // Get all active promotions (both public and private)
        const { data: allPromotions } = await dynamicFindManyWithFilters('promotions', baseFilters, {
          skip: 0,
          take: 1000, // Get more to filter by user segments
          useAllColumns: true
        });

        // Filter promotions based on user segments and visibility
        const personalizedPromotions = allPromotions
          .filter((promo: any) => this.isPromotionCurrentlyActive(promo))
          .filter((promo: any) => {
            // For identified users, show:
            // 1. All promotions (since visibility is mostly null in current data)
            // 2. Filter by user segments for personalized targeting
            return this.isPromotionApplicableToUser(promo, userSegments);
          })
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
        // Guest user - get ONLY public promotions
        logger.info('Getting public promotions for guest user');
        
        const publicFilters: FilterOptions = {
          ...baseFilters,
          visibility: 'public'
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



  // Calculate potential discount for recommendation
  private calculatePotentialDiscount(promotion: any, cartInfo: {
    total: number;
    items: Array<{ productId: string; qty: number; category: string; price: number }>;
    mode: 'phonepe' | 'cod';
  }) {
    let discountAmount = 0;
    let discountPercentage = 0;
    let savingsAmount = 0;

    switch (promotion.type) {
      case 'FIXED_AMOUNT_OFF_CART':
        discountAmount = Math.min(promotion.discount_value || 0, cartInfo.total);
        discountPercentage = cartInfo.total > 0 ? (discountAmount / cartInfo.total) * 100 : 0;
        savingsAmount = discountAmount;
        break;

      case 'PERCENT_OFF_CART':
        const percentage = (promotion.discount_value || 0) / 100;
        discountAmount = cartInfo.total * percentage;
        discountPercentage = promotion.discount_value || 0;
        savingsAmount = discountAmount;
        break;

      case 'FREE_SHIPPING':
        // Assume shipping cost is 50 for now - this should be calculated properly
        const shippingCost = 50;
        discountAmount = shippingCost;
        discountPercentage = cartInfo.total > 0 ? (shippingCost / cartInfo.total) * 100 : 0;
        savingsAmount = shippingCost;
        break;

      case 'FIXED_AMOUNT_OFF_ITEM':
        // Apply to eligible items
        for (const item of cartInfo.items) {
          if (this.isItemEligibleForRecommendation(item, promotion)) {
            const itemDiscount = Math.min(promotion.discount_value || 0, item.price * item.qty);
            discountAmount += itemDiscount;
          }
        }
        discountPercentage = cartInfo.total > 0 ? (discountAmount / cartInfo.total) * 100 : 0;
        savingsAmount = discountAmount;
        break;

      case 'PERCENT_OFF_ITEM':
        // Apply percentage to eligible items
        for (const item of cartInfo.items) {
          if (this.isItemEligibleForRecommendation(item, promotion)) {
            const percentage = (promotion.discount_value || 0) / 100;
            const itemDiscount = (item.price * item.qty) * percentage;
            discountAmount += itemDiscount;
          }
        }
        discountPercentage = promotion.discount_value || 0;
        savingsAmount = discountAmount;
        break;

      case 'BOGO':
        // Buy One Get One Free logic
        for (const item of cartInfo.items) {
          if (this.isItemEligibleForRecommendation(item, promotion) && item.qty >= 2) {
            const freeItems = Math.floor(item.qty / 2);
            const itemDiscount = freeItems * item.price;
            discountAmount += itemDiscount;
          }
        }
        discountPercentage = cartInfo.total > 0 ? (discountAmount / cartInfo.total) * 100 : 0;
        savingsAmount = discountAmount;
        break;
    }

    return {
      discountAmount: Math.round(discountAmount * 100) / 100, // Round to 2 decimal places
      discountPercentage: Math.round(discountPercentage * 100) / 100,
      savingsAmount: Math.round(savingsAmount * 100) / 100
    };
  }

  // Check if item is eligible for recommendation
  private isItemEligibleForRecommendation(item: { productId: string; qty: number; category: string; price: number }, promotion: any): boolean {
    // Simple eligibility check - can be extended based on promotion conditions
    return true;
  }

  // Helper methods for condition evaluation
  private evaluateNumericCondition(condition: any, value: number): boolean {
    switch (condition.operator) {
      case 'GTE': return value >= condition.value;
      case 'LTE': return value <= condition.value;
      case 'EQ': return value === condition.value;
      case 'GT': return value > condition.value;
      case 'LT': return value < condition.value;
      default: return false;
    }
  }

  private evaluateDateCondition(condition: any, date: Date): boolean {
    // Implement date condition logic
    return true;
  }

  // Database helper methods
  private async getUserCreatedDate(userId: string): Promise<Date | null> {
    try {
      const user = await this.prisma.users.findUnique({
        where: { id: parseInt(userId) },
        select: { createddate: true }
      });
      return user?.createddate ? new Date(Number(user.createddate)) : null;
    } catch (error) {
      logger.warn({ error, userId }, 'Error getting user created date');
      return null;
    }
  }

  private async getUserOrderCount(userId: string): Promise<number> {
    try {
      const count = await this.prisma.orders.count({
        where: { userid: parseInt(userId) }
      });
      return count;
    } catch (error) {
      logger.warn({ error, userId }, 'Error getting user order count');
      return 0;
    }
  }

  // Format promotion for display
  private formatPromotionForDisplay(promotion: any): any {
    return {
      promotion_id: promotion.id,
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

  // Get unified promotion offers (best recommendation + all eligible/ineligible)
  async getUnifiedPromotionOffers(request: {
    userId: string;
    cartItems: Array<{ productId: string; qty: number; category: string; price: number }>;
    mode: 'phonepe' | 'cod';
  }) {
    try {
      logger.info({ 
        userId: request.userId, 
        cartItemsCount: request.cartItems.length, 
        mode: request.mode 
      }, 'Getting eligible and ineligible promotions');

      // Calculate cart totals
      const cartTotal = request.cartItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
      const categories = [...new Set(request.cartItems.map(item => item.category).filter(Boolean))];
      const itemCount = request.cartItems.reduce((sum, item) => sum + item.qty, 0);

      logger.info({ 
        cartTotal, 
        categories, 
        itemCount 
      }, 'Cart analysis completed');

      // Get all active promotions
      const filters: FilterOptions = {
        is_active: 'true',
        status: 'active'
      };

      const { data: allPromotions } = await dynamicFindManyWithFilters('promotions', filters, {
        skip: 0,
        take: 100, // Get more promotions to evaluate
        useAllColumns: true
      });

      logger.info({ totalPromotions: allPromotions.length }, 'Retrieved active promotions');

      // Evaluate each promotion against the cart
      const eligibleCoupons = [];
      const ineligibleCoupons = [];
      const now = new Date();

      for (const promotion of allPromotions) {
        try {
          // Check if promotion is currently active
          const startDate = promotion.start_date ? new Date(promotion.start_date) : null;
          const endDate = promotion.end_date ? new Date(promotion.end_date) : null;
          
          if (startDate && startDate > now) {
            ineligibleCoupons.push({
              ...this.formatPromotionForDisplay(promotion),
              ineligibleReason: 'Promotion has not started yet',
              ineligibleDetails: {
                startDate: startDate.toISOString(),
                currentDate: now.toISOString()
              }
            });
            continue;
          }
          
          if (endDate && endDate < now) {
            ineligibleCoupons.push({
              ...this.formatPromotionForDisplay(promotion),
              ineligibleReason: 'Promotion has expired',
              ineligibleDetails: {
                endDate: endDate.toISOString(),
                currentDate: now.toISOString()
              }
            });
            continue;
          }

          // Check user eligibility if user_id provided
          let userEligible = true;
          let userIneligibleReason = '';
          if (request.userId && promotion.conditions) {
            const userEligibilityResult = await this.checkUserEligibilityForEligible(promotion, request.userId);
            userEligible = userEligibilityResult.isEligible;
            userIneligibleReason = userEligibilityResult.reason;
          }

          // Check cart eligibility
          const cartEligibilityResult = this.checkCartEligibilityForEligible(promotion, {
            total: cartTotal,
            categories,
            itemCount,
            items: request.cartItems
          });

          // If either user or cart is ineligible, add to ineligible
          if (!userEligible || !cartEligibilityResult.isEligible) {
            ineligibleCoupons.push({
              ...this.formatPromotionForDisplay(promotion),
              ineligibleReason: userIneligibleReason || cartEligibilityResult.reason,
              ineligibleDetails: {
                userEligible,
                cartEligible: cartEligibilityResult.isEligible,
                userReason: userIneligibleReason,
                cartReason: cartEligibilityResult.reason
              }
            });
            continue;
          }

          // Calculate potential discount
          const discountInfo = this.calculatePotentialDiscount(promotion, {
            total: cartTotal,
            items: request.cartItems,
            mode: request.mode
          });

          if (discountInfo.discountAmount > 0) {
            eligibleCoupons.push({
              ...this.formatPromotionForDisplay(promotion),
              discountInfo: {
                originalTotal: cartTotal,
                discountAmount: discountInfo.discountAmount,
                discountedTotal: cartTotal - discountInfo.discountAmount,
                discountPercentage: discountInfo.discountPercentage,
                savingsAmount: discountInfo.savingsAmount
              },
              cartInfo: {
                totalItems: itemCount,
                categories: categories,
                totalValue: cartTotal
              },
              mode: request.mode,
              expiresAt: promotion.end_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            });
          } else {
            ineligibleCoupons.push({
              ...this.formatPromotionForDisplay(promotion),
              ineligibleReason: 'No discount applicable to current cart',
              ineligibleDetails: {
                cartTotal,
                discountAmount: discountInfo.discountAmount
              }
            });
          }
        } catch (error) {
          logger.warn({ error, promotionId: promotion.id }, 'Error evaluating promotion for eligibility');
          ineligibleCoupons.push({
            ...this.formatPromotionForDisplay(promotion),
            ineligibleReason: 'Error evaluating promotion',
            ineligibleDetails: {
              error: error.message
            }
          });
        }
      }

      // Sort eligible coupons by best value
      eligibleCoupons.sort((a, b) => {
        // Primary sort: by actual discount amount
        if (a.discountInfo.discountAmount !== b.discountInfo.discountAmount) {
          return b.discountInfo.discountAmount - a.discountInfo.discountAmount;
        }
        // Secondary sort: by priority (lower number = higher priority)
        if (a.priority !== b.priority) {
          return (a.priority || 999) - (b.priority || 999);
        }
        // Tertiary sort: by discount percentage
        return b.discountInfo.discountPercentage - a.discountInfo.discountPercentage;
      });

      // Get the best coupon (first in sorted eligible coupons)
      const bestCoupon = eligibleCoupons.length > 0 ? eligibleCoupons[0] : null;

      logger.info({ 
        eligibleCount: eligibleCoupons.length,
        ineligibleCount: ineligibleCoupons.length,
        hasBestCoupon: !!bestCoupon
      }, 'Unified promotion offers evaluation completed');

      return {
        bestCoupon,
        eligibleCoupons,
        ineligibleCoupons,
        summary: {
          totalPromotions: allPromotions.length,
          eligibleCount: eligibleCoupons.length,
          ineligibleCount: ineligibleCoupons.length,
          cartTotal,
          cartItems: itemCount,
          categories: categories
        }
      };

    } catch (error) {
      logger.error({ error, request }, 'Error getting eligible promotions');
      throw error;
    }
  }

  // Check user eligibility for eligible promotions (with detailed reasons)
  private async checkUserEligibilityForEligible(promotion: any, userId: string): Promise<{isEligible: boolean, reason: string}> {
    if (!promotion.conditions) return { isEligible: true, reason: '' };

    try {
      const conditions = Array.isArray(promotion.conditions) ? 
        promotion.conditions : JSON.parse(promotion.conditions);

      for (const condition of conditions) {
        switch (condition.attribute) {
          case 'user.segment':
            const userSegments = await this.getUserSegments(userId);
            if (!condition.value.some((segment: string) => userSegments.includes(segment))) {
              return {
                isEligible: false,
                reason: `User segment not eligible. Required: ${condition.value.join(', ')}, Current: ${userSegments.join(', ')}`
              };
            }
            break;

          case 'user.created_date':
            const userCreatedDate = await this.getUserCreatedDate(userId);
            if (userCreatedDate && !this.evaluateDateCondition(condition, userCreatedDate)) {
              return {
                isEligible: false,
                reason: `User creation date not eligible. Required: ${condition.value}, Current: ${userCreatedDate.toISOString()}`
              };
            }
            break;

          case 'user.order_count':
            const orderCount = await this.getUserOrderCount(userId);
            if (!this.evaluateNumericCondition(condition, orderCount)) {
              return {
                isEligible: false,
                reason: `User order count not eligible. Required: ${condition.operator} ${condition.value}, Current: ${orderCount}`
              };
            }
            break;
        }
      }

      return { isEligible: true, reason: '' };
    } catch (error) {
      logger.warn({ error, promotionId: promotion.id, userId }, 'Error checking user eligibility');
      return {
        isEligible: false,
        reason: `Error checking user eligibility: ${error.message}`
      };
    }
  }

  // Check cart eligibility for eligible promotions (with detailed reasons)
  private checkCartEligibilityForEligible(promotion: any, cartInfo: {
    total: number;
    categories: string[];
    itemCount: number;
    items: Array<{ productId: string; qty: number; category: string; price: number }>;
  }): {isEligible: boolean, reason: string} {
    if (!promotion.conditions) return { isEligible: true, reason: '' };

    try {
      const conditions = Array.isArray(promotion.conditions) ? 
        promotion.conditions : JSON.parse(promotion.conditions);

      for (const condition of conditions) {
        switch (condition.attribute) {
          case 'cart.total_value':
            if (!this.evaluateNumericCondition(condition, cartInfo.total)) {
              return {
                isEligible: false,
                reason: `Cart total value not eligible. Required: ${condition.operator} ${condition.value}, Current: ${cartInfo.total}`
              };
            }
            break;

          case 'cart.item_count':
            if (!this.evaluateNumericCondition(condition, cartInfo.itemCount)) {
              return {
                isEligible: false,
                reason: `Cart item count not eligible. Required: ${condition.operator} ${condition.value}, Current: ${cartInfo.itemCount}`
              };
            }
            break;

          case 'cart.category':
            if (!condition.value.some((cat: string) => cartInfo.categories.includes(cat))) {
              return {
                isEligible: false,
                reason: `Cart category not eligible. Required: ${condition.value.join(', ')}, Current: ${cartInfo.categories.join(', ')}`
              };
            }
            break;
        }
      }

      return { isEligible: true, reason: '' };
    } catch (error) {
      logger.warn({ error, promotionId: promotion.id }, 'Error checking cart eligibility');
      return {
        isEligible: false,
        reason: `Error checking cart eligibility: ${error.message}`
      };
    }
  }

} 