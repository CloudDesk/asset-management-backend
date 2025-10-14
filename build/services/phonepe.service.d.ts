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
    private sdkClient;
    constructor();
    /**
     * Initialize PhonePe SDK Client
     */
    private initializeSDKClient;
    /**
     * Initialize payment with PhonePe (using SDK or legacy method)
     */
    initiatePayment(paymentRequest: PhonePePaymentRequest): Promise<{
        success: boolean;
        message: string;
        redirectUrl?: string;
        transactionId?: string;
        error?: string;
    }>;
    /**
     * Initialize payment using PhonePe SDK (NEW)
     */
    private initiatePaymentWithSDK;
    /**
     * Initialize payment using legacy method (FALLBACK)
     */
    private initiatePaymentLegacy;
    /**
     * Check payment status with PhonePe using SDK
     */
    checkPaymentStatus(merchantTransactionId: string): Promise<PaymentStatusResponse>;
    /**
     * Check payment status using PhonePe SDK
     */
    private checkPaymentStatusWithSDK;
    /**
     * Legacy payment status check (fallback)
     */
    private checkPaymentStatusLegacy;
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
     * Create SDK Order (for mobile app integration)
     */
    createSdkOrder(orderData: {
        merchantOrderId: string;
        amount: number;
        redirectUrl: string;
        userId?: number;
        productIds?: number[];
        transactionFor?: string;
    }): Promise<{
        success: boolean;
        message: string;
        orderToken?: string;
        error?: string;
    }>;
    /**
     * Refund payment using SDK
     */
    refundPayment(merchantTransactionId: string, refundAmount?: number, reason?: string): Promise<{
        success: boolean;
        message: string;
        refundId?: string;
    }>;
    /**
     * Refund payment using SDK (simplified for now)
     */
    private refundPaymentWithSDK;
    /**
     * Legacy refund payment method
     */
    private refundPaymentLegacy;
    /**
     * Check refund status using SDK (simplified for now)
     */
    checkRefundStatus(refundId: string): Promise<{
        success: boolean;
        message: string;
        refundData?: any;
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
     * Validate PhonePe webhook signature using SDK
     */
    validateWebhookSignature(payload: string, authHeader: string): Promise<{
        isValid: boolean;
        callbackResponse?: any;
        error?: string;
    }>;
    /**
     * Legacy webhook signature validation
     */
    private validateWebhookSignatureLegacy;
}
//# sourceMappingURL=phonepe.service.d.ts.map