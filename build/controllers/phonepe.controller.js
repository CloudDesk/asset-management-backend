import { PhonePeService } from '../services/phonepe.service.js';
import { TransactionService } from '../services/transaction.service.js';
import { OrdersService } from '../services/orders.service.js';
import { OrderlineService } from '../services/orderline.service.js';
import { prisma } from '../models/prisma.js';
import { createSuccessResponse, createErrorResponse, asyncHandler, ValidationError, DatabaseError } from '../utils/errorHandler.js';
import { logger } from '../config/logger.js';
export class PhonePeController {
    phonePeService = new PhonePeService();
    transactionService = new TransactionService();
    ordersService = new OrdersService();
    orderlineService = new OrderlineService();
    /**
     * Initiate payment with PhonePe
     */
    initiatePayment = asyncHandler(async (request, reply) => {
        try {
            const requestBody = request.body;
            logger.info({
                orderCount: requestBody.order.length,
                transactionAmount: requestBody.transaction.amount,
                userId: requestBody.transaction.userId,
                productIds: requestBody.transaction.productid
            }, 'Payment initiation request received with new payload structure');
            // Create PhonePe payment request from the new payload structure
            const paymentRequest = {
                merchantTransactionId: PhonePeService.generateMerchantTransactionId(),
                amount: requestBody.transaction.amount,
                name: requestBody.transaction.name,
                mobileNumber: requestBody.transaction.mobilenumber,
                userId: requestBody.transaction.userId,
                productIds: requestBody.transaction.productid,
                transactionFor: requestBody.transaction.transactionfor
            };
            logger.info({
                merchantTransactionId: paymentRequest.merchantTransactionId,
                amount: paymentRequest.amount,
                userId: paymentRequest.userId,
                productIds: paymentRequest.productIds
            }, 'Converted payload to PhonePe payment request');
            const result = await this.phonePeService.initiatePayment(paymentRequest);
            if (result.success) {
                // Store the complete payload in transaction data for later use in order creation
                const transactionData = {
                    originalPayload: requestBody,
                    paymentRequest: paymentRequest,
                    initiatedAt: new Date().toISOString(),
                    phonePeResponses: {
                        initiation: {
                            timestamp: new Date().toISOString(),
                            response: result,
                            status: 'INITIATED'
                        }
                    }
                };
                // Store transaction with complete data
                await this.storeTransactionData(paymentRequest, transactionData);
                const response = createSuccessResponse('Payment initiated successfully', {
                    merchantTransactionId: result.transactionId,
                    redirectUrl: result.redirectUrl,
                    amount: paymentRequest.amount,
                    status: 'INITIATED'
                });
                return reply.code(200).send(response);
            }
            else {
                const errorResponse = createErrorResponse(result.message || 'Payment initiation failed', result.error, 400);
                return reply.code(400).send(errorResponse);
            }
        }
        catch (error) {
            logger.error({
                error: error.message,
                stack: error.stack,
                body: request.body
            }, 'Error in payment initiation');
            if (error instanceof ValidationError) {
                const response = createErrorResponse(error.message, error.details, 400);
                return reply.code(400).send(response);
            }
            const response = createErrorResponse('Payment initiation failed', 'An unexpected error occurred while initiating payment', 500);
            return reply.code(500).send(response);
        }
    });
    /**
     * Handle payment callback from PhonePe
     */
    handlePaymentCallback = asyncHandler(async (request, reply) => {
        try {
            const { merchantTransactionId } = request.params;
            const { token } = request.query;
            logger.info({
                merchantTransactionId,
                hasToken: !!token,
                method: request.method,
                headers: request.headers
            }, 'Payment callback received');
            const result = await this.phonePeService.handlePaymentCallback(merchantTransactionId, token);
            // Redirect to appropriate URL based on payment status
            if (result.success) {
                logger.info({
                    merchantTransactionId,
                    redirectUrl: result.redirectUrl
                }, 'Payment successful, redirecting to success page');
            }
            else {
                logger.warn({
                    merchantTransactionId,
                    message: result.message,
                    redirectUrl: result.redirectUrl
                }, 'Payment failed, redirecting to failure page');
            }
            // Perform redirect
            return reply.redirect(result.redirectUrl);
        }
        catch (error) {
            logger.error({
                error: error.message,
                merchantTransactionId: request.params?.merchantTransactionId
            }, 'Error in payment callback');
            // Redirect to failure page on error
            const failureUrl = process.env.REDIRECT_URL_FAILURE || 'http://localhost:5600/payment/failure';
            return reply.redirect(failureUrl);
        }
    });
    /**
     * Check payment status
     */
    checkPaymentStatus = asyncHandler(async (request, reply) => {
        try {
            const { merchantTransactionId } = request.params;
            logger.info({ merchantTransactionId }, 'Payment status check requested');
            const paymentStatus = await this.phonePeService.checkPaymentStatus(merchantTransactionId);
            const response = createSuccessResponse('Payment status retrieved successfully', {
                merchantTransactionId,
                status: paymentStatus.code,
                success: paymentStatus.success,
                message: paymentStatus.message,
                paymentData: paymentStatus.data
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({
                error: error.message,
                merchantTransactionId: request.params?.merchantTransactionId
            }, 'Error checking payment status');
            if (error instanceof DatabaseError) {
                const response = createErrorResponse(error.message, error.details, error.statusCode);
                return reply.code(error.statusCode).send(response);
            }
            const response = createErrorResponse('Failed to check payment status', 'An error occurred while checking payment status', 500);
            return reply.code(500).send(response);
        }
    });
    /**
     * Process refund
     */
    processRefund = asyncHandler(async (request, reply) => {
        try {
            const { merchantTransactionId } = request.params;
            const { refundAmount, reason } = request.body;
            logger.info({
                merchantTransactionId,
                refundAmount,
                reason
            }, 'Refund request received');
            const result = await this.phonePeService.refundPayment(merchantTransactionId, refundAmount, reason);
            if (result.success) {
                const response = createSuccessResponse('Refund initiated successfully', {
                    merchantTransactionId,
                    refundId: result.refundId,
                    refundAmount,
                    reason,
                    status: 'REFUND_INITIATED'
                });
                return reply.code(200).send(response);
            }
            else {
                const errorResponse = createErrorResponse(result.message || 'Refund initiation failed', undefined, 400);
                return reply.code(400).send(errorResponse);
            }
        }
        catch (error) {
            logger.error({
                error: error.message,
                merchantTransactionId: request.params?.merchantTransactionId
            }, 'Error processing refund');
            if (error instanceof ValidationError) {
                const response = createErrorResponse(error.message, error.details, 400);
                return reply.code(400).send(response);
            }
            const response = createErrorResponse('Refund processing failed', 'An unexpected error occurred while processing refund', 500);
            return reply.code(500).send(response);
        }
    });
    /**
     * Get user transaction history
     */
    getUserTransactionHistory = asyncHandler(async (request, reply) => {
        try {
            const userId = parseInt(request.params.userId);
            const page = parseInt(request.query.page || '1');
            const limit = parseInt(request.query.limit || '10');
            if (isNaN(userId)) {
                const response = createErrorResponse('Invalid user ID', 'User ID must be a valid number', 400);
                return reply.code(400).send(response);
            }
            logger.debug({ userId, page, limit }, 'User transaction history requested');
            const result = await this.phonePeService.getUserTransactionHistory(userId, page, limit);
            return reply.code(200).send({
                ...result,
                meta: {
                    userId,
                    page,
                    limit
                }
            });
        }
        catch (error) {
            logger.error({
                error: error.message,
                userId: request.params?.userId
            }, 'Error getting user transaction history');
            if (error instanceof DatabaseError) {
                const response = createErrorResponse(error.message, error.details, error.statusCode);
                return reply.code(error.statusCode).send(response);
            }
            const response = createErrorResponse('Failed to retrieve transaction history', 'An error occurred while retrieving transaction history', 500);
            return reply.code(500).send(response);
        }
    });
    /**
     * Get transaction statistics
     */
    getTransactionStats = asyncHandler(async (request, reply) => {
        try {
            const userIdParam = request.query.userId;
            const userId = userIdParam ? parseInt(userIdParam) : undefined;
            if (userIdParam && isNaN(userId)) {
                const response = createErrorResponse('Invalid user ID', 'User ID must be a valid number', 400);
                return reply.code(400).send(response);
            }
            logger.debug({ userId }, 'Transaction statistics requested');
            const result = await this.phonePeService.getTransactionStats(userId);
            return reply.code(200).send({
                ...result,
                meta: {
                    userId,
                    generatedAt: new Date().toISOString()
                }
            });
        }
        catch (error) {
            logger.error({
                error: error.message,
                userId: request.query?.userId
            }, 'Error getting transaction statistics');
            if (error instanceof DatabaseError) {
                const response = createErrorResponse(error.message, error.details, error.statusCode);
                return reply.code(error.statusCode).send(response);
            }
            const response = createErrorResponse('Failed to retrieve transaction statistics', 'An error occurred while retrieving transaction statistics', 500);
            return reply.code(500).send(response);
        }
    });
    /**
     * Handle PhonePe webhook
     */
    handleWebhook = asyncHandler(async (request, reply) => {
        try {
            const signature = request.headers['x-verify'];
            const payload = JSON.stringify(request.body);
            logger.info({
                hasSignature: !!signature,
                bodyLength: payload.length
            }, 'PhonePe webhook received');
            // Validate webhook signature
            if (!signature || !PhonePeService.validateWebhookSignature(payload, signature)) {
                logger.warn({ signature }, 'Invalid webhook signature');
                const response = createErrorResponse('Invalid signature', 'Webhook signature validation failed', 401);
                return reply.code(401).send(response);
            }
            // Process webhook data
            const webhookData = request.body;
            logger.info({
                merchantTransactionId: webhookData.merchantTransactionId,
                status: webhookData.code
            }, 'Processing webhook data');
            // Here you can add additional webhook processing logic as needed
            // For example, updating order status, sending notifications, etc.
            const response = createSuccessResponse('Webhook processed successfully', {
                received: true,
                timestamp: new Date().toISOString()
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({
                error: error.message,
                body: request.body
            }, 'Error processing webhook');
            const response = createErrorResponse('Webhook processing failed', 'An error occurred while processing webhook', 500);
            return reply.code(500).send(response);
        }
    });
    /**
     * Generate merchant transaction ID
     */
    generateTransactionId = asyncHandler(async (request, reply) => {
        try {
            const prefix = request.query.prefix || 'TXN';
            const transactionId = PhonePeService.generateMerchantTransactionId(prefix);
            logger.debug({ prefix, transactionId }, 'Generated merchant transaction ID');
            const response = createSuccessResponse('Transaction ID generated successfully', {
                merchantTransactionId: transactionId,
                prefix,
                timestamp: Date.now()
            });
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error: error.message }, 'Error generating transaction ID');
            const response = createErrorResponse('Transaction ID generation failed', 'An error occurred while generating transaction ID', 500);
            return reply.code(500).send(response);
        }
    });
    /**
     * Health check for PhonePe service
     */
    healthCheck = asyncHandler(async (request, reply) => {
        try {
            const healthData = {
                service: 'PhonePe Payment Gateway',
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                environment: process.env.NODE_ENV || 'development',
                configuration: {
                    merchantId: process.env.PHONEPE_MERCHANT_ID ? 'configured' : 'not configured',
                    saltKey: process.env.PHONEPE_SALT_KEY ? 'configured' : 'not configured',
                    baseUrl: process.env.PHONEPE_BASE_URL || 'default (sandbox)',
                    redirectUrls: {
                        success: process.env.REDIRECT_URL_SUCCESS || 'default',
                        failure: process.env.REDIRECT_URL_FAILURE || 'default',
                        status: process.env.REDIRECT_URL_PAYMENT_STATUS || 'default'
                    }
                }
            };
            const response = createSuccessResponse('PhonePe service is healthy', healthData);
            return reply.code(200).send(response);
        }
        catch (error) {
            logger.error({ error: error.message }, 'Error in PhonePe health check');
            const response = createErrorResponse('PhonePe service health check failed', 'An error occurred during health check', 500);
            return reply.code(500).send(response);
        }
    });
    /**
     * Update transaction status in database
     */
    async updateTransactionStatus(transactionId, status, paymentData) {
        try {
            logger.info({ transactionId, status }, 'Updating transaction status');
            // Find transaction by merchanttransactionid
            const transactions = await this.transactionService.findMany({ merchanttransactionid: transactionId }, 1, 1);
            if (!transactions.data || transactions.data.length === 0) {
                throw new Error(`Transaction not found with merchanttransactionid: ${transactionId}`);
            }
            const transaction = transactions.data[0];
            // Get existing transaction data or create new structure
            const existingTransactionData = transaction.transactiondata || {};
            // Ensure phonePeResponses object exists
            if (!existingTransactionData.phonePeResponses) {
                existingTransactionData.phonePeResponses = {};
            }
            // Add the new status response
            const statusKey = status.toLowerCase();
            existingTransactionData.phonePeResponses[statusKey] = {
                timestamp: new Date().toISOString(),
                response: paymentData,
                status: status
            };
            // Update the main status fields for backward compatibility
            existingTransactionData.status = status;
            existingTransactionData.paymentCompleteAt = new Date().toISOString();
            existingTransactionData.updatedAt = new Date().toISOString();
            // If there's an error, store it in the phonePeResponse field for backward compatibility
            if (status === 'ERROR' || status === 'FAILED') {
                existingTransactionData.phonePeResponse = {
                    error: paymentData.error || paymentData.message || 'Payment failed'
                };
            }
            else {
                existingTransactionData.phonePeResponse = paymentData;
            }
            // Update transaction data with enhanced structure
            const updateData = {
                transactiondata: existingTransactionData,
                modifieddate: Date.now()
            };
            // Use TransactionService to update transaction by database ID
            const result = await this.transactionService.update(transaction.id.toString(), updateData);
            logger.info({
                transactionId,
                status,
                statusKey,
                hasExistingData: !!transaction.transactiondata,
                responseCount: Object.keys(existingTransactionData.phonePeResponses).length
            }, 'Transaction status updated successfully with enhanced data structure');
            return result;
        }
        catch (error) {
            logger.error({
                error: error.message,
                transactionId,
                status
            }, 'Error updating transaction status');
            throw error;
        }
    }
    /**
     * Create order and orderline records after successful payment
     */
    async createOrderAfterPayment(transactionId) {
        try {
            logger.info({ transactionId }, 'Creating order after successful payment');
            // Find transaction by merchanttransactionid
            const transactions = await this.transactionService.findMany({ merchanttransactionid: transactionId }, 1, 1);
            if (!transactions.data || transactions.data.length === 0) {
                throw new Error(`Transaction not found with merchanttransactionid: ${transactionId}`);
            }
            const transaction = transactions.data[0];
            logger.info({
                transactionId,
                foundTransaction: {
                    id: transaction.id,
                    userid: transaction.userid,
                    productid: transaction.productid,
                    amount: transaction.amount
                }
            }, 'Transaction found for order creation');
            const currentTime = Date.now();
            const orderid = `ORDER_${transactionId}_${currentTime}`;
            // Create order record
            const orderData = {
                userid: transaction.userid,
                orderamount: parseFloat(transaction.amount?.toString() || '0'),
                orderid: orderid,
                orderstatus: 'payment_completed',
                quantity: transaction.productid?.length || 1,
                transactionid: transaction.transactionid, // Use the database transactionid field
                productamount: parseFloat(transaction.amount?.toString() || '0'),
                discountamount: 0,
                ispaymentsucceed: true,
                merchanttransactionid: transaction.merchanttransactionid,
                productid: transaction.productid || [],
                createddate: currentTime,
                modifieddate: currentTime
            };
            // Create order using OrdersService
            const order = await this.ordersService.create(orderData);
            logger.info({ transactionId, orderId: order.id }, 'Order created successfully');
            // Create orderline records for each product (with validation)
            if (transaction.productid && transaction.productid.length > 0) {
                logger.info({
                    transactionId,
                    productIds: transaction.productid,
                    productCount: transaction.productid.length
                }, 'Starting product validation for orderline creation');
                // Validate product IDs first to avoid foreign key constraint violations
                const validProductIds = [];
                const invalidProductIds = [];
                for (const productId of transaction.productid) {
                    try {
                        logger.debug({ transactionId, productId }, 'Checking if product exists');
                        // Check if product exists in product table
                        const productExists = await this.checkProductExists(productId);
                        if (productExists) {
                            validProductIds.push(productId);
                            logger.info({ transactionId, productId }, 'Product validated successfully');
                        }
                        else {
                            invalidProductIds.push(productId);
                            logger.warn({
                                transactionId,
                                productId
                            }, 'Product ID does not exist in database, skipping orderline creation');
                        }
                    }
                    catch (error) {
                        invalidProductIds.push(productId);
                        logger.error({
                            transactionId,
                            productId,
                            error: error.message,
                            stack: error.stack
                        }, 'Error validating product ID, skipping orderline creation');
                    }
                }
                logger.info({
                    transactionId,
                    totalProducts: transaction.productid.length,
                    validProductIds,
                    invalidProductIds,
                    validCount: validProductIds.length,
                    invalidCount: invalidProductIds.length
                }, 'Product validation completed');
                if (invalidProductIds.length > 0) {
                    logger.warn({
                        transactionId,
                        invalidProductIds,
                        validProductIds
                    }, 'Some product IDs are invalid and will be skipped');
                }
                if (validProductIds.length > 0) {
                    logger.info({
                        transactionId,
                        validProductIds,
                        orderlineCount: validProductIds.length
                    }, 'Creating orderlines for valid products');
                    const orderlinePromises = validProductIds.map(async (productId, index) => {
                        const orderlineData = {
                            orderid: order.id,
                            productid: productId,
                            userid: transaction.userid,
                            productamount: parseFloat(transaction.amount?.toString() || '0') / validProductIds.length,
                            discountamount: 0,
                            orderamount: parseFloat(transaction.amount?.toString() || '0') / validProductIds.length,
                            quantity: 1,
                            merchanttransactionid: transaction.merchanttransactionid,
                            orderstatus: 'payment_completed',
                            orderlinenumber: `${orderid}_LINE_${index + 1}`,
                            ordereddate: currentTime,
                            createddate: currentTime,
                            modifieddate: currentTime
                        };
                        logger.debug({
                            transactionId,
                            productId,
                            orderlineData
                        }, 'Creating orderline');
                        try {
                            const orderline = await this.orderlineService.create(orderlineData);
                            logger.info({
                                transactionId,
                                productId,
                                orderlineId: orderline.id
                            }, 'Orderline created successfully');
                            return orderline;
                        }
                        catch (error) {
                            logger.error({
                                transactionId,
                                productId,
                                orderlineData,
                                error: error.message,
                                stack: error.stack
                            }, 'Failed to create orderline');
                            throw error;
                        }
                    });
                    try {
                        const orderlines = await Promise.all(orderlinePromises);
                        logger.info({
                            transactionId,
                            orderId: order.id,
                            orderlineCount: orderlines.length,
                            validProductIds,
                            skippedProductIds: invalidProductIds,
                            createdOrderlineIds: orderlines.map(ol => ol.id)
                        }, 'All orderlines created successfully');
                    }
                    catch (error) {
                        logger.error({
                            transactionId,
                            error: error.message,
                            stack: error.stack
                        }, 'Error creating one or more orderlines');
                        throw error;
                    }
                }
                else {
                    logger.warn({
                        transactionId,
                        orderId: order.id,
                        invalidProductIds
                    }, 'No valid product IDs found, no orderlines created');
                }
            }
            else {
                logger.warn({
                    transactionId,
                    productid: transaction.productid
                }, 'No product IDs found in transaction, skipping orderline creation');
            }
            logger.info({ transactionId, orderId: order.id }, 'Order and orderlines created successfully after payment');
            return order;
        }
        catch (error) {
            logger.error({
                error: error.message,
                stack: error.stack,
                transactionId
            }, 'Error creating order after payment');
            throw error;
        }
    }
    /**
     * Check if product exists in product table
     */
    async checkProductExists(productId) {
        try {
            // Use direct prisma query to check if product exists
            const result = await prisma.$queryRaw `
        SELECT id FROM product WHERE id = ${productId} LIMIT 1
      `;
            return Array.isArray(result) && result.length > 0;
        }
        catch (error) {
            logger.error({ productId, error: error.message }, 'Error checking product existence');
            return false;
        }
    }
    /**
     * Store transaction data in database
     */
    async storeTransactionData(paymentRequest, transactionData) {
        try {
            logger.info({
                merchantTransactionId: paymentRequest.merchantTransactionId,
                amount: paymentRequest.amount,
                userId: paymentRequest.userId
            }, 'Storing transaction data');
            const transactionRecord = {
                transactionid: paymentRequest.merchantTransactionId,
                merchanttransactionid: paymentRequest.merchantTransactionId,
                userid: paymentRequest.userId,
                amount: paymentRequest.amount,
                mobilenumber: parseInt(paymentRequest.mobileNumber),
                name: paymentRequest.name,
                productid: paymentRequest.productIds || [],
                transactionfor: paymentRequest.transactionFor,
                transactiondata: transactionData,
                createddate: Date.now(),
                modifieddate: Date.now()
            };
            const result = await this.transactionService.create(transactionRecord);
            logger.info({
                merchantTransactionId: paymentRequest.merchantTransactionId,
                transactionId: result.id
            }, 'Transaction data stored successfully');
            return result;
        }
        catch (error) {
            logger.error({
                error: error.message,
                merchantTransactionId: paymentRequest.merchantTransactionId
            }, 'Error storing transaction data');
            throw error;
        }
    }
}
//# sourceMappingURL=phonepe.controller.js.map