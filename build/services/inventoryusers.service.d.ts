import { CreateInventoryUsersInput, UpdateInventoryUsersInput, UpsertInventoryUsersInput } from '../schemas/inventoryusers.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class InventoryUsersService {
    private emailService;
    private sendPasswordSetLink;
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    findByEmail(email: string): Promise<any>;
    create(data: CreateInventoryUsersInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateInventoryUsersInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    upsert(data: UpsertInventoryUsersInput & Record<string, any>): Promise<any>;
    /**
     * Authenticate user with email and password
     */
    authenticate(email: string, password: string): Promise<{
        user: any;
        roles: any;
        permissions: any;
        token: string;
        refreshToken: string;
        expiresIn: number;
    } | null>;
    /**
     * Sign out user
     * NOTE: Session revocation is handled by authSessionService.revokeAllUserSessions()
     * This method only updates modifieddate for audit purposes
     */
    signOut(userId: number): Promise<void>;
    /**
     * Initiate password reset process
     */
    initiatePasswordReset(email: string): Promise<void>;
    /**
     * Reset password using reset token
     */
    resetPassword(token: string, newPassword: string): Promise<void>;
    /**
     * Update user password (for authenticated users)
     */
    updatePassword(userId: number, currentPassword: string, newPassword: string): Promise<void>;
}
//# sourceMappingURL=inventoryusers.service.d.ts.map