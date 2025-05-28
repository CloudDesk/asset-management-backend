import { prisma } from '../models/prisma.js';
import { logger } from '../config/logger.js';
// Cache for discovered table schemas (30 minute TTL for better performance)
const schemaCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
// Cache for safe columns to avoid repeated schema queries
const safeColumnsCache = new Map();
const SAFE_COLUMNS_TTL = 30 * 60 * 1000; // 30 minutes
// Predefined safe columns for common tables (to avoid schema queries)
const PREDEFINED_SAFE_COLUMNS = {
    stock: ['id', 'puc', 'category', 'subcategory', 'brand', 'model', 'stockstatus', 'createddate', 'modifieddate', 'productname', 'serialnumber', 'location'],
    product: ['id', 'productname', 'category', 'subcategory', 'brand', 'model', 'price', 'createddate', 'modifieddate', 'productstatus', 'puc'],
    picklist: ['id', 'type', 'table', 'field', 'label', 'value', 'isActive', 'ordering']
};
/**
 * Gets safe columns for a table with caching to improve performance
 */
async function getSafeColumnsForTable(tableName) {
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
  `, tableName);
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
async function discoverTableColumns(tableName) {
    try {
        // Check cache first
        const cached = schemaCache.get(tableName);
        if (cached && (Date.now() - cached.lastChecked) < CACHE_TTL) {
            return cached.columns;
        }
        logger.debug({ tableName }, 'Discovering table columns');
        // Query PostgreSQL information schema to get column names
        const result = await prisma.$queryRaw `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = ${tableName}
      AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
        const columns = result.map((row) => row.column_name);
        // Cache the result
        schemaCache.set(tableName, {
            tableName,
            columns,
            lastChecked: Date.now()
        });
        logger.info({ tableName, columns }, `Discovered ${columns.length} columns for table ${tableName}`);
        return columns;
    }
    catch (error) {
        logger.error({ error, tableName }, 'Failed to discover table columns');
        return []; // Return empty array if discovery fails
    }
}
/**
 * Gets the actual table name from the Prisma model name
 */
function getTableName(modelName) {
    // Map model names to actual table names
    const tableMapping = {
        'product': 'product',
        'stock': 'stock',
        'picklist': 'picklist',
        'supplier': 'supplier',
        'purchaseorder': 'purchaseorder',
        'purchaserequest': 'purchaserequest'
    };
    return tableMapping[modelName] || modelName;
}
/**
 * Converts BigInt values to numbers for JSON serialization
 */
function convertBigIntToNumber(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === 'bigint') {
        return Number(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(convertBigIntToNumber);
    }
    if (typeof obj === 'object') {
        const converted = {};
        for (const [key, value] of Object.entries(obj)) {
            converted[key] = convertBigIntToNumber(value);
        }
        return converted;
    }
    return obj;
}
/**
 * Filters input data to only include columns that exist in the database
 */
