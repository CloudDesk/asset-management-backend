import { z } from 'zod';

export const amazonOfferUpdateSchema = z.object({
  price: z.coerce.number().positive().max(100_000_000).optional(),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()).optional(),
  quantity: z.coerce.number().int().min(0).max(1_000_000).optional(),
  handlingTimeDays: z.coerce.number().int().min(0).max(30).optional(),
  available: z.boolean().optional(),
}).strict().superRefine((value, context) => {
  if (value.price === undefined && value.quantity === undefined && value.handlingTimeDays === undefined && value.available === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'At least one offer change is required' });
  }
  if (value.currency !== undefined && value.price === undefined) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['currency'], message: 'Currency can be changed only with price' });
  }
});

export const amazonOfferApplySchema = z.object({
  previewId: z.union([z.string().regex(/^[1-9]\d*$/), z.number().int().positive()]).transform(String),
  confirmed: z.literal(true),
}).strict();
