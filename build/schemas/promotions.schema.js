import { z } from 'zod';
// Validation schema for creating a promotion
export const createPromotionsSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    type: z.enum(['coupon', 'automatic', 'waive_fee']).optional(),
    code: z.string().optional(),
    auto_apply: z.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    priority: z.number().int().optional(),
    visibility: z.enum(['public', 'private']).optional(),
    max_redemptions: z.number().int().optional(),
    per_user_limit: z.number().int().optional(),
    stackable: z.boolean().optional(),
}).strict();
// Validation schema for updating a promotion
export const updatePromotionsSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    type: z.enum(['coupon', 'automatic', 'waive_fee']).optional(),
    code: z.string().optional(),
    auto_apply: z.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    priority: z.number().int().optional(),
    visibility: z.enum(['public', 'private']).optional(),
    max_redemptions: z.number().int().optional(),
    per_user_limit: z.number().int().optional(),
    stackable: z.boolean().optional(),
}).strict();
// Schema for upserting (create or update)
export const upsertPromotionsSchema = z.object({
    id: z.number().int().optional(),
    name: z.string().min(1).max(255).optional(),
    type: z.enum(['coupon', 'automatic', 'waive_fee']).optional(),
    code: z.string().optional(),
    auto_apply: z.boolean().optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    priority: z.number().int().optional(),
    visibility: z.enum(['public', 'private']).optional(),
    max_redemptions: z.number().int().optional(),
    per_user_limit: z.number().int().optional(),
    stackable: z.boolean().optional(),
}).strict();
// Schema for URL params with ID
export const promotionsParamsSchema = z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a valid integer')
});
// Schema for query parameters
export const promotionsQuerySchema = z.object({
    // Pagination
    page: z.string().optional(),
    limit: z.string().optional(),
    // Filter fields
    name: z.string().optional(),
    type: z.string().optional(),
    code: z.string().optional(),
    auto_apply: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    visibility: z.string().optional(),
    stackable: z.string().optional(),
    start_date_after: z.string().optional(),
    start_date_before: z.string().optional(),
    end_date_after: z.string().optional(),
    end_date_before: z.string().optional(),
});
// Schema for eligibility check request
export const promotionEligibilitySchema = z.object({
    user_id: z.string().min(1, 'User ID is required'),
    cart: z.array(z.object({
        product_id: z.number().int().positive('Product ID must be positive'),
        quantity: z.number().int().positive('Quantity must be positive')
    })).min(1, 'Cart must contain at least one item'),
    platform: z.string().min(1, 'Platform is required'),
    payment_method: z.string().optional(),
    order_date: z.string().datetime().optional(),
}).strict();
//# sourceMappingURL=promotions.schema.js.map