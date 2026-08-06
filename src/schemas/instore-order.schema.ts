import { z } from 'zod';

const mobileSchema = z.string()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((value) => /^[1-9]\d{9}$/.test(value), 'Enter a valid 10-digit mobile number');

export const instoreSearchSchema = z.object({
  search: z.string().trim().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const instoreOrderSchema = z.object({
  client_reference: z.string().trim().min(8).max(100),
  customer: z.union([
    z.object({ customer_id: z.number().int().positive() }),
    z.object({
      name: z.string().trim().min(2).max(500),
      mobile: mobileSchema,
    }),
  ]),
  items: z.array(z.object({
    product_id: z.number().int().positive(),
    quantity: z.number().int().min(1).max(100),
  })).min(1).max(100),
  manual_discount: z.object({
    type: z.enum(['none', 'fixed', 'percentage']).default('none'),
    value: z.number().min(0).default(0),
    reason: z.string().trim().max(500).optional(),
  }).default({ type: 'none', value: 0 }),
  payment_method: z.enum(['cash', 'card', 'upi']),
  payment_reference: z.string().trim().max(500).optional(),
  store_location: z.string().trim().max(500).optional(),
}).superRefine((data, context) => {
  const productIds = data.items.map((item) => item.product_id);
  if (new Set(productIds).size !== productIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['items'],
      message: 'Each product must appear only once; update its quantity instead',
    });
  }

  if (data.manual_discount.type === 'percentage' && data.manual_discount.value > 100) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['manual_discount', 'value'],
      message: 'Percentage discount cannot exceed 100%',
    });
  }

});

export type InstoreSearchInput = z.infer<typeof instoreSearchSchema>;
export type InstoreOrderInput = z.infer<typeof instoreOrderSchema>;
