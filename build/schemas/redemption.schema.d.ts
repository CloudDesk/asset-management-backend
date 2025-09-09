import { z } from 'zod';
export declare const redemptionRequestSchema: z.ZodObject<{
    evaluation_id: z.ZodString;
    order_id: z.ZodString;
    user_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    evaluation_id: string;
    order_id: string;
    user_id: string;
}, {
    evaluation_id: string;
    order_id: string;
    user_id: string;
}>;
export declare const redemptionDetailSchema: z.ZodObject<{
    promotion_id: z.ZodNumber;
    discount_amount: z.ZodNumber;
    redeemed_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    promotion_id: number;
    discount_amount: number;
    redeemed_at: string;
}, {
    promotion_id: number;
    discount_amount: number;
    redeemed_at: string;
}>;
export declare const redemptionResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    redemption_id: z.ZodString;
    order_id: z.ZodString;
    total_discount_applied: z.ZodNumber;
    redemption_details: z.ZodArray<z.ZodObject<{
        promotion_id: z.ZodNumber;
        discount_amount: z.ZodNumber;
        redeemed_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        promotion_id: number;
        discount_amount: number;
        redeemed_at: string;
    }, {
        promotion_id: number;
        discount_amount: number;
        redeemed_at: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    order_id: string;
    success: boolean;
    redemption_id: string;
    total_discount_applied: number;
    redemption_details: {
        promotion_id: number;
        discount_amount: number;
        redeemed_at: string;
    }[];
}, {
    order_id: string;
    success: boolean;
    redemption_id: string;
    total_discount_applied: number;
    redemption_details: {
        promotion_id: number;
        discount_amount: number;
        redeemed_at: string;
    }[];
}>;
export type RedemptionRequest = z.infer<typeof redemptionRequestSchema>;
export type RedemptionDetail = z.infer<typeof redemptionDetailSchema>;
export type RedemptionResponse = z.infer<typeof redemptionResponseSchema>;
//# sourceMappingURL=redemption.schema.d.ts.map