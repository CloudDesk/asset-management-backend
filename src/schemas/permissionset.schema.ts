import { z } from 'zod';

// Permission object schema (for JSONB validation)
const permissionObjectSchema = z.object({
  object: z.string().min(1, 'Object is required'),
  read: z.boolean().optional(),
  create: z.boolean().optional(),
  edit: z.boolean().optional(),
  delete: z.boolean().optional(),
  export: z.boolean().optional(),
  import: z.boolean().optional(),
  approve: z.boolean().optional(),
  reject: z.boolean().optional(),
  viewall: z.boolean().optional(),
  modifyall: z.boolean().optional(),
  deleteall: z.boolean().optional(),
  accesslevel: z.enum(['all', 'own', 'subordinates']).optional(),
  customactions: z.record(z.string(), z.boolean()).optional(),
}).passthrough();

// Create permission set schema
export const createPermissionSetSchema = z.object({
  name: z.string().max(200).min(1, 'Name is required'),
  description: z.string().max(500).optional(),
  roleid: z.preprocess(
    (val) => {
      // Convert 0 to null, keep null as null, keep positive numbers as-is
      if (val === 0 || val === '0' || val === null || val === undefined) {
        return null;
      }
      return val;
    },
    z.union([
      z.null(),
      z.number().int().positive()
    ])
  ).optional(), // NULL for system-wide default
  isactive: z.boolean().default(true),
  isdefault: z.boolean().default(false), // System-wide default (not per-role) - used as fallback
  permissions: z.array(permissionObjectSchema).min(1, 'At least one permission is required'),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough().refine(
  (data) => {
    // Rule 1: If roleid is null, isdefault MUST be true (system-wide default)
    if (data.roleid === null && data.isdefault !== true) {
      return false;
    }
    // Rule 2: If isdefault is false, roleid must be provided (role-specific)
    if (data.isdefault === false && !data.roleid) {
      return false; // Role-specific sets must have roleid
    }
    return true;
  },
  {
    message: 'If roleid is null, isdefault must be true (system-wide default). If isdefault is false, roleid must be provided (role-specific).',
  }
);

// Update permission set schema
export const updatePermissionSetSchema = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(500).optional(),
  roleid: z.preprocess(
    (val) => {
      // Convert 0 to null, keep null as null, keep positive numbers as-is
      if (val === 0 || val === '0' || val === null || val === undefined) {
        return null;
      }
      return val;
    },
    z.union([
      z.null(),
      z.number().int().positive()
    ])
  ).optional(), // NULL for system-wide default
  isactive: z.boolean().optional(),
  isdefault: z.boolean().optional(), // System-wide default (not per-role)
  permissions: z.array(permissionObjectSchema).optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough().refine(
  (data) => {
    // Rule 1: If roleid is null, isdefault MUST be true (system-wide default)
    if (data.roleid === null && data.isdefault !== undefined && data.isdefault !== true) {
      return false;
    }
    // Rule 2: If isdefault is false, roleid must be provided (role-specific)
    if (data.isdefault === false && data.roleid === null) {
      return false; // Role-specific sets must have roleid
    }
    return true;
  },
  {
    message: 'If roleid is null, isdefault must be true (system-wide default). If isdefault is false, roleid must be provided (role-specific).',
  }
);

// Permission set params schema
export const permissionSetParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number'),
});

export type PermissionSetParams = z.infer<typeof permissionSetParamsSchema>;
export type CreatePermissionSetInput = z.infer<typeof createPermissionSetSchema>;
export type UpdatePermissionSetInput = z.infer<typeof updatePermissionSetSchema>;

