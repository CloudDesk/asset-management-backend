import { CreatePromotionRulesInput, UpdatePromotionRulesInput, UpsertPromotionRulesInput } from '../schemas/promotion-rules.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class PromotionRulesService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreatePromotionRulesInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdatePromotionRulesInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<true>;
    upsert(data: UpsertPromotionRulesInput & Record<string, any>): Promise<any>;
}
//# sourceMappingURL=promotion-rules.service.d.ts.map