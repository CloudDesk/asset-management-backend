import { z } from 'zod';

// PlatformStock schema for multi-platform inventory management
export const createPlatformStockSchema = z.object({
  // Core required fields
  platform: z.string().min(1, 'Platform is required').max(100, 'Platform name too long'),
  productid: z.union([z.string().regex(/^\d+$/), z.number().min(1)]),
  
  // Quantity fields with defaults
  availableqty: z.number().int().min(0, 'Available quantity cannot be negative').default(0).optional(),
  orderedqty: z.number().int().min(0, 'Ordered quantity cannot be negative').default(0).optional(),
  soldqty: z.number().int().min(0, 'Sold quantity cannot be negative').default(0).optional(),
  totalqty: z.number().int().min(0, 'Total quantity cannot be negative').default(0).optional(),
  lockqty: z.number().int().min(0, 'Lock quantity cannot be negative').default(0).optional(),
  
  // Timestamps
  createddate: z.union([z.string().regex(/^\d+$/), z.number(), z.bigint()]).optional(),
  modifieddate: z.union([z.string().regex(/^\d+$/), z.number(), z.bigint()]).optional(),
}).passthrough(); // Allow any additional fields

export const updatePlatformStockSchema = z.object({
  // All fields optional for updates
  platform: z.string().max(100, 'Platform name too long').optional(),
  productid: z.union([z.string().regex(/^\d+$/), z.number()]).optional(),
  
  // Quantity fields
  availableqty: z.number().int().min(0, 'Available quantity cannot be negative').optional(),
  orderedqty: z.number().int().min(0, 'Ordered quantity cannot be negative').optional(),
  soldqty: z.number().int().min(0, 'Sold quantity cannot be negative').optional(),
  totalqty: z.number().int().min(0, 'Total quantity cannot be negative').optional(),
  lockqty: z.number().int().min(0, 'Lock quantity cannot be negative').optional(),
  
  // Timestamps
  modifieddate: z.union([z.string().regex(/^\d+$/), z.number(), z.bigint()]).optional(),
}).passthrough();

export const upsertPlatformStockSchema = z.object({
  id: z.union([z.string().regex(/^\d+$/), z.number(), z.bigint()]).optional(),
  
  // Core fields - same as create/update
  platform: z.string().min(1, 'Platform is required').max(100, 'Platform name too long').optional(),
  productid: z.union([z.string().regex(/^\d+$/), z.number().min(1)]).optional(),
  
  // Quantity fields
  availableqty: z.number().int().min(0, 'Available quantity cannot be negative').default(0).optional(),
  orderedqty: z.number().int().min(0, 'Ordered quantity cannot be negative').default(0).optional(),
  soldqty: z.number().int().min(0, 'Sold quantity cannot be negative').default(0).optional(),
  totalqty: z.number().int().min(0, 'Total quantity cannot be negative').default(0).optional(),
  lockqty: z.number().int().min(0, 'Lock quantity cannot be negative').default(0).optional(),
  
  // Timestamps
  createddate: z.union([z.string().regex(/^\d+$/), z.number(), z.bigint()]).optional(),
  modifieddate: z.union([z.string().regex(/^\d+$/), z.number(), z.bigint()]).optional(),
}).passthrough();

export const platformStockParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Invalid platform stock ID - must be a numeric string'),
});

export const platformStockQuerySchema = z.object({
  // Pagination
  page: z.string().optional(),
  limit: z.string().optional(),
  
  // Filter fields
  platform: z.string().optional(),
  productid: z.string().optional(),
  minAvailableQty: z.string().optional(),
  maxAvailableQty: z.string().optional(),
  minOrderedQty: z.string().optional(),
  maxOrderedQty: z.string().optional(),
  minSoldQty: z.string().optional(),
  maxSoldQty: z.string().optional(),
  minTotalQty: z.string().optional(),
  maxTotalQty: z.string().optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
  
});

// Platform transfer schema for moving stock between platforms
export const platformTransferSchema = z.object({
  stockId: z.union([z.string().regex(/^\d+$/), z.number().min(1)]),
  newPlatform: z.string().min(1, 'New platform is required').max(100, 'Platform name too long'),
  reason: z.string().max(255, 'Reason too long').optional(),
  userId: z.union([z.string().regex(/^\d+$/), z.number(), z.bigint()]).optional(),
});

// Bulk platform stock update schema
export const bulkPlatformStockUpdateSchema = z.object({
  productid: z.union([z.string().regex(/^\d+$/), z.number().min(1)]),
  platformUpdates: z.array(z.object({
    platform: z.string().min(1, 'Platform is required').max(100, 'Platform name too long'),
    availableqty: z.number().int().min(0).optional(),
    orderedqty: z.number().int().min(0).optional(),
    soldqty: z.number().int().min(0).optional(),
    totalqty: z.number().int().min(0).optional(),
    lockqty: z.number().int().min(0).optional(),
  })).min(1, 'At least one platform update is required'),
});

// Dynamic field validation for PlatformStock
export function validatePlatformStockDynamicFields(data: Record<string, any>): Record<string, any> {
  const dynamicFields: Record<string, any> = {};
  
  for (const [key, value] of Object.entries(data)) {
    // Accept any field, but apply type conversion for known fields
    switch (key) {
      case 'availableqty':
      case 'orderedqty':
      case 'soldqty':
      case 'totalqty':
      case 'lockqty':
        dynamicFields[key] = Number(value);
        break;
      case 'createddate':
      case 'modifieddate':
        dynamicFields[key] = typeof value === 'string' ? parseInt(value) : value;
        break;
      default:
        dynamicFields[key] = value;
    }
  }
  
  return dynamicFields;
}

export type CreatePlatformStockInput = z.infer<typeof createPlatformStockSchema>;
export type UpdatePlatformStockInput = z.infer<typeof updatePlatformStockSchema>;
export type UpsertPlatformStockInput = z.infer<typeof upsertPlatformStockSchema>;
export type PlatformStockParams = z.infer<typeof platformStockParamsSchema>;
export type PlatformStockQuery = z.infer<typeof platformStockQuerySchema>;
export type PlatformTransferInput = z.infer<typeof platformTransferSchema>;
export type BulkPlatformStockUpdateInput = z.infer<typeof bulkPlatformStockUpdateSchema>;
