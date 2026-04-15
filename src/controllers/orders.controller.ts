import { FastifyRequest, FastifyReply } from 'fastify';
import { OrdersService } from '../services/orders.service.js';
import {
  createOrdersSchema,
  updateOrdersSchema,
  upsertOrdersSchema,
  ordersParamsSchema,
  OrdersParams
} from '../schemas/orders.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import {
  createSuccessResponse,
  asyncHandler
} from '../utils/errorHandler.js';
import { formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export class OrdersController {
  public ordersService = new OrdersService();

  private resolveInventoryActor(
    request: FastifyRequest,
    fallbackInventoryUserId?: number
  ): { id: number; username: string } | null {
    const authRequest = request as AuthenticatedRequest;
    const authUser = authRequest.user;

    if (authUser?.userType === 'inventory' && authUser.id) {
      const fullName = `${authUser.firstname || ''} ${authUser.lastname || ''}`.trim();
      const username = fullName || authUser.useremail || `inventory_user_${authUser.id}`;

      if (fallbackInventoryUserId && fallbackInventoryUserId !== authUser.id) {
        logger.warn({
          tokenInventoryUserId: authUser.id,
          payloadInventoryUserId: fallbackInventoryUserId,
          endpoint: request.url
        }, 'inventory_user_id in payload does not match authenticated user; using token identity');
      }

      return {
        id: authUser.id,
        username
      };
    }

    if (fallbackInventoryUserId) {
      logger.warn({
        fallbackInventoryUserId,
        endpoint: request.url
      }, 'Authenticated inventory user context missing; falling back to payload inventory_user_id');
      return {
        id: fallbackInventoryUserId,
        username: `inventory_user_${fallbackInventoryUserId}`
      };
    }

    return null;
  }

  getOrders = asyncHandler(async (request: FastifyRequest<{ Querystring: Record<string, any> }>, reply: FastifyReply) => {
    // Get all query parameters as filters (not just schema-validated ones)
    const allFilters: Record<string, any> = request.query || {};
    const { page, limit } = getPaginationParams(allFilters);

    // Remove pagination params from filters
    const { page: _, limit: __, ...filters } = allFilters;

    const result = await this.ordersService.findMany(filters, page, limit);

    // Format all orders in the result
    const formattedData = formatEntitiesForAPI(result.data, 'orders');

    const response = createSuccessResponse('Orders retrieved successfully', formattedData);
    return reply.code(200).send({
      ...response,
      pagination: result.pagination,
      meta: {
        filters: Object.keys(filters),
        total: result.pagination.total,
        filtered: Object.keys(filters).length > 0
      }
    });
  });

  /**
   * Mark order as ready for dispatch
   * PATCH /v1/orders/:id/ready-for-dispatch
   */
  markReadyForDispatch = asyncHandler(async (
    request: FastifyRequest<{
      Params: { id: string },
      Body: {
        inventory_user_id: number;
        stock_mapping?: Array<{
          orderline_id: number;
          stock_ids?: number[];
          skus?: string[];
          batch_filter?: {
            batchno?: string;
            supplierid?: number;
            poid?: number;
          };
        }>;
      }
    }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { inventory_user_id, stock_mapping } = request.body;

    if (!inventory_user_id) {
      return reply.code(400).send({
        success: false,
        message: 'inventory_user_id is required',
        statusCode: 400
      });
    }

    const actor = this.resolveInventoryActor(request, inventory_user_id);
    if (!actor) {
      return reply.code(401).send({
        success: false,
        message: 'Authenticated inventory user is required',
        statusCode: 401
      });
    }

    const order = await this.ordersService.markReadyForDispatch(
      parseInt(id),
      actor.id,
      stock_mapping,
      actor.username
    );

    const response = createSuccessResponse(
      'Order marked as ready for dispatch',
      formatEntitiesForAPI([order], 'orders')[0]
    );
    return reply.code(200).send(response);
  });

  /**
   * Manually ship order with vendor details
   * Automatically sets order status to 'shipped'
   * PATCH /v1/orders/:id/manual-ship
   * 
   * Note: Allows updating from EKART to another vendor when EKART refuses to collect
   */
  updateShipmentDetails = asyncHandler(async (
    request: FastifyRequest<{
      Params: { id: string },
      Body: {
        tracking_id: string;
        vendor: string;
        inventory_user_id: number;
        public_tracking_link?: string;
        shipped?: boolean;
      }
    }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { tracking_id, vendor, inventory_user_id, public_tracking_link, shipped } = request.body;

    if (!tracking_id) {
      return reply.code(400).send({
        success: false,
        message: 'tracking_id is required',
        statusCode: 400
      });
    }

    if (!vendor) {
      return reply.code(400).send({
        success: false,
        message: 'vendor is required',
        statusCode: 400
      });
    }

    if (!inventory_user_id) {
      return reply.code(400).send({
        success: false,
        message: 'inventory_user_id is required',
        statusCode: 400
      });
    }

    const actor = this.resolveInventoryActor(request, inventory_user_id);
    if (!actor) {
      return reply.code(401).send({
        success: false,
        message: 'Authenticated inventory user is required',
        statusCode: 401
      });
    }

    try {
      const updatedOrder = await this.ordersService.updateShipmentDetails(
        id,
        tracking_id,
        vendor,
        actor.id,
        public_tracking_link,
        shipped,
        actor.username
      );

      const response = createSuccessResponse(
        shipped ? 'Shipment details updated and order marked as shipped' : 'Shipment details updated',
        formatEntitiesForAPI([updatedOrder], 'orders')[0]
      );
      return reply.code(200).send(response);
    } catch (error: any) {
      if (error.message.includes('Order not found')) {
        return reply.code(404).send({
          success: false,
          message: error.message,
          statusCode: 404
        });
      }
      if (error.message.includes('ready_for_dispatch')) {
        return reply.code(400).send({
          success: false,
          message: error.message,
          statusCode: 400
        });
      }
      throw error;
    }
  });

  /**
   * Mark order as shipped (after label printed)
   * PATCH /v1/orders/:id/mark-shipped
   */
  markShipped = asyncHandler(async (
    request: FastifyRequest<{ Params: { id: string }, Body: { inventory_user_id: number } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { inventory_user_id } = request.body;

    if (!inventory_user_id) {
      return reply.code(400).send({
        success: false,
        message: 'inventory_user_id is required',
        statusCode: 400
      });
    }

    const actor = this.resolveInventoryActor(request, inventory_user_id);
    if (!actor) {
      return reply.code(401).send({
        success: false,
        message: 'Authenticated inventory user is required',
        statusCode: 401
      });
    }

    try {
      const order = await this.ordersService.markShipped(parseInt(id), actor.id, actor.username);

      const response = createSuccessResponse(
        'Order marked as shipped',
        formatEntitiesForAPI([order], 'orders')[0]
      );
      return reply.code(200).send(response);
    } catch (error: any) {
      if (error.message.includes('Shipment not created')) {
        return reply.code(400).send({
          success: false,
          message: error.message,
          statusCode: 400
        });
      }
      throw error;
    }
  });

  /**
   * Update shipment tracking status manually
   * Works for ALL vendors (EKART + manual vendors)
   * PATCH /v1/orders/:id/shipment-status
   */
  updateShipmentStatus = asyncHandler(async (
    request: FastifyRequest<{
      Params: { id: string },
      Body: {
        status: string;
        inventory_user_id: number;
        location?: string;
        description?: string;
      }
    }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { status, inventory_user_id, location, description } = request.body;

    if (!status) {
      return reply.code(400).send({
        success: false,
        message: 'status is required',
        statusCode: 400
      });
    }

    if (!inventory_user_id) {
      return reply.code(400).send({
        success: false,
        message: 'inventory_user_id is required',
        statusCode: 400
      });
    }

    const actor = this.resolveInventoryActor(request, inventory_user_id);
    if (!actor) {
      return reply.code(401).send({
        success: false,
        message: 'Authenticated inventory user is required',
        statusCode: 401
      });
    }

    try {
      const updatedOrder = await this.ordersService.updateShipmentStatus(
        id,
        status,
        actor.id,
        location,
        description,
        actor.username
      );

      const response = createSuccessResponse(
        'Shipment status updated successfully',
        formatEntitiesForAPI([updatedOrder], 'orders')[0]
      );
      return reply.code(200).send(response);
    } catch (error: any) {
      if (error.message.includes('Order not found')) {
        return reply.code(404).send({
          success: false,
          message: error.message,
          statusCode: 404
        });
      }
      if (
        error.message.includes('tracking_id') ||
        error.message.includes('status') ||
        error.message.includes('transition') ||
        error.message.includes('cancelled') ||
        error.message.includes('returned')
      ) {
        return reply.code(400).send({
          success: false,
          message: error.message,
          statusCode: 400
        });
      }
      throw error;
    }
  });

  generateOrderInvoice = asyncHandler(async (
    request: FastifyRequest<{
      Params: { id: string },
      Body: { inventory_user_id: number }
    }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { inventory_user_id } = request.body;

    if (!inventory_user_id) {
      return reply.code(400).send({
        success: false,
        message: 'inventory_user_id is required',
        statusCode: 400
      });
    }

    const actor = this.resolveInventoryActor(request, inventory_user_id);
    if (!actor) {
      return reply.code(401).send({
        success: false,
        message: 'Authenticated inventory user is required',
        statusCode: 401
      });
    }

    try {
      const result = await this.ordersService.generateOrderInvoice(id);

      const response = createSuccessResponse(
        'Order invoice generated successfully',
        {
          ...formatEntitiesForAPI([result.order], 'orders')[0],
          invoiceUrl: result.invoiceUrl,
          generated_by_inventory_user_id: actor.id
        }
      );

      return reply.code(200).send(response);
    } catch (error: any) {
      if (error.message.includes('Order not found')) {
        return reply.code(404).send({
          success: false,
          message: error.message,
          statusCode: 404
        });
      }

      if (error.message.includes('Invoice generation failed')) {
        return reply.code(400).send({
          success: false,
          message: error.message,
          statusCode: 400
        });
      }

      throw error;
    }
  });

  updateOrderStatus = asyncHandler(async (request: FastifyRequest<{ Params: OrdersParams; Body: { status: string; additionalData?: Record<string, any> } }>, reply: FastifyReply) => {
    const { id } = ordersParamsSchema.parse(request.params);
    const { status, additionalData } = request.body;

    if (!status) {
      return reply.code(400).send({
        success: false,
        message: 'Status is required',
        details: 'Please provide a valid status',
        statusCode: 400
      });
    }

    const order = await this.ordersService.updateOrderStatus(id, status, additionalData);

    const response = createSuccessResponse('Order status updated successfully', formatEntitiesForAPI([order], 'orders')[0]);
    return reply.code(200).send(response);
  });

  /**
   * Track order by order ID (customer-facing)
   * GET /v1/orders/:id/track
   */
  trackOrder = asyncHandler(async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    // Find order by ID or orderid (order number)
    let order;
    if (isNaN(Number(id))) {
      // If not a number, treat as orderid (order number)
      order = await this.ordersService.findByOrderNumber(id);
    } else {
      // If number, treat as database ID
      order = await this.ordersService.findById(Number(id));
    }

    if (!order) {
      return reply.code(404).send({
        success: false,
        message: 'Order not found',
        statusCode: 404
      });
    }

    // Check if order has been shipped
    if (!order.tracking_id) {
      return reply.code(200).send(createSuccessResponse('Order tracking information', {
        order_id: order.id,
        order_number: order.orderid,
        order_status: order.orderstatus,
        tracking_id: null,
        message: 'Order has not been shipped yet',
        tracking_available: false
      }));
    }

    // Get EKART tracking info
    try {
      const { ekartService } = await import('../services/ekart.service.js');
      const trackingInfo = await ekartService.trackShipment(order.tracking_id);

      return reply.code(200).send(createSuccessResponse('Order tracking retrieved successfully', {
        order_id: order.id,
        order_number: order.orderid,
        order_status: order.orderstatus,
        tracking_id: order.tracking_id,
        vendor: order.vendor || 'EKART',
        public_tracking_link: order.public_tracking_link || `https://app.elite.ekartlogistics.in/track/${order.tracking_id}`,
        ekart_tracking: {
          status: trackingInfo.track?.status,
          current_location: trackingInfo.track?.location,
          description: trackingInfo.track?.desc,
          estimated_delivery: trackingInfo.edd ? new Date(trackingInfo.edd).toISOString() : null,
          status_history: trackingInfo.track?.details || [],
          ndr_status: trackingInfo.track?.ndrStatus,
          ndr_actions: trackingInfo.track?.ndrActions,
          attempts: trackingInfo.track?.attempts
        },
        tracking_available: true
      }));
    } catch (error: any) {
      logger.error({ error: error.message, trackingId: order.tracking_id }, 'Failed to fetch EKART tracking info');

      // Return order info even if EKART tracking fails
      return reply.code(200).send(createSuccessResponse('Order tracking information (EKART tracking unavailable)', {
        order_id: order.id,
        order_number: order.orderid,
        order_status: order.orderstatus,
        tracking_id: order.tracking_id,
        vendor: order.vendor || 'EKART',
        public_tracking_link: order.public_tracking_link || `https://app.elite.ekartlogistics.in/track/${order.tracking_id}`,
        message: 'EKART tracking information temporarily unavailable',
        tracking_available: true
      }));
    }
  });

  /**
   * Get order details with orderlines, products, and address
   * GET /v1/orders/:id/details
   * For Inventory App order detail page
   */
  getOrderDetails = asyncHandler(async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;

    try {
      const orderDetails = await this.ordersService.getOrderDetails(id);

      if (!orderDetails) {
        return reply.code(404).send({
          success: false,
          message: 'Order not found',
          statusCode: 404
        });
      }

      return reply.code(200).send(createSuccessResponse('Order details retrieved successfully', orderDetails));
    } catch (error: any) {
      if (error.message === 'Order not found') {
        return reply.code(404).send({
          success: false,
          message: 'Order not found',
          statusCode: 404
        });
      }
      throw error;
    }
  });

  /**
   * Get orders by user ID with orderlines and address details
   * GET /v1/orders/user/:userid/details
   */
  getOrdersByUserIdWithDetails = asyncHandler(async (
    request: FastifyRequest<{
      Params: { userid: string },
      Querystring: {
        page?: string;
        limit?: string;
        orderstatus?: string;
        date_range?: string;
        start_date?: string;
        end_date?: string;
        mode?: string;
        amount_range?: string;
        min_amount?: string;
        max_amount?: string;
      }
    }>,
    reply: FastifyReply
  ) => {
    const { userid } = request.params;
    const {
      page: pageStr,
      limit: limitStr,
      orderstatus,
      date_range,
      start_date,
      end_date,
      mode,
      amount_range,
      min_amount,
      max_amount
    } = request.query;

    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 10;

    if (isNaN(Number(userid))) {
      return reply.code(400).send({
        success: false,
        message: 'Invalid user ID',
        statusCode: 400
      });
    }

    const userId = parseInt(userid, 10);

    // Build filters object (only include defined values to satisfy TypeScript strict mode)
    const filters: {
      orderstatus?: string;
      date_range?: string;
      start_date?: string;
      end_date?: string;
      mode?: string;
      amount_range?: string;
      min_amount?: string;
      max_amount?: string;
    } = {};

    if (orderstatus) filters.orderstatus = orderstatus;
    if (date_range) filters.date_range = date_range;
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;
    if (mode) filters.mode = mode;
    if (amount_range) filters.amount_range = amount_range;
    if (min_amount) filters.min_amount = min_amount;
    if (max_amount) filters.max_amount = max_amount;

    const result = await this.ordersService.getOrdersByUserIdWithDetails(userId, page, limit, filters);

    return reply.code(200).send({
      success: true,
      message: 'Orders retrieved successfully',
      data: result.orders,
      pagination: result.pagination
    });
  });

  /**
   * Cancel order (customer or admin initiated)
   * POST /v1/orders/:id/cancel
   */
  cancelOrder = asyncHandler(async (
    request: FastifyRequest<{
      Params: { id: string },
      Body: {
        userid?: number;
        inventory_user_id?: number;
        cancellation_reason: string;
      }
    }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const { userid, inventory_user_id, cancellation_reason } = request.body;

    // Validate: at least one of userid or inventory_user_id required
    if (!userid && !inventory_user_id) {
      return reply.code(400).send({
        success: false,
        message: 'Either userid or inventory_user_id is required',
        statusCode: 400
      });
    }

    // Cancellation reason is required
    if (!cancellation_reason) {
      return reply.code(400).send({
        success: false,
        message: 'cancellation_reason is required',
        statusCode: 400
      });
    }

    // Determine source
    const source: 'customer' | 'inventory_user' = userid ? 'customer' : 'inventory_user';
    const actor = source === 'inventory_user'
      ? this.resolveInventoryActor(request, inventory_user_id)
      : null;

    if (source === 'inventory_user' && !actor) {
      return reply.code(401).send({
        success: false,
        message: 'Authenticated inventory user is required',
        statusCode: 401
      });
    }

    try {
      // Parse order ID
      let orderId: number;
      if (isNaN(Number(id))) {
        // If not a number, treat as orderid (order number)
        const order = await this.ordersService.findByOrderNumber(id);
        if (!order) {
          return reply.code(404).send({
            success: false,
            message: 'Order not found',
            statusCode: 404
          });
        }
        orderId = order.id;
      } else {
        orderId = Number(id);
      }

      // Call service to cancel order
      const cancelledOrder = await this.ordersService.cancelOrder(
        orderId,
        userid,
        actor?.id || inventory_user_id,
        cancellation_reason,
        source,
        actor?.username
      );

      const response = createSuccessResponse(
        'Order cancelled successfully',
        formatEntitiesForAPI([cancelledOrder], 'orders')[0]
      );
      return reply.code(200).send(response);
    } catch (error: any) {
      // Handle specific error cases
      if (error.message.includes('Order cannot be cancelled')) {
        return reply.code(400).send({
          success: false,
          message: error.message,
          statusCode: 400
        });
      }

      if (error.message.includes('Unauthorized')) {
        return reply.code(403).send({
          success: false,
          message: error.message,
          statusCode: 403
        });
      }

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          message: error.message,
          statusCode: 404
        });
      }

      // Generic error
      throw error;
    }
  });

  /**
   * Update refund status for cancelled orders (admin-only)
   * PATCH /v1/orders/:id/refund-status
   */
  updateRefundStatus = asyncHandler(async (
    request: FastifyRequest<{
      Params: { id: string },
      Body: {
        status: 'cancelled_refund_processing' | 'cancelled_refunded' | 'cancelled_completed';
        admin_user_id: number;
        notes?: string;
        // NEW: Optional structured refund fields
        refund_transaction_id?: string;
        refund_amount?: number;
        refund_reference?: string;
      }
    }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const {
      status,
      admin_user_id,
      notes,
      refund_transaction_id,
      refund_amount,
      refund_reference
    } = request.body;

    // Validate required fields
    if (!status) {
      return reply.code(400).send({
        success: false,
        message: 'status is required',
        statusCode: 400
      });
    }

    if (!admin_user_id) {
      return reply.code(400).send({
        success: false,
        message: 'admin_user_id is required',
        statusCode: 400
      });
    }

    const actor = this.resolveInventoryActor(request, admin_user_id);
    if (!actor) {
      return reply.code(401).send({
        success: false,
        message: 'Authenticated inventory user is required',
        statusCode: 401
      });
    }

    // Validate status value
    const validStatuses = ['cancelled_refund_processing', 'cancelled_refunded', 'cancelled_completed'];
    if (!validStatuses.includes(status)) {
      return reply.code(400).send({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        statusCode: 400
      });
    }

    try {
      // Parse order ID
      let orderId: number;
      if (isNaN(Number(id))) {
        // If not a number, treat as orderid (order number)
        const order = await this.ordersService.findByOrderNumber(id);
        if (!order) {
          return reply.code(404).send({
            success: false,
            message: 'Order not found',
            statusCode: 404
          });
        }
        orderId = order.id;
      } else {
        orderId = Number(id);
      }

      // Call service to update refund status with new fields
      const updatedOrder = await this.ordersService.updateRefundStatus(
        orderId,
        status,
        actor.id,
        notes,
        refund_transaction_id,
        refund_amount,
        refund_reference,
        actor.username
      );

      const response = createSuccessResponse(
        'Refund status updated successfully',
        formatEntitiesForAPI([updatedOrder], 'orders')[0]
      );
      return reply.code(200).send(response);
    } catch (error: any) {
      // Handle specific error cases
      if (error.message.includes('Cannot update refund status')) {
        return reply.code(400).send({
          success: false,
          message: error.message,
          statusCode: 400
        });
      }

      if (error.message.includes('already in final status')) {
        return reply.code(400).send({
          success: false,
          message: error.message,
          statusCode: 400
        });
      }

      if (error.message.includes('not found')) {
        return reply.code(404).send({
          success: false,
          message: error.message,
          statusCode: 404
        });
      }

      // Generic error
      throw error;
    }
  });
} 
