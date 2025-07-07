import { z } from 'zod';

// Validation schema for creating a promotion usage log
export const createPromotionUsageLogSchema = z.object({
  promotion_id: z.number().int().positive().optional(),
  user_id: z.string().optional(),
  order_id: z.string().optional(),
  redemption_date: z.string().datetime().optional(),
  discount_applied: z.number().optional(),
  platform: z.string().optional(),
}).passthrough();

// Validation schema for updating a promotion usage log
export const updatePromotionUsageLogSchema = z.object({
  promotion_id: z.number().int().positive().optional(),
  user_id: z.string().optional(),
  order_id: z.string().optional(),
  redemption_date: z.string().datetime().optional(),
  discount_applied: z.number().optional(),
  platform: z.string().optional(),
}).passthrough();

// Schema for upserting (create or update)
export const upsertPromotionUsageLogSchema = z.object({
  id: z.number().int().optional(),
  promotion_id: z.number().int().positive().optional(),
  user_id: z.string().optional(),
  order_id: z.string().optional(),
  redemption_date: z.string().datetime().optional(),
  discount_applied: z.number().optional(),
  platform: z.string().optional(),
}).passthrough();

// Schema for URL params with ID
export const promotionUsageLogParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a valid integer')
});

// Schema for query parameters
export const promotionUsageLogQuerySchema = z.object({
  // Pagination
  page: z.string().optional(),
  limit: z.string().optional(),
  
  // Filter fields
  promotion_id: z.string().optional(),
  user_id: z.string().optional(),
  order_id: z.string().optional(),
  platform: z.string().optional(),
  discount_applied_min: z.string().optional(),
  discount_applied_max: z.string().optional(),
  redemption_date_after: z.string().optional(),
  redemption_date_before: z.string().optional(),
});

// Export types for use in controllers and services
export type CreatePromotionUsageLogInput = z.infer<typeof createPromotionUsageLogSchema>;
export type UpdatePromotionUsageLogInput = z.infer<typeof updatePromotionUsageLogSchema>;
export type UpsertPromotionUsageLogInput = z.infer<typeof upsertPromotionUsageLogSchema>;
export type PromotionUsageLogParams = z.infer<typeof promotionUsageLogParamsSchema>;
export type PromotionUsageLogQuery = z.infer<typeof promotionUsageLogQuerySchema>; 