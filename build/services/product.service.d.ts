import { CreateProductInput, UpdateProductInput, UpsertProductInput } from '../schemas/product.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class ProductService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreateProductInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateProductInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    upsert(data: UpsertProductInput & Record<string, any>): Promise<any>;
    updateStockTotals(productId: string): Promise<any>;
}
//# sourceMappingURL=product.service.d.ts.map