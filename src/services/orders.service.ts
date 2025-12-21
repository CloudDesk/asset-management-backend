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
import { gstService } from './gst.service.js';

export class OrdersService {
  // Helper function to parse status_history
  private parseStatusHistory(statusHistory: any): any[] {
    if (!statusHistory) return [];

    // If it's already an array, return it (filter out empty objects)
    if (Array.isArray(statusHistory)) {
      return statusHistory.filter((entry: any) =>
        entry && typeof entry === 'object' && Object.keys(entry).length > 0
      );
    }

    // If it's a string, try to parse it
    if (typeof statusHistory === 'string') {
      try {
        const parsed = JSON.parse(statusHistory);
        if (Array.isArray(parsed)) {
          return parsed.filter((entry: any) =>
            entry && typeof entry === 'object' && Object.keys(entry).length > 0
          );
        }
      } catch (e) {
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

          const gstResult = await gstService.processOrderGst(
            order.id,
            addressId,
            orderAmount,
            shippingCost
          );

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
          } else {
            logger.warn({
              orderId: order.id,
              error: gstResult.error
            }, 'GST calculation failed - order created without GST data');
          }
        } catch (gstError: any) {
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
      // ✅ FIX: original_price is PER-UNIT, so multiply by quantity to get total
      totalOriginalPrice: successfulOrderlines.reduce((sum, ol) => {
        const originalPrice = parseFloat(ol.original_price?.toString() || '0') || 0;
        const quantity = parseFloat(ol.quantity?.toString() || '1') || 1;
        return sum + (originalPrice * quantity);
      }, 0),
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
        const deactivatedHistory = existingHistory.map((entry: any) => ({
          ...entry,
          is_active: false
        }));

        // New entry with is_active: true
        const historyEntry: any = {
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
   * Uses dynamicFindUnique - works when Prisma schema is available
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
   * Find order by orderid field using dynamicFindManyWithFilters
   * Use this method when you need to search by orderid (string field) and dynamicFindUnique doesn't work
   */
  async findByOrderIdString(orderIdString: string) {
    try {
      logger.debug({ orderIdString }, 'Finding order by orderid string using filters');

      const { data: orders } = await dynamicFindManyWithFilters(
        'orders',
        { orderid: orderIdString },
        { take: 1, useAllColumns: true }
      );

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
    } catch (error) {
      logger.error({ error, orderIdString }, 'Error finding order by orderid string');
      throw error;
    }
  }

  /**
   * Auto-select stocks using FIFO (First In First Out)
   */
  private async autoSelectStocks(
    productId: number | bigint,  // Product.id (orderline.productid = Product.id)
    quantity: number,  // From orderline.quantity
    platform: string,
    batchFilter?: {
      batchno?: string;
      supplierid?: number;
      poid?: number;
    }
  ): Promise<any[]> {
    try {
      // Get Product by id to get puc
      // Relationship: Product.id = orderline.productid, Stock.puc = Product.puc
      const product = await dynamicFindUnique('product', { id: productId });
      if (!product || !product.puc) {
        throw new Error(`Product not found or missing PUC for productid: ${productId}`);
      }

      const filters: any = {
        puc: product.puc,  // Stock.puc = Product.puc (where Product.id = productId)
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
        orderBy: 'createddate',  // FIFO within filtered batch
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
        throw new Error(
          `Insufficient available stock: Need ${quantity}, Found ${stocks?.length || 0}${batchInfo}`
        );
      }

      return stocks.slice(0, quantity);
    } catch (error) {
      logger.error({ error, productId, quantity, platform, batchFilter }, 'Error in autoSelectStocks');
      throw error;
    }
  }

  /**
   * Get stocks by IDs
   */
  private async getStocksByIds(stockIds: number[]): Promise<any[]> {
    try {
      const stocks: any[] = [];
      for (const stockId of stockIds) {
        const stock = await dynamicFindUnique('stock', { id: stockId });
        if (!stock) {
          throw new Error(`Stock with ID ${stockId} not found`);
        }
        stocks.push(stock);
      }
      return stocks;
    } catch (error) {
      logger.error({ error, stockIds }, 'Error in getStocksByIds');
      throw error;
    }
  }

  /**
   * Get stocks by SKUs
   */
  private async getStocksBySKUs(skus: string[]): Promise<any[]> {
    try {
      const stocks: any[] = [];
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
    } catch (error) {
      logger.error({ error, skus }, 'Error in getStocksBySKUs');
      throw error;
    }
  }

  /**
   * Allocate stock to orderlines based on stock mapping
   */
  private async allocateStockToOrderlines(
    orderId: number,
    stockMapping?: Array<{
      orderline_id: number;
      stock_ids?: number[];
      skus?: string[];
      batch_filter?: {
        batchno?: string;
        supplierid?: number;
        poid?: number;
      };
    }>
  ): Promise<Array<{ orderline_id: number; stocks: any[] }>> {
    try {
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

      const allocations: Array<{ orderline_id: number; stocks: any[] }> = [];

      for (const orderline of orderlines) {
        const mapping = stockMapping?.find(m => m.orderline_id === orderline.id);

        let stocks: any[];

        if (mapping?.stock_ids) {
          // Manual selection by stock IDs
          stocks = await this.getStocksByIds(mapping.stock_ids);
          // Validate quantity matches orderline
          if (stocks.length !== (orderline.quantity || 0)) {
            throw new Error(
              `Stock count mismatch for orderline ${orderline.id}: ` +
              `Expected ${orderline.quantity}, got ${stocks.length}`
            );
          }
        } else if (mapping?.skus) {
          // Manual selection by SKUs
          stocks = await this.getStocksBySKUs(mapping.skus);
          // Validate quantity matches orderline
          if (stocks.length !== (orderline.quantity || 0)) {
            throw new Error(
              `Stock count mismatch for orderline ${orderline.id}: ` +
              `Expected ${orderline.quantity}, got ${stocks.length}`
            );
          }
        } else if (mapping?.batch_filter) {
          // Auto-select from specific batch/filter
          stocks = await this.autoSelectStocks(
            orderline.productid,
            orderline.quantity || 1,
            'nivapp', // Default platform, can be enhanced to use order's platform
            mapping.batch_filter
          );
        } else {
          // Auto-select available stocks (FIFO - no filter)
          stocks = await this.autoSelectStocks(
            orderline.productid,
            orderline.quantity || 1,
            'nivapp' // Default platform
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
            throw new Error(
              `Stock ${stock.id} (puc: ${stock.puc}) does not match orderline product ` +
              `(productid: ${orderline.productid}, Product.puc: ${orderlineProduct?.puc || 'N/A'})`
            );
          }
        }

        allocations.push({
          orderline_id: orderline.id,
          stocks: stocks
        });
      }

      return allocations;
    } catch (error) {
      logger.error({ error, orderId, stockMapping }, 'Error in allocateStockToOrderlines');
      throw error;
    }
  }

  /**
   * Update stock status and quantities for dispatch
   */
  private async updateStockForDispatch(
    allocations: Array<{ orderline_id: number; stocks: any[] }>,
    orderId: number,  // orders.id (Int type)
    order: any         // Full order object to get order.orderid (String)
  ): Promise<void> {
    try {
      const { OrderlineService } = await import('./orderline.service.js');
      const orderlineService = new OrderlineService();
      const currentTimestamp = Date.now();

      // Track quantity updates per product/platform to avoid duplicate updates
      // Key: "productId-platform" -> quantity
      const platformStockUpdates = new Map<string, { productId: number; platform: string; quantity: number }>();
      // Key: puc -> quantity
      const productUpdates = new Map<string, number>();

      for (const allocation of allocations) {
        const orderline = await orderlineService.findById(allocation.orderline_id.toString());
        const orderlineQuantity = orderline.quantity || allocation.stocks.length; // Use orderline quantity or stock count

        // Validate stock count matches orderline quantity
        if (allocation.stocks.length !== orderlineQuantity) {
          throw new Error(
            `Stock count mismatch for orderline ${allocation.orderline_id}: ` +
            `Expected ${orderlineQuantity}, got ${allocation.stocks.length}`
          );
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
        platformStockUpdates.get(platformStockKey)!.quantity += orderlineQuantity;

        // Track Product update (aggregate by puc)
        if (!productUpdates.has(firstStock.puc)) {
          productUpdates.set(firstStock.puc, 0);
        }
        productUpdates.set(firstStock.puc, productUpdates.get(firstStock.puc)! + orderlineQuantity);

        // Update each Stock record
        for (const stock of allocation.stocks) {
          // 1. Update Stock record
          // Note: Stock.orderid is String (references orders.orderid, not orders.id)
          // Note: Stock.orderlinenumber is String (references orderline.orderlinenumber)
          await dynamicUpdate('stock', { id: stock.id }, {
            stockstatus: 'sold',
            orderid: order.orderid || orderId.toString(),  // Use orders.orderid (String) if available
            orderlinenumber: orderline.orderlinenumber,    // String type
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
    } catch (error) {
      logger.error({ error, allocations, orderId }, 'Error in updateStockForDispatch');
      throw error;
    }
  }

  /**
   * Mark order as ready for dispatch
   */
  async markReadyForDispatch(
    orderId: number,
    inventoryUserId: number,
    stockMapping?: Array<{
      orderline_id: number;
      stock_ids?: number[];
      skus?: string[];
      batch_filter?: {
        batchno?: string;
        supplierid?: number;
        poid?: number;
      };
    }>
  ): Promise<any> {
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

        const { data: orderlines } = await orderlineService.findMany(
          { orderid: orderId.toString() },
          1,
          1000
        );

        if (!orderlines || orderlines.length === 0) {
          throw new Error('No orderlines found for this order');
        }

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
      const existingHistory = Array.isArray(currentOrder.status_history)
        ? currentOrder.status_history
        : (typeof currentOrder.status_history === 'string' ? JSON.parse(currentOrder.status_history) : []);

      // Set all existing entries to is_active: false
      const deactivatedHistory = existingHistory.map((entry: any) => ({
        ...entry,
        is_active: false
      }));

      // New entry with is_active: true
      const historyEntry: any = {
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

      const updateData: Record<string, any> = {
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

  /**
   * Get order details with orderlines and address
   * For Inventory App order detail page
   * 
   * Returns specific fields only:
   * - order: Selected order fields
   * - orderlines[]: Array of orderlines with selected fields
   * - address: Address object with selected fields
   */
  async getOrderDetails(idOrOrderNumber: string): Promise<{
    order: any;
    orderlines: any[];
    address: any | null;
  }> {
    try {
      logger.info({ idOrOrderNumber }, 'Getting order details with orderlines and address');

      // Find order by ID or order number
      let fullOrder;
      if (isNaN(Number(idOrOrderNumber))) {
        // If not a number, treat as orderid (order number string)
        fullOrder = await this.findByOrderNumber(idOrOrderNumber);
      } else {
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

      const { data: rawOrderlines } = await orderlineService.findMany(
        { orderid: fullOrder.id.toString() },
        1,
        1000
      );

      // Extract only required orderline fields and enrich with combo component data
      const orderlines = await Promise.all(
        rawOrderlines.map(async (ol: any) => {
          const orderlineData: any = {
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
                  orderlineData.components = components.map((c: any) => ({
                    componentproductid: Number(c.componentproductid),
                    productname: c.componentproduct?.name || null,
                    productcategory: c.componentproduct?.category || null,
                    subcategory: c.componentproduct?.subcategory || null,
                    requiredqty: c.requiredqty || 1,
                  }));
                } catch (componentError: any) {
                  logger.warn(
                    {
                      orderlineId: ol.id,
                      productId: ol.productid,
                      error: componentError.message
                    },
                    'Failed to fetch combo components'
                  );
                  orderlineData.components = [];
                }
              }
              // If iscombo is false or undefined, don't add iscombo/components fields
              // This maintains backward compatibility - response is same as before
            } catch (productError: any) {
              logger.warn(
                {
                  orderlineId: ol.id,
                  productId: ol.productid,
                  error: productError.message
                },
                'Failed to check if product is combo'
              );
              // Don't add iscombo field on error - maintain backward compatibility
            }
          }
          // If no productid, don't add iscombo/components fields - maintain backward compatibility

          return orderlineData;
        })
      );

      // Get address from first orderline (all orderlines share same address)
      let address = null;
      const firstOrderlineWithAddress = rawOrderlines.find((ol: any) => ol.addressid);

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
        } catch (err) {
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
    } catch (error) {
      logger.error({ error, idOrOrderNumber }, 'Error getting order details');
      throw error;
    }
  }

  /**
   * Get orders by userid with orderlines and address data
   * Returns orders with nested orderlines and address information
   */
  async getOrdersByUserIdWithDetails(
    userId: number,
    page: number = 1,
    limit: number = 50
  ): Promise<{
    orders: Array<{
      id: number;
      orderamount: number | null;
      orderid: string | null;
      orderstatus: string | null;
      quantity: number | null;
      productamount: number | null;
      discountamount: number | null;
      ispaymentsucceed: boolean | null;
      mode: string | null;
      promotion_discount_total: number | null;
      original_total: number | null;
      shipping_cost: number | null;
      items_total: number | null;
      total_taxable_amount: number | null;
      total_cgst_amount: number | null;
      total_sgst_amount: number | null;
      total_igst_amount: number | null;
      total_gst_amount: number | null;
      createddate: number | null;
      modifieddate: number | null;
      status_history: any[];
      orderlines: Array<{
        id: number;
        productname: string | null;
        productcategory: string | null;
        productid: number | null;
        orderstatus: string | null;
        productamount: number | null;
        discountamount: number | null;
        orderamount: number | null;
        quantity: number | null;
        product_discount_amount: number | null;
        promotion_discount_amount: number | null;
        shipping_cost: number | null;
        createddate: number | null;
        modifieddate: number | null;
        status_history: any[];
      }>;
      address: {
        name: string | null;
        mobilenumber: string | null;
        doornumber: string | null;
        address: string | null;
        pincode: string | null;
        state: string | null;
        city: string | null;
      } | null;
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    try {
      logger.info({ userId, page, limit }, 'Getting orders by userid with orderlines and address');

      // Get orders for this user
      const ordersResult = await this.findMany(
        { userid: userId.toString() },
        page,
        limit
      );
      const orders = ordersResult.data;
      const pagination = ordersResult.pagination;

      // Get orderlines for all orders
      const { OrderlineService } = await import('./orderline.service.js');
      const orderlineService = new OrderlineService();

      // Get all order IDs
      const orderIds = orders.map((order: any) => order.id.toString());

      // Get all orderlines for these orders using dynamic operations
      // Query orderlines for each order and combine results
      const allOrderlines: any[] = [];
      for (const orderId of orderIds) {
        const { data: orderlines } = await orderlineService.findMany(
          { orderid: orderId },
          1,
          1000 // Large limit to get all orderlines for each order
        );
        allOrderlines.push(...orderlines);
      }

      // Group orderlines by orderid
      const orderlinesByOrderId = new Map<number, any[]>();
      for (const orderline of allOrderlines) {
        const orderId = Number(orderline.orderid);
        if (!orderlinesByOrderId.has(orderId)) {
          orderlinesByOrderId.set(orderId, []);
        }
        orderlinesByOrderId.get(orderId)!.push(orderline);
      }

      // Get unique address IDs from orders and orderlines
      const addressIds = new Set<number>();
      orders.forEach((order: any) => {
        if (order.addressid) addressIds.add(Number(order.addressid));
      });
      allOrderlines.forEach((orderline: any) => {
        if (orderline.addressid) addressIds.add(Number(orderline.addressid));
      });

      // Fetch all addresses in one batch
      // Query each address individually to avoid hardcoded SQL
      const addressMap = new Map<number, any>();
      if (addressIds.size > 0) {
        const addressPromises = Array.from(addressIds).map(async (addressId) => {
          try {
            const address = await dynamicFindUnique('address', { id: addressId });
            if (address) {
              return { id: addressId, address };
            }
            return null;
          } catch (error) {
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
      const ordersWithDetails = orders.map((order: any) => {
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
        const orderOrderlines = (orderlinesByOrderId.get(order.id) || []).map((ol: any) => ({
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
    } catch (error) {
      logger.error({ error, userId, page, limit }, 'Error getting orders by userid with details');
      throw error;
    }
  }

  /**
   * Cancel order (customer or admin initiated)
   * Handles stock reversal based on order status
   */
  async cancelOrder(
    orderId: number,
    userId?: number,
    inventoryUserId?: number,
    cancellationReason?: string,
    source: 'customer' | 'inventoryuser' = 'customer'
  ): Promise<any> {
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

      const { data: orderlines } = await orderlineService.findMany(
        { orderid: orderId.toString() },
        1,
        1000
      );

      if (!orderlines || orderlines.length === 0) {
        throw new Error('No orderlines found for this order');
      }

      // Determine cancellation path based on order status
      const currentTimestamp = Date.now();

      if (order.orderstatus === 'ready_for_dispatch') {
        // Path 2: Reverse stock allocations (soldqty → availableqty)
        await this.cancelOrderAfterReadyForDispatch(orderId, orderlines);
      } else {
        // Path 1: Reverse order quantities (orderedqty → availableqty)
        await this.cancelOrderBeforeReadyForDispatch(orderId, orderlines);
      }

      // Update all orderlines to cancelled
      for (const orderline of orderlines) {
        await orderlineService.updateOrderlineStatus(
          orderline.id.toString(),
          'cancelled',
          {
            source,
            userid: userId,
            inventory_user_id: inventoryUserId,
            cancellation_reason: cancellationReason
          }
        );
      }

      // Update order status to cancelled
      await this.updateOrderStatus(
        orderId.toString(),
        'cancelled',
        {
          source,
          userid: userId,
          inventory_user_id: inventoryUserId,
          cancellation_reason: cancellationReason,
          cancelleddate: currentTimestamp
        }
      );

      const updatedOrder = await this.findById(orderId);

      logger.info({
        orderId,
        previousStatus: order.orderstatus,
        newStatus: 'cancelled',
        source,
        userId,
        inventoryUserId
      }, 'Order cancelled successfully');

      return updatedOrder;
    } catch (error) {
      logger.error({ error, orderId }, 'Error cancelling order');
      throw error;
    }
  }

  /**
   * Cancel order before ready_for_dispatch
   * Reverses orderedqty → availableqty
   */
  private async cancelOrderBeforeReadyForDispatch(
    orderId: number,
    orderlines: any[]
  ): Promise<void> {
    try {
      logger.info({ orderId, orderlinesCount: orderlines.length }, 'Reversing pre-dispatch order quantities');

      const currentTimestamp = Date.now();

      // Track updates by product to avoid duplicate updates
      const platformStockUpdates = new Map<string, { productId: number; platform: string; quantity: number }>();
      const productUpdates = new Map<number, number>();

      for (const orderline of orderlines) {
        const productId = orderline.productid;
        const quantity = orderline.quantity || 0;

        if (!productId || quantity === 0) continue;

        // Get product
        const product = await dynamicFindUnique('product', { id: Number(productId) });
        if (!product) {
          logger.warn({ orderlineId: orderline.id, productId }, 'Product not found for orderline');
          continue;
        }

        // Track PlatformStock update (aggregate by productId + platform)
        const platform = 'nivapp'; // Default platform
        const platformStockKey = `${productId}-${platform}`;

        if (!platformStockUpdates.has(platformStockKey)) {
          platformStockUpdates.set(platformStockKey, {
            productId: Number(productId),
            platform,
            quantity: 0
          });
        }
        platformStockUpdates.get(platformStockKey)!.quantity += quantity;

        // Track Product update
        if (!productUpdates.has(productId)) {
          productUpdates.set(productId, 0);
        }
        productUpdates.set(productId, productUpdates.get(productId)! + quantity);
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
    } catch (error) {
      logger.error({ error, orderId }, 'Error in cancelOrderBeforeReadyForDispatch');
      throw error;
    }
  }

  /**
   * Cancel order after ready_for_dispatch
   * Reverses stock allocations and soldqty → availableqty
   */
  private async cancelOrderAfterReadyForDispatch(
    orderId: number,
    orderlines: any[]
  ): Promise<void> {
    try {
      logger.info({ orderId, orderlinesCount: orderlines.length }, 'Reversing post-dispatch stock allocations');

      const currentTimestamp = Date.now();

      // Track updates by product to avoid duplicate updates
      const platformStockUpdates = new Map<string, { productId: number; platform: string; quantity: number }>();
      const productUpdates = new Map<number, number>();

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

        // Track PlatformStock update
        const platform = firstStock.platform || 'nivapp';
        const platformStockKey = `${productId}-${platform}`;

        if (!platformStockUpdates.has(platformStockKey)) {
          platformStockUpdates.set(platformStockKey, {
            productId,
            platform,
            quantity: 0
          });
        }
        platformStockUpdates.get(platformStockKey)!.quantity += quantity;

        // Track Product update
        if (!productUpdates.has(productId)) {
          productUpdates.set(productId, 0);
        }
        productUpdates.set(productId, productUpdates.get(productId)! + quantity);
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
    } catch (error) {
      logger.error({ error, orderId }, 'Error in cancelOrderAfterReadyForDispatch');
      throw error;
    }
  }
} 