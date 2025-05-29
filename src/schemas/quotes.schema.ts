import { z } from 'zod';

// Flexible quotes schema that works with the existing database structure
export const createQuotesSchema = z.object({
  // Core fields from the quotes table
  createddate: z.number().int().positive().optional(),
  modifieddate: z.number().int().positive().optional(),
  status: z.string().max(500).optional(),
  prnumber: z.string().max(500).optional(),
  quoteurl: z.string().max(500).optional(),
  quotenumber: z.string().max(500).optional(),
}).passthrough(); // Allow any additional fields

export const updateQuotesSchema = z.object({
  // All fields optional for updates
  createddate: z.number().int().positive().optional(),
  modifieddate: z.number().int().positive().optional(),
  status: z.string().max(500).optional(),
  prnumber: z.string().max(500).optional(),
  quoteurl: z.string().max(500).optional(),
  quotenumber: z.string().max(500).optional(),
}).passthrough();

export const upsertQuotesSchema = z.object({
  id: z.number().int().positive().optional(),
  
  // Core fields
  createddate: z.number().int().positive().optional(),
  modifieddate: z.number().int().positive().optional(),
  status: z.string().max(500).optional(),
  prnumber: z.string().max(500).optional(),
  quoteurl: z.string().max(500).optional(),
  quotenumber: z.string().max(500).optional(),
}).passthrough();

export const quotesParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Invalid quotes ID - must be an integer'),
});

export const quotesQuerySchema = z.object({
  // Pagination
  page: z.string().optional(),
  limit: z.string().optional(),
  
  // Filter fields
  status: z.string().optional(),
  prnumber: z.string().optional(),
  quotenumber: z.string().optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  modifiedAfter: z.string().optional(),
  modifiedBefore: z.string().optional(),
});

// Dynamic field validation for quotes
export function validateQuotesDynamicFields(data: Record<string, any>): Record<string, any> {
  const dynamicFields: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Handle known field types
    switch (key) {
      case 'id':
      case 'createddate':
      case 'modifieddate':
        if (value !== null && value !== undefined) {
          dynamicFields[key] = Number(value);
        }
        break;
      case 'status':
      case 'prnumber':
      case 'quoteurl':
      case 'quotenumber':
        if (value !== null && value !== undefined) {
          dynamicFields[key] = String(value);
        }
        break;
      default:
        // For unknown fields, store as-is
        dynamicFields[key] = value;
    }
  }
  
  return dynamicFields;
}

export type CreateQuotesInput = z.infer<typeof createQuotesSchema>;
export type UpdateQuotesInput = z.infer<typeof updateQuotesSchema>;
export type UpsertQuotesInput = z.infer<typeof upsertQuotesSchema>;
export type QuotesParams = z.infer<typeof quotesParamsSchema>;
export type QuotesQuery = z.infer<typeof quotesQuerySchema>; 