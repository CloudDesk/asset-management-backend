import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
// Cache for frequently accessed data (in-memory cache for performance)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
export class SamplePurchaseRequestService {
    tableName = 'samplepurchaserequest';
    requiredFields = [
        'companyname', 'contactname', 'phonenumber', 'companymail',
        'gstnumber', 'companyaddress', 'supplierid', 'items',
        'createdby', 'modifiedby'
    ];
    /**
     * Get data from cache or execute function and cache result
     */
    async getCachedOrExecute(cacheKey, executeFn, ttl = CACHE_TTL) {
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
            logger.debug({ cacheKey }, 'Cache hit');
            return cached.data;
        }
        const result = await executeFn();
        cache.set(cacheKey, { data: result, timestamp: Date.now(), ttl });
        logger.debug({ cacheKey }, 'Cache miss - data cached');
        return result;
    }
    /**
     * Clear cache entries matching pattern
     */
    clearCache(pattern) {
        if (!pattern) {
            cache.clear();
            return;
        }
        for (const [key] of cache) {
            if (key.includes(pattern)) {
                cache.delete(key);
            }
        }
    }
    /**
     * Validate input data before processing
     */
    validateInput(data, operation) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid input data: must be an object');
        }
        if (operation === 'create') {
            const missingFields = this.requiredFields.filter(field => data[field] === undefined || data[field] === null || data[field] === '');
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }
        }
        // Validate items array if present
        if (data.items) {
            if (!Array.isArray(data.items) || data.items.length === 0) {
                throw new Error('Items must be a non-empty array');
            }
            if (data.items.length > 100) {
                throw new Error('Too many items: maximum 100 items allowed');
            }
            data.items.forEach((item, index) => {
                if (!item.id || !item.name || !item.quantity) {
                    throw new Error(`Invalid item at index ${index}: id, name, and quantity are required`);
                }
                if (typeof item.quantity !== 'number' || item.quantity <= 0) {
                    throw new Error(`Invalid quantity at index ${index}: must be a positive number`);
                }
            });
        }
    }
    /**
     * Find sample purchase requests with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    async findMany(filters, page = 1, limit = 10, sortBy, sortOrder) {
        try {
            // Validate pagination parameters
            page = Math.max(1, Math.floor(page));
            limit = Math.min(Math.max(1, Math.floor(limit)), 100); // Limit max to 100 for performance
            const cacheKey = `findMany:${JSON.stringify({ filters, page, limit, sortBy, sortOrder })}`;
            return await this.getCachedOrExecute(cacheKey, async () => {
                logger.info({ filters, page, limit, sortBy, sortOrder }, 'Starting optimized sample purchase request findMany');
                const { skip, take } = getPrismaSkipTake(page, limit);
                // Add sorting options for better performance
                const options = {
                    skip,
                    take,
                    useAllColumns: true
                };
                if (sortBy && ['id', 'companyname', 'contactname', 'createddate', 'modifieddate'].includes(sortBy)) {
                    options.orderBy = { [sortBy]: sortOrder || 'desc' };
                }
                const { data: samplePurchaseRequests, total } = await dynamicFindManyWithFilters(this.tableName, filters, options);
                logger.info({
                    samplePurchaseRequestCount: samplePurchaseRequests.length,
                    total,
                    filtered: Object.keys(filters).length > 0,
                    appliedFilters: Object.keys(filters),
                    page,
                    limit,
                    cached: false
                }, 'Optimized sample purchase request findMany completed');
                return createPaginationResult(samplePurchaseRequests, total, page, limit);
            }, 2 * 60 * 1000); // 2 minutes cache for list queries
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in optimized sample purchase request findMany operation');
            throw error;
        }
    }
    /**
     * Find sample purchase request by ID using dynamic operations with caching
     */
    async findById(id) {
        try {
            // Validate ID format
            if (!id || typeof id !== 'string' || !/^\d+$/.test(id)) {
                throw new Error('Invalid ID format: ID must be a positive integer string');
            }
            const cacheKey = `findById:${id}`;
            return await this.getCachedOrExecute(cacheKey, async () => {
                logger.debug({ samplePurchaseRequestId: id }, 'Starting optimized sample purchase request findById');
                const samplePurchaseRequest = await dynamicFindUnique(this.tableName, { id });
                if (!samplePurchaseRequest) {
                    throw new Error(`Sample purchase request with ID ${id} not found`);
                }
                logger.debug({
                    samplePurchaseRequestId: id,
                    availableFields: Object.keys(samplePurchaseRequest),
                    cached: false
                }, 'Optimized sample purchase request findById completed');
                return samplePurchaseRequest;
            }, 5 * 60 * 1000); // 5 minutes cache for individual records
        }
        catch (error) {
            logger.error({ error, samplePurchaseRequestId: id }, 'Error in optimized sample purchase request findById operation');
            throw error;
        }
    }
    /**
     * Create new sample purchase request with optimized validation
     */
    async create(data) {
        try {
            // Validate input data
            this.validateInput(data, 'create');
            logger.debug({ originalData: data }, 'Starting optimized sample purchase request create');
            // Prepare data with automatic timestamps
            const createData = {
                ...data,
                createddate: data.createddate || Date.now(),
                modifieddate: data.modifieddate || Date.now()
            };
            const samplePurchaseRequest = await dynamicCreate(this.tableName, createData);
            if (!samplePurchaseRequest) {
                throw new Error('Failed to create sample purchase request - database operation failed');
            }
            // Clear relevant cache entries
            this.clearCache('findMany');
            this.clearCache(`supplier:${data.supplierid}`);
            logger.info({
                samplePurchaseRequestId: samplePurchaseRequest.id,
                availableFields: Object.keys(samplePurchaseRequest)
            }, 'Optimized sample purchase request create completed');
            return samplePurchaseRequest;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in optimized sample purchase request create operation');
            throw error;
        }
    }
    /**
     * Update sample purchase request with optimized validation and caching
     */
    async update(id, data) {
        try {
            // Validate input
            if (!data || Object.keys(data).length === 0) {
                throw new Error('Update data cannot be empty');
            }
            this.validateInput(data, 'update');
            // Check if record exists (with caching)
            const existingRecord = await this.findById(id);
            logger.debug({ originalData: data, samplePurchaseRequestId: id }, 'Starting optimized sample purchase request update');
            // Prepare update data with automatic modified timestamp
            const updateData = {
                ...data,
                modifieddate: Date.now()
            };
            const samplePurchaseRequest = await dynamicUpdate(this.tableName, { id }, updateData);
            if (!samplePurchaseRequest) {
                throw new Error('Failed to update sample purchase request - database operation failed');
            }
            // Clear relevant cache entries
            this.clearCache(`findById:${id}`);
            this.clearCache('findMany');
            this.clearCache(`supplier:${existingRecord.supplierid}`);
            if (data.supplierid && data.supplierid !== existingRecord.supplierid) {
                this.clearCache(`supplier:${data.supplierid}`);
            }
            logger.info({
                samplePurchaseRequestId: id,
                availableFields: Object.keys(samplePurchaseRequest)
            }, 'Optimized sample purchase request update completed');
            return samplePurchaseRequest;
        }
        catch (error) {
            logger.error({ error, data, samplePurchaseRequestId: id }, 'Error in optimized sample purchase request update operation');
            throw error;
        }
    }
    /**
     * Delete sample purchase request by ID with optimized caching
     */
    async delete(id) {
        try {
            // Check if record exists and get supplier ID for cache clearing
            const existingRecord = await this.findById(id);
            logger.debug({ samplePurchaseRequestId: id }, 'Starting optimized sample purchase request delete');
            const success = await dynamicDelete(this.tableName, { id });
            if (!success) {
                throw new Error('Failed to delete sample purchase request - database operation failed');
            }
            // Clear relevant cache entries
            this.clearCache(`findById:${id}`);
            this.clearCache('findMany');
            this.clearCache(`supplier:${existingRecord.supplierid}`);
            logger.info({ samplePurchaseRequestId: id }, 'Optimized sample purchase request delete completed');
        }
        catch (error) {
            logger.error({ error, samplePurchaseRequestId: id }, 'Error in optimized sample purchase request delete operation');
            throw error;
        }
    }
    /**
     * Upsert sample purchase request with optimized logic
     */
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing record
                logger.debug({ samplePurchaseRequestId: id, data: updateData }, 'Upserting existing sample purchase request');
                return await this.update(id, updateData);
            }
            else {
                // Create new record
                logger.debug({ data: updateData }, 'Upserting new sample purchase request');
                return await this.create(updateData);
            }
        }
        catch (error) {
            logger.error({ error, data }, 'Error in optimized sample purchase request upsert operation');
            throw error;
        }
    }
    /**
     * Find sample purchase requests by supplier ID with caching
     */
    async findBySupplier(supplierId, page = 1, limit = 10, sortBy, sortOrder) {
        try {
            // Validate supplier ID
            if (!supplierId || typeof supplierId !== 'string') {
                throw new Error('Invalid supplier ID: must be a non-empty string');
            }
            const cacheKey = `supplier:${supplierId}:${page}:${limit}:${sortBy}:${sortOrder}`;
            return await this.getCachedOrExecute(cacheKey, async () => {
                logger.debug({ supplierId, page, limit, sortBy, sortOrder }, 'Finding sample purchase requests by supplier');
                const filters = { supplierid: supplierId };
                const result = await this.findMany(filters, page, limit, sortBy, sortOrder);
                logger.debug({
                    supplierId,
                    samplePurchaseRequestCount: result.data.length,
                    total: result.pagination.total,
                    cached: false
                }, 'Found sample purchase requests by supplier');
                return result;
            }, 3 * 60 * 1000); // 3 minutes cache for supplier queries
        }
        catch (error) {
            logger.error({ error, supplierId }, 'Error finding sample purchase requests by supplier');
            throw error;
        }
    }
    /**
     * Get service statistics for monitoring
     */
    async getStats() {
        return {
            cacheSize: cache.size,
            cacheKeys: Array.from(cache.keys())
        };
    }
    /**
     * Clear all cache (for testing or manual cache invalidation)
     */
    clearAllCache() {
        this.clearCache();
        logger.info('All cache cleared manually');
    }
}
//# sourceMappingURL=samplepurchaserequest.service.js.map