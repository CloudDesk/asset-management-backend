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
  'rto_closed',
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

const optionalTrimmedString = (maxLength: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.string().trim().max(maxLength).optional()
  );

const optionalDateString = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'invoice_date must be in YYYY-MM-DD format').optional()
);

const evidenceRuleSchema = z.object({
  type: attachmentTypeSchema,
  required: z.coerce.boolean().default(false),
  minimum: z.coerce.number().int().min(0).default(0),
});

export const createReturnReasonRuleSchema = z.object({
  reasoncode: z.string().trim().min(1).max(100),
  reasonname: z.string().trim().min(1).max(255),
  source: returnSourceSchema.default('customer'),
  aliases: z.array(z.string().trim().min(1).max(255)).default([]),
  allowedresolutions: z.array(requestedResolutionSchema).default([]),
  raisewithinhours: z.coerce.number().int().positive().nullable().optional(),
  schemaversion: z.coerce.number().int().positive().default(1),
  evidencerules: z.array(evidenceRuleSchema).default([]),
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
  resolutiontiming: z.string().trim().max(100).nullable().optional(),
  stockunavailableresolution: requestedResolutionSchema.nullable().optional(),
  pickuptriggermode: z.literal('manual_admin').default('manual_admin'),
  notifycustomeronstockfallback: z.coerce.boolean().default(true),
  reverseshippingchargebearer: z.literal('nivaana').nullable().optional(),
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
  policyreasonruleid: z.coerce.number().int().positive().optional(),
  reasoncode: z.string().trim().max(100).optional(),
  reason: z.string().trim().min(1).max(255).optional(),
  requestedquantity: z.coerce.number().int().positive().default(1),
  requestedresolution: requestedResolutionSchema,
  ispackageopened: z.coerce.boolean().optional(),
  additionalremarks: z.string().trim().max(3000).optional(),
  attachments: z.array(returnRequestAttachmentInputSchema).default([]),
}).refine(
  (data) => data.policyreasonruleid || data.reasoncode || data.reason,
  'Provide policyreasonruleid, reasoncode, or reason'
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
  auto_create_pickup: z.literal(false).optional().default(false),
  pickup_created_by: z.literal('admin').optional().default('admin'),
  create_reverse_shipment: z.coerce.boolean().optional().default(false),
  logistics_provider_source: z.enum(['original_forward_provider', 'configured_provider', 'manual', 'undecided']).default('undecided'),
  reverse_shipping_charge_bearer: z.literal('nivaana').optional().default('nivaana'),
  reverse_shipping_charge_adjustment: z.literal('none').optional().default('none'),
  reverse_shipment_tracking_id: optionalTrimmedString(500),
  reverse_shipment_provider: optionalTrimmedString(100),
  seller_name: optionalTrimmedString(255),
  seller_address: optionalTrimmedString(1000),
  seller_gst_tin: optionalTrimmedString(50),
  seller_location_alias: optionalTrimmedString(100),
  pickup_location_name: optionalTrimmedString(100),
  return_location_name: optionalTrimmedString(100),
  invoice_number: optionalTrimmedString(100),
  invoice_date: optionalDateString,
  item_description: optionalTrimmedString(500),
  return_reason: optionalTrimmedString(255),
  length: z.coerce.number().positive().optional(),
  width: z.coerce.number().positive().optional(),
  height: z.coerce.number().positive().optional(),
  weight: z.coerce.number().positive().optional(),
  qc_shipment: z.coerce.boolean().optional(),
  remarks: z.string().trim().max(3000).optional(),
});

export const markReturnReceivedSchema = z.object({
  receivedquantity: z.coerce.number().int().positive().optional(),
  receivedcondition: z.enum(['unknown', 'apparently_resellable', 'apparently_damaged', 'package_damaged', 'mismatch']).default('unknown'),
  receivedlocation: z.string().trim().max(255).optional(),
  remarks: z.string().trim().max(3000).optional(),
});

export const inspectionConditionSchema = z.enum(['resellable', 'damaged', 'incorrect_product', 'other']);
export const restockActionSchema = z.enum(['available', 'damaged', 'quarantine', 'on_hold', 'none']);

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
  (data) => data.approvedquantity > 0 || ['none', 'on_hold'].includes(data.restockaction),
  'restockaction must be none or on_hold when approvedquantity is 0'
).refine(
  (data) => data.restockaction !== 'on_hold' || data.approvedquantity === 0,
  'on_hold restock action is only for rejected-only inspection passes'
).refine(
  (data) => data.condition !== 'resellable' || ['available', 'none'].includes(data.restockaction),
  'resellable inspection can use available or none restock action'
).refine(
  (data) => data.condition !== 'damaged' || ['damaged', 'quarantine', 'on_hold', 'none'].includes(data.restockaction),
  'damaged inspection can use damaged, quarantine, on_hold, or none restock action'
).refine(
  (data) => !['incorrect_product', 'other'].includes(data.condition) || ['quarantine', 'on_hold', 'none'].includes(data.restockaction),
  'exception inspections can use quarantine, on_hold, or none restock action'
).refine(
  (data) => data.rejectedquantity === 0 || data.restockaction === 'on_hold' || data.restockaction === 'none',
  'rejected quantities can only use on_hold or none restock action'
);

