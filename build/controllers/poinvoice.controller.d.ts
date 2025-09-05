import { FastifyRequest, FastifyReply } from 'fastify';
import { PoinvoiceService } from '../services/poinvoice.service.js';
export declare class PoinvoiceController {
    poinvoiceService: PoinvoiceService;
    getPoinvoices: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getPoinvoice: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createPoinvoice: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updatePoinvoice: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deletePoinvoice: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertPoinvoice: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=poinvoice.controller.d.ts.map