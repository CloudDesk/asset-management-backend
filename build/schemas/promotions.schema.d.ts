import { z } from 'zod';
export declare const createPromotionsSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["coupon", "automatic", "waive_fee"]>>;
    code: z.ZodOptional<z.ZodString>;
    auto_apply: z.ZodOptional<z.ZodBoolean>;
    start_date: z.ZodOptional<z.ZodString>;
    end_date: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive"]>>;
    priority: z.ZodOptional<z.ZodNumber>;
    visibility: z.ZodOptional<z.ZodEnum<["public", "private"]>>;
    max_redemptions: z.ZodOptional<z.ZodNumber>;
    per_user_limit: z.ZodOptional<z.ZodNumber>;
    stackable: z.ZodOptional<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    code?: string | undefined;
    type?: "coupon" | "automatic" | "waive_fee" | undefined;
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    priority?: number | undefined;
    auto_apply?: boolean | undefined;
    start_date?: string | undefined;
    end_date?: string | undefined;
    visibility?: "public" | "private" | undefined;
    max_redemptions?: number | undefined;
    per_user_limit?: number | undefined;
    stackable?: boolean | undefined;
}, {
    code?: string | undefined;
    type?: "coupon" | "automatic" | "waive_fee" | undefined;
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    priority?: number | undefined;
    auto_apply?: boolean | undefined;
    start_date?: string | undefined;
    end_date?: string | undefined;
    visibility?: "public" | "private" | undefined;
    max_redemptions?: number | undefined;
    per_user_limit?: number | undefined;
    stackable?: boolean | undefined;
}>;
export declare const updatePromotionsSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["coupon", "automatic", "waive_fee"]>>;
    code: z.ZodOptional<z.ZodString>;
    auto_apply: z.ZodOptional<z.ZodBoolean>;
    start_date: z.ZodOptional<z.ZodString>;
    end_date: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive"]>>;
    priority: z.ZodOptional<z.ZodNumber>;
    visibility: z.ZodOptional<z.ZodEnum<["public", "private"]>>;
    max_redemptions: z.ZodOptional<z.ZodNumber>;
    per_user_limit: z.ZodOptional<z.ZodNumber>;
    stackable: z.ZodOptional<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    code?: string | undefined;
    type?: "coupon" | "automatic" | "waive_fee" | undefined;
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    priority?: number | undefined;
    auto_apply?: boolean | undefined;
    start_date?: string | undefined;
    end_date?: string | undefined;
    visibility?: "public" | "private" | undefined;
    max_redemptions?: number | undefined;
    per_user_limit?: number | undefined;
    stackable?: boolean | undefined;
}, {
    code?: string | undefined;
    type?: "coupon" | "automatic" | "waive_fee" | undefined;
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    priority?: number | undefined;
    auto_apply?: boolean | undefined;
    start_date?: string | undefined;
    end_date?: string | undefined;
    visibility?: "public" | "private" | undefined;
    max_redemptions?: number | undefined;
    per_user_limit?: number | undefined;
    stackable?: boolean | undefined;
}>;
export declare const upsertPromotionsSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["coupon", "automatic", "waive_fee"]>>;
    code: z.ZodOptional<z.ZodString>;
    auto_apply: z.ZodOptional<z.ZodBoolean>;
    start_date: z.ZodOptional<z.ZodString>;
    end_date: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive"]>>;
    priority: z.ZodOptional<z.ZodNumber>;
    visibility: z.ZodOptional<z.ZodEnum<["public", "private"]>>;
    max_redemptions: z.ZodOptional<z.ZodNumber>;
    per_user_limit: z.ZodOptional<z.ZodNumber>;
    stackable: z.ZodOptional<z.ZodBoolean>;
}, "strict", z.ZodTypeAny, {
    code?: string | undefined;
    type?: "coupon" | "automatic" | "waive_fee" | undefined;
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    id?: number | undefined;
    priority?: number | undefined;
    auto_apply?: boolean | undefined;
    start_date?: string | undefined;
    end_date?: string | undefined;
    visibility?: "public" | "private" | undefined;
    max_redemptions?: number | undefined;
    per_user_limit?: number | undefined;
    stackable?: boolean | undefined;
}, {
    code?: string | undefined;
    type?: "coupon" | "automatic" | "waive_fee" | undefined;
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    id?: number | undefined;
    priority?: number | undefined;
    auto_apply?: boolean | undefined;
    start_date?: string | undefined;
    end_date?: string | undefined;
    visibility?: "public" | "private" | undefined;
    max_redemptions?: number | undefined;
    per_user_limit?: number | undefined;
    stackable?: boolean | undefined;
}>;
export declare const promotionsParamsSchema: z.ZodObject<{
    id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
}, {
    id: string;
}>;
export declare const promotionsQuerySchema: z.ZodObject<{
    page: z.ZodOptional<z.ZodString>;
    limit: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodString>;
    code: z.ZodOptional<z.ZodString>;
    auto_apply: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodString>;
    visibility: z.ZodOptional<z.ZodString>;
    stackable: z.ZodOptional<z.ZodString>;
    start_date_after: z.ZodOptional<z.ZodString>;
    start_date_before: z.ZodOptional<z.ZodString>;
    end_date_after: z.ZodOptional<z.ZodString>;
    end_date_before: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code?: string | undefined;
    type?: string | undefined;
    status?: string | undefined;
    name?: string | undefined;
    priority?: string | undefined;
    auto_apply?: string | undefined;
    visibility?: string | undefined;
    stackable?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    start_date_after?: string | undefined;
    start_date_before?: string | undefined;
    end_date_after?: string | undefined;
    end_date_before?: string | undefined;
}, {
    code?: string | undefined;
    type?: string | undefined;
    status?: string | undefined;
    name?: string | undefined;
    priority?: string | undefined;
    auto_apply?: string | undefined;
    visibility?: string | undefined;
    stackable?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    start_date_after?: string | undefined;
    start_date_before?: string | undefined;
    end_date_after?: string | undefined;
    end_date_before?: string | undefined;
}>;
export declare const promotionEligibilitySchema: z.ZodObject<{
    user_id: z.ZodString;
    platform: z.ZodString;
    cart: z.ZodOptional<z.ZodArray<z.ZodObject<{
        product_id: z.ZodString;
        quantity: z.ZodNumber;
        price: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        quantity: number;
        price: number;
        product_id: string;
    }, {
        quantity: number;
        price: number;
        product_id: string;
    }>, "many">>;
    code: z.ZodOptional<z.ZodString>;
    order_date: z.ZodOptional<z.ZodString>;
    payment_method: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    user_id: string;
    platform: string;
    code?: string | undefined;
    cart?: {
        quantity: number;
        price: number;
        product_id: string;
    }[] | undefined;
    order_date?: string | undefined;
    payment_method?: string | undefined;
}, {
    user_id: string;
    platform: string;
    code?: string | undefined;
    cart?: {
        quantity: number;
        price: number;
        product_id: string;
    }[] | undefined;
    order_date?: string | undefined;
    payment_method?: string | undefined;
}>;
export declare const promotionEligibilityQuerySchema: z.ZodObject<{
    user_id: z.ZodString;
    platform: z.ZodString;
    code: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    user_id: string;
    platform: string;
    code?: string | undefined;
}, {
    user_id: string;
    platform: string;
    code?: string | undefined;
}>;
export type CreatePromotionsInput = z.infer<typeof createPromotionsSchema>;
export type UpdatePromotionsInput = z.infer<typeof updatePromotionsSchema>;
export type UpsertPromotionsInput = z.infer<typeof upsertPromotionsSchema>;
export type PromotionsParams = z.infer<typeof promotionsParamsSchema>;
export type PromotionsQuery = z.infer<typeof promotionsQuerySchema>;
export type PromotionEligibilityInput = z.infer<typeof promotionEligibilitySchema>;
export type PromotionEligibilityQueryInput = z.infer<typeof promotionEligibilityQuerySchema>;
//# sourceMappingURL=promotions.schema.d.ts.map