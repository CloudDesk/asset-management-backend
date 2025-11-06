import { FastifyRequest, FastifyReply } from "fastify";
import { PhonePeService } from "../services/phonepe.service.js";
import { TransactionService } from "../services/transaction.service.js";
import { OrdersService } from "../services/orders.service.js";
import { OrderlineService } from "../services/orderline.service.js";
export declare class PhonePeController {
    phonePeService: PhonePeService;
    transactionService: TransactionService;
    ordersService: OrdersService;
    orderlineService: OrderlineService;
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
     * Generate merchant transaction ID
     */
    generateTransactionId: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Manually update product quantities for an existing order
     * This is useful for fixing orders where quantity updates failed
     */
    updateOrderQuantities: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
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
    createOrderAfterPayment(transactionId: string, forceMode?: string, evaluationIds?: string[]): Promise<any>;
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
    /**
     * Store transaction data with dedicated status column (NEW METHOD)
     * This method includes the new status column for better performance and consistency
     */
    private storeTransactionDataWithStatus;
    /**
     * Update product quantities and status after successful order creation
     * NEW: Now includes platform-specific stock updates for nivapp
     *
     * Flow:
     * 1. Check platformstock for nivapp (availableqty - lockqty >= ordered quantity)
     * 2. Update platformstock (availableqty, lockqty, orderedqty, platformstatus)
     * 3. Update overall product quantities and status
     *
     * Product status rules:
     * - availablequantity <= 0: "out_of_stock"
     * - availablequantity 1-5: "low_stock"
     * - availablequantity > 5: "in_stock"
     */
    updateProductQuantitiesAfterOrder(orderData: any, originalOrderItems: any[], mode: string): Promise<{
        success: boolean;
        totalProducts: number;
        successfulUpdates: number;
        failedUpdates: number;
        updateResults: never[];
        error: string;
        platform?: never;
    } | {
        success: boolean;
        totalProducts: number;
        successfulUpdates: number;
        failedUpdates: number;
        updateResults: ({
            productId: any;
            success: boolean;
            error: string;
            productName?: never;
            error_code?: never;
            critical?: never;
            productQuantityUpdate?: never;
            platformQuantityUpdate?: never;
            verification?: never;
            isPlatformStockError?: never;
        } | {
            productId: any;
            productName: any;
            success: boolean;
            error: string;
            error_code: string;
            critical: boolean;
            productQuantityUpdate?: never;
            platformQuantityUpdate?: never;
            verification?: never;
            isPlatformStockError?: never;
        } | {
            productId: any;
            productName: string;
            success: boolean;
            productQuantityUpdate: {
                requestedQuantity: any;
                oldOrderedQuantity: number;
                newOrderedQuantity: any;
                oldAvailableQuantity: number;
                newAvailableQuantity: number;
                newProductStatus: string;
            };
            platformQuantityUpdate: {
                platform: string;
                oldAvailableQty: number;
                newAvailableQty: number;
                oldLockQty: number;
                newLockQty: number;
                oldOrderedQty: number;
                newOrderedQty: number;
                newPlatformStatus: string;
            };
            verification: {
                actualOrderedQuantity: number | null | undefined;
                actualAvailableQuantity: number | null | undefined;
                actualProductStatus: string | null | undefined;
            };
            error?: never;
            error_code?: never;
            critical?: never;
            isPlatformStockError?: never;
        } | {
            productId: any;
            success: boolean;
            error: any;
            isPlatformStockError: any;
            productName?: never;
            error_code?: never;
            critical?: never;
            productQuantityUpdate?: never;
            platformQuantityUpdate?: never;
            verification?: never;
        })[];
        platform: string;
        error?: never;
    }>;
    /**
     * Cleanup expired lock (called by GCP Cloud Task)
     * POST /v1/phonepe/cleanup-lock
     *
     * This endpoint is triggered by GCP Cloud Tasks after 15 minutes of payment initiation.
     * It checks payment status and releases stock locks for abandoned/failed payments.
     */
    cleanupExpiredLock: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Check refund status
     */
    checkRefundStatus: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Create SDK Order for mobile app integration
     */
    createSdkOrder: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Handle PhonePe webhook notifications
     */
    handleWebhook: (request: FastifyRequest, reply: FastifyReply) => Promise<any>;
    /**
     * Handle payment webhook
     */
    private handlePaymentWebhook;
    /**
     * Handle refund webhook
     */
    private handleRefundWebhook;
}
//# sourceMappingURL=phonepe.controller.d.ts.map