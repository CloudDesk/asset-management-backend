import { z } from 'zod';

export const PROMOTION_SCHEMA_VERSION = 2 as const;

export const PromotionFacetSchema = z.enum([
  'PRODUCT',
  'CATEGORY',
  'SUBCATEGORY',
  // Future facets retained but intentionally disabled by the approved scope:
  // 'FRAGRANCE',
  // 'BRAND',
  // 'COLLECTION',
  // 'TAG',
  // 'SUBSUBCATEGORY',
  'ENTIRE_CART',
]);

export const PromotionScopeGroupSchema = z.object({
  facet: PromotionFacetSchema,
  values: z.array(z.string().trim().min(1)).min(1),
}).superRefine((group, context) => {
  if (group.facet === 'ENTIRE_CART' && !group.values.includes('*')) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'ENTIRE_CART must use the value "*"' });
  }
});

export const PromotionScopeSchema = z.object({
  include: z.array(PromotionScopeGroupSchema).default([{ facet: 'ENTIRE_CART', values: ['*'] }]),
  exclude: z.array(PromotionScopeGroupSchema).default([]),
  group_operator: z.enum(['AND', 'OR']).default('OR'),
});

export const PromotionBenefitSchema = z.object({
  type: z.enum(['PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FREE_ITEM', 'FREE_SHIPPING']),
  value: z.number().nonnegative().optional(),
  quantity: z.number().int().positive().optional(),
  target: z.enum([
    'ALL_QUALIFYING_UNITS',
    'PAID_QUALIFYING_UNITS',
    'CHEAPEST_QUALIFYING_UNIT',
    'MOST_EXPENSIVE_QUALIFYING_UNIT',
    'SAME_PRODUCT_AS_QUALIFIER',
    'SPECIFIC_PRODUCTS',
    'CUSTOMER_SELECTED_REWARD_GROUP',
  ]).default('ALL_QUALIFYING_UNITS'),
  product_ids: z.array(z.string().trim().min(1)).optional(),
  reward_group: z.array(z.string().trim().min(1)).optional(),
  fulfilment: z.enum(['AUTO_ADD', 'DISCOUNT_EXISTING']).default('AUTO_ADD'),
  out_of_stock_policy: z.enum([
    'REMOVE_PROMOTION',
    'NEXT_CONFIGURED_GIFT',
    'CUSTOMER_SELECTS_ALTERNATIVE',
    'CONVERT_TO_DISCOUNT',
  ]).default('REMOVE_PROMOTION'),
  fallback_discount_amount: z.number().int().nonnegative().optional(),
  return_policy: z.enum(['RETURN_GIFT', 'DEDUCT_GIFT_VALUE', 'KEEP_GIFT']).default('DEDUCT_GIFT_VALUE'),
}).superRefine((benefit, context) => {
  if (benefit.type === 'PERCENT_OFF' && (benefit.value === undefined || benefit.value <= 0 || benefit.value > 100)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Percentage must be greater than 0 and at most 100' });
  }
  if (benefit.type === 'FIXED_AMOUNT_OFF' && (!Number.isInteger(benefit.value) || (benefit.value ?? 0) <= 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Fixed amount must be positive integer paise' });
  }
  if (benefit.type === 'FREE_ITEM') {
    if (!benefit.quantity) context.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: 'Free-item quantity is required' });
    if (benefit.target === 'SPECIFIC_PRODUCTS' && !benefit.product_ids?.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['product_ids'], message: 'At least one gift product is required' });
    }
    if (benefit.target === 'CUSTOMER_SELECTED_REWARD_GROUP' && !benefit.reward_group?.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['reward_group'], message: 'A reward group is required' });
    }
    if (benefit.out_of_stock_policy === 'CONVERT_TO_DISCOUNT' && !benefit.fallback_discount_amount) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['fallback_discount_amount'], message: 'A fallback discount is required for conversion' });
    }
  }
});

export const PromotionTierSchema = z.object({
  minimum: z.number().positive(),
  benefit: PromotionBenefitSchema,
});

