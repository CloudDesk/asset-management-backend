import { FastifyInstance } from 'fastify';
import { PurchaseOrderController } from '../controllers/purchaseorder.controller.js';

export async function purchaseOrderRoutes(fastify: FastifyInstance) {
  const purchaseOrderController = new PurchaseOrderController();

  // GET /v1/purchaseorders - Get all purchase orders with pagination and filtering
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
          // Range filters for numeric fields
          minSubtotal: { type: 'string', description: 'Minimum subtotal filter' },
          maxSubtotal: { type: 'string', description: 'Maximum subtotal filter' },
          minTotal: { type: 'string', description: 'Minimum total filter' },
          maxTotal: { type: 'string', description: 'Maximum total filter' },
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
  }, purchaseOrderController.getPurchaseOrder.bind(purchaseOrderController));

  // POST /v1/purchaseorders - Create new purchase order
  fastify.post('/', {
    schema: {
      description: 'Create a new purchase order',
      tags: ['Purchase Orders'],
      body: {
        type: 'object',
        properties: {
          // Use actual database field names
          ponumber: { type: 'string', minLength: 1, maxLength: 255, description: 'PO number' },
          prnumber: { type: 'string', maxLength: 255, description: 'PR number' },
          companyname: { type: 'string', maxLength: 255, description: 'Company name' },
          companyaddress: { type: 'string', description: 'Company address' },
          contactname: { type: 'string', maxLength: 255, description: 'Contact name' },
          phonenumber: { type: 'object', description: 'Phone number (complex object)' },
          gstnumber: { type: 'string', maxLength: 50, description: 'GST number' },
          supplierid: { type: 'number', description: 'Supplier ID' },
          po_status: { type: 'string', enum: ['pending', 'in_progress', 'partially_fulfilled', 'fulfilled', 'cancelled'], description: 'PO status' },
          suppliertype: { type: 'string', enum: ['local', 'International'], description: 'Supplier type' },
          paymentterms: { type: 'string', description: 'Payment terms' },
          sameasinvoice: { type: 'boolean', description: 'Same as invoice flag' },
          instructions: { type: 'string', description: 'Instructions' },
          comments: { type: 'string', description: 'Comments' },
        },
        additionalProperties: true, // Allow dynamic fields
      },
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
        properties: {
          // Use actual database field names
          ponumber: { type: 'string', minLength: 1, maxLength: 255, description: 'PO number' },
          prnumber: { type: 'string', maxLength: 255, description: 'PR number' },
          companyname: { type: 'string', maxLength: 255, description: 'Company name' },
          companyaddress: { type: 'string', description: 'Company address' },
          contactname: { type: 'string', maxLength: 255, description: 'Contact name' },
          phonenumber: { type: 'object', description: 'Phone number (complex object)' },
          gstnumber: { type: 'string', maxLength: 50, description: 'GST number' },
          supplierid: { type: 'number', description: 'Supplier ID' },
          po_status: { type: 'string', enum: ['pending', 'in_progress', 'partially_fulfilled', 'fulfilled', 'cancelled'], description: 'PO status' },
          suppliertype: { type: 'string', enum: ['local', 'International'], description: 'Supplier type' },
          paymentterms: { type: 'string', description: 'Payment terms' },
          sameasinvoice: { type: 'boolean', description: 'Same as invoice flag' },
          instructions: { type: 'string', description: 'Instructions' },
          comments: { type: 'string', description: 'Comments' },
        },
        additionalProperties: true, // Allow dynamic fields
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
  }, purchaseOrderController.updatePurchaseOrder.bind(purchaseOrderController));

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
  }, purchaseOrderController.deletePurchaseOrder.bind(purchaseOrderController));

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
      body: {
        type: 'object',
        properties: {
          po_status: { type: 'string', enum: ['pending', 'in_progress', 'partially_fulfilled', 'fulfilled', 'cancelled'], description: 'New PO status' },
          comments: { type: 'string', description: 'Status change comments' },
        },
        required: ['po_status'],
        additionalProperties: true,
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
  }, purchaseOrderController.updatePurchaseOrderStatus.bind(purchaseOrderController));
} 