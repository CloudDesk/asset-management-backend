import { z } from 'zod';

// Create role schema
export const createRoleSchema = z.object({
  name: z.string().max(100, 'Role name must be 100 characters or fewer.').min(1, 'Role name is required.'),
  code: z.string()
    .max(50, 'Role code must be 50 characters or fewer.')
    .min(1, 'Role code is required.')
    .regex(/^[a-z0-9_]+$/, 'Role code can only use lowercase letters, numbers and underscores (e.g. super_admin).')
    .transform((val) => val.toLowerCase().trim()), // Normalize to lowercase
  level: z.number().int().min(1, 'Level must be 1 or higher.'),
  description: z.string().max(500, 'Description must be 500 characters or fewer.').optional(),
  isactive: z.boolean().default(true),
  issystem: z.boolean().default(false),
  parentroleid: z.preprocess(
    (val) => {
      // If undefined, keep it undefined (field is optional)
      if (val === undefined) return undefined;
      // If null, keep it null (explicit null is allowed)
      if (val === null) return null;
      // Convert 0 to null (0 means no parent)
      if (val === 0 || val === '0') return null;
      // Return other values as-is for validation
      return val;
    },
    z.union([
      z.number().int().positive(), // Must be positive integer if provided
      z.null() // Or null
    ]).optional() // Field itself is optional
  ),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough();

// Update role schema
export const updateRoleSchema = z.object({
  name: z.string().max(100, 'Role name must be 100 characters or fewer.').optional(),
  code: z.string()
    .max(50, 'Role code must be 50 characters or fewer.')
    .min(1, 'Role code is required.')
    .regex(/^[a-z0-9_]+$/, 'Role code can only use lowercase letters, numbers and underscores (e.g. super_admin).')
    .transform((val) => val.toLowerCase().trim()) // Normalize to lowercase
    .optional(),
  level: z.number().int().min(1, 'Level must be 1 or higher.').optional(),
  description: z.string().max(500, 'Description must be 500 characters or fewer.').optional(),
  isactive: z.boolean().optional(),
  issystem: z.boolean().optional(),
  parentroleid: z.preprocess(
    (val) => {
      // If undefined, keep it undefined (field is optional)
      if (val === undefined) return undefined;
      // If null, keep it null (explicit null is allowed)
      if (val === null) return null;
      // Convert 0 to null (0 means no parent)
      if (val === 0 || val === '0') return null;
      // Return other values as-is for validation
      return val;
    },
    z.union([
      z.number().int().positive(), // Must be positive integer if provided
      z.null() // Or null
    ]).optional() // Field itself is optional
  ),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough();

// Role params schema
export const roleParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number'),
});

export type RoleParams = z.infer<typeof roleParamsSchema>;
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

