import { z } from 'zod';

// Create rating schema based on actual database table
export const createRatingSchema = z.object({
  userid: z.coerce.number().int().positive().optional(),
  productid: z.coerce.number().int().positive().optional(),
  orderid: z.coerce.number().int().positive().optional(),
  starrating: z.coerce.number().int().min(1).max(5).optional(),
  comments: z.string().optional(),
  url: z.array(z.string()).default([]).optional(),
  usermail: z.string().email().max(500).optional(),
  orderlineid: z.coerce.number().int().positive().optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough(); // Allow any additional fields

export const updateRatingSchema = z.object({
  userid: z.coerce.number().int().positive().optional(),
  productid: z.coerce.number().int().positive().optional(),
  orderid: z.coerce.number().int().positive().optional(),
  starrating: z.coerce.number().int().min(1).max(5).optional(),
  comments: z.string().optional(),
  url: z.array(z.string()).optional(),
  usermail: z.string().email().max(500).optional(),
  orderlineid: z.coerce.number().int().positive().optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough();

export const upsertRatingSchema = z.object({
  id: z.number().int().positive().optional(),
  userid: z.coerce.number().int().positive().optional(),
  productid: z.coerce.number().int().positive().optional(),
  orderid: z.coerce.number().int().positive().optional(),
  starrating: z.coerce.number().int().min(1).max(5).optional(),
  comments: z.string().optional(),
  url: z.array(z.string()).default([]).optional(),
  usermail: z.string().email().max(500).optional(),
  orderlineid: z.coerce.number().int().positive().optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough();

export const ratingParamsSchema = z.object({
  id: z.string().refine((val) => /^\d+$/.test(val), 'Invalid rating ID'),
});

export const ratingQuerySchema = z.object({
  // Pagination
  page: z.string().optional(),
  limit: z.string().optional(),
  
  // Filter fields based on actual table columns
  userid: z.string().optional(),
  productid: z.string().optional(),
  orderid: z.string().optional(),
  starrating: z.string().optional(),
  usermail: z.string().optional(),
  orderlineid: z.string().optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
});

export type CreateRatingInput = z.infer<typeof createRatingSchema>;
export type UpdateRatingInput = z.infer<typeof updateRatingSchema>;
export type UpsertRatingInput = z.infer<typeof upsertRatingSchema>;
export type RatingParams = z.infer<typeof ratingParamsSchema>;
export type RatingQuery = z.infer<typeof ratingQuerySchema>; 
