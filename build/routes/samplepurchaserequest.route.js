import { SamplePurchaseRequestController } from '../controllers/samplepurchaserequest.controller.js';
export async function samplePurchaseRequestRoutes(fastify) {
    const samplePurchaseRequestController = new SamplePurchaseRequestController();
    // GET /v1/samplepurchaserequests - Get all sample purchase requests with optimized pagination and filtering
    fastify.get('/', {
        schema: {
            description: 'Get all sample purchase requests with optimized pagination, filtering, and sorting',
            tags: ['Sample Purchase Requests'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number (default: 1)' },
                    limit: { type: 'string', description: 'Items per page (max: 100, default: 10)' },
                    sortBy: {
                        type: 'string',
                        enum: ['id', 'companyname', 'contactname', 'createddate', 'modifieddate'],
                        description: 'Field to sort by'
                    },
                    sortOrder: {
                        type: 'string',
                        enum: ['asc', 'desc'],
                        description: 'Sort order (default: desc)'
                    },
                    companyname: { type: 'string', description: 'Filter by company name' },
                    contactname: { type: 'string', description: 'Filter by contact name' },
                    phonenumber: { type: 'string', description: 'Filter by phone number' },
                    companymail: { type: 'string', description: 'Filter by company email' },
                    gstnumber: { type: 'string', description: 'Filter by GST number' },
                    companyaddress: { type: 'string', description: 'Filter by company address' },
                    supplierid: { type: 'string', description: 'Filter by supplier ID' },
                    createddate: { type: 'string', description: 'Filter by creation date (timestamp)' },
                    modifieddate: { type: 'string', description: 'Filter by modification date (timestamp)' },
                    createdby: { type: 'string', description: 'Filter by created by' },
                    modifiedby: { type: 'string', description: 'Filter by modified by' },
                },
                additionalProperties: false,
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'number', description: 'Sample purchase request ID' },
                                    companyname: { type: 'string', description: 'Company name' },
                                    contactname: { type: 'string', description: 'Contact name' },
                                    phonenumber: { type: 'number', description: 'Phone number' },
                                    companymail: { type: 'string', description: 'Company email' },
                                    gstnumber: { type: 'string', description: 'GST number' },
                                    companyaddress: { type: 'string', description: 'Company address' },
                                    supplierid: { type: 'number', description: 'Supplier ID' },
                                    items: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                id: { type: 'number', description: 'Item ID' },
                                                name: { type: 'string', description: 'Item name' },
                                                quantity: { type: 'number', description: 'Item quantity' }
                                            }
                                        }
                                    },
                                    createddate: { type: 'number', description: 'Creation timestamp' },
                                    modifieddate: { type: 'number', description: 'Modification timestamp' },
                                    createdby: { type: 'string', description: 'Created by' },
                                    modifiedby: { type: 'string', description: 'Modified by' },
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
                                sortBy: { type: 'string' },
                                sortOrder: { type: 'string' },
                                responseTime: { type: 'number' },
                                cached: { type: 'boolean' },
                            },
                        },
                    },
                },
            },
        },
    }, samplePurchaseRequestController.getSamplePurchaseRequests);
    // GET /v1/samplepurchaserequests/:id - Get sample purchase request by ID with caching
    fastify.get('/:id', {
        schema: {
            description: 'Get sample purchase request by ID with optimized caching',
            tags: ['Sample Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        pattern: '^\\d+$',
                        description: 'Sample purchase request ID (must be a positive integer)'
                    },
                },
                required: ['id'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in sample purchase request object
                        },
                        meta: {
                            type: 'object',
                            properties: {
                                responseTime: { type: 'number' },
                                cached: { type: 'boolean' },
                            },
                        },
                    },
                },
            },
        },
    }, samplePurchaseRequestController.getSamplePurchaseRequest);
    // POST /v1/samplepurchaserequests - Create new sample purchase request with enhanced validation
    fastify.post('/', {
        schema: {
            description: 'Create new sample purchase request with enhanced validation',
            tags: ['Sample Purchase Requests'],
            body: {
                type: 'object',
                properties: {
                    companyname: { type: 'string', minLength: 1, maxLength: 255, description: 'Company name' },
                    contactname: { type: 'string', minLength: 1, maxLength: 255, description: 'Contact name' },
                    phonenumber: {
                        type: 'number',
                        minimum: 1000000000,
                        maximum: 9999999999,
                        description: 'Phone number (10 digits)'
                    },
                    companymail: {
                        type: 'string',
                        format: 'email',
                        maxLength: 255,
                        description: 'Company email'
                    },
                    gstnumber: { type: 'string', minLength: 1, maxLength: 50, description: 'GST number' },
                    companyaddress: { type: 'string', minLength: 1, maxLength: 1000, description: 'Company address' },
                    supplierid: { type: 'number', minimum: 1, description: 'Supplier ID' },
                    items: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 100,
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'number', minimum: 1, description: 'Item ID' },
                                name: { type: 'string', minLength: 1, maxLength: 255, description: 'Item name' },
                                quantity: { type: 'number', minimum: 1, maximum: 999999, description: 'Item quantity' }
                            },
                            required: ['id', 'name', 'quantity'],
                            additionalProperties: false
                        },
                        description: 'Items array (max 100 items)'
                    },
                    createdby: { type: 'string', minLength: 1, maxLength: 255, description: 'Created by' },
                    modifiedby: { type: 'string', minLength: 1, maxLength: 255, description: 'Modified by' },
                    createddate: { type: 'number', minimum: 0, description: 'Creation timestamp (optional)' },
                    modifieddate: { type: 'number', minimum: 0, description: 'Modification timestamp (optional)' },
                },
                required: [
                    'companyname', 'contactname', 'phonenumber', 'companymail',
                    'gstnumber', 'companyaddress', 'supplierid', 'items',
                    'createdby', 'modifiedby'
                ],
                additionalProperties: false,
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: { type: 'object', additionalProperties: true },
                        meta: {
                            type: 'object',
                            properties: {
                                responseTime: { type: 'number' },
                                created: { type: 'boolean' },
                            },
                        },
                    },
                },
            },
        },
    }, samplePurchaseRequestController.createSamplePurchaseRequest);
    // PUT /v1/samplepurchaserequests/:id - Update sample purchase request with optimized validation
    fastify.put('/:id', {
        schema: {
            description: 'Update sample purchase request with optimized validation',
            tags: ['Sample Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        pattern: '^\\d+$',
                        description: 'Sample purchase request ID (must be a positive integer)'
                    },
                },
                required: ['id'],
            },
            body: {
                type: 'object',
                properties: {
                    companyname: { type: 'string', minLength: 1, maxLength: 255, description: 'Company name' },
                    contactname: { type: 'string', minLength: 1, maxLength: 255, description: 'Contact name' },
                    phonenumber: {
                        type: 'number',
                        minimum: 1000000000,
                        maximum: 9999999999,
                        description: 'Phone number (10 digits)'
                    },
                    companymail: {
                        type: 'string',
                        format: 'email',
                        maxLength: 255,
                        description: 'Company email'
                    },
                    gstnumber: { type: 'string', minLength: 1, maxLength: 50, description: 'GST number' },
                    companyaddress: { type: 'string', minLength: 1, maxLength: 1000, description: 'Company address' },
                    supplierid: { type: 'number', minimum: 1, description: 'Supplier ID' },
                    items: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 100,
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'number', minimum: 1, description: 'Item ID' },
                                name: { type: 'string', minLength: 1, maxLength: 255, description: 'Item name' },
                                quantity: { type: 'number', minimum: 1, maximum: 999999, description: 'Item quantity' }
                            },
                            required: ['id', 'name', 'quantity'],
                            additionalProperties: false
                        },
                        description: 'Items array (max 100 items)'
                    },
                    createdby: { type: 'string', minLength: 1, maxLength: 255, description: 'Created by' },
                    modifiedby: { type: 'string', minLength: 1, maxLength: 255, description: 'Modified by' },
                    createddate: { type: 'number', minimum: 0, description: 'Creation timestamp' },
                    modifieddate: { type: 'number', minimum: 0, description: 'Modification timestamp' },
                },
                minProperties: 1, // At least one field must be provided
                additionalProperties: false,
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: { type: 'object', additionalProperties: true },
                        meta: {
                            type: 'object',
                            properties: {
                                responseTime: { type: 'number' },
                                updated: { type: 'boolean' },
                                fieldsUpdated: { type: 'array', items: { type: 'string' } },
                            },
                        },
                    },
                },
            },
        },
    }, samplePurchaseRequestController.updateSamplePurchaseRequest);
    // DELETE /v1/samplepurchaserequests/:id - Delete sample purchase request with optimized logging
    fastify.delete('/:id', {
        schema: {
            description: 'Delete sample purchase request with optimized logging',
            tags: ['Sample Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    id: {
                        type: 'string',
                        pattern: '^\\d+$',
                        description: 'Sample purchase request ID (must be a positive integer)'
                    },
                },
                required: ['id'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: { type: 'null' },
                        meta: {
                            type: 'object',
                            properties: {
                                responseTime: { type: 'number' },
                                deleted: { type: 'boolean' },
                            },
                        },
                    },
                },
            },
        },
    }, samplePurchaseRequestController.deleteSamplePurchaseRequest);
    // POST /v1/samplepurchaserequests/upsert - Upsert sample purchase request with enhanced logic
    fastify.post('/upsert', {
        schema: {
            description: 'Create or update sample purchase request based on ID presence',
            tags: ['Sample Purchase Requests'],
            body: {
                type: 'object',
                properties: {
                    id: { type: 'string', minLength: 1, description: 'Sample purchase request ID (optional for create)' },
                    companyname: { type: 'string', minLength: 1, maxLength: 255, description: 'Company name' },
                    contactname: { type: 'string', minLength: 1, maxLength: 255, description: 'Contact name' },
                    phonenumber: {
                        type: 'number',
                        minimum: 1000000000,
                        maximum: 9999999999,
                        description: 'Phone number (10 digits)'
                    },
                    companymail: {
                        type: 'string',
                        format: 'email',
                        maxLength: 255,
                        description: 'Company email'
                    },
                    gstnumber: { type: 'string', minLength: 1, maxLength: 50, description: 'GST number' },
                    companyaddress: { type: 'string', minLength: 1, maxLength: 1000, description: 'Company address' },
                    supplierid: { type: 'number', minimum: 1, description: 'Supplier ID' },
                    items: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 100,
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'number', minimum: 1, description: 'Item ID' },
                                name: { type: 'string', minLength: 1, maxLength: 255, description: 'Item name' },
                                quantity: { type: 'number', minimum: 1, maximum: 999999, description: 'Item quantity' }
                            },
                            required: ['id', 'name', 'quantity'],
                            additionalProperties: false
                        },
                        description: 'Items array (max 100 items)'
                    },
                    createdby: { type: 'string', minLength: 1, maxLength: 255, description: 'Created by' },
                    modifiedby: { type: 'string', minLength: 1, maxLength: 255, description: 'Modified by' },
                    createddate: { type: 'number', minimum: 0, description: 'Creation timestamp' },
                    modifieddate: { type: 'number', minimum: 0, description: 'Modification timestamp' },
                },
                additionalProperties: false,
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: { type: 'object', additionalProperties: true },
                        meta: {
                            type: 'object',
                            properties: {
                                responseTime: { type: 'number' },
                                operation: { type: 'string', enum: ['create', 'update'] },
                            },
                        },
                    },
                },
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: { type: 'object', additionalProperties: true },
                        meta: {
                            type: 'object',
                            properties: {
                                responseTime: { type: 'number' },
                                operation: { type: 'string', enum: ['create', 'update'] },
                            },
                        },
                    },
                },
            },
        },
    }, samplePurchaseRequestController.upsertSamplePurchaseRequest);
    // GET /v1/samplepurchaserequests/supplier/:supplierId - Get sample purchase requests by supplier with enhanced performance
    fastify.get('/supplier/:supplierId', {
        schema: {
            description: 'Get sample purchase requests by supplier ID with enhanced performance and caching',
            tags: ['Sample Purchase Requests'],
            params: {
                type: 'object',
                properties: {
                    supplierId: {
                        type: 'string',
                        minLength: 1,
                        description: 'Supplier ID'
                    },
                },
                required: ['supplierId'],
            },
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number (default: 1)' },
                    limit: { type: 'string', description: 'Items per page (max: 100, default: 10)' },
                    sortBy: {
                        type: 'string',
                        enum: ['id', 'companyname', 'contactname', 'createddate', 'modifieddate'],
                        description: 'Field to sort by'
                    },
                    sortOrder: {
                        type: 'string',
                        enum: ['asc', 'desc'],
                        description: 'Sort order (default: desc)'
                    },
                },
                additionalProperties: false,
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
                                supplierId: { type: 'string' },
                                data: {
                                    type: 'array',
                                    items: { type: 'object', additionalProperties: true }
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
                                        total: { type: 'number' },
                                        sortBy: { type: 'string' },
                                        sortOrder: { type: 'string' },
                                        responseTime: { type: 'number' },
                                        cached: { type: 'boolean' },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    }, samplePurchaseRequestController.getSamplePurchaseRequestsBySupplier);
    // GET /v1/samplepurchaserequests/stats - Get service statistics for monitoring
    fastify.get('/stats', {
        schema: {
            description: 'Get service statistics for monitoring and debugging',
            tags: ['Sample Purchase Requests', 'Monitoring'],
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
                                cacheSize: { type: 'number' },
                                cacheKeys: { type: 'array', items: { type: 'string' } },
                                timestamp: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
    }, samplePurchaseRequestController.getStats);
    // POST /v1/samplepurchaserequests/cache/clear - Clear service cache (admin endpoint)
    fastify.post('/cache/clear', {
        schema: {
            description: 'Clear service cache for admin/debugging purposes',
            tags: ['Sample Purchase Requests', 'Admin'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: {
                            type: 'object',
                            properties: {
                                timestamp: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
    }, samplePurchaseRequestController.clearCache);
}
//# sourceMappingURL=samplepurchaserequest.route.js.map