import { CreateRatingInput, UpdateRatingInput, UpsertRatingInput } from "../schemas/rating.schema.js";
import { PaginationResult } from "../utils/pagination.js";
import { FilterOptions } from "../utils/filterBuilder.js";
export declare class RatingService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    findByUserId(userId: number): Promise<any[]>;
    findByProductId(productId: number): Promise<any[]>;
    findByOrderId(orderId: number): Promise<any[]>;
    create(data: CreateRatingInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateRatingInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<boolean>;
    upsert(data: UpsertRatingInput & Record<string, any>): Promise<any>;
    getAverageRatingByProductId(productId: number): Promise<{
        averageRating: number;
        totalRatings: number;
    }>;
    getRatingsByStarLevel(productId?: number): Promise<{
        [key: number]: number;
    }>;
}
//# sourceMappingURL=rating.service.d.ts.map