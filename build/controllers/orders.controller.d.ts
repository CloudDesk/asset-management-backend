import { FastifyRequest, FastifyReply } from "fastify";
import { OrdersService } from "../services/orders.service.js";
export declare class OrdersController {
    ordersService: OrdersService;
    getOrders: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getOrderByOrderId: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateOrderStatus: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=orders.controller.d.ts.map