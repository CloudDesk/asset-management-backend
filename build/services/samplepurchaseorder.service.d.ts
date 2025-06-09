import { CreateSamplePurchaseOrderInput, UpdateSamplePurchaseOrderInput, UpsertSamplePurchaseOrderInput } from '../schemas/samplepurchaseorder.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class SamplePurchaseOrderService {
    /**
     * Find sample purchase orders with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    /**
     * Find sample purchase order by ID using dynamic operations
     */
    findById(id: string): Promise<any>;
    /**
     * Create new sample purchase order with dynamic field support
     * Only uses fields that exist in the database schema
     */
    create(data: CreateSamplePurchaseOrderInput & Record<string, any>): Promise<any>;
    /**
     * Update sample purchase order with dynamic field support
     */
    update(id: string, data: UpdateSamplePurchaseOrderInput & Record<string, any>): Promise<any>;
    /**
     * Delete sample purchase order by ID
     */
    delete(id: string): Promise<void>;
    /**
     * Upsert sample purchase order - create if ID not provided, update if ID exists
     */
    upsert(data: UpsertSamplePurchaseOrderInput & Record<string, any>): Promise<any>;
    /**
     * Validates that all required fields are present for creation
     */
    private validateRequiredFields;
    /**
     * Find sample purchase orders by supplier ID
     */
    findBySupplier(supplierId: string, page?: number, limit?: number): Promise<PaginationResult<any>>;
}
//# sourceMappingURL=samplepurchaseorder.service.d.ts.map