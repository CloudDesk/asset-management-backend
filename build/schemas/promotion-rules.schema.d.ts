import { z } from 'zod';
export declare const createPromotionRulesSchema: z.ZodObject<{
    promotion_id: z.ZodOptional<z.ZodNumber>;
    rule_type: z.ZodOptional<z.ZodEnum<["user", "product", "cart", "payment"]>>;
    condition_key: z.ZodOptional<z.ZodString>;
    operator: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodString>;
    value_type: z.ZodOptional<z.ZodEnum<["string", "number", "currency"]>>;
    logic_group: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodNumber>;
    exclude: z.ZodOptional<z.ZodBoolean>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    value?: string | undefined;
    priority?: number | undefined;
    is_active?: boolean | undefined;
    notes?: string | undefined;
    promotion_id?: number | undefined;
    condition_key?: string | undefined;
    rule_type?: "product" | "cart" | "user" | "payment" | undefined;
    operator?: string | undefined;
    value_type?: "string" | "number" | "currency" | undefined;
    logic_group?: string | undefined;
    exclude?: boolean | undefined;
}, {
    value?: string | undefined;
    priority?: number | undefined;
    is_active?: boolean | undefined;
    notes?: string | undefined;
    promotion_id?: number | undefined;
    condition_key?: string | undefined;
    rule_type?: "product" | "cart" | "user" | "payment" | undefined;
    operator?: string | undefined;
    value_type?: "string" | "number" | "currency" | undefined;
    logic_group?: string | undefined;
    exclude?: boolean | undefined;
}>;
export declare const updatePromotionRulesSchema: z.ZodObject<{
    promotion_id: z.ZodOptional<z.ZodNumber>;
    rule_type: z.ZodOptional<z.ZodEnum<["user", "product", "cart", "payment"]>>;
    condition_key: z.ZodOptional<z.ZodString>;
    operator: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodString>;
    value_type: z.ZodOptional<z.ZodEnum<["string", "number", "currency"]>>;
    logic_group: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodNumber>;
    exclude: z.ZodOptional<z.ZodBoolean>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    value?: string | undefined;
    priority?: number | undefined;
    is_active?: boolean | undefined;
    notes?: string | undefined;
    promotion_id?: number | undefined;
    condition_key?: string | undefined;
    rule_type?: "product" | "cart" | "user" | "payment" | undefined;
    operator?: string | undefined;
    value_type?: "string" | "number" | "currency" | undefined;
    logic_group?: string | undefined;
    exclude?: boolean | undefined;
}, {
    value?: string | undefined;
    priority?: number | undefined;
    is_active?: boolean | undefined;
    notes?: string | undefined;
    promotion_id?: number | undefined;
    condition_key?: string | undefined;
    rule_type?: "product" | "cart" | "user" | "payment" | undefined;
    operator?: string | undefined;
    value_type?: "string" | "number" | "currency" | undefined;
    logic_group?: string | undefined;
    exclude?: boolean | undefined;
}>;
export declare const upsertPromotionRulesSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    promotion_id: z.ZodOptional<z.ZodNumber>;
    rule_type: z.ZodOptional<z.ZodEnum<["user", "product", "cart", "payment"]>>;
    condition_key: z.ZodOptional<z.ZodString>;
    operator: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodString>;
    value_type: z.ZodOptional<z.ZodEnum<["string", "number", "currency"]>>;
    logic_group: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodNumber>;
    exclude: z.ZodOptional<z.ZodBoolean>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    notes: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    value?: string | undefined;
    id?: number | undefined;
    priority?: number | undefined;
    is_active?: boolean | undefined;
    notes?: string | undefined;
    promotion_id?: number | undefined;
    condition_key?: string | undefined;
    rule_type?: "product" | "cart" | "user" | "payment" | undefined;
    operator?: string | undefined;
    value_type?: "string" | "number" | "currency" | undefined;
    logic_group?: string | undefined;
    exclude?: boolean | undefined;
}, {
    value?: string | undefined;
    id?: number | undefined;
    priority?: number | undefined;
    is_active?: boolean | undefined;
    notes?: string | undefined;
    promotion_id?: number | undefined;
    condition_key?: string | undefined;
    rule_type?: "product" | "cart" | "user" | "payment" | undefined;
    operator?: string | undefined;
    value_type?: "string" | "number" | "currency" | undefined;
    logic_group?: string | undefined;
    exclude?: boolean | undefined;
}>;
export declare const promotionRulesParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const promotionRulesQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    promotion_id: z.ZodOptional<z.ZodString>;
    rule_type: z.ZodOptional<z.ZodString>;
    condition_key: z.ZodOptional<z.ZodString>;
    operator: z.ZodOptional<z.ZodString>;
    value: z.ZodOptional<z.ZodString>;
    value_type: z.ZodOptional<z.ZodString>;
    logic_group: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodString>;
    exclude: z.ZodOptional<z.ZodString>;
    is_active: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    value?: string | undefined;
    priority?: string | undefined;
    is_active?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    promotion_id?: string | undefined;
    condition_key?: string | undefined;
    rule_type?: string | undefined;
    operator?: string | undefined;
    value_type?: string | undefined;
    logic_group?: string | undefined;
    exclude?: string | undefined;
}, {
    value?: string | undefined;
    priority?: string | undefined;
    is_active?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    promotion_id?: string | undefined;
    condition_key?: string | undefined;
    rule_type?: string | undefined;
    operator?: string | undefined;
    value_type?: string | undefined;
    logic_group?: string | undefined;
    exclude?: string | undefined;
}>;
export type CreatePromotionRulesInput = z.infer<typeof createPromotionRulesSchema>;
export type UpdatePromotionRulesInput = z.infer<typeof updatePromotionRulesSchema>;
export type UpsertPromotionRulesInput = z.infer<typeof upsertPromotionRulesSchema>;
export type PromotionRulesParams = z.infer<typeof promotionRulesParamsSchema>;
export type PromotionRulesQuery = z.infer<typeof promotionRulesQuerySchema>;
//# sourceMappingURL=promotion-rules.schema.d.ts.map