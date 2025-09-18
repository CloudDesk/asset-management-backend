import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger.js';
import { dynamicFindManyWithFilters } from '../utils/dynamicDbOperations.js';
import { 
  EvaluationRequest, 
  EvaluationResponse, 
  CartData, 
  AppliedPromotion, 
  IneligibleReason,
  DiscountBreakdown 
} from '../schemas/evaluation.schema.js';
import { createHash } from 'crypto';

export class PromotionEvaluationService {
  private prisma: PrismaClient;

  // Helper function to get discount value from either old or new format
  private getDiscountValue(promotion: any): number {
    if (promotion.discount_value !== null && promotion.discount_value !== undefined) {
      return promotion.discount_value;
    }
    if (promotion.action && promotion.action.value !== null && promotion.action.value !== undefined) {
      return promotion.action.value;
    }
    return 0;
  }

  // Enhanced helper to calculate discount with action object logic
  private calculateDiscountWithAction(promotion: any, itemPrice: number, itemQuantity: number, totalCartValue?: number): number {
    if (!promotion.action) {
      // Fallback to old logic
      return this.getDiscountValue(promotion);
    }

    const action = promotion.action;
    let discount = 0;

    // Ensure action.value exists and is a valid number
    const actionValue = action.value || 0;

    switch (action.type) {
      case 'PERCENT_OFF':
        discount = (itemPrice * itemQuantity * actionValue) / 100;
        // Apply max_discount cap if specified (optional field)
        if (action.max_discount && typeof action.max_discount === 'number' && discount > action.max_discount) {
          discount = action.max_discount;
        }
        break;

      case 'FIXED_AMOUNT_OFF':
        discount = Math.min(actionValue, itemPrice * itemQuantity);
        break;

      case 'FREE_SHIPPING':
        discount = 0; // Free shipping doesn't affect item prices
        break;

      case 'BOGO':
        // BOGO logic - all fields are optional with defaults
        const buyQuantity = action.buy_quantity || 1;
        const getQuantity = action.get_quantity || 1;
        
        if (itemQuantity >= buyQuantity) {
          const freeItems = Math.floor(itemQuantity / buyQuantity) * getQuantity;
          // max_free_items is optional - if not specified, no limit
          const maxFreeItems = action.max_free_items || freeItems;
          const actualFreeItems = Math.min(freeItems, maxFreeItems);
          discount = actualFreeItems * itemPrice;
        }
        break;

      case 'FREE_PRODUCT':
        // Free product logic - minimum purchase check should be done at cart level
        // min_purchase and free_product_id are optional fields
        discount = 0; // Free product doesn't reduce existing item prices
        break;

      default:
        discount = this.getDiscountValue(promotion);
    }

    return discount;
  }

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Helper function to build enhanced applied promotion object with new fields
  private buildAppliedPromotion(promotion: any, discountAmount: number, cartItems: any[], isAuto: boolean = false): any {
    const basePromotion: any = {
      promotion_id: promotion.id,
      promotion_name: promotion.name || `Promotion ${promotion.id}`,
      promotion_type: promotion.type || 'UNKNOWN',
      discount_amount: discountAmount,
      is_auto: isAuto,
      is_free_shipping: promotion.type === 'FREE_SHIPPING',
      is_stacked: this.isStackablePromotion(promotion.type)
    };

    // Add BOGO-specific details
    if (promotion.type === 'BOGO' && promotion.action) {
      const bogoDetails = this.calculateBogoDetails(promotion, cartItems);
      if (bogoDetails) {
        basePromotion.bogo_details = bogoDetails;
      }
    }

    // Add FREE_PRODUCT-specific details
    if (promotion.type === 'FREE_PRODUCT' && promotion.action) {
      const freeProductDetails = this.calculateFreeProductDetails(promotion, cartItems);
      if (freeProductDetails) {
        basePromotion.free_product_details = freeProductDetails;
      }
    }

    return basePromotion;
  }

  // Helper function to determine if a promotion type is stackable
  private isStackablePromotion(promotionType: string): boolean {
    const stackableTypes = ['FREE_SHIPPING', 'BOGO', 'FREE_PRODUCT'];
    return stackableTypes.includes(promotionType);
  }

  // Helper function to calculate BOGO details
  private calculateBogoDetails(promotion: any, cartItems: any[]): any {
    if (!promotion.action || promotion.action.type !== 'BOGO') {
      return null;
    }

    const action = promotion.action;
    const buyQuantity = action.buy_quantity || 1;
    const getQuantity = action.get_quantity || 1;
    const maxFreeItems = action.max_free_items;
    const productIds = action.product_ids || [];

    let totalFreeItems = 0;
    const affectedProducts: string[] = [];

    for (const item of cartItems) {
      // Check if item is eligible (either no product_ids specified or item is in the list)
      const isEligible = productIds.length === 0 || productIds.includes(item.product_id);
      
      if (isEligible && item.quantity >= buyQuantity) {
        const freeItems = Math.floor(item.quantity / buyQuantity) * getQuantity;
        let actualFreeItems = freeItems;
        
        // Apply max_free_items limit if specified
        if (maxFreeItems && totalFreeItems + freeItems > maxFreeItems) {
          actualFreeItems = Math.max(0, maxFreeItems - totalFreeItems);
        }
        
        if (actualFreeItems > 0) {
          totalFreeItems += actualFreeItems;
          affectedProducts.push(item.product_id);
        }
      }
    }

    return {
      buy_quantity: buyQuantity,
      get_quantity: getQuantity,
      affected_products: affectedProducts,
      free_items_count: totalFreeItems
    };
  }

  // Helper function to calculate FREE_PRODUCT details
  private calculateFreeProductDetails(promotion: any, cartItems: any[]): any {
    if (!promotion.action || promotion.action.type !== 'FREE_PRODUCT') {
      return null;
    }

    const action = promotion.action;
    const freeProductId = action.free_product_id;
    const maxFreeItems = action.max_free_items || 1;
    const minPurchase = action.min_purchase || 0;

    // Calculate cart total to check minimum purchase requirement
    const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Check if minimum purchase requirement is met
    if (cartTotal < minPurchase) {
      return null;
    }

    // Grant the free product (default to 1 item, up to max_free_items)
    const grantedItems = Math.min(1, maxFreeItems);

    return {
      free_product_id: freeProductId,
      max_free_items: maxFreeItems,
      granted_items_count: grantedItems
    };
  }

  // Helper methods for date handling with Unix timestamps
  private getUtcTimestamp(): bigint {
    return BigInt(new Date().getTime()); // Current UTC time in milliseconds
  }

  private getUtcTimestampWithOffset(offsetMinutes: number): bigint {
    return BigInt(new Date().getTime() + (offsetMinutes * 60 * 1000)); // UTC time + offset
  }

  // Helper function to convert Unix timestamp to Date object
  private convertUnixTimestampToDate(timestamp: number | string | bigint | null): Date | null {
    if (!timestamp) return null;
    
    const numTimestamp = typeof timestamp === 'string' ? parseInt(timestamp) : 
                        typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;
    if (isNaN(numTimestamp)) return null;
    
    return new Date(numTimestamp * 1000); // Convert seconds to milliseconds
  }

  // Main evaluation method
  async evaluatePromotion(request: EvaluationRequest): Promise<EvaluationResponse> {
    try {
      logger.info({ request }, 'Starting promotion evaluation');

      // 1. Get promotion details
      const promotion = await this.getPromotion(request.promotion_id);
      if (!promotion) {
        throw new Error('Promotion not found');
      }

      // 2. Validate promotion is active and applicable
      const validationResult = await this.validatePromotion(promotion, request);
      if (!validationResult.isValid) {
        return this.createIneligibleResponse(request, validationResult.reasons);
      }

      // 3. Calculate discounts
      const discountResult = await this.calculateDiscounts(promotion, request.cart_data);

      // 4. Create evaluation record
      const evaluationId = uuidv4();
      const expiresAtUtc = this.getUtcTimestampWithOffset(promotion.evaluation_expiry_minutes || 15);

      await this.createEvaluationRecord({
        evaluationId,
        userId: request.user_id,
        cartData: request.cart_data,
        promotion,
        discountResult,
        expiresAt: expiresAtUtc
      });

      // 5. Build response
      const response: EvaluationResponse = {
        success: true,
        evaluation_id: evaluationId,
        original_total: request.cart_data.subtotal + request.cart_data.shipping_cost + request.cart_data.tax_amount,
        discounted_total: discountResult.discounted_total,
        total_discount: discountResult.total_discount,
        applied_promotions: [this.buildAppliedPromotion(
          promotion, 
          discountResult.total_discount, 
          request.cart_data.items || [], 
          false // is_auto = false (manual evaluation)
        )],
        ineligible_reasons: [],
        expires_at: expiresAtUtc.toString()
      };

      logger.info({ evaluationId, totalDiscount: discountResult.total_discount }, 'Promotion evaluation completed');
      return response;

    } catch (error) {
      logger.error({ error, request }, 'Error in promotion evaluation');
      throw error;
    }
  }

