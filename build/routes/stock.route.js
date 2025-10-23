import { StockController } from '../controllers/stock.controller.js';
export async function stockRoutes(fastify) {
    const stockController = new StockController();
    // GET /v1/stocks - Get all stocks with pagination and filtering
    fastify.get('/', {
        schema: {
            description: 'Get all stocks with pagination and filtering',
            tags: ['Stocks'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number' },
                    limit: { type: 'string', description: 'Items per page' },
                    // Current Stock model fields
                    puc: { type: 'string', description: 'Filter by product unique code' },
                    platform: { type: 'string', description: 'Filter by platform (amazon, flipkart, nivapp)' },
                    sku: { type: 'string', description: 'Filter by stock keeping unit' },
                    batchno: { type: 'string', description: 'Filter by batch number' },
                    poid: { type: 'string', description: 'Filter by purchase order ID' },
                    supplierid: { type: 'string', description: 'Filter by supplier ID' },
                    stockstatus: { type: 'string', description: 'Filter by stock status' },
                    serialnumber: { type: 'string', description: 'Filter by serial number' },
                    orderid: { type: 'string', description: 'Filter by order ID' },
                    orderlinenumber: { type: 'string', description: 'Filter by order line number' },
                    isdeleted: { type: 'string', description: 'Filter by deletion status (true/false)' },
                    isarchive: { type: 'string', description: 'Filter by archive status (true/false)' },
                    removefromrecyclebin: { type: 'string', description: 'Filter by recycle bin status (true/false)' },
                    ecompublish: {
                        anyOf: [
                            { type: 'boolean' },
                            { type: 'string' }
                        ],
                        description: 'Filter by e-commerce publish status (true/false)'
                    },
                    rfid: { type: 'string', description: 'Filter by RFID tag' },
                    minManufacturedYear: { type: 'string', description: 'Minimum manufactured year' },
                    maxManufacturedYear: { type: 'string', description: 'Maximum manufactured year' },
                    minReleaseYear: { type: 'string', description: 'Minimum release year' },
                    maxReleaseYear: { type: 'string', description: 'Maximum release year' },
                    createdAfter: { type: 'string', description: 'Created after date (timestamp)' },
                    createdBefore: { type: 'string', description: 'Created before date (timestamp)' },
                    modifiedAfter: { type: 'string', description: 'Modified after date (timestamp)' },
                    modifiedBefore: { type: 'string', description: 'Modified before date (timestamp)' },
                    // Legacy field support
                    productId: { type: 'string', description: 'Filter by product ID (legacy)' },
                    batchNumber: { type: 'string', description: 'Filter by batch number (legacy)' },
                    warehouseLocation: { type: 'string', description: 'Filter by warehouse location (legacy)' },
                },
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
                                    id: { type: 'number', description: 'Stock ID' },
                                    puc: { type: 'string', description: 'Product unique code' },
                                    platform: { type: 'string', description: 'Platform (amazon, flipkart, nivapp)' },
                                    sku: { type: 'string', description: 'Stock keeping unit (auto-generated)' },
                                    serialnumber: { type: 'string', nullable: true, description: 'Serial number' },
                                    stockstatus: { type: 'string', description: 'Stock status' },
                                    manufacturedyear: { type: 'number', nullable: true, description: 'Manufactured year' },
                                    releaseyear: { type: 'number', nullable: true, description: 'Release year' },
                                    isdeleted: { type: 'boolean', nullable: true, description: 'Deletion status' },
                                    isarchive: { type: 'boolean', nullable: true, description: 'Archive status' },
                                    removefromrecyclebin: { type: 'boolean', nullable: true, description: 'Recycle bin status' },
                                    ecompublish: { type: 'boolean', nullable: true, description: 'E-commerce publish status' },
                                    solddate: { type: 'number', nullable: true, description: 'Sold date timestamp' },
                                    orderlinenumber: { type: 'string', nullable: true, description: 'Order line number' },
                                    orderid: { type: 'string', nullable: true, description: 'Order ID' },
                                    poid: { type: 'number', nullable: true, description: 'Purchase order ID' },
                                    supplierid: { type: 'number', nullable: true, description: 'Supplier ID' },
                                    batchno: { type: 'string', nullable: true, description: 'Batch number' },
                                    platformhistory: { type: 'object', nullable: true, description: 'Platform transfer history' },
                                    rfid: { type: 'string', nullable: true, description: 'RFID tag' },
                                    rfidscannedtime: { type: 'number', nullable: true, description: 'RFID scan timestamp' },
                                    createddate: { type: 'number', nullable: true, description: 'Creation timestamp' },
                                    modifieddate: { type: 'number', nullable: true, description: 'Modification timestamp' },
                                    // Legacy field support
                                    productId: { type: 'string', nullable: true, description: 'Product ID (legacy)' },
                                    batchNumber: { type: 'string', nullable: true, description: 'Batch number (legacy)' },
                                    warehouseLocation: { type: 'string', nullable: true, description: 'Warehouse location (legacy)' },
                                    quantity: { type: 'number', nullable: true, description: 'Quantity (legacy)' },
                                    availableQuantity: { type: 'number', nullable: true, description: 'Available quantity (legacy)' },
                                    soldQuantity: { type: 'number', nullable: true, description: 'Sold quantity (legacy)' },
                                },
                                additionalProperties: true // Allow additional dynamic fields
                            }
                        },
                        summary: {
                            type: 'object',
                            nullable: true,
                            properties: {
                                quantity: { type: 'number', description: 'Total stock quantity for the PUC' },
                                availablequantity: { type: 'number', description: 'Available quantity for the PUC' },
                                orderedquantity: { type: 'number', description: 'Ordered quantity for the PUC' },
                                soldquantity: { type: 'number', description: 'Sold quantity for the PUC' },
                                ecompublishedquantity: { type: 'number', description: 'E-commerce published quantity for the PUC' },
                                locations: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            location: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Stock location label (null when unknown)' },
                                            quantity: { type: 'number', description: 'Total stocks at this location' },
                                            availablequantity: { type: 'number', description: 'Available stocks at this location' },
                                            orderedquantity: { type: 'number', description: 'Ordered stocks at this location' },
                                            soldquantity: { type: 'number', description: 'Sold stocks at this location' },
                                            ecompublishedquantity: { type: 'number', description: 'E-commerce published stocks at this location' }
                                        },
                                        additionalProperties: false
                                    }
                                }
                            },
                            additionalProperties: false
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
            },
        },
    }, stockController.getStocks.bind(stockController));
    // GET /v1/stocks/:id - Get stock by ID
    fastify.get('/:id', {
        schema: {
            description: 'Get stock by ID',
            tags: ['Stocks'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Stock ID' },
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
                            additionalProperties: true // Allow any fields in stock object
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
            if (!id || id.trim() === '' || !/^\d+$/.test(id)) {
                const errorResponse = {
                    success: false,
                    message: 'Invalid ID format. ID must be an integer.',
                    details: `The provided ID '${id}' is not a valid integer format.`,
                    statusCode: 400
                };
                return reply.code(400).send(errorResponse);
            }
            // Call the service method directly
            const stock = await stockController.stockService.findById(id);
            const response = {
                success: true,
                message: 'Stock retrieved successfully',
                data: stock
            };
            return reply.code(200).send(response);
        }
        catch (error) {
            console.log('=== STOCK GET ERROR:', error.message);
            if (error.message.includes('not found')) {
                const errorResponse = {
                    success: false,
                    message: `Stock with ID ${request.params.id} not found`,
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
    // POST /v1/stocks - Create new stock
    fastify.post('/', {
        schema: {
            description: 'Create a new stock entry',
            tags: ['Stocks'],
            body: {
                type: 'object',
                properties: {
                    // Required fields
                    puc: { type: 'string', maxLength: 255, description: 'Product unique code (required)' },
                    platform: { type: 'string', maxLength: 100, description: 'Platform (amazon, flipkart, nivapp) (required)' },
                    // Auto-generated fields
                    sku: { type: 'string', maxLength: 255, description: 'Stock keeping unit (auto-generated)' },
                    // Optional fields
                    serialnumber: { type: 'string', maxLength: 500, description: 'Serial number (unique)' },
                    stockstatus: { type: 'string', maxLength: 500, description: 'Stock status', default: 'available' },
                    manufacturedyear: { type: 'number', description: 'Manufactured year' },
                    releaseyear: { type: 'number', description: 'Release year' },
                    isdeleted: { type: 'boolean', description: 'Deletion status', default: false },
                    isarchive: { type: 'boolean', description: 'Archive status', default: false },
                    removefromrecyclebin: { type: 'boolean', description: 'Recycle bin status', default: false },
                    ecompublish: { type: 'boolean', description: 'E-commerce publish status', default: false },
                    solddate: { type: 'number', description: 'Sold date timestamp' },
                    orderlinenumber: { type: 'string', maxLength: 500, description: 'Order line number' },
                    orderid: { type: 'string', maxLength: 500, description: 'Order ID' },
                    poid: { type: 'number', description: 'Purchase order ID' },
                    supplierid: { type: 'number', description: 'Supplier ID' },
                    batchno: { type: 'string', maxLength: 255, description: 'Batch number' },
                    platformhistory: { type: 'object', description: 'Platform transfer history (JSON)' },
                    rfid: { type: 'string', maxLength: 500, description: 'RFID tag' },
                    rfidscannedtime: { type: 'number', description: 'RFID scan timestamp' },
                    // Legacy field support
                    productId: { type: 'string', description: 'Product ID (legacy)' },
                    batchNumber: { type: 'string', description: 'Batch number (legacy)' },
                    warehouseLocation: { type: 'string', description: 'Warehouse location (legacy)' },
                    quantity: { type: 'number', description: 'Quantity (legacy)' },
                    availableQuantity: { type: 'number', description: 'Available quantity (legacy)' },
                    soldQuantity: { type: 'number', description: 'Sold quantity (legacy)' },
                },
                additionalProperties: true, // Allow additional dynamic fields
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in stock object
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
    }, stockController.createStock.bind(stockController));
    // Legacy bulk insert endpoint (old method)
    fastify.post('/bulk-insert-old', {
        schema: {
            description: 'Create multiple stock entries in bulk',
            tags: ['Stocks'],
            body: {
                type: 'array',
                minItems: 1,
                items: {
                    type: 'object',
                    properties: {
                        puc: { type: 'string', maxLength: 255, description: 'Product unique code (required)' },
                        platform: { type: 'string', maxLength: 100, description: 'Platform (amazon, flipkart, nivapp) (required)' },
                        sku: { type: 'string', maxLength: 255, description: 'Stock keeping unit (auto-generated)', nullable: true },
                        serialnumber: { type: 'string', maxLength: 500, description: 'Serial number (unique)', nullable: true },
                        stockstatus: { type: 'string', maxLength: 500, description: 'Stock status', default: 'available' },
                        manufacturedyear: { type: 'number', description: 'Manufactured year', nullable: true },
                        releaseyear: { type: 'number', description: 'Release year', nullable: true },
                        isdeleted: { type: 'boolean', description: 'Deletion status', default: false },
                        isarchive: { type: 'boolean', description: 'Archive status', default: false },
                        removefromrecyclebin: { type: 'boolean', description: 'Recycle bin status', default: false },
                        ecompublish: { type: 'boolean', description: 'E-commerce publish status', default: false },
                        solddate: { type: 'number', description: 'Sold date timestamp', nullable: true },
                        orderlinenumber: { type: 'string', maxLength: 500, description: 'Order line number', nullable: true },
                        orderid: { type: 'string', maxLength: 500, description: 'Order ID', nullable: true },
                        poid: { type: 'number', description: 'Purchase order ID', nullable: true },
                        supplierid: { type: 'number', description: 'Supplier ID', nullable: true },
                        batchno: { type: 'string', maxLength: 255, description: 'Batch number', nullable: true },
                        platformhistory: { type: 'object', description: 'Platform transfer history (JSON)', nullable: true },
                        rfid: { type: 'string', maxLength: 500, description: 'RFID tag', nullable: true },
                        rfidscannedtime: { type: 'number', description: 'RFID scan timestamp', nullable: true },
                        productId: { type: 'string', description: 'Product ID (legacy)', nullable: true },
                        batchNumber: { type: 'string', description: 'Batch number (legacy)', nullable: true },
                        warehouseLocation: { type: 'string', description: 'Warehouse location (legacy)', nullable: true },
                        quantity: { type: 'number', description: 'Quantity (legacy)', nullable: true },
                        availableQuantity: { type: 'number', description: 'Available quantity (legacy)', nullable: true },
                        soldQuantity: { type: 'number', description: 'Sold quantity (legacy)', nullable: true },
                    },
                    required: ['puc', 'platform'],
                    additionalProperties: true,
                },
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        insertedCount: { type: 'number' },
                        failures: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    index: { type: 'number' },
                                    error: { type: 'string' },
                                },
                            },
                        },
                    },
                },
            },
        },
    }, stockController.createBulkStocksLegacy.bind(stockController));
    // New optimized bulk insert endpoint (direct DB insert)
    fastify.post('/bulk-insert', {
        schema: {
            description: 'Create multiple stock entries in bulk with optimized batch processing and quantity-based expansion',
            tags: ['Stocks'],
            querystring: {
                type: 'object',
                properties: {
                    batchSize: { type: 'string', description: 'Number of records per batch (default: 100, max: 200, min: 10)' },
                },
            },
            body: {
                type: 'array',
                minItems: 1,
                items: {
                    type: 'object',
                    properties: {
                        puc: { type: 'string', maxLength: 255, description: 'Product unique code (required)' },
                        platform: { type: 'string', maxLength: 100, description: 'Platform (amazon, flipkart, nivapp) (required)' },
                        serialnumber: { type: 'string', maxLength: 500, description: 'Serial number (unique)', nullable: true },
                        stockstatus: { type: 'string', maxLength: 500, description: 'Stock status', default: 'available' },
                        manufacturedyear: { type: 'number', description: 'Manufactured year', nullable: true },
                        releaseyear: { type: 'number', description: 'Release year', nullable: true },
                        ecompublish: { type: 'boolean', description: 'E-commerce publish status', default: false },
                        poid: { type: 'number', description: 'Purchase order ID', nullable: true },
                        supplierid: { type: 'number', description: 'Supplier ID', nullable: true },
                        batchno: { type: 'string', maxLength: 255, description: 'Batch number', nullable: true },
                        // Enhanced field for instance-based bulk insert
                        instances: { type: 'number', minimum: 1, maximum: 10000, description: 'Number of identical records to create (1-10000). This object will be replicated N times.', nullable: false },
                    },
                    required: ['puc', 'platform', 'instances'],
                    additionalProperties: true,
                },
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        insertedCount: { type: 'number' },
                        failures: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    index: { type: 'number' },
                                    error: { type: 'string' },
                                },
                            },
                        },
                        summary: {
                            type: 'object',
                            properties: {
                                total: { type: 'number' },
                                processed: { type: 'number' },
                                successful: { type: 'number' },
                                failed: { type: 'number' },
                                batchesProcessed: { type: 'number' },
                            },
                        },
                        productUpdates: {
                            type: 'object',
                            properties: {
                                attempted: { type: 'number' },
                                succeeded: { type: 'number' },
                                failed: { type: 'number' },
                                failures: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            identifier: { type: 'string' },
                                            message: { type: 'string' },
                                        },
                                    },
                                },
                            },
                            required: ['attempted', 'succeeded', 'failed', 'failures'],
                        },
                        platformStockUpdates: {
                            type: 'object',
                            properties: {
                                attempted: { type: 'number' },
                                succeeded: { type: 'number' },
                                failed: { type: 'number' },
                                failures: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            productId: { type: 'number' },
                                            platform: { type: 'string' },
                                            message: { type: 'string' },
                                        },
                                    },
                                },
                            },
                            required: ['attempted', 'succeeded', 'failed', 'failures'],
                        },
                    },
                    required: ['success', 'insertedCount', 'failures', 'summary', 'productUpdates', 'platformStockUpdates'],
                },
                207: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        insertedCount: { type: 'number' },
                        failures: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    index: { type: 'number' },
                                    error: { type: 'string' },
                                },
                            },
                        },
                        summary: {
                            type: 'object',
                            properties: {
                                total: { type: 'number' },
                                processed: { type: 'number' },
                                successful: { type: 'number' },
                                failed: { type: 'number' },
                                batchesProcessed: { type: 'number' },
                            },
                        },
                        productUpdates: {
                            type: 'object',
                            properties: {
                                attempted: { type: 'number' },
                                succeeded: { type: 'number' },
                                failed: { type: 'number' },
                                failures: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            identifier: { type: 'string' },
                                            message: { type: 'string' },
                                        },
                                    },
                                },
                            },
                            required: ['attempted', 'succeeded', 'failed', 'failures'],
                        },
                        platformStockUpdates: {
                            type: 'object',
                            properties: {
                                attempted: { type: 'number' },
                                succeeded: { type: 'number' },
                                failed: { type: 'number' },
                                failures: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            productId: { type: 'number' },
                                            platform: { type: 'string' },
                                            message: { type: 'string' },
                                        },
                                    },
                                },
                            },
                            required: ['attempted', 'succeeded', 'failed', 'failures'],
                        },
                    },
                    required: ['success', 'insertedCount', 'failures', 'summary', 'productUpdates', 'platformStockUpdates'],
                },
            },
        },
    }, stockController.createBulkStocks.bind(stockController));
    // PUT /v1/stocks/:id - Update stock
    fastify.put('/:id', {
        schema: {
            description: 'Update stock by ID',
            tags: ['Stocks'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Stock ID' },
                },
                required: ['id'],
            },
            body: {
                type: 'object',
                properties: {
                    // Updateable fields
                    puc: { type: 'string', maxLength: 255, description: 'Product unique code' },
                    platform: { type: 'string', maxLength: 100, description: 'Platform (amazon, flipkart, nivapp)' },
                    serialnumber: { type: 'string', maxLength: 500, description: 'Serial number (unique)' },
                    stockstatus: { type: 'string', maxLength: 500, description: 'Stock status' },
                    manufacturedyear: { type: 'number', description: 'Manufactured year' },
                    releaseyear: { type: 'number', description: 'Release year' },
                    isdeleted: { type: 'boolean', description: 'Deletion status' },
                    isarchive: { type: 'boolean', description: 'Archive status' },
                    removefromrecyclebin: { type: 'boolean', description: 'Recycle bin status' },
                    ecompublish: { type: 'boolean', description: 'E-commerce publish status' },
                    solddate: { type: 'number', description: 'Sold date timestamp' },
                    orderlinenumber: { type: 'string', maxLength: 500, description: 'Order line number' },
                    orderid: { type: 'string', maxLength: 500, description: 'Order ID' },
                    poid: { type: 'number', description: 'Purchase order ID' },
                    supplierid: { type: 'number', description: 'Supplier ID' },
                    batchno: { type: 'string', maxLength: 255, description: 'Batch number' },
                    platformhistory: { type: 'object', description: 'Platform transfer history (JSON)' },
                    rfid: { type: 'string', maxLength: 500, description: 'RFID tag' },
                    rfidscannedtime: { type: 'number', description: 'RFID scan timestamp' },
                    // Legacy field support
                    productId: { type: 'string', description: 'Product ID (legacy)' },
                    batchNumber: { type: 'string', description: 'Batch number (legacy)' },
                    warehouseLocation: { type: 'string', description: 'Warehouse location (legacy)' },
                    quantity: { type: 'number', description: 'Quantity (legacy)' },
                    availableQuantity: { type: 'number', description: 'Available quantity (legacy)' },
                    soldQuantity: { type: 'number', description: 'Sold quantity (legacy)' },
                },
                additionalProperties: true, // Allow additional dynamic fields
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in stock object
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
            // Update the stock
            const stock = await stockController.stockService.update(id, request.body);
            const response = {
                success: true,
                message: 'Stock updated successfully',
                data: stock
            };
            return reply.code(200).send(response);
        }
        catch (error) {
            console.log('=== STOCK PUT ERROR:', error.message);
            if (error.message.includes('not found')) {
                const errorResponse = {
                    success: false,
                    message: `Stock with ID ${request.params.id} not found`,
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
    // DELETE /v1/stocks/:id - Delete stock
    fastify.delete('/:id', {
        schema: {
            description: 'Delete stock by ID',
            tags: ['Stocks'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Stock ID' },
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
                409: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        message: { type: "string" },
                        details: { type: "string" },
                        statusCode: { type: "number" },
                        errorCode: { type: "string" },
                        blockingRecords: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    table: { type: "string", description: "Table name containing the blocking record" },
                                    recordId: { type: ["string", "number"], description: "ID of the blocking record" },
                                    details: {
                                        type: "object",
                                        description: "Detailed information about the blocking record",
                                        additionalProperties: true
                                    }
                                }
                            }
                        },
                        constraintInfo: {
                            type: "object",
                            properties: {
                                constraintName: { type: "string", description: "Foreign key constraint name" },
                                referencedTable: { type: "string", description: "Table being referenced" }
                            }
                        }
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
            // Delete the stock
            await stockController.stockService.delete(id);
            const response = {
                success: true,
                message: 'Stock deleted successfully'
            };
            return reply.code(200).send(response);
        }
        catch (error) {
            const { handleDeleteError } = await import('../utils/dynamicDbOperations.js');
            return await handleDeleteError(error, 'stock', request.params.id, reply);
        }
    });
    // POST /v1/stocks/upsert - Upsert stock
    fastify.post('/upsert', {
        schema: {
            description: 'Create or update stock (upsert)',
            tags: ['Stocks'],
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true // Allow any fields in stock object
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
    }, stockController.upsertStock.bind(stockController));
    // PATCH /v1/stocks/:id/quantities - Update stock quantities only
    fastify.patch('/:id/quantities', {
        schema: {
            description: 'Update stock quantities only',
            tags: ['Stocks'],
            params: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Stock ID' },
                },
                required: ['id'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: { type: 'object' },
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
    }, stockController.updateQuantities.bind(stockController));
    // POST /v1/stocks/rfid-update - Update stock by RFID scan
    fastify.post('/rfid-update', {
        schema: {
            description: 'Update stock status and order line by RFID scan',
            tags: ['Stocks'],
            body: {
                type: 'object',
                properties: {
                    rfid: {
                        type: 'string',
                        description: 'RFID tag identifier',
                        minLength: 1,
                        maxLength: 500
                    },
                    orderlineid: {
                        type: 'string',
                        description: 'Order line ID to associate with this stock',
                        minLength: 1,
                        maxLength: 500
                    },
                },
                required: ['rfid', 'orderlineid'],
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            additionalProperties: true,
                            description: 'Updated stock object'
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
    }, stockController.updateStockByRfid.bind(stockController));
    // POST /v1/stocks/bulk-rfid-update - Bulk update stocks by RFID scan
    fastify.post('/bulk-rfid-update', {
        schema: {
            description: 'Update multiple stocks status and order lines by RFID scan',
            tags: ['Stocks'],
            body: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        rfid: {
                            type: 'string',
                            description: 'RFID tag identifier',
                            minLength: 1,
                            maxLength: 500
                        },
                        orderlineid: {
                            type: 'string',
                            description: 'Order line ID to associate with this stock',
                            minLength: 1,
                            maxLength: 500
                        },
                    },
                    required: ['rfid', 'orderlineid'],
                },
                minItems: 1,
                maxItems: 100,
                description: 'Array of RFID and order line ID pairs to update'
            },
            response: {
                200: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                summary: {
                                    type: 'object',
                                    properties: {
                                        total: { type: 'number' },
                                        successful: { type: 'number' },
                                        failed: { type: 'number' },
                                        successRate: { type: 'string' }
                                    }
                                },
                                results: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        additionalProperties: true
                                    }
                                },
                                errors: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        additionalProperties: true
                                    },
                                    description: 'Failed updates (only present if there are failures)'
                                }
                            }
                        },
                        message: { type: 'string' },
                    },
                },
                207: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        data: {
                            type: 'object',
                            properties: {
                                summary: {
                                    type: 'object',
                                    properties: {
                                        total: { type: 'number' },
                                        successful: { type: 'number' },
                                        failed: { type: 'number' },
                                        successRate: { type: 'string' }
                                    }
                                },
                                results: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        additionalProperties: true
                                    }
                                },
                                errors: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        additionalProperties: true
                                    }
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
    }, stockController.bulkUpdateStockByRfid.bind(stockController));
    // GET /v1/stocks/export - Export stocks to Excel
    fastify.get('/export', {
        schema: {
            description: 'Export stocks to Excel file',
            tags: ['Stocks'],
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'string', description: 'Page number (default: 1)' },
                    limit: { type: 'string', description: 'Items per page (default: 500)' },
                    puc: { type: 'string', description: 'Filter by product unique code' },
                    platform: { type: 'string', description: 'Filter by platform (amazon, flipkart, nivapp)' },
                    sku: { type: 'string', description: 'Filter by SKU' },
                    serialnumber: { type: 'string', description: 'Filter by serial number' },
                    stockstatus: { type: 'string', description: 'Filter by stock status' },
                    ecompublish: { type: 'string', description: 'Filter by e-commerce publish status (true/false)' },
                    minManufacturedYear: { type: 'string', description: 'Minimum manufactured year' },
                    maxManufacturedYear: { type: 'string', description: 'Maximum manufactured year' },
                    minReleaseYear: { type: 'string', description: 'Minimum release year' },
                    maxReleaseYear: { type: 'string', description: 'Maximum release year' },
                    createdAfter: { type: 'string', description: 'Created after date (timestamp)' },
                    createdBefore: { type: 'string', description: 'Created before date (timestamp)' },
                    modifiedAfter: { type: 'string', description: 'Modified after date (timestamp)' },
                    modifiedBefore: { type: 'string', description: 'Modified before date (timestamp)' },
                },
            },
            response: {
                200: {
                    type: 'string',
                    format: 'binary',
                    description: 'Excel file download'
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
    }, stockController.exportStocks.bind(stockController));
    /*
      // POST /v1/stocks/import/preview - Parse and validate Excel import file
      fastify.post('/import/preview', {
        schema: {
          description: 'Parse and validate stock import Excel file before commit',
          tags: ['Stocks'],
          consumes: ['multipart/form-data'],
          body: {
            type: 'object',
            properties: {
              file: {
                isFile: true,
                description: 'Excel file to import',
              },
            },
            required: ['file'],
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
                    summary: {
                      type: 'object',
                      properties: {
                        totalRows: { type: 'number' },
                        success: { type: 'number' },
                        warnings: { type: 'number' },
                        errors: { type: 'number' },
                      },
                      required: ['totalRows', 'success', 'warnings', 'errors'],
                    },
                    rows: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          rowNumber: { type: 'number' },
                          status: { type: 'string', enum: ['success', 'warning', 'error'] },
                          normalized: { type: ['object', 'null'], additionalProperties: true },
                          issues: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                type: { type: 'string', enum: ['error', 'warning'] },
                                field: { type: ['string', 'null'], nullable: true },
                                message: { type: 'string' },
                              },
                              required: ['type', 'message'],
                              additionalProperties: false,
                            },
                          },
                          original: { type: ['object', 'null'], additionalProperties: true, nullable: true },
                        },
                        required: ['rowNumber', 'status', 'issues'],
                        additionalProperties: false,
                      },
                    },
                    validRows: {
                      type: 'array',
                      items: {
                        type: 'object',
                        additionalProperties: true,
                      },
                    },
                    warningRows: {
                      type: 'array',
                      items: {
                        type: 'object',
                        additionalProperties: true,
                      },
                    },
                    errorRows: {
                      type: 'array',
                      items: {
                        type: 'object',
                        additionalProperties: true,
                      },
                    },
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
      }, stockController.importPreview.bind(stockController));
    
      // POST /v1/stocks/import/commit - Persist validated rows
      fastify.post('/import/commit', {
        schema: {
          description: 'Commit validated stock import rows into the database',
          tags: ['Stocks'],
          body: {
            type: 'object',
            properties: {
              rows: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    rowNumber: { type: 'number' },
                    puc: { type: 'string' },
                    rfid: { type: 'string' },
                    serialnumber: { type: 'string' },
                    manufacturedyear: { type: 'number' },
                    releaseyear: { type: 'number' },
                    ecompublish: { type: 'boolean' },
                    location: { type: 'string' },
                  },
                  required: ['rfid', 'serialnumber'],
                  additionalProperties: true,
                },
                minItems: 1,
              },
            },
            required: ['rows'],
          },
          response: {
            201: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
                data: {
                  type: 'object',
                  properties: {
                    summary: {
                      type: 'object',
                      properties: {
                        requested: { type: 'number' },
                        inserted: { type: 'number' },
                        failed: { type: 'number' },
                      },
                    },
                    inserted: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          rowNumber: { type: 'number', nullable: true },
                          data: { type: 'object', additionalProperties: true },
                        },
                      },
                    },
                    failures: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          rowNumber: { type: 'number', nullable: true },
                          serialnumber: { type: 'string', nullable: true },
                          message: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
            207: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
                data: {
                  type: 'object',
                  properties: {
                    summary: {
                      type: 'object',
                      properties: {
                        requested: { type: 'number' },
                        inserted: { type: 'number' },
                        failed: { type: 'number' },
                      },
                    },
                    inserted: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          rowNumber: { type: 'number', nullable: true },
                          data: { type: 'object', additionalProperties: true },
                        },
                      },
                    },
                    failures: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          rowNumber: { type: 'number', nullable: true },
                          serialnumber: { type: 'string', nullable: true },
                          message: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: {
              type: 'object',
              properties: {
                success: { type: 'boolean' },
                message: { type: 'string' },
                statusCode: { type: 'number' },
                data: { type: 'object', additionalProperties: true },
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
      }, stockController.importCommit.bind(stockController));
      */
    // POST /v1/stocks/import-bulk/preview - Parse and validate Excel import file for stocks
    fastify.post('/import/preview', {
        schema: {
            description: 'Parse and validate stock import Excel file before commit',
            tags: ['Stocks'],
            consumes: ['multipart/form-data'],
            body: {
                type: 'object',
                properties: {
                    file: {
                        isFile: true,
                        description: 'Excel file containing stock data to import',
                    },
                },
                required: ['file'],
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
                                summary: {
                                    type: 'object',
                                    properties: {
                                        totalRows: { type: 'number', description: 'Total rows processed' },
                                        success: { type: 'number', description: 'Valid rows count' },
                                        warnings: { type: 'number', description: 'Rows with warnings' },
                                        errors: { type: 'number', description: 'Rows with errors' },
                                    },
                                    required: ['totalRows', 'success', 'warnings', 'errors'],
                                },
                                rows: {
                                    type: 'array',
                                    description: 'Detailed row-by-row validation results',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            rowNumber: { type: 'number', description: 'Excel row number' },
                                            status: { type: 'string', enum: ['success', 'warning', 'error'], description: 'Row validation status' },
                                            normalized: {
                                                type: ['object', 'null'],
                                                additionalProperties: true,
                                                description: 'Normalized stock data ready for insertion'
                                            },
                                            issues: {
                                                type: 'array',
                                                description: 'Validation issues for this row',
                                                items: {
                                                    type: 'object',
                                                    properties: {
                                                        type: { type: 'string', enum: ['error', 'warning'], description: 'Issue severity' },
                                                        field: { type: ['string', 'null'], nullable: true, description: 'Field with issue' },
                                                        message: { type: 'string', description: 'Issue description' },
                                                    },
                                                    required: ['type', 'message'],
                                                    additionalProperties: false,
                                                },
                                            },
                                            original: {
                                                type: ['object', 'null'],
                                                additionalProperties: true,
                                                nullable: true,
                                                description: 'Original Excel row data'
                                            },
                                        },
                                        required: ['rowNumber', 'status', 'issues'],
                                        additionalProperties: false,
                                    },
                                },
                                validRows: {
                                    type: 'array',
                                    description: 'Rows ready for insertion',
                                    items: {
                                        type: 'object',
                                        additionalProperties: true,
                                    },
                                },
                                warningRows: {
                                    type: 'array',
                                    description: 'Rows with warnings but still valid',
                                    items: {
                                        type: 'object',
                                        additionalProperties: true,
                                    },
                                },
                                errorRows: {
                                    type: 'array',
                                    description: 'Rows with validation errors',
                                    items: {
                                        type: 'object',
                                        additionalProperties: true,
                                    },
                                },
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
    }, stockController.importPreview.bind(stockController));
    // POST /v1/stocks/import-bulk/commit - Persist validated stock rows
    fastify.post('/import/commit', {
        schema: {
            description: 'Commit validated stock import rows into the database',
            tags: ['Stocks'],
            body: {
                type: 'object',
                properties: {
                    rows: {
                        type: 'array',
                        description: 'Validated stock rows to insert',
                        items: {
                            type: 'object',
                            properties: {
                                rowNumber: { type: 'number', description: 'Excel row number' },
                                puc: { type: 'string', description: 'Product unique code (mandatory)' },
                                platform: { type: 'string', description: 'Platform (mandatory)' },
                                batchno: { type: 'string', description: 'Batch number (mandatory)' },
                                stockstatus: { type: 'string', description: 'Stock status (mandatory)' },
                                ecompublish: { type: 'boolean', description: 'E-commerce publish status (mandatory)' },
                                serialnumber: { type: 'string', description: 'Serial number (optional)' },
                                rfid: { type: 'string', description: 'RFID tag (optional)' },
                                manufacturedyear: { type: 'number', description: 'Manufactured year (epoch time, optional)' },
                                releaseyear: { type: 'number', description: 'Release year (epoch time, optional)' },
                                poid: { type: 'string', description: 'Purchase Order ID (optional)' },
                                supplierid: { type: 'string', description: 'Supplier ID (optional)' },
                                location: { type: 'string', description: 'Storage location (optional, legacy)' },
                            },
                            required: ['puc', 'platform', 'batchno', 'stockstatus', 'ecompublish'],
                            additionalProperties: true,
                        },
                        minItems: 1,
                    },
                },
                required: ['rows'],
            },
            response: {
                201: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: {
                            type: 'object',
                            properties: {
                                summary: {
                                    type: 'object',
                                    properties: {
                                        requested: { type: 'number', description: 'Total rows requested for insertion' },
                                        inserted: { type: 'number', description: 'Successfully inserted rows' },
                                        failed: { type: 'number', description: 'Failed insertions' },
                                    },
                                },
                                inserted: {
                                    type: 'array',
                                    description: 'Successfully inserted stock records',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            rowNumber: { type: 'number', nullable: true },
                                            data: { type: 'object', additionalProperties: true },
                                        },
                                    },
                                },
                                failures: {
                                    type: 'array',
                                    description: 'Failed insertion attempts',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            rowNumber: { type: 'number', nullable: true },
                                            serialnumber: { type: 'string', nullable: true },
                                            rfid: { type: 'string', nullable: true },
                                            message: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                207: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: {
                            type: 'object',
                            properties: {
                                summary: {
                                    type: 'object',
                                    properties: {
                                        requested: { type: 'number' },
                                        inserted: { type: 'number' },
                                        failed: { type: 'number' },
                                    },
                                },
                                inserted: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            rowNumber: { type: 'number', nullable: true },
                                            data: { type: 'object', additionalProperties: true },
                                        },
                                    },
                                },
                                failures: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            rowNumber: { type: 'number', nullable: true },
                                            serialnumber: { type: 'string', nullable: true },
                                            rfid: { type: 'string', nullable: true },
                                            message: { type: 'string' },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                400: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        statusCode: { type: 'number' },
                        data: { type: 'object', additionalProperties: true },
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
    }, stockController.importCommit.bind(stockController));
}
//# sourceMappingURL=stock.route.js.map