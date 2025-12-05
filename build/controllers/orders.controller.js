import { OrdersService } from '../services/orders.service.js';
import { ordersParamsSchema } from '../schemas/orders.schema.js';
import { getPaginationParams } from '../utils/pagination.js';
import { createSuccessResponse, asyncHandler } from '../utils/errorHandler.js';
import { formatEntitiesForAPI } from '../utils/dynamicDbOperations.js';
import { logger } from '../config/logger.js';
export class OrdersController {
    ordersService = new OrdersService();
    getOrders = asyncHandler(async (request, reply) => {
        // Get all query parameters as filters (not just schema-validated ones)
        const allFilters = request.query || {};
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
    markReadyForDispatch = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        const { inventory_user_id } = request.body;
        if (!inventory_user_id) {
            return reply.code(400).send({
                success: false,
                message: 'inventory_user_id is required',
                statusCode: 400
            });
        }
        const order = await this.ordersService.markReadyForDispatch(parseInt(id), inventory_user_id);
        const response = createSuccessResponse('Order marked as ready for dispatch', formatEntitiesForAPI([order], 'orders')[0]);
        return reply.code(200).send(response);
    });
    /**
     * Mark order as shipped (after label printed)
     * PATCH /v1/orders/:id/mark-shipped
     */
    markShipped = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        const { inventory_user_id } = request.body;
        if (!inventory_user_id) {
            return reply.code(400).send({
                success: false,
                message: 'inventory_user_id is required',
                statusCode: 400
            });
        }
        try {
            const order = await this.ordersService.markShipped(parseInt(id), inventory_user_id);
            const response = createSuccessResponse('Order marked as shipped', formatEntitiesForAPI([order], 'orders')[0]);
            return reply.code(200).send(response);
        }
        catch (error) {
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
    updateOrderStatus = asyncHandler(async (request, reply) => {
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
    trackOrder = asyncHandler(async (request, reply) => {
        const { id } = request.params;
        // Find order by ID or orderid (order number)
        let order;
        if (isNaN(Number(id))) {
            // If not a number, treat as orderid (order number)
            order = await this.ordersService.findByOrderNumber(id);
        }
        else {
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
        }
        catch (error) {
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
}
//# sourceMappingURL=orders.controller.js.map