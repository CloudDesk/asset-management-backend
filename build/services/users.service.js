import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindManyWithFilters, dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
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
    async create(data) {
        try {
            logger.debug({ originalData: data }, 'Starting dynamic users create operation');
            // Add timestamps
            const userData = {
                ...data,
                createddate: BigInt(Date.now()),
                modifieddate: BigInt(Date.now())
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
            // Add modified timestamp
            const userData = {
                ...data,
                modifieddate: BigInt(Date.now())
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
}
//# sourceMappingURL=users.service.js.map