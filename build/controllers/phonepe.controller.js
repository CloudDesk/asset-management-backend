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
            // Create orderline records for each product (with improved validation)
            if (transaction.productid && Array.isArray(transaction.productid) && transaction.productid.length > 0) {
                logger.info({
                    transactionId,
                    productIds: transaction.productid,
                    productCount: transaction.productid.length
                }, 'Starting product validation for orderline creation');
                // Validate all products at once using Prisma
                const validProducts = await this.validateProductsBatch(transaction.productid);
                const validProductIds = validProducts.map(p => p.id);
                const invalidProductIds = transaction.productid.filter((id) => !validProductIds.includes(id));
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
                    // Create orderlines with proper error handling
                    const orderlineResults = await this.createOrderlinesForProducts(order.id, validProducts, transaction, orderid, currentTime, transactionId);
                    const successfulOrderlines = orderlineResults.filter(result => result.success);
                    const failedOrderlines = orderlineResults.filter(result => !result.success);
                    logger.info({
                        transactionId,
                        orderId: order.id,
                        totalOrderlines: orderlineResults.length,
                        successfulCount: successfulOrderlines.length,
                        failedCount: failedOrderlines.length,
                        successfulOrderlineIds: successfulOrderlines.map(r => r.orderline?.id).filter(Boolean),
                        failedProductIds: failedOrderlines.map(r => r.productId)
                    }, 'Orderline creation completed');
                    // If all orderlines failed, throw an error
                    if (successfulOrderlines.length === 0 && failedOrderlines.length > 0) {
                        throw new Error(`Failed to create any orderlines. Errors: ${failedOrderlines.map(r => r.error).join(', ')}`);
                    }
                    // Log warnings for partial failures
                    if (failedOrderlines.length > 0) {
                        logger.warn({
                            transactionId,
                            failedOrderlines: failedOrderlines.map(r => ({ productId: r.productId, error: r.error }))
                        }, 'Some orderlines failed to create');
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
     * Validate products in batch using Prisma
     */
    async validateProductsBatch(productIds) {
        try {
            logger.debug({ productIds }, 'Validating products in batch');
            const products = await prisma.product.findMany({
                where: {
                    id: { in: productIds.map((id) => BigInt(id)) }
                },
                select: {
                    id: true,
                    name: true
                }
            });
            const formattedProducts = products.map(p => ({
                id: Number(p.id),
                name: p.name || undefined
            })).filter(p => p.id && !isNaN(p.id));
            logger.debug({
                requestedIds: productIds,
                foundProducts: formattedProducts.map(p => ({ id: p.id, name: p.name }))
            }, 'Batch product validation completed');
            return formattedProducts;
        }
        catch (error) {
            logger.error({
                productIds,
                error: error.message,
                stack: error.stack
            }, 'Error in batch product validation');
            return [];
        }
    }
    /**
     * Validate and clean orderline data before creation
     */
    validateOrderlineData(orderlineData) {
        const errors = [];
        const cleanedData = { ...orderlineData };
        // Validate required fields
        if (!cleanedData.orderid || typeof cleanedData.orderid !== 'number') {
            errors.push('orderid must be a valid number');
        }
        if (!cleanedData.productid || typeof cleanedData.productid !== 'number') {
            errors.push('productid must be a valid number');
        }
        if (!cleanedData.userid || typeof cleanedData.userid !== 'number') {
            errors.push('userid must be a valid number');
        }
        // Validate and clean numeric fields
        const numericFields = ['productamount', 'discountamount', 'orderamount', 'quantity'];
        numericFields.forEach(field => {
            if (cleanedData[field] !== undefined && cleanedData[field] !== null) {
                const numValue = Number(cleanedData[field]);
                if (isNaN(numValue)) {
                    errors.push(`${field} must be a valid number`);
                }
                else {
                    cleanedData[field] = numValue;
                }
            }
        });
        // Validate and clean timestamp fields
        const timestampFields = ['createddate', 'modifieddate', 'ordereddate'];
        timestampFields.forEach(field => {
            if (cleanedData[field] !== undefined && cleanedData[field] !== null) {
                const numValue = Number(cleanedData[field]);
                if (isNaN(numValue) || numValue < 0) {
                    errors.push(`${field} must be a valid timestamp`);
                }
                else {
                    cleanedData[field] = numValue;
                }
            }
        });
        // Validate string fields length
        const stringFields = [
            { field: 'merchanttransactionid', maxLength: 250 },
            { field: 'productname', maxLength: 500 },
            { field: 'productcategory', maxLength: 500 },
            { field: 'productcolour', maxLength: 500 },
            { field: 'orderstatus', maxLength: 500 },
            { field: 'uniqueordderid', maxLength: 500 },
            { field: 'orderlinenumber', maxLength: 500 },
            { field: 'deliveryfrom', maxLength: 500 },
            { field: 'location', maxLength: 500 }
        ];
        stringFields.forEach(({ field, maxLength }) => {
            if (cleanedData[field] && typeof cleanedData[field] === 'string') {
                if (cleanedData[field].length > maxLength) {
                    errors.push(`${field} must be ${maxLength} characters or less`);
                }
            }
        });
        // Ensure null values for optional fields that might be undefined
        const optionalFields = ['addressid', 'productcategory', 'productcolour', 'deliveryfrom', 'location'];
        optionalFields.forEach(field => {
            if (cleanedData[field] === undefined) {
                cleanedData[field] = null;
            }
        });
        return {
            isValid: errors.length === 0,
            errors,
            cleanedData: errors.length === 0 ? cleanedData : undefined
        };
    }
    /**
     * Create orderlines for validated products
     */
    async createOrderlinesForProducts(orderId, validProducts, transaction, orderid, currentTime, transactionId) {
        const results = [];
        // Calculate amount per product
        const totalAmount = parseFloat(transaction.amount?.toString() || '0');
        const amountPerProduct = validProducts.length > 0 ? totalAmount / validProducts.length : 0;
        for (let index = 0; index < validProducts.length; index++) {
            const product = validProducts[index];
            if (!product) {
                logger.warn({ transactionId, index }, 'Skipping undefined product');
                continue;
            }
            try {
                const orderlineData = {
                    orderid: orderId, // Use the numeric order ID, not the string orderid
                    productid: product.id,
                    userid: transaction.userid,
                    productamount: Number(amountPerProduct),
                    discountamount: 0,
                    orderamount: Number(amountPerProduct),
                    quantity: 1,
                    merchanttransactionid: transaction.merchanttransactionid,
                    orderstatus: 'payment_completed',
                    orderlinenumber: `${orderid}_LINE_${index + 1}`,
                    productname: product.name || null,
                    ordereddate: currentTime,
                    createddate: currentTime,
                    modifieddate: currentTime
                };
                // Validate orderline data before creation
                const validation = this.validateOrderlineData(orderlineData);
                if (!validation.isValid) {
                    throw new Error(`Orderline data validation failed: ${validation.errors.join(', ')}`);
                }
                logger.debug({
                    transactionId,
                    productId: product.id,
                    orderlineData: {
                        ...validation.cleanedData,
                        // Don't log the full productname to keep logs clean
                        productname: product.name ? '***' : null
                    }
                }, 'Creating orderline with validated data');
                const orderline = await this.orderlineService.create(validation.cleanedData);
                logger.info({
                    transactionId,
                    productId: product.id,
                    orderlineId: orderline.id,
                    orderlinenumber: orderline.orderlinenumber
                }, 'Orderline created successfully');
                results.push({
                    success: true,
                    productId: product.id,
                    orderline
                });
            }
            catch (error) {
                logger.error({
                    transactionId,
                    productId: product.id,
                    error: error.message,
                    stack: error.stack,
                    errorType: error.constructor.name
                }, 'Failed to create orderline for product');
                results.push({
                    success: false,
                    productId: product.id,
                    error: error.message
                });
            }
        }
        return results;
    }
    /**
     * Check if product exists in product table
     */
    async checkProductExists(productId) {
        try {
            logger.debug({ productId }, 'Checking if product exists in database');
            // Use Prisma's findUnique instead of raw SQL for better reliability
            const product = await prisma.product.findUnique({
                where: { id: BigInt(productId) },
                select: { id: true }
            });
            const exists = !!product;
            logger.debug({ productId, exists }, 'Product existence check completed');
            return exists;
        }
        catch (error) {
            logger.error({
                productId,
                error: error.message,
                stack: error.stack
            }, 'Error checking product existence');
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