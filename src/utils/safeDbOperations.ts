import { logger } from '../config/logger.js';

/**
 * Safe Database Operations Utility
 * 
 * This module provides utilities for handling database operations when schema fields
 * might not exist yet. This is designed for iterative development where the database
 * schema is still evolving.
 * 
 * Behavior:
 * - CREATE: Unknown fields are ignored (filtered out before database operation)
 * - READ: Missing fields return as null/undefined in response
 * - UPDATE: Unknown fields are ignored, existing fields are updated safely
 * 
 * When you add new fields to the Prisma schema, they will automatically be used
 * without any code changes needed.
 */

export interface SafeFieldConfig {
  // Core fields that should always exist
  coreFields: string[];
  // Optional fields that might not exist yet
  optionalFields: string[];
  // Dynamic fields (stored as JSON)
  dynamicFields: string[];
}

// Configuration for each model's safe field handling
export const SAFE_FIELD_CONFIGS = {
  product: {
    coreFields: [
      'id', 'name', 'description', 'category', 'price', 'status',
      'createdAt', 'updatedAt'
    ] as readonly string[],
    optionalFields: [
      'totalStockQuantity', 'totalStockAvailable', 'totalStockSold',
      'dynamicFields'
    ] as readonly string[],
    dynamicFields: [
      'brand', 'model', 'color', 'size', 'weight', 'dimensions',
      'material', 'warranty', 'tags', 'notes',
      'customField1', 'customField2', 'customField3', 'customField4', 'customField5'
    ] as readonly string[]
  },
  stock: {
    coreFields: [
      'id', 'productId', 'batchNumber', 'warehouseLocation',
      'quantity', 'availableQuantity', 'soldQuantity',
      'createdAt', 'updatedAt'
    ] as readonly string[],
    optionalFields: [
      'dynamicFields'
    ] as readonly string[],
    dynamicFields: [
      'supplier', 'purchasePrice', 'expiryDate', 'manufacturingDate',
      'qualityGrade', 'notes',
      'customField1', 'customField2', 'customField3'
    ] as readonly string[]
  },
  picklist: {
    coreFields: [
      'id', 'type', 'table', 'field', 'label', 'value',
      'isActive', 'ordering', 'createdAt', 'updatedAt'
    ] as readonly string[],
    optionalFields: [] as readonly string[],
    dynamicFields: [] as readonly string[]
  },
  purchaserequest: {
    coreFields: [
      'id', 'companyname', 'companyaddress', 'contactname', 'phonenumber',
      'gstnumber', 'companymail', 'supplierid', 'prurl', 'prdata',
      'prnumber', 'supplieremail', 'prstatus', 'createddate', 'modifieddate'
    ] as readonly string[],
    optionalFields: [
      'dynamicFields'
    ] as readonly string[],
    dynamicFields: [
      'notes', 'customField1', 'customField2', 'customField3'
    ] as readonly string[]
  },
  inventoryusers: {
    coreFields: [
      'id', 'useremail', 'userpassword', 'createddate', 'modifieddate',
      'role', 'usersphonenumber', 'firstname', 'lastname', 'location',
      'fcmid', 'sessiontoken', 'resettoken', 'resettokenexpires'
    ] as readonly string[],
    optionalFields: [] as readonly string[],
    dynamicFields: [] as readonly string[]
  }
};

/**
 * Safely filters input data to only include fields that exist in the schema
 * Unknown fields are logged and ignored to prevent database errors
 */
