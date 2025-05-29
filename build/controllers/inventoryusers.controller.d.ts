import { FastifyRequest, FastifyReply } from 'fastify';
import { InventoryUsersService } from '../services/inventoryusers.service.js';
export declare class InventoryUsersController {
    inventoryUsersService: InventoryUsersService;
    getInventoryUsers: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getInventoryUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createInventoryUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateInventoryUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteInventoryUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertInventoryUser: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=inventoryusers.controller.d.ts.map