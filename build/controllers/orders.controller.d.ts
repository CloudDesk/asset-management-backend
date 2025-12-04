import { FastifyRequest, FastifyReply } from 'fastify';
import { OrdersService } from '../services/orders.service.js';
export declare class OrdersController {
    ordersService: OrdersService;
    getOrders: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=orders.controller.d.ts.map