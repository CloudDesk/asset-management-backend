import { prisma } from '../models/prisma.js';
import { logger } from '../config/logger.js';
import { randomUUID } from 'crypto';

/**
 * Dynamic Database Operations Utility
 * 
 * This module provides utilities for handling database operations when you don't know
 * which columns exist yet. It dynamically discovers available columns and adapts
 * queries accordingly.
 * 
 * Behavior:
 * - Discovers available columns at runtime
 * - Only queries columns that actually exist
 * - Gracefully handles missing columns
 * - Returns consistent API responses regardless of schema state
 */

interface TableSchema {
  tableName: string;
  columns: string[];
  lastChecked: number;
}

// Cache for discovered table schemas (30 minute TTL for better performance)
const schemaCache = new Map<string, TableSchema>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// Cache for safe columns to avoid repeated schema queries
const safeColumnsCache = new Map<string, { columns: string[]; columnList: string; lastChecked: number }>();
const SAFE_COLUMNS_TTL = 30 * 60 * 1000; // 30 minutes

// Predefined safe columns for common tables (to avoid schema queries)
const PREDEFINED_SAFE_COLUMNS: Record<string, string[]> = {
  stock: ['id', 'puc', 'category', 'subcategory', 'brand', 'model', 'stockstatus', 'createddate', 'modifieddate', 'productname', 'serialnumber', 'location'],
  product: ['id', 'productname', 'category', 'subcategory', 'brand', 'model', 'price', 'createddate', 'modifieddate', 'productstatus', 'puc'],
  picklist: ['id', 'type', 'table', 'field', 'label', 'value', 'isActive', 'ordering']
};

/**
 * Gets safe columns for a table with caching to improve performance
 */
