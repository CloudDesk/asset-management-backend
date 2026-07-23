import { z } from 'zod';

const optionalText = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).max(255).optional()
);

export const amazonOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: optionalText,
  orderStatus: optionalText,
  syncState: optionalText,
  fulfilmentType: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.enum(['FBA', 'EASY_SHIP', 'MFN', 'UNKNOWN']).optional()
  ),
}).strict();

export const amazonOrderImportSchema = z.object({
  fullHistory: z.boolean().default(false),
}).strict();

export const amazonOrderNotificationSchema = z.object({
  notificationId: z.string().trim().min(1).max(255),
  notificationType: z.string().trim().min(1).max(100),
  sellerId: z.string().trim().min(1).max(255),
  marketplaceId: z.string().trim().min(1).max(50),
  eventTime: z.string().datetime(),
  payload: z.unknown(),
}).strict();

const positiveMeasure = z.coerce.number().positive().max(100_000);

export const amazonOrderPackSchema = z.object({
  weightGrams: z.coerce.number().int().min(11).max(1_000_000),
  lengthCm: positiveMeasure,
  widthCm: positiveMeasure,
  heightCm: positiveMeasure,
  packageIdentifier: optionalText,
}).strict();

export const amazonOrderShippingMethodSchema = z.object({
  shippingMethod: z.string().trim().min(1).max(100),
  logisticsPartner: optionalText,
}).strict();

export const amazonOrderDocumentsSchema = z.object({
  invoiceUrl: z.string().url().max(2_000).optional(),
  packingSlipUrl: z.string().url().max(2_000).optional(),
  shippingLabelUrl: z.string().url().max(2_000).optional(),
}).strict().refine((value) => Object.values(value).some(Boolean), 'At least one document URL is required');

export const amazonOrderTrackingSchema = z.object({
  courierCode: z.string().trim().min(1).max(100),
  courierName: z.string().trim().min(1).max(255),
  trackingNumber: z.string().trim().min(1).max(255),
  shippingDate: z.string().datetime(),
}).strict();

export const amazonEasyShipPackageSchema = z.object({
  weightGrams: z.coerce.number().int().min(11).max(1_000_000),
  lengthCm: positiveMeasure,
  widthCm: positiveMeasure,
  heightCm: positiveMeasure,
}).strict();

export const amazonEasyShipSlotSchema = z.object({
  slotId: z.string().trim().min(1).max(255),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  handoverMethod: z.enum(['PICKUP', 'DROPOFF']).optional(),
}).strict();

export const amazonEasyShipScheduleSchema = amazonEasyShipPackageSchema.extend({
  slot: amazonEasyShipSlotSchema,
  packageIdentifier: optionalText,
}).strict();

export const amazonEasyShipRescheduleSchema = z.object({ slot: amazonEasyShipSlotSchema }).strict();

export const amazonFulfillmentExceptionResolutionSchema = z.object({
  note: z.string().trim().min(1).max(2_000),
}).strict();
