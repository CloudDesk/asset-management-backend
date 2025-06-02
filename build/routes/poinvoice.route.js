import { PoinvoiceController } from '../controllers/poinvoice.controller.js';
export async function poinvoiceRoutes(fastify) {
    const poinvoiceController = new PoinvoiceController();
    // GET /v1/poinvoices - Get all poinvoices with pagination and filtering
    fastify.get('/', {
        schema: {
            description: 'Get all poinvoices with pagination and filtering',
            tags: ['PO Invoices'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                    // Actual database fields for filtering
                    invoiceamount: { type: 'string', description: 'Filter by invoice amount' },
                    ponumber: { type: 'string', description: 'Filter by PO number' },
                    invoicedate: { type: 'string', description: 'Filter by invoice date (timestamp)' },
                    invoicenumber: { type: 'string', description: 'Filter by invoice number' },
                    invoicestatus: { type: 'string', description: 'Filter by invoice status' },
                    balanceamount: { type: 'string', description: 'Filter by balance amount' },
                    iscreditpayment: { type: 'string', description: 'Filter by credit payment flag' },
                    paymentduedate: { type: 'string', description: 'Filter by payment due date (timestamp)' },
                    pototal: { type: 'string', description: 'Filter by PO total' },
                    purchaseorderstatus: { type: 'string', description: 'Filter by purchase order status' },
                    suppliertype: { type: 'string', description: 'Filter by supplier type' },
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
                                    id: { type: 'number', description: 'Poinvoice ID' },
                                    invoiceamount: { type: 'number', nullable: true, description: 'Invoice amount' },
                                    ponumber: { type: 'string', nullable: true, description: 'PO number' },
                                    invoicedate: { type: 'number', nullable: true, description: 'Invoice date timestamp' },
                                    invoicenumber: { type: 'string', nullable: true, description: 'Invoice number' },
                                    invoiceurl: { type: 'string', nullable: true, description: 'Invoice URL' },
                                    paymentdata: {
                                        oneOf: [
                                            {
                                                type: 'array',
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        id: { type: 'number', description: 'Payment ID' },
                                                        comments: { type: 'string', nullable: true, description: 'Payment comments' },
                                                        paymentdate: { type: 'string', nullable: true, description: 'Payment date' },
                                                        paymenttype: { type: 'string', nullable: true, description: 'Payment type (e.g., "Part Payment", "Full Payment")' },
                                                        paymentamount: { type: 'number', nullable: true, description: 'Payment amount' },
                                                        paymentmethod: { type: 'string', nullable: true, description: 'Payment method (e.g., "banktransfer", "cash", "cheque")' },
                                                        transactionid: { type: 'string', nullable: true, description: 'Transaction ID' },
                                                        receiptcomments: { type: 'string', nullable: true, description: 'Receipt comments' }
                                                    },
                                                    additionalProperties: true
                                                }
                                            },
                                            { type: 'object', additionalProperties: true },
                                            { type: 'null' }
                                        ],
                                        description: 'Payment data JSON - can be array of payment objects or single object'
                                    },
                                    createddate: { type: 'number', nullable: true, description: 'Creation timestamp' },
                                    modifieddate: { type: 'number', nullable: true, description: 'Modification timestamp' },
                                    balanceamount: { type: 'number', nullable: true, description: 'Balance amount' },
                                    iscreditpayment: { type: 'boolean', nullable: true, description: 'Is credit payment' },
                                    paymentduedate: { type: 'number', nullable: true, description: 'Payment due date timestamp' },
                                    invoicestatus: { type: 'string', nullable: true, description: 'Invoice status' },
                                    pototal: { type: 'number', nullable: true, description: 'PO total' },
                                    purchaseorderstatus: { type: 'string', nullable: true, description: 'Purchase order status' },
                                    transportationcharges: { type: 'number', nullable: true, description: 'Transportation charges' },
                                    exchangeamount: { type: 'number', nullable: true, description: 'Exchange amount' },
                                    customdutytaxamount: { type: 'number', nullable: true, description: 'Custom duty tax amount' },
                                    suppliertype: { type: 'string', nullable: true, description: 'Supplier type' },
                                    customdutychallanurl: { type: 'string', nullable: true, description: 'Custom duty challan URL' },
                                    billofentryurl: { type: 'string', nullable: true, description: 'Bill of entry URL' },
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
    }, poinvoiceController.getPoinvoices.bind(poinvoiceController));
    // GET /v1/poinvoices/:id - Get poinvoice by ID
    fastify.get('/:id', {
        schema: {
            description: 'Get poinvoice by ID',
            tags: ['PO Invoices'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Poinvoice ID' },
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
                                id: { type: 'number', description: 'Poinvoice ID' },
                                invoiceamount: { type: 'number', nullable: true, description: 'Invoice amount' },
                                ponumber: { type: 'string', nullable: true, description: 'PO number' },
                                invoicedate: { type: 'number', nullable: true, description: 'Invoice date timestamp' },
                                invoicenumber: { type: 'string', nullable: true, description: 'Invoice number' },
                                invoiceurl: { type: 'string', nullable: true, description: 'Invoice URL' },
                                paymentdata: {
                                    oneOf: [
                                        {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    id: { type: 'number', description: 'Payment ID' },
                                                    comments: { type: 'string', nullable: true, description: 'Payment comments' },
                                                    paymentdate: { type: 'string', nullable: true, description: 'Payment date' },
                                                    paymenttype: { type: 'string', nullable: true, description: 'Payment type (e.g., "Part Payment", "Full Payment")' },
                                                    paymentamount: { type: 'number', nullable: true, description: 'Payment amount' },
                                                    paymentmethod: { type: 'string', nullable: true, description: 'Payment method (e.g., "banktransfer", "cash", "cheque")' },
                                                    transactionid: { type: 'string', nullable: true, description: 'Transaction ID' },
                                                    receiptcomments: { type: 'string', nullable: true, description: 'Receipt comments' }
                                                },
                                                additionalProperties: true
                                            }
                                        },
                                        { type: 'object', additionalProperties: true },
                                        { type: 'null' }
                                    ],
                                    description: 'Payment data JSON - can be array of payment objects or single object'
                                },
                                createddate: { type: 'number', nullable: true, description: 'Creation timestamp' },
                                modifieddate: { type: 'number', nullable: true, description: 'Modification timestamp' },
                                balanceamount: { type: 'number', nullable: true, description: 'Balance amount' },
                                iscreditpayment: { type: 'boolean', nullable: true, description: 'Is credit payment' },
                                paymentduedate: { type: 'number', nullable: true, description: 'Payment due date timestamp' },
                                invoicestatus: { type: 'string', nullable: true, description: 'Invoice status' },
                                pototal: { type: 'number', nullable: true, description: 'PO total' },
                                purchaseorderstatus: { type: 'string', nullable: true, description: 'Purchase order status' },
                                transportationcharges: { type: 'number', nullable: true, description: 'Transportation charges' },
                                exchangeamount: { type: 'number', nullable: true, description: 'Exchange amount' },
                                customdutytaxamount: { type: 'number', nullable: true, description: 'Custom duty tax amount' },
                                suppliertype: { type: 'string', nullable: true, description: 'Supplier type' },
                                customdutychallanurl: { type: 'string', nullable: true, description: 'Custom duty challan URL' },
                                billofentryurl: { type: 'string', nullable: true, description: 'Bill of entry URL' },
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
    }, poinvoiceController.getPoinvoice.bind(poinvoiceController));
    // POST /v1/poinvoices - Create new poinvoice
    fastify.post('/', {
        schema: {
            description: 'Create a new poinvoice',
            tags: ['PO Invoices'],
            body: {
                type: 'object',
                properties: {
                    invoiceamount: { type: 'number', description: 'Invoice amount' },
                    ponumber: { type: 'string', maxLength: 500, description: 'PO number' },
                    invoicedate: { type: 'number', description: 'Invoice date timestamp' },
                    invoicenumber: { type: 'string', maxLength: 500, description: 'Invoice number' },
                    invoiceurl: { type: 'string', maxLength: 500, description: 'Invoice URL' },
                    paymentdata: {
                        oneOf: [
                            {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'number', description: 'Payment ID' },
                                        comments: { type: 'string', nullable: true, description: 'Payment comments' },
                                        paymentdate: { type: 'string', nullable: true, description: 'Payment date' },
                                        paymenttype: { type: 'string', nullable: true, description: 'Payment type (e.g., "Part Payment", "Full Payment")' },
                                        paymentamount: { type: 'number', nullable: true, description: 'Payment amount' },
                                        paymentmethod: { type: 'string', nullable: true, description: 'Payment method (e.g., "banktransfer", "cash", "cheque")' },
                                        transactionid: { type: 'string', nullable: true, description: 'Transaction ID' },
                                        receiptcomments: { type: 'string', nullable: true, description: 'Receipt comments' }
                                    },
                                    additionalProperties: true
                                }
                            },
                            { type: 'object', additionalProperties: true },
                            { type: 'null' }
                        ],
                        description: 'Payment data JSON - can be array of payment objects or single object'
                    },
                    createddate: { type: 'number', description: 'Creation timestamp (optional, auto-generated if not provided)' },
                    modifieddate: { type: 'number', description: 'Modification timestamp (optional, auto-generated if not provided)' },
                    balanceamount: { type: 'number', description: 'Balance amount' },
                    iscreditpayment: { type: 'boolean', description: 'Is credit payment' },
                    paymentduedate: { type: 'number', description: 'Payment due date timestamp' },
                    invoicestatus: { type: 'string', maxLength: 100, description: 'Invoice status' },
                    pototal: { type: 'number', description: 'PO total' },
                    purchaseorderstatus: { type: 'string', maxLength: 500, description: 'Purchase order status' },
                    transportationcharges: { type: 'number', description: 'Transportation charges' },
                    exchangeamount: { type: 'number', description: 'Exchange amount' },
                    customdutytaxamount: { type: 'number', description: 'Custom duty tax amount' },
                    suppliertype: { type: 'string', maxLength: 255, description: 'Supplier type' },
                    customdutychallanurl: { type: 'string', maxLength: 255, description: 'Custom duty challan URL' },
                    billofentryurl: { type: 'string', maxLength: 255, description: 'Bill of entry URL' },
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
                            properties: {
                                id: { type: 'number', description: 'Poinvoice ID' },
                                invoiceamount: { type: 'number', nullable: true, description: 'Invoice amount' },
                                ponumber: { type: 'string', nullable: true, description: 'PO number' },
                                invoicedate: { type: 'number', nullable: true, description: 'Invoice date timestamp' },
                                invoicenumber: { type: 'string', nullable: true, description: 'Invoice number' },
                                invoiceurl: { type: 'string', nullable: true, description: 'Invoice URL' },
                                paymentdata: {
                                    oneOf: [
                                        {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    id: { type: 'number', description: 'Payment ID' },
                                                    comments: { type: 'string', nullable: true, description: 'Payment comments' },
                                                    paymentdate: { type: 'string', nullable: true, description: 'Payment date' },
                                                    paymenttype: { type: 'string', nullable: true, description: 'Payment type (e.g., "Part Payment", "Full Payment")' },
                                                    paymentamount: { type: 'number', nullable: true, description: 'Payment amount' },
                                                    paymentmethod: { type: 'string', nullable: true, description: 'Payment method (e.g., "banktransfer", "cash", "cheque")' },
                                                    transactionid: { type: 'string', nullable: true, description: 'Transaction ID' },
                                                    receiptcomments: { type: 'string', nullable: true, description: 'Receipt comments' }
                                                },
                                                additionalProperties: true
                                            }
                                        },
                                        { type: 'object', additionalProperties: true },
                                        { type: 'null' }
                                    ],
                                    description: 'Payment data JSON - can be array of payment objects or single object'
                                },
                                createddate: { type: 'number', nullable: true, description: 'Creation timestamp' },
                                modifieddate: { type: 'number', nullable: true, description: 'Modification timestamp' },
                                balanceamount: { type: 'number', nullable: true, description: 'Balance amount' },
                                iscreditpayment: { type: 'boolean', nullable: true, description: 'Is credit payment' },
                                paymentduedate: { type: 'number', nullable: true, description: 'Payment due date timestamp' },
                                invoicestatus: { type: 'string', nullable: true, description: 'Invoice status' },
                                pototal: { type: 'number', nullable: true, description: 'PO total' },
                                purchaseorderstatus: { type: 'string', nullable: true, description: 'Purchase order status' },
                                transportationcharges: { type: 'number', nullable: true, description: 'Transportation charges' },
                                exchangeamount: { type: 'number', nullable: true, description: 'Exchange amount' },
                                customdutytaxamount: { type: 'number', nullable: true, description: 'Custom duty tax amount' },
                                suppliertype: { type: 'string', nullable: true, description: 'Supplier type' },
                                customdutychallanurl: { type: 'string', nullable: true, description: 'Custom duty challan URL' },
                                billofentryurl: { type: 'string', nullable: true, description: 'Bill of entry URL' },
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
    }, poinvoiceController.createPoinvoice.bind(poinvoiceController));
    // PUT /v1/poinvoices/:id - Update poinvoice
    fastify.put('/:id', {
        schema: {
            description: 'Update an existing poinvoice',
            tags: ['PO Invoices'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Poinvoice ID' },
                },
                required: ['id'],
            },
            body: {
                type: 'object',
                properties: {
                    invoiceamount: { type: 'number', description: 'Invoice amount' },
                    ponumber: { type: 'string', maxLength: 500, description: 'PO number' },
                    invoicedate: { type: 'number', description: 'Invoice date timestamp' },
                    invoicenumber: { type: 'string', maxLength: 500, description: 'Invoice number' },
                    invoiceurl: { type: 'string', maxLength: 500, description: 'Invoice URL' },
                    paymentdata: {
                        oneOf: [
                            {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'number', description: 'Payment ID' },
                                        comments: { type: 'string', nullable: true, description: 'Payment comments' },
                                        paymentdate: { type: 'string', nullable: true, description: 'Payment date' },
                                        paymenttype: { type: 'string', nullable: true, description: 'Payment type (e.g., "Part Payment", "Full Payment")' },
                                        paymentamount: { type: 'number', nullable: true, description: 'Payment amount' },
                                        paymentmethod: { type: 'string', nullable: true, description: 'Payment method (e.g., "banktransfer", "cash", "cheque")' },
                                        transactionid: { type: 'string', nullable: true, description: 'Transaction ID' },
                                        receiptcomments: { type: 'string', nullable: true, description: 'Receipt comments' }
                                    },
                                    additionalProperties: true
                                }
                            },
                            { type: 'object', additionalProperties: true },
                            { type: 'null' }
                        ],
                        description: 'Payment data JSON - can be array of payment objects or single object'
                    },
                    modifieddate: { type: 'number', description: 'Modification timestamp (optional, auto-generated if not provided)' },
                    balanceamount: { type: 'number', description: 'Balance amount' },
                    iscreditpayment: { type: 'boolean', description: 'Is credit payment' },
                    paymentduedate: { type: 'number', description: 'Payment due date timestamp' },
                    invoicestatus: { type: 'string', maxLength: 100, description: 'Invoice status' },
                    pototal: { type: 'number', description: 'PO total' },
                    purchaseorderstatus: { type: 'string', maxLength: 500, description: 'Purchase order status' },
                    transportationcharges: { type: 'number', description: 'Transportation charges' },
                    exchangeamount: { type: 'number', description: 'Exchange amount' },
                    customdutytaxamount: { type: 'number', description: 'Custom duty tax amount' },
                    suppliertype: { type: 'string', maxLength: 255, description: 'Supplier type' },
                    customdutychallanurl: { type: 'string', maxLength: 255, description: 'Custom duty challan URL' },
                    billofentryurl: { type: 'string', maxLength: 255, description: 'Bill of entry URL' },
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
                            properties: {
                                id: { type: 'number', description: 'Poinvoice ID' },
                                invoiceamount: { type: 'number', nullable: true, description: 'Invoice amount' },
                                ponumber: { type: 'string', nullable: true, description: 'PO number' },
                                invoicedate: { type: 'number', nullable: true, description: 'Invoice date timestamp' },
                                invoicenumber: { type: 'string', nullable: true, description: 'Invoice number' },
                                invoiceurl: { type: 'string', nullable: true, description: 'Invoice URL' },
                                paymentdata: {
                                    oneOf: [
                                        {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    id: { type: 'number', description: 'Payment ID' },
                                                    comments: { type: 'string', nullable: true, description: 'Payment comments' },
                                                    paymentdate: { type: 'string', nullable: true, description: 'Payment date' },
                                                    paymenttype: { type: 'string', nullable: true, description: 'Payment type (e.g., "Part Payment", "Full Payment")' },
                                                    paymentamount: { type: 'number', nullable: true, description: 'Payment amount' },
                                                    paymentmethod: { type: 'string', nullable: true, description: 'Payment method (e.g., "banktransfer", "cash", "cheque")' },
                                                    transactionid: { type: 'string', nullable: true, description: 'Transaction ID' },
                                                    receiptcomments: { type: 'string', nullable: true, description: 'Receipt comments' }
                                                },
                                                additionalProperties: true
                                            }
                                        },
                                        { type: 'object', additionalProperties: true },
                                        { type: 'null' }
                                    ],
                                    description: 'Payment data JSON - can be array of payment objects or single object'
                                },
                                createddate: { type: 'number', nullable: true, description: 'Creation timestamp' },
                                modifieddate: { type: 'number', nullable: true, description: 'Modification timestamp' },
                                balanceamount: { type: 'number', nullable: true, description: 'Balance amount' },
                                iscreditpayment: { type: 'boolean', nullable: true, description: 'Is credit payment' },
                                paymentduedate: { type: 'number', nullable: true, description: 'Payment due date timestamp' },
                                invoicestatus: { type: 'string', nullable: true, description: 'Invoice status' },
                                pototal: { type: 'number', nullable: true, description: 'PO total' },
                                purchaseorderstatus: { type: 'string', nullable: true, description: 'Purchase order status' },
                                transportationcharges: { type: 'number', nullable: true, description: 'Transportation charges' },
                                exchangeamount: { type: 'number', nullable: true, description: 'Exchange amount' },
                                customdutytaxamount: { type: 'number', nullable: true, description: 'Custom duty tax amount' },
                                suppliertype: { type: 'string', nullable: true, description: 'Supplier type' },
                                customdutychallanurl: { type: 'string', nullable: true, description: 'Custom duty challan URL' },
                                billofentryurl: { type: 'string', nullable: true, description: 'Bill of entry URL' },
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
    }, poinvoiceController.updatePoinvoice.bind(poinvoiceController));
    // DELETE /v1/poinvoices/:id - Delete poinvoice
    fastify.delete('/:id', {
        schema: {
            description: 'Delete a poinvoice by ID',
            tags: ['PO Invoices'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Poinvoice ID' },
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
    }, poinvoiceController.deletePoinvoice.bind(poinvoiceController));
    // PUT /v1/poinvoices - Upsert poinvoice
    fastify.put('/', {
        schema: {
            description: 'Create or update a poinvoice (upsert operation)',
            tags: ['PO Invoices'],
            body: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Poinvoice ID (optional for create, required for update)' },
                    invoiceamount: { type: 'number', description: 'Invoice amount' },
                    ponumber: { type: 'string', maxLength: 500, description: 'PO number' },
                    invoicedate: { type: 'number', description: 'Invoice date timestamp' },
                    invoicenumber: { type: 'string', maxLength: 500, description: 'Invoice number' },
                    invoiceurl: { type: 'string', maxLength: 500, description: 'Invoice URL' },
                    paymentdata: {
                        oneOf: [
                            {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'number', description: 'Payment ID' },
                                        comments: { type: 'string', nullable: true, description: 'Payment comments' },
                                        paymentdate: { type: 'string', nullable: true, description: 'Payment date' },
                                        paymenttype: { type: 'string', nullable: true, description: 'Payment type (e.g., "Part Payment", "Full Payment")' },
                                        paymentamount: { type: 'number', nullable: true, description: 'Payment amount' },
                                        paymentmethod: { type: 'string', nullable: true, description: 'Payment method (e.g., "banktransfer", "cash", "cheque")' },
                                        transactionid: { type: 'string', nullable: true, description: 'Transaction ID' },
                                        receiptcomments: { type: 'string', nullable: true, description: 'Receipt comments' }
                                    },
                                    additionalProperties: true
                                }
                            },
                            { type: 'object', additionalProperties: true },
                            { type: 'null' }
                        ],
                        description: 'Payment data JSON - can be array of payment objects or single object'
                    },
                    createddate: { type: 'number', description: 'Creation timestamp (optional, auto-generated if not provided)' },
                    modifieddate: { type: 'number', description: 'Modification timestamp (optional, auto-generated if not provided)' },
                    balanceamount: { type: 'number', description: 'Balance amount' },
                    iscreditpayment: { type: 'boolean', description: 'Is credit payment' },
                    paymentduedate: { type: 'number', description: 'Payment due date timestamp' },
                    invoicestatus: { type: 'string', maxLength: 100, description: 'Invoice status' },
                    pototal: { type: 'number', description: 'PO total' },
                    purchaseorderstatus: { type: 'string', maxLength: 500, description: 'Purchase order status' },
                    transportationcharges: { type: 'number', description: 'Transportation charges' },
                    exchangeamount: { type: 'number', description: 'Exchange amount' },
                    customdutytaxamount: { type: 'number', description: 'Custom duty tax amount' },
                    suppliertype: { type: 'string', maxLength: 255, description: 'Supplier type' },
                    customdutychallanurl: { type: 'string', maxLength: 255, description: 'Custom duty challan URL' },
                    billofentryurl: { type: 'string', maxLength: 255, description: 'Bill of entry URL' },
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
                            properties: {
                                id: { type: 'number', description: 'Poinvoice ID' },
                                invoiceamount: { type: 'number', nullable: true, description: 'Invoice amount' },
                                ponumber: { type: 'string', nullable: true, description: 'PO number' },
                                invoicedate: { type: 'number', nullable: true, description: 'Invoice date timestamp' },
                                invoicenumber: { type: 'string', nullable: true, description: 'Invoice number' },
                                invoiceurl: { type: 'string', nullable: true, description: 'Invoice URL' },
                                paymentdata: {
                                    oneOf: [
                                        {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    id: { type: 'number', description: 'Payment ID' },
                                                    comments: { type: 'string', nullable: true, description: 'Payment comments' },
                                                    paymentdate: { type: 'string', nullable: true, description: 'Payment date' },
                                                    paymenttype: { type: 'string', nullable: true, description: 'Payment type (e.g., "Part Payment", "Full Payment")' },
                                                    paymentamount: { type: 'number', nullable: true, description: 'Payment amount' },
                                                    paymentmethod: { type: 'string', nullable: true, description: 'Payment method (e.g., "banktransfer", "cash", "cheque")' },
                                                    transactionid: { type: 'string', nullable: true, description: 'Transaction ID' },
                                                    receiptcomments: { type: 'string', nullable: true, description: 'Receipt comments' }
                                                },
                                                additionalProperties: true
                                            }
                                        },
                                        { type: 'object', additionalProperties: true },
                                        { type: 'null' }
                                    ],
                                    description: 'Payment data JSON - can be array of payment objects or single object'
                                },
                                createddate: { type: 'number', nullable: true, description: 'Creation timestamp' },
                                modifieddate: { type: 'number', nullable: true, description: 'Modification timestamp' },
                                balanceamount: { type: 'number', nullable: true, description: 'Balance amount' },
                                iscreditpayment: { type: 'boolean', nullable: true, description: 'Is credit payment' },
                                paymentduedate: { type: 'number', nullable: true, description: 'Payment due date timestamp' },
                                invoicestatus: { type: 'string', nullable: true, description: 'Invoice status' },
                                pototal: { type: 'number', nullable: true, description: 'PO total' },
                                purchaseorderstatus: { type: 'string', nullable: true, description: 'Purchase order status' },
                                transportationcharges: { type: 'number', nullable: true, description: 'Transportation charges' },
                                exchangeamount: { type: 'number', nullable: true, description: 'Exchange amount' },
                                customdutytaxamount: { type: 'number', nullable: true, description: 'Custom duty tax amount' },
                                suppliertype: { type: 'string', nullable: true, description: 'Supplier type' },
                                customdutychallanurl: { type: 'string', nullable: true, description: 'Custom duty challan URL' },
                                billofentryurl: { type: 'string', nullable: true, description: 'Bill of entry URL' },
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
    }, poinvoiceController.upsertPoinvoice.bind(poinvoiceController));
}
//# sourceMappingURL=poinvoice.route.js.map