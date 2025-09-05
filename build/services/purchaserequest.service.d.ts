import { CreatePurchaseRequestInput, UpdatePurchaseRequestInput, UpsertPurchaseRequestInput } from '../schemas/purchaserequest.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class PurchaseRequestService {
    /**
     * Find purchase requests with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    /**
     * Find purchase request by ID using dynamic operations
     */
    findById(id: string): Promise<any>;
    /**
     * Create new purchase request with dynamic field support
     * Only uses fields that exist in the database schema
     */
    create(data: CreatePurchaseRequestInput & Record<string, any>): Promise<any>;
    /**
     * Update purchase request with dynamic field support
     */
    update(id: string, data: UpdatePurchaseRequestInput & Record<string, any>): Promise<any>;
    /**
     * Delete purchase request by ID
     */
    delete(id: string): Promise<void>;
    /**
     * Upsert purchase request - create if ID not provided, update if ID exists
     */
    upsert(data: UpsertPurchaseRequestInput & Record<string, any>): Promise<any>;
    /**
     * Find purchase requests by supplier ID
     */
    findBySupplier(supplierId: string, page?: number, limit?: number): Promise<PaginationResult<any>>;
    /**
     * Find purchase requests by requester
     */
    findByRequester(requestedBy: string, page?: number, limit?: number): Promise<PaginationResult<any>>;
    /**
     * Approve purchase request
     */
    approve(id: string, approvedBy: string, notes?: string): Promise<any>;
    /**
     * Reject purchase request
     */
    reject(id: string, rejectedBy: string, notes?: string): Promise<any>;
}
//# sourceMappingURL=purchaserequest.service.d.ts.map