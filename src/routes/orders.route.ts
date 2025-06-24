import { FastifyInstance } from 'fastify';
import { OrdersController } from '../controllers/orders.controller.js';

export async function ordersRoutes(fastify: FastifyInstance) {
  const ordersController = new OrdersController();

  // GET /v1/orders - Get all orders with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all orders with pagination and filtering',
      tags: ['Orders'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          // Actual database fields for filtering
          userid: { type: 'string', description: 'Filter by user ID' },
          addressid: { type: 'string', description: 'Filter by address ID' },
          orderid: { type: 'string', description: 'Filter by order ID' },
          orderstatus: { type: 'string', description: 'Filter by order status' },
          transactionid: { type: 'string', description: 'Filter by transaction ID' },
          merchanttransactionid: { type: 'string', description: 'Filter by merchant transaction ID' },
          deliveryfrom: { type: 'string', description: 'Filter by delivery from location' },
          ispaymentsucceed: { type: 'string', description: 'Filter by payment success status' },
          quantity: { type: 'string', description: 'Filter by quantity' },
          orderamount: { type: 'string', description: 'Filter by order amount' },
          productamount: { type: 'string', description: 'Filter by product amount' },
          discountamount: { type: 'string', description: 'Filter by discount amount' }
        },
        additionalProperties: true, // Allow any query parameters for dynamic filtering
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number', description: 'Order ID' },
                  userid: { type: 'number', nullable: true, description: 'User ID' },
                  addressid: { type: 'number', nullable: true, description: 'Address ID' },
                  orderamount: { type: 'number', nullable: true, description: 'Order amount' },
                  orderid: { type: 'string', nullable: true, description: 'Order ID string' },
                  orderstatus: { type: 'string', nullable: true, description: 'Order status' },
                  quantity: { type: 'number', nullable: true, description: 'Quantity' },
                  transactionid: { type: 'string', nullable: true, description: 'Transaction ID' },
                  readytodispatchdate: { type: 'number', nullable: true, description: 'Ready to dispatch date' },
                  dispatcheddate: { type: 'number', nullable: true, description: 'Dispatched date' },
                  productamount: { type: 'number', nullable: true, description: 'Product amount' },
                  discountamount: { type: 'number', nullable: true, description: 'Discount amount' },
                  deliveryfrom: { type: 'string', nullable: true, description: 'Delivery from location' },
                  orderprocessingtime: { type: 'number', nullable: true, description: 'Order processing time' },
                  ispaymentsucceed: { type: 'boolean', nullable: true, description: 'Payment success status' },
                  merchanttransactionid: { type: 'string', nullable: true, description: 'Merchant transaction ID' },
                  productid: { type: 'array', items: { type: 'number' }, nullable: true, description: 'Product IDs' },
                  delivereddate: { type: 'number', nullable: true, description: 'Delivered date' },
                  cancelleddate: { type: 'number', nullable: true, description: 'Cancelled date' },
                  returneddate: { type: 'number', nullable: true, description: 'Returned date' },
                  paymentfaileddate: { type: 'number', nullable: true, description: 'Payment failed date' },
                  createddate: { type: 'number', nullable: true, description: 'Created date' },
                  modifieddate: { type: 'number', nullable: true, description: 'Modified date' },
                },
                additionalProperties: true // Allow any additional fields
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' },
                hasNext: { type: 'boolean' },
                hasPrev: { type: 'boolean' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                filters: { type: 'array', items: { type: 'string' } },
                total: { type: 'number' },
                filtered: { type: 'boolean' },
              },
            },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
  }, ordersController.getOrders.bind(ordersController));

  // GET /v1/orders/:id - Get order by ID
  fastify.get('/:id', {
    schema: {
      description: 'Get order by ID',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              properties: {
                id: { type: 'number', description: 'Order ID' },
                userid: { type: 'number', nullable: true, description: 'User ID' },
                addressid: { type: 'number', nullable: true, description: 'Address ID' },
                orderamount: { type: 'number', nullable: true, description: 'Order amount' },
                orderid: { type: 'string', nullable: true, description: 'Order ID string' },
                orderstatus: { type: 'string', nullable: true, description: 'Order status' },
                quantity: { type: 'number', nullable: true, description: 'Quantity' },
                transactionid: { type: 'string', nullable: true, description: 'Transaction ID' },
                readytodispatchdate: { type: 'number', nullable: true, description: 'Ready to dispatch date' },
                dispatcheddate: { type: 'number', nullable: true, description: 'Dispatched date' },
                productamount: { type: 'number', nullable: true, description: 'Product amount' },
                discountamount: { type: 'number', nullable: true, description: 'Discount amount' },
                deliveryfrom: { type: 'string', nullable: true, description: 'Delivery from location' },
                orderprocessingtime: { type: 'number', nullable: true, description: 'Order processing time' },
                ispaymentsucceed: { type: 'boolean', nullable: true, description: 'Payment success status' },
                merchanttransactionid: { type: 'string', nullable: true, description: 'Merchant transaction ID' },
                productid: { type: 'array', items: { type: 'number' }, nullable: true, description: 'Product IDs' },
                delivereddate: { type: 'number', nullable: true, description: 'Delivered date' },
                cancelleddate: { type: 'number', nullable: true, description: 'Cancelled date' },
                returneddate: { type: 'number', nullable: true, description: 'Returned date' },
                paymentfaileddate: { type: 'number', nullable: true, description: 'Payment failed date' },
                createddate: { type: 'number', nullable: true, description: 'Created date' },
                modifieddate: { type: 'number', nullable: true, description: 'Modified date' },
              },
              additionalProperties: true // Allow any additional fields
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ordersController.getOrder.bind(ordersController));

  // GET /v1/orders/orderid/:orderid - Get order by order ID string
  fastify.get('/orderid/:orderid', {
    schema: {
      description: 'Get order by order ID string',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          orderid: { type: 'string', description: 'Order ID string' },
        },
        required: ['orderid'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              additionalProperties: true // Allow any fields in order object
            },
            message: { type: 'string' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ordersController.getOrderByOrderId.bind(ordersController));

  // POST /v1/orders - Create new order
  fastify.post('/', {
    schema: {
      description: 'Create a new order from single order object or cart items array',
      tags: ['Orders'],
      body: {
        oneOf: [
          {
            // Single order object
            type: 'object',
            properties: {
              userid: { type: 'number', description: 'User ID' },
              addressid: { type: 'number', description: 'Address ID' },
              orderamount: { type: 'number', description: 'Order amount' },
              orderid: { type: 'string', maxLength: 500, description: 'Order ID string' },
              orderstatus: { type: 'string', maxLength: 500, description: 'Order status' },
              quantity: { type: 'number', description: 'Quantity' },
              transactionid: { type: 'string', maxLength: 500, description: 'Transaction ID' },
              readytodispatchdate: { type: 'number', description: 'Ready to dispatch date (timestamp)' },
              dispatcheddate: { type: 'number', description: 'Dispatched date (timestamp)' },
              productamount: { type: 'number', description: 'Product amount' },
              discountamount: { type: 'number', description: 'Discount amount' },
              deliveryfrom: { type: 'string', maxLength: 200, description: 'Delivery from location' },
              orderprocessingtime: { type: 'number', description: 'Order processing time' },
              ispaymentsucceed: { type: 'boolean', description: 'Payment success status' },
              merchanttransactionid: { type: 'string', maxLength: 250, description: 'Merchant transaction ID' },
              productid: { type: 'array', items: { type: 'number' }, description: 'Product IDs' },
              delivereddate: { type: 'number', description: 'Delivered date (timestamp)' },
              cancelleddate: { type: 'number', description: 'Cancelled date (timestamp)' },
              returneddate: { type: 'number', description: 'Returned date (timestamp)' },
              paymentfaileddate: { type: 'number', description: 'Payment failed date (timestamp)' },
              createddate: { type: 'number', description: 'Created date (timestamp)' },
              modifieddate: { type: 'number', description: 'Modified date (timestamp)' }
            },
            additionalProperties: true
          },
          {
            // Cart items array
            type: 'array',
            items: {
              type: 'object',
              properties: {
                addressid: { type: 'number', description: 'Address ID' },
                cartId: { type: 'number', description: 'Cart ID' },
                discountamount: { type: 'number', description: 'Discount amount for this item' },
                orderamount: { type: 'number', description: 'Order amount for this item' },
                productamount: { type: 'number', description: 'Product amount for this item' },
                productcategory: { type: 'string', description: 'Product category' },
                productid: { type: 'number', description: 'Product ID' },
                productname: { type: 'string', description: 'Product name' },
                quantity: { type: 'number', description: 'Quantity of this product' },
                userid: { type: 'number', description: 'User ID' }
              },
              required: ['productid', 'userid', 'quantity'],
              additionalProperties: true
            },
            minItems: 1,
            description: 'Array of cart items to create order from'
          }
        ]
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              additionalProperties: true // Allow any fields in order object
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ordersController.createOrder.bind(ordersController));

  // PUT /v1/orders/:id - Update order
  fastify.put('/:id', {
    schema: {
      description: 'Update an existing order',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          userid: { type: 'number', description: 'User ID' },
          addressid: { type: 'number', description: 'Address ID' },
          orderamount: { type: 'number', description: 'Order amount' },
          orderid: { type: 'string', maxLength: 500, description: 'Order ID string' },
          orderstatus: { type: 'string', maxLength: 500, description: 'Order status' },
          quantity: { type: 'number', description: 'Quantity' },
          transactionid: { type: 'string', maxLength: 500, description: 'Transaction ID' },
          readytodispatchdate: { type: 'number', description: 'Ready to dispatch date (timestamp)' },
          dispatcheddate: { type: 'number', description: 'Dispatched date (timestamp)' },
          productamount: { type: 'number', description: 'Product amount' },
          discountamount: { type: 'number', description: 'Discount amount' },
          deliveryfrom: { type: 'string', maxLength: 200, description: 'Delivery from location' },
          orderprocessingtime: { type: 'number', description: 'Order processing time' },
          ispaymentsucceed: { type: 'boolean', description: 'Payment success status' },
          merchanttransactionid: { type: 'string', maxLength: 250, description: 'Merchant transaction ID' },
          productid: { type: 'array', items: { type: 'number' }, description: 'Product IDs' },
          delivereddate: { type: 'number', description: 'Delivered date (timestamp)' },
          cancelleddate: { type: 'number', description: 'Cancelled date (timestamp)' },
          returneddate: { type: 'number', description: 'Returned date (timestamp)' },
          paymentfaileddate: { type: 'number', description: 'Payment failed date (timestamp)' },
          modifieddate: { type: 'number', description: 'Modified date (timestamp)' }
        },
        additionalProperties: true, // Allow any additional fields
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              additionalProperties: true // Allow any fields in order object
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ordersController.updateOrder.bind(ordersController));

  // PATCH /v1/orders/:id/status - Update order status
  fastify.patch('/:id/status', {
    schema: {
      description: 'Update order status',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID' },
        },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'New status (delivered, cancelled, returned, dispatched, ready_to_dispatch, payment_failed, payment_success)' },
          additionalData: { type: 'object', description: 'Additional data to update' }
        },
        required: ['status'],
        additionalProperties: true,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              additionalProperties: true // Allow any fields in order object
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ordersController.updateOrderStatus.bind(ordersController));

  // DELETE /v1/orders/:id - Delete order
  fastify.delete('/:id', {
    schema: {
      description: 'Delete an order',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID' },
        },
        required: ['id'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'null' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ordersController.deleteOrder.bind(ordersController));

  // POST /v1/orders/upsert - Upsert order
  fastify.post('/upsert', {
    schema: {
      description: 'Create or update an order',
      tags: ['Orders'],
      body: {
        type: 'object',
        properties: {
          id: { type: 'number', description: 'Order ID (for update, omit for create)' },
          userid: { type: 'number', description: 'User ID' },
          addressid: { type: 'number', description: 'Address ID' },
          orderamount: { type: 'number', description: 'Order amount' },
          orderid: { type: 'string', maxLength: 500, description: 'Order ID string' },
          orderstatus: { type: 'string', maxLength: 500, description: 'Order status' },
          quantity: { type: 'number', description: 'Quantity' },
          transactionid: { type: 'string', maxLength: 500, description: 'Transaction ID' },
          readytodispatchdate: { type: 'number', description: 'Ready to dispatch date (timestamp)' },
          dispatcheddate: { type: 'number', description: 'Dispatched date (timestamp)' },
          productamount: { type: 'number', description: 'Product amount' },
          discountamount: { type: 'number', description: 'Discount amount' },
          deliveryfrom: { type: 'string', maxLength: 200, description: 'Delivery from location' },
          orderprocessingtime: { type: 'number', description: 'Order processing time' },
          ispaymentsucceed: { type: 'boolean', description: 'Payment success status' },
          merchanttransactionid: { type: 'string', maxLength: 250, description: 'Merchant transaction ID' },
          productid: { type: 'array', items: { type: 'number' }, description: 'Product IDs' },
          delivereddate: { type: 'number', description: 'Delivered date (timestamp)' },
          cancelleddate: { type: 'number', description: 'Cancelled date (timestamp)' },
          returneddate: { type: 'number', description: 'Returned date (timestamp)' },
          paymentfaileddate: { type: 'number', description: 'Payment failed date (timestamp)' },
          createddate: { type: 'number', description: 'Created date (timestamp)' },
          modifieddate: { type: 'number', description: 'Modified date (timestamp)' }
        },
        additionalProperties: true, // Allow any additional fields
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'object',
              additionalProperties: true // Allow any fields in order object
            },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            details: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
      },
    },
  }, ordersController.upsertOrder.bind(ordersController));
} 