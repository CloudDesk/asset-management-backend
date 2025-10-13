import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindManyWithFilters, dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
import { hashPassword, verifyPassword, generateSessionToken, sanitizeUserData } from '../utils/auth.js';
export class UsersService {
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic users findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the new dynamic filtering system
            const { data: users, total } = await dynamicFindManyWithFilters('users', filters, {
                skip,
                take,
                useAllColumns: true // Get all available columns
            });
            logger.info({
                userCount: users.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: users.length > 0 ? Object.keys(users[0]) : []
            }, 'Dynamic users findMany with filters completed');
            return createPaginationResult(users, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in dynamic users findMany operation');
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ userId: id }, 'Starting dynamic users findById operation');
            const user = await dynamicFindUnique('users', { id: parseInt(id) });
            if (!user) {
                throw new Error('User not found');
            }
            logger.debug({
                userId: id,
                availableFields: Object.keys(user)
            }, 'Dynamic users findById completed');
            return user;
        }
        catch (error) {
            logger.error({ error, userId: id }, 'Error in users findById operation');
            throw error;
        }
    }
    async findByEmail(email) {
        try {
            logger.debug({ email }, 'Starting dynamic users findByEmail operation');
            const users = await dynamicFindManyWithFilters('users', { useremail: email }, {
                skip: 0,
                take: 1,
                useAllColumns: true
            });
            const user = users.data?.[0] || null;
            logger.debug({
                email,
                found: !!user,
                availableFields: user ? Object.keys(user) : []
            }, 'Dynamic users findByEmail completed');
            return user;
        }
        catch (error) {
            logger.error({ error, email }, 'Error in users findByEmail operation');
            throw error;
        }
    }
    async findByMobileNumber(mobileNumber) {
        try {
            logger.debug({ mobileNumber }, 'Starting dynamic users findByMobileNumber operation');
            const users = await dynamicFindManyWithFilters('users', { usermobilenumber: mobileNumber }, {
                skip: 0,
                take: 1,
                useAllColumns: true
            });
            const user = users.data?.[0] || null;
            logger.debug({
                mobileNumber,
                found: !!user,
                availableFields: user ? Object.keys(user) : []
            }, 'Dynamic users findByMobileNumber completed');
            return user;
        }
        catch (error) {
            logger.error({ error, mobileNumber }, 'Error in users findByMobileNumber operation');
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ originalData: data }, 'Starting dynamic users create operation');
            // Hash password if provided
            let userData = { ...data };
            if (userData.userpassword) {
                userData.userpassword = await hashPassword(userData.userpassword);
            }
            // Add timestamps
            userData = {
                ...userData,
                createddate: Date.now(),
                modifieddate: Date.now()
            };
            const user = await dynamicCreate('users', userData);
            if (!user) {
                throw new Error('Failed to create user - no valid fields provided');
            }
            logger.info({
                userId: user.id,
                availableFields: Object.keys(user)
            }, 'Dynamic users create completed');
            return user;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in users create operation');
            throw error;
        }
    }
    async update(id, data) {
        try {
            // Check if user exists
            await this.findById(id);
            logger.debug({ originalData: data, userId: id }, 'Starting dynamic users update operation');
            // Hash password if provided
            let userData = { ...data };
            if (userData.userpassword) {
                userData.userpassword = await hashPassword(userData.userpassword);
            }
            // Add modified timestamp
            userData = {
                ...userData,
                modifieddate: Date.now()
            };
            const user = await dynamicUpdate('users', { id: parseInt(id) }, userData);
            if (!user) {
                throw new Error('Failed to update user - no valid fields provided');
            }
            logger.info({
                userId: id,
                availableFields: Object.keys(user)
            }, 'Dynamic users update completed');
            return user;
        }
        catch (error) {
            logger.error({ error, data, userId: id }, 'Error in users update operation');
            throw error;
        }
    }
    async delete(id) {
        try {
            // Check if user exists
            await this.findById(id);
            logger.debug({ userId: id }, 'Starting dynamic users delete operation');
            const success = await dynamicDelete('users', { id: parseInt(id) });
            if (!success) {
                throw new Error('Failed to delete user');
            }
            logger.info({ userId: id }, 'Dynamic users delete completed successfully');
        }
        catch (error) {
            logger.error({ error, userId: id }, 'Error in users delete operation');
            throw error;
        }
    }
    /**
     * Soft delete user (deactivate account)
     * @param userId - The user ID to deactivate
     * @param email - Optional email to update before deactivation
     */
    async deactivateAccount(userId, email) {
        try {
            logger.debug({ userId, email }, 'Starting user account deactivation');
            // Check if user exists
            const user = await dynamicFindUnique('users', { id: userId });
            if (!user) {
                throw new Error('User not found');
            }
            // Prepare update data
            const updateData = {
                isactive: false,
                modifieddate: Date.now()
            };
            // Update email if provided
            if (email) {
                updateData.useremail = email;
            }
            // Update user to deactivate
            const updatedUser = await dynamicUpdate('users', { id: userId }, updateData);
            logger.info({
                userId,
                emailUpdated: !!email,
                newEmail: email
            }, 'User account deactivated successfully');
            return updatedUser;
        }
        catch (error) {
            logger.error({ error, userId, email }, 'Error in user account deactivation');
            throw error;
        }
    }
    /**
     * Authenticate user with email and password
     */
    async authenticate(email, password) {
        try {
            logger.debug({ email }, 'Attempting to authenticate user');
            const user = await this.findByEmail(email);
            if (!user || !user.userpassword) {
                logger.warn({ email }, 'Authentication failed: User not found or no password set');
                return null;
            }
            const isPasswordValid = await verifyPassword(password, user.userpassword);
            if (!isPasswordValid) {
                logger.warn({ email, userId: user.id }, 'Authentication failed: Invalid password');
                return null;
            }
            // Generate session token (but don't store it in DB since users table doesn't have sessiontoken field)
            const sessionToken = generateSessionToken();
            logger.info({
                userId: user.id,
                email: user.useremail
            }, 'User authenticated successfully');
            return {
                user: sanitizeUserData(user),
                token: sessionToken
            };
        }
        catch (error) {
            logger.error({ error, email }, 'Error during authentication');
            throw error;
        }
    }
    /**
     * Authenticate user with mobile number and password
     */
    async authenticateByMobile(mobileNumber, password) {
        try {
            logger.debug({ mobileNumber }, 'Attempting to authenticate user by mobile number');
            const user = await this.findByMobileNumber(mobileNumber);
            if (!user || !user.userpassword) {
                logger.warn({ mobileNumber }, 'Authentication failed: User not found or no password set');
                return null;
            }
            const isPasswordValid = await verifyPassword(password, user.userpassword);
            if (!isPasswordValid) {
                logger.warn({ mobileNumber, userId: user.id }, 'Authentication failed: Invalid password');
                return null;
            }
            // Generate session token
            const sessionToken = generateSessionToken();
            logger.info({
                userId: user.id,
                mobileNumber: user.usermobilenumber
            }, 'User authenticated successfully via mobile number');
            return {
                user: sanitizeUserData(user),
                token: sessionToken
            };
        }
        catch (error) {
            logger.error({ error, mobileNumber }, 'Error during mobile authentication');
            throw error;
        }
    }
    /**
     * Generate OTP for mobile number (passwordless login step 1)
     * @param mobileNumber - The mobile number to generate OTP for
     * @param verifyOnly - If true, only generate OTP if user exists (for delete account flow)
     */
    async generateMobileOTP(mobileNumber, verifyOnly = false) {
        try {
            logger.debug({ mobileNumber, verifyOnly }, 'Generating OTP for mobile number');
            // Check if user exists
            let user = await this.findByMobileNumber(mobileNumber);
            let isNewUser = false;
            if (!user) {
                // If verifyOnly is true, don't create user - just return null (for delete account flow)
                if (verifyOnly) {
                    logger.warn({ mobileNumber }, 'User not found and verifyOnly is true - OTP not generated');
                    return null;
                }
                // User doesn't exist, create a new user automatically (for sign-in flow)
                logger.info({ mobileNumber }, 'Mobile number not found, creating new user automatically');
                try {
                    const newUserData = {
                        usermobilenumber: mobileNumber,
                        firstname: `User`, // Default first name
                        createddate: Date.now(),
                        modifieddate: Date.now()
                    };
                    user = await this.create(newUserData);
                    isNewUser = true;
                    logger.info({
                        userId: user.id,
                        mobileNumber: user.usermobilenumber
                    }, 'New user created successfully for mobile login');
                }
                catch (createError) {
                    logger.error({ error: createError, mobileNumber }, 'Failed to create new user for mobile number');
                    return null;
                }
            }
            // Use hardcoded OTP for development (no SMS gateway needed)
            const otp = 1234; // Hardcoded integer for development - easy testing
            const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
            // Store OTP in memory for verification
            this.storeOTP(mobileNumber, otp, expiresAt);
            logger.info({
                userId: user.id,
                mobileNumber: user.usermobilenumber,
                otp: otp, // Log OTP for development (remove in production)
                isNewUser: isNewUser
            }, `OTP generated successfully for mobile login ${isNewUser ? '(new user created)' : '(existing user)'}`);
            return { otp, expiresAt, isNewUser };
        }
        catch (error) {
            logger.error({ error, mobileNumber }, 'Error during OTP generation');
            throw error;
        }
    }
    /**
     * Verify OTP and authenticate user (passwordless login step 2)
     */
    async verifyMobileOTP(mobileNumber, otp) {
        try {
            logger.debug({ mobileNumber, otp }, 'Verifying OTP for mobile authentication');
            // Check if user exists
            const user = await this.findByMobileNumber(mobileNumber);
            if (!user) {
                logger.warn({ mobileNumber }, 'OTP verification failed: User not found');
                return null;
            }
            // Verify OTP
            const isOTPValid = this.verifyOTP(mobileNumber, otp);
            if (!isOTPValid) {
                logger.warn({ mobileNumber, userId: user.id }, 'OTP verification failed: Invalid or expired OTP');
                return null;
            }
            // Clear OTP after successful verification
            this.clearOTP(mobileNumber);
            // Generate session token
            const sessionToken = generateSessionToken();
            logger.info({
                userId: user.id,
                mobileNumber: user.usermobilenumber
            }, 'User authenticated successfully via mobile OTP');
            return {
                user: sanitizeUserData(user),
                token: sessionToken
            };
        }
        catch (error) {
            logger.error({ error, mobileNumber }, 'Error during OTP verification');
            throw error;
        }
    }
    // OTP storage (in-memory for testing - use Redis/DB in production)
    otpStorage = new Map();
    storeOTP(mobileNumber, otp, expiresAt) {
        this.otpStorage.set(mobileNumber, { otp, expiresAt });
        // Auto-cleanup expired OTP after expiry time
        setTimeout(() => {
            this.otpStorage.delete(mobileNumber);
        }, expiresAt.getTime() - Date.now());
    }
    verifyOTP(mobileNumber, otp) {
        const storedOTP = this.otpStorage.get(mobileNumber);
        if (!storedOTP) {
            return false;
        }
        // Check if OTP has expired
        if (new Date() > storedOTP.expiresAt) {
            this.otpStorage.delete(mobileNumber);
            return false;
        }
        // Verify OTP
        return storedOTP.otp === otp;
    }
    clearOTP(mobileNumber) {
        this.otpStorage.delete(mobileNumber);
    }
    /**
     * Get OTP for testing purposes (remove in production)
     */
    async getOTPForTesting(mobileNumber) {
        const storedOTP = this.otpStorage.get(mobileNumber);
        return storedOTP?.otp || null;
    }
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing user
                logger.debug({ userId: id, data: updateData }, 'Upserting existing user');
                return this.update(id.toString(), updateData);
            }
            else {
                // Create new user
                logger.debug({ data: updateData }, 'Upserting new user');
                return this.create(updateData);
            }
        }
        catch (error) {
            logger.error({ error, data }, 'Error in users upsert operation');
            throw error;
        }
    }
    /**
     * Create a guest user with minimal required fields
     * Guest users can checkout without creating an account
     */
    async createGuestUser(data) {
        try {
            logger.debug({ originalData: data }, 'Starting guest user creation');
            // Check if a user with this mobile number already exists
            const existingUser = await this.findByMobileNumber(data.usermobilenumber);
            if (existingUser) {
                // If user exists, check if they're already a guest
                if (existingUser.isguest) {
                    logger.info({
                        userId: existingUser.id,
                        mobileNumber: data.usermobilenumber
                    }, 'Returning existing guest user');
                    return existingUser;
                }
                else {
                    // User is already a registered user
                    throw new Error('This phone number is already registered. Please login instead.');
                }
            }
            // Create guest user with minimal fields
            const guestUserData = {
                firstname: data.firstname,
                useremail: data.useremail,
                usermobilenumber: data.usermobilenumber,
                isguest: true,
                createddate: Date.now(),
                modifieddate: Date.now()
            };
            const guestUser = await dynamicCreate('users', guestUserData);
            if (!guestUser) {
                throw new Error('Failed to create guest user');
            }
            logger.info({
                userId: guestUser.id,
                mobileNumber: guestUser.usermobilenumber,
                isGuest: guestUser.isguest
            }, 'Guest user created successfully');
            return guestUser;
        }
        catch (error) {
            logger.error({ error, data }, 'Error creating guest user');
            throw error;
        }
    }
    /**
     * Convert guest user to registered user
     * Called when a guest user registers/logs in with the same phone number
     */
    async convertGuestToRegistered(userId, registrationData) {
        try {
            logger.debug({ userId, registrationData }, 'Converting guest user to registered user');
            // Verify user exists and is a guest
            const user = await this.findById(userId.toString());
            if (!user) {
                throw new Error('User not found');
            }
            if (!user.isguest) {
                logger.warn({ userId }, 'User is already a registered user');
                return user;
            }
            // Update user to registered status with additional data if provided
            const updateData = {
                isguest: false,
                modifieddate: Date.now(),
                ...registrationData
            };
            // Hash password if provided
            if (updateData.userpassword) {
                updateData.userpassword = await hashPassword(updateData.userpassword);
            }
            const updatedUser = await dynamicUpdate('users', { id: userId }, updateData);
            logger.info({
                userId,
                mobileNumber: updatedUser.usermobilenumber
            }, 'Guest user converted to registered user successfully');
            return updatedUser;
        }
        catch (error) {
            logger.error({ error, userId }, 'Error converting guest user to registered');
            throw error;
        }
    }
    /**
     * Find all orders for a user (including when they were a guest) by mobile number
     * This is useful when showing order history after a guest user logs in
     */
    async findOrdersByMobileNumber(mobileNumber) {
        try {
            logger.debug({ mobileNumber }, 'Finding all orders for mobile number');
            // Find all users with this mobile number (there should only be one)
            const user = await this.findByMobileNumber(mobileNumber);
            if (!user) {
                return [];
            }
            // Return the user ID so orders can be fetched
            return { userId: user.id, isGuest: user.isguest };
        }
        catch (error) {
            logger.error({ error, mobileNumber }, 'Error finding orders by mobile number');
            throw error;
        }
    }
    /**
     * Merge guest user into authenticated user
     * When a user authenticates and has previous guest orders
     */
    async mergeGuestUser(guestUserId, authenticatedUserId) {
        try {
            logger.info({ guestUserId, authenticatedUserId }, 'Starting guest user merge');
            // This should be called by the orders service to transfer orders
            // Just update the guest user record to point to authenticated user
            // This is handled at the order level, not user level
            // Mark the guest user as merged (optional - could also delete)
            await dynamicUpdate('users', { id: guestUserId }, {
                isguest: false,
                modifieddate: Date.now()
            });
            logger.info({ guestUserId, authenticatedUserId }, 'Guest user merged successfully');
            return true;
        }
        catch (error) {
            logger.error({ error, guestUserId, authenticatedUserId }, 'Error merging guest user');
            throw error;
        }
    }
}
//# sourceMappingURL=users.service.js.map