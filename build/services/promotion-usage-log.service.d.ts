import { CreatePromotionUsageLogInput, UpdatePromotionUsageLogInput, UpsertPromotionUsageLogInput } from '../schemas/promotion-usage-log.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class PromotionUsageLogService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreatePromotionUsageLogInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdatePromotionUsageLogInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<true>;
    upsert(data: UpsertPromotionUsageLogInput & Record<string, any>): Promise<any>;
}
//# sourceMappingURL=promotion-usage-log.service.d.ts.map