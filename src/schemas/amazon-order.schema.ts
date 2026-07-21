import { z } from 'zod';

const optionalText = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().min(1).max(255).optional()
);

export const amazonOrderQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: optionalText,
  syncState: optionalText,
  fulfilmentType: z.preprocess(
    (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
    z.enum(['FBA', 'EASY_SHIP', 'MFN', 'UNKNOWN']).optional()
  ),
}).strict();

export const amazonOrderImportSchema = z.object({
  fullHistory: z.boolean().default(false),
}).strict();
