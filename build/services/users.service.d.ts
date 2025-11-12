import { CreateUsersInput, CreateGuestUserInput, UpdateUsersInput, UpsertUsersInput } from '../schemas/users.schema.js';
import { PaginationResult } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
export declare class UsersService {
    findMany(filters: FilterOptions, page: number, limit: number): Promise<PaginationResult<any>>;
    findById(id: string): Promise<any>;
    findByEmail(email: string): Promise<any>;
    findByMobileNumber(mobileNumber: number): Promise<any>;
    create(data: CreateUsersInput & Record<string, any>): Promise<any>;
    update(id: string, data: UpdateUsersInput & Record<string, any>): Promise<any>;
    delete(id: string): Promise<void>;
    /**
     * Soft delete user (deactivate account)
     * @param userId - The user ID to deactivate
     * @param email - Optional email to update before deactivation
     */
    deactivateAccount(userId: number, email?: string): Promise<any>;
    /**
     * Authenticate user with email and password
     */
    authenticate(email: string, password: string): Promise<{
        user: any;
        token: string;
    } | null>;
    /**
     * Authenticate user with mobile number and password
     */
    authenticateByMobile(mobileNumber: number, password: string): Promise<{
        user: any;
        token: string;
    } | null>;
    /**
     * Generate OTP for mobile number (passwordless login step 1)
     * @param mobileNumber - The mobile number to generate OTP for
     * @param verifyOnly - If true, only generate OTP if user exists (for delete account flow)
     */
    generateMobileOTP(mobileNumber: number, verifyOnly?: boolean): Promise<{
        otp: number;
        expiresAt: Date;
        isNewUser?: boolean;
    } | null>;
    /**
     * Verify OTP and authenticate user (passwordless login step 2)
     */
    verifyMobileOTP(mobileNumber: number, otp: number): Promise<{
        user: any;
        token: string;
    } | null>;
    private otpStorage;
    private storeOTP;
    private verifyOTP;
    private clearOTP;
    /**
     * Get OTP for testing purposes (remove in production)
     */
    getOTPForTesting(mobileNumber: number): Promise<number | null>;
    upsert(data: UpsertUsersInput & Record<string, any>): Promise<any>;
    /**
     * Create a guest user with minimal required fields
     * Guest users can checkout without creating an account
     */
    createGuestUser(data: CreateGuestUserInput & Record<string, any>): Promise<any>;
    /**
     * Convert guest user to registered user
     * Called when a guest user registers/logs in with the same phone number
     */
    convertGuestToRegistered(userId: number, registrationData?: Partial<CreateUsersInput>): Promise<any>;
    /**
     * Find all orders for a user (including when they were a guest) by mobile number
     * This is useful when showing order history after a guest user logs in
     */
    findOrdersByMobileNumber(mobileNumber: number): Promise<never[] | {
        userId: any;
        isGuest: any;
    }>;
    /**
     * Merge guest user into authenticated user
     * When a user authenticates and has previous guest orders
     */
    mergeGuestUser(guestUserId: number, authenticatedUserId: number): Promise<boolean>;
    /**
     * Store Amazon refresh token and seller ID for a user
     * @param userId - User ID
     * @param refreshToken - Refresh token from Amazon (will be encrypted in Step 8)
     * @param sellerId - Seller ID from Amazon
     * @param userType - User type: "inventoryusers" or "users" (default: "inventoryusers")
     * @param marketplaceId - Marketplace ID (default: "A21TJRUUN4KGV" for India)
     * @returns Amazon connection record
     */
    storeAmazonRefreshToken(userId: number, refreshToken: string, sellerId: string, userType?: string, marketplaceId?: string): Promise<any>;
    /**
     * Get Amazon refresh token for a user
     * @param userId - User ID
     * @param userType - User type: "inventoryusers" or "users" (default: "inventoryusers")
     * @returns Refresh token (decrypted) or null if not found
     */
    getAmazonRefreshToken(userId: number, userType?: string): Promise<string | null>;
    /**
     * Get full Amazon connection data for a user
     * @param userId - User ID
     * @param userType - User type: "inventoryusers" or "users" (default: "inventoryusers")
     * @returns Amazon connection record or null if not found
     */
    getAmazonConnection(userId: number, userType?: string): Promise<any>;
    /**
     * Delete Amazon connection for a user (disconnect)
     * @param userId - User ID
     * @param userType - User type: "inventoryusers" or "users" (default: "inventoryusers")
     * @returns true if deleted, false if not found
     */
    deleteAmazonConnection(userId: number, userType?: string): Promise<boolean>;
}
//# sourceMappingURL=users.service.d.ts.map