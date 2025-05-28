import { FastifyRequest, FastifyReply } from 'fastify';
export declare class PicklistController {
    private picklistService;
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