import { z } from 'zod';

// Validation schema for creating a promotion rule
export const createPromotionRulesSchema = z.object({
  promotion_id: z.number().int().positive().optional(),
  rule_type: z.enum(['user', 'product', 'cart', 'payment']).optional(),
  condition_key: z.string().optional(),
  operator: z.string().optional(),
  value: z.string().optional(),
  value_type: z.enum(['string', 'number', 'currency']).optional(),
  logic_group: z.string().optional(),
  priority: z.number().int().optional(),
  exclude: z.boolean().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().optional(),
}).strict();

// Validation schema for updating a promotion rule
export const updatePromotionRulesSchema = z.object({
  promotion_id: z.number().int().positive().optional(),
  rule_type: z.enum(['user', 'product', 'cart', 'payment']).optional(),
  condition_key: z.string().optional(),
  operator: z.string().optional(),
  value: z.string().optional(),
  value_type: z.enum(['string', 'number', 'currency']).optional(),
  logic_group: z.string().optional(),
  priority: z.number().int().optional(),
  exclude: z.boolean().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().optional(),
}).strict();

// Schema for upserting (create or update)
export const upsertPromotionRulesSchema = z.object({
  id: z.number().int().optional(),
  promotion_id: z.number().int().positive().optional(),
  rule_type: z.enum(['user', 'product', 'cart', 'payment']).optional(),
  condition_key: z.string().optional(),
  operator: z.string().optional(),
  value: z.string().optional(),
  value_type: z.enum(['string', 'number', 'currency']).optional(),
  logic_group: z.string().optional(),
  priority: z.number().int().optional(),
  exclude: z.boolean().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().optional(),
}).strict();

// Schema for URL params with ID
export const promotionRulesParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a valid integer')
});

// Schema for query parameters
export const promotionRulesQuerySchema = z.object({
  // Pagination
  page: z.string().optional(),
  limit: z.string().optional(),
  
  // Filter fields
  promotion_id: z.string().optional(),
  rule_type: z.string().optional(),
  condition_key: z.string().optional(),
  operator: z.string().optional(),
  value: z.string().optional(),
  value_type: z.string().optional(),
  logic_group: z.string().optional(),
  priority: z.string().optional(),
  exclude: z.string().optional(),
  is_active: z.string().optional(),
});

// Export types for use in controllers and services
export type CreatePromotionRulesInput = z.infer<typeof createPromotionRulesSchema>;
export type UpdatePromotionRulesInput = z.infer<typeof updatePromotionRulesSchema>;
export type UpsertPromotionRulesInput = z.infer<typeof upsertPromotionRulesSchema>;
export type PromotionRulesParams = z.infer<typeof promotionRulesParamsSchema>;
export type PromotionRulesQuery = z.infer<typeof promotionRulesQuerySchema>; 
