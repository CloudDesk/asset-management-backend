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
            // Debug logging for pincode field
            if (key === 'pincode') {
                console.log('=== PINCODE DEBUG ===');
                console.log('pincode value:', value);
                console.log('pincode type:', typeof value);
                console.log('pincode constructor:', value?.constructor?.name);
                console.log('pincode toString:', value?.toString?.());
                console.log('===================');
            }
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
 * Validates and converts query parameter values to prevent object conversion errors
 */
function validateQueryParameter(key, value) {
    console.log(`=== validateQueryParameter DEBUG ===`);
    console.log(`key: ${key}, value:`, value, `typeof: ${typeof value}`);
    // If value is an object, try to extract a meaningful value or skip it
    if (typeof value === 'object' && value !== null) {
        console.log(`HANDLING OBJECT for key: ${key}`);
        // If it's an array, take the first element
        if (Array.isArray(value)) {
            if (value.length > 0) {
                const firstValue = value[0];
                console.log(`USING FIRST ARRAY ELEMENT for key: ${key}, value: ${firstValue}`);
                return String(firstValue);
            }
            else {
                console.log(`EMPTY ARRAY for key: ${key}`);
                return null;
            }
        }
        // If it's a plain object, try to get a string representation or skip it
        if (value.toString && value.toString() !== '[object Object]') {
            const stringValue = value.toString();
            console.log(`USING OBJECT toString for key: ${key}, value: ${stringValue}`);
            return stringValue;
        }
        // If we can't meaningfully convert the object, skip this parameter
        console.log(`SKIPPING COMPLEX OBJECT for key: ${key}`);
        return null;
    }
    // If value is undefined or null, return null
    if (value === undefined || value === null) {
        console.log(`NULL/UNDEFINED for key: ${key}`);
        return null;
    }
    // Convert to string for consistency (query params are typically strings)
    const result = String(value);
    console.log(`CONVERTED for key: ${key}, result: ${result}`);
    return result;
}
/**
 * Gets column information including data types for a table
 */
async function getColumnInfo(tableName) {
    try {
        const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, tableName);
        return result;
    }
    catch (error) {
        logger.error({ error, tableName }, 'Failed to get column info');
        return [];
    }
}
/**
 * Determines if a column is numeric based on its data type
 */
function isNumericColumn(dataType) {
    const numericTypes = [
        'integer', 'bigint', 'smallint', 'decimal', 'numeric',
        'real', 'double precision', 'serial', 'bigserial', 'smallserial'
    ];
    return numericTypes.includes(dataType.toLowerCase());
}
/**
 * Determines if a column is a date/time column based on its data type
 */
function isDateTimeColumn(dataType) {
    const dateTimeTypes = [
        'timestamp', 'timestamp with time zone', 'timestamp without time zone',
        'date', 'time', 'time with time zone', 'time without time zone'
    ];
    return dateTimeTypes.some(type => dataType.toLowerCase().includes(type));
}
/**
 * Determines if a column is a UUID column based on its data type
 */
function isUuidColumn(dataType) {
    return dataType.toLowerCase() === 'uuid';
}
/**
 * Builds dynamic WHERE clause for any table based on query parameters
 */
