import { CreatePromotionsInput, UpdatePromotionsInput } from '../schemas/promotions.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class PromotionsService {
    private prisma;
    getAutoAppliedPromotionsFromEvaluation(userId: string): Promise<any[]>;
    private convertDateToUnixTimestamp;
    private convertUnixTimestampToDateString;
    private convertUnixTimestampToDate;
    private transformFrontendDataToBackend;
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
    findMany(filters: FilterOptions, page: number, limit: number, adminMode?: boolean): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreatePromotionsInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdatePromotionsInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<true>;
    private calculatePotentialDiscount;
    private isItemEligibleForRecommendation;
    private evaluateNumericCondition;
    private evaluateDateCondition;
    private getUserCreatedDate;
    private getUserOrderCount;
    private formatPromotionForDisplay;
    getUnifiedPromotionOffers(request: {
        userId: string;
        cartItems: Array<{
            productId: string;
            qty: number;
            category: string;
            price: number;
        }>;
        mode: 'phonepe' | 'cod';
    }): Promise<{
        bestCoupon: any;
        eligibleCoupons: any[];
        ineligibleCoupons: any[];
        stackablePromotions: any[];
        autoAppliedPromotions: any[];
        summary: {
            totalPromotions: number;
            eligibleCount: number;
            ineligibleCount: number;
            stackableCount: number;
            autoAppliedCount: number;
            cartTotal: number;
            cartItems: number;
            categories: string[];
        };
    }>;
    private checkUserEligibilityForEligible;
    private checkCartEligibilityForEligible;
}
//# sourceMappingURL=promotions.service.d.ts.map