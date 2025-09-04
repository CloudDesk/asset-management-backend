import { FastifyRequest, FastifyReply } from "fastify";
import {
  PhonePeService,
  PhonePePaymentRequest,
} from "../services/phonepe.service.js";
import { TransactionService } from "../services/transaction.service.js";
import { OrdersService } from "../services/orders.service.js";
import { OrderlineService } from "../services/orderline.service.js";
import { prisma } from "../models/prisma.js";
import {
  createSuccessResponse,
  createErrorResponse,
  asyncHandler,
  ValidationError,
  DatabaseError,
} from "../utils/errorHandler.js";
import { logger } from "../config/logger.js";

export class PhonePeController {
  public phonePeService = new PhonePeService();
  public transactionService = new TransactionService();
  private ordersService = new OrdersService();
  private orderlineService = new OrderlineService();

  /**
   * Initiate payment with PhonePe
   */
  initiatePayment = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const requestBody = request.body as {
          mode: "phonepe" | "cod";
          order: Array<{
            addressid: number;
            cartId: number;
            discountamount: number;
            orderamount: number;
            productamount: number;
            productcategory: string;
            productid: number;
            productname: string;
            quantity: number;
            userid: number;
          }>;
          transaction: {
            amount: number;
            mobilenumber: string;
            name: string;
            productid: number[];
            transactionfor: string;
            userId: number;
          };
        };

        logger.info(
          {
            mode: requestBody.mode,
            orderCount: requestBody.order.length,
            transactionAmount: requestBody.transaction.amount,
            userId: requestBody.transaction.userId,
            productIds: requestBody.transaction.productid,
          },
          "Payment initiation request received with new payload structure"
        );
        console.log(request.body, "request body");
        // Generate unique transaction ID for both modes
        const merchantTransactionId =
          PhonePeService.generateMerchantTransactionId();

        let result: any;
        let paymentRequest: any;

        if (requestBody.mode === "phonepe") {
          // Create PhonePe payment request
          paymentRequest = {
            merchantTransactionId,
            amount: requestBody.transaction.amount,
            name: requestBody.transaction.name,
            mobileNumber: requestBody.transaction.mobilenumber,
            userId: requestBody.transaction.userId,
            productIds: requestBody.transaction.productid,
            transactionFor: requestBody.transaction.transactionfor,
          };

          logger.info(
            {
              merchantTransactionId: paymentRequest.merchantTransactionId,
              amount: paymentRequest.amount,
              userId: paymentRequest.userId,
              productIds: paymentRequest.productIds,
            },
            "Converted payload to PhonePe payment request"
          );

          // Call PhonePe service for online payment
          result = await this.phonePeService.initiatePayment(paymentRequest);
          console.log(result, "for  phone pe");
        } else if (requestBody.mode === "cod") {
          // For COD, create a mock successful result
          paymentRequest = {
            merchantTransactionId,
            amount: requestBody.transaction.amount,
            name: requestBody.transaction.name,
            mobileNumber: requestBody.transaction.mobilenumber,
            userId: requestBody.transaction.userId,
            productIds: requestBody.transaction.productid,
            transactionFor: requestBody.transaction.transactionfor,
          };

          logger.info(
            {
              merchantTransactionId: paymentRequest.merchantTransactionId,
              amount: paymentRequest.amount,
              userId: paymentRequest.userId,
              productIds: paymentRequest.productIds,
            },
            "COD payment request created"
          );

          // Mock successful result for COD
          result = {
            success: true,
            message: "COD order created successfully",
            redirectUrl: null, // No redirect for COD
            transactionId: merchantTransactionId,
          };
        } else {
          throw new Error(`Invalid payment mode: ${requestBody.mode}`);
        }

