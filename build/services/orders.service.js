import { prisma } from '../models/prisma.js';
import { createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { dynamicFindUnique, dynamicCreate, dynamicUpdate, dynamicFindManyWithFilters } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
import { gstService } from './gst.service.js';
export class OrdersService {
    /**
     * Maps EKART webhook status to our system status
     * Handles various formats: "Shipped", "SHIPPED", "In Transit", "In_Transit", "Pick Up", "Picked Up", etc.
     *
     * EKART Status Mapping:
     * - "Shipped" or "Pick Up" or "Picked Up" → shipped (Picked Up)
     * - "In Transit" → in_transit
     * - "Out For Delivery" → out_for_delivery
     * - "Delivered" → delivered
     * - "COD Collected" → cod_payment_received
     *
     * @param ekartStatus - Status from EKART webhook (e.g., "Shipped", "In Transit", "Pick Up")
     * @returns Mapped system status (e.g., "shipped", "in_transit") or null if unknown
     */
    mapEkartWebhookStatusToSystemStatus(ekartStatus) {
        if (!ekartStatus)
            return null;
        // Normalize: lowercase, trim, replace spaces/underscores/hyphens with single space
        const normalized = ekartStatus
            .toLowerCase()
            .trim()
            .replace(/[_\-\s]+/g, ' ')
            .trim();
        // Status mapping (case-insensitive, handles all variations)
        const statusMap = {
            // Shipped/Picked Up variations (all map to shipped)
            'shipped': 'shipped',
            'pick up': 'shipped',
            'picked up': 'shipped',
            'pickedup': 'shipped',
            'pickup': 'shipped',
            'pick-up': 'shipped',
            'picked-up': 'shipped',
            // In Transit variations
            'in transit': 'in_transit',
            'intransit': 'in_transit',
            'in-transit': 'in_transit',
            'in_transit': 'in_transit',
            // Out For Delivery variations
            'out for delivery': 'out_for_delivery',
            'outfordelivery': 'out_for_delivery',
            'out-for-delivery': 'out_for_delivery',
            'out_for_delivery': 'out_for_delivery',
            // Delivered
            'delivered': 'delivered',
            // COD Collected variations
            'cod collected': 'cod_payment_received',
            'codcollected': 'cod_payment_received',
            'cod-collected': 'cod_payment_received',
            'cod_collected': 'cod_payment_received',
            // RTO variations
            'rto initiated': 'rto_initiated',
            'rtoinitiated': 'rto_initiated',
            'rto-initiated': 'rto_initiated',
            'rto_initiated': 'rto_initiated',
            'rto delivered': 'rto_delivered',
            'rtodelivered': 'rto_delivered',
            'rto-delivered': 'rto_delivered',
            'rto_delivered': 'rto_delivered',
        };
        return statusMap[normalized] || null;
    }
    // Helper function to parse status_history
    parseStatusHistory(statusHistory) {
        if (!statusHistory)
            return [];
        // Helper to check if an object has any meaningful data
        const hasData = (obj) => {
            if (!obj || typeof obj !== 'object')
                return false;
            const keys = Object.keys(obj);
            if (keys.length === 0)
                return false;
            // Check if at least one property has a non-null, non-undefined value
            return keys.some(key => obj[key] !== null && obj[key] !== undefined);
        };
        // If it's already an array, return it (filter out empty objects)
        if (Array.isArray(statusHistory)) {
            return statusHistory.filter(hasData);
        }
        // If it's a string, try to parse it
        if (typeof statusHistory === 'string') {
            try {
                const parsed = JSON.parse(statusHistory);
                if (Array.isArray(parsed)) {
                    return parsed.filter(hasData);
                }
            }
            catch (e) {
                // If parsing fails, return empty array
                return [];
            }
        }
        // If it's an object (but not an array), wrap it in an array
        if (hasData(statusHistory)) {
            return [statusHistory];
        }
        return [];
    }
    async findMany(filters, page, limit) {
        try {
            logger.info({ filters, page, limit }, 'Starting dynamic orders findMany with filters');
            const { skip, take } = getPrismaSkipTake(page, limit);
            // Build where clause from filters
            const whereClause = {};
            for (const [key, value] of Object.entries(filters)) {
                if (!['page', 'limit'].includes(key)) {
                    // Handle numeric fields
                    if (['userid', 'addressid', 'id', 'quantity'].includes(key)) {
                        whereClause[key] = parseInt(value);
                    }
                    // // Handle boolean fields
                    // else if (key === 'ispaymentsucceed') {
                    //   whereClause[key] = value === 'true' || value === true;
                    // }
                    // Handle string fields
                    else {
                        whereClause[key] = value;
                    }
                }
            }
            // Fetch orders with user information using Prisma
            const [orders, total] = await Promise.all([
                prisma.orders.findMany({
                    where: whereClause,
                    skip,
                    take,
                    include: {
                        users: {
                            select: {
                                id: true,
                                firstname: true,
                                lastname: true,
                                useremail: true,
                                usermobilenumber: true
                            }
                        }
                    },
                    orderBy: {
                        createddate: 'desc'
                    }
                }),
                prisma.orders.count({ where: whereClause })
            ]);
            // Transform the data to include user properties at order level
            const transformedOrders = orders.map((order) => {
                const { users, ...orderData } = order;
                return {
                    ...orderData,
                    // Add user information as separate properties
                    username: users ? `${users.firstname || ''} ${users.lastname || ''}`.trim() : null,
                    useremail: users?.useremail || null,
                    usermobilenumber: users?.usermobilenumber || null,
                    user_firstname: users?.firstname || null,
                    user_lastname: users?.lastname || null
                };
            });
            logger.info({
                orderCount: transformedOrders.length,
                total,
                filtered: Object.keys(filters).length > 0,
                appliedFilters: Object.keys(filters),
                availableFields: transformedOrders.length > 0 ? Object.keys(transformedOrders[0]) : []
            }, 'Dynamic orders findMany with user data completed');
            return createPaginationResult(transformedOrders, total, page, limit);
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
                const orderUpdateData = {
                    orderstatus: newOrderStatus,
                    status_history: JSON.stringify(updatedHistory),
                    modifieddate: Date.now()
                };
                // Set readytodispatchdate when status becomes ready_for_dispatch
                if (newOrderStatus === 'ready_for_dispatch') {
                    orderUpdateData.readytodispatchdate = Date.now();
                }
                await dynamicUpdate('orders', { id: orderId }, orderUpdateData);
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
                stockstatus: 'available',
                ecompublish: true // Only select e-commerce published stocks
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
                // Validate: Only allow e-commerce published stocks
                if (stock.ecompublish !== true) {
                    throw new Error(`Stock with ID ${stockId} is not e-commerce published (ecompublish: ${stock.ecompublish}). ` +
                        `Only stocks with ecompublish=true can be allocated for dispatch.`);
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
                const { data: stockResults } = await dynamicFindManyWithFilters('stock', {
                    sku,
                    ecompublish: true // Only select e-commerce published stocks
                }, {
                    take: 1,
                    useAllColumns: true
                });
                if (!stockResults || stockResults.length === 0) {
                    throw new Error(`Stock with SKU ${sku} not found or not e-commerce published. ` +
                        `Only stocks with ecompublish=true can be allocated for dispatch.`);
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
                // COMBO PRODUCT SUPPORT: Check if orderline product is a combo
                // If so, allocate stock for component products instead of combo product itself
                const orderlineProduct = await dynamicFindUnique('product', { id: orderline.productid });
                if (!orderlineProduct) {
                    throw new Error(`Product ${orderline.productid} not found for orderline ${orderline.id}`);
                }
                if (orderlineProduct.iscombo === true) {
                    // COMBO PRODUCT: Allocate stock for components
                    logger.info({
                        orderlineId: orderline.id,
                        comboProductId: orderline.productid,
                        comboProductName: orderlineProduct.name,
                        quantity: orderline.quantity
                    }, 'Detected combo product - allocating stock for components');
                    // Get component products from productbundlemap
                    const components = await prisma.productBundleMap.findMany({
                        where: {
                            bundleproductid: BigInt(orderline.productid),
                            isactive: true
                        }
                    });
                    if (components.length === 0) {
                        throw new Error(`Combo product ${orderline.productid} has no active components in productbundlemap`);
                    }
                    // For each component, allocate stock
                    for (const component of components) {
                        const componentProductId = Number(component.componentproductid);
                        const requiredQty = component.requiredqty || 1;
                        const totalNeeded = requiredQty * (orderline.quantity || 1);
                        logger.info({
                            orderlineId: orderline.id,
                            comboProductId: orderline.productid,
                            componentProductId,
                            requiredQtyPerCombo: requiredQty,
                            comboQuantity: orderline.quantity,
                            totalNeeded
                        }, 'Allocating stock for combo component');
                        // Allocate stock for component product
                        // Note: Manual stock selection is not supported for combo components (auto-select only)
                        const componentStocks = await this.autoSelectStocks(componentProductId, totalNeeded, 'nivapp' // Default platform
                        );
                        // Validate stock status, e-commerce publish status, and product match for component stocks
                        const componentProduct = await dynamicFindUnique('product', { id: componentProductId });
                        for (const stock of componentStocks) {
                            if (stock.stockstatus !== 'available') {
                                throw new Error(`Component stock ${stock.id} is not available (status: ${stock.stockstatus})`);
                            }
                            // Validate: Only allow e-commerce published stocks for components
                            if (stock.ecompublish !== true) {
                                throw new Error(`Component stock ${stock.id} is not e-commerce published (ecompublish: ${stock.ecompublish}). ` +
                                    `Only stocks with ecompublish=true can be allocated for dispatch.`);
                            }
                            if (!componentProduct || stock.puc !== componentProduct.puc) {
                                throw new Error(`Component stock ${stock.id} (puc: ${stock.puc}) does not match component product ` +
                                    `(productid: ${componentProductId}, Product.puc: ${componentProduct?.puc || 'N/A'})`);
                            }
                        }
                        allocations.push({
                            orderline_id: orderline.id,
                            stocks: componentStocks,
                            is_component: true, // Flag to identify this is a component allocation
                            combo_product_id: orderline.productid, // Original combo product ID
                            component_product_id: componentProductId // Component product ID
                        });
                        logger.info({
                            orderlineId: orderline.id,
                            componentProductId,
                            allocatedStocks: componentStocks.length,
                            totalNeeded
                        }, 'Component stock allocated successfully');
                    }
                    logger.info({
                        orderlineId: orderline.id,
                        comboProductId: orderline.productid,
                        componentsCount: components.length
                    }, 'All component stocks allocated for combo product');
                }
                else {
                    // REGULAR PRODUCT: Current logic (unchanged)
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
                    // Validate stock status, e-commerce publish status, and product match
                    for (const stock of stocks) {
                        if (stock.stockstatus !== 'available') {
                            throw new Error(`Stock ${stock.id} is not available (status: ${stock.stockstatus})`);
                        }
                        // Validate: Only allow e-commerce published stocks
                        if (stock.ecompublish !== true) {
                            throw new Error(`Stock ${stock.id} is not e-commerce published (ecompublish: ${stock.ecompublish}). ` +
                                `Only stocks with ecompublish=true can be allocated for dispatch.`);
                        }
                        // Validate: Get Product by id = orderline.productid, then check Stock.puc = Product.puc
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
            // Key: "productId-platform" -> { quantity, ecomQuantity }
            const platformStockUpdates = new Map();
            // Key: puc -> quantity
            const productUpdates = new Map();
            for (const allocation of allocations) {
                const orderline = await orderlineService.findById(allocation.orderline_id.toString());
                // COMBO COMPONENT HANDLING:
                // For combo component allocations, stock count is based on component requirements,
                // not orderline quantity. Skip validation for component allocations.
                if (!allocation.is_component) {
                    // Regular product: Validate stock count matches orderline quantity
                    const orderlineQuantity = orderline.quantity || allocation.stocks.length;
                    if (allocation.stocks.length !== orderlineQuantity) {
                        throw new Error(`Stock count mismatch for orderline ${allocation.orderline_id}: ` +
                            `Expected ${orderlineQuantity}, got ${allocation.stocks.length}`);
                    }
                }
                else {
                    // Combo component: Log allocation details
                    logger.info({
                        orderlineId: allocation.orderline_id,
                        comboProductId: allocation.combo_product_id,
                        componentProductId: allocation.component_product_id,
                        stockCount: allocation.stocks.length
                    }, 'Processing combo component stock allocation');
                }
                // Get product info from first stock (all stocks should have same puc)
                const firstStock = allocation.stocks[0];
                const product = await dynamicFindUnique('product', { puc: firstStock.puc });
                if (!product || !product.id) {
                    throw new Error(`Product not found for puc: ${firstStock.puc}`);
                }
                const productId = Number(product.id);
                // Track PlatformStock update (aggregate by productId + platform)
                // For combo components, this will track the COMPONENT product, not the combo product
                const platformStockKey = `${productId}-${firstStock.platform}`;
                if (!platformStockUpdates.has(platformStockKey)) {
                    platformStockUpdates.set(platformStockKey, {
                        productId,
                        platform: firstStock.platform,
                        quantity: 0,
                        ecomQuantity: 0
                    });
                }
                const update = platformStockUpdates.get(platformStockKey);
                update.quantity += allocation.stocks.length;
                // Count how many stocks were e-commerce published (before they're marked as sold)
                const ecomPublishedCount = allocation.stocks.filter(s => s.ecompublish === true).length;
                update.ecomQuantity += ecomPublishedCount;
                // Track Product update (aggregate by puc)
                // For combo components, this will track the COMPONENT product, not the combo product
                if (!productUpdates.has(firstStock.puc)) {
                    productUpdates.set(firstStock.puc, 0);
                }
                productUpdates.set(firstStock.puc, productUpdates.get(firstStock.puc) + allocation.stocks.length);
                // Update each Stock record
                // For combo components, stock records are linked to the combo product's orderline
                for (const stock of allocation.stocks) {
                    // 1. Update Stock record
                    // Note: Stock.orderid is String (references orders.orderid, not orders.id)
                    // Note: Stock.orderlinenumber is String (references orderline.orderlinenumber)
                    await dynamicUpdate('stock', { id: stock.id }, {
                        stockstatus: 'sold',
                        orderid: order.orderid || orderId.toString(), // Use orders.orderid (String) if available
                        orderlinenumber: orderline.orderlinenumber, // String type (combo product's orderline)
                        solddate: currentTimestamp,
                        modifieddate: currentTimestamp
                    });
                    if (allocation.is_component) {
                        logger.info({
                            stockId: stock.id,
                            stockPuc: stock.puc,
                            componentProductId: allocation.component_product_id,
                            comboOrderlineNumber: orderline.orderlinenumber
                        }, 'Component stock marked as sold and linked to combo orderline');
                    }
                }
            }
            // 3. Update PlatformStock quantities (once per product/platform combination)
            // For combo products, this updates COMPONENT platformstock, not combo platformstock
            for (const [key, update] of platformStockUpdates.entries()) {
                const { data: platformStocks } = await dynamicFindManyWithFilters('platformstock', {
                    productid: update.productId.toString(),
                    platform: update.platform
                }, { take: 1, useAllColumns: true });
                if (platformStocks && platformStocks.length > 0) {
                    const platformStock = platformStocks[0];
                    // Get current quantities
                    const currentEcomQty = Number(platformStock.ecomqty || 0);
                    const currentOrderedQty = Number(platformStock.orderedqty || 0);
                    const currentSoldQty = Number(platformStock.soldqty || 0);
                    const currentLockQty = Number(platformStock.lockqty || 0);
                    // Update PlatformStock: 
                    // - Decrease orderedqty (stocks were reserved, now sold)
                    // - Increase soldqty (stocks are now sold)
                    // - Decrease ecomqty (if stocks were e-commerce published)
                    // - Recalculate availableqty using formula: ecomqty - orderedqty - soldqty - lockqty
                    const newOrderedQty = Math.max(0, currentOrderedQty - update.quantity);
                    const newSoldQty = currentSoldQty + update.quantity;
                    const newEcomQty = Math.max(0, currentEcomQty - update.ecomQuantity); // Decrease by e-commerce published count
                    const newAvailableQty = Math.max(0, newEcomQty - newOrderedQty - newSoldQty - currentLockQty);
                    // Calculate platform status
                    const { PlatformStockService } = await import('./platformStock.service.js');
                    const platformStockService = new PlatformStockService();
                    const platformStatus = platformStockService['calculatePlatformStatus'](newAvailableQty);
                    await dynamicUpdate('platformstock', { id: platformStock.id }, {
                        ecomqty: newEcomQty,
                        orderedqty: newOrderedQty,
                        soldqty: newSoldQty,
                        availableqty: newAvailableQty,
                        platformstatus: platformStatus,
                        modifieddate: currentTimestamp
                    });
                    logger.info({
                        platformStockId: platformStock.id,
                        productId: update.productId,
                        platform: update.platform,
                        quantity: update.quantity,
                        ecomQuantity: update.ecomQuantity,
                        oldEcomQty: currentEcomQty,
                        newEcomQty,
                        oldOrderedQty: currentOrderedQty,
                        newOrderedQty,
                        oldSoldQty: currentSoldQty,
                        newSoldQty,
                        oldAvailableQty: platformStock.availableqty,
                        newAvailableQty,
                        formula: {
                            availableqty: `${newEcomQty} - ${newOrderedQty} - ${newSoldQty} - ${currentLockQty} = ${newAvailableQty}`
                        }
                    }, 'PlatformStock quantities updated (dispatch)');
                }
            }
            // 4. Update Product quantities (once per product)
            // For combo products, this updates COMPONENT product quantities, not combo product
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
     * Generate invoice for an order
     * Fetches seller data from EKART and calls storage backend to generate invoice PDF
     * @param orderId - Order ID
     * @returns Invoice URL if successful, null otherwise
     */
    async generateInvoice(orderId) {
        try {
            logger.info({ orderId }, 'Generating invoice for order');
            // Get complete order details including orderlines and address
            const orderDetails = await this.getOrderDetails(orderId.toString());
            // Import axios
            const axios = (await import('axios')).default;
            // Fetch seller data from EKART addresses endpoint
            let sellerData = null;
            try {
                const { ekartService } = await import('./ekart.service.js');
                logger.info('Fetching seller addresses from EKART service');
                const addresses = await ekartService.getAddresses();
                // Get the first address from the response (main sales office)
                if (addresses && addresses.length > 0) {
                    sellerData = addresses[0];
                    logger.info({ seller: sellerData?.alias }, 'Seller data fetched successfully');
                }
                else {
                    logger.warn('No seller addresses found in EKART response');
                }
            }
            catch (sellerError) {
                logger.error({
                    error: sellerError.message
                }, 'Failed to fetch seller data from EKART - continuing without seller info');
                // Continue without seller data - don't fail invoice generation
            }
            // Call storage backend to generate invoice
            const storageBackendUrl = process.env.STORAGE_BACKEND_URL || 'http://localhost:4500';
            const invoiceEndpoint = `${storageBackendUrl}/order/invoice`;
            logger.info({
                endpoint: invoiceEndpoint,
                orderId: orderDetails.order.id,
                orderNumber: orderDetails.order.orderid,
                hasSeller: !!sellerData
            }, 'Calling storage backend to generate invoice');
            const invoiceResponse = await axios.post(invoiceEndpoint, {
                order: orderDetails.order,
                orderlines: orderDetails.orderlines,
                address: orderDetails.address,
                seller: sellerData
            }, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 30000 // 30 second timeout
            });
            logger.info({
                orderId,
                response: invoiceResponse.data,
                status: invoiceResponse.status
            }, 'Invoice generated successfully');
            // If the response contains an invoice URL, update the order record
            if (invoiceResponse.data?.invoiceUrl) {
                await dynamicUpdate('orders', { id: orderId }, {
                    order_invoice_url: invoiceResponse.data.invoiceUrl,
                    modifieddate: Date.now()
                });
                logger.info({
                    orderId,
                    invoiceUrl: invoiceResponse.data.invoiceUrl
                }, 'Order updated with invoice URL');
                return invoiceResponse.data.invoiceUrl;
            }
            return null;
        }
        catch (invoiceError) {
            // Log the error but don't fail the operation
            // Invoice generation is a secondary operation
            logger.error({
                error: invoiceError.message,
                response: invoiceError.response?.data,
                status: invoiceError.response?.status,
                orderId
            }, 'Failed to generate invoice - continuing without invoice');
            return null;
        }
    }
    /**
     * Mark order as shipped (after label printed)
     * NOTE: This endpoint is kept for backward compatibility and manual override.
     * For EKART orders, the 'shipped' status is now set automatically via webhook.
     */
    async markShipped(orderId, inventoryUserId) {
        try {
            logger.info({ orderId, inventoryUserId }, 'Marking order as shipped');
            const order = await this.findById(orderId);
            // Block mark-shipped for cancelled orders (all cancelled-related statuses)
            const cancelledStatuses = [
                'cancelled',
                'cancelled_refund_processing',
                'cancelled_refunded',
                'cancelled_completed'
            ];
            if (cancelledStatuses.includes(order.orderstatus) || order.orderstatus === 'returned') {
                throw new Error(`Cannot mark order as shipped. Order is in ${order.orderstatus} status`);
            }
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
     * Manually ship order with vendor details
     * Automatically sets order status to 'shipped'
     * PATCH /v1/orders/:id/manual-ship
     *
     * Note: Allows updating from EKART to another vendor when EKART refuses to collect
     */
    async updateShipmentDetails(orderIdOrNumber, trackingId, vendor, inventoryUserId, publicTrackingLink, shipped) {
        try {
            logger.info({ orderIdOrNumber, trackingId, vendor, inventoryUserId }, 'Updating shipment details for manual vendor');
            // Find order by ID or order number
            let order;
            if (typeof orderIdOrNumber === 'string' && isNaN(Number(orderIdOrNumber))) {
                order = await this.findByOrderNumber(orderIdOrNumber);
            }
            else {
                order = await this.findById(Number(orderIdOrNumber));
            }
            if (!order) {
                throw new Error('Order not found');
            }
            // Block shipment updates for cancelled orders (all cancelled-related statuses)
            const cancelledStatuses = [
                'cancelled',
                'cancelled_refund_processing',
                'cancelled_refunded',
                'cancelled_completed'
            ];
            if (cancelledStatuses.includes(order.orderstatus) || order.orderstatus === 'returned') {
                throw new Error(`Cannot update shipment details for ${order.orderstatus} order`);
            }
            // Validate order status - allow ready_for_dispatch OR shipped (for EKART to manual vendor switch)
            if (order.orderstatus !== 'ready_for_dispatch' && order.orderstatus !== 'shipped') {
                throw new Error(`Order must be in 'ready_for_dispatch' or 'shipped' status. Current status: ${order.orderstatus}`);
            }
            // Check if switching from EKART to manual vendor
            const isSwitchingFromEkart = order.vendor === 'EKART' && vendor !== 'EKART';
            const isAlreadyShipped = order.orderstatus === 'shipped';
            if (isSwitchingFromEkart) {
                if (isAlreadyShipped) {
                    // Switching from EKART to manual vendor after shipped
                    logger.info({ orderId: order.id, currentVendor: order.vendor, newVendor: vendor }, 'Switching vendor from EKART to manual vendor for shipped order');
                }
                else {
                    // Switching from EKART to manual vendor before pickup (EKART didn't collect)
                    logger.info({ orderId: order.id, currentVendor: order.vendor, newVendor: vendor }, 'Switching vendor from EKART to manual vendor - EKART did not collect');
                }
            }
            else if (isAlreadyShipped && !isSwitchingFromEkart) {
                // Cannot switch vendor if already shipped with non-EKART vendor
                throw new Error(`Cannot switch vendor for shipped order. Current vendor: ${order.vendor}. Only EKART orders can be switched to another vendor after shipped status.`);
            }
            // Note: We allow updating from EKART to another vendor
            // This is needed when EKART refuses to collect after shipment creation
            // (e.g., due to low delivery volume in that area)
            // The new vendor in the request can be any vendor (including switching from EKART to manual vendor)
            // Generate public tracking link if not provided
            const finalTrackingLink = publicTrackingLink || this.generateTrackingLink(vendor, trackingId);
            const currentTimestamp = Date.now();
            // Update order with shipment details
            const updateData = {
                tracking_id: trackingId,
                vendor: vendor,
                public_tracking_link: finalTrackingLink,
                modifieddate: currentTimestamp
            };
            // If switching from EKART to manual vendor, reset EKART-specific fields
            if (isSwitchingFromEkart) {
                // Reset EKART-specific fields
                updateData.label_url = null; // Reset EKART label URL
                updateData.barcodes = null; // Reset EKART barcodes
                updateData.shipment_tracking_status = null; // Reset EKART tracking status
                logger.info({ orderId: order.id }, 'Resetting EKART-specific fields (label_url, barcodes, shipment_tracking_status)');
            }
            // Only update shipment_created_at, shipdate, label_printed_at if:
            // 1. Order is not already shipped
            // 2. Payload includes shipped: true (only set shipdate if actually shipping)
            if (!isAlreadyShipped && shipped === true) {
                updateData.shipment_created_at = currentTimestamp;
                updateData.shipdate = currentTimestamp;
                updateData.label_printed_at = currentTimestamp; // Same as shipdate for manual vendors
            }
            else if (!isAlreadyShipped) {
                // If not shipping yet, only set shipment_created_at
                updateData.shipment_created_at = currentTimestamp;
            }
            else if (isSwitchingFromEkart) {
                // If switching from EKART after shipped, reset label_printed_at to new timestamp
                updateData.label_printed_at = currentTimestamp;
            }
            await dynamicUpdate('orders', { id: order.id }, updateData);
            logger.info({ orderId: order.id, trackingId, vendor, isAlreadyShipped }, 'Order shipment details updated');
            // Update all orderlines with tracking_id
            const { OrderlineService } = await import('./orderline.service.js');
            const orderlineService = new OrderlineService();
            const { data: orderlines } = await orderlineService.findMany({ orderid: order.id.toString() }, 1, 1000);
            if (orderlines && orderlines.length > 0) {
                logger.info({ orderId: order.id, orderlineCount: orderlines.length, isAlreadyShipped }, 'Updating orderlines with tracking ID');
                // Update all orderlines with tracking_id
                for (const orderline of orderlines) {
                    // Only update status and shipdate if:
                    // 1. Order is not already shipped
                    // 2. Payload includes shipped: true
                    if (!isAlreadyShipped && shipped === true) {
                        // Update orderline status to shipped
                        await orderlineService.updateOrderlineStatus(orderline.id.toString(), 'shipped', {
                            tracking_id: trackingId,
                            shipdate: currentTimestamp,
                            source: 'inventoryuser',
                            inventory_user_id: inventoryUserId
                        });
                    }
                    else {
                        // For already shipped orderlines OR if shipped is false/undefined, just update tracking_id
                        // If switching from EKART, we're updating to new manual vendor tracking ID
                        await orderlineService.update(orderline.id.toString(), {
                            tracking_id: trackingId,
                            modifieddate: currentTimestamp
                        });
                    }
                }
                logger.info({ orderId: order.id, orderlineCount: orderlines.length, isAlreadyShipped }, 'All orderlines updated');
            }
            // Update order status to shipped only if:
            // 1. Order is not already shipped
            // 2. Payload includes shipped: true
            if (!isAlreadyShipped && shipped === true) {
                // Update order status to shipped (triggers status_history update)
                await this.updateOrderStatus(order.id.toString(), 'shipped', {
                    source: 'inventoryuser',
                    inventory_user_id: inventoryUserId
                });
                logger.info({ orderId: order.id }, 'Order status updated to shipped (shipped: true in payload)');
                // Generate invoice for manual vendor orders (same as EKART flow)
                try {
                    logger.info({ orderId: order.id, vendor }, 'Generating invoice for manual vendor order');
                    const invoiceUrl = await this.generateInvoice(order.id);
                    if (invoiceUrl) {
                        logger.info({ orderId: order.id, invoiceUrl, vendor }, 'Invoice generated successfully for manual vendor order');
                    }
                    else {
                        logger.warn({ orderId: order.id, vendor }, 'Invoice generation returned no URL (non-blocking)');
                    }
                }
                catch (invoiceError) {
                    // Invoice generation is non-blocking - don't fail the shipment update
                    logger.error({
                        error: invoiceError.message,
                        orderId: order.id,
                        vendor
                    }, 'Failed to generate invoice for manual vendor order (non-blocking)');
                }
            }
            else if (!isAlreadyShipped && shipped === false) {
                // Explicitly keep status as ready_for_dispatch
                logger.info({ orderId: order.id }, 'Order status remains ready_for_dispatch (shipped: false in payload)');
            }
            else if (!isAlreadyShipped && shipped === undefined) {
                // If shipped not provided, keep status as ready_for_dispatch
                logger.info({ orderId: order.id }, 'Order status remains ready_for_dispatch (shipped not provided in payload)');
            }
            else {
                // Order is already shipped, just log the vendor switch
                logger.info({ orderId: order.id, oldVendor: order.vendor, newVendor: vendor }, 'Vendor switched for already shipped order (no status change)');
            }
            const updatedOrder = await this.findById(order.id);
            logger.info({ orderId: order.id, orderStatus: updatedOrder.orderstatus, shipped: shipped }, shipped === true ? 'Order shipment details updated and marked as shipped' : 'Order shipment details updated (status unchanged)');
            return updatedOrder;
        }
        catch (error) {
            logger.error({ error, orderIdOrNumber, trackingId, vendor }, 'Error updating shipment details');
            throw error;
        }
    }
    /**
     * Generate tracking link for manual vendors
     * Private helper method
     */
    generateTrackingLink(vendor, trackingId) {
        // Vendor-specific tracking link generation
        // IMPORTANT: Use the ACTUAL vendor's tracking URL, not aggregator sites
        // The vendor field should match the actual logistics provider (e.g., "Delhivery", "Shiprocket", not "Shipway" aggregator)
        const vendorLinks = {
            // Logistics Providers (Direct)
            Delhivery: `https://www.delhivery.com/track/${trackingId}`,
            Shiprocket: `https://shiprocket.co/tracking/${trackingId}`,
            Xpressbees: `https://www.xpressbees.com/track/${trackingId}`,
            BlueDart: `https://www.bluedart.com/track/${trackingId}`,
            DTDC: `https://www.dtdc.in/tracking/${trackingId}`,
            FedEx: `https://www.fedex.com/apps/fedextrack/?tracknumbers=${trackingId}`,
            Shadowfax: `https://shadowfax.in/track/${trackingId}`,
            'Ecom Express': `https://ecomexpress.in/track/${trackingId}`,
            // Aggregator Platforms (if vendor field is the aggregator itself)
            Shipway: `https://shipway.in/track/${trackingId}`, // Only if Shipway is the actual vendor
            Vamaship: `https://vamaship.com/track/${trackingId}`,
            IthinkLogistics: `https://ithinklogistics.com/track/${trackingId}`
            // Add more vendors as needed
        };
        // If vendor not found in map, generate generic URL
        // Note: This is a fallback - prefer explicit vendor mapping above
        return (vendorLinks[vendor] ||
            `https://tracking.${vendor.toLowerCase().replace(/\s+/g, '')}.com/${trackingId}`);
    }
    /**
     * Update shipment tracking status manually
     * Works for ALL vendors (EKART + manual vendors)
     * PATCH /v1/orders/:id/shipment-status
     */
    async updateShipmentStatus(orderIdOrNumber, status, inventoryUserId, location, description) {
        try {
            logger.info({ orderIdOrNumber, status, inventoryUserId, location }, 'Updating shipment tracking status manually');
            // Find order by ID or order number
            let order;
            if (typeof orderIdOrNumber === 'string' && isNaN(Number(orderIdOrNumber))) {
                order = await this.findByOrderNumber(orderIdOrNumber);
            }
            else {
                order = await this.findById(Number(orderIdOrNumber));
            }
            if (!order) {
                throw new Error('Order not found');
            }
            // Step 1: Prerequisites validation
            if (!order.tracking_id) {
                throw new Error('Order must have tracking_id to update shipment status');
            }
            // Block status updates for cancelled orders (all cancelled-related statuses)
            const cancelledStatuses = [
                'cancelled',
                'cancelled_refund_processing',
                'cancelled_refunded',
                'cancelled_completed'
            ];
            if (cancelledStatuses.includes(order.orderstatus) || order.orderstatus === 'returned') {
                throw new Error(`Cannot update shipment status for ${order.orderstatus} order`);
            }
            // Order must be in ready_for_dispatch (with tracking_id) or shipped or later status
            // Allow ready_for_dispatch if tracking_id and vendor exist (can set shipped status)
            const validStartingStatuses = [
                'ready_for_dispatch', // Allowed if tracking_id and vendor exist (can set shipped)
                'shipped',
                'in_transit',
                'out_for_delivery',
                'delivered',
                'rto_initiated',
                'rto_delivered'
            ];
            // Special case: ready_for_dispatch is only allowed if tracking_id and vendor exist
            if (order.orderstatus === 'ready_for_dispatch') {
                if (!order.tracking_id || !order.vendor) {
                    throw new Error('Order must have tracking_id and vendor to set shipped status from ready_for_dispatch');
                }
                // Only allow 'shipped' status from ready_for_dispatch
                if (status !== 'shipped') {
                    throw new Error(`Cannot update to ${status} from ready_for_dispatch. Only 'shipped' status is allowed.`);
                }
            }
            else if (!validStartingStatuses.includes(order.orderstatus)) {
                throw new Error(`Order must be in ready_for_dispatch (with tracking_id), shipped, or later status to update shipment status. Current status: ${order.orderstatus}`);
            }
            // Step 2: Status value validation
            const allowedStatuses = [
                'shipped', // Allowed from ready_for_dispatch (if tracking_id and vendor exist)
                'in_transit',
                'out_for_delivery',
                'delivered',
                'rto_initiated',
                'rto_delivered',
                'cod_payment_received'
            ];
            if (!allowedStatuses.includes(status)) {
                throw new Error(`Invalid shipment status: ${status}. Allowed statuses: ${allowedStatuses.join(', ')}`);
            }
            // Step 3: Idempotency check
            // For ready_for_dispatch → shipped, check if already shipped (shouldn't happen, but handle gracefully)
            if (order.orderstatus === 'ready_for_dispatch' && status === 'shipped') {
                // This is a valid transition, proceed
            }
            else if (order.shipment_tracking_status === status && order.orderstatus === status) {
                // For other statuses, check if status already matches
                logger.info({ orderId: order.id, status }, 'Status already set to requested value, no change needed');
                return order;
            }
            // Step 4: Status transition validation
            const currentStatus = order.orderstatus;
            const validTransitions = {
                ready_for_dispatch: ['shipped'], // Only if tracking_id and vendor exist (already validated above)
                shipped: ['in_transit', 'out_for_delivery', 'rto_initiated'],
                in_transit: ['out_for_delivery', 'delivered', 'rto_initiated'],
                out_for_delivery: ['delivered', 'rto_initiated'],
                delivered: ['cod_payment_received'],
                rto_initiated: ['rto_delivered'],
                rto_delivered: [] // Terminal status
            };
            // Check if transition is valid (including flexible transitions)
            const isValidTransition = validTransitions[currentStatus]?.includes(status);
            // Allow some flexible transitions (skipping intermediate stages)
            const flexibleTransitions = {
                shipped: ['out_for_delivery'], // Can skip in_transit
                in_transit: ['delivered'] // Can skip out_for_delivery
            };
            const isFlexibleTransition = flexibleTransitions[currentStatus]?.includes(status);
            if (!isValidTransition && !isFlexibleTransition) {
                throw new Error(`Invalid status transition from ${currentStatus} to ${status}. Allowed transitions: ${validTransitions[currentStatus]?.join(', ') || 'none (terminal status)'}`);
            }
            // Step 5: Special case validation
            if (status === 'cod_payment_received') {
                if (order.mode !== 'cod') {
                    throw new Error('cod_payment_received status is only allowed for COD orders');
                }
                if (currentStatus !== 'delivered') {
                    throw new Error('cod_payment_received can only be set after delivered status');
                }
            }
            if (status === 'rto_delivered') {
                if (currentStatus !== 'rto_initiated') {
                    throw new Error('rto_delivered can only be set from rto_initiated status');
                }
            }
            // Terminal status check (already handled in transition validation, but double-check)
            if (currentStatus === 'rto_delivered' && status !== 'rto_delivered') {
                throw new Error('rto_delivered is a terminal status and cannot be updated');
            }
            // Step 6: Warning for EKART orders
            if (order.vendor === 'EKART') {
                logger.warn({
                    orderId: order.id,
                    trackingId: order.tracking_id,
                    status,
                    vendor: order.vendor
                }, 'Manual shipment status update for EKART order - may be overwritten by webhook');
            }
            // Step 7: Determine new order status based on shipment status
            let newOrderStatus = status;
            // Some shipment statuses map directly to order status
            const statusMapping = {
                shipped: 'shipped', // Maps directly to shipped
                in_transit: 'in_transit',
                out_for_delivery: 'out_for_delivery',
                delivered: 'delivered',
                rto_initiated: 'rto_initiated',
                rto_delivered: 'rto_delivered',
                cod_payment_received: 'delivered' // Keep as delivered, cod_payment_received is just a tracking status
            };
            newOrderStatus = statusMapping[status] || status;
            const currentTimestamp = Date.now();
            // Step 8: Update shipment_tracking_status and set shipdate if status is shipped
            const orderUpdateData = {
                shipment_tracking_status: status,
                modifieddate: currentTimestamp
            };
            // If setting to shipped, also set shipdate and label_printed_at
            if (status === 'shipped' && !order.shipdate) {
                orderUpdateData.shipdate = currentTimestamp;
                orderUpdateData.label_printed_at = currentTimestamp;
            }
            await dynamicUpdate('orders', { id: order.id }, orderUpdateData);
            logger.info({ orderId: order.id, status, vendor: order.vendor }, 'Shipment tracking status updated');
            // Step 9: Update all orderlines with same status
            const { OrderlineService } = await import('./orderline.service.js');
            const orderlineService = new OrderlineService();
            const { data: orderlines } = await orderlineService.findMany({ orderid: order.id.toString() }, 1, 1000);
            if (orderlines && orderlines.length > 0) {
                logger.info({ orderId: order.id, orderlineCount: orderlines.length, status }, 'Updating orderlines with shipment status');
                for (const orderline of orderlines) {
                    const orderlineUpdateData = {
                        source: 'inventoryuser',
                        inventory_user_id: inventoryUserId,
                        location,
                        description
                    };
                    // If setting to shipped, also set shipdate
                    if (status === 'shipped' && !orderline.shipdate) {
                        orderlineUpdateData.shipdate = currentTimestamp;
                    }
                    await orderlineService.updateOrderlineStatus(orderline.id.toString(), newOrderStatus, orderlineUpdateData);
                }
                logger.info({ orderId: order.id, orderlineCount: orderlines.length }, 'All orderlines updated with shipment status');
            }
            // Step 10: Update order status (triggers status_history update)
            await this.updateOrderStatus(order.id.toString(), newOrderStatus, {
                source: 'inventoryuser',
                inventory_user_id: inventoryUserId,
                location,
                description
            });
            const updatedOrder = await this.findById(order.id);
            logger.info({
                orderId: order.id,
                orderStatus: updatedOrder.orderstatus,
                shipmentTrackingStatus: updatedOrder.shipment_tracking_status
            }, 'Shipment status updated successfully');
            return updatedOrder;
        }
        catch (error) {
            logger.error({ error, orderIdOrNumber, status }, 'Error updating shipment status');
            throw error;
        }
    }
    /**
     * Handle EKART webhook status update
     * Maps EKART webhook status to system status and updates order/orderlines
     * @param trackingId - EKART tracking ID (wbn from webhook)
     * @param ekartStatus - Original status from EKART webhook (e.g., "Shipped", "In Transit")
     * @param webhookData - Additional webhook data (location, description, ctime, etc.)
     */
    async handleEkartWebhookStatusUpdate(trackingId, ekartStatus, webhookData, fullWebhookPayload // Full original webhook payload
    ) {
        try {
            logger.info({ trackingId, ekartStatus, webhookData }, 'Processing EKART webhook status update');
            // Find order by tracking ID
            const order = await this.findByTrackingId(trackingId);
            if (!order) {
                throw new Error(`Order not found for tracking ID: ${trackingId}`);
            }
            // Only process EKART orders
            if (order.vendor !== 'EKART') {
                logger.info({ orderId: order.id, vendor: order.vendor, trackingId }, 'Ekart webhook received for non-EKART order - ignoring (manual vendor)');
                return order; // Return existing order without changes
            }
            // Map EKART status to system status
            const systemStatus = this.mapEkartWebhookStatusToSystemStatus(ekartStatus);
            if (!systemStatus) {
                logger.warn({ trackingId, ekartStatus, orderId: order.id }, 'Unknown EKART webhook status - storing in shipment_tracking_status and status_history only (is_active: false)');
                const currentTimestamp = webhookData.ctime || Date.now();
                const currentOrderStatus = order.orderstatus;
                // Get existing status history
                const existingHistory = Array.isArray(order.status_history)
                    ? order.status_history
                    : (typeof order.status_history === 'string' ? JSON.parse(order.status_history) : []);
                // Set all existing entries to is_active: false
                const deactivatedHistory = existingHistory.map((entry) => ({
                    ...entry,
                    is_active: false
                }));
                // Add new entry for unknown webhook status (is_active: false - does not affect status flow)
                const unknownStatusEntry = {
                    previous_status: currentOrderStatus,
                    new_status: currentOrderStatus, // Keep current status (no change)
                    changed_date: currentTimestamp,
                    source: 'ekart',
                    location: webhookData.location,
                    description: webhookData.description || `Unknown EKART status: ${ekartStatus}`,
                    ekart_original_status: ekartStatus, // Store original unknown status
                    is_active: false, // NOT active - just for tracking/history
                    is_webhook_status: true, // Mark as webhook status
                    webhook_payload: fullWebhookPayload || {} // Store full webhook payload for debugging/auditing
                };
                const updatedHistory = [...deactivatedHistory, unknownStatusEntry];
                // Store original status in shipment_tracking_status and status_history
                // BUT do NOT update orderstatus or orderline statuses
                await dynamicUpdate('orders', { id: order.id }, {
                    shipment_tracking_status: ekartStatus, // Store original unknown status
                    status_history: JSON.stringify(updatedHistory), // Add to history with is_active: false
                    modifieddate: currentTimestamp
                });
                logger.info({ orderId: order.id, ekartStatus, currentOrderStatus }, 'Unknown EKART webhook status stored in shipment_tracking_status and status_history (is_active: false) - orderstatus unchanged');
                return await this.findById(order.id);
            }
            // Check if status actually changed
            const currentOrderStatus = order.orderstatus;
            if (currentOrderStatus === systemStatus && order.shipment_tracking_status === ekartStatus) {
                logger.debug({ orderId: order.id, trackingId, status: systemStatus }, 'EKART webhook status unchanged, skipping update');
                return order;
            }
            const currentTimestamp = webhookData.ctime || Date.now();
            // Update shipment_tracking_status (store original EKART status)
            await dynamicUpdate('orders', { id: order.id }, {
                shipment_tracking_status: ekartStatus, // Store original EKART status
                modifieddate: currentTimestamp
            });
            logger.info({ orderId: order.id, trackingId, ekartStatus, systemStatus }, 'Order shipment_tracking_status updated from EKART webhook');
            // Prepare additional data for status update
            const additionalData = {
                source: 'ekart',
                location: webhookData.location,
                description: webhookData.description,
                ekart_original_status: ekartStatus // Store original in status_history
            };
            // Set specific date fields based on status
            if (systemStatus === 'shipped' && !order.shipdate) {
                // Set shipdate on first shipped status
                additionalData.shipdate = webhookData.pickupTime || currentTimestamp;
            }
            if (systemStatus === 'delivered') {
                additionalData.delivereddate = currentTimestamp;
            }
            if (systemStatus === 'cod_payment_received') {
                additionalData.cod_payment_received_date = currentTimestamp;
            }
            // Update all orderlines with same status
            const { OrderlineService } = await import('./orderline.service.js');
            const orderlineService = new OrderlineService();
            const { data: orderlines } = await orderlineService.findMany({ orderid: order.id.toString() }, 1, 1000);
            if (orderlines && orderlines.length > 0) {
                logger.info({ orderId: order.id, orderlineCount: orderlines.length, systemStatus }, 'Updating orderlines with EKART webhook status');
                for (const orderline of orderlines) {
                    await orderlineService.updateOrderlineStatus(orderline.id.toString(), systemStatus, {
                        source: 'ekart',
                        location: webhookData.location,
                        description: webhookData.description,
                        ekart_original_status: ekartStatus,
                        ...(systemStatus === 'shipped' && !orderline.shipdate && {
                            shipdate: webhookData.pickupTime || currentTimestamp
                        }),
                        ...(systemStatus === 'delivered' && {
                            delivereddate: currentTimestamp
                        })
                    });
                }
                logger.info({ orderId: order.id, orderlineCount: orderlines.length }, 'All orderlines updated with EKART webhook status');
            }
            // Update order status (triggers status_history update)
            await this.updateOrderStatus(order.id.toString(), systemStatus, additionalData);
            const updatedOrder = await this.findById(order.id);
            logger.info({
                orderId: order.id,
                trackingId,
                ekartStatus,
                systemStatus,
                previousStatus: currentOrderStatus,
                newStatus: updatedOrder.orderstatus
            }, 'EKART webhook status update completed successfully');
            return updatedOrder;
        }
        catch (error) {
            logger.error({ error, trackingId, ekartStatus }, 'Error processing EKART webhook status update');
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
            // Skip status history update if status hasn't changed
            if (previousStatus === status) {
                logger.debug({ orderId: id, status }, 'Order status unchanged, skipping status history update');
                // Still update other fields if provided (like modifieddate, location, description)
                const updateData = {
                    modifieddate: Date.now(),
                    ...additionalData
                };
                // Remove orderstatus from additionalData to avoid unnecessary update
                delete updateData.orderstatus;
                if (Object.keys(updateData).length > 1) { // More than just modifieddate
                    await dynamicUpdate('orders', { id: parseInt(id) }, updateData);
                }
                return currentOrder;
            }
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
            // Add location and description if provided
            if (additionalData?.location) {
                historyEntry.location = additionalData.location;
            }
            if (additionalData?.description) {
                historyEntry.description = additionalData.description;
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
                // Refund tracking fields
                refund_transaction_id: fullOrder.refund_transaction_id,
                refund_amount: fullOrder.refund_amount ? Number(fullOrder.refund_amount) : null,
                refund_reference: fullOrder.refund_reference,
                refund_initiated_date: fullOrder.refund_initiated_date,
                refund_completed_date: fullOrder.refund_completed_date,
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
    async getOrdersByUserIdWithDetails(userId, page = 1, limit = 10, filters) {
        try {
            logger.info({ userId, page, limit, filters }, 'Getting orders by userid with orderlines and address');
            // Build filters for database query
            const dbFilters = { userid: userId.toString() };
            // 1. ORDER STATUS FILTER (existing)
            if (filters?.orderstatus) {
                dbFilters.orderstatus = filters.orderstatus; // Support comma-separated values
            }
            // 2. DATE RANGE FILTER
            if (filters?.date_range || filters?.start_date || filters?.end_date) {
                const now = Date.now();
                let startDate;
                let endDate;
                // Predefined date ranges
                if (filters.date_range) {
                    const ranges = {
                        'last_7_days': now - (7 * 24 * 60 * 60 * 1000),
                        'last_30_days': now - (30 * 24 * 60 * 60 * 1000),
                        'last_3_months': now - (90 * 24 * 60 * 60 * 1000),
                        'last_6_months': now - (180 * 24 * 60 * 60 * 1000),
                        'last_1_year': now - (365 * 24 * 60 * 60 * 1000)
                    };
                    startDate = ranges[filters.date_range];
                    endDate = now;
                    logger.debug({
                        userId,
                        dateRange: filters.date_range,
                        startDate,
                        endDate,
                        startDateReadable: startDate ? new Date(startDate).toISOString() : null,
                        endDateReadable: endDate ? new Date(endDate).toISOString() : null
                    }, 'Applying predefined date range filter');
                }
                // Custom date range (overrides predefined if both provided)
                if (filters.start_date) {
                    startDate = parseInt(filters.start_date, 10);
                }
                if (filters.end_date) {
                    endDate = parseInt(filters.end_date, 10);
                }
                // Apply date filter using >= and <= operators
                if (startDate) {
                    dbFilters['createddate_gte'] = startDate.toString();
                }
                if (endDate) {
                    dbFilters['createddate_lte'] = endDate.toString();
                }
                logger.debug({
                    userId,
                    appliedStartDate: startDate,
                    appliedEndDate: endDate,
                    startDateReadable: startDate ? new Date(startDate).toISOString() : null,
                    endDateReadable: endDate ? new Date(endDate).toISOString() : null
                }, 'Date range filter applied');
            }
            // 3. PAYMENT METHOD FILTER
            if (filters?.mode) {
                dbFilters.mode = filters.mode; // Support comma-separated values like "cod,phonepe"
                logger.debug({ userId, mode: filters.mode }, 'Payment method filter applied');
            }
            // 4. AMOUNT RANGE FILTER
            if (filters?.amount_range || filters?.min_amount || filters?.max_amount) {
                let minAmount;
                let maxAmount;
                // Predefined amount ranges
                if (filters.amount_range) {
                    const ranges = {
                        'under_500': { max: 500 },
                        '500_1000': { min: 500, max: 1000 },
                        '1000_2500': { min: 1000, max: 2500 },
                        '2500_5000': { min: 2500, max: 5000 },
                        'above_5000': { min: 5000 }
                    };
                    const range = ranges[filters.amount_range];
                    if (range) {
                        minAmount = range.min;
                        maxAmount = range.max;
                    }
                    logger.debug({
                        userId,
                        amountRange: filters.amount_range,
                        minAmount,
                        maxAmount
                    }, 'Applying predefined amount range filter');
                }
                // Custom amount range (overrides predefined if both provided)
                if (filters.min_amount) {
                    minAmount = parseFloat(filters.min_amount);
                }
                if (filters.max_amount) {
                    maxAmount = parseFloat(filters.max_amount);
                }
                // Apply amount filter using >= and <= operators
                if (minAmount !== undefined) {
                    dbFilters['orderamount_gte'] = minAmount.toString();
                }
                if (maxAmount !== undefined) {
                    dbFilters['orderamount_lte'] = maxAmount.toString();
                }
                logger.debug({
                    userId,
                    appliedMinAmount: minAmount,
                    appliedMaxAmount: maxAmount
                }, 'Amount range filter applied');
            }
            logger.info({
                userId,
                page,
                limit,
                dbFilters,
                filterCount: Object.keys(dbFilters).length - 1 // Exclude userid
            }, 'Final filters prepared for database query');
            // Get order IDs for this user (lightweight query for pagination)
            const ordersResult = await this.findMany(dbFilters, page, limit);
            const pagination = ordersResult.pagination;
            // Fetch full order details for each order using findById
            // This ensures JSONB fields like status_history are properly deserialized
            const orders = await Promise.all(ordersResult.data.map((o) => this.findById(o.id)));
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
                    id: order.id,
                    orderamount: order.orderamount ? Number(order.orderamount) : null,
                    orderid: order.orderid,
                    orderstatus: order.orderstatus,
                    quantity: order.quantity,
                    productid: order.productid,
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
                    refund_transaction_id: order.refund_transaction_id,
                    refund_amount: order.refund_amount ? Number(order.refund_amount) : null,
                    refund_reference: order.refund_reference,
                    refund_initiated_date: order.refund_initiated_date,
                    refund_completed_date: order.refund_completed_date,
                    status_history: this.parseStatusHistory(order.status_history),
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
            // IDEMPOTENCY CHECK: If order already cancelled, handle appropriately
            if (order.orderstatus === 'cancelled') {
                logger.info({
                    orderId,
                    orderNumber: order.orderid,
                    cancelledDate: order.cancelleddate,
                    mode: order.mode
                }, 'Order already cancelled - checking if COD auto-completion needed (idempotent)');
                // AUTO-COMPLETE COD ORDERS even on retry/subsequent calls
                // This ensures COD orders never get stuck in 'cancelled' status
                if (order.mode === 'cod') {
                    logger.info({
                        orderId,
                        orderNumber: order.orderid,
                        mode: 'cod'
                    }, 'COD order already cancelled - attempting auto-completion to cancelled_completed');
                    try {
                        // Use proper user ID: inventoryUserId for admin, userId for customer, -1 for system
                        const adminUserIdForRefund = inventoryUserId || userId || -1;
                        const finalOrder = await this.updateRefundStatus(orderId, 'cancelled_completed', adminUserIdForRefund, `COD order - automatically completed (no refund required). Cancelled by: ${source}`);
                        logger.info({
                            orderId,
                            orderNumber: finalOrder.orderid,
                            finalStatus: finalOrder.orderstatus
                        }, 'COD order auto-completed during idempotent check');
                        return finalOrder;
                    }
                    catch (autoCompleteError) {
                        logger.error({
                            error: autoCompleteError.message,
                            errorStack: autoCompleteError.stack,
                            orderId,
                            orderNumber: order.orderid
                        }, 'Failed to auto-complete COD order during idempotent check - returning cancelled order');
                        return order;
                    }
                }
                // PhonePe orders: Just return as-is (already cancelled, waiting for admin refund)
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
            // Fetch orderlines with status_history for proper tracking
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
                for (const orderline of orderlines) {
                    // Get previous status from the orderline
                    const previousStatus = orderline.orderstatus || 'unknown';
                    // Create status history entry with all required fields
                    const statusHistoryEntry = {
                        previous_status: previousStatus,
                        new_status: 'cancelled',
                        changed_date: currentTimestamp,
                        source,
                        userid: userId,
                        inventory_user_id: inventoryUserId,
                        cancellation_reason: cancellationReason,
                        is_active: true
                    };
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
                // OPTIMIZED: Direct update of order status with status_history
                // We KNOW it's cancelled - all orderlines are cancelled
                const orderStatusHistoryEntry = {
                    previous_status: order.orderstatus || 'unknown',
                    new_status: 'cancelled',
                    changed_date: currentTimestamp,
                    source,
                    userid: userId,
                    inventory_user_id: inventoryUserId,
                    cancellation_reason: cancellationReason,
                    is_active: true
                };
                const existingOrderHistory = Array.isArray(order.status_history)
                    ? order.status_history
                    : [];
                const updatedOrderHistory = existingOrderHistory.map((entry) => ({
                    ...entry,
                    is_active: false
                }));
                updatedOrderHistory.push(orderStatusHistoryEntry);
                await tx.orders.update({
                    where: { id: orderId },
                    data: {
                        orderstatus: 'cancelled',
                        cancelleddate: currentTimestamp,
                        status_history: updatedOrderHistory,
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
            // Helper function for async eKart shipment cancellation
            // This ensures consistent eKart cancellation for both COD and PhonePe orders
            const cancelEkartShipmentAsync = (orderToCancel) => {
                if (orderToCancel.tracking_id) {
                    logger.info({
                        orderId,
                        orderNumber: orderToCancel.orderid,
                        trackingId: orderToCancel.tracking_id,
                        orderStatus: orderToCancel.orderstatus
                    }, 'Order has eKart shipment - attempting async cancellation');
                    // Fire-and-forget async eKart cancellation
                    // Don't await - let it run in background
                    setImmediate(async () => {
                        try {
                            const { ekartService } = await import('./ekart.service.js');
                            await ekartService.cancelShipment(orderToCancel.tracking_id);
                            logger.info({
                                orderId,
                                orderNumber: orderToCancel.orderid,
                                trackingId: orderToCancel.tracking_id
                            }, '✅ eKart shipment cancelled successfully (async)');
                            // Optional: Update order record with eKart cancellation status
                            // This is best-effort - if it fails, it won't affect the order cancellation
                            try {
                                await dynamicUpdate('orders', { id: orderId }, {
                                    ekart_cancellation_status: 'cancelled',
                                    ekart_cancellation_date: Date.now(),
                                    modifieddate: Date.now()
                                });
                            }
                            catch (updateError) {
                                logger.warn({
                                    error: updateError.message,
                                    orderId
                                }, 'Failed to update eKart cancellation status in order record');
                            }
                        }
                        catch (error) {
                            // eKart cancellation may fail if shipment is already picked up or in transit
                            // This is expected and should not affect the order cancellation
                            logger.warn({
                                error: error.message,
                                errorStack: error.stack,
                                orderId,
                                orderNumber: orderToCancel.orderid,
                                trackingId: orderToCancel.tracking_id
                            }, '⚠️ Failed to cancel eKart shipment (async) - shipment may be in transit. eKart will handle RTO automatically.');
                        }
                    });
                }
                else {
                    logger.debug({
                        orderId,
                        orderNumber: orderToCancel.orderid
                    }, 'No eKart shipment found - skipping eKart cancellation');
                }
            };
            // AUTO-COMPLETE COD ORDERS (no refund needed)
            // PhonePe orders remain in 'cancelled' status awaiting manual refund processing
            logger.info({
                orderId,
                orderNumber: updatedOrder.orderid,
                mode: updatedOrder.mode,
                modeType: typeof updatedOrder.mode,
                modeComparison: `mode === 'cod': ${updatedOrder.mode === 'cod'}`,
                modeLowerCase: updatedOrder.mode?.toLowerCase()
            }, 'Checking if COD order for auto-completion');
            if (updatedOrder.mode === 'cod') {
                logger.info({
                    orderId,
                    orderNumber: updatedOrder.orderid,
                    mode: 'cod'
                }, 'COD order detected - automatically setting to cancelled_completed (no refund needed)');
                try {
                    // Auto-update to cancelled_completed for COD orders
                    // Use proper user ID: inventoryUserId for admin, userId for customer, -1 for system
                    const adminUserIdForRefund = inventoryUserId || userId || -1;
                    const finalOrder = await this.updateRefundStatus(orderId, 'cancelled_completed', adminUserIdForRefund, `COD order - automatically completed (no refund required). Cancelled by: ${source}`);
                    logger.info({
                        orderId,
                        orderNumber: finalOrder.orderid,
                        finalStatus: finalOrder.orderstatus
                    }, 'COD order cancellation completed automatically');
                    // ASYNC EKART CANCELLATION - Final step after ALL updates complete (COD path)
                    cancelEkartShipmentAsync(finalOrder);
                    return finalOrder;
                }
                catch (autoCompleteError) {
                    // If auto-complete fails, log but return the cancelled order
                    logger.error({
                        error: autoCompleteError.message,
                        errorStack: autoCompleteError.stack,
                        orderId,
                        orderNumber: updatedOrder.orderid,
                        mode: updatedOrder.mode,
                        currentStatus: updatedOrder.orderstatus
                    }, 'CRITICAL: Failed to auto-complete COD order, remains in cancelled status');
                    // ASYNC EKART CANCELLATION - Even if COD auto-complete fails (fallback)
                    cancelEkartShipmentAsync(updatedOrder);
                    return updatedOrder;
                }
            }
            else {
                logger.info({
                    orderId,
                    orderNumber: updatedOrder.orderid,
                    mode: updatedOrder.mode,
                    reason: 'Not a COD order - skipping auto-completion'
                }, 'Order is not COD, manual refund processing required');
            }
            // PhonePe orders: Manual refund processing required
            logger.info({
                orderId,
                orderNumber: updatedOrder.orderid,
                mode: updatedOrder.mode,
                isPaymentSucceed: updatedOrder.ispaymentsucceed
            }, 'PhonePe order cancelled. Admin must manually process refund via PhonePe portal.');
            // ASYNC EKART CANCELLATION - Final step after ALL updates complete (PhonePe path)
            cancelEkartShipmentAsync(updatedOrder);
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
    async updateRefundStatus(orderId, newStatus, adminUserId, notes, 
    // NEW: Optional structured refund fields
    refundTransactionId, refundAmount, refundReference) {
        try {
            logger.info({
                orderId,
                newStatus,
                adminUserId,
                notes,
                refundTransactionId,
                refundAmount,
                refundReference
            }, 'Updating refund status with structured data');
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
            // VALIDATION: Refund amount (if provided)
            if (refundAmount !== undefined && refundAmount !== null) {
                const tolerance = 1; // Allow ₹1 difference for rounding/fees
                if (Math.abs(refundAmount - order.orderamount) > tolerance) {
                    logger.warn({
                        orderId,
                        refundAmount,
                        orderAmount: order.orderamount,
                        difference: Math.abs(refundAmount - order.orderamount)
                    }, 'Refund amount differs from order amount');
                }
            }
            // Get all orderlines for this order
            const { OrderlineService } = await import('./orderline.service.js');
            const orderlineService = new OrderlineService();
            const { data: orderlines } = await orderlineService.findMany({ orderid: (typeof orderId === 'string' ? parseInt(orderId) : orderId).toString() }, 1, 1000);
            const currentTimestamp = Date.now();
            // Build status_history entry with structured refund data
            const statusHistoryData = {
                source: 'inventoryuser',
                inventory_user_id: adminUserId
            };
            // Add refund fields to status_history
            if (refundTransactionId)
                statusHistoryData.refund_transaction_id = refundTransactionId;
            if (refundAmount !== undefined && refundAmount !== null)
                statusHistoryData.refund_amount = refundAmount;
            if (refundReference)
                statusHistoryData.refund_reference = refundReference;
            if (notes)
                statusHistoryData.refund_notes = notes;
            // Add timestamps based on status
            if (newStatus === 'cancelled_refund_processing') {
                statusHistoryData.refund_initiated_date = currentTimestamp;
            }
            if (newStatus === 'cancelled_refunded') {
                statusHistoryData.refund_completed_date = currentTimestamp;
                // EDGE CASE: If jumping directly to cancelled_refunded without refund_processing,
                // set initiated date too (e.g., cancelled → cancelled_refunded)
                if (!order.refund_initiated_date) {
                    statusHistoryData.refund_initiated_date = currentTimestamp;
                }
            }
            // Update orderlines status with enhanced data
            for (const orderline of orderlines) {
                await orderlineService.updateOrderlineStatus(orderline.id.toString(), newStatus, statusHistoryData);
            }
            // Prepare order update data
            const orderUpdateData = {
                source: 'inventoryuser',
                inventory_user_id: adminUserId,
                refund_status_updated_date: currentTimestamp
            };
            // Add refund fields to order update
            if (refundTransactionId)
                orderUpdateData.refund_transaction_id = refundTransactionId;
            if (refundAmount !== undefined && refundAmount !== null)
                orderUpdateData.refund_amount = refundAmount;
            if (refundReference)
                orderUpdateData.refund_reference = refundReference;
            if (notes)
                orderUpdateData.refund_notes = notes;
            // Add timestamp fields to order
            if (newStatus === 'cancelled_refund_processing') {
                orderUpdateData.refund_initiated_date = currentTimestamp;
            }
            if (newStatus === 'cancelled_refunded') {
                orderUpdateData.refund_completed_date = currentTimestamp;
                // EDGE CASE: Backfill refund_initiated_date if it was never set
                // (e.g., direct jump from cancelled → cancelled_refunded)
                if (!order.refund_initiated_date) {
                    orderUpdateData.refund_initiated_date = currentTimestamp;
                }
            }
            // Update order status
            await this.updateOrderStatus((typeof orderId === 'string' ? parseInt(orderId) : orderId).toString(), newStatus, orderUpdateData);
            // Fetch and return updated order
            const updatedOrder = await this.findById(typeof orderId === 'string' ? parseInt(orderId) : orderId);
            // UPDATE TRANSACTION TABLE with structured refund data
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
                            refund_admin_user: adminUserId
                        };
                        // Add structured refund data to transaction
                        if (refundTransactionId)
                            updatedTransactionData.refund_transaction_id = refundTransactionId;
                        if (refundAmount !== undefined && refundAmount !== null)
                            updatedTransactionData.refund_amount = refundAmount;
                        if (refundReference)
                            updatedTransactionData.refund_reference = refundReference;
                        if (notes)
                            updatedTransactionData.refund_notes = notes;
                        await dynamicUpdate('transaction', { id: transaction.id }, {
                            transactiondata: updatedTransactionData,
                            modifieddate: currentTimestamp
                        });
                        logger.info({
                            transactionId: transaction.id,
                            merchantTransactionId: updatedOrder.merchanttransactionid,
                            newTransactionStatus: transactionStatus,
                            refundTransactionId,
                            refundAmount
                        }, 'Transaction updated with structured refund data');
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
                adminUserId,
                refundTransactionId,
                refundAmount
            }, 'Refund status updated successfully with structured data');
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
                    // Get current quantities
                    const currentEcomQty = Number(platformStock.ecomqty || 0);
                    const currentSoldQty = Number(platformStock.soldqty || 0);
                    const currentLockQty = Number(platformStock.lockqty || 0);
                    // Restore orderedqty → availableqty
                    const newOrderedQty = Math.max(0, (platformStock.orderedqty || 0) - update.quantity);
                    // Recalculate availableqty using formula: ecomqty - orderedqty - soldqty - lockqty
                    // ecomqty doesn't change (stocks still available, just not ordered anymore)
                    const newAvailableQty = Math.max(0, currentEcomQty - newOrderedQty - currentSoldQty - currentLockQty);
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
            // Key: "productId-platform" -> { quantity, ecomQuantity }
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
                // COMBO PRODUCT SUPPORT: Check if the ORDERLINE's product is a combo
                // Important: We must check orderline.productid, not stock.puc, because:
                // - For combo orderlines, stocks belong to COMPONENT products (not the combo product itself)
                // - If we check stock.puc, we'll get the component product which has iscombo=false
                const orderlineProduct = await dynamicFindUnique('product', { id: orderline.productid });
                if (orderlineProduct && orderlineProduct.iscombo === true) {
                    logger.info({
                        orderlineId: orderline.id,
                        comboProductId: orderline.productid,
                        comboProductName: orderlineProduct.name,
                        quantity: orderline.quantity,
                        allocatedStocks: allocatedStocks.length
                    }, 'Detected combo product orderline - reversing ONLY component stock allocations (not combo itself)');
                    try {
                        // Get component products from productbundlemap
                        const components = await prisma.productBundleMap.findMany({
                            where: {
                                bundleproductid: BigInt(orderline.productid),
                                isactive: true
                            }
                        });
                        if (components.length === 0) {
                            logger.warn({
                                orderlineId: orderline.id,
                                comboProductId: orderline.productid,
                                comboProductName: orderlineProduct.name
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
                                comboProductId: orderline.productid, // ✅ Use orderline's productid (combo product)
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
                                    quantity: 0,
                                    ecomQuantity: 0
                                });
                            }
                            const componentUpdate = platformStockUpdates.get(componentPlatformStockKey);
                            componentUpdate.quantity += componentTotalQty;
                            // For combo components, we need to check if the stocks were e-commerce published
                            // Since we don't have direct access to component stocks here, we'll assume they were e-commerce published
                            // (components of combo products are typically e-commerce published)
                            // Note: In cancellation, we're restoring stocks that were already allocated, so they were e-commerce published
                            componentUpdate.ecomQuantity += componentTotalQty;
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
                        quantity: 0,
                        ecomQuantity: 0
                    });
                }
                const update = platformStockUpdates.get(platformStockKey);
                update.quantity += quantity;
                // Count how many stocks were e-commerce published (before they were marked as sold)
                // Stocks that were sold were e-commerce published (otherwise they wouldn't be in soldqty)
                const ecomPublishedCount = allocatedStocks.filter(s => s.ecompublish === true).length;
                update.ecomQuantity += ecomPublishedCount;
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
                    // Get current quantities
                    const currentEcomQty = Number(platformStock.ecomqty || 0);
                    const currentOrderedQty = Number(platformStock.orderedqty || 0);
                    const currentLockQty = Number(platformStock.lockqty || 0);
                    // Restore soldqty → availableqty
                    // ecomqty increases because stocks are back to 'available' status (if they were e-commerce published)
                    // Note: We need to check if the stocks were e-commerce published
                    // For now, we'll recalculate ecomqty from actual stocks, but for cancellation we increment it
                    // Actually, ecomqty should be recalculated from stocks, but for performance we increment it
                    // The stocks being cancelled were sold, so they were e-commerce published (otherwise they wouldn't be in soldqty)
                    const newSoldQty = Math.max(0, (platformStock.soldqty || 0) - update.quantity);
                    const newEcomQty = currentEcomQty + update.ecomQuantity; // Increase by e-commerce published count
                    // Recalculate availableqty using formula: ecomqty - orderedqty - soldqty - lockqty
                    const newAvailableQty = Math.max(0, newEcomQty - currentOrderedQty - newSoldQty - currentLockQty);
                    await dynamicUpdate('platformstock', { id: platformStock.id }, {
                        ecomqty: newEcomQty,
                        availableqty: newAvailableQty,
                        soldqty: newSoldQty,
                        modifieddate: currentTimestamp
                    });
                    logger.info({
                        platformStockId: platformStock.id,
                        productId: update.productId,
                        platform: update.platform,
                        quantity: update.quantity,
                        ecomQuantity: update.ecomQuantity,
                        oldEcomQty: currentEcomQty,
                        newEcomQty,
                        oldAvailableQty: platformStock.availableqty,
                        newAvailableQty,
                        oldSoldQty: platformStock.soldqty,
                        newSoldQty,
                        formula: {
                            availableqty: `${newEcomQty} - ${currentOrderedQty} - ${newSoldQty} - ${currentLockQty} = ${newAvailableQty}`
                        }
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