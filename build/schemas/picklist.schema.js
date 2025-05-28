import { z } from 'zod';
import { picklistTypes } from '../config/dynamicFieldConfig.js';
export const createPicklistSchema = z.object({
    type: z.enum(Object.values(picklistTypes), {
        errorMap: () => ({ message: 'Invalid picklist type' }),
    }),
    table: z.string().min(1, 'Table is required').max(100),
    field: z.string().min(1, 'Field is required').max(100),
    label: z.string().min(1, 'Label is required').max(255),
    value: z.string().min(1, 'Value is required').max(255),
    ordering: z.number().int().min(0).default(0),
});
export const updatePicklistSchema = createPicklistSchema.partial().omit({ type: true });
export const picklistParamsSchema = z.object({
    id: z.string().uuid('Invalid picklist ID'),
});
export const picklistQuerySchema = z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    type: z.string().optional(),
    table: z.string().optional(),
    field: z.string().optional(),
    label: z.string().optional(),
    value: z.string().optional(),
    isActive: z.string().optional(),
});
//# sourceMappingURL=picklist.schema.js.map