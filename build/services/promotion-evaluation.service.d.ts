import { EvaluationRequest, EvaluationResponse } from '../schemas/evaluation.schema.js';
export declare class PromotionEvaluationService {
    private prisma;
    constructor();
    private getUtcTimestamp;
    private getUtcTimestampWithOffset;
    evaluatePromotion(request: EvaluationRequest): Promise<EvaluationResponse>;
    private getPromotion;
    private validatePromotion;
    private checkUserEligibility;
    private checkCartEligibility;
    private calculateDiscounts;
    private isItemEligible;
    private evaluateNumericCondition;
    private evaluateDateCondition;
    private getUserSegments;
    private getUserCreatedDate;
    private getUserOrderCount;
    private createEvaluationRecord;
    private createIneligibleResponse;
    getEvaluation(evaluationId: string): Promise<{
        status: string | null;
        createddate: bigint | null;
        modifieddate: bigint | null;
        evaluation_id: string;
        original_total: import("@prisma/client/runtime/library").Decimal | null;
        order_id: number | null;
        user_id: string | null;
        cart_data: import("@prisma/client/runtime/library").JsonValue | null;
        cart_signature: string | null;
        discounted_total: import("@prisma/client/runtime/library").Decimal | null;
        applied_promotions: import("@prisma/client/runtime/library").JsonValue | null;
        ineligible_coupons: import("@prisma/client/runtime/library").JsonValue | null;
        context: import("@prisma/client/runtime/library").JsonValue | null;
        created_at: bigint;
        expires_at: bigint;
    } | null>;
    evaluateSpecificPromotion(request: {
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
    }): Promise<{
        evaluation_id: any;
        promotion_id: number;
        promotion_name: string | null;
        is_eligible: boolean;
        original_total: number;
        discounted_total: number;
        total_discount: number;
        discount_breakdown: never[];
        ineligible_reason: string;
        expires_at: string;
        promotion_type?: never;
        shipping_info?: never;
    } | {
        evaluation_id: any;
        promotion_id: number;
        promotion_name: string | null;
        is_eligible: boolean;
        original_total: number;
        discounted_total: number;
        total_discount: number;
        discount_breakdown: {
            cart_record_id: string;
            product_id: string;
            product_name: string;
            category: string;
            quantity: number;
            original_price: number;
            discount_per_item: number;
            final_price_per_item: number;
            total_discount: number;
        }[];
        ineligible_reason: null;
        expires_at: string;
        promotion_type: string | null;
        shipping_info: {
            original_shipping_cost: number;
            final_shipping_cost: number;
            shipping_discount: number;
            is_free_shipping: boolean;
        } | undefined;
    }>;
    private generateEvaluationId;
    private calculateDiscountBreakdown;
    private isItemEligibleForPromotion;
    private calculateBOGODiscount;
    private storeEvaluation;
    removeEvaluation(evaluationId: string, userId: string): Promise<{
        evaluation_id: string;
        status: string;
    }>;
    validateEvaluationForOrder(evaluationId: string, userId: string): Promise<{
        isValid: boolean;
        reason?: string;
        evaluation?: any;
    }>;
    getUserActiveEvaluations(userId: string): Promise<{
        evaluations: {
            evaluation_id: any;
            user_id: any;
            original_total: any;
            discounted_total: any;
            applied_promotions: any;
            status: any;
            created_at: any;
            expires_at: any;
        }[];
        total_count: number;
    }>;
    evaluateAutomaticPromotions(request: {
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
    }): Promise<{
        evaluations: ({
            evaluation_id: any;
            promotion_id: number;
            promotion_name: string | null;
            is_eligible: boolean;
            original_total: number;
            discounted_total: number;
            total_discount: number;
            discount_breakdown: never[];
            ineligible_reason: string;
            expires_at: string;
            promotion_type?: never;
            shipping_info?: never;
        } | {
            evaluation_id: any;
            promotion_id: number;
            promotion_name: string | null;
            is_eligible: boolean;
            original_total: number;
            discounted_total: number;
            total_discount: number;
            discount_breakdown: {
                cart_record_id: string;
                product_id: string;
                product_name: string;
                category: string;
                quantity: number;
                original_price: number;
                discount_per_item: number;
                final_price_per_item: number;
                total_discount: number;
            }[];
            ineligible_reason: null;
            expires_at: string;
            promotion_type: string | null;
            shipping_info: {
                original_shipping_cost: number;
                final_shipping_cost: number;
                shipping_discount: number;
                is_free_shipping: boolean;
            } | undefined;
        })[];
        total_automatic_discount: number;
        cart_total_after_automatic: number;
    }>;
    private checkAutomaticPromotionEligibility;
    private evaluateCondition;
    private calculateShippingCost;
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
    }>): string;
    findActiveEvaluationByCartSignature(userId: string, cartSignature: string): Promise<{
        status: string | null;
        createddate: bigint | null;
        modifieddate: bigint | null;
        evaluation_id: string;
        original_total: import("@prisma/client/runtime/library").Decimal | null;
        order_id: number | null;
        user_id: string | null;
        cart_data: import("@prisma/client/runtime/library").JsonValue | null;
        cart_signature: string | null;
        discounted_total: import("@prisma/client/runtime/library").Decimal | null;
        applied_promotions: import("@prisma/client/runtime/library").JsonValue | null;
        ineligible_coupons: import("@prisma/client/runtime/library").JsonValue | null;
        context: import("@prisma/client/runtime/library").JsonValue | null;
        created_at: bigint;
        expires_at: bigint;
    } | null>;
    updateEvaluationWithManualPromotion(existingEvaluation: any, request: {
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
    }): Promise<{
        evaluation_id: any;
        promotion_id: number;
        promotion_name: string | null;
        is_eligible: boolean;
        original_total: number;
        discounted_total: number;
        total_discount: number;
        discount_breakdown: never[];
        ineligible_reason: string;
        expires_at: string;
        promotion_type?: never;
        shipping_info?: never;
    } | {
        evaluation_id: any;
        promotion_id: number;
        promotion_name: string | null;
        is_eligible: boolean;
        original_total: number;
        discounted_total: number;
        total_discount: number;
        discount_breakdown: {
            cart_record_id: string;
            product_id: string;
            product_name: string;
            category: string;
            quantity: number;
            original_price: number;
            discount_per_item: number;
            final_price_per_item: number;
            total_discount: number;
        }[];
        ineligible_reason: null;
        expires_at: string;
        promotion_type: string | null;
        shipping_info: {
            original_shipping_cost: number;
            final_shipping_cost: number;
            shipping_discount: number;
            is_free_shipping: boolean;
        } | undefined;
    }>;
    createAutomaticEvaluation(request: {
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
    }): Promise<{
        evaluation_id: string;
        user_id: string;
        cart_signature: string;
        cart_data: {
            cart_record_id: string;
            product_id: string;
            quantity: number;
            base_price: number;
            product_discount: number;
            price: number;
            category: string;
            subcategory?: string;
            name?: string;
        }[];
        applied_promotions: {
            promotion_id: number;
            promotion_name: string;
            promotion_type: string;
            discount_amount: number;
            is_auto: boolean;
            is_free_shipping: boolean;
        }[];
        status: string;
        created_at: string;
        expires_at: string;
    }>;
    applyManualCoupon(request: {
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
    }): Promise<{
        evaluation_id: string;
        applied_promotions: any[];
        expires_at: string;
    }>;
    removeManualCoupon(request: {
        evaluation_id: string;
        promotion_id: number;
    }): Promise<{
        evaluation_id: string;
        applied_promotions: any[];
        expires_at: string;
    }>;
    getEligibleAutomaticPromotions(userId: string, cartTotal: number, cartItems: any[]): Promise<{
        promotion_id: number;
        promotion_name: string;
        promotion_type: string;
        discount_amount: number;
        is_auto: boolean;
    }[]>;
}
//# sourceMappingURL=promotion-evaluation.service.d.ts.map