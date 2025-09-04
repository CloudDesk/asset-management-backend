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
              current_value: userSegments
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
              current_value: userCreatedDate
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
              current_value: categories
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
}
