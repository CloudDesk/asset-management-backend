import { z } from 'zod';
export declare const createPromotionUsageLogSchema: z.ZodObject<{
    promotion_id: z.ZodOptional<z.ZodNumber>;
    user_id: z.ZodOptional<z.ZodString>;
    order_id: z.ZodOptional<z.ZodString>;
    redemption_date: z.ZodOptional<z.ZodString>;
    discount_applied: z.ZodOptional<z.ZodNumber>;
    platform: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    promotion_id: z.ZodOptional<z.ZodNumber>;
    user_id: z.ZodOptional<z.ZodString>;
    order_id: z.ZodOptional<z.ZodString>;
    redemption_date: z.ZodOptional<z.ZodString>;
    discount_applied: z.ZodOptional<z.ZodNumber>;
    platform: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    promotion_id: z.ZodOptional<z.ZodNumber>;
    user_id: z.ZodOptional<z.ZodString>;
    order_id: z.ZodOptional<z.ZodString>;
    redemption_date: z.ZodOptional<z.ZodString>;
    discount_applied: z.ZodOptional<z.ZodNumber>;
    platform: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export declare const updatePromotionUsageLogSchema: z.ZodObject<{
    promotion_id: z.ZodOptional<z.ZodNumber>;
    user_id: z.ZodOptional<z.ZodString>;
    order_id: z.ZodOptional<z.ZodString>;
    redemption_date: z.ZodOptional<z.ZodString>;
    discount_applied: z.ZodOptional<z.ZodNumber>;
    platform: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    promotion_id: z.ZodOptional<z.ZodNumber>;
    user_id: z.ZodOptional<z.ZodString>;
    order_id: z.ZodOptional<z.ZodString>;
    redemption_date: z.ZodOptional<z.ZodString>;
    discount_applied: z.ZodOptional<z.ZodNumber>;
    platform: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    promotion_id: z.ZodOptional<z.ZodNumber>;
    user_id: z.ZodOptional<z.ZodString>;
    order_id: z.ZodOptional<z.ZodString>;
    redemption_date: z.ZodOptional<z.ZodString>;
    discount_applied: z.ZodOptional<z.ZodNumber>;
    platform: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export declare const upsertPromotionUsageLogSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    promotion_id: z.ZodOptional<z.ZodNumber>;
    user_id: z.ZodOptional<z.ZodString>;
    order_id: z.ZodOptional<z.ZodString>;
    redemption_date: z.ZodOptional<z.ZodString>;
    discount_applied: z.ZodOptional<z.ZodNumber>;
    platform: z.ZodOptional<z.ZodString>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodOptional<z.ZodNumber>;
    promotion_id: z.ZodOptional<z.ZodNumber>;
    user_id: z.ZodOptional<z.ZodString>;
    order_id: z.ZodOptional<z.ZodString>;
    redemption_date: z.ZodOptional<z.ZodString>;
    discount_applied: z.ZodOptional<z.ZodNumber>;
    platform: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodOptional<z.ZodNumber>;
    promotion_id: z.ZodOptional<z.ZodNumber>;
    user_id: z.ZodOptional<z.ZodString>;
    order_id: z.ZodOptional<z.ZodString>;
    redemption_date: z.ZodOptional<z.ZodString>;
    discount_applied: z.ZodOptional<z.ZodNumber>;
    platform: z.ZodOptional<z.ZodString>;
}, z.ZodTypeAny, "passthrough">>;
export declare const promotionUsageLogParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const promotionUsageLogQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    promotion_id: z.ZodOptional<z.ZodString>;
    user_id: z.ZodOptional<z.ZodString>;
    order_id: z.ZodOptional<z.ZodString>;
    platform: z.ZodOptional<z.ZodString>;
    discount_applied_min: z.ZodOptional<z.ZodString>;
    discount_applied_max: z.ZodOptional<z.ZodString>;
    redemption_date_after: z.ZodOptional<z.ZodString>;
    redemption_date_before: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    page?: string | undefined;
    limit?: string | undefined;
    user_id?: string | undefined;
    platform?: string | undefined;
    promotion_id?: string | undefined;
    order_id?: string | undefined;
    discount_applied_min?: string | undefined;
    discount_applied_max?: string | undefined;
    redemption_date_after?: string | undefined;
    redemption_date_before?: string | undefined;
}, {
    page?: string | undefined;
    limit?: string | undefined;
    user_id?: string | undefined;
    platform?: string | undefined;
    promotion_id?: string | undefined;
    order_id?: string | undefined;
    discount_applied_min?: string | undefined;
    discount_applied_max?: string | undefined;
    redemption_date_after?: string | undefined;
    redemption_date_before?: string | undefined;
}>;
export type CreatePromotionUsageLogInput = z.infer<typeof createPromotionUsageLogSchema>;
export type UpdatePromotionUsageLogInput = z.infer<typeof updatePromotionUsageLogSchema>;
export type UpsertPromotionUsageLogInput = z.infer<typeof upsertPromotionUsageLogSchema>;
export type PromotionUsageLogParams = z.infer<typeof promotionUsageLogParamsSchema>;
export type PromotionUsageLogQuery = z.infer<typeof promotionUsageLogQuerySchema>;
//# sourceMappingURL=promotion-usage-log.schema.d.ts.map