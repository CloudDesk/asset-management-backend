import { z } from 'zod';

// Create inventoryusers schema based on actual database table
export const createInventoryUsersSchema = z.object({
  useremail: z.string().email().max(255).optional(),
  userpassword: z.string().max(255).optional(),
  role: z.string().max(500).optional(), // Legacy field - kept for backward compatibility
  roleid: z.preprocess((val) => (val === 0 || val === '0' ? null : val), z.number().int().positive().nullable().optional()), // Foreign key to roles.id
  usersphonenumber: z.coerce.number().optional(),
  firstname: z.string().max(255).optional(),
  lastname: z.string().max(255).optional(),
  location: z.string().max(500).optional(),
  fcmid: z.string().max(400).optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough(); // Allow any additional fields

export const updateInventoryUsersSchema = z.object({
  useremail: z.string().email().max(255).optional(),
  userpassword: z.string().max(255).optional(),
  role: z.string().max(500).optional(), // Legacy field - kept for backward compatibility
  roleid: z.preprocess((val) => (val === 0 || val === '0' ? null : val), z.number().int().positive().nullable().optional()), // Foreign key to roles.id
  usersphonenumber: z.coerce.number().optional(),
  firstname: z.string().max(255).optional(),
  lastname: z.string().max(255).optional(),
  location: z.string().max(500).optional(),
  fcmid: z.string().max(400).optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough();

export const upsertInventoryUsersSchema = z.object({
  id: z.number().int().positive().optional(),
  useremail: z.string().email().max(255).optional(),
  userpassword: z.string().max(255).optional(),
  role: z.string().max(500).optional(), // Legacy field - kept for backward compatibility
  roleid: z.preprocess((val) => (val === 0 || val === '0' ? null : val), z.number().int().positive().nullable().optional()), // Foreign key to roles.id
  usersphonenumber: z.coerce.number().optional(),
  firstname: z.string().max(255).optional(),
  lastname: z.string().max(255).optional(),
  location: z.string().max(500).optional(),
  fcmid: z.string().max(400).optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough();

export const inventoryUsersParamsSchema = z.object({
  id: z.string().refine((val) => /^\d+$/.test(val), 'Invalid inventory user ID'),
});

export const inventoryUsersQuerySchema = z.object({
  // Pagination
  page: z.string().optional(),
  limit: z.string().optional(),
  
  // Filter fields based on actual table columns
  useremail: z.string().optional(),
  role: z.string().optional(), // Legacy field - kept for backward compatibility
  roleid: z.string().optional(), // Filter by role ID
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  location: z.string().optional(),
  usersphonenumber: z.string().optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
});

export type CreateInventoryUsersInput = z.infer<typeof createInventoryUsersSchema>;
export type UpdateInventoryUsersInput = z.infer<typeof updateInventoryUsersSchema>;
export type UpsertInventoryUsersInput = z.infer<typeof upsertInventoryUsersSchema>;
export type InventoryUsersParams = z.infer<typeof inventoryUsersParamsSchema>;
export type InventoryUsersQuery = z.infer<typeof inventoryUsersQuerySchema>; 