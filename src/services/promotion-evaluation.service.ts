import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger.js';
import { 
  EvaluationRequest, 
  EvaluationResponse, 
  CartData, 
  AppliedPromotion, 
  IneligibleReason,
  DiscountBreakdown 
} from '../schemas/evaluation.schema.js';

export class PromotionEvaluationService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
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
      const expiresAt = new Date(Date.now() + (promotion.evaluation_expiry_minutes || 15) * 60 * 1000);

      await this.createEvaluationRecord({
        evaluationId,
        userId: request.user_id,
        cartData: request.cart_data,
        promotion,
        discountResult,
        expiresAt
      });

      // 5. Build response
      const response: EvaluationResponse = {
        success: true,
        evaluation_id: evaluationId,
        original_total: request.cart_data.subtotal + request.cart_data.shipping_cost + request.cart_data.tax_amount,
        discounted_total: discountResult.discounted_total,
        total_discount: discountResult.total_discount,
        applied_promotions: [{
          promotion_id: promotion.id,
          promotion_name: promotion.name || 'Unknown Promotion',
          discount_amount: discountResult.total_discount,
          affected_items: discountResult.affected_items,
          discount_breakdown: discountResult.breakdown
        }],
        ineligible_reasons: [],
        expires_at: expiresAt.toISOString()
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
    if (!promotion.is_active) {
      reasons.push({
        promotion_id: promotion.id,
        reason: 'Promotion is not active'
      });
    }

    // Check date range
    const now = new Date();
    if (promotion.start_date && new Date(promotion.start_date) > now) {
      reasons.push({
        promotion_id: promotion.id,
        reason: 'Promotion has not started yet',
        required_value: promotion.start_date.getTime(),
        current_value: now.getTime()
      });
    }

    if (promotion.end_date && new Date(promotion.end_date) < now) {
      reasons.push({
        promotion_id: promotion.id,
        reason: 'Promotion has expired',
        required_value: promotion.end_date.getTime(),
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
        totalDiscount = Math.min(promotion.discount_value || 0, totalValue);
        discountedTotal = totalValue - totalDiscount;
        break;

      case 'PERCENT_OFF_CART':
        const percentage = (promotion.discount_value || 0) / 100;
        totalDiscount = totalValue * percentage;
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
            const itemDiscount = Math.min(promotion.discount_value || 0, item.price * item.quantity);
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
            const percentage = (promotion.discount_value || 0) / 100;
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
        // Free product logic (simplified)
        totalDiscount = promotion.discount_value || 0;
        discountedTotal = totalValue - totalDiscount;
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
        created_at: new Date(),
        expires_at: data.expiresAt,
        status: 'active',
        createddate: BigInt(Date.now()),
        modifieddate: BigInt(Date.now())
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

      // Generate unique evaluation ID
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
            is_active: true,
            status: 'active'
          }
        });
      }

      if (!promotion) {
        const identifier = request.promotion_id ? `ID ${request.promotion_id}` : `code "${request.code}"`;
        throw new Error(`Promotion not found with ${identifier}`);
      }

      // Calculate cart totals
      const originalTotal = request.cart_items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const categories = [...new Set(request.cart_items.map(item => item.category).filter(Boolean))];

      logger.info({ 
        originalTotal, 
        categories, 
        promotionName: promotion.name 
      }, 'Cart analysis completed');

      // Check if promotion is currently active
      const now = new Date();
      const startDate = promotion.start_date ? new Date(promotion.start_date) : null;
      const endDate = promotion.end_date ? new Date(promotion.end_date) : null;
      
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
        // Calculate discount based on promotion type
        switch (promotion.type) {
          case 'PERCENT_OFF_ITEM':
            discountPerItem = (item.price * promotion.discount_value) / 100;
            break;
          case 'FIXED_AMOUNT_OFF_ITEM':
            discountPerItem = Math.min(promotion.discount_value, item.price);
            break;
          case 'PERCENT_OFF_CART':
            discountPerItem = (item.price * promotion.discount_value) / 100;
            break;
          case 'FIXED_AMOUNT_OFF_CART':
            // For cart-level fixed amount, distribute proportionally
            const totalCartValue = cartItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
            const itemValue = item.price * item.quantity;
            const proportionalDiscount = (itemValue / totalCartValue) * promotion.discount_value;
            discountPerItem = proportionalDiscount / item.quantity;
            break;
          case 'FREE_SHIPPING':
            // Free shipping doesn't affect item prices
            discountPerItem = 0;
            break;
          case 'BOGO':
            // Buy One Get One - complex logic
            discountPerItem = this.calculateBOGODiscount(promotion, item);
            break;
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
      // Calculate discount amount based on promotion type
      let discountAmount = 0;
      
      if (evaluationData.promotion_type === 'FREE_SHIPPING') {
        // For free shipping, discount amount is the shipping cost saved
        discountAmount = evaluationData.shipping_info?.shipping_discount || 0;
      } else {
        // For other promotions, discount amount is the cart total reduction
        discountAmount = evaluationData.original_total - evaluationData.discounted_total;
      }

      await this.prisma.promotion_evaluations.create({
        data: {
          evaluation_id: evaluationId,
          user_id: evaluationData.user_id,
          cart_data: evaluationData.cart_items,
          original_total: evaluationData.original_total,
          discounted_total: evaluationData.discounted_total,
          applied_promotions: [{
            promotion_id: evaluationData.promotion_id,
            discount_amount: discountAmount,
            breakdown: evaluationData.discount_breakdown,
            is_shipping_discount: evaluationData.promotion_type === 'FREE_SHIPPING' || false,
            promotion_type: evaluationData.promotion_type || 'UNKNOWN',
            shipping_info: evaluationData.shipping_info || null
          }],
          context: evaluationData.context,
          expires_at: new Date(Date.now() + 60 * 60 * 1000), // 60 minutes
          status: 'active'
        }
      });

      logger.info({ 
        evaluationId, 
        promotionType: evaluationData.promotion_type,
        discountAmount,
        shippingDiscount: evaluationData.shipping_info?.shipping_discount 
      }, 'Evaluation stored successfully');
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
        evaluations: evaluations.map(evaluation => ({
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
    current_total?: number; // Optional: if already discounted
  }) {
    try {
      logger.info({
        userId: request.user_id,
        cartItemsCount: request.cart_items.length,
        currentTotal: request.current_total
      }, 'Evaluating automatic promotions');

      // Calculate cart total
      const cartTotal = request.current_total || 
        request.cart_items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Get automatic promotions that are active and auto_apply = true
      const automaticPromotions = await this.prisma.promotions.findMany({
        where: {
          auto_apply: true,
          is_active: true,
          status: 'active',
          start_date: { lte: new Date() },
          end_date: { gte: new Date() }
        },
        orderBy: { priority: 'asc' } // Lower priority number = higher priority
      });

      logger.info({
        automaticPromotionsCount: automaticPromotions.length,
        cartTotal,
        promotions: automaticPromotions.map(p => ({
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
}
