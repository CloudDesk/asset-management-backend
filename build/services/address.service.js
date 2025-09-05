import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class AddressService {
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic address findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the new dynamic filtering system
            const { data: addresses, total } = await dynamicFindManyWithFilters('address', filters, {
                skip,
                take,
                useAllColumns: true // Get all available columns
            });
            logger.info({
                addressCount: addresses.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: addresses.length > 0 ? Object.keys(addresses[0]) : []
            }, 'Dynamic address findMany with filters completed');
            return createPaginationResult(addresses, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in dynamic address findMany operation');
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ addressId: id }, 'Starting dynamic address findById operation');
            const address = await dynamicFindUnique('address', { id });
            if (!address) {
                throw new Error('Address not found');
            }
            logger.debug({
                addressId: id,
                availableFields: Object.keys(address)
            }, 'Dynamic address findById completed');
            return address;
        }
        catch (error) {
            logger.error({ error, addressId: id }, 'Error in address findById operation');
            throw error;
        }
    }
    async resetDefaultAddress(userId) {
        try {
            logger.debug({ userId }, 'Resetting default address for user');
            await dynamicUpdate('address', { userid: userId, isdefaultaddress: true }, { isdefaultaddress: false });
            logger.debug({ userId }, 'Default address reset completed');
        }
        catch (error) {
            logger.error({ error, userId }, 'Error resetting default address');
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ originalData: data }, 'Starting dynamic address create operation');
            // Auto-set created and modified dates if not provided
            const currentTimestamp = Date.now();
            const createData = {
                ...data,
                createddate: data.createddate || currentTimestamp,
                modifieddate: data.modifieddate || currentTimestamp,
            };
            // If this is set as default address, reset any existing default
            if (createData.userid && createData.isdefaultaddress) {
                await this.resetDefaultAddress(createData.userid);
            }
            const address = await dynamicCreate('address', createData);
            if (!address) {
                throw new Error('Failed to create address - no valid fields provided');
            }
            logger.info({
                addressId: address.id,
                availableFields: Object.keys(address)
            }, 'Dynamic address create completed');
            return address;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in address create operation');
            throw error;
        }
    }
    async update(id, data) {
        try {
            // Check if address exists
            const existingAddress = await this.findById(id);
            logger.debug({ originalData: data, addressId: id }, 'Starting dynamic address update operation');
            // Auto-set modified date
            const updateData = {
                ...data,
                modifieddate: data.modifieddate || Date.now(),
            };
            // If this is being set as default address, reset any existing default
            if (existingAddress.userid && updateData.isdefaultaddress) {
                await this.resetDefaultAddress(existingAddress.userid);
            }
            const address = await dynamicUpdate('address', { id }, updateData);
            if (!address) {
                throw new Error('Failed to update address - no valid fields provided');
            }
            logger.info({
                addressId: id,
                availableFields: Object.keys(address)
            }, 'Dynamic address update completed');
            return address;
        }
        catch (error) {
            logger.error({ error, data, addressId: id }, 'Error in address update operation');
            throw error;
        }
    }
    async delete(id) {
        try {
            // Check if address exists
            await this.findById(id);
            logger.debug({ addressId: id }, 'Starting dynamic address delete operation');
            const success = await dynamicDelete('address', { id });
            if (!success) {
                throw new Error('Failed to delete address');
            }
            logger.info({ addressId: id }, 'Dynamic address delete completed successfully');
        }
        catch (error) {
            logger.error({ error, addressId: id }, 'Error in address delete operation');
            throw error;
        }
    }
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing address
                logger.debug({ addressId: id, data: updateData }, 'Upserting existing address');
                return this.update(id, updateData);
            }
            else {
                // Create new address
                logger.debug({ data: updateData }, 'Upserting new address');
                return this.create(updateData);
            }
        }
        catch (error) {
            logger.error({ error, data }, 'Error in address upsert operation');
            throw error;
        }
    }
    async getDefaultAddress(userId) {
        try {
            logger.debug({ userId }, 'Getting default address for user');
            const { data: addresses } = await dynamicFindManyWithFilters('address', {
                userid: userId,
                isdefaultaddress: true
            }, {
                skip: 0,
                take: 1,
                useAllColumns: true
            });
            return addresses[0] || null;
        }
        catch (error) {
            logger.error({ error, userId }, 'Error getting default address');
            throw error;
        }
    }
}
//# sourceMappingURL=address.service.js.map