import { z } from 'zod';
export declare const createPromotionTargetLinkSchema: z.ZodObject<{
    promotion_id: z.ZodOptional<z.ZodNumber>;
    target_type: z.ZodOptional<z.ZodString>;
    target_id: z.ZodOptional<z.ZodString>;
    target_label: z.ZodOptional<z.ZodString>;
    apply_scope: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    promotion_id: z.ZodOptional<z.ZodNumber>;
    target_type: z.ZodOptional<z.ZodString>;
    target_id: z.ZodOptional<z.ZodString>;
    target_label: z.ZodOptional<z.ZodString>;
    apply_scope: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    promotion_id: z.ZodOptional<z.ZodNumber>;
    target_type: z.ZodOptional<z.ZodString>;
    target_id: z.ZodOptional<z.ZodString>;
    target_label: z.ZodOptional<z.ZodString>;
    apply_scope: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">>;
export declare const updatePromotionTargetLinkSchema: z.ZodObject<{
    promotion_id: z.ZodOptional<z.ZodNumber>;
    target_type: z.ZodOptional<z.ZodString>;
    target_id: z.ZodOptional<z.ZodString>;
    target_label: z.ZodOptional<z.ZodString>;
    apply_scope: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    promotion_id: z.ZodOptional<z.ZodNumber>;
    target_type: z.ZodOptional<z.ZodString>;
    target_id: z.ZodOptional<z.ZodString>;
    target_label: z.ZodOptional<z.ZodString>;
    apply_scope: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    promotion_id: z.ZodOptional<z.ZodNumber>;
    target_type: z.ZodOptional<z.ZodString>;
    target_id: z.ZodOptional<z.ZodString>;
    target_label: z.ZodOptional<z.ZodString>;
    apply_scope: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">>;
export declare const upsertPromotionTargetLinkSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    promotion_id: z.ZodOptional<z.ZodNumber>;
    target_type: z.ZodOptional<z.ZodString>;
    target_id: z.ZodOptional<z.ZodString>;
    target_label: z.ZodOptional<z.ZodString>;
    apply_scope: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    id: z.ZodOptional<z.ZodNumber>;
    promotion_id: z.ZodOptional<z.ZodNumber>;
    target_type: z.ZodOptional<z.ZodString>;
    target_id: z.ZodOptional<z.ZodString>;
    target_label: z.ZodOptional<z.ZodString>;
    apply_scope: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    id: z.ZodOptional<z.ZodNumber>;
    promotion_id: z.ZodOptional<z.ZodNumber>;
    target_type: z.ZodOptional<z.ZodString>;
    target_id: z.ZodOptional<z.ZodString>;
    target_label: z.ZodOptional<z.ZodString>;
    apply_scope: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">>;
export declare const promotionTargetLinkParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const promotionTargetLinkQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    promotion_id: z.ZodOptional<z.ZodString>;
    target_type: z.ZodOptional<z.ZodString>;
    target_id: z.ZodOptional<z.ZodString>;
    target_label: z.ZodOptional<z.ZodString>;
    apply_scope: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    is_active?: string | undefined;
    promotion_id?: string | undefined;
    target_type?: string | undefined;
    target_id?: string | undefined;
    target_label?: string | undefined;
    apply_scope?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
}, {
    is_active?: string | undefined;
    promotion_id?: string | undefined;
    target_type?: string | undefined;
    target_id?: string | undefined;
    target_label?: string | undefined;
    apply_scope?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
}>;
export type CreatePromotionTargetLinkInput = z.infer<typeof createPromotionTargetLinkSchema>;
export type UpdatePromotionTargetLinkInput = z.infer<typeof updatePromotionTargetLinkSchema>;
export type UpsertPromotionTargetLinkInput = z.infer<typeof upsertPromotionTargetLinkSchema>;
export type PromotionTargetLinkParams = z.infer<typeof promotionTargetLinkParamsSchema>;
export type PromotionTargetLinkQuery = z.infer<typeof promotionTargetLinkQuerySchema>;
//# sourceMappingURL=promotion-target-link.schema.d.ts.map