import { CreatePoinvoiceInput, UpdatePoinvoiceInput, UpsertPoinvoiceInput } from '../schemas/poinvoice.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class PoinvoiceService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreatePoinvoiceInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdatePoinvoiceInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    upsert(data: UpsertPoinvoiceInput & Record<string, any>): Promise<any>;
}
//# sourceMappingURL=poinvoice.service.d.ts.map