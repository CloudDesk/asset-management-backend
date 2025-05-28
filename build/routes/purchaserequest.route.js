import { PurchaseRequestController } from '../controllers/purchaserequest.controller.js';
export async function purchaseRequestRoutes(fastify) {
    const purchaseRequestController = new PurchaseRequestController();
    // GET /v1/purchaserequests - Get all purchase requests with pagination and filtering
    fastify.get('/', {
        schema: {
            description: 'Get all purchase requests with pagination and filtering',
            tags: ['Purchase Requests'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                    // Actual database fields for filtering
                    prnumber: { type: 'string', description: 'Filter by PR number' },
                    prstatus: { type: 'string', description: 'Filter by PR status' },
                    companyname: { type: 'string', description: 'Filter by company name' },
                    companyaddress: { type: 'string', description: 'Filter by company address' },
                    contactname: { type: 'string', description: 'Filter by contact name' },
                    phonenumber: { type: 'string', description: 'Filter by phone number' },
                    gstnumber: { type: 'string', description: 'Filter by GST number' },
                    companymail: { type: 'string', description: 'Filter by company email' },
                    supplierid: { type: 'string', description: 'Filter by supplier ID' },
                    supplieremail: { type: 'string', description: 'Filter by supplier email' },
                    createddate: { type: 'string', description: 'Filter by creation date (timestamp)' },
                    modifieddate: { type: 'string', description: 'Filter by modification date (timestamp)' },
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
                                    id: { type: 'number', description: 'Purchase request ID' },
                                    prnumber: { type: 'string', description: 'PR number' },
                                    prstatus: { type: 'string', description: 'PR status' },
                                    companyname: { type: 'string', description: 'Company name' },
                                    companyaddress: { type: 'string', description: 'Company address' },
                                    contactname: { type: 'string', description: 'Contact name' },
                                    phonenumber: { type: 'number', description: 'Phone number' },
                                    gstnumber: { type: 'string', description: 'GST number' },
                                    companymail: { type: 'string', description: 'Company email' },
                                    supplierid: { type: 'number', description: 'Supplier ID' },
                                    supplieremail: { type: 'string', nullable: true, description: 'Supplier email' },
                                    prurl: { type: 'string', nullable: true, description: 'PR document URL' },
                                    prdata: { type: 'array', description: 'PR data array with product details' },
                                    createddate: { type: 'number', description: 'Creation timestamp' },
                                    modifieddate: { type: 'number', description: 'Modification timestamp' },
                                },
                                additionalProperties: true // Allow additional dynamic fields
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
    }, purchaseRequestController.getPurchaseRequests.bind(purchaseRequestController));
    // GET /v1/purchaserequests/:id - Get purchase request by ID
    fastify.get('/:id', {
        schema: {
            description: 'Get purchase request by ID',
            tags: ['Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Purchase request ID' },
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
                            additionalProperties: true // Allow any fields in purchase request object
                        },
                        message: { type: 'string' },
                    },
                },
                404: {
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
    }, purchaseRequestController.getPurchaseRequest.bind(purchaseRequestController));
    // POST /v1/purchaserequests - Create new purchase request
    fastify.post('/', {
        schema: {
            description: 'Create a new purchase request',
            tags: ['Purchase Requests'],
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in purchase request object
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
    }, purchaseRequestController.createPurchaseRequest.bind(purchaseRequestController));
    // PUT /v1/purchaserequests/:id - Update purchase request
    fastify.put('/:id', {
        schema: {
            description: 'Update purchase request by ID',
            tags: ['Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Purchase request ID' },
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
                            additionalProperties: true // Allow any fields in purchase request object
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
    }, purchaseRequestController.updatePurchaseRequest.bind(purchaseRequestController));
    // DELETE /v1/purchaserequests/:id - Delete purchase request
    fastify.delete('/:id', {
        schema: {
            description: 'Delete purchase request by ID',
            tags: ['Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Purchase request ID' },
                },
                required: ['id'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
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
    }, purchaseRequestController.deletePurchaseRequest.bind(purchaseRequestController));
    // GET /v1/purchaserequests/user/:userId - Get purchase requests by user
    fastify.get('/user/:userId', {
        schema: {
            description: 'Get purchase requests by user (requested by)',
            tags: ['Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    userId: { type: 'string', description: 'User ID' },
                },
                required: ['userId'],
            },
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                    prstatus: { type: 'string', description: 'Filter by PR status' },
                },
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
                                additionalProperties: true // Allow any fields in purchase request objects
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
    }, purchaseRequestController.getPurchaseRequestsByRequester.bind(purchaseRequestController));
    // GET /v1/purchaserequests/supplier/:supplierId - Get purchase requests by supplier
    fastify.get('/supplier/:supplierId', {
        schema: {
            description: 'Get purchase requests by supplier ID',
            tags: ['Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    supplierId: { type: 'string', description: 'Supplier ID' },
                },
                required: ['supplierId'],
            },
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                    prstatus: { type: 'string', description: 'Filter by PR status' },
                },
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
                                additionalProperties: true // Allow any fields in purchase request objects
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
    }, purchaseRequestController.getPurchaseRequestsBySupplier.bind(purchaseRequestController));
    // PUT /v1/purchaserequests/:id/approve - Approve purchase request
    fastify.put('/:id/approve', {
        schema: {
            description: 'Approve purchase request',
            tags: ['Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Purchase request ID' },
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
                            additionalProperties: true // Allow any fields in purchase request object
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
    }, purchaseRequestController.approvePurchaseRequest.bind(purchaseRequestController));
    // PUT /v1/purchaserequests/:id/reject - Reject purchase request
    fastify.put('/:id/reject', {
        schema: {
            description: 'Reject purchase request',
            tags: ['Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Purchase request ID' },
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
                            additionalProperties: true // Allow any fields in purchase request object
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
    }, purchaseRequestController.rejectPurchaseRequest.bind(purchaseRequestController));
}
//# sourceMappingURL=purchaserequest.route.js.map