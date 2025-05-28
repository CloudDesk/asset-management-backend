import { FastifyRequest, FastifyReply } from 'fastify';
export declare class StockController {
    private stockService;
    getStocks: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getStock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createStock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateStock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteStock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertStock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateQuantities: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=stock.controller.d.ts.map