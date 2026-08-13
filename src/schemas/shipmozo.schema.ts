import { z } from 'zod';

const nonEmptyString = z.string().trim().min(1);
const identifierString = z.coerce.string().trim().min(1);
const phoneString = z.coerce.string().trim().regex(/^\d{10,15}$/, 'Phone number must contain 10 to 15 digits');
const optionalPhoneString = z.union([phoneString, z.literal('')]).optional().default('');
const indianPincodeString = z.coerce.string().trim().regex(/^\d{6}$/, 'Pincode must be 6 digits');

export const shipmozoProductSchema = z.object({
  name: nonEmptyString.max(200, 'Product name must not exceed 200 characters'),
  sku_number: identifierString,
  quantity: z.coerce.number().int().positive(),
  discount: z.coerce.number().nonnegative().default(0),
  hsn: z.string().trim().default(''),
  unit_price: z.coerce.number().nonnegative(),
  product_category: z.string().trim().default('Other')
});

export const shipmozoPushOrderSchema = z.object({
  order_id: identifierString,
  order_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Order date must use YYYY-MM-DD'),
  consignee_name: nonEmptyString,
  consignee_phone: phoneString,
  consignee_alternate_phone: optionalPhoneString,
  consignee_email: z.string().trim().email().or(z.literal('')).optional().default(''),
  consignee_address_line_one: nonEmptyString,
  consignee_address_line_two: z.string().trim().optional().default(''),
  consignee_pin_code: indianPincodeString,
  consignee_city: nonEmptyString,
  consignee_state: nonEmptyString,
  product_detail: z.array(shipmozoProductSchema).min(1),
  payment_type: z.enum(['PREPAID', 'COD']),
  cod_amount: z.coerce.number().nonnegative().optional().default(0),
  shipping_charges: z.coerce.number().nonnegative().optional().default(0),
  weight: z.coerce.number().positive('Weight in grams must be positive'),
  length: z.coerce.number().positive(),
  width: z.coerce.number().positive(),
  height: z.coerce.number().positive(),
  warehouse_id: z.coerce.string().trim().optional(),
  gst_ewaybill_number: z.string().trim().optional().default(''),
  gstin_number: z.string().trim().optional().default(''),
  assignment_mode: z.enum(['AUTO', 'MANUAL']).optional(),
  courier_id: z.string().trim().optional(),
  schedule_pickup: z.boolean().optional().default(false)
}).superRefine((value, ctx) => {
  if (value.payment_type === 'COD' && value.cod_amount <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cod_amount'],
      message: 'cod_amount must be greater than 0 for COD shipments'
    });
  }

  if (value.payment_type === 'PREPAID' && value.cod_amount !== 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cod_amount'],
      message: 'cod_amount must be 0 for prepaid shipments'
    });
  }

  if (value.assignment_mode === 'MANUAL' && !value.courier_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['courier_id'],
      message: 'courier_id is required for manual courier assignment'
    });
  }
});

export const shipmozoServiceabilitySchema = z.object({
  pickup_pincode: z.string().trim().regex(/^\d{6}$/),
  delivery_pincode: z.string().trim().regex(/^\d{6}$/)
});

export const shipmozoRateSchema = z.object({
  order_id: z.string().trim().optional().default(''),
  pickup_pincode: z.string().trim().regex(/^\d{6}$/),
  delivery_pincode: z.string().trim().regex(/^\d{6}$/),
  payment_type: z.enum(['PREPAID', 'COD']),
  shipment_type: z.enum(['FORWARD', 'RETURN']).optional().default('FORWARD'),
  order_amount: z.coerce.number().nonnegative(),
  type_of_package: z.enum(['SPS', 'MPS', 'B2B']).optional().default('SPS'),
  rov_type: z.enum(['ROV_OWNER', 'ROV_CARRIER']).optional().default('ROV_OWNER'),
  cod_amount: z.coerce.number().nonnegative().optional().default(0),
  weight: z.coerce.number().positive(),
  dimensions: z.array(z.object({
    no_of_box: z.coerce.number().int().positive(),
    length: z.coerce.number().positive(),
    width: z.coerce.number().positive(),
    height: z.coerce.number().positive()
  })).min(1)
});

export const shipmozoTrackSchema = z.object({ awbNumber: nonEmptyString });
export const shipmozoLabelSchema = z.object({
  awbNumber: nonEmptyString,
  type: z.enum(['PDF']).optional().default('PDF')
});
export const shipmozoCancelSchema = z.object({
  order_id: nonEmptyString,
  awb_number: nonEmptyString
});
export const shipmozoSchedulePickupSchema = z.object({
  order_id: nonEmptyString,
  return_request_id: z.coerce.number().int().positive().optional()
});

export const shipmozoReturnOrderSchema = z.object({
  order_id: nonEmptyString,
  order_date: nonEmptyString,
  pickup_name: nonEmptyString,
  pickup_phone: nonEmptyString,
  pickup_email: z.string().trim().email().or(z.literal('')).optional().default(''),
  pickup_address_line_one: nonEmptyString,
  pickup_address_line_two: z.string().trim().optional().default(''),
  pickup_pin_code: z.string().trim().regex(/^\d{6}$/, 'Pickup pincode must be 6 digits'),
  pickup_city: nonEmptyString,
  pickup_state: nonEmptyString,
  product_detail: z.array(shipmozoProductSchema).min(1),
  payment_type: z.literal('PREPAID').default('PREPAID'),
  weight: z.coerce.number().positive('Weight in grams must be positive'),
  length: z.coerce.number().positive(),
  width: z.coerce.number().positive(),
  height: z.coerce.number().positive(),
  warehouse_id: z.string().trim().optional(),
  return_reason_id: nonEmptyString,
  customer_request: z.enum(['REFUND', 'EXCHANGE']),
  reason_comment: z.string().trim().optional().default(''),
  return_request_id: z.coerce.number().int().positive().optional(),
  schedule_pickup: z.boolean().optional().default(false)
});
export const shipmozoWarehouseQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional()
});

export type ShipmozoPushOrderInput = z.infer<typeof shipmozoPushOrderSchema>;
export type ShipmozoRateInput = z.infer<typeof shipmozoRateSchema>;
export type ShipmozoReturnOrderInput = z.infer<typeof shipmozoReturnOrderSchema>;
