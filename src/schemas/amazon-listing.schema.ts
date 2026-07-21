import { z } from 'zod';

const optionalTrimmed = (maxLength: number) => z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).max(maxLength).optional()
);

const optionalUppercaseEnum = <T extends [string, ...string[]]>(values: T) => z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().transform((value) => value.toUpperCase()).pipe(z.enum(values)).optional()
);

const positiveInteger = (defaultValue: number, maximum: number) => z.preprocess(
  (value) => value === undefined || value === '' ? defaultValue : value,
  z.coerce.number().int().min(1).max(maximum)
);

export const amazonListingQuerySchema = z.object({
  search: optionalTrimmed(255),
  mappingStatus: optionalUppercaseEnum(['UNMAPPED', 'MAPPED', 'CONFLICT']),
  fulfilmentChannel: optionalUppercaseEnum(['MFN', 'EASY_SHIP', 'FBA', 'UNKNOWN']),
  listingStatus: optionalTrimmed(255),
  page: positiveInteger(1, 1_000_000),
  limit: positiveInteger(20, 100),
}).strict();

const positiveBigIntId = z.preprocess(
  (value) => typeof value === 'number' ? String(value) : value,
  z.string().trim().regex(/^[1-9]\d*$/, 'must be a positive integer identifier')
);

export const amazonListingParamsSchema = z.object({
  listingId: positiveBigIntId,
}).strict();

export const mapAmazonListingSchema = z.object({
  productId: positiveBigIntId,
  unitsPerListing: z.coerce.number().int().min(1).max(10_000).default(1),
  allowRemap: z.preprocess(
    (value) => value === 'true' ? true : value === 'false' ? false : value,
    z.boolean().default(false)
  ),
}).strict();

export const bulkMapAmazonListingsSchema = z.object({
  items: z.array(z.object({
    listingId: positiveBigIntId,
    productId: positiveBigIntId,
    unitsPerListing: z.coerce.number().int().min(1).max(10_000).default(1),
    allowRemap: z.boolean().default(false),
  }).strict()).min(1).max(100),
}).strict();

export const amazonInventorySyncSchema = z.object({
  previewId: positiveBigIntId,
}).strict();

export const amazonInventorySyncModeSchema = z.object({
  mode: z.enum(['DISABLED', 'MANUAL', 'AUTOMATIC']),
}).strict();

export const amazonInventoryRetrySchema = z.object({
  attemptId: positiveBigIntId,
}).strict();

export const amazonInventoryBulkPreviewSchema = z.object({
  listingIds: z.array(positiveBigIntId).min(1).max(25),
}).strict();

export const amazonInventoryBulkSyncSchema = z.object({
  items: z.array(z.object({
    listingId: positiveBigIntId,
    previewId: positiveBigIntId,
  }).strict()).min(1).max(25),
}).strict();

export type AmazonListingQueryInput = z.infer<typeof amazonListingQuerySchema>;
export type MapAmazonListingInput = z.infer<typeof mapAmazonListingSchema>;
export type BulkMapAmazonListingsInput = z.infer<typeof bulkMapAmazonListingsSchema>;
