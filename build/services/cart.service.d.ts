import { CreateCartInput, UpdateCartInput, UpsertCartInput } from '../schemas/cart.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class CartService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreateCartInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateCartInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    /**
     * Upsert cart/wishlist item with duplicate prevention
     * Business Rules:
     * - If ID provided: UPDATE that specific record by ID (direct update)
     * - If no ID:
     *   - Cart items (iscart=true): UPDATE quantity if exists, INSERT if not
     *   - Wishlist items (iswishlist=true): SKIP if exists, INSERT if not
     * - Same product CAN be in both cart and wishlist (different records)
     * - Uniqueness check at service level, not database level
     */
    upsert(data: UpsertCartInput & Record<string, any>): Promise<any>;
    /**
     * Validate cart/wishlist request
     * Ensures data integrity before insert/update
     */
    private validateCartRequest;
    findByUserId(userId: string, isCart?: boolean): Promise<any[]>;
    findWishlistByUserId(userId: string): Promise<any[]>;
    clearCartByUserId(userId: string): Promise<{
        deletedCount: number;
    }>;
}
//# sourceMappingURL=cart.service.d.ts.map