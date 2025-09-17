// Enhanced Promotion Action Schema
// This replaces the redundant discount_type/discount_value fields with a single, comprehensive action object

import { z } from 'zod';

// Base action schema
export const baseActionSchema = z.object({
  type: z.enum(['PERCENT_OFF', 'FIXED_AMOUNT_OFF', 'FREE_SHIPPING', 'BOGO', 'FREE_PRODUCT'])
});

// PERCENT_OFF action schema
export const percentOffActionSchema = baseActionSchema.extend({
  type: z.literal('PERCENT_OFF'),
  value: z.number().min(1).max(100).describe('Discount percentage (1-100)'),
  max_discount: z.number().optional().describe('Maximum discount amount cap')
});

// FIXED_AMOUNT_OFF action schema  
export const fixedAmountOffActionSchema = baseActionSchema.extend({
  type: z.literal('FIXED_AMOUNT_OFF'),
  value: z.number().positive().describe('Fixed discount amount')
});

// FREE_SHIPPING action schema
export const freeShippingActionSchema = baseActionSchema.extend({
  type: z.literal('FREE_SHIPPING'),
  min_order_value: z.number().optional().describe('Minimum order value for free shipping')
});

// BOGO (Buy One Get One) action schema
export const bogoActionSchema = baseActionSchema.extend({
  type: z.literal('BOGO'),
  buy_quantity: z.number().int().positive().describe('Quantity to buy'),
  get_quantity: z.number().int().positive().describe('Quantity to get free'),
  product_ids: z.array(z.number().int().positive()).optional().describe('Specific product IDs (empty = all products)'),
  max_free_items: z.number().int().positive().optional().describe('Maximum free items per order')
});

// FREE_PRODUCT action schema
export const freeProductActionSchema = baseActionSchema.extend({
  type: z.literal('FREE_PRODUCT'),
  free_product_id: z.number().int().positive().describe('Product ID to give for free'),
  min_purchase: z.number().positive().optional().describe('Minimum purchase amount required'),
  max_free_items: z.number().int().positive().optional().describe('Maximum free items per order')
});

// Union of all action schemas
export const promotionActionSchema = z.discriminatedUnion('type', [
  percentOffActionSchema,
  fixedAmountOffActionSchema,
  freeShippingActionSchema,
  bogoActionSchema,
  freeProductActionSchema
]);

// Updated promotion schema (single action, not array)
export const enhancedPromotionSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum([
    'PERCENT_OFF_ITEM', 
    'FIXED_AMOUNT_OFF_ITEM', 
    'BOGO', 
    'PERCENT_OFF_CART', 
    'FIXED_AMOUNT_OFF_CART', 
    'FREE_SHIPPING', 
    'FREE_PRODUCT'
  ]),
  code: z.string().optional(),
  auto_apply: z.boolean().default(false),
  is_active: z.boolean().default(true),
  start_date: z.number().describe('Unix timestamp'),
  end_date: z.number().describe('Unix timestamp'),
  status: z.enum(['active', 'inactive', 'draft', 'expired']).default('active'),
  priority: z.number().int().default(1),
  visibility: z.enum(['public', 'private']).default('public'),
  max_redemptions: z.number().int().positive().optional(),
  per_user_limit: z.number().int().positive().optional(),
  stackable: z.boolean().default(false),
  budget: z.number().positive().optional(),
  timezone: z.string().default('Asia/Kolkata'),
  evaluation_expiry_minutes: z.number().int().positive().default(15),
  
  // Enhanced conditions array
  conditions: z.array(z.object({
    attribute: z.string().describe('e.g., cart.total_value, product.category'),
    operator: z.enum(['GTE', 'LTE', 'EQ', 'IN', 'NOT_IN', 'CONTAINS']),
    value: z.union([z.string(), z.number(), z.array(z.string()), z.boolean()])
  })).default([]),
  
  // Single action object (not array)
  action: promotionActionSchema
});

// Frontend helper functions
export const getActionForPromotionType = (promotionType: string, formData: any) => {
  switch (promotionType) {
    case 'PERCENT_OFF_CART':
    case 'PERCENT_OFF_ITEM':
      return {
        type: 'PERCENT_OFF' as const,
        value: formData.discount_percentage,
        max_discount: formData.max_discount_cap
      };
      
    case 'FIXED_AMOUNT_OFF_CART':
    case 'FIXED_AMOUNT_OFF_ITEM':
      return {
        type: 'FIXED_AMOUNT_OFF' as const,
        value: formData.discount_amount
      };
      
    case 'BOGO':
      return {
        type: 'BOGO' as const,
        buy_quantity: formData.buy_quantity,
        get_quantity: formData.get_quantity,
        product_ids: formData.selected_products || undefined,
        max_free_items: formData.max_free_items
      };
      
    case 'FREE_PRODUCT':
      return {
        type: 'FREE_PRODUCT' as const,
        free_product_id: formData.selected_free_product,
        min_purchase: formData.minimum_purchase,
        max_free_items: formData.max_free_items
      };
      
    case 'FREE_SHIPPING':
      return {
        type: 'FREE_SHIPPING' as const,
        min_order_value: formData.minimum_order_value
      };
      
    default:
      throw new Error(`Unsupported promotion type: ${promotionType}`);
  }
};

// Validation helper
export const validatePromotionAction = (promotionType: string, action: any) => {
  try {
    const schema = enhancedPromotionSchema.pick({ action: true });
    return schema.parse({ action });
  } catch (error) {
    throw new Error(`Invalid action for promotion type ${promotionType}: ${error.message}`);
  }
};
