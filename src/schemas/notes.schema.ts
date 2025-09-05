import { z } from 'zod';

// Flexible notes schema that works with the existing database structure
export const createNotesSchema = z.object({
  // Core fields from the notes table
  createddate: z.number().int().positive().optional(),
  modifieddate: z.number().int().positive().optional(),
  quotenumber: z.string().max(500).optional(),
  comment: z.string().optional(),
  title: z.string().max(500).optional(),
  ispinned: z.boolean().optional(),
}).passthrough();

export const updateNotesSchema = z.object({
  // All fields optional for updates
  createddate: z.number().int().positive().optional(),
  modifieddate: z.number().int().positive().optional(),
  quotenumber: z.string().max(500).optional(),
  comment: z.string().optional(),
  title: z.string().max(500).optional(),
  ispinned: z.boolean().optional(),
}).passthrough();

export const upsertNotesSchema = z.object({
  id: z.number().int().positive().optional(),
  
  // Core fields
  createddate: z.number().int().positive().optional(),
  modifieddate: z.number().int().positive().optional(),
  quotenumber: z.string().max(500).optional(),
  comment: z.string().optional(),
  title: z.string().max(500).optional(),
  ispinned: z.boolean().optional(),
}).passthrough();

export const notesParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Invalid notes ID - must be an integer'),
});

export const notesQuerySchema = z.object({
  // Pagination
  page: z.string().optional(),
  limit: z.string().optional(),
  
  // Filter fields
  quotenumber: z.string().optional(),
  title: z.string().optional(),
  ispinned: z.string().optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  modifiedAfter: z.string().optional(),
  modifiedBefore: z.string().optional(),
});

export type CreateNotesInput = z.infer<typeof createNotesSchema>;
export type UpdateNotesInput = z.infer<typeof updateNotesSchema>;
export type UpsertNotesInput = z.infer<typeof upsertNotesSchema>;
export type NotesParams = z.infer<typeof notesParamsSchema>;
export type NotesQuery = z.infer<typeof notesQuerySchema>; 
