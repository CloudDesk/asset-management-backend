import { CreateStockInput, UpdateStockInput, UpsertStockInput } from "../schemas/stock.schema.js";
import { PaginationResult } from "../utils/pagination.js";
import { FilterOptions } from "../utils/filterBuilder.js";
export declare class StockService {
    private productService;
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreateStockInput & Record<string, any>): Promise<any>;
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
}
//# sourceMappingURL=stock.service.d.ts.map