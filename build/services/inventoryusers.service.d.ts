import { CreateInventoryUsersInput, UpdateInventoryUsersInput, UpsertInventoryUsersInput } from '../schemas/inventoryusers.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class InventoryUsersService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreateInventoryUsersInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateInventoryUsersInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    upsert(data: UpsertInventoryUsersInput & Record<string, any>): Promise<any>;
}
//# sourceMappingURL=inventoryusers.service.d.ts.map