export const completeReturnResolutionSchema = z.object({
  action_type: z.enum(['refund', 'partial_refund', 'replacement_shipment', 'missing_item_shipment']),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']).default('completed'),
  amount: z.coerce.number().min(0).optional(),
  refund_method: z.enum(['original_payment', 'wallet', 'manual']).optional(),
  process_original_payment_refund: z.coerce.boolean().optional().default(false),
  external_reference: z.string().trim().max(500).optional(),
  shipment_tracking_id: z.string().trim().max(500).optional(),
  shipment_provider: z.string().trim().max(100).optional(),
  quantity: z.coerce.number().int().positive().optional(),
  stock_fallback_applied: z.coerce.boolean().optional().default(false),
  metadata: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().trim().max(3000).optional(),
}).refine(
  (data) => !['refund', 'partial_refund'].includes(data.action_type) || data.amount === undefined || data.amount > 0,
  'Refund amount must be greater than 0'
).refine(
  (data) => data.action_type !== 'partial_refund' || data.amount !== undefined,
  'Partial refund amount is required'
).refine(
  (data) => !['refund', 'partial_refund'].includes(data.action_type) || Boolean(data.refund_method),
  'refund_method is required for refund actions'
).refine(
  (data) => !['replacement_shipment', 'missing_item_shipment'].includes(data.action_type) || Boolean(data.shipment_tracking_id || data.external_reference || data.status === 'pending'),
  'shipment tracking or external reference is required for completed shipment actions'
);

export const updateReturnShipmentStatusSchema = z.object({
  resolution_action_id: z.coerce.number().int().positive().optional(),
  shipment_tracking_id: z.string().trim().max(500).optional(),
  shipment_provider: z.string().trim().max(100).optional(),
  status: z.enum(['shipped', 'in_transit', 'delivered', 'failed', 'returned']),
  event_time: z.coerce.number().int().positive().optional(),
  remarks: z.string().trim().max(3000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(
  (data) => Boolean(data.resolution_action_id || data.shipment_tracking_id),
  'resolution_action_id or shipment_tracking_id is required'
);

export const updateReturnRefundStatusSchema = z.object({
  resolution_action_id: z.coerce.number().int().positive().optional(),
  external_reference: z.string().trim().max(500).optional(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
  event_time: z.coerce.number().int().positive().optional(),
  remarks: z.string().trim().max(3000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(
  (data) => Boolean(data.resolution_action_id || data.external_reference),
  'resolution_action_id or external_reference is required'
);

export const createReturnCreditNoteSchema = z.object({
  resolution_action_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['draft', 'issued']).default('draft'),
  refund_amount: z.coerce.number().positive().optional(),
  taxable_amount: z.coerce.number().min(0).optional(),
  gst_rate: z.coerce.number().min(0).max(100).optional(),
  cgst_amount: z.coerce.number().min(0).optional(),
  sgst_amount: z.coerce.number().min(0).optional(),
  igst_amount: z.coerce.number().min(0).optional(),
  total_gst_amount: z.coerce.number().min(0).optional(),
  hsn_code: z.string().trim().max(50).optional(),
  original_invoice_number: z.string().trim().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().trim().max(3000).optional(),
});

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

export const returnOperationsSummaryQuerySchema = z.object({
  from: z.coerce.number().int().positive().optional(),
  to: z.coerce.number().int().positive().optional(),
  requesttype: returnRequestTypeSchema.optional(),
  source: returnRequestSourceSchema.optional(),
  status: z.string().optional(),
  reasoncode: z.string().optional(),
}).refine(
  (data) => !data.from || !data.to || data.to >= data.from,
  'to must be greater than or equal to from'
);

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
export type CompleteReturnResolutionInput = z.infer<typeof completeReturnResolutionSchema>;
export type UpdateReturnShipmentStatusInput = z.infer<typeof updateReturnShipmentStatusSchema>;
export type UpdateReturnRefundStatusInput = z.infer<typeof updateReturnRefundStatusSchema>;
export type CreateReturnCreditNoteInput = z.infer<typeof createReturnCreditNoteSchema>;
export type ReturnOperationsSummaryQuery = z.infer<typeof returnOperationsSummaryQuerySchema>;
export type ReturnRequestQuery = z.infer<typeof returnRequestQuerySchema>;
export type AddReturnRequestAttachmentInput = z.infer<typeof addReturnRequestAttachmentSchema>;
export type ReturnRequestAttachmentInput = z.infer<typeof returnRequestAttachmentInputSchema>;
