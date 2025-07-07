import { PromotionEligibilityInput } from '../schemas/promotions.schema.js';
export interface EligiblePromotion {
    promotion_id: number;
    name: string;
    type: string;
    description: string;
    stackable: boolean;
    actions: Array<{
        type: string;
        target: string;
        value: number | string;
    }>;
}
export interface PromotionEligibilityResponse {
    eligible_promotions: EligiblePromotion[];
}
export declare class PromotionEvaluationService {
    /**
     * Main method to evaluate promotion eligibility
     * Implements the logic described in the requirements
     */
    evaluateEligibility(data: PromotionEligibilityInput): Promise<PromotionEligibilityResponse>;
    /**
     * Step 1: Get active promotions within date range
     */
    private getActivePromotions;
    /**
     * Step 2: Check if a specific promotion is eligible for the given request
     */
    private checkPromotionEligibility;
    /**
     * Check usage limits (per_user_limit and max_redemptions)
     */
    private checkUsageLimits;
    /**
     * Check target links (user_id, product_id, category restrictions)
     */
    private checkTargetLinks;
    /**
     * Check a single target link
     */
    private checkSingleTargetLink;
    /**
     * Check promotion rules with logic_group support
     */
    private checkPromotionRules;
    /**
     * Group rules by logic_group
     */
    private groupRulesByLogicGroup;
    /**
     * Evaluate a single rule group (AND logic within group)
     */
    private evaluateRuleGroup;
    /**
     * Evaluate a single rule
     */
    private evaluateSingleRule;
    /**
     * Get the actual value for a condition key
     */
    private getConditionValue;
    /**
     * Perform comparison based on operator
     */
    private performComparison;
    /**
     * Get promotion actions sorted by action_order
     */
    private getPromotionActions;
    /**
     * Format eligible promotion for response
     */
    private formatEligiblePromotion;
    /**
     * Generate description for promotion
     */
    private generatePromotionDescription;
    /**
     * Handle stackable logic and priority sorting
     */
    private handleStackableLogic;
}
//# sourceMappingURL=promotion-evaluation.service.d.ts.map