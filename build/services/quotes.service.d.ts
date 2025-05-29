import { CreateQuotesInput, UpdateQuotesInput, UpsertQuotesInput } from '../schemas/quotes.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class QuotesService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreateQuotesInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateQuotesInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    upsert(data: UpsertQuotesInput & Record<string, any>): Promise<any>;
    findByPrNumber(prnumber: string, page?: number, limit?: number): Promise<PaginationResult<any>>;
    findByStatus(status: string, page?: number, limit?: number): Promise<PaginationResult<any>>;
    getQuotesStats(): Promise<{
        total: number;
        byStatus: Record<string, number>;
    }>;
}
//# sourceMappingURL=quotes.service.d.ts.map