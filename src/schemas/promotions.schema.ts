import { z } from 'zod';

// UTC Timestamp helper schemas for BigInt database fields
export const utcTimestampSchema = z.union([
  z.bigint(),
  z.number().int().positive().transform(val => BigInt(val)),
  z.string().transform(val => BigInt(new Date(val).getTime()))
]);

export const utcTimestampResponseSchema = z.union([
  z.bigint().transform(val => new Date(Number(val)).toISOString()),
  z.string(),
  z.number().transform(val => new Date(val).toISOString())
]);

// Promotion type enum matching functional specification
export const promotionTypeEnum = z.enum([
  'PERCENT_OFF_ITEM',
  'FIXED_AMOUNT_OFF_ITEM', 
  'BOGO',
  'PERCENT_OFF_CART',
  'FIXED_AMOUNT_OFF_CART',
  'FREE_SHIPPING',
  'FREE_PRODUCT'
]);

export const applicableChannelEnum = z.enum(['all', 'web', 'mobile']);
export const promotionApplicationModeEnum = z.enum(['automatic', 'click_to_apply', 'code_entry']);

// Condition object schema
export const conditionSchema = z.object({
  attribute: z.string(), // e.g., "cart.total_value", "user.segment"
  operator: z.enum([
    'GTE',
    'GT',
    'LTE',
    'LT',
    'EQ',
    'IN',
    'NOT_IN',
    'CONTAINS',
    'DATE_ADD_DAYS',
    'DATE_SUBTRACT_DAYS'
  ]),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
  comparison: z.enum(['GTE', 'GT', 'LTE', 'LT', 'EQ']).optional(),
  compare_with: z.string().optional()
});

// Action object schema
export const actionSchema = z.object({
  type: z.enum(['PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FREE_SHIPPING', 'BOGO', 'FREE_PRODUCT']),
  value: z.union([z.number(), z.boolean(), z.string()]) // string for product_id in FREE_PRODUCT
});

// Validation schema for creating a promotion
export const createPromotionsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  type: promotionTypeEnum.optional(),
  code: z.string().optional(), // Coupon code (NULL for automatic promotions)
  auto_apply: z.boolean().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  priority: z.number().int().optional(),
  visibility: z.enum(['public', 'private']).optional(),
  applicable_channel: applicableChannelEnum.default('all').optional(),
  application_mode: promotionApplicationModeEnum.default('click_to_apply').optional(),
  max_redemptions: z.number().int().nullable().optional(),
  per_user_limit: z.number().int().nullable().optional(),
  stackable: z.boolean().optional(),
  budget: z.number().positive().optional(),
  timezone: z.string().optional(),
  evaluation_expiry_minutes: z.number().int().positive().default(15).optional(),
  discount_type: z.string().optional(),
  discount_value: z.number().positive().optional(),
  conditions: z.array(conditionSchema).optional(),
  actions: z.array(actionSchema).optional(),
}).strict();

// Validation schema for updating a promotion
export const updatePromotionsSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  type: promotionTypeEnum.optional(),
  code: z.string().optional(),
  auto_apply: z.boolean().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  priority: z.number().int().optional(),
  visibility: z.enum(['public', 'private']).optional(),
  applicable_channel: applicableChannelEnum.optional(),
  application_mode: promotionApplicationModeEnum.optional(),
  max_redemptions: z.number().int().nullable().optional(),
  per_user_limit: z.number().int().nullable().optional(),
  stackable: z.boolean().optional(),
  budget: z.number().positive().optional(),
  timezone: z.string().optional(),
  evaluation_expiry_minutes: z.number().int().positive().optional(),
  discount_type: z.string().optional(),
  discount_value: z.number().positive().optional(),
  conditions: z.array(conditionSchema).optional(),
  actions: z.array(actionSchema).optional(),
}).strict();

