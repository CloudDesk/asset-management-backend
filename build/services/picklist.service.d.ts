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
}
//# sourceMappingURL=picklist.service.d.ts.map