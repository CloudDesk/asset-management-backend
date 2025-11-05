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

  async findByOrderId(orderid: string) {
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
    } catch (error) {
      logger.error({ error, orderid }, 'Error in orders findByOrderId operation');
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
            currentTimestamp
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
            currentTimestamp
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

  async createFromCartItems(cartItems: any[]) {
    try {
      logger.debug({ cartItems, itemCount: cartItems.length }, 'Starting order creation from cart items');

      if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        throw new Error('Cart items array is required and cannot be empty');
      }

      // Calculate totals from cart items
      const totalOrderAmount = cartItems.reduce((sum, item) => sum + (item.orderamount || 0), 0);
      const totalProductAmount = cartItems.reduce((sum, item) => sum + (item.productamount || 0), 0);
      const totalDiscountAmount = cartItems.reduce((sum, item) => sum + (item.discountamount || 0), 0);
      const totalQuantity = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const productIds = cartItems.map(item => item.productid);

      // Use data from first item for common order fields
      const firstItem = cartItems[0];
      const currentTimestamp = Date.now();
      
      // Generate unique orderid
      const orderid = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Create order record with aggregated data
      const orderData = {
        userid: firstItem.userid,
        addressid: firstItem.addressid,
        orderamount: totalOrderAmount,
        orderid: orderid,
        orderstatus: 'order_processing',
        quantity: totalQuantity,
        productamount: totalProductAmount,
        discountamount: totalDiscountAmount,
        ispaymentsucceed: false,
        productid: productIds,
        createddate: currentTimestamp,
        modifieddate: currentTimestamp
      };

      // Create the order first
      const order = await dynamicCreate('orders', orderData);

      if (!order) {
        throw new Error('Failed to create order - no valid fields provided');
      }

      logger.info({ 
        orderId: order.id,
        cartItems: cartItems.length,
        totalAmount: totalOrderAmount
      }, 'Creating orderlines for cart items');

      // Create orderlines with proper error handling
      const orderlineResults = await this.createOrderlinesFromCartItems(
        order.id,
        cartItems,
        order.orderid,
        currentTimestamp
      );

      logger.info({ 
        orderId: order.id, 
        orderid: order.orderid,
        createdOrderlines: orderlineResults.length,
        totalCartItems: cartItems.length
      }, 'Order and orderlines creation from cart completed');

      // Return order with orderlines info
      return {
        ...order,
        orderlines: orderlineResults
      };
    } catch (error) {
      logger.error({ error, cartItems }, 'Error in order creation from cart items');
      throw error;
    }
  }

  async createOrderlinesForProducts(
    orderId: number,
    productIds: number[],
    orderData: any,
    orderidString: string,
    currentTime: number
  ) {
    const orderlines = [];
    
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
        orderstatus: orderData.orderstatus || 'order_processing',
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

  async createOrderlinesFromCartItems(
    orderId: number,
    cartItems: any[],
    orderidString: string,
    currentTime: number
  ) {
    const orderlines = [];
    
    for (let i = 0; i < cartItems.length; i++) {
      const item = cartItems[i];
      
      const orderlineData = {
        orderid: orderId, // Use the database ID, not the string orderid
        productid: item.productid,
        userid: item.userid || null,
        addressid: item.addressid || null,
        productamount: item.productamount || null,
        discountamount: item.discountamount || null,
        orderamount: item.orderamount || null,
        quantity: item.quantity || 1,
        productname: item.productname || null,
        productcategory: item.productcategory || null,
        orderstatus: 'order_processing',
        uniqueordderid: orderidString, // Use the string orderid
        createddate: currentTime,
        modifieddate: currentTime
      };

      try {
        const orderline = await dynamicCreate('orderline', orderlineData);
        if (orderline) {
          orderlines.push(orderline);
          logger.debug({ 
            orderlineId: orderline.id, 
            orderlineNumber: orderline.orderlinenumber,
            productId: item.productid,
            productName: item.productname
          }, 'Orderline created successfully from cart item');
        }
      } catch (orderlineError: any) {
        logger.error({ 
          error: orderlineError, 
          orderlineData, 
          cartItem: item 
        }, 'Failed to create orderline for cart item');
        // Continue with other orderlines even if one fails
      }
    }

    return orderlines;
  }

  async createOrderlinesFromOrderItems(
    orderId: number,
    orderItems: any[],
    orderidString: string,
    currentTime: number
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
        orderstatus: 'payment_completed',
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

  async delete(id: string) {
    try {
      // Check if order exists
      await this.findById(Number(id));

      logger.debug({ orderId: id }, 'Starting dynamic orders delete operation');

      const success = await dynamicDelete('orders', { id: parseInt(id) });

      if (!success) {
        throw new Error('Failed to delete order');
      }

      logger.info({ orderId: id }, 'Dynamic orders delete completed successfully');
    } catch (error) {
      logger.error({ error, orderId: id }, 'Error in orders delete operation');
      throw error;
    }
  }

  async upsert(data: UpsertOrdersInput & Record<string, any>) {
    try {
      const { id, ...updateData } = data;

      if (id) {
        // Update existing order
        logger.debug({ orderId: id, data: updateData }, 'Upserting existing order');
        return this.update(id.toString(), updateData);
      } else {
        // Create new order
        logger.debug({ data: updateData }, 'Upserting new order');
        return this.create(updateData);
      }
    } catch (error) {
      logger.error({ error, data }, 'Error in orders upsert operation');
      throw error;
    }
  }

  async updateOrderStatus(id: string, status: string, additionalData?: Record<string, any>) {
    try {
      logger.debug({ orderId: id, status, additionalData }, 'Starting orders status update operation');

      const updateData: Record<string, any> = {
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
    } catch (error) {
      logger.error({ error, orderId: id, status }, 'Error in orders status update operation');
      throw error;
    }
  }
} 