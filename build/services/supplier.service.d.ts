import { CreateSupplierInput, UpdateSupplierInput, UpsertSupplierInput } from '../schemas/supplier.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class SupplierService {
    /**
     * Find suppliers with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    /**
     * Find supplier by ID using dynamic operations
     */
    findById(id: string): Promise<any>;
    /**
     * Create new supplier with dynamic field support
     * Only uses fields that exist in the database schema
     */
    create(data: CreateSupplierInput & Record<string, any>): Promise<any>;
    /**
     * Update supplier with dynamic field support
     */
    update(id: string, data: UpdateSupplierInput & Record<string, any>): Promise<any>;
    /**
     * Delete supplier by ID
     */
    delete(id: string): Promise<void>;
    /**
     * Upsert supplier - create if ID not provided, update if ID exists
     */
    upsert(data: UpsertSupplierInput & Record<string, any>): Promise<any>;
    /**
     * Get supplier statistics and related data counts
     */
    getSupplierStats(supplierId: string): Promise<{
        purchaseOrdersCount: number;
        purchaseRequestsCount: number;
        totalTransactions: number;
    }>;
}
//# sourceMappingURL=supplier.service.d.ts.map