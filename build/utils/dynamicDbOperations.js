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
    picklist: ['id', 'type', 'table', 'field', 'label', 'value', 'isActive', 'ordering'],
    orders: ['id', 'userid', 'addressid', 'orderamount', 'orderid', 'orderstatus', 'quantity', 'transactionid', 'readytodispatchdate', 'dispatcheddate', 'productamount', 'discountamount', 'deliveryfrom', 'orderprocessingtime', 'ispaymentsucceed', 'merchanttransactionid', 'productid', 'delivereddate', 'cancelleddate', 'returneddate', 'paymentfaileddate', 'createddate', 'modifieddate'],
    orderline: ['id', 'orderid', 'productid', 'userid', 'addressid', 'productamount', 'discountamount', 'orderamount', 'quantity', 'merchanttransactionid', 'productname', 'productcategory', 'productcolour', 'readytodispatchdate', 'delivereddate', 'cancelleddate', 'returneddate', 'orderstatus', 'uniqueordderid', 'orderlinenumber', 'deliveryfrom', 'location', 'dispatcheddate', 'ordereddate', 'paymentfaileddate', 'createddate', 'modifieddate']
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
        'purchaserequest': 'purchaserequest',
        'quotes': 'quotes',
        'orders': 'orders',
        'orderline': 'orderline'
    };
    return tableMapping[modelName] || modelName;
}
/**
 * Converts BigInt values and other database objects to JSON-serializable values
 */
export function convertBigIntToNumber(obj) {
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
        // Handle JSONB objects from PostgreSQL - they often have a special constructor
        // but should be treated as plain JSON
        if (obj.constructor && obj.constructor.name && obj.constructor.name.includes('Json')) {
            // For JSONB objects, try to extract the actual JSON data
            try {
                const jsonString = JSON.stringify(obj);
                const parsed = JSON.parse(jsonString);
                return convertBigIntToNumber(parsed);
            }
            catch (e) {
                // If that fails, treat as plain object
            }
        }
        // For plain objects, recursively convert properties
        if (obj.constructor === Object || obj.constructor === undefined) {
            const converted = {};
            for (const [key, value] of Object.entries(obj)) {
                converted[key] = convertBigIntToNumber(value);
            }
            return converted;
        }
        // IMPORTANT FIX: For other objects that look like plain JSON objects,
        // try to preserve them instead of converting to null
        try {
            // Check if the object can be JSON stringified and parsed
            const jsonString = JSON.stringify(obj);
            const parsed = JSON.parse(jsonString);
            // If successful, recursively convert the parsed object
            if (typeof parsed === 'object' && parsed !== null) {
                return convertBigIntToNumber(parsed);
            }
        }
        catch (e) {
            // JSON stringify/parse failed, continue with other methods
        }
        // JSONB FIX: PostgreSQL JSONB objects sometimes have special handling
        // If it's an object with enumerable properties, preserve them
        if (typeof obj === 'object' && obj !== null) {
            const keys = Object.keys(obj);
            if (keys.length > 0) {
                // This is likely a valid JSON object that should be preserved
                const converted = {};
                for (const key of keys) {
                    converted[key] = convertBigIntToNumber(obj[key]);
                }
                return converted;
            }
        }
        // For other objects, try to extract a meaningful value
        // This is a fallback for unknown object types
        if (obj.constructor && obj.constructor.name) {
            logger.debug({
                objectType: obj.constructor.name,
                objectString: obj.toString(),
                hasValueOf: typeof obj.valueOf === 'function',
                hasToString: typeof obj.toString === 'function',
                keys: Object.keys(obj)
            }, 'Unknown object type encountered in convertBigIntToNumber');
            // If it has enumerable properties, try to preserve them
            const keys = Object.keys(obj);
            if (keys.length > 0) {
                const converted = {};
                for (const key of keys) {
                    converted[key] = convertBigIntToNumber(obj[key]);
                }
                return converted;
            }
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
        // If all else fails, return the original object instead of null
        // This preserves JSON data that might be in an unknown format
        return obj;
    }
    return obj;
}
/**
 * Filters input data to only include columns that exist in the database
 */
