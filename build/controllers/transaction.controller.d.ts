import { FastifyRequest, FastifyReply } from 'fastify';
import { TransactionService } from '../services/transaction.service.js';
export declare class TransactionController {
    transactionService: TransactionService;
    getTransactions: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getTransaction: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getTransactionByTransactionId: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getUserTransactions: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    createTransaction: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateTransaction: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    updateTransactionByTransactionId: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteTransaction: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    deleteTransactionByTransactionId: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    upsertTransaction: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    getTransactionStats: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
}
//# sourceMappingURL=transaction.controller.d.ts.map