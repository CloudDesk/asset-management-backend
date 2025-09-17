import crypto from 'crypto';
import axios from 'axios';
import { logger } from '../config/logger.js';
import { TransactionService } from './transaction.service.js';
import { createSuccessResponse, DatabaseError, ValidationError } from '../utils/errorHandler.js';
// PhonePe Configuration
const PHONEPE_CONFIG = {
    MERCHANT_ID: process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT86',
    SALT_KEY: process.env.PHONEPE_SALT_KEY || '96434309-7796-489d-8924-ab56988a6076',
    KEY_INDEX: 1,
    BASE_URL: process.env.PHONEPE_BASE_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox',
    REDIRECT_SUCCESS: process.env.REDIRECT_URL_SUCCESS || 'http://localhost:5600/payment/success',
    REDIRECT_FAILURE: process.env.REDIRECT_URL_FAILURE || 'http://localhost:5600/payment/failure',
    // REDIRECT_STATUS: process.env.REDIRECT_URL_PAYMENT_STATUS || 'http://localhost:5600'
    REDIRECT_STATUS: 'https://foal-stirring-illegally.ngrok-free.app'
};
export class PhonePeService {
    transactionService = new TransactionService();
    /**
     * Initialize payment with PhonePe
     */
    async initiatePayment(paymentRequest) {
        try {
            // Validate required fields
            this.validatePaymentRequest(paymentRequest);
            const { merchantTransactionId, amount, name, mobileNumber, userId, productIds = [], transactionFor = 'product_purchase', callbackUrl } = paymentRequest;
            // Create PhonePe payment payload
            const finalCallbackUrl = callbackUrl || `${PHONEPE_CONFIG.REDIRECT_STATUS}/v1/phonepe/callback/${merchantTransactionId}`;
            const paymentData = {
                merchantId: PHONEPE_CONFIG.MERCHANT_ID,
                merchantTransactionId,
                name,
                amount: Math.round(amount * 100), // Convert to paise
                redirectUrl: finalCallbackUrl,
                redirectMode: 'POST',
                mobileNumber,
                paymentInstrument: {
                    type: 'PAY_PAGE'
                }
            };
            // Log the callback URL being sent to PhonePe
            logger.info({
                merchantTransactionId,
                callbackUrl: finalCallbackUrl,
                redirectStatus: PHONEPE_CONFIG.REDIRECT_STATUS,
                step: 'phonepe_callback_url_set'
            }, 'PhonePe callback URL configured');
            logger.info({
                merchantTransactionId,
                amount,
                userId,
                productIds
            }, 'Initiating PhonePe payment');
            // Create base64 encoded payload
            const payload = JSON.stringify(paymentData);
            const payloadMain = Buffer.from(payload).toString('base64');
            // Generate checksum
            const checksumString = payloadMain + '/pg/v1/pay' + PHONEPE_CONFIG.SALT_KEY;
            const sha256 = crypto.createHash('sha256').update(checksumString).digest('hex');
            const checksum = sha256 + '###' + PHONEPE_CONFIG.KEY_INDEX;
            // Make API call to PhonePe
            const apiUrl = `${PHONEPE_CONFIG.BASE_URL}/pg/v1/pay`;
            const headers = {
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum
            };
            const response = await axios.post(apiUrl, {
                request: payloadMain
            }, { headers });
            // Note: Transaction creation is handled by the controller to avoid duplicates
            // The controller will store the complete transaction data including PhonePe response
            logger.info({
                merchantTransactionId,
                success: response.data.success,
                code: response.data.code,
                phonePeResponse: response.data,
                callbackUrl: finalCallbackUrl
            }, 'PhonePe payment initiated successfully LatestUpdate');
            if (response.data.success && response.data.data?.instrumentResponse?.redirectInfo?.url) {
                return {
                    success: true,
                    message: 'Payment initiated successfully',
                    redirectUrl: response.data.data.instrumentResponse.redirectInfo.url,
                    transactionId: merchantTransactionId
                };
            }
            else {
                throw new Error(response.data.message || 'Failed to initiate payment');
            }
        }
        catch (error) {
            logger.error({
                error: error.message,
                stack: error.stack,
                paymentRequest
            }, 'Error initiating PhonePe payment');
            // Update transaction with error status if it exists
            try {
                const existingTransaction = await this.transactionService.findByTransactionId(paymentRequest.merchantTransactionId);
                if (existingTransaction) {
                    await this.updateTransactionStatus(paymentRequest.merchantTransactionId, 'FAILED', { error: error.message });
                }
            }
            catch (updateError) {
                logger.error({ updateError }, 'Failed to update transaction status after payment initiation error');
            }
            return {
                success: false,
                message: 'Payment initiation failed',
                error: error.message
            };
        }
    }
    /**
     * Check payment status with PhonePe
     */
    async checkPaymentStatus(merchantTransactionId) {
        try {
            logger.info({ merchantTransactionId }, 'Checking PhonePe payment status');
            // Generate checksum for status check
            const checksumString = `/pg/v1/status/${PHONEPE_CONFIG.MERCHANT_ID}/${merchantTransactionId}` + PHONEPE_CONFIG.SALT_KEY;
            const sha256 = crypto.createHash('sha256').update(checksumString).digest('hex');
            const checksum = sha256 + '###' + PHONEPE_CONFIG.KEY_INDEX;
            const apiUrl = `${PHONEPE_CONFIG.BASE_URL}/pg/v1/status/${PHONEPE_CONFIG.MERCHANT_ID}/${merchantTransactionId}`;
            const headers = {
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
                'X-MERCHANT-ID': PHONEPE_CONFIG.MERCHANT_ID
            };
            const response = await axios.get(apiUrl, { headers });
            logger.info({
                merchantTransactionId,
                status: response.data.code,
                success: response.data.success
            }, 'PhonePe payment status checked');
            return response.data;
        }
        catch (error) {
            logger.error({
                error: error.message,
                merchantTransactionId
            }, 'Error checking PhonePe payment status');
            throw new DatabaseError('Failed to check payment status', error.message);
        }
    }
    /**
     * Handle payment callback from PhonePe
     */
    async handlePaymentCallback(merchantTransactionId, authToken) {
        try {
            logger.info({ merchantTransactionId }, 'Handling PhonePe payment callback');
            // Check if transaction exists
            const existingTransaction = await this.transactionService.findByTransactionId(merchantTransactionId);
            if (!existingTransaction) {
                logger.error({ merchantTransactionId }, 'Transaction not found for callback');
                return {
                    success: false,
                    message: 'Transaction not found',
                    redirectUrl: PHONEPE_CONFIG.REDIRECT_FAILURE
                };
            }
            // Get payment status from PhonePe
            const paymentStatus = await this.checkPaymentStatus(merchantTransactionId);
            if (paymentStatus.success && paymentStatus.code === 'PAYMENT_SUCCESS') {
                // Payment successful
                const updatedTransaction = await this.updateTransactionStatus(merchantTransactionId, 'SUCCESS', paymentStatus);
                logger.info({
                    merchantTransactionId,
                    amount: paymentStatus.data?.amount,
                    transactionId: paymentStatus.data?.transactionId
                }, 'Payment completed successfully');
                return {
                    success: true,
                    message: 'Payment completed successfully',
                    redirectUrl: PHONEPE_CONFIG.REDIRECT_SUCCESS,
                    transactionData: updatedTransaction
                };
            }
            else {
                // Payment failed
                await this.updateTransactionStatus(merchantTransactionId, 'FAILED', paymentStatus);
                logger.warn({
                    merchantTransactionId,
                    code: paymentStatus.code,
                    message: paymentStatus.message
                }, 'Payment failed');
                return {
                    success: false,
                    message: paymentStatus.message || 'Payment was not successful',
                    redirectUrl: PHONEPE_CONFIG.REDIRECT_FAILURE
                };
            }
        }
        catch (error) {
            logger.error({
                error: error.message,
                merchantTransactionId
            }, 'Error handling PhonePe payment callback');
            // Update transaction with error status
            try {
                await this.updateTransactionStatus(merchantTransactionId, 'ERROR', { error: error.message });
            }
            catch (updateError) {
                logger.error({ updateError }, 'Failed to update transaction status after callback error');
            }
            return {
                success: false,
                message: 'Payment processing failed',
                redirectUrl: PHONEPE_CONFIG.REDIRECT_FAILURE
            };
        }
    }
    /**
     * Refund payment
     */
    async refundPayment(merchantTransactionId, refundAmount, reason) {
        try {
            logger.info({ merchantTransactionId, refundAmount, reason }, 'Initiating PhonePe refund');
            // Get original transaction
            const transaction = await this.transactionService.findByTransactionId(merchantTransactionId);
            if (!transaction) {
                throw new ValidationError('Transaction not found');
            }
            const refundId = `REFUND_${merchantTransactionId}_${Date.now()}`;
            const finalRefundAmount = refundAmount || parseFloat(transaction.amount?.toString() || '0');
            const refundData = {
                merchantId: PHONEPE_CONFIG.MERCHANT_ID,
                merchantTransactionId: refundId,
                originalTransactionId: merchantTransactionId,
                amount: Math.round(finalRefundAmount * 100),
                callbackUrl: `${PHONEPE_CONFIG.REDIRECT_STATUS}/v1/phonepe/refund-callback/${refundId}`
            };
            const payload = JSON.stringify(refundData);
            const payloadMain = Buffer.from(payload).toString('base64');
            const checksumString = payloadMain + '/pg/v1/refund' + PHONEPE_CONFIG.SALT_KEY;
            const sha256 = crypto.createHash('sha256').update(checksumString).digest('hex');
            const checksum = sha256 + '###' + PHONEPE_CONFIG.KEY_INDEX;
            const apiUrl = `${PHONEPE_CONFIG.BASE_URL}/pg/v1/refund`;
            const headers = {
                'accept': 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum
            };
            const response = await axios.post(apiUrl, {
                request: payloadMain
            }, { headers });
            // Create refund transaction record
            await this.transactionService.create({
                transactionid: refundId,
                merchanttransactionid: refundId,
                name: transaction.name || 'Refund',
                amount: finalRefundAmount,
                mobilenumber: transaction.mobilenumber,
                userid: transaction.userid,
                productid: transaction.productid,
                transactionfor: 'refund',
                transactiondata: {
                    status: 'REFUND_INITIATED',
                    originalTransactionId: merchantTransactionId,
                    reason,
                    phonePeResponse: response.data
                }
            });
            logger.info({
                merchantTransactionId,
                refundId,
                amount: finalRefundAmount,
                success: response.data.success
            }, 'PhonePe refund initiated');
            return {
                success: response.data.success || false,
                message: response.data.message || 'Refund initiated successfully',
                refundId
            };
        }
        catch (error) {
            logger.error({
                error: error.message,
                merchantTransactionId,
                refundAmount
            }, 'Error initiating PhonePe refund');
            return {
                success: false,
                message: 'Refund initiation failed'
            };
        }
    }
    /**
     * Get transaction history for a user
     */
    async getUserTransactionHistory(userId, page = 1, limit = 10) {
        try {
            logger.debug({ userId, page, limit }, 'Getting user transaction history');
            const result = await this.transactionService.findByUserId(userId, page, limit);
            return createSuccessResponse('Transaction history retrieved successfully', result);
        }
        catch (error) {
            logger.error({ error: error.message, userId }, 'Error getting user transaction history');
            throw new DatabaseError('Failed to retrieve transaction history', error.message);
        }
    }
    /**
     * Get transaction statistics
     */
    async getTransactionStats(userId) {
        try {
            logger.debug({ userId }, 'Getting transaction statistics');
            const stats = await this.transactionService.getTransactionStats(userId);
            return createSuccessResponse('Transaction statistics retrieved successfully', stats);
        }
        catch (error) {
            logger.error({ error: error.message, userId }, 'Error getting transaction statistics');
            throw new DatabaseError('Failed to retrieve transaction statistics', error.message);
        }
    }
    // Private helper methods
    validatePaymentRequest(request) {
        const errors = [];
        if (!request.merchantTransactionId)
            errors.push('merchantTransactionId is required');
        if (!request.amount || request.amount <= 0)
            errors.push('amount must be greater than 0');
        if (!request.name)
            errors.push('name is required');
        if (!request.mobileNumber)
            errors.push('mobileNumber is required');
        if (!request.userId)
            errors.push('userId is required');
        // Validate mobile number format (10 digits)
        if (request.mobileNumber && !/^\d{10}$/.test(request.mobileNumber)) {
            errors.push('mobileNumber must be a valid 10-digit number');
        }
        // Validate merchant transaction ID format
        if (request.merchantTransactionId && request.merchantTransactionId.length > 35) {
            errors.push('merchantTransactionId must be 35 characters or less');
        }
        if (errors.length > 0) {
            throw new ValidationError('Invalid payment request', errors.join(', '), errors);
        }
    }
    async createInitialTransaction(transactionData) {
        try {
            return await this.transactionService.create(transactionData);
        }
        catch (error) {
            logger.error({
                error: error.message,
                transactionData
            }, 'Error creating initial transaction');
            throw new DatabaseError('Failed to create transaction record', error.message);
        }
    }
    async updateTransactionStatus(merchantTransactionId, status, additionalData) {
        try {
            const updateData = {
                transactiondata: {
                    status,
                    updatedAt: new Date().toISOString(),
                    ...additionalData
                },
                modifieddate: Date.now()
            };
            return await this.transactionService.updateByTransactionId(merchantTransactionId, updateData);
        }
        catch (error) {
            logger.error({
                error: error.message,
                merchantTransactionId,
                status
            }, 'Error updating transaction status');
            throw new DatabaseError('Failed to update transaction status', error.message);
        }
    }
    /**
     * Generate unique merchant transaction ID
     */
    static generateMerchantTransactionId(prefix = 'TXN') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `${prefix}_${timestamp}_${random}`;
    }
    /**
     * Validate PhonePe webhook signature
     */
    static validateWebhookSignature(payload, signature) {
        try {
            const expectedSignature = crypto
                .createHash('sha256')
                .update(payload + PHONEPE_CONFIG.SALT_KEY)
                .digest('hex') + '###' + PHONEPE_CONFIG.KEY_INDEX;
            return expectedSignature === signature;
        }
        catch (error) {
            logger.error({ error }, 'Error validating webhook signature');
            return false;
        }
    }
}
//# sourceMappingURL=phonepe.service.js.map