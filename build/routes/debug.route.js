import { getSchemaCacheStatus, clearSchemaCache } from '../utils/dynamicDbOperations.js';
import { createSuccessResponse } from '../utils/errorHandler.js';
import { prisma } from '../models/prisma.js';
export async function debugRoutes(fastify) {
    // Get schema information
    fastify.get('/schema', {
        schema: {
            description: 'Get discovered database schema information',
            tags: ['Debug'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: {
                            type: 'object',
                            properties: {
                                tables: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            tableName: { type: 'string' },
                                            columns: { type: 'array', items: { type: 'string' } },
                                            age: { type: 'number' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }, async (request, reply) => {
        try {
            const schemaInfo = getSchemaCacheStatus();
            const response = createSuccessResponse('Schema information retrieved', {
                tables: schemaInfo,
                cacheStatus: schemaInfo.length > 0 ? 'populated' : 'empty'
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to get schema information',
                error: 'SCHEMA_ERROR'
            });
        }
    });
    // Clear schema cache
    fastify.post('/schema/clear', {
        schema: {
            description: 'Clear the schema cache to force re-discovery',
            tags: ['Debug'],
        }
    }, async (request, reply) => {
        try {
            clearSchemaCache();
            const response = createSuccessResponse('Schema cache cleared successfully', null);
            return reply.code(200).send(response);
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to clear schema cache',
                error: 'CACHE_ERROR'
            });
        }
    });
    // Test database connection and discover tables
    fastify.get('/tables', {
        schema: {
            description: 'Discover all tables in the database',
            tags: ['Debug'],
        }
    }, async (request, reply) => {
        try {
            // Query to get all tables in the public schema
            const tables = await prisma.$queryRaw `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `;
            const tableNames = tables.map((row) => row.table_name);
            const response = createSuccessResponse('Database tables discovered', {
                tables: tableNames,
                count: tableNames.length
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to discover database tables',
                error: 'DATABASE_ERROR'
            });
        }
    });
    // Get columns for a specific table
    fastify.get('/tables/:tableName/columns', {
        schema: {
            description: 'Get columns for a specific table',
            tags: ['Debug'],
            params: {
                type: 'object',
                properties: {
                    tableName: { type: 'string' }
                },
                required: ['tableName']
            }
        }
    }, async (request, reply) => {
        try {
            const { tableName } = request.params;
            const columns = await prisma.$queryRaw `
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = ${tableName}
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `;
            const columnInfo = columns.map((col) => ({
                name: col.column_name,
                type: col.data_type,
                nullable: col.is_nullable === 'YES',
                default: col.column_default
            }));
            const response = createSuccessResponse(`Columns for table ${tableName}`, {
                tableName,
                columns: columnInfo,
                count: columnInfo.length
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to get table columns',
                error: 'COLUMN_ERROR'
            });
        }
    });
    // Test raw SQL query
    fastify.get('/test-stock', {
        schema: {
            description: 'Test raw SQL query on stock table',
            tags: ['Debug'],
        }
    }, async (request, reply) => {
        try {
            // Test if table exists
            const tableExists = await prisma.$queryRawUnsafe(`SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'stock'
        )`);
            // Test simple count
            const countResult = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM stock');
            // Test simple select with specific columns
            const selectResult = await prisma.$queryRawUnsafe('SELECT id, puc, productname FROM stock ORDER BY id DESC LIMIT 2');
            const response = createSuccessResponse('Stock table test completed', {
                tableExists: tableExists[0]?.exists || false,
                count: Number(countResult[0]?.count || 0),
                records: Array.isArray(selectResult) ? selectResult.length : 0,
                sampleData: Array.isArray(selectResult) && selectResult.length > 0 ? selectResult[0] : null
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to test stock table',
                error: error.message || 'TEST_ERROR'
            });
        }
    });
    // Test exact dynamic query
    fastify.get('/test-dynamic-query', {
        schema: {
            description: 'Test the exact query that dynamic operations generates',
            tags: ['Debug'],
        }
    }, async (request, reply) => {
        try {
            // Test the exact query format used by dynamic operations
            const query = 'SELECT * FROM stock ORDER BY createddate DESC LIMIT 2 OFFSET 0';
            const result = await prisma.$queryRawUnsafe(query);
            const response = createSuccessResponse('Dynamic query test completed', {
                query,
                resultCount: Array.isArray(result) ? result.length : 0,
                resultType: typeof result,
                sampleData: Array.isArray(result) && result.length > 0 ? result[0] : null
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to test dynamic query',
                error: error.message || 'DYNAMIC_TEST_ERROR'
            });
        }
    });
    // Test product table
    fastify.get('/test-product', {
        schema: {
            description: 'Test raw SQL query on product table',
            tags: ['Debug'],
        }
    }, async (request, reply) => {
        try {
            // Test simple count
            const countResult = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM product');
            // Test simple select with specific columns (avoiding tsvector)
            const selectResult = await prisma.$queryRawUnsafe('SELECT id, productname, category FROM product ORDER BY id DESC LIMIT 2');
            const response = createSuccessResponse('Product table test completed', {
                count: Number(countResult[0]?.count || 0),
                records: Array.isArray(selectResult) ? selectResult.length : 0,
                sampleData: Array.isArray(selectResult) && selectResult.length > 0 ? selectResult[0] : null
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to test product table',
                error: error.message || 'PRODUCT_TEST_ERROR'
            });
        }
    });
    // Performance monitoring endpoint
    fastify.get('/performance', {
        schema: {
            description: 'Monitor API performance and get optimization suggestions',
            tags: ['Debug'],
        }
    }, async (request, reply) => {
        try {
            const startTime = Date.now();
            // Test basic queries
            const stockCountStart = Date.now();
            const stockCount = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM stock');
            const stockCountTime = Date.now() - stockCountStart;
            const productCountStart = Date.now();
            const productCount = await prisma.$queryRawUnsafe('SELECT COUNT(*) as count FROM product');
            const productCountTime = Date.now() - productCountStart;
            const stockSelectStart = Date.now();
            const stockSample = await prisma.$queryRawUnsafe('SELECT id, puc, category FROM stock LIMIT 5');
            const stockSelectTime = Date.now() - stockSelectStart;
            const totalTime = Date.now() - startTime;
            // Performance analysis
            const performance = {
                overall: {
                    totalTime: `${totalTime}ms`,
                    status: totalTime < 100 ? 'excellent' : totalTime < 300 ? 'good' : totalTime < 500 ? 'acceptable' : 'slow'
                },
                queries: {
                    stockCount: { time: `${stockCountTime}ms`, records: Number(stockCount[0]?.count || 0) },
                    productCount: { time: `${productCountTime}ms`, records: Number(productCount[0]?.count || 0) },
                    stockSelect: { time: `${stockSelectTime}ms`, records: Array.isArray(stockSample) ? stockSample.length : 0 }
                },
                recommendations: []
            };
            // Add recommendations based on performance
            if (stockCountTime > 50) {
                performance.recommendations.push('Consider adding index on stock table primary key');
            }
            if (productCountTime > 50) {
                performance.recommendations.push('Consider adding index on product table primary key');
            }
            if (stockSelectTime > 100) {
                performance.recommendations.push('Consider adding composite index on frequently queried stock columns');
            }
            if (totalTime > 300) {
                performance.recommendations.push('Consider implementing connection pooling and query optimization');
            }
            const response = createSuccessResponse('Performance analysis completed', performance);
            return reply.code(200).send(response);
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to analyze performance',
                error: error.message || 'PERFORMANCE_ERROR'
            });
        }
    });
    // Create performance indexes
    fastify.post('/create-indexes', {
        schema: {
            description: 'Create database indexes to improve performance',
            tags: ['Debug'],
        }
    }, async (request, reply) => {
        try {
            const results = [];
            // Create indexes for commonly queried columns
            const indexQueries = [
                // Stock table indexes
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_id ON stock(id)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_createddate ON stock(createddate)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_category ON stock(category)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_puc ON stock(puc)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_stockstatus ON stock(stockstatus)',
                // Product table indexes  
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_id ON product(id)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_createddate ON product(createddate)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_category ON product(category)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_puc ON product(puc)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_product_productstatus ON product(productstatus)',
                // Picklist table indexes
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_picklist_id ON picklist(id)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_picklist_type ON picklist(type)',
                'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_picklist_table_field ON picklist(table, field)',
            ];
            for (const query of indexQueries) {
                try {
                    const startTime = Date.now();
                    await prisma.$executeRawUnsafe(query);
                    const duration = Date.now() - startTime;
                    results.push({
                        query: query.substring(0, 80) + '...',
                        status: 'success',
                        duration: `${duration}ms`
                    });
                }
                catch (error) {
                    results.push({
                        query: query.substring(0, 80) + '...',
                        status: 'error',
                        error: error.message
                    });
                }
            }
            const response = createSuccessResponse('Database indexes creation completed', {
                results,
                totalIndexes: indexQueries.length,
                successful: results.filter(r => r.status === 'success').length,
                failed: results.filter(r => r.status === 'error').length
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to create indexes',
                error: error.message || 'INDEX_ERROR'
            });
        }
    });
    // Fast test endpoint
    fastify.get('/fast-stocks', {
        schema: {
            description: 'Fast stock query test without overhead',
            tags: ['Debug'],
        }
    }, async (request, reply) => {
        try {
            const startTime = Date.now();
            // Direct raw query without any overhead
            const rawResult = await prisma.$queryRawUnsafe(`
        SELECT id, puc, category, stockstatus, createddate 
        FROM stock 
        ORDER BY id DESC 
        LIMIT 10
      `);
            // Convert BigInt to Number for JSON serialization
            const result = Array.isArray(rawResult) ? rawResult.map(row => ({
                ...row,
                createddate: typeof row.createddate === 'bigint' ? Number(row.createddate) : row.createddate
            })) : [];
            const queryTime = Date.now() - startTime;
            const response = createSuccessResponse('Fast stock query completed', {
                queryTime: `${queryTime}ms`,
                records: Array.isArray(result) ? result.length : 0,
                data: result
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to execute fast query',
                error: error.message || 'FAST_QUERY_ERROR'
            });
        }
    });
    // Fast dynamic stocks endpoint
    fastify.get('/fast-dynamic-stocks', {
        schema: {
            description: 'Test fast dynamic stock query',
            tags: ['Debug'],
        }
    }, async (request, reply) => {
        try {
            const startTime = Date.now();
            // Import the fast function
            const { fastFindMany } = await import('../utils/dynamicDbOperations.js');
            const result = await fastFindMany('stock', {
                skip: 0,
                take: 10,
                useAllColumns: false // Use predefined columns for speed
            });
            const queryTime = Date.now() - startTime;
            const response = createSuccessResponse('Fast dynamic stock query completed', {
                queryTime: `${queryTime}ms`,
                records: Array.isArray(result) ? result.length : 0,
                data: result
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to execute fast dynamic query',
                error: error.message || 'FAST_DYNAMIC_ERROR'
            });
        }
    });
    // Test dynamic filtering
    fastify.get('/test-filtering', {
        schema: {
            description: 'Test dynamic filtering with specific parameters',
            tags: ['Debug'],
            querystring: {
                type: 'object',
                additionalProperties: true
            }
        }
    }, async (request, reply) => {
        try {
            const filters = request.query;
            // Import the filtering function
            const { dynamicFindManyWithFilters } = await import('../utils/dynamicDbOperations.js');
            const startTime = Date.now();
            // Test filtering on stock table
            const { data, total } = await dynamicFindManyWithFilters('stock', filters, {
                skip: 0,
                take: 5,
                useAllColumns: false
            });
            const queryTime = Date.now() - startTime;
            const response = createSuccessResponse('Dynamic filtering test completed', {
                queryTime: `${queryTime}ms`,
                filters: Object.keys(filters),
                total,
                returned: data.length,
                sampleData: data.length > 0 ? data[0] : null,
                allFilters: filters
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            fastify.log.error(error);
            return reply.code(500).send({
                success: false,
                message: 'Failed to test filtering',
                error: error.message || 'FILTERING_TEST_ERROR'
            });
        }
    });
}
//# sourceMappingURL=debug.route.js.map