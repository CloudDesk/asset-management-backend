export interface PhonePePaymentRequest {
    merchantTransactionId: string;
    amount: number;
    name: string;
    mobileNumber: string;
    userId: number;
    productIds?: number[];
    transactionFor?: string;
    callbackUrl?: string;
}
export interface PhonePePaymentResponse {
    success: boolean;
    code: string;
    message: string;
    data?: {
        merchantId: string;
        merchantTransactionId: string;
        instrumentResponse: {
            type: string;
            redirectInfo: {
                url: string;
                method: string;
            };
        };
    };
}
export interface PaymentStatusResponse {
    success: boolean;
    code: string;
    message: string;
    data?: {
        merchantId: string;
        merchantTransactionId: string;
        transactionId: string;
        amount: number;
        state: string;
        responseCode: string;
        paymentInstrument: {
            type: string;
            cardType?: string;
            pgTransactionId?: string;
            bankTransactionId?: string;
            pgAuthorizationCode?: string;
            arn?: string;
            bankId?: string;
            brn?: string;
        };
    };
}
export declare class PhonePeService {
    private transactionService;
    /**
     * Initialize payment with PhonePe
     */
    initiatePayment(paymentRequest: PhonePePaymentRequest): Promise<{
        success: boolean;
        message: string;
        redirectUrl?: string;
        transactionId?: string;
        error?: string;
    }>;
    /**
     * Check payment status with PhonePe
     */
    checkPaymentStatus(merchantTransactionId: string): Promise<PaymentStatusResponse>;
    /**
     * Handle payment callback from PhonePe
     */
    handlePaymentCallback(merchantTransactionId: string, authToken?: string): Promise<{
        success: boolean;
        message: string;
        redirectUrl: string;
        transactionData?: any;
    }>;
    /**
     * Refund payment
     */
    refundPayment(merchantTransactionId: string, refundAmount?: number, reason?: string): Promise<{
        success: boolean;
        message: string;
        refundId?: string;
    }>;
    /**
     * Get transaction history for a user
     */
    getUserTransactionHistory(userId: number, page?: number, limit?: number): Promise<import("../utils/errorHandler.js").SuccessResponse<import("../utils/pagination.js").PaginationResult<any>>>;
    /**
     * Get transaction statistics
     */
    getTransactionStats(userId?: number): Promise<import("../utils/errorHandler.js").SuccessResponse<any>>;
    private validatePaymentRequest;
    private createInitialTransaction;
    private updateTransactionStatus;
    /**
     * Generate unique merchant transaction ID
     */
    static generateMerchantTransactionId(prefix?: string): string;
    /**
     * Validate PhonePe webhook signature
     */
    static validateWebhookSignature(payload: string, signature: string): boolean;
}
//# sourceMappingURL=phonepe.service.d.ts.map