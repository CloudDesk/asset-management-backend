import { CreateUsersInput, UpdateUsersInput, UpsertUsersInput } from '../schemas/users.schema.js';
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
     */
    generateMobileOTP(mobileNumber: number): Promise<{
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
}
//# sourceMappingURL=users.service.d.ts.map