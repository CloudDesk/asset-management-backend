import { FastifyRequest, FastifyReply } from 'fastify';
import { OrdersService } from '../services/orders.service.js';
export declare class OrdersController {
    ordersService: OrdersService;
    private resolveInventoryActor;
    getOrders: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Mark order as ready for dispatch
     * PATCH /v1/orders/:id/ready-for-dispatch
     */
    markReadyForDispatch: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Manually ship order with vendor details
     * Automatically sets order status to 'shipped'
     * PATCH /v1/orders/:id/manual-ship
     *
     * Note: Allows updating from EKART to another vendor when EKART refuses to collect
     */
    updateShipmentDetails: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Mark order as shipped (after label printed)
     * PATCH /v1/orders/:id/mark-shipped
     */
    markShipped: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Update shipment tracking status manually
     * Works for ALL vendors (EKART + manual vendors)
     * PATCH /v1/orders/:id/shipment-status
     */
    updateShipmentStatus: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    generateOrderInvoice: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateOrderStatus: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Track order by order ID (customer-facing)
     * GET /v1/orders/:id/track
     */
    trackOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get order details with orderlines, products, and address
     * GET /v1/orders/:id/details
     * For Inventory App order detail page
     */
    getOrderDetails: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get orders by user ID with orderlines and address details
     * GET /v1/orders/user/:userid/details
     */
    getOrdersByUserIdWithDetails: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Cancel order (customer or admin initiated)
     * POST /v1/orders/:id/cancel
     */
    cancelOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Update refund status for cancelled orders (admin-only)
     * PATCH /v1/orders/:id/refund-status
     */
    updateRefundStatus: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=orders.controller.d.ts.map