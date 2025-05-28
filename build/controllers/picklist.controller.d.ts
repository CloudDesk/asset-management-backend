import { FastifyRequest, FastifyReply } from 'fastify';
import { PicklistService } from '../services/picklist.service.js';
export declare class PicklistController {
    picklistService: PicklistService;
    getPicklists: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getPicklist: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getPicklistByType: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createPicklist: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updatePicklist: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deletePicklist: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    toggleActive: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    reorderPicklists: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=picklist.controller.d.ts.map