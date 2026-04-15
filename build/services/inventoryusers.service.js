import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindManyWithFilters, dynamicUpdate, dynamicDelete } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
import { hashPassword, verifyPassword, validatePassword, 
// generateSessionToken - removed, not used (session management in auth_sessions table)
generateResetToken, verifyResetToken, sanitizeUserData } from '../utils/auth.js';
import { EmailService } from './email.service.js';
import { prisma } from '../models/prisma.js';
import crypto from 'crypto';
export class InventoryUsersService {
    emailService = new EmailService();
    async sendPasswordSetLink(user) {
        if (!user.useremail) {
            logger.warn({ userId: user.id }, 'Skipping password set email because useremail is missing');
            return;
        }
        const { token, hashedToken, expiresAt } = generateResetToken();
        await dynamicUpdate('inventoryusers', { id: user.id }, {
            resettoken: hashedToken,
            resettokenexpires: BigInt(expiresAt.getTime()),
            modifieddate: BigInt(Date.now())
        });
        const userName = user.firstname || user.useremail.split('@')[0] || 'User';
        await this.emailService.sendPasswordResetEmail(user.useremail, token, userName);
        logger.info({
            userId: user.id,
            email: user.useremail
        }, 'Password set email sent successfully');
    }
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic inventoryusers findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Build where clause for Prisma
            const where = {};
            // Apply filters
            if (filters.useremail)
                where.useremail = filters.useremail;
            if (filters.role)
                where.role = filters.role; // Legacy field
            if (filters.roleid)
                where.roleid = parseInt(filters.roleid);
            if (filters.firstname)
                where.firstname = filters.firstname;
            if (filters.lastname)
                where.lastname = filters.lastname;
            if (filters.location)
                where.location = filters.location;
            if (filters.usersphonenumber)
                where.usersphonenumber = BigInt(filters.usersphonenumber);
            // Date filters
            if (filters.createdAfter) {
                where.createddate = { ...where.createddate, gte: BigInt(filters.createdAfter) };
            }
            if (filters.createdBefore) {
                where.createddate = { ...where.createddate, lte: BigInt(filters.createdBefore) };
            }
            // Use Prisma to include role relation
            const [inventoryUsers, total] = await Promise.all([
                prisma.inventoryusers.findMany({
                    where,
                    skip,
                    take,
                    include: {
                        rolerelation: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                level: true,
                                description: true,
                                isactive: true
                            }
                        }
                    },
                    orderBy: { id: 'desc' }
                }),
                prisma.inventoryusers.count({ where })
            ]);
            // Ensure roleRelation is null for users with null roleid
            inventoryUsers.forEach((user) => {
                if (user.roleid === null) {
                    user.rolerelation = null;
                }
            });
            logger.info({
                inventoryUserCount: inventoryUsers.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters)
            }, 'Dynamic inventoryusers findMany with filters completed');
            return createPaginationResult(inventoryUsers, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in dynamic inventoryusers findMany operation');
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ inventoryUserId: id }, 'Starting dynamic inventoryusers findById operation');
            // Use Prisma to include role relation (only if roleid is not null)
            const inventoryUser = await prisma.inventoryusers.findUnique({
                where: { id: parseInt(id) },
                include: {
                    rolerelation: {
                        select: {
                            id: true,
                            name: true,
                            code: true,
                            level: true,
                            description: true,
                            isactive: true
                        }
                    }
                }
            });
            // Ensure roleRelation is null if roleid is null
            if (inventoryUser && inventoryUser.roleid === null) {
                inventoryUser.rolerelation = null;
            }
            if (!inventoryUser) {
                throw new Error('Inventory user not found');
            }
            logger.debug({
                inventoryUserId: id,
                availableFields: Object.keys(inventoryUser),
                hasRole: !!inventoryUser.rolerelation
            }, 'Dynamic inventoryusers findById completed');
            return inventoryUser;
        }
        catch (error) {
            logger.error({ error, inventoryUserId: id }, 'Error in inventoryusers findById operation');
            throw error;
        }
    }
    async findByEmail(email) {
        try {
            logger.debug({ email }, 'Finding inventory user by email');
            const users = await dynamicFindManyWithFilters('inventoryusers', { useremail: email }, {
                skip: 0,
                take: 1,
                useAllColumns: true
            });
            if (!users.data || users.data.length === 0) {
                return null;
            }
            return users.data[0];
        }
        catch (error) {
            logger.error({ error, email }, 'Error finding inventory user by email');
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ originalData: { ...data, userpassword: '[REDACTED]' } }, 'Starting dynamic inventoryusers create operation');
            // Validate roleid if provided
            if (data.roleid !== null && data.roleid !== undefined) {
                const role = await prisma.role.findUnique({
                    where: { id: data.roleid }
                });
                if (!role) {
                    throw new Error(`Role with ID ${data.roleid} not found`);
                }
                logger.debug({ roleid: data.roleid, roleName: role.name }, 'Role validated for inventory user creation');
            }
            // Validate and hash password if provided
            if (data.userpassword) {
                const passwordValidation = validatePassword(data.userpassword);
                if (!passwordValidation.isValid) {
                    throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
                }
                // Hash the password
                data.userpassword = await hashPassword(data.userpassword);
            }
            // Check if email already exists
            if (data.useremail) {
                const existingUser = await this.findByEmail(data.useremail);
                if (existingUser) {
                    throw new Error('Email already exists');
                }
            }
            // Add timestamps
            const inventoryUserData = {
                ...data,
                createddate: BigInt(Date.now()),
                modifieddate: BigInt(Date.now())
            };
            // Use Prisma to create with role relation (only if roleid is not null)
            const includeRole = inventoryUserData.roleid !== null && inventoryUserData.roleid !== undefined;
            const inventoryUser = await prisma.inventoryusers.create({
                data: inventoryUserData,
                ...(includeRole ? {
                    include: {
                        rolerelation: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                level: true,
                                description: true,
                                isactive: true
                            }
                        }
                    }
                } : {})
            });
            // Ensure roleRelation is null if roleid is null
            if (!includeRole) {
                inventoryUser.rolerelation = null;
            }
            if (!inventoryUser) {
                throw new Error('Failed to create inventory user - no valid fields provided');
            }
            try {
                await this.sendPasswordSetLink(inventoryUser);
            }
            catch (emailError) {
                logger.error({
                    error: emailError,
                    userId: inventoryUser.id,
                    email: inventoryUser.useremail
                }, 'Failed to send password set email for newly created inventory user');
            }
            logger.info({
                inventoryUserId: inventoryUser.id,
                email: inventoryUser.useremail,
                roleid: inventoryUser.roleid,
                hasRole: !!inventoryUser.rolerelation
            }, 'Dynamic inventoryusers create completed');
            return sanitizeUserData(inventoryUser);
        }
        catch (error) {
            logger.error({ error, email: data.useremail }, 'Error in inventoryusers create operation');
            throw error;
        }
    }
    async update(id, data) {
        try {
            // Check if inventory user exists
            await this.findById(id);
            logger.debug({ originalData: { ...data, userpassword: data.userpassword ? '[REDACTED]' : undefined }, inventoryUserId: id }, 'Starting dynamic inventoryusers update operation');
            // Validate roleid if provided
            if (data.roleid !== null && data.roleid !== undefined) {
                const role = await prisma.role.findUnique({
                    where: { id: data.roleid }
                });
                if (!role) {
                    throw new Error(`Role with ID ${data.roleid} not found`);
                }
                logger.debug({ roleid: data.roleid, roleName: role.name }, 'Role validated for inventory user update');
            }
            // Validate and hash password if provided
            if (data.userpassword) {
                const passwordValidation = validatePassword(data.userpassword);
                if (!passwordValidation.isValid) {
                    throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
                }
                // Hash the password
                data.userpassword = await hashPassword(data.userpassword);
            }
            // Check if email already exists (if changing email)
            if (data.useremail) {
                const existingUser = await this.findByEmail(data.useremail);
                if (existingUser && existingUser.id !== parseInt(id)) {
                    throw new Error('Email already exists');
                }
            }
            // Add modified timestamp
            const inventoryUserData = {
                ...data,
                modifieddate: BigInt(Date.now())
            };
            // Use Prisma to update with role relation (only if roleid is not null)
            const finalRoleId = inventoryUserData.roleid !== undefined ? inventoryUserData.roleid : (await prisma.inventoryusers.findUnique({ where: { id: parseInt(id) }, select: { roleid: true } }))?.roleid;
            const includeRole = finalRoleId !== null && finalRoleId !== undefined;
            const inventoryUser = await prisma.inventoryusers.update({
                where: { id: parseInt(id) },
                data: inventoryUserData,
                ...(includeRole ? {
                    include: {
                        rolerelation: {
                            select: {
                                id: true,
                                name: true,
                                code: true,
                                level: true,
                                description: true,
                                isactive: true
                            }
                        }
                    }
                } : {})
            });
            // Ensure roleRelation is null if roleid is null
            if (!includeRole) {
                inventoryUser.rolerelation = null;
            }
            if (!inventoryUser) {
                throw new Error('Failed to update inventory user - no valid fields provided');
            }
            logger.info({
                inventoryUserId: id,
                email: inventoryUser.useremail,
                roleid: inventoryUser.roleid,
                hasRole: !!inventoryUser.rolerelation
            }, 'Dynamic inventoryusers update completed');
            return sanitizeUserData(inventoryUser);
        }
        catch (error) {
            logger.error({ error, inventoryUserId: id }, 'Error in inventoryusers update operation');
            throw error;
        }
    }
    async delete(id) {
        try {
            // Check if inventory user exists
            await this.findById(id);
            logger.debug({ inventoryUserId: id }, 'Starting dynamic inventoryusers delete operation');
            const success = await dynamicDelete('inventoryusers', { id: parseInt(id) });
            if (!success) {
                throw new Error('Failed to delete inventory user');
            }
            logger.info({ inventoryUserId: id }, 'Dynamic inventoryusers delete completed successfully');
        }
        catch (error) {
            logger.error({ error, inventoryUserId: id }, 'Error in inventoryusers delete operation');
            throw error;
        }
    }
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing inventory user
                logger.debug({ inventoryUserId: id, data: { ...updateData, userpassword: updateData.userpassword ? '[REDACTED]' : undefined } }, 'Upserting existing inventory user');
                return this.update(id.toString(), updateData);
            }
            else {
                // Create new inventory user
                logger.debug({ data: { ...updateData, userpassword: updateData.userpassword ? '[REDACTED]' : undefined } }, 'Upserting new inventory user');
                return this.create(updateData);
            }
        }
        catch (error) {
            logger.error({ error }, 'Error in inventoryusers upsert operation');
            throw error;
        }
    }
    /**
     * Authenticate user with email and password
     */
    async authenticate(email, password) {
        try {
            logger.debug({ email }, 'Attempting to authenticate inventory user');
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
            // Generate JWT tokens (access + refresh)
            const { generateTokenPair } = await import('../utils/jwt.js');
            const tokenPair = generateTokenPair({
                userId: user.id,
                email: user.useremail || '',
                roleId: user.roleid || undefined,
                userType: 'inventory',
            });
            // NOTE: Session management is handled by auth_sessions table
            // Sessions are created in the auth route after successful authentication
            logger.info({
                userId: user.id,
                email: user.useremail,
                role: user.role,
                roleid: user.roleid
            }, 'User authenticated successfully');
            // Get role and permissions for the user
            let roleData = null;
            let permissionsData = {};
            if (user.roleid) {
                try {
                    // Get role details
                    const role = await prisma.role.findUnique({
                        where: { id: user.roleid },
                        select: {
                            id: true,
                            name: true,
                            code: true,
                            level: true,
                            description: true,
                            isactive: true
                        }
                    });
                    if (role) {
                        roleData = {
                            id: role.id,
                            name: role.name,
                            code: role.code,
                            level: role.level || 0
                        };
                        // Get permissions for this user
                        const { getUserPermissions } = await import('../utils/permissionChecker.js');
                        const permissionsResult = await getUserPermissions(user.id);
                        permissionsData = permissionsResult.permissions || {};
                    }
                }
                catch (error) {
                    logger.warn({ error, roleid: user.roleid }, 'Error fetching role/permissions during authentication');
                }
            }
            return {
                user: sanitizeUserData(user),
                roles: roleData,
                permissions: permissionsData,
                token: tokenPair.accessToken, // JWT access token
                refreshToken: tokenPair.refreshToken, // JWT refresh token
                expiresIn: tokenPair.expiresIn, // Token expiry in seconds
            }; // Type assertion to allow roles and permissions in response
        }
        catch (error) {
            logger.error({ error, email }, 'Error during authentication');
            throw error;
        }
    }
    /**
     * Sign out user
     * NOTE: Session revocation is handled by authSessionService.revokeAllUserSessions()
     * This method only updates modifieddate for audit purposes
     */
    async signOut(userId) {
        try {
            logger.debug({ userId }, 'Signing out inventory user');
            // Session revocation is handled by authSessionService.revokeAllUserSessions()
            // Only update modifieddate for audit purposes
            await dynamicUpdate('inventoryusers', { id: userId }, {
                modifieddate: BigInt(Date.now())
            });
            logger.info({ userId }, 'User signed out successfully');
        }
        catch (error) {
            logger.error({ error, userId }, 'Error during sign out');
            throw error;
        }
    }
    /**
     * Initiate password reset process
     */
    async initiatePasswordReset(email) {
        try {
            logger.debug({ email }, 'Initiating password reset');
            const user = await this.findByEmail(email);
            if (!user) {
                // Don't reveal if email exists or not for security
                logger.warn({ email }, 'Password reset requested for non-existent email');
                return;
            }
            await this.sendPasswordSetLink(user);
            logger.info({
                userId: user.id,
                email
            }, 'Password reset email sent successfully');
        }
        catch (error) {
            logger.error({ error, email }, 'Error initiating password reset');
            throw error;
        }
    }
    /**
     * Reset password using reset token
     */
    async resetPassword(token, newPassword) {
        try {
            logger.debug('Processing password reset');
            // Validate new password
            const passwordValidation = validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
            }
            // Find user with reset token
            const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
            const users = await dynamicFindManyWithFilters('inventoryusers', { resettoken: hashedToken }, {
                skip: 0,
                take: 1,
                useAllColumns: true
            });
            if (!users.data || users.data.length === 0) {
                throw new Error('Invalid or expired reset token');
            }
            const user = users.data[0];
            // Verify token hasn't expired
            const expiresAt = new Date(Number(user.resettokenexpires));
            if (!verifyResetToken(token, hashedToken, expiresAt)) {
                throw new Error('Invalid or expired reset token');
            }
            // Hash new password
            const hashedPassword = await hashPassword(newPassword);
            // Update password and clear reset token
            await dynamicUpdate('inventoryusers', { id: user.id }, {
                userpassword: hashedPassword,
                resettoken: null,
                resettokenexpires: null,
                modifieddate: BigInt(Date.now())
            });
            logger.info({
                userId: user.id,
                email: user.useremail
            }, 'Password reset completed successfully');
        }
        catch (error) {
            logger.error({ error }, 'Error resetting password');
            throw error;
        }
    }
    /**
     * Update user password (for authenticated users)
     */
    async updatePassword(userId, currentPassword, newPassword) {
        try {
            logger.debug({ userId }, 'Updating user password');
            const user = await this.findById(userId.toString());
            if (!user || !user.userpassword) {
                throw new Error('User not found or no password set');
            }
            // Verify current password
            const isCurrentPasswordValid = await verifyPassword(currentPassword, user.userpassword);
            if (!isCurrentPasswordValid) {
                throw new Error('Current password is incorrect');
            }
            // Validate new password
            const passwordValidation = validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
            }
            // Hash new password
            const hashedPassword = await hashPassword(newPassword);
            // Update password
            await dynamicUpdate('inventoryusers', { id: userId }, {
                userpassword: hashedPassword,
                modifieddate: BigInt(Date.now())
            });
            logger.info({
                userId,
                email: user.useremail
            }, 'Password updated successfully');
        }
        catch (error) {
            logger.error({ error, userId }, 'Error updating password');
            throw error;
        }
    }
}
//# sourceMappingURL=inventoryusers.service.js.map