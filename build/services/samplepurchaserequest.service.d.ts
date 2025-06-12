import { CreateSamplePurchaseRequestInput, UpdateSamplePurchaseRequestInput, UpsertSamplePurchaseRequestInput } from '../schemas/samplepurchaserequest.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class SamplePurchaseRequestService {
    private readonly tableName;
    private readonly requiredFields;
    /**
     * Get data from cache or execute function and cache result
     */
    private getCachedOrExecute;
    /**
     * Clear cache entries matching pattern
     */
    private clearCache;
    /**
     * Validate input data before processing
     */
    private validateInput;
    /**
     * Find sample purchase requests with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    findMany(filters: FilterOptions, page?: number, limit?: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<PaginationResult<any>>;
    /**
     * Find sample purchase request by ID using dynamic operations with caching
     */
    findById(id: string): Promise<any>;
    /**
     * Create new sample purchase request with optimized validation
     */
    create(data: CreateSamplePurchaseRequestInput & Record<string, any>): Promise<any>;
    /**
     * Update sample purchase request with optimized validation and caching
     */
    update(id: string, data: UpdateSamplePurchaseRequestInput & Record<string, any>): Promise<any>;
    /**
     * Delete sample purchase request by ID with optimized caching
     */
    delete(id: string): Promise<void>;
    /**
     * Upsert sample purchase request with optimized logic
     */
    upsert(data: UpsertSamplePurchaseRequestInput & Record<string, any>): Promise<any>;
    /**
     * Find sample purchase requests by supplier ID with caching
     */
    findBySupplier(supplierId: string, page?: number, limit?: number, sortBy?: string, sortOrder?: 'asc' | 'desc'): Promise<PaginationResult<any>>;
    /**
     * Get service statistics for monitoring
     */
    getStats(): Promise<{
        cacheSize: number;
        cacheKeys: string[];
    }>;
    /**
     * Clear all cache (for testing or manual cache invalidation)
     */
    clearAllCache(): void;
}
//# sourceMappingURL=samplepurchaserequest.service.d.ts.map