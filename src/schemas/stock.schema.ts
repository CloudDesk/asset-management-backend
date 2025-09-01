import { z } from 'zod';
import { dynamicFieldConfigs } from '../config/dynamicFieldConfig.js';

// Enhanced stock schema that works with the provided payload
export const createStockSchema = z.object({
  // Core required/optional fields
  productId: z.string().min(1, "Product ID is required and cannot be empty").optional(),
  serialNumber: z.string().min(1, "Serial number cannot be empty").max(500, "Serial number cannot exceed 500 characters").optional(),
  
  // Date fields - accept both string dates and year numbers
  manufactureYear: z.union([
    z.string().refine((val) => {
      // Check if it's a valid date string or a year
      if (/^\d{4}$/.test(val)) return true; // 4-digit year
      const date = new Date(val);
      return !isNaN(date.getTime()); // Valid date
    }, "Manufacture year must be a valid date or 4-digit year"),
    z.number().int().min(1900).max(2100, "Manufacture year must be between 1900 and 2100")
  ]).optional(),
  
  releaseYear: z.union([
    z.string().refine((val) => {
      if (/^\d{4}$/.test(val)) return true; // 4-digit year
      const date = new Date(val);
      return !isNaN(date.getTime()); // Valid date
    }, "Release year must be a valid date or 4-digit year"),
    z.number().int().min(1900).max(2100, "Release year must be between 1900 and 2100")
  ]).optional(),
  
  // Boolean fields
  ecommercePublish: z.boolean().optional().default(false),
  
  // Location field
  location: z.string().min(1, "Location cannot be empty").max(500, "Location cannot exceed 500 characters").optional(),
  
  // Existing quantity fields
  batchNumber: z.string().max(100).optional(),
  warehouseLocation: z.string().max(100).optional(),
  quantity: z.number().int().min(0, "Quantity cannot be negative").optional(),
  availableQuantity: z.number().int().min(0, "Available quantity cannot be negative").optional(),
  soldQuantity: z.number().int().min(0, "Sold quantity cannot be negative").optional(),
  
  // Alternative field names for flexibility
  product_id: z.string().min(1, "Product ID is required and cannot be empty").optional(),
  serial_number: z.string().min(1, "Serial number cannot be empty").max(500).optional(),
  manufacture_year: z.union([
    z.string().refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) || /^\d{4}$/.test(val);
    }, "Manufacture year must be a valid date or 4-digit year"),
    z.number().int().min(1900).max(2100)
  ]).optional(),
  release_year: z.union([
    z.string().refine((val) => {
      const date = new Date(val);
      return !isNaN(date.getTime()) || /^\d{4}$/.test(val);
    }, "Release year must be a valid date or 4-digit year"),
    z.number().int().min(1900).max(2100)
  ]).optional(),
  ecommerce_publish: z.boolean().optional().default(false),
  batch_number: z.string().max(100).optional(),
  warehouse_location: z.string().max(100).optional(),
  available_quantity: z.number().int().min(0).optional(),
  sold_quantity: z.number().int().min(0).optional(),
  
  // Additional common fields
  stockstatus: z.string().max(50).optional().default("Available"),
  stockStatus: z.string().max(50).optional().default("Available"),
  isdeleted: z.boolean().optional().default(false),
  isDeleted: z.boolean().optional().default(false),
  isarchive: z.boolean().optional().default(false),
  isArchive: z.boolean().optional().default(false),
}).passthrough().refine((data) => {
  // Custom validation to ensure at least some meaningful data is provided
  const hasProductId = data.productId || data.product_id;
  const hasSerialNumber = data.serialNumber || data.serial_number;
  const hasLocation = data.location;
  
  return hasProductId || hasSerialNumber || hasLocation;
}, {
  message: "At least one of productId, serialNumber, or location must be provided",
  path: ["productId"] // This will highlight the productId field in error
});

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