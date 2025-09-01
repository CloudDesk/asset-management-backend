import { CreateUsersInput, UpdateUsersInput, UpsertUsersInput } from '../schemas/users.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class UsersService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    findByEmail(email: string): Promise<any>;
    create(data: CreateUsersInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateUsersInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    /**
     * Authenticate user with email and password
     */
    authenticate(email: string, password: string): Promise<{
        user: any;
        token: string;
    } | null>;
    upsert(data: UpsertUsersInput & Record<string, any>): Promise<any>;
}
//# sourceMappingURL=users.service.d.ts.map