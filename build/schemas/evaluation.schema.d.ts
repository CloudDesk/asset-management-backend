import { z } from 'zod';
export declare const cartItemSchema: z.ZodObject<{
    product_id: z.ZodString;
    quantity: z.ZodNumber;
    base_price: z.ZodNumber;
    product_discount: z.ZodNumber;
    price: z.ZodNumber;
    category: z.ZodOptional<z.ZodString>;
    subcategory: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    price: number;
    quantity: number;
    product_id: string;
    base_price: number;
    product_discount: number;
    name?: string | undefined;
    category?: string | undefined;
    subcategory?: string | undefined;
}, {
    price: number;
    quantity: number;
    product_id: string;
    base_price: number;
    product_discount: number;
    name?: string | undefined;
    category?: string | undefined;
    subcategory?: string | undefined;
}>;
export declare const cartDataSchema: z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        product_id: z.ZodString;
        quantity: z.ZodNumber;
        base_price: z.ZodNumber;
        product_discount: z.ZodNumber;
        price: z.ZodNumber;
        category: z.ZodOptional<z.ZodString>;
        subcategory: z.ZodOptional<z.ZodString>;
        name: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        price: number;
        quantity: number;
        product_id: string;
        base_price: number;
        product_discount: number;
        name?: string | undefined;
        category?: string | undefined;
        subcategory?: string | undefined;
    }, {
        price: number;
        quantity: number;
        product_id: string;
        base_price: number;
        product_discount: number;
        name?: string | undefined;
        category?: string | undefined;
        subcategory?: string | undefined;
    }>, "many">;
    subtotal: z.ZodNumber;
    shipping_cost: z.ZodNumber;
    tax_amount: z.ZodNumber;
    total: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    shipping_cost: number;
    tax_amount: number;
    subtotal: number;
    items: {
        price: number;
        quantity: number;
        product_id: string;
        base_price: number;
        product_discount: number;
        name?: string | undefined;
        category?: string | undefined;
        subcategory?: string | undefined;
    }[];
    total?: number | undefined;
}, {
    shipping_cost: number;
    tax_amount: number;
    subtotal: number;
    items: {
        price: number;
        quantity: number;
        product_id: string;
        base_price: number;
        product_discount: number;
        name?: string | undefined;
        category?: string | undefined;
        subcategory?: string | undefined;
    }[];
    total?: number | undefined;
}>;
export declare const contextSchema: z.ZodObject<{
    channel: z.ZodDefault<z.ZodEnum<["web", "mobile", "mobile_app"]>>;
    geo: z.ZodDefault<z.ZodString>;
    payment_method: z.ZodOptional<z.ZodString>;
    user_agent: z.ZodOptional<z.ZodString>;
    ip_address: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    channel: "mobile" | "web" | "mobile_app";
    geo: string;
    payment_method?: string | undefined;
    user_agent?: string | undefined;
    ip_address?: string | undefined;
}, {
    payment_method?: string | undefined;
    channel?: "mobile" | "web" | "mobile_app" | undefined;
    geo?: string | undefined;
    user_agent?: string | undefined;
    ip_address?: string | undefined;
}>;
export declare const evaluationRequestSchema: z.ZodObject<{
    cart_id: z.ZodOptional<z.ZodString>;
    user_id: z.ZodOptional<z.ZodString>;
    promotion_id: z.ZodNumber;
    cart_data: z.ZodObject<{
        items: z.ZodArray<z.ZodObject<{
            product_id: z.ZodString;
            quantity: z.ZodNumber;
            base_price: z.ZodNumber;
            product_discount: z.ZodNumber;
            price: z.ZodNumber;
            category: z.ZodOptional<z.ZodString>;
            subcategory: z.ZodOptional<z.ZodString>;
            name: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            price: number;
            quantity: number;
            product_id: string;
            base_price: number;
            product_discount: number;
            name?: string | undefined;
            category?: string | undefined;
            subcategory?: string | undefined;
        }, {
            price: number;
            quantity: number;
            product_id: string;
            base_price: number;
            product_discount: number;
            name?: string | undefined;
            category?: string | undefined;
            subcategory?: string | undefined;
        }>, "many">;
        subtotal: z.ZodNumber;
        shipping_cost: z.ZodNumber;
        tax_amount: z.ZodNumber;
        total: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        shipping_cost: number;
        tax_amount: number;
        subtotal: number;
        items: {
            price: number;
            quantity: number;
            product_id: string;
            base_price: number;
            product_discount: number;
            name?: string | undefined;
            category?: string | undefined;
            subcategory?: string | undefined;
        }[];
        total?: number | undefined;
    }, {
        shipping_cost: number;
        tax_amount: number;
        subtotal: number;
        items: {
            price: number;
            quantity: number;
            product_id: string;
            base_price: number;
            product_discount: number;
            name?: string | undefined;
            category?: string | undefined;
            subcategory?: string | undefined;
        }[];
        total?: number | undefined;
    }>;
    context: z.ZodOptional<z.ZodObject<{
        channel: z.ZodDefault<z.ZodEnum<["web", "mobile", "mobile_app"]>>;
        geo: z.ZodDefault<z.ZodString>;
        payment_method: z.ZodOptional<z.ZodString>;
        user_agent: z.ZodOptional<z.ZodString>;
        ip_address: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        channel: "mobile" | "web" | "mobile_app";
        geo: string;
        payment_method?: string | undefined;
        user_agent?: string | undefined;
        ip_address?: string | undefined;
    }, {
        payment_method?: string | undefined;
        channel?: "mobile" | "web" | "mobile_app" | undefined;
        geo?: string | undefined;
        user_agent?: string | undefined;
        ip_address?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    promotion_id: number;
    cart_data: {
        shipping_cost: number;
        tax_amount: number;
        subtotal: number;
        items: {
            price: number;
            quantity: number;
            product_id: string;
            base_price: number;
            product_discount: number;
            name?: string | undefined;
            category?: string | undefined;
            subcategory?: string | undefined;
        }[];
        total?: number | undefined;
    };
    user_id?: string | undefined;
    context?: {
        channel: "mobile" | "web" | "mobile_app";
        geo: string;
        payment_method?: string | undefined;
        user_agent?: string | undefined;
        ip_address?: string | undefined;
    } | undefined;
    cart_id?: string | undefined;
}, {
    promotion_id: number;
    cart_data: {
        shipping_cost: number;
        tax_amount: number;
        subtotal: number;
        items: {
            price: number;
            quantity: number;
            product_id: string;
            base_price: number;
            product_discount: number;
            name?: string | undefined;
            category?: string | undefined;
            subcategory?: string | undefined;
        }[];
        total?: number | undefined;
    };
    user_id?: string | undefined;
    context?: {
        payment_method?: string | undefined;
        channel?: "mobile" | "web" | "mobile_app" | undefined;
        geo?: string | undefined;
        user_agent?: string | undefined;
        ip_address?: string | undefined;
    } | undefined;
    cart_id?: string | undefined;
}>;
export declare const discountBreakdownSchema: z.ZodObject<{
    item_discounts: z.ZodArray<z.ZodObject<{
        product_id: z.ZodString;
        original_price: z.ZodNumber;
        discounted_price: z.ZodNumber;
        discount_amount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        original_price: number;
        discount_amount: number;
        product_id: string;
        discounted_price: number;
    }, {
        original_price: number;
        discount_amount: number;
        product_id: string;
        discounted_price: number;
    }>, "many">;
    shipping_discount: z.ZodNumber;
    cart_discount: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    item_discounts: {
        original_price: number;
        discount_amount: number;
        product_id: string;
        discounted_price: number;
    }[];
    shipping_discount: number;
    cart_discount: number;
}, {
    item_discounts: {
        original_price: number;
        discount_amount: number;
        product_id: string;
        discounted_price: number;
    }[];
    shipping_discount: number;
    cart_discount: number;
}>;
export declare const bogoDetailsSchema: z.ZodObject<{
    buy_quantity: z.ZodNumber;
    get_quantity: z.ZodNumber;
    affected_products: z.ZodArray<z.ZodString, "many">;
    free_items_count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    buy_quantity: number;
    get_quantity: number;
    affected_products: string[];
    free_items_count: number;
}, {
    buy_quantity: number;
    get_quantity: number;
    affected_products: string[];
    free_items_count: number;
}>;
export declare const freeProductDetailsSchema: z.ZodObject<{
    free_product_id: z.ZodString;
    max_free_items: z.ZodNumber;
    granted_items_count: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    free_product_id: string;
    max_free_items: number;
    granted_items_count: number;
}, {
    free_product_id: string;
    max_free_items: number;
    granted_items_count: number;
}>;
export declare const appliedPromotionSchema: z.ZodObject<{
    promotion_id: z.ZodNumber;
    promotion_name: z.ZodString;
    promotion_type: z.ZodString;
    discount_amount: z.ZodNumber;
    is_auto: z.ZodBoolean;
    is_free_shipping: z.ZodBoolean;
    is_stacked: z.ZodOptional<z.ZodBoolean>;
    bogo_details: z.ZodOptional<z.ZodObject<{
        buy_quantity: z.ZodNumber;
        get_quantity: z.ZodNumber;
        affected_products: z.ZodArray<z.ZodString, "many">;
        free_items_count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        buy_quantity: number;
        get_quantity: number;
        affected_products: string[];
        free_items_count: number;
    }, {
        buy_quantity: number;
        get_quantity: number;
        affected_products: string[];
        free_items_count: number;
    }>>;
    free_product_details: z.ZodOptional<z.ZodObject<{
        free_product_id: z.ZodString;
        max_free_items: z.ZodNumber;
        granted_items_count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        free_product_id: string;
        max_free_items: number;
        granted_items_count: number;
    }, {
        free_product_id: string;
        max_free_items: number;
        granted_items_count: number;
    }>>;
    affected_items: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    discount_breakdown: z.ZodOptional<z.ZodObject<{
        item_discounts: z.ZodArray<z.ZodObject<{
            product_id: z.ZodString;
            original_price: z.ZodNumber;
            discounted_price: z.ZodNumber;
            discount_amount: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            original_price: number;
            discount_amount: number;
            product_id: string;
            discounted_price: number;
        }, {
            original_price: number;
            discount_amount: number;
            product_id: string;
            discounted_price: number;
        }>, "many">;
        shipping_discount: z.ZodNumber;
        cart_discount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        item_discounts: {
            original_price: number;
            discount_amount: number;
            product_id: string;
            discounted_price: number;
        }[];
        shipping_discount: number;
        cart_discount: number;
    }, {
        item_discounts: {
            original_price: number;
            discount_amount: number;
            product_id: string;
            discounted_price: number;
        }[];
        shipping_discount: number;
        cart_discount: number;
    }>>;
    breakdown: z.ZodOptional<z.ZodObject<{
        item_discounts: z.ZodArray<z.ZodObject<{
            product_id: z.ZodString;
            original_price: z.ZodNumber;
            discounted_price: z.ZodNumber;
            discount_amount: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            original_price: number;
            discount_amount: number;
            product_id: string;
            discounted_price: number;
        }, {
            original_price: number;
            discount_amount: number;
            product_id: string;
            discounted_price: number;
        }>, "many">;
        shipping_discount: z.ZodNumber;
        cart_discount: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        item_discounts: {
            original_price: number;
            discount_amount: number;
            product_id: string;
            discounted_price: number;
        }[];
        shipping_discount: number;
        cart_discount: number;
    }, {
        item_discounts: {
            original_price: number;
            discount_amount: number;
            product_id: string;
            discounted_price: number;
        }[];
        shipping_discount: number;
        cart_discount: number;
    }>>;
    is_shipping_discount: z.ZodOptional<z.ZodBoolean>;
    shipping_info: z.ZodOptional<z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    promotion_id: number;
    discount_amount: number;
    promotion_name: string;
    promotion_type: string;
    is_auto: boolean;
    is_free_shipping: boolean;
    is_stacked?: boolean | undefined;
    bogo_details?: {
        buy_quantity: number;
        get_quantity: number;
        affected_products: string[];
        free_items_count: number;
    } | undefined;
    free_product_details?: {
        free_product_id: string;
        max_free_items: number;
        granted_items_count: number;
    } | undefined;
    affected_items?: string[] | undefined;
    discount_breakdown?: {
        item_discounts: {
            original_price: number;
            discount_amount: number;
            product_id: string;
            discounted_price: number;
        }[];
        shipping_discount: number;
        cart_discount: number;
    } | undefined;
    breakdown?: {
        item_discounts: {
            original_price: number;
            discount_amount: number;
            product_id: string;
            discounted_price: number;
        }[];
        shipping_discount: number;
        cart_discount: number;
    } | undefined;
    is_shipping_discount?: boolean | undefined;
    shipping_info?: any;
}, {
    promotion_id: number;
    discount_amount: number;
    promotion_name: string;
    promotion_type: string;
    is_auto: boolean;
    is_free_shipping: boolean;
    is_stacked?: boolean | undefined;
    bogo_details?: {
        buy_quantity: number;
        get_quantity: number;
        affected_products: string[];
        free_items_count: number;
    } | undefined;
    free_product_details?: {
        free_product_id: string;
        max_free_items: number;
        granted_items_count: number;
    } | undefined;
    affected_items?: string[] | undefined;
    discount_breakdown?: {
        item_discounts: {
            original_price: number;
            discount_amount: number;
            product_id: string;
            discounted_price: number;
        }[];
        shipping_discount: number;
        cart_discount: number;
    } | undefined;
    breakdown?: {
        item_discounts: {
            original_price: number;
            discount_amount: number;
            product_id: string;
            discounted_price: number;
        }[];
        shipping_discount: number;
        cart_discount: number;
    } | undefined;
    is_shipping_discount?: boolean | undefined;
    shipping_info?: any;
}>;
export declare const ineligibleReasonSchema: z.ZodObject<{
    promotion_id: z.ZodNumber;
    reason: z.ZodString;
    required_value: z.ZodOptional<z.ZodNumber>;
    current_value: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    promotion_id: number;
    reason: string;
    required_value?: number | undefined;
    current_value?: number | undefined;
}, {
    promotion_id: number;
    reason: string;
    required_value?: number | undefined;
    current_value?: number | undefined;
}>;
export declare const evaluationResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    evaluation_id: z.ZodString;
    original_total: z.ZodNumber;
    discounted_total: z.ZodNumber;
    total_discount: z.ZodNumber;
    applied_promotions: z.ZodArray<z.ZodObject<{
        promotion_id: z.ZodNumber;
        promotion_name: z.ZodString;
        promotion_type: z.ZodString;
        discount_amount: z.ZodNumber;
        is_auto: z.ZodBoolean;
        is_free_shipping: z.ZodBoolean;
        is_stacked: z.ZodOptional<z.ZodBoolean>;
        bogo_details: z.ZodOptional<z.ZodObject<{
            buy_quantity: z.ZodNumber;
            get_quantity: z.ZodNumber;
            affected_products: z.ZodArray<z.ZodString, "many">;
            free_items_count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            buy_quantity: number;
            get_quantity: number;
            affected_products: string[];
            free_items_count: number;
        }, {
            buy_quantity: number;
            get_quantity: number;
            affected_products: string[];
            free_items_count: number;
        }>>;
        free_product_details: z.ZodOptional<z.ZodObject<{
            free_product_id: z.ZodString;
            max_free_items: z.ZodNumber;
            granted_items_count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            free_product_id: string;
            max_free_items: number;
            granted_items_count: number;
        }, {
            free_product_id: string;
            max_free_items: number;
            granted_items_count: number;
        }>>;
        affected_items: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        discount_breakdown: z.ZodOptional<z.ZodObject<{
            item_discounts: z.ZodArray<z.ZodObject<{
                product_id: z.ZodString;
                original_price: z.ZodNumber;
                discounted_price: z.ZodNumber;
                discount_amount: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }, {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }>, "many">;
            shipping_discount: z.ZodNumber;
            cart_discount: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        }, {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        }>>;
        breakdown: z.ZodOptional<z.ZodObject<{
            item_discounts: z.ZodArray<z.ZodObject<{
                product_id: z.ZodString;
                original_price: z.ZodNumber;
                discounted_price: z.ZodNumber;
                discount_amount: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }, {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }>, "many">;
            shipping_discount: z.ZodNumber;
            cart_discount: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        }, {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        }>>;
        is_shipping_discount: z.ZodOptional<z.ZodBoolean>;
        shipping_info: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        promotion_id: number;
        discount_amount: number;
        promotion_name: string;
        promotion_type: string;
        is_auto: boolean;
        is_free_shipping: boolean;
        is_stacked?: boolean | undefined;
        bogo_details?: {
            buy_quantity: number;
            get_quantity: number;
            affected_products: string[];
            free_items_count: number;
        } | undefined;
        free_product_details?: {
            free_product_id: string;
            max_free_items: number;
            granted_items_count: number;
        } | undefined;
        affected_items?: string[] | undefined;
        discount_breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        is_shipping_discount?: boolean | undefined;
        shipping_info?: any;
    }, {
        promotion_id: number;
        discount_amount: number;
        promotion_name: string;
        promotion_type: string;
        is_auto: boolean;
        is_free_shipping: boolean;
        is_stacked?: boolean | undefined;
        bogo_details?: {
            buy_quantity: number;
            get_quantity: number;
            affected_products: string[];
            free_items_count: number;
        } | undefined;
        free_product_details?: {
            free_product_id: string;
            max_free_items: number;
            granted_items_count: number;
        } | undefined;
        affected_items?: string[] | undefined;
        discount_breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        is_shipping_discount?: boolean | undefined;
        shipping_info?: any;
    }>, "many">;
    ineligible_reasons: z.ZodArray<z.ZodObject<{
        promotion_id: z.ZodNumber;
        reason: z.ZodString;
        required_value: z.ZodOptional<z.ZodNumber>;
        current_value: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        promotion_id: number;
        reason: string;
        required_value?: number | undefined;
        current_value?: number | undefined;
    }, {
        promotion_id: number;
        reason: string;
        required_value?: number | undefined;
        current_value?: number | undefined;
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
        promotion_type: string;
        is_auto: boolean;
        is_free_shipping: boolean;
        is_stacked?: boolean | undefined;
        bogo_details?: {
            buy_quantity: number;
            get_quantity: number;
            affected_products: string[];
            free_items_count: number;
        } | undefined;
        free_product_details?: {
            free_product_id: string;
            max_free_items: number;
            granted_items_count: number;
        } | undefined;
        affected_items?: string[] | undefined;
        discount_breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        is_shipping_discount?: boolean | undefined;
        shipping_info?: any;
    }[];
    expires_at: string;
    success: boolean;
    total_discount: number;
    ineligible_reasons: {
        promotion_id: number;
        reason: string;
        required_value?: number | undefined;
        current_value?: number | undefined;
    }[];
}, {
    evaluation_id: string;
    original_total: number;
    discounted_total: number;
    applied_promotions: {
        promotion_id: number;
        discount_amount: number;
        promotion_name: string;
        promotion_type: string;
        is_auto: boolean;
        is_free_shipping: boolean;
        is_stacked?: boolean | undefined;
        bogo_details?: {
            buy_quantity: number;
            get_quantity: number;
            affected_products: string[];
            free_items_count: number;
        } | undefined;
        free_product_details?: {
            free_product_id: string;
            max_free_items: number;
            granted_items_count: number;
        } | undefined;
        affected_items?: string[] | undefined;
        discount_breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        is_shipping_discount?: boolean | undefined;
        shipping_info?: any;
    }[];
    expires_at: string | number | bigint;
    success: boolean;
    total_discount: number;
    ineligible_reasons: {
        promotion_id: number;
        reason: string;
        required_value?: number | undefined;
        current_value?: number | undefined;
    }[];
}>;
export declare const evaluationResultSchema: z.ZodObject<{
    evaluation_id: z.ZodString;
    user_id: z.ZodOptional<z.ZodString>;
    cart_signature: z.ZodOptional<z.ZodString>;
    original_total: z.ZodNumber;
    discounted_total: z.ZodNumber;
    applied_promotions: z.ZodArray<z.ZodObject<{
        promotion_id: z.ZodNumber;
        promotion_name: z.ZodString;
        promotion_type: z.ZodString;
        discount_amount: z.ZodNumber;
        is_auto: z.ZodBoolean;
        is_free_shipping: z.ZodBoolean;
        is_stacked: z.ZodOptional<z.ZodBoolean>;
        bogo_details: z.ZodOptional<z.ZodObject<{
            buy_quantity: z.ZodNumber;
            get_quantity: z.ZodNumber;
            affected_products: z.ZodArray<z.ZodString, "many">;
            free_items_count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            buy_quantity: number;
            get_quantity: number;
            affected_products: string[];
            free_items_count: number;
        }, {
            buy_quantity: number;
            get_quantity: number;
            affected_products: string[];
            free_items_count: number;
        }>>;
        free_product_details: z.ZodOptional<z.ZodObject<{
            free_product_id: z.ZodString;
            max_free_items: z.ZodNumber;
            granted_items_count: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            free_product_id: string;
            max_free_items: number;
            granted_items_count: number;
        }, {
            free_product_id: string;
            max_free_items: number;
            granted_items_count: number;
        }>>;
        affected_items: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        discount_breakdown: z.ZodOptional<z.ZodObject<{
            item_discounts: z.ZodArray<z.ZodObject<{
                product_id: z.ZodString;
                original_price: z.ZodNumber;
                discounted_price: z.ZodNumber;
                discount_amount: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }, {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }>, "many">;
            shipping_discount: z.ZodNumber;
            cart_discount: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        }, {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        }>>;
        breakdown: z.ZodOptional<z.ZodObject<{
            item_discounts: z.ZodArray<z.ZodObject<{
                product_id: z.ZodString;
                original_price: z.ZodNumber;
                discounted_price: z.ZodNumber;
                discount_amount: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }, {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }>, "many">;
            shipping_discount: z.ZodNumber;
            cart_discount: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        }, {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        }>>;
        is_shipping_discount: z.ZodOptional<z.ZodBoolean>;
        shipping_info: z.ZodOptional<z.ZodAny>;
    }, "strip", z.ZodTypeAny, {
        promotion_id: number;
        discount_amount: number;
        promotion_name: string;
        promotion_type: string;
        is_auto: boolean;
        is_free_shipping: boolean;
        is_stacked?: boolean | undefined;
        bogo_details?: {
            buy_quantity: number;
            get_quantity: number;
            affected_products: string[];
            free_items_count: number;
        } | undefined;
        free_product_details?: {
            free_product_id: string;
            max_free_items: number;
            granted_items_count: number;
        } | undefined;
        affected_items?: string[] | undefined;
        discount_breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        is_shipping_discount?: boolean | undefined;
        shipping_info?: any;
    }, {
        promotion_id: number;
        discount_amount: number;
        promotion_name: string;
        promotion_type: string;
        is_auto: boolean;
        is_free_shipping: boolean;
        is_stacked?: boolean | undefined;
        bogo_details?: {
            buy_quantity: number;
            get_quantity: number;
            affected_products: string[];
            free_items_count: number;
        } | undefined;
        free_product_details?: {
            free_product_id: string;
            max_free_items: number;
            granted_items_count: number;
        } | undefined;
        affected_items?: string[] | undefined;
        discount_breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        is_shipping_discount?: boolean | undefined;
        shipping_info?: any;
    }>, "many">;
    ineligible_coupons: z.ZodArray<z.ZodObject<{
        promotion_id: z.ZodNumber;
        reason: z.ZodString;
        required_value: z.ZodOptional<z.ZodNumber>;
        current_value: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        promotion_id: number;
        reason: string;
        required_value?: number | undefined;
        current_value?: number | undefined;
    }, {
        promotion_id: number;
        reason: string;
        required_value?: number | undefined;
        current_value?: number | undefined;
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
        promotion_type: string;
        is_auto: boolean;
        is_free_shipping: boolean;
        is_stacked?: boolean | undefined;
        bogo_details?: {
            buy_quantity: number;
            get_quantity: number;
            affected_products: string[];
            free_items_count: number;
        } | undefined;
        free_product_details?: {
            free_product_id: string;
            max_free_items: number;
            granted_items_count: number;
        } | undefined;
        affected_items?: string[] | undefined;
        discount_breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        is_shipping_discount?: boolean | undefined;
        shipping_info?: any;
    }[];
    ineligible_coupons: {
        promotion_id: number;
        reason: string;
        required_value?: number | undefined;
        current_value?: number | undefined;
    }[];
    expires_at: string;
    user_id?: string | undefined;
    cart_signature?: string | undefined;
}, {
    evaluation_id: string;
    original_total: number;
    discounted_total: number;
    applied_promotions: {
        promotion_id: number;
        discount_amount: number;
        promotion_name: string;
        promotion_type: string;
        is_auto: boolean;
        is_free_shipping: boolean;
        is_stacked?: boolean | undefined;
        bogo_details?: {
            buy_quantity: number;
            get_quantity: number;
            affected_products: string[];
            free_items_count: number;
        } | undefined;
        free_product_details?: {
            free_product_id: string;
            max_free_items: number;
            granted_items_count: number;
        } | undefined;
        affected_items?: string[] | undefined;
        discount_breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        breakdown?: {
            item_discounts: {
                original_price: number;
                discount_amount: number;
                product_id: string;
                discounted_price: number;
            }[];
            shipping_discount: number;
            cart_discount: number;
        } | undefined;
        is_shipping_discount?: boolean | undefined;
        shipping_info?: any;
    }[];
    ineligible_coupons: {
        promotion_id: number;
        reason: string;
        required_value?: number | undefined;
        current_value?: number | undefined;
    }[];
    expires_at: string | number | bigint;
    user_id?: string | undefined;
    cart_signature?: string | undefined;
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
export type CartItem = z.infer<typeof cartItemSchema>;
export type CartData = z.infer<typeof cartDataSchema>;
export type Context = z.infer<typeof contextSchema>;
export type EvaluationRequest = z.infer<typeof evaluationRequestSchema>;
export type DiscountBreakdown = z.infer<typeof discountBreakdownSchema>;
export type BogoDetails = z.infer<typeof bogoDetailsSchema>;
export type FreeProductDetails = z.infer<typeof freeProductDetailsSchema>;
export type AppliedPromotion = z.infer<typeof appliedPromotionSchema>;
export type IneligibleReason = z.infer<typeof ineligibleReasonSchema>;
export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;
//# sourceMappingURL=evaluation.schema.d.ts.map