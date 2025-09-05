import { CreatePromotionActionsInput, UpdatePromotionActionsInput, UpsertPromotionActionsInput } from '../schemas/promotion-actions.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class PromotionActionsService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreatePromotionActionsInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdatePromotionActionsInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<true>;
    upsert(data: UpsertPromotionActionsInput & Record<string, any>): Promise<any>;
}
//# sourceMappingURL=promotion-actions.service.d.ts.map