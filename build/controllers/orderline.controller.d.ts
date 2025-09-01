import { FastifyRequest, FastifyReply } from 'fastify';
import { OrderlineService } from '../services/orderline.service.js';
export declare class OrderlineController {
    orderlineService: OrderlineService;
    getOrderlines: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getOrderline: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getOrderlineByOrderlineNumber: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getOrderlinesByOrderId: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createOrderline: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateOrderline: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateOrderlineStatus: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    bulkUpdateOrderlineStatus: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteOrderline: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertOrderline: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=orderline.controller.d.ts.map