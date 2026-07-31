import { z } from 'zod';

export const returnSourceSchema = z.enum(['customer', 'delivery_partner', 'admin', 'both']);
export const returnRequestSourceSchema = z.enum(['customer', 'delivery_partner', 'admin']);
export const returnRequestTypeSchema = z.enum(['return', 'replacement', 'rto']);
export const rtoStatusSchema = z.enum([
  'delivery_failed',
  'rto_initiated',
  'rto_in_transit',
  'rto_received',
  'warehouse_verification',
  'closed',
]);
export const requestedResolutionSchema = z.enum([
  'replacement',
  'refund',
  'partial_refund',
  'ship_missing_item',
  'complete_return',
]);

export const attachmentTypeSchema = z.enum([
  'product_photo',
  'package_photo',
  'unboxing_video',
  'defect_video',
  'other',
]);

export const createReturnReasonRuleSchema = z.object({
  reasoncode: z.string().trim().min(1).max(100),
  reasonname: z.string().trim().min(1).max(255),
  source: returnSourceSchema.default('customer'),
  aliases: z.array(z.string().trim().min(1).max(255)).default([]),
  allowedresolutions: z.array(requestedResolutionSchema).default([]),
  minimumraisewindowhours: z.coerce.number().int().positive().nullable().optional(),
  photorequired: z.coerce.boolean().default(true),
  videorequired: z.coerce.boolean().default(false),
  packagephotorequired: z.coerce.boolean().default(false),
  packagephotooptional: z.coerce.boolean().default(false),
  unboxingvideorequired: z.coerce.boolean().default(false),
  unboxingvideooptional: z.coerce.boolean().default(false),
  openedpackageallowed: z.coerce.boolean().default(true),
  pickuprequired: z.coerce.boolean().default(true),
  evidencefirstapproval: z.coerce.boolean().default(false),
  autocreatepickup: z.coerce.boolean().default(false),
  reverseshippingchargebearer: z.enum(['nivaana', 'customer', 'undecided']).nullable().optional(),
  notes: z.string().trim().max(3000).nullable().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const updateReturnReasonRuleSchema = createReturnReasonRuleSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  'At least one field is required for update'
);

export const returnReasonRuleQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  source: returnSourceSchema.optional(),
  status: z.enum(['active', 'inactive']).optional(),
  q: z.string().trim().optional(),
});

export const returnSourceParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Invalid ID'),
});

export const returnRequestAttachmentInputSchema = z.object({
  attachmenttype: attachmentTypeSchema,
  fileurl: z.string().trim().url(),
  isrequired: z.coerce.boolean().optional(),
});

export const createReturnRequestSchema = z.object({
  orderlineid: z.coerce.number().int().positive(),
  requesttype: z.enum(['return', 'replacement']),
  reasoncode: z.string().trim().max(100).optional(),
  reason: z.string().trim().min(1).max(255).optional(),
  requestedquantity: z.coerce.number().int().positive().default(1),
  requestedresolution: requestedResolutionSchema,
  ispackageopened: z.coerce.boolean().optional(),
  additionalremarks: z.string().trim().max(3000).optional(),
  attachments: z.array(returnRequestAttachmentInputSchema).default([]),
}).refine(
  (data) => data.reasoncode || data.reason,
  'Provide reasoncode or reason'
);

export const createRtoRequestSchema = z.object({
  orderid: z.coerce.number().int().positive().optional(),
  orderlineid: z.coerce.number().int().positive().optional(),
  trackingid: z.string().trim().max(500).optional(),
  reasoncode: z.string().trim().max(100).optional(),
  reason: z.string().trim().min(1).max(255).optional(),
  requestedquantity: z.coerce.number().int().positive().optional(),
  status: z.enum(['delivery_failed', 'rto_initiated', 'rto_in_transit', 'rto_received']).default('rto_initiated'),
  additionalremarks: z.string().trim().max(3000).optional(),
}).refine(
  (data) => data.orderid || data.orderlineid || data.trackingid,
  'Provide orderid, orderlineid, or trackingid'
).refine(
  (data) => data.reasoncode || data.reason,
  'Provide reasoncode or reason'
);

export const updateRtoStatusSchema = z.object({
  status: rtoStatusSchema,
  additionalremarks: z.string().trim().max(3000).optional(),
  reverse_shipment_tracking_id: z.string().trim().max(500).optional(),
  reverse_shipment_provider: z.string().trim().max(100).optional(),
});

export const markRtoReceivedSchema = z.object({
  additionalremarks: z.string().trim().max(3000).optional(),
  reverse_shipment_tracking_id: z.string().trim().max(500).optional(),
  reverse_shipment_provider: z.string().trim().max(100).optional(),
});

export const evidenceReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  remarks: z.string().trim().max(3000).optional(),
  rejectionreason: z.string().trim().max(3000).optional(),
}).refine(
  (data) => data.decision !== 'rejected' || Boolean(data.rejectionreason),
  'rejectionreason is required when decision is rejected'
);

