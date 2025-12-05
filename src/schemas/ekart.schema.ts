import { z } from 'zod';

// Location schema
export const locationSchema = z.object({
  location_type: z.enum(['Home', 'Office']).optional(),
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  country: z.string().optional().default('India'),
  pin: z.number().int().positive('PIN must be a positive number'),
  phone: z.number().int().positive('Phone must be a positive number')
});

// QC Details schema
export const qcDetailsSchema = z.object({
  qc_shipment: z.boolean(),
  product_name: z.string().min(1, 'Product name is required'),
  product_desc: z.string().optional(),
  product_sku: z.string().optional(),
  product_color: z.string().optional(),
  product_size: z.string().optional(),
  brand_name: z.string().optional(),
  product_category: z.string().optional(),
  ean_barcode: z.string().optional(),
  serial_number: z.string().optional(),
  imei_number: z.string().optional(),
  product_images: z.array(z.string().url()).optional()
});

// Item schema
export const itemSchema = z.object({
  product_name: z.string().min(1),
  sku: z.string().min(1),
  taxable_value: z.number().positive(),
  description: z.string().optional(),
  quantity: z.number().int().positive(),
  length: z.number().nonnegative(),
  height: z.number().nonnegative(),
  breadth: z.number().nonnegative(),
  weight: z.number().nonnegative(),
  hsn_code: z.string().optional(),
  cgst_tax_value: z.number().nonnegative().optional(),
  sgst_tax_value: z.number().nonnegative().optional(),
  igst_tax_value: z.number().nonnegative().optional()
});

// Base shipment schema
const baseShipmentSchema = z.object({
  seller_name: z.string().min(1, 'Seller name is required'),
  seller_address: z.string().min(1, 'Seller address is required'),
  seller_gst_tin: z.string().min(1, 'Seller GST TIN is required'),
  order_number: z.string().min(1, 'Order number is required'),
  invoice_number: z.string().min(1, 'Invoice number is required'),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invoice date must be in YYYY-MM-DD format'),
  consignee_name: z.string().min(1, 'Consignee name is required'),
  products_desc: z.string().min(1, 'Products description is required'),
  payment_mode: z.enum(['COD', 'Prepaid', 'Pickup']),
  total_amount: z.number().positive('Total amount must be positive'),
  tax_value: z.number().nonnegative('Tax value must be non-negative'),
  taxable_amount: z.number().positive('Taxable amount must be positive'),
  commodity_value: z.string().min(1, 'Commodity value is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  weight: z.number().positive('Weight must be positive'),
  drop_location: locationSchema,
  
  // Dimension fields (either templateName OR length/width/height)
  templateName: z.string().optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  
  // Optional fields
  seller_gst_amount: z.number().nonnegative().optional(),
  consignee_gst_amount: z.number().nonnegative().optional(),
  integrated_gst_amount: z.number().nonnegative().optional(),
  consignee_gst_tin: z.string().optional(),
  ewbn: z.string().optional(),
  document_number: z.string().optional(),
  document_date: z.string().optional(),
  hsn_code: z.string().optional(),
  category_of_goods: z.string().optional(),
  cod_amount: z.number().nonnegative().optional(),
  return_reason: z.string().optional(),
  pickup_location: z.object({ name: z.string() }).optional(),
  return_location: z.object({ name: z.string() }).optional(),
  qc_details: qcDetailsSchema.optional(),
  items: z.array(itemSchema).optional(),
  what3words_address: z.string().optional()
}).refine((data) => {
  // Either templateName OR dimensions must be provided
  const hasTemplate = !!data.templateName;
  const hasDimensions = !!(data.length && data.width && data.height);
  
  if (!hasTemplate && !hasDimensions) {
    return false;
  }
  
  if (hasTemplate && hasDimensions) {
    return false; // Cannot have both
  }
  
  return true;
}, {
  message: 'Either templateName OR (length, width, height) must be provided, but not both',
  path: ['templateName']
}).refine((data) => {
  // If payment_mode is COD, cod_amount must equal total_amount
  if (data.payment_mode === 'COD') {
    return data.cod_amount === data.total_amount;
  }
  // If payment_mode is Prepaid, cod_amount must be 0 or not provided
  if (data.payment_mode === 'Prepaid') {
    return !data.cod_amount || data.cod_amount === 0;
  }
  return true;
}, {
  message: 'For COD: cod_amount must equal total_amount. For Prepaid: cod_amount must be 0 or omitted',
  path: ['cod_amount']
});

// Forward shipment schema (Prepaid or COD)
export const forwardShipmentSchema = baseShipmentSchema.refine((data) => {
  return data.payment_mode === 'COD' || data.payment_mode === 'Prepaid';
}, {
  message: 'Forward shipments must have payment_mode of COD or Prepaid',
  path: ['payment_mode']
});

// Reverse shipment schema (Pickup)
export const reverseShipmentSchema = baseShipmentSchema.refine((data) => {
  return data.payment_mode === 'Pickup';
}, {
  message: 'Reverse shipments must have payment_mode of Pickup',
  path: ['payment_mode']
}).refine((data) => {
  return !!data.return_reason;
}, {
  message: 'return_reason is required for reverse shipments',
  path: ['return_reason']
});

// Export schemas with dimensions (already included in base schema)
export const forwardShipmentSchemaWithDimensions = forwardShipmentSchema;
export const reverseShipmentSchemaWithDimensions = reverseShipmentSchema;

// Track shipment schema
export const trackShipmentSchema = z.object({
  trackingId: z.string().min(1, 'Tracking ID is required')
});

// Cancel shipment schema
export const cancelShipmentSchema = z.object({
  trackingId: z.string().min(1, 'Tracking ID is required')
});

// Download label schema
export const downloadLabelSchema = z.object({
  trackingIds: z.array(z.string().min(1)).min(1, 'At least one tracking ID is required')
});

// Shipping rates schema
export const shippingRatesSchema = z.object({
  pickupPincode: z.number().int().positive('Pickup pincode must be a positive number'),
  dropPincode: z.number().int().positive('Drop pincode must be a positive number'),
  invoiceAmount: z.number().nonnegative('Invoice amount must be non-negative'),
  weight: z.number().positive('Weight must be positive'),
  length: z.number().positive('Length must be positive'),
  height: z.number().positive('Height must be positive'),
  width: z.number().positive('Width must be positive'),
  serviceType: z.string().min(1, 'Service type is required'),
  codAmount: z.number().nonnegative('COD amount must be non-negative'),
  packages: z.array(z.object({
    length: z.number().positive(),
    height: z.number().positive(),
    width: z.number().positive(),
    count: z.string().min(1)
  })).min(1, 'At least one package is required')
});

// Type exports
export type ForwardShipmentInput = z.infer<typeof forwardShipmentSchemaWithDimensions>;
export type ReverseShipmentInput = z.infer<typeof reverseShipmentSchemaWithDimensions>;
export type TrackShipmentInput = z.infer<typeof trackShipmentSchema>;
export type CancelShipmentInput = z.infer<typeof cancelShipmentSchema>;
export type DownloadLabelInput = z.infer<typeof downloadLabelSchema>;
export type ShippingRatesInput = z.infer<typeof shippingRatesSchema>;

