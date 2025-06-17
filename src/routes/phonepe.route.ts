import { FastifyInstance } from 'fastify';
import { PhonePeController } from '../controllers/phonepe.controller.js';

export async function phonePeRoutes(fastify: FastifyInstance) {
  const phonePeController = new PhonePeController();

  // Payment initiation endpoint
  fastify.post('/initiate', {
    schema: {
      description: 'Initiate payment with PhonePe',
      tags: ['PhonePe Payment'],
      summary: 'Start a payment transaction with PhonePe gateway',
      body: {
        type: 'object',
        properties: {
          order: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                addressid: { type: 'number', minimum: 1, description: 'Address ID' },
                cartId: { type: 'number', minimum: 1, description: 'Cart ID' },
                discountamount: { type: 'number', minimum: 0, description: 'Discount amount' },
                orderamount: { type: 'number', minimum: 0.01, description: 'Order amount' },
                productamount: { type: 'number', minimum: 0.01, description: 'Product amount' },
                productcategory: { type: 'string', minLength: 1, description: 'Product category' },
                productid: { type: 'number', minimum: 1, description: 'Product ID' },
                productname: { type: 'string', minLength: 1, description: 'Product name' },
                quantity: { type: 'string', minLength: 1, description: 'Quantity as string' },
                userid: { type: 'string', minLength: 1, description: 'User ID as string' }
              },
              required: ['addressid', 'cartId', 'discountamount', 'orderamount', 'productamount', 'productcategory', 'productid', 'productname', 'quantity', 'userid'],
              additionalProperties: false
            },
            minItems: 1,
            description: 'Array of order items'
          },
          transaction: {
            type: 'object',
            properties: {
              amount: { 
                type: 'number', 
                minimum: 0.01,
                maximum: 100000,
                description: 'Transaction amount in INR'
              },
              mobilenumber: { 
                type: 'string', 
                pattern: '^[1-9][0-9]{9}$',
                description: '10-digit mobile number (cannot start with 0)'
              },
              name: { 
                type: 'string', 
                minLength: 1,
                maxLength: 100,
                description: 'Customer name/email'
              },
              productid: { 
                type: 'array',
                items: { type: 'number', minimum: 1 },
                minItems: 1,
                description: 'Array of product IDs'
              },
              transactionfor: { 
                type: 'string', 
                minLength: 1,
                maxLength: 255,
                description: 'Purpose of transaction'
              },
              userId: { 
                type: 'string', 
                minLength: 1,
                description: 'User ID as string'
              }
            },
            required: ['amount', 'mobilenumber', 'name', 'productid', 'transactionfor', 'userId'],
            additionalProperties: false
          }
        },
        required: ['order', 'transaction'],
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                merchantTransactionId: { type: 'string' },
                redirectUrl: { type: 'string' },
                amount: { type: 'number' },
                status: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number', example: 400 }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number', example: 500 }
          }
        }
      }
    }
  }, phonePeController.initiatePayment);

  // Payment callback endpoint (for PhonePe redirects)
  fastify.all('/callback/:transactionId', {
    schema: {
      description: 'Handle payment callback from PhonePe',
      tags: ['PhonePe Payment'],
      summary: 'Process payment completion callback from PhonePe',
      params: {
        type: 'object',
        properties: {
          transactionId: {
            type: 'string',
            minLength: 1,
            maxLength: 500,
            description: 'Transaction ID'
          }
        },
        required: ['transactionId']
      },
      querystring: {
        type: 'object',
        properties: {
          token: { type: 'string', description: 'Optional callback token' }
        },
        additionalProperties: true
      },
      response: {
        302: {
          description: 'Redirect to success/failure page',
          type: 'object',
          properties: {
            statusCode: { type: 'number', example: 302 },
            message: { type: 'string', example: 'Redirecting...' }
          }
        },
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { transactionId } = request.params as { transactionId: string };
    
    try {
      fastify.log.info(`Payment callback received for transaction: ${transactionId}`);
      
      // Get payment status from PhonePe
      const paymentStatus = await phonePeController.phonePeService.checkPaymentStatus(transactionId);
      
      if (paymentStatus.success && paymentStatus.code === 'PAYMENT_SUCCESS') {
        fastify.log.info(`Payment successful for transaction: ${transactionId}`);
        
        // Update transaction status
        await phonePeController.updateTransactionStatus(transactionId, 'SUCCESS', paymentStatus);
        fastify.log.info(`Transaction status updated to SUCCESS for: ${transactionId}`);
        
        // Create order and orderline records
        try {
          fastify.log.info(`Calling createOrderAfterPayment for transaction: ${transactionId}`);
          const order = await phonePeController.createOrderAfterPayment(transactionId);
          fastify.log.info(`Order created successfully for transaction: ${transactionId}`, { orderId: order.id });
        } catch (orderError: any) {
          fastify.log.error(`Error creating order for transaction: ${transactionId}`, {
            error: orderError.message,
            stack: orderError.stack
          });
          // Don't fail the entire flow if order creation fails
          // The payment was successful, just log the error
        }
        
        // Redirect to success page
        return reply.redirect('http://localhost:5600/health');
      } else {
        fastify.log.warn(`Payment failed for transaction: ${transactionId}`, paymentStatus);
        
        // Update transaction status to failed
        await phonePeController.updateTransactionStatus(transactionId, 'FAILED', paymentStatus);
        
        // Redirect to failure page
        return reply.redirect('http://localhost:5600/docs#/');
      }
    } catch (error: any) {
      fastify.log.error(`Error processing payment callback for ${transactionId}:`, error);
      
      // Update transaction status to error
      await phonePeController.updateTransactionStatus(transactionId, 'ERROR', { error: error.message });
      
      // Redirect to failure page
      return reply.redirect('http://localhost:5600/docs#/');
    }
  });

  // Payment status check endpoint
  fastify.get('/status/:merchantTransactionId', {
    schema: {
      description: 'Check payment status',
      tags: ['PhonePe Payment'],
      summary: 'Get current status of a payment transaction',
      params: {
        type: 'object',
        properties: {
          merchantTransactionId: {
            type: 'string',
            minLength: 1,
            maxLength: 35,
            description: 'Merchant transaction ID'
          }
        },
        required: ['merchantTransactionId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                merchantTransaction: { type: 'string' },
                status: { type: 'string' },
                success: { type: 'boolean' },
                message: { type: 'string' },
                paymentData: { type: 'object' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number', example: 400 }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Transaction not found' },
            statusCode: { type: 'number', example: 404 }
          }
        }
      }
    }
  }, phonePeController.checkPaymentStatus);

  // Refund endpoint
  fastify.post('/refund/:merchantTransactionId', {
    schema: {
      description: 'Process payment refund',
      tags: ['PhonePe Payment'],
      summary: 'Initiate a refund for a completed payment',
      params: {
        type: 'object',
        properties: {
          merchantTransactionId: {
            type: 'string',
            minLength: 1,
            maxLength: 35,
            description: 'Merchant transaction ID'
          }
        },
        required: ['merchantTransactionId']
      },
      body: {
        type: 'object',
        properties: {
          refundAmount: {
            type: 'number',
            minimum: 0.01,
            maximum: 100000,
            description: 'Refund amount in INR (optional, defaults to full amount)'
          },
          reason: {
            type: 'string',
            minLength: 1,
            maxLength: 500,
            description: 'Reason for refund'
          }
        },
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                merchantTransaction: { type: 'string' },
                refundId: { type: 'string' },
                refundAmount: { type: 'number' },
                reason: { type: 'string' },
                status: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number', example: 400 }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Transaction not found' },
            statusCode: { type: 'number', example: 404 }
          }
        }
      }
    }
  }, phonePeController.processRefund);

  // User transaction history endpoint
  fastify.get('/user/:userId/transactions', {
    schema: {
      description: 'Get user transaction history',
      tags: ['PhonePe Payment'],
      summary: 'Retrieve paginated transaction history for a user',
      params: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            pattern: '^[0-9]+$',
            description: 'User ID (must be a positive number)'
          }
        },
        required: ['userId']
      },
      querystring: {
        type: 'object',
        properties: {
          page: {
            type: 'string',
            pattern: '^[0-9]+$',
            default: '1',
            description: 'Page number'
          },
          limit: {
            type: 'string',
            pattern: '^[0-9]+$',
            default: '10',
            description: 'Items per page (max 100)'
          }
        },
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                data: { type: 'array', items: { type: 'object' } },
                pagination: {
                  type: 'object',
                  properties: {
                    currentPage: { type: 'number' },
                    totalPages: { type: 'number' },
                    pageSize: { type: 'number' },
                    total: { type: 'number' },
                    hasNext: { type: 'boolean' },
                    hasPrev: { type: 'boolean' }
                  }
                }
              }
            },
            meta: {
              type: 'object',
              properties: {
                userId: { type: 'number' },
                page: { type: 'number' },
                limit: { type: 'number' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number', example: 400 }
          }
        }
      }
    }
  }, phonePeController.getUserTransactionHistory);

  // Transaction statistics endpoint
  fastify.get('/stats', {
    schema: {
      description: 'Get transaction statistics',
      tags: ['PhonePe Payment'],
      summary: 'Retrieve transaction statistics (optionally filtered by user)',
      querystring: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            pattern: '^[0-9]+$',
            description: 'User ID to filter statistics (optional)'
          }
        },
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                totalTransactions: { type: 'number' },
                successfulTransactions: { type: 'number' },
                failedTransactions: { type: 'number' },
                totalAmount: { type: 'number' },
                averageAmount: { type: 'number' },
                successRate: { type: 'number' }
              }
            },
            meta: {
              type: 'object',
              properties: {
                userId: { type: 'number' },
                generatedAt: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, phonePeController.getTransactionStats);

  // Webhook endpoint for PhonePe notifications
  fastify.post('/webhook', {
    schema: {
      description: 'Handle PhonePe webhook notifications',
      tags: ['PhonePe Payment'],
      summary: 'Process webhook notifications from PhonePe',
      headers: {
        type: 'object',
        properties: {
          'x-verify': { type: 'string', description: 'PhonePe signature header' }
        },
        required: ['x-verify']
      },
      body: {
        type: 'object',
        description: 'Webhook payload from PhonePe'
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Webhook processed successfully' },
            data: {
              type: 'object',
              properties: {
                received: { type: 'boolean', example: true },
                timestamp: { type: 'string' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Invalid signature' },
            statusCode: { type: 'number', example: 401 }
          }
        }
      }
    }
  }, phonePeController.handleWebhook);

  // Generate transaction ID endpoint
  fastify.get('/generate-transaction-id', {
    schema: {
      description: 'Generate a unique merchant transaction ID',
      tags: ['PhonePe Utilities'],
      summary: 'Generate a unique transaction ID for payment initiation',
      querystring: {
        type: 'object',
        properties: {
          prefix: {
            type: 'string',
            minLength: 1,
            maxLength: 10,
            pattern: '^[A-Z0-9_]+$',
            default: 'TXN',
            description: 'Prefix for transaction ID (uppercase letters, numbers, underscores only)'
          }
        },
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Transaction ID generated successfully' },
            data: {
              type: 'object',
              properties: {
                merchantTransaction: { type: 'string' },
                prefix: { type: 'string' },
                timestamp: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, phonePeController.generateTransactionId);

  // Health check endpoint
  fastify.get('/health', {
    schema: {
      description: 'PhonePe service health check',
      tags: ['PhonePe Utilities'],
      summary: 'Check the health and configuration of PhonePe service',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                service: { type: 'string' },
                status: { type: 'string' },
                timestamp: { type: 'string' },
                version: { type: 'string' },
                environment: { type: 'string' },
                configuration: {
                  type: 'object',
                  properties: {
                    merchantId: { type: 'string' },
                    saltKey: { type: 'string' },
                    baseUrl: { type: 'string' },
                    redirectUrls: {
                      type: 'object',
                      properties: {
                        success: { type: 'string' },
                        failure: { type: 'string' },
                        status: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            statusCode: { type: 'number', example: 500 }
          }
        }
      }
    }
  }, phonePeController.healthCheck);

  // Refund callback endpoint (for PhonePe refund notifications)
  fastify.all('/refund-callback/:refundId', {
    schema: {
      description: 'Handle refund callback from PhonePe',
      tags: ['PhonePe Payment'],
      summary: 'Process refund completion callback from PhonePe',
      params: {
        type: 'object',
        properties: {
          refundId: { type: 'string', description: 'Refund transaction ID' }
        },
        required: ['refundId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Refund callback processed' }
          }
        }
      }
    }
  }, async (request, reply) => {
    // Basic refund callback handler
    const { refundId } = request.params as { refundId: string };
    
    // Log the refund callback
    fastify.log.info({
      refundId,
      body: request.body,
      query: request.query
    }, 'Refund callback received');

    // You can add additional refund processing logic here
    // For example, updating order status, sending notifications, etc.

    return reply.code(200).send({
      success: true,
      message: 'Refund callback processed successfully',
      data: {
        refundId,
        timestamp: new Date().toISOString()
      }
    });
  });

  // Bulk transaction status check endpoint
  fastify.post('/bulk-status', {
    schema: {
      description: 'Check status of multiple transactions',
      tags: ['PhonePe Payment'],
      summary: 'Get status of multiple payment transactions in one request',
      body: {
        type: 'object',
        properties: {
          merchantTransactionIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            maxItems: 20,
            description: 'Array of merchant transaction IDs (max 20)'
          }
        },
        required: ['merchantTransactionIds']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  merchantTransaction: { type: 'string' },
                  status: { type: 'string' },
                  success: { type: 'boolean' },
                  error: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { merchantTransactionIds } = request.body as { merchantTransactionIds: string[] };
    
    const results = await Promise.allSettled(
      merchantTransactionIds.map(async (id) => {
        try {
          const status = await phonePeController.phonePeService.checkPaymentStatus(id);
          return {
            merchantTransaction: id,
            status: status.code,
            success: status.success,
            data: status.data
          };
        } catch (error: any) {
          return {
            merchantTransaction: id,
            status: 'ERROR',
            success: false,
            error: error.message
          };
        }
      })
    );

    const data = results.map((result, index) => ({
      ...(result.status === 'fulfilled' ? result.value : {
        merchantTransaction: merchantTransactionIds[index],
        status: 'ERROR',
        success: false,
        error: result.reason?.message || 'Unknown error'
      })
    }));

    return reply.code(200).send({
      success: true,
      message: 'Bulk status check completed',
      data,
      meta: {
        totalRequested: merchantTransactionIds.length,
        timestamp: new Date().toISOString()
      }
    });
  });
} 