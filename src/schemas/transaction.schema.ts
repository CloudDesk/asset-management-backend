import { z } from 'zod';

// Create transaction schema based on actual database table
export const createTransactionSchema = z.object({
  transactionid: z.string().max(500), // Primary key - required for creation
  transactiondata: z.any().optional(), // JSON field
  userid: z.number().int().positive().optional(),
  productid: z.array(z.number().int().positive()).optional(), // Array of integers
  merchanttransactionid: z.string().max(500).optional(),
  name: z.string().max(500).optional(),
  amount: z.number().or(z.string()).optional(),
  mobilenumber: z.coerce.number().optional(),
  transactionfor: z.string().max(255).optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough(); // Allow any additional fields

export const updateTransactionSchema = z.object({
  transactiondata: z.any().optional(), // JSON field
  userid: z.number().int().positive().optional(),
  productid: z.array(z.number().int().positive()).optional(), // Array of integers
  merchanttransactionid: z.string().max(500).optional(),
  name: z.string().max(500).optional(),
  amount: z.number().or(z.string()).optional(),
  mobilenumber: z.coerce.number().optional(),
  transactionfor: z.string().max(255).optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough();

export const upsertTransactionSchema = z.object({
  id: z.number().int().positive().optional(),
  transactionid: z.string().max(500).optional(),
  transactiondata: z.any().optional(), // JSON field
  userid: z.number().int().positive().optional(),
  productid: z.array(z.number().int().positive()).optional(), // Array of integers
  merchanttransactionid: z.string().max(500).optional(),
  name: z.string().max(500).optional(),
  amount: z.number().or(z.string()).optional(),
  mobilenumber: z.coerce.number().optional(),
  transactionfor: z.string().max(255).optional(),
  createddate: z.coerce.number().optional(),
  modifieddate: z.coerce.number().optional(),
}).passthrough();

export const transactionParamsSchema = z.object({
  transactionid: z.string().min(1, 'Transaction ID is required'),
});

export const transactionByIdParamsSchema = z.object({
  id: z.string().refine((val) => /^\d+$/.test(val), 'Invalid transaction ID'),
});

export const transactionQuerySchema = z.object({
  // Pagination
  page: z.string().optional(),
  limit: z.string().optional(),
  
  // Filter fields based on actual table columns
  transactionid: z.string().optional(),
  userid: z.string().optional(),
  merchanttransactionid: z.string().optional(),
  name: z.string().optional(),
  amount: z.string().optional(),
  mobilenumber: z.string().optional(),
  transactionfor: z.string().optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  amountMin: z.string().optional(),
  amountMax: z.string().optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type UpsertTransactionInput = z.infer<typeof upsertTransactionSchema>;
export type TransactionParams = z.infer<typeof transactionParamsSchema>;
export type TransactionByIdParams = z.infer<typeof transactionByIdParamsSchema>;
export type TransactionQuery = z.infer<typeof transactionQuerySchema>; 
