import { z } from 'zod';
export declare const utcTimestampSchema: z.ZodUnion<[z.ZodBigInt, z.ZodEffects<z.ZodNumber, bigint, number>, z.ZodEffects<z.ZodString, bigint, string>]>;
export declare const utcTimestampResponseSchema: z.ZodUnion<[z.ZodEffects<z.ZodBigInt, string, bigint>, z.ZodString, z.ZodEffects<z.ZodNumber, string, number>]>;
export declare const promotionTypeEnum: z.ZodEnum<["PERCENT_OFF_ITEM", "FIXED_AMOUNT_OFF_ITEM", "BOGO", "PERCENT_OFF_CART", "FIXED_AMOUNT_OFF_CART", "FREE_SHIPPING", "FREE_PRODUCT"]>;
export declare const conditionSchema: z.ZodObject<{
    attribute: z.ZodString;
    operator: z.ZodEnum<["GTE", "LTE", "EQ", "IN", "NOT_IN", "CONTAINS"]>;
    value: z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString, "many">]>;
}, "strip", z.ZodTypeAny, {
    value: string | number | string[];
    attribute: string;
    operator: "GTE" | "LTE" | "EQ" | "IN" | "NOT_IN" | "CONTAINS";
}, {
    value: string | number | string[];
    attribute: string;
    operator: "GTE" | "LTE" | "EQ" | "IN" | "NOT_IN" | "CONTAINS";
}>;
export declare const actionSchema: z.ZodObject<{
    type: z.ZodEnum<["PERCENT_OFF", "FIXED_AMOUNT_OFF", "FREE_SHIPPING", "BOGO", "FREE_PRODUCT"]>;
    value: z.ZodUnion<[z.ZodNumber, z.ZodBoolean, z.ZodString]>;
}, "strip", z.ZodTypeAny, {
    value: string | number | boolean;
    type: "BOGO" | "FREE_SHIPPING" | "FREE_PRODUCT" | "PERCENT_OFF" | "FIXED_AMOUNT_OFF";
}, {
    value: string | number | boolean;
    type: "BOGO" | "FREE_SHIPPING" | "FREE_PRODUCT" | "PERCENT_OFF" | "FIXED_AMOUNT_OFF";
}>;
export declare const createPromotionsSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["PERCENT_OFF_ITEM", "FIXED_AMOUNT_OFF_ITEM", "BOGO", "PERCENT_OFF_CART", "FIXED_AMOUNT_OFF_CART", "FREE_SHIPPING", "FREE_PRODUCT"]>>;
    code: z.ZodOptional<z.ZodString>;
    auto_apply: z.ZodOptional<z.ZodBoolean>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    start_date: z.ZodOptional<z.ZodString>;
    end_date: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive"]>>;
    priority: z.ZodOptional<z.ZodNumber>;
    visibility: z.ZodOptional<z.ZodEnum<["public", "private"]>>;
    max_redemptions: z.ZodOptional<z.ZodNumber>;
    per_user_limit: z.ZodOptional<z.ZodNumber>;
    stackable: z.ZodOptional<z.ZodBoolean>;
    budget: z.ZodOptional<z.ZodNumber>;
    timezone: z.ZodOptional<z.ZodString>;
    evaluation_expiry_minutes: z.ZodOptional<z.ZodDefault<z.ZodNumber>>;
    discount_type: z.ZodOptional<z.ZodString>;
    discount_value: z.ZodOptional<z.ZodNumber>;
    conditions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        attribute: z.ZodString;
        operator: z.ZodEnum<["GTE", "LTE", "EQ", "IN", "NOT_IN", "CONTAINS"]>;
        value: z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString, "many">]>;
    }, "strip", z.ZodTypeAny, {
        value: string | number | string[];
        attribute: string;
        operator: "GTE" | "LTE" | "EQ" | "IN" | "NOT_IN" | "CONTAINS";
    }, {
        value: string | number | string[];
        attribute: string;
        operator: "GTE" | "LTE" | "EQ" | "IN" | "NOT_IN" | "CONTAINS";
    }>, "many">>;
    actions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["PERCENT_OFF", "FIXED_AMOUNT_OFF", "FREE_SHIPPING", "BOGO", "FREE_PRODUCT"]>;
        value: z.ZodUnion<[z.ZodNumber, z.ZodBoolean, z.ZodString]>;
    }, "strip", z.ZodTypeAny, {
        value: string | number | boolean;
        type: "BOGO" | "FREE_SHIPPING" | "FREE_PRODUCT" | "PERCENT_OFF" | "FIXED_AMOUNT_OFF";
    }, {
        value: string | number | boolean;
        type: "BOGO" | "FREE_SHIPPING" | "FREE_PRODUCT" | "PERCENT_OFF" | "FIXED_AMOUNT_OFF";
    }>, "many">>;
}, "strict", z.ZodTypeAny, {
    code?: string | undefined;
    type?: "PERCENT_OFF_ITEM" | "FIXED_AMOUNT_OFF_ITEM" | "BOGO" | "PERCENT_OFF_CART" | "FIXED_AMOUNT_OFF_CART" | "FREE_SHIPPING" | "FREE_PRODUCT" | undefined;
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    description?: string | undefined;
    auto_apply?: boolean | undefined;
    is_active?: boolean | undefined;
    start_date?: string | undefined;
    end_date?: string | undefined;
    priority?: number | undefined;
    visibility?: "public" | "private" | undefined;
    max_redemptions?: number | undefined;
    per_user_limit?: number | undefined;
    stackable?: boolean | undefined;
    budget?: number | undefined;
    timezone?: string | undefined;
    evaluation_expiry_minutes?: number | undefined;
    discount_type?: string | undefined;
    discount_value?: number | undefined;
    conditions?: {
        value: string | number | string[];
        attribute: string;
        operator: "GTE" | "LTE" | "EQ" | "IN" | "NOT_IN" | "CONTAINS";
    }[] | undefined;
    actions?: {
        value: string | number | boolean;
        type: "BOGO" | "FREE_SHIPPING" | "FREE_PRODUCT" | "PERCENT_OFF" | "FIXED_AMOUNT_OFF";
    }[] | undefined;
}, {
    code?: string | undefined;
    type?: "PERCENT_OFF_ITEM" | "FIXED_AMOUNT_OFF_ITEM" | "BOGO" | "PERCENT_OFF_CART" | "FIXED_AMOUNT_OFF_CART" | "FREE_SHIPPING" | "FREE_PRODUCT" | undefined;
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    description?: string | undefined;
    auto_apply?: boolean | undefined;
    is_active?: boolean | undefined;
    start_date?: string | undefined;
    end_date?: string | undefined;
    priority?: number | undefined;
    visibility?: "public" | "private" | undefined;
    max_redemptions?: number | undefined;
    per_user_limit?: number | undefined;
    stackable?: boolean | undefined;
    budget?: number | undefined;
    timezone?: string | undefined;
    evaluation_expiry_minutes?: number | undefined;
    discount_type?: string | undefined;
    discount_value?: number | undefined;
    conditions?: {
        value: string | number | string[];
        attribute: string;
        operator: "GTE" | "LTE" | "EQ" | "IN" | "NOT_IN" | "CONTAINS";
    }[] | undefined;
    actions?: {
        value: string | number | boolean;
        type: "BOGO" | "FREE_SHIPPING" | "FREE_PRODUCT" | "PERCENT_OFF" | "FIXED_AMOUNT_OFF";
    }[] | undefined;
}>;
export declare const updatePromotionsSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["PERCENT_OFF_ITEM", "FIXED_AMOUNT_OFF_ITEM", "BOGO", "PERCENT_OFF_CART", "FIXED_AMOUNT_OFF_CART", "FREE_SHIPPING", "FREE_PRODUCT"]>>;
    code: z.ZodOptional<z.ZodString>;
    auto_apply: z.ZodOptional<z.ZodBoolean>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    start_date: z.ZodOptional<z.ZodString>;
    end_date: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive"]>>;
    priority: z.ZodOptional<z.ZodNumber>;
    visibility: z.ZodOptional<z.ZodEnum<["public", "private"]>>;
    max_redemptions: z.ZodOptional<z.ZodNumber>;
    per_user_limit: z.ZodOptional<z.ZodNumber>;
    stackable: z.ZodOptional<z.ZodBoolean>;
    budget: z.ZodOptional<z.ZodNumber>;
    timezone: z.ZodOptional<z.ZodString>;
    evaluation_expiry_minutes: z.ZodOptional<z.ZodNumber>;
    discount_type: z.ZodOptional<z.ZodString>;
    discount_value: z.ZodOptional<z.ZodNumber>;
    conditions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        attribute: z.ZodString;
        operator: z.ZodEnum<["GTE", "LTE", "EQ", "IN", "NOT_IN", "CONTAINS"]>;
        value: z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString, "many">]>;
    }, "strip", z.ZodTypeAny, {
        value: string | number | string[];
        attribute: string;
        operator: "GTE" | "LTE" | "EQ" | "IN" | "NOT_IN" | "CONTAINS";
    }, {
        value: string | number | string[];
        attribute: string;
        operator: "GTE" | "LTE" | "EQ" | "IN" | "NOT_IN" | "CONTAINS";
    }>, "many">>;
    actions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["PERCENT_OFF", "FIXED_AMOUNT_OFF", "FREE_SHIPPING", "BOGO", "FREE_PRODUCT"]>;
        value: z.ZodUnion<[z.ZodNumber, z.ZodBoolean, z.ZodString]>;
    }, "strip", z.ZodTypeAny, {
        value: string | number | boolean;
        type: "BOGO" | "FREE_SHIPPING" | "FREE_PRODUCT" | "PERCENT_OFF" | "FIXED_AMOUNT_OFF";
    }, {
        value: string | number | boolean;
        type: "BOGO" | "FREE_SHIPPING" | "FREE_PRODUCT" | "PERCENT_OFF" | "FIXED_AMOUNT_OFF";
    }>, "many">>;
}, "strict", z.ZodTypeAny, {
    code?: string | undefined;
    type?: "PERCENT_OFF_ITEM" | "FIXED_AMOUNT_OFF_ITEM" | "BOGO" | "PERCENT_OFF_CART" | "FIXED_AMOUNT_OFF_CART" | "FREE_SHIPPING" | "FREE_PRODUCT" | undefined;
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    description?: string | undefined;
    auto_apply?: boolean | undefined;
    is_active?: boolean | undefined;
    start_date?: string | undefined;
    end_date?: string | undefined;
    priority?: number | undefined;
    visibility?: "public" | "private" | undefined;
    max_redemptions?: number | undefined;
    per_user_limit?: number | undefined;
    stackable?: boolean | undefined;
    budget?: number | undefined;
    timezone?: string | undefined;
    evaluation_expiry_minutes?: number | undefined;
    discount_type?: string | undefined;
    discount_value?: number | undefined;
    conditions?: {
        value: string | number | string[];
        attribute: string;
        operator: "GTE" | "LTE" | "EQ" | "IN" | "NOT_IN" | "CONTAINS";
    }[] | undefined;
    actions?: {
        value: string | number | boolean;
        type: "BOGO" | "FREE_SHIPPING" | "FREE_PRODUCT" | "PERCENT_OFF" | "FIXED_AMOUNT_OFF";
    }[] | undefined;
}, {
    code?: string | undefined;
    type?: "PERCENT_OFF_ITEM" | "FIXED_AMOUNT_OFF_ITEM" | "BOGO" | "PERCENT_OFF_CART" | "FIXED_AMOUNT_OFF_CART" | "FREE_SHIPPING" | "FREE_PRODUCT" | undefined;
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    description?: string | undefined;
    auto_apply?: boolean | undefined;
    is_active?: boolean | undefined;
    start_date?: string | undefined;
    end_date?: string | undefined;
    priority?: number | undefined;
    visibility?: "public" | "private" | undefined;
    max_redemptions?: number | undefined;
    per_user_limit?: number | undefined;
    stackable?: boolean | undefined;
    budget?: number | undefined;
    timezone?: string | undefined;
    evaluation_expiry_minutes?: number | undefined;
    discount_type?: string | undefined;
    discount_value?: number | undefined;
    conditions?: {
        value: string | number | string[];
        attribute: string;
        operator: "GTE" | "LTE" | "EQ" | "IN" | "NOT_IN" | "CONTAINS";
    }[] | undefined;
    actions?: {
        value: string | number | boolean;
        type: "BOGO" | "FREE_SHIPPING" | "FREE_PRODUCT" | "PERCENT_OFF" | "FIXED_AMOUNT_OFF";
    }[] | undefined;
}>;
export declare const upsertPromotionsSchema: z.ZodObject<{
    id: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["PERCENT_OFF_ITEM", "FIXED_AMOUNT_OFF_ITEM", "BOGO", "PERCENT_OFF_CART", "FIXED_AMOUNT_OFF_CART", "FREE_SHIPPING", "FREE_PRODUCT"]>>;
    code: z.ZodOptional<z.ZodString>;
    auto_apply: z.ZodOptional<z.ZodBoolean>;
    is_active: z.ZodOptional<z.ZodBoolean>;
    start_date: z.ZodOptional<z.ZodString>;
    end_date: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive"]>>;
    priority: z.ZodOptional<z.ZodNumber>;
    visibility: z.ZodOptional<z.ZodEnum<["public", "private"]>>;
    max_redemptions: z.ZodOptional<z.ZodNumber>;
    per_user_limit: z.ZodOptional<z.ZodNumber>;
    stackable: z.ZodOptional<z.ZodBoolean>;
    budget: z.ZodOptional<z.ZodNumber>;
    timezone: z.ZodOptional<z.ZodString>;
    evaluation_expiry_minutes: z.ZodOptional<z.ZodNumber>;
    discount_type: z.ZodOptional<z.ZodString>;
    discount_value: z.ZodOptional<z.ZodNumber>;
    conditions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        attribute: z.ZodString;
        operator: z.ZodEnum<["GTE", "LTE", "EQ", "IN", "NOT_IN", "CONTAINS"]>;
        value: z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodArray<z.ZodString, "many">]>;
    }, "strip", z.ZodTypeAny, {
        value: string | number | string[];
        attribute: string;
        operator: "GTE" | "LTE" | "EQ" | "IN" | "NOT_IN" | "CONTAINS";
    }, {
        value: string | number | string[];
        attribute: string;
        operator: "GTE" | "LTE" | "EQ" | "IN" | "NOT_IN" | "CONTAINS";
    }>, "many">>;
    actions: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<["PERCENT_OFF", "FIXED_AMOUNT_OFF", "FREE_SHIPPING", "BOGO", "FREE_PRODUCT"]>;
        value: z.ZodUnion<[z.ZodNumber, z.ZodBoolean, z.ZodString]>;
    }, "strip", z.ZodTypeAny, {
        value: string | number | boolean;
        type: "BOGO" | "FREE_SHIPPING" | "FREE_PRODUCT" | "PERCENT_OFF" | "FIXED_AMOUNT_OFF";
    }, {
        value: string | number | boolean;
        type: "BOGO" | "FREE_SHIPPING" | "FREE_PRODUCT" | "PERCENT_OFF" | "FIXED_AMOUNT_OFF";
    }>, "many">>;
}, "strict", z.ZodTypeAny, {
    code?: string | undefined;
    type?: "PERCENT_OFF_ITEM" | "FIXED_AMOUNT_OFF_ITEM" | "BOGO" | "PERCENT_OFF_CART" | "FIXED_AMOUNT_OFF_CART" | "FREE_SHIPPING" | "FREE_PRODUCT" | undefined;
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    id?: number | undefined;
    description?: string | undefined;
    auto_apply?: boolean | undefined;
    is_active?: boolean | undefined;
    start_date?: string | undefined;
    end_date?: string | undefined;
    priority?: number | undefined;
    visibility?: "public" | "private" | undefined;
    max_redemptions?: number | undefined;
    per_user_limit?: number | undefined;
    stackable?: boolean | undefined;
    budget?: number | undefined;
    timezone?: string | undefined;
    evaluation_expiry_minutes?: number | undefined;
    discount_type?: string | undefined;
    discount_value?: number | undefined;
    conditions?: {
        value: string | number | string[];
        attribute: string;
        operator: "GTE" | "LTE" | "EQ" | "IN" | "NOT_IN" | "CONTAINS";
    }[] | undefined;
    actions?: {
        value: string | number | boolean;
        type: "BOGO" | "FREE_SHIPPING" | "FREE_PRODUCT" | "PERCENT_OFF" | "FIXED_AMOUNT_OFF";
    }[] | undefined;
}, {
    code?: string | undefined;
    type?: "PERCENT_OFF_ITEM" | "FIXED_AMOUNT_OFF_ITEM" | "BOGO" | "PERCENT_OFF_CART" | "FIXED_AMOUNT_OFF_CART" | "FREE_SHIPPING" | "FREE_PRODUCT" | undefined;
    status?: "active" | "inactive" | undefined;
    name?: string | undefined;
    id?: number | undefined;
    description?: string | undefined;
    auto_apply?: boolean | undefined;
    is_active?: boolean | undefined;
    start_date?: string | undefined;
    end_date?: string | undefined;
    priority?: number | undefined;
    visibility?: "public" | "private" | undefined;
    max_redemptions?: number | undefined;
    per_user_limit?: number | undefined;
    stackable?: boolean | undefined;
    budget?: number | undefined;
    timezone?: string | undefined;
    evaluation_expiry_minutes?: number | undefined;
    discount_type?: string | undefined;
    discount_value?: number | undefined;
    conditions?: {
        value: string | number | string[];
        attribute: string;
        operator: "GTE" | "LTE" | "EQ" | "IN" | "NOT_IN" | "CONTAINS";
    }[] | undefined;
    actions?: {
        value: string | number | boolean;
        type: "BOGO" | "FREE_SHIPPING" | "FREE_PRODUCT" | "PERCENT_OFF" | "FIXED_AMOUNT_OFF";
    }[] | undefined;
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
    is_active: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodString>;
    priority: z.ZodOptional<z.ZodString>;
    visibility: z.ZodOptional<z.ZodString>;
    stackable: z.ZodOptional<z.ZodString>;
    budget_min: z.ZodOptional<z.ZodString>;
    budget_max: z.ZodOptional<z.ZodString>;
    timezone: z.ZodOptional<z.ZodString>;
    discount_type: z.ZodOptional<z.ZodString>;
    discount_value_min: z.ZodOptional<z.ZodString>;
    discount_value_max: z.ZodOptional<z.ZodString>;
    start_date_after: z.ZodOptional<z.ZodString>;
    start_date_before: z.ZodOptional<z.ZodString>;
    end_date_after: z.ZodOptional<z.ZodString>;
    end_date_before: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    code?: string | undefined;
    type?: string | undefined;
    status?: string | undefined;
    name?: string | undefined;
    auto_apply?: string | undefined;
    is_active?: string | undefined;
    priority?: string | undefined;
    visibility?: string | undefined;
    stackable?: string | undefined;
    timezone?: string | undefined;
    discount_type?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    budget_min?: string | undefined;
    budget_max?: string | undefined;
    discount_value_min?: string | undefined;
    discount_value_max?: string | undefined;
    start_date_after?: string | undefined;
    start_date_before?: string | undefined;
    end_date_after?: string | undefined;
    end_date_before?: string | undefined;
}, {
    code?: string | undefined;
    type?: string | undefined;
    status?: string | undefined;
    name?: string | undefined;
    auto_apply?: string | undefined;
    is_active?: string | undefined;
    priority?: string | undefined;
    visibility?: string | undefined;
    stackable?: string | undefined;
    timezone?: string | undefined;
    discount_type?: string | undefined;
    page?: string | undefined;
    limit?: string | undefined;
    budget_min?: string | undefined;
    budget_max?: string | undefined;
    discount_value_min?: string | undefined;
    discount_value_max?: string | undefined;
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
export declare const lineItemSchema: z.ZodObject<{
    id: z.ZodString;
    sku: z.ZodString;
    quantity: z.ZodNumber;
    price: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    quantity: number;
    price: number;
    sku: string;
}, {
    id: string;
    quantity: number;
    price: number;
    sku: string;
}>;
export declare const userContextSchema: z.ZodObject<{
    user_id: z.ZodString;
    segment_flags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    user_id: string;
    segment_flags?: string[] | undefined;
}, {
    user_id: string;
    segment_flags?: string[] | undefined;
}>;
export declare const cartContextSchema: z.ZodObject<{
    line_items: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        sku: z.ZodString;
        quantity: z.ZodNumber;
        price: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        id: string;
        quantity: number;
        price: number;
        sku: string;
    }, {
        id: string;
        quantity: number;
        price: number;
        sku: string;
    }>, "many">;
    applied_coupon_codes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    line_items: {
        id: string;
        quantity: number;
        price: number;
        sku: string;
    }[];
    applied_coupon_codes?: string[] | undefined;
}, {
    line_items: {
        id: string;
        quantity: number;
        price: number;
        sku: string;
    }[];
    applied_coupon_codes?: string[] | undefined;
}>;
export declare const evaluationContextSchema: z.ZodObject<{
    context: z.ZodObject<{
        channel: z.ZodString;
        geo: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        channel: string;
        geo: string;
    }, {
        channel: string;
        geo: string;
    }>;
    user: z.ZodObject<{
        user_id: z.ZodString;
        segment_flags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        user_id: string;
        segment_flags?: string[] | undefined;
    }, {
        user_id: string;
        segment_flags?: string[] | undefined;
    }>;
    cart: z.ZodObject<{
        line_items: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            sku: z.ZodString;
            quantity: z.ZodNumber;
            price: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            id: string;
            quantity: number;
            price: number;
            sku: string;
        }, {
            id: string;
            quantity: number;
            price: number;
            sku: string;
        }>, "many">;
        applied_coupon_codes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        line_items: {
            id: string;
            quantity: number;
            price: number;
            sku: string;
        }[];
        applied_coupon_codes?: string[] | undefined;
    }, {
        line_items: {
            id: string;
            quantity: number;
            price: number;
            sku: string;
        }[];
        applied_coupon_codes?: string[] | undefined;
    }>;
    payment_method: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    cart: {
        line_items: {
            id: string;
            quantity: number;
            price: number;
            sku: string;
        }[];
        applied_coupon_codes?: string[] | undefined;
    };
    context: {
        channel: string;
        geo: string;
    };
    user: {
        user_id: string;
        segment_flags?: string[] | undefined;
    };
    payment_method?: string | undefined;
}, {
    cart: {
        line_items: {
            id: string;
            quantity: number;
            price: number;
            sku: string;
        }[];
        applied_coupon_codes?: string[] | undefined;
    };
    context: {
        channel: string;
        geo: string;
    };
    user: {
        user_id: string;
        segment_flags?: string[] | undefined;
    };
    payment_method?: string | undefined;
}>;
export declare const appliedPromotionSchema: z.ZodObject<{
    promotion_id: z.ZodNumber;
    promotion_name: z.ZodString;
    discount_amount: z.ZodNumber;
    affected_line_item_ids: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    promotion_id: number;
    discount_amount: number;
    promotion_name: string;
    affected_line_item_ids: string[];
}, {
    promotion_id: number;
    discount_amount: number;
    promotion_name: string;
    affected_line_item_ids: string[];
}>;
export declare const ineligibleCouponSchema: z.ZodObject<{
    coupon_code: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    coupon_code: string;
}, {
    reason: string;
    coupon_code: string;
}>;
export declare const evaluationResultSchema: z.ZodObject<{
    evaluation_id: z.ZodString;
    original_total: z.ZodNumber;
    discounted_total: z.ZodNumber;
    applied_promotions: z.ZodArray<z.ZodObject<{
        promotion_id: z.ZodNumber;
        promotion_name: z.ZodString;
        discount_amount: z.ZodNumber;
        affected_line_item_ids: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        promotion_id: number;
        discount_amount: number;
        promotion_name: string;
        affected_line_item_ids: string[];
    }, {
        promotion_id: number;
        discount_amount: number;
        promotion_name: string;
        affected_line_item_ids: string[];
    }>, "many">;
    ineligible_coupons: z.ZodArray<z.ZodObject<{
        coupon_code: z.ZodString;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        reason: string;
        coupon_code: string;
    }, {
        reason: string;
        coupon_code: string;
    }>, "many">;
    expires_at: z.ZodUnion<[z.ZodEffects<z.ZodBigInt, string, bigint>, z.ZodString, z.ZodEffects<z.ZodNumber, string, number>]>;
}, "strip", z.ZodTypeAny, {
    evaluation_id: string;
    original_total: number;
    discounted_total: number;
    applied_promotions: {
        promotion_id: number;
        discount_amount: number;
        promotion_name: string;
        affected_line_item_ids: string[];
    }[];
    ineligible_coupons: {
        reason: string;
        coupon_code: string;
    }[];
    expires_at: string;
}, {
    evaluation_id: string;
    original_total: number;
    discounted_total: number;
    applied_promotions: {
        promotion_id: number;
        discount_amount: number;
        promotion_name: string;
        affected_line_item_ids: string[];
    }[];
    ineligible_coupons: {
        reason: string;
        coupon_code: string;
    }[];
    expires_at: string | number | bigint;
}>;
export declare const createEvaluationSchema: z.ZodObject<{
    context: z.ZodObject<{
        channel: z.ZodString;
        geo: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        channel: string;
        geo: string;
    }, {
        channel: string;
        geo: string;
    }>;
    user: z.ZodObject<{
        user_id: z.ZodString;
        segment_flags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        user_id: string;
        segment_flags?: string[] | undefined;
    }, {
        user_id: string;
        segment_flags?: string[] | undefined;
    }>;
    cart: z.ZodObject<{
        line_items: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            sku: z.ZodString;
            quantity: z.ZodNumber;
            price: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            id: string;
            quantity: number;
            price: number;
            sku: string;
        }, {
            id: string;
            quantity: number;
            price: number;
            sku: string;
        }>, "many">;
        applied_coupon_codes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        line_items: {
            id: string;
            quantity: number;
            price: number;
            sku: string;
        }[];
        applied_coupon_codes?: string[] | undefined;
    }, {
        line_items: {
            id: string;
            quantity: number;
            price: number;
            sku: string;
        }[];
        applied_coupon_codes?: string[] | undefined;
    }>;
    payment_method: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    cart: {
        line_items: {
            id: string;
            quantity: number;
            price: number;
            sku: string;
        }[];
        applied_coupon_codes?: string[] | undefined;
    };
    context: {
        channel: string;
        geo: string;
    };
    user: {
        user_id: string;
        segment_flags?: string[] | undefined;
    };
    payment_method?: string | undefined;
}, {
    cart: {
        line_items: {
            id: string;
            quantity: number;
            price: number;
            sku: string;
        }[];
        applied_coupon_codes?: string[] | undefined;
    };
    context: {
        channel: string;
        geo: string;
    };
    user: {
        user_id: string;
        segment_flags?: string[] | undefined;
    };
    payment_method?: string | undefined;
}>;
export declare const redemptionRequestSchema: z.ZodObject<{
    evaluation_id: z.ZodString;
    order_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    evaluation_id: string;
    order_id: string;
}, {
    evaluation_id: string;
    order_id: string;
}>;
export declare const redemptionResultSchema: z.ZodObject<{
    redemption_id: z.ZodString;
    evaluation_id: z.ZodString;
    order_id: z.ZodString;
    total_discount: z.ZodNumber;
    applied_promotions: z.ZodArray<z.ZodObject<{
        promotion_id: z.ZodNumber;
        discount_amount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        promotion_id: number;
        discount_amount: number;
    }, {
        promotion_id: number;
        discount_amount: number;
    }>, "many">;
    redeemed_at: z.ZodUnion<[z.ZodEffects<z.ZodBigInt, string, bigint>, z.ZodString, z.ZodEffects<z.ZodNumber, string, number>]>;
}, "strip", z.ZodTypeAny, {
    evaluation_id: string;
    order_id: string;
    redeemed_at: string;
    applied_promotions: {
        promotion_id: number;
        discount_amount: number;
    }[];
    redemption_id: string;
    total_discount: number;
}, {
    evaluation_id: string;
    order_id: string;
    redeemed_at: string | number | bigint;
    applied_promotions: {
        promotion_id: number;
        discount_amount: number;
    }[];
    redemption_id: string;
    total_discount: number;
}>;
export declare const activePromotionsQuerySchema: z.ZodObject<{
    channel: z.ZodOptional<z.ZodString>;
    geo: z.ZodOptional<z.ZodString>;
    scope: z.ZodOptional<z.ZodDefault<z.ZodEnum<["banner", "all"]>>>;
}, "strip", z.ZodTypeAny, {
    channel?: string | undefined;
    geo?: string | undefined;
    scope?: "all" | "banner" | undefined;
}, {
    channel?: string | undefined;
    geo?: string | undefined;
    scope?: "all" | "banner" | undefined;
}>;
export declare const activePromotionSchema: z.ZodObject<{
    id: z.ZodNumber;
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["PERCENT_OFF_ITEM", "FIXED_AMOUNT_OFF_ITEM", "BOGO", "PERCENT_OFF_CART", "FIXED_AMOUNT_OFF_CART", "FREE_SHIPPING", "FREE_PRODUCT"]>;
    priority: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "PERCENT_OFF_ITEM" | "FIXED_AMOUNT_OFF_ITEM" | "BOGO" | "PERCENT_OFF_CART" | "FIXED_AMOUNT_OFF_CART" | "FREE_SHIPPING" | "FREE_PRODUCT";
    name: string;
    id: number;
    priority: number;
    description?: string | undefined;
}, {
    type: "PERCENT_OFF_ITEM" | "FIXED_AMOUNT_OFF_ITEM" | "BOGO" | "PERCENT_OFF_CART" | "FIXED_AMOUNT_OFF_CART" | "FREE_SHIPPING" | "FREE_PRODUCT";
    name: string;
    id: number;
    priority: number;
    description?: string | undefined;
}>;
export type CreatePromotionsInput = z.infer<typeof createPromotionsSchema>;
export type UpdatePromotionsInput = z.infer<typeof updatePromotionsSchema>;
export type UpsertPromotionsInput = z.infer<typeof upsertPromotionsSchema>;
export type PromotionsParams = z.infer<typeof promotionsParamsSchema>;
export type PromotionsQuery = z.infer<typeof promotionsQuerySchema>;
export type PromotionEligibilityInput = z.infer<typeof promotionEligibilitySchema>;
export type PromotionEligibilityQueryInput = z.infer<typeof promotionEligibilityQuerySchema>;
export type Condition = z.infer<typeof conditionSchema>;
export type Action = z.infer<typeof actionSchema>;
export type LineItem = z.infer<typeof lineItemSchema>;
export type UserContext = z.infer<typeof userContextSchema>;
export type CartContext = z.infer<typeof cartContextSchema>;
export type EvaluationContext = z.infer<typeof evaluationContextSchema>;
export type AppliedPromotion = z.infer<typeof appliedPromotionSchema>;
export type IneligibleCoupon = z.infer<typeof ineligibleCouponSchema>;
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
export type RedemptionRequest = z.infer<typeof redemptionRequestSchema>;
export type RedemptionResult = z.infer<typeof redemptionResultSchema>;
export type ActivePromotionsQuery = z.infer<typeof activePromotionsQuerySchema>;
export type ActivePromotion = z.infer<typeof activePromotionSchema>;
//# sourceMappingURL=promotions.schema.d.ts.map