import { EvaluationRequest, EvaluationResponse } from '../schemas/evaluation.schema.js';
export declare class PromotionEvaluationService {
    private prisma;
    constructor();
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
        user_id: string | null;
        cart_data: import("@prisma/client/runtime/library").JsonValue | null;
        original_total: import("@prisma/client/runtime/library").Decimal | null;
        discounted_total: import("@prisma/client/runtime/library").Decimal | null;
        applied_promotions: import("@prisma/client/runtime/library").JsonValue | null;
        ineligible_coupons: import("@prisma/client/runtime/library").JsonValue | null;
        context: import("@prisma/client/runtime/library").JsonValue | null;
        created_at: Date;
        expires_at: Date;
    } | null>;
}
//# sourceMappingURL=promotion-evaluation.service.d.ts.map