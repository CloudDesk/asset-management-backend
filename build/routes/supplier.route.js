import { SupplierController } from '../controllers/supplier.controller.js';
export async function supplierRoutes(fastify) {
    const supplierController = new SupplierController();
    // GET /v1/suppliers - Get all suppliers with pagination and filtering
    fastify.get('/', {
        schema: {
            description: 'Get all suppliers with pagination and filtering',
            tags: ['Suppliers'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                    suppliername: { type: 'string', description: 'Filter by supplier name' },
                    suppliercode: { type: 'string', description: 'Filter by supplier code' },
                    suppliertype: { type: 'string', description: 'Filter by supplier type (local/International)' },
                    supplieremail: { type: 'string', description: 'Filter by supplier email' },
                    supplierphonenumber: { type: 'string', description: 'Filter by supplier phone number' },
                    supplierlandline: { type: 'string', description: 'Filter by supplier landline' },
                    city: { type: 'string', description: 'Filter by city' },
                    state: { type: 'string', description: 'Filter by state' },
                    country: { type: 'string', description: 'Filter by country' },
                    gstnumber: { type: 'string', description: 'Filter by GST number' },
                    doornumber: { type: 'string', description: 'Filter by door number' },
                    streetname: { type: 'string', description: 'Filter by street name' },
                    pincode: { type: 'string', description: 'Filter by pincode' },
                    isdeleted: { type: 'string', description: 'Filter by deletion status' },
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
                                    id: { type: 'number', description: 'Supplier ID' },
                                    suppliername: { type: 'string', description: 'Supplier name' },
                                    suppliercode: { type: 'string', description: 'Supplier code' },
                                    suppliertype: { type: 'string', description: 'Supplier type (local/International)' },
                                    supplieremail: { type: 'string', description: 'Supplier email' },
                                    supplierphonenumber: { type: 'number', nullable: true, description: 'Supplier phone number' },
                                    supplierlandline: { type: 'number', nullable: true, description: 'Supplier landline' },
                                    city: { type: 'string', nullable: true, description: 'City' },
                                    state: { type: 'string', nullable: true, description: 'State' },
                                    country: { type: 'string', nullable: true, description: 'Country' },
                                    gstnumber: { type: 'string', nullable: true, description: 'GST number' },
                                    doornumber: { type: 'string', nullable: true, description: 'Door number' },
                                    streetname: { type: 'string', nullable: true, description: 'Street name' },
                                    pincode: { type: 'string', nullable: true, description: 'Pincode' },
                                    isdeleted: { type: 'boolean', nullable: true, description: 'Deletion status' },
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
    }, supplierController.getSuppliers.bind(supplierController));
    // GET /v1/suppliers/:id - Get supplier by ID
    fastify.get('/:id', {
        schema: {
            description: 'Get supplier by ID',
            tags: ['Suppliers'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Supplier ID' },
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
                                id: { type: 'number', description: 'Supplier ID' },
                                suppliername: { type: 'string', description: 'Supplier name' },
                                suppliercode: { type: 'string', description: 'Supplier code' },
                                suppliertype: { type: 'string', description: 'Supplier type (local/International)' },
                                supplieremail: { type: 'string', description: 'Supplier email' },
                                supplierphonenumber: { type: 'number', nullable: true, description: 'Supplier phone number' },
                                supplierlandline: { type: 'number', nullable: true, description: 'Supplier landline' },
                                city: { type: 'string', nullable: true, description: 'City' },
                                state: { type: 'string', nullable: true, description: 'State' },
                                country: { type: 'string', nullable: true, description: 'Country' },
                                gstnumber: { type: 'string', nullable: true, description: 'GST number' },
                                doornumber: { type: 'string', nullable: true, description: 'Door number' },
                                streetname: { type: 'string', nullable: true, description: 'Street name' },
                                pincode: { type: 'string', nullable: true, description: 'Pincode' },
                                isdeleted: { type: 'boolean', nullable: true, description: 'Deletion status' },
                                createddate: { type: 'number', description: 'Creation timestamp' },
                                modifieddate: { type: 'number', description: 'Modification timestamp' },
                            },
                            additionalProperties: true // Allow additional dynamic fields
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
    }, supplierController.getSupplier.bind(supplierController));
    // POST /v1/suppliers - Create new supplier
    fastify.post('/', {
        schema: {
            description: 'Create a new supplier',
            tags: ['Suppliers'],
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in supplier object
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
    }, supplierController.createSupplier.bind(supplierController));
    // PUT /v1/suppliers/:id - Update supplier
    fastify.put('/:id', {
        schema: {
            description: 'Update supplier by ID',
            tags: ['Suppliers'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Supplier ID' },
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
                            additionalProperties: true // Allow any fields in supplier object
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
    }, supplierController.updateSupplier.bind(supplierController));
    // DELETE /v1/suppliers/:id - Delete supplier
    fastify.delete('/:id', {
        schema: {
            description: 'Delete supplier by ID',
            tags: ['Suppliers'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Supplier ID' },
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
    }, supplierController.deleteSupplier.bind(supplierController));
    // POST /v1/suppliers/upsert - Upsert supplier
    fastify.post('/upsert', {
        schema: {
            description: 'Create or update supplier (upsert operation)',
            tags: ['Suppliers'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in supplier object
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
    }, supplierController.upsertSupplier.bind(supplierController));
    // GET /v1/suppliers/:id/stats - Get supplier statistics
    fastify.get('/:id/stats', {
        schema: {
            description: 'Get supplier statistics (purchase orders, requests, etc.)',
            tags: ['Suppliers'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', format: 'uuid' },
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
                            additionalProperties: true
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
            },
        },
    }, supplierController.getSupplierStats.bind(supplierController));
}
//# sourceMappingURL=supplier.route.js.map