import { CreateSamplePurchaseRequestInput, UpdateSamplePurchaseRequestInput, UpsertSamplePurchaseRequestInput } from '../schemas/samplepurchaserequest.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class SamplePurchaseRequestService {
    /**
     * Find sample purchase requests with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    /**
     * Find sample purchase request by ID using dynamic operations
     */
    findById(id: string): Promise<any>;
    /**
     * Create new sample purchase request with dynamic field support
     * Only uses fields that exist in the database schema
     */
    create(data: CreateSamplePurchaseRequestInput & Record<string, any>): Promise<any>;
    /**
     * Update sample purchase request with dynamic field support
     */
    update(id: string, data: UpdateSamplePurchaseRequestInput & Record<string, any>): Promise<any>;
    /**
     * Delete sample purchase request by ID
     */
    delete(id: string): Promise<void>;
    /**
     * Upsert sample purchase request - create if ID not provided, update if ID exists
     */
    upsert(data: UpsertSamplePurchaseRequestInput & Record<string, any>): Promise<any>;
    /**
     * Validates that all required fields are present for creation
     */
    private validateRequiredFields;
    /**
     * Find sample purchase requests by supplier ID
     */
    findBySupplier(supplierId: string, page?: number, limit?: number): Promise<PaginationResult<any>>;
}
//# sourceMappingURL=samplepurchaserequest.service.d.ts.map