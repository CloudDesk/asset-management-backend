import { CreateTransactionInput, UpdateTransactionInput, UpsertTransactionInput } from '../schemas/transaction.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class TransactionService {
    /**
     * Enhanced error handler for database operations
     */
    private handleDatabaseError;
    /**
     * Retry wrapper for database operations
     */
    private retryDatabaseOperation;
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    findByTransactionId(transactionid: string): Promise<any>;
    findByUserId(userId: number, page?: number, limit?: number): Promise<PaginationResult<any>>;
    create(data: CreateTransactionInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateTransactionInput & Record<string, any>): Promise<any>;
    updateByTransactionId(transactionid: string, data: UpdateTransactionInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    deleteByTransactionId(transactionid: string): Promise<void>;
    upsert(data: UpsertTransactionInput & Record<string, any>): Promise<any>;
    /**
     * Get transaction statistics for a user
     */
    getTransactionStats(userId?: number): Promise<any>;
    /**
     * Process filters for special cases like amount range
     */
    private processFilters;
}
//# sourceMappingURL=transaction.service.d.ts.map