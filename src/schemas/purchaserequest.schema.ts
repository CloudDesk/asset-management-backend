import { z } from 'zod';
import { dynamicFieldConfigs } from '../config/dynamicFieldConfig.js';

// Flexible purchase request schema that works with any database structure
export const createPurchaseRequestSchema = z.object({
  // Core fields that might exist
  requestNumber: z.string().min(1).max(100).optional(),
  supplierId: z.string().uuid().optional(),
  requestDate: z.string().datetime().optional(),
  requiredDate: z.string().datetime().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  requestedBy: z.string().max(255).optional(),
  approvedBy: z.string().max(255).optional(),
  approvedDate: z.string().datetime().optional(),
  totalEstimatedAmount: z.number().positive().optional(),
  notes: z.string().optional(),
  
  // Common alternative field names (snake_case)
  request_number: z.string().min(1).max(100).optional(),
  supplier_id: z.string().uuid().optional(),
  request_date: z.string().datetime().optional(),
  required_date: z.string().datetime().optional(),
  request_status: z.string().optional(),
  request_priority: z.string().optional(),
  requested_by: z.string().max(255).optional(),
  approved_by: z.string().max(255).optional(),
  approved_date: z.string().datetime().optional(),
  total_estimated_amount: z.number().positive().optional(),
  request_notes: z.string().optional(),
}).passthrough(); // Allow any additional fields

export const updatePurchaseRequestSchema = z.object({
  // All fields optional for updates
  requestNumber: z.string().min(1).max(100).optional(),
  supplierId: z.string().uuid().optional(),
  requestDate: z.string().datetime().optional(),
  requiredDate: z.string().datetime().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  requestedBy: z.string().max(255).optional(),
  approvedBy: z.string().max(255).optional(),
  approvedDate: z.string().datetime().optional(),
  totalEstimatedAmount: z.number().positive().optional(),
  notes: z.string().optional(),
  
  // Common alternative field names
  request_number: z.string().min(1).max(100).optional(),
  supplier_id: z.string().uuid().optional(),
  request_date: z.string().datetime().optional(),
  required_date: z.string().datetime().optional(),
  request_status: z.string().optional(),
  request_priority: z.string().optional(),
  requested_by: z.string().max(255).optional(),
  approved_by: z.string().max(255).optional(),
  approved_date: z.string().datetime().optional(),
  total_estimated_amount: z.number().positive().optional(),
  request_notes: z.string().optional(),
}).passthrough();

export const upsertPurchaseRequestSchema = z.object({
  id: z.string().uuid().optional(),
  
  // Core fields
  requestNumber: z.string().min(1).max(100).optional(),
  supplierId: z.string().uuid().optional(),
  requestDate: z.string().datetime().optional(),
  requiredDate: z.string().datetime().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  requestedBy: z.string().max(255).optional(),
  approvedBy: z.string().max(255).optional(),
  approvedDate: z.string().datetime().optional(),
  totalEstimatedAmount: z.number().positive().optional(),
  notes: z.string().optional(),
  
  // Common alternative field names
  request_number: z.string().min(1).max(100).optional(),
  supplier_id: z.string().uuid().optional(),
  request_date: z.string().datetime().optional(),
  required_date: z.string().datetime().optional(),
  request_status: z.string().optional(),
  request_priority: z.string().optional(),
  requested_by: z.string().max(255).optional(),
  approved_by: z.string().max(255).optional(),
  approved_date: z.string().datetime().optional(),
  total_estimated_amount: z.number().positive().optional(),
  request_notes: z.string().optional(),
}).passthrough();

export const purchaseRequestParamsSchema = z.object({
  id: z.string().uuid('Invalid purchase request ID'),
});

export const purchaseRequestQuerySchema = z.object({
  // Pagination
  page: z.string().optional(),
  limit: z.string().optional(),
  
  // Filter fields - support both naming conventions
  requestNumber: z.string().optional(),
  supplierId: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  requestedBy: z.string().optional(),
  approvedBy: z.string().optional(),
  minAmount: z.string().optional(),
  maxAmount: z.string().optional(),
  requestDateAfter: z.string().optional(),
  requestDateBefore: z.string().optional(),
  requiredDateAfter: z.string().optional(),
  requiredDateBefore: z.string().optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  
  // Alternative field names (snake_case)
  request_number: z.string().optional(),
  supplier_id: z.string().optional(),
  request_status: z.string().optional(),
  request_priority: z.string().optional(),
  requested_by: z.string().optional(),
  approved_by: z.string().optional(),
  min_amount: z.string().optional(),
  max_amount: z.string().optional(),
  request_date_after: z.string().optional(),
  request_date_before: z.string().optional(),
  required_date_after: z.string().optional(),
  required_date_before: z.string().optional(),
  created_after: z.string().optional(),
  created_before: z.string().optional(),
});

// Dynamic field validation - permissive approach
export function validatePurchaseRequestDynamicFields(data: Record<string, any>): Record<string, any> {
  const config = dynamicFieldConfigs.purchaseRequest;
  const dynamicFields: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Accept any field, but apply type conversion for known fields
    if (config && config.allowedFields.includes(key)) {
      const fieldType = config.fieldTypes[key];
      
      try {
        switch (fieldType) {
          case 'string':
            dynamicFields[key] = String(value);
            break;
          case 'number':
            dynamicFields[key] = Number(value);
            break;
          case 'boolean':
            dynamicFields[key] = Boolean(value);
            break;
          case 'date':
            dynamicFields[key] = new Date(value);
            break;
          default:
            dynamicFields[key] = value;
        }
      } catch (error) {
        // If type conversion fails, store as-is
        dynamicFields[key] = value;
      }
    } else {
      // For unknown fields, store as-is
      dynamicFields[key] = value;
    }
  }
  
  return dynamicFields;
}

export type CreatePurchaseRequestInput = z.infer<typeof createPurchaseRequestSchema>;
export type UpdatePurchaseRequestInput = z.infer<typeof updatePurchaseRequestSchema>;
export type UpsertPurchaseRequestInput = z.infer<typeof upsertPurchaseRequestSchema>;
export type PurchaseRequestParams = z.infer<typeof purchaseRequestParamsSchema>;
export type PurchaseRequestQuery = z.infer<typeof purchaseRequestQuerySchema>; 
