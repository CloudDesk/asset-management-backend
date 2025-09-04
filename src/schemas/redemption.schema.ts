import { z } from 'zod';

// Redemption request schema
export const redemptionRequestSchema = z.object({
  evaluation_id: z.string().uuid(),
  order_id: z.string(),
  user_id: z.string(),
});

// Redemption detail schema
export const redemptionDetailSchema = z.object({
  promotion_id: z.number(),
  discount_amount: z.number(),
  redeemed_at: z.string(),
});

// Redemption response schema
export const redemptionResponseSchema = z.object({
  success: z.boolean(),
  redemption_id: z.string(),
  order_id: z.string(),
  total_discount_applied: z.number(),
  redemption_details: z.array(redemptionDetailSchema),
});

// Type exports
export type RedemptionRequest = z.infer<typeof redemptionRequestSchema>;
export type RedemptionDetail = z.infer<typeof redemptionDetailSchema>;
export type RedemptionResponse = z.infer<typeof redemptionResponseSchema>;
