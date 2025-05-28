import { logger } from '../config/logger.js';

/**
 * Converts and validates data based on schema field types
 */
export function validateAndConvertData(data: any, schema: any): any {
  if (!data || !schema || !schema.properties) {
    return data;
  }

  const convertedData: any = {};

  for (const [key, value] of Object.entries(data)) {
    const fieldSchema = schema.properties[key];
    
    if (!fieldSchema) {
      // Field not in schema, skip it
      continue;
    }

    try {
      convertedData[key] = convertFieldValue(value, fieldSchema, key);
    } catch (error: any) {
      logger.warn({ key, value, error: error.message }, 'Field conversion failed');
      throw new Error(`Invalid value for field '${key}': ${error.message}`);
    }
  }

  return convertedData;
}

/**
 * Converts a single field value based on its schema type
 */
function convertFieldValue(value: any, fieldSchema: any, fieldName: string): any {
  // Handle null/undefined values
  if (value === null || value === undefined) {
    if (fieldSchema.nullable) {
      return null;
    }
    // If field is not nullable but value is null/undefined, let it pass through
    // The database will handle the constraint violation
    return value;
  }

  // Handle empty strings for numeric fields
  if (value === '' && (fieldSchema.type === 'number' || fieldSchema.type === 'integer')) {
    return fieldSchema.nullable ? null : value;
  }

  switch (fieldSchema.type) {
    case 'integer':
      return convertToInteger(value, fieldName);
    
    case 'number':
      return convertToNumber(value, fieldName);
    
    case 'boolean':
      return convertToBoolean(value, fieldName);
    
    case 'string':
      return convertToString(value, fieldSchema, fieldName);
    
    default:
      return value;
  }
}

/**
 * Converts value to integer
 */
function convertToInteger(value: any, fieldName: string): number {
  if (typeof value === 'number') {
    if (Number.isInteger(value)) {
      return value;
    }
    throw new Error(`Expected integer for field '${fieldName}', got decimal number`);
  }

  if (typeof value === 'string') {
    if (value.trim() === '') {
      throw new Error(`Empty string cannot be converted to integer for field '${fieldName}'`);
    }
    
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
      throw new Error(`Cannot convert '${value}' to integer for field '${fieldName}'`);
    }
    return parsed;
  }

  if (typeof value === 'object') {
    throw new Error(`Object cannot be converted to integer for field '${fieldName}'`);
  }

  throw new Error(`Cannot convert ${typeof value} to integer for field '${fieldName}'`);
}

/**
 * Converts value to number (float)
 */
function convertToNumber(value: any, fieldName: string): number {
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) {
      throw new Error(`Invalid number value for field '${fieldName}'`);
    }
    return value;
  }

  if (typeof value === 'string') {
    if (value.trim() === '') {
      throw new Error(`Empty string cannot be converted to number for field '${fieldName}'`);
    }
    
    const parsed = parseFloat(value);
    if (isNaN(parsed)) {
      throw new Error(`Cannot convert '${value}' to number for field '${fieldName}'`);
    }
    return parsed;
  }

  if (typeof value === 'object') {
    throw new Error(`Object cannot be converted to number for field '${fieldName}'`);
  }

  throw new Error(`Cannot convert ${typeof value} to number for field '${fieldName}'`);
}

/**
 * Converts value to boolean
 */
function convertToBoolean(value: any, fieldName: string): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === '1' || lower === 'yes') {
      return true;
    }
    if (lower === 'false' || lower === '0' || lower === 'no') {
      return false;
    }
    throw new Error(`Cannot convert '${value}' to boolean for field '${fieldName}'`);
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'object') {
    throw new Error(`Object cannot be converted to boolean for field '${fieldName}'`);
  }

  throw new Error(`Cannot convert ${typeof value} to boolean for field '${fieldName}'`);
}

/**
 * Converts value to string with length validation
 */
function convertToString(value: any, fieldSchema: any, fieldName: string): string {
  if (typeof value === 'string') {
    if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
      throw new Error(`String too long for field '${fieldName}'. Maximum length: ${fieldSchema.maxLength}`);
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    const stringValue = String(value);
    if (fieldSchema.maxLength && stringValue.length > fieldSchema.maxLength) {
      throw new Error(`Converted string too long for field '${fieldName}'. Maximum length: ${fieldSchema.maxLength}`);
    }
    return stringValue;
  }

  if (typeof value === 'object') {
    throw new Error(`Object cannot be converted to string for field '${fieldName}'`);
  }

  return String(value);
}

/**
 * Removes fields that are not in the schema
 */
export function filterDataBySchema(data: any, schema: any): any {
  if (!data || !schema || !schema.properties) {
    return data;
  }

  const filteredData: any = {};
  const schemaFields = Object.keys(schema.properties);

  for (const [key, value] of Object.entries(data)) {
    if (schemaFields.includes(key)) {
      filteredData[key] = value;
    }
  }

  return filteredData;
}

/**
 * Validates required fields are present
 */
export function validateRequiredFields(data: any, schema: any): string[] {
  if (!schema || !schema.required || !Array.isArray(schema.required)) {
    return [];
  }

  const missingFields: string[] = [];
  
  for (const requiredField of schema.required) {
    if (!(requiredField in data) || data[requiredField] === null || data[requiredField] === undefined) {
      missingFields.push(requiredField);
    }
  }

  return missingFields;
} 