        if (result.success) {
          // Store the complete payload in transaction data for later use in order creation
          const transactionData = {
            status:
              requestBody.mode === "phonepe"
                ? "INITIATED"
                : "COD_ORDER_CREATED",
            mode: requestBody.mode,
            originalPayload: requestBody,
            paymentRequest: paymentRequest,
            initiatedAt: new Date().toISOString(),
            phonePeResponses:
              requestBody.mode === "phonepe"
                ? {
                    initiation: {
                      timestamp: new Date().toISOString(),
                      response: result,
                      status: "INITIATED",
                      redirectUrl: result.redirectUrl,
                    },
                  }
                : null,
            codData:
              requestBody.mode === "cod"
                ? {
                    timestamp: new Date().toISOString(),
                    status: "COD_ORDER_CREATED",
                    message: "Cash on Delivery order created successfully",
                  }
                : null,
          };

          console.log(transactionData, "transactionData");
          // Store transaction with complete data (single transaction record)
          await this.storeTransactionData(paymentRequest, transactionData);

          // For COD, create order and orderlines immediately
          let orderData: any = null;
          if (requestBody.mode === "cod") {
            try {
              logger.info(
                {
                  merchantTransactionId: paymentRequest.merchantTransactionId,
                  mode: "cod",
                },
                "Creating COD order and orderlines immediately"
              );

              // Create order and orderlines for COD
              // Force mode to "cod" since this is COD order
              orderData = await this.createOrderAfterPayment(
                paymentRequest.merchantTransactionId,
                "cod"
              );

              logger.info(
                {
                  merchantTransactionId: paymentRequest.merchantTransactionId,
                  orderId: orderData?.id,
                  mode: "cod",
                },
                "COD order and orderlines created successfully Initiate Payemnt"
              );

              // Update product quantities after successful order creation
              if (
                orderData &&
                requestBody.order &&
                Array.isArray(requestBody.order)
              ) {
                try {
                  logger.info(
                    {
                      merchantTransactionId:
                        paymentRequest.merchantTransactionId,
                      orderId: orderData.id,
                      mode: "cod",
                      orderItemsCount: requestBody.order.length,
                      orderItems: requestBody.order.map((item) => ({
                        productid: item.productid,
                        quantity: item.quantity,
                        productname: item.productname,
                      })),
                    },
                    "Starting product quantity updates for COD order"
                  );

                  const quantityUpdateResult =
                    await this.updateProductQuantitiesAfterOrder(
                      orderData,
                      requestBody.order,
                      "cod"
                    );

                  logger.info(
                    {
                      merchantTransactionId:
                        paymentRequest.merchantTransactionId,
                      orderId: orderData.id,
                      mode: "cod",
                      quantityUpdateResult,
                    },
                    "Product quantity updates completed for COD order"
                  );

                  // If quantity update failed, log it as a warning but don't fail the order
                  if (!quantityUpdateResult.success) {
                    logger.warn(
                      {
                        merchantTransactionId:
                          paymentRequest.merchantTransactionId,
                        orderId: orderData.id,
                        mode: "cod",
                        quantityUpdateResult,
                      },
                      "Product quantity update failed for COD order - order was still created successfully"
                    );
                  }
                } catch (quantityUpdateError: any) {
                  logger.error(
                    {
                      error: quantityUpdateError.message,
                      stack: quantityUpdateError.stack,
                      merchantTransactionId:
                        paymentRequest.merchantTransactionId,
                      orderId: orderData.id,
                      mode: "cod",
                      orderItems: requestBody.order,
                    },
                    "Error updating product quantities for COD order"
                  );

                  // Don't fail the order creation if quantity update fails
                  // The order is already created successfully
                }
              } else {
                logger.warn(
                  {
                    merchantTransactionId: paymentRequest.merchantTransactionId,
                    orderId: orderData?.id,
                    mode: "cod",
                    hasOrderData: !!orderData,
                    hasRequestBodyOrder: !!requestBody.order,
                    isRequestBodyOrderArray: Array.isArray(requestBody.order),
                    requestBodyOrderLength: requestBody.order?.length,
                  },
                  "Cannot update product quantities - missing or invalid order data"
                );
              }
            } catch (orderError: any) {
              logger.error(
                {
                  error: orderError.message,
                  merchantTransactionId: paymentRequest.merchantTransactionId,
                  mode: "cod",
                },
                "Error creating COD order and orderlines"
              );

              // Even if order creation fails, we still return success for transaction
              // The order can be created later using the stored transaction data
            }
          }

          const response = createSuccessResponse(
            requestBody.mode === "phonepe"
              ? "Payment initiated successfully"
              : "COD order created successfully",
            {
              merchantTransactionId: result.transactionId,
              redirectUrl: result.redirectUrl,
              amount: paymentRequest.amount,
              status:
                requestBody.mode === "phonepe"
                  ? "INITIATED"
                  : "COD_ORDER_CREATED",
              mode: requestBody.mode,
              message:
                requestBody.mode === "phonepe"
                  ? "Redirect to PhonePe for payment"
                  : "Order created for cash on delivery",
              orderData:
                requestBody.mode === "cod"
                  ? {
                      orderId: orderData?.id,
                      orderid: orderData?.orderid,
                      status: orderData?.orderstatus,
                    }
                  : null,
            }
          );
          console.log(response, "response FInal ");
          return reply.code(200).send(response);
        } else {
          const errorResponse = createErrorResponse(
            result.message ||
              `${requestBody.mode === "phonepe" ? "Payment" : "COD order"} ${
                requestBody.mode === "phonepe" ? "initiation" : "creation"
              } failed`,
            result.error,
            400
          );
          return reply.code(400).send(errorResponse);
        }
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            stack: error.stack,
            body: request.body,
          },
          "Error in payment initiation"
        );

        if (error instanceof ValidationError) {
          const response = createErrorResponse(
            error.message,
            error.details,
            400
          );
          return reply.code(400).send(response);
        }

        const response = createErrorResponse(
          "Payment initiation failed",
          "An unexpected error occurred while initiating payment",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Handle payment callback from PhonePe
   */
  handlePaymentCallback = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { merchantTransactionId: string };
        Querystring: { token?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { merchantTransactionId } = request.params;
        const { token } = request.query;

        console.log("=== PAYMENT CALLBACK START ===");
        console.log("merchantTransactionId:", merchantTransactionId);
        console.log("token:", token);
        console.log("request.method:", request.method);
        console.log(
          "request.headers:",
          JSON.stringify(request.headers, null, 2)
        );

        console.log("inside Payment Confirmaion ");
        logger.info(
          {
            merchantTransactionId,
            hasToken: !!token,
            method: request.method,
            headers: request.headers,
          },
          "Payment callback received"
        );

        const result = await this.phonePeService.handlePaymentCallback(
          merchantTransactionId,
          token
        );

        console.log("=== PHONEPE SERVICE RESULT ===");
        console.log("result:", JSON.stringify(result, null, 2));

        // If payment is successful, create order and orderlines
        if (result.success) {
          console.log("=== PAYMENT SUCCESSFUL - CREATING ORDER ===");
          try {
            logger.info(
              {
                merchantTransactionId,
                redirectUrl: result.redirectUrl,
                mode: "phonepe",
              },
              "Payment successful, creating order and orderlines with mode: phonepe"
            );

            // Create order and orderlines for successful PhonePe payment
            // Force mode to "phonepe" since this is PhonePe callback
            console.log("=== CALLING createOrderAfterPayment ===");
            const orderData = await this.createOrderAfterPayment(
              merchantTransactionId,
              "phonepe"
            );
            console.log("=== ORDER CREATED ===");
            console.log("orderData:", JSON.stringify(orderData, null, 2));
            console.log(orderData, "orderData ==>> Test ==> ");
            logger.info(
              {
                merchantTransactionId,
                orderId: orderData?.id,
                orderid: orderData?.orderid,
                mode: "phonepe",
              },
              "Order and orderlines created successfully for PhonePe payment Payment Callback"
            );

            // Update product quantities after successful order creation for PhonePe
            console.log("=== STARTING PRODUCT QUANTITY UPDATE PROCESS ===");
            try {
              // Get the original order data from transaction
              console.log("=== FINDING TRANSACTION DATA ===");
              const transactions = await this.transactionService.findMany(
                { merchanttransactionid: merchantTransactionId },
                1,
                1
              );

              console.log("=== TRANSACTION SEARCH RESULT ===");
              console.log(
                "transactions:",
                JSON.stringify(transactions, null, 2)
              );
              console.log(transactions, "transactions ==>> Test ==> ");

              if (transactions.data && transactions.data.length > 0) {
                const transaction = transactions.data[0];
                const originalOrderItems =
                  transaction.transactiondata?.originalPayload?.order || [];

                console.log("=== TRANSACTION DATA EXTRACTED ===");
                console.log(
                  "transaction:",
                  JSON.stringify(transaction, null, 2)
                );
                console.log(
                  "originalOrderItems:",
                  JSON.stringify(originalOrderItems, null, 2)
                );
                console.log(transaction, "transaction ==>> Test ==> ");
                console.log(
                  originalOrderItems,
                  "originalOrderItems from transaction ==>> Test ==> "
                );

                if (originalOrderItems.length > 0) {
                  console.log(
                    "=== CALLING updateProductQuantitiesAfterOrder ==="
                  );
                  console.log("orderData.id:", orderData.id);
                  console.log(
                    "originalOrderItems.length:",
                    originalOrderItems.length
                  );
                  console.log("mode: phonepe");
                  logger.info(
                    {
                      merchantTransactionId,
                      orderId: orderData.id,
                      mode: "phonepe",
                      originalOrderItemsCount: originalOrderItems.length,
                      originalOrderItems: originalOrderItems.map(
                        (item: any) => ({
                          productid: item.productid,
                          quantity: item.quantity,
                          productname: item.productname,
                        })
                      ),
                    },
                    "Starting product quantity updates for PhonePe order"
                  );

                  const quantityUpdateResult =
                    await this.updateProductQuantitiesAfterOrder(
                      orderData,
                      originalOrderItems,
                      "phonepe"
                    );

                  console.log("=== QUANTITY UPDATE RESULT ===");
                  console.log(
                    "quantityUpdateResult:",
                    JSON.stringify(quantityUpdateResult, null, 2)
                  );

                  logger.info(
                    {
                      merchantTransactionId,
                      orderId: orderData.id,
                      mode: "phonepe",
                      quantityUpdateResult,
                    },
                    "Product quantity updates completed for PhonePe order"
                  );
                } else {
                  console.log("=== NO ORIGINAL ORDER ITEMS FOUND ===");
                  logger.warn(
                    {
                      merchantTransactionId,
                      orderId: orderData.id,
                      mode: "phonepe",
                      transactionData: transaction.transactiondata,
                      originalPayload:
                        transaction.transactiondata?.originalPayload,
                    },
                    "No original order items found for quantity update"
                  );
                }
              } else {
                console.log("=== NO TRANSACTIONS FOUND ===");
                console.log(
                  "No transactions found for merchantTransactionId:",
                  merchantTransactionId
                );
              }
            } catch (quantityUpdateError: any) {
              console.log("=== QUANTITY UPDATE ERROR ===");
              console.log(
                "quantityUpdateError:",
                JSON.stringify(quantityUpdateError, null, 2)
              );
              logger.error(
                {
                  error: quantityUpdateError.message,
                  merchantTransactionId,
                  orderId: orderData?.id,
                  mode: "phonepe",
                },
                "Error updating product quantities for PhonePe order"
              );

              // Don't fail the order creation if quantity update fails
              // The order is already created successfully
            }
          } catch (orderError: any) {
            console.log("=== ORDER CREATION ERROR ===");
            console.log("orderError:", JSON.stringify(orderError, null, 2));

            // Even if order creation fails, we still redirect to success page
            // The order can be created later using the stored transaction data
          }
        } else {
          logger.warn(
            {
              merchantTransactionId,
              message: result.message,
              redirectUrl: result.redirectUrl,
            },
            "Payment failed, redirecting to failure page"
          );
        }

        // Perform redirect
        return reply.redirect(result.redirectUrl);
      } catch (error: any) {
        console.log("=== MAIN PAYMENT CALLBACK ERROR ===");
        console.log("error:", JSON.stringify(error, null, 2));
        logger.error(
          {
            error: error.message,
            merchantTransactionId: request.params?.merchantTransactionId,
          },
          "Error in payment callback"
        );

        // Redirect to failure page on error
        const failureUrl =
          process.env.REDIRECT_URL_FAILURE ||
          "http://localhost:5600/payment/failure";
        return reply.redirect(failureUrl);
      }
    }
  );

  /**
   * Check payment status
   */
  checkPaymentStatus = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { merchantTransactionId: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { merchantTransactionId } = request.params;

        logger.info(
          { merchantTransactionId },
          "Payment status check requested"
        );

        const paymentStatus = await this.phonePeService.checkPaymentStatus(
          merchantTransactionId
        );

        const response = createSuccessResponse(
          "Payment status retrieved successfully",
          {
            merchantTransactionId,
            status: paymentStatus.code,
            success: paymentStatus.success,
            message: paymentStatus.message,
            paymentData: paymentStatus.data,
          }
        );

        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            merchantTransactionId: request.params?.merchantTransactionId,
          },
          "Error checking payment status"
        );

        if (error instanceof DatabaseError) {
          const response = createErrorResponse(
            error.message,
            error.details,
            error.statusCode
          );
          return reply.code(error.statusCode).send(response);
        }

        const response = createErrorResponse(
          "Failed to check payment status",
          "An error occurred while checking payment status",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Process refund
   */
  processRefund = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { merchantTransactionId: string };
        Body: { refundAmount?: number; reason?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { merchantTransactionId } = request.params;
        const { refundAmount, reason } = request.body as {
          refundAmount?: number;
          reason?: string;
        };

        logger.info(
          {
            merchantTransactionId,
            refundAmount,
            reason,
          },
          "Refund request received"
        );

        const result = await this.phonePeService.refundPayment(
          merchantTransactionId,
          refundAmount,
          reason
        );

        if (result.success) {
          const response = createSuccessResponse(
            "Refund initiated successfully",
            {
              merchantTransactionId,
              refundId: result.refundId,
              refundAmount,
              reason,
              status: "REFUND_INITIATED",
            }
          );
          return reply.code(200).send(response);
        } else {
          const errorResponse = createErrorResponse(
            result.message || "Refund initiation failed",
            undefined,
            400
          );
          return reply.code(400).send(errorResponse);
        }
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            merchantTransactionId: request.params?.merchantTransactionId,
          },
          "Error processing refund"
        );

        if (error instanceof ValidationError) {
          const response = createErrorResponse(
            error.message,
            error.details,
            400
          );
          return reply.code(400).send(response);
        }

        const response = createErrorResponse(
          "Refund processing failed",
          "An unexpected error occurred while processing refund",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Get user transaction history
   */
  getUserTransactionHistory = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { userId: string };
        Querystring: { page?: string; limit?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const userId = parseInt(request.params.userId);
        const page = parseInt(request.query.page || "1");
        const limit = parseInt(request.query.limit || "10");

        if (isNaN(userId)) {
          const response = createErrorResponse(
            "Invalid user ID",
            "User ID must be a valid number",
            400
          );
          return reply.code(400).send(response);
        }

        logger.debug(
          { userId, page, limit },
          "User transaction history requested"
        );

        const result = await this.phonePeService.getUserTransactionHistory(
          userId,
          page,
          limit
        );

        return reply.code(200).send({
          ...result,
          meta: {
            userId,
            page,
            limit,
          },
        });
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            userId: request.params?.userId,
          },
          "Error getting user transaction history"
        );

        if (error instanceof DatabaseError) {
          const response = createErrorResponse(
            error.message,
            error.details,
            error.statusCode
          );
          return reply.code(error.statusCode).send(response);
        }

        const response = createErrorResponse(
          "Failed to retrieve transaction history",
          "An error occurred while retrieving transaction history",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Get transaction statistics
   */
  getTransactionStats = asyncHandler(
    async (
      request: FastifyRequest<{
        Querystring: { userId?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const userIdParam = request.query.userId;
        const userId = userIdParam ? parseInt(userIdParam) : undefined;

        if (userIdParam && isNaN(userId!)) {
          const response = createErrorResponse(
            "Invalid user ID",
            "User ID must be a valid number",
            400
          );
          return reply.code(400).send(response);
        }

        logger.debug({ userId }, "Transaction statistics requested");

        const result = await this.phonePeService.getTransactionStats(userId);

        return reply.code(200).send({
          ...result,
          meta: {
            userId,
            generatedAt: new Date().toISOString(),
          },
        });
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            userId: request.query?.userId,
          },
          "Error getting transaction statistics"
        );

        if (error instanceof DatabaseError) {
          const response = createErrorResponse(
            error.message,
            error.details,
            error.statusCode
          );
          return reply.code(error.statusCode).send(response);
        }

        const response = createErrorResponse(
          "Failed to retrieve transaction statistics",
          "An error occurred while retrieving transaction statistics",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Handle PhonePe webhook
   */
  handleWebhook = asyncHandler(
    async (
      request: FastifyRequest<{
        Headers: { "x-verify"?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const signature = request.headers["x-verify"];
        const payload = JSON.stringify(request.body);

        logger.info(
          {
            hasSignature: !!signature,
            bodyLength: payload.length,
          },
          "PhonePe webhook received"
        );

        // Validate webhook signature
        if (
          !signature ||
          !PhonePeService.validateWebhookSignature(payload, signature)
        ) {
          logger.warn({ signature }, "Invalid webhook signature");
          const response = createErrorResponse(
            "Invalid signature",
            "Webhook signature validation failed",
            401
          );
          return reply.code(401).send(response);
        }

        // Process webhook data
        const webhookData = request.body as any;
        logger.info(
          {
            merchantTransactionId: webhookData.merchantTransactionId,
            status: webhookData.code,
          },
          "Processing webhook data"
        );

        // Here you can add additional webhook processing logic as needed
        // For example, updating order status, sending notifications, etc.

        const response = createSuccessResponse(
          "Webhook processed successfully",
          {
            received: true,
            timestamp: new Date().toISOString(),
          }
        );

        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            body: request.body,
          },
          "Error processing webhook"
        );

        const response = createErrorResponse(
          "Webhook processing failed",
          "An error occurred while processing webhook",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Generate merchant transaction ID
   */
  generateTransactionId = asyncHandler(
    async (
      request: FastifyRequest<{
        Querystring: { prefix?: string };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const prefix = request.query.prefix || "TXN";
        const transactionId =
          PhonePeService.generateMerchantTransactionId(prefix);

        logger.debug(
          { prefix, transactionId },
          "Generated merchant transaction ID"
        );

        const response = createSuccessResponse(
          "Transaction ID generated successfully",
          {
            merchantTransactionId: transactionId,
            prefix,
            timestamp: Date.now(),
          }
        );

        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error(
          { error: error.message },
          "Error generating transaction ID"
        );

        const response = createErrorResponse(
          "Transaction ID generation failed",
          "An error occurred while generating transaction ID",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Manually update product quantities for an existing order
   * This is useful for fixing orders where quantity updates failed
   */
  updateOrderQuantities = asyncHandler(
    async (
      request: FastifyRequest<{
        Params: { orderId: Number };
      }>,
      reply: FastifyReply
    ) => {
      try {
        const { orderId } = request.params;

        logger.info({ orderId }, "Manual product quantity update requested");

        // Get order data
        const order = await this.ordersService.findById(orderId);
        if (!order) {
          const response = createErrorResponse(
            "Order not found",
            `Order with ID ${orderId} does not exist`,
            404
          );
          return reply.code(404).send(response);
        }

        // Get orderlines for this order
        const orderlines = await prisma.orderline.findMany({
          where: { orderid: Number(orderId) },
          select: {
            id: true,
            productid: true,
            quantity: true,
          },
        });

        if (orderlines.length === 0) {
          const response = createErrorResponse(
            "No orderlines found",
            `No orderlines found for order ${orderId}`,
            404
          );
          return reply.code(404).send(response);
        }

        // Convert orderlines to the format expected by updateProductQuantitiesAfterOrder
        const orderItems = orderlines.map((orderline) => ({
          productid: Number(orderline.productid),
          quantity: orderline.quantity || 1,
          productname: null, // We'll get the product name from the product table if needed
        }));

        // Update product quantities
        const quantityUpdateResult =
          await this.updateProductQuantitiesAfterOrder(
            order,
            orderItems,
            order.mode || "unknown"
          );

        const response = createSuccessResponse(
          "Product quantities updated successfully",
          {
            orderId: orderId,
            orderlines: orderlines.length,
            quantityUpdateResult,
          }
        );

        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error(
          {
            error: error.message,
            orderId: request.params?.orderId,
          },
          "Error in manual product quantity update"
        );

        const response = createErrorResponse(
          "Failed to update product quantities",
          "An error occurred while updating product quantities",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Health check for PhonePe service
   */
  healthCheck = asyncHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const healthData = {
          service: "PhonePe Payment Gateway",
          status: "healthy",
          timestamp: new Date().toISOString(),
          version: "1.0.0",
          environment: process.env.NODE_ENV || "development",
          configuration: {
            merchantId: process.env.PHONEPE_MERCHANT_ID
              ? "configured"
              : "not configured",
            saltKey: process.env.PHONEPE_SALT_KEY
              ? "configured"
              : "not configured",
            baseUrl: process.env.PHONEPE_BASE_URL || "default (sandbox)",
            redirectUrls: {
              success: process.env.REDIRECT_URL_SUCCESS || "default",
              failure: process.env.REDIRECT_URL_FAILURE || "default",
              status: process.env.REDIRECT_URL_PAYMENT_STATUS || "default",
            },
          },
        };

        const response = createSuccessResponse(
          "PhonePe service is healthy",
          healthData
        );
        return reply.code(200).send(response);
      } catch (error: any) {
        logger.error({ error: error.message }, "Error in PhonePe health check");

        const response = createErrorResponse(
          "PhonePe service health check failed",
          "An error occurred during health check",
          500
        );
        return reply.code(500).send(response);
      }
    }
  );

  /**
   * Update transaction status in database
   */
  async updateTransactionStatus(
    transactionId: string,
    status: string,
    paymentData: any
  ) {
    try {
      logger.info({ transactionId, status }, "Updating transaction status");

      // Find transaction by merchanttransactionid
      const transactions = await this.transactionService.findMany(
        { merchanttransactionid: transactionId },
        1,
        1
      );

      if (!transactions.data || transactions.data.length === 0) {
        throw new Error(
          `Transaction not found with merchanttransactionid: ${transactionId}`
        );
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
        status: status,
      };

      // Update the main status fields for backward compatibility
      existingTransactionData.status = status;
      existingTransactionData.paymentCompleteAt = new Date().toISOString();
      existingTransactionData.updatedAt = new Date().toISOString();

      // If there's an error, store it in the phonePeResponse field for backward compatibility
      if (status === "ERROR" || status === "FAILED") {
        existingTransactionData.phonePeResponse = {
          error: paymentData.error || paymentData.message || "Payment failed",
        };
      } else {
        existingTransactionData.phonePeResponse = paymentData;
      }

      // Update transaction data with enhanced structure
      const updateData = {
        transactiondata: existingTransactionData,
        modifieddate: Date.now(),
      };

      // Use TransactionService to update transaction by database ID
      const result = await this.transactionService.update(
        transaction.id.toString(),
        updateData
      );
      logger.info(
        {
          transactionId,
          status,
          statusKey,
          hasExistingData: !!transaction.transactiondata,
          responseCount: Object.keys(existingTransactionData.phonePeResponses)
            .length,
        },
        "Transaction status updated successfully with enhanced data structure"
      );

      return result;
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          transactionId,
          status,
        },
        "Error updating transaction status"
      );
      throw error;
    }
  }

  /**
   * Create order and orderline records after successful payment
   */
  async createOrderAfterPayment(transactionId: string, forceMode?: string) {
    try {
      console.log("=== createOrderAfterPayment METHOD CALLED ===");
      console.log("transactionId:", transactionId);
      console.log("forceMode:", forceMode);

      logger.info({ transactionId }, "Creating order after successful payment");
      logger.info({ forceMode }, "forceMode createOrderAfterPayment");
      // Find transaction by merchanttransactionid
      const transactions = await this.transactionService.findMany(
        { merchanttransactionid: transactionId },
        1,
        1
      );

      if (!transactions.data || transactions.data.length === 0) {
        throw new Error(
          `Transaction not found with merchanttransactionid: ${transactionId}`
        );
      }

      const transaction = transactions.data[0];
      logger.info(
        {
          transactionId,
          mode: transaction.transactiondata?.mode || "unknown",
          foundTransaction: {
            id: transaction.id,
            userid: transaction.userid,
            productid: transaction.productid,
            amount: transaction.amount,
          },
        },
        "Transaction found for order creation"
      );

      // Validate products BEFORE creating order
      if (
        !transaction.productid ||
        !Array.isArray(transaction.productid) ||
        transaction.productid.length === 0
      ) {
        logger.warn(
          {
            transactionId,
            productid: transaction.productid,
          },
          "No product IDs found in transaction, cannot create order"
        );
        throw new Error(
          "No product IDs found in transaction - cannot create order"
        );
      }

      // Validate all products at once using Prisma
      const validProducts = await this.validateProductsBatch(
        transaction.productid
      );
      const validProductIds = validProducts.map((p) => p.id);
      const invalidProductIds = transaction.productid.filter(
        (id: number) => !validProductIds.includes(id)
      );

      logger.info(
        {
          transactionId,
          totalProducts: transaction.productid.length,
          validProductIds,
          invalidProductIds,
          validCount: validProductIds.length,
          invalidCount: invalidProductIds.length,
        },
        "Product validation completed before order creation"
      );

      // Prevent order creation if no valid products exist
      if (validProductIds.length === 0) {
        const errorMsg = `Cannot create order - no valid products found. Invalid product IDs: ${JSON.stringify(
          invalidProductIds
        )}`;
        logger.error(
          {
            transactionId,
            invalidProductIds,
            totalRequested: transaction.productid.length,
          },
          errorMsg
        );
        throw new Error(errorMsg);
      }

      // Log warnings for invalid products but continue with valid ones
      if (invalidProductIds.length > 0) {
        logger.warn(
          {
            transactionId,
            invalidProductIds,
            validProductIds,
            message:
              "Some products are invalid but order will be created with valid products only",
          },
          "Invalid products detected - will skip these during orderline creation"
        );
      }

      const currentTime = Date.now();
      const orderid = `ORDER_${transactionId}_${currentTime}`;

      // Get mode from transaction data or use forced mode
      const mode = forceMode || transaction.transactiondata?.mode || "unknown";

      logger.info(
        {
          transactionId,
          forceMode,
          originalMode: transaction.transactiondata?.mode,
          finalMode: mode,
        },
        "Mode determination for order creation"
      );

      // Get original order data from transaction for detailed orderline creation
      const originalOrderData =
        transaction.transactiondata?.originalPayload?.order || [];

      logger.info(
        {
          transactionId,
          mode: mode,
          originalOrderData: originalOrderData.length,
          validProductIds,
          step: "preparing_order_with_detailed_items",
        },
        "Preparing order creation with detailed product information"
      );

      // Create order record with productid to enable automatic orderline creation
      const orderData = {
        userid: transaction.userid,
        orderamount: parseFloat(transaction.amount?.toString() || "0"),
        orderid: orderid,
        orderstatus: "payment_completed",
        quantity: validProductIds.length, // Use valid product count
        transactionid: transaction.transactionid,
        productamount: parseFloat(transaction.amount?.toString() || "0"),
        discountamount: 0,
        ispaymentsucceed: true,
        merchanttransactionid: transaction.merchanttransactionid,
        productid: validProductIds, // Include product IDs for automatic orderline creation
        mode: mode, // Add mode field: 'phonepe' or 'cod'
        createddate: currentTime,
        modifieddate: currentTime,
        // Add original order items for detailed orderline creation
        orderItems: originalOrderData.filter((item: any) =>
          validProductIds.includes(item.productid)
        ),
      };

      // Log the orderData being sent to OrdersService
      logger.info(
        {
          transactionId,
          mode: mode,
          orderDataKeys: Object.keys(orderData),
          orderDataMode: orderData.mode,
          orderDataFull: JSON.stringify(orderData, null, 2),
          step: "sending_to_orders_service",
        },
        "Order data being sent to OrdersService"
      );

      // Add a test to see if mode field is being filtered out
      logger.info(
        {
          transactionId,
          hasModeInOrderData: "mode" in orderData,
          modeValue: orderData.mode,
          modeType: typeof orderData.mode,
          step: "mode_field_verification",
        },
        "Mode field verification before OrdersService.create"
      );

      // Create order using OrdersService (with automatic orderline creation)
      const order = await this.ordersService.create(orderData);

      // Log the created order to see if mode was saved
      logger.info(
        {
          transactionId,
          orderId: order.id,
          orderidString: order.orderid,
          orderMode: order.mode,
          orderFull: JSON.stringify(order, null, 2),
          validProductCount: validProductIds.length,
          invalidProductCount: invalidProductIds.length,
          step: "order_created_with_automatic_orderlines",
        },
        "Order created successfully with automatic orderline creation"
      );

      // Check if orderlines were created automatically
      const createdOrderlines = await prisma.orderline.findMany({
        where: { orderid: order.id },
        select: { id: true, productid: true, orderlinenumber: true },
      });

      logger.info(
        {
          transactionId,
          orderId: order.id,
          automaticOrderlines: createdOrderlines.length,
          orderlineIds: createdOrderlines.map((ol) => ol.id),
          step: "automatic_orderlines_verified",
        },
        "Automatic orderline creation completed and verified"
      );

      // Use the automatically created orderlines
      const orderlineResults = createdOrderlines.map((ol) => ({
        success: true,
        productId: Number(ol.productid),
        orderline: ol,
      }));

      const successfulOrderlines = orderlineResults.filter(
        (result) => result.success
      );
      const failedOrderlines: any = orderlineResults.filter(
        (result) => !result.success
      );

      logger.info(
        {
          transactionId,
          orderId: order.id,
          totalOrderlines: orderlineResults.length,
          successfulCount: successfulOrderlines.length,
          failedCount: failedOrderlines.length,
          successfulOrderlineIds: successfulOrderlines
            .map((r) => r.orderline?.id)
            .filter(Boolean),
          failedProductIds: failedOrderlines.map((r: any) => r.productId),
          invalidProductsSkipped: invalidProductIds,
        },
        "Orderline creation completed"
      );

      // If all orderlines failed, throw an error
      if (successfulOrderlines.length === 0) {
        const errorMsg = `Failed to create any orderlines for order ${
          order.id
        }. Errors: ${failedOrderlines.map((r: any) => r.error).join(", ")}`;
        logger.error(
          {
            transactionId,
            orderId: order.id,
            failedOrderlines: failedOrderlines.map((r: any) => ({
              productId: r.productId,
              error: r.error,
            })),
          },
          errorMsg
        );
        throw new Error(errorMsg);
      }

      // Log warnings for partial failures
      if (failedOrderlines.length > 0) {
        logger.warn(
          {
            transactionId,
            orderId: order.id,
            failedOrderlines: failedOrderlines.map((r: any) => ({
              productId: r.productId,
              error: r.error,
            })),
          },
          "Some orderlines failed to create but order has partial success"
        );
      }

      // Final success log with comprehensive summary
      logger.info(
        {
          transactionId,
          orderId: order.id,
          mode: mode,
          summary: {
            totalProductsRequested: transaction.productid.length,
            validProducts: validProductIds.length,
            invalidProducts: invalidProductIds.length,
            successfulOrderlines: successfulOrderlines.length,
            failedOrderlines: failedOrderlines.length,
            orderAmount: order.orderamount,
            orderStatus: order.orderstatus,
          },
        },
        "Order and orderlines created successfully after payment"
      );
      console.log(order, "Final Order testing ==>>>> ");
      return order;
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          stack: error.stack,
          transactionId,
        },
        "Error creating order after payment"
      );
      throw error;
    }
  }

  /**
   * Validate products in batch using Prisma
   */
  private async validateProductsBatch(
    productIds: number[]
  ): Promise<Array<{ id: number; name?: string }>> {
    try {
      logger.debug({ productIds }, "Validating products in batch");

      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds.map((id: number) => BigInt(id)) },
        },
        select: {
          id: true,
          name: true,
        },
      });

      const formattedProducts = products
        .map((p) => ({
          id: Number(p.id),
          name: p.name || undefined,
        }))
        .filter((p) => p.id && !isNaN(p.id)) as Array<{
        id: number;
        name?: string;
      }>;

      logger.debug(
        {
          requestedIds: productIds,
          foundProducts: formattedProducts.map((p) => ({
            id: p.id,
            name: p.name,
          })),
        },
        "Batch product validation completed"
      );

      return formattedProducts;
    } catch (error: any) {
      logger.error(
        {
          productIds,
          error: error.message,
          stack: error.stack,
        },
        "Error in batch product validation"
      );
      return [];
    }
  }

  /**
   * Validate and clean orderline data before creation
   */
  private validateOrderlineData(orderlineData: any): {
    isValid: boolean;
    errors: string[];
    cleanedData?: any;
  } {
    const errors: string[] = [];
    const cleanedData = { ...orderlineData };

    // Validate required ID fields (all should be Int)
    if (!cleanedData.orderid || typeof cleanedData.orderid !== "number") {
      errors.push("orderid must be a valid number (Int)");
    }

    if (!cleanedData.productid || typeof cleanedData.productid !== "number") {
      errors.push("productid must be a valid number (Int)");
    }

    if (!cleanedData.userid || typeof cleanedData.userid !== "number") {
      errors.push("userid must be a valid number (Int)");
    }

    // Optional ID fields (should be Int or null)
    if (cleanedData.addressid !== undefined && cleanedData.addressid !== null) {
      const addressId = Number(cleanedData.addressid);
      if (isNaN(addressId)) {
        errors.push("addressid must be a valid number (Int) or null");
      } else {
        cleanedData.addressid = addressId;
      }
    }

    // Validate and clean numeric fields (Decimal in DB, Number in JS)
    const numericFields = ["productamount", "discountamount", "orderamount"];
    numericFields.forEach((field) => {
      if (cleanedData[field] !== undefined && cleanedData[field] !== null) {
        const numValue = Number(cleanedData[field]);
        if (isNaN(numValue)) {
          errors.push(`${field} must be a valid number (Decimal)`);
        } else {
          cleanedData[field] = numValue;
        }
      }
    });

    // Validate quantity (should be Int)
    if (cleanedData.quantity !== undefined && cleanedData.quantity !== null) {
      const quantityValue = Number(cleanedData.quantity);
      if (isNaN(quantityValue) || !Number.isInteger(quantityValue)) {
        errors.push("quantity must be a valid integer (Int)");
      } else {
        cleanedData.quantity = quantityValue;
      }
    }

    // Validate and clean timestamp fields (should be BigInt)
    const timestampFields = [
      "createddate",
      "modifieddate",
      "ordereddate",
      "readytodispatchdate",
      "delivereddate",
      "cancelleddate",
      "returneddate",
      "dispatcheddate",
      "paymentfaileddate",
    ];
    timestampFields.forEach((field) => {
      if (cleanedData[field] !== undefined && cleanedData[field] !== null) {
        try {
          // Convert to BigInt for date fields
          const timestampValue = BigInt(cleanedData[field]);
          cleanedData[field] = timestampValue;
        } catch (error) {
          errors.push(`${field} must be a valid timestamp (BigInt)`);
        }
      }
    });

    // Validate string fields length
    const stringFields = [
      { field: "merchanttransactionid", maxLength: 250 },
      { field: "productname", maxLength: 500 },
      { field: "productcategory", maxLength: 500 },
      { field: "productcolour", maxLength: 500 },
      { field: "orderstatus", maxLength: 500 },
      { field: "uniqueordderid", maxLength: 500 },
      { field: "orderlinenumber", maxLength: 500 },
      { field: "deliveryfrom", maxLength: 500 },
      { field: "location", maxLength: 500 },
    ];

    stringFields.forEach(({ field, maxLength }) => {
      if (cleanedData[field] && typeof cleanedData[field] === "string") {
        if (cleanedData[field].length > maxLength) {
          errors.push(`${field} must be ${maxLength} characters or less`);
        }
      }
    });

    // Ensure null values for optional fields that might be undefined
    const optionalFields = [
      "addressid",
      "productcategory",
      "productcolour",
      "deliveryfrom",
      "location",
    ];
    optionalFields.forEach((field) => {
      if (cleanedData[field] === undefined) {
        cleanedData[field] = null;
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      cleanedData: errors.length === 0 ? cleanedData : undefined,
    };
  }

  /**
   * Create orderlines for validated products
   */
  private async createOrderlinesForProducts(
    orderId: number,
    validProducts: Array<{ id: number; name?: string }>,
    transaction: any,
    orderid: string,
    currentTime: number,
    transactionId: string
  ): Promise<
    Array<{
      success: boolean;
      productId: number;
      orderline?: any;
      error?: string;
    }>
  > {
    const results: Array<{
      success: boolean;
      productId: number;
      orderline?: any;
      error?: string;
    }> = [];

    // Get original order data from transaction to retrieve individual product amounts
    const originalOrderData =
      transaction.transactiondata?.originalPayload?.order || [];

    // Create a map of product amounts from original order data
    const productAmountMap = new Map<number, number>();
    originalOrderData.forEach((orderItem: any) => {
      if (orderItem.productid && orderItem.productamount !== undefined) {
        productAmountMap.set(
          orderItem.productid,
          parseFloat(orderItem.productamount.toString()) || 0
        );
      }
    });

    logger.debug(
      {
        transactionId,
        originalOrderData: originalOrderData.length,
        productAmountMap: Object.fromEntries(productAmountMap),
        validProductIds: validProducts.map((p) => p.id),
      },
      "Product amount mapping from original order data"
    );

    for (let index = 0; index < validProducts.length; index++) {
      const product = validProducts[index];

      if (!product) {
        logger.warn({ transactionId, index }, "Skipping undefined product");
        continue;
      }

      try {
        // Get individual product amount from the original order data
        const individualProductAmount = productAmountMap.get(product.id);

        if (individualProductAmount === undefined) {
          logger.warn(
            {
              transactionId,
              productId: product.id,
              availableAmounts: Object.fromEntries(productAmountMap),
            },
            "Product amount not found in original order data, using fallback calculation"
          );

          // Fallback to equal division if individual amount not found
          const totalAmount = parseFloat(transaction.amount?.toString() || "0");
          const fallbackAmount =
            validProducts.length > 0 ? totalAmount / validProducts.length : 0;

          logger.warn(
            {
              transactionId,
              productId: product.id,
              fallbackAmount,
              totalAmount,
              validProductsCount: validProducts.length,
            },
            "Using fallback equal division for product amount"
          );
        }

        const productAmountToUse =
          individualProductAmount ??
          (validProducts.length > 0
            ? parseFloat(transaction.amount?.toString() || "0") /
              validProducts.length
            : 0);

        const orderlineData = {
          orderid: orderId, // Int - correct
          productid: product.id, // Int - correct (not BigInt)
          userid: transaction.userid, // Int - correct
          productamount: Number(productAmountToUse),
          discountamount: 0,
          orderamount: Number(productAmountToUse),
          quantity: 1, // Int - correct
          merchanttransactionid: transaction.merchanttransactionid,
          orderstatus: "payment_completed",
          orderlinenumber: `${orderid}_LINE_${index + 1}`,
          productname: product.name || null,
          ordereddate: BigInt(currentTime), // BigInt - correct for date fields
          createddate: BigInt(currentTime), // BigInt - correct for date fields
          modifieddate: BigInt(currentTime), // BigInt - correct for date fields
        };

        // Validate orderline data before creation
        const validation = this.validateOrderlineData(orderlineData);
        if (!validation.isValid) {
          throw new Error(
            `Orderline data validation failed: ${validation.errors.join(", ")}`
          );
        }

        logger.debug(
          {
            transactionId,
            productId: product.id,
            individualAmount: individualProductAmount,
            amountUsed: productAmountToUse,
            orderlineData: {
              ...validation.cleanedData,
              // Don't log the full productname to keep logs clean
              productname: product.name ? "***" : null,
            },
          },
          "Creating orderline with individual product amount"
        );

        const orderline = await this.orderlineService.create(
          validation.cleanedData!
        );

        logger.info(
          {
            transactionId,
            productId: product.id,
            orderlineId: orderline.id,
            orderlinenumber: orderline.orderlinenumber,
            productAmount: productAmountToUse,
          },
          "Orderline created successfully with individual product amount"
        );

        results.push({
          success: true,
          productId: product.id,
          orderline,
        });
      } catch (error: any) {
        logger.error(
          {
            transactionId,
            productId: product.id,
            error: error.message,
            stack: error.stack,
            errorType: error.constructor.name,
          },
          "Failed to create orderline for product"
        );

        results.push({
          success: false,
          productId: product.id,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Check if product exists in product table
   */
  private async checkProductExists(productId: number): Promise<boolean> {
    try {
      logger.debug({ productId }, "Checking if product exists in database");

      // Use Prisma's findUnique instead of raw SQL for better reliability
      const product = await prisma.product.findUnique({
        where: { id: BigInt(productId) },
        select: { id: true },
      });

      const exists = !!product;
      logger.debug({ productId, exists }, "Product existence check completed");

      return exists;
    } catch (error: any) {
      logger.error(
        {
          productId,
          error: error.message,
          stack: error.stack,
        },
        "Error checking product existence"
      );
      return false;
    }
  }

  /**
   * Store transaction data in database
   */
  private async storeTransactionData(
    paymentRequest: any,
    transactionData: any
  ) {
    try {
      logger.info(
        {
          merchantTransactionId: paymentRequest.merchantTransactionId,
          amount: paymentRequest.amount,
          userId: paymentRequest.userId,
          mode: transactionData.mode,
        },
        "Storing transaction data"
      );

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
        modifieddate: Date.now(),
      };

      const result = await this.transactionService.create(transactionRecord);
      logger.info(
        {
          merchantTransactionId: paymentRequest.merchantTransactionId,
          transactionId: result.id,
        },
        "Transaction data stored successfully"
      );

      return result;
    } catch (error: any) {
      logger.error(
        {
          error: error.message,
          merchantTransactionId: paymentRequest.merchantTransactionId,
        },
        "Error storing transaction data"
      );
      throw error;
    }
  }

  /**
   * Update product quantities and status after successful order creation
   * This method updates orderedquantity, availablequantity, and productstatus for each product in the order
   * Product status rules:
   * - availablequantity <= 0: "out_of_stock"
   * - availablequantity 1-5: "low_stock"
   * - availablequantity > 5: "in_stock"
   */
  async updateProductQuantitiesAfterOrder(
    orderData: any,
    originalOrderItems: any[],
    mode: string
  ) {
    console.log("=== updateProductQuantitiesAfterOrder METHOD CALLED ===");
    console.log(orderData, "orderData ==>> Test ==> ");
    console.log(originalOrderItems, "originalOrderItems ==>> Test ==> ");
    console.log(mode, "mode ==>> Test ==> ");
    try {
      logger.info(
        {
          orderId: orderData.id,
          mode: mode,
          orderItemsCount: originalOrderItems.length,
          orderItemsStructure: originalOrderItems.map((item) => ({
            productid: item.productid,
            quantity: item.quantity,
            productname: item.productname,
          })),
        },
        "Starting product quantity updates after order creation"
      );

      // Validate input data
      if (
        !originalOrderItems ||
        !Array.isArray(originalOrderItems) ||
        originalOrderItems.length === 0
      ) {
        logger.warn(
          {
            orderId: orderData.id,
            mode: mode,
            originalOrderItems: originalOrderItems,
          },
          "No valid order items provided for quantity update"
        );
        return {
          success: false,
          totalProducts: 0,
          successfulUpdates: 0,
          failedUpdates: 0,
          updateResults: [],
          error: "No valid order items provided",
        };
      }

      const updateResults = [];

      for (const orderItem of originalOrderItems) {
        try {
          // Validate order item structure
          if (!orderItem || typeof orderItem !== "object") {
            logger.warn(
              {
                orderId: orderData.id,
                orderItem: orderItem,
              },
              "Invalid order item structure"
            );
            updateResults.push({
              productId: null,
              success: false,
              error: "Invalid order item structure",
            });
            continue;
          }

          const productId = orderItem.productid;
          const requestedQuantity = orderItem.quantity || 1;
          console.log(productId, "productId");
          console.log(requestedQuantity, "requestedQuantity");
          // Validate product ID
          if (!productId || isNaN(Number(productId))) {
            logger.warn(
              {
                orderId: orderData.id,
                productId: productId,
                orderItem: orderItem,
              },
              "Invalid product ID in order item"
            );
            updateResults.push({
              productId: productId,
              success: false,
              error: "Invalid product ID",
            });
            continue;
          }

          logger.info(
            {
              orderId: orderData.id,
              productId: productId,
              requestedQuantity: requestedQuantity,
              mode: mode,
            },
            "Processing product quantity update"
          );

          // Get current product data
          const product = await prisma.product.findUnique({
            where: { id: BigInt(productId) },
            select: {
              id: true,
              name: true,
              orderedquantity: true,
              availablequantity: true,
              quantity: true,
            },
          });
          console.log(product, "final product");
          if (!product) {
            logger.warn(
              {
                productId,
                orderId: orderData.id,
              },
              "Product not found for quantity update"
            );
            updateResults.push({
              productId: productId,
              success: false,
              error: "Product not found",
            });
            continue;
          }

          // Calculate new quantities
          const currentOrderedQuantity = product.orderedquantity || 0;
          const currentAvailableQuantity = product.availablequantity || 0;

          const newOrderedQuantity = currentOrderedQuantity + requestedQuantity;
          const newAvailableQuantity = Math.max(
            0,
            currentAvailableQuantity - requestedQuantity
          );

          console.log(
            {
              productId,
              currentOrderedQuantity,
              currentAvailableQuantity,
              requestedQuantity,
              newOrderedQuantity,
              newAvailableQuantity,
            },
            "Quantity calculations ==>> Test ==> "
          );

          // Determine product status based on new available quantity
          let newProductStatus: string;
          if (newAvailableQuantity <= 0) {
            newProductStatus = "out_of_stock";
          } else if (newAvailableQuantity >= 1 && newAvailableQuantity <= 5) {
            newProductStatus = "low_stock";
          } else {
            newProductStatus = "in_stock";
          }

          logger.info(
            {
              orderId: orderData.id,
              productId: productId,
              productName: product.name,
              mode: mode,
              beforeUpdate: {
                orderedquantity: currentOrderedQuantity,
                availablequantity: currentAvailableQuantity,
              },
              afterUpdate: {
                orderedquantity: newOrderedQuantity,
                availablequantity: newAvailableQuantity,
                productstatus: newProductStatus,
              },
              requestedQuantity: requestedQuantity,
            },
            "About to update product quantities and status"
          );

          // Update product quantities and status
          try {
            const updatedProduct = await prisma.product.update({
              where: { id: BigInt(productId) },
              data: {
                orderedquantity: newOrderedQuantity,
                availablequantity: newAvailableQuantity,
                productstatus: newProductStatus,
                modifieddate: BigInt(Date.now()),
              },
            });

            console.log(updatedProduct, "updatedProduct ==>> Test ==> ");
          } catch (updateError: any) {
            console.error(
              {
                productId,
                error: updateError.message,
                stack: updateError.stack,
              },
              "Prisma update error ==>> Test ==> "
            );
            throw updateError;
          }

          // Verify the update was successful
          const verificationProduct = await prisma.product.findUnique({
            where: { id: BigInt(productId) },
            select: {
              id: true,
              name: true,
              orderedquantity: true,
              availablequantity: true,
              productstatus: true,
            },
          });

          console.log(
            verificationProduct,
            "verificationProduct ==>> Test ==> "
          );

          // Final verification - check database directly
          const finalCheck = await prisma.product.findUnique({
            where: { id: BigInt(productId) },
            select: {
              id: true,
              name: true,
              orderedquantity: true,
              availablequantity: true,
              productstatus: true,
            },
          });

          console.log(finalCheck, "finalCheck from database ==>> Test ==> ");

          logger.info(
            {
              productId,
              productName: product.name,
              orderId: orderData.id,
              mode: mode,
              quantityUpdate: {
                requestedQuantity,
                oldOrderedQuantity: currentOrderedQuantity,
                newOrderedQuantity,
                oldAvailableQuantity: currentAvailableQuantity,
                newAvailableQuantity,
                newProductStatus,
              },
              verification: {
                actualOrderedQuantity: verificationProduct?.orderedquantity,
                actualAvailableQuantity: verificationProduct?.availablequantity,
                actualProductStatus: verificationProduct?.productstatus,
              },
            },
            "Product quantity and status updated successfully"
          );

          updateResults.push({
            productId,
            productName: product.name,
            success: true,
            quantityUpdate: {
              requestedQuantity,
              oldOrderedQuantity: currentOrderedQuantity,
              newOrderedQuantity,
              oldAvailableQuantity: currentAvailableQuantity,
              newAvailableQuantity,
              newProductStatus,
            },
            verification: {
              actualOrderedQuantity: verificationProduct?.orderedquantity,
              actualAvailableQuantity: verificationProduct?.availablequantity,
              actualProductStatus: verificationProduct?.productstatus,
            },
          });
        } catch (productError: any) {
          logger.error(
            {
              productId: orderItem?.productid,
              orderId: orderData.id,
              error: productError.message,
              stack: productError.stack,
              orderItem: orderItem,
            },
            "Error updating product quantity"
          );

          updateResults.push({
            productId: orderItem?.productid,
            success: false,
            error: productError.message,
          });
        }
      }

      const successfulUpdates = updateResults.filter((r) => r.success);
      const failedUpdates = updateResults.filter((r) => !r.success);

      logger.info(
        {
          orderId: orderData.id,
          mode: mode,
          totalProducts: originalOrderItems.length,
          successfulUpdates: successfulUpdates.length,
          failedUpdates: failedUpdates.length,
          updateResults: updateResults.map((r) => ({
            productId: r.productId,
            success: r.success,
            error: r.error,
          })),
        },
        "Product quantity update process completed"
      );

      return {
        success: successfulUpdates.length > 0,
        totalProducts: originalOrderItems.length,
        successfulUpdates: successfulUpdates.length,
        failedUpdates: failedUpdates.length,
        updateResults,
      };
    } catch (error: any) {
      logger.error(
        {
          orderId: orderData.id,
          mode: mode,
          error: error.message,
          stack: error.stack,
        },
        "Error in product quantity update process"
      );

      throw error;
    }
  }
}
