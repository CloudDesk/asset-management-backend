import { prisma } from "../models/prisma.js";
import { createPaginationResult, getPrismaSkipTake, } from "../utils/pagination.js";
import { dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters, } from "../utils/dynamicDbOperations.js";
import { logger } from "../config/logger.js";
export class OrderlineService {
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, "Starting dynamic orderline findMany with filters");
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the new dynamic filtering system
            const { data: orderlines, total } = await dynamicFindManyWithFilters("orderline", filters, {
                skip,
                take,
                useAllColumns: true, // Get all available columns
            });
            logger.info({
                orderlineCount: orderlines.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: orderlines.length > 0 ? Object.keys(orderlines[0]) : [],
            }, "Dynamic orderline findMany with filters completed");
            return createPaginationResult(orderlines, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, "Error in dynamic orderline findMany operation");
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ orderlineId: id }, "Starting dynamic orderline findById operation");
            const orderline = await dynamicFindUnique("orderline", {
                id: parseInt(id),
            });
            if (!orderline) {
                throw new Error("Orderline not found");
            }
            logger.debug({
                orderlineId: id,
                availableFields: Object.keys(orderline),
            }, "Dynamic orderline findById completed");
            return orderline;
        }
        catch (error) {
            logger.error({ error, orderlineId: id }, "Error in orderline findById operation");
            throw error;
        }
    }
    async findByOrderlineNumber(orderlinenumber) {
        try {
            logger.debug({ orderlinenumber }, "Starting dynamic orderline findByOrderlineNumber operation");
            const orderline = await dynamicFindUnique("orderline", {
                orderlinenumber,
            });
            if (!orderline) {
                throw new Error("Orderline not found");
            }
            logger.debug({
                orderlinenumber,
                availableFields: Object.keys(orderline),
            }, "Dynamic orderline findByOrderlineNumber completed");
            return orderline;
        }
        catch (error) {
            logger.error({ error, orderlinenumber }, "Error in orderline findByOrderlineNumber operation");
            throw error;
        }
    }
    async findByOrderId(orderid) {
        try {
            logger.debug({ orderid }, "Starting dynamic orderline findByOrderId operation");
            const { data: orderlines, total } = await dynamicFindManyWithFilters("orderline", { orderid }, {
                useAllColumns: true,
            });
            logger.debug({
                orderid,
                orderlineCount: orderlines.length,
                availableFields: orderlines.length > 0 ? Object.keys(orderlines[0]) : [],
            }, "Dynamic orderline findByOrderId completed");
            return orderlines;
        }
        catch (error) {
            logger.error({ error, orderid }, "Error in orderline findByOrderId operation");
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ originalData: data }, "Starting dynamic orderline create operation");
            // Auto-set created and modified dates if not provided
            const currentTimestamp = Date.now();
            const createData = {
                ...data,
                createddate: data.createddate || currentTimestamp,
                modifieddate: data.modifieddate || currentTimestamp,
                ordereddate: data.ordereddate || currentTimestamp,
            };
            // Generate unique orderlinenumber if not provided
            if (!createData.orderlinenumber) {
                createData.orderlinenumber = `OL-${Date.now()}-${Math.random()
                    .toString(36)
                    .substr(2, 9)}`;
            }
            // Generate unique order id if not provided
            if (!createData.uniqueordderid) {
                createData.uniqueordderid = `UOD-${Date.now()}-${Math.random()
                    .toString(36)
                    .substr(2, 9)}`;
            }
            const orderline = await dynamicCreate("orderline", createData);
            if (!orderline) {
                throw new Error("Failed to create orderline - no valid fields provided");
            }
            logger.info({
                orderlineId: orderline.id,
                orderlinenumber: orderline.orderlinenumber,
                availableFields: Object.keys(orderline),
            }, "Dynamic orderline create completed");
            return orderline;
        }
        catch (error) {
            logger.error({ error, data }, "Error in orderline create operation");
            throw error;
        }
    }
    async update(id, data) {
        try {
            // Check if orderline exists
            await this.findById(id);
            logger.debug({ originalData: data, orderlineId: id }, "Starting dynamic orderline update operation");
            // Auto-set modified date
            const updateData = {
                ...data,
                modifieddate: data.modifieddate || Date.now(),
            };
            const orderline = await dynamicUpdate("orderline", { id: parseInt(id) }, updateData);
            if (!orderline) {
                throw new Error("Failed to update orderline - no valid fields provided");
            }
            logger.info({
                orderlineId: id,
                availableFields: Object.keys(orderline),
            }, "Dynamic orderline update completed");
            return orderline;
        }
        catch (error) {
            logger.error({ error, data, orderlineId: id }, "Error in orderline update operation");
            throw error;
        }
    }
    async delete(id) {
        try {
            // Check if orderline exists
            await this.findById(id);
            logger.debug({ orderlineId: id }, "Starting dynamic orderline delete operation");
            const success = await dynamicDelete("orderline", { id: parseInt(id) });
            if (!success) {
                throw new Error("Failed to delete orderline");
            }
            logger.info({ orderlineId: id }, "Dynamic orderline delete completed successfully");
        }
        catch (error) {
            logger.error({ error, orderlineId: id }, "Error in orderline delete operation");
            throw error;
        }
    }
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing orderline
                logger.debug({ orderlineId: id, data: updateData }, "Upserting existing orderline");
                return this.update(id.toString(), updateData);
            }
            else {
                // Create new orderline
                logger.debug({ data: updateData }, "Upserting new orderline");
                return this.create(updateData);
            }
        }
        catch (error) {
            logger.error({ error, data }, "Error in orderline upsert operation");
            throw error;
        }
    }
    async updateOrderlineStatus(id, status, additionalData) {
        try {
            logger.debug({ orderlineId: id, status, additionalData }, "Starting orderline status update operation");
            const updateData = {
                orderstatus: status,
                modifieddate: Date.now(),
                ...additionalData,
            };
            // Set specific date fields based on status
            const currentTimestamp = Date.now();
            switch (status.toLowerCase()) {
                case "delivered":
                    updateData.delivereddate = currentTimestamp;
                    break;
                case "cancelled":
                    updateData.cancelleddate = currentTimestamp;
                    break;
                case "returned":
                    updateData.returneddate = currentTimestamp;
                    break;
                case "dispatched":
                    updateData.dispatcheddate = currentTimestamp;
                    break;
                case "ready_to_dispatch":
                    updateData.readytodispatchdate = currentTimestamp;
                    break;
                case "payment_failed":
                    updateData.paymentfaileddate = currentTimestamp;
                    break;
            }
            const orderline = await this.update(id, updateData);
            logger.info({
                orderlineId: id,
                status,
                orderlinenumber: orderline.orderlinenumber,
            }, "Orderline status update completed");
            return orderline;
        }
        catch (error) {
            logger.error({ error, orderlineId: id, status }, "Error in orderline status update operation");
            throw error;
        }
    }
    async bulkUpdateStatus(orderlineIds, status, additionalData) {
        try {
            logger.debug({ orderlineIds, status, additionalData }, "Starting bulk orderline status update operation");
            const results = [];
            for (const id of orderlineIds) {
                try {
                    const result = await this.updateOrderlineStatus(id, status, additionalData);
                    results.push({ success: true, id, data: result });
                }
                catch (error) {
                    logger.error({ error, orderlineId: id }, "Error updating individual orderline status");
                    results.push({ success: false, id, error: error.message });
                }
            }
            logger.info({
                totalUpdates: orderlineIds.length,
                successful: results.filter((r) => r.success).length,
                failed: results.filter((r) => !r.success).length,
            }, "Bulk orderline status update completed");
            return results;
        }
        catch (error) {
            logger.error({ error, orderlineIds, status }, "Error in bulk orderline status update operation");
            throw error;
        }
    }
    async cancelOrderline(id, reason) {
        try {
            logger.info({ orderlineId: id, reason }, "Starting orderline cancellation process");
            // Get the orderline with current status
            const orderline = await this.findById(id);
            if (!orderline) {
                throw new Error("Orderline not found");
            }
            // Check if orderline is already cancelled
            if (orderline.orderstatus === "cancelled") {
                logger.warn({ orderlineId: id }, "Orderline is already cancelled");
                return {
                    success: true,
                    message: "Orderline is already cancelled",
                    orderline,
                    productUpdates: [],
                    orderStatusUpdated: false,
                    cancellationDetails: {
                        orderlineId: id,
                        productId: orderline.productid,
                        orderId: orderline.orderid,
                        restoredQuantity: 0,
                        reason,
                    },
                };
            }
            // Store original quantities for product restoration
            const originalQuantity = orderline.quantity || 1;
            const productId = orderline.productid;
            const orderId = orderline.orderid;
            logger.debug({
                orderlineId: id,
                productId,
                orderId,
                originalQuantity,
                currentStatus: orderline.orderstatus,
            }, "Orderline details for cancellation");
            // Step 1: Update orderline status to cancelled
            const updateData = {
                orderstatus: "cancelled",
                cancelleddate: Date.now(),
                modifieddate: Date.now(),
            };
            if (reason) {
                updateData.cancellation_reason = reason;
            }
            const updatedOrderline = await this.update(id, updateData);
            logger.info({
                orderlineId: id,
                newStatus: "cancelled",
                orderlinenumber: updatedOrderline.orderlinenumber,
            }, "Orderline status updated to cancelled");
            // Step 2: Restore product quantities
            const productUpdates = await this.restoreProductQuantities(productId, originalQuantity);
            // Step 3: Check if all orderlines in the order are cancelled
            const orderStatusUpdated = await this.checkAndUpdateOrderStatus(orderId);
            const result = {
                success: true,
                message: "Orderline cancelled successfully",
                orderline: updatedOrderline,
                productUpdates,
                orderStatusUpdated,
                cancellationDetails: {
                    orderlineId: id,
                    productId,
                    orderId,
                    restoredQuantity: originalQuantity,
                    reason,
                },
            };
            logger.info({
                orderlineId: id,
                productUpdates: productUpdates.length,
                orderStatusUpdated,
                result,
            }, "Orderline cancellation completed successfully");
            return result;
        }
        catch (error) {
            logger.error({ error, orderlineId: id }, "Error in orderline cancellation process");
            throw error;
        }
    }
    async restoreProductQuantities(productId, quantity) {
        try {
            logger.debug({ productId, quantity }, "Starting product quantity restoration");
            // Get current product data
            const product = await prisma.product.findUnique({
                where: { id: BigInt(productId) },
                select: {
                    id: true,
                    name: true,
                    orderedquantity: true,
                    availablequantity: true,
                    productstatus: true,
                },
            });
            if (!product) {
                logger.warn({ productId }, "Product not found for quantity restoration");
                return [
                    {
                        productId,
                        success: false,
                        error: "Product not found",
                    },
                ];
            }
            // Calculate new quantities
            const currentOrderedQuantity = product.orderedquantity || 0;
            const currentAvailableQuantity = product.availablequantity || 0;
            const newOrderedQuantity = Math.max(0, currentOrderedQuantity - quantity);
            const newAvailableQuantity = currentAvailableQuantity + quantity;
            logger.debug({
                productId,
                productName: product.name,
                currentOrderedQuantity,
                currentAvailableQuantity,
                quantity,
                newOrderedQuantity,
                newAvailableQuantity,
            }, "Product quantity calculations for restoration");
            // Determine new product status based on available quantity
            let newProductStatus;
            if (newAvailableQuantity <= 0) {
                newProductStatus = "out_of_stock";
            }
            else if (newAvailableQuantity >= 1 && newAvailableQuantity <= 5) {
                newProductStatus = "low_stock";
            }
            else {
                newProductStatus = "in_stock";
            }
            // Update product quantities and status
            const updatedProduct = await prisma.product.update({
                where: { id: BigInt(productId) },
                data: {
                    orderedquantity: newOrderedQuantity,
                    availablequantity: newAvailableQuantity,
                    productstatus: newProductStatus,
                    modifieddate: BigInt(Date.now()),
                },
            });
            logger.info({
                productId,
                productName: product.name,
                quantityRestored: quantity,
                oldOrderedQuantity: currentOrderedQuantity,
                newOrderedQuantity,
                oldAvailableQuantity: currentAvailableQuantity,
                newAvailableQuantity,
                newProductStatus,
            }, "Product quantities restored successfully");
            return [
                {
                    productId,
                    success: true,
                    productName: product.name,
                    quantityRestored: quantity,
                    oldQuantities: {
                        ordered: currentOrderedQuantity,
                        available: currentAvailableQuantity,
                        status: product.productstatus,
                    },
                    newQuantities: {
                        ordered: newOrderedQuantity,
                        available: newAvailableQuantity,
                        status: newProductStatus,
                    },
                },
            ];
        }
        catch (error) {
            logger.error({ error, productId, quantity }, "Error restoring product quantities");
            return [
                {
                    productId,
                    success: false,
                    error: error.message,
                },
            ];
        }
    }
    async checkAndUpdateOrderStatus(orderId) {
        try {
            logger.debug({ orderId }, "Checking if all orderlines are cancelled to update order status");
            // Get all orderlines for this order
            const orderlines = await this.findByOrderId(orderId);
            if (orderlines.length === 0) {
                logger.warn({ orderId }, "No orderlines found for order");
                return false;
            }
            // Check if all orderlines are cancelled
            const allCancelled = orderlines.every((orderline) => orderline.orderstatus === "cancelled");
            logger.debug({
                orderId,
                totalOrderlines: orderlines.length,
                cancelledOrderlines: orderlines.filter((ol) => ol.orderstatus === "cancelled").length,
                allCancelled,
            }, "Orderline status analysis");
            if (allCancelled) {
                // Update order status to cancelled
                const orderUpdateData = {
                    orderstatus: "cancelled",
                    cancelleddate: Date.now(),
                    modifieddate: Date.now(),
                };
                const updatedOrder = await dynamicUpdate("orders", { id: orderId }, orderUpdateData);
                if (updatedOrder) {
                    logger.info({
                        orderId,
                        newStatus: "cancelled",
                        orderid: updatedOrder.orderid,
                    }, "Order status updated to cancelled (all orderlines cancelled)");
                    return true;
                }
                else {
                    logger.error({ orderId }, "Failed to update order status to cancelled");
                    return false;
                }
            }
            else {
                logger.debug({ orderId }, "Not all orderlines are cancelled, order status remains unchanged");
                return false;
            }
        }
        catch (error) {
            logger.error({ error, orderId }, "Error checking and updating order status");
            return false;
        }
    }
}
//# sourceMappingURL=orderline.service.js.map