import { z } from 'zod';
import { PromotionRuleV2Schema, PromotionScopeSchema } from './promotions-v2.schema.js';

export const PROMOTION_SCHEMA_VERSION_V3 = 3 as const;

const NumericComparisonSchema = z.enum(['GT', 'GTE', 'EQ', 'LTE', 'LT']);
const PromotionChannelSchema = z.enum(['web', 'mobile', 'nivapp', 'amazon', 'flipkart', 'instore']);

export const PromotionPredicateSchema = z.discriminatedUnion('field', [
  z.object({
    field: z.enum(['ELIGIBLE_QUANTITY', 'DISTINCT_PRODUCT_COUNT']),
    operator: NumericComparisonSchema.default('GTE'),
    value: z.number().int().nonnegative(),
  }),
  z.object({
    field: z.enum(['QUALIFYING_SUBTOTAL', 'CART_SUBTOTAL', 'REMAINING_CART_VALUE', 'ORDER_TOTAL']),
    operator: NumericComparisonSchema.default('GTE'),
    value: z.number().int().nonnegative(),
  }),
  z.object({
    field: z.literal('CHANNEL'),
    operator: z.enum(['IN', 'NOT_IN']).default('IN'),
    value: z.array(PromotionChannelSchema).min(1),
  }),
  z.object({
    field: z.literal('CUSTOMER_SEGMENT'),
    operator: z.enum(['IN', 'NOT_IN']).default('IN'),
    value: z.array(z.string().trim().min(1)).min(1),
  }),
]);

export const PromotionBenefitV3Schema = z.object({
  type: z.enum(['PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FREE_ITEM', 'FREE_SHIPPING']),
  application_level: z.enum(['ITEM', 'ORDER']).default('ITEM'),
  value: z.number().nonnegative().optional(),
  quantity: z.number().int().positive().optional(),
  allocation: z.enum([
    'ALL_ELIGIBLE_UNITS',
    'QUALIFYING_UNITS_ONLY',
    'CHEAPEST_ELIGIBLE_UNIT',
    'REMAINING_AVAILABLE_UNITS',
  ]).default('ALL_ELIGIBLE_UNITS'),
  units_per_application: z.number().int().positive().optional(),
}).superRefine((benefit, context) => {
  if (benefit.type === 'PERCENT_OFF' && (benefit.value === undefined || benefit.value <= 0 || benefit.value > 100)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Percentage must be greater than 0 and at most 100' });
  }
  if (benefit.type === 'FIXED_AMOUNT_OFF' && (!Number.isInteger(benefit.value) || (benefit.value ?? 0) <= 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'Fixed amount must be positive integer paise' });
  }
  if (benefit.type === 'FREE_ITEM' && !benefit.quantity) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['quantity'], message: 'Free-item quantity is required' });
  }
  if (benefit.application_level === 'ORDER' && !['PERCENT_OFF', 'FIXED_AMOUNT_OFF'].includes(benefit.type)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['application_level'], message: 'Only percentage and fixed discounts can be applied at order level' });
  }
  if (benefit.application_level === 'ORDER' && benefit.units_per_application !== undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['units_per_application'], message: 'Order-level discounts cannot configure affected item units' });
  }
});

export const PromotionTierV3Schema = z.object({
  minimum_quantity: z.number().int().positive(),
  benefit: PromotionBenefitV3Schema,
});

export const PromotionRewardV3Schema = z.object({
  mode: z.enum([
    'SAME_PRODUCT',
    'SPECIFIC_PRODUCT',
    'CHEAPEST_ELIGIBLE_CART_UNIT',
    'PACKER_SELECTED_SURPRISE_GIFT',
  ]),
  product_ids: z.array(z.string().trim().min(1)).default([]),
  allowed_scope: PromotionScopeSchema.nullable().default(null),
  fulfilment: z.enum(['AUTO_ADD', 'DISCOUNT_EXISTING', 'PACKING_SELECTION']),
}).superRefine((reward, context) => {
  if (reward.mode === 'SPECIFIC_PRODUCT' && reward.product_ids.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['product_ids'], message: 'A configured gift product is required' });
  }
  if (reward.mode === 'PACKER_SELECTED_SURPRISE_GIFT' && reward.fulfilment !== 'PACKING_SELECTION') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fulfilment'], message: 'Surprise gifts must be selected during packing' });
  }
  if (reward.mode !== 'PACKER_SELECTED_SURPRISE_GIFT' && reward.fulfilment === 'PACKING_SELECTION') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fulfilment'], message: 'Packing selection is reserved for surprise gifts' });
  }
  if (reward.mode === 'CHEAPEST_ELIGIBLE_CART_UNIT' && reward.fulfilment !== 'DISCOUNT_EXISTING') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fulfilment'], message: 'Cheapest eligible rewards must discount an existing cart unit' });
  }
  if (['SAME_PRODUCT', 'SPECIFIC_PRODUCT'].includes(reward.mode) && reward.fulfilment !== 'AUTO_ADD') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['fulfilment'], message: 'Same-product and configured-product gifts are added automatically' });
  }
  if (reward.mode === 'PACKER_SELECTED_SURPRISE_GIFT' && !reward.allowed_scope) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['allowed_scope'], message: 'Surprise gifts require an allowed product scope' });
  }
});

