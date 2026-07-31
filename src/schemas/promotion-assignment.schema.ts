import { z } from 'zod';

export const createPromotionAssignmentSchema = z.object({
  assignment_type: z.enum(['customer', 'customer_group']),
  customer_id: z.number().int().positive().optional(),
  customer_group_id: z.number().int().positive().optional(),
  prefix: z.string().min(1).max(30).optional(),
  voucher_code: z.string().min(4).max(100).optional(),
  usage_limit: z.number().int().positive().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().nullable().optional(),
}).superRefine((value, context) => {
  if (value.assignment_type === 'customer' && !value.customer_id) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['customer_id'], message: 'customer_id is required' });
  }
  if (value.assignment_type === 'customer_group' && !value.customer_group_id) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['customer_group_id'], message: 'customer_group_id is required' });
  }
});

export const updatePromotionAssignmentSchema = z.object({
  status: z.enum(['active', 'inactive', 'expired']).optional(),
  assignment_type: z.enum(['customer', 'customer_group']).optional(),
  customer_id: z.number().int().positive().nullable().optional(),
  customer_group_id: z.number().int().positive().nullable().optional(),
  voucher_code: z.string().min(4).max(100).optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  start_date: z.string().datetime().nullable().optional(),
  end_date: z.string().datetime().nullable().optional(),
});

export const createCustomerGroupSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(2).max(100),
  description: z.string().optional(),
});

export const updateCustomerGroupSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const addCustomerGroupMembersSchema = z.object({
  customer_ids: z.array(z.number().int().positive()).min(1),
});

export type CreatePromotionAssignmentInput = z.infer<typeof createPromotionAssignmentSchema>;
export type UpdatePromotionAssignmentInput = z.infer<typeof updatePromotionAssignmentSchema>;
export type CreateCustomerGroupInput = z.infer<typeof createCustomerGroupSchema>;
export type UpdateCustomerGroupInput = z.infer<typeof updateCustomerGroupSchema>;
