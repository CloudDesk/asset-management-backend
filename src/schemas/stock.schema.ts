import { z } from 'zod';
import { dynamicFieldConfigs } from '../config/dynamicFieldConfig.js';

// Flexible stock schema that works with any database structure
export const createStockSchema = z.object({
  // Core fields that might exist
  productId: z.string().optional(),
  batchNumber: z.string().max(100).optional(),
  warehouseLocation: z.string().max(100).optional(),
  quantity: z.number().int().min(0).optional(),
  availableQuantity: z.number().int().min(0).optional(),
  soldQuantity: z.number().int().min(0).optional(),
  
  // Common alternative field names
  product_id: z.string().optional(),
  batch_number: z.string().max(100).optional(),
  warehouse_location: z.string().max(100).optional(),
  available_quantity: z.number().int().min(0).optional(),
  sold_quantity: z.number().int().min(0).optional(),
}).passthrough(); // Allow any additional fields

export const updateStockSchema = z.object({
  // All fields optional for updates
  batchNumber: z.string().max(100).optional(),
  warehouseLocation: z.string().max(100).optional(),
  quantity: z.number().int().min(0).optional(),
  availableQuantity: z.number().int().min(0).optional(),
  soldQuantity: z.number().int().min(0).optional(),
  
  // Common alternative field names
  batch_number: z.string().max(100).optional(),
  warehouse_location: z.string().max(100).optional(),
  available_quantity: z.number().int().min(0).optional(),
  sold_quantity: z.number().int().min(0).optional(),
}).passthrough();

export const upsertStockSchema = z.object({
  id: z.string().regex(/^\d+$/).optional(),
  
  // Core fields
  productId: z.string().optional(),
  batchNumber: z.string().max(100).optional(),
  warehouseLocation: z.string().max(100).optional(),
  quantity: z.number().int().min(0).optional(),
  availableQuantity: z.number().int().min(0).optional(),
  soldQuantity: z.number().int().min(0).optional(),
  
  // Common alternative field names
  product_id: z.string().optional(),
  batch_number: z.string().max(100).optional(),
  warehouse_location: z.string().max(100).optional(),
  available_quantity: z.number().int().min(0).optional(),
  sold_quantity: z.number().int().min(0).optional(),
}).passthrough();

export const stockParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Invalid stock ID - must be a number'),
});

export const stockQuerySchema = z.object({
  // Pagination
  page: z.string().optional(),
  limit: z.string().optional(),
  
  // Filter fields - support both naming conventions
  productId: z.string().optional(),
  batchNumber: z.string().optional(),
  warehouseLocation: z.string().optional(),
  minQuantity: z.string().optional(),
  maxQuantity: z.string().optional(),
  minAvailable: z.string().optional(),
  maxAvailable: z.string().optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  
  // Alternative field names
  product_id: z.string().optional(),
  batch_number: z.string().optional(),
  warehouse_location: z.string().optional(),
  min_quantity: z.string().optional(),
  max_quantity: z.string().optional(),
  min_available: z.string().optional(),
  max_available: z.string().optional(),
  created_after: z.string().optional(),
  created_before: z.string().optional(),
});

// Dynamic field validation - now more permissive
export function validateStockDynamicFields(data: Record<string, any>): Record<string, any> {
  const config = dynamicFieldConfigs.stock;
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

export type CreateStockInput = z.infer<typeof createStockSchema>;
export type UpdateStockInput = z.infer<typeof updateStockSchema>;
export type UpsertStockInput = z.infer<typeof upsertStockSchema>;
export type StockParams = z.infer<typeof stockParamsSchema>;
export type StockQuery = z.infer<typeof stockQuerySchema>; 