async function getSafeColumnsForTable(tableName: string): Promise<{ columns: string[]; columnList: string }> {
  // Check cache first
  const cached = safeColumnsCache.get(tableName);
  if (cached && (Date.now() - cached.lastChecked) < SAFE_COLUMNS_TTL) {
    return { columns: cached.columns, columnList: cached.columnList };
  }

  // Get column information to exclude problematic types
  const columnInfo = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = $1 AND table_schema = 'public'
    ORDER BY ordinal_position
  `, tableName) as Array<{ column_name: string; data_type: string }>;
  
  // Build safe column list (exclude tsvector and other problematic types)
  const safeColumns = columnInfo
    .filter(col => !['tsvector', 'tsquery'].includes(col.data_type))
    .map(col => col.column_name);
  
  const columnList = safeColumns.length > 0 ? safeColumns.join(', ') : '*';
  
  // Cache the result
  safeColumnsCache.set(tableName, {
    columns: safeColumns,
    columnList,
    lastChecked: Date.now()
  });

  logger.debug({ 
    tableName, 
    totalColumns: columnInfo.length, 
    safeColumns: safeColumns.length,
    excludedColumns: columnInfo.length - safeColumns.length
  }, 'Safe columns cached for table');

  return { columns: safeColumns, columnList };
}

/**
 * Discovers available columns for a table by querying the database schema
 */
async function discoverTableColumns(tableName: string): Promise<string[]> {
  try {
    // Check cache first
    const cached = schemaCache.get(tableName);
    if (cached && (Date.now() - cached.lastChecked) < CACHE_TTL) {
      return cached.columns;
    }

    logger.debug({ tableName }, 'Discovering table columns');

    // Query PostgreSQL information schema to get column names
    const result = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = ${tableName}
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;

    const columns = result.map((row: { column_name: string }) => row.column_name);
    
    // Cache the result
    schemaCache.set(tableName, {
      tableName,
      columns,
      lastChecked: Date.now()
    });

    logger.info({ tableName, columns }, `Discovered ${columns.length} columns for table ${tableName}`);
    return columns;
  } catch (error) {
    logger.error({ error, tableName }, 'Failed to discover table columns');
    return []; // Return empty array if discovery fails
  }
}

/**
 * Gets the actual table name from the Prisma model name
 */
function getTableName(modelName: string): string {
  // Map model names to actual table names
  const tableMapping: Record<string, string> = {
    'product': 'product',
    'stock': 'stock', 
    'picklist': 'picklist',
    'supplier': 'supplier',
    'purchaseorder': 'purchaseorder',
    'purchaserequest': 'purchaserequest',
    'quotes': 'quotes'
  };
  
  return tableMapping[modelName] || modelName;
}

/**
 * Converts BigInt values and other database objects to JSON-serializable values
 */
function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle BigInt
  if (typeof obj === 'bigint') {
    return Number(obj);
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToNumber);
  }
  
  // Handle specific object types that need special conversion
  if (typeof obj === 'object') {
    // Handle Prisma Decimal objects
    if (obj.constructor && obj.constructor.name === 'Decimal') {
      return Number(obj.toString());
    }
    
    // Handle Buffer objects (convert to string or number if numeric)
    if (Buffer.isBuffer(obj)) {
      const str = obj.toString();
      // If it's a numeric string, convert to number
      if (/^\d+$/.test(str)) {
        return Number(str);
      }
      return str;
    }
    
    // Handle Date objects
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    
    // Handle objects with valueOf method (like some database types)
    if (typeof obj.valueOf === 'function' && obj.valueOf() !== obj) {
      const value = obj.valueOf();
      if (typeof value === 'bigint') {
        return Number(value);
      }
      if (typeof value !== 'object') {
        return value;
      }
    }
    
    // Handle objects with toString method that returns a numeric value
    if (typeof obj.toString === 'function') {
      const str = obj.toString();
      // Check if toString returns something other than "[object Object]"
      if (str !== '[object Object]' && str !== obj) {
        // If it's a numeric string, convert to number
        if (/^\d+(\.\d+)?$/.test(str)) {
          return Number(str);
        }
        // If it's not the default object string, use it
        if (!str.startsWith('[object ')) {
          return str;
        }
      }
    }
    
    // Handle objects with toNumber method
    if (typeof obj.toNumber === 'function') {
      return obj.toNumber();
    }
    
    // Handle objects with toJSON method
    if (typeof obj.toJSON === 'function') {
      return convertBigIntToNumber(obj.toJSON());
    }
    
    // For plain objects, recursively convert properties
    if (obj.constructor === Object || obj.constructor === undefined) {
      const converted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        converted[key] = convertBigIntToNumber(value);
      }
      return converted;
    }
    
    // For other objects, try to extract a meaningful value
    // This is a fallback for unknown object types
    if (obj.constructor && obj.constructor.name) {
      logger.warn({ 
        objectType: obj.constructor.name,
        objectString: obj.toString(),
        hasValueOf: typeof obj.valueOf === 'function',
        hasToString: typeof obj.toString === 'function'
      }, 'Unknown object type encountered in convertBigIntToNumber');
    }
    
    // Last resort: try to convert to string if it's not the default object representation
    const str = String(obj);
    if (str !== '[object Object]') {
      // If it's a numeric string, convert to number
      if (/^\d+(\.\d+)?$/.test(str)) {
        return Number(str);
      }
      return str;
    }
    
    // If all else fails, return null to avoid "[object Object]"
    return null;
  }
  
  return obj;
}

/**
 * Filters input data to only include columns that exist in the database
 */
async function filterInputDataBySchema(
  data: Record<string, any>,
  modelName: string,
  operation: 'create' | 'update' = 'create'
): Promise<Record<string, any>> {
  const tableName = getTableName(modelName);
  const availableColumns = await discoverTableColumns(tableName);
  
  if (availableColumns.length === 0) {
    logger.warn({ modelName, tableName }, 'No columns available, returning empty data');
    return {};
  }

  const filteredData: Record<string, any> = {};
  const ignoredFields: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (availableColumns.includes(key)) {
      filteredData[key] = value;
    } else {
      ignoredFields.push(key);
    }
  }

  if (ignoredFields.length > 0) {
    logger.debug({
      modelName,
      operation,
      ignoredFields,
      availableColumns,
      filteredFields: Object.keys(filteredData)
    }, `Filtered input data for ${modelName} ${operation} - ignored non-existent fields`);
  }

  return filteredData;
}

/**
 * Gets essential columns for fast queries without schema discovery
 */
function getFastColumns(tableName: string): string {
  const safeColumns = PREDEFINED_SAFE_COLUMNS[tableName];
  return safeColumns ? safeColumns.join(', ') : 'id, createddate, modifieddate';
}

/**
 * Performs a fast findMany operation optimized for performance
 */
export async function fastFindMany(
  modelName: string,
  options: {
    skip?: number;
    take?: number;
    useAllColumns?: boolean;
  } = {}
): Promise<any[]> {
  try {
    const tableName = getTableName(modelName);
    const { skip = 0, take = 10, useAllColumns = false } = options;
    
    // Use predefined columns for speed, or all columns if requested
    const columnList = useAllColumns ? 
      (await getSafeColumnsForTable(tableName)).columnList : 
      getFastColumns(tableName);
    
    // Simple ordering - prefer id for speed
    const orderByClause = 'id DESC';
    
    const query = `SELECT ${columnList} FROM ${tableName} ORDER BY ${orderByClause} LIMIT ${take} OFFSET ${skip}`;
    
    logger.debug({ query, tableName, fast: !useAllColumns }, 'Executing fast findMany query');
    
    const result = await prisma.$queryRawUnsafe(query);
    
    logger.debug({ 
      modelName, 
      resultCount: Array.isArray(result) ? result.length : 0,
      fast: !useAllColumns
    }, 'Fast findMany completed');

    return Array.isArray(result) ? convertBigIntToNumber(result) : [];
  } catch (error: any) {
    logger.error({ 
      error: error.message, 
      modelName, 
      options 
    }, 'Error in fast findMany operation');
    
    return [];
  }
}

/**
 * Builds dynamic WHERE clause for any table based on query parameters
 */
async function buildDynamicWhereClause(
  tableName: string, 
  filters: Record<string, any>
): Promise<{ whereClause: string; values: any[] }> {
  if (!filters || Object.keys(filters).length === 0) {
    return { whereClause: '', values: [] };
  }

  // Get available columns for the table
  const availableColumns = await discoverTableColumns(tableName);
  
  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  // Helper function to find matching column name with case variations
  function findMatchingColumn(filterKey: string): string | null {
    // Try exact match first
    if (availableColumns.includes(filterKey)) {
      return filterKey;
    }
    
    // Try lowercase
    const lowerKey = filterKey.toLowerCase();
    if (availableColumns.includes(lowerKey)) {
      return lowerKey;
    }
    
    // Try snake_case conversion (camelCase -> snake_case)
    const snakeKey = filterKey.replace(/([A-Z])/g, '_$1').toLowerCase();
    if (availableColumns.includes(snakeKey)) {
      return snakeKey;
    }
    
    // Try removing underscores (snake_case -> camelcase)
    const camelKey = filterKey.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    if (availableColumns.includes(camelKey)) {
      return camelKey;
    }
    
    // Try case-insensitive search
    const matchingColumn = availableColumns.find(col => 
      col.toLowerCase() === filterKey.toLowerCase()
    );
    if (matchingColumn) {
      return matchingColumn;
    }
    
    return null;
  }

  for (const [key, value] of Object.entries(filters)) {
    // Skip pagination parameters
    if (['page', 'limit', 'skip', 'take'].includes(key)) {
      continue;
    }

    // Find matching column with case variations
    const matchingColumn = findMatchingColumn(key);
    
    if (matchingColumn) {
      if (value !== undefined && value !== null && value !== '') {
        // Safely convert value to appropriate type
        let processedValue = value;
        
        // Handle arrays (take first element)
        if (Array.isArray(value)) {
          processedValue = value[0];
        }
        
        // Handle objects (convert to string)
        if (typeof processedValue === 'object' && processedValue !== null) {
          processedValue = processedValue.toString();
        }
        
        // Skip empty values after processing
        if (processedValue === undefined || processedValue === null || processedValue === '') {
          continue;
        }
        
        // Handle different filter types
        if (key.startsWith('min') && key.length > 3) {
          // Range filters like minPrice, minQuantity
          const baseKey = key.substring(3);
          const columnName = findMatchingColumn(baseKey);
          if (columnName) {
            const numValue = Number(processedValue);
            if (!isNaN(numValue)) {
              conditions.push(`"${columnName}" >= $${paramIndex}`);
              values.push(numValue);
              paramIndex++;
            }
          }
        } else if (key.startsWith('max') && key.length > 3) {
          // Range filters like maxPrice, maxQuantity
          const baseKey = key.substring(3);
          const columnName = findMatchingColumn(baseKey);
          if (columnName) {
            const numValue = Number(processedValue);
            if (!isNaN(numValue)) {
              conditions.push(`"${columnName}" <= $${paramIndex}`);
              values.push(numValue);
              paramIndex++;
            }
          }
        } else if (key.includes('date') || key.includes('Date')) {
          // Date filters
          conditions.push(`"${matchingColumn}" = $${paramIndex}`);
          values.push(processedValue);
          paramIndex++;
        } else if (key === 'id' || key.toLowerCase() === 'id' || 
                   key === 'supplierid' || key === 'supplier_id' ||
                   key.endsWith('_id') || key.endsWith('Id')) {
          // Special handling for ID fields - treat as numeric
          const numValue = Number(processedValue);
          if (!isNaN(numValue)) {
            conditions.push(`"${matchingColumn}" = $${paramIndex}`);
            values.push(numValue);
            paramIndex++;
          }
        } else if (typeof processedValue === 'string') {
          // String filters - support both exact match and ILIKE
          if (processedValue.includes('%') || processedValue.includes('*')) {
            // Wildcard search
            const searchValue = processedValue.replace(/\*/g, '%');
            conditions.push(`"${matchingColumn}" ILIKE $${paramIndex}`);
            values.push(searchValue);
          } else {
            // Exact match (case-insensitive for strings)
            conditions.push(`LOWER("${matchingColumn}") = LOWER($${paramIndex})`);
            values.push(processedValue);
          }
          paramIndex++;
        } else {
          // Exact match for numbers, booleans, etc.
          conditions.push(`"${matchingColumn}" = $${paramIndex}`);
          values.push(processedValue);
          paramIndex++;
        }
      }
    } else {
      // Log warning for unrecognized fields
      logger.warn({
        tableName,
        filterKey: key,
        availableColumns: availableColumns.slice(0, 10), // Show first 10 columns
        totalColumns: availableColumns.length
      }, `Filter key '${key}' does not match any available column`);
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  logger.debug({
    tableName,
    filters: Object.keys(filters),
    whereClause,
    valueCount: values.length,
    availableColumns: availableColumns.length
  }, 'Built dynamic WHERE clause');

  return { whereClause, values };
}

/**
 * Performs dynamic findMany with proper filtering and counting
 */
export async function dynamicFindManyWithFilters(
  modelName: string,
  filters: Record<string, any> = {},
  options: {
    skip?: number;
    take?: number;
    useAllColumns?: boolean;
  } = {}
): Promise<{ data: any[]; total: number }> {
  try {
    const tableName = getTableName(modelName);
    const { skip = 0, take = 10, useAllColumns = false } = options;
    
    // Build WHERE clause
    const { whereClause, values } = await buildDynamicWhereClause(tableName, filters);
    
    // Choose columns
    const columnList = useAllColumns ? 
      (await getSafeColumnsForTable(tableName)).columnList : 
      getFastColumns(tableName);
    
    // Build queries
    const dataQuery = `
      SELECT ${columnList} 
      FROM ${tableName} 
      ${whereClause}
      ORDER BY id DESC 
      LIMIT ${take} OFFSET ${skip}
    `;
    
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM ${tableName} 
      ${whereClause}
    `;
    
    logger.debug({ 
      dataQuery, 
      countQuery, 
      values,
      tableName,
      filters: Object.keys(filters)
    }, 'Executing dynamic filtered queries');
    
    // Execute both queries in parallel
    const [dataResult, countResult] = await Promise.all([
      prisma.$queryRawUnsafe(dataQuery, ...values),
      prisma.$queryRawUnsafe(countQuery, ...values)
    ]);
    
    const data = Array.isArray(dataResult) ? convertBigIntToNumber(dataResult) : [];
    const total = Number((countResult as any)[0]?.count || 0);
    
    logger.info({
      modelName,
      filters: Object.keys(filters),
      total,
      returned: data.length,
      filtered: whereClause !== ''
    }, 'Dynamic filtered findMany completed');
    
    return { data, total };
  } catch (error: any) {
    logger.error({ 
      error: error.message, 
      modelName, 
      filters,
      options 
    }, 'Error in dynamic filtered findMany');
    
    return { data: [], total: 0 };
  }
}

