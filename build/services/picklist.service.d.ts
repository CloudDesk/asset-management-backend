import { CreatePicklistInput, UpdatePicklistInput } from '../schemas/picklist.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class PicklistService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    findByObject(object: string): Promise<any[]>;
    findByFieldname(fieldname: string): Promise<any[]>;
    create(data: CreatePicklistInput): Promise<any>;
    update(id: string, data: UpdatePicklistInput): Promise<any>;
    delete(id: string): Promise<void>;
    /**
     * Fetch picklists grouped by fieldName for a given object
     * Optimized query that fetches all records in one query and groups in memory
     *
     * @param object - Object name (e.g., 'product')
     * @param sortBy - Field to sort by: 'sortorder' (default) or 'label'
     * @param order - Sort direction: 'asc' (default) or 'desc'
     * @returns Object with fieldName as keys and arrays of picklist records as values
     */
    findGroupedByObject(object: string, sortBy?: 'sortorder' | 'label', order?: 'asc' | 'desc'): Promise<Record<string, any[]>>;
}
//# sourceMappingURL=picklist.service.d.ts.map