async function filterInputDataBySchema(data, modelName, operation = 'create') {
    const tableName = getTableName(modelName);
    const availableColumns = await discoverTableColumns(tableName);
    if (availableColumns.length === 0) {
        logger.warn({ modelName, tableName }, 'No columns available, returning empty data');
        return {};
    }
    const filteredData = {};
    const ignoredFields = [];
    for (const [key, value] of Object.entries(data)) {
        if (availableColumns.includes(key)) {
            filteredData[key] = value;
        }
        else {
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
function getFastColumns(tableName) {
    const safeColumns = PREDEFINED_SAFE_COLUMNS[tableName];
    return safeColumns ? safeColumns.join(', ') : 'id, createddate, modifieddate';
}
/**
 * Performs a fast findMany operation optimized for performance
 */
export async function fastFindMany(modelName, options = {}) {
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
    }
    catch (error) {
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
async function buildDynamicWhereClause(tableName, filters) {
    if (!filters || Object.keys(filters).length === 0) {
        return { whereClause: '', values: [] };
    }
    // Get available columns for the table
    const availableColumns = await discoverTableColumns(tableName);
    const conditions = [];
    const values = [];
    let paramIndex = 1;
    // Helper function to find matching column name with case variations
    function findMatchingColumn(filterKey) {
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
        const matchingColumn = availableColumns.find(col => col.toLowerCase() === filterKey.toLowerCase());
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
                }
                else if (key.startsWith('max') && key.length > 3) {
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
                }
                else if (key.includes('date') || key.includes('Date')) {
                    // Date filters
                    conditions.push(`"${matchingColumn}" = $${paramIndex}`);
                    values.push(processedValue);
                    paramIndex++;
                }
                else if (typeof processedValue === 'string') {
                    // String filters - support both exact match and ILIKE
                    if (processedValue.includes('%') || processedValue.includes('*')) {
                        // Wildcard search
                        const searchValue = processedValue.replace(/\*/g, '%');
                        conditions.push(`"${matchingColumn}" ILIKE $${paramIndex}`);
                        values.push(searchValue);
                    }
                    else {
                        // Exact match (case-insensitive for strings)
                        conditions.push(`LOWER("${matchingColumn}") = LOWER($${paramIndex})`);
                        values.push(processedValue);
                    }
                    paramIndex++;
                }
                else {
                    // Exact match for numbers, booleans, etc.
                    conditions.push(`"${matchingColumn}" = $${paramIndex}`);
                    values.push(processedValue);
                    paramIndex++;
                }
            }
        }
        else {
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
export async function dynamicFindManyWithFilters(modelName, filters = {}, options = {}) {
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
        const total = Number(countResult[0]?.count || 0);
        logger.info({
            modelName,
            filters: Object.keys(filters),
            total,
            returned: data.length,
            filtered: whereClause !== ''
        }, 'Dynamic filtered findMany completed');
        return { data, total };
    }
    catch (error) {
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
export async function dynamicFindMany(modelName, options = {}) {
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
            }
            catch (sqlError) {
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
            let result = [];
            if (modelName === 'product') {
                const findOptions = {};
                if (options.where !== undefined)
                    findOptions.where = options.where;
                if (options.skip !== undefined)
                    findOptions.skip = options.skip;
                if (options.take !== undefined)
                    findOptions.take = options.take;
                if (options.orderBy !== undefined)
                    findOptions.orderBy = options.orderBy;
                result = await prisma.product.findMany(findOptions);
            }
            else if (modelName === 'stock') {
                const findOptions = {};
                if (options.where !== undefined)
                    findOptions.where = options.where;
                if (options.skip !== undefined)
                    findOptions.skip = options.skip;
                if (options.take !== undefined)
                    findOptions.take = options.take;
                if (options.orderBy !== undefined)
                    findOptions.orderBy = options.orderBy;
                result = await prisma.stock.findMany(findOptions);
            }
            else if (modelName === 'picklist') {
                const findOptions = {};
                if (options.where !== undefined)
                    findOptions.where = options.where;
                if (options.skip !== undefined)
                    findOptions.skip = options.skip;
                if (options.take !== undefined)
                    findOptions.take = options.take;
                if (options.orderBy !== undefined)
                    findOptions.orderBy = options.orderBy;
                result = await prisma.picklist.findMany(findOptions);
            }
            logger.debug({
                modelName,
                resultCount: result.length
            }, 'Prisma findMany completed successfully');
            return result;
        }
        catch (prismaError) {
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
    }
    catch (error) {
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
export async function dynamicCount(modelName, where) {
    try {
        const tableName = getTableName(modelName);
        // For simple count without filters, use direct query (fastest)
        if (!where || Object.keys(where).length === 0) {
            logger.debug({ tableName }, 'Executing optimized COUNT(*) query');
            const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
            const count = Number(result[0]?.count || 0);
            logger.debug({ tableName, count }, 'Optimized count completed');
            return count;
        }
        // For filtered queries, try Prisma first (it might be optimized)
        try {
            let result = 0;
            if (modelName === 'product') {
                result = await prisma.product.count({ where });
            }
            else if (modelName === 'stock') {
                result = await prisma.stock.count({ where });
            }
            else if (modelName === 'picklist') {
                result = await prisma.picklist.count({ where });
            }
            return result;
        }
        catch (prismaError) {
            logger.warn({
                error: prismaError.message,
                modelName
            }, 'Prisma count failed, falling back to raw SQL');
            // Fallback to raw count without filters
            const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM ${tableName}`);
            return Number(result[0]?.count || 0);
        }
    }
    catch (error) {
        logger.error({ error: error.message, modelName, where }, 'Error in dynamic count operation');
        return 0;
    }
}
/**
 * Performs a dynamic findUnique operation
 */
export async function dynamicFindUnique(modelName, where, include) {
    try {
        const tableName = getTableName(modelName);
        const availableColumns = await discoverTableColumns(tableName);
        if (availableColumns.length === 0) {
            logger.warn({ modelName, tableName }, 'No columns available for findUnique');
            return null;
        }
        // Try Prisma first for models that have proper schema definitions
        try {
            let result = null;
            if (modelName === 'product') {
                result = await prisma.product.findUnique({
                    where,
                    include,
                });
            }
            else if (modelName === 'stock') {
                result = await prisma.stock.findUnique({
                    where,
                    include,
                });
            }
            else if (modelName === 'picklist') {
                result = await prisma.picklist.findUnique({
                    where,
                    include,
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
                const sqlResult = await prisma.$queryRawUnsafe(`SELECT * FROM ${tableName} WHERE id = $1 LIMIT 1`, idValue);
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
        }
        catch (prismaError) {
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
                const result = await prisma.$queryRawUnsafe(`SELECT * FROM ${tableName} WHERE id = $1 LIMIT 1`, idValue);
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
    }
    catch (error) {
        logger.error({ error: error.message, modelName, where }, 'Error in dynamic findUnique operation');
        return null;
    }
}
/**
 * Performs a dynamic create operation
 */
export async function dynamicCreate(modelName, data, include) {
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
        const rawData = {};
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
        }
        else {
            throw new Error(`Failed to create ${modelName} record`);
        }
    }
    catch (error) {
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
export async function dynamicUpdate(modelName, where, data, include) {
    try {
        const filteredData = await filterInputDataBySchema(data, modelName, 'update');
        if (Object.keys(filteredData).length === 0) {
            logger.warn({ modelName, where, originalData: data }, 'No valid fields for update operation');
            return null;
        }
        // Try Prisma first for models that have proper schema definitions
        try {
            let result = null;
            if (modelName === 'product') {
                result = await prisma.product.update({
                    where,
                    data: filteredData,
                    include,
                });
            }
            else if (modelName === 'stock') {
                result = await prisma.stock.update({
                    where,
                    data: filteredData,
                    include,
                });
            }
            else if (modelName === 'picklist') {
                result = await prisma.picklist.update({
                    where,
                    data: filteredData,
                    include,
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
            const rawData = {};
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
        }
        catch (prismaError) {
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
            const rawData = {};
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
    }
    catch (error) {
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
export async function dynamicDelete(modelName, where) {
    try {
        // Try Prisma first
        try {
            let result = null;
            if (modelName === 'product') {
                result = await prisma.product.delete({ where });
            }
            else if (modelName === 'stock') {
                result = await prisma.stock.delete({ where });
            }
            else if (modelName === 'picklist') {
                result = await prisma.picklist.delete({ where });
            }
            logger.info({
                modelName,
                deletedId: result?.id
            }, 'Prisma delete completed successfully');
            return true;
        }
        catch (prismaError) {
            logger.warn({
                error: prismaError.message,
                modelName,
                where
            }, 'Prisma delete failed, falling back to raw SQL');
            // Fallback to raw SQL DELETE
            const tableName = getTableName(modelName);
            const deleteQuery = `
        DELETE FROM "${tableName}" 
        WHERE "id" = $1 
        RETURNING id
      `;
            const result = await prisma.$queryRawUnsafe(deleteQuery, where.id);
            const records = Array.isArray(result) ? result : [];
            const success = records.length > 0;
            if (success) {
                logger.info({
                    modelName,
                    deletedId: where.id
                }, 'Raw SQL delete completed successfully');
            }
            return success;
        }
    }
    catch (error) {
        logger.error({
            error: error.message,
            modelName,
            where
        }, 'Error in dynamic delete operation');
        return false;
    }
}
/**
 * Clears the schema cache (useful for testing or when schema changes)
 */
export function clearSchemaCache() {
    schemaCache.clear();
    logger.info('Schema cache cleared');
}
/**
 * Gets current schema cache status
 */
export function getSchemaCacheStatus() {
    const now = Date.now();
    return Array.from(schemaCache.values()).map(schema => ({
        tableName: schema.tableName,
        columns: schema.columns,
        age: now - schema.lastChecked
    }));
}
//# sourceMappingURL=dynamicDbOperations.js.map