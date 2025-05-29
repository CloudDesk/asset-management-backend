import { CreateNotesInput, UpdateNotesInput } from '../schemas/notes.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class NotesService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreateNotesInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateNotesInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    findByQuoteNumber(quotenumber: string, page?: number, limit?: number): Promise<PaginationResult<any>>;
    getNotesStats(): Promise<{
        total: number;
        byQuote: Record<string, number>;
        pinned: number;
    }>;
}
//# sourceMappingURL=notes.service.d.ts.map