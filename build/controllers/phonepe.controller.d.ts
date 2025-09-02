import { FastifyRequest, FastifyReply } from 'fastify';
import { PhonePeService } from '../services/phonepe.service.js';
export declare class PhonePeController {
    phonePeService: PhonePeService;
    private transactionService;
    private ordersService;
    private orderlineService;
    /**
     * Initiate payment with PhonePe
     */
    initiatePayment: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Handle payment callback from PhonePe
     */
    handlePaymentCallback: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Check payment status
     */
    checkPaymentStatus: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Process refund
     */
    processRefund: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get user transaction history
     */
    getUserTransactionHistory: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Get transaction statistics
     */
    getTransactionStats: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Handle PhonePe webhook
     */
    handleWebhook: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Generate merchant transaction ID
     */
    generateTransactionId: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Health check for PhonePe service
     */
    healthCheck: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Update transaction status in database
     */
    updateTransactionStatus(transactionId: string, status: string, paymentData: any): Promise<any>;
    /**
     * Create order and orderline records after successful payment
     */
    createOrderAfterPayment(transactionId: string, forceMode?: string): Promise<any>;
    /**
     * Validate products in batch using Prisma
     */
    private validateProductsBatch;
    /**
     * Validate and clean orderline data before creation
     */
    private validateOrderlineData;
    /**
     * Create orderlines for validated products
     */
    private createOrderlinesForProducts;
    /**
     * Check if product exists in product table
     */
    private checkProductExists;
    /**
     * Store transaction data in database
     */
    private storeTransactionData;
}
//# sourceMappingURL=phonepe.controller.d.ts.map