/**
 * Performs a dynamic findMany operation that adapts to available columns
 */
export async function dynamicFindMany(
  modelName: string,
  options: {
    where?: any;
    skip?: number;
    take?: number;
    orderBy?: any;
    include?: any;
  } = {}
): Promise<any[]> {
  try {
    const tableName = getTableName(modelName);
    const availableColumns = await discoverTableColumns(tableName);
    
    if (availableColumns.length === 0) {
      logger.warn({ modelName, tableName }, 'No columns available for findMany');
      return [];
    }

    logger.debug({ 
      modelName, 
      availableColumns, 
      options
    }, 'Performing dynamic findMany with raw SQL');

    // Build raw SQL query for true SELECT * behavior
    const { skip = 0, take = 10 } = options;
    
    // Simple case: no filters, just get all records
    if (!options.where || Object.keys(options.where).length === 0) {
      logger.debug({ tableName, skip, take }, 'Executing optimized raw SQL SELECT query');
      
      // Build dynamic ORDER BY based on available columns
      const orderByClause = availableColumns.includes('created_at') ? 'created_at DESC' :
                           availableColumns.includes('createddate') ? 'createddate DESC' :
                           availableColumns.includes('id') ? 'id DESC' :
                           '1'; // fallback to constant if no suitable column
      
      // Get safe columns with caching
      const { columnList } = await getSafeColumnsForTable(tableName);
      
      const query = `SELECT ${columnList} FROM ${tableName} ORDER BY ${orderByClause} LIMIT ${take} OFFSET ${skip}`;
      logger.debug({ query, tableName, orderByClause }, 'Executing optimized raw SQL query');
      
      try {
        const result = await prisma.$queryRawUnsafe(query);
        
        logger.debug({ 
          modelName, 
          resultCount: Array.isArray(result) ? result.length : 0,
          resultType: typeof result,
          firstRecord: Array.isArray(result) && result.length > 0 ? Object.keys(result[0]) : 'no records'
        }, 'Optimized raw SQL findMany completed successfully');

        return Array.isArray(result) ? convertBigIntToNumber(result) : [];
      } catch (sqlError: any) {
        logger.error({ 
          error: sqlError.message, 
          query, 
          tableName 
        }, 'Optimized raw SQL query failed');
        return [];
      }
    }

    // For filtered queries, we need to be more careful
    // For now, let's try the Prisma approach but catch errors gracefully
    try {
      let result: any[] = [];
      
      if (modelName === 'product') {
        const findOptions: any = {};
        if (options.where !== undefined) findOptions.where = options.where;
        if (options.skip !== undefined) findOptions.skip = options.skip;
        if (options.take !== undefined) findOptions.take = options.take;
        if (options.orderBy !== undefined) findOptions.orderBy = options.orderBy;
        
        result = await prisma.product.findMany(findOptions);
      } else if (modelName === 'stock') {
        const findOptions: any = {};
        if (options.where !== undefined) findOptions.where = options.where;
        if (options.skip !== undefined) findOptions.skip = options.skip;
        if (options.take !== undefined) findOptions.take = options.take;
        if (options.orderBy !== undefined) findOptions.orderBy = options.orderBy;
        
        result = await prisma.stock.findMany(findOptions);
      } else if (modelName === 'picklist') {
        const findOptions: any = {};
        if (options.where !== undefined) findOptions.where = options.where;
        if (options.skip !== undefined) findOptions.skip = options.skip;
        if (options.take !== undefined) findOptions.take = options.take;
        if (options.orderBy !== undefined) findOptions.orderBy = options.orderBy;
        
        result = await prisma.picklist.findMany(findOptions);
      }

      logger.debug({ 
        modelName, 
        resultCount: result.length 
      }, 'Prisma findMany completed successfully');

      return result;
    } catch (prismaError: any) {
      logger.warn({ 
        error: prismaError.message, 
        modelName 
      }, 'Prisma findMany failed, falling back to raw SQL');
      
      // Fallback to raw SQL without filters
      const orderByClause = availableColumns.includes('created_at') ? 'created_at DESC' :
                           availableColumns.includes('createddate') ? 'createddate DESC' :
                           availableColumns.includes('id') ? 'id DESC' :
                           '1'; // fallback to constant if no suitable column
      
      // Use the same safe column approach with caching
      const { columnList } = await getSafeColumnsForTable(tableName);
      
      const result = await prisma.$queryRawUnsafe(`
        SELECT ${columnList} FROM ${tableName} 
        ORDER BY ${orderByClause}
        LIMIT ${take} OFFSET ${skip}
      `);
      
      return Array.isArray(result) ? convertBigIntToNumber(result) : [];
    }
  } catch (error: any) {
    logger.error({ 
      error: error.message, 
      modelName, 
      options 
    }, 'Error in dynamic findMany operation');
    
    // Return empty array on any error
    return [];
  }
}