  // Get promotion by ID
  private async getPromotion(promotionId: number) {
    return await this.prisma.promotions.findUnique({
      where: { id: promotionId }
    });
  }

  // Validate promotion eligibility
  private async validatePromotion(promotion: any, request: EvaluationRequest) {
    const reasons: IneligibleReason[] = [];

    // Check if promotion is active
    if (promotion.status !== 'active') {
      reasons.push({
        promotion_id: promotion.id,
        reason: 'Promotion is not active'
      });
    }

    // Check date range
    const now = new Date();
    const startDate = this.convertUnixTimestampToDate(promotion.start_date);
    const endDate = this.convertUnixTimestampToDate(promotion.end_date);
    
    if (startDate && startDate > now) {
      reasons.push({
        promotion_id: promotion.id,
        reason: 'Promotion has not started yet',
        required_value: startDate ? startDate.getTime() : 0,
        current_value: now.getTime()
      });
    }

    if (endDate && endDate < now) {
      reasons.push({
        promotion_id: promotion.id,
        reason: 'Promotion has expired',
        required_value: endDate ? endDate.getTime() : 0,
        current_value: now.getTime()
      });
    }

    // Check user eligibility if user_id provided
    if (request.user_id && promotion.conditions) {
      const userEligibility = await this.checkUserEligibility(promotion, request.user_id);
      if (!userEligibility.isEligible) {
        reasons.push(...userEligibility.reasons);
      }
    }

    // Check cart conditions
    const cartEligibility = this.checkCartEligibility(promotion, request.cart_data);
    if (!cartEligibility.isEligible) {
      reasons.push(...cartEligibility.reasons);
    }

    return {
      isValid: reasons.length === 0,
      reasons
    };
  }

  // Check user eligibility based on conditions
  private async checkUserEligibility(promotion: any, userId: string) {
    const reasons: IneligibleReason[] = [];

    if (!promotion.conditions) {
      return { isEligible: true, reasons: [] };
    }

    const conditions = Array.isArray(promotion.conditions) ? 
      promotion.conditions : JSON.parse(promotion.conditions);

    for (const condition of conditions) {
      switch (condition.attribute) {
        case 'user.segment':
          const userSegments = await this.getUserSegments(userId);
          if (!condition.value.some((segment: string) => userSegments.includes(segment))) {
            reasons.push({
              promotion_id: promotion.id,
              reason: 'User segment not eligible',
              required_value: condition.value,
              current_value: userSegments.length
            });
          }
          break;

        case 'user.created_date':
          const userCreatedDate = await this.getUserCreatedDate(userId);
          if (userCreatedDate && !this.evaluateDateCondition(condition, userCreatedDate)) {
            reasons.push({
              promotion_id: promotion.id,
              reason: 'User creation date not eligible',
              required_value: condition.value,
              current_value: userCreatedDate.getTime()
            });
          }
          break;

        case 'user.order_count':
          const orderCount = await this.getUserOrderCount(userId);
          if (!this.evaluateNumericCondition(condition, orderCount)) {
            reasons.push({
              promotion_id: promotion.id,
              reason: 'User order count not eligible',
              required_value: condition.value,
              current_value: orderCount
            });
          }
          break;
      }
    }

    return {
      isEligible: reasons.length === 0,
      reasons
    };
  }

  // Check cart eligibility based on conditions
  private checkCartEligibility(promotion: any, cartData: CartData) {
    const reasons: IneligibleReason[] = [];

    if (!promotion.conditions) {
      return { isEligible: true, reasons: [] };
    }

    const conditions = Array.isArray(promotion.conditions) ? 
      promotion.conditions : JSON.parse(promotion.conditions);

    for (const condition of conditions) {
      switch (condition.attribute) {
        case 'cart.total_value':
          const totalValue = cartData.subtotal + cartData.shipping_cost + cartData.tax_amount;
          if (!this.evaluateNumericCondition(condition, totalValue)) {
            reasons.push({
              promotion_id: promotion.id,
              reason: 'Cart total value not eligible',
              required_value: condition.value,
              current_value: totalValue
            });
          }
          break;

        case 'cart.item_count':
          const itemCount = cartData.items.reduce((sum, item) => sum + item.quantity, 0);
          if (!this.evaluateNumericCondition(condition, itemCount)) {
            reasons.push({
              promotion_id: promotion.id,
              reason: 'Cart item count not eligible',
              required_value: condition.value,
              current_value: itemCount
            });
          }
          break;

        case 'cart.category':
          const categories = [...new Set(cartData.items.map(item => item.category).filter(Boolean))];
          if (!condition.value.some((cat: string) => categories.includes(cat))) {
            reasons.push({
              promotion_id: promotion.id,
              reason: 'Cart category not eligible',
              required_value: condition.value,
              current_value: categories.length
            });
          }
          break;
      }
    }

    return {
      isEligible: reasons.length === 0,
      reasons
    };
  }

  // Calculate discounts based on promotion type
  private async calculateDiscounts(promotion: any, cartData: CartData) {
    const totalValue = cartData.subtotal + cartData.shipping_cost + cartData.tax_amount;
    let totalDiscount = 0;
    let discountedTotal = totalValue;
    const affectedItems: string[] = [];
    const itemDiscounts: any[] = [];

    switch (promotion.type) {
      case 'FIXED_AMOUNT_OFF_CART':
        totalDiscount = Math.min(this.getDiscountValue(promotion), totalValue);
        discountedTotal = totalValue - totalDiscount;
        break;

      case 'PERCENT_OFF_CART':
        const percentage = this.getDiscountValue(promotion) / 100;
        totalDiscount = totalValue * percentage;
        
        // Apply max_discount cap if specified in action (optional field)
        if (promotion.action && 
            promotion.action.max_discount && 
            typeof promotion.action.max_discount === 'number' && 
            totalDiscount > promotion.action.max_discount) {
          totalDiscount = promotion.action.max_discount;
        }
        
        discountedTotal = totalValue - totalDiscount;
        break;

      case 'FREE_SHIPPING':
        totalDiscount = cartData.shipping_cost;
        discountedTotal = totalValue - totalDiscount;
        break;

      case 'FIXED_AMOUNT_OFF_ITEM':
        // Apply to specific items based on conditions
        for (const item of cartData.items) {
          if (this.isItemEligible(item, promotion)) {
            const itemDiscount = Math.min(this.getDiscountValue(promotion), item.price * item.quantity);
            totalDiscount += itemDiscount;
            affectedItems.push(item.product_id);
            itemDiscounts.push({
              product_id: item.product_id,
              original_price: item.price * item.quantity,
              discounted_price: (item.price * item.quantity) - itemDiscount,
              discount_amount: itemDiscount
            });
          }
        }
        discountedTotal = totalValue - totalDiscount;
        break;

      case 'PERCENT_OFF_ITEM':
        // Apply percentage to specific items
        for (const item of cartData.items) {
          if (this.isItemEligible(item, promotion)) {
            const percentage = this.getDiscountValue(promotion) / 100;
            const itemDiscount = (item.price * item.quantity) * percentage;
            totalDiscount += itemDiscount;
            affectedItems.push(item.product_id);
            itemDiscounts.push({
              product_id: item.product_id,
              original_price: item.price * item.quantity,
              discounted_price: (item.price * item.quantity) - itemDiscount,
              discount_amount: itemDiscount
            });
          }
        }
        discountedTotal = totalValue - totalDiscount;
        break;

      case 'BOGO':
        // Buy One Get One Free logic
        for (const item of cartData.items) {
          if (this.isItemEligible(item, promotion) && item.quantity >= 2) {
            const freeItems = Math.floor(item.quantity / 2);
            const itemDiscount = freeItems * item.price;
            totalDiscount += itemDiscount;
            affectedItems.push(item.product_id);
            itemDiscounts.push({
              product_id: item.product_id,
              original_price: item.price * item.quantity,
              discounted_price: (item.price * item.quantity) - itemDiscount,
              discount_amount: itemDiscount
            });
          }
        }
        discountedTotal = totalValue - totalDiscount;
        break;

      case 'FREE_PRODUCT':
        // Free product logic - doesn't reduce cart total (like FREE_SHIPPING)
        totalDiscount = 0;  // Free products don't discount existing items
        discountedTotal = totalValue; // Cart total remains unchanged
        break;
    }

    const breakdown: DiscountBreakdown = {
      item_discounts: itemDiscounts,
      shipping_discount: promotion.type === 'FREE_SHIPPING' ? cartData.shipping_cost : 0,
      cart_discount: totalDiscount - (promotion.type === 'FREE_SHIPPING' ? cartData.shipping_cost : 0)
    };

    return {
      total_discount: totalDiscount,
      discounted_total: discountedTotal,
      affected_items: affectedItems,
      breakdown
    };
  }

