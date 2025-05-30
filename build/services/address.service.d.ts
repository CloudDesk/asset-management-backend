import { CreateAddressInput, UpdateAddressInput, UpsertAddressInput } from '../schemas/address.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class AddressService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    create(data: CreateAddressInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateAddressInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    upsert(data: UpsertAddressInput & Record<string, any>): Promise<any>;
}
//# sourceMappingURL=address.service.d.ts.map