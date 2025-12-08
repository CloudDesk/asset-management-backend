import { prisma } from '../models/prisma.js';
import { Prisma } from '@prisma/client';
import { 
  CreateOrderlineInput, 
  UpdateOrderlineInput, 
  UpsertOrderlineInput
} from '../schemas/orderline.schema.js';
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

export class OrderlineService {
  async findMany(
    filters: FilterOptions,
    page: number,
    limit: number
  ): Promise<PaginationResult<any>> {
    try {
      logger.info({ filters, page, limit }, 'Starting dynamic orderline findMany with filters');

      const { skip, take } = getPrismaSkipTake(page, limit);

      // Use the new dynamic filtering system
      const { data: orderlines, total } = await dynamicFindManyWithFilters('orderline', filters, {
        skip,
        take,
        useAllColumns: true // Get all available columns
      });

      logger.info({
        orderlineCount: orderlines.length, 
        total,
        filtered: Object.keys(filters).length > 0,
        appliedFilters: Object.keys(filters),
        availableFields: orderlines.length > 0 ? Object.keys(orderlines[0]) : []
      }, 'Dynamic orderline findMany with filters completed');

      return createPaginationResult(orderlines, total, page, limit);
    } catch (error) {
      logger.error({ error, filters, page, limit }, 'Error in dynamic orderline findMany operation');
      throw error;
    }
  }