export const PromotionRuleV3Schema = z.object({
  schema_version: z.literal(PROMOTION_SCHEMA_VERSION_V3),
  qualifier: z.object({
    scope: PromotionScopeSchema,
    predicates: z.array(PromotionPredicateSchema).default([]),
    aggregation: z.enum([
      'PER_PRODUCT',
      'ACROSS_ELIGIBLE_PRODUCTS',
      'DISTINCT_PRODUCTS',
      'PER_CATEGORY',
      'PER_SUBCATEGORY',
    ]).default('ACROSS_ELIGIBLE_PRODUCTS'),
  }),
  benefit: PromotionBenefitV3Schema.optional(),
  tiers: z.array(PromotionTierV3Schema).default([]),
  tier_selection: z.literal('HIGHEST_MATCHING_TIER').default('HIGHEST_MATCHING_TIER'),
  reward: PromotionRewardV3Schema.optional(),
  repetition: z.object({
    mode: z.enum(['ONCE', 'PER_QUALIFYING_SET']).default('ONCE'),
    maximum_sets_per_order: z.number().int().positive().nullable().default(null),
  }).default({}),
  conflict_policy: z.object({
    exclusive_group: z.string().trim().min(1).default('MERCHANDISE_PROMOTIONS'),
    maximum_promotions_from_group: z.number().int().positive().nullable().default(null),
    stackable: z.boolean().default(false),
    item_reuse: z.boolean().default(false),
    selection_strategy: z.enum(['CAMPAIGN_PRIORITY', 'BEST_CUSTOMER_VALUE']).default('CAMPAIGN_PRIORITY'),
    priority: z.number().int().default(0),
  }).default({}),
  limits: z.object({
    maximum_discount_amount: z.number().int().positive().nullable().default(null),
    maximum_affected_quantity: z.number().int().positive().nullable().default(null),
    per_customer_usage: z.number().int().positive().nullable().default(null),
  }).default({}),
  availability_policy: z.object({
    when_gift_unavailable: z.literal('REMOVE_AND_NOTIFY').default('REMOVE_AND_NOTIFY'),
  }).default({}),
  presentation: z.object({
    title: z.string().trim().min(1),
    progress_template: z.string().trim().min(1).optional(),
    applied_template: z.string().trim().min(1).optional(),
    unavailable_template: z.string().trim().min(1).optional(),
  }),
}).superRefine((rule, context) => {
  if ((!rule.benefit && rule.tiers.length === 0) || (rule.benefit && rule.tiers.length > 0)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['benefit'], message: 'Configure either one benefit or quantity tiers' });
  }
  const tierMinimums = rule.tiers.map((tier) => tier.minimum_quantity);
  if (new Set(tierMinimums).size !== tierMinimums.length || tierMinimums.some((minimum, index) => index > 0 && minimum <= tierMinimums[index - 1]!)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['tiers'], message: 'Tier minimum quantities must be unique and strictly increasing' });
  }
  const configuredBenefits = [rule.benefit, ...rule.tiers.map((tier) => tier.benefit)].filter((benefit) => benefit !== undefined);
  const applicationLevels = new Set(configuredBenefits.map((benefit) => benefit.application_level));
  if (applicationLevels.size > 1) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['tiers'], message: 'All benefits in a promotion must use the same application level' });
  }
  if (applicationLevels.has('ORDER')) {
    const entireCartOnly = rule.qualifier.scope.include.length === 1
      && rule.qualifier.scope.include[0]?.facet === 'ENTIRE_CART'
      && rule.qualifier.scope.include[0].values.includes('*')
      && rule.qualifier.scope.exclude.length === 0;
    if (!entireCartOnly) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['qualifier', 'scope'], message: 'Order-level discounts must target the entire cart' });
    }
  }
  const hasFreeItem = configuredBenefits.some((benefit) => benefit.type === 'FREE_ITEM');
  if (hasFreeItem && !rule.reward) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['reward'], message: 'A free-item benefit requires reward configuration' });
  }
  if (!hasFreeItem && rule.reward) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['reward'], message: 'Reward configuration is only valid for free-item benefits' });
  }
  if (rule.reward?.mode === 'SAME_PRODUCT' && rule.qualifier.aggregation !== 'PER_PRODUCT') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['qualifier', 'aggregation'], message: 'Same-product rewards must qualify each product independently' });
  }
  if (rule.repetition.mode === 'PER_QUALIFYING_SET') {
    const quantityPredicate = rule.qualifier.predicates.find((predicate) => predicate.field === 'ELIGIBLE_QUANTITY');
    if (!quantityPredicate || typeof quantityPredicate.value !== 'number' || !['GT', 'GTE', 'EQ'].includes(quantityPredicate.operator) || quantityPredicate.value <= 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['qualifier', 'predicates'], message: 'Repeating promotions require a positive eligible-quantity predicate' });
    }
  }
});