async function buildDynamicWhereClause(tableName, filters) {
    console.log('=== buildDynamicWhereClause DEBUG ===');
    console.log('tableName:', tableName);
    console.log('filters:', JSON.stringify(filters, null, 2));
    console.log('filters keys:', Object.keys(filters));
    if (!filters || Object.keys(filters).length === 0) {
        console.log('No filters provided, returning empty where clause');
        return { whereClause: '', values: [] };
    }
    // Get column information including data types
    const columnInfo = await getColumnInfo(tableName);
    const columnMap = new Map();
    columnInfo.forEach(col => {
        columnMap.set(col.column_name, col.data_type);
    });
    const availableColumns = columnInfo.map(col => col.column_name);
    console.log('availableColumns:', availableColumns);
    console.log('columnTypes:', Object.fromEntries(columnMap));
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
    for (const [key, rawValue] of Object.entries(filters)) {
        console.log(`Processing filter: key=${key}, rawValue=`, rawValue, `typeof=${typeof rawValue}`);
        // Skip pagination parameters
        if (['page', 'limit', 'skip', 'take'].includes(key)) {
            console.log(`Skipping pagination parameter: ${key}`);
            continue;
        }
        try {
            // Validate and convert the query parameter
            const value = validateQueryParameter(key, rawValue);
            console.log(`After validation: key=${key}, value=${value}`);
            // Skip empty values
            if (value === null || value === '') {
                console.log(`Skipping empty value for key: ${key}`);
                continue;
            }
            // Find matching column with case variations
            const matchingColumn = findMatchingColumn(key);
            console.log(`Matching column for ${key}: ${matchingColumn}`);
            if (matchingColumn) {
                const dataType = columnMap.get(matchingColumn);
                console.log(`Column ${matchingColumn} has data type: ${dataType}`);
                // Handle different filter types
                if (key.startsWith('min') && key.length > 3) {
                    // Range filters like minPrice, minQuantity
                    const baseKey = key.substring(3);
                    const columnName = findMatchingColumn(baseKey);
                    if (columnName) {
                        const numValue = Number(value);
                        if (isNaN(numValue)) {
                            logger.warn({ key, value }, `Invalid numeric value for range filter '${key}'`);
                            continue;
                        }
                        console.log(`Adding min range condition: ${columnName} >= ${numValue}`);
                        conditions.push(`"${columnName}" >= $${paramIndex}`);
                        values.push(numValue);
                        paramIndex++;
                    }
                }
                else if (key.startsWith('max') && key.length > 3) {
                    // Range filters like maxPrice, maxQuantity
                    const baseKey = key.substring(3);
                    const columnName = findMatchingColumn(baseKey);
                    if (columnName) {
                        const numValue = Number(value);
                        if (isNaN(numValue)) {
                            logger.warn({ key, value }, `Invalid numeric value for range filter '${key}'`);
                            continue;
                        }
                        console.log(`Adding max range condition: ${columnName} <= ${numValue}`);
                        conditions.push(`"${columnName}" <= $${paramIndex}`);
                        values.push(numValue);
                        paramIndex++;
                    }
                }
                else if (isDateTimeColumn(dataType || '')) {
                    // Date/time filters - use exact match
                    console.log(`Adding date condition: ${matchingColumn} = ${value}`);
                    conditions.push(`"${matchingColumn}" = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
                else if (isNumericColumn(dataType || '')) {
                    // Numeric filters - use exact match
                    const numValue = Number(value);
                    if (isNaN(numValue)) {
                        logger.warn({ key, value, dataType }, `Invalid numeric value for numeric column '${matchingColumn}'`);
                        continue;
                    }
                    console.log(`Adding numeric condition: ${matchingColumn} = ${numValue}`);
                    conditions.push(`"${matchingColumn}" = $${paramIndex}`);
                    values.push(numValue);
                    paramIndex++;
                }
                else if (isUuidColumn(dataType || '')) {
                    // UUID filters - use exact match
                    console.log(`Adding UUID condition: ${matchingColumn} = ${value}`);
                    conditions.push(`"${matchingColumn}" = $${paramIndex}`);
                    values.push(value);
                    paramIndex++;
                }
                else {
                    // String filters - support both exact match and ILIKE
                    if (value.includes('%') || value.includes('*')) {
                        // Wildcard search
                        const searchValue = value.replace(/\*/g, '%');
                        console.log(`Adding wildcard condition: ${matchingColumn} ILIKE ${searchValue}`);
                        conditions.push(`"${matchingColumn}" ILIKE $${paramIndex}`);
                        values.push(searchValue);
                    }
                    else {
                        // Partial match for strings (case-insensitive)
                        console.log(`Adding string partial match condition: ${matchingColumn} ILIKE %${value}%`);
                        conditions.push(`"${matchingColumn}" ILIKE $${paramIndex}`);
                        values.push(`%${value}%`);
                    }
                    paramIndex++;
                }
            }
            else {
                console.log(`No matching column found for filter key: ${key}`);
                logger.warn({ key, availableColumns }, `Filter key '${key}' does not match any available columns`);
            }
        }
        catch (error) {
            console.log(`Error processing filter ${key}:`, error.message);
            logger.error({ key, rawValue, error: error.message }, 'Error processing filter parameter');
            throw error; // Re-throw to stop processing
        }
    }
    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '';
    console.log('Final whereClause:', whereClause);
    console.log('Final values:', JSON.stringify(values, null, 2));
    return { whereClause, values };
}
/**
 * Performs dynamic findMany with proper filtering and counting
 */
export async function dynamicFindManyWithFilters(modelName, filters = {}, options = {}) {
    console.log('=== dynamicFindManyWithFilters DEBUG ===');
    console.log('modelName:', modelName);
    console.log('filters:', JSON.stringify(filters, null, 2));
    console.log('options:', JSON.stringify(options, null, 2));
    try {
        const tableName = getTableName(modelName);
        const { skip = 0, take = 10, useAllColumns = false } = options;
        console.log('tableName:', tableName);
        console.log('skip:', skip, 'take:', take, 'useAllColumns:', useAllColumns);
        // Build WHERE clause from filters
        const { whereClause, values } = await buildDynamicWhereClause(tableName, filters);
        console.log('whereClause:', whereClause);
        console.log('values:', JSON.stringify(values, null, 2));
        // Get columns for the table
        const { columnList } = useAllColumns ?
            await getSafeColumnsForTable(tableName) :
            { columnList: getFastColumns(tableName) };
        console.log('columnList:', columnList);
        // Build the main query
        const baseQuery = `SELECT ${columnList} FROM ${tableName}`;
        const fullQuery = whereClause ?
            `${baseQuery} WHERE ${whereClause} ORDER BY id DESC LIMIT ${take} OFFSET ${skip}` :
            `${baseQuery} ORDER BY id DESC LIMIT ${take} OFFSET ${skip}`;
        console.log('fullQuery:', fullQuery);
        // Build count query
        const countQuery = whereClause ?
            `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}` :
            `SELECT COUNT(*) as count FROM ${tableName}`;
        console.log('countQuery:', countQuery);
        // Execute queries
        logger.debug({
            modelName,
            tableName,
            query: fullQuery,
            countQuery,
            filterCount: Object.keys(filters).length,
            useAllColumns
        }, 'Executing dynamic findMany with filters');
        const [data, countResult] = await Promise.all([
            values.length > 0 ?
                prisma.$queryRawUnsafe(fullQuery, ...values) :
                prisma.$queryRawUnsafe(fullQuery),
            values.length > 0 ?
                prisma.$queryRawUnsafe(countQuery, ...values) :
                prisma.$queryRawUnsafe(countQuery)
        ]);
        console.log('Query executed successfully');
        console.log('data length:', Array.isArray(data) ? data.length : 'not array');
        console.log('countResult:', countResult);
        const total = Array.isArray(countResult) && countResult.length > 0 ?
            Number(countResult[0].count) : 0;
        logger.debug({
            modelName,
            resultCount: Array.isArray(data) ? data.length : 0,
            total,
            filtered: Object.keys(filters).length > 0
        }, 'Dynamic findMany with filters completed');
        return {
            data: Array.isArray(data) ? convertBigIntToNumber(data) : [],
            total
        };
    }
    catch (error) {
        console.log('=== ERROR in dynamicFindManyWithFilters ===');
        console.log('error:', error);
        console.log('error.message:', error.message);
        logger.error({
            error: error.message,
            modelName,
            filters,
            options
        }, 'Error in dynamic findMany with filters operation');
        throw error;
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
                result = await prisma.product.findMany({
                    ...options,
                });
            }
            else if (modelName === 'stock') {
                result = await prisma.stock.findMany({
                    ...options,
                });
            }
            else if (modelName === 'picklist') {
                const { include, ...picklistOptions } = options;
                result = await prisma.picklist.findMany(picklistOptions);
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
                    ...(include ? { include } : {}),
                });
            }
            else if (modelName === 'stock') {
                result = await prisma.stock.findUnique({
                    where,
                    ...(include ? { include } : {}),
                });
            }
            else if (modelName === 'picklist') {
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
export async function dynamicCreate(modelName, data) {
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
                    ...(include ? { include } : {}),
                });
            }
            else if (modelName === 'stock') {
                result = await prisma.stock.update({
                    where,
                    data: filteredData,
                    ...(include ? { include } : {}),
                });
            }
            else if (modelName === 'picklist') {
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
            // Convert string ID to integer for Prisma operations
            const whereClause = { ...where };
            if (whereClause.id && typeof whereClause.id === 'string' && /^\d+$/.test(whereClause.id)) {
                whereClause.id = parseInt(whereClause.id, 10);
            }
            if (modelName === 'product') {
                result = await prisma.product.delete({ where: whereClause });
            }
            else if (modelName === 'stock') {
                result = await prisma.stock.delete({ where: whereClause });
            }
            else if (modelName === 'picklist') {
                result = await prisma.picklist.delete({ where: whereClause });
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
            // Convert ID to integer if it's a numeric string (for tables with integer IDs)
            let idValue = where.id;
            if (typeof idValue === 'string' && /^\d+$/.test(idValue)) {
                idValue = parseInt(idValue, 10);
            }
            const deleteQuery = `
        DELETE FROM "${tableName}" 
        WHERE "id" = $1 
        RETURNING id
      `;
            const result = await prisma.$queryRawUnsafe(deleteQuery, idValue);
            const records = Array.isArray(result) ? result : [];
            const success = records.length > 0;
            if (success) {
                logger.info({
                    modelName,
                    deletedId: idValue
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