/**
 * Performs a dynamic count operation with optimizations
 */
export async function dynamicCount(
  modelName: string,
  where?: any
): Promise<number> {
  try {
    const tableName = getTableName(modelName);
    
    // For simple count without filters, use direct query (fastest)
    if (!where || Object.keys(where).length === 0) {
      logger.debug({ tableName }, 'Executing optimized COUNT(*) query');
      
      const result = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM ${tableName}`
      ) as Array<{ count: bigint }>;
      
      const count = Number(result[0]?.count || 0);
      logger.debug({ tableName, count }, 'Optimized count completed');
      return count;
    }

    // For filtered queries, try Prisma first (it might be optimized)
    try {
      let result = 0;
      
      if (modelName === 'product') {
        result = await prisma.product.count({ where });
      } else if (modelName === 'stock') {
        result = await prisma.stock.count({ where });
      } else if (modelName === 'picklist') {
        result = await prisma.picklist.count({ where });
      }

      return result;
    } catch (prismaError: any) {
      logger.warn({ 
        error: prismaError.message, 
        modelName 
      }, 'Prisma count failed, falling back to raw SQL');
      
      // Fallback to raw count without filters
      const result = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM ${tableName}`
      ) as Array<{ count: bigint }>;
      
      return Number(result[0]?.count || 0);
    }
  } catch (error: any) {
    logger.error({ error: error.message, modelName, where }, 'Error in dynamic count operation');
    return 0;
  }
}

/**
 * Performs a dynamic findUnique operation
 */
