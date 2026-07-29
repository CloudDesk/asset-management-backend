import { CreatePicklistInput, UpdatePicklistInput } from '../schemas/picklist.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class PicklistService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    /**
     * Add the active category image to picklist records without changing the
     * existing database-shaped fields consumed by older clients.
     */
    private attachCategoryImages;
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
    /**
     * v2: Get picklists with optional grouping by fieldname and/or parent
     * Supports both flat and grouped response formats
     *
     * @param filters - Filter options including object, searchtext, parent, etc.
     * @param groupByFieldname - If true, returns grouped by fieldname; if false, returns flat array
     * @param groupByParent - If true (and groupByFieldname is true), groups by parent within each fieldname
     * @param sortorder - Sort direction for sortorder field (ASC/DESC)
     * @param fieldnameOrder - Sort direction for fieldname groups (ASC/DESC)
     * @param limit - Global limit (not per fieldname)
     * @returns Object with grouped/flat data and metadata
     */
    findManyV2(filters: FilterOptions, groupByFieldname?: boolean, groupByParent?: boolean, sortorder?: 'ASC' | 'DESC', fieldnameOrder?: 'ASC' | 'DESC', limit?: number): Promise<{
        grouped?: Record<string, any[] | Record<string, any[] | Record<string, any[]>>>;
        flat?: any[];
        meta: {
            object?: string;
            grouped: boolean;
            groupedByParent?: boolean;
            groupCount?: number;
            totalRecords: number;
        };
        pagination?: PaginationResult<any>['pagination'];
    }>;
    /**
     * v2: Bulk create/update picklists - Create new items or update existing ones
     * Handles both create (when id is missing/null/negative) and update operations
     * Useful for reordering and reorganizing picklist items in a single API call
     *
     * @param updates - Array of picklist items:
     *   - For CREATE: id is missing/null/negative, requires: label, value, object, fieldname
     *   - For UPDATE: id is provided (positive number), updates only provided fields
     * @returns Summary of create/update results
     */
    bulkUpdateV2(updates: Array<{
        id?: number | string | null;
        fieldname?: string;
        parent?: string | null;
        sortorder?: number | null;
        label?: string | null;
        value?: string | null;
        object?: string;
        description?: string | null;
        controlledfieldname?: string | null;
        controlledlabel?: string | null;
        controlledvalue?: string | null;
        isactive?: boolean | null;
    }>): Promise<{
        summary: {
            total: number;
            successful: number;
            failed: number;
        };
        results: Array<{
            id: number | string;
            success: boolean;
            operation?: 'create' | 'update';
            data?: any;
            error?: string;
        }>;
    }>;
    /**
     * Get unique fieldnames filtered by object
     * Returns an array of unique fieldname values for a given object
     *
     * @param object - Object name to filter by (e.g., 'product', 'stock')
     * @returns Array of unique fieldname strings
     */
    getUniqueFieldnamesByObject(object: string): Promise<string[]>;
}
//# sourceMappingURL=picklist.service.d.ts.map