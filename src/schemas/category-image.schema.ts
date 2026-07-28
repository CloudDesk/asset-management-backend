import { z } from 'zod';

export const categoryImageParamsSchema = z.object({
  picklistId: z.string().regex(/^\d+$/, 'Picklist ID must be a valid integer'),
});

export const categoryImageQuerySchema = z.object({
  fieldname: z.enum(['category', 'subcategory']).optional(),
  isactive: z.enum(['true', 'false']).optional(),
  search: z.string().trim().max(255).optional(),
});

export const updateCategoryImageSchema = z.object({
  alttext: z.string().trim().max(255).nullable().optional(),
  isactive: z.boolean().optional(),
}).strict();

export type CategoryImageQuery = z.infer<typeof categoryImageQuerySchema>;
export type UpdateCategoryImageInput = z.infer<typeof updateCategoryImageSchema>;
