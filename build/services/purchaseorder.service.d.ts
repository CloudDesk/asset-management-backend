import { CreatePurchaseOrderInput, UpdatePurchaseOrderInput, UpsertPurchaseOrderInput } from '../schemas/purchaseorder.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class PurchaseOrderService {
    /**
     * Find purchase orders with dynamic filtering and pagination
     * Supports any field that exists in the database
     */
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    /**
     * Find purchase order by ID using dynamic operations
     */
    findById(id: string): Promise<any>;
    /**
     * Create new purchase order with dynamic field support
     * Only uses fields that exist in the database schema
     */
    create(data: CreatePurchaseOrderInput & Record<string, any>): Promise<any>;
    /**
     * Update purchase order with dynamic field support
     */
    update(id: string, data: UpdatePurchaseOrderInput & Record<string, any>): Promise<any>;
    /**
     * Delete purchase order by ID
     */
    delete(id: string): Promise<void>;
    /**
     * Upsert purchase order - create if ID not provided, update if ID exists
     */
    upsert(data: UpsertPurchaseOrderInput & Record<string, any>): Promise<any>;
    /**
     * Find purchase orders by supplier ID
     */
    findBySupplier(supplierId: string, page?: number, limit?: number): Promise<PaginationResult<any>>;
    /**
     * Update purchase order status
     */
    updateStatus(id: string, status: string, notes?: string): Promise<any>;
}
//# sourceMappingURL=purchaseorder.service.d.ts.map