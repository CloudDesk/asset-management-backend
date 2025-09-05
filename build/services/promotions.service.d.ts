import { CreatePromotionsInput, UpdatePromotionsInput, UpsertPromotionsInput } from '../schemas/promotions.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class PromotionsService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreatePromotionsInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdatePromotionsInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<true>;
    upsert(data: UpsertPromotionsInput & Record<string, any>): Promise<any>;
}
//# sourceMappingURL=promotions.service.d.ts.map