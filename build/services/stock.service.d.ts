import { CreateStockInput, UpdateStockInput, UpsertStockInput } from "../schemas/stock.schema.js";
import { PaginationResult } from "../utils/pagination.js";
import { FilterOptions } from "../utils/filterBuilder.js";
interface CreateStockOptions {
    skipProductUpdate?: boolean;
}
export declare class StockService {
    private productService;
    private platformStockService;
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    getSummaryByPuc(puc: string): Promise<{
        quantity: number;
        availablequantity: number;
        orderedquantity: number;
        soldquantity: number;
        ecompublishedquantity: number;
        platforms: Array<{
            platform: string;
            quantity: number;
            availablequantity: number;
            orderedquantity: number;
            soldquantity: number;
            ecompublishedquantity: number;
        }>;
        platformStocks: Array<{
            platform: string;
            totalqty: number;
            availableqty: number;
            orderedqty: number;
            soldqty: number;
            lockqty: number;
        }>;
        locations: Array<{
            location: string;
            quantity: number;
            availablequantity: number;
            orderedquantity: number;
            soldquantity: number;
            ecompublishedquantity: number;
        }>;
    } | null>;
    create(data: CreateStockInput & Record<string, any>, options?: CreateStockOptions): Promise<any>;
    createBulk(dataArray: (CreateStockInput & Record<string, any>)[]): Promise<{
        inserted: any[];
        failures: {
            index: number;
            error: string;
        }[];
    }>;
    /**
     * Direct bulk insert using database-level operations
     * Uses single SQL query with VALUES clause for maximum performance
     */
    createBulkDirect(dataArray: (CreateStockInput & Record<string, any>)[], options?: {
        batchSize?: number;
    }): Promise<{
        inserted: any[];
        failures: {
            index: number;
            error: string;
        }[];
        summary: {
            total: number;
            processed: number;
            successful: number;
            failed: number;
            batchesProcessed: number;
        };
        productUpdates: {
            attempted: number;
            succeeded: number;
            failed: number;
            failures: Array<{
                identifier: string;
                message: string;
            }>;
        };
        platformStockUpdates: {
            attempted: number;
            succeeded: number;
            failed: number;
            failures: Array<{
                productId: number;
                platform: string;
                message: string;
            }>;
        };
    }>;
    /**
     * Optimized bulk insert with batch processing
     * Processes records in configurable batches to avoid timeouts
     */
    createBulkOptimized(dataArray: (CreateStockInput & Record<string, any>)[], options?: {
        batchSize?: number;
        maxConcurrency?: number;
    }): Promise<{
        inserted: any[];
        failures: {
            index: number;
            error: string;
        }[];
        summary: {
            total: number;
            processed: number;
            successful: number;
            failed: number;
            batchesProcessed: number;
        };
        productUpdates: {
            attempted: number;
            succeeded: number;
            failed: number;
            failures: Array<{
                identifier: string;
                message: string;
            }>;
        };
        platformStockUpdates: {
            attempted: number;
            succeeded: number;
            failed: number;
            failures: Array<{
                productId: number;
                platform: string;
                message: string;
            }>;
        };
    }>;
    /**
     * Database-level bulk create using dynamicDbOperations
     * Uses single SQL query with VALUES clause for maximum performance
     */
    private dynamicBulkCreate;
    /**
     * Process a batch with controlled concurrency to avoid overwhelming the database
     */
    private processBatchWithConcurrency;
    /**
     * Async bulk insert for very large datasets (>1000 records)
     * Returns immediately with job ID, processes in background
     */
    createBulkAsync(dataArray: (CreateStockInput & Record<string, any>)[], options?: {
        batchSize?: number;
        maxConcurrency?: number;
    }): Promise<{
        jobId: string;
        status: 'queued';
        totalRecords: number;
        estimatedBatches: number;
    }>;
    /**
     * Update product quantities and platform stock for successful bulk inserts
     */
    private updateProductAndPlatformStockForBulkInsert;
    /**
     * Process async bulk job in background
     */
    private processAsyncBulkJob;
    update(id: string, data: UpdateStockInput & Record<string, any>): Promise<any>;
    private updateProductByPuc;
    delete(id: string): Promise<void>;
    upsert(data: UpsertStockInput & Record<string, any>): Promise<any>;
    findByProduct(productId: string): Promise<any[]>;
    updateQuantities(id: string, quantities: {
        quantity?: number;
        availableQuantity?: number;
        soldQuantity?: number;
    }): Promise<any>;
    updateByRfid(rfid: string, orderlineid: string): Promise<any>;
    bulkUpdateByRfid(updates: Array<{
        rfid: string;
        orderlineid: string;
    }>): Promise<{
        summary: {
            total: number;
            successful: number;
            failed: number;
            successRate: string;
        };
        results: ({
            index: number;
            rfid: string;
            orderlineid: string;
            success: boolean;
            error: any;
            errorDetails: any;
        } | {
            index: number;
            rfid: string;
            orderlineid: string;
            success: boolean;
            data: any;
            stockId: any;
            status: any;
        })[];
        errors: {
            index: number;
            rfid: string;
            orderlineid: string;
            success: boolean;
            error: any;
            errorDetails: any;
        }[] | undefined;
    }>;
}
export {};
//# sourceMappingURL=stock.service.d.ts.map