export async function dynamicFindUnique(
  modelName: string,
  where: any,
  include?: any
): Promise<any | null> {
  try {
    const tableName = getTableName(modelName);
    const availableColumns = await discoverTableColumns(tableName);
    
    if (availableColumns.length === 0) {
      logger.warn({ modelName, tableName }, 'No columns available for findUnique');
      return null;
    }

    // Try Prisma first for models that have proper schema definitions
    try {
      let result: any = null;
      
      if (modelName === 'product') {
        result = await prisma.product.findUnique({
          where,
          ...(include && { include }),
        });
      } else if (modelName === 'stock') {
        result = await prisma.stock.findUnique({
          where,
          ...(include && { include }),
        });
      } else if (modelName === 'picklist') {
        result = await prisma.picklist.findUnique({
          where,
        });
      }

      if (result) {
        logger.debug({ 
          modelName, 
          foundId: result.id,
          availableFields: Object.keys(result)
        }, 'Prisma findUnique completed successfully');
        return convertBigIntToNumber(result);
      }

      // For models without proper Prisma schema or when Prisma fails, use raw SQL
      if (where.id) {
        // Convert ID to integer if it's a numeric string (for tables with integer IDs)
        let idValue = where.id;
        if (typeof idValue === 'string' && /^\d+$/.test(idValue)) {
          idValue = parseInt(idValue, 10);
        }
        
        const sqlResult = await prisma.$queryRawUnsafe(
          `SELECT * FROM ${tableName} WHERE id = $1 LIMIT 1`,
          idValue
        );
        
        const records = Array.isArray(sqlResult) ? sqlResult : [];
        if (records.length > 0) {
          logger.debug({ 
            modelName, 
            foundId: records[0].id,
            method: 'raw_sql'
          }, 'Raw SQL findUnique completed successfully');
          return convertBigIntToNumber(records[0]);
        }
      }

      return null;
    } catch (prismaError: any) {
      logger.warn({ 
        error: prismaError.message, 
        modelName,
        where 
      }, 'Prisma findUnique failed, falling back to raw SQL');
      
      // Fallback to raw SQL
      if (where.id) {
        // Convert ID to integer if it's a numeric string (for tables with integer IDs)
        let idValue = where.id;
        if (typeof idValue === 'string' && /^\d+$/.test(idValue)) {
          idValue = parseInt(idValue, 10);
        }
        
        const result = await prisma.$queryRawUnsafe(
          `SELECT * FROM ${tableName} WHERE id = $1 LIMIT 1`,
          idValue
        );
        
        const records = Array.isArray(result) ? result : [];
        if (records.length > 0) {
          logger.debug({ 
            modelName, 
            foundId: records[0].id,
            method: 'raw_sql_fallback'
          }, 'Raw SQL fallback findUnique completed successfully');
          return convertBigIntToNumber(records[0]);
        }
      }
      
      return null;
    }
  } catch (error: any) {
    logger.error({ error: error.message, modelName, where }, 'Error in dynamic findUnique operation');
    return null;
  }
}

/**
 * Performs a dynamic create operation
 */
export async function dynamicCreate(
  modelName: string,
  data: Record<string, any>,
  include?: any
): Promise<any | null> {
  try {
    const filteredData = await filterInputDataBySchema(data, modelName, 'create');
    
    if (Object.keys(filteredData).length === 0) {
      logger.warn({ modelName, originalData: data }, 'No valid fields for create operation');
      throw new Error(`No valid fields provided for ${modelName} creation`);
    }

    // Use raw SQL for all models to ensure consistency
    const tableName = getTableName(modelName);
    const availableColumns = await discoverTableColumns(tableName);
    
    // Filter data to only include existing columns
    const rawData: Record<string, any> = {};
    for (const [key, value] of Object.entries(filteredData)) {
      if (availableColumns.includes(key)) {
        rawData[key] = value;
      }
    }
    
    if (Object.keys(rawData).length === 0) {
      logger.warn({ modelName, tableName }, 'No valid columns for create operation');
      throw new Error(`No valid columns found for ${modelName} creation`);
    }
    
    // Add timestamps if not present
    const now = Math.floor(Date.now() / 1000);
    if (!rawData.createddate && availableColumns.includes('createddate')) {
      rawData.createddate = now;
    }
    if (!rawData.modifieddate && availableColumns.includes('modifieddate')) {
      rawData.modifieddate = now;
    }
    
    // Build dynamic INSERT query
    const columns = Object.keys(rawData);
    const values = Object.values(rawData);
    const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
    const columnsList = columns.map(col => `"${col}"`).join(', ');
    
    const insertQuery = `
      INSERT INTO "${tableName}" (${columnsList}) 
      VALUES (${placeholders}) 
      RETURNING *
    `;
    
    logger.debug({ 
      modelName, 
      tableName, 
      columns, 
      query: insertQuery 
    }, 'Executing dynamic create query');
    
    const result = await prisma.$queryRawUnsafe(insertQuery, ...values);
    const records = Array.isArray(result) ? result : [];
    const createdRecord = records.length > 0 ? records[0] : null;
    
    if (createdRecord) {
      logger.info({ 
        modelName, 
        createdId: createdRecord.id,
        fieldsUsed: columns
      }, 'Dynamic create completed successfully');
      return convertBigIntToNumber(createdRecord);
    } else {
      throw new Error(`Failed to create ${modelName} record`);
    }
  } catch (error: any) {
    logger.error({ 
      error: error.message, 
      modelName, 
      data 
    }, 'Error in dynamic create operation');
    throw error; // Re-throw instead of returning null
  }
}

/**
 * Performs a dynamic update operation
 */
