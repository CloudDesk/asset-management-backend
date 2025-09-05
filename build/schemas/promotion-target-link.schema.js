import { z } from 'zod';
// Validation schema for creating a promotion target link
export const createPromotionTargetLinkSchema = z.object({
    promotion_id: z.number().int().positive().optional(),
    target_type: z.string().optional(),
    target_id: z.string().optional(),
    target_label: z.string().optional(),
    apply_scope: z.string().optional(),
    is_active: z.boolean().optional(),
}).passthrough();
// Validation schema for updating a promotion target link
export const updatePromotionTargetLinkSchema = z.object({
    promotion_id: z.number().int().positive().optional(),
    target_type: z.string().optional(),
    target_id: z.string().optional(),
    target_label: z.string().optional(),
    apply_scope: z.string().optional(),
    is_active: z.boolean().optional(),
}).passthrough();
// Schema for upserting (create or update)
export const upsertPromotionTargetLinkSchema = z.object({
    id: z.number().int().optional(),
    promotion_id: z.number().int().positive().optional(),
    target_type: z.string().optional(),
    target_id: z.string().optional(),
    target_label: z.string().optional(),
    apply_scope: z.string().optional(),
    is_active: z.boolean().optional(),
}).passthrough();
// Schema for URL params with ID
export const promotionTargetLinkParamsSchema = z.object({
    id: z.string().regex(/^\d+$/, 'ID must be a valid integer')
});
// Schema for query parameters
export const promotionTargetLinkQuerySchema = z.object({
    // Pagination
    page: z.string().optional(),
    limit: z.string().optional(),
    // Filter fields
    promotion_id: z.string().optional(),
    target_type: z.string().optional(),
    target_id: z.string().optional(),
    target_label: z.string().optional(),
    apply_scope: z.string().optional(),
    is_active: z.string().optional(),
});
//# sourceMappingURL=promotion-target-link.schema.js.map