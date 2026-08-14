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

const amazonAttributeName = z.string().trim().regex(/^[a-z0-9_]+$/).max(255);

export const amazonListingEditPreviewSchema = z.object({
  baselineHash: z.string().regex(/^[a-f0-9]{64}$/),
  changedAttributes: z.record(amazonAttributeName, z.array(z.record(z.unknown())).max(100)),
}).strict().superRefine((value, context) => {
  const names = Object.keys(value.changedAttributes);
  if (names.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['changedAttributes'], message: 'At least one changed Amazon attribute is required' });
  }
  if (names.length > 50) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['changedAttributes'], message: 'No more than 50 attribute groups can be changed at once' });
  }
  for (const protectedName of ['purchasable_offer', 'fulfillment_availability']) {
    if (protectedName in value.changedAttributes) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['changedAttributes', protectedName],
        message: `${protectedName} must be changed through the dedicated offer or stock workflow`,
      });
    }
  }
});

export const amazonListingEditApplySchema = amazonOfferApplySchema.extend({
  baselineHash: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
