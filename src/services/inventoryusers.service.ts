import { 
  CreateInventoryUsersInput, 
  UpdateInventoryUsersInput, 
  UpsertInventoryUsersInput
} from '../schemas/inventoryusers.schema.js';
import { PaginationResult, createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
import { 
  dynamicFindManyWithFilters,
  dynamicFindUnique, 
  dynamicCreate, 
  dynamicUpdate, 
  dynamicDelete
} from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
import { 
  hashPassword, 
  verifyPassword, 
  validatePassword, 
  generateSessionToken, 
  generateResetToken, 
  verifyResetToken,
  sanitizeUserData 
} from '../utils/auth.js';
import { EmailService } from './email.service.js';

export class InventoryUsersService {
  private emailService = new EmailService();

  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info({ filters, page, limit }, 'Starting dynamic inventoryusers findMany with filters');

      const { skip, take } = getPrismaSkipTake(page, limit);

      // Use the new dynamic filtering system
      const { data: inventoryUsers, total } = await dynamicFindManyWithFilters('inventoryusers', filters, {
        skip,
        take,
        useAllColumns: true // Get all available columns
      });

      logger.info({
        inventoryUserCount: inventoryUsers.length, 
        total,
        filtered: Object.keys(filters).length > 0,
        appliedFilters: Object.keys(filters),
        availableFields: inventoryUsers.length > 0 ? Object.keys(inventoryUsers[0]) : []
      }, 'Dynamic inventoryusers findMany with filters completed');

      return createPaginationResult(inventoryUsers, total, page, limit);
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in dynamic inventoryusers findMany operation');
      throw error;
    }
  }

  async findById(id: string) {
    try {
      logger.debug({ inventoryUserId: id }, 'Starting dynamic inventoryusers findById operation');

      const inventoryUser = await dynamicFindUnique('inventoryusers', { id: parseInt(id) });

      if (!inventoryUser) {
        throw new Error('Inventory user not found');
      }

      logger.debug({ 
        inventoryUserId: id, 
        availableFields: Object.keys(inventoryUser) 
      }, 'Dynamic inventoryusers findById completed');

      return inventoryUser;
    } catch (error) {
      logger.error({ error, inventoryUserId: id }, 'Error in inventoryusers findById operation');
      throw error;
    }
  }

  async findByEmail(email: string) {
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
    } catch (error) {
      logger.error({ error, email }, 'Error finding inventory user by email');
      throw error;
    }
  }

  async create(data: CreateInventoryUsersInput & Record<string, any>) {
    try {
      logger.debug({ originalData: { ...data, userpassword: '[REDACTED]' } }, 'Starting dynamic inventoryusers create operation');

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

      const inventoryUser = await dynamicCreate('inventoryusers', inventoryUserData);

      if (!inventoryUser) {
        throw new Error('Failed to create inventory user - no valid fields provided');
      }

      logger.info({ 
        inventoryUserId: inventoryUser.id, 
        email: inventoryUser.useremail,
        availableFields: Object.keys(inventoryUser) 
      }, 'Dynamic inventoryusers create completed');

      return sanitizeUserData(inventoryUser);
    } catch (error) {
      logger.error({ error, email: data.useremail }, 'Error in inventoryusers create operation');
      throw error;
    }
  }

  async update(id: string, data: UpdateInventoryUsersInput & Record<string, any>) {
    try {
      // Check if inventory user exists
      await this.findById(id);

      logger.debug({ originalData: { ...data, userpassword: data.userpassword ? '[REDACTED]' : undefined }, inventoryUserId: id }, 'Starting dynamic inventoryusers update operation');

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

      const inventoryUser = await dynamicUpdate('inventoryusers', { id: parseInt(id) }, inventoryUserData);

      if (!inventoryUser) {
        throw new Error('Failed to update inventory user - no valid fields provided');
      }

      logger.info({ 
        inventoryUserId: id, 
        email: inventoryUser.useremail,
        availableFields: Object.keys(inventoryUser) 
      }, 'Dynamic inventoryusers update completed');

      return sanitizeUserData(inventoryUser);
    } catch (error) {
      logger.error({ error, inventoryUserId: id }, 'Error in inventoryusers update operation');
      throw error;
    }
  }

  async delete(id: string) {
    try {
      // Check if inventory user exists
      await this.findById(id);

      logger.debug({ inventoryUserId: id }, 'Starting dynamic inventoryusers delete operation');

      const success = await dynamicDelete('inventoryusers', { id: parseInt(id) });

      if (!success) {
        throw new Error('Failed to delete inventory user');
      }

      logger.info({ inventoryUserId: id }, 'Dynamic inventoryusers delete completed successfully');
    } catch (error) {
      logger.error({ error, inventoryUserId: id }, 'Error in inventoryusers delete operation');
      throw error;
    }
  }

  async upsert(data: UpsertInventoryUsersInput & Record<string, any>) {
    try {
      const { id, ...updateData } = data;

      if (id) {
        // Update existing inventory user
        logger.debug({ inventoryUserId: id, data: { ...updateData, userpassword: updateData.userpassword ? '[REDACTED]' : undefined } }, 'Upserting existing inventory user');
        return this.update(id.toString(), updateData);
      } else {
        // Create new inventory user
        logger.debug({ data: { ...updateData, userpassword: updateData.userpassword ? '[REDACTED]' : undefined } }, 'Upserting new inventory user');
        return this.create(updateData);
      }
    } catch (error) {
      logger.error({ error }, 'Error in inventoryusers upsert operation');
      throw error;
    }
  }

  /**
   * Authenticate user with email and password
   */
  async authenticate(email: string, password: string): Promise<{ user: any; token: string } | null> {
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

      // Generate session token
      const sessionToken = generateSessionToken();

      // Update user with session token (in a real implementation, store this in a sessions table)
      await dynamicUpdate('inventoryusers', { id: user.id }, { 
        sessiontoken: sessionToken,
        modifieddate: BigInt(Date.now())
      });

      logger.info({ 
        userId: user.id, 
        email: user.useremail,
        role: user.role 
      }, 'User authenticated successfully');

      return {
        user: sanitizeUserData(user),
        token: sessionToken
      };
    } catch (error) {
      logger.error({ error, email }, 'Error during authentication');
      throw error;
    }
  }

  /**
   * Sign out user by invalidating session token
   */
  async signOut(userId: number): Promise<void> {
    try {
      logger.debug({ userId }, 'Signing out inventory user');

      await dynamicUpdate('inventoryusers', { id: userId }, { 
        sessiontoken: null,
        modifieddate: BigInt(Date.now())
      });

      logger.info({ userId }, 'User signed out successfully');
    } catch (error) {
      logger.error({ error, userId }, 'Error during sign out');
      throw error;
    }
  }

  /**
   * Initiate password reset process
   */
  async initiatePasswordReset(email: string): Promise<void> {
    try {
      logger.debug({ email }, 'Initiating password reset');

      const user = await this.findByEmail(email);
      if (!user) {
        // Don't reveal if email exists or not for security
        logger.warn({ email }, 'Password reset requested for non-existent email');
        return;
      }

      const { token, hashedToken, expiresAt } = generateResetToken();

      // Store reset token in database
      await dynamicUpdate('inventoryusers', { id: user.id }, {
        resettoken: hashedToken,
        resettokenexpires: BigInt(expiresAt.getTime()),
        modifieddate: BigInt(Date.now())
      });

      // Send reset email
      const userName = user.firstname || user.useremail?.split('@')[0] || 'User';
      await this.emailService.sendPasswordResetEmail(email, token, userName);

      logger.info({ 
        userId: user.id, 
        email 
      }, 'Password reset email sent successfully');
    } catch (error) {
      logger.error({ error, email }, 'Error initiating password reset');
      throw error;
    }
  }

  /**
   * Reset password using reset token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      logger.debug('Processing password reset');

      // Validate new password
      const passwordValidation = validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
      }

      // Find user with reset token
      const hashedToken = require('crypto').createHash('sha256').update(token).digest('hex');
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
        sessiontoken: null, // Invalidate any existing sessions
        modifieddate: BigInt(Date.now())
      });

      logger.info({ 
        userId: user.id, 
        email: user.useremail 
      }, 'Password reset completed successfully');
    } catch (error) {
      logger.error({ error }, 'Error resetting password');
      throw error;
    }
  }

  /**
   * Update user password (for authenticated users)
   */
  async updatePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
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
    } catch (error) {
      logger.error({ error, userId }, 'Error updating password');
      throw error;
    }
  }
} 