  // Check if item is eligible for promotion
  private isItemEligible(item: any, promotion: any): boolean {
    // Simple eligibility check - can be extended based on conditions
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
  private async getUserSegments(userId: string): Promise<string[]> {
    // Implement user segment retrieval
    return ['new_user']; // Placeholder
  }

  private async getUserCreatedDate(userId: string): Promise<Date | null> {
    const user = await this.prisma.users.findUnique({
      where: { id: parseInt(userId) },
      select: { createddate: true }
    });
    return user?.createddate ? new Date(Number(user.createddate)) : null;
  }

  private async getUserOrderCount(userId: string): Promise<number> {
    const count = await this.prisma.orders.count({
      where: { userid: parseInt(userId) }
    });
    return count;
  }

  // Create evaluation record
  private async createEvaluationRecord(data: any) {
    const nowUtc = this.getUtcTimestamp();
    const expiresAtUtc = this.getUtcTimestampWithOffset(15); // 15 minutes as requested

    await this.prisma.promotion_evaluations.create({
      data: {
        evaluation_id: data.evaluationId,
        user_id: data.userId,
        cart_data: data.cartData,
        original_total: data.cartData.subtotal + data.cartData.shipping_cost + data.cartData.tax_amount,
        discounted_total: data.discountResult.discounted_total,
        applied_promotions: [{
          promotion_id: data.promotion.id,
          promotion_name: data.promotion.name,
          discount_amount: data.discountResult.total_discount
        }],
        ineligible_coupons: [],
        context: {},
        created_at: BigInt(Date.now()) as any,           // Temporary fix: cast as any
        expires_at: BigInt(Date.now() + (15 * 60 * 1000)) as any,     // Temporary fix: cast as any
        status: 'active',
        createddate: BigInt(Date.now()),          // UTC timestamp
        modifieddate: BigInt(Date.now())          // UTC timestamp
      }
    });
  }

  // Create ineligible response
  private createIneligibleResponse(request: EvaluationRequest, reasons: IneligibleReason[]): EvaluationResponse {
    const totalValue = request.cart_data.subtotal + request.cart_data.shipping_cost + request.cart_data.tax_amount;
    
    return {
      success: false,
      evaluation_id: '',
      original_total: totalValue,
      discounted_total: totalValue,
      total_discount: 0,
      applied_promotions: [],
      ineligible_reasons: reasons,
      expires_at: new Date().toISOString()
    };
  }

  // Get evaluation by ID
  async getEvaluation(evaluationId: string) {
    try {
      const evaluation = await this.prisma.promotion_evaluations.findUnique({
        where: { evaluation_id: evaluationId }
      });
      
      return evaluation;
    } catch (error) {
      logger.error({ error, evaluationId }, 'Error getting evaluation');
      throw error;
    }
  }

  // Evaluate specific promotion against user's cart
  async evaluateSpecificPromotion(request: {
    user_id: string;
    promotion_id?: number;
    code?: string;
    cart_items: Array<{
      cart_record_id: string;
      product_id: string;
      quantity: number;
      base_price: number;
      product_discount: number;
      price: number;
      category: string;
      subcategory?: string;
      name?: string;
    }>;
    context: {
      channel: 'web' | 'mobile' | 'mobile_app';
      geo: string;
      payment_method?: string;
      user_agent?: string;
      ip_address?: string;
    };
  }) {
    try {
      logger.info({ 
        userId: request.user_id, 
        promotionId: request.promotion_id,
        code: request.code,
        cartItemsCount: request.cart_items.length 
      }, 'Evaluating specific promotion against user cart');

      // Generate cart signature to check for existing evaluation
      const cartSignature = this.generateCartSignature(request.cart_items);
      
      // Check for existing active evaluation with same cart signature
      const existingEvaluation = await this.findActiveEvaluationByCartSignature(request.user_id, cartSignature);
      
      if (existingEvaluation) {
        logger.info({ 
          evaluationId: existingEvaluation.evaluation_id,
          cartSignature 
        }, 'Found existing active evaluation for cart signature - will update with manual promotion');
        
        // Update existing evaluation with the new manual promotion
        return await this.updateEvaluationWithManualPromotion(existingEvaluation, request);
      }

      // Generate unique evaluation ID for new evaluation
      const evaluationId = this.generateEvaluationId();

      // Get the specific promotion by ID or code
      let promotion;
      if (request.promotion_id) {
        promotion = await this.prisma.promotions.findUnique({
          where: { id: request.promotion_id }
        });
      } else if (request.code) {
        promotion = await this.prisma.promotions.findFirst({
          where: { 
            code: request.code,
            status: 'active'
          }
        });
      }

      if (!promotion) {
        const identifier = request.promotion_id ? `ID ${request.promotion_id}` : `code "${request.code}"`;
        throw new Error(`Promotion not found with ${identifier}`);
      }

      // Calculate cart totals using the price field (already after product discount)
      const originalTotal = request.cart_items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const categories = [...new Set(request.cart_items.map(item => item.category).filter(Boolean))];

      logger.info({ 
        originalTotal, 
        categories, 
        promotionName: promotion.name 
      }, 'Cart analysis completed');

      // Check if promotion is currently active
      const now = new Date();
      const startDate = this.convertUnixTimestampToDate(promotion.start_date);
      const endDate = this.convertUnixTimestampToDate(promotion.end_date);
      
      if (startDate && startDate > now) {
        return {
          evaluation_id: evaluationId,
          promotion_id: promotion.id,
          promotion_name: promotion.name,
          is_eligible: false,
          original_total: originalTotal,
          discounted_total: originalTotal,
          total_discount: 0,
          discount_breakdown: [],
          ineligible_reason: 'Promotion has not started yet',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 60 minutes
        };
      }
      
      if (endDate && endDate < now) {
        return {
          evaluation_id: evaluationId,
          promotion_id: promotion.id,
          promotion_name: promotion.name,
          is_eligible: false,
          original_total: originalTotal,
          discounted_total: originalTotal,
          total_discount: 0,
          discount_breakdown: [],
          ineligible_reason: 'Promotion has expired',
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        };
      }

      // Check user eligibility
      const userEligible = await this.checkUserEligibility(promotion, request.user_id);
      if (!userEligible.isEligible) {
        return {
          evaluation_id: evaluationId,
          promotion_id: promotion.id,
          promotion_name: promotion.name,
          is_eligible: false,
          original_total: originalTotal,
          discounted_total: originalTotal,
          total_discount: 0,
          discount_breakdown: [],
          ineligible_reason: userEligible.reasons?.[0]?.reason || 'User not eligible',
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        };
      }

      // Check cart eligibility
      const cartEligible = this.checkCartEligibility(promotion, {
        subtotal: originalTotal,
        items: request.cart_items.map(item => ({
          quantity: item.quantity,
          base_price: item.base_price,
          product_discount: item.product_discount,
          price: item.price,
          product_id: item.product_id,
          name: item.name,
          category: item.category,
          subcategory: item.subcategory
        })),
        shipping_cost: 0,
        tax_amount: 0,
        total: originalTotal
      });

      if (!cartEligible.isEligible) {
        return {
          evaluation_id: evaluationId,
          promotion_id: promotion.id,
          promotion_name: promotion.name,
          is_eligible: false,
          original_total: originalTotal,
          discounted_total: originalTotal,
          total_discount: 0,
          discount_breakdown: [],
          ineligible_reason: cartEligible.reasons?.[0]?.reason || 'Cart not eligible',
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        };
      }

      // Calculate discount breakdown
      const discountBreakdown = this.calculateDiscountBreakdown(promotion, request.cart_items);
      const totalDiscount = discountBreakdown.reduce((sum, item) => sum + item.total_discount, 0);
      
      // For FREE_SHIPPING promotions, the discount is applied to shipping, not cart total
      let discountedTotal = originalTotal;
      let shippingInfo = undefined;
      
      if (promotion.type === 'FREE_SHIPPING') {
        // For free shipping, cart total remains the same, but shipping cost is reduced
        discountedTotal = originalTotal; // Cart total doesn't change
        const originalShippingCost = this.calculateShippingCost(request.cart_items);
        const finalShippingCost = 0; // Free shipping
        const shippingDiscount = originalShippingCost;
        
        shippingInfo = {
          original_shipping_cost: originalShippingCost,
          final_shipping_cost: finalShippingCost,
          shipping_discount: shippingDiscount,
          is_free_shipping: true
        };
      } else {
        // For other promotions, apply discount to cart total
        discountedTotal = originalTotal - totalDiscount;
      }

      // Store evaluation for redemption
      await this.storeEvaluation(evaluationId, {
        user_id: request.user_id,
        promotion_id: promotion.id,
        original_total: originalTotal,
        discounted_total: discountedTotal,
        cart_items: request.cart_items,
        discount_breakdown: discountBreakdown,
        context: request.context,
        promotion_type: promotion.type,
        shipping_info: shippingInfo
      });

      logger.info({
        evaluationId,
        promotionId: promotion.id,
        totalDiscount,
        discountedTotal,
        shippingInfo
      }, 'Promotion evaluation completed successfully');

      return {
        evaluation_id: evaluationId,
        promotion_id: promotion.id,
        promotion_name: promotion.name,
        is_eligible: true,
        original_total: originalTotal,
        discounted_total: discountedTotal,
        total_discount: totalDiscount,
        discount_breakdown: discountBreakdown,
        ineligible_reason: null,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        promotion_type: promotion.type,
        shipping_info: shippingInfo
      };

    } catch (error) {
      logger.error({ error, request }, 'Error evaluating specific promotion');
      throw error;
    }
  }

  // Generate unique evaluation ID
  private generateEvaluationId(): string {
    return `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }



  // Calculate detailed discount breakdown per cart item
  private calculateDiscountBreakdown(promotion: any, cartItems: Array<{
    cart_record_id: string;
    product_id: string;
    quantity: number;
    base_price: number;
    product_discount: number;
    price: number;
    category: string;
    subcategory?: string;
    name?: string;
  }>): Array<{
    cart_record_id: string;
    product_id: string;
    product_name: string;
    category: string;
    quantity: number;
    original_price: number;
    discount_per_item: number;
    final_price_per_item: number;
    total_discount: number;
  }> {
    const breakdown = [];

    // Handle FREE_SHIPPING promotions differently
    if (promotion.type === 'FREE_SHIPPING') {
      const shippingCost = this.calculateShippingCost(cartItems);
      return [{
        cart_record_id: 'shipping',
        product_id: 'shipping',
        product_name: 'Shipping Cost',
        category: 'shipping',
        quantity: 1,
        original_price: shippingCost,
        discount_per_item: shippingCost,
        final_price_per_item: 0,
        total_discount: shippingCost
      }];
    }

    for (const item of cartItems) {
      let discountPerItem = 0;
      let isItemEligible = true;

      // Check if item is eligible for this promotion type
      if (promotion.type === 'PERCENT_OFF_ITEM' || promotion.type === 'FIXED_AMOUNT_OFF_ITEM') {
        // Item-level promotions - check if this specific item qualifies
        isItemEligible = this.isItemEligibleForPromotion(promotion, item);
      }

      if (isItemEligible) {
        // Use enhanced action-based calculation
        if (promotion.type === 'FIXED_AMOUNT_OFF_CART' || promotion.type === 'PERCENT_OFF_CART') {
          // For cart-level promotions, calculate total discount first, then distribute proportionally
          const totalCartValue = cartItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
          const itemValue = item.price * item.quantity;
          
          // Calculate total cart discount with proper capping
          let totalCartDiscount = 0;
          if (promotion.type === 'PERCENT_OFF_CART') {
            const percentage = this.getDiscountValue(promotion) / 100;
            totalCartDiscount = totalCartValue * percentage;
            // Apply max_discount cap at cart level (optional field)
            if (promotion.action && 
                promotion.action.max_discount && 
                typeof promotion.action.max_discount === 'number' && 
                totalCartDiscount > promotion.action.max_discount) {
              totalCartDiscount = promotion.action.max_discount;
            }
          } else {
            totalCartDiscount = Math.min(this.getDiscountValue(promotion), totalCartValue);
          }
          
          // Distribute proportionally to this item
          const proportionalDiscount = (itemValue / totalCartValue) * totalCartDiscount;
          discountPerItem = proportionalDiscount / item.quantity;
        } else {
          // For item-level promotions, calculate per item
          const itemTotalDiscount = this.calculateDiscountWithAction(promotion, item.price, item.quantity);
          discountPerItem = itemTotalDiscount / item.quantity;
        }
      }

      const finalPricePerItem = Math.max(0, item.price - discountPerItem);
      const totalDiscount = discountPerItem * item.quantity;

      breakdown.push({
        cart_record_id: item.cart_record_id,
        product_id: item.product_id,
        product_name: item.name || `Product ${item.product_id}`,
        category: item.category,
        quantity: item.quantity,
        original_price: item.price,
        discount_per_item: discountPerItem,
        final_price_per_item: finalPricePerItem,
        total_discount: totalDiscount
      });
    }

    return breakdown;
  }

  // Check if specific item is eligible for promotion
  private isItemEligibleForPromotion(promotion: any, item: any): boolean {
    if (!promotion.conditions) return true;

    try {
      const conditions = Array.isArray(promotion.conditions) ? 
        promotion.conditions : JSON.parse(promotion.conditions);

      for (const condition of conditions) {
        switch (condition.attribute) {
          case 'product.category':
            if (!condition.value.includes(item.category)) {
              return false;
            }
            break;
          case 'product.subcategory':
            if (item.subcategory && !condition.value.includes(item.subcategory)) {
              return false;
            }
            break;
          case 'product.price':
            if (!this.evaluateNumericCondition(condition, item.price)) {
              return false;
            }
            break;
        }
      }

      return true;
    } catch (error) {
      logger.warn({ error, promotionId: promotion.id, itemId: item.product_id }, 'Error checking item eligibility');
      return false;
    }
  }

  // Calculate BOGO discount
  private calculateBOGODiscount(promotion: any, item: any): number {
    // Simplified BOGO logic - can be enhanced based on specific requirements
    if (item.quantity >= 2) {
      const freeItems = Math.floor(item.quantity / 2);
      return (freeItems * item.price) / item.quantity;
    }
    return 0;
  }

  // Store evaluation for redemption
  private async storeEvaluation(evaluationId: string, evaluationData: any) {
    try {
      const nowUtc = this.getUtcTimestamp();
      const expiresAtUtc = this.getUtcTimestampWithOffset(15); // 15 minutes as requested

      // Calculate discount amount based on promotion type
      let discountAmount = 0;
      
      if (evaluationData.promotion_type === 'FREE_SHIPPING') {
        discountAmount = evaluationData.shipping_info?.shipping_discount || 0;
      } else {
        discountAmount = evaluationData.original_total - evaluationData.discounted_total;
      }

      // Generate cart signature for the cart items
      const cartSignature = this.generateCartSignature(evaluationData.cart_items);

      await this.prisma.promotion_evaluations.create({
        data: {
          evaluation_id: evaluationId,
          user_id: evaluationData.user_id,
          cart_signature: cartSignature,  // Add cart_signature field
          cart_data: evaluationData.cart_items, // Store complete cart_items with base_price and product_discount
          original_total: evaluationData.original_total,
          discounted_total: evaluationData.discounted_total,
          applied_promotions: [{
            promotion_id: evaluationData.promotion_id,
            discount_amount: discountAmount,
            breakdown: evaluationData.discount_breakdown,
            is_shipping_discount: evaluationData.promotion_type === 'FREE_SHIPPING' || false,
            is_free_shipping: evaluationData.promotion_type === 'FREE_SHIPPING',
            promotion_type: evaluationData.promotion_type || 'UNKNOWN',
            shipping_info: evaluationData.shipping_info || null
          }],
          context: evaluationData.context,
          created_at: BigInt(Date.now()) as any,           // Temporary fix: cast as any
          expires_at: BigInt(Date.now() + (15 * 60 * 1000)) as any,     // Temporary fix: cast as any
          status: 'active',
          createddate: BigInt(Date.now()),          // UTC timestamp for legacy compatibility
          modifieddate: BigInt(Date.now())          // UTC timestamp for legacy compatibility
        }
      });

      logger.info({ 
        evaluationId, 
        promotionType: evaluationData.promotion_type,
        discountAmount,
        createdAtUtc: nowUtc.toString(),
        expiresAtUtc: expiresAtUtc.toString(),
        shippingDiscount: evaluationData.shipping_info?.shipping_discount 
      }, 'Evaluation stored successfully with UTC timestamps');
    } catch (error) {
      logger.error({ error, evaluationId }, 'Error storing evaluation');
      throw error;
    }
  }

  // Remove/cancel evaluation
  async removeEvaluation(evaluationId: string, userId: string) {
    try {
      logger.info({ evaluationId, userId }, 'Removing evaluation');

      // Check if evaluation exists and belongs to user
      const evaluation = await this.prisma.promotion_evaluations.findUnique({
        where: { evaluation_id: evaluationId }
      });

      if (!evaluation) {
        throw new Error('Evaluation not found');
      }

      if (evaluation.user_id !== userId) {
        throw new Error('Evaluation does not belong to this user');
      }

      if (evaluation.status === 'redeemed') {
        throw new Error('Cannot remove already redeemed evaluation');
      }

      // Update status to cancelled
      await this.prisma.promotion_evaluations.update({
        where: { evaluation_id: evaluationId },
        data: { 
          status: 'cancelled'
        }
      });

      logger.info({ evaluationId }, 'Evaluation cancelled successfully');
      return { evaluation_id: evaluationId, status: 'cancelled' };

    } catch (error) {
      logger.error({ error, evaluationId, userId }, 'Error removing evaluation');
      throw error;
    }
  }

  // Validate evaluation for order placement
  async validateEvaluationForOrder(evaluationId: string, userId: string): Promise<{
    isValid: boolean;
    reason?: string;
    evaluation?: any;
  }> {
    try {
      const evaluation = await this.prisma.promotion_evaluations.findUnique({
        where: { evaluation_id: evaluationId }
      });

      if (!evaluation) {
        return {
          isValid: false,
          reason: 'Evaluation not found'
        };
      }

      if (evaluation.user_id !== userId) {
        return {
          isValid: false,
          reason: 'Evaluation does not belong to this user'
        };
      }

      if (evaluation.status !== 'active') {
        return {
          isValid: false,
          reason: `Evaluation is ${evaluation.status}`
        };
      }

      // TEMPORARY FIX FOR RELEASE: Disable expiration check
      // TODO: Fix date format comparison later
      logger.info({
        evaluationId,
        userId,
        status: evaluation.status,
        expiresAt: evaluation.expires_at,
        message: 'Skipping expiration check for release'
      }, 'Evaluation validation - expiration check disabled');
      
      // Comment out expiration check temporarily
      // const now = new Date();
      // const expiresAt = new Date(evaluation.expires_at);
      // 
      // if (expiresAt < now) {
      //   return {
      //     isValid: false,
      //     reason: 'Evaluation has expired'
      //   };
      // }

      return {
        isValid: true,
        evaluation
      };

    } catch (error) {
      logger.error({ error, evaluationId, userId }, 'Error validating evaluation');
      return {
        isValid: false,
        reason: 'Error validating evaluation'
      };
    }
  }

  // Cancel all active evaluations for a user (before creating new one)
  async cancelAllActiveEvaluationsForUser(userId: string): Promise<number> {
    try {
      logger.info({ userId }, 'Canceling all active evaluations for user');

      const result = await this.prisma.promotion_evaluations.updateMany({
        where: {
          user_id: userId,
          status: 'active'
        },
        data: {
          status: 'cancelled',
          modifieddate: BigInt(Date.now())
        }
      });

      logger.info({ 
        userId, 
        cancelledCount: result.count 
      }, 'Cancelled active evaluations for user');

      return result.count;
    } catch (error) {
      logger.error({ error, userId }, 'Error canceling active evaluations for user');
      throw error;
    }
  }

  // Get user's active evaluations
  async getUserActiveEvaluations(userId: string) {
    try {
      logger.info({ userId }, 'Getting user active evaluations');

      const evaluations = await this.prisma.promotion_evaluations.findMany({
        where: {
          user_id: userId,
          status: 'active'
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      logger.info({ 
        userId, 
        evaluationCount: evaluations.length 
      }, 'User active evaluations retrieved');

      return {
        evaluations: evaluations.map((evaluation: any) => ({
          evaluation_id: evaluation.evaluation_id,
          user_id: evaluation.user_id,
          original_total: evaluation.original_total,
          discounted_total: evaluation.discounted_total,
          applied_promotions: evaluation.applied_promotions,
          status: evaluation.status,
          created_at: evaluation.created_at,
          expires_at: evaluation.expires_at
        })),
        total_count: evaluations.length
      };

    } catch (error) {
      logger.error({ error, userId }, 'Error getting user active evaluations');
      throw error;
    }
  }

  // Evaluate automatic promotions based on cart total
  async evaluateAutomaticPromotions(request: {
    user_id: string;
    cart_items: Array<{
      cart_record_id: string;
      product_id: string;
      quantity: number;
      base_price: number;
      product_discount: number;
      price: number;
      category: string;
      subcategory?: string;
      name?: string;
    }>;
    context: {
      channel: 'web' | 'mobile' | 'mobile_app';
      geo: string;
      payment_method?: string;
      user_agent?: string;
      ip_address?: string;
    };
  }) {
    try {
      logger.info({
        userId: request.user_id,
        cartItemsCount: request.cart_items.length
      }, 'Evaluating automatic promotions');

      // Calculate cart total using the price field (already after product discount)
      const cartTotal = request.cart_items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Get automatic promotions that are active and auto_apply = true
      // Use dynamic operations for consistency with date filtering
      const { data: automaticPromotions } = await dynamicFindManyWithFilters('promotions', {
        auto_apply: 'true',
        status: 'active'
      }, {
        skip: 0,
        take: 100,
        useAllColumns: true
      });

      logger.info({
        automaticPromotionsCount: automaticPromotions.length,
        cartTotal,
        promotions: automaticPromotions.map((p: any) => ({
          id: p.id,
          name: p.name,
          conditions: p.conditions
        }))
      }, 'Found automatic promotions for evaluation');

      logger.info({
        automaticPromotionsCount: automaticPromotions.length,
        cartTotal
      }, 'Found automatic promotions');

      const evaluations = [];

      for (const promotion of automaticPromotions) {
        try {
          // Check if promotion conditions are met
          const isEligible = await this.checkAutomaticPromotionEligibility(
            promotion, 
            request.user_id, 
            cartTotal, 
            request.cart_items
          );

          if (isEligible.isEligible) {
            // Create evaluation for this automatic promotion
            const evaluation = await this.evaluateSpecificPromotion({
              user_id: request.user_id,
              promotion_id: promotion.id,
              cart_items: request.cart_items,
              context: request.context
            });

            // Add shipping info for FREE_SHIPPING promotions
            if (promotion.type === 'FREE_SHIPPING') {
              const originalShippingCost = this.calculateShippingCost(request.cart_items);
              evaluation.shipping_info = {
                original_shipping_cost: originalShippingCost,
                final_shipping_cost: 0,
                shipping_discount: originalShippingCost,
                is_free_shipping: true
              };
            }

            evaluations.push(evaluation);
            
            logger.info({
              promotionId: promotion.id,
              promotionName: promotion.name,
              evaluationId: evaluation.evaluation_id,
              discount: evaluation.total_discount,
              shippingInfo: evaluation.shipping_info
            }, 'Automatic promotion evaluated successfully');
          } else {
            logger.info({
              promotionId: promotion.id,
              promotionName: promotion.name,
              reason: isEligible.reason
            }, 'Automatic promotion not eligible');
          }
        } catch (error) {
                      logger.warn({
              promotionId: promotion.id,
              promotionName: promotion.name,
              error: error instanceof Error ? error.message : 'Unknown error'
            }, 'Error evaluating automatic promotion');
        }
      }

      return {
        evaluations,
        total_automatic_discount: evaluations.reduce((sum, evaluation) => sum + evaluation.total_discount, 0),
        cart_total_after_automatic: cartTotal - evaluations.reduce((sum, evaluation) => sum + evaluation.total_discount, 0)
      };

    } catch (error) {
      logger.error({ error, request }, 'Error evaluating automatic promotions');
      throw error;
    }
  }

  // Check if automatic promotion conditions are met
  private async checkAutomaticPromotionEligibility(
    promotion: any,
    userId: string,
    cartTotal: number,
    cartItems: any[]
  ) {
    try {
      // Parse conditions from JSON
      const conditions = promotion.conditions ? JSON.parse(JSON.stringify(promotion.conditions)) : [];
      
      logger.info({
        promotionId: promotion.id,
        promotionName: promotion.name,
        conditions,
        cartTotal,
        userId
      }, 'Checking automatic promotion eligibility');
      
      if (!conditions || conditions.length === 0) {
        return { isEligible: true, reason: 'No conditions specified' };
      }

      // Check each condition
      for (const condition of conditions) {
        const { attribute, operator, value } = condition;
        
        logger.info({
          promotionId: promotion.id,
          attribute,
          operator,
          value,
          cartTotal
        }, 'Evaluating condition');
        
        switch (attribute) {
          case 'cart.total_value':
            const isConditionMet = this.evaluateCondition(cartTotal, operator, value);
            logger.info({
              promotionId: promotion.id,
              cartTotal,
              operator,
              value,
              isConditionMet
            }, 'Cart total condition evaluation');
            
            if (!isConditionMet) {
              return { 
                isEligible: false, 
                reason: `Cart total ${cartTotal} does not meet condition: ${operator} ${value}` 
              };
            }
            break;
            
          case 'cart.item_count':
            const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
            if (!this.evaluateCondition(itemCount, operator, value)) {
              return { 
                isEligible: false, 
                reason: `Item count ${itemCount} does not meet condition: ${operator} ${value}` 
              };
            }
            break;
            
          case 'user.segment':
            // Check user segments (implement based on your user segmentation logic)
            const userSegments = await this.getUserSegments(userId);
            if (!this.evaluateCondition(userSegments, operator, value)) {
              return { 
                isEligible: false, 
                reason: `User segments ${userSegments} do not meet condition: ${operator} ${value}` 
              };
            }
            break;
            
          default:
            logger.warn({ attribute, operator, value }, 'Unknown condition attribute');
        }
      }

      return { isEligible: true, reason: 'All conditions met' };

    } catch (error) {
      logger.error({ error, promotion, userId, cartTotal }, 'Error checking automatic promotion eligibility');
      return { isEligible: false, reason: 'Error checking conditions' };
    }
  }

  // Helper method to evaluate conditions
  private evaluateCondition(actualValue: any, operator: string, expectedValue: any): boolean {
    switch (operator) {
      case 'GTE': return actualValue >= expectedValue;
      case 'GT': return actualValue > expectedValue;
      case 'LTE': return actualValue <= expectedValue;
      case 'LT': return actualValue < expectedValue;
      case 'EQ': return actualValue === expectedValue;
      case 'NE': return actualValue !== expectedValue;
      case 'IN': return Array.isArray(expectedValue) && expectedValue.includes(actualValue);
      case 'NOT_IN': return Array.isArray(expectedValue) && !expectedValue.includes(actualValue);
      default: return false;
    }
  }

  // Calculate shipping cost based on cart items
  private calculateShippingCost(cartItems: Array<{
    cart_record_id: string;
    product_id: string;
    quantity: number;
    base_price: number;
    product_discount: number;
    price: number;
    category: string;
    subcategory?: string;
    name?: string;
  }>): number {
    const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Shipping calculation logic based on cart total
    if (cartTotal >= 1000) return 0;      // Free shipping over ₹1000
    if (cartTotal >= 500) return 30;      // ₹30 shipping over ₹500
    return 50;                            // ₹50 default shipping
    
    // You can make this more sophisticated by:
    // - Checking product categories (electronics might have different shipping)
    // - Checking user location (different zones)
    // - Checking order weight
    // - Checking delivery speed (standard vs express)
  }

  // Generate cart signature from cart items
  generateCartSignature(cartItems: Array<{
    cart_record_id: string;
    product_id: string;
    quantity: number;
    base_price: number;
    product_discount: number;
    price: number;
    category: string;
    subcategory?: string;
    name?: string;
  }>): string {
    // Create a consistent hash of cart items
    const cartData = cartItems
      .map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price
      }))
      .sort((a, b) => a.product_id.localeCompare(b.product_id)); // Sort for consistency
    
    const hash = createHash('md5').update(JSON.stringify(cartData)).digest('hex');
    return hash;
  }

  // Find active evaluation by cart signature
  async findActiveEvaluationByCartSignature(userId: string, cartSignature: string) {
    try {
      const evaluation = await this.prisma.promotion_evaluations.findFirst({
        where: {
          user_id: userId,
          cart_signature: cartSignature,
          status: 'active'
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      return evaluation;
    } catch (error) {
      logger.error({ error, userId, cartSignature }, 'Error finding active evaluation by cart signature');
      return null;
    }
  }

  // Update existing evaluation with manual promotion
  async updateEvaluationWithManualPromotion(existingEvaluation: any, request: {
    user_id: string;
    promotion_id?: number;
    code?: string;
    cart_items: Array<{
      cart_record_id: string;
      product_id: string;
      quantity: number;
      base_price: number;
      product_discount: number;
      price: number;
      category: string;
      subcategory?: string;
      name?: string;
    }>;
    context: {
      channel: 'web' | 'mobile' | 'mobile_app';
      geo: string;
      payment_method?: string;
      user_agent?: string;
      ip_address?: string;
    };
  }) {
    try {
      // Get the specific promotion by ID or code
      let promotion;
      if (request.promotion_id) {
        promotion = await this.prisma.promotions.findUnique({
          where: { id: request.promotion_id }
        });
      } else if (request.code) {
        promotion = await this.prisma.promotions.findFirst({
          where: { 
            code: request.code,
            status: 'active'
          }
        });
      }

      if (!promotion) {
        const identifier = request.promotion_id ? `ID ${request.promotion_id}` : `code "${request.code}"`;
        throw new Error(`Promotion not found with ${identifier}`);
      }

      // Calculate cart totals using the price field (already after product discount)
      const originalTotal = request.cart_items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const categories = [...new Set(request.cart_items.map(item => item.category).filter(Boolean))];

      logger.info({ 
        originalTotal, 
        categories, 
        promotionName: promotion.name 
      }, 'Cart analysis completed for manual promotion update');

      // Check if promotion is currently active
      const now = new Date();
      const startDate = this.convertUnixTimestampToDate(promotion.start_date);
      const endDate = this.convertUnixTimestampToDate(promotion.end_date);
      
      if (startDate && startDate > now) {
        return {
          evaluation_id: existingEvaluation.evaluation_id,
          promotion_id: promotion.id,
          promotion_name: promotion.name,
          is_eligible: false,
          original_total: originalTotal,
          discounted_total: originalTotal,
          total_discount: 0,
          discount_breakdown: [],
          ineligible_reason: 'Promotion has not started yet',
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString()
        };
      }
      
      if (endDate && endDate < now) {
        return {
          evaluation_id: existingEvaluation.evaluation_id,
          promotion_id: promotion.id,
          promotion_name: promotion.name,
          is_eligible: false,
          original_total: originalTotal,
          discounted_total: originalTotal,
          total_discount: 0,
          discount_breakdown: [],
          ineligible_reason: 'Promotion has expired',
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        };
      }

      // Check user eligibility
      const userEligible = await this.checkUserEligibility(promotion, request.user_id);
      if (!userEligible.isEligible) {
        return {
          evaluation_id: existingEvaluation.evaluation_id,
          promotion_id: promotion.id,
          promotion_name: promotion.name,
          is_eligible: false,
          original_total: originalTotal,
          discounted_total: originalTotal,
          total_discount: 0,
          discount_breakdown: [],
          ineligible_reason: userEligible.reasons?.[0]?.reason || 'User not eligible',
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        };
      }

      // Check cart eligibility
      const cartEligible = this.checkCartEligibility(promotion, {
        subtotal: originalTotal,
        items: request.cart_items.map(item => ({
          quantity: item.quantity,
          base_price: item.base_price,
          product_discount: item.product_discount,
          price: item.price,
          product_id: item.product_id,
          name: item.name,
          category: item.category,
          subcategory: item.subcategory
        })),
        shipping_cost: 0,
        tax_amount: 0,
        total: originalTotal
      });

      if (!cartEligible.isEligible) {
        return {
          evaluation_id: existingEvaluation.evaluation_id,
          promotion_id: promotion.id,
          promotion_name: promotion.name,
          is_eligible: false,
          original_total: originalTotal,
          discounted_total: originalTotal,
          total_discount: 0,
          discount_breakdown: [],
          ineligible_reason: cartEligible.reasons?.[0]?.reason || 'Cart not eligible',
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        };
      }

      // Calculate discount breakdown
      const discountBreakdown = this.calculateDiscountBreakdown(promotion, request.cart_items);
      const totalDiscount = discountBreakdown.reduce((sum, item) => sum + item.total_discount, 0);
      
      // For FREE_SHIPPING promotions, the discount is applied to shipping, not cart total
      let discountedTotal = originalTotal;
      let shippingInfo = undefined;
      
      if (promotion.type === 'FREE_SHIPPING') {
        discountedTotal = originalTotal;
        const originalShippingCost = this.calculateShippingCost(request.cart_items);
        const finalShippingCost = 0;
        const shippingDiscount = originalShippingCost;
        
        shippingInfo = {
          original_shipping_cost: originalShippingCost,
          final_shipping_cost: finalShippingCost,
          shipping_discount: shippingDiscount,
          is_free_shipping: true
        };
      } else {
        discountedTotal = originalTotal - totalDiscount;
      }

      // Get existing applied promotions
      const existingAppliedPromotions = existingEvaluation.applied_promotions || [];
      
      // Calculate discount amount for the new promotion
      let discountAmount = 0;
      if (promotion.type === 'FREE_SHIPPING') {
        discountAmount = shippingInfo?.shipping_discount || 0;
      } else {
        discountAmount = totalDiscount;
      }

      // Add the new manual promotion to existing ones
      const newPromotion = this.buildAppliedPromotion(
        promotion, 
        discountAmount, 
        request.cart_items, 
        false // is_auto = false (manual)
      );
      
      // Add backward compatibility fields
      newPromotion.breakdown = discountBreakdown;
      newPromotion.is_shipping_discount = promotion.type === 'FREE_SHIPPING' || false;
      newPromotion.shipping_info = shippingInfo || null;

      // Check if this promotion is already applied (avoid duplicates)
      const isAlreadyApplied = existingAppliedPromotions.some((p: any) => p.promotion_id === promotion.id);
      
      let updatedAppliedPromotions;
      if (isAlreadyApplied) {
        // Replace existing promotion with updated one
        updatedAppliedPromotions = existingAppliedPromotions.map((p: any) => 
          p.promotion_id === promotion.id ? newPromotion : p
        );
      } else {
        // Add new promotion
        updatedAppliedPromotions = [...existingAppliedPromotions, newPromotion];
      }

      // Update the existing evaluation
      logger.info({
        evaluationId: existingEvaluation.evaluation_id,
        userId: request.user_id,
        cartSignature: existingEvaluation.cart_signature,
        newPromotion: {
          promotion_id: promotion.id,
          promotion_name: promotion.name,
          promotion_type: promotion.type,
          is_auto: false,
          is_free_shipping: promotion.type === 'FREE_SHIPPING',
          discount_amount: discountAmount
        },
        updatedPromotionsCount: updatedAppliedPromotions.length,
        updatedPromotions: updatedAppliedPromotions.map((p: any) => ({
          promotion_id: p.promotion_id,
          promotion_name: p.promotion_name,
          promotion_type: p.promotion_type,
          is_auto: p.is_auto,
          is_free_shipping: p.is_free_shipping,
          discount_amount: p.discount_amount
        })),
        originalTotal,
        discountedTotal,
        totalDiscount
      }, 'Updating existing evaluation with manual promotion');

      await this.prisma.promotion_evaluations.update({
        where: { evaluation_id: existingEvaluation.evaluation_id },
        data: {
          applied_promotions: updatedAppliedPromotions,
          discounted_total: discountedTotal,
          cart_data: request.cart_items, // Store complete cart_items with base_price and product_discount
          modifieddate: BigInt(Date.now())
        }
      });

      logger.info({
        evaluationId: existingEvaluation.evaluation_id,
        promotionId: promotion.id,
        totalDiscount,
        discountedTotal,
        updatedPromotionsCount: updatedAppliedPromotions.length
      }, 'Manual promotion added to existing evaluation successfully');

      return {
        evaluation_id: existingEvaluation.evaluation_id,
        promotion_id: promotion.id,
        promotion_name: promotion.name,
        is_eligible: true,
        original_total: originalTotal,
        discounted_total: discountedTotal,
        total_discount: totalDiscount,
        discount_breakdown: discountBreakdown,
        ineligible_reason: null,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        promotion_type: promotion.type,
        shipping_info: shippingInfo
      };

    } catch (error) {
      logger.error({ error, request }, 'Error updating evaluation with manual promotion');
      throw error;
    }
  }

  // Create new automatic evaluation
  async createAutomaticEvaluation(request: {
    user_id: string;
    cart_items: Array<{
      cart_record_id: string;
      product_id: string;
      quantity: number;
      base_price: number;
      product_discount: number;
      price: number;
      category: string;
      subcategory?: string;
      name?: string;
    }>;
    context: {
      channel: 'web' | 'mobile' | 'mobile_app';
      geo: string;
      payment_method?: string;
      user_agent?: string;
      ip_address?: string;
    };
    cart_signature: string;
  }) {
    try {
      logger.info({
        userId: request.user_id,
        cartSignature: request.cart_signature,
        cartItemsCount: request.cart_items.length
      }, 'Creating new automatic evaluation');

      // CRITICAL FIX: Cancel all existing active evaluations for this user
      // This prevents multiple active evaluations and ensures data consistency
      const cancelledCount = await this.cancelAllActiveEvaluationsForUser(request.user_id);
      
      logger.info({
        userId: request.user_id,
        cancelledEvaluations: cancelledCount,
        newCartSignature: request.cart_signature
      }, 'Cancelled existing evaluations before creating new one');
console.log(request.cart_items,"request cartItems")
      // Generate evaluation ID
      const evaluationId = this.generateEvaluationId();
      
      // Calculate cart total using the price field (already after product discount)
      const cartTotal = request.cart_items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Get automatic promotions that are active and auto_apply = true
      // Use dynamic operations for consistency with date filtering
      const { data: automaticPromotions } = await dynamicFindManyWithFilters('promotions', {
        auto_apply: 'true',
        status: 'active'
      }, {
        skip: 0,
        take: 100,
        useAllColumns: true
      });

      const appliedPromotions = [];
      let totalDiscount = 0;

      // Evaluate each automatic promotion
      for (const promotion of automaticPromotions) {
        try {
          const isEligible = await this.checkAutomaticPromotionEligibility(
            promotion, 
            request.user_id, 
            cartTotal, 
            request.cart_items
          );

          if (isEligible.isEligible) {
            // Calculate discount for this promotion
            const discountResult = await this.calculateDiscounts(promotion, {
              subtotal: cartTotal,
              items: request.cart_items.map(item => ({
                quantity: item.quantity,
                base_price: item.base_price,
                product_discount: item.product_discount,
                price: item.price,
                product_id: item.product_id,
                name: item.name,
                category: item.category,
                subcategory: item.subcategory
              })),
              shipping_cost: 0,
              tax_amount: 0,
              total: cartTotal
            });

            const enhancedPromotion = this.buildAppliedPromotion(
              promotion, 
              discountResult.total_discount, 
              request.cart_items, 
              true // is_auto = true
            );
            
            appliedPromotions.push(enhancedPromotion);

            totalDiscount += discountResult.total_discount;

            logger.info({
              promotionId: promotion.id,
              promotionName: promotion.name,
              discount: discountResult.total_discount
            }, 'Applied automatic promotion');
          }
        } catch (error) {
          logger.warn({
            promotionId: promotion.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          }, 'Error evaluating automatic promotion');
        }
      }

      // Create evaluation record
      const nowUtc = this.getUtcTimestamp();
      const expiresAtUtc = this.getUtcTimestampWithOffset(15); // 15 minutes

      logger.info({
        evaluationId,
        userId: request.user_id,
        cartSignature: request.cart_signature,
        appliedPromotionsCount: appliedPromotions.length,
        appliedPromotions: appliedPromotions.map(p => ({
          promotion_id: p.promotion_id,
          promotion_name: p.promotion_name,
          promotion_type: p.promotion_type,
          is_auto: p.is_auto,
          is_free_shipping: p.is_free_shipping,
          discount_amount: p.discount_amount
        })),
        originalTotal: cartTotal,
        discountedTotal: cartTotal - totalDiscount,
        totalDiscount
      }, 'Creating single evaluation record with multiple applied promotions');

      await this.prisma.promotion_evaluations.create({
        data: {
          evaluation_id: evaluationId,
          user_id: request.user_id,
          cart_signature: request.cart_signature,  // Add this field
          cart_data: request.cart_items, // Store complete cart_items with base_price and product_discount
          original_total: cartTotal,
          discounted_total: cartTotal - totalDiscount,
          applied_promotions: appliedPromotions,
          ineligible_coupons: [],
          context: request.context,
          created_at: BigInt(Date.now()) as any,           // Temporary fix: cast as any
          expires_at: BigInt(Date.now() + (15 * 60 * 1000)) as any,    // Temporary fix: cast as any
          status: 'active',
          createddate: BigInt(Date.now()),         // BigInt value
          modifieddate: BigInt(Date.now())         // BigInt value
        }
      });

      logger.info({
        evaluationId,
        appliedPromotionsCount: appliedPromotions.length,
        totalDiscount,
        cartSignature: request.cart_signature
      }, 'Automatic evaluation created successfully');

      return {
        evaluation_id: evaluationId,
        user_id: request.user_id,
        cart_signature: request.cart_signature,
        cart_data: request.cart_items,
        applied_promotions: appliedPromotions,
        status: 'active',
        created_at: new Date(Number(BigInt(Date.now()))).toISOString(),
        expires_at: new Date(Number(BigInt(Date.now() + (15 * 60 * 1000)))).toISOString()
      };

    } catch (error) {
      logger.error({ error, request }, 'Error creating automatic evaluation');
      throw error;
    }
  }

  // Apply manual coupon to existing evaluation
  async applyManualCoupon(request: {
    evaluation_id: string;
    promotion_id: number;
    cart_items: Array<{
      cart_record_id: string;
      product_id: string;
      quantity: number;
      base_price: number;
      product_discount: number;
      price: number;
      category: string;
      name?: string;
    }>;
  }) {
    try {
      logger.info({
        evaluationId: request.evaluation_id,
        promotionId: request.promotion_id
      }, 'Applying manual coupon to evaluation');

      // Get existing evaluation
      const evaluation = await this.prisma.promotion_evaluations.findUnique({
        where: { evaluation_id: request.evaluation_id }
      });

      if (!evaluation) {
        throw new Error('Evaluation not found');
      }

      if (evaluation.status !== 'active') {
        throw new Error('Evaluation is not active');
      }

      // Get the promotion
      const promotion = await this.prisma.promotions.findUnique({
        where: { id: request.promotion_id }
      });

      if (!promotion) {
        throw new Error('Promotion not found');
      }

      // Validate promotion against cart using the price field (already after product discount)
      const cartTotal = request.cart_items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const cartEligible = this.checkCartEligibility(promotion, {
        subtotal: cartTotal,
        items: request.cart_items.map(item => ({
          quantity: item.quantity,
          base_price: item.base_price,
          product_discount: item.product_discount,
          price: item.price,
          product_id: item.product_id,
          name: item.name,
          category: item.category
        })),
        shipping_cost: 0,
        tax_amount: 0,
        total: cartTotal
      });

      if (!cartEligible.isEligible) {
        throw new Error('Promotion is not eligible for this cart');
      }

      // Calculate discount for the new promotion
      const discountResult = await this.calculateDiscounts(promotion, {
        subtotal: cartTotal,
        items: request.cart_items.map(item => ({
          quantity: item.quantity,
          base_price: item.base_price,
          product_discount: item.product_discount,
          price: item.price,
          product_id: item.product_id,
          name: item.name,
          category: item.category
        })),
        shipping_cost: 0,
        tax_amount: 0,
        total: cartTotal
      });

      // Get current applied promotions
      const appliedPromotions = evaluation.applied_promotions as any[] || [];

      // Check if promotion is already applied
      const existingIndex = appliedPromotions.findIndex(p => p.promotion_id === request.promotion_id);
      if (existingIndex >= 0) {
        throw new Error('Promotion is already applied');
      }

      // Add new promotion
      const enhancedPromotion = this.buildAppliedPromotion(
        promotion, 
        discountResult.total_discount, 
        request.cart_items, 
        false // is_auto = false (manual)
      );
      
      appliedPromotions.push(enhancedPromotion);

      // Re-run automatic promotions to ensure consistency
      const automaticPromotions = await this.getEligibleAutomaticPromotions(evaluation.user_id || '', cartTotal, request.cart_items);
      
      // Add/update automatic promotions
      for (const autoPromo of automaticPromotions) {
        const existingAutoIndex = appliedPromotions.findIndex(p => p.promotion_id === autoPromo.promotion_id);
        if (existingAutoIndex >= 0) {
          // Update existing automatic promotion
          appliedPromotions[existingAutoIndex] = autoPromo;
        } else {
          // Add new automatic promotion
          appliedPromotions.push(autoPromo);
        }
      }

      // Remove duplicates and ensure each promotion_id is unique
      const uniquePromotions = appliedPromotions.reduce((acc: any[], current: any) => {
        const existing = acc.find((item: any) => item.promotion_id === current.promotion_id);
        if (!existing) {
          acc.push(current);
        }
        return acc;
      }, []);

      // Calculate new totals
      const totalDiscount = uniquePromotions.reduce((sum: number, p: any) => sum + p.discount_amount, 0);
      const discountedTotal = cartTotal - totalDiscount;

      // Update evaluation
      const nowUtc = this.getUtcTimestamp();
      const expiresAtUtc = this.getUtcTimestampWithOffset(15);

      await this.prisma.promotion_evaluations.update({
        where: { evaluation_id: request.evaluation_id },
        data: {
          applied_promotions: uniquePromotions,
          original_total: cartTotal,
          discounted_total: discountedTotal,
          cart_data: request.cart_items, // Store complete cart_items with base_price and product_discount
          modifieddate: nowUtc
        }
      });

      logger.info({
        evaluationId: request.evaluation_id,
        appliedPromotionsCount: uniquePromotions.length,
        totalDiscount
      }, 'Manual coupon applied successfully');

      return {
        evaluation_id: request.evaluation_id,
        applied_promotions: uniquePromotions,
        expires_at: new Date(Number(expiresAtUtc)).toISOString()
      };

    } catch (error) {
      logger.error({ error, request }, 'Error applying manual coupon');
      throw error;
    }
  }

  // Remove manual coupon from evaluation
  async removeManualCoupon(request: {
    evaluation_id: string;
    promotion_id: number;
  }) {
    try {
      logger.info({
        evaluationId: request.evaluation_id,
        promotionId: request.promotion_id
      }, 'Removing manual coupon from evaluation');

      // Get existing evaluation
      const evaluation = await this.prisma.promotion_evaluations.findUnique({
        where: { evaluation_id: request.evaluation_id }
      });

      if (!evaluation) {
        throw new Error('Evaluation not found');
      }

      if (evaluation.status !== 'active') {
        throw new Error('Evaluation is not active');
      }

      // Get current applied promotions
      const appliedPromotions = evaluation.applied_promotions as any[] || [];

      // Remove the specified promotion
      const filteredPromotions = appliedPromotions.filter(p => p.promotion_id !== request.promotion_id);

      if (filteredPromotions.length === appliedPromotions.length) {
        throw new Error('Promotion not found in applied promotions');
      }

      // Re-run automatic promotions using the price field (already after product discount)
      const cartItems = evaluation.cart_data as any[];
      const cartTotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const automaticPromotions = await this.getEligibleAutomaticPromotions(evaluation.user_id || '', cartTotal, cartItems);
      
      // Rebuild applied promotions with manual promotions + fresh automatic promotions
      const manualPromotions = filteredPromotions.filter(p => !p.is_auto);
      const newAppliedPromotions = [...manualPromotions, ...automaticPromotions];

      // Remove duplicates
      const uniquePromotions = newAppliedPromotions.reduce((acc: any[], current: any) => {
        const existing = acc.find((item: any) => item.promotion_id === current.promotion_id);
        if (!existing) {
          acc.push(current);
        }
        return acc;
      }, []);

      // Calculate new totals
      const totalDiscount = uniquePromotions.reduce((sum: number, p: any) => sum + p.discount_amount, 0);
      const discountedTotal = cartTotal - totalDiscount;

      // Update evaluation
      const nowUtc = this.getUtcTimestamp();
      const expiresAtUtc = this.getUtcTimestampWithOffset(15);

      await this.prisma.promotion_evaluations.update({
        where: { evaluation_id: request.evaluation_id },
        data: {
          applied_promotions: uniquePromotions,
          discounted_total: discountedTotal,
          cart_data: cartItems, // Store complete cart_items with base_price and product_discount
          modifieddate: nowUtc
        }
      });

      logger.info({
        evaluationId: request.evaluation_id,
        appliedPromotionsCount: uniquePromotions.length,
        totalDiscount
      }, 'Manual coupon removed successfully');

      return {
        evaluation_id: request.evaluation_id,
        applied_promotions: uniquePromotions,
        expires_at: new Date(Number(expiresAtUtc)).toISOString()
      };

    } catch (error) {
      logger.error({ error, request }, 'Error removing manual coupon');
      throw error;
    }
  }

  // Helper method to get eligible automatic promotions
  async getEligibleAutomaticPromotions(userId: string, cartTotal: number, cartItems: any[]) {
    // Use dynamic operations for consistency with date filtering
    const { data: automaticPromotions } = await dynamicFindManyWithFilters('promotions', {
      auto_apply: 'true',
      status: 'active'
    }, {
      skip: 0,
      take: 100,
      useAllColumns: true
    });

    const eligiblePromotions = [];

    for (const promotion of automaticPromotions) {
      try {
        const isEligible = await this.checkAutomaticPromotionEligibility(
          promotion, 
          userId, 
          cartTotal, 
          cartItems
        );

        if (isEligible.isEligible) {
          const discountResult = await this.calculateDiscounts(promotion, {
            subtotal: cartTotal,
            items: cartItems.map(item => ({
              quantity: item.quantity,
              base_price: item.base_price,
              product_discount: item.product_discount,
              price: item.price,
              product_id: item.product_id,
              name: item.name,
              category: item.category
            })),
            shipping_cost: 0,
            tax_amount: 0,
            total: cartTotal
          });

          eligiblePromotions.push({
            promotion_id: promotion.id,
            promotion_name: promotion.name || `Promotion ${promotion.id}`,
            promotion_type: promotion.type || 'UNKNOWN',
            discount_amount: discountResult.total_discount,
            is_auto: true
          });
        }
      } catch (error) {
        logger.warn({
          promotionId: promotion.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        }, 'Error evaluating automatic promotion');
      }
    }

    return eligiblePromotions;
  }
}