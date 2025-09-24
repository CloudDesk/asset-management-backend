import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindMany, dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicDelete, dynamicFindManyWithFilters } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class ProductService {
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic product findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Use the new dynamic filtering system
            const { data: products, total } = await dynamicFindManyWithFilters('product', filters, {
                skip,
                take,
                useAllColumns: true // Get all available columns
            });
            logger.info({
                productCount: products.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: products.length > 0 ? Object.keys(products[0]) : []
            }, 'Dynamic product findMany with filters completed');
            return createPaginationResult(products, total, page, limit);
        }
        catch (error) {
            logger.error({ error, filters, page, limit }, 'Error in dynamic product findMany operation');
            throw error;
        }
    }
    async findById(id) {
        try {
            logger.debug({ productId: id }, 'Starting dynamic product findById operation');
            const product = await dynamicFindUnique('product', { id });
            if (!product) {
                throw new Error('Product not found');
            }
            logger.debug({
                productId: id,
                availableFields: Object.keys(product)
            }, 'Dynamic product findById completed');
            return product;
        }
        catch (error) {
            logger.error({ error, productId: id }, 'Error in product findById operation');
            throw error;
        }
    }
    async create(data) {
        try {
            logger.debug({ originalData: data }, 'Starting dynamic product create operation');
            const product = await dynamicCreate('product', data);
            if (!product) {
                throw new Error('Failed to create product - no valid fields provided');
            }
            logger.info({
                productId: product.id,
                availableFields: Object.keys(product)
            }, 'Dynamic product create completed');
            return product;
        }
        catch (error) {
            logger.error({
                error: error.message,
                errorCode: error.code,
                errorMeta: error.meta,
                originalData: data
            }, 'Error in product create operation');
            // Re-throw the original error to preserve specific error details
            throw error;
        }
    }
    async update(id, data) {
        try {
            // Check if product exists
            await this.findById(id);
            logger.debug({ originalData: data, productId: id }, 'Starting dynamic product update operation');
            const product = await dynamicUpdate('product', { id }, data);
            if (!product) {
                throw new Error('Failed to update product - no valid fields provided');
            }
            logger.info({
                productId: id,
                availableFields: Object.keys(product)
            }, 'Dynamic product update completed');
            return product;
        }
        catch (error) {
            logger.error({ error, data, productId: id }, 'Error in product update operation');
            throw error;
        }
    }
    async delete(id) {
        try {
            // Check if product exists
            await this.findById(id);
            logger.debug({ productId: id }, 'Starting dynamic product delete operation');
            const success = await dynamicDelete('product', { id });
            if (!success) {
                throw new Error('Failed to delete product');
            }
            logger.info({ productId: id }, 'Dynamic product delete completed successfully');
        }
        catch (error) {
            logger.error({ error, productId: id }, 'Error in product delete operation');
            throw error;
        }
    }
    async upsert(data) {
        try {
            const { id, ...updateData } = data;
            if (id) {
                // Update existing product
                logger.debug({ productId: id, data: updateData }, 'Upserting existing product');
                return this.update(id, updateData);
            }
            else {
                // Create new product
                logger.debug({ data: updateData }, 'Upserting new product');
                return this.create(updateData);
            }
        }
        catch (error) {
            logger.error({ error, data }, 'Error in product upsert operation');
            throw error;
        }
    }
    async updateStockTotals(productIdentifier, insertedStock, stockStatusChange) {
        try {
            logger.debug({ productIdentifier }, 'Starting comprehensive stock totals update');
            // First, try to determine if productIdentifier is an ID or PUC and find the product
            let product = null;
            let productPuc = productIdentifier;
            let productId = productIdentifier;
            // Try to find product by ID first (if it's numeric)
            if (/^\d+$/.test(productIdentifier)) {
                try {
                    product = await dynamicFindUnique('product', { id: productIdentifier });
                    if (product && product.puc) {
                        productPuc = product.puc;
                        productId = product.id;
                        logger.debug({ productIdentifier, productId, productPuc }, 'Found product by ID');
                    }
                }
                catch (error) {
                    logger.debug({ productIdentifier }, 'Could not find product by ID, will try by PUC');
                }
            }
            // If not found by ID or not numeric, try to find by PUC
            if (!product) {
                try {
                    const products = await dynamicFindMany('product', {
                        where: { puc: productIdentifier },
                        take: 1
                    });
                    if (products && products.length > 0) {
                        product = products[0];
                        productPuc = product.puc;
                        productId = product.id;
                        logger.debug({ productIdentifier, productId, productPuc }, 'Found product by PUC');
                    }
                }
                catch (error) {
                    logger.warn({ productIdentifier }, 'Could not find product by PUC either');
                }
            }
            if (!product) {
                logger.warn({ productIdentifier }, 'Product not found, skipping stock totals update');
                return { totalQuantity: 0, totalAvailable: 0, totalSold: 0, totalEcomPublished: 0 };
            }
            // Find stocks by PUC (primary relationship) - only use active stocks
            const stocks = await dynamicFindMany('stock', {
                where: {
                    puc: productPuc,
                    isdeleted: { not: true },
                    isarchive: { not: true }
                },
            });
            if (!Array.isArray(stocks) || stocks.length === 0) {
                logger.warn({ productIdentifier, productPuc, productId }, 'No active stocks found for product, setting quantities to zero');
                // Update product to zero quantities if no stocks found
                const updateData = {
                    quantity: 0,
                    availablequantity: 0,
                    soldquantity: 0,
                    ecompublishedquantity: 0,
                    productstatus: 'out_of_stock',
                    modifieddate: BigInt(Date.now())
                };
                await dynamicUpdate('product', { id: productId }, updateData);
                logger.info({ productIdentifier, productId }, 'Updated product quantities to zero (no active stocks found)');
                return { totalQuantity: 0, totalAvailable: 0, totalSold: 0, totalEcomPublished: 0 };
            }
            // Calculate totals based on stock records count (not stock.quantity field)
            let totalQuantity = 0;
            let totalAvailable = 0;
            let totalSold = 0;
            let totalEcomPublished = 0;
            stocks.forEach(stock => {
                // Count each stock record as 1 unit (not using stock.quantity field)
                totalQuantity += 1;
                if (stock.stockstatus === 'Available') {
                    // Only count e-commerce published if stock is available AND ecompublish is true
                    if (stock.ecompublish === true) {
                        totalEcomPublished += 1;
                        totalAvailable += 1; // Available quantity = stocks that are Available AND ecompublish=true
                    }
                    // Note: Available stocks with ecompublish=false are NOT counted in availablequantity
                }
                else if (stock.stockstatus === 'Sold') {
                    totalSold += 1;
                }
                // Note: Damaged stocks are not counted in available or sold
            });
            const totals = {
                totalQuantity,
                totalAvailable, // Recalculated from actual stock data
                totalSold,
                totalEcomPublished
            };
            logger.info({
                productIdentifier,
                productId,
                productPuc,
                stockCount: stocks.length,
                totals,
                stockBreakdown: {
                    totalStocks: stocks.length,
                    availableAndEcomPublishedCount: totalAvailable, // Available AND ecompublish=true (for reference)
                    soldCount: totalSold,
                    ecomPublishedCount: totalEcomPublished,
                    stockDetails: stocks.map(s => ({
                        id: s.id,
                        status: s.stockstatus,
                        ecompublish: s.ecompublish,
                        countsAsAvailable: s.stockstatus === 'Available' && s.ecompublish === true
                    }))
                }
            }, 'Calculated stock totals - availablequantity will be calculated using business formula: ecompublishedquantity - orderedquantity - soldquantity');
            // Determine product status based on available quantity
            let productStatus = 'out_of_stock';
            if (totals.totalAvailable > 5) {
                productStatus = 'in_stock';
            }
            else if (totals.totalAvailable >= 1) {
                productStatus = 'low_stock';
            }
            // Handle orderedquantity decrease when stock changes to Sold
            let orderedQuantityAdjustment = 0;
            if (stockStatusChange && stockStatusChange.from !== 'Sold' && stockStatusChange.to === 'Sold') {
                // When stock changes to Sold, decrease orderedquantity by 1
                orderedQuantityAdjustment = -1;
                logger.info({
                    productIdentifier,
                    stockStatusChange,
                    orderedQuantityAdjustment
                }, 'Stock status changed to Sold - will decrease orderedquantity');
            }
            // Calculate availablequantity using business formula: ecompublishedquantity - orderedquantity - soldquantity
            const currentOrderedQuantity = product.orderedquantity || 0;
            const orderedQuantityAfterAdjustment = orderedQuantityAdjustment !== 0
                ? Math.max(0, currentOrderedQuantity + orderedQuantityAdjustment)
                : currentOrderedQuantity;
            const calculatedAvailableQuantity = Math.max(0, totals.totalEcomPublished - orderedQuantityAfterAdjustment - totals.totalSold);
            // Update product with calculated totals
            const updateData = {
                quantity: totals.totalQuantity,
                availablequantity: calculatedAvailableQuantity, // Use business formula instead of totalAvailable
                soldquantity: totals.totalSold,
                ecompublishedquantity: totals.totalEcomPublished,
                productstatus: productStatus,
                modifieddate: BigInt(Date.now())
            };
            // Add orderedquantity adjustment if needed
            if (orderedQuantityAdjustment !== 0) {
                const currentOrderedQuantity = product.orderedquantity || 0;
                const newOrderedQuantity = Math.max(0, currentOrderedQuantity + orderedQuantityAdjustment);
                updateData.orderedquantity = newOrderedQuantity;
                logger.info({
                    productIdentifier,
                    currentOrderedQuantity,
                    adjustment: orderedQuantityAdjustment,
                    newOrderedQuantity
                }, 'Adjusting orderedquantity for stock status change to Sold');
            }
            const updatedProduct = await dynamicUpdate('product', { id: productId }, updateData);
            if (updatedProduct) {
                logger.info({
                    productIdentifier,
                    productId,
                    productPuc,
                    totals,
                    productStatus,
                    availableQuantityCalculation: {
                        ecompublishedquantity: totals.totalEcomPublished,
                        orderedquantity: orderedQuantityAfterAdjustment,
                        soldquantity: totals.totalSold,
                        calculatedAvailableQuantity
                    },
                    updatedFields: Object.keys(updateData)
                }, 'Updated product stock totals and status successfully - availablequantity calculated using business formula');
            }
            else {
                logger.warn({
                    productIdentifier,
                    productId,
                    productPuc,
                    totals,
                    productStatus,
                    attemptedFields: Object.keys(updateData)
                }, 'Could not update product - fields may not be available in schema');
            }
            return {
                ...totals,
                updatedProduct: updatedProduct || null
            };
        }
        catch (error) {
            logger.error({ error, productIdentifier }, 'Error in updateStockTotals operation');
            throw error;
        }
    }
    /**
     * Upsert product with file upload handling - merges image URLs into size arrays
     */
    async upsertProductWithFile(data) {
        try {
            const { productid, url, ...otherData } = data;
            let existingProductData = {};
            const upsertProductData = { ...otherData };
            // If productid is provided, fetch existing product data
            if (productid) {
                logger.debug({ productId: productid }, 'Fetching existing product for file upsert');
                existingProductData = await dynamicFindUnique('product', { id: productid });
                if (!existingProductData) {
                    throw new Error(`Product with ID ${productid} not found`);
                }
            }
            // Handle image URL merging if url data is provided
            if (url) {
                logger.debug({
                    productId: productid,
                    urlData: url,
                    existingLarge: existingProductData?.large,
                    existingMedium: existingProductData?.medium,
                    existingSmall: existingProductData?.small
                }, 'Processing image URL data for size arrays');
                // Merge large images
                if (url.Large && Array.isArray(url.Large)) {
                    upsertProductData.large = existingProductData?.large
                        ? [...(existingProductData.large || []), ...url.Large]
                        : url.Large;
                }
                // Merge medium images
                if (url.Medium && Array.isArray(url.Medium)) {
                    upsertProductData.medium = existingProductData?.medium
                        ? [...(existingProductData.medium || []), ...url.Medium]
                        : url.Medium;
                }
                // Merge small images
                if (url.Small && Array.isArray(url.Small)) {
                    upsertProductData.small = existingProductData?.small
                        ? [...(existingProductData.small || []), ...url.Small]
                        : url.Small;
                }
                logger.debug({
                    productId: productid,
                    mergedLarge: upsertProductData.large,
                    mergedMedium: upsertProductData.medium,
                    mergedSmall: upsertProductData.small
                }, 'Image URL arrays merged successfully');
            }
            let result;
            if (productid) {
                // Update existing product
                logger.debug({ productId: productid, updateData: upsertProductData }, 'Updating existing product with file data');
                result = await this.update(productid, upsertProductData);
            }
            else {
                // Create new product
                logger.debug({ createData: upsertProductData }, 'Creating new product with file data');
                result = await this.create(upsertProductData);
            }
            logger.info({
                productId: productid || result?.id,
                operation: productid ? 'update' : 'create',
                hasImageData: !!url,
                imageArraysUpdated: {
                    large: !!upsertProductData.large,
                    medium: !!upsertProductData.medium,
                    small: !!upsertProductData.small
                }
            }, 'Product upsert with file completed successfully');
            return {
                result,
                productid: productid || result?.id,
                pathurldatas: url || null
            };
        }
        catch (error) {
            logger.error({
                error: error.message,
                data,
                productId: data?.productid
            }, 'Error in product upsert with file operation');
            // Use the project's error handling pattern
            if (error.message.includes('not found')) {
                throw new Error(`Product with ID ${data?.productid} not found`);
            }
            throw error;
        }
    }
    /**
     * Rearrange image URLs within product arrays (large, medium, small)
     */
    async rearrangeProductImages(productId, rearrangeData) {
        try {
            logger.debug({ productId, rearrangeData }, 'Starting product image rearrangement');
            // Fetch existing product to validate
            const existingProduct = await dynamicFindUnique('product', { id: productId });
            if (!existingProduct) {
                throw new Error(`Product with ID ${productId} not found`);
            }
            // Validate that provided arrays contain the same URLs as existing arrays
            const updateData = {};
            if (rearrangeData.large) {
                const existingLarge = existingProduct.large || [];
                if (!this.arraysContainSameElements(rearrangeData.large, existingLarge)) {
                    throw new Error('Large array rearrangement must contain exactly the same URLs as existing array');
                }
                updateData.large = rearrangeData.large;
            }
            if (rearrangeData.medium) {
                const existingMedium = existingProduct.medium || [];
                if (!this.arraysContainSameElements(rearrangeData.medium, existingMedium)) {
                    throw new Error('Medium array rearrangement must contain exactly the same URLs as existing array');
                }
                updateData.medium = rearrangeData.medium;
            }
            if (rearrangeData.small) {
                const existingSmall = existingProduct.small || [];
                if (!this.arraysContainSameElements(rearrangeData.small, existingSmall)) {
                    throw new Error('Small array rearrangement must contain exactly the same URLs as existing array');
                }
                updateData.small = rearrangeData.small;
            }
            if (Object.keys(updateData).length === 0) {
                throw new Error('No valid rearrangement data provided');
            }
            // Update the product with rearranged arrays
            const result = await this.update(productId, updateData);
            logger.info({
                productId,
                rearrangedArrays: Object.keys(updateData),
                arrayLengths: {
                    large: updateData.large?.length,
                    medium: updateData.medium?.length,
                    small: updateData.small?.length
                }
            }, 'Product image rearrangement completed successfully');
            return result;
        }
        catch (error) {
            logger.error({
                error: error.message,
                productId,
                rearrangeData
            }, 'Error in product image rearrangement operation');
            throw error;
        }
    }
    /**
     * Helper method to check if two arrays contain the same elements (order doesn't matter)
     */
    arraysContainSameElements(arr1, arr2) {
        if (arr1.length !== arr2.length)
            return false;
        const sorted1 = [...arr1].sort();
        const sorted2 = [...arr2].sort();
        return sorted1.every((val, index) => val === sorted2[index]);
    }
    /**
     * Delete specific URLs from product image arrays
     */
    async deleteProductImageUrls(productId, deleteData) {
        try {
            logger.debug({ productId, deleteData }, 'Starting product image URL deletion');
            // Fetch existing product to validate
            const existingProduct = await dynamicFindUnique('product', { id: productId });
            if (!existingProduct) {
                throw new Error(`Product with ID ${productId} not found`);
            }
            const updateData = {};
            const deletionSummary = {};
            // Process large array deletions
            if (deleteData.large && deleteData.large.length > 0) {
                const existingLarge = existingProduct.large || [];
                const filteredLarge = existingLarge.filter((url) => !deleteData.large.includes(url));
                if (filteredLarge.length === existingLarge.length) {
                    logger.warn({ productId, urlsToDelete: deleteData.large }, 'No matching URLs found in large array');
                }
                else {
                    updateData.large = filteredLarge;
                    deletionSummary.large = {
                        before: existingLarge.length,
                        after: filteredLarge.length,
                        deleted: existingLarge.length - filteredLarge.length
                    };
                }
            }
            // Process medium array deletions
            if (deleteData.medium && deleteData.medium.length > 0) {
                const existingMedium = existingProduct.medium || [];
                const filteredMedium = existingMedium.filter((url) => !deleteData.medium.includes(url));
                if (filteredMedium.length === existingMedium.length) {
                    logger.warn({ productId, urlsToDelete: deleteData.medium }, 'No matching URLs found in medium array');
                }
                else {
                    updateData.medium = filteredMedium;
                    deletionSummary.medium = {
                        before: existingMedium.length,
                        after: filteredMedium.length,
                        deleted: existingMedium.length - filteredMedium.length
                    };
                }
            }
            // Process small array deletions
            if (deleteData.small && deleteData.small.length > 0) {
                const existingSmall = existingProduct.small || [];
                const filteredSmall = existingSmall.filter((url) => !deleteData.small.includes(url));
                if (filteredSmall.length === existingSmall.length) {
                    logger.warn({ productId, urlsToDelete: deleteData.small }, 'No matching URLs found in small array');
                }
                else {
                    updateData.small = filteredSmall;
                    deletionSummary.small = {
                        before: existingSmall.length,
                        after: filteredSmall.length,
                        deleted: existingSmall.length - filteredSmall.length
                    };
                }
            }
            if (Object.keys(updateData).length === 0) {
                throw new Error('No URLs were found to delete from the specified arrays');
            }
            // Update the product with filtered arrays
            const result = await this.update(productId, updateData);
            logger.info({
                productId,
                deletionSummary,
                totalDeleted: Object.values(deletionSummary).reduce((sum, info) => sum + info.deleted, 0)
            }, 'Product image URL deletion completed successfully');
            return {
                product: result,
                deletionSummary
            };
        }
        catch (error) {
            logger.error({
                error: error.message,
                productId,
                deleteData
            }, 'Error in product image URL deletion operation');
            throw error;
        }
    }
}
//# sourceMappingURL=product.service.js.map