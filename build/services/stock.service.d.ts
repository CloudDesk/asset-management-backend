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