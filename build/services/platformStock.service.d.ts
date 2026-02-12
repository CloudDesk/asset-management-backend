import { CreatePlatformStockInput, UpdatePlatformStockInput, UpsertPlatformStockInput } from "../schemas/platformStock.schema.js";
import { PaginationResult } from "../utils/pagination.js";
import { FilterOptions } from "../utils/filterBuilder.js";
export declare class PlatformStockService {
    /**
     * Calculate platform status based on available quantity
     * @param availableqty - Available quantity
     * @returns Platform status string
     */
    private calculatePlatformStatus;
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string | number): Promise<any>;
    create(data: CreatePlatformStockInput & Record<string, any>): Promise<any>;
    update(id: string | number, data: UpdatePlatformStockInput & Record<string, any>): Promise<any>;
    delete(id: string | number): Promise<true>;
    upsert(data: UpsertPlatformStockInput & Record<string, any>): Promise<any>;
    /**
     * Update platform stock quantities based on stock changes
     * Handles multiple business scenarios:
     * 1. Platform transfers (decrease old platform, increase new platform)
     * 2. E-com publish changes (increase/decrease available quantity)
     * 3. Stock status changes (available/sold)
     * 4. Stock deletions (decrease quantities)
     * 5. New stock additions (increase quantities)
     */
    updatePlatformStockQuantities(productId: number, platform: string, stockInfo: {
        ecompublish?: boolean;
        stockstatus?: string;
        quantity?: number;
        isNewStock?: boolean;
        operation?: 'create' | 'update' | 'delete' | 'transfer';
        oldPlatform?: string;
        oldEcompublish?: boolean;
        oldStockstatus?: string;
    }): Promise<any>;
    /**
     * Transfer stock between platforms
     * Decreases quantities from old platform and increases in new platform
     */
    transferStockBetweenPlatforms(productId: number, fromPlatform: string, toPlatform: string, stockInfo: {
        ecompublish?: boolean;
        stockstatus?: string;
        quantity?: number;
    }): Promise<{
        fromPlatformStock: any;
        toPlatformStock: any;
    } | null>;
    /**
     * Get platform stock for a specific product and platform
     */
    getByProductAndPlatform(productId: number, platform: string): Promise<any>;
    /**
     * Recalculate PlatformStock quantities from scratch (similar to Product.updateStockTotals)
     * Counts actual stocks and recalculates all quantities
     *
     * Formula:
     * - totalqty = Count of ALL stocks for this product+platform
     * - ecomqty = Count of stocks where stockstatus = 'available' AND ecompublish = true
     * - soldqty = Count of stocks where stockstatus = 'sold'
     * - availableqty = ecomqty - orderedqty - soldqty - lockqty
     */
    recalculatePlatformStockQuantities(productId: number, platform: string): Promise<any>;
}
//# sourceMappingURL=platformStock.service.d.ts.map