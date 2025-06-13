import { CreateCartInput, UpdateCartInput, UpsertCartInput } from '../schemas/cart.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class CartService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreateCartInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateCartInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    upsert(data: UpsertCartInput & Record<string, any>): Promise<any>;
    findByUserId(userId: string, isCart?: boolean): Promise<any[]>;
    findWishlistByUserId(userId: string): Promise<any[]>;
    clearCartByUserId(userId: string): Promise<{
        deletedCount: number;
    }>;
}
//# sourceMappingURL=cart.service.d.ts.map