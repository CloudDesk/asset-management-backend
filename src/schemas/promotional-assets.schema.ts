import { z } from 'zod';

const assetTypeEnum = z.enum(['banner', 'featured_ad', 'popup', 'carousel']);
const auditActionEnum = z.enum(['create', 'update', 'delete']);

const basePromotionalAssetSchema = z.object({
  type: assetTypeEnum,
  placement: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  content: z.record(z.any()).refine(
    (data) => Object.keys(data).length > 0,
    { message: "Content cannot be empty" }
  ),
  priority: z.number().int().min(0).default(0),
  is_active: z.boolean({ required_error: "is_active must be a boolean" }).default(true),
  schedule_start: z.string().datetime().optional(),
  schedule_end: z.string().datetime().optional(),
});

export const createPromotionalAssetSchema = basePromotionalAssetSchema.refine(
  (data) => {
    if (data.schedule_start && data.schedule_end) {
      return new Date(data.schedule_start) <= new Date(data.schedule_end);
    }
    return true;
  },
  { message: "Schedule end must be after schedule start", path: ["schedule_end"] }
);

export const updatePromotionalAssetSchema = basePromotionalAssetSchema
  .partial()
  .extend({
    version: z.number().int().min(1).optional()
  })
  .refine(
    (data) => {
      if (data.schedule_start && data.schedule_end) {
        return new Date(data.schedule_start) <= new Date(data.schedule_end);
      }
      return true;
    },
    { message: "Schedule end must be after schedule start", path: ["schedule_end"] }
  );

export const promotionalAssetParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Invalid asset ID')
});

export const promotionalAssetQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  type: assetTypeEnum.optional(),
  placement: z.string().optional(),
  is_active: z.string().optional(),
  schedule_active: z.string().optional(),
  priority_min: z.string().optional(),
  priority_max: z.string().optional(),
}).passthrough();

export const auditLogQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
});

export type CreatePromotionalAssetInput = z.infer<typeof createPromotionalAssetSchema>;
export type UpdatePromotionalAssetInput = z.infer<typeof updatePromotionalAssetSchema>;
export type PromotionalAssetParams = z.infer<typeof promotionalAssetParamsSchema>;
export type PromotionalAssetQuery = z.infer<typeof promotionalAssetQuerySchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>; 