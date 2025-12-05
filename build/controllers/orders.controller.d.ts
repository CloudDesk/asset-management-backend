import { FastifyRequest, FastifyReply } from 'fastify';
import { OrdersService } from '../services/orders.service.js';
export declare class OrdersController {
    ordersService: OrdersService;
    getOrders: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Mark order as ready for dispatch
     * PATCH /v1/orders/:id/ready-for-dispatch
     */
    markReadyForDispatch: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Mark order as shipped (after label printed)
     * PATCH /v1/orders/:id/mark-shipped
     */
    markShipped: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
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
}
//# sourceMappingURL=orders.controller.d.ts.map