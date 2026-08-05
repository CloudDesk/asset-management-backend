import { z } from 'zod';

export const createCouponGroupSchema = z.object({
  name: z.string().trim().min(1).max(255),
  code: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(2000).optional(),
});

export const updateCouponGroupSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
}).refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export const addCouponGroupMembersSchema = z.object({
  customer_ids: z.array(z.number().int().positive()).min(1).max(500),
});

export type CreateCouponGroupInput = z.infer<typeof createCouponGroupSchema>;
export type UpdateCouponGroupInput = z.infer<typeof updateCouponGroupSchema>;
