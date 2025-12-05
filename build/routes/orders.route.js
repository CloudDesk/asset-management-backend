import { OrdersController } from '../controllers/orders.controller.js';
export async function ordersRoutes(fastify) {
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
    // PATCH /v1/orders/:id/ready-for-dispatch - Mark order as ready for dispatch
    fastify.patch('/:id/ready-for-dispatch', {
        schema: {
            description: 'Mark order as ready for dispatch (all products collected and box ready)',
            tags: ['Orders'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Order ID' }
                },
                required: ['id']
            },
            body: {
                type: 'object',
                required: ['inventory_user_id'],
                properties: {
                    inventory_user_id: { type: 'number', description: 'Inventory user ID who performed the action' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: { type: 'object', additionalProperties: true },
                        message: { type: 'string' }
                    }
                },
                400: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        statusCode: { type: 'number' }
                    }
                }
            }
        }
    }, ordersController.markReadyForDispatch.bind(ordersController));
    // PATCH /v1/orders/:id/mark-shipped - Mark order as shipped (after label printed)
    fastify.patch('/:id/mark-shipped', {
        schema: {
            description: 'Mark order as shipped (label printed and stuck on box)',
            tags: ['Orders'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Order ID' }
                },
                required: ['id']
            },
            body: {
                type: 'object',
                required: ['inventory_user_id'],
                properties: {
                    inventory_user_id: { type: 'number', description: 'Inventory user ID who performed the action' }
                }
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: { type: 'object', additionalProperties: true },
                        message: { type: 'string' }
                    }
                },
                400: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        statusCode: { type: 'number' }
                    }
                }
            }
        }
    }, ordersController.markShipped.bind(ordersController));
    // GET /v1/orders/:id/track - Track order by order ID (customer-facing)
    fastify.get('/:id/track', {
        schema: {
            description: 'Track order by order ID or order number (customer-facing)',
            tags: ['Orders'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Order ID (database ID) or order number (orderid)' }
                },
                required: ['id']
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
                                order_id: { type: 'number' },
                                order_number: { type: 'string' },
                                order_status: { type: 'string' },
                                tracking_id: { type: 'string', nullable: true },
                                vendor: { type: 'string', nullable: true },
                                public_tracking_link: { type: 'string', nullable: true },
                                tracking_available: { type: 'boolean' },
                                ekart_tracking: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string' },
                                        current_location: { type: 'string' },
                                        description: { type: 'string' },
                                        estimated_delivery: { type: 'string', format: 'date-time', nullable: true },
                                        status_history: { type: 'array' },
                                        ndr_status: { type: 'string', nullable: true },
                                        ndr_actions: { type: 'array', nullable: true },
                                        attempts: { type: 'number', nullable: true }
                                    }
                                }
                            }
                        }
                    }
                },
                404: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        statusCode: { type: 'number' }
                    }
                }
            }
        }
    }, ordersController.trackOrder.bind(ordersController));
}
//# sourceMappingURL=orders.route.js.map