import { RedemptionRequest, RedemptionResponse } from '../schemas/redemption.schema.js';
export declare class PromotionRedemptionService {
    private prisma;
    constructor();
    redeemPromotion(request: RedemptionRequest): Promise<RedemptionResponse>;
    private getEvaluation;
    private getRedemptionByEvaluation;
    private createRedemptionRecords;
    private updateEvaluationStatus;
    private updatePromotionCounters;
    getRedemptionsForOrder(orderId: string): Promise<{
        id: any;
        promotion_id: any;
        promotion_name: any;
        promotion_type: any;
        promotion_code: any;
        discount_amount: any;
        redeemed_at: any;
        redemption_data: any;
    }[]>;
    getRedemptionById(redemptionId: string): Promise<{
        id: string;
        evaluation_id: string;
        order_id: string | null;
        user_id: string | null;
        promotion_id: number | null;
        promotion_name: string | null | undefined;
        promotion_type: string | null | undefined;
        promotion_code: string | null | undefined;
        discount_amount: import("@prisma/client/runtime/library").Decimal | null;
        redeemed_at: bigint;
        redemption_data: import("@prisma/client/runtime/library").JsonValue;
        evaluation: {
            evaluation_id: string;
            user_id: string | null;
            created_at: bigint;
        };
    } | null>;
    getUserRedemptionHistory(userId: string, page?: number, limit?: number): Promise<{
        redemptions: {
            id: any;
            promotion_id: any;
            promotion_name: any;
            promotion_type: any;
            promotion_code: any;
            discount_amount: any;
            redeemed_at: any;
            order_id: any;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            totalPages: number;
            hasNext: boolean;
            hasPrev: boolean;
        };
    }>;
    private getUtcTimestamp;
    /**
     * Update promotion usage tracking after redemption
     * This method updates budget consumption and usage counts
     */
    private updatePromotionUsageTracking;
}
//# sourceMappingURL=promotion-redemption.service.d.ts.map