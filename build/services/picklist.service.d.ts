import { CreatePicklistInput, UpdatePicklistInput } from '../schemas/picklist.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
import { PicklistType } from '../config/dynamicFieldConfig.js';
export declare class PicklistService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    findByType(type: PicklistType, table?: string, field?: string): Promise<any[]>;
    create(data: CreatePicklistInput): Promise<any>;
    update(id: string, data: UpdatePicklistInput): Promise<any>;
    delete(id: string): Promise<void>;
    reorder(type: PicklistType, table: string, field: string, itemOrders: {
        id: string;
        ordering: number;
    }[]): Promise<any[]>;
    toggleActive(id: string): Promise<any>;
}
//# sourceMappingURL=picklist.service.d.ts.map