  async findById(id: string) {
    try {
      logger.debug({ orderlineId: id }, 'Starting dynamic orderline findById operation');

      const orderline = await dynamicFindUnique('orderline', { id: parseInt(id) });

      if (!orderline) {
        throw new Error('Orderline not found');
      }

      logger.debug({ 
        orderlineId: id, 
        availableFields: Object.keys(orderline) 
      }, 'Dynamic orderline findById completed');

      return orderline;
    } catch (error) {
      logger.error({ error, orderlineId: id }, 'Error in orderline findById operation');
      throw error;
    }
  }
  async create(data: CreateOrderlineInput & Record<string, any>) {
    try {
      logger.debug({ originalData: data }, 'Starting dynamic orderline create operation');

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
        createData.orderlinenumber = `OL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      // Generate unique order id if not provided
      if (!createData.uniqueordderid) {
        createData.uniqueordderid = `UOD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      }

      const orderline = await dynamicCreate('orderline', createData);

      if (!orderline) {
        throw new Error('Failed to create orderline - no valid fields provided');
      }

      logger.info({ 
        orderlineId: orderline.id, 
        orderlinenumber: orderline.orderlinenumber,
        availableFields: Object.keys(orderline) 
      }, 'Dynamic orderline create completed');

      return orderline;
    } catch (error) {
      logger.error({ error, data }, 'Error in orderline create operation');
      throw error;
    }
  }

  async update(id: string, data: UpdateOrderlineInput & Record<string, any>) {
    try {
      // Check if orderline exists
      await this.findById(id);

      logger.debug({ originalData: data, orderlineId: id }, 'Starting dynamic orderline update operation');

      // Auto-set modified date
      const updateData = {
        ...data,
        modifieddate: data.modifieddate || Date.now(),
      };

      const orderline = await dynamicUpdate('orderline', { id: parseInt(id) }, updateData);

      if (!orderline) {
        throw new Error('Failed to update orderline - no valid fields provided');
      }

      logger.info({ 
        orderlineId: id, 
        availableFields: Object.keys(orderline) 
      }, 'Dynamic orderline update completed');

      return orderline;
    } catch (error) {
      logger.error({ error, data, orderlineId: id }, 'Error in orderline update operation');
      throw error;
    }
  }
  /**
   * Update orderline status with complete lifecycle management
   * 
   * For CANCELLATION specifically (status === 'cancelled'):
   * 
   * Flow according to ORDER_FULFILLMENT_EKART_INTEGRATION_PLAN.md Section 6:
   * 1. Check if order has tracking_id (EKART shipment created)
   * 2. If yes, attempt to cancel EKART shipment first
   *    - Scenario B (ready_for_dispatch): Should succeed
   *    - Scenario C (shipped/in_transit): May fail, but continue anyway
   * 3. Update orderline status to 'cancelled'
   * 4. Restore stock (Product + PlatformStock) - automatic via adjustProductQuantitiesOnCancellation
   * 5. Update status_history (orderline)
   * 6. Recalculate order status (may become 'cancelled' or 'partially_cancelled')
   * 7. Update order status_history (automatic via recalculateOrderStatus)
   * 
   * Stock Restoration (ORDER_ORDERLINE_LIFECYCLE_COMPLETE.md Section 12):
   * - Product: availablequantity ↑, orderedquantity ↓
   * - PlatformStock: availableqty ↑, orderedqty ↓
   * - lockqty is NOT updated (only orderedqty restored)
   * 
   * @param id - Orderline ID
   * @param status - New status (e.g., 'cancelled', 'delivered', 'shipped')
   * @param additionalData - Additional data including:
   *   - source: 'customer' | 'inventoryuser' | 'ekart' | 'phonepe' | 'system'
   *   - inventory_user_id: Required when source is 'inventoryuser'
   *   - cancellation_reason: Reason for cancellation
   */
  async updateOrderlineStatus(id: string, status: string, additionalData?: Record<string, any>) {
    try {
      logger.debug({ orderlineId: id, status, additionalData }, 'Starting orderline status update operation');

      // Get the current orderline to check if we need to adjust quantities
      const currentOrderline = await this.findById(id);
      if (!currentOrderline) {
        throw new Error(`Orderline with ID ${id} not found`);
      }

      const previousStatus = currentOrderline.orderstatus;
      // Default source to 'customer' for cancellation (as per plan), otherwise 'system'
      const source = additionalData?.source || (status.toLowerCase() === 'cancelled' ? 'customer' : 'system');
      const inventoryUserId = additionalData?.inventory_user_id;

      // ✅ CANCELLATION FLOW: Handle EKART shipment cancellation before updating status
      // According to ORDER_FULFILLMENT_EKART_INTEGRATION_PLAN.md Section 6
      if (status.toLowerCase() === 'cancelled') {
        try {
          const { OrdersService } = await import('./orders.service.js');
          const ordersService = new OrdersService();
          const order = await ordersService.findById(parseInt(currentOrderline.orderid.toString()));
          
          if (order && order.tracking_id) {
            // Scenario B & C: Cancel EKART shipment if exists
            // - Scenario B: Before label print (ready_for_dispatch) - should succeed
            // - Scenario C: After label print (shipped/in_transit) - may fail, but continue anyway
            try {
              const { ekartService } = await import('./ekart.service.js');
              await ekartService.cancelShipment(order.tracking_id);
              logger.info({ 
                trackingId: order.tracking_id, 
                orderlineId: id,
                orderId: order.id,
                orderStatus: order.orderstatus
              }, '✅ EKART shipment cancelled successfully before orderline cancellation');
            } catch (error: any) {
              // EKART cancellation may fail if shipment is already in transit
              // According to plan: Continue with cancellation anyway, EKART will handle RTO
              logger.warn({ 
                error: error.message, 
                trackingId: order.tracking_id,
                orderlineId: id,
                orderStatus: order.orderstatus
              }, '⚠️ Failed to cancel EKART shipment (may be in transit) - continuing with orderline cancellation. EKART will handle RTO automatically.');
              // Continue with cancellation anyway - stock will be restored
            }
          } else {
            // Scenario A: No tracking_id - no EKART action needed
            logger.debug({ 
              orderlineId: id,
              orderId: order?.id,
              hasTrackingId: !!order?.tracking_id
            }, 'No EKART shipment found - proceeding with orderline cancellation only');
          }
        } catch (error: any) {
          logger.warn({ 
            error: error.message, 
            orderlineId: id 
          }, 'Error checking for EKART shipment cancellation - continuing with orderline cancellation');
          // Continue with cancellation anyway - don't fail the entire operation
        }
      }

      // Prepare status history entry
      const existingHistory = Array.isArray(currentOrderline.status_history) 
        ? currentOrderline.status_history 
        : (typeof currentOrderline.status_history === 'string' ? JSON.parse(currentOrderline.status_history) : []);
      
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
        source: source,
        is_active: true
      };
      
      // Add inventory_user_id if source is inventoryuser (REQUIRED)
      if (source === 'inventoryuser') {
        if (!inventoryUserId) {
          throw new Error('inventory_user_id is required when source is inventoryuser');
        }
        historyEntry.inventory_user_id = inventoryUserId;
      }
      
      const updatedHistory = [...deactivatedHistory, historyEntry];

      const updateData: Record<string, any> = {
        orderstatus: status,
        status_history: JSON.stringify(updatedHistory), // ✅ Update status history (JSON.stringify for JSONB)
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
          // ✅ Restore stock quantities when cancelling (as per ORDER_ORDERLINE_LIFECYCLE_COMPLETE.md Section 12)
          // This updates both Product and PlatformStock tables
          await this.adjustProductQuantitiesOnCancellation(currentOrderline);
          break;
        case 'returned':
          updateData.returneddate = currentTimestamp;
          // Adjust product quantities when returning (similar to cancellation)
          await this.adjustProductQuantitiesOnCancellation(currentOrderline);
          break;
        case 'dispatched':
          updateData.dispatcheddate = currentTimestamp;
          break;
        case 'ready_to_dispatch':
          updateData.readytodispatchdate = currentTimestamp;
          break;
        case 'payment_failed':
          updateData.paymentfaileddate = currentTimestamp;
          break;
      }

      const orderline = await this.update(id, updateData);

      // ✅ IMPORTANT: Recalculate order status after orderline update
      // According to ORDER_ORDERLINE_LIFECYCLE_COMPLETE.md Section 3 & 9.12
      // Order status is automatically derived from orderline statuses
      if (orderline.orderid) {
        try {
          const { OrdersService } = await import('./orders.service.js');
          const ordersService = new OrdersService();
          await ordersService.recalculateOrderStatus(parseInt(orderline.orderid.toString()));
          
          logger.debug({ 
            orderlineId: id, 
            orderId: orderline.orderid,
            previousStatus,
            newStatus: status
          }, 'Order status recalculated after orderline status update');
        } catch (error: any) {
          logger.error(
            { error: error.message, orderlineId: id, orderId: orderline.orderid },
            'Failed to recalculate order status after orderline update'
          );
          // Don't fail the orderline update if recalculation fails
          // Orderline cancellation should succeed even if order status update fails
        }
      }

      logger.info({ 
        orderlineId: id, 
        status,
        orderlinenumber: orderline.orderlinenumber
      }, 'Orderline status update completed');

      return orderline;
    } catch (error) {
      logger.error({ error, orderlineId: id, status }, 'Error in orderline status update operation');
      throw error;
    }
  }

   /**
    * Adjust product quantities when an orderline is cancelled or returned
    * 
    * According to ORDER_ORDERLINE_LIFECYCLE_COMPLETE.md Section 12:
    * - Decrease orderedquantity by the cancelled quantity (Product + PlatformStock)
    * - Increase availablequantity by the cancelled quantity (Product + PlatformStock)
    * - Recalculate productstatus and platformstatus
    * 
    * Stock restoration happens for both:
    * - Product table (orderedquantity ↓, availablequantity ↑)
    * - PlatformStock table (orderedqty ↓, availableqty ↑)
    * 
    * Note: lockqty is NOT updated (only orderedqty is restored)
    */
   private async adjustProductQuantitiesOnCancellation(orderline: any) {
    try {
      const productId = orderline.productid;
      const cancelledQuantity = orderline.quantity || 1;

      if (!productId) {
        logger.warn({ orderlineId: orderline.id }, 'No product ID found in orderline, skipping quantity adjustment');
        return;
      }

      logger.debug({ 
        orderlineId: orderline.id, 
        productId, 
        cancelledQuantity 
      }, 'Starting product quantity adjustment for cancellation');

      // Get current product quantities
      const product = await dynamicFindUnique('product', { 
        id: parseInt(productId.toString()) 
      });

      if (!product) {
        logger.warn({ productId, orderlineId: orderline.id }, 'Product not found, skipping quantity adjustment');
        return;
      }

      const currentOrderedQuantity = product.orderedquantity || 0;
      const currentAvailableQuantity = product.availablequantity || 0;

      // Calculate new quantities
      const newOrderedQuantity = Math.max(0, currentOrderedQuantity - cancelledQuantity);
      const newAvailableQuantity = currentAvailableQuantity + cancelledQuantity;

      // Determine new product status based on available quantity
      let newProductStatus: string;
      if (newAvailableQuantity <= 0) {
        newProductStatus = "out_of_stock";
      } else if (newAvailableQuantity >= 1 && newAvailableQuantity <= 5) {
        newProductStatus = "low_stock";
      } else {
        newProductStatus = "in_stock";
      }
      // Update product quantities and status
      const updatedProduct = await dynamicUpdate('product', 
        { id: parseInt(productId.toString()) }, 
        {
          orderedquantity: newOrderedQuantity,
          availablequantity: newAvailableQuantity,
          productstatus: newProductStatus,
          modifieddate: Date.now()
        }
      );

      logger.info({
        orderlineId: orderline.id,
        productId,
        productName: product.name,
        quantityAdjustment: {
          cancelledQuantity,
          oldOrderedQuantity: currentOrderedQuantity,
          newOrderedQuantity,
          oldAvailableQuantity: currentAvailableQuantity,
          newAvailableQuantity,
          oldProductStatus: product.productstatus,
          newProductStatus
        }
      }, 'Product quantities adjusted successfully for orderline cancellation');

      // Update platformstock for NIVAPP platform
      try {
        const platformStock = await dynamicFindManyWithFilters('platformstock', {
          productid: productId.toString(),
          platform: 'nivapp'
        }, { useAllColumns: true });

        if (platformStock.data && platformStock.data.length > 0) {
          const nivappStock = platformStock.data[0];
          const currentPlatformOrderedQty = nivappStock.orderedqty || 0;
          const currentPlatformAvailableQty = nivappStock.availableqty || 0;

          // Calculate new platformstock quantities
          const newPlatformOrderedQty = Math.max(0, currentPlatformOrderedQty - cancelledQuantity);
          const newPlatformAvailableQty = currentPlatformAvailableQty + cancelledQuantity;

          // Determine platform status
          let platformStatus = 'out_of_stock';
          if (newPlatformAvailableQty > 5) {
            platformStatus = 'in_stock';
          } else if (newPlatformAvailableQty >= 1) {
            platformStatus = 'low_stock';
          }

          // Update platformstock
          await dynamicUpdate('platformstock',
            { id: nivappStock.id },
            {
              orderedqty: newPlatformOrderedQty,
              availableqty: newPlatformAvailableQty,
              platformstatus: platformStatus,
              modifieddate: Date.now()
            }
          );

          logger.info({
            orderlineId: orderline.id,
            productId,
            platform: 'nivapp',
            platformStockAdjustment: {
              cancelledQuantity,
              oldOrderedQty: currentPlatformOrderedQty,
              newOrderedQty: newPlatformOrderedQty,
              oldAvailableQty: currentPlatformAvailableQty,
              newAvailableQty: newPlatformAvailableQty,
              oldPlatformStatus: nivappStock.platformstatus,
              newPlatformStatus: platformStatus
            }
          }, 'PlatformStock (NIVAPP) quantities adjusted successfully for orderline cancellation');
        } else {
          logger.warn({ 
            productId, 
            platform: 'nivapp' 
          }, 'No platformstock found for NIVAPP, skipping platformstock adjustment');
        }
      } catch (platformError) {
        logger.error({ 
          error: platformError, 
          productId, 
          platform: 'nivapp' 
        }, 'Error adjusting platformstock quantities on cancellation');
        // Don't throw error, continue with product update success
      }

      return updatedProduct;
    } catch (error) {
      logger.error({ 
        error, 
        orderlineId: orderline.id, 
        productId: orderline.productid 
      }, 'Error adjusting product quantities on cancellation');
      // Don't throw error to avoid breaking the orderline cancellation
      // Just log the error and continue
    }
  }

  async findByOrderId(orderid: number) {
    try {
      logger.debug({ orderid }, 'Starting dynamic orderline findByOrderId operation');

      const { data: orderlines, total } = await dynamicFindManyWithFilters('orderline', { orderid }, {
        useAllColumns: true
      });

      logger.debug({ 
        orderid, 
        orderlineCount: orderlines.length,
        availableFields: orderlines.length > 0 ? Object.keys(orderlines[0]) : []
      }, 'Dynamic orderline findByOrderId completed');

      return orderlines;
    } catch (error) {
      logger.error({ error, orderid }, 'Error in orderline findByOrderId operation');
      throw error;
    }
  }