export async function dynamicUpdate(
  modelName: string,
  where: any,
  data: Record<string, any>,
  include?: any
): Promise<any | null> {
  try {
    const filteredData = await filterInputDataBySchema(data, modelName, 'update');
    
    if (Object.keys(filteredData).length === 0) {
      logger.warn({ modelName, where, originalData: data }, 'No valid fields for update operation');
      return null;
    }

    // Try Prisma first for models that have proper schema definitions
    try {
      let result: any = null;
      
      if (modelName === 'product') {
        result = await prisma.product.update({
          where,
          data: filteredData,
          include,
        });
      } else if (modelName === 'stock') {
        result = await prisma.stock.update({
          where,
          data: filteredData,
          include,
        });
      } else if (modelName === 'picklist') {
        result = await prisma.picklist.update({
          where,
          data: filteredData,
        });
      }

      if (result) {
        logger.info({ 
          modelName, 
          updatedId: result?.id,
          fieldsUsed: Object.keys(filteredData)
        }, 'Prisma update completed successfully');
        return result;
      }

      // For models without proper Prisma schema (like supplier), use raw SQL
      const tableName = getTableName(modelName);
      const availableColumns = await discoverTableColumns(tableName);
      
      // Filter data to only include existing columns
      const rawData: Record<string, any> = {};
      for (const [key, value] of Object.entries(filteredData)) {
        if (availableColumns.includes(key)) {
          rawData[key] = value;
        }
      }
      
      if (Object.keys(rawData).length === 0) {
        logger.warn({ modelName, tableName }, 'No valid columns for raw SQL update');
        return null;
      }
      
      // Add modifieddate timestamp
      const now = Math.floor(Date.now() / 1000);
      if (availableColumns.includes('modifieddate')) {
        rawData.modifieddate = now;
      }
      
      // Convert ID to integer if it's a numeric string (for tables with integer IDs)
      let idValue = where.id;
      if (typeof idValue === 'string' && /^\d+$/.test(idValue)) {
        idValue = parseInt(idValue, 10);
      }
      
      // Build dynamic UPDATE query
      const setClause = Object.keys(rawData)
        .map((key, index) => `"${key}" = $${index + 2}`) // Start from $2 since $1 is for WHERE
        .join(', ');
      
      const updateQuery = `
        UPDATE "${tableName}" 
        SET ${setClause} 
        WHERE "id" = $1 
        RETURNING *
      `;
      
      const values = [idValue, ...Object.values(rawData)];
      
      logger.debug({ 
        modelName, 
        tableName, 
        updateQuery,
        values: values.length,
        fields: Object.keys(rawData)
      }, 'Executing dynamic update query');
      
      const updateResult = await prisma.$queryRawUnsafe(updateQuery, ...values);
      const records = Array.isArray(updateResult) ? updateResult : [];
      const updatedRecord = records.length > 0 ? records[0] : null;
      
      if (updatedRecord) {
        logger.info({ 
          modelName, 
          updatedId: updatedRecord.id,
          fieldsUsed: Object.keys(rawData)
        }, 'Raw SQL update completed successfully');
        return convertBigIntToNumber(updatedRecord);
      }
      
      return null;
    } catch (prismaError: any) {
      logger.warn({ 
        error: prismaError.message, 
        modelName,
        where,
        data: filteredData 
      }, 'Prisma update failed, falling back to raw SQL');
      
      // Fallback to raw SQL UPDATE
      const tableName = getTableName(modelName);
      const availableColumns = await discoverTableColumns(tableName);
      
      // Filter data to only include existing columns
      const rawData: Record<string, any> = {};
      for (const [key, value] of Object.entries(filteredData)) {
        if (availableColumns.includes(key)) {
          rawData[key] = value;
        }
      }
      
      if (Object.keys(rawData).length === 0) {
        logger.warn({ modelName, tableName }, 'No valid columns for raw SQL fallback update');
        return null;
      }
      
      // Add modifieddate timestamp
      const now = Math.floor(Date.now() / 1000);
      if (availableColumns.includes('modifieddate')) {
        rawData.modifieddate = now;
      }
      
      // Convert ID to integer if it's a numeric string (for tables with integer IDs)
      let idValue = where.id;
      if (typeof idValue === 'string' && /^\d+$/.test(idValue)) {
        idValue = parseInt(idValue, 10);
      }
      
      // Build dynamic UPDATE query
      const setClause = Object.keys(rawData)
        .map((key, index) => `"${key}" = $${index + 2}`) // Start from $2 since $1 is for WHERE
        .join(', ');
      
      const updateQuery = `
        UPDATE "${tableName}" 
        SET ${setClause} 
        WHERE "id" = $1 
        RETURNING *
      `;
      
      const values = [idValue, ...Object.values(rawData)];
      const result = await prisma.$queryRawUnsafe(updateQuery, ...values);
      const records = Array.isArray(result) ? result : [];
      const updatedRecord = records.length > 0 ? records[0] : null;
      
      if (updatedRecord) {
        logger.info({ 
          modelName, 
          updatedId: updatedRecord.id,
          fieldsUsed: Object.keys(rawData)
        }, 'Raw SQL fallback update completed successfully');
      }
      
      return updatedRecord ? convertBigIntToNumber(updatedRecord) : null;
    }
  } catch (error: any) {
    logger.error({ 
      error: error.message, 
      modelName, 
      where, 
      data 
    }, 'Error in dynamic update operation');
    return null;
  }
}

/**
 * Performs a dynamic delete operation
 */
export async function dynamicDelete(
  modelName: string,
  where: any
): Promise<boolean> {
  try {
    // Input validation
    if (!modelName || !where || !where.id) {
      logger.warn({ modelName, where }, 'Invalid input for delete operation');
      return false;
    }

    // Convert ID to integer if it's a numeric string
    let idValue = where.id;
    if (typeof idValue === 'string' && /^\d+$/.test(idValue)) {
      idValue = parseInt(idValue, 10);
    }

    // Get table name and validate it exists
    const tableName = getTableName(modelName);
    const availableColumns = await discoverTableColumns(tableName);
    
    if (availableColumns.length === 0) {
      logger.warn({ modelName, tableName }, 'Table not found or has no columns');
      return false;
    }

    // Verify ID column exists
    if (!availableColumns.includes('id')) {
      logger.warn({ modelName, tableName, columns: availableColumns }, 'Table does not have an id column');
      return false;
    }

    // Try Prisma first for models with schema
    try {
      let result: any = null;
      
      if (modelName === 'product') {
        result = await prisma.product.delete({ where: { id: idValue } });
      } else if (modelName === 'stock') {
        result = await prisma.stock.delete({ where: { id: idValue } });
      } else if (modelName === 'picklist') {
        result = await prisma.picklist.delete({ where: { id: idValue } });
      }

      if (result) {
        logger.info({ 
          modelName, 
          deletedId: result?.id 
        }, 'Prisma delete completed successfully');
        return true;
      }

      logger.debug({ 
        modelName,
        where 
      }, 'No Prisma model found or delete failed, falling back to raw SQL');
      
    } catch (prismaError: any) {
      logger.warn({ 
        error: prismaError.message, 
        modelName,
        where 
      }, 'Prisma delete failed, falling back to raw SQL');
    }
    
    // Fallback to raw SQL DELETE with better error handling
    try {
      const deleteQuery = `
        DELETE FROM "${tableName}" 
        WHERE "id" = $1 
        RETURNING id
      `;
      
      logger.debug({ 
        modelName,
        tableName,
        query: deleteQuery,
        id: idValue
      }, 'Executing raw SQL delete');

      const result = await prisma.$queryRawUnsafe(deleteQuery, idValue);
      
      // Ensure result is properly handled
      const records = Array.isArray(result) ? result : [];
      const success = records.length > 0;
      
      if (success) {
        logger.info({ 
          modelName, 
          deletedId: idValue,
          method: 'raw_sql'
        }, 'Raw SQL delete completed successfully');
      } else {
        logger.warn({ 
          modelName, 
          id: idValue,
          method: 'raw_sql'
        }, 'Record not found for deletion');
      }
      
      return success;
    } catch (sqlError: any) {
      // Handle specific SQL errors
      logger.error({ 
        error: sqlError.message, 
        code: sqlError.code,
        modelName,
        tableName,
        id: idValue
      }, 'Raw SQL delete failed');
      
      // Check for foreign key constraint violations
      if (sqlError.code === '23503') {
        logger.warn({
          modelName,
          id: idValue,
          constraint: sqlError.constraint
        }, 'Cannot delete record due to foreign key constraint');
      }
      
      throw sqlError;
    }
  } catch (error: any) {
    logger.error({ 
      error: error.message, 
      modelName, 
      where,
      stack: error.stack
    }, 'Error in dynamic delete operation');
    return false;
  }
}

