import { z } from 'zod';

// Create cart schema based on actual database table
export const createCartSchema = z.object({
  productid: z.coerce.number().int().positive().optional(),
  userid: z.coerce.number().int().positive().optional(),
  quantity: z.coerce.number().positive().optional(),
  iscart: z.boolean().optional(),
  iswishlist: z.boolean().optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough(); // Allow any additional fields

export const updateCartSchema = z.object({
  productid: z.coerce.number().int().positive().optional(),
  userid: z.coerce.number().int().positive().optional(),
  quantity: z.coerce.number().positive().optional(),
  iscart: z.boolean().optional(),
  iswishlist: z.boolean().optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough();

export const upsertCartSchema = z.object({
  id: z.number().int().positive().optional(),
  productid: z.coerce.number().int().positive().optional(),
  userid: z.coerce.number().int().positive().optional(),
  quantity: z.coerce.number().positive().optional(),
  iscart: z.boolean().optional(),
  iswishlist: z.boolean().optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough();

export const cartParamsSchema = z.object({
  id: z.string().refine((val) => /^\d+$/.test(val), 'Invalid cart ID'),
});

export const cartQuerySchema = z.object({
  // Pagination
  page: z.string().optional(),
  limit: z.string().optional(),
  
  // Filter fields based on actual table columns
  productid: z.string().optional(),
  userid: z.string().optional(),
  quantity: z.string().optional(),
  iscart: z.string().optional(),
  iswishlist: z.string().optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
});

export type CreateCartInput = z.infer<typeof createCartSchema>;
export type UpdateCartInput = z.infer<typeof updateCartSchema>;
export type UpsertCartInput = z.infer<typeof upsertCartSchema>;
export type CartParams = z.infer<typeof cartParamsSchema>;
export type CartQuery = z.infer<typeof cartQuerySchema>; 
