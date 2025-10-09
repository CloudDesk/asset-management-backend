import { createPaginationResult, getPrismaSkipTake, } from "../utils/pagination.js";
import { dynamicFindMany, dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters, } from "../utils/dynamicDbOperations.js";
import { logger } from "../config/logger.js";
export class PlatformStockService {
    /**
     * Calculate platform status based on available quantity
     * @param availableqty - Available quantity
     * @returns Platform status string
     */
    calculatePlatformStatus(availableqty) {
        if (availableqty === 0) {
            return 'out_of_stock';
        }
        else if (availableqty > 5) {
            return 'in_stock';
        }
        else {
            return 'low_stock';
        }
    }
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, "Starting dynamic platformStock findMany with filters");
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the new dynamic filtering system
            const { data: platformStocks, total } = await dynamicFindManyWithFilters("platformstock", filters, {
                skip,
                take,
            });
            const paginationResult = createPaginationResult(platformStocks, total, page, limit);
            logger.info({
                total,
                returned: platformStocks.length,
                page,
                limit,
            }, "Dynamic platformStock findMany completed");
            return paginationResult;
        }
        catch (error) {
            logger.error({ error: error.message, filters, page, limit }, "Error in dynamic platformStock findMany");
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ id }, "Starting platformStock findById");
            const platformStock = await dynamicFindUnique("platformstock", {
                where: { id: Number(id) },
            });
            if (!platformStock) {
                throw new Error(`PlatformStock with ID ${id} not found`);
            }
            logger.debug({ id, platformStockId: platformStock.id }, "PlatformStock findById completed");
            return platformStock;
        }
        catch (error) {
            logger.error({ error: error.message, id }, "Error in platformStock findById");
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ originalData: data }, "Starting dynamic platformStock create operation");
            // Calculate platform status based on availableqty if provided
            const availableqty = data.availableqty || 0;
            const platformStatus = this.calculatePlatformStatus(Number(availableqty));
            // Add platform status and date fields to create data
            const dataWithStatus = {
                ...data,
                platformstatus: platformStatus,
            };
            const platformStock = await dynamicCreate("platformstock", dataWithStatus);
            if (!platformStock) {
                throw new Error("Failed to create platformStock - no valid fields provided");
            }
            logger.info({
                platformStockId: platformStock.id,
                productId: platformStock.productId,
                platform: platformStock.platform,
                platformStatus: platformStatus,
                availableqty: availableqty,
                availableFields: Object.keys(platformStock),
            }, "Dynamic platformStock create completed with calculated status");
            return platformStock;
        }
        catch (error) {
            logger.error({ error: error.message, data }, "Error in dynamic platformStock create");
            throw error;
        }
    }
    async update(id, data) {
        try {
            logger.debug({ id, originalData: data }, "Starting dynamic platformStock update operation");
            // Calculate platform status based on availableqty if provided
            const availableqty = data.availableqty;
            let dataWithStatus = { ...data };
            if (availableqty !== undefined) {
                const platformStatus = this.calculatePlatformStatus(Number(availableqty));
                dataWithStatus.platformstatus = platformStatus;
                logger.debug({
                    id,
                    availableqty,
                    calculatedPlatformStatus: platformStatus,
                    dataToPassToDynamicUpdate: dataWithStatus,
                    dataKeys: Object.keys(dataWithStatus),
                    dataValues: Object.values(dataWithStatus)
                }, "Data being passed to dynamicUpdate with calculated platform status");
            }
            else {
                logger.debug({
                    id,
                    dataToPassToDynamicUpdate: dataWithStatus,
                    dataKeys: Object.keys(dataWithStatus),
                    dataValues: Object.values(dataWithStatus)
                }, "Data being passed to dynamicUpdate (no availableqty change)");
            }
            const platformStock = await dynamicUpdate("platformstock", { id: Number(id) }, dataWithStatus);
            if (!platformStock) {
                throw new Error(`PlatformStock with ID ${id} not found`);
            }
            logger.info({
                platformStockId: platformStock.id,
                productId: platformStock.productId,
                platform: platformStock.platform,
                updatedFields: Object.keys(dataWithStatus),
                platformStatus: dataWithStatus.platformstatus,
                availableqty: availableqty,
            }, "Dynamic platformStock update completed with calculated status");
            return platformStock;
        }
        catch (error) {
            logger.error({ error: error.message, id, data }, "Error in dynamic platformStock update");
            throw error;
        }
    }
    async delete(id) {
        try {
            logger.debug({ id }, "Starting platformStock delete operation");
            const result = await dynamicDelete("platformstock", {
                where: { id: Number(id) },
            });
            if (!result) {
                throw new Error(`PlatformStock with ID ${id} not found`);
            }
            logger.info({ id, deletedPlatformStockId: id }, "PlatformStock delete completed");
            return result;
        }
        catch (error) {
            logger.error({ error: error.message, id }, "Error in platformStock delete");
            throw error;
        }
    }
    async upsert(data) {
        try {
            logger.debug({ originalData: data }, "Starting dynamic platformStock upsert operation");
            // For upsert, we need to use the productid and platform as unique identifiers
            const { productid, platform, ...updateData } = data;
            logger.debug({
                originalData: data,
                productid,
                platform,
                updateData
            }, "Upsert method - destructured data");
            if (!productid || !platform) {
                throw new Error("productid and platform are required for upsert operation");
            }
            // Try to find existing platformStock
            let existingPlatformStock = null;
            try {
                const existingStocks = await dynamicFindMany('platformstock', {
                    where: {
                        productid: Number(productid),
                        platform: platform,
                    },
                    take: 1
                });
                if (existingStocks && existingStocks.length > 0) {
                    existingPlatformStock = existingStocks[0];
                }
            }
            catch (error) {
                logger.debug({ error: error.message }, "No existing platformStock found");
            }
            // Calculate platform status based on availableqty if provided
            const availableqty = updateData.availableqty || existingPlatformStock?.availableqty || 0;
            const platformStatus = this.calculatePlatformStatus(Number(availableqty));
            // Add platform status and date fields to update data
            const dataWithStatus = {
                ...updateData,
                platformstatus: platformStatus
            };
            let platformStock;
            if (existingPlatformStock) {
                // Update existing
                platformStock = await this.update(existingPlatformStock.id, dataWithStatus);
                logger.info({
                    platformStockId: platformStock.id,
                    action: "updated",
                    platformStatus: platformStatus,
                    availableqty: availableqty
                }, "PlatformStock upsert - updated existing with calculated status");
            }
            else {
                // Create new - ensure required fields are present
                const createData = {
                    productid: Number(productid),
                    platform: platform,
                    ...dataWithStatus,
                };
                // Ensure productid is defined
                if (!createData.productid) {
                    throw new Error("productid is required for creating platform stock");
                }
                platformStock = await this.create(createData);
                logger.info({
                    platformStockId: platformStock.id,
                    action: "created",
                    platformStatus: platformStatus,
                    availableqty: availableqty
                }, "PlatformStock upsert - created new with calculated status");
            }
            return platformStock;
        }
        catch (error) {
            logger.error({ error: error.message, data }, "Error in dynamic platformStock upsert");
            throw error;
        }
    }
    /**
     * Update platform stock quantities based on stock changes
     * Handles multiple business scenarios:
     * 1. Platform transfers (decrease old platform, increase new platform)
     * 2. E-com publish changes (increase/decrease available quantity)
     * 3. Stock status changes (available/sold)
     * 4. Stock deletions (decrease quantities)
     * 5. New stock additions (increase quantities)
     */
    async updatePlatformStockQuantities(productId, platform, stockInfo) {
        try {
            logger.debug({ productId, platform, stockInfo }, "Starting platform stock quantities update");
            const operation = stockInfo.operation || (stockInfo.isNewStock ? 'create' : 'update');
            let availableQtyChange = 0;
            let soldQtyChange = 0;
            let totalQtyChange = 0;
            // Handle different operations
            switch (operation) {
                case 'create':
                    // New stock added
                    const quantityToAdd = stockInfo.quantity || 1; // Use provided quantity or default to 1
                    if (stockInfo.stockstatus === 'available') {
                        totalQtyChange = quantityToAdd; // Increase total quantity by provided quantity
                        if (stockInfo.ecompublish) {
                            availableQtyChange = quantityToAdd; // Increase available quantity by provided quantity if e-commerce enabled
                        }
                    }
                    break;
                case 'delete':
                    // Stock deleted - decrease quantities
                    const quantityToRemove = stockInfo.quantity || 1; // Use provided quantity or default to 1
                    if (stockInfo.stockstatus === 'available') {
                        totalQtyChange = -quantityToRemove; // Decrease total quantity by provided quantity
                        if (stockInfo.ecompublish) {
                            availableQtyChange = -quantityToRemove; // Decrease available quantity by provided quantity if e-commerce was enabled
                        }
                    }
                    else if (stockInfo.stockstatus === 'sold') {
                        soldQtyChange = -quantityToRemove;
                        totalQtyChange = -quantityToRemove;
                    }
                    break;
                case 'transfer':
                    // Platform transfer - handled separately in transferStockBetweenPlatforms
                    return await this.transferStockBetweenPlatforms(productId, stockInfo.oldPlatform, platform, stockInfo);
                case 'update':
                default:
                    // Handle status changes
                    if (stockInfo.oldStockstatus !== stockInfo.stockstatus) {
                        if (stockInfo.oldStockstatus === 'available' && stockInfo.stockstatus === 'sold') {
                            availableQtyChange = -1;
                            soldQtyChange = 1;
                        }
                        else if (stockInfo.oldStockstatus === 'sold' && stockInfo.stockstatus === 'available') {
                            availableQtyChange = 1;
                            soldQtyChange = -1;
                        }
                    }
                    // Handle e-com publish changes
                    if (stockInfo.oldEcompublish !== stockInfo.ecompublish && stockInfo.stockstatus === 'available') {
                        if (stockInfo.ecompublish && !stockInfo.oldEcompublish) {
                            // E-com enabled - increase available
                            availableQtyChange += 1;
                        }
                        else if (!stockInfo.ecompublish && stockInfo.oldEcompublish) {
                            // E-com disabled - decrease available
                            availableQtyChange -= 1;
                        }
                    }
                    break;
            }
            // Skip if no changes
            if (availableQtyChange === 0 && soldQtyChange === 0 && totalQtyChange === 0) {
                logger.debug({ productId, platform, operation }, "No quantity changes needed for platform stock");
                return null;
            }
            // Use the existing upsert method to handle create or update
            // First get the current record to calculate new quantities
            let currentRecord = null;
            try {
                const existingRecords = await dynamicFindMany('platformstock', {
                    where: {
                        productid: productId,
                        platform: platform,
                    },
                    take: 1
                });
                if (existingRecords && existingRecords.length > 0) {
                    currentRecord = existingRecords[0];
                }
            }
            catch (error) {
                logger.debug({ error: error.message, productId, platform }, "No existing platform stock record found");
            }
            // Calculate new quantities - convert BigInt to Number for calculations
            const currentAvailableQty = currentRecord ? Number(currentRecord.availableqty) : 0;
            const currentSoldQty = currentRecord ? Number(currentRecord.soldqty) : 0;
            const currentTotalQty = currentRecord ? Number(currentRecord.totalqty) : 0;
            const newAvailableQty = Math.max(0, currentAvailableQty + availableQtyChange);
            const newSoldQty = Math.max(0, currentSoldQty + soldQtyChange);
            const newTotalQty = Math.max(0, currentTotalQty + totalQtyChange);
            logger.debug({
                productId,
                platform,
                currentRecord: currentRecord ? {
                    availableqty: currentRecord.availableqty,
                    soldqty: currentRecord.soldqty,
                    totalqty: currentRecord.totalqty
                } : null,
                calculatedNewValues: {
                    newAvailableQty,
                    newSoldQty,
                    newTotalQty
                },
                changes: {
                    availableQtyChange,
                    soldQtyChange,
                    totalQtyChange
                }
            }, "PlatformStock quantity calculations");
            // Calculate platform status based on new available quantity
            const platformStatus = this.calculatePlatformStatus(newAvailableQty);
            // Use upsert to create or update
            const upsertData = {
                productid: productId,
                platform: platform,
                availableqty: newAvailableQty,
                soldqty: newSoldQty,
                totalqty: newTotalQty,
                orderedqty: currentRecord?.orderedqty || 0,
                lockqty: currentRecord?.lockqty || 0,
                platformstatus: platformStatus,
            };
            logger.debug({
                upsertData,
                currentRecord: currentRecord ? {
                    orderedqty: currentRecord.orderedqty,
                    lockqty: currentRecord.lockqty
                } : null
            }, "About to call upsert with data");
            const platformStock = await this.upsert(upsertData);
            logger.info({
                platformStockId: platformStock.id,
                productId,
                platform,
                operation,
                changes: {
                    availableQtyChange,
                    soldQtyChange,
                    totalQtyChange,
                },
                finalQuantities: {
                    availableqty: platformStock.availableqty,
                    soldqty: platformStock.soldqty,
                    totalqty: platformStock.totalqty,
                },
                platformStatus: platformStatus,
            }, "Platform stock quantities and status updated successfully");
            return platformStock;
        }
        catch (error) {
            logger.error({ error: error.message, productId, platform, stockInfo }, "Error updating platform stock quantities");
            throw error;
        }
    }
    /**
     * Transfer stock between platforms
     * Decreases quantities from old platform and increases in new platform
     */
    async transferStockBetweenPlatforms(productId, fromPlatform, toPlatform, stockInfo) {
        try {
            logger.debug({ productId, fromPlatform, toPlatform, stockInfo }, "Starting platform stock transfer");
            // Only transfer if e-com is published and stock is available
            if (!stockInfo.ecompublish || stockInfo.stockstatus !== 'available') {
                logger.debug({ productId, fromPlatform, toPlatform }, "Skipping platform transfer - stock not e-com published or not available");
                return null;
            }
            // Decrease from old platform
            let fromPlatformStock = null;
            try {
                const fromRecords = await dynamicFindMany('platformstock', {
                    where: {
                        productid: productId,
                        platform: fromPlatform,
                    },
                    take: 1
                });
                if (fromRecords && fromRecords.length > 0) {
                    const fromRecord = fromRecords[0];
                    fromPlatformStock = await dynamicUpdate('platformstock', { id: fromRecord.id }, {
                        availableqty: Math.max(0, fromRecord.availableqty - 1),
                        totalqty: Math.max(0, fromRecord.totalqty - 1),
                    });
                }
                else {
                    // Create with 0 quantities
                    fromPlatformStock = await dynamicCreate('platformstock', {
                        productid: productId,
                        platform: fromPlatform,
                        availableqty: 0,
                        soldqty: 0,
                        totalqty: 0,
                        orderedqty: 0,
                        lockqty: 0,
                    });
                }
            }
            catch (error) {
                logger.error({ error: error.message, productId, fromPlatform }, "Error updating from platform stock");
            }
            // Increase in new platform
            let toPlatformStock = null;
            try {
                const toRecords = await dynamicFindMany('platformstock', {
                    where: {
                        productid: productId,
                        platform: toPlatform,
                    },
                    take: 1
                });
                if (toRecords && toRecords.length > 0) {
                    const toRecord = toRecords[0];
                    toPlatformStock = await dynamicUpdate('platformstock', { id: toRecord.id }, {
                        availableqty: toRecord.availableqty + 1,
                        totalqty: toRecord.totalqty + 1,
                    });
                }
                else {
                    // Create new record
                    toPlatformStock = await dynamicCreate('platformstock', {
                        productid: productId,
                        platform: toPlatform,
                        availableqty: 1,
                        soldqty: 0,
                        totalqty: 1,
                        orderedqty: 0,
                        lockqty: 0,
                    });
                }
            }
            catch (error) {
                logger.error({ error: error.message, productId, toPlatform }, "Error updating to platform stock");
            }
            logger.info({
                productId,
                fromPlatform,
                toPlatform,
                fromPlatformStock: {
                    id: fromPlatformStock.id,
                    availableqty: fromPlatformStock.availableqty,
                    totalqty: fromPlatformStock.totalqty,
                },
                toPlatformStock: {
                    id: toPlatformStock.id,
                    availableqty: toPlatformStock.availableqty,
                    totalqty: toPlatformStock.totalqty,
                },
            }, "Platform stock transfer completed successfully");
            return { fromPlatformStock, toPlatformStock };
        }
        catch (error) {
            logger.error({ error: error.message, productId, fromPlatform, toPlatform, stockInfo }, "Error transferring stock between platforms");
            throw error;
        }
    }
    /**
     * Get platform stock for a specific product and platform
     */
    async getByProductAndPlatform(productId, platform) {
        try {
            const platformStocks = await dynamicFindMany('platformstock', {
                where: {
                    productid: productId,
                    platform: platform,
                },
                take: 1
            });
            return platformStocks && platformStocks.length > 0 ? platformStocks[0] : null;
        }
        catch (error) {
            logger.error({ error: error.message, productId, platform }, "Error getting platform stock by product and platform");
            throw error;
        }
    }
}
//# sourceMappingURL=platformStock.service.js.map