/*
  async findByOrderlineNumber(orderlinenumber: string) {
    try {
      logger.debug({ orderlinenumber }, 'Starting dynamic orderline findByOrderlineNumber operation');

      const orderline = await dynamicFindUnique('orderline', { orderlinenumber });

      if (!orderline) {
        throw new Error('Orderline not found');
      }

      logger.debug({ 
        orderlinenumber, 
        availableFields: Object.keys(orderline) 
      }, 'Dynamic orderline findByOrderlineNumber completed');

      return orderline;
    } catch (error) {
      logger.error({ error, orderlinenumber }, 'Error in orderline findByOrderlineNumber operation');
      throw error;
    }
  }


*/

/*
  async delete(id: string) {
    try {
      // Check if orderline exists
      await this.findById(id);

      logger.debug({ orderlineId: id }, 'Starting dynamic orderline delete operation');

      const success = await dynamicDelete('orderline', { id: parseInt(id) });

      if (!success) {
        throw new Error('Failed to delete orderline');
      }

      logger.info({ orderlineId: id }, 'Dynamic orderline delete completed successfully');
    } catch (error) {
      logger.error({ error, orderlineId: id }, 'Error in orderline delete operation');
      throw error;
    }
  }

  async upsert(data: UpsertOrderlineInput & Record<string, any>) {
    try {
      const { id, ...updateData } = data;

      if (id) {
        // Update existing orderline
        logger.debug({ orderlineId: id, data: updateData }, 'Upserting existing orderline');
        return this.update(id.toString(), updateData);
      } else {
        // Create new orderline
        logger.debug({ data: updateData }, 'Upserting new orderline');
        return this.create(updateData);
      }
    } catch (error) {
      logger.error({ error, data }, 'Error in orderline upsert operation');
      throw error;
    }
  }

  async bulkUpdateStatus(orderlineIds: string[], status: string, additionalData?: Record<string, any>) {
    try {
      logger.debug({ orderlineIds, status, additionalData }, 'Starting bulk orderline status update operation');

      const results = [];
      for (const id of orderlineIds) {
        try {
          const result = await this.updateOrderlineStatus(id, status, additionalData);
          results.push({ success: true, id, data: result });
        } catch (error) {
          logger.error({ error, orderlineId: id }, 'Error updating individual orderline status');
          results.push({ success: false, id, error: (error as Error).message });
        }
      }

      logger.info({ 
        totalUpdates: orderlineIds.length, 
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }, 'Bulk orderline status update completed');

      return results;
    } catch (error) {
      logger.error({ error, orderlineIds, status }, 'Error in bulk orderline status update operation');
      throw error;
    }
  }*/
} 