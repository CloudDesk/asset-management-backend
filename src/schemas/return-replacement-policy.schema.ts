import { z } from 'zod';

const refundMethodSchema = z.enum(['original_payment', 'wallet']);
const requestedResolutionSchema = z.enum([
  'replacement',
  'refund',
  'partial_refund',
  'ship_missing_item',
  'complete_return',
]);
const evidenceTypeSchema = z.enum([
  'product_photo',
  'package_photo',
  'unboxing_video',
  'defect_video',
  'other',
]);

const optionalCategoryValue = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().max(255).optional()
);

export const createReturnReplacementPolicySchema = z.object({
  category: z.string().trim().min(1, 'category is required').max(255),
  subcategory: optionalCategoryValue,
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

export const returnPolicyReasonParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Invalid policy ID'),
  reasonCode: z.string().trim().min(1).max(100),
});

export const returnReplacementPolicyQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  isactive: z.string().optional(),
});

export const returnReplacementPolicyEligibilityQuerySchema = z.object({
  orderlineid: z.coerce.number().int().positive().optional(),
  productid: z.coerce.number().int().positive().optional(),
  category: z.string().trim().min(1).optional(),
  subcategory: optionalCategoryValue,
  requesttype: z.enum(['return', 'replacement']).default('return'),
}).refine(
  (data) => data.orderlineid || data.productid || data.category,
  'Provide one of orderlineid, productid, or category'
);

export const policyReasonEvidenceRuleSchema = z.object({
  type: evidenceTypeSchema,
  required: z.coerce.boolean().default(false),
  minimum: z.coerce.number().int().min(0).max(10).default(0),
});

export const policyReasonConfigurationPatchSchema = z.object({
  aliases: z.array(z.string().trim().min(1).max(100)).optional(),
  raiseWithinHours: z.coerce.number().int().positive().max(8760).nullable().optional(),
  evidence: z.array(policyReasonEvidenceRuleSchema).optional(),
  allowedResolutions: z.array(requestedResolutionSchema).min(1).optional(),
  openedPackageAllowed: z.coerce.boolean().optional(),
  approvalMode: z.enum(['evidence_first', 'pickup_first']).optional(),
  resolutionTiming: z.string().trim().max(100).nullable().optional(),
  pickup: z.object({
    required: z.coerce.boolean().optional(),
    triggerMode: z.literal('manual_admin').optional(),
    chargeBearer: z.literal('nivaana').optional(),
    deductChargeFromRefund: z.literal(false).optional(),
  }).optional(),
  stockUnavailableResolution: requestedResolutionSchema.nullable().optional(),
  notifyCustomerOnStockFallback: z.coerce.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  'At least one configuration field is required'
);

export const updatePolicyReasonRuleSchema = z.object({
  configurationVersion: z.coerce.number().int().positive(),
  configuration: policyReasonConfigurationPatchSchema,
  isActive: z.coerce.boolean().optional(),
  modifiedBy: z.coerce.number().int().positive().optional(),
});

export const resetPolicyReasonRuleSchema = z.object({
  configurationVersion: z.coerce.number().int().positive().optional(),
  modifiedBy: z.coerce.number().int().positive().optional(),
}).optional().default({});

export type CreateReturnReplacementPolicyInput = z.infer<typeof createReturnReplacementPolicySchema>;
export type UpdateReturnReplacementPolicyInput = z.infer<typeof updateReturnReplacementPolicySchema>;
export type ReturnReplacementPolicyParams = z.infer<typeof returnReplacementPolicyParamsSchema>;
export type ReturnPolicyReasonParams = z.infer<typeof returnPolicyReasonParamsSchema>;
export type ReturnReplacementPolicyQuery = z.infer<typeof returnReplacementPolicyQuerySchema>;
export type ReturnReplacementPolicyEligibilityQuery = z.infer<typeof returnReplacementPolicyEligibilityQuerySchema>;
export type UpdatePolicyReasonRuleInput = z.infer<typeof updatePolicyReasonRuleSchema>;
export type ResetPolicyReasonRuleInput = z.infer<typeof resetPolicyReasonRuleSchema>;