export const approveReturnRequestSchema = z.object({
  remarks: z.string().trim().max(3000).optional(),
});

export const rejectReturnRequestSchema = z.object({
  rejectionreason: z.string().trim().min(1).max(3000),
  remarks: z.string().trim().max(3000).optional(),
});

export const preparePickupSchema = z.object({
  auto_create_pickup: z.coerce.boolean().default(false),
  pickup_created_by: z.enum(['admin', 'system']).default('admin'),
  logistics_provider_source: z.enum(['original_forward_provider', 'configured_provider', 'manual', 'undecided']).default('undecided'),
  reverse_shipping_charge_bearer: z.enum(['nivaana', 'customer', 'undecided']).default('undecided'),
  reverse_shipping_charge_adjustment: z.enum(['deduct_from_refund', 'collect_separately', 'none', 'undecided']).default('undecided'),
  reverse_shipment_tracking_id: z.string().trim().max(500).optional(),
  reverse_shipment_provider: z.string().trim().max(100).optional(),
  remarks: z.string().trim().max(3000).optional(),
});

export const markReturnReceivedSchema = z.object({
  receivedquantity: z.coerce.number().int().positive().optional(),
  receivedcondition: z.enum(['unknown', 'apparently_resellable', 'apparently_damaged', 'package_damaged', 'mismatch']).default('unknown'),
  receivedlocation: z.string().trim().max(255).optional(),
  remarks: z.string().trim().max(3000).optional(),
});

export const inspectionConditionSchema = z.enum(['resellable', 'damaged', 'incorrect_product', 'other']);
export const restockActionSchema = z.enum(['available', 'damaged', 'quarantine', 'none']);

export const inspectReturnRequestSchema = z.object({
  receivedquantity: z.coerce.number().int().positive().optional(),
  approvedquantity: z.coerce.number().int().min(0).default(0),
  rejectedquantity: z.coerce.number().int().min(0).default(0),
  condition: inspectionConditionSchema,
  restockaction: restockActionSchema.default('none'),
  inspectionnotes: z.string().trim().max(3000).optional(),
}).refine(
  (data) => data.approvedquantity + data.rejectedquantity > 0,
  'approvedquantity or rejectedquantity is required'
).refine(
  (data) => data.approvedquantity > 0 || data.restockaction === 'none',
  'restockaction must be none when approvedquantity is 0'
).refine(
  (data) => data.condition !== 'resellable' || ['available', 'none'].includes(data.restockaction),
  'resellable inspection can use available or none restock action'
).refine(
  (data) => data.condition !== 'damaged' || ['damaged', 'quarantine', 'none'].includes(data.restockaction),
  'damaged inspection can use damaged, quarantine, or none restock action'
).refine(
  (data) => !['incorrect_product', 'other'].includes(data.condition) || ['quarantine', 'none'].includes(data.restockaction),
  'exception inspections can use quarantine or none restock action'
);

export const returnRequestQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  orderid: z.string().optional(),
  orderlineid: z.string().optional(),
  customerid: z.string().optional(),
  requesttype: returnRequestTypeSchema.optional(),
  source: returnRequestSourceSchema.optional(),
  status: z.string().optional(),
  reasoncode: z.string().optional(),
});

export const addReturnRequestAttachmentSchema = z.object({
  attachments: z.array(returnRequestAttachmentInputSchema).min(1),
});

export type CreateReturnReasonRuleInput = z.infer<typeof createReturnReasonRuleSchema>;
export type UpdateReturnReasonRuleInput = z.infer<typeof updateReturnReasonRuleSchema>;
export type ReturnReasonRuleQuery = z.infer<typeof returnReasonRuleQuerySchema>;
export type ReturnSourceParams = z.infer<typeof returnSourceParamsSchema>;
export type CreateReturnRequestInput = z.infer<typeof createReturnRequestSchema>;
export type CreateRtoRequestInput = z.infer<typeof createRtoRequestSchema>;
export type UpdateRtoStatusInput = z.infer<typeof updateRtoStatusSchema>;
export type MarkRtoReceivedInput = z.infer<typeof markRtoReceivedSchema>;
export type EvidenceReviewInput = z.infer<typeof evidenceReviewSchema>;
export type ApproveReturnRequestInput = z.infer<typeof approveReturnRequestSchema>;
export type RejectReturnRequestInput = z.infer<typeof rejectReturnRequestSchema>;
export type PreparePickupInput = z.infer<typeof preparePickupSchema>;
export type MarkReturnReceivedInput = z.infer<typeof markReturnReceivedSchema>;
export type InspectReturnRequestInput = z.infer<typeof inspectReturnRequestSchema>;
export type ReturnRequestQuery = z.infer<typeof returnRequestQuerySchema>;
export type AddReturnRequestAttachmentInput = z.infer<typeof addReturnRequestAttachmentSchema>;
export type ReturnRequestAttachmentInput = z.infer<typeof returnRequestAttachmentInputSchema>;
