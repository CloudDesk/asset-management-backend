import { z } from 'zod';
import { utcTimestampResponseSchema } from './promotions.schema.js';

// Cart item schema
export const cartItemSchema = z.object({
  product_id: z.string(),
  quantity: z.number().positive(),
  base_price: z.number().positive(),
  product_discount: z.number().min(0),
  price: z.number().positive(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  name: z.string().optional(),
});

// Cart data schema
export const cartDataSchema = z.object({
  items: z.array(cartItemSchema),
  subtotal: z.number().positive(),
  shipping_cost: z.number().min(0),
  tax_amount: z.number().min(0),
  total: z.number().positive().optional(),
});

// Context schema
export const contextSchema = z.object({
  channel: z.enum(['web', 'mobile', 'mobile_app']).default('web'),
  geo: z.string().default('IN'),
  payment_method: z.string().optional(),
  user_agent: z.string().optional(),
  ip_address: z.string().optional(),
});

// Evaluation request schema
export const evaluationRequestSchema = z.object({
  cart_id: z.string().optional(),
  user_id: z.string().optional(),
  promotion_id: z.number().positive(),
  cart_data: cartDataSchema,
  context: contextSchema.optional(),
});

// Discount breakdown schema
export const discountBreakdownSchema = z.object({
  item_discounts: z.array(z.object({
    product_id: z.string(),
    original_price: z.number(),
    discounted_price: z.number(),
    discount_amount: z.number(),
  })),
  shipping_discount: z.number().min(0),
  cart_discount: z.number().min(0),
});

// Applied promotion schema
export const appliedPromotionSchema = z.object({
  promotion_id: z.number(),
  promotion_name: z.string(),
  discount_amount: z.number(),
  affected_items: z.array(z.string()),
  discount_breakdown: discountBreakdownSchema,
});

// Ineligible reason schema
export const ineligibleReasonSchema = z.object({
  promotion_id: z.number(),
  reason: z.string(),
  required_value: z.number().optional(),
  current_value: z.number().optional(),
});

// Evaluation response schema
export const evaluationResponseSchema = z.object({
  success: z.boolean(),
  evaluation_id: z.string(),
  original_total: z.number(),
  discounted_total: z.number(),
  total_discount: z.number(),
  applied_promotions: z.array(appliedPromotionSchema),
  ineligible_reasons: z.array(ineligibleReasonSchema),
  expires_at: utcTimestampResponseSchema,
});

// Evaluation result schema (around line 218)
export const evaluationResultSchema = z.object({
  evaluation_id: z.string(),
  user_id: z.string().optional(),
  cart_signature: z.string().optional(),  // Add cart_signature field
  original_total: z.number(),
  discounted_total: z.number(),
  applied_promotions: z.array(appliedPromotionSchema),
  ineligible_coupons: z.array(ineligibleReasonSchema), // Fixed: was ineligibleCouponSchema
  expires_at: utcTimestampResponseSchema
});

// Redemption result schema (around line 240)
export const redemptionResultSchema = z.object({
  redemption_id: z.string(),
  evaluation_id: z.string(),
  order_id: z.string(),
  total_discount: z.number(),
  applied_promotions: z.array(z.object({
    promotion_id: z.number(),
    discount_amount: z.number()
  })),
  redeemed_at: utcTimestampResponseSchema
});

// Type exports
export type CartItem = z.infer<typeof cartItemSchema>;
export type CartData = z.infer<typeof cartDataSchema>;
export type Context = z.infer<typeof contextSchema>;
export type EvaluationRequest = z.infer<typeof evaluationRequestSchema>;
export type DiscountBreakdown = z.infer<typeof discountBreakdownSchema>;
export type AppliedPromotion = z.infer<typeof appliedPromotionSchema>;
export type IneligibleReason = z.infer<typeof ineligibleReasonSchema>;
export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;
export type EvaluationResult = z.infer<typeof evaluationResultSchema>;  // Add this type export
