import crypto from "crypto";
import axios from "axios";
import { logger } from "../config/logger.js";
import { TransactionService } from "./transaction.service.js";
import { createSuccessResponse, DatabaseError, ValidationError, } from "../utils/errorHandler.js";
// Import PhonePe SDK
import { StandardCheckoutClient, Env, MetaInfo, StandardCheckoutPayRequest, PhonePeException, } from "pg-sdk-node";
// PhonePe Configuration
const PHONEPE_CONFIG = {
    // Legacy/Fallback configuration (kept for backward compatibility)
    MERCHANT_ID: process.env.PHONEPE_MERCHANT_ID,
    SALT_KEY: process.env.PHONEPE_SALT_KEY,
    KEY_INDEX: 1,
    BASE_URL: process.env.PHONEPE_BASE_URL,
    // New SDK Configuration
    CLIENT_ID: process.env.PHONEPE_CLIENT_ID || "",
    CLIENT_SECRET: process.env.PHONEPE_CLIENT_SECRET || "",
    CLIENT_VERSION: parseInt(process.env.PHONEPE_CLIENT_VERSION || "1"),
    USE_SDK: process.env.PHONEPE_USE_SDK === "true" || true, // Default to SDK if credentials present
    ENVIRONMENT: (process.env.PHONEPE_ENVIRONMENT || "SANDBOX"),
    // Redirect URLs
    REDIRECT_SUCCESS: process.env.REDIRECT_URL_SUCCESS || "http://localhost:5600/payment/success",
    REDIRECT_FAILURE: process.env.REDIRECT_URL_FAILURE || "http://localhost:5600/payment/failure",
    REDIRECT_STATUS: process.env.REDIRECT_URL_PAYMENT_STATUS || "http://localhost:5600",
    // REDIRECT_STATUS: 'https://foal-stirring-illegally.ngrok-free.app'
    // REDIRECT_STATUS: 'https://85c96baef4c7.ngrok-free.app'
};
export class PhonePeService {
    transactionService = new TransactionService();
    sdkClient = null;
    constructor() {
        // Initialize SDK client if credentials are available
        this.initializeSDKClient();
    }
    /**
     * Initialize PhonePe SDK Client
     */
    initializeSDKClient() {
        try {
            if (PHONEPE_CONFIG.CLIENT_ID &&
                PHONEPE_CONFIG.CLIENT_SECRET &&
                PHONEPE_CONFIG.USE_SDK) {
                const env = PHONEPE_CONFIG.ENVIRONMENT === "PRODUCTION"
                    ? Env.PRODUCTION
                    : Env.SANDBOX;
                this.sdkClient = StandardCheckoutClient.getInstance(PHONEPE_CONFIG.CLIENT_ID, PHONEPE_CONFIG.CLIENT_SECRET, PHONEPE_CONFIG.CLIENT_VERSION, env);
                logger.info({
                    environment: PHONEPE_CONFIG.ENVIRONMENT,
                    clientVersion: PHONEPE_CONFIG.CLIENT_VERSION,
                    usingSDK: true,
                }, "PhonePe SDK client initialized successfully");
            }
            else {
                logger.info({
                    usingSDK: false,
                    reason: "SDK credentials not provided or SDK disabled",
                }, "Using legacy PhonePe integration");
            }
        }
        catch (error) {
            logger.error({
                error: error.message,
                stack: error.stack,
            }, "Failed to initialize PhonePe SDK client, falling back to legacy integration");
            this.sdkClient = null;
        }
    }
    /**
     * Initialize payment with PhonePe (using SDK or legacy method)
     */
    async initiatePayment(paymentRequest) {
        try {
            // Validate required fields
            this.validatePaymentRequest(paymentRequest);
            const { merchantTransactionId, amount, name, mobileNumber, userId, productIds = [], transactionFor = "product_purchase", callbackUrl, } = paymentRequest;
            // Create PhonePe callback URL
            const finalCallbackUrl = callbackUrl ||
                `${PHONEPE_CONFIG.REDIRECT_STATUS}/v1/phonepe/callback/${merchantTransactionId}`;
            logger.info({
                merchantTransactionId,
                amount,
                userId,
                productIds,
                usingSDK: !!this.sdkClient,
            }, "Initiating PhonePe payment");
            // Use SDK if available, otherwise fall back to legacy integration
            if (this.sdkClient) {
                return await this.initiatePaymentWithSDK(paymentRequest, finalCallbackUrl);
            }
            else {
                return await this.initiatePaymentLegacy(paymentRequest, finalCallbackUrl);
            }
        }
        catch (error) {
            logger.error({
                error: error.message,
                stack: error.stack,
                paymentRequest,
            }, "Error initiating PhonePe payment");
            // Update transaction with error status if it exists
            try {
                const existingTransaction = await this.transactionService.findByTransactionId(paymentRequest.merchantTransactionId);
                if (existingTransaction) {
                    await this.updateTransactionStatus(paymentRequest.merchantTransactionId, "FAILED", { error: error.message });
                }
            }
            catch (updateError) {
                logger.error({ updateError }, "Failed to update transaction status after payment initiation error");
            }
            return {
                success: false,
                message: "Payment initiation failed",
                error: error.message,
            };
        }
    }
    /**
     * Initialize payment using PhonePe SDK (NEW)
     */
    async initiatePaymentWithSDK(paymentRequest, callbackUrl) {
        const { merchantTransactionId, amount, name, mobileNumber, userId, productIds = [], transactionFor = "product_purchase", } = paymentRequest;
        try {
            // Build metadata for the payment
            const metaInfo = MetaInfo.builder()
                .udf1(userId.toString())
                .udf2(transactionFor)
                .udf3(productIds.join(","))
                .udf4(name)
                .udf5(mobileNumber)
                .build();
            // Build payment request using SDK
            const sdkRequest = StandardCheckoutPayRequest.builder()
                .merchantOrderId(merchantTransactionId)
                .amount(Math.round(amount * 100)) // Convert to paise
                .redirectUrl(callbackUrl)
                .metaInfo(metaInfo)
                .build();
            logger.info({
                merchantTransactionId,
                callbackUrl,
                redirectStatus: PHONEPE_CONFIG.REDIRECT_STATUS,
                step: "phonepe_sdk_request_built",
            }, "PhonePe SDK request built");
            // Make payment request using SDK
            const response = await this.sdkClient.pay(sdkRequest);
            logger.info({
                merchantTransactionId,
                hasRedirectUrl: !!response.redirectUrl,
                sdkResponse: response,
            }, "PhonePe payment initiated successfully via SDK");
            if (response.redirectUrl) {
                return {
                    success: true,
                    message: "Payment initiated successfully",
                    redirectUrl: response.redirectUrl,
                    transactionId: merchantTransactionId,
                };
            }
            else {
                throw new Error("No redirect URL received from PhonePe SDK");
            }
        }
        catch (error) {
            logger.error({
                error: error.message,
                stack: error.stack,
                merchantTransactionId,
            }, "Error initiating payment with PhonePe SDK");
            throw error;
        }
    }
    /**
     * Initialize payment using legacy method (FALLBACK)
     */
    async initiatePaymentLegacy(paymentRequest, callbackUrl) {
        const { merchantTransactionId, amount, name, mobileNumber } = paymentRequest;
        try {
            const paymentData = {
                merchantId: PHONEPE_CONFIG.MERCHANT_ID,
                merchantTransactionId,
                name,
                amount: Math.round(amount * 100), // Convert to paise
                redirectUrl: callbackUrl,
                redirectMode: "POST",
                mobileNumber,
                paymentInstrument: {
                    type: "PAY_PAGE",
                },
            };
            // Log the callback URL being sent to PhonePe
            logger.info({
                merchantTransactionId,
                callbackUrl: callbackUrl,
                redirectStatus: PHONEPE_CONFIG.REDIRECT_STATUS,
                step: "phonepe_callback_url_set",
            }, "PhonePe callback URL configured (legacy)");
            // Create base64 encoded payload
            const payload = JSON.stringify(paymentData);
            const payloadMain = Buffer.from(payload).toString("base64");
            // Generate checksum
            const checksumString = payloadMain + "/pg/v1/pay" + PHONEPE_CONFIG.SALT_KEY;
            const sha256 = crypto
                .createHash("sha256")
                .update(checksumString)
                .digest("hex");
            const checksum = sha256 + "###" + PHONEPE_CONFIG.KEY_INDEX;
            // Make API call to PhonePe
            const apiUrl = `${PHONEPE_CONFIG.BASE_URL}/pg/v1/pay`;
            const headers = {
                accept: "application/json",
                "Content-Type": "application/json",
                "X-VERIFY": checksum,
            };
            const response = await axios.post(apiUrl, {
                request: payloadMain,
            }, { headers });
            logger.info({
                merchantTransactionId,
                success: response.data.success,
                code: response.data.code,
                phonePeResponse: response.data,
                callbackUrl: callbackUrl,
            }, "PhonePe payment initiated successfully (legacy)");
            if (response.data.success &&
                response.data.data?.instrumentResponse?.redirectInfo?.url) {
                return {
                    success: true,
                    message: "Payment initiated successfully",
                    redirectUrl: response.data.data.instrumentResponse.redirectInfo.url,
                    transactionId: merchantTransactionId,
                };
            }
            else {
                throw new Error(response.data.message || "Failed to initiate payment");
            }
        }
        catch (error) {
            logger.error({
                error: error.message,
                stack: error.stack,
                merchantTransactionId,
            }, "Error initiating payment with legacy PhonePe integration");
            throw error;
        }
    }
    /**
     * Check payment status with PhonePe using SDK
     */
    async checkPaymentStatus(merchantTransactionId) {
        try {
            logger.info({ merchantTransactionId }, "Checking PhonePe payment status");
            // Use SDK method if available, otherwise fall back to legacy
            if (this.sdkClient) {
                return await this.checkPaymentStatusWithSDK(merchantTransactionId);
            }
            else {
                return await this.checkPaymentStatusLegacy(merchantTransactionId);
            }
        }
        catch (error) {
            // Handle PhonePe SDK exceptions
            if (error instanceof PhonePeException) {
                logger.error({
                    error: error.message,
                    merchantTransactionId,
                    phonePeError: {
                        code: error.code,
                        message: error.message,
                        data: error.data,
                    },
                }, "PhonePe SDK error checking payment status");
                throw new DatabaseError("PhonePe SDK error", error.message);
            }
            logger.error({
                error: error.message,
                merchantTransactionId,
            }, "Error checking PhonePe payment status");
            throw new DatabaseError("Failed to check payment status", error.message);
        }
    }
    /**
     * Check payment status using PhonePe SDK
     */
    async checkPaymentStatusWithSDK(merchantTransactionId) {
        try {
            logger.info({ merchantTransactionId }, "Using SDK to check payment status");
            const orderStatus = await this.sdkClient.getOrderStatus(merchantTransactionId);
            logger.info({
                merchantTransactionId,
                orderStatus: {
                    orderId: orderStatus.orderId,
                    state: orderStatus.state,
                    amount: orderStatus.amount,
                },
            }, "PhonePe SDK order status retrieved");
            // Convert SDK response to our expected format
            const isSuccess = orderStatus.state === "COMPLETED";
            return {
                success: isSuccess,
                code: isSuccess ? "PAYMENT_SUCCESS" : orderStatus.state,
                message: isSuccess
                    ? "Payment successful"
                    : `Payment ${orderStatus.state}`,
                data: {
                    merchantId: PHONEPE_CONFIG.CLIENT_ID,
                    merchantTransactionId: orderStatus.orderId,
                    transactionId: orderStatus.orderId,
                    amount: orderStatus.amount,
                    state: orderStatus.state,
                    responseCode: isSuccess ? "SUCCESS" : orderStatus.state,
                    paymentInstrument: {
                        type: "UNKNOWN",
                    },
                },
            };
        }
        catch (error) {
            logger.error({
                error: error.message,
                merchantTransactionId,
                stack: error.stack,
            }, "Error checking payment status with SDK");
            // If SDK fails, fall back to legacy method
            logger.info({ merchantTransactionId }, "Falling back to legacy status check");
            return await this.checkPaymentStatusLegacy(merchantTransactionId);
        }
    }
    /**
     * Legacy payment status check (fallback)
     */
    async checkPaymentStatusLegacy(merchantTransactionId) {
        try {
            logger.info({ merchantTransactionId }, "Using legacy method to check payment status");
            // Generate checksum for status check
            const checksumString = `/pg/v1/status/${PHONEPE_CONFIG.MERCHANT_ID}/${merchantTransactionId}` +
                PHONEPE_CONFIG.SALT_KEY;
            const sha256 = crypto
                .createHash("sha256")
                .update(checksumString)
                .digest("hex");
            const checksum = sha256 + "###" + PHONEPE_CONFIG.KEY_INDEX;
            const apiUrl = `${PHONEPE_CONFIG.BASE_URL}/pg/v1/status/${PHONEPE_CONFIG.MERCHANT_ID}/${merchantTransactionId}`;
            const headers = {
                accept: "application/json",
                "Content-Type": "application/json",
                "X-VERIFY": checksum,
                "X-MERCHANT-ID": PHONEPE_CONFIG.MERCHANT_ID,
            };
            const response = await axios.get(apiUrl, { headers });
            // Enhanced logging to debug the empty response issue
            console.log("=== PHONEPE STATUS API RESPONSE ===");
            console.log("URL:", apiUrl);
            console.log("Headers:", headers);
            console.log("Response Status:", response.status);
            console.log("Response Data:", JSON.stringify(response.data, null, 2));
            console.log("=== END PHONEPE STATUS RESPONSE ===");
            // Handle HTTP 204 (No Content) - Transaction not found or expired
            if (response.status === 204 || !response.data || response.data === "") {
                logger.warn({
                    merchantTransactionId,
                    responseStatus: response.status,
                    issue: "HTTP 204 - Transaction not found or expired",
                }, "PhonePe transaction not found - likely cancelled or expired");
                return {
                    success: false,
                    code: "TRANSACTION_NOT_FOUND",
                    message: "Transaction not found or expired",
                };
            }
            logger.info({
                merchantTransactionId,
                apiUrl,
                responseStatus: response.status,
                responseData: response.data,
                status: response.data?.code,
                success: response.data?.success,
                message: response.data?.message,
            }, "PhonePe payment status checked - LEGACY METHOD");
            return response.data;
        }
        catch (error) {
            logger.error({
                error: error.message,
                merchantTransactionId,
            }, "Error checking PhonePe payment status with legacy method");
            throw new DatabaseError("Failed to check payment status", error.message);
        }
    }
    /**
     * Handle payment callback from PhonePe
     */
    async handlePaymentCallback(merchantTransactionId, authToken) {
        try {
            logger.info({ merchantTransactionId }, "Handling PhonePe payment callback");
            // Check if transaction exists
            const existingTransaction = await this.transactionService.findByTransactionId(merchantTransactionId);
            if (!existingTransaction) {
                logger.error({ merchantTransactionId }, "Transaction not found for callback");
                return {
                    success: false,
                    message: "Transaction not found",
                    redirectUrl: PHONEPE_CONFIG.REDIRECT_FAILURE,
                };
            }
            // Get payment status from PhonePe
            const paymentStatus = await this.checkPaymentStatus(merchantTransactionId);
            if (paymentStatus.success && paymentStatus.code === "PAYMENT_SUCCESS") {
                // Payment successful
                const updatedTransaction = await this.updateTransactionStatus(merchantTransactionId, "SUCCESS", paymentStatus);
                logger.info({
                    merchantTransactionId,
                    amount: paymentStatus.data?.amount,
                    transactionId: paymentStatus.data?.transactionId,
                }, "Payment completed successfully");
                return {
                    success: true,
                    message: "Payment completed successfully",
                    redirectUrl: PHONEPE_CONFIG.REDIRECT_SUCCESS,
                    transactionData: updatedTransaction,
                };
            }
            else {
                // Payment failed
                await this.updateTransactionStatus(merchantTransactionId, "FAILED", paymentStatus);
                logger.warn({
                    merchantTransactionId,
                    code: paymentStatus.code,
                    message: paymentStatus.message,
                }, "Payment failed");
                return {
                    success: false,
                    message: paymentStatus.message || "Payment was not successful",
                    redirectUrl: PHONEPE_CONFIG.REDIRECT_FAILURE,
                };
            }
        }
        catch (error) {
            logger.error({
                error: error.message,
                merchantTransactionId,
            }, "Error handling PhonePe payment callback");
            // Update transaction with error status
            try {
                await this.updateTransactionStatus(merchantTransactionId, "ERROR", {
                    error: error.message,
                });
            }
            catch (updateError) {
                logger.error({ updateError }, "Failed to update transaction status after callback error");
            }
            return {
                success: false,
                message: "Payment processing failed",
                redirectUrl: PHONEPE_CONFIG.REDIRECT_FAILURE,
            };
        }
    }
    /**
     * Create SDK Order (for mobile app integration)
     * Uses the same proven approach as /v1/phonepe/initiate
     */
    async createSdkOrder(orderData) {
        try {
            logger.info({
                merchantOrderId: orderData.merchantOrderId,
                amount: orderData.amount,
                userId: orderData.userId,
            }, "Creating SDK order using PhonePe API");
            // Use the same approach as /v1/phonepe/initiate (PROVEN TO WORK)
            // Build payment data (same as legacy method)
            const paymentData = {
                merchantId: PHONEPE_CONFIG.MERCHANT_ID,
                merchantTransactionId: orderData.merchantOrderId,
                name: `User_${orderData.userId || "guest"}`,
                amount: Math.round(orderData.amount * 100), // Convert to paise
                redirectUrl: orderData.redirectUrl,
                redirectMode: "POST",
                mobileNumber: "9999999999", // Placeholder for SDK orders
                paymentInstrument: {
                    type: "PAY_PAGE",
                },
            };
            // Create base64 encoded payload
            const payload = JSON.stringify(paymentData);
            const payloadMain = Buffer.from(payload).toString("base64");
            // Generate checksum (same as legacy method)
            const checksumString = payloadMain + "/pg/v1/pay" + PHONEPE_CONFIG.SALT_KEY;
            const sha256 = crypto
                .createHash("sha256")
                .update(checksumString)
                .digest("hex");
            const checksum = sha256 + "###" + PHONEPE_CONFIG.KEY_INDEX;
            // Make API call to PhonePe (same as legacy method)
            const apiUrl = `${PHONEPE_CONFIG.BASE_URL}/pg/v1/pay`;
            const headers = {
                accept: "application/json",
                "Content-Type": "application/json",
                "X-VERIFY": checksum,
            };
            logger.info({
                merchantOrderId: orderData.merchantOrderId,
                apiUrl,
                hasChecksum: !!checksum,
            }, "Calling PhonePe API for SDK order");
            const response = await axios.post(apiUrl, {
                request: payloadMain,
            }, { headers });
            // DEBUG: Log full response to understand structure
            console.log("=== PHONEPE API RESPONSE DEBUG ===");
            console.log("Full response.data:", JSON.stringify(response.data, null, 2));
            console.log("==================================");
            logger.info({
                merchantOrderId: orderData.merchantOrderId,
                success: response.data.success,
                code: response.data.code,
                hasRedirectInfo: !!response.data.data?.instrumentResponse?.redirectInfo,
                fullResponseData: response.data,
            }, "PhonePe API response received for SDK order");
            // Extract redirectUrl (same path as legacy method)
            const redirectUrlFromPhonePe = response.data.data?.instrumentResponse?.redirectInfo?.url;
            console.log("=== REDIRECT URL EXTRACTION ===");
            console.log("Extracted redirectUrl:", redirectUrlFromPhonePe);
            console.log("redirectUrl type:", typeof redirectUrlFromPhonePe);
            console.log("redirectUrl length:", redirectUrlFromPhonePe?.length);
            console.log("================================");
            if (!redirectUrlFromPhonePe) {
                logger.error({
                    merchantOrderId: orderData.merchantOrderId,
                    responseData: response.data,
                }, "No redirectUrl in PhonePe response");
                return {
                    success: false,
                    message: "PhonePe did not return a payment URL",
                    error: "No redirectUrl in response",
                };
            }
            // Extract JWT token from redirectUrl query parameter
            let jwtToken = null;
            try {
                const url = new URL(redirectUrlFromPhonePe);
                // DEBUG: Log all query parameters to see what's available
                const allParams = {};
                url.searchParams.forEach((value, key) => {
                    allParams[key] = value;
                });
                jwtToken = url.searchParams.get("token");
                console.log("=== TOKEN EXTRACTION DEBUG ===");
                console.log("Full redirectUrl:", redirectUrlFromPhonePe);
                console.log("All query parameters:", allParams);
                console.log("Extracted token:", jwtToken);
                console.log("Token length:", jwtToken?.length);
                console.log("Token starts with eyJ?", jwtToken?.startsWith("eyJ"));
                console.log("First 20 chars:", jwtToken?.substring(0, 20));
                console.log("Last 20 chars:", jwtToken?.substring(jwtToken.length - 20));
                console.log("============================");
                logger.info({
                    merchantOrderId: orderData.merchantOrderId,
                    redirectUrl: redirectUrlFromPhonePe,
                    allQueryParams: allParams,
                    extractedToken: jwtToken?.substring(0, 50) + "...",
                    hasToken: !!jwtToken,
                    tokenLength: jwtToken?.length || 0,
                    tokenStartsWithEyJ: jwtToken?.startsWith("eyJ"),
                    first20Chars: jwtToken?.substring(0, 20),
                }, "JWT token extraction attempt from PhonePe redirectUrl");
            }
            catch (urlError) {
                logger.error({
                    error: urlError.message,
                    redirectUrl: redirectUrlFromPhonePe,
                }, "Failed to parse redirectUrl for JWT token");
                return {
                    success: false,
                    message: "Failed to parse PhonePe redirectUrl",
                    error: urlError.message,
                };
            }
            if (!jwtToken) {
                logger.error({
                    merchantOrderId: orderData.merchantOrderId,
                    redirectUrl: redirectUrlFromPhonePe,
                }, "No JWT token found in redirectUrl query parameter");
                return {
                    success: false,
                    message: "Failed to extract JWT token from PhonePe response",
                    error: "No 'token' query parameter found in redirectUrl",
                };
            }
            // Validate JWT token format
            if (!jwtToken.startsWith("eyJ")) {
                logger.error({
                    merchantOrderId: orderData.merchantOrderId,
                    token: jwtToken.substring(0, 20) + "...",
                }, "Extracted token is not a valid JWT (should start with 'eyJ')");
                return {
                    success: false,
                    message: "Invalid JWT token format",
                    error: "Token does not start with 'eyJ'",
                };
            }
            logger.info({
                merchantOrderId: orderData.merchantOrderId,
                tokenLength: jwtToken.length,
                tokenPreview: jwtToken.substring(0, 30) + "...",
            }, "✅ SDK order created successfully with valid JWT token");
            return {
                success: true,
                message: "SDK order created successfully",
                orderToken: jwtToken, // ✅ Return valid JWT token
            };
        }
        catch (error) {
            logger.error({
                error: error.message,
                stack: error.stack,
                orderData,
            }, "Error creating SDK order");
            return {
                success: false,
                message: "Failed to create SDK order",
                error: error.message,
            };
        }
    }
    /**
     * Refund payment using SDK
     */
    async refundPayment(merchantTransactionId, refundAmount, reason) {
        try {
            logger.info({ merchantTransactionId, refundAmount, reason }, "Initiating PhonePe refund");
            // Get original transaction
            const transaction = await this.transactionService.findByTransactionId(merchantTransactionId);
            if (!transaction) {
                throw new ValidationError("Transaction not found");
            }
            const refundId = `REFUND_${merchantTransactionId}_${Date.now()}`;
            const finalRefundAmount = refundAmount || parseFloat(transaction.amount?.toString() || "0");
            // Use SDK if available, otherwise fall back to legacy
            if (this.sdkClient) {
                return await this.refundPaymentWithSDK(merchantTransactionId, refundId, finalRefundAmount, reason, transaction);
            }
            else {
                return await this.refundPaymentLegacy(merchantTransactionId, refundId, finalRefundAmount, reason, transaction);
            }
        }
        catch (error) {
            // Handle PhonePe SDK exceptions
            if (error instanceof PhonePeException) {
                logger.error({
                    error: error.message,
                    merchantTransactionId,
                    phonePeError: {
                        code: error.code,
                        message: error.message,
                        data: error.data,
                    },
                }, "PhonePe SDK error during refund");
                return {
                    success: false,
                    message: `PhonePe SDK error: ${error.message}`,
                };
            }
            logger.error({
                error: error.message,
                merchantTransactionId,
                refundAmount,
            }, "Error initiating PhonePe refund");
            return {
                success: false,
                message: "Refund initiation failed",
            };
        }
    }
    /**
     * Refund payment using SDK (simplified for now)
     */
    async refundPaymentWithSDK(merchantTransactionId, refundId, refundAmount, reason, transaction) {
        try {
            logger.info({
                merchantTransactionId,
                refundId,
                refundAmount,
            }, "SDK refund not fully implemented yet, falling back to legacy");
            // For now, fall back to legacy refund method
            return await this.refundPaymentLegacy(merchantTransactionId, refundId, refundAmount, reason, transaction);
        }
        catch (error) {
            logger.error({
                error: error.message,
                stack: error.stack,
                merchantTransactionId,
                refundId,
            }, "Error in SDK refund");
            throw error; // Re-throw to be handled by parent method
        }
    }
    /**
     * Legacy refund payment method
     */
    async refundPaymentLegacy(merchantTransactionId, refundId, refundAmount, reason, transaction) {
        try {
            logger.info({
                merchantTransactionId,
                refundId,
                refundAmount,
            }, "Using legacy method for refund");
            const refundData = {
                merchantId: PHONEPE_CONFIG.MERCHANT_ID,
                merchantTransactionId: refundId,
                originalTransactionId: merchantTransactionId,
                amount: Math.round(refundAmount * 100),
                callbackUrl: `${PHONEPE_CONFIG.REDIRECT_STATUS}/v1/phonepe/refund-callback/${refundId}`,
            };
            const payload = JSON.stringify(refundData);
            const payloadMain = Buffer.from(payload).toString("base64");
            const checksumString = payloadMain + "/pg/v1/refund" + PHONEPE_CONFIG.SALT_KEY;
            const sha256 = crypto
                .createHash("sha256")
                .update(checksumString)
                .digest("hex");
            const checksum = sha256 + "###" + PHONEPE_CONFIG.KEY_INDEX;
            const apiUrl = `${PHONEPE_CONFIG.BASE_URL}/pg/v1/refund`;
            const headers = {
                accept: "application/json",
                "Content-Type": "application/json",
                "X-VERIFY": checksum,
            };
            const response = await axios.post(apiUrl, {
                request: payloadMain,
            }, { headers });
            // Create refund transaction record
            await this.transactionService.create({
                transactionid: refundId,
                merchanttransactionid: refundId,
                name: transaction.name || "Refund",
                amount: refundAmount,
                mobilenumber: transaction.mobilenumber,
                userid: transaction.userid,
                productid: transaction.productid,
                transactionfor: "refund",
                transactiondata: {
                    status: "REFUND_INITIATED",
                    originalTransactionId: merchantTransactionId,
                    reason,
                    phonePeResponse: response.data,
                },
            });
            logger.info({
                merchantTransactionId,
                refundId,
                amount: refundAmount,
                success: response.data.success,
            }, "PhonePe refund initiated (legacy)");
            return {
                success: response.data.success || false,
                message: response.data.message || "Refund initiated successfully",
                refundId,
            };
        }
        catch (error) {
            logger.error({
                error: error.message,
                merchantTransactionId,
                refundAmount,
            }, "Error initiating PhonePe refund (legacy)");
            throw error; // Re-throw to be handled by parent method
        }
    }
    /**
     * Check refund status using SDK (simplified for now)
     */
    async checkRefundStatus(refundId) {
        try {
            if (this.sdkClient) {
                logger.info({ refundId }, "SDK refund status check not fully implemented yet");
                // For now, return a placeholder response
                return {
                    success: false,
                    message: "SDK refund status check not fully implemented yet",
                };
            }
            else {
                logger.warn({ refundId }, "SDK not available for refund status check");
                return {
                    success: false,
                    message: "SDK not available for refund status check",
                };
            }
        }
        catch (error) {
            logger.error({
                error: error.message,
                refundId,
            }, "Error checking refund status");
            return {
                success: false,
                message: `Failed to check refund status: ${error.message}`,
            };
        }
    }
    /**
     * Get transaction history for a user
     */
    async getUserTransactionHistory(userId, page = 1, limit = 10) {
        try {
            logger.debug({ userId, page, limit }, "Getting user transaction history");
            const result = await this.transactionService.findByUserId(userId, page, limit);
            return createSuccessResponse("Transaction history retrieved successfully", result);
        }
        catch (error) {
            logger.error({ error: error.message, userId }, "Error getting user transaction history");
            throw new DatabaseError("Failed to retrieve transaction history", error.message);
        }
    }
    /**
     * Get transaction statistics
     */
    async getTransactionStats(userId) {
        try {
            logger.debug({ userId }, "Getting transaction statistics");
            const stats = await this.transactionService.getTransactionStats(userId);
            return createSuccessResponse("Transaction statistics retrieved successfully", stats);
        }
        catch (error) {
            logger.error({ error: error.message, userId }, "Error getting transaction statistics");
            throw new DatabaseError("Failed to retrieve transaction statistics", error.message);
        }
    }
    // Private helper methods
    validatePaymentRequest(request) {
        const errors = [];
        if (!request.merchantTransactionId)
            errors.push("merchantTransactionId is required");
        if (!request.amount || request.amount <= 0)
            errors.push("amount must be greater than 0");
        if (!request.name)
            errors.push("name is required");
        if (!request.mobileNumber)
            errors.push("mobileNumber is required");
        if (!request.userId)
            errors.push("userId is required");
        // Validate mobile number format (10 digits)
        if (request.mobileNumber && !/^\d{10}$/.test(request.mobileNumber)) {
            errors.push("mobileNumber must be a valid 10-digit number");
        }
        // Validate merchant transaction ID format
        if (request.merchantTransactionId &&
            request.merchantTransactionId.length > 35) {
            errors.push("merchantTransactionId must be 35 characters or less");
        }
        if (errors.length > 0) {
            throw new ValidationError("Invalid payment request", errors.join(", "), errors);
        }
    }
    async createInitialTransaction(transactionData) {
        try {
            return await this.transactionService.create(transactionData);
        }
        catch (error) {
            logger.error({
                error: error.message,
                transactionData,
            }, "Error creating initial transaction");
            throw new DatabaseError("Failed to create transaction record", error.message);
        }
    }
    async updateTransactionStatus(merchantTransactionId, status, additionalData) {
        try {
            const updateData = {
                transactiondata: {
                    status,
                    updatedAt: new Date().toISOString(),
                    ...additionalData,
                },
                modifieddate: Date.now(),
            };
            return await this.transactionService.updateByTransactionId(merchantTransactionId, updateData);
        }
        catch (error) {
            logger.error({
                error: error.message,
                merchantTransactionId,
                status,
            }, "Error updating transaction status");
            throw new DatabaseError("Failed to update transaction status", error.message);
        }
    }
    /**
     * Generate unique merchant transaction ID
     */
    static generateMerchantTransactionId(prefix = "TXN") {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `${prefix}_${timestamp}_${random}`;
    }
    /**
     * Validate PhonePe webhook signature using SDK
     */
    async validateWebhookSignature(payload, authHeader) {
        try {
            if (this.sdkClient) {
                // Use SDK validation method
                const callbackResponse = await this.sdkClient.validateCallback(PHONEPE_CONFIG.CLIENT_ID, // username
                PHONEPE_CONFIG.CLIENT_SECRET, // password
                authHeader, // Authorization header
                payload // response body string
                );
                logger.info({
                    isValid: true, // SDK validation succeeded
                    eventType: "PAYMENT", // Default event type
                    state: "VALIDATED",
                    orderId: "N/A",
                    refundId: "N/A",
                }, "PhonePe SDK webhook validation result");
                return {
                    isValid: true,
                    callbackResponse: {
                        isValid: true,
                        eventType: "PAYMENT",
                        state: "VALIDATED",
                    },
                };
            }
            else {
                // Fall back to legacy validation
                return this.validateWebhookSignatureLegacy(payload, authHeader);
            }
        }
        catch (error) {
            logger.error({
                error: error.message,
                stack: error.stack,
            }, "Error validating webhook signature");
            return {
                isValid: false,
                error: error.message,
            };
        }
    }
    /**
     * Legacy webhook signature validation
     */
    validateWebhookSignatureLegacy(payload, signature) {
        try {
            const expectedSignature = crypto
                .createHash("sha256")
                .update(payload + PHONEPE_CONFIG.SALT_KEY)
                .digest("hex") +
                "###" +
                PHONEPE_CONFIG.KEY_INDEX;
            const isValid = expectedSignature === signature;
            logger.info({
                isValid,
                signatureProvided: signature.substring(0, 20) + "...",
                signatureExpected: expectedSignature.substring(0, 20) + "...",
            }, "PhonePe legacy webhook validation result");
            return { isValid };
        }
        catch (error) {
            logger.error({ error }, "Error validating webhook signature (legacy)");
            return {
                isValid: false,
                error: error.message,
            };
        }
    }
}
//# sourceMappingURL=phonepe.service.js.map