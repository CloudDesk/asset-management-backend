import { prisma } from '../models/prisma.js';
import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicFindManyWithFilters } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
import { gstService } from './gst.service.js';
export class OrdersService {
    // Helper function to parse status_history
    parseStatusHistory(statusHistory) {
        if (!statusHistory)
            return [];
        // If it's already an array, return it (filter out empty objects)
        if (Array.isArray(statusHistory)) {
            return statusHistory.filter((entry) => entry && typeof entry === 'object' && Object.keys(entry).length > 0);
        }
        // If it's a string, try to parse it
        if (typeof statusHistory === 'string') {
            try {
                const parsed = JSON.parse(statusHistory);
                if (Array.isArray(parsed)) {
                    return parsed.filter((entry) => entry && typeof entry === 'object' && Object.keys(entry).length > 0);
                }
            }
            catch (e) {
                // If parsing fails, return empty array
                return [];
            }
        }
        // If it's an object (but not an array), wrap it in an array
        if (typeof statusHistory === 'object' && Object.keys(statusHistory).length > 0) {
            return [statusHistory];
        }
        return [];
    }
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
            const order = await dynamicFindUnique('orders', { id: id });
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
            // Create the order first
            const order = await dynamicCreate('orders', createData);
            if (!order) {
                throw new Error('Failed to create order - no valid fields provided');
            }
            // Create orderlines for valid products if productid array is provided
            if (data.productid && Array.isArray(data.productid) && data.productid.length > 0) {
                logger.info({
                    orderId: order.id,
                    productIds: data.productid,
                    orderlineCount: data.productid.length,
                    hasOrderItems: !!data.orderItems
                }, 'Creating orderlines for valid products');
                // Use detailed order items if available, otherwise fall back to simple product IDs
                let orderlineResults;
                if (data.orderItems && Array.isArray(data.orderItems) && data.orderItems.length > 0) {
                    logger.info({
                        orderId: order.id,
                        orderItems: data.orderItems.length
                    }, 'Creating orderlines from detailed order items');
                    orderlineResults = await this.createOrderlinesFromOrderItems(order.id, data.orderItems, order.orderid, currentTimestamp, data.mode // ✅ Pass mode for correct orderline status
                    );
                }
                else {
                    logger.info({
                        orderId: order.id,
                        productIds: data.productid.length
                    }, 'Creating orderlines from product IDs (fallback)');
                    orderlineResults = await this.createOrderlinesForProducts(order.id, data.productid, data, order.orderid, currentTimestamp, data.mode // ✅ Pass mode for correct orderline status
                    );
                }
                logger.info({
                    orderId: order.id,
                    orderid: order.orderid,
                    createdOrderlines: orderlineResults.length,
                    totalProducts: data.productid.length
                }, 'Order and orderlines creation completed');
                // ============================================
                // GST CALCULATION - Calculate and update GST for order and orderlines
                // ============================================
                try {
                    const orderAmount = parseFloat(order.orderamount?.toString() || '0');
                    const shippingCost = parseFloat(data.shipping_cost?.toString() || '0');
                    const addressId = data.addressid || null;
                    logger.info({
                        orderId: order.id,
                        orderAmount,
                        shippingCost,
                        addressId,
                        orderlinesCount: orderlineResults.length
                    }, 'Starting GST calculation for order');
                    const gstResult = await gstService.processOrderGst(order.id, addressId, orderAmount, shippingCost);
                    if (gstResult.success) {
                        logger.info({
                            orderId: order.id,
                            orderTotals: gstResult.orderTotals
                        }, 'GST calculation completed successfully');
                        // Add GST totals to the order object for return
                        order.items_total = gstResult.orderTotals?.items_total;
                        order.total_taxable_amount = gstResult.orderTotals?.total_taxable_amount;
                        order.total_cgst_amount = gstResult.orderTotals?.total_cgst_amount;
                        order.total_sgst_amount = gstResult.orderTotals?.total_sgst_amount;
                        order.total_igst_amount = gstResult.orderTotals?.total_igst_amount;
                        order.total_gst_amount = gstResult.orderTotals?.total_gst_amount;
                    }
                    else {
                        logger.warn({
                            orderId: order.id,
                            error: gstResult.error
                        }, 'GST calculation failed - order created without GST data');
                    }
                }
                catch (gstError) {
                    logger.error({
                        orderId: order.id,
                        error: gstError.message,
                        stack: gstError.stack
                    }, 'Error during GST calculation - order created without GST data');
                    // Don't fail order creation for GST calculation errors
                }
                // ============================================
                // END GST CALCULATION
                // ============================================
                // Return order with orderlines info
                return {
                    ...order,
                    orderlines: orderlineResults
                };
            }
            logger.info({
                orderId: order.id,
                orderid: order.orderid,
                availableFields: Object.keys(order)
            }, 'Dynamic orders create completed (no orderlines created)');
            return order;
        }
        catch (error) {
            logger.error({ error, data }, 'Error in orders create operation');
            throw error;
        }
    }
    async createOrderlinesForProducts(orderId, productIds, orderData, orderidString, currentTime, mode // ✅ Optional mode parameter for correct orderline status
    ) {
        const orderlines = [];
        // ✅ FIX: COD orderlines should start with order_confirmed, Prepaid with payment_completed
        const isCodOrder = mode === 'cod';
        const defaultStatus = isCodOrder ? 'order_confirmed' : 'payment_completed';
        // Initialize status_history for orderlines (JSON.stringify for JSONB column)
        // is_active: true for the current/latest entry, false for all previous entries
        const initialStatusHistory = JSON.stringify([{
                previous_status: 'order_placed',
                new_status: defaultStatus,
                changed_date: currentTime,
                source: isCodOrder ? 'system' : 'phonepe',
                is_active: true
            }]);
        for (let i = 0; i < productIds.length; i++) {
            const productId = productIds[i];
            const orderlineData = {
                orderid: orderId, // Use the database ID, not the string orderid
                productid: productId,
                userid: orderData.userid || null,
                addressid: orderData.addressid || null,
                productamount: orderData.productamount || null,
                discountamount: orderData.discountamount || null,
                orderamount: orderData.orderamount || null,
                quantity: orderData.quantity || 1, // Default quantity per line
                merchanttransactionid: orderData.merchanttransactionid || null,
                orderstatus: orderData.orderstatus || defaultStatus, // ✅ COD: order_confirmed, Prepaid: payment_completed
                uniqueordderid: orderidString, // Use the string orderid
                deliveryfrom: orderData.deliveryfrom || null,
                createddate: currentTime,
                modifieddate: currentTime,
                readytodispatchdate: orderData.readytodispatchdate || null,
                dispatcheddate: orderData.dispatcheddate || null,
                delivereddate: orderData.delivereddate || null,
                cancelleddate: orderData.cancelleddate || null,
                returneddate: orderData.returneddate || null,
                paymentfaileddate: orderData.paymentfaileddate || null,
                status_history: initialStatusHistory // ✅ Initialize status history for tracking
            };
            try {
                const orderline = await dynamicCreate('orderline', orderlineData);
                if (orderline) {
                    orderlines.push(orderline);
                    logger.debug({
                        orderlineId: orderline.id,
                        orderlineNumber: orderline.orderlinenumber,
                        productId: productId
                    }, 'Orderline created successfully');
                }
            }
            catch (orderlineError) {
                logger.error({
                    error: orderlineError,
                    orderlineData,
                    productId
                }, 'Failed to create orderline for product');
                // Continue with other orderlines even if one fails
            }
        }
        return orderlines;
    }
    async createOrderlinesFromOrderItems(orderId, orderItems, orderidString, currentTime, mode // ✅ Optional mode parameter for correct orderline status
    ) {
        const orderlines = [];
        logger.info({
            orderId,
            orderidString,
            orderItemsCount: orderItems.length,
            sampleOrderItem: orderItems.length > 0 ? {
                productid: orderItems[0].productid,
                hasOriginalPrice: 'original_price' in orderItems[0],
                hasProductDiscount: 'product_discount_amount' in orderItems[0],
                hasPromotionDiscount: 'promotion_discount_amount' in orderItems[0],
                hasShippingCost: 'shipping_cost' in orderItems[0],
                hasEvaluationId: 'evaluation_id' in orderItems[0]
            } : null
        }, 'Starting orderline creation from enriched order items');
        // ✅ FIX: COD orderlines should start with order_confirmed, Prepaid with payment_completed
        const isCodOrder = mode === 'cod';
        const orderlineStatus = isCodOrder ? 'order_confirmed' : 'payment_completed';
        // Initialize status_history for orderlines (JSON.stringify for JSONB column)
        // is_active: true for the current/latest entry, false for all previous entries
        const initialStatusHistory = JSON.stringify([{
                previous_status: 'order_placed',
                new_status: orderlineStatus,
                changed_date: currentTime,
                source: isCodOrder ? 'system' : 'phonepe',
                is_active: true
            }]);
        for (let i = 0; i < orderItems.length; i++) {
            const orderItem = orderItems[i];
            const orderlineData = {
                orderid: orderId, // Use the database ID, not the string orderid
                productid: orderItem.productid,
                userid: parseInt(orderItem.userid?.toString() || '0') || null,
                addressid: parseInt(orderItem.addressid?.toString() || '0') || null,
                productamount: parseFloat(orderItem.productamount?.toString() || '0') || null,
                discountamount: parseFloat(orderItem.discountamount?.toString() || '0') || null,
                orderamount: parseFloat(orderItem.orderamount?.toString() || '0') || null,
                quantity: parseInt(orderItem.quantity?.toString() || '1') || 1,
                productname: orderItem.productname || null,
                productcategory: orderItem.productcategory || null,
                orderstatus: orderlineStatus, // ✅ COD: order_confirmed, Prepaid: payment_completed
                uniqueordderid: orderidString, // Use the string orderid
                createddate: currentTime,
                modifieddate: currentTime,
                ordereddate: currentTime,
                // ✅ BUGFIX: Add promotion/discount fields with proper null handling
                original_price: orderItem.original_price !== undefined
                    ? parseFloat(orderItem.original_price?.toString() || '0')
                    : null,
                product_discount_amount: orderItem.product_discount_amount !== undefined
                    ? parseFloat(orderItem.product_discount_amount?.toString() || '0')
                    : null,
                promotion_discount_amount: orderItem.promotion_discount_amount !== undefined
                    ? parseFloat(orderItem.promotion_discount_amount?.toString() || '0')
                    : null,
                shipping_cost: orderItem.shipping_cost !== undefined
                    ? parseFloat(orderItem.shipping_cost?.toString() || '0')
                    : null,
                evaluation_id: orderItem.evaluation_id || null,
                merchanttransactionid: orderItem.merchanttransactionid || null,
                status_history: initialStatusHistory // ✅ Initialize status history for tracking
            };
            try {
                logger.debug({
                    orderId,
                    productid: orderItem.productid,
                    orderlineIndex: i,
                    discountFields: {
                        original_price: orderlineData.original_price,
                        product_discount_amount: orderlineData.product_discount_amount,
                        promotion_discount_amount: orderlineData.promotion_discount_amount,
                        shipping_cost: orderlineData.shipping_cost,
                        evaluation_id: orderlineData.evaluation_id
                    }
                }, 'Creating orderline with discount fields');
                const orderline = await dynamicCreate('orderline', orderlineData);
                if (orderline) {
                    orderlines.push(orderline);
                    logger.info({
                        orderlineId: orderline.id,
                        orderlineNumber: orderline.orderlinenumber,
                        productId: orderItem.productid,
                        productName: orderItem.productname,
                        orderAmount: orderItem.orderamount,
                        discountAmount: orderItem.discountamount,
                        savedDiscountFields: {
                            original_price: orderline.original_price,
                            product_discount_amount: orderline.product_discount_amount,
                            promotion_discount_amount: orderline.promotion_discount_amount,
                            shipping_cost: orderline.shipping_cost,
                            evaluation_id: orderline.evaluation_id
                        }
                    }, 'Orderline created successfully with discount fields');
                }
            }
            catch (orderlineError) {
                logger.error({
                    error: orderlineError.message,
                    stack: orderlineError.stack,
                    orderlineData,
                    orderItem,
                    orderId,
                    productid: orderItem.productid
                }, 'Failed to create orderline for order item');
                // Continue with other orderlines even if one fails
            }
        }
        // Calculate and log totals for validation
        const successfulOrderlines = orderlines.filter(ol => ol.id);
        const totals = {
            // ✅ FIX: original_price is PER-UNIT, so multiply by quantity to get total
            totalOriginalPrice: successfulOrderlines.reduce((sum, ol) => {
                const originalPrice = parseFloat(ol.original_price?.toString() || '0') || 0;
                const quantity = parseFloat(ol.quantity?.toString() || '1') || 1;
                return sum + (originalPrice * quantity);
            }, 0),
            totalProductDiscount: successfulOrderlines.reduce((sum, ol) => sum + (parseFloat(ol.product_discount_amount?.toString() || '0') || 0), 0),
            totalPromotionDiscount: successfulOrderlines.reduce((sum, ol) => sum + (parseFloat(ol.promotion_discount_amount?.toString() || '0') || 0), 0),
            totalShipping: successfulOrderlines.reduce((sum, ol) => sum + (parseFloat(ol.shipping_cost?.toString() || '0') || 0), 0)
        };
        logger.info({
            orderId,
            orderidString,
            orderlinesCreated: successfulOrderlines.length,
            orderlinesFailed: orderlines.length - successfulOrderlines.length,
            calculatedTotals: totals
        }, 'Orderline creation completed with discount field distribution');
        return orderlines;
    }
    /**
     * Recalculate order status based on all orderline statuses
     * This automatically updates order status history
     */
    async recalculateOrderStatus(orderId) {
        try {
            logger.debug({ orderId }, 'Starting order status recalculation');
            // Get all orderlines for this order
            const { data: orderlines } = await dynamicFindManyWithFilters('orderline', {
                orderid: orderId.toString()
            }, { useAllColumns: true });
            if (!orderlines || orderlines.length === 0) {
                logger.warn({ orderId }, 'No orderlines found for order');
                return;
            }
            const orderlineStatuses = orderlines.map(ol => ol.orderstatus);
            // Calculate new order status based on aggregation rules
            let newOrderStatus;
            // Check for cancellation scenarios first
            const cancelledCount = orderlineStatuses.filter(s => s === 'cancelled').length;
            const totalCount = orderlineStatuses.length;
            if (cancelledCount === totalCount) {
                newOrderStatus = 'cancelled';
            }
            else {
                // Check for return scenarios
                const returnedCount = orderlineStatuses.filter(s => s === 'returned').length;
                if (returnedCount === totalCount) {
                    newOrderStatus = 'returned';
                }
                else {
                    // All orderlines have same status
                    const uniqueStatuses = [...new Set(orderlineStatuses)];
                    if (uniqueStatuses.length === 1) {
                        newOrderStatus = uniqueStatuses[0];
                    }
                    else {
                        // Mixed statuses - use priority ladder (lowest progress stage)
                        const statusPriority = [
                            'order_placed',
                            'payment_completed',
                            'order_confirmed',
                            'ready_for_dispatch',
                            'shipped',
                            'in_transit',
                            'out_for_delivery',
                            'delivered',
                            'cod_payment_received',
                            'cancelled',
                            'returned',
                            'rto_initiated',
                            'rto_delivered'
                        ];
                        // Find the lowest priority status
                        let lowestPriority = 999;
                        let lowestStatus = uniqueStatuses[0];
                        for (const status of uniqueStatuses) {
                            const priority = statusPriority.indexOf(status);
                            if (priority !== -1 && priority < lowestPriority) {
                                lowestPriority = priority;
                                lowestStatus = status;
                            }
                        }
                        newOrderStatus = lowestStatus;
                    }
                }
            }
            // Get current order to check if status changed
            const currentOrder = await this.findById(orderId);
            const previousStatus = currentOrder.orderstatus;
            // Only update if status changed
            if (previousStatus !== newOrderStatus) {
                // Update status history for order
                const existingHistory = Array.isArray(currentOrder.status_history)
                    ? currentOrder.status_history
                    : (typeof currentOrder.status_history === 'string' ? JSON.parse(currentOrder.status_history) : []);
                // Set all existing entries to is_active: false
                const deactivatedHistory = existingHistory.map((entry) => ({
                    ...entry,
                    is_active: false
                }));
                // New entry with is_active: true
                const historyEntry = {
                    previous_status: previousStatus,
                    new_status: newOrderStatus,
                    changed_date: Date.now(),
                    source: 'system', // Auto-calculated from orderlines
                    is_active: true
                };
                const updatedHistory = [...deactivatedHistory, historyEntry];
                // Update order with new status and history (JSON.stringify for JSONB column)
                await dynamicUpdate('orders', { id: orderId }, {
                    orderstatus: newOrderStatus,
                    status_history: JSON.stringify(updatedHistory),
                    modifieddate: Date.now()
                });
                logger.info({
                    orderId,
                    previousStatus,
                    newOrderStatus,
                    orderlineStatuses
                }, 'Order status recalculated and history updated');
            }
        }
        catch (error) {
            logger.error({ error, orderId }, 'Error recalculating order status');
            throw error;
        }
    }
    /**
     * Find order by tracking ID
     */
    async findByTrackingId(trackingId) {
        try {
            logger.debug({ trackingId }, 'Finding order by tracking ID');
            const { data: orders } = await dynamicFindManyWithFilters('orders', {
                tracking_id: trackingId
            }, { useAllColumns: true });
            if (!orders || orders.length === 0) {
                return null;
            }
            return orders[0]; // Return first match
        }
        catch (error) {
            logger.error({ error, trackingId }, 'Error finding order by tracking ID');
            throw error;
        }
    }
    /**
     * Find order by order number (orderid field)
     * Uses dynamicFindUnique - works when Prisma schema is available
     */
    async findByOrderNumber(orderNumber) {
        try {
            logger.debug({ orderNumber }, 'Finding order by order number');
            const order = await dynamicFindUnique('orders', { orderid: orderNumber });
            if (!order) {
                return null;
            }
            return order;
        }
        catch (error) {
            logger.error({ error, orderNumber }, 'Error finding order by order number');
            throw error;
        }
    }
    /**
     * Find order by orderid field using dynamicFindManyWithFilters
     * Use this method when you need to search by orderid (string field) and dynamicFindUnique doesn't work
     */
    async findByOrderIdString(orderIdString) {
        try {
            logger.debug({ orderIdString }, 'Finding order by orderid string using filters');
            const { data: orders } = await dynamicFindManyWithFilters('orders', { orderid: orderIdString }, { take: 1, useAllColumns: true });
            if (!orders || orders.length === 0) {
                logger.debug({ orderIdString }, 'Order not found by orderid string');
                return null;
            }
            logger.debug({
                orderIdString,
                foundOrderId: orders[0].id,
                foundOrderid: orders[0].orderid
            }, 'Order found by orderid string');
            return orders[0];
        }
        catch (error) {
            logger.error({ error, orderIdString }, 'Error finding order by orderid string');
            throw error;
        }
    }
    /**
     * Auto-select stocks using FIFO (First In First Out)
     */
    async autoSelectStocks(productId, // Product.id (orderline.productid = Product.id)
    quantity, // From orderline.quantity
    platform, batchFilter) {
        try {
            // Get Product by id to get puc
            // Relationship: Product.id = orderline.productid, Stock.puc = Product.puc
            const product = await dynamicFindUnique('product', { id: productId });
            if (!product || !product.puc) {
                throw new Error(`Product not found or missing PUC for productid: ${productId}`);
            }
            const filters = {
                puc: product.puc, // Stock.puc = Product.puc (where Product.id = productId)
                platform: platform,
                stockstatus: 'available'
            };
            // Apply batch filters if provided
            if (batchFilter?.batchno) {
                filters.batchno = batchFilter.batchno;
            }
            if (batchFilter?.supplierid) {
                filters.supplierid = batchFilter.supplierid;
            }
            if (batchFilter?.poid) {
                filters.poid = batchFilter.poid;
            }
            // Get available stocks (FIFO by createddate)
            const { data: stocks } = await dynamicFindManyWithFilters('stock', filters, {
                orderBy: 'createddate', // FIFO within filtered batch
                orderDirection: 'ASC',
                take: quantity,
                useAllColumns: true
            });
            if (!stocks || stocks.length < quantity) {
                const batchInfo = batchFilter
                    ? `. Batch: ${batchFilter.batchno || 'N/A'}, ` +
                        `Supplier: ${batchFilter.supplierid || 'N/A'}, ` +
                        `PO: ${batchFilter.poid || 'N/A'}. ` +
                        `Please select different batch or use manual stock_ids.`
                    : '';
                throw new Error(`Insufficient available stock: Need ${quantity}, Found ${stocks?.length || 0}${batchInfo}`);
            }
            return stocks.slice(0, quantity);
        }
        catch (error) {
            logger.error({ error, productId, quantity, platform, batchFilter }, 'Error in autoSelectStocks');
            throw error;
        }
    }
    /**
     * Get stocks by IDs
     */
    async getStocksByIds(stockIds) {
        try {
            const stocks = [];
            for (const stockId of stockIds) {
                const stock = await dynamicFindUnique('stock', { id: stockId });
                if (!stock) {
                    throw new Error(`Stock with ID ${stockId} not found`);
                }
                stocks.push(stock);
            }
            return stocks;
        }
        catch (error) {
            logger.error({ error, stockIds }, 'Error in getStocksByIds');
            throw error;
        }
    }
    /**
     * Get stocks by SKUs
     */
    async getStocksBySKUs(skus) {
        try {
            const stocks = [];
            for (const sku of skus) {
                const { data: stockResults } = await dynamicFindManyWithFilters('stock', { sku }, {
                    take: 1,
                    useAllColumns: true
                });
                if (!stockResults || stockResults.length === 0) {
                    throw new Error(`Stock with SKU ${sku} not found`);
                }
                stocks.push(stockResults[0]);
            }
            return stocks;
        }
        catch (error) {
            logger.error({ error, skus }, 'Error in getStocksBySKUs');
            throw error;
        }
    }
    /**
     * Allocate stock to orderlines based on stock mapping
     */
    async allocateStockToOrderlines(orderId, stockMapping) {
        try {
            const { OrderlineService } = await import('./orderline.service.js');
            const orderlineService = new OrderlineService();
            // Get all orderlines for this order
            const { data: orderlines } = await orderlineService.findMany({ orderid: orderId.toString() }, 1, 1000);
            if (!orderlines || orderlines.length === 0) {
                throw new Error('No orderlines found for this order');
            }
            const allocations = [];
            for (const orderline of orderlines) {
                const mapping = stockMapping?.find(m => m.orderline_id === orderline.id);
                let stocks;
                if (mapping?.stock_ids) {
                    // Manual selection by stock IDs
                    stocks = await this.getStocksByIds(mapping.stock_ids);
                    // Validate quantity matches orderline
                    if (stocks.length !== (orderline.quantity || 0)) {
                        throw new Error(`Stock count mismatch for orderline ${orderline.id}: ` +
                            `Expected ${orderline.quantity}, got ${stocks.length}`);
                    }
                }
                else if (mapping?.skus) {
                    // Manual selection by SKUs
                    stocks = await this.getStocksBySKUs(mapping.skus);
                    // Validate quantity matches orderline
                    if (stocks.length !== (orderline.quantity || 0)) {
                        throw new Error(`Stock count mismatch for orderline ${orderline.id}: ` +
                            `Expected ${orderline.quantity}, got ${stocks.length}`);
                    }
                }
                else if (mapping?.batch_filter) {
                    // Auto-select from specific batch/filter
                    stocks = await this.autoSelectStocks(orderline.productid, orderline.quantity || 1, 'nivapp', // Default platform, can be enhanced to use order's platform
                    mapping.batch_filter);
                }
                else {
                    // Auto-select available stocks (FIFO - no filter)
                    stocks = await this.autoSelectStocks(orderline.productid, orderline.quantity || 1, 'nivapp' // Default platform
                    );
                }
                // Validate stock status and product match
                for (const stock of stocks) {
                    if (stock.stockstatus !== 'available') {
                        throw new Error(`Stock ${stock.id} is not available (status: ${stock.stockstatus})`);
                    }
                    // Validate: Get Product by id = orderline.productid, then check Stock.puc = Product.puc
                    const orderlineProduct = await dynamicFindUnique('product', { id: orderline.productid });
                    if (!orderlineProduct || stock.puc !== orderlineProduct.puc) {
                        throw new Error(`Stock ${stock.id} (puc: ${stock.puc}) does not match orderline product ` +
                            `(productid: ${orderline.productid}, Product.puc: ${orderlineProduct?.puc || 'N/A'})`);
                    }
                }
                allocations.push({
                    orderline_id: orderline.id,
                    stocks: stocks
                });
            }
            return allocations;
        }
        catch (error) {
            logger.error({ error, orderId, stockMapping }, 'Error in allocateStockToOrderlines');
            throw error;
        }
    }
    /**
     * Update stock status and quantities for dispatch
     */
    async updateStockForDispatch(allocations, orderId, // orders.id (Int type)
    order // Full order object to get order.orderid (String)
    ) {
        try {
            const { OrderlineService } = await import('./orderline.service.js');
            const orderlineService = new OrderlineService();
            const currentTimestamp = Date.now();
            // Track quantity updates per product/platform to avoid duplicate updates
            // Key: "productId-platform" -> quantity
            const platformStockUpdates = new Map();
            // Key: puc -> quantity
            const productUpdates = new Map();
            for (const allocation of allocations) {
                const orderline = await orderlineService.findById(allocation.orderline_id.toString());
                const orderlineQuantity = orderline.quantity || allocation.stocks.length; // Use orderline quantity or stock count
                // Validate stock count matches orderline quantity
                if (allocation.stocks.length !== orderlineQuantity) {
                    throw new Error(`Stock count mismatch for orderline ${allocation.orderline_id}: ` +
                        `Expected ${orderlineQuantity}, got ${allocation.stocks.length}`);
                }
                // Get product info from first stock (all stocks should have same puc for same orderline)
                const firstStock = allocation.stocks[0];
                const product = await dynamicFindUnique('product', { puc: firstStock.puc });
                if (!product || !product.id) {
                    throw new Error(`Product not found for puc: ${firstStock.puc}`);
                }
                const productId = Number(product.id);
                // Track PlatformStock update (aggregate by productId + platform)
                const platformStockKey = `${productId}-${firstStock.platform}`;
                if (!platformStockUpdates.has(platformStockKey)) {
                    platformStockUpdates.set(platformStockKey, {
                        productId,
                        platform: firstStock.platform,
                        quantity: 0
                    });
                }
                platformStockUpdates.get(platformStockKey).quantity += orderlineQuantity;
                // Track Product update (aggregate by puc)
                if (!productUpdates.has(firstStock.puc)) {
                    productUpdates.set(firstStock.puc, 0);
                }
                productUpdates.set(firstStock.puc, productUpdates.get(firstStock.puc) + orderlineQuantity);
                // Update each Stock record
                for (const stock of allocation.stocks) {
                    // 1. Update Stock record
                    // Note: Stock.orderid is String (references orders.orderid, not orders.id)
                    // Note: Stock.orderlinenumber is String (references orderline.orderlinenumber)
                    await dynamicUpdate('stock', { id: stock.id }, {
                        stockstatus: 'sold',
                        orderid: order.orderid || orderId.toString(), // Use orders.orderid (String) if available
                        orderlinenumber: orderline.orderlinenumber, // String type
                        solddate: currentTimestamp,
                        modifieddate: currentTimestamp
                    });
                }
            }
            // 3. Update PlatformStock quantities (once per product/platform combination)
            for (const [key, update] of platformStockUpdates.entries()) {
                const { data: platformStocks } = await dynamicFindManyWithFilters('platformstock', {
                    productid: update.productId.toString(),
                    platform: update.platform
                }, { take: 1, useAllColumns: true });
                if (platformStocks && platformStocks.length > 0) {
                    const platformStock = platformStocks[0];
                    // Update PlatformStock: decrease orderedqty, increase soldqty
                    // Note: availableqty and platformstatus don't change (already done during order creation)
                    const newOrderedQty = Math.max(0, (platformStock.orderedqty || 0) - update.quantity);
                    const newSoldQty = (platformStock.soldqty || 0) + update.quantity;
                    await dynamicUpdate('platformstock', { id: platformStock.id }, {
                        orderedqty: newOrderedQty,
                        soldqty: newSoldQty,
                        modifieddate: currentTimestamp
                    });
                    logger.info({
                        platformStockId: platformStock.id,
                        productId: update.productId,
                        platform: update.platform,
                        quantity: update.quantity,
                        oldOrderedQty: platformStock.orderedqty,
                        newOrderedQty,
                        oldSoldQty: platformStock.soldqty,
                        newSoldQty
                    }, 'PlatformStock quantities updated');
                }
            }
            // 4. Update Product quantities (once per product)
            for (const [puc, quantity] of productUpdates.entries()) {
                const productForUpdate = await dynamicFindUnique('product', { puc });
                if (productForUpdate) {
                    // Update Product: decrease orderedquantity, increase soldquantity
                    // Note: availablequantity doesn't change (already done during order creation)
                    const newOrderedQuantity = Math.max(0, (productForUpdate.orderedquantity || 0) - quantity);
                    const newSoldQuantity = (productForUpdate.soldquantity || 0) + quantity;
                    await dynamicUpdate('product', { id: productForUpdate.id }, {
                        orderedquantity: newOrderedQuantity,
                        soldquantity: newSoldQuantity,
                        modifieddate: currentTimestamp
                    });
                    logger.info({
                        productId: productForUpdate.id,
                        puc,
                        quantity,
                        oldOrderedQuantity: productForUpdate.orderedquantity,
                        newOrderedQuantity,
                        oldSoldQuantity: productForUpdate.soldquantity,
                        newSoldQuantity
                    }, 'Product quantities updated');
                }
            }
        }
        catch (error) {
            logger.error({ error, allocations, orderId }, 'Error in updateStockForDispatch');
            throw error;
        }
    }
    /**
     * Mark order as ready for dispatch
     */
    async markReadyForDispatch(orderId, inventoryUserId, stockMapping) {
        try {
            logger.info({ orderId, inventoryUserId, hasStockMapping: !!stockMapping }, 'Marking order as ready for dispatch');
            // Use transaction for all updates
            return await prisma.$transaction(async (tx) => {
                // 1. Get full order object (needed for order.orderid String)
                const order = await this.findById(orderId);
                if (!order) {
                    throw new Error(`Order with ID ${orderId} not found`);
                }
                // 2. Allocate stock to orderlines
                const allocations = await this.allocateStockToOrderlines(orderId, stockMapping);
                // 3. Update stock status and quantities
                await this.updateStockForDispatch(allocations, orderId, order);
                // 4. Update all orderlines to ready_for_dispatch
                const { OrderlineService } = await import('./orderline.service.js');
                const orderlineService = new OrderlineService();
                const { data: orderlines } = await orderlineService.findMany({ orderid: orderId.toString() }, 1, 1000);
                if (!orderlines || orderlines.length === 0) {
                    throw new Error('No orderlines found for this order');
                }
                for (const orderline of orderlines) {
                    await orderlineService.updateOrderlineStatus(orderline.id.toString(), 'ready_for_dispatch', {
                        source: 'inventoryuser',
                        inventory_user_id: inventoryUserId
                    });
                }
                // 5. Recalculate order status (should become ready_for_dispatch)
                await this.recalculateOrderStatus(orderId);
                const updatedOrder = await this.findById(orderId);
                logger.info({
                    orderId,
                    orderStatus: updatedOrder.orderstatus,
                    allocatedStocks: allocations.reduce((sum, a) => sum + a.stocks.length, 0)
                }, 'Order marked as ready for dispatch');
                return updatedOrder;
            });
        }
        catch (error) {
            logger.error({ error, orderId, inventoryUserId }, 'Error marking order as ready for dispatch');
            throw error;
        }
    }
    /**
     * Mark order as shipped (after label printed)
     */
    async markShipped(orderId, inventoryUserId) {
        try {
            logger.info({ orderId, inventoryUserId }, 'Marking order as shipped');
            const order = await this.findById(orderId);
            if (!order.tracking_id) {
                throw new Error('Shipment not created yet. Please create EKART shipment first.');
            }
            const { OrderlineService } = await import('./orderline.service.js');
            const orderlineService = new OrderlineService();
            const currentTimestamp = Date.now();
            // Get all orderlines for this order
            const { data: orderlines } = await orderlineService.findMany({ orderid: orderId.toString() }, 1, 1000);
            if (!orderlines || orderlines.length === 0) {
                throw new Error('No orderlines found for this order');
            }
            // Update all orderlines to shipped
            for (const orderline of orderlines) {
                await orderlineService.updateOrderlineStatus(orderline.id.toString(), 'shipped', {
                    shipdate: currentTimestamp,
                    source: 'inventoryuser',
                    inventory_user_id: inventoryUserId
                });
            }
            // Update order
            await dynamicUpdate('orders', { id: orderId }, {
                shipdate: currentTimestamp,
                label_printed_at: currentTimestamp,
                modifieddate: Date.now()
            });
            // Recalculate order status (should become shipped)
            await this.recalculateOrderStatus(orderId);
            const updatedOrder = await this.findById(orderId);
            logger.info({ orderId, orderStatus: updatedOrder.orderstatus }, 'Order marked as shipped');
            return updatedOrder;
        }
        catch (error) {
            logger.error({ error, orderId, inventoryUserId }, 'Error marking order as shipped');
            throw error;
        }
    }
    /**
     * Update order status
     */
    async updateOrderStatus(id, status, additionalData) {
        try {
            logger.debug({ orderId: id, status, additionalData }, 'Starting orders status update operation');
            // Get current order
            const currentOrder = await this.findById(Number(id));
            const previousStatus = currentOrder.orderstatus;
            // Prepare status history entry
            const existingHistory = Array.isArray(currentOrder.status_history)
                ? currentOrder.status_history
                : (typeof currentOrder.status_history === 'string' ? JSON.parse(currentOrder.status_history) : []);
            // Set all existing entries to is_active: false
            const deactivatedHistory = existingHistory.map((entry) => ({
                ...entry,
                is_active: false
            }));
            // New entry with is_active: true
            const historyEntry = {
                previous_status: previousStatus,
                new_status: status,
                changed_date: Date.now(),
                source: additionalData?.source || 'system',
                is_active: true
            };
            // Add inventory_user_id if source is inventoryuser
            if (historyEntry.source === 'inventoryuser' && additionalData?.inventory_user_id) {
                historyEntry.inventory_user_id = additionalData.inventory_user_id;
            }
            const updatedHistory = [...deactivatedHistory, historyEntry];
            const updateData = {
                orderstatus: status,
                status_history: JSON.stringify(updatedHistory), // JSON.stringify for JSONB column
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
                case 'ready_for_dispatch':
                    updateData.readytodispatchdate = currentTimestamp;
                    break;
                case 'payment_failed':
                    updateData.paymentfaileddate = currentTimestamp;
                    updateData.ispaymentsucceed = false;
                    break;
                case 'payment_success':
                case 'payment_completed':
                    updateData.ispaymentsucceed = true;
                    break;
            }
            const order = await dynamicUpdate('orders', { id: parseInt(id) }, updateData);
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
    /**
     * Update order (generic update method)
     */
    async update(id, data) {
        try {
            // Check if order exists
            await this.findById(Number(id));
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
    /**
     * Get order details with orderlines and address
     * For Inventory App order detail page
     *
     * Returns specific fields only:
     * - order: Selected order fields
     * - orderlines[]: Array of orderlines with selected fields
     * - address: Address object with selected fields
     */
    async getOrderDetails(idOrOrderNumber) {
        try {
            logger.info({ idOrOrderNumber }, 'Getting order details with orderlines and address');
            // Find order by ID or order number
            let fullOrder;
            if (isNaN(Number(idOrOrderNumber))) {
                // If not a number, treat as orderid (order number string)
                fullOrder = await this.findByOrderNumber(idOrOrderNumber);
            }
            else {
                // If number, treat as database ID
                fullOrder = await this.findById(Number(idOrOrderNumber));
            }
            if (!fullOrder) {
                throw new Error('Order not found');
            }
            // Extract only required order fields
            const order = {
                id: fullOrder.id,
                orderid: fullOrder.orderid,
                createddate: fullOrder.createddate,
                modifieddate: fullOrder.modifieddate,
                orderamount: fullOrder.orderamount ? Number(fullOrder.orderamount) : null,
                orderstatus: fullOrder.orderstatus,
                delivereddate: fullOrder.delivereddate,
                cancelleddate: fullOrder.cancelleddate,
                returneddate: fullOrder.returneddate,
                quantity: fullOrder.quantity,
                transactionid: fullOrder.transactionid,
                productid: fullOrder.productid, // Array of product IDs
                productamount: fullOrder.productamount ? Number(fullOrder.productamount) : null,
                discountamount: fullOrder.discountamount ? Number(fullOrder.discountamount) : null,
                ispaymentsucceed: fullOrder.ispaymentsucceed,
                merchanttransactionid: fullOrder.merchanttransactionid,
                paymentfaileddate: fullOrder.paymentfaileddate,
                mode: fullOrder.mode,
                promotion_discount_total: fullOrder.promotion_discount_total ? Number(fullOrder.promotion_discount_total) : null,
                original_total: fullOrder.original_total ? Number(fullOrder.original_total) : null,
                shipping_cost: fullOrder.shipping_cost ? Number(fullOrder.shipping_cost) : null,
                items_total: fullOrder.items_total ? Number(fullOrder.items_total) : null,
                total_taxable_amount: fullOrder.total_taxable_amount ? Number(fullOrder.total_taxable_amount) : null,
                total_cgst_amount: fullOrder.total_cgst_amount ? Number(fullOrder.total_cgst_amount) : null,
                total_sgst_amount: fullOrder.total_sgst_amount ? Number(fullOrder.total_sgst_amount) : null,
                total_igst_amount: fullOrder.total_igst_amount ? Number(fullOrder.total_igst_amount) : null,
                total_gst_amount: fullOrder.total_gst_amount ? Number(fullOrder.total_gst_amount) : null,
                tax_amount: fullOrder.tax_amount ? Number(fullOrder.tax_amount) : null,
                tracking_id: fullOrder.tracking_id,
                vendor: fullOrder.vendor,
                barcodes: fullOrder.barcodes,
                label_url: fullOrder.label_url,
                public_tracking_link: fullOrder.public_tracking_link,
                shipment_created_at: fullOrder.shipment_created_at,
                shipdate: fullOrder.shipdate,
                cod_payment_received_date: fullOrder.cod_payment_received_date,
                cod_transaction_reference: fullOrder.cod_transaction_reference,
                cod_amount: fullOrder.cod_amount ? Number(fullOrder.cod_amount) : null,
                status_history: this.parseStatusHistory(fullOrder.status_history)
            };
            // Get orderlines for this order
            const { OrderlineService } = await import('./orderline.service.js');
            const orderlineService = new OrderlineService();
            const { data: rawOrderlines } = await orderlineService.findMany({ orderid: fullOrder.id.toString() }, 1, 1000);
            // Extract only required orderline fields and enrich with combo component data
            const orderlines = await Promise.all(rawOrderlines.map(async (ol) => {
                const orderlineData = {
                    id: ol.id,
                    productamount: ol.productamount ? Number(ol.productamount) : null,
                    discountamount: ol.discountamount ? Number(ol.discountamount) : null,
                    orderamount: ol.orderamount ? Number(ol.orderamount) : null,
                    quantity: ol.quantity,
                    productid: ol.productid,
                    productname: ol.productname,
                    productcategory: ol.productcategory,
                    hsn_code: ol.hsn_code,
                    orderstatus: ol.orderstatus,
                    original_price: ol.original_price ? Number(ol.original_price) : null,
                    product_discount_amount: ol.product_discount_amount ? Number(ol.product_discount_amount) : null,
                    promotion_discount_amount: ol.promotion_discount_amount ? Number(ol.promotion_discount_amount) : null,
                    shipping_cost: ol.shipping_cost ? Number(ol.shipping_cost) : null,
                    gst_rate: ol.gst_rate ? Number(ol.gst_rate) : null,
                    taxable_amount: ol.taxable_amount ? Number(ol.taxable_amount) : null,
                    cgst_amount: ol.cgst_amount ? Number(ol.cgst_amount) : null,
                    sgst_amount: ol.sgst_amount ? Number(ol.sgst_amount) : null,
                    igst_amount: ol.igst_amount ? Number(ol.igst_amount) : null,
                    total_gst_amount: ol.total_gst_amount ? Number(ol.total_gst_amount) : null,
                    status_history: this.parseStatusHistory(ol.status_history)
                };
                // Check if product is combo and fetch component data
                // Only add iscombo and components fields if product is actually a combo
                // This ensures backward compatibility - non-combo products have same structure as before
                if (ol.productid) {
                    try {
                        const product = await dynamicFindUnique('product', { id: Number(ol.productid) });
                        if (product?.iscombo === true) {
                            orderlineData.iscombo = true;
                            // Fetch components from productbundlemap
                            try {
                                const components = await prisma.productBundleMap.findMany({
                                    where: {
                                        bundleproductid: BigInt(Number(ol.productid)),
                                        isactive: true,
                                    },
                                    include: {
                                        componentproduct: {
                                            select: {
                                                id: true,
                                                name: true,
                                                category: true,
                                                subcategory: true,
                                            },
                                        },
                                    },
                                });
                                // Map components with required data
                                orderlineData.components = components.map((c) => ({
                                    componentproductid: Number(c.componentproductid),
                                    productname: c.componentproduct?.name || null,
                                    productcategory: c.componentproduct?.category || null,
                                    subcategory: c.componentproduct?.subcategory || null,
                                    requiredqty: c.requiredqty || 1,
                                }));
                            }
                            catch (componentError) {
                                logger.warn({
                                    orderlineId: ol.id,
                                    productId: ol.productid,
                                    error: componentError.message
                                }, 'Failed to fetch combo components');
                                orderlineData.components = [];
                            }
                        }
                        // If iscombo is false or undefined, don't add iscombo/components fields
                        // This maintains backward compatibility - response is same as before
                    }
                    catch (productError) {
                        logger.warn({
                            orderlineId: ol.id,
                            productId: ol.productid,
                            error: productError.message
                        }, 'Failed to check if product is combo');
                        // Don't add iscombo field on error - maintain backward compatibility
                    }
                }
                // If no productid, don't add iscombo/components fields - maintain backward compatibility
                return orderlineData;
            }));
            // Get address from first orderline (all orderlines share same address)
            let address = null;
            const firstOrderlineWithAddress = rawOrderlines.find((ol) => ol.addressid);
            if (firstOrderlineWithAddress?.addressid) {
                try {
                    const fullAddress = await dynamicFindUnique('address', { id: firstOrderlineWithAddress.addressid });
                    if (fullAddress) {
                        // Extract only required address fields
                        address = {
                            name: fullAddress.name,
                            mobilenumber: fullAddress.mobilenumber,
                            pincode: fullAddress.pincode,
                            doornumber: fullAddress.doornumber || fullAddress.addressline1,
                            address: fullAddress.addressline2 || fullAddress.address,
                            landmark: fullAddress.landmark,
                            state: fullAddress.state,
                            city: fullAddress.city
                        };
                    }
                }
                catch (err) {
                    logger.warn({ addressId: firstOrderlineWithAddress.addressid, error: err }, 'Failed to fetch address');
                }
            }
            logger.info({
                orderId: order.id,
                orderlinesCount: orderlines.length,
                hasAddress: !!address
            }, 'Order details retrieved successfully');
            return {
                order,
                orderlines,
                address
            };
        }
        catch (error) {
            logger.error({ error, idOrOrderNumber }, 'Error getting order details');
            throw error;
        }
    }
    /**
     * Get orders by userid with orderlines and address data
     * Returns orders with nested orderlines and address information
     */
    async getOrdersByUserIdWithDetails(userId, page = 1, limit = 50) {
        try {
            logger.info({ userId, page, limit }, 'Getting orders by userid with orderlines and address');
            // Get orders for this user
            const ordersResult = await this.findMany({ userid: userId.toString() }, page, limit);
            const orders = ordersResult.data;
            const pagination = ordersResult.pagination;
            // Get orderlines for all orders
            const { OrderlineService } = await import('./orderline.service.js');
            const orderlineService = new OrderlineService();
            // Get all order IDs
            const orderIds = orders.map((order) => order.id.toString());
            // Get all orderlines for these orders using dynamic operations
            // Query orderlines for each order and combine results
            const allOrderlines = [];
            for (const orderId of orderIds) {
                const { data: orderlines } = await orderlineService.findMany({ orderid: orderId }, 1, 1000 // Large limit to get all orderlines for each order
                );
                allOrderlines.push(...orderlines);
            }
            // Group orderlines by orderid
            const orderlinesByOrderId = new Map();
            for (const orderline of allOrderlines) {
                const orderId = Number(orderline.orderid);
                if (!orderlinesByOrderId.has(orderId)) {
                    orderlinesByOrderId.set(orderId, []);
                }
                orderlinesByOrderId.get(orderId).push(orderline);
            }
            // Get unique address IDs from orders and orderlines
            const addressIds = new Set();
            orders.forEach((order) => {
                if (order.addressid)
                    addressIds.add(Number(order.addressid));
            });
            allOrderlines.forEach((orderline) => {
                if (orderline.addressid)
                    addressIds.add(Number(orderline.addressid));
            });
            // Fetch all addresses in one batch
            // Query each address individually to avoid hardcoded SQL
            const addressMap = new Map();
            if (addressIds.size > 0) {
                const addressPromises = Array.from(addressIds).map(async (addressId) => {
                    try {
                        const address = await dynamicFindUnique('address', { id: addressId });
                        if (address) {
                            return { id: addressId, address };
                        }
                        return null;
                    }
                    catch (error) {
                        logger.warn({ addressId, error }, 'Failed to fetch address');
                        return null;
                    }
                });
                const addressResults = await Promise.all(addressPromises);
                addressResults.forEach((result) => {
                    if (result && result.address) {
                        const addr = result.address;
                        addressMap.set(result.id, {
                            name: addr.name,
                            mobilenumber: addr.mobile || addr.mobilenumber,
                            doornumber: addr.doornumber || addr.addressline1,
                            address: addr.addressline2 || addr.address,
                            pincode: addr.pincode,
                            state: addr.state,
                            city: addr.city
                        });
                    }
                });
            }
            // Build response with orders, orderlines, and address
            const ordersWithDetails = orders.map((order) => {
                // Extract required order fields
                const orderData = {
                    id: order.id,
                    orderamount: order.orderamount ? Number(order.orderamount) : null,
                    orderid: order.orderid,
                    orderstatus: order.orderstatus,
                    quantity: order.quantity,
                    productid: order.productid, // Array of product IDs
                    productamount: order.productamount ? Number(order.productamount) : null,
                    discountamount: order.discountamount ? Number(order.discountamount) : null,
                    ispaymentsucceed: order.ispaymentsucceed,
                    mode: order.mode,
                    promotion_discount_total: order.promotion_discount_total ? Number(order.promotion_discount_total) : null,
                    original_total: order.original_total ? Number(order.original_total) : null,
                    shipping_cost: order.shipping_cost ? Number(order.shipping_cost) : null,
                    items_total: order.items_total ? Number(order.items_total) : null,
                    total_taxable_amount: order.total_taxable_amount ? Number(order.total_taxable_amount) : null,
                    total_cgst_amount: order.total_cgst_amount ? Number(order.total_cgst_amount) : null,
                    total_sgst_amount: order.total_sgst_amount ? Number(order.total_sgst_amount) : null,
                    total_igst_amount: order.total_igst_amount ? Number(order.total_igst_amount) : null,
                    total_gst_amount: order.total_gst_amount ? Number(order.total_gst_amount) : null,
                    createddate: order.createddate ? Number(order.createddate) : null,
                    modifieddate: order.modifieddate ? Number(order.modifieddate) : null,
                    status_history: this.parseStatusHistory(order.status_history)
                };
                // Get orderlines for this order
                const orderOrderlines = (orderlinesByOrderId.get(order.id) || []).map((ol) => ({
                    id: ol.id,
                    productname: ol.productname,
                    productcategory: ol.productcategory,
                    productid: ol.productid ? Number(ol.productid) : null,
                    orderstatus: ol.orderstatus,
                    productamount: ol.productamount ? Number(ol.productamount) : null,
                    discountamount: ol.discountamount ? Number(ol.discountamount) : null,
                    orderamount: ol.orderamount ? Number(ol.orderamount) : null,
                    quantity: ol.quantity,
                    original_price: ol.original_price ? Number(ol.original_price) : null,
                    product_discount_amount: ol.product_discount_amount ? Number(ol.product_discount_amount) : null,
                    promotion_discount_amount: ol.promotion_discount_amount ? Number(ol.promotion_discount_amount) : null,
                    shipping_cost: ol.shipping_cost ? Number(ol.shipping_cost) : null,
                    gst_rate: ol.gst_rate ? Number(ol.gst_rate) : null,
                    taxable_amount: ol.taxable_amount ? Number(ol.taxable_amount) : null,
                    cgst_amount: ol.cgst_amount ? Number(ol.cgst_amount) : null,
                    sgst_amount: ol.sgst_amount ? Number(ol.sgst_amount) : null,
                    igst_amount: ol.igst_amount ? Number(ol.igst_amount) : null,
                    total_gst_amount: ol.total_gst_amount ? Number(ol.total_gst_amount) : null,
                    createddate: ol.createddate ? Number(ol.createddate) : null,
                    modifieddate: ol.modifieddate ? Number(ol.modifieddate) : null,
                    status_history: this.parseStatusHistory(ol.status_history)
                }));
                // Get address (prefer order address, fallback to first orderline address)
                let address = null;
                if (order.addressid) {
                    address = addressMap.get(Number(order.addressid)) || null;
                }
                // If no address on order, get from first orderline
                if (!address && orderOrderlines.length > 0) {
                    const firstOrderline = orderlinesByOrderId.get(order.id)?.[0];
                    if (firstOrderline?.addressid) {
                        address = addressMap.get(Number(firstOrderline.addressid)) || null;
                    }
                }
                return {
                    ...orderData,
                    orderlines: orderOrderlines,
                    address
                };
            });
            logger.info({
                userId,
                ordersCount: ordersWithDetails.length,
                totalOrders: pagination.total,
                page,
                limit
            }, 'Orders with orderlines and address retrieved successfully');
            return {
                orders: ordersWithDetails,
                pagination
            };
        }
        catch (error) {
            logger.error({ error, userId, page, limit }, 'Error getting orders by userid with details');
            throw error;
        }
    }
    /**
     * Cancel order (customer or admin initiated)
     * Handles stock reversal based on order status
     */
    async cancelOrder(orderId, userId, inventoryUserId, cancellationReason, source = 'customer') {
        try {
            logger.info({
                orderId,
                userId,
                inventoryUserId,
                source,
                cancellationReason
            }, 'Starting order cancellation');
            // Get order
            const order = await this.findById(orderId);
            if (!order) {
                throw new Error(`Order with ID ${orderId} not found`);
            }
            // IDEMPOTENCY CHECK: If order already cancelled, return existing state
            if (order.orderstatus === 'cancelled') {
                logger.info({
                    orderId,
                    orderNumber: order.orderid,
                    cancelledDate: order.cancelleddate
                }, 'Order already cancelled - returning existing state (idempotent)');
                return order;
            }
            // Define cancellable statuses
            const CANCELLABLE_STATUSES = [
                'order_placed',
                'payment_completed',
                'order_confirmed',
                'packed',
                'ready_for_dispatch'
            ];
            // Check if order can be cancelled
            if (!CANCELLABLE_STATUSES.includes(order.orderstatus)) {
                throw new Error(`Order cannot be cancelled. Current status: ${order.orderstatus}`);
            }
            // Verify userid matches order owner if customer cancellation
            if (source === 'customer' && userId && order.userid !== userId) {
                throw new Error('Unauthorized: userid does not match order owner');
            }
            // Get all orderlines for this order
            const { OrderlineService } = await import('./orderline.service.js');
            const orderlineService = new OrderlineService();
            const { data: orderlines } = await orderlineService.findMany({ orderid: orderId.toString() }, 1, 1000);
            if (!orderlines || orderlines.length === 0) {
                throw new Error('No orderlines found for this order');
            }
            // TRANSACTION WITH ROW-LEVEL LOCKING
            // Prevents race conditions when multiple cancel requests arrive simultaneously
            const updatedOrder = await prisma.$transaction(async (tx) => {
                logger.info({ orderId }, 'Starting atomic transaction with row-level lock');
                // STEP 1: Fetch order with row-level lock (SELECT FOR UPDATE)
                // This creates an exclusive lock on the order row
                // Other concurrent requests will WAIT here until this transaction completes
                const order = await tx.orders.findUnique({
                    where: { id: orderId }
                });
                if (!order) {
                    throw new Error(`Order with ID ${orderId} not found`);
                }
                // STEP 2: IDEMPOTENCY CHECK (now protected by row lock)
                // If first request is processing, second request waits
                // When second request acquires lock, it will see status = 'cancelled'
                if (order.orderstatus === 'cancelled') {
                    logger.info({
                        orderId,
                        orderNumber: order.orderid,
                        cancelledDate: order.cancelleddate
                    }, 'Order already cancelled - returning existing state (idempotent, lock-protected)');
                    return order;
                }
                // STEP 3: Validate cancellable status
                if (!order.orderstatus || !CANCELLABLE_STATUSES.includes(order.orderstatus)) {
                    throw new Error(`Order cannot be cancelled. Current status: ${order.orderstatus || 'unknown'}`);
                }
                // STEP 4: Verify user authorization
                if (source === 'customer' && userId && order.userid !== userId) {
                    throw new Error('Unauthorized: userid does not match order owner');
                }
                // STEP 5: Determine cancellation path and reverse stock
                const currentTimestamp = Date.now();
                if (order.orderstatus === 'ready_for_dispatch') {
                    // Path 2: Reverse stock allocations (soldqty → availableqty)
                    await this.cancelOrderAfterReadyForDispatch(orderId, orderlines);
                }
                else {
                    // Path 1: Reverse order quantities (orderedqty → availableqty)
                    await this.cancelOrderBeforeReadyForDispatch(orderId, orderlines);
                }
                // OPTIMIZED: Direct bulk update of orderlines to cancelled (no method calls to avoid triggering recalculateOrderStatus)
                // This prevents transaction timeout by avoiding heavy operations inside the transaction
                const statusHistoryEntry = {
                    status: 'cancelled',
                    timestamp: currentTimestamp,
                    source,
                    userid: userId,
                    inventory_user_id: inventoryUserId,
                    cancellation_reason: cancellationReason,
                    is_active: true
                };
                for (const orderline of orderlines) {
                    // Direct update without triggering recalculateOrderStatus
                    const existingHistory = Array.isArray(orderline.status_history)
                        ? orderline.status_history
                        : [];
                    const updatedHistory = existingHistory.map((entry) => ({
                        ...entry,
                        is_active: false
                    }));
                    updatedHistory.push(statusHistoryEntry);
                    await tx.orderline.update({
                        where: { id: orderline.id },
                        data: {
                            orderstatus: 'cancelled',
                            cancelleddate: currentTimestamp,
                            status_history: updatedHistory,
                            modifieddate: currentTimestamp
                        }
                    });
                }
                // OPTIMIZED: Direct update of order status (we KNOW it's cancelled - all orderlines are cancelled)
                // No need to call updateOrderStatus which triggers recalculateOrderStatus
                await tx.orders.update({
                    where: { id: orderId },
                    data: {
                        orderstatus: 'cancelled',
                        cancelleddate: currentTimestamp,
                        modifieddate: currentTimestamp
                    }
                });
                // Fetch and return updated order
                const finalOrder = await this.findById(orderId);
                logger.info({ orderId }, 'Transaction committed successfully');
                return finalOrder;
            }, {
                timeout: 30000, // 30 second timeout for large orders
                maxWait: 5000, // Maximum time to wait for transaction to start
            });
            logger.info({
                orderId,
                previousStatus: order.orderstatus,
                newStatus: 'cancelled',
                source,
                userId,
                inventoryUserId
            }, 'Order cancelled successfully');
            // UPDATE TRANSACTION TABLE
            const currentTimestamp = Date.now();
            try {
                if (updatedOrder.merchanttransactionid) {
                    const transaction = await dynamicFindUnique('transaction', {
                        merchanttransactionid: updatedOrder.merchanttransactionid
                    });
                    if (transaction) {
                        const existingData = transaction.transactiondata || {};
                        const updatedTransactionData = {
                            ...existingData,
                            order_cancelled: true,
                            cancelled_date: currentTimestamp,
                            cancellation_source: source,
                            cancellation_reason: cancellationReason,
                            order_status: updatedOrder.mode === 'cod' ? 'ORDER_CANCELLED' : 'CANCELLED_AWAITING_REFUND'
                        };
                        await dynamicUpdate('transaction', { id: transaction.id }, {
                            transactiondata: updatedTransactionData,
                            modifieddate: currentTimestamp
                        });
                        logger.info({
                            transactionId: transaction.id,
                            merchantTransactionId: updatedOrder.merchanttransactionid,
                            orderStatus: updatedTransactionData.order_status
                        }, 'Transaction updated with cancellation info');
                    }
                }
            }
            catch (transactionError) {
                // Log but don't fail cancellation if transaction update fails
                logger.error({
                    error: transactionError.message,
                    orderId,
                    merchantTransactionId: updatedOrder.merchanttransactionid
                }, 'Failed to update transaction record for cancellation');
            }
            // AUTO-COMPLETE COD ORDERS (no refund needed)
            // PhonePe orders remain in 'cancelled' status awaiting manual refund processing
            if (updatedOrder.mode === 'cod') {
                logger.info({
                    orderId,
                    orderNumber: updatedOrder.orderid,
                    mode: 'cod'
                }, 'COD order - automatically setting to cancelled_completed (no refund needed)');
                try {
                    // Auto-update to cancelled_completed for COD orders
                    const finalOrder = await this.updateRefundStatus(orderId, 'cancelled_completed', inventoryUserId || 0, // System auto-complete if no inventory user
                    'COD order - automatically completed (no refund required)');
                    logger.info({
                        orderId,
                        orderNumber: finalOrder.orderid,
                        finalStatus: 'cancelled_completed'
                    }, 'COD order cancellation completed automatically');
                    return finalOrder;
                }
                catch (autoCompleteError) {
                    // If auto-complete fails, log but return the cancelled order
                    logger.error({
                        error: autoCompleteError.message,
                        orderId,
                        orderNumber: updatedOrder.orderid
                    }, 'Failed to auto-complete COD order, remains in cancelled status');
                    return updatedOrder;
                }
            }
            // PhonePe orders: Manual refund processing required
            logger.info({
                orderId,
                orderNumber: updatedOrder.orderid,
                mode: updatedOrder.mode,
                isPaymentSucceed: updatedOrder.ispaymentsucceed
            }, 'PhonePe order cancelled. Admin must manually process refund via PhonePe portal.');
            return updatedOrder;
        }
        catch (error) {
            logger.error({ error, orderId }, 'Error cancelling order');
            throw error;
        }
    }
    /**
     * DEPRECATED: Manual refund process is now used
     *
     * This method is kept for reference purposes only.
     * Refunds are now manually processed by admins via PhonePe portal.
     *
     * @deprecated Use manual refund workflow instead
     * @see updateRefundStatus for manual refund status management
     */
    async handleCancellationRefundAndNotification(order, cancellationReason) {
        try {
            logger.info({
                orderId: order.id,
                orderNumber: order.orderid,
                mode: order.mode,
                isPaymentSucceed: order.ispaymentsucceed
            }, 'Processing cancellation refund and notification');
            // Get transaction details
            const transaction = await dynamicFindUnique('transaction', {
                merchanttransactionid: order.merchanttransactionid
            });
            if (!transaction) {
                logger.warn({
                    orderId: order.id,
                    merchantTransactionId: order.merchanttransactionid
                }, 'No transaction found for cancelled order');
                return;
            }
            const transactionData = transaction.transactiondata || {};
            const paymentMode = transactionData.mode || order.mode;
            // Determine if refund is needed
            let refundNeeded = false;
            let refundAmount = 0;
            if (paymentMode === 'phonepe') {
                // Check PhonePe payment status
                const phonePeStatus = transactionData.status;
                if (phonePeStatus === 'SUCCESS' && order.ispaymentsucceed) {
                    refundNeeded = true;
                    refundAmount = order.orderamount || 0;
                    logger.info({
                        orderId: order.id,
                        orderNumber: order.orderid,
                        refundAmount,
                        merchantTransactionId: order.merchanttransactionid
                    }, 'PhonePe payment SUCCESS - refund will be initiated');
                }
                else {
                    logger.info({
                        orderId: order.id,
                        phonePeStatus,
                        isPaymentSucceed: order.ispaymentsucceed
                    }, 'PhonePe payment not successful - no refund needed');
                }
            }
            else if (paymentMode === 'cod') {
                logger.info({
                    orderId: order.id,
                    orderNumber: order.orderid
                }, 'COD order - no refund needed, only email notification');
            }
            // TODO: Integrate with actual refund service
            if (refundNeeded) {
                logger.info({
                    orderId: order.id,
                    orderNumber: order.orderid,
                    refundAmount,
                    merchantTransactionId: order.merchanttransactionid
                }, 'REFUND INTEGRATION POINT: Initiate PhonePe refund here');
                // Example integration point:
                // await this.phonePeService.initiateRefund({
                //   merchantTransactionId: order.merchanttransactionid,
                //   amount: refundAmount,
                //   reason: cancellationReason
                // });
            }
            // TODO: Send email notification to customer
            logger.info({
                orderId: order.id,
                orderNumber: order.orderid,
                userId: order.userid,
                paymentMode,
                refundNeeded
            }, 'EMAIL INTEGRATION POINT: Send cancellation email to customer');
            // Example integration point:
            // await this.emailService.sendCancellationEmail({
            //   userId: order.userid,
            //   orderNumber: order.orderid,
            //   cancellationReason,
            //   refundAmount: refundNeeded ? refundAmount : null,
            //   expectedRefundDays: refundNeeded ? '5-7 business days' : null
            // });
            // Example integration point for push notification:
            // await this.notificationService.sendPushNotification({
            //   userId: order.userid,
            //   title: 'Order Cancelled',
            //   body: `Your order ${order.orderid} has been cancelled`,
            //   data: { orderId: order.id, refundAmount }
            // });
        }
        catch (error) {
            logger.error({
                error: error.message,
                orderId: order.id,
                orderNumber: order.orderid
            }, 'Error in handleCancellationRefundAndNotification');
            throw error;
        }
    }
    /**
     * Update refund status for cancelled orders (admin-only operation)
     * Transitions: cancelled → cancelled_refund_processing → cancelled_refunded
     * Or: cancelled → cancelled_completed (for COD orders)
     */
    async updateRefundStatus(orderId, newStatus, adminUserId, notes) {
        try {
            logger.info({
                orderId,
                newStatus,
                adminUserId,
                notes
            }, 'Updating refund status');
            // Get order
            const order = await this.findById(typeof orderId === 'string' ? parseInt(orderId) : orderId);
            if (!order) {
                throw new Error(`Order with ID ${orderId} not found`);
            }
            // Validate current status allows refund status update
            const VALID_CURRENT_STATUSES = ['cancelled', 'cancelled_refund_processing'];
            if (!order.orderstatus || !VALID_CURRENT_STATUSES.includes(order.orderstatus)) {
                throw new Error(`Cannot update refund status. Order must be in 'cancelled' or 'cancelled_refund_processing' status. ` +
                    `Current status: ${order.orderstatus || 'unknown'}`);
            }
            // Validate status progression
            if (order.orderstatus === 'cancelled_refund_processing' && newStatus === 'cancelled_refund_processing') {
                logger.warn({ orderId, newStatus }, 'Status is already cancelled_refund_processing, no change needed');
                return order;
            }
            if (order.orderstatus === 'cancelled_refunded' || order.orderstatus === 'cancelled_completed') {
                throw new Error(`Order already in final status (${order.orderstatus}). Cannot update refund status.`);
            }
            // Get all orderlines for this order
            const { OrderlineService } = await import('./orderline.service.js');
            const orderlineService = new OrderlineService();
            const { data: orderlines } = await orderlineService.findMany({ orderid: (typeof orderId === 'string' ? parseInt(orderId) : orderId).toString() }, 1, 1000);
            const currentTimestamp = Date.now();
            // Update orderlines status
            for (const orderline of orderlines) {
                await orderlineService.updateOrderlineStatus(orderline.id.toString(), newStatus, {
                    source: 'inventoryuser',
                    inventory_user_id: adminUserId,
                    refund_notes: notes
                });
            }
            // Update order status
            await this.updateOrderStatus((typeof orderId === 'string' ? parseInt(orderId) : orderId).toString(), newStatus, {
                source: 'inventoryuser',
                inventory_user_id: adminUserId,
                refund_notes: notes,
                refund_status_updated_date: currentTimestamp
            });
            // Fetch and return updated order
            const updatedOrder = await this.findById(typeof orderId === 'string' ? parseInt(orderId) : orderId);
            // UPDATE TRANSACTION TABLE
            try {
                if (updatedOrder?.merchanttransactionid) {
                    const transaction = await dynamicFindUnique('transaction', {
                        merchanttransactionid: updatedOrder.merchanttransactionid
                    });
                    if (transaction) {
                        const existingData = transaction.transactiondata || {};
                        let transactionStatus = existingData.order_status || 'UNKNOWN';
                        // Update status based on new order status
                        if (newStatus === 'cancelled_refund_processing') {
                            transactionStatus = 'REFUND_PROCESSING';
                        }
                        else if (newStatus === 'cancelled_refunded') {
                            transactionStatus = 'REFUNDED';
                        }
                        else if (newStatus === 'cancelled_completed') {
                            transactionStatus = 'CANCELLATION_COMPLETED';
                        }
                        const updatedTransactionData = {
                            ...existingData,
                            order_status: transactionStatus,
                            refund_status_updated_date: currentTimestamp,
                            refund_admin_user: adminUserId,
                            refund_notes: notes
                        };
                        await dynamicUpdate('transaction', { id: transaction.id }, {
                            transactiondata: updatedTransactionData,
                            modifieddate: currentTimestamp
                        });
                        logger.info({
                            transactionId: transaction.id,
                            merchantTransactionId: updatedOrder.merchanttransactionid,
                            newTransactionStatus: transactionStatus
                        }, 'Transaction updated with refund status progression');
                    }
                }
            }
            catch (transactionError) {
                // Log but don't fail status update if transaction update fails
                logger.error({
                    error: transactionError.message,
                    orderId,
                    merchantTransactionId: updatedOrder?.merchanttransactionid
                }, 'Failed to update transaction record for refund status');
            }
            logger.info({
                orderId,
                previousStatus: order.orderstatus,
                newStatus,
                adminUserId
            }, 'Refund status updated successfully');
            return updatedOrder;
        }
        catch (error) {
            logger.error({ error, orderId, newStatus }, 'Error updating refund status');
            throw error;
        }
    }
    /**
     * Cancel order before ready_for_dispatch
     * Reverses orderedqty → availableqty
     */
    async cancelOrderBeforeReadyForDispatch(orderId, orderlines) {
        try {
            logger.info({ orderId, orderlinesCount: orderlines.length }, 'Reversing pre-dispatch order quantities');
            const currentTimestamp = Date.now();
            // Track updates by product to avoid duplicate updates
            const platformStockUpdates = new Map();
            const productUpdates = new Map();
            for (const orderline of orderlines) {
                const productId = orderline.productid;
                const quantity = orderline.quantity || 0;
                if (!productId || quantity === 0)
                    continue;
                // Get product
                const product = await dynamicFindUnique('product', { id: Number(productId) });
                if (!product) {
                    logger.warn({ orderlineId: orderline.id, productId }, 'Product not found for orderline');
                    continue;
                }
                const platform = 'nivapp'; // Default platform
                // COMBO PRODUCT SUPPORT: Check if this is a combo product
                if (product.iscombo === true) {
                    logger.info({
                        orderlineId: orderline.id,
                        productId,
                        productName: product.name,
                        quantity
                    }, 'Detected combo product, reversing ONLY component stock (not combo itself)');
                    try {
                        // Get component products from productbundlemap
                        const components = await prisma.productBundleMap.findMany({
                            where: {
                                bundleproductid: BigInt(Number(productId)),
                                isactive: true
                            }
                        });
                        if (components.length === 0) {
                            logger.warn({
                                orderlineId: orderline.id,
                                productId,
                                productName: product.name
                            }, 'Combo product has no active components in productbundlemap');
                        }
                        // For each component, reverse the stock
                        for (const component of components) {
                            const componentProductId = Number(component.componentproductid);
                            const componentRequiredQty = component.requiredqty || 1;
                            // orderline.quantity = number of combo packs ordered
                            const componentTotalQty = componentRequiredQty * quantity;
                            logger.info({
                                orderlineId: orderline.id,
                                comboProductId: productId,
                                componentProductId,
                                requiredQtyPerCombo: componentRequiredQty,
                                comboQuantity: quantity,
                                totalComponentQty: componentTotalQty
                            }, 'Reversing component product stock');
                            // Track component PlatformStock update
                            const componentPlatformStockKey = `${componentProductId}-${platform}`;
                            if (!platformStockUpdates.has(componentPlatformStockKey)) {
                                platformStockUpdates.set(componentPlatformStockKey, {
                                    productId: componentProductId,
                                    platform,
                                    quantity: 0
                                });
                            }
                            platformStockUpdates.get(componentPlatformStockKey).quantity += componentTotalQty;
                            // Track component Product update
                            if (!productUpdates.has(componentProductId)) {
                                productUpdates.set(componentProductId, 0);
                            }
                            productUpdates.set(componentProductId, productUpdates.get(componentProductId) + componentTotalQty);
                        }
                        logger.info({
                            orderlineId: orderline.id,
                            comboProductId: productId,
                            componentsCount: components.length
                        }, 'Component stock reversal tracked for combo product (combo product itself NOT changed)');
                    }
                    catch (componentError) {
                        logger.error({
                            error: componentError.message,
                            orderlineId: orderline.id,
                            productId,
                            productName: product.name
                        }, 'Failed to reverse component stock for combo product');
                        // Don't throw - continue with other orderlines
                    }
                    // SKIP tracking the combo product itself - only components are tracked
                    continue;
                }
                // NON-COMBO PRODUCT: Track PlatformStock update
                const platformStockKey = `${productId}-${platform}`;
                if (!platformStockUpdates.has(platformStockKey)) {
                    platformStockUpdates.set(platformStockKey, {
                        productId: Number(productId),
                        platform,
                        quantity: 0
                    });
                }
                platformStockUpdates.get(platformStockKey).quantity += quantity;
                // Track Product update
                if (!productUpdates.has(productId)) {
                    productUpdates.set(productId, 0);
                }
                productUpdates.set(productId, productUpdates.get(productId) + quantity);
            }
            // Update PlatformStock quantities
            for (const [key, update] of platformStockUpdates.entries()) {
                const { data: platformStocks } = await dynamicFindManyWithFilters('platformstock', {
                    productid: update.productId.toString(),
                    platform: update.platform
                }, { take: 1, useAllColumns: true });
                if (platformStocks && platformStocks.length > 0) {
                    const platformStock = platformStocks[0];
                    // Restore availableqty, reduce orderedqty
                    const newAvailableQty = (platformStock.availableqty || 0) + update.quantity;
                    const newOrderedQty = Math.max(0, (platformStock.orderedqty || 0) - update.quantity);
                    await dynamicUpdate('platformstock', { id: platformStock.id }, {
                        availableqty: newAvailableQty,
                        orderedqty: newOrderedQty,
                        modifieddate: currentTimestamp
                    });
                    logger.info({
                        platformStockId: platformStock.id,
                        productId: update.productId,
                        platform: update.platform,
                        quantity: update.quantity,
                        oldAvailableQty: platformStock.availableqty,
                        newAvailableQty,
                        oldOrderedQty: platformStock.orderedqty,
                        newOrderedQty
                    }, 'PlatformStock quantities restored (pre-dispatch cancellation)');
                }
            }
            // Update Product quantities
            for (const [productId, quantity] of productUpdates.entries()) {
                const product = await dynamicFindUnique('product', { id: productId });
                if (product) {
                    // Restore availablequantity, reduce orderedquantity
                    const newAvailableQuantity = (product.availablequantity || 0) + quantity;
                    const newOrderedQuantity = Math.max(0, (product.orderedquantity || 0) - quantity);
                    await dynamicUpdate('product', { id: product.id }, {
                        availablequantity: newAvailableQuantity,
                        orderedquantity: newOrderedQuantity,
                        modifieddate: currentTimestamp
                    });
                    logger.info({
                        productId: product.id,
                        quantity,
                        oldAvailableQuantity: product.availablequantity,
                        newAvailableQuantity,
                        oldOrderedQuantity: product.orderedquantity,
                        newOrderedQuantity
                    }, 'Product quantities restored (pre-dispatch cancellation)');
                }
            }
            logger.info({ orderId }, 'Pre-dispatch order cancellation completed');
        }
        catch (error) {
            logger.error({ error, orderId }, 'Error in cancelOrderBeforeReadyForDispatch');
            throw error;
        }
    }
    /**
     * Cancel order after ready_for_dispatch
     * Reverses stock allocations and soldqty → availableqty
     */
    async cancelOrderAfterReadyForDispatch(orderId, orderlines) {
        try {
            logger.info({ orderId, orderlinesCount: orderlines.length }, 'Reversing post-dispatch stock allocations');
            const currentTimestamp = Date.now();
            // Track updates by product to avoid duplicate updates
            const platformStockUpdates = new Map();
            const productUpdates = new Map();
            // Get order to retrieve orderid string
            const order = await this.findById(orderId);
            if (!order) {
                throw new Error(`Order with ID ${orderId} not found`);
            }
            // Process each orderline
            for (const orderline of orderlines) {
                // Get stock records allocated to this orderline via orderid and orderlinenumber
                const { data: allocatedStocks } = await dynamicFindManyWithFilters('stock', {
                    orderid: order.orderid || orderId.toString(),
                    orderlinenumber: orderline.orderlinenumber
                }, { useAllColumns: true });
                if (!allocatedStocks || allocatedStocks.length === 0) {
                    logger.warn({
                        orderlineId: orderline.id,
                        orderid: order.orderid,
                        orderlinenumber: orderline.orderlinenumber
                    }, 'No allocated stocks found for orderline');
                    continue;
                }
                // Get product info from first stock
                const firstStock = allocatedStocks[0];
                const product = await dynamicFindUnique('product', { puc: firstStock.puc });
                if (!product) {
                    logger.warn({ puc: firstStock.puc }, 'Product not found for stock');
                    continue;
                }
                const productId = Number(product.id);
                const quantity = allocatedStocks.length;
                // Update all stock records for this orderline
                for (const stock of allocatedStocks) {
                    await dynamicUpdate('stock', { id: stock.id }, {
                        stockstatus: 'available',
                        orderid: null,
                        orderlinenumber: null,
                        solddate: null,
                        modifieddate: currentTimestamp
                    });
                    logger.info({
                        stockId: stock.id,
                        orderlineId: orderline.id,
                        orderId
                    }, 'Stock status reset to available');
                }
                // Track updates for product
                const platform = firstStock.platform || 'nivapp';
                // COMBO PRODUCT SUPPORT: Check if this is a combo product
                if (product.iscombo === true) {
                    logger.info({
                        orderlineId: orderline.id,
                        productId,
                        productName: product.name,
                        quantity: orderline.quantity
                    }, 'Detected combo product, reversing ONLY component stock allocations (not combo itself)');
                    try {
                        // Get component products from productbundlemap
                        const components = await prisma.productBundleMap.findMany({
                            where: {
                                bundleproductid: BigInt(Number(productId)),
                                isactive: true
                            }
                        });
                        if (components.length === 0) {
                            logger.warn({
                                orderlineId: orderline.id,
                                productId,
                                productName: product.name
                            }, 'Combo product has no active components in productbundlemap');
                        }
                        // For each component, reverse the soldqty
                        // Note: Component stock allocations are handled by the combo product's allocation
                        // We only need to reverse the PlatformStock and Product soldqty for components
                        for (const component of components) {
                            const componentProductId = Number(component.componentproductid);
                            const componentRequiredQty = component.requiredqty || 1;
                            // orderline.quantity represents how many combo packs were ordered
                            const componentTotalQty = componentRequiredQty * (orderline.quantity || quantity);
                            logger.info({
                                orderlineId: orderline.id,
                                comboProductId: productId,
                                componentProductId,
                                requiredQtyPerCombo: componentRequiredQty,
                                comboQuantityOrdered: orderline.quantity,
                                totalComponentQty: componentTotalQty
                            }, 'Reversing component product soldqty');
                            // Track component PlatformStock update
                            const componentPlatformStockKey = `${componentProductId}-${platform}`;
                            if (!platformStockUpdates.has(componentPlatformStockKey)) {
                                platformStockUpdates.set(componentPlatformStockKey, {
                                    productId: componentProductId,
                                    platform,
                                    quantity: 0
                                });
                            }
                            platformStockUpdates.get(componentPlatformStockKey).quantity += componentTotalQty;
                            // Track component Product update
                            if (!productUpdates.has(componentProductId)) {
                                productUpdates.set(componentProductId, 0);
                            }
                            productUpdates.set(componentProductId, productUpdates.get(componentProductId) + componentTotalQty);
                        }
                        logger.info({
                            orderlineId: orderline.id,
                            comboProductId: productId,
                            componentsCount: components.length
                        }, 'Component stock reversal tracked for combo product (post-dispatch, combo itself NOT changed)');
                    }
                    catch (componentError) {
                        logger.error({
                            error: componentError.message,
                            orderlineId: orderline.id,
                            productId,
                            productName: product.name
                        }, 'Failed to reverse component stock for combo product (post-dispatch)');
                        // Don't throw - continue with other orderlines
                    }
                    // SKIP tracking the combo product itself - only components are tracked
                    continue;
                }
                // NON-COMBO PRODUCT: Track PlatformStock update
                const platformStockKey = `${productId}-${platform}`;
                if (!platformStockUpdates.has(platformStockKey)) {
                    platformStockUpdates.set(platformStockKey, {
                        productId,
                        platform,
                        quantity: 0
                    });
                }
                platformStockUpdates.get(platformStockKey).quantity += quantity;
                // Track Product update
                if (!productUpdates.has(productId)) {
                    productUpdates.set(productId, 0);
                }
                productUpdates.set(productId, productUpdates.get(productId) + quantity);
            }
            // Update PlatformStock quantities
            for (const [key, update] of platformStockUpdates.entries()) {
                const { data: platformStocks } = await dynamicFindManyWithFilters('platformstock', {
                    productid: update.productId.toString(),
                    platform: update.platform
                }, { take: 1, useAllColumns: true });
                if (platformStocks && platformStocks.length > 0) {
                    const platformStock = platformStocks[0];
                    // Restore availableqty, reduce soldqty
                    const newAvailableQty = (platformStock.availableqty || 0) + update.quantity;
                    const newSoldQty = Math.max(0, (platformStock.soldqty || 0) - update.quantity);
                    await dynamicUpdate('platformstock', { id: platformStock.id }, {
                        availableqty: newAvailableQty,
                        soldqty: newSoldQty,
                        modifieddate: currentTimestamp
                    });
                    logger.info({
                        platformStockId: platformStock.id,
                        productId: update.productId,
                        platform: update.platform,
                        quantity: update.quantity,
                        oldAvailableQty: platformStock.availableqty,
                        newAvailableQty,
                        oldSoldQty: platformStock.soldqty,
                        newSoldQty
                    }, 'PlatformStock quantities restored (post-dispatch cancellation)');
                }
            }
            // Update Product quantities
            for (const [productId, quantity] of productUpdates.entries()) {
                const product = await dynamicFindUnique('product', { id: productId });
                if (product) {
                    // Restore availablequantity, reduce soldquantity
                    const newAvailableQuantity = (product.availablequantity || 0) + quantity;
                    const newSoldQuantity = Math.max(0, (product.soldquantity || 0) - quantity);
                    await dynamicUpdate('product', { id: product.id }, {
                        availablequantity: newAvailableQuantity,
                        soldquantity: newSoldQuantity,
                        modifieddate: currentTimestamp
                    });
                    logger.info({
                        productId: product.id,
                        quantity,
                        oldAvailableQuantity: product.availablequantity,
                        newAvailableQuantity,
                        oldSoldQuantity: product.soldquantity,
                        newSoldQuantity
                    }, 'Product quantities restored (post-dispatch cancellation)');
                }
            }
            logger.info({ orderId }, 'Post-dispatch order cancellation completed');
        }
        catch (error) {
            logger.error({ error, orderId }, 'Error in cancelOrderAfterReadyForDispatch');
            throw error;
        }
    }
}
//# sourceMappingURL=orders.service.js.map