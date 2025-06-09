import { SamplePurchaseOrderController } from '../controllers/samplepurchaseorder.controller.js';
import { formatSamplePurchaseOrderForAPI } from '../utils/dynamicDbOperations.js';
export async function samplePurchaseOrderRoutes(fastify) {
    const samplePurchaseOrderController = new SamplePurchaseOrderController();
    // GET /v1/samplepurchaseorders - Get all sample purchase orders with pagination and filtering
    fastify.get('/', {
        schema: {
            description: 'Get all sample purchase orders with pagination and filtering',
            tags: ['Sample Purchase Orders'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
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
                                    id: { type: 'number', description: 'Sample purchase order ID' },
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
    }, samplePurchaseOrderController.getSamplePurchaseOrders.bind(samplePurchaseOrderController));
    // GET /v1/samplepurchaseorders/:id - Get sample purchase order by ID
    fastify.get('/:id', {
        schema: {
            description: 'Get sample purchase order by ID',
            tags: ['Sample Purchase Orders'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Sample purchase order ID' },
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
                            additionalProperties: true // Allow any fields in sample purchase order object
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
    }, async (request, reply) => {
        try {
            const { id } = request.params;
            // Validate ID format
            if (!/^\d+$/.test(id)) {
                const errorResponse = {
                    success: false,
                    message: 'Invalid ID format. ID must be an integer.',
                    details: `The provided ID '${id}' is not a valid integer format.`,
                    statusCode: 400
                };
                return reply.code(400).send(errorResponse);
            }
            // Call the service method directly
            const samplePurchaseOrder = await samplePurchaseOrderController.samplePurchaseOrderService.findById(id);
            const response = {
                success: true,
                message: 'Sample purchase order retrieved successfully',
                data: formatSamplePurchaseOrderForAPI(samplePurchaseOrder)
            };
            return reply.code(200).send(response);
        }
        catch (error) {
            console.log('=== SAMPLE PURCHASE ORDER GET ERROR:', error.message);
            if (error.message.includes('not found')) {
                const errorResponse = {
                    success: false,
                    message: `Sample purchase order with ID ${request.params.id} not found`,
                    details: 'The requested resource could not be found',
                    statusCode: 404
                };
                return reply.code(404).send(errorResponse);
            }
            // Default error response
            const errorResponse = {
                success: false,
                message: 'Internal server error',
                details: 'Something went wrong on the server',
                statusCode: 500
            };
            return reply.code(500).send(errorResponse);
        }
    });
    // POST /v1/samplepurchaseorders - Create new sample purchase order
    fastify.post('/', {
        schema: {
            description: 'Create a new sample purchase order',
            tags: ['Sample Purchase Orders'],
            body: {
                type: 'object',
                properties: {
                    companyname: {
                        type: 'string',
                        description: 'Company name'
                    },
                    contactname: {
                        type: 'string',
                        description: 'Contact person name'
                    },
                    phonenumber: {
                        type: 'number',
                        description: 'Phone number'
                    },
                    companymail: {
                        type: 'string',
                        format: 'email',
                        description: 'Company email'
                    },
                    gstnumber: {
                        type: 'string',
                        description: 'GST number'
                    },
                    companyaddress: {
                        type: 'string',
                        description: 'Company address'
                    },
                    supplierid: {
                        type: 'number',
                        description: 'Supplier ID (must exist in supplier table)'
                    },
                    items: {
                        type: 'array',
                        description: 'Items in the sample purchase order',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'number', description: 'Item ID' },
                                name: { type: 'string', description: 'Item name' },
                                quantity: { type: 'number', description: 'Quantity ordered' }
                            },
                            required: ['id', 'name', 'quantity']
                        }
                    },
                    createdby: {
                        type: 'string',
                        description: 'Username of the person who created the purchase order'
                    },
                    modifiedby: {
                        type: 'string',
                        description: 'Username of the person who last modified the purchase order'
                    }
                },
                required: [
                    'companyname',
                    'contactname',
                    'phonenumber',
                    'companymail',
                    'gstnumber',
                    'companyaddress',
                    'supplierid',
                    'items',
                    'createdby',
                    'modifiedby'
                ],
                additionalProperties: true
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in sample purchase order object
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
    }, samplePurchaseOrderController.createSamplePurchaseOrder.bind(samplePurchaseOrderController));
    // PUT /v1/samplepurchaseorders/:id - Update sample purchase order
    fastify.put('/:id', {
        schema: {
            description: 'Update sample purchase order by ID',
            tags: ['Sample Purchase Orders'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Sample purchase order ID' },
                },
                required: ['id'],
            },
            body: {
                type: 'object',
                properties: {
                    companyname: {
                        type: 'string',
                        description: 'Company name'
                    },
                    contactname: {
                        type: 'string',
                        description: 'Contact person name'
                    },
                    phonenumber: {
                        type: 'number',
                        description: 'Phone number'
                    },
                    companymail: {
                        type: 'string',
                        format: 'email',
                        description: 'Company email'
                    },
                    gstnumber: {
                        type: 'string',
                        description: 'GST number'
                    },
                    companyaddress: {
                        type: 'string',
                        description: 'Company address'
                    },
                    supplierid: {
                        type: 'number',
                        description: 'Supplier ID (must exist in supplier table)'
                    },
                    items: {
                        type: 'array',
                        description: 'Items in the sample purchase order',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'number', description: 'Item ID' },
                                name: { type: 'string', description: 'Item name' },
                                quantity: { type: 'number', description: 'Quantity ordered' }
                            },
                            required: ['id', 'name', 'quantity']
                        }
                    },
                    modifiedby: {
                        type: 'string',
                        description: 'Username of the person who last modified the purchase order'
                    }
                },
                additionalProperties: true, // Allow any fields for dynamic updates
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in sample purchase order object
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
    }, async (request, reply) => {
        try {
            const { id } = request.params;
            // Validate ID format
            if (!/^\d+$/.test(id)) {
                const errorResponse = {
                    success: false,
                    message: 'Invalid ID format. ID must be an integer.',
                    details: `The provided ID '${id}' is not a valid integer format.`,
                    statusCode: 400
                };
                return reply.code(400).send(errorResponse);
            }
            // Update the sample purchase order
            const samplePurchaseOrder = await samplePurchaseOrderController.samplePurchaseOrderService.update(id, request.body);
            const response = {
                success: true,
                message: 'Sample purchase order updated successfully',
                data: samplePurchaseOrder
            };
            return reply.code(200).send(response);
        }
        catch (error) {
            console.log('=== SAMPLE PURCHASE ORDER PUT ERROR:', error.message);
            if (error.message.includes('not found')) {
                const errorResponse = {
                    success: false,
                    message: `Sample purchase order with ID ${request.params.id} not found`,
                    details: 'The requested resource could not be found',
                    statusCode: 404
                };
                return reply.code(404).send(errorResponse);
            }
            if (error.message.includes('already exists')) {
                const errorResponse = {
                    success: false,
                    message: error.message,
                    details: 'Duplicate entry detected',
                    statusCode: 400
                };
                return reply.code(400).send(errorResponse);
            }
            // Default error response
            const errorResponse = {
                success: false,
                message: 'Internal server error',
                details: 'Something went wrong on the server',
                statusCode: 500
            };
            return reply.code(500).send(errorResponse);
        }
    });
    // DELETE /v1/samplepurchaseorders/:id - Delete sample purchase order
    fastify.delete('/:id', {
        schema: {
            description: 'Delete sample purchase order by ID',
            tags: ['Sample Purchase Orders'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Sample purchase order ID' },
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
    }, async (request, reply) => {
        try {
            const { id } = request.params;
            // Validate ID format
            if (!/^\d+$/.test(id)) {
                const errorResponse = {
                    success: false,
                    message: 'Invalid ID format. ID must be an integer.',
                    details: `The provided ID '${id}' is not a valid integer format.`,
                    statusCode: 400
                };
                return reply.code(400).send(errorResponse);
            }
            // Delete the sample purchase order
            await samplePurchaseOrderController.samplePurchaseOrderService.delete(id);
            const response = {
                success: true,
                message: 'Sample purchase order deleted successfully'
            };
            return reply.code(200).send(response);
        }
        catch (error) {
            console.log('=== SAMPLE PURCHASE ORDER DELETE ERROR:', error.message);
            if (error.message.includes('not found')) {
                const errorResponse = {
                    success: false,
                    message: `Sample purchase order with ID ${request.params.id} not found`,
                    details: 'The requested resource could not be found',
                    statusCode: 404
                };
                return reply.code(404).send(errorResponse);
            }
            // Default error response
            const errorResponse = {
                success: false,
                message: 'Internal server error',
                details: 'Something went wrong on the server',
                statusCode: 500
            };
            return reply.code(500).send(errorResponse);
        }
    });
    // GET /v1/samplepurchaseorders/supplier/:supplierId - Get sample purchase orders by supplier
    fastify.get('/supplier/:supplierId', {
        schema: {
            description: 'Get sample purchase orders by supplier ID',
            tags: ['Sample Purchase Orders'],
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
                                additionalProperties: true // Allow any fields in sample purchase order objects
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
    }, samplePurchaseOrderController.getSamplePurchaseOrdersBySupplier.bind(samplePurchaseOrderController));
}
//# sourceMappingURL=samplepurchaseorder.route.js.map