export const PromotionRuleSchema = z.union([PromotionRuleV3Schema, PromotionRuleV2Schema]);

export const PromotionPublishRequestSchema = z.object({
  expected_checksum: z.string().regex(/^[a-f0-9]{64}$/i, 'Expected checksum must be a SHA-256 value'),
});

export const PromotionGiftFulfilmentSchema = z.object({
  product_id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^\d+$/, 'Product id must be numeric')),
  quantity: z.number().int().positive(),
});

export const PromotionRuleStatusSchema = z.enum(['DRAFT', 'PUBLISHED', 'RETIRED']);
export const PromotionOutcomeStatusSchema = z.enum(['AVAILABLE', 'PROGRESS', 'APPLIED', 'REJECTED', 'ALTERNATIVE']);
export const PromotionReasonCodeSchema = z.enum([
  'MINIMUM_QUANTITY_NOT_MET',
  'MINIMUM_VALUE_NOT_MET',
  'CHANNEL_NOT_ELIGIBLE',
  'CUSTOMER_NOT_ELIGIBLE',
  'USAGE_LIMIT_REACHED',
  'BUDGET_EXHAUSTED',
  'GIFT_OUT_OF_STOCK',
  'CONFLICTED_WITH_BETTER_OFFER',
  'INVALID_REWARD_SELECTION',
  'NO_ELIGIBLE_PRODUCTS',
  'QUOTE_EXPIRED',
  'QUOTE_CHANGED',
]);

export const PromotionMessageSchema = z.object({
  key: z.string().trim().min(1),
  dedupe_key: z.string().trim().min(1),
  severity: z.enum(['info', 'success', 'warning', 'error']),
  surface: z.array(z.enum(['PRODUCT', 'CART', 'CHECKOUT', 'PACKING'])).min(1),
  parameters: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
  fallback_text: z.string().trim().min(1),
});

export const PromotionQuantityBreakdownSchema = z.object({
  product_id: z.string().trim().min(1),
  paid_quantity: z.number().int().nonnegative(),
  free_quantity: z.number().int().nonnegative(),
  total_quantity: z.number().int().nonnegative(),
}).superRefine((quantity, context) => {
  if (quantity.total_quantity !== quantity.paid_quantity + quantity.free_quantity) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['total_quantity'], message: 'Total quantity must equal paid plus free quantity' });
  }
});

export const PromotionV3SimulationRequestSchema = z.object({
  schema_version: z.literal(PROMOTION_SCHEMA_VERSION_V3),
  cart_items: z.array(z.object({
    cart_record_id: z.union([z.string(), z.number()]).transform(String).optional(),
    product_id: z.union([z.string(), z.number()]).transform(String),
    quantity: z.number().int().positive(),
  })).min(1),
  channel: PromotionChannelSchema.default('web'),
  shipping_amount: z.number().int().nonnegative().default(0),
  remaining_cart_value: z.number().int().nonnegative().optional(),
  customer_segments: z.array(z.string().trim().min(1)).default([]),
  rule: PromotionRuleV3Schema.optional(),
});

export const PromotionV3MultiSimulationRequestSchema = PromotionV3SimulationRequestSchema.omit({ rule: true }).extend({
  campaigns: z.array(z.object({
    promotion_id: z.number().int().positive(),
    rule_version: z.number().int().nonnegative().default(0),
    name: z.string().trim().min(1).optional(),
    rule: PromotionRuleV3Schema,
  })).min(1).max(200),
});

export const PromotionQuoteRequestCurrentSchema = PromotionV3SimulationRequestSchema
  .omit({ schema_version: true, rule: true, remaining_cart_value: true })
  .extend({ customer_segments: z.array(z.string().trim().min(1)).default([]) });

export type PromotionRuleV3 = z.infer<typeof PromotionRuleV3Schema>;
export type PromotionRule = z.infer<typeof PromotionRuleSchema>;
export type PromotionPredicate = z.infer<typeof PromotionPredicateSchema>;
export type PromotionMessage = z.infer<typeof PromotionMessageSchema>;
export type PromotionV3SimulationRequest = z.infer<typeof PromotionV3SimulationRequestSchema>;
export type PromotionV3MultiSimulationRequest = z.infer<typeof PromotionV3MultiSimulationRequestSchema>;
