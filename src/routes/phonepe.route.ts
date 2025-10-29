import { FastifyInstance } from "fastify";
import { PhonePeController } from "../controllers/phonepe.controller.js";
import logger from "../plugins/logger.js";

export async function phonePeRoutes(fastify: FastifyInstance) {
  const phonePeController = new PhonePeController();

  // Payment initiation endpoint
  fastify.post(
    "/initiate",
    {
      schema: {
        description: "Initiate payment with PhonePe or create COD order",
        tags: ["PhonePe Payment"],
        summary:
          "Start a payment transaction with PhonePe gateway or create Cash on Delivery order",
        body: {
          type: "object",
          properties: {
            mode: {
              type: "string",
              // enum: ['phonepe', 'cod'],
              description:
                "Payment mode: phonepe for online payment, cod for cash on delivery",
            },
            evaluation_ids: {
              type: "array",
              items: { type: "string" },
              description: "Promotion evaluation IDs array (optional)",
            },
            order: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  addressid: {
                    type: "number",
                    minimum: 1,
                    description: "Address ID from address table",
                  },
                  cartId: {
                    type: "number",
                    minimum: 1,
                    description: "Shopping cart ID",
                  },
                  discountamount: {
                    type: "number",
                    minimum: 0,
                    description: "Discount amount in INR",
                  },
                  orderamount: {
                    type: "number",
                    minimum: 0.01,
                    description: "Total order amount in INR",
                  },
                  productamount: {
                    type: "number",
                    minimum: 0.01,
                    description: "Product price in INR",
                  },
                  productcategory: {
                    type: "string",
                    minLength: 1,
                    description: "Product category",
                  },
                  productid: {
                    type: "number",
                    minimum: 1,
                    description: "Product ID from product table",
                  },
                  productname: {
                    type: "string",
                    minLength: 1,
                    description: "Product name",
                  },
                  quantity: {
                    type: "number",
                    minimum: 1,
                    description: "Quantity of product",
                  },
                  userid: {
                    type: "number",
                    minimum: 1,
                    description: "User ID from users table",
                  },
                },
                required: [
                  "addressid",
                  "cartId",
                  "discountamount",
                  "orderamount",
                  "productamount",
                  "productcategory",
                  "productid",
                  "productname",
                  "quantity",
                  "userid",
                ],
                additionalProperties: false,
              },
              minItems: 1,
              description: "Array of order items to purchase",
            },
            transaction: {
              type: "object",
              properties: {
                amount: {
                  type: "number",
                  minimum: 0.01,
                  maximum: 100000,
                  description: "Total transaction amount in INR",
                },
                mobilenumber: {
                  type: "string",
                  pattern: "^[1-9][0-9]{9}$",
                  description:
                    "10-digit Indian mobile number (cannot start with 0)",
                },
                name: {
                  type: "string",
                  minLength: 1,
                  maxLength: 100,
                  description: "Customer name or email address",
                },
                productid: {
                  type: "array",
                  items: {
                    type: "number",
                    minimum: 1,
                  },
                  minItems: 1,
                  description: "Array of product IDs being purchased",
                },
                transactionfor: {
                  type: "string",
                  minLength: 1,
                  maxLength: 255,
                  description: "Purpose of the transaction",
                  enum: ["product", "service", "subscription", "donation"],
                },
                userId: {
                  type: "number",
                  minimum: 1,
                  description: "User ID from users table",
                },
              },
              required: [
                "amount",
                "mobilenumber",
                "name",
                "productid",
                "transactionfor",
                "userId",
              ],
              additionalProperties: false,
            },
          },
          required: ["mode", "order", "transaction"],
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  // Transaction & Payment Info
                  merchantTransactionId: {
                    type: "string",
                    description: "Unique merchant transaction ID",
                  },
                  redirectUrl: {
                    type: "string",
                    nullable: true,
                    description: "PhonePe payment page URL (null for COD)",
                  },
                  amount: {
                    type: "number",
                    description: "Transaction amount in INR",
                  },
                  status: {
                    type: "string",
                    enum: ["INITIATED", "COD_ORDER_CREATED"],
                    description:
                      "Payment status - INITIATED for PhonePe, COD_ORDER_CREATED for COD",
                  },
                  mode: {
                    type: "string",
                    enum: ["phonepe", "cod"],
                    description: "Payment mode",
                  },
                  message: {
                    type: "string",
                    description: "User-friendly message",
                  },

                  // Validation Summary
                  validation_summary: {
                    type: "object",
                    description: "Summary of all validations performed",
                    properties: {
                      promotions_validated: {
                        type: "number",
                        description: "Number of promotions validated",
                      },
                      products_validated: {
                        type: "number",
                        description: "Number of products validated",
                      },
                      stock_validated: {
                        type: "number",
                        description: "Number of stock items validated",
                      },
                      all_validations_passed: {
                        type: "boolean",
                        description: "True if all validations passed",
                      },
                    },
                  },

                  // Promotion Status
                  promotion_status: {
                    type: "object",
                    description: "Promotion/coupon application status",
                    properties: {
                      valid_evaluations: {
                        type: "array",
                        items: { type: "string" },
                        description: "Array of valid promotion evaluation IDs",
                      },
                      limit_reached_evaluations: {
                        type: "array",
                        description: "Promotions that reached usage limits",
                      },
                      action_required: {
                        type: "string",
                        nullable: true,
                        description:
                          "Action required from user (e.g., apply_another_coupon)",
                      },
                      invalid_evaluations: {
                        type: "array",
                        description: "Promotions that failed validation",
                      },
                      total_applied: {
                        type: "number",
                        description: "Count of successfully applied promotions",
                      },
                      total_attempted: {
                        type: "number",
                        description: "Count of promotions attempted",
                      },
                    },
                  },

                  // Stock Locking Summary
                  stock_locking: {
                    type: "object",
                    description: "Stock reservation/locking details",
                    properties: {
                      platform: {
                        type: "string",
                        description: "Platform name (nivapp)",
                      },
                      total_products_locked: {
                        type: "number",
                        description: "Number of products successfully locked",
                      },
                      lock_status: {
                        type: "string",
                        enum: ["success", "failed"],
                        description: "Overall lock status",
                      },
                      products: {
                        type: "array",
                        description: "Per-product lock details",
                        items: {
                          type: "object",
                          properties: {
                            productId: { type: "number" },
                            productName: { type: "string" },
                            quantity_locked: { type: "number" },
                            before: {
                              type: "object",
                              properties: {
                                availableqty: { type: "number" },
                                lockqty: { type: "number" },
                              },
                            },
                            after: {
                              type: "object",
                              properties: {
                                availableqty: { type: "number" },
                                lockqty: { type: "number" },
                              },
                            },
                            note: { type: "string" },
                          },
                        },
                      },
                      message: {
                        type: "string",
                        description: "Stock locking summary message",
                      },
                    },
                  },

                  // Order Data (COD only)
                  orderData: {
                    type: "object",
                    nullable: true,
                    description:
                      "Order details (only for COD mode, null for PhonePe)",
                    properties: {
                      orderId: {
                        type: "number",
                        description: "Database order ID",
                      },
                      orderid: {
                        type: "string",
                        description: "Display order ID",
                      },
                      status: {
                        type: "string",
                        description: "Order status",
                      },
                      created_at: {
                        type: "number",
                        description: "Order creation timestamp",
                      },
                      order_created: {
                        type: "boolean",
                        description: "True if order was created",
                      },
                    },
                  },

                  // Next Steps for Frontend
                  next_steps: {
                    type: "object",
                    description: "Instructions for frontend on what to do next",
                    properties: {
                      phonepe: {
                        type: "object",
                        nullable: true,
                        description:
                          "Next steps for PhonePe mode (null for COD)",
                        properties: {
                          action: {
                            type: "string",
                            description: "Action to take (redirect_to_payment)",
                          },
                          redirectUrl: {
                            type: "string",
                            description: "URL to redirect user to",
                          },
                          instructions: {
                            type: "string",
                            description: "Human-readable instructions",
                          },
                          stock_status: {
                            type: "string",
                            description:
                              "Current stock status (locked_until_payment_complete)",
                          },
                          lock_duration: {
                            type: "string",
                            description: "How long stock will be locked",
                          },
                        },
                      },
                      cod: {
                        type: "object",
                        nullable: true,
                        description:
                          "Next steps for COD mode (null for PhonePe)",
                        properties: {
                          action: {
                            type: "string",
                            description:
                              "Action to take (show_order_confirmation)",
                          },
                          order_id: {
                            type: "number",
                            description: "Created order ID",
                          },
                          instructions: {
                            type: "string",
                            description: "Human-readable instructions",
                          },
                          stock_status: {
                            type: "string",
                            description:
                              "Current stock status (converted_to_order)",
                          },
                          lockqty_status: {
                            type: "string",
                            description: "Lock quantity status (reset_to_0)",
                          },
                        },
                      },
                    },
                  },
                },
                additionalProperties: true,
              },
            },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              details: { type: "string" },
              statusCode: { type: "number" },
            },
          },
          500: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              details: { type: "string" },
              statusCode: { type: "number" },
            },
          },
        },
      },
    },
    phonePeController.initiatePayment
  );

  // Payment callback endpoint (for PhonePe redirects) - handles both GET and POST
  fastify.all(
    "/callback/:transactionId",
    {
      schema: {
        description: "Handle payment callback from PhonePe",
        tags: ["PhonePe Payment"],
        summary: "Process payment completion callback from PhonePe",
        params: {
          type: "object",
          properties: {
            transactionId: {
              type: "string",
              minLength: 1,
              maxLength: 500,
              description: "Transaction ID",
            },
          },
          required: ["transactionId"],
        },
        querystring: {
          type: "object",
          properties: {
            token: { type: "string", description: "Optional callback token" },
          },
          additionalProperties: true,
        },
        response: {
          302: {
            description: "Redirect to success/failure page",
            type: "object",
            properties: {
              statusCode: { type: "number" },
              message: { type: "string" },
            },
          },
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: { type: "object" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { transactionId } = request.params as { transactionId: string };
      console.log(transactionId, "Payment callback received for transaction:");
      try {
        fastify.log.info(
          `Payment callback received for transaction: ${transactionId}`
        );

        // Get payment status from PhonePe
        const paymentStatus =
          await phonePeController.phonePeService.checkPaymentStatus(
            transactionId
          );

        // Enhanced logging for debugging
        fastify.log.info(
          {
            transactionId,
            paymentStatus: {
              success: paymentStatus.success,
              code: paymentStatus.code,
              message: paymentStatus.message,
              data: paymentStatus.data,
            },
          },
          "PhonePe payment status response details"
        );

        // Handle different payment status scenarios
        if (paymentStatus.success && paymentStatus.code === "PAYMENT_SUCCESS") {
          fastify.log.info(
            `Payment successful for transaction: ${transactionId}`
          );

          // Update transaction status to success first
          await phonePeController.updateTransactionStatus(
            transactionId,
            "SUCCESS",
            paymentStatus
          );
          fastify.log.info(
            `Transaction status updated to SUCCESS for: ${transactionId}`
          );

          // Create order and orderline records with improved error handling
          let orderCreationStatus = "success";
          let orderCreationError = null;
          let orderId = null;

          try {
            fastify.log.info(
              `Calling createOrderAfterPayment for transaction: ${transactionId}`
            );

            // Get evaluation IDs from transaction data for promotion redemption
            const transactions =
              await phonePeController.transactionService.findMany(
                { merchanttransactionid: transactionId },
                1,
                1
              );

            let evaluationIds: string[] = [];
            if (transactions.data && transactions.data.length > 0) {
              const transaction = transactions.data[0];
              evaluationIds = transaction.transactiondata?.evaluation_ids || [];

              fastify.log.info(
                {
                  transactionId,
                  evaluationIds,
                  evaluationCount: evaluationIds.length,
                },
                "Retrieved evaluation IDs from transaction for promotion redemption"
              );
            }

            // Force mode to "phonepe" since this is PhonePe webhook callback
            const order = await phonePeController.createOrderAfterPayment(
              transactionId,
              "phonepe",
              evaluationIds
            );
            orderId = order.id;
            fastify.log.info(
              `Order created successfully for transaction: ${transactionId}`,
              {
                orderId: order.id,
                orderIdString: order.orderid,
              }
            );

            // Update product quantities after successful order creation
            try {
              fastify.log.info(
                `Starting product quantity updates for PhonePe order: ${transactionId}`
              );

              // Get orderlines for quantity update
              const orderlines =
                await phonePeController.orderlineService.findMany(
                  { orderid: order.id },
                  1,
                  100
                );

              if (orderlines.data && orderlines.data.length > 0) {
                // Convert orderlines to the format expected by updateProductQuantitiesAfterOrder
                const orderItems = orderlines.data.map((orderline) => ({
                  productid: Number(orderline.productid),
                  quantity: orderline.quantity || 1,
                  productname: orderline.productname || null,
                }));

                // Update product quantities
                const quantityUpdateResult =
                  await phonePeController.updateProductQuantitiesAfterOrder(
                    order,
                    orderItems,
                    "phonepe"
                  );

                fastify.log.info(
                  `Product quantities updated successfully for order: ${order.id}`,
                  {
                    orderId: order.id,
                    updatedProducts:
                      quantityUpdateResult.updateResults?.length || 0,
                    results: quantityUpdateResult,
                  }
                );
              } else {
                fastify.log.warn(
                  `No orderlines found for order: ${order.id} - skipping quantity update`
                );
              }
            } catch (quantityError: any) {
              fastify.log.error(
                `Error updating product quantities for order: ${order.id}`,
                {
                  error: quantityError.message,
                  stack: quantityError.stack,
                  orderId: order.id,
                }
              );
              // Don't fail the entire callback for quantity update errors
            }
          } catch (orderError: any) {
            orderCreationStatus = "failed";
            orderCreationError = orderError.message;

            fastify.log.error(
              `Error creating order for transaction: ${transactionId}`,
              {
                error: orderError.message,
                stack: orderError.stack,
                errorType: orderError.constructor.name,
              }
            );

            // Update transaction with order creation error details
            try {
              await phonePeController.updateTransactionStatus(
                transactionId,
                "SUCCESS",
                {
                  ...paymentStatus,
                  orderCreation: {
                    status: "failed",
                    error: orderError.message,
                    timestamp: new Date().toISOString(),
                  },
                }
              );
            } catch (updateError: any) {
              fastify.log.error(
                `Failed to update transaction with order creation error for ${transactionId}`,
                {
                  updateError: updateError.message,
                }
              );
            }
          }

          // Update final transaction status with order creation results
          try {
            await phonePeController.updateTransactionStatus(
              transactionId,
              "SUCCESS",
              {
                ...paymentStatus,
                orderCreation: {
                  status: orderCreationStatus,
                  error: orderCreationError,
                  orderId: orderId,
                  timestamp: new Date().toISOString(),
                },
                paymentCompleteAt: new Date().toISOString(),
              }
            );
          } catch (finalUpdateError: any) {
            fastify.log.error(
              `Failed to update final transaction status for ${transactionId}`,
              {
                error: finalUpdateError.message,
              }
            );
          }

          // Redirect to success page regardless of order creation status
          // Payment was successful, order creation is secondary
          const successUrl = process.env.REDIRECT_URL_SUCCESS || "com.Nivaana.app://profile/orders";
          return reply.redirect(successUrl);
        } else if (paymentStatus.code === "TRANSACTION_NOT_FOUND") {
          fastify.log.warn(
            `Payment transaction not found or expired for: ${transactionId}`,
            paymentStatus
          );

          // Update transaction status to cancelled/expired
          await phonePeController.updateTransactionStatus(
            transactionId,
            "CANCELLED",
            paymentStatus
          );

          // Redirect to failure page with appropriate message
          const failureUrl = process.env.REDIRECT_URL_FAILURE || "com.Nivaana.app://profile/orders";
          return reply.redirect(failureUrl);
        } else {
          fastify.log.warn(
            `Payment failed for transaction: ${transactionId}`,
            paymentStatus
          );

          // Update transaction status to failed
          await phonePeController.updateTransactionStatus(
            transactionId,
            "FAILED",
            paymentStatus
          );

          // Redirect to failure page
          const failureUrl = process.env.REDIRECT_URL_FAILURE || "com.Nivaana.app://profile/orders";
          return reply.redirect(failureUrl);
        }
      } catch (error: any) {
        fastify.log.error(
          `Error processing payment callback for ${transactionId}:`,
          {
            error: error.message,
            stack: error.stack,
            errorType: error.constructor.name,
          }
        );

        // Update transaction status to error with detailed information
        try {
          await phonePeController.updateTransactionStatus(
            transactionId,
            "ERROR",
            {
              error: error.message,
              errorType: error.constructor.name,
              stack: error.stack,
              timestamp: new Date().toISOString(),
            }
          );
        } catch (updateError: any) {
          fastify.log.error(
            `Failed to update transaction status to ERROR for ${transactionId}`,
            {
              updateError: updateError.message,
            }
          );
        }

        // Redirect to failure page
        const failureUrl = process.env.REDIRECT_URL_FAILURE || "com.Nivaana.app://profile/orders";
        return reply.redirect(failureUrl);
      }
    }
  );

  // Payment status check endpoint
  fastify.get(
    "/status/:merchantTransactionId",
    {
      schema: {
        description: "Check payment status",
        tags: ["PhonePe Payment"],
        summary: "Get current status of a payment transaction",
        params: {
          type: "object",
          properties: {
            merchantTransactionId: {
              type: "string",
              minLength: 1,
              maxLength: 35,
              description:
                "Merchant transaction ID returned from payment initiation",
            },
          },
          required: ["merchantTransactionId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  merchantTransactionId: {
                    type: "string",
                    description: "Merchant transaction ID",
                  },
                  status: {
                    type: "string",
                    description: "Current payment status",
                    enum: [
                      "PAYMENT_INITIATED",
                      "PAYMENT_PENDING",
                      "PAYMENT_SUCCESS",
                      "PAYMENT_ERROR",
                      "PAYMENT_DECLINED",
                    ],
                  },
                  success: {
                    type: "boolean",
                    description: "Whether the payment was successful",
                  },
                  message: {
                    type: "string",
                    description: "Status message from PhonePe",
                  },
                  paymentData: {
                    type: "object",
                    description: "Complete payment response from PhonePe",
                  },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              details: { type: "string" },
              statusCode: { type: "number" },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              statusCode: { type: "number" },
            },
          },
        },
      },
    },
    phonePeController.checkPaymentStatus
  );

  // Refund endpoint
  fastify.post(
    "/refund/:merchantTransactionId",
    {
      schema: {
        description: "Process payment refund",
        tags: ["PhonePe Payment"],
        summary: "Initiate a refund for a completed payment",
        params: {
          type: "object",
          properties: {
            merchantTransactionId: {
              type: "string",
              minLength: 1,
              maxLength: 35,
              description: "Merchant transaction ID of the original payment",
            },
          },
          required: ["merchantTransactionId"],
        },
        body: {
          type: "object",
          properties: {
            refundAmount: {
              type: "number",
              minimum: 0.01,
              maximum: 100000,
              description:
                "Refund amount in INR (optional, defaults to full amount)",
            },
            reason: {
              type: "string",
              minLength: 1,
              maxLength: 500,
              description: "Reason for refund",
            },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  merchantTransactionId: {
                    type: "string",
                    description: "Original transaction ID",
                  },
                  refundId: {
                    type: "string",
                    description: "Unique refund transaction ID",
                  },
                  refundAmount: {
                    type: "number",
                    description: "Refund amount in INR",
                  },
                  reason: {
                    type: "string",
                    description: "Refund reason",
                  },
                  status: {
                    type: "string",
                    description: "Refund status",
                  },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              details: { type: "string" },
              statusCode: { type: "number" },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              statusCode: { type: "number" },
            },
          },
        },
      },
    },
    phonePeController.processRefund
  );

  // User transaction history endpoint
  fastify.get(
    "/user/:userId/transactions",
    {
      schema: {
        description: "Get user transaction history",
        tags: ["PhonePe Payment"],
        summary: "Retrieve paginated transaction history for a user",
        params: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              pattern: "^[0-9]+$",
              description: "User ID (must be a positive number)",
            },
          },
          required: ["userId"],
        },
        querystring: {
          type: "object",
          properties: {
            page: {
              type: "string",
              pattern: "^[0-9]+$",
              default: "1",
              description: "Page number for pagination",
            },
            limit: {
              type: "string",
              pattern: "^[0-9]+$",
              default: "10",
              description: "Number of items per page (max 100)",
            },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  data: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "number" },
                        merchanttransactionid: { type: "string" },
                        amount: { type: "number" },
                        status: { type: "string" },
                        createddate: { type: "number" },
                        productid: { type: "array", items: { type: "number" } },
                        transactionfor: { type: "string" },
                      },
                    },
                    description: "Array of user transactions",
                  },
                  pagination: {
                    type: "object",
                    properties: {
                      currentPage: {
                        type: "number",
                        description: "Current page number",
                      },
                      totalPages: {
                        type: "number",
                        description: "Total number of pages",
                      },
                      pageSize: {
                        type: "number",
                        description: "Items per page",
                      },
                      total: {
                        type: "number",
                        description: "Total number of transactions",
                      },
                      hasNext: {
                        type: "boolean",
                        description: "Whether next page exists",
                      },
                      hasPrev: {
                        type: "boolean",
                        description: "Whether previous page exists",
                      },
                    },
                  },
                },
              },
              meta: {
                type: "object",
                properties: {
                  userId: { type: "number", description: "User ID" },
                  page: { type: "number", description: "Requested page" },
                  limit: { type: "number", description: "Requested limit" },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              details: { type: "string" },
              statusCode: { type: "number" },
            },
          },
        },
      },
    },
    phonePeController.getUserTransactionHistory
  );

  // Transaction statistics endpoint
  fastify.get(
    "/stats",
    {
      schema: {
        description: "Get transaction statistics",
        tags: ["PhonePe Payment"],
        summary:
          "Retrieve transaction statistics (optionally filtered by user)",
        querystring: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              pattern: "^[0-9]+$",
              description: "User ID to filter statistics (optional)",
            },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  totalTransactions: {
                    type: "number",
                    description: "Total number of transactions",
                  },
                  successfulTransactions: {
                    type: "number",
                    description: "Number of successful transactions",
                  },
                  failedTransactions: {
                    type: "number",
                    description: "Number of failed transactions",
                  },
                  totalAmount: {
                    type: "number",
                    description: "Total transaction amount in INR",
                  },
                  averageAmount: {
                    type: "number",
                    description: "Average transaction amount in INR",
                  },
                  successRate: {
                    type: "number",
                    description: "Success rate percentage",
                  },
                },
              },
              meta: {
                type: "object",
                properties: {
                  userId: {
                    type: "number",
                    description: "User ID (if filtered)",
                  },
                  generatedAt: {
                    type: "string",
                    description: "Statistics generation timestamp",
                  },
                },
              },
            },
          },
        },
      },
    },
    phonePeController.getTransactionStats
  );

  // Webhook endpoint for PhonePe notifications
  fastify.post(
    "/webhook",
    {
      schema: {
        description: "Handle PhonePe webhook notifications",
        tags: ["PhonePe Payment"],
        summary: "Process webhook notifications from PhonePe",
        headers: {
          type: "object",
          properties: {
            "x-verify": {
              type: "string",
              description: "PhonePe signature header for webhook verification",
            },
          },
          required: ["x-verify"],
        },
        body: {
          type: "object",
          description: "Webhook payload from PhonePe",
          properties: {
            merchantId: {
              type: "string",
              description: "Merchant ID",
            },
            merchantTransactionId: {
              type: "string",
              description: "Merchant transaction ID",
            },
            transactionId: {
              type: "string",
              description: "PhonePe transaction ID",
            },
            amount: {
              type: "number",
              description: "Transaction amount in paise",
            },
            state: {
              type: "string",
              description: "Transaction state",
            },
            responseCode: {
              type: "string",
              description: "Response code",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  received: {
                    type: "boolean",
                    description: "Webhook received status",
                  },
                  timestamp: {
                    type: "string",
                    description: "Processing timestamp",
                  },
                },
              },
            },
          },
          401: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              statusCode: { type: "number" },
            },
          },
        },
      },
    },
    phonePeController.handleWebhook
  );

  // Create SDK Order endpoint (for mobile app integration)
  fastify.post(
    "/create-sdk-order",
    {
      schema: {
        description: "Create SDK order for mobile app integration",
        tags: ["PhonePe Payment"],
        summary: "Generate order token for mobile SDK payment",
        body: {
          type: "object",
          required: ["merchantOrderId", "amount", "redirectUrl"],
          properties: {
            merchantOrderId: {
              type: "string",
              minLength: 1,
              maxLength: 100,
              description: "Unique merchant order ID",
            },
            amount: {
              type: "number",
              minimum: 1,
              description: "Order amount in rupees",
            },
            redirectUrl: {
              type: "string",
              format: "uri",
              description: "Redirect URL after payment completion",
            },
            userId: {
              type: "number",
              description: "User ID (optional)",
            },
            productIds: {
              type: "array",
              items: { type: "number" },
              description: "Array of product IDs (optional)",
            },
            transactionFor: {
              type: "string",
              description: "Transaction purpose (optional)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  orderToken: { type: "string" },
                  orderId: { type: "string" },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              error: { type: "string" },
            },
          },
        },
      },
    },
    phonePeController.createSdkOrder
  );

  // Check refund status endpoint
  fastify.get(
    "/refund-status/:refundId",
    {
      schema: {
        description: "Check refund status using SDK",
        tags: ["PhonePe Payment"],
        summary: "Get current status of a refund transaction",
        params: {
          type: "object",
          properties: {
            refundId: {
              type: "string",
              minLength: 1,
              maxLength: 100,
              description: "Refund ID to check status for",
            },
          },
          required: ["refundId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  refundId: { type: "string" },
                  state: { type: "string" },
                  amount: { type: "number" },
                  errorCode: { type: "string" },
                  errorMessage: { type: "string" },
                },
              },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    phonePeController.checkRefundStatus
  );

  // Generate transaction ID endpoint
  fastify.get(
    "/generate-transaction-id",
    {
      schema: {
        description: "Generate a unique merchant transaction ID",
        tags: ["PhonePe Utilities"],
        summary: "Generate a unique transaction ID for payment initiation",
        querystring: {
          type: "object",
          properties: {
            prefix: {
              type: "string",
              minLength: 1,
              maxLength: 10,
              pattern: "^[A-Z0-9_]+$",
              default: "TXN",
              description:
                "Prefix for transaction ID (uppercase letters, numbers, underscores only)",
            },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  merchantTransactionId: {
                    type: "string",
                    description: "Generated unique transaction ID",
                  },
                  prefix: {
                    type: "string",
                    description: "Used prefix",
                  },
                  timestamp: {
                    type: "number",
                    description: "Generation timestamp",
                  },
                },
              },
            },
          },
        },
      },
    },
    phonePeController.generateTransactionId
  );

  // Health check endpoint
  fastify.get(
    "/health",
    {
      schema: {
        description: "PhonePe service health check",
        tags: ["PhonePe Utilities"],
        summary: "Check the health and configuration of PhonePe service",
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  service: {
                    type: "string",
                    description: "Service name",
                  },
                  status: {
                    type: "string",
                    description: "Service status",
                  },
                  timestamp: {
                    type: "string",
                    description: "Health check timestamp",
                  },
                  version: {
                    type: "string",
                    description: "Service version",
                  },
                  environment: {
                    type: "string",
                    description: "Current environment",
                  },
                  configuration: {
                    type: "object",
                    properties: {
                      merchantId: {
                        type: "string",
                        description: "Merchant ID configuration status",
                      },
                      saltKey: {
                        type: "string",
                        description: "Salt key configuration status",
                      },
                      baseUrl: {
                        type: "string",
                        description: "PhonePe API base URL",
                      },
                      redirectUrls: {
                        type: "object",
                        properties: {
                          success: {
                            type: "string",
                            description: "Success redirect URL",
                          },
                          failure: {
                            type: "string",
                            description: "Failure redirect URL",
                          },
                          status: {
                            type: "string",
                            description: "Status check URL",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          500: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              statusCode: { type: "number" },
            },
          },
        },
      },
    },
    phonePeController.healthCheck
  );

  // Refund callback endpoint (for PhonePe refund notifications)
  fastify.all(
    "/refund-callback/:refundId",
    {
      schema: {
        description: "Handle refund callback from PhonePe",
        tags: ["PhonePe Payment"],
        summary: "Process refund completion callback from PhonePe",
        params: {
          type: "object",
          properties: {
            refundId: { type: "string", description: "Refund transaction ID" },
          },
          required: ["refundId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      // Basic refund callback handler
      const { refundId } = request.params as { refundId: string };

      // Log the refund callback
      fastify.log.info(
        {
          refundId,
          body: request.body,
          query: request.query,
        },
        "Refund callback received"
      );

      // You can add additional refund processing logic here
      // For example, updating order status, sending notifications, etc.

      return reply.code(200).send({
        success: true,
        message: "Refund callback processed successfully",
        data: {
          refundId,
          timestamp: new Date().toISOString(),
        },
      });
    }
  );

  // Bulk transaction status check endpoint
  fastify.post(
    "/bulk-status",
    {
      schema: {
        description: "Check status of multiple transactions",
        tags: ["PhonePe Payment"],
        summary: "Get status of multiple payment transactions in one request",
        body: {
          type: "object",
          properties: {
            merchantTransactionIds: {
              type: "array",
              items: {
                type: "string",
              },
              minItems: 1,
              maxItems: 20,
              description: "Array of merchant transaction IDs (max 20)",
            },
          },
          required: ["merchantTransactionIds"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    merchantTransactionId: {
                      type: "string",
                      description: "Merchant transaction ID",
                    },
                    status: {
                      type: "string",
                      description: "Transaction status",
                    },
                    success: {
                      type: "boolean",
                      description: "Whether the transaction was successful",
                    },
                    error: {
                      type: "string",
                      description: "Error message if any",
                    },
                  },
                },
              },
              meta: {
                type: "object",
                properties: {
                  totalRequested: {
                    type: "number",
                    description: "Total number of transactions requested",
                  },
                  timestamp: {
                    type: "string",
                    description: "Bulk check timestamp",
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { merchantTransactionIds } = request.body as {
        merchantTransactionIds: string[];
      };

      const results = await Promise.allSettled(
        merchantTransactionIds.map(async (id) => {
          try {
            const status =
              await phonePeController.phonePeService.checkPaymentStatus(id);
            return {
              merchantTransaction: id,
              status: status.code,
              success: status.success,
              data: status.data,
            };
          } catch (error: any) {
            return {
              merchantTransaction: id,
              status: "ERROR",
              success: false,
              error: error.message,
            };
          }
        })
      );

      const data = results.map((result, index) => ({
        ...(result.status === "fulfilled"
          ? result.value
          : {
              merchantTransaction: merchantTransactionIds[index],
              status: "ERROR",
              success: false,
              error: result.reason?.message || "Unknown error",
            }),
      }));

      return reply.code(200).send({
        success: true,
        message: "Bulk status check completed",
        data,
        meta: {
          totalRequested: merchantTransactionIds.length,
          timestamp: new Date().toISOString(),
        },
      });
    }
  );

  // Manual product quantity update endpoint
  fastify.post(
    "/orders/:orderId/update-quantities",
    {
      schema: {
        description: "Manually update product quantities for an existing order",
        tags: ["PhonePe Payment"],
        summary:
          "Update product quantities for an order (useful for fixing failed quantity updates)",
        params: {
          type: "object",
          properties: {
            orderId: {
              type: "string",
              minLength: 1,
              description: "Order ID to update quantities for",
            },
          },
          required: ["orderId"],
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: {
                type: "object",
                properties: {
                  orderId: { type: "number" },
                  orderlines: { type: "number" },
                  quantityUpdateResult: { type: "object" },
                },
              },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              error: { type: "string" },
            },
          },
          500: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { orderId } = request.params as { orderId: Number };

      // logger.info({ orderId }, 'Manual quantity update request received');

      try {
        const result = await phonePeController.updateOrderQuantities(
          request,
          reply
        );
        return result;
      } catch (error: any) {
        // logger.error({
        //   error: error.message,
        //   orderId
        // }, 'Error in manual quantity update route');

        return reply.code(500).send({
          success: false,
          message: "Failed to update product quantities",
          error: error.message,
        });
      }
    }
  );

  // ========================================
  // GCP Cloud Task Endpoint - Lock Cleanup
  // ========================================

  /**
   * Lock cleanup endpoint (called by GCP Cloud Tasks)
   * POST /v1/phonepe/cleanup-lock
   *
   * Triggered by GCP Cloud Tasks after 15 minutes of payment initiation.
   * Checks payment status and releases locks for abandoned/failed payments.
   */
  fastify.post(
    "/cleanup-lock",
    {
      schema: {
        description: "Cleanup expired stock locks (GCP Cloud Tasks webhook)",
        tags: ["PhonePe Payment", "Internal"],
        summary: "Release locks for abandoned/failed payments",
        body: {
          type: "object",
          properties: {
            merchantTransactionId: {
              type: "string",
              description: "Merchant transaction ID to cleanup",
            },
            merchantid: {
              type: "string",
              description:
                "Legacy: Merchant transaction ID (backward compatibility)",
            },
            createdAt: {
              type: "string",
              description: "Task creation timestamp (ISO 8601)",
            },
            action: {
              type: "string",
              description: "Action type (e.g., release_expired_lock)",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: {
                type: "boolean",
                description: "Operation success status",
              },
              message: {
                type: "string",
                description: "Human-readable message",
              },
              action: {
                type: "string",
                enum: ["none", "locks_released"],
                description: "Action taken by cleanup task",
              },
              data: {
                type: "object",
                properties: {
                  merchantTransactionId: {
                    type: "string",
                    description: "Transaction ID",
                  },
                  paymentStatus: {
                    type: "string",
                    description: "Current payment status code",
                  },
                  lockStatus: {
                    type: "string",
                    description: "Lock status (for successful payments)",
                  },
                  productsProcessed: {
                    type: "number",
                    description: "Number of products processed",
                  },
                  productsReleased: {
                    type: "number",
                    description: "Number of products with locks released",
                  },
                  releaseDetails: {
                    type: "array",
                    description: "Detailed release results per product",
                    items: {
                      type: "object",
                      properties: {
                        productId: { type: "number" },
                        productName: { type: "string" },
                        status: {
                          type: "string",
                          enum: ["released", "skipped", "error"],
                        },
                        quantityReleased: { type: "number" },
                        before: {
                          type: "object",
                          properties: {
                            availableqty: { type: "number" },
                            lockqty: { type: "number" },
                          },
                        },
                        after: {
                          type: "object",
                          properties: {
                            availableqty: { type: "number" },
                            lockqty: { type: "number" },
                          },
                        },
                        reason: { type: "string" },
                        error: { type: "string" },
                      },
                    },
                  },
                  transactionStatus: {
                    type: "string",
                    description:
                      "Updated transaction status (EXPIRED if locks released)",
                  },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              error: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              error: { type: "string" },
            },
          },
          500: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              error: { type: "string" },
            },
          },
        },
      },
    },
    phonePeController.cleanupExpiredLock
  );
}