/**
 * Clears the schema cache (useful for testing or when schema changes)
 */
export function clearSchemaCache(): void {
  schemaCache.clear();
  logger.info('Schema cache cleared');
}

/**
 * Gets current schema cache status
 */
export function getSchemaCacheStatus(): Array<{ tableName: string; columns: string[]; age: number }> {
  const now = Date.now();
  return Array.from(schemaCache.values()).map(schema => ({
    tableName: schema.tableName,
    columns: schema.columns,
    age: now - schema.lastChecked
  }));
}

/**
 * Safely serializes database objects for API responses
 * This function ensures that all database objects are properly converted to JSON-serializable values
 */
export function serializeForAPI(data: any): any {
  return convertBigIntToNumber(data);
}

/**
 * Generic function to format numeric fields consistently
 */
function formatNumericField(value: any): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  
  const stringValue = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(stringValue)) {
    return Number(stringValue);
  }
  
  return null;
}

/**
 * Generic function to format integer fields consistently
 */
function formatIntegerField(value: any): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  
  const stringValue = String(value).trim();
  if (/^\d+$/.test(stringValue)) {
    return parseInt(stringValue, 10);
  }
  
  return null;
}

/**
 * Formats a single supplier object for API response
 * Ensures all numeric fields are properly converted and handles any special cases
 */
export function formatSupplierForAPI(supplier: any): any {
  if (!supplier) return supplier;
  
  const formatted = serializeForAPI(supplier);
  
  // Ensure specific fields are properly typed as numbers
  if (formatted.id !== undefined) {
    formatted.id = formatIntegerField(formatted.id) || formatted.id;
  }
  
  // Handle pincode - ensure it's a number if it contains numeric data
  if (formatted.pincode !== undefined) {
    formatted.pincode = formatIntegerField(formatted.pincode);
  }
  
  // Handle phone numbers
  if (formatted.supplierphonenumber !== undefined) {
    formatted.supplierphonenumber = formatIntegerField(formatted.supplierphonenumber);
  }
  
  if (formatted.supplierlandline !== undefined) {
    formatted.supplierlandline = formatIntegerField(formatted.supplierlandline);
  }
  
  // Handle timestamps
  if (formatted.createddate !== undefined) {
    formatted.createddate = formatIntegerField(formatted.createddate) || formatted.createddate;
  }
  if (formatted.modifieddate !== undefined) {
    formatted.modifieddate = formatIntegerField(formatted.modifieddate) || formatted.modifieddate;
  }
  
  return formatted;
}

/**
 * Formats a single product object for API response
 */
export function formatProductForAPI(product: any): any {
  if (!product) return product;
  
  const formatted = serializeForAPI(product);
  
  // Format numeric fields
  if (formatted.id !== undefined) {
    formatted.id = formatIntegerField(formatted.id) || formatted.id;
  }
  if (formatted.price !== undefined) {
    formatted.price = formatNumericField(formatted.price);
  }
  if (formatted.createddate !== undefined) {
    formatted.createddate = formatIntegerField(formatted.createddate) || formatted.createddate;
  }
  if (formatted.modifieddate !== undefined) {
    formatted.modifieddate = formatIntegerField(formatted.modifieddate) || formatted.modifieddate;
  }
  
  return formatted;
}

/**
 * Formats a single stock object for API response
 */
export function formatStockForAPI(stock: any): any {
  if (!stock) return stock;
  
  const formatted = serializeForAPI(stock);
  
  // Format numeric fields
  if (formatted.id !== undefined) {
    formatted.id = formatIntegerField(formatted.id) || formatted.id;
  }
  if (formatted.quantity !== undefined) {
    formatted.quantity = formatIntegerField(formatted.quantity);
  }
  if (formatted.minstock !== undefined) {
    formatted.minstock = formatIntegerField(formatted.minstock);
  }
  if (formatted.maxstock !== undefined) {
    formatted.maxstock = formatIntegerField(formatted.maxstock);
  }
  if (formatted.createddate !== undefined) {
    formatted.createddate = formatIntegerField(formatted.createddate) || formatted.createddate;
  }
  if (formatted.modifieddate !== undefined) {
    formatted.modifieddate = formatIntegerField(formatted.modifieddate) || formatted.modifieddate;
  }
  
  return formatted;
}

/**
 * Formats a single purchase order object for API response
 */