export const PromotionRuleV2Schema = z.object({
  schema_version: z.literal(PROMOTION_SCHEMA_VERSION),
  qualifier: z.object({
    scope: PromotionScopeSchema,
    metric: z.enum([
      'ELIGIBLE_QUANTITY',
      'DISTINCT_PRODUCT_COUNT',
      'PER_PRODUCT_QUANTITY',
      'QUALIFYING_SUBTOTAL',
      'CART_SUBTOTAL',
      'ORDER_TOTAL',
    ]).default('ELIGIBLE_QUANTITY'),
    aggregation: z.enum([
      'PER_PRODUCT',
      'ACROSS_ELIGIBLE_PRODUCTS',
      'DISTINCT_PRODUCTS',
      'PER_CATEGORY',
      'PER_SUBCATEGORY',
      // Future aggregation retained but intentionally disabled:
      // 'PER_FRAGRANCE',
    ]).default('ACROSS_ELIGIBLE_PRODUCTS'),
    minimum_quantity: z.number().int().positive().optional(),
    minimum_value: z.number().int().positive().optional(),
  }),
  tiers: z.array(PromotionTierSchema).default([]),
  benefit: PromotionBenefitSchema.optional(),
  tier_selection: z.literal('HIGHEST_MATCHING_TIER').default('HIGHEST_MATCHING_TIER'),
  repeat: z.enum(['ONCE', 'PER_MULTIPLE']).default('ONCE'),
  limits: z.object({
    maximum_applications_per_order: z.number().int().positive().optional(),
    maximum_discount_amount: z.number().int().positive().optional(),
    maximum_free_quantity: z.number().int().positive().optional(),
    per_customer_usage: z.number().int().positive().optional(),
  }).default({}),
  stacking: z.object({
    stackable: z.boolean().default(false),
    exclusive_group: z.enum([
      'MERCHANDISE_DISCOUNT',
      'ORDER_DISCOUNT',
      'SHIPPING_DISCOUNT',
      'WALLET_CREDIT',
      'LOYALTY_REWARD',
    ]).default('MERCHANDISE_DISCOUNT'),
    item_reuse: z.enum(['ALLOW', 'DISALLOW']).default('DISALLOW'),
    selection_strategy: z.enum(['BEST_CUSTOMER_VALUE', 'CAMPAIGN_PRIORITY', 'MERCHANT_MARGIN']).default('BEST_CUSTOMER_VALUE'),
    priority: z.number().int().default(0),
  }).default({}),
  presentation: z.object({
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    badge: z.string().trim().optional(),
    template_type: z.enum([
      'BUY_X_GET_Y_FREE',
      'BUY_X_PERCENT_OFF',
      'QUANTITY_TIERED_PERCENT_OFF',
      'PERCENT_OFF_PRODUCTS',
      'PERCENT_OFF_CATEGORIES',
      'PERCENT_OFF_SUBCATEGORIES',
    ]).optional(),
  }).default({}),
}).superRefine((rule, context) => {
  if (!rule.benefit && rule.tiers.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['benefit'], message: 'A benefit or at least one tier is required' });
  }
  const minimums = rule.tiers.map((tier) => tier.minimum);
  if (new Set(minimums).size !== minimums.length || minimums.some((value, index) => index > 0 && value <= minimums[index - 1]!)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['tiers'], message: 'Tier minimums must be unique and strictly increasing' });
  }
  if (rule.qualifier.metric === 'PER_PRODUCT_QUANTITY' && rule.qualifier.aggregation !== 'PER_PRODUCT') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['qualifier', 'aggregation'], message: 'PER_PRODUCT_QUANTITY requires PER_PRODUCT aggregation' });
  }
  if (['QUALIFYING_SUBTOTAL', 'CART_SUBTOTAL', 'ORDER_TOTAL'].includes(rule.qualifier.metric) && !rule.qualifier.minimum_value && rule.tiers.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['qualifier', 'minimum_value'], message: 'A minimum value is required for a value metric' });
  }
});

export const PromotionQuoteRequestSchema = z.object({
  schema_version: z.literal(PROMOTION_SCHEMA_VERSION),
  cart_items: z.array(z.object({
    cart_record_id: z.union([z.string(), z.number()]).transform(String).optional(),
    product_id: z.union([z.string(), z.number()]).transform(String),
    quantity: z.number().int().positive(),
  })).min(1),
  channel: z.enum(['web', 'mobile', 'nivapp', 'amazon', 'flipkart', 'instore']).default('web'),
  shipping_amount: z.number().int().nonnegative().default(0),
  customer_id: z.union([z.string(), z.number()]).transform(String).optional(),
  coupon_code: z.string().trim().optional(),
  selected_promotion_ids: z.array(z.number().int().positive()).optional(),
  reward_selections: z.record(z.string()).optional(),
});

export const PromotionEligibilityRequestSchema = PromotionQuoteRequestSchema.omit({
  selected_promotion_ids: true,
  coupon_code: true,
  reward_selections: true,
}).extend({
  promotion_ids: z.array(z.number().int().positive()).min(1).max(200),
});

export const PromotionSelectionSchema = z.object({
  schema_version: z.literal(PROMOTION_SCHEMA_VERSION),
  promotion_id: z.number().int().positive(),
});

export const PromotionGiftSelectionSchema = PromotionSelectionSchema.extend({
  product_id: z.union([z.string(), z.number()]).transform(String),
});

export type PromotionRuleV2 = z.infer<typeof PromotionRuleV2Schema>;
export type PromotionBenefit = z.infer<typeof PromotionBenefitSchema>;
export type PromotionQuoteRequest = z.infer<typeof PromotionQuoteRequestSchema>;
export type PromotionEligibilityRequest = z.infer<typeof PromotionEligibilityRequestSchema>;
