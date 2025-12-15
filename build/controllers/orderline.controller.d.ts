import { FastifyRequest, FastifyReply } from 'fastify';
import { OrderlineService } from '../services/orderline.service.js';
export declare class OrderlineController {
    orderlineService: OrderlineService;
    getOrderlines: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getOrderline: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    cancelOrderline: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=orderline.controller.d.ts.map