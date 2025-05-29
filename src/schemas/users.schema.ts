import { z } from 'zod';

// Create users schema based on actual database table
export const createUsersSchema = z.object({
  useremail: z.string().email().max(255).optional(),
  userpassword: z.string().max(255).optional(),
  usermobilenumber: z.coerce.number().optional(),
  fcmid: z.string().max(500).optional(),
  firstname: z.string().max(500).optional(),
  lastname: z.string().max(500).optional(),
  gender: z.string().max(50).optional(),
  gstnumber: z.string().max(20).optional(),
  isbusinessuser: z.boolean().optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough(); // Allow any additional fields

export const updateUsersSchema = z.object({
  useremail: z.string().email().max(255).optional(),
  userpassword: z.string().max(255).optional(),
  usermobilenumber: z.coerce.number().optional(),
  fcmid: z.string().max(500).optional(),
  firstname: z.string().max(500).optional(),
  lastname: z.string().max(500).optional(),
  gender: z.string().max(50).optional(),
  gstnumber: z.string().max(20).optional(),
  isbusinessuser: z.boolean().optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough();

export const upsertUsersSchema = z.object({
  id: z.number().int().positive().optional(),
  useremail: z.string().email().max(255).optional(),
  userpassword: z.string().max(255).optional(),
  usermobilenumber: z.coerce.number().optional(),
  fcmid: z.string().max(500).optional(),
  firstname: z.string().max(500).optional(),
  lastname: z.string().max(500).optional(),
  gender: z.string().max(50).optional(),
  gstnumber: z.string().max(20).optional(),
  isbusinessuser: z.boolean().optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough();

export const usersParamsSchema = z.object({
  id: z.string().refine((val) => /^\d+$/.test(val), 'Invalid user ID'),
});

export const usersQuerySchema = z.object({
  // Pagination
  page: z.string().optional(),
  limit: z.string().optional(),
  
  // Filter fields based on actual table columns
  useremail: z.string().optional(),
  firstname: z.string().optional(),
  lastname: z.string().optional(),
  gender: z.string().optional(),
  gstnumber: z.string().optional(),
  isbusinessuser: z.string().optional(),
  usermobilenumber: z.string().optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
});

export type CreateUsersInput = z.infer<typeof createUsersSchema>;
export type UpdateUsersInput = z.infer<typeof updateUsersSchema>;
export type UpsertUsersInput = z.infer<typeof upsertUsersSchema>;
export type UsersParams = z.infer<typeof usersParamsSchema>;
export type UsersQuery = z.infer<typeof usersQuerySchema>; 