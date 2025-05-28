import { FastifyRequest, FastifyReply } from 'fastify';
import { StockService } from '../services/stock.service.js';
export declare class StockController {
    stockService: StockService;
    getStocks: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getStock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createStock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateStock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteStock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertStock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateQuantities: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=stock.controller.d.ts.map