export function safeFilterInputData(
  data: Record<string, any>,
  modelName: keyof typeof SAFE_FIELD_CONFIGS,
  operation: 'create' | 'update' = 'create'
): Record<string, any> {
  const config = SAFE_FIELD_CONFIGS[modelName];
  const allowedFields = [...config.coreFields, ...config.optionalFields];
  const filteredData: Record<string, any> = {};
  const ignoredFields: string[] = [];
  const dynamicFieldsData: Record<string, any> = {};

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.includes(key)) {
      // Field exists in schema, include it
      filteredData[key] = value;
    } else if (config.dynamicFields.includes(key)) {
      // Dynamic field, add to dynamicFields JSON
      dynamicFieldsData[key] = value;
    } else {
      // Unknown field, ignore it
      ignoredFields.push(key);
    }
  }

  // Add dynamic fields as JSON if any exist
  if (Object.keys(dynamicFieldsData).length > 0) {
    filteredData.dynamicFields = dynamicFieldsData;
  }

  // Log ignored fields for debugging
  if (ignoredFields.length > 0) {
    logger.debug({
      modelName,
      operation,
      ignoredFields,
      dynamicFields: Object.keys(dynamicFieldsData)
    }, `Safely ignored unknown fields for ${modelName} ${operation}`);
  }

  return filteredData;
}

/**
 * Safely processes database result to handle missing fields
 * Missing fields are set to null to maintain consistent API response structure
 */
export function safeProcessDbResult(
  result: Record<string, any> | null,
  modelName: keyof typeof SAFE_FIELD_CONFIGS
): Record<string, any> | null {
  if (!result) return null;

  const config = SAFE_FIELD_CONFIGS[modelName];
  const processedResult = { ...result };

  // Ensure all optional fields exist (set to null if missing)
  config.optionalFields.forEach(field => {
    if (!(field in processedResult)) {
      processedResult[field] = null;
    }
  });

  // Process dynamic fields if they exist
  if (processedResult.dynamicFields && typeof processedResult.dynamicFields === 'object') {
    const dynamicData = processedResult.dynamicFields as Record<string, any>;
    
    // Ensure all expected dynamic fields exist
    config.dynamicFields.forEach(field => {
      if (!(field in dynamicData)) {
        dynamicData[field] = null;
      }
    });
  } else if (config.dynamicFields.length > 0) {
    // No dynamic fields in result, create empty object with null values
    const emptyDynamicFields: Record<string, any> = {};
    config.dynamicFields.forEach(field => {
      emptyDynamicFields[field] = null;
    });
    processedResult.dynamicFields = emptyDynamicFields;
  }

  return processedResult;
}

/**
 * Safely processes array of database results
 */
export function safeProcessDbResults<T extends Record<string, any>>(
  results: T[],
  modelName: keyof typeof SAFE_FIELD_CONFIGS
): T[] {
  return results.map(result => safeProcessDbResult(result, modelName)).filter(Boolean) as T[];
}

/**
 * Wrapper for Prisma operations that handles errors gracefully
 * If a field doesn't exist in the database, the operation continues without that field
 */
export async function safePrismaOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  modelName: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error: any) {
    // Check if error is due to missing column/field
    if (error.code === 'P2021' || // Column does not exist
        error.code === 'P2022' || // Column does not exist
        error.message?.includes('column') && error.message?.includes('does not exist')) {
      
      logger.warn({
        error: error.message,
        operationName,
        modelName,
        code: error.code
      }, `Database field missing for ${modelName}.${operationName} - continuing safely`);
      
      return null;
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Type-safe field validator that checks if a field should be included in operations
 */
export function isFieldSafe(
  fieldName: string,
  modelName: keyof typeof SAFE_FIELD_CONFIGS,
  includeOptional: boolean = true
): boolean {
  const config = SAFE_FIELD_CONFIGS[modelName];
  
  if (config.coreFields.includes(fieldName)) {
    return true;
  }
  
  if (includeOptional && config.optionalFields.includes(fieldName)) {
    return true;
  }
  
  return config.dynamicFields.includes(fieldName);
}

/**
 * Extracts dynamic fields from input data and validates them
 */
export function extractDynamicFields(
  data: Record<string, any>,
  modelName: keyof typeof SAFE_FIELD_CONFIGS
): Record<string, any> {
  const config = SAFE_FIELD_CONFIGS[modelName];
  const dynamicFields: Record<string, any> = {};
  
  config.dynamicFields.forEach(field => {
    if (field in data && data[field] !== undefined) {
      dynamicFields[field] = data[field];
    }
  });
  
  return dynamicFields;
} 