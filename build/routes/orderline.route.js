import { OrderlineController } from '../controllers/orderline.controller.js';
export async function orderlineRoutes(fastify) {
    const orderlineController = new OrderlineController();
    // GET /v1/orderlines - Get all orderlines with pagination and filtering
    fastify.get('/', {
        schema: {
            description: 'Get all orderlines with pagination and filtering',
            tags: ['Orderlines'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                    // Actual database fields for filtering
                    orderid: { type: 'string', description: 'Filter by order ID' },
                    productid: { type: 'string', description: 'Filter by product ID' },
                    userid: { type: 'string', description: 'Filter by user ID' },
                    addressid: { type: 'string', description: 'Filter by address ID' },
                    productname: { type: 'string', description: 'Filter by product name' },
                    productcategory: { type: 'string', description: 'Filter by product category' },
                    productcolour: { type: 'string', description: 'Filter by product colour' },
                    orderstatus: { type: 'string', description: 'Filter by order status' },
                    uniqueordderid: { type: 'string', description: 'Filter by unique order ID' },
                    orderlinenumber: { type: 'string', description: 'Filter by orderline number' },
                    deliveryfrom: { type: 'string', description: 'Filter by delivery from location' },
                    location: { type: 'string', description: 'Filter by location' },
                    merchanttransactionid: { type: 'string', description: 'Filter by merchant transaction ID' },
                    quantity: { type: 'string', description: 'Filter by quantity' },
                    productamount: { type: 'string', description: 'Filter by product amount' },
                    orderamount: { type: 'string', description: 'Filter by order amount' },
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
                                    id: { type: 'number', description: 'Orderline ID' },
                                    orderid: { type: 'number', nullable: true, description: 'Order ID' },
                                    productid: { type: 'number', nullable: true, description: 'Product ID' },
                                    userid: { type: 'number', nullable: true, description: 'User ID' },
                                    addressid: { type: 'number', nullable: true, description: 'Address ID' },
                                    productamount: { type: 'number', nullable: true, description: 'Product amount' },
                                    discountamount: { type: 'number', nullable: true, description: 'Discount amount' },
                                    orderamount: { type: 'number', nullable: true, description: 'Order amount' },
                                    quantity: { type: 'number', nullable: true, description: 'Quantity' },
                                    merchanttransactionid: { type: 'string', nullable: true, description: 'Merchant transaction ID' },
                                    productname: { type: 'string', nullable: true, description: 'Product name' },
                                    productcategory: { type: 'string', nullable: true, description: 'Product category' },
                                    productcolour: { type: 'string', nullable: true, description: 'Product colour' },
                                    readytodispatchdate: { type: 'number', nullable: true, description: 'Ready to dispatch date' },
                                    delivereddate: { type: 'number', nullable: true, description: 'Delivered date' },
                                    cancelleddate: { type: 'number', nullable: true, description: 'Cancelled date' },
                                    returneddate: { type: 'number', nullable: true, description: 'Returned date' },
                                    orderstatus: { type: 'string', nullable: true, description: 'Order status' },
                                    uniqueordderid: { type: 'string', nullable: true, description: 'Unique order ID' },
                                    orderlinenumber: { type: 'string', nullable: true, description: 'Orderline number' },
                                    deliveryfrom: { type: 'string', nullable: true, description: 'Delivery from location' },
                                    location: { type: 'string', nullable: true, description: 'Location' },
                                    dispatcheddate: { type: 'number', nullable: true, description: 'Dispatched date' },
                                    ordereddate: { type: 'number', nullable: true, description: 'Ordered date' },
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
    }, orderlineController.getOrderlines.bind(orderlineController));
    // GET /v1/orderlines/:id - Get orderline by ID
    fastify.get('/:id', {
        schema: {
            description: 'Get orderline by ID',
            tags: ['Orderlines'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Orderline ID' },
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
                                id: { type: 'number', description: 'Orderline ID' },
                                orderid: { type: 'number', nullable: true, description: 'Order ID' },
                                productid: { type: 'number', nullable: true, description: 'Product ID' },
                                userid: { type: 'number', nullable: true, description: 'User ID' },
                                addressid: { type: 'number', nullable: true, description: 'Address ID' },
                                productamount: { type: 'number', nullable: true, description: 'Product amount' },
                                discountamount: { type: 'number', nullable: true, description: 'Discount amount' },
                                orderamount: { type: 'number', nullable: true, description: 'Order amount' },
                                quantity: { type: 'number', nullable: true, description: 'Quantity' },
                                merchanttransactionid: { type: 'string', nullable: true, description: 'Merchant transaction ID' },
                                productname: { type: 'string', nullable: true, description: 'Product name' },
                                productcategory: { type: 'string', nullable: true, description: 'Product category' },
                                productcolour: { type: 'string', nullable: true, description: 'Product colour' },
                                readytodispatchdate: { type: 'number', nullable: true, description: 'Ready to dispatch date' },
                                delivereddate: { type: 'number', nullable: true, description: 'Delivered date' },
                                cancelleddate: { type: 'number', nullable: true, description: 'Cancelled date' },
                                returneddate: { type: 'number', nullable: true, description: 'Returned date' },
                                orderstatus: { type: 'string', nullable: true, description: 'Order status' },
                                uniqueordderid: { type: 'string', nullable: true, description: 'Unique order ID' },
                                orderlinenumber: { type: 'string', nullable: true, description: 'Orderline number' },
                                deliveryfrom: { type: 'string', nullable: true, description: 'Delivery from location' },
                                location: { type: 'string', nullable: true, description: 'Location' },
                                dispatcheddate: { type: 'number', nullable: true, description: 'Dispatched date' },
                                ordereddate: { type: 'number', nullable: true, description: 'Ordered date' },
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
    }, orderlineController.getOrderline.bind(orderlineController));
    // GET /v1/orderlines/orderlinenumber/:orderlinenumber - Get orderline by orderline number
    fastify.get('/orderlinenumber/:orderlinenumber', {
        schema: {
            description: 'Get orderline by orderline number',
            tags: ['Orderlines'],
            params: {
                type: 'object',
                properties: {
                    orderlinenumber: { type: 'string', description: 'Orderline number' },
                },
                required: ['orderlinenumber'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in orderline object
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
    }, orderlineController.getOrderlineByOrderlineNumber.bind(orderlineController));
    // GET /v1/orderlines/order/:orderid - Get orderlines by order ID
    fastify.get('/order/:orderid', {
        schema: {
            description: 'Get all orderlines for a specific order',
            tags: ['Orderlines'],
            params: {
                type: 'object',
                properties: {
                    orderid: { type: 'string', description: 'Order ID' },
                },
                required: ['orderid'],
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
                                additionalProperties: true // Allow any fields in orderline objects
                            }
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
    }, orderlineController.getOrderlinesByOrderId.bind(orderlineController));
    // POST /v1/orderlines - Create new orderline
    fastify.post('/', {
        schema: {
            description: 'Create a new orderline',
            tags: ['Orderlines'],
            body: {
                type: 'object',
                properties: {
                    orderid: { type: 'number', description: 'Order ID' },
                    productid: { type: 'number', description: 'Product ID' },
                    userid: { type: 'number', description: 'User ID' },
                    addressid: { type: 'number', description: 'Address ID' },
                    productamount: { type: 'number', description: 'Product amount' },
                    discountamount: { type: 'number', description: 'Discount amount' },
                    orderamount: { type: 'number', description: 'Order amount' },
                    quantity: { type: 'number', description: 'Quantity' },
                    merchanttransactionid: { type: 'string', maxLength: 250, description: 'Merchant transaction ID' },
                    productname: { type: 'string', maxLength: 500, description: 'Product name' },
                    productcategory: { type: 'string', maxLength: 500, description: 'Product category' },
                    productcolour: { type: 'string', maxLength: 500, description: 'Product colour' },
                    readytodispatchdate: { type: 'number', description: 'Ready to dispatch date (timestamp)' },
                    delivereddate: { type: 'number', description: 'Delivered date (timestamp)' },
                    cancelleddate: { type: 'number', description: 'Cancelled date (timestamp)' },
                    returneddate: { type: 'number', description: 'Returned date (timestamp)' },
                    orderstatus: { type: 'string', maxLength: 500, description: 'Order status' },
                    uniqueordderid: { type: 'string', maxLength: 500, description: 'Unique order ID' },
                    orderlinenumber: { type: 'string', maxLength: 500, description: 'Orderline number' },
                    deliveryfrom: { type: 'string', maxLength: 500, description: 'Delivery from location' },
                    location: { type: 'string', maxLength: 500, description: 'Location' },
                    dispatcheddate: { type: 'number', description: 'Dispatched date (timestamp)' },
                    ordereddate: { type: 'number', description: 'Ordered date (timestamp)' },
                    paymentfaileddate: { type: 'number', description: 'Payment failed date (timestamp)' },
                    createddate: { type: 'number', description: 'Created date (timestamp)' },
                    modifieddate: { type: 'number', description: 'Modified date (timestamp)' }
                },
                additionalProperties: true, // Allow any additional fields
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in orderline object
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
    }, orderlineController.createOrderline.bind(orderlineController));
    // PUT /v1/orderlines/:id - Update orderline
    fastify.put('/:id', {
        schema: {
            description: 'Update an existing orderline',
            tags: ['Orderlines'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Orderline ID' },
                },
                required: ['id'],
            },
            body: {
                type: 'object',
                properties: {
                    orderid: { type: 'number', description: 'Order ID' },
                    productid: { type: 'number', description: 'Product ID' },
                    userid: { type: 'number', description: 'User ID' },
                    addressid: { type: 'number', description: 'Address ID' },
                    productamount: { type: 'number', description: 'Product amount' },
                    discountamount: { type: 'number', description: 'Discount amount' },
                    orderamount: { type: 'number', description: 'Order amount' },
                    quantity: { type: 'number', description: 'Quantity' },
                    merchanttransactionid: { type: 'string', maxLength: 250, description: 'Merchant transaction ID' },
                    productname: { type: 'string', maxLength: 500, description: 'Product name' },
                    productcategory: { type: 'string', maxLength: 500, description: 'Product category' },
                    productcolour: { type: 'string', maxLength: 500, description: 'Product colour' },
                    readytodispatchdate: { type: 'number', description: 'Ready to dispatch date (timestamp)' },
                    delivereddate: { type: 'number', description: 'Delivered date (timestamp)' },
                    cancelleddate: { type: 'number', description: 'Cancelled date (timestamp)' },
                    returneddate: { type: 'number', description: 'Returned date (timestamp)' },
                    orderstatus: { type: 'string', maxLength: 500, description: 'Order status' },
                    uniqueordderid: { type: 'string', maxLength: 500, description: 'Unique order ID' },
                    orderlinenumber: { type: 'string', maxLength: 500, description: 'Orderline number' },
                    deliveryfrom: { type: 'string', maxLength: 500, description: 'Delivery from location' },
                    location: { type: 'string', maxLength: 500, description: 'Location' },
                    dispatcheddate: { type: 'number', description: 'Dispatched date (timestamp)' },
                    ordereddate: { type: 'number', description: 'Ordered date (timestamp)' },
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
                            additionalProperties: true // Allow any fields in orderline object
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
    }, orderlineController.updateOrderline.bind(orderlineController));
    // PATCH /v1/orderlines/:id/status - Update orderline status
    fastify.patch('/:id/status', {
        schema: {
            description: 'Update orderline status',
            tags: ['Orderlines'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Orderline ID' },
                },
                required: ['id'],
            },
            body: {
                type: 'object',
                properties: {
                    status: { type: 'string', description: 'New status (delivered, cancelled, returned, dispatched, ready_to_dispatch, payment_failed)' },
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
                            additionalProperties: true // Allow any fields in orderline object
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
    }, orderlineController.updateOrderlineStatus.bind(orderlineController));
    // PATCH /v1/orderlines/bulk-status - Bulk update orderline status
    fastify.patch('/bulk-status', {
        schema: {
            description: 'Bulk update orderline status for multiple orderlines',
            tags: ['Orderlines'],
            body: {
                type: 'object',
                properties: {
                    orderlineIds: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Array of orderline IDs to update'
                    },
                    status: { type: 'string', description: 'New status (delivered, cancelled, returned, dispatched, ready_to_dispatch, payment_failed)' },
                    additionalData: { type: 'object', description: 'Additional data to update' }
                },
                required: ['orderlineIds', 'status'],
                additionalProperties: true,
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
                                    success: { type: 'boolean' },
                                    id: { type: 'string' },
                                    data: { type: 'object', additionalProperties: true },
                                    error: { type: 'string' }
                                }
                            }
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
            },
        },
    }, orderlineController.bulkUpdateOrderlineStatus.bind(orderlineController));
    // DELETE /v1/orderlines/:id - Delete orderline
    fastify.delete('/:id', {
        schema: {
            description: 'Delete an orderline',
            tags: ['Orderlines'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Orderline ID' },
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
    }, orderlineController.deleteOrderline.bind(orderlineController));
    // POST /v1/orderlines/upsert - Upsert orderline
    fastify.post('/upsert', {
        schema: {
            description: 'Create or update an orderline',
            tags: ['Orderlines'],
            body: {
                type: 'object',
                properties: {
                    id: { type: 'number', description: 'Orderline ID (for update, omit for create)' },
                    orderid: { type: 'number', description: 'Order ID' },
                    productid: { type: 'number', description: 'Product ID' },
                    userid: { type: 'number', description: 'User ID' },
                    addressid: { type: 'number', description: 'Address ID' },
                    productamount: { type: 'number', description: 'Product amount' },
                    discountamount: { type: 'number', description: 'Discount amount' },
                    orderamount: { type: 'number', description: 'Order amount' },
                    quantity: { type: 'number', description: 'Quantity' },
                    merchanttransactionid: { type: 'string', maxLength: 250, description: 'Merchant transaction ID' },
                    productname: { type: 'string', maxLength: 500, description: 'Product name' },
                    productcategory: { type: 'string', maxLength: 500, description: 'Product category' },
                    productcolour: { type: 'string', maxLength: 500, description: 'Product colour' },
                    readytodispatchdate: { type: 'number', description: 'Ready to dispatch date (timestamp)' },
                    delivereddate: { type: 'number', description: 'Delivered date (timestamp)' },
                    cancelleddate: { type: 'number', description: 'Cancelled date (timestamp)' },
                    returneddate: { type: 'number', description: 'Returned date (timestamp)' },
                    orderstatus: { type: 'string', maxLength: 500, description: 'Order status' },
                    uniqueordderid: { type: 'string', maxLength: 500, description: 'Unique order ID' },
                    orderlinenumber: { type: 'string', maxLength: 500, description: 'Orderline number' },
                    deliveryfrom: { type: 'string', maxLength: 500, description: 'Delivery from location' },
                    location: { type: 'string', maxLength: 500, description: 'Location' },
                    dispatcheddate: { type: 'number', description: 'Dispatched date (timestamp)' },
                    ordereddate: { type: 'number', description: 'Ordered date (timestamp)' },
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
                            additionalProperties: true // Allow any fields in orderline object
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
    }, orderlineController.upsertOrderline.bind(orderlineController));
}
//# sourceMappingURL=orderline.route.js.map