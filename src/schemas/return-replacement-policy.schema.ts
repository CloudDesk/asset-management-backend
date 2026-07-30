import { z } from 'zod';

const refundMethodSchema = z.enum(['original_payment', 'wallet']);

const optionalCategoryValue = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().max(255).optional()
);

export const createReturnReplacementPolicySchema = z.object({
  category: z.string().trim().min(1, 'category is required').max(255),
  subcategory: optionalCategoryValue,
  subsubcategory: optionalCategoryValue,
  returnallowed: z.coerce.boolean().default(false),
  replacementallowed: z.coerce.boolean().default(false),
  returnwindowdays: z.coerce.number().int().min(0).max(365).optional(),
  replacementwindowdays: z.coerce.number().int().min(0).max(365).optional(),
  allowedrefundmethods: z.array(refundMethodSchema).default([]),
  notes: z.string().trim().max(2000).optional(),
  isactive: z.coerce.boolean().default(true),
  createdby: z.coerce.number().int().positive().optional(),
  modifiedby: z.coerce.number().int().positive().optional(),
});

export const updateReturnReplacementPolicySchema = z.object({
  category: z.string().trim().min(1, 'category is required').max(255).optional(),
  subcategory: optionalCategoryValue,
  subsubcategory: optionalCategoryValue,
  returnallowed: z.coerce.boolean().optional(),
  replacementallowed: z.coerce.boolean().optional(),
  returnwindowdays: z.coerce.number().int().min(0).max(365).optional(),
  replacementwindowdays: z.coerce.number().int().min(0).max(365).optional(),
  allowedrefundmethods: z.array(refundMethodSchema).optional(),
  notes: z.string().trim().max(2000).optional(),
  isactive: z.coerce.boolean().optional(),
  modifiedby: z.coerce.number().int().positive().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  'At least one field is required for update'
);

export const returnReplacementPolicyParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Invalid policy ID'),
});

export const returnReplacementPolicyQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  subsubcategory: z.string().optional(),
  isactive: z.string().optional(),
});

export const returnReplacementPolicyEligibilityQuerySchema = z.object({
  orderlineid: z.coerce.number().int().positive().optional(),
  productid: z.coerce.number().int().positive().optional(),
  category: z.string().trim().min(1).optional(),
  subcategory: optionalCategoryValue,
  subsubcategory: optionalCategoryValue,
  requesttype: z.enum(['return', 'replacement']).default('return'),
}).refine(
  (data) => data.orderlineid || data.productid || data.category,
  'Provide one of orderlineid, productid, or category'
);

export type CreateReturnReplacementPolicyInput = z.infer<typeof createReturnReplacementPolicySchema>;
export type UpdateReturnReplacementPolicyInput = z.infer<typeof updateReturnReplacementPolicySchema>;
export type ReturnReplacementPolicyParams = z.infer<typeof returnReplacementPolicyParamsSchema>;
export type ReturnReplacementPolicyQuery = z.infer<typeof returnReplacementPolicyQuerySchema>;
export type ReturnReplacementPolicyEligibilityQuery = z.infer<typeof returnReplacementPolicyEligibilityQuerySchema>;
