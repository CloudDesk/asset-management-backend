import { z } from 'zod';
// Updated schema to match the actual database structure
export const createPicklistSchema = z.object({
    label: z.string().min(1, 'Label is required').max(255),
    value: z.string().min(1, 'Value is required').max(255),
    object: z.string().max(255).optional(),
    controlledvalue: z.string().max(255).optional(),
    fieldname: z.string().max(255).optional(),
    controlledlabel: z.string().max(255).optional(),
    controlledfieldname: z.string().max(255).optional(),
    parent: z.string().max(255).optional(),
    description: z.string().max(255).optional(),
    sortorder: z.number().int().optional(),
    isactive: z.boolean().optional().nullable(),
});
export const updatePicklistSchema = createPicklistSchema.partial();
export const picklistParamsSchema = z.object({
    id: z.string().regex(/^\d+$/, 'Invalid picklist ID - must be an integer'),
});
export const picklistQuerySchema = z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    label: z.string().optional(),
    value: z.string().optional(),
    object: z.string().optional(),
    controlledvalue: z.string().optional(),
    fieldname: z.string().optional(),
    controlledlabel: z.string().optional(),
    controlledfieldname: z.string().optional(),
    parent: z.string().optional(),
});
//# sourceMappingURL=picklist.schema.js.map