async function filterInputDataBySchema(data, modelName, operation = 'create') {
    const tableName = getTableName(modelName);
    // Write debug info to files
    const { writeFileSync } = await import('fs');
    writeFileSync('debug_filter_start.txt', `Filtering data for ${modelName} (${tableName}): ${JSON.stringify(data, null, 2)}\n`, { flag: 'a' });
    const availableColumns = await discoverTableColumns(tableName);
    writeFileSync('debug_filter_columns.txt', `Available columns for ${tableName}: ${JSON.stringify(availableColumns)}\n`, { flag: 'a' });
    if (availableColumns.length === 0) {
        logger.warn({ modelName, tableName }, 'No columns available, returning empty data');
        writeFileSync('debug_filter_no_columns.txt', `No columns found for ${tableName}\n`, { flag: 'a' });
        return {};
    }
    const filteredData = {};
    const ignoredFields = [];
    for (const [key, value] of Object.entries(data)) {
        if (availableColumns.includes(key)) {
            filteredData[key] = value;
            writeFileSync('debug_filter_included.txt', `Included field: ${key} = ${JSON.stringify(value)}\n`, { flag: 'a' });
        }
        else {
            ignoredFields.push(key);
            writeFileSync('debug_filter_ignored.txt', `Ignored field: ${key} (not in available columns)\n`, { flag: 'a' });
        }
    }
    writeFileSync('debug_filter_result.txt', `Filtered data result: ${JSON.stringify(filteredData, null, 2)}\n`, { flag: 'a' });
    writeFileSync('debug_filter_ignored_summary.txt', `Ignored fields: ${JSON.stringify(ignoredFields)}\n`, { flag: 'a' });
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
    // Helper function to determine if a field is numeric
    function isNumericField(fieldName) {
        // First, exclude fields that contain "number" but are actually string identifiers
        const stringNumberFields = [
            /^.*prnumber$/i, // PR numbers like "REVO-PR-00005"
            /^.*quotenumber$/i, // Quote numbers like "TEST4-QUOTE-00017"
            /^.*ponumber$/i, // PO numbers
            /^.*invoicenumber$/i, // Invoice numbers
            /^.*ordernumber$/i, // Order numbers
            /^.*referencenumber$/i, // Reference numbers
            /^.*serialnumber$/i, // Serial numbers
            /^.*partnumber$/i, // Part numbers
            /^.*modelnumber$/i, // Model numbers
            /^.*trackingnumber$/i, // Tracking numbers
            /^.*accountnumber$/i, // Account numbers
            /^.*customernumber$/i, // Customer numbers
            /^.*suppliernumber$/i, // Supplier numbers
        ];
        // If it matches any string number pattern, it's NOT numeric
        if (stringNumberFields.some(pattern => pattern.test(fieldName))) {
            return false;
        }
        const numericFieldPatterns = [
            /^.*id$/i, // ends with 'id'
            /^id$/i, // exactly 'id'
            /^.*userid$/i, // ends with 'userid'
            /^.*amount$/i, // ends with 'amount'
            /^.*price$/i, // ends with 'price'
            /^.*total$/i, // ends with 'total'
            /^.*quantity$/i, // ends with 'quantity'
            /^.*count$/i, // ends with 'count'
            /^.*date$/i, // ends with 'date' (timestamps)
            /^.*time$/i, // ends with 'time' (timestamps)
            /^.*code$/i, // ends with 'code' like pincode
            /^mobilenumber$/i, // specific mobile fields (actual phone numbers)
            /^phonenumber$/i, // specific phone fields (actual phone numbers)
            /^usersphonenumber$/i, // specific user phone fields
            /^usermobilenumber$/i, // specific user mobile fields
            /^createddate$/i, // timestamp fields
            /^modifieddate$/i, // timestamp fields
            /^invoicedate$/i, // timestamp fields
            /^paymentduedate$/i, // timestamp fields
        ];
        return numericFieldPatterns.some(pattern => pattern.test(fieldName));
    }
    // Helper function to determine if a field is boolean
    function isBooleanField(fieldName) {
        const booleanFieldPatterns = [
            /^is[A-Z]/i, // starts with 'is'
            /^has[A-Z]/i, // starts with 'has'
            /^.*flag$/i, // ends with 'flag'
            /^.*enabled$/i, // ends with 'enabled'
            /^.*active$/i, // ends with 'active'
            /^iscreditpayment$/i, // specific boolean fields
            /^isbusinessuser$/i, // specific boolean fields
            /^ispinned$/i, // specific boolean fields
            /^stackable$/i, // promotion stackable field
            /^auto_apply$/i, // promotion auto_apply field
            /^is_active$/i, // promotion rule is_active field
        ];
        return booleanFieldPatterns.some(pattern => pattern.test(fieldName));
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
                else if (isNumericField(matchingColumn)) {
                    // Numeric fields - treat as exact numeric match
                    const numValue = Number(processedValue);
                    if (!isNaN(numValue)) {
                        conditions.push(`"${matchingColumn}" = $${paramIndex}`);
                        values.push(numValue);
                        paramIndex++;
                    }
                    else {
                        // If conversion fails, skip this filter
                        logger.warn({
                            tableName,
                            fieldName: matchingColumn,
                            value: processedValue
                        }, `Failed to convert value to number for numeric field`);
                    }
                }
                else if (isBooleanField(matchingColumn)) {
                    // Boolean fields - convert string to boolean
                    let boolValue;
                    if (typeof processedValue === 'boolean') {
                        boolValue = processedValue;
                    }
                    else if (typeof processedValue === 'string') {
                        boolValue = processedValue.toLowerCase() === 'true' || processedValue === '1';
                    }
                    else {
                        boolValue = Boolean(processedValue);
                    }
                    conditions.push(`"${matchingColumn}" = $${paramIndex}`);
                    values.push(boolValue);
                    paramIndex++;
                }
                else if (typeof processedValue === 'string') {
                    // String fields - support both exact match and ILIKE
                    if (processedValue.includes('%') || processedValue.includes('*')) {
                        // Wildcard search
                        const searchValue = processedValue.replace(/\*/g, '%');
                        conditions.push(`"${matchingColumn}" ILIKE $${paramIndex}`);
                        values.push(searchValue);
                    }
                    else {
                        // Case-insensitive exact match for string fields only
                        conditions.push(`LOWER("${matchingColumn}") = LOWER($${paramIndex})`);
                        values.push(processedValue);
                    }
                    paramIndex++;
                }
                else {
                    // Exact match for other types
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
      ORDER BY COALESCE(modifieddate, createddate, id) DESC 
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
            // Build dynamic ORDER BY based on available columns, prioritizing modified date
            const orderByClause = availableColumns.includes('modifieddate') ? 'COALESCE(modifieddate, createddate, id) DESC' :
                availableColumns.includes('created_at') ? 'created_at DESC' :
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
            // Fallback to raw SQL without filters, prioritizing modifieddate
            const orderByClause = availableColumns.includes('modifieddate') ? 'COALESCE(modifieddate, createddate, id) DESC' :
                availableColumns.includes('created_at') ? 'created_at DESC' :
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
                    ...(include && { include }),
                });
                // Check if the result is missing the isdealoftheday field
                // If so, fall back to raw SQL to get the complete data
                if (result && !result.hasOwnProperty('isdealoftheday')) {
                    logger.debug({ modelName }, 'Prisma result missing isdealoftheday field, falling back to raw SQL');
                    throw new Error('Prisma client outdated, using raw SQL fallback');
                }
            }
            else if (modelName === 'stock') {
                // Convert string ID to integer for stock model
                const stockWhere = { ...where };
                if (stockWhere.id && typeof stockWhere.id === 'string' && /^\d+$/.test(stockWhere.id)) {
                    stockWhere.id = parseInt(stockWhere.id, 10);
                }
                result = await prisma.stock.findUnique({
                    where: stockWhere,
                    ...(include && { include }),
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
                // Get table columns but exclude tsvector columns that can't be deserialized
                const availableColumns = await discoverTableColumns(tableName);
                const selectableColumns = availableColumns.filter(col => col !== 'searchtext');
                const columnsList = selectableColumns.map(col => `"${col}"`).join(', ');
                const sqlResult = await prisma.$queryRawUnsafe(`SELECT ${columnsList} FROM ${tableName} WHERE id = $1 LIMIT 1`, idValue);
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
                // Get table columns but exclude tsvector columns that can't be deserialized
                const availableColumns = await discoverTableColumns(tableName);
                const selectableColumns = availableColumns.filter(col => col !== 'searchtext');
                const columnsList = selectableColumns.map(col => `"${col}"`).join(', ');
                const result = await prisma.$queryRawUnsafe(`SELECT ${columnsList} FROM ${tableName} WHERE id = $1 LIMIT 1`, idValue);
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
                // Handle JSON fields properly for PostgreSQL
                if ((key === 'paymentdata' || key === 'items' || key === 'content') && value !== null && value !== undefined) {
                    // For JSONB fields with explicit casting, stringify the JSON
                    rawData[key] = typeof value === 'string' ? value : JSON.stringify(value);
                }
                else {
                    rawData[key] = value;
                }
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
        // Build placeholders with special handling for JSON fields
        const placeholders = columns.map((col, index) => {
            if (col === 'paymentdata' || col === 'items') {
                return `$${index + 1}::jsonb`;
            }
            return `$${index + 1}`;
        }).join(', ');
        const columnsList = columns.map(col => `"${col}"`).join(', ');
        // Use safe columns for RETURNING to avoid tsvector issues
        const { columnList: safeColumnsList } = await getSafeColumnsForTable(tableName);
        const insertQuery = `
      INSERT INTO "${tableName}" (${columnsList}) 
      VALUES (${placeholders}) 
      RETURNING ${safeColumnsList}
    `;
        logger.debug({
            modelName,
            tableName,
            columns,
            query: insertQuery,
            hasItems: !!rawData.items,
            itemsDataType: rawData.items ? typeof rawData.items : 'undefined',
            hasPaymentData: !!rawData.paymentdata,
            paymentDataType: rawData.paymentdata ? typeof rawData.paymentdata : 'undefined'
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
                // Convert string ID to integer for stock model
                const stockWhere = { ...where };
                if (stockWhere.id && typeof stockWhere.id === 'string' && /^\d+$/.test(stockWhere.id)) {
                    stockWhere.id = parseInt(stockWhere.id, 10);
                }
                result = await prisma.stock.update({
                    where: stockWhere,
                    data: filteredData,
                    include,
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
            // Write debug info to files
            const { writeFileSync } = await import('fs');
            writeFileSync('debug_raw_sql_start.txt', `Starting raw SQL update for ${modelName} (${tableName})\n`, { flag: 'a' });
            writeFileSync('debug_raw_sql_filtered_data.txt', `Filtered data: ${JSON.stringify(filteredData, null, 2)}\n`, { flag: 'a' });
            writeFileSync('debug_raw_sql_available_columns.txt', `Available columns: ${JSON.stringify(availableColumns)}\n`, { flag: 'a' });
            // Filter data to only include existing columns
            const rawData = {};
            for (const [key, value] of Object.entries(filteredData)) {
                if (availableColumns.includes(key)) {
                    // Handle JSON fields properly for PostgreSQL
                    if ((key === 'paymentdata' || key === 'items') && value !== null && value !== undefined) {
                        // For JSONB fields with explicit casting, stringify the JSON
                        rawData[key] = typeof value === 'string' ? value : JSON.stringify(value);
                        if (key === 'paymentdata') {
                            writeFileSync('debug_raw_sql_paymentdata.txt', `Converted paymentdata: ${rawData[key]}\n`, { flag: 'a' });
                        }
                        else if (key === 'items') {
                            writeFileSync('debug_raw_sql_items.txt', `Converted items: ${rawData[key]}\n`, { flag: 'a' });
                        }
                    }
                    else {
                        rawData[key] = value;
                    }
                    writeFileSync('debug_raw_sql_included.txt', `Included in rawData: ${key} = ${JSON.stringify(value)}\n`, { flag: 'a' });
                }
                else {
                    writeFileSync('debug_raw_sql_excluded.txt', `Excluded from rawData: ${key} (not in available columns)\n`, { flag: 'a' });
                }
            }
            writeFileSync('debug_raw_sql_rawdata.txt', `Final rawData: ${JSON.stringify(rawData, null, 2)}\n`, { flag: 'a' });
            if (Object.keys(rawData).length === 0) {
                logger.warn({ modelName, tableName }, 'No valid columns for raw SQL update');
                writeFileSync('debug_raw_sql_no_data.txt', `No valid columns for raw SQL update\n`, { flag: 'a' });
                return null;
            }
            // Add modifieddate timestamp
            const now = Math.floor(Date.now() / 1000);
            if (availableColumns.includes('modifieddate')) {
                rawData.modifieddate = now;
                writeFileSync('debug_raw_sql_modifieddate.txt', `Added modifieddate: ${now}\n`, { flag: 'a' });
            }
            // Convert ID to integer if it's a numeric string (for tables with integer IDs)
            let idValue = where.id;
            if (typeof idValue === 'string' && /^\d+$/.test(idValue)) {
                idValue = parseInt(idValue, 10);
            }
            writeFileSync('debug_raw_sql_id.txt', `ID value: ${idValue} (type: ${typeof idValue})\n`, { flag: 'a' });
            // Build dynamic UPDATE query
            const setClause = Object.keys(rawData)
                .map((key, index) => {
                if (key === 'paymentdata' || key === 'items') {
                    return `"${key}" = $${index + 2}::jsonb`; // Cast to JSONB for JSON fields
                }
                return `"${key}" = $${index + 2}`;
            }) // Start from $2 since $1 is for WHERE
                .join(', ');
            // Use safe columns for RETURNING to avoid tsvector issues
            const { columnList: safeColumnsList } = await getSafeColumnsForTable(tableName);
            const updateQuery = `
        UPDATE "${tableName}" 
        SET ${setClause} 
        WHERE "id" = $1 
        RETURNING ${safeColumnsList}
      `;
            const values = [idValue, ...Object.values(rawData)];
            writeFileSync('debug_raw_sql_query.txt', `Update query: ${updateQuery}\n`, { flag: 'a' });
            writeFileSync('debug_raw_sql_values.txt', `Values: ${JSON.stringify(values, null, 2)}\n`, { flag: 'a' });
            logger.debug({
                modelName,
                tableName,
                updateQuery,
                values: values.length,
                fields: Object.keys(rawData)
            }, 'Executing dynamic update query');
            try {
                const updateResult = await prisma.$queryRawUnsafe(updateQuery, ...values);
                writeFileSync('debug_raw_sql_result.txt', `Update result: ${JSON.stringify(updateResult, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2)}\n`, { flag: 'a' });
                const records = Array.isArray(updateResult) ? updateResult : [];
                const updatedRecord = records.length > 0 ? records[0] : null;
                writeFileSync('debug_raw_sql_updated_record.txt', `Updated record: ${JSON.stringify(updatedRecord, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2)}\n`, { flag: 'a' });
                if (updatedRecord) {
                    logger.info({
                        modelName,
                        updatedId: updatedRecord.id,
                        fieldsUsed: Object.keys(rawData)
                    }, 'Raw SQL update completed successfully');
                    return convertBigIntToNumber(updatedRecord);
                }
                writeFileSync('debug_raw_sql_no_record.txt', `No record returned from update\n`, { flag: 'a' });
                return null;
            }
            catch (sqlError) {
                writeFileSync('debug_raw_sql_error.txt', `SQL Error: ${sqlError.message}\nStack: ${sqlError.stack}\n`, { flag: 'a' });
                logger.error({
                    error: sqlError.message,
                    sqlError: sqlError,
                    modelName,
                    tableName,
                    updateQuery,
                    values: values.length // Don't log the actual values to avoid BigInt issues
                }, 'SQL execution failed in raw SQL update');
                throw sqlError; // Re-throw to trigger fallback
            }
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
            // Write debug info to files
            const { writeFileSync } = await import('fs');
            writeFileSync('debug_raw_sql_fallback_start.txt', `Starting raw SQL fallback update for ${modelName} (${tableName})\n`, { flag: 'a' });
            // Filter data to only include existing columns
            const rawData = {};
            for (const [key, value] of Object.entries(filteredData)) {
                if (availableColumns.includes(key)) {
                    // Handle JSON fields properly for PostgreSQL
                    if (key === 'paymentdata' && value !== null && value !== undefined) {
                        // For JSONB fields with explicit casting, stringify the JSON
                        rawData[key] = typeof value === 'string' ? value : JSON.stringify(value);
                    }
                    else {
                        rawData[key] = value;
                    }
                }
            }
            if (Object.keys(rawData).length === 0) {
                logger.warn({ modelName, tableName }, 'No valid columns for raw SQL fallback update');
                writeFileSync('debug_raw_sql_fallback_no_data.txt', `No valid columns for raw SQL fallback update\n`, { flag: 'a' });
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
            // Use safe columns for RETURNING to avoid tsvector issues
            const { columnList: safeColumnsList } = await getSafeColumnsForTable(tableName);
            const updateQuery = `
        UPDATE "${tableName}" 
        SET ${setClause} 
        WHERE "id" = $1 
        RETURNING ${safeColumnsList}
      `;
            const values = [idValue, ...Object.values(rawData)];
            writeFileSync('debug_raw_sql_fallback_query.txt', `Fallback query: ${updateQuery}\n`, { flag: 'a' });
            writeFileSync('debug_raw_sql_fallback_values.txt', `Fallback values: ${JSON.stringify(values, null, 2)}\n`, { flag: 'a' });
            const fallbackResult = await prisma.$queryRawUnsafe(updateQuery, ...values);
            const records = Array.isArray(fallbackResult) ? fallbackResult : [];
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
            let result = null;
            if (modelName === 'product') {
                result = await prisma.product.delete({ where: { id: idValue } });
            }
            else if (modelName === 'stock') {
                result = await prisma.stock.delete({ where: { id: idValue } });
            }
            else if (modelName === 'picklist') {
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
        }
        catch (prismaError) {
            // For foreign key constraints and other critical errors, re-throw them
            // so the calling code can handle them with meaningful error messages
            if (prismaError.code === 'P2003' ||
                prismaError.code === 'P2002' ||
                prismaError.code === 'P2025' ||
                prismaError.message.includes('foreign key constraint')) {
                logger.error({
                    error: prismaError.message,
                    code: prismaError.code,
                    modelName,
                    where
                }, 'Prisma delete failed with constraint error - re-throwing');
                throw prismaError;
            }
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
            }
            else {
                logger.warn({
                    modelName,
                    id: idValue,
                    method: 'raw_sql'
                }, 'Record not found for deletion');
            }
            return success;
        }
        catch (sqlError) {
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
            // Re-throw SQL errors so they can be handled properly by the route
            throw sqlError;
        }
    }
    catch (error) {
        // Only catch and return false for unexpected errors that aren't constraint violations
        if (error.code === 'P2003' || error.code === 'P2002' || error.code === 'P2025' ||
            error.code === '23503' || error.message.includes('foreign key constraint')) {
            // Re-throw constraint errors so they reach the route handler
            throw error;
        }
        logger.error({
            error: error.message,
            modelName,
            where,
            stack: error.stack
        }, 'Unexpected error in dynamic delete operation');
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
/**
 * Safely serializes database objects for API responses
 * This function ensures that all database objects are properly converted to JSON-serializable values
 */
export function serializeForAPI(data) {
    return convertBigIntToNumber(data);
}
/**
 * Generic function to format numeric fields consistently
 */
function formatNumericField(value) {
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
function formatIntegerField(value) {
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
export function formatSupplierForAPI(supplier) {
    if (!supplier)
        return supplier;
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
export function formatProductForAPI(product) {
    if (!product)
        return product;
    const formatted = serializeForAPI(product);
    // Format all BigInt and numeric fields from the Product schema
    if (formatted.id !== undefined) {
        formatted.id = formatIntegerField(formatted.id) || formatted.id;
    }
    if (formatted.supplierid !== undefined) {
        formatted.supplierid = formatIntegerField(formatted.supplierid);
    }
    if (formatted.soldquantity !== undefined) {
        formatted.soldquantity = formatIntegerField(formatted.soldquantity);
    }
    if (formatted.availablequantity !== undefined) {
        formatted.availablequantity = formatIntegerField(formatted.availablequantity);
    }
    if (formatted.discount !== undefined) {
        formatted.discount = formatIntegerField(formatted.discount);
    }
    if (formatted.price !== undefined) {
        formatted.price = formatNumericField(formatted.price);
    }
    if (formatted.orderedquantity !== undefined) {
        formatted.orderedquantity = formatIntegerField(formatted.orderedquantity);
    }
    if (formatted.createddate !== undefined) {
        formatted.createddate = formatIntegerField(formatted.createddate) || formatted.createddate;
    }
    if (formatted.modifieddate !== undefined) {
        formatted.modifieddate = formatIntegerField(formatted.modifieddate) || formatted.modifieddate;
    }
    // Handle Decimal fields
    if (formatted.averagerating !== undefined) {
        formatted.averagerating = formatNumericField(formatted.averagerating);
    }
    return formatted;
}
/**
 * Formats a single stock object for API response
 */
export function formatStockForAPI(stock) {
    if (!stock)
        return stock;
    const formatted = serializeForAPI(stock);
    // Format all BigInt and numeric fields from the Stock schema
    if (formatted.id !== undefined) {
        formatted.id = formatIntegerField(formatted.id) || formatted.id;
    }
    if (formatted.createddate !== undefined) {
        formatted.createddate = formatIntegerField(formatted.createddate) || formatted.createddate;
    }
    if (formatted.modifieddate !== undefined) {
        formatted.modifieddate = formatIntegerField(formatted.modifieddate) || formatted.modifieddate;
    }
    if (formatted.createdby !== undefined) {
        formatted.createdby = formatIntegerField(formatted.createdby);
    }
    if (formatted.modifiedby !== undefined) {
        formatted.modifiedby = formatIntegerField(formatted.modifiedby);
    }
    if (formatted.manufacturedyear !== undefined) {
        formatted.manufacturedyear = formatIntegerField(formatted.manufacturedyear);
    }
    if (formatted.releaseyear !== undefined) {
        formatted.releaseyear = formatIntegerField(formatted.releaseyear);
    }
    if (formatted.solddate !== undefined) {
        formatted.solddate = formatIntegerField(formatted.solddate);
    }
    if (formatted.rfidscannedtime !== undefined) {
        formatted.rfidscannedtime = formatIntegerField(formatted.rfidscannedtime);
    }
    // Handle legacy quantity fields that might exist
    if (formatted.quantity !== undefined) {
        formatted.quantity = formatIntegerField(formatted.quantity);
    }
    if (formatted.minstock !== undefined) {
        formatted.minstock = formatIntegerField(formatted.minstock);
    }
    if (formatted.maxstock !== undefined) {
        formatted.maxstock = formatIntegerField(formatted.maxstock);
    }
    return formatted;
}
/**
 * Formats a single purchase order object for API response
 */
export function formatPurchaseOrderForAPI(purchaseOrder) {
    if (!purchaseOrder)
        return purchaseOrder;
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
export function formatPurchaseRequestForAPI(purchaseRequest) {
    if (!purchaseRequest)
        return purchaseRequest;
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
export function formatPicklistForAPI(picklist) {
    if (!picklist)
        return picklist;
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
export function formatQuotesForAPI(quote) {
    if (!quote)
        return quote;
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
 * Formats a single user object for API response
 */
export function formatUsersForAPI(user) {
    if (!user)
        return user;
    const formatted = serializeForAPI(user);
    // Format numeric fields
    if (formatted.id !== undefined) {
        formatted.id = formatIntegerField(formatted.id) || formatted.id;
    }
    if (formatted.usermobilenumber !== undefined) {
        formatted.usermobilenumber = formatIntegerField(formatted.usermobilenumber);
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
 * Formats a single inventory user object for API response
 */
export function formatInventoryUsersForAPI(inventoryUser) {
    if (!inventoryUser)
        return inventoryUser;
    const formatted = serializeForAPI(inventoryUser);
    // Format numeric fields
    if (formatted.id !== undefined) {
        formatted.id = formatIntegerField(formatted.id) || formatted.id;
    }
    if (formatted.usersphonenumber !== undefined) {
        formatted.usersphonenumber = formatIntegerField(formatted.usersphonenumber);
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
 * Formats a single poinvoice object for API response
 */
export function formatPoinvoiceForAPI(poinvoice) {
    if (!poinvoice)
        return poinvoice;
    // Debug logging for paymentdata
    logger.debug({
        originalPaymentData: poinvoice.paymentdata,
        paymentDataType: typeof poinvoice.paymentdata,
        paymentDataConstructor: poinvoice.paymentdata?.constructor?.name
    }, 'formatPoinvoiceForAPI: Original paymentdata');
    const formatted = serializeForAPI(poinvoice);
    // Debug logging after serialization
    logger.debug({
        serializedPaymentData: formatted.paymentdata,
        serializedPaymentDataType: typeof formatted.paymentdata,
        serializedPaymentDataConstructor: formatted.paymentdata?.constructor?.name
    }, 'formatPoinvoiceForAPI: After serializeForAPI');
    // Format numeric fields
    if (formatted.id !== undefined) {
        formatted.id = formatIntegerField(formatted.id) || formatted.id;
    }
    if (formatted.invoiceamount !== undefined) {
        formatted.invoiceamount = formatNumericField(formatted.invoiceamount);
    }
    if (formatted.balanceamount !== undefined) {
        formatted.balanceamount = formatNumericField(formatted.balanceamount);
    }
    if (formatted.pototal !== undefined) {
        formatted.pototal = formatNumericField(formatted.pototal);
    }
    if (formatted.transportationcharges !== undefined) {
        formatted.transportationcharges = formatNumericField(formatted.transportationcharges);
    }
    if (formatted.exchangeamount !== undefined) {
        formatted.exchangeamount = formatNumericField(formatted.exchangeamount);
    }
    if (formatted.customdutytaxamount !== undefined) {
        formatted.customdutytaxamount = formatNumericField(formatted.customdutytaxamount);
    }
    if (formatted.invoicedate !== undefined) {
        formatted.invoicedate = formatIntegerField(formatted.invoicedate) || formatted.invoicedate;
    }
    if (formatted.paymentduedate !== undefined) {
        formatted.paymentduedate = formatIntegerField(formatted.paymentduedate) || formatted.paymentduedate;
    }
    if (formatted.createddate !== undefined) {
        formatted.createddate = formatIntegerField(formatted.createddate) || formatted.createddate;
    }
    if (formatted.modifieddate !== undefined) {
        formatted.modifieddate = formatIntegerField(formatted.modifieddate) || formatted.modifieddate;
    }
    // ENHANCED PAYMENTDATA HANDLING - Handle JSONB properly
    if (formatted.paymentdata !== undefined) {
        logger.debug({
            beforeProcessing: formatted.paymentdata,
            beforeProcessingType: typeof formatted.paymentdata,
            isArray: Array.isArray(formatted.paymentdata),
            stringRepresentation: String(formatted.paymentdata)
        }, 'formatPoinvoiceForAPI: Before paymentdata processing');
        // Handle null/undefined cases
        if (formatted.paymentdata === null || formatted.paymentdata === undefined) {
            formatted.paymentdata = null;
            logger.debug('formatPoinvoiceForAPI: Set paymentdata to null (was null/undefined)');
        }
        // Handle string that needs parsing
        else if (typeof formatted.paymentdata === 'string') {
            try {
                if (formatted.paymentdata.trim() === '') {
                    formatted.paymentdata = null;
                    logger.debug('formatPoinvoiceForAPI: Set paymentdata to null (empty string)');
                }
                else {
                    formatted.paymentdata = JSON.parse(formatted.paymentdata);
                    logger.debug({
                        afterParsing: formatted.paymentdata
                    }, 'formatPoinvoiceForAPI: After JSON.parse from string');
                }
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                formatted.paymentdata = null;
                logger.debug({
                    parseError: errorMessage,
                    originalString: formatted.paymentdata
                }, 'formatPoinvoiceForAPI: JSON parse failed, set to null');
            }
        }
        // Handle arrays (common for JSONB)
        else if (Array.isArray(formatted.paymentdata)) {
            // Already an array, keep as is
            logger.debug({
                arrayLength: formatted.paymentdata.length,
                arrayContents: formatted.paymentdata
            }, 'formatPoinvoiceForAPI: paymentdata is array, keeping as-is');
        }
        // Handle objects that might be JSONB representations
        else if (typeof formatted.paymentdata === 'object') {
            // Check if it's an empty object {}
            if (Object.keys(formatted.paymentdata).length === 0) {
                // Try to get original paymentdata from the unformatted object
                const originalPaymentData = poinvoice.paymentdata;
                logger.debug({
                    emptyObject: true,
                    originalValue: originalPaymentData,
                    originalType: typeof originalPaymentData
                }, 'formatPoinvoiceForAPI: paymentdata is empty object, checking original');
                if (originalPaymentData !== null && originalPaymentData !== undefined) {
                    // Try to handle the original value directly
                    if (typeof originalPaymentData === 'string') {
                        try {
                            formatted.paymentdata = JSON.parse(originalPaymentData);
                            logger.debug('formatPoinvoiceForAPI: Parsed original string paymentdata');
                        }
                        catch {
                            formatted.paymentdata = null;
                            logger.debug('formatPoinvoiceForAPI: Failed to parse original string, set to null');
                        }
                    }
                    else if (Array.isArray(originalPaymentData)) {
                        formatted.paymentdata = originalPaymentData;
                        logger.debug('formatPoinvoiceForAPI: Using original array paymentdata');
                    }
                    else if (typeof originalPaymentData === 'object') {
                        // For JSONB objects, try to convert to plain object
                        try {
                            const jsonString = JSON.stringify(originalPaymentData);
                            formatted.paymentdata = JSON.parse(jsonString);
                            logger.debug('formatPoinvoiceForAPI: Converted JSONB object via stringify/parse');
                        }
                        catch {
                            formatted.paymentdata = originalPaymentData;
                            logger.debug('formatPoinvoiceForAPI: Using original object as-is');
                        }
                    }
                    else {
                        formatted.paymentdata = originalPaymentData;
                        logger.debug('formatPoinvoiceForAPI: Using original value as-is');
                    }
                }
                else {
                    formatted.paymentdata = null;
                    logger.debug('formatPoinvoiceForAPI: Original was null/undefined, set to null');
                }
            }
            else {
                // Non-empty object, keep as is
                logger.debug({
                    objectKeys: Object.keys(formatted.paymentdata),
                    objectValues: formatted.paymentdata
                }, 'formatPoinvoiceForAPI: paymentdata is non-empty object, keeping as-is');
            }
        }
        // Handle other types
        else {
            logger.debug({
                unexpectedType: typeof formatted.paymentdata,
                value: formatted.paymentdata
            }, 'formatPoinvoiceForAPI: Unexpected paymentdata type, keeping as-is');
        }
        logger.debug({
            finalPaymentData: formatted.paymentdata,
            finalPaymentDataType: typeof formatted.paymentdata,
            isArray: Array.isArray(formatted.paymentdata)
        }, 'formatPoinvoiceForAPI: Final paymentdata');
    }
    return formatted;
}
/**
 * Formats a single address object for API response
 */
export function formatAddressForAPI(address) {
    if (!address)
        return address;
    const formatted = serializeForAPI(address);
    // Format numeric fields
    if (formatted.id !== undefined) {
        formatted.id = formatIntegerField(formatted.id) || formatted.id;
    }
    if (formatted.userid !== undefined) {
        formatted.userid = formatIntegerField(formatted.userid);
    }
    if (formatted.mobilenumber !== undefined) {
        formatted.mobilenumber = formatIntegerField(formatted.mobilenumber);
    }
    if (formatted.pincode !== undefined) {
        formatted.pincode = formatIntegerField(formatted.pincode);
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
 * Formats a single sample purchase order object for API response
 */
export function formatSamplePurchaseOrderForAPI(samplePurchaseOrder) {
    if (!samplePurchaseOrder)
        return samplePurchaseOrder;
    const formatted = serializeForAPI(samplePurchaseOrder);
    // Format numeric fields
    if (formatted.id !== undefined) {
        formatted.id = formatIntegerField(formatted.id) || formatted.id;
    }
    if (formatted.supplierid !== undefined) {
        formatted.supplierid = formatIntegerField(formatted.supplierid);
    }
    // Handle phone number field
    if (formatted.phonenumber !== undefined) {
        formatted.phonenumber = formatIntegerField(formatted.phonenumber);
    }
    // Handle timestamps
    if (formatted.createddate !== undefined) {
        formatted.createddate = formatIntegerField(formatted.createddate) || formatted.createddate;
    }
    if (formatted.modifieddate !== undefined) {
        formatted.modifieddate = formatIntegerField(formatted.modifieddate) || formatted.modifieddate;
    }
    // Ensure items is properly handled as JSON
    if (formatted.items !== undefined) {
        if (typeof formatted.items === 'string') {
            try {
                formatted.items = JSON.parse(formatted.items);
            }
            catch (error) {
                logger.warn({
                    error,
                    originalItems: formatted.items
                }, 'Error parsing items JSON in formatSamplePurchaseOrderForAPI');
            }
        }
    }
    return formatted;
}
/**
 * Formats a single sample purchase request object for API response
 */
export function formatSamplePurchaseRequestForAPI(samplePurchaseRequest) {
    if (!samplePurchaseRequest)
        return samplePurchaseRequest;
    const formatted = serializeForAPI(samplePurchaseRequest);
    // Format numeric fields
    if (formatted.id !== undefined) {
        formatted.id = formatIntegerField(formatted.id) || formatted.id;
    }
    if (formatted.supplierid !== undefined) {
        formatted.supplierid = formatIntegerField(formatted.supplierid);
    }
    // Handle phone number field
    if (formatted.phonenumber !== undefined) {
        formatted.phonenumber = formatIntegerField(formatted.phonenumber);
    }
    // Handle timestamps
    if (formatted.createddate !== undefined) {
        formatted.createddate = formatIntegerField(formatted.createddate) || formatted.createddate;
    }
    if (formatted.modifieddate !== undefined) {
        formatted.modifieddate = formatIntegerField(formatted.modifieddate) || formatted.modifieddate;
    }
    // Ensure items is properly handled as JSON
    if (formatted.items !== undefined) {
        if (typeof formatted.items === 'string') {
            try {
                formatted.items = JSON.parse(formatted.items);
            }
            catch (error) {
                logger.warn({
                    error,
                    originalItems: formatted.items
                }, 'Error parsing items JSON in formatSamplePurchaseRequestForAPI');
            }
        }
    }
    return formatted;
}
/**
 * Formats a single orders object for API response
 */
export function formatOrdersForAPI(order) {
    if (!order)
        return order;
    const formatted = serializeForAPI(order);
    // Format numeric fields
    if (formatted.id !== undefined) {
        formatted.id = formatIntegerField(formatted.id) || formatted.id;
    }
    if (formatted.userid !== undefined) {
        formatted.userid = formatIntegerField(formatted.userid);
    }
    if (formatted.addressid !== undefined) {
        formatted.addressid = formatIntegerField(formatted.addressid);
    }
    if (formatted.quantity !== undefined) {
        formatted.quantity = formatIntegerField(formatted.quantity);
    }
    if (formatted.orderamount !== undefined) {
        formatted.orderamount = formatNumericField(formatted.orderamount);
    }
    if (formatted.productamount !== undefined) {
        formatted.productamount = formatNumericField(formatted.productamount);
    }
    if (formatted.discountamount !== undefined) {
        formatted.discountamount = formatNumericField(formatted.discountamount);
    }
    if (formatted.orderprocessingtime !== undefined) {
        formatted.orderprocessingtime = formatIntegerField(formatted.orderprocessingtime);
    }
    // Handle timestamp fields
    if (formatted.createddate !== undefined) {
        formatted.createddate = formatIntegerField(formatted.createddate) || formatted.createddate;
    }
    if (formatted.modifieddate !== undefined) {
        formatted.modifieddate = formatIntegerField(formatted.modifieddate) || formatted.modifieddate;
    }
    if (formatted.delivereddate !== undefined) {
        formatted.delivereddate = formatIntegerField(formatted.delivereddate);
    }
    if (formatted.cancelleddate !== undefined) {
        formatted.cancelleddate = formatIntegerField(formatted.cancelleddate);
    }
    if (formatted.returneddate !== undefined) {
        formatted.returneddate = formatIntegerField(formatted.returneddate);
    }
    if (formatted.readytodispatchdate !== undefined) {
        formatted.readytodispatchdate = formatIntegerField(formatted.readytodispatchdate);
    }
    if (formatted.dispatcheddate !== undefined) {
        formatted.dispatcheddate = formatIntegerField(formatted.dispatcheddate);
    }
    if (formatted.paymentfaileddate !== undefined) {
        formatted.paymentfaileddate = formatIntegerField(formatted.paymentfaileddate);
    }
    // Handle productid array
    if (formatted.productid && Array.isArray(formatted.productid)) {
        formatted.productid = formatted.productid.map((id) => formatIntegerField(id) || id);
    }
    return formatted;
}
/**
 * Formats a single orderline object for API response
 */
export function formatOrderlineForAPI(orderline) {
    if (!orderline)
        return orderline;
    const formatted = serializeForAPI(orderline);
    // Format numeric fields
    if (formatted.id !== undefined) {
        formatted.id = formatIntegerField(formatted.id) || formatted.id;
    }
    if (formatted.orderid !== undefined) {
        formatted.orderid = formatIntegerField(formatted.orderid);
    }
    if (formatted.productid !== undefined) {
        formatted.productid = formatIntegerField(formatted.productid);
    }
    if (formatted.userid !== undefined) {
        formatted.userid = formatIntegerField(formatted.userid);
    }
    if (formatted.addressid !== undefined) {
        formatted.addressid = formatIntegerField(formatted.addressid);
    }
    if (formatted.quantity !== undefined) {
        formatted.quantity = formatIntegerField(formatted.quantity);
    }
    if (formatted.productamount !== undefined) {
        formatted.productamount = formatNumericField(formatted.productamount);
    }
    if (formatted.discountamount !== undefined) {
        formatted.discountamount = formatNumericField(formatted.discountamount);
    }
    if (formatted.orderamount !== undefined) {
        formatted.orderamount = formatNumericField(formatted.orderamount);
    }
    // Handle timestamp fields
    if (formatted.createddate !== undefined) {
        formatted.createddate = formatIntegerField(formatted.createddate) || formatted.createddate;
    }
    if (formatted.modifieddate !== undefined) {
        formatted.modifieddate = formatIntegerField(formatted.modifieddate) || formatted.modifieddate;
    }
    if (formatted.readytodispatchdate !== undefined) {
        formatted.readytodispatchdate = formatIntegerField(formatted.readytodispatchdate);
    }
    if (formatted.delivereddate !== undefined) {
        formatted.delivereddate = formatIntegerField(formatted.delivereddate);
    }
    if (formatted.cancelleddate !== undefined) {
        formatted.cancelleddate = formatIntegerField(formatted.cancelleddate);
    }
    if (formatted.returneddate !== undefined) {
        formatted.returneddate = formatIntegerField(formatted.returneddate);
    }
    if (formatted.dispatcheddate !== undefined) {
        formatted.dispatcheddate = formatIntegerField(formatted.dispatcheddate);
    }
    if (formatted.ordereddate !== undefined) {
        formatted.ordereddate = formatIntegerField(formatted.ordereddate);
    }
    if (formatted.paymentfaileddate !== undefined) {
        formatted.paymentfaileddate = formatIntegerField(formatted.paymentfaileddate);
    }
    return formatted;
}
/**
 * Universal formatter that detects entity type and applies appropriate formatting
 */
export function formatEntityForAPI(entity, entityType) {
    if (!entity)
        return entity;
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
            case 'users':
                return formatUsersForAPI(entity);
            case 'inventoryusers':
                return formatInventoryUsersForAPI(entity);
            case 'poinvoice':
                return formatPoinvoiceForAPI(entity);
            case 'address':
                return formatAddressForAPI(entity);
            case 'samplepurchaseorder':
                return formatSamplePurchaseOrderForAPI(entity);
            case 'samplepurchaserequest':
                return formatSamplePurchaseRequestForAPI(entity);
            case 'orders':
                return formatOrdersForAPI(entity);
            case 'orderline':
                return formatOrderlineForAPI(entity);
            case 'promotional_assets':
                return formatPromotionalAssetForAPI(entity);
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
    if (entity.useremail && entity.usermobilenumber !== undefined) {
        return formatUsersForAPI(entity);
    }
    if (entity.useremail && entity.role !== undefined && entity.usersphonenumber !== undefined) {
        return formatInventoryUsersForAPI(entity);
    }
    if (entity.invoiceamount !== undefined || entity.invoicenumber !== undefined) {
        return formatPoinvoiceForAPI(entity);
    }
    if (entity.address !== undefined || entity.doornumber !== undefined) {
        return formatAddressForAPI(entity);
    }
    if (entity.orderid !== undefined && entity.orderstatus !== undefined && entity.orderamount !== undefined) {
        return formatOrdersForAPI(entity);
    }
    if (entity.orderlinenumber !== undefined || (entity.orderid !== undefined && entity.productid !== undefined)) {
        return formatOrderlineForAPI(entity);
    }
    if (entity.type && entity.placement && entity.title && entity.content !== undefined) {
        return formatPromotionalAssetForAPI(entity);
    }
    // Fallback to generic serialization
    return serializeForAPI(entity);
}
/**
 * Formats an array of entities for API response
 */
export function formatEntitiesForAPI(entities, entityType) {
    if (!Array.isArray(entities))
        return entities;
    return entities.map(entity => formatEntityForAPI(entity, entityType));
}
export function formatPromotionalAssetForAPI(asset) {
    if (!asset)
        return asset;
    const formatted = serializeForAPI(asset);
    // Format all numeric fields
    if (formatted.id !== undefined) {
        formatted.id = formatIntegerField(formatted.id) || formatted.id;
    }
    if (formatted.priority !== undefined) {
        formatted.priority = formatIntegerField(formatted.priority) || formatted.priority;
    }
    if (formatted.version !== undefined) {
        formatted.version = formatIntegerField(formatted.version) || formatted.version;
    }
    if (formatted.createddate !== undefined) {
        formatted.createddate = formatIntegerField(formatted.createddate) || formatted.createddate;
    }
    if (formatted.modifieddate !== undefined) {
        formatted.modifieddate = formatIntegerField(formatted.modifieddate) || formatted.modifieddate;
    }
    // Ensure boolean fields are properly formatted
    if (formatted.is_active !== undefined) {
        formatted.is_active = Boolean(formatted.is_active);
    }
    // Handle date fields
    if (formatted.schedule_start) {
        formatted.schedule_start = formatted.schedule_start instanceof Date ?
            formatted.schedule_start.toISOString() : formatted.schedule_start;
    }
    if (formatted.schedule_end) {
        formatted.schedule_end = formatted.schedule_end instanceof Date ?
            formatted.schedule_end.toISOString() : formatted.schedule_end;
    }
    // Content field should already be properly handled by serializeForAPI
    // which calls convertBigIntToNumber
    return formatted;
}
const MODEL_RELATIONSHIPS = {
    product: [
        {
            table: 'orderline',
            foreignKey: 'productid',
            includeFields: ['id', 'orderid', 'orderstatus', 'productname', 'quantity', 'orderamount'],
            displayTemplate: (record) => `orderline ID ${record.id} (order ${record.orderid}, status: ${record.orderstatus})`
        },
        {
            table: 'stock',
            foreignKey: 'puc',
            matchField: 'puc', // Match product.puc with stock.puc
            includeFields: ['id', 'serialnumber', 'stockstatus', 'productname', 'location', 'assetlocation'],
            displayTemplate: (record) => `stock ID ${record.id} (${record.stockstatus}${record.location || record.assetlocation ? `, location: ${record.location || record.assetlocation}` : ''})`
        }
    ],
    supplier: [
        {
            table: 'product',
            foreignKey: 'supplierid',
            includeFields: ['id', 'name', 'category', 'productstatus', 'price'],
            displayTemplate: (record) => `product ID ${record.id} (${record.name}, status: ${record.productstatus})`
        },
        {
            table: 'purchaseorder',
            foreignKey: 'supplierid',
            includeFields: ['ponumber', 'po_status', 'total', 'createddate'],
            displayTemplate: (record) => `purchase order ${record.ponumber} (status: ${record.po_status})`
        },
        {
            table: 'purchaserequest',
            foreignKey: 'supplierid',
            includeFields: ['prnumber', 'prstatus', 'companyname'],
            displayTemplate: (record) => `purchase request ${record.prnumber} (status: ${record.prstatus})`
        }
    ],
    stock: [
        {
            table: 'orderline',
            foreignKey: 'orderlinenumber',
            matchField: 'orderlinenumber',
            includeFields: ['id', 'orderid', 'orderstatus', 'productname', 'quantity'],
            displayTemplate: (record) => `orderline ID ${record.id} (order ${record.orderid}, status: ${record.orderstatus})`
        }
    ],
    orders: [
        {
            table: 'orderline',
            foreignKey: 'orderid',
            includeFields: ['id', 'productid', 'productname', 'orderstatus', 'quantity', 'orderamount'],
            displayTemplate: (record) => `orderline ID ${record.id} (product: ${record.productname}, status: ${record.orderstatus})`
        },
        {
            table: 'stock',
            foreignKey: 'orderid',
            includeFields: ['id', 'serialnumber', 'stockstatus', 'productname'],
            displayTemplate: (record) => `stock ID ${record.id} (${record.productname}, status: ${record.stockstatus})`
        }
    ]
};
/**
 * Identifies specific records that are blocking deletion due to foreign key constraints
 * Now supports all models dynamically based on MODEL_RELATIONSHIPS configuration
 */
async function identifyBlockingRecords(modelName, id) {
    const blockingRecords = [];
    try {
        const relationships = MODEL_RELATIONSHIPS[modelName];
        if (!relationships) {
            return {
                blockingRecords: [],
                summary: `No relationship configuration found for model: ${modelName}`
            };
        }
        // Get the main record to access its data for relationship matching
        let mainRecord = null;
        try {
            if (modelName === 'product') {
                mainRecord = await prisma.product.findUnique({ where: { id: BigInt(id) } });
            }
            else if (modelName === 'supplier') {
                mainRecord = await prisma.supplier.findUnique({ where: { id: parseInt(id) } });
            }
            else if (modelName === 'stock') {
                mainRecord = await prisma.stock.findUnique({ where: { id: parseInt(id) } });
            }
            else if (modelName === 'orders') {
                mainRecord = await prisma.orders.findUnique({ where: { id: parseInt(id) } });
            }
            // Add more models as needed
            if (!mainRecord) {
                return { blockingRecords: [], summary: `${modelName} not found` };
            }
        }
        catch (error) {
            logger.error({ error, modelName, id }, 'Error fetching main record for relationship check');
            return { blockingRecords: [], summary: `Error fetching ${modelName} record` };
        }
        // Check each relationship
        for (const relationship of relationships) {
            try {
                let whereClause = {};
                // Determine the match criteria
                if (relationship.matchField) {
                    // Use a specific field from the main record (like PUC matching)
                    const matchValue = mainRecord[relationship.matchField];
                    if (matchValue) {
                        whereClause[relationship.foreignKey] = matchValue;
                    }
                    else {
                        continue; // Skip if the match field is empty
                    }
                }
                else {
                    // Use the record ID directly
                    whereClause[relationship.foreignKey] = modelName === 'product' ? parseInt(id) : parseInt(id);
                }
                // Execute query based on table
                let relatedRecords = [];
                if (relationship.table === 'orderline') {
                    relatedRecords = await prisma.orderline.findMany({ where: whereClause });
                }
                else if (relationship.table === 'stock') {
                    relatedRecords = await prisma.stock.findMany({ where: whereClause });
                }
                else if (relationship.table === 'product') {
                    relatedRecords = await prisma.product.findMany({ where: whereClause });
                }
                else if (relationship.table === 'purchaseorder') {
                    relatedRecords = await prisma.purchaseOrder.findMany({ where: whereClause });
                }
                else if (relationship.table === 'purchaserequest') {
                    relatedRecords = await prisma.purchaseRequest.findMany({ where: whereClause });
                }
                // Add more table queries as needed
                // Process found records
                for (const record of relatedRecords) {
                    const details = {};
                    // Extract specified fields
                    for (const field of relationship.includeFields) {
                        if (record[field] !== undefined) {
                            details[field] = record[field]?.toString() || record[field];
                        }
                    }
                    blockingRecords.push({
                        table: relationship.table,
                        recordId: record.id,
                        details
                    });
                }
            }
            catch (relationshipError) {
                logger.error({
                    error: relationshipError.message,
                    modelName,
                    id,
                    relationship: relationship.table
                }, 'Error checking relationship');
            }
        }
        // Generate dynamic summary
        let summary = '';
        if (blockingRecords.length === 0) {
            summary = 'No blocking records found';
        }
        else {
            const tableGroups = blockingRecords.reduce((acc, record) => {
                if (!acc[record.table])
                    acc[record.table] = [];
                acc[record.table].push(record);
                return acc;
            }, {});
            const summaryParts = Object.entries(tableGroups).map(([table, records]) => {
                const relationship = relationships.find(r => r.table === table);
                if (relationship?.displayTemplate) {
                    const recordDetails = records.map(r => relationship.displayTemplate(r.details)).join(', ');
                    return `${records.length} ${table} record(s): ${recordDetails}`;
                }
                else {
                    // Fallback for tables without custom display templates
                    const recordIds = records.map(r => `ID ${r.recordId}`).join(', ');
                    return `${records.length} ${table} record(s): ${recordIds}`;
                }
            });
            summary = summaryParts.join('; ');
        }
        return { blockingRecords, summary };
    }
    catch (error) {
        logger.error({ error: error.message, modelName, id }, 'Error identifying blocking records');
        return {
            blockingRecords: [],
            summary: `Error checking blocking records: ${error.message}`
        };
    }
}
/**
 * Enhanced error details for foreign key constraints
 */
export async function getConstraintViolationDetails(modelName, id, error) {
    try {
        const blockingInfo = await identifyBlockingRecords(modelName, id);
        // Extract constraint information from the error
        const constraintInfo = {};
        if (error.meta?.constraint) {
            constraintInfo.constraintName = error.meta.constraint;
            // Try to extract referenced table from constraint name
            if (error.meta.constraint.includes('_fkey')) {
                const parts = error.meta.constraint.split('_');
                if (parts.length > 1) {
                    constraintInfo.referencedTable = parts[0];
                }
            }
        }
        // Create specific message based on blocking records
        let specificMessage = '';
        if (blockingInfo.blockingRecords.length > 0) {
            if (modelName === 'product') {
                specificMessage = `Product ID ${id} cannot be deleted because it is referenced by: ${blockingInfo.summary}`;
            }
            else {
                specificMessage = `${modelName} ID ${id} cannot be deleted because it is referenced by: ${blockingInfo.summary}`;
            }
        }
        else {
            specificMessage = `${modelName} ID ${id} cannot be deleted due to foreign key constraint: ${error.meta?.constraint || 'unknown constraint'}`;
        }
        return {
            specificMessage,
            blockingRecords: blockingInfo.blockingRecords,
            constraintInfo
        };
    }
    catch (detailError) {
        logger.error({ detailError: detailError.message, modelName, id }, 'Error getting constraint violation details');
        return {
            specificMessage: `${modelName} ID ${id} cannot be deleted due to foreign key constraint`,
            blockingRecords: [],
            constraintInfo: {}
        };
    }
}
/**
 * Reusable helper for DELETE routes to handle errors with detailed constraint information
 * This can be used in any DELETE route across the application
 */
export async function handleDeleteError(error, modelName, id, reply) {
    console.log(`=== ${modelName.toUpperCase()} DELETE ERROR:`, error.message);
    console.log(`=== ${modelName.toUpperCase()} DELETE ERROR STACK:`, error.stack);
    if (error.message.includes("not found")) {
        const errorResponse = {
            success: false,
            message: `${modelName.charAt(0).toUpperCase() + modelName.slice(1)} with ID ${id} not found`,
            details: "The requested resource could not be found",
            statusCode: 404,
        };
        return reply.code(404).send(errorResponse);
    }
    // Check for database/foreign key constraint errors
    if (error.code === 'P2003' || error.message.includes('foreign key constraint')) {
        // Get detailed information about what's blocking the deletion
        const constraintDetails = await getConstraintViolationDetails(modelName, id, error);
        const errorResponse = {
            success: false,
            message: `Cannot delete ${modelName} with ID ${id}`,
            details: constraintDetails.specificMessage,
            statusCode: 409,
            errorCode: error.code || 'FOREIGN_KEY_CONSTRAINT',
            blockingRecords: constraintDetails.blockingRecords,
            constraintInfo: constraintDetails.constraintInfo
        };
        return reply.code(409).send(errorResponse);
    }
    // Check for database connection errors
    if (error.code === 'ECONNREFUSED' || error.message.includes('connect ECONNREFUSED')) {
        const errorResponse = {
            success: false,
            message: "Database connection error",
            details: "Unable to connect to the database. Please try again later.",
            statusCode: 503,
            errorCode: error.code || 'DATABASE_CONNECTION_ERROR'
        };
        return reply.code(503).send(errorResponse);
    }
    // Check for Prisma-specific errors
    if (error.code && error.code.startsWith('P')) {
        const errorResponse = {
            success: false,
            message: `Database operation failed for ${modelName} ${id}`,
            details: `Prisma error: ${error.message}`,
            statusCode: 500,
            errorCode: error.code,
            meta: error.meta || null
        };
        return reply.code(500).send(errorResponse);
    }
    // Check for validation errors
    if (error.name === 'ValidationError' || error.message.includes('validation')) {
        const errorResponse = {
            success: false,
            message: `Validation error during ${modelName} deletion`,
            details: error.message,
            statusCode: 400,
            errorCode: 'VALIDATION_ERROR'
        };
        return reply.code(400).send(errorResponse);
    }
    // Enhanced default error response with more details
    const errorResponse = {
        success: false,
        message: `Failed to delete ${modelName} with ID ${id}`,
        details: error.message || `An unexpected error occurred during ${modelName} deletion`,
        statusCode: 500,
        errorCode: error.code || error.name || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString()
    };
    return reply.code(500).send(errorResponse);
}
//# sourceMappingURL=dynamicDbOperations.js.map