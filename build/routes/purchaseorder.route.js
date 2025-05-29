import { PurchaseOrderController } from '../controllers/purchaseorder.controller.js';
export async function purchaseOrderRoutes(fastify) {
    const purchaseOrderController = new PurchaseOrderController();
    fastify.get('/', {
        schema: {
            description: 'Get all purchase orders with pagination and filtering',
            tags: ['Purchase Orders'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                    // Actual database fields for filtering
                    ponumber: { type: 'string', description: 'Filter by PO number' },
                    prnumber: { type: 'string', description: 'Filter by PR number' },
                    companyname: { type: 'string', description: 'Filter by company name' },
                    companyaddress: { type: 'string', description: 'Filter by company address' },
                    contactname: { type: 'string', description: 'Filter by contact name' },
                    gstnumber: { type: 'string', description: 'Filter by GST number' },
                    supplierid: { type: 'string', description: 'Filter by supplier ID' },
                    po_status: { type: 'string', description: 'Filter by PO status' },
                    suppliertype: { type: 'string', description: 'Filter by supplier type' },
                    suppliercompanyname: { type: 'string', description: 'Filter by supplier company name' },
                    supplieraddress: { type: 'string', description: 'Filter by supplier address' },
                    suppliergstnumber: { type: 'string', nullable: true, description: 'Filter by supplier GST number' },
                    paymentterms: { type: 'string', nullable: true, description: 'Filter by payment terms' },
                    sameasinvoice: { type: 'string', description: 'Filter by same as invoice flag' },
                    createddate: { type: 'string', description: 'Filter by creation date (timestamp)' },
                    modifieddate: { type: 'string', description: 'Filter by modification date (timestamp)' },
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
                                    id: { type: 'number', description: 'Purchase order ID' },
                                    ponumber: { type: 'string', description: 'PO number' },
                                    prnumber: { type: 'string', description: 'PR number' },
                                    companyname: { type: 'string', description: 'Company name' },
                                    companyaddress: { type: 'string', description: 'Company address' },
                                    contactname: { type: 'string', description: 'Contact name' },
                                    phonenumber: { type: 'object', description: 'Phone number (complex object)' },
                                    gstnumber: { type: 'string', description: 'GST number' },
                                    io_companyname: { type: 'string', description: 'Invoice company name' },
                                    io_companyaddress: { type: 'string', description: 'Invoice company address' },
                                    io_contactname: { type: 'string', description: 'Invoice contact name' },
                                    io_phonenumber: { type: 'object', description: 'Invoice phone number (complex object)' },
                                    io_gstnumber: { type: 'string', description: 'Invoice GST number' },
                                    dt_companyname: { type: 'string', description: 'Delivery company name' },
                                    dt_companyaddress: { type: 'string', description: 'Delivery company address' },
                                    dt_contactname: { type: 'string', description: 'Delivery contact name' },
                                    dt_phonenumber: { type: 'object', description: 'Delivery phone number (complex object)' },
                                    dt_gstnumber: { type: 'string', description: 'Delivery GST number' },
                                    supplierid: { type: 'number', description: 'Supplier ID' },
                                    subtotal: { type: 'object', description: 'Subtotal (complex object)' },
                                    discount: { type: 'object', description: 'Discount (complex object)' },
                                    sgst: { type: 'object', description: 'SGST (complex object)' },
                                    cgst: { type: 'object', description: 'CGST (complex object)' },
                                    payabletaxamount: { type: 'object', description: 'Payable tax amount (complex object)' },
                                    total: { type: 'object', description: 'Total amount (complex object)' },
                                    createddate: { type: 'number', description: 'Creation timestamp' },
                                    modifieddate: { type: 'number', description: 'Modification timestamp' },
                                    product: { type: 'array', description: 'Product details array' },
                                    po_status: { type: 'string', description: 'PO status' },
                                    supplieraddress: { type: 'string', description: 'Supplier address' },
                                    suppliercompanyname: { type: 'string', description: 'Supplier company name' },
                                    supplierphonenumber: { type: 'object', description: 'Supplier phone number (complex object)' },
                                    suppliergstnumber: { type: 'string', nullable: true, description: 'Supplier GST number' },
                                    instructions: { type: 'string', nullable: true, description: 'Instructions' },
                                    fileurl: { type: 'string', nullable: true, description: 'File URL' },
                                    invoiceurl: { type: 'string', nullable: true, description: 'Invoice URL' },
                                    sameasinvoice: { type: 'boolean', description: 'Same as invoice flag' },
                                    paymentterms: { type: 'string', nullable: true, description: 'Payment terms' },
                                    overduedate: { type: 'string', nullable: true, description: 'Overdue date' },
                                    comments: { type: 'string', nullable: true, description: 'Comments' },
                                    suppliertype: { type: 'string', description: 'Supplier type' },
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
    }, purchaseOrderController.getPurchaseOrders.bind(purchaseOrderController));
    // GET /v1/purchaseorders/:id - Get purchase order by ID
    fastify.get('/:id', {
        schema: {
            description: 'Get purchase order by ID',
            tags: ['Purchase Orders'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Purchase order ID' },
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
                            additionalProperties: true // Allow any fields in purchase order object
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
            const purchaseOrder = await purchaseOrderController.purchaseOrderService.findById(id);
            const response = {
                success: true,
                message: 'Purchase order retrieved successfully',
                data: purchaseOrder
            };
            return reply.code(200).send(response);
        }
        catch (error) {
            console.log('=== PURCHASE ORDER GET ERROR:', error.message);
            if (error.message.includes('not found')) {
                const errorResponse = {
                    success: false,
                    message: `Purchase order with ID ${request.params.id} not found`,
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
    // POST /v1/purchaseorders - Create new purchase order
    fastify.post('/', {
        schema: {
            description: 'Create a new purchase order',
            tags: ['Purchase Orders'],
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in purchase order object
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
    }, purchaseOrderController.createPurchaseOrder.bind(purchaseOrderController));
    // PUT /v1/purchaseorders/:id - Update purchase order
    fastify.put('/:id', {
        schema: {
            description: 'Update purchase order by ID',
            tags: ['Purchase Orders'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Purchase order ID' },
                },
                required: ['id'],
            },
            body: {
                type: 'object',
                additionalProperties: true, // Allow any fields for dynamic updates
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in purchase order object
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
            // Update the purchase order
            const purchaseOrder = await purchaseOrderController.purchaseOrderService.update(id, request.body);
            const response = {
                success: true,
                message: 'Purchase order updated successfully',
                data: purchaseOrder
            };
            return reply.code(200).send(response);
        }
        catch (error) {
            console.log('=== PURCHASE ORDER PUT ERROR:', error.message);
            if (error.message.includes('not found')) {
                const errorResponse = {
                    success: false,
                    message: `Purchase order with ID ${request.params.id} not found`,
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
    // DELETE /v1/purchaseorders/:id - Delete purchase order
    fastify.delete('/:id', {
        schema: {
            description: 'Delete purchase order by ID',
            tags: ['Purchase Orders'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Purchase order ID' },
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
            // Delete the purchase order
            await purchaseOrderController.purchaseOrderService.delete(id);
            const response = {
                success: true,
                message: 'Purchase order deleted successfully'
            };
            return reply.code(200).send(response);
        }
        catch (error) {
            console.log('=== PURCHASE ORDER DELETE ERROR:', error.message);
            if (error.message.includes('not found')) {
                const errorResponse = {
                    success: false,
                    message: `Purchase order with ID ${request.params.id} not found`,
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
    // GET /v1/purchaseorders/supplier/:supplierId - Get purchase orders by supplier
    fastify.get('/supplier/:supplierId', {
        schema: {
            description: 'Get purchase orders by supplier ID',
            tags: ['Purchase Orders'],
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
                    po_status: { type: 'string', description: 'Filter by PO status' },
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
                                additionalProperties: true // Allow any fields in purchase order objects
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
    }, purchaseOrderController.getPurchaseOrdersBySupplier.bind(purchaseOrderController));
    // PUT /v1/purchaseorders/:id/status - Update purchase order status
    fastify.put('/:id/status', {
        schema: {
            description: 'Update purchase order status',
            tags: ['Purchase Orders'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Purchase order ID' },
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
                            additionalProperties: true // Allow any fields in purchase order object
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
    }, purchaseOrderController.updatePurchaseOrderStatus.bind(purchaseOrderController));
}
//# sourceMappingURL=purchaseorder.route.js.map