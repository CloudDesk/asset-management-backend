import { FastifyInstance } from 'fastify';
import { StockController } from '../controllers/stock.controller.js';

export async function stockRoutes(fastify: FastifyInstance) {
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
          puc: { type: 'string', description: 'Filter by product unique code' },
          category: { type: 'string', description: 'Filter by category' },
          subcategory: { type: 'string', description: 'Filter by subcategory' },
          brand: { type: 'string', description: 'Filter by brand' },
          model: { type: 'string', description: 'Filter by model' },
          operatingsystem: { type: 'string', description: 'Filter by operating system' },
          ram: { type: 'string', description: 'Filter by RAM specification' },
          storagetype: { type: 'string', description: 'Filter by storage type' },
          storagecapacity: { type: 'string', description: 'Filter by storage capacity' },
          colour: { type: 'string', description: 'Filter by color' },
          processor: { type: 'string', description: 'Filter by processor' },
          serialnumber: { type: 'string', description: 'Filter by serial number' },
          stockstatus: { type: 'string', description: 'Filter by stock status' },
          productname: { type: 'string', description: 'Filter by product name' },
          location: { type: 'string', description: 'Filter by storage location' },
          assetlocation: { type: 'string', description: 'Filter by asset location' },
          orderid: { type: 'string', description: 'Filter by order ID' },
          orderlinenumber: { type: 'string', description: 'Filter by order line number' },
          isdeleted: { type: 'string', description: 'Filter by deletion status (true/false)' },
          isarchive: { type: 'string', description: 'Filter by archive status (true/false)' },
          ecompublish: { type: 'string', description: 'Filter by e-commerce publish status (true/false)' },
          ewaste: { type: 'string', description: 'Filter by e-waste status (true/false)' },
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
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { 
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'number', description: 'Stock ID' },
                  puc: { type: 'string', nullable: true, description: 'Product unique code' },
                  category: { type: 'string', nullable: true, description: 'Product category' },
                  subcategory: { type: 'string', nullable: true, description: 'Product subcategory' },
                  brand: { type: 'string', nullable: true, description: 'Product brand' },
                  model: { type: 'string', nullable: true, description: 'Product model' },
                  operatingsystem: { type: 'string', nullable: true, description: 'Operating system' },
                  operatingsystemversion: { type: 'string', nullable: true, description: 'OS version' },
                  ram: { type: 'string', nullable: true, description: 'RAM specification' },
                  storagetype: { type: 'string', nullable: true, description: 'Storage type' },
                  storagecapacity: { type: 'string', nullable: true, description: 'Storage capacity' },
                  colour: { type: 'string', nullable: true, description: 'Product color' },
                  graphicscard: { type: 'string', nullable: true, description: 'Graphics card' },
                  processor: { type: 'string', nullable: true, description: 'Processor specification' },
                  serialnumber: { type: 'string', nullable: true, description: 'Serial number' },
                  stockstatus: { type: 'string', description: 'Stock status' },
                  manufacturedyear: { type: 'number', nullable: true, description: 'Manufactured year' },
                  releaseyear: { type: 'number', nullable: true, description: 'Release year' },
                  isdeleted: { type: 'boolean', nullable: true, description: 'Deletion status' },
                  isarchive: { type: 'boolean', nullable: true, description: 'Archive status' },
                  removefromrecyclebin: { type: 'boolean', nullable: true, description: 'Recycle bin status' },
                  ecompublish: { type: 'boolean', nullable: true, description: 'E-commerce publish status' },
                  productname: { type: 'string', nullable: true, description: 'Product name' },
                  rfid: { type: 'string', nullable: true, description: 'RFID tag' },
                  nfc: { type: 'string', nullable: true, description: 'NFC tag' },
                  orderid: { type: 'string', nullable: true, description: 'Order ID' },
                  invoiceurl: { type: 'string', nullable: true, description: 'Invoice URL' },
                  location: { type: 'string', nullable: true, description: 'Storage location' },
                  solddate: { type: 'number', nullable: true, description: 'Sold date timestamp' },
                  assetlocation: { type: 'string', nullable: true, description: 'Asset location' },
                  rfidscannedtime: { type: 'number', nullable: true, description: 'RFID scan timestamp' },
                  orderlinenumber: { type: 'string', nullable: true, description: 'Order line number' },
                  qrcode: { type: 'string', nullable: true, description: 'QR code' },
                  barcode: { type: 'string', nullable: true, description: 'Barcode' },
                  ewaste: { type: 'boolean', nullable: true, description: 'E-waste status' },
                  createddate: { type: 'number', description: 'Creation timestamp' },
                  modifieddate: { type: 'number', description: 'Modification timestamp' },
                  createdby: { type: 'number', nullable: true, description: 'Created by user ID' },
                  modifiedby: { type: 'number', nullable: true, description: 'Modified by user ID' },
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
  }, async (request: any, reply: any) => {
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
    } catch (error: any) {
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
          puc: { type: 'string', maxLength: 500, description: 'Product unique code' },
          category: { type: 'string', maxLength: 500, description: 'Product category' },
          subcategory: { type: 'string', maxLength: 500, description: 'Product subcategory' },
          brand: { type: 'string', maxLength: 500, description: 'Product brand' },
          model: { type: 'string', maxLength: 500, description: 'Product model' },
          operatingsystem: { type: 'string', maxLength: 500, description: 'Operating system' },
          operatingsystemversion: { type: 'string', maxLength: 500, description: 'OS version' },
          ram: { type: 'string', maxLength: 500, description: 'RAM specification' },
          storagetype: { type: 'string', maxLength: 500, description: 'Storage type' },
          storagecapacity: { type: 'string', maxLength: 500, description: 'Storage capacity' },
          colour: { type: 'string', maxLength: 500, description: 'Product color' },
          graphicscard: { type: 'string', maxLength: 500, description: 'Graphics card' },
          processor: { type: 'string', maxLength: 500, description: 'Processor specification' },
          serialnumber: { type: 'string', maxLength: 500, description: 'Serial number (unique)' },
          stockstatus: { type: 'string', maxLength: 500, description: 'Stock status', default: 'Available' },
          manufacturedyear: { type: 'number', description: 'Manufactured year' },
          releaseyear: { type: 'number', description: 'Release year' },
          isdeleted: { type: 'boolean', description: 'Deletion status', default: false },
          isarchive: { type: 'boolean', description: 'Archive status', default: false },
          removefromrecyclebin: { type: 'boolean', description: 'Recycle bin status', default: false },
          ecompublish: { type: 'boolean', description: 'E-commerce publish status', default: false },
          productname: { type: 'string', maxLength: 500, description: 'Product name' },
          rfid: { type: 'string', maxLength: 500, description: 'RFID tag' },
          nfc: { type: 'string', maxLength: 500, description: 'NFC tag (unique)' },
          orderid: { type: 'string', maxLength: 500, description: 'Order ID' },
          invoiceurl: { type: 'string', maxLength: 500, description: 'Invoice URL' },
          location: { type: 'string', maxLength: 500, description: 'Storage location' },
          solddate: { type: 'number', description: 'Sold date timestamp' },
          assetlocation: { type: 'string', maxLength: 200, description: 'Asset location' },
          rfidscannedtime: { type: 'number', description: 'RFID scan timestamp' },
          orderlinenumber: { type: 'string', maxLength: 500, description: 'Order line number' },
          qrcode: { type: 'string', maxLength: 500, description: 'QR code (unique)' },
          barcode: { type: 'string', maxLength: 500, description: 'Barcode (unique)' },
          ewaste: { type: 'boolean', description: 'E-waste status', default: false },
          createdby: { type: 'number', description: 'Created by user ID' },
          modifiedby: { type: 'number', description: 'Modified by user ID' },
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
          puc: { type: 'string', maxLength: 500, description: 'Product unique code' },
          category: { type: 'string', maxLength: 500, description: 'Product category' },
          subcategory: { type: 'string', maxLength: 500, description: 'Product subcategory' },
          brand: { type: 'string', maxLength: 500, description: 'Product brand' },
          model: { type: 'string', maxLength: 500, description: 'Product model' },
          operatingsystem: { type: 'string', maxLength: 500, description: 'Operating system' },
          operatingsystemversion: { type: 'string', maxLength: 500, description: 'OS version' },
          ram: { type: 'string', maxLength: 500, description: 'RAM specification' },
          storagetype: { type: 'string', maxLength: 500, description: 'Storage type' },
          storagecapacity: { type: 'string', maxLength: 500, description: 'Storage capacity' },
          colour: { type: 'string', maxLength: 500, description: 'Product color' },
          graphicscard: { type: 'string', maxLength: 500, description: 'Graphics card' },
          processor: { type: 'string', maxLength: 500, description: 'Processor specification' },
          serialnumber: { type: 'string', maxLength: 500, description: 'Serial number (unique)' },
          stockstatus: { type: 'string', maxLength: 500, description: 'Stock status' },
          manufacturedyear: { type: 'number', description: 'Manufactured year' },
          releaseyear: { type: 'number', description: 'Release year' },
          isdeleted: { type: 'boolean', description: 'Deletion status' },
          isarchive: { type: 'boolean', description: 'Archive status' },
          removefromrecyclebin: { type: 'boolean', description: 'Recycle bin status' },
          ecompublish: { type: 'boolean', description: 'E-commerce publish status' },
          productname: { type: 'string', maxLength: 500, description: 'Product name' },
          rfid: { type: 'string', maxLength: 500, description: 'RFID tag' },
          nfc: { type: 'string', maxLength: 500, description: 'NFC tag (unique)' },
          orderid: { type: 'string', maxLength: 500, description: 'Order ID' },
          invoiceurl: { type: 'string', maxLength: 500, description: 'Invoice URL' },
          location: { type: 'string', maxLength: 500, description: 'Storage location' },
          solddate: { type: 'number', description: 'Sold date timestamp' },
          assetlocation: { type: 'string', maxLength: 200, description: 'Asset location' },
          rfidscannedtime: { type: 'number', description: 'RFID scan timestamp' },
          orderlinenumber: { type: 'string', maxLength: 500, description: 'Order line number' },
          qrcode: { type: 'string', maxLength: 500, description: 'QR code (unique)' },
          barcode: { type: 'string', maxLength: 500, description: 'Barcode (unique)' },
          ewaste: { type: 'boolean', description: 'E-waste status' },
          createdby: { type: 'number', description: 'Created by user ID' },
          modifiedby: { type: 'number', description: 'Modified by user ID' },
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
  }, async (request: any, reply: any) => {
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
    } catch (error: any) {
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
  }, async (request: any, reply: any) => {
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
    } catch (error: any) {
      console.log('=== STOCK DELETE ERROR:', error.message);
      
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
} 