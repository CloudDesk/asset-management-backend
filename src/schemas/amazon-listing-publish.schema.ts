import { z } from 'zod';

const positiveId = z.union([
  z.string().regex(/^[1-9]\d*$/, 'Must be a positive numeric identifier'),
  z.number().int().positive(),
  z.bigint().positive(),
]).transform((value) => String(value));

export const amazonPublishProductParamsSchema = z.object({
  productId: positiveId,
});

export const amazonPublishDraftParamsSchema = z.object({
  draftId: positiveId,
});

export const amazonPublishDraftBootstrapSchema = z.object({
  listingMode: z.enum(['UNDECIDED', 'MAP_EXISTING', 'OFFER_ONLY', 'FULL_CATALOG']).optional().default('UNDECIDED'),
}).strict();

export const amazonPublishDraftCancelSchema = z.object({
  draftRevision: z.number().int().positive(),
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();

export const amazonPublishDraftUpdateSchema = z.object({
  draftRevision: z.number().int().positive(),
  listingMode: z.enum(['UNDECIDED', 'MAP_EXISTING', 'OFFER_ONLY', 'FULL_CATALOG']).optional(),
  sellerSku: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/).optional(),
  mappedAttributes: z.record(z.unknown()).optional(),
}).strict().refine(
  (value) => value.listingMode !== undefined || value.sellerSku !== undefined || value.mappedAttributes !== undefined,
  'At least one draft field must be supplied'
);

const draftRevision = z.number().int().positive();
const identifierType = z.enum(['ASIN', 'EAN', 'GTIN', 'ISBN', 'JAN', 'MINSAN', 'SKU', 'UPC']);

export const amazonCatalogSearchSchema = z.object({
  draftRevision,
  identifiers: z.array(z.string().trim().min(1)).min(1).max(20).optional(),
  identifiersType: identifierType.optional(),
  keywords: z.array(z.string().trim().min(1)).min(1).max(20).optional(),
}).strict()
  .refine((value) => !(value.identifiers && value.keywords), 'Identifiers and keywords cannot be combined')
  .refine((value) => !value.identifiers || value.identifiersType, 'identifiersType is required with identifiers');

export const amazonAsinSelectionSchema = z.object({
  draftRevision,
  asin: z.string().trim().regex(/^[A-Z0-9]{10}$/, 'ASIN must contain 10 uppercase letters or digits'),
}).strict();

export const amazonNoCatalogMatchSchema = z.object({
  draftRevision,
  confirmed: z.literal(true),
}).strict();

export const amazonProductTypeSearchSchema = z.object({
  draftRevision,
  itemName: z.string().trim().min(1).max(500).optional(),
  keywords: z.array(z.string().trim().min(1)).min(1).max(20).optional(),
}).strict().refine((value) => !(value.itemName && value.keywords), 'itemName and keywords cannot be combined');

export const amazonProductTypeSelectionSchema = z.object({
  draftRevision,
  productType: z.string().trim().min(1).max(100),
}).strict();

export const amazonProductTypeDefinitionSchema = z.object({
  draftRevision,
}).strict();

export const amazonPublishValidationSchema = z.object({
  draftRevision,
}).strict();

export const amazonPublishSubmissionSchema = z.object({
  draftRevision,
  confirmed: z.literal(true),
  confirmationText: z.string().trim().min(1).max(255),
  idempotencyKey: z.string().uuid(),
}).strict();

export const amazonPublishCorrectionSchema = z.object({
  draftRevision,
  confirmed: z.literal(true),
  reason: z.string().trim().min(3).max(500),
}).strict();

export const amazonEligibilityCheckSchema = z.object({
  draftRevision,
  conditionType: z.enum([
    'new_new', 'new_open_box', 'new_oem', 'refurbished_refurbished',
    'used_like_new', 'used_very_good', 'used_good', 'used_acceptable',
    'collectible_like_new', 'collectible_very_good', 'collectible_good',
    'collectible_acceptable', 'club_club',
  ]).optional().default('new_new'),
}).strict();

export type AmazonPublishDraftBootstrapInput = z.infer<typeof amazonPublishDraftBootstrapSchema>;
export type AmazonPublishDraftCancelInput = z.infer<typeof amazonPublishDraftCancelSchema>;