export function formatPurchaseOrderForAPI(purchaseOrder: any): any {
  if (!purchaseOrder) return purchaseOrder;
  
  const formatted = serializeForAPI(purchaseOrder);
  
  // Format numeric fields
  if (formatted.id !== undefined) {
    formatted.id = formatIntegerField(formatted.id) || formatted.id;
  }
  if (formatted.supplierid !== undefined) {
    formatted.supplierid = formatIntegerField(formatted.supplierid);
  }
  if (formatted.quantity !== undefined) {
    formatted.quantity = formatIntegerField(formatted.quantity);
  }
  if (formatted.unitprice !== undefined) {
    formatted.unitprice = formatNumericField(formatted.unitprice);
  }
  if (formatted.totalprice !== undefined) {
    formatted.totalprice = formatNumericField(formatted.totalprice);
  }
  
  // Handle phone number fields
  if (formatted.phonenumber !== undefined) {
    formatted.phonenumber = formatIntegerField(formatted.phonenumber);
  }
  if (formatted.io_phonenumber !== undefined) {
    formatted.io_phonenumber = formatIntegerField(formatted.io_phonenumber);
  }
  if (formatted.dt_phonenumber !== undefined) {
    formatted.dt_phonenumber = formatIntegerField(formatted.dt_phonenumber);
  }
  if (formatted.supplierphonenumber !== undefined) {
    formatted.supplierphonenumber = formatIntegerField(formatted.supplierphonenumber);
  }
  
  // Handle financial fields
  if (formatted.subtotal !== undefined) {
    formatted.subtotal = formatNumericField(formatted.subtotal);
  }
  if (formatted.discount !== undefined) {
    formatted.discount = formatNumericField(formatted.discount);
  }
  if (formatted.sgst !== undefined) {
    formatted.sgst = formatNumericField(formatted.sgst);
  }
  if (formatted.cgst !== undefined) {
    formatted.cgst = formatNumericField(formatted.cgst);
  }
  if (formatted.payabletaxamount !== undefined) {
    formatted.payabletaxamount = formatNumericField(formatted.payabletaxamount);
  }
  if (formatted.total !== undefined) {
    formatted.total = formatNumericField(formatted.total);
  }
  
  // Handle timestamps
  if (formatted.createddate !== undefined) {
    formatted.createddate = formatIntegerField(formatted.createddate) || formatted.createddate;
  }
  if (formatted.modifieddate !== undefined) {
    formatted.modifieddate = formatIntegerField(formatted.modifieddate) || formatted.modifieddate;
  }
  
  return formatted;
}

/**
 * Formats a single purchase request object for API response
 */
export function formatPurchaseRequestForAPI(purchaseRequest: any): any {
  if (!purchaseRequest) return purchaseRequest;
  
  const formatted = serializeForAPI(purchaseRequest);
  
  // Format numeric fields
  if (formatted.id !== undefined) {
    formatted.id = formatIntegerField(formatted.id) || formatted.id;
  }
  if (formatted.quantity !== undefined) {
    formatted.quantity = formatIntegerField(formatted.quantity);
  }
  if (formatted.estimatedprice !== undefined) {
    formatted.estimatedprice = formatNumericField(formatted.estimatedprice);
  }
  if (formatted.createddate !== undefined) {
    formatted.createddate = formatIntegerField(formatted.createddate) || formatted.createddate;
  }
  if (formatted.modifieddate !== undefined) {
    formatted.modifieddate = formatIntegerField(formatted.modifieddate) || formatted.modifieddate;
  }
  
  return formatted;
}

/**
 * Formats a single picklist object for API response
 */
export function formatPicklistForAPI(picklist: any): any {
  if (!picklist) return picklist;
  
  const formatted = serializeForAPI(picklist);
  
  // Format numeric fields
  if (formatted.id !== undefined) {
    formatted.id = formatIntegerField(formatted.id) || formatted.id;
  }
  if (formatted.ordering !== undefined) {
    formatted.ordering = formatIntegerField(formatted.ordering);
  }
  
  return formatted;
}

/**
 * Formats a single quotes object for API response
 */
export function formatQuotesForAPI(quote: any): any {
  if (!quote) return quote;
  
  const formatted = serializeForAPI(quote);
  
  // Format numeric fields
  if (formatted.id !== undefined) {
    formatted.id = formatIntegerField(formatted.id) || formatted.id;
  }
  if (formatted.createddate !== undefined) {
    formatted.createddate = formatIntegerField(formatted.createddate) || formatted.createddate;
  }
  if (formatted.modifieddate !== undefined) {
    formatted.modifieddate = formatIntegerField(formatted.modifieddate) || formatted.modifieddate;
  }
  
  return formatted;
}

/**
 * Universal formatter that detects entity type and applies appropriate formatting
 */
export function formatEntityForAPI(entity: any, entityType?: string): any {
  if (!entity) return entity;
  
  // If entityType is provided, use specific formatter
  if (entityType) {
    switch (entityType.toLowerCase()) {
      case 'supplier':
        return formatSupplierForAPI(entity);
      case 'product':
        return formatProductForAPI(entity);
      case 'stock':
        return formatStockForAPI(entity);
      case 'purchaseorder':
        return formatPurchaseOrderForAPI(entity);
      case 'purchaserequest':
        return formatPurchaseRequestForAPI(entity);
      case 'picklist':
        return formatPicklistForAPI(entity);
      case 'quotes':
        return formatQuotesForAPI(entity);
      default:
        return serializeForAPI(entity);
    }
  }
  
  // Auto-detect entity type based on fields
  if (entity.suppliername || entity.suppliercode) {
    return formatSupplierForAPI(entity);
  }
  if (entity.productname || entity.puc) {
    return formatProductForAPI(entity);
  }
  if (entity.stockstatus || entity.serialnumber) {
    return formatStockForAPI(entity);
  }
  if (entity.ponumber || entity.unitprice) {
    return formatPurchaseOrderForAPI(entity);
  }
  if (entity.requestnumber || entity.estimatedprice) {
    return formatPurchaseRequestForAPI(entity);
  }
  if (entity.type && entity.table && entity.field) {
    return formatPicklistForAPI(entity);
  }
  if (entity.quotenumber || entity.quoteurl) {
    return formatQuotesForAPI(entity);
  }
  
  // Fallback to generic serialization
  return serializeForAPI(entity);
}

/**
 * Formats an array of entities for API response
 */
export function formatEntitiesForAPI(entities: any[], entityType?: string): any[] {
  if (!Array.isArray(entities)) return entities;
  
  return entities.map(entity => formatEntityForAPI(entity, entityType));
} 