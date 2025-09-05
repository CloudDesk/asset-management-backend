import { FastifyRequest, FastifyReply } from 'fastify';
import { QuotesService } from '../services/quotes.service.js';
export declare class QuotesController {
    quotesService: QuotesService;
    getQuotes: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getQuote: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createQuote: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateQuote: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteQuote: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertQuote: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getQuotesByPrNumber: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getQuotesByStatus: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getQuotesStats: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Attach quote with automatic purchase request status update
     * Creates/updates quote and updates PR status to "Completed" if quote status is "closed_won"
     */
    attachQuoteWithPrStatusUpdate: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=quotes.controller.d.ts.map