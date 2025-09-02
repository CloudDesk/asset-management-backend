import { createPaginationResult, getPrismaSkipTake, } from "../utils/pagination.js";
import { dynamicFindMany, dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters, } from "../utils/dynamicDbOperations.js";
import { logger } from "../config/logger.js";
import { ProductService } from "./product.service.js";
export class StockService {
    productService = new ProductService();
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, "Starting dynamic stock findMany with filters");
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the new dynamic filtering system
            const { data: stocks, total } = await dynamicFindManyWithFilters("stock", filters, {
                skip,
                take,
                useAllColumns: true, // Get all available columns
            });
            logger.info({
                stockCount: stocks.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: stocks.length > 0 ? Object.keys(stocks[0]) : [],
            }, "Dynamic stock findMany with filters completed");
            return createPaginationResult(stocks, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, "Error in dynamic stock findMany operation");
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ stockId: id }, "Starting dynamic stock findById operation");
            const stock = await dynamicFindUnique("stock", { id });
            if (!stock) {
                throw new Error("Stock not found");
            }
            logger.debug({
                stockId: id,
                availableFields: Object.keys(stock),
            }, "Dynamic stock findById completed");
            return stock;
        }
        catch (error) {
            logger.error({ error, stockId: id }, "Error in stock findById operation");
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ originalData: data }, "Starting dynamic stock create operation");
            // First, try to find the product by PUC if provided
            let linkedProduct = null;
            if (data.puc) {
                try {
                    // Try to find product by puc field match first
                    const products = await dynamicFindMany('product', {
                        where: { puc: data.puc },
                        take: 1
                    });
                    if (products && products.length > 0) {
                        linkedProduct = products[0];
                        logger.debug({ puc: data.puc, productId: linkedProduct?.id }, "Found linked product by PUC field match");
                    }
                    else {
                        // Try by ID as fallback
                        linkedProduct = await this.productService.findById(data.puc);
                        logger.debug({ puc: data.puc, productId: linkedProduct?.id }, "Found linked product by PUC as ID");
                    }
                }
                catch (error) {
                    logger.warn({ error: error.message, puc: data.puc }, "Could not find product by PUC, stock will be created without product link");
                }
            }
            // Try to verify product exists if productId is provided (legacy support)
            if (data.productId || data.product_id) {
                try {
                    const productId = data.productId || data.product_id;
                    if (productId) {
                        await this.productService.findById(productId);
                        logger.debug({ productId }, "Product verification successful");
                    }
                }
                catch (error) {
                    logger.warn({ error, data }, "Product verification failed, continuing with stock creation");
                }
            }
            const stock = await dynamicCreate("stock", data);
            if (!stock) {
                throw new Error("Failed to create stock - no valid fields provided");
            }
            logger.info({
                stockId: stock.id,
                puc: stock.puc,
                stockstatus: stock.stockstatus,
                ecompublish: stock.ecompublish,
                availableFields: Object.keys(stock),
            }, "Dynamic stock create completed");
            // Update product quantities based on the new stock
            // Priority: 1. Use stock.puc, 2. Use linked product, 3. Use legacy productId
            const productIdentifier = stock.puc ||
                linkedProduct?.puc ||
                linkedProduct?.id ||
                stock.productId ||
                stock.product_id;
            if (productIdentifier) {
                try {
                    // Pass the inserted stock information to updateStockTotals
                    const insertedStockInfo = {
                        ecompublish: stock.ecompublish,
                        stockstatus: stock.stockstatus,
                        quantity: stock.quantity || 1 // Default to 1 if not specified
                    };
                    const updateResult = await this.productService.updateStockTotals(productIdentifier, insertedStockInfo);
                    logger.info({
                        stockId: stock.id,
                        productIdentifier,
                        stockstatus: stock.stockstatus,
                        ecompublish: stock.ecompublish,
                        insertedStockInfo,
                        updateResult
                    }, "Successfully updated product quantities after stock creation");
                }
                catch (error) {
                    logger.error({
                        error: error.message,
                        stockId: stock.id,
                        productIdentifier,
                        stockstatus: stock.stockstatus,
                        ecompublish: stock.ecompublish
                    }, "Failed to update product quantities after stock creation");
                }
            }
            else {
                logger.warn({ stockId: stock.id }, "No product identifier found, skipping product quantity update");
            }
            return stock;
        }
        catch (error) {
            logger.error({ error, data }, "Error in stock create operation");
            throw error;
        }
    }
    async update(id, data) {
        try {
            // Check if stock exists
            const existingStock = await this.findById(id);
            logger.debug({ originalData: data, stockId: id }, "Starting dynamic stock update operation");
            const stock = await dynamicUpdate("stock", { id }, data);
            if (!stock) {
                throw new Error("Failed to update stock - no valid fields provided");
            }
            logger.info({
                stockId: id,
                oldStockStatus: existingStock.stockstatus,
                newStockStatus: stock.stockstatus,
                oldEcomPublish: existingStock.ecompublish,
                newEcomPublish: stock.ecompublish,
                availableFields: Object.keys(stock),
            }, "Dynamic stock update completed");
            // Update product quantities if stock status or ecompublish changed, or if PUC changed
            const shouldUpdateProduct = (existingStock.stockstatus !== stock.stockstatus ||
                existingStock.ecompublish !== stock.ecompublish ||
                existingStock.puc !== stock.puc ||
                data.stockstatus !== undefined ||
                data.ecompublish !== undefined);
            if (shouldUpdateProduct) {
                // Update quantities for old product if PUC changed
                if (existingStock.puc !== stock.puc && existingStock.puc) {
                    try {
                        await this.updateProductByPuc(existingStock.puc, "Stock removed/moved");
                    }
                    catch (error) {
                        logger.warn({ error, oldPuc: existingStock.puc }, "Failed to update old product after PUC change");
                    }
                }
                // Update quantities for current product
                const productIdentifier = stock.puc ||
                    existingStock.puc ||
                    stock.productId ||
                    stock.product_id ||
                    existingStock.productId ||
                    existingStock.product_id;
                if (productIdentifier) {
                    try {
                        const updateResult = await this.productService.updateStockTotals(productIdentifier);
                        logger.info({
                            stockId: id,
                            productIdentifier,
                            oldStockStatus: existingStock.stockstatus,
                            newStockStatus: stock.stockstatus,
                            oldEcomPublish: existingStock.ecompublish,
                            newEcomPublish: stock.ecompublish,
                            updateResult
                        }, "Successfully updated product quantities after stock update");
                    }
                    catch (error) {
                        logger.error({
                            error,
                            stockId: id,
                            productIdentifier,
                            changes: {
                                stockstatus: { from: existingStock.stockstatus, to: stock.stockstatus },
                                ecompublish: { from: existingStock.ecompublish, to: stock.ecompublish }
                            }
                        }, "Failed to update product quantities after stock update");
                    }
                }
                else {
                    logger.warn({ stockId: id }, "No product identifier found, skipping product quantity update after stock update");
                }
            }
            else {
                logger.debug({ stockId: id }, "No relevant fields changed, skipping product quantity update");
            }
            return stock;
        }
        catch (error) {
            logger.error({ error, data, stockId: id }, "Error in stock update operation");
            throw error;
        }
    }
    // Helper method to update product by PUC
    async updateProductByPuc(puc, reason) {
        try {
            const products = await dynamicFindMany('product', {
                where: { puc },
                take: 1
            });
            if (products && products.length > 0) {
                await this.productService.updateStockTotals(products[0].id || puc);
                logger.debug({ puc, reason }, "Updated product by PUC");
            }
        }
        catch (error) {
            logger.warn({ error, puc, reason }, "Failed to update product by PUC");
            // Try with PUC as ID fallback
            try {
                await this.productService.updateStockTotals(puc);
                logger.debug({ puc, reason }, "Updated product using PUC as ID");
            }
            catch (fallbackError) {
                logger.warn({ error: fallbackError, puc, reason }, "Failed to update product using PUC as ID");
            }
        }
    }
    async delete(id) {
        try {
            // Check if stock exists and get product info
            const existingStock = await this.findById(id);
            logger.debug({ stockId: id }, "Starting dynamic stock delete operation");
            const success = await dynamicDelete("stock", { id });
            if (!success) {
                throw new Error("Failed to delete stock");
            }
            logger.info({
                stockId: id,
                deletedStockPuc: existingStock.puc,
                deletedStockStatus: existingStock.stockstatus,
                deletedStockEcompublish: existingStock.ecompublish
            }, "Dynamic stock delete completed successfully");
            // Update product quantities based on the deleted stock
            // Priority: 1. Use stock.puc, 2. Use legacy productId
            const productIdentifier = existingStock.puc ||
                existingStock.productId ||
                existingStock.product_id;
            if (productIdentifier) {
                try {
                    const updateResult = await this.productService.updateStockTotals(productIdentifier);
                    logger.info({
                        stockId: id,
                        productIdentifier,
                        deletedStockStatus: existingStock.stockstatus,
                        deletedStockEcompublish: existingStock.ecompublish,
                        updateResult
                    }, "Successfully updated product quantities after stock deletion");
                }
                catch (error) {
                    logger.error({
                        error: error.message,
                        stockId: id,
                        productIdentifier,
                        deletedStockStatus: existingStock.stockstatus,
                        deletedStockEcompublish: existingStock.ecompublish
                    }, "Failed to update product quantities after stock deletion");
                }
            }
            else {
                logger.warn({ stockId: id }, "No product identifier found, skipping product quantity update after delete");
            }
        }
        catch (error) {
            logger.error({ error, stockId: id }, "Error in stock delete operation");
            throw error;
        }
    }
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing stock by ID
                logger.debug({ stockId: id, data: updateData }, "Upserting existing stock by ID");
                return this.update(id, updateData);
            }
            else {
                // Try to find existing stock by unique fields
                let existingStock = null;
                // Strategy 1: Try to find by productId and batchNumber
                const productId = data.productId || data.product_id;
                const batchNumber = data.batchNumber || data.batch_number;
                if (productId && batchNumber) {
                    try {
                        const existingStocks = await dynamicFindMany("stock", {
                            where: {
                                OR: [
                                    { productId, batchNumber },
                                    { product_id: productId, batch_number: batchNumber },
                                    { productId, batch_number: batchNumber },
                                    { product_id: productId, batchNumber },
                                ],
                            },
                            take: 1,
                        });
                        if (existingStocks.length > 0) {
                            existingStock = existingStocks[0];
                            logger.debug({ stockId: existingStock.id }, "Found existing stock by productId and batchNumber");
                        }
                    }
                    catch (error) {
                        logger.debug({ error }, "Could not search by productId and batchNumber");
                    }
                }
                // Strategy 2: Try to find by RFID if not found yet
                if (!existingStock && (data.rfid || data.rfid === "")) {
                    try {
                        const existingStocks = await dynamicFindMany("stock", {
                            where: { rfid: data.rfid },
                            take: 1,
                        });
                        if (existingStocks.length > 0) {
                            existingStock = existingStocks[0];
                            logger.debug({ stockId: existingStock.id }, "Found existing stock by RFID");
                        }
                    }
                    catch (error) {
                        logger.debug({ error }, "Could not search by RFID");
                    }
                }
                // Strategy 3: Try to find by serial number if not found yet
                if (!existingStock && (data.serialnumber || data.serialNumber)) {
                    try {
                        const serialNumber = data.serialnumber || data.serialNumber;
                        const existingStocks = await dynamicFindMany("stock", {
                            where: {
                                OR: [
                                    { serialnumber: serialNumber },
                                    { serialNumber: serialNumber },
                                ],
                            },
                            take: 1,
                        });
                        if (existingStocks.length > 0) {
                            existingStock = existingStocks[0];
                            logger.debug({ stockId: existingStock.id }, "Found existing stock by serial number");
                        }
                    }
                    catch (error) {
                        logger.debug({ error }, "Could not search by serial number");
                    }
                }
                if (existingStock) {
                    // Update existing stock
                    logger.debug({ stockId: existingStock.id, data: updateData }, "Upserting found existing stock");
                    return this.update(existingStock.id.toString(), updateData);
                }
                else {
                    // Create new stock
                    logger.debug({ data: updateData }, "Upserting new stock (no existing found)");
                    return this.create(updateData);
                }
            }
        }
        catch (error) {
            logger.error({ error, data }, "Error in stock upsert operation");
            throw error;
        }
    }
    async findByProduct(productId) {
        try {
            logger.debug({ productId }, "Finding stocks by product");
            const stocks = await dynamicFindMany("stock", {
                where: {
                    OR: [{ productId }, { product_id: productId }],
                },
                orderBy: { createdAt: "desc" },
            });
            logger.debug({ productId, stockCount: stocks.length }, "Found stocks by product");
            return stocks;
        }
        catch (error) {
            logger.error({ error, productId }, "Error finding stocks by product");
            throw error;
        }
    }
    async updateQuantities(id, quantities) {
        try {
            const existingStock = await this.findById(id);
            logger.debug({ stockId: id, quantities }, "Updating stock quantities");
            // Map field names to handle both camelCase and snake_case
            const updateData = {};
            if (quantities.quantity !== undefined) {
                updateData.quantity = quantities.quantity;
            }
            if (quantities.availableQuantity !== undefined) {
                updateData.availableQuantity = quantities.availableQuantity;
                updateData.available_quantity = quantities.availableQuantity; // Also try snake_case
            }
            if (quantities.soldQuantity !== undefined) {
                updateData.soldQuantity = quantities.soldQuantity;
                updateData.sold_quantity = quantities.soldQuantity; // Also try snake_case
            }
            const stock = await dynamicUpdate("stock", { id }, updateData);
            if (!stock) {
                throw new Error("Failed to update stock quantities - no valid fields provided");
            }
            logger.info({ stockId: id, quantities }, "Stock quantities updated successfully");
            // Try to update product stock totals if possible
            const productId = existingStock.productId || existingStock.product_id;
            if (productId) {
                try {
                    await this.productService.updateStockTotals(productId);
                }
                catch (error) {
                    logger.warn({ error, productId }, "Failed to update product stock totals after quantity update");
                }
            }
            return stock;
        }
        catch (error) {
            logger.error({ error, stockId: id, quantities }, "Error updating stock quantities");
            throw error;
        }
    }
    async updateByRfid(rfid, orderlineid) {
        try {
            logger.info({ rfid, orderlineid }, "Starting stock update by RFID");
            // Find stock by RFID
            const stockList = await dynamicFindMany("stock", {
                where: { rfid: rfid },
                take: 1
            });
            if (!stockList || stockList.length === 0) {
                throw new Error(`Stock not found with RFID: ${rfid}`);
            }
            const stock = stockList[0];
            const stockId = stock.id; // Keep as integer, don't convert to string
            logger.debug({ stockId, currentStatus: stock.stockstatus, rfid }, "Found stock by RFID");
            // Update stock with new orderlinenumber and status
            const currentTime = Date.now();
            const updateData = {
                orderlinenumber: orderlineid,
                stockstatus: "Sold",
                solddate: BigInt(currentTime),
                rfidscannedtime: BigInt(currentTime)
            };
            const updatedStock = await dynamicUpdate("stock", { id: stockId }, updateData);
            if (!updatedStock) {
                throw new Error("Failed to update stock");
            }
            logger.info({
                stockId,
                rfid,
                orderlineid,
                oldStatus: stock.stockstatus,
                newStatus: "Sold"
            }, "Stock updated successfully");
            // Update product quantities using existing logic if PUC is available
            if (updatedStock.puc) {
                try {
                    await this.updateProductByPuc(updatedStock.puc, "RFID stock sale");
                    logger.info({
                        stockId,
                        puc: updatedStock.puc,
                        reason: "RFID stock sale"
                    }, "Product quantities updated after RFID sale");
                }
                catch (error) {
                    logger.error({
                        error: error.message,
                        stockId,
                        puc: updatedStock.puc
                    }, "Failed to update product quantities after RFID sale");
                    // Don't throw error here, stock update was successful
                }
            }
            else {
                logger.warn({ stockId, rfid }, "No PUC found for stock, skipping product quantity update");
            }
            return updatedStock;
        }
        catch (error) {
            logger.error({ error, rfid, orderlineid }, "Error in updateByRfid operation");
            throw error;
        }
    }
    async bulkUpdateByRfid(updates) {
        try {
            logger.info({ updateCount: updates.length }, "Starting bulk stock update by RFID");
            const results = [];
            const errors = [];
            let successCount = 0;
            let failureCount = 0;
            // Process each update
            for (const [index, { rfid, orderlineid }] of updates.entries()) {
                try {
                    logger.debug({ index: index + 1, total: updates.length, rfid, orderlineid }, "Processing individual RFID update");
                    const updatedStock = await this.updateByRfid(rfid, orderlineid);
                    results.push({
                        index,
                        rfid,
                        orderlineid,
                        success: true,
                        data: updatedStock,
                        stockId: updatedStock.id,
                        status: updatedStock.stockstatus
                    });
                    successCount++;
                    logger.debug({ index: index + 1, rfid, stockId: updatedStock.id }, "Individual RFID update successful");
                }
                catch (error) {
                    const errorResult = {
                        index,
                        rfid,
                        orderlineid,
                        success: false,
                        error: error.message,
                        errorDetails: error.stack
                    };
                    results.push(errorResult);
                    errors.push(errorResult);
                    failureCount++;
                    logger.warn({ index: index + 1, rfid, error: error.message }, "Individual RFID update failed");
                }
            }
            const summary = {
                total: updates.length,
                successful: successCount,
                failed: failureCount,
                successRate: `${((successCount / updates.length) * 100).toFixed(1)}%`
            };
            logger.info({
                summary,
                hasErrors: errors.length > 0
            }, "Bulk RFID update completed");
            return {
                summary,
                results,
                errors: errors.length > 0 ? errors : undefined
            };
        }
        catch (error) {
            logger.error({ error, updateCount: updates.length }, "Error in bulkUpdateByRfid operation");
            throw error;
        }
    }
}
//# sourceMappingURL=stock.service.js.map