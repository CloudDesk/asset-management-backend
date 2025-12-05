import { prisma } from '../models/prisma.js';
import { Prisma } from '@prisma/client';
import { 
  CreateOrdersInput, 
  UpdateOrdersInput, 
  UpsertOrdersInput
} from '../schemas/orders.schema.js';
import { PaginationResult, createPaginationResult, getPrismaSkipTake } from '../utils/pagination.js';
import { FilterOptions } from '../utils/filterBuilder.js';
import { 
  dynamicFindMany, 
  dynamicCount, 
  dynamicFindUnique, 
  dynamicCreate, 
  dynamicUpdate, 
  dynamicDelete,
  dynamicFindManyWithFilters
} from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';

export class OrdersService {
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
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
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in dynamic orders findMany operation');
      throw error;
    }
  }

  async findById(id: Number) {
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
    } catch (error) {
      logger.error({ error, orderId: id }, 'Error in orders findById operation');
      throw error;
    }
  }
  async create(data: CreateOrdersInput & Record<string, any>) {
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
          
          orderlineResults = await this.createOrderlinesFromOrderItems(
            order.id,
            data.orderItems,
            order.orderid,
            currentTimestamp,
            data.mode // ✅ Pass mode for correct orderline status
          );
        } else {
          logger.info({
            orderId: order.id,
            productIds: data.productid.length
          }, 'Creating orderlines from product IDs (fallback)');
          
          orderlineResults = await this.createOrderlinesForProducts(
            order.id,
            data.productid,
            data,
            order.orderid,
            currentTimestamp,
            data.mode // ✅ Pass mode for correct orderline status
          );
        }

        logger.info({ 
          orderId: order.id, 
          orderid: order.orderid,
          createdOrderlines: orderlineResults.length,
          totalProducts: data.productid.length
        }, 'Order and orderlines creation completed');

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
    } catch (error) {
      logger.error({ error, data }, 'Error in orders create operation');
      throw error;
    }
  }
  async createOrderlinesForProducts(
    orderId: number,
    productIds: number[],
    orderData: any,
    orderidString: string,
    currentTime: number,
    mode?: string // ✅ Optional mode parameter for correct orderline status
  ) {
    const orderlines = [];
    
    // ✅ FIX: COD orderlines should start with order_confirmed, Prepaid with payment_completed
    const isCodOrder = mode === 'cod';
    const defaultStatus = isCodOrder ? 'order_confirmed' : 'payment_completed';
    
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
        paymentfaileddate: orderData.paymentfaileddate || null
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
      } catch (orderlineError) {
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
  async createOrderlinesFromOrderItems(
    orderId: number,
    orderItems: any[],
    orderidString: string,
    currentTime: number,
    mode?: string // ✅ Optional mode parameter for correct orderline status
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
    
    for (let i = 0; i < orderItems.length; i++) {
      const orderItem = orderItems[i];
      
      // ✅ FIX: COD orderlines should start with order_confirmed, Prepaid with payment_completed
      const isCodOrder = mode === 'cod';
      const orderlineStatus = isCodOrder ? 'order_confirmed' : 'payment_completed';
      
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
        merchanttransactionid: orderItem.merchanttransactionid || null
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
      } catch (orderlineError: any) {
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
      totalOriginalPrice: successfulOrderlines.reduce((sum, ol) => 
        sum + (parseFloat(ol.original_price?.toString() || '0') || 0), 0),
      totalProductDiscount: successfulOrderlines.reduce((sum, ol) => 
        sum + (parseFloat(ol.product_discount_amount?.toString() || '0') || 0), 0),
      totalPromotionDiscount: successfulOrderlines.reduce((sum, ol) => 
        sum + (parseFloat(ol.promotion_discount_amount?.toString() || '0') || 0), 0),
      totalShipping: successfulOrderlines.reduce((sum, ol) => 
        sum + (parseFloat(ol.shipping_cost?.toString() || '0') || 0), 0)
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
  async recalculateOrderStatus(orderId: number): Promise<void> {
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
      let newOrderStatus: string;

      // Check for cancellation scenarios first
      const cancelledCount = orderlineStatuses.filter(s => s === 'cancelled').length;
      const totalCount = orderlineStatuses.length;

      if (cancelledCount === totalCount) {
        newOrderStatus = 'cancelled';
      } else if (cancelledCount > 0) {
        newOrderStatus = 'partially_cancelled';
      } else {
        // Check for return scenarios
        const returnedCount = orderlineStatuses.filter(s => s === 'returned').length;
        
        if (returnedCount === totalCount) {
          newOrderStatus = 'returned';
        } else if (returnedCount > 0) {
          newOrderStatus = 'partially_returned';
        } else {
          // All orderlines have same status
          const uniqueStatuses = [...new Set(orderlineStatuses)];
          
          if (uniqueStatuses.length === 1) {
            newOrderStatus = uniqueStatuses[0];
          } else {
            // Mixed statuses - use priority ladder (lowest progress stage)
            const statusPriority = [
              'order_placed',
              'payment_completed',
              'order_confirmed',
              'packed',
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
        const existingHistory = currentOrder.status_history || [];
        const historyEntry: any = {
          previous_status: previousStatus,
          new_status: newOrderStatus,
          changed_date: Date.now(),
          source: 'system' // Auto-calculated from orderlines
        };
        const updatedHistory = [...existingHistory, historyEntry];

        // Update order with new status and history
        await dynamicUpdate('orders', { id: orderId }, {
          orderstatus: newOrderStatus,
          status_history: updatedHistory,
          modifieddate: Date.now()
        });

        logger.info({
          orderId,
          previousStatus,
          newOrderStatus,
          orderlineStatuses
        }, 'Order status recalculated and history updated');
      }
    } catch (error) {
      logger.error({ error, orderId }, 'Error recalculating order status');
      throw error;
    }
  }

  /**
   * Find order by tracking ID
   */
  async findByTrackingId(trackingId: string) {
    try {
      logger.debug({ trackingId }, 'Finding order by tracking ID');

      const { data: orders } = await dynamicFindManyWithFilters('orders', {
        tracking_id: trackingId
      }, { useAllColumns: true });

      if (!orders || orders.length === 0) {
        return null;
      }

      return orders[0]; // Return first match
    } catch (error) {
      logger.error({ error, trackingId }, 'Error finding order by tracking ID');
      throw error;
    }
  }

  /**
   * Find order by order number (orderid field)
   */
  async findByOrderNumber(orderNumber: string) {
    try {
      logger.debug({ orderNumber }, 'Finding order by order number');

      const order = await dynamicFindUnique('orders', { orderid: orderNumber });

      if (!order) {
        return null;
      }

      return order;
    } catch (error) {
      logger.error({ error, orderNumber }, 'Error finding order by order number');
      throw error;
    }
  }

  /**
   * Mark order as ready for dispatch
   */
  async markReadyForDispatch(orderId: number, inventoryUserId: number): Promise<any> {
    try {
      logger.info({ orderId, inventoryUserId }, 'Marking order as ready for dispatch');

      const { OrderlineService } = await import('./orderline.service.js');
      const orderlineService = new OrderlineService();

      // Get all orderlines for this order
      const { data: orderlines } = await orderlineService.findMany(
        { orderid: orderId.toString() },
        1,
        1000
      );

      if (!orderlines || orderlines.length === 0) {
        throw new Error('No orderlines found for this order');
      }

      // Update all orderlines to ready_for_dispatch
      for (const orderline of orderlines) {
        await orderlineService.updateOrderlineStatus(
          orderline.id.toString(),
          'ready_for_dispatch',
          {
            source: 'inventoryuser',
            inventory_user_id: inventoryUserId
          }
        );
      }

      // Recalculate order status (should become ready_for_dispatch)
      await this.recalculateOrderStatus(orderId);

      const order = await this.findById(orderId);
      logger.info({ orderId, orderStatus: order.orderstatus }, 'Order marked as ready for dispatch');

      return order;
    } catch (error) {
      logger.error({ error, orderId, inventoryUserId }, 'Error marking order as ready for dispatch');
      throw error;
    }
  }

  /**
   * Mark order as shipped (after label printed)
   */
  async markShipped(orderId: number, inventoryUserId: number): Promise<any> {
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
      const { data: orderlines } = await orderlineService.findMany(
        { orderid: orderId.toString() },
        1,
        1000
      );

      if (!orderlines || orderlines.length === 0) {
        throw new Error('No orderlines found for this order');
      }

      // Update all orderlines to shipped
      for (const orderline of orderlines) {
        await orderlineService.updateOrderlineStatus(
          orderline.id.toString(),
          'shipped',
          {
            shipdate: currentTimestamp,
            source: 'inventoryuser',
            inventory_user_id: inventoryUserId
          }
        );
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
    } catch (error) {
      logger.error({ error, orderId, inventoryUserId }, 'Error marking order as shipped');
      throw error;
    }
  }

  /**
   * Update order status
   */
  async updateOrderStatus(id: string, status: string, additionalData?: Record<string, any>) {
    try {
      logger.debug({ orderId: id, status, additionalData }, 'Starting orders status update operation');

      // Get current order
      const currentOrder = await this.findById(Number(id));
      const previousStatus = currentOrder.orderstatus;

      // Prepare status history entry
      const existingHistory = currentOrder.status_history || [];
      const historyEntry: any = {
        previous_status: previousStatus,
        new_status: status,
        changed_date: Date.now(),
        source: additionalData?.source || 'system'
      };
      
      // Add inventory_user_id if source is inventoryuser
      if (historyEntry.source === 'inventoryuser' && additionalData?.inventory_user_id) {
        historyEntry.inventory_user_id = additionalData.inventory_user_id;
      }
      
      const updatedHistory = [...existingHistory, historyEntry];

      const updateData: Record<string, any> = {
        orderstatus: status,
        status_history: updatedHistory,
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
    } catch (error) {
      logger.error({ error, orderId: id, status }, 'Error in orders status update operation');
      throw error;
    }
  }

  /**
   * Update order (generic update method)
   */
  async update(id: string, data: UpdateOrdersInput & Record<string, any>) {
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
    } catch (error) {
      logger.error({ error, data, orderId: id }, 'Error in orders update operation');
      throw error;
    }
  }
} 