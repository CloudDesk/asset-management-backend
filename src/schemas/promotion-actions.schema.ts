import { z } from 'zod';

// Validation schema for creating a promotion action
export const createPromotionActionsSchema = z.object({
  promotion_id: z.number().int().positive().optional(),
  action_type: z.enum(['percentage_discount', 'flat_discount', 'free_product', 'waive_fee']).optional(),
  target: z.string().optional(),
  value_type: z.enum(['percentage', 'currency']).optional(),
  value: z.number().optional(),
  reward_product_id: z.number().int().optional(),
  min_combo_size: z.number().int().optional(),
  apply_to_product_ids: z.array(z.number().int()).optional(),
  max_discount_cap: z.number().optional(),
  check_inventory: z.boolean().optional(),
  execution_group: z.string().optional(),
  action_order: z.number().int().optional(),
}).strict();

// Validation schema for updating a promotion action
export const updatePromotionActionsSchema = z.object({
  promotion_id: z.number().int().positive().optional(),
  action_type: z.enum(['percentage_discount', 'flat_discount', 'free_product', 'waive_fee']).optional(),
  target: z.string().optional(),
  value_type: z.enum(['percentage', 'currency']).optional(),
  value: z.number().optional(),
  reward_product_id: z.number().int().optional(),
  min_combo_size: z.number().int().optional(),
  apply_to_product_ids: z.array(z.number().int()).optional(),
  max_discount_cap: z.number().optional(),
  check_inventory: z.boolean().optional(),
  execution_group: z.string().optional(),
  action_order: z.number().int().optional(),
}).strict();

// Schema for upserting (create or update)
export const upsertPromotionActionsSchema = z.object({
  id: z.number().int().optional(),
  promotion_id: z.number().int().positive().optional(),
  action_type: z.enum(['percentage_discount', 'flat_discount', 'free_product', 'waive_fee']).optional(),
  target: z.string().optional(),
  value_type: z.enum(['percentage', 'currency']).optional(),
  value: z.number().optional(),
  reward_product_id: z.number().int().optional(),
  min_combo_size: z.number().int().optional(),
  apply_to_product_ids: z.array(z.number().int()).optional(),
  max_discount_cap: z.number().optional(),
  check_inventory: z.boolean().optional(),
  execution_group: z.string().optional(),
  action_order: z.number().int().optional(),
}).strict();

// Schema for URL params with ID
export const promotionActionsParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a valid integer')
});

// Schema for query parameters
export const promotionActionsQuerySchema = z.object({
  // Pagination
  page: z.string().optional(),
  limit: z.string().optional(),
  
  // Filter fields
  promotion_id: z.string().optional(),
  action_type: z.string().optional(),
  target: z.string().optional(),
  value_type: z.string().optional(),
  value: z.string().optional(),
  reward_product_id: z.string().optional(),
  min_combo_size: z.string().optional(),
  max_discount_cap: z.string().optional(),
  check_inventory: z.string().optional(),
  execution_group: z.string().optional(),
  action_order: z.string().optional(),
});

// Export types for use in controllers and services
export type CreatePromotionActionsInput = z.infer<typeof createPromotionActionsSchema>;
export type UpdatePromotionActionsInput = z.infer<typeof updatePromotionActionsSchema>;
export type UpsertPromotionActionsInput = z.infer<typeof upsertPromotionActionsSchema>;
export type PromotionActionsParams = z.infer<typeof promotionActionsParamsSchema>;
export type PromotionActionsQuery = z.infer<typeof promotionActionsQuerySchema>; 
