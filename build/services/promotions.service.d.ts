import { CreatePromotionsInput, UpdatePromotionsInput } from '../schemas/promotions.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class PromotionsService {
    private prisma;
    getPublicPromotions(options: {
        channel: string;
        geo: string;
        limit: number;
    }): Promise<any[]>;
    getIdentifiedUserPromotions(options: {
        userId: string;
        currentDate?: string;
        channel: string;
        geo: string;
        limit: number;
    }): Promise<any[]>;
    getUserSegments(userId: string): Promise<string[]>;
    private isPromotionCurrentlyActive;
    private isPromotionApplicableToUser;
    private evaluateCondition;
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreatePromotionsInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdatePromotionsInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<true>;
    getBestPromotionRecommendation(request: {
        userId: string;
        cartItems: Array<{
            productId: string;
            qty: number;
            category: string;
            price: number;
        }>;
        mode: 'phonepe' | 'cod';
    }): Promise<{
        recommendation: null;
        message: string;
        cartTotal: number;
        eligiblePromotions: never[];
        eligibleCount?: never;
    } | {
        recommendation: {
            promotion: {
                id: any;
                name: any;
                description: any;
                type: any;
                code: any;
                discount_value: any;
                discount_type: any;
                priority: any;
                start_date: any;
                end_date: any;
            };
            discountInfo: {
                originalTotal: number;
                discountAmount: any;
                discountedTotal: number;
                discountPercentage: any;
                savingsAmount: any;
            };
            cartInfo: {
                totalItems: number;
                categories: string[];
                totalValue: number;
            };
            mode: "phonepe" | "cod";
            expiresAt: any;
        };
        message: string;
        eligibleCount: number;
        cartTotal: number;
        eligiblePromotions?: never;
    }>;
    private checkUserEligibilityForRecommendation;
    private checkCartEligibilityForRecommendation;
    private calculatePotentialDiscount;
    private isItemEligibleForRecommendation;
    private evaluateNumericCondition;
    private evaluateDateCondition;
    private getUserCreatedDate;
    private getUserOrderCount;
    private formatPromotionForDisplay;
}
//# sourceMappingURL=promotions.service.d.ts.map