// Schema for upserting (create or update)
export const upsertPromotionsSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  type: promotionTypeEnum.optional(),
  code: z.string().optional(),
  auto_apply: z.boolean().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  priority: z.number().int().optional(),
  visibility: z.enum(['public', 'private']).optional(),
  applicable_channel: applicableChannelEnum.optional(),
  application_mode: promotionApplicationModeEnum.optional(),
  max_redemptions: z.number().int().nullable().optional(),
  per_user_limit: z.number().int().nullable().optional(),
  stackable: z.boolean().optional(),
  budget: z.number().positive().optional(),
  timezone: z.string().optional(),
  evaluation_expiry_minutes: z.number().int().positive().optional(),
  discount_type: z.string().optional(),
  discount_value: z.number().positive().optional(),
  conditions: z.array(conditionSchema).optional(),
  actions: z.array(actionSchema).optional(),
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
  applicable_channel: applicableChannelEnum.optional(),
  stackable: z.string().optional(),
  budget_min: z.string().optional(),
  budget_max: z.string().optional(),
  timezone: z.string().optional(),
  discount_type: z.string().optional(),
  discount_value_min: z.string().optional(),
  discount_value_max: z.string().optional(),
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

// ===== PROMOTION EVALUATION SCHEMAS =====

// Line item schema for cart data
export const lineItemSchema = z.object({
  id: z.string(),
  sku: z.string(),
  quantity: z.number().positive(),
  price: z.number().positive()
});

// User context schema
export const userContextSchema = z.object({
  user_id: z.string(),
  segment_flags: z.array(z.string()).optional()
});

// Cart context schema
export const cartContextSchema = z.object({
  line_items: z.array(lineItemSchema),
  applied_coupon_codes: z.array(z.string()).optional()
});

// Evaluation context schema
export const evaluationContextSchema = z.object({
  context: z.object({
    channel: z.string(),
    geo: z.string()
  }),
  user: userContextSchema,
  cart: cartContextSchema,
  payment_method: z.string().optional()
});

// Applied promotion schema
export const appliedPromotionSchema = z.object({
  promotion_id: z.number(),
  promotion_name: z.string(),
  discount_amount: z.number(),
  affected_line_item_ids: z.array(z.string())
});

// Ineligible coupon schema
export const ineligibleCouponSchema = z.object({
  coupon_code: z.string(),
  reason: z.string()
});

// Evaluation result schema
export const evaluationResultSchema = z.object({
  evaluation_id: z.string(),
  original_total: z.number(),
  discounted_total: z.number(),
  applied_promotions: z.array(appliedPromotionSchema),
  ineligible_coupons: z.array(ineligibleCouponSchema),
  expires_at: utcTimestampResponseSchema
});

// Create evaluation request schema
export const createEvaluationSchema = evaluationContextSchema;

// ===== PROMOTION REDEMPTION SCHEMAS =====

// Redemption request schema
export const redemptionRequestSchema = z.object({
  evaluation_id: z.string(),
  order_id: z.string()
});

// Redemption result schema
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

// ===== ACTIVE PROMOTIONS SCHEMA =====

// Active promotions query schema
export const activePromotionsQuerySchema = z.object({
  channel: z.string().optional(),
  geo: z.string().optional(),
  scope: z.enum(['banner', 'all']).default('banner').optional()
});

// Active promotion response schema
export const activePromotionSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().optional(),
  type: promotionTypeEnum,
  priority: z.number()
});

// Export types for use in controllers and services
export type CreatePromotionsInput = z.infer<typeof createPromotionsSchema>;
export type UpdatePromotionsInput = z.infer<typeof updatePromotionsSchema>;
export type UpsertPromotionsInput = z.infer<typeof upsertPromotionsSchema>;
export type PromotionsParams = z.infer<typeof promotionsParamsSchema>;
export type PromotionsQuery = z.infer<typeof promotionsQuerySchema>;
export type PromotionEligibilityInput = z.infer<typeof promotionEligibilitySchema>;
export type PromotionEligibilityQueryInput = z.infer<typeof promotionEligibilityQuerySchema>;

// New v3 types
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
