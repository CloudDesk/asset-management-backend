import { z } from 'zod';

// Supplier schema based on actual database fields
export const createSupplierSchema = z.object({
  // Actual database fields
  suppliername: z.string().min(1).max(255).optional(),
  suppliercode: z.string().max(50).optional(),
  suppliertype: z.enum(['local', 'International']).optional(),
  supplieremail: z.string().email().optional(),
  supplierphonenumber: z.number().optional(),
  supplierlandline: z.number().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  gstnumber: z.string().max(50).optional(),
  doornumber: z.string().max(50).optional(),
  streetname: z.string().max(255).optional(),
  pincode: z.number().optional(),
  isdeleted: z.boolean().optional(),
  createddate: z.number().optional(),
  modifieddate: z.number().optional(),
}).passthrough(); // Allow any additional fields

export const updateSupplierSchema = z.object({
  // All fields optional for updates
  suppliername: z.string().min(1).max(255).optional(),
  suppliercode: z.string().max(50).optional(),
  suppliertype: z.enum(['local', 'International']).optional(),
  supplieremail: z.string().email().optional(),
  supplierphonenumber: z.number().optional(),
  supplierlandline: z.number().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  gstnumber: z.string().max(50).optional(),
  doornumber: z.string().max(50).optional(),
  streetname: z.string().max(255).optional(),
  pincode: z.number().optional(),
  isdeleted: z.boolean().optional(),
  createddate: z.number().optional(),
  modifieddate: z.number().optional(),
}).passthrough();

export const upsertSupplierSchema = z.object({
  id: z.string().optional(), // Changed from uuid() to allow numeric IDs
  
  // Actual database fields
  suppliername: z.string().min(1).max(255).optional(),
  suppliercode: z.string().max(50).optional(),
  suppliertype: z.enum(['local', 'International']).optional(),
  supplieremail: z.string().email().optional(),
  supplierphonenumber: z.number().optional(),
  supplierlandline: z.number().optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  gstnumber: z.string().max(50).optional(),
  doornumber: z.string().max(50).optional(),
  streetname: z.string().max(255).optional(),
  pincode: z.number().optional(),
  isdeleted: z.boolean().optional(),
  createddate: z.number().optional(),
  modifieddate: z.number().optional(),
}).passthrough();

export const supplierParamsSchema = z.object({
  id: z.string().min(1, 'Invalid supplier ID'),
});

export const supplierQuerySchema = z.object({
  // Pagination
  page: z.string().optional(),
  limit: z.string().optional(),
  
  // ID filter
  id: z.string().optional(),
  
  // Filter fields based on actual database columns
  suppliername: z.string().optional(),
  suppliercode: z.string().optional(),
  suppliertype: z.string().optional(),
  supplieremail: z.string().optional(),
  supplierphonenumber: z.string().optional(),
  supplierlandline: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  gstnumber: z.string().optional(),
  doornumber: z.string().optional(),
  streetname: z.string().optional(),
  pincode: z.string().optional(),
  isdeleted: z.string().optional(),
  createddate: z.string().optional(),
  modifieddate: z.string().optional(),
}).passthrough(); // Allow any additional query parameters

// Dynamic field validation - permissive approach
export function validateSupplierDynamicFields(data: Record<string, any>): Record<string, any> {
  // Just return the data as-is since we're using passthrough
  // The database operations will filter out invalid fields
  return data;
}

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type UpsertSupplierInput = z.infer<typeof upsertSupplierSchema>;
export type SupplierParams = z.infer<typeof supplierParamsSchema>;
export type SupplierQuery = z.infer<typeof supplierQuerySchema>; 
