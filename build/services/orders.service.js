import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class OrdersService {
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic orders findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the new dynamic filtering system
            const { data: orders, total } = await dynamicFindManyWithFilters('orders', filters, {
                skip,
                take,
                useAllColumns: true // Get all available columns
            });
            logger.info({
                orderCount: orders.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: orders.length > 0 ? Object.keys(orders[0]) : []
            }, 'Dynamic orders findMany with filters completed');
            return createPaginationResult(orders, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in dynamic orders findMany operation');
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ orderId: id }, 'Starting dynamic orders findById operation');
            const order = await dynamicFindUnique('orders', { id: parseInt(id) });
            if (!order) {
                throw new Error('Order not found');
            }
            logger.debug({
                orderId: id,
                availableFields: Object.keys(order)
            }, 'Dynamic orders findById completed');
            return order;
        }
        catch (error) {
            logger.error({ error, orderId: id }, 'Error in orders findById operation');
            throw error;
        }
    }
    async findByOrderId(orderid) {
        try {
            logger.debug({ orderid }, 'Starting dynamic orders findByOrderId operation');
            const order = await dynamicFindUnique('orders', { orderid });
            if (!order) {
                throw new Error('Order not found');
            }
            logger.debug({
                orderid,
                availableFields: Object.keys(order)
            }, 'Dynamic orders findByOrderId completed');
            return order;
        }
        catch (error) {
            logger.error({ error, orderid }, 'Error in orders findByOrderId operation');
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ originalData: data }, 'Starting dynamic orders create operation');
            // Auto-set created and modified dates if not provided
            const currentTimestamp = Date.now();
            const createData = {
                ...data,
                createddate: data.createddate || currentTimestamp,
                modifieddate: data.modifieddate || currentTimestamp,
            };
            // Generate unique orderid if not provided
            if (!createData.orderid) {
                createData.orderid = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            }
            const order = await dynamicCreate('orders', createData);
            if (!order) {
                throw new Error('Failed to create order - no valid fields provided');
            }
            logger.info({
                orderId: order.id,
                orderid: order.orderid,
                availableFields: Object.keys(order)
            }, 'Dynamic orders create completed');
            return order;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in orders create operation');
            throw error;
        }
    }
    async update(id, data) {
        try {
            // Check if order exists
            await this.findById(id);
            logger.debug({ originalData: data, orderId: id }, 'Starting dynamic orders update operation');
            // Auto-set modified date
            const updateData = {
                ...data,
                modifieddate: data.modifieddate || Date.now(),
            };
            const order = await dynamicUpdate('orders', { id: parseInt(id) }, updateData);
            if (!order) {
                throw new Error('Failed to update order - no valid fields provided');
            }
            logger.info({
                orderId: id,
                availableFields: Object.keys(order)
            }, 'Dynamic orders update completed');
            return order;
        }
        catch (error) {
            logger.error({ error, data, orderId: id }, 'Error in orders update operation');
            throw error;
        }
    }
    async delete(id) {
        try {
            // Check if order exists
            await this.findById(id);
            logger.debug({ orderId: id }, 'Starting dynamic orders delete operation');
            const success = await dynamicDelete('orders', { id: parseInt(id) });
            if (!success) {
                throw new Error('Failed to delete order');
            }
            logger.info({ orderId: id }, 'Dynamic orders delete completed successfully');
        }
        catch (error) {
            logger.error({ error, orderId: id }, 'Error in orders delete operation');
            throw error;
        }
    }
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing order
                logger.debug({ orderId: id, data: updateData }, 'Upserting existing order');
                return this.update(id.toString(), updateData);
            }
            else {
                // Create new order
                logger.debug({ data: updateData }, 'Upserting new order');
                return this.create(updateData);
            }
        }
        catch (error) {
            logger.error({ error, data }, 'Error in orders upsert operation');
            throw error;
        }
    }
    async updateOrderStatus(id, status, additionalData) {
        try {
            logger.debug({ orderId: id, status, additionalData }, 'Starting orders status update operation');
            const updateData = {
                orderstatus: status,
                modifieddate: Date.now(),
                ...additionalData
            };
            // Set specific date fields based on status
            const currentTimestamp = Date.now();
            switch (status.toLowerCase()) {
                case 'delivered':
                    updateData.delivereddate = currentTimestamp;
                    break;
                case 'cancelled':
                    updateData.cancelleddate = currentTimestamp;
                    break;
                case 'returned':
                    updateData.returneddate = currentTimestamp;
                    break;
                case 'dispatched':
                    updateData.dispatcheddate = currentTimestamp;
                    break;
                case 'ready_to_dispatch':
                    updateData.readytodispatchdate = currentTimestamp;
                    break;
                case 'payment_failed':
                    updateData.paymentfaileddate = currentTimestamp;
                    updateData.ispaymentsucceed = false;
                    break;
                case 'payment_success':
                    updateData.ispaymentsucceed = true;
                    break;
            }
            const order = await this.update(id, updateData);
            logger.info({
                orderId: id,
                status,
                orderid: order.orderid
            }, 'Orders status update completed');
            return order;
        }
        catch (error) {
            logger.error({ error, orderId: id, status }, 'Error in orders status update operation');
            throw error;
        }
    }
}
//# sourceMappingURL=orders.service.js.map