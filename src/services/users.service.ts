import { 
  CreateUsersInput, 
  UpdateUsersInput, 
  UpsertUsersInput
} from '../schemas/users.schema.js';
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
import { hashPassword, verifyPassword, generateSessionToken, sanitizeUserData } from '../utils/auth.js';

export class UsersService {
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
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
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in dynamic users findMany operation');
      throw error;
    }
  }

  async findById(id: string) {
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
    } catch (error) {
      logger.error({ error, userId: id }, 'Error in users findById operation');
      throw error;
    }
  }

  async findByEmail(email: string) {
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
    } catch (error) {
      logger.error({ error, email }, 'Error in users findByEmail operation');
      throw error;
    }
  }

  async create(data: CreateUsersInput & Record<string, any>) {
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
    } catch (error) {
      logger.error({ error, data }, 'Error in users create operation');
      throw error;
    }
  }

  async update(id: string, data: UpdateUsersInput & Record<string, any>) {
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
    } catch (error) {
      logger.error({ error, data, userId: id }, 'Error in users update operation');
      throw error;
    }
  }

  async delete(id: string) {
    try {
      // Check if user exists
      await this.findById(id);

      logger.debug({ userId: id }, 'Starting dynamic users delete operation');

      const success = await dynamicDelete('users', { id: parseInt(id) });

      if (!success) {
        throw new Error('Failed to delete user');
      }

      logger.info({ userId: id }, 'Dynamic users delete completed successfully');
    } catch (error) {
      logger.error({ error, userId: id }, 'Error in users delete operation');
      throw error;
    }
  }

  /**
   * Authenticate user with email and password
   */
  async authenticate(email: string, password: string): Promise<{ user: any; token: string } | null> {
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
    } catch (error) {
      logger.error({ error, email }, 'Error during authentication');
      throw error;
    }
  }

  async upsert(data: UpsertUsersInput & Record<string, any>) {
    try {
      const { id, ...updateData } = data;

      if (id) {
        // Update existing user
        logger.debug({ userId: id, data: updateData }, 'Upserting existing user');
        return this.update(id.toString(), updateData);
      } else {
        // Create new user
        logger.debug({ data: updateData }, 'Upserting new user');
        return this.create(updateData);
      }
    } catch (error) {
      logger.error({ error, data }, 'Error in users upsert operation');
      throw error;
    }
  }
} 