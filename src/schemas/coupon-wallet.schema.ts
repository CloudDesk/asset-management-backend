import { z } from 'zod';

export const claimCouponSchema = z.object({
  code: z.string().trim().min(4).max(100),
  channel: z.enum(['web', 'mobile']).default('web'),
});

export const walletChannelSchema = z.object({
  channel: z.enum(['web', 'mobile']).default('web'),
});

export const walletDiscountQuoteSchema = z.object({
  eligibility_base: z.number().nonnegative(),
  payable_amount: z.number().nonnegative(),
  merchandise_payable: z.number().nonnegative().optional(),
  shipping_payable: z.number().nonnegative().optional(),
});

export const directCouponCheckoutQuoteSchema = z.object({
  code: z.string().trim().min(4).max(100),
  channel: z.enum(['web', 'mobile']).default('web'),
  merchandise_subtotal: z.number().nonnegative(),
  merchandise_remaining: z.number().nonnegative(),
}).superRefine((value, context) => {
  if (value.merchandise_remaining > value.merchandise_subtotal) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['merchandise_remaining'],
      message: 'merchandise_remaining cannot exceed merchandise_subtotal',
    });
  }
});

export const couponWalletListSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['not_used', 'added_to_wallet', 'partly_used', 'fully_used', 'expired', 'paused', 'cancelled']).optional(),
  ownership_mode: z.enum(['customer', 'customer_group', 'anyone']).optional(),
  source: z.enum(['customer', 'coupon_group']).optional(),
  customer_id: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(100).optional(),
  scope: z.enum(['all', 'standalone', 'promotion']).default('all'),
});

export const createQuickCouponSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  discount_type: z.literal('FIXED_AMOUNT_OFF'),
  discount_value: z.number().positive(),
  max_discount: z.number().positive().optional(),
  minimum_cart_amount: z.number().nonnegative().optional(),
  assignment_type: z.enum(['customer', 'coupon_group']),
  customer_id: z.number().int().positive().optional(),
  coupon_group_id: z.number().int().positive().optional(),
  voucher_code: z.string().trim().min(4).max(100).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  dispatched_order_id: z.string().trim().max(500).optional(),
  // Accepted for backward compatibility with older Inventory clients, but
  // standalone coupons are always available on both customer channels and
  // never participate in generic promotion stacking.
  delivery_channel: z.enum(['all', 'web', 'mobile', 'print']).optional().transform(() => 'all' as const),
  stackable: z.boolean().optional().transform(() => false as const),
}).superRefine((value, context) => {
  if (value.assignment_type === 'customer' && !value.customer_id) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['customer_id'], message: 'customer_id is required' });
  }
  if (value.assignment_type === 'coupon_group' && !value.coupon_group_id) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['coupon_group_id'], message: 'coupon_group_id is required' });
  }
  if (value.assignment_type === 'coupon_group' && value.voucher_code) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['voucher_code'], message: 'Group coupons generate one personalized code per customer' });
  }
  if (value.start_date && value.end_date && new Date(value.start_date) >= new Date(value.end_date)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['end_date'], message: 'end_date must be later than start_date' });
  }
});

export const updateQuickCouponSchema = z.object({
  name: z.string().trim().min(1).max(255),
  discount_type: z.literal('FIXED_AMOUNT_OFF'),
  discount_value: z.number().positive(),
  max_discount: z.number().positive().nullable().optional(),
  minimum_cart_amount: z.number().nonnegative().nullable().optional(),
  assignment_type: z.literal('customer'),
  customer_id: z.number().int().positive().nullable().optional(),
  start_date: z.string().datetime().nullable().optional(),
  end_date: z.string().datetime().nullable().optional(),
  dispatched_order_id: z.string().trim().max(500).nullable().optional(),
  // See create schema: legacy values are deliberately normalized server-side.
  delivery_channel: z.enum(['all', 'web', 'mobile', 'print']).optional().transform(() => 'all' as const),
  stackable: z.boolean().optional().transform(() => false as const),
  status: z.enum(['active', 'inactive', 'revoked']),
}).superRefine((value, context) => {
  if (value.assignment_type === 'customer' && !value.customer_id) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['customer_id'], message: 'customer_id is required' });
  }
  if (value.start_date && value.end_date && new Date(value.start_date) >= new Date(value.end_date)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['end_date'], message: 'end_date must be later than start_date' });
  }
});

export type CouponWalletListInput = z.infer<typeof couponWalletListSchema>;
export type CreateQuickCouponInput = z.infer<typeof createQuickCouponSchema>;
export type UpdateQuickCouponInput = z.infer<typeof updateQuickCouponSchema>;
