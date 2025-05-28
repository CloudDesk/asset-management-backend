import { prisma } from '../models/prisma.js';
import { logger } from '../config/logger.js';

interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

interface SwaggerProperty {
  type: string;
  format?: string;
  description?: string;
  nullable?: boolean;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  example?: any;
}

interface SwaggerSchema {
  type: string;
  properties: Record<string, SwaggerProperty>;
  required: string[];
  additionalProperties?: boolean;
}

// Cache for table schemas to avoid repeated database queries
const schemaCache = new Map<string, { schema: SwaggerSchema; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

/**
 * Maps PostgreSQL data types to Swagger/OpenAPI types
 */
function mapPostgresToSwaggerType(pgType: string, isNullable: boolean): SwaggerProperty {
  const property: SwaggerProperty = {
    type: 'string'
  };
  
  switch (pgType.toLowerCase()) {
    case 'uuid':
      property.type = 'string';
      property.format = 'uuid';
      break;
    case 'varchar':
    case 'text':
    case 'char':
    case 'character':
    case 'character varying':
      property.type = 'string';
      break;
    case 'integer':
    case 'int':
    case 'int4':
    case 'serial':
    case 'serial4':
      property.type = 'integer';
      property.format = 'int32';
      break;
    case 'bigint':
    case 'int8':
    case 'bigserial':
    case 'serial8':
      property.type = 'integer';
      property.format = 'int64';
      break;
    case 'smallint':
    case 'int2':
    case 'smallserial':
    case 'serial2':
      property.type = 'integer';
      property.format = 'int16';
      break;
    case 'decimal':
    case 'numeric':
    case 'real':
    case 'float4':
      property.type = 'number';
      property.format = 'float';
      break;
    case 'double precision':
    case 'float8':
      property.type = 'number';
      property.format = 'double';
      break;
    case 'boolean':
    case 'bool':
      property.type = 'boolean';
      break;
    case 'timestamp':
    case 'timestamp without time zone':
    case 'timestamp with time zone':
    case 'timestamptz':
      property.type = 'string';
      property.format = 'date-time';
      break;
    case 'date':
      property.type = 'string';
      property.format = 'date';
      break;
    case 'time':
    case 'time without time zone':
    case 'time with time zone':
      property.type = 'string';
      property.format = 'time';
      break;
    case 'json':
    case 'jsonb':
      property.type = 'object';
      break;
    case 'array':
      property.type = 'array';
      break;
    default:
      property.type = 'string';
  }
  
  if (isNullable) {
    property.nullable = true;
  }
  
  return property;
}

/**
 * Fetches all fields from a database table and returns their metadata
 */
export async function getModelFields(modelName: string): Promise<ColumnInfo[]> {
  try {
    logger.debug({ modelName }, 'Fetching model fields from database');
    
    // Map model names to actual table names
    const tableMapping: Record<string, string> = {
      'product': 'product',
      'stock': 'stock',
      'picklist': 'picklist',
      'supplier': 'supplier',
      'purchaseorder': 'purchaseorder',
      'purchaserequest': 'purchaserequest'
    };
    
    const tableName = tableMapping[modelName] || modelName;
    
    const columns = await prisma.$queryRaw<ColumnInfo[]>`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns 
      WHERE table_name = ${tableName}
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    logger.info({ modelName, tableName, columnCount: columns.length }, 'Successfully fetched model fields');
    return columns;
  } catch (error) {
    logger.error({ error, modelName }, 'Failed to fetch model fields');
    throw new Error(`Failed to fetch fields for model ${modelName}: ${error}`);
  }
}

/**
 * Generates a Swagger schema object for a given model
 */
export async function generateSwaggerSchema(
  modelName: string, 
  schemaType: 'create' | 'update' | 'response' = 'response'
): Promise<SwaggerSchema> {
  try {
    // Check cache first
    const cacheKey = `${modelName}_${schemaType}`;
    const cached = schemaCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      logger.debug({ modelName, schemaType }, 'Using cached Swagger schema');
      return cached.schema;
    }
    
    logger.debug({ modelName, schemaType }, 'Generating Swagger schema');
    
    const fields = await getModelFields(modelName);
    const properties: Record<string, SwaggerProperty> = {};
    const required: string[] = [];
    
    for (const field of fields) {
      const isNullable = field.is_nullable === 'YES';
      const hasDefault = field.column_default !== null;
      
      // Map PostgreSQL type to Swagger type
      const property = mapPostgresToSwaggerType(field.data_type, isNullable);
      
      // Add length constraints for string types
      if (property.type === 'string' && field.character_maximum_length) {
        property.maxLength = field.character_maximum_length;
      }
      
      // Add precision constraints for numeric types
      if (property.type === 'number' && field.numeric_precision) {
        // Note: Precision constraints could be added here if needed
        // but examples are not supported in strict mode
      }
      
      // Add field description
      property.description = `${field.column_name} field (${field.data_type})`;
      
      properties[field.column_name] = property;
      
      // Determine if field is required based on schema type
      if (schemaType === 'create') {
        // For create operations, required if not nullable and no default
        if (!isNullable && !hasDefault && field.column_name !== 'id') {
          required.push(field.column_name);
        }
      }
      // For update operations, no fields are required
      // For response operations, include all fields but none are required for validation
    }
    
    const schema: SwaggerSchema = {
      type: 'object',
      properties,
      required,
      additionalProperties: false
    };
    
    // Cache the result
    schemaCache.set(cacheKey, {
      schema,
      timestamp: Date.now()
    });
    
    logger.info({ 
      modelName, 
      schemaType, 
      fieldCount: Object.keys(properties).length,
      requiredCount: required.length 
    }, 'Successfully generated Swagger schema');
    
    return schema;
  } catch (error) {
    logger.error({ error, modelName, schemaType }, 'Failed to generate Swagger schema');
    throw new Error(`Failed to generate Swagger schema for ${modelName}: ${error}`);
  }
}

/**
 * Generates complete Swagger route schemas for CRUD operations
 */
export async function generateCRUDSchemas(modelName: string) {
  try {
    logger.debug({ modelName }, 'Generating CRUD schemas');
    
    const [createSchema, updateSchema, responseSchema] = await Promise.all([
      generateSwaggerSchema(modelName, 'create'),
      generateSwaggerSchema(modelName, 'update'),
      generateSwaggerSchema(modelName, 'response')
    ]);
    
    // Standard error response schema
    const errorSchema = {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        details: { type: 'string' },
        statusCode: { type: 'number' }
      },
      required: ['success', 'message']
    };
    
    // Success response schema
    const successSchema = {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: responseSchema
      },
      required: ['success', 'data']
    };
    
    // List response schema with pagination
    const listSchema = {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'array',
          items: responseSchema
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' }
          }
        },
        meta: {
          type: 'object',
          properties: {
            filters: { type: 'array', items: { type: 'string' } },
            total: { type: 'number' },
            filtered: { type: 'boolean' }
          }
        }
      },
      required: ['success', 'data']
    };
    
    return {
      create: createSchema,
      update: updateSchema,
      response: responseSchema,
      success: successSchema,
      list: listSchema,
      error: errorSchema
    };
  } catch (error) {
    logger.error({ error, modelName }, 'Failed to generate CRUD schemas');
    throw error;
  }
}

/**
 * Clears the schema cache (useful for testing or when schema changes)
 */
export function clearSchemaCache(): void {
  schemaCache.clear();
  logger.info('Swagger schema cache cleared');
}

/**
 * Gets cache status for debugging
 */
export function getSchemaCacheStatus(): Array<{ key: string; age: number }> {
  const now = Date.now();
  return Array.from(schemaCache.entries()).map(([key, value]) => ({
    key,
    age: now - value.timestamp
  }));
} 