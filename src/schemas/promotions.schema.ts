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
  user_id: z.string(),
  platform: z.string(),
  cart: z.array(z.object({
    product_id: z.string(),
    quantity: z.number(),
    price: z.number()
  })).optional(),
  code: z.string().optional(),
  order_date: z.string().optional(),
  payment_method: z.string().optional()

});

// Schema for query parameters
export const promotionEligibilityQuerySchema = z.object({
  user_id: z.string(),
  platform: z.string(),
  code: z.string().optional()
});

// Export types for use in controllers and services
export type CreatePromotionsInput = z.infer<typeof createPromotionsSchema>;
export type UpdatePromotionsInput = z.infer<typeof updatePromotionsSchema>;
export type UpsertPromotionsInput = z.infer<typeof upsertPromotionsSchema>;
export type PromotionsParams = z.infer<typeof promotionsParamsSchema>;
export type PromotionsQuery = z.infer<typeof promotionsQuerySchema>;
export type PromotionEligibilityInput = z.infer<typeof promotionEligibilitySchema>;
export type PromotionEligibilityQueryInput = z.infer<typeof promotionEligibilityQuerySchema>; 
