import { FastifyInstance } from 'fastify';
import { OrdersController } from '../controllers/orders.controller.js';

export async function ordersRoutes(fastify: FastifyInstance) {
  const ordersController = new OrdersController();


  // GET /v1/orders - Get all orders with pagination and filtering
  fastify.get('/', {
    schema: {
      description: 'Get all orders with pagination and filtering',
      tags: ['Orders'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number' },
          limit: { type: 'string', description: 'Items per page' },
          // Actual database fields for filtering
          userid: { type: 'string', description: 'Filter by user ID' },
          addressid: { type: 'string', description: 'Filter by address ID' },
          orderid: { type: 'string', description: 'Filter by order ID' },
          orderstatus: { type: 'string', description: 'Filter by order status' },
          order_type: { type: 'string', enum: ['instore', 'online'], description: 'Filter by in-store or online order type' },
          transactionid: { type: 'string', description: 'Filter by transaction ID' },
          merchanttransactionid: { type: 'string', description: 'Filter by merchant transaction ID' },
          deliveryfrom: { type: 'string', description: 'Filter by delivery from location' },
          ispaymentsucceed: { type: 'string', description: 'Filter by payment success status' },
          quantity: { type: 'string', description: 'Filter by quantity' },
          orderamount: { type: 'string', description: 'Filter by order amount' },
          productamount: { type: 'string', description: 'Filter by product amount' },
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
                  id: { type: 'number', description: 'Order ID' },
                  userid: { type: 'number', nullable: true, description: 'User ID' },
                  addressid: { type: 'number', nullable: true, description: 'Address ID' },
                  orderamount: { type: 'number', nullable: true, description: 'Order amount' },
                  orderid: { type: 'string', nullable: true, description: 'Order ID string' },
                  orderstatus: { type: 'string', nullable: true, description: 'Order status' },
                  fulfillment_status: { type: 'string', nullable: true, description: 'Original fulfillment status' },
                  effective_status: { type: 'string', nullable: true, description: 'Current customer-facing order/return/refund status' },
                  workflow_type: { type: 'string', nullable: true },
                  workflow_request_id: { type: 'number', nullable: true },
                  quantity: { type: 'number', nullable: true, description: 'Quantity' },
                  transactionid: { type: 'string', nullable: true, description: 'Transaction ID' },
                  readytodispatchdate: { type: 'number', nullable: true, description: 'Ready to dispatch date' },
                  dispatcheddate: { type: 'number', nullable: true, description: 'Dispatched date' },
                  productamount: { type: 'number', nullable: true, description: 'Product amount' },
                  discountamount: { type: 'number', nullable: true, description: 'Discount amount' },
                  deliveryfrom: { type: 'string', nullable: true, description: 'Delivery from location' },
                  orderprocessingtime: { type: 'number', nullable: true, description: 'Order processing time' },
                  ispaymentsucceed: { type: 'boolean', nullable: true, description: 'Payment success status' },
                  merchanttransactionid: { type: 'string', nullable: true, description: 'Merchant transaction ID' },
                  productid: { type: 'array', items: { type: 'number' }, nullable: true, description: 'Product IDs' },
                  delivereddate: { type: 'number', nullable: true, description: 'Delivered date' },
                  cancelleddate: { type: 'number', nullable: true, description: 'Cancelled date' },
                  returneddate: { type: 'number', nullable: true, description: 'Returned date' },
                  paymentfaileddate: { type: 'number', nullable: true, description: 'Payment failed date' },
                  createddate: { type: 'number', nullable: true, description: 'Created date' },
                  modifieddate: { type: 'number', nullable: true, description: 'Modified date' },
                  // User-related fields
                  username: { type: 'string', nullable: true, description: 'User full name (firstname + lastname)' },
                  useremail: { type: 'string', nullable: true, description: 'User email' },
                  usermobilenumber: { type: 'number', nullable: true, description: 'User mobile number' },
                  user_firstname: { type: 'string', nullable: true, description: 'User first name' },
                  user_lastname: { type: 'string', nullable: true, description: 'User last name' },
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
  }, ordersController.getOrders.bind(ordersController));

  // PATCH /v1/orders/:id/ready-for-dispatch - Mark order as ready for dispatch
  fastify.patch('/:id/ready-for-dispatch', {
    schema: {
      description: 'Mark order as ready for dispatch (all products collected and box ready)',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        required: ['inventory_user_id'],
        properties: {
          inventory_user_id: { type: 'number', description: 'Inventory user ID who performed the action' },
          stock_mapping: {
            type: 'array',
            description: 'Optional stock mapping for manual selection or batch filtering',
            items: {
              type: 'object',
              properties: {
                orderline_id: { type: 'number', description: 'Orderline ID' },
                stock_ids: {
                  type: 'array',
                  items: { type: 'number' },
                  description: 'Specific stock IDs (quantity = array length)'
                },
                skus: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific stock SKUs (quantity = array length)'
                },
                batch_filter: {
                  type: 'object',
                  properties: {
                    batchno: { type: 'string', description: 'Batch number filter' },
                    supplierid: { type: 'number', description: 'Supplier ID filter' },
                    poid: { type: 'number', description: 'Purchase Order ID filter' }
                  },
                  description: 'Auto-select from specific batch/supplier/PO (quantity from orderline)'
                }
              },
              required: ['orderline_id']
            }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, ordersController.markReadyForDispatch.bind(ordersController));

  // PATCH /v1/orders/:id/manual-ship - Manually ship order with vendor details (auto-sets shipped status)
  fastify.patch('/:id/manual-ship', {
    schema: {
      description: 'Update shipment details for manual vendors (tracking_id, vendor, public_tracking_link). If payload includes shipped: true, sets order status to shipped. If shipped: false or not provided, status remains ready_for_dispatch. Allows updating from EKART to another vendor when EKART refuses to collect (works for both ready_for_dispatch and shipped orders).',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID (database ID) or order number (orderid)' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        required: ['tracking_id', 'vendor', 'inventory_user_id'],
        properties: {
          tracking_id: { type: 'string', description: 'Tracking ID (AWB) from manual vendor' },
          vendor: { type: 'string', description: 'Vendor name (e.g., "Delhivery", "Shiprocket"). Can be used to switch from EKART to another vendor.' },
          inventory_user_id: { type: 'number', description: 'Inventory user ID who performed the action' },
          public_tracking_link: { type: 'string', description: 'Optional: Public tracking URL (auto-generated if not provided)' },
          shipped: { type: 'boolean', description: 'Optional: If true, sets order status to shipped. If false or not provided, status remains ready_for_dispatch.' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, ordersController.updateShipmentDetails.bind(ordersController));

  // PATCH /v1/orders/:id/shipment-status - Manually update shipment tracking status (works for ALL vendors)
  fastify.patch('/:id/shipment-status', {
    schema: {
      description: 'Manually update shipment tracking status. Works for ALL vendors (EKART + manual vendors). Allows setting shipped status from ready_for_dispatch (if tracking_id and vendor exist). Warning logged for EKART orders as webhook may overwrite.',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID (database ID) or order number (orderid)' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        required: ['status', 'inventory_user_id'],
        properties: {
          status: {
            type: 'string',
            enum: ['shipped', 'in_transit', 'out_for_delivery', 'delivered', 'rto_initiated', 'rto_delivered', 'cod_payment_received'],
            description: 'Shipment tracking status. Allowed values: shipped (from ready_for_dispatch with tracking_id), in_transit, out_for_delivery, delivered, rto_initiated, rto_delivered, cod_payment_received'
          },
          inventory_user_id: { type: 'number', description: 'Inventory user ID who performed the action' },
          location: { type: 'string', description: 'Optional: Current location of shipment' },
          description: { type: 'string', description: 'Optional: Status description or notes' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, ordersController.updateShipmentStatus.bind(ordersController));

  // PATCH /v1/orders/:id/invoice-seller-address - Save the seller snapshot used by invoices
  fastify.patch('/:id/invoice-seller-address', {
    schema: {
      description: 'Update the editable seller address snapshot used for order and adjustment invoices.',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID (database ID) or order number (orderid)' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        additionalProperties: false,
        required: [
          'inventory_user_id', 'alias', 'phone', 'address_line1',
          'pincode', 'city', 'state', 'country', 'gstin'
        ],
        properties: {
          inventory_user_id: { type: 'number' },
          alias: { type: 'string', minLength: 1, maxLength: 200 },
          phone: { type: 'string', minLength: 10, maxLength: 20 },
          address_line1: { type: 'string', minLength: 1, maxLength: 500 },
          address_line2: { type: 'string', maxLength: 500 },
          pincode: { type: 'string', pattern: '^\\d{6}$' },
          city: { type: 'string', minLength: 1, maxLength: 100 },
          state: { type: 'string', minLength: 1, maxLength: 100 },
          country: { type: 'string', minLength: 1, maxLength: 100 },
          gstin: { type: 'string', pattern: '^[0-9A-Za-z]{15}$' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }, message: { type: 'string' }, statusCode: { type: 'number' }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }, message: { type: 'string' }, statusCode: { type: 'number' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }, message: { type: 'string' }, statusCode: { type: 'number' }
          }
        }
      }
    }
  }, ordersController.updateInvoiceSellerAddress.bind(ordersController));

  // POST /v1/orders/:id/generate-invoice - Manually generate order invoice
  fastify.post('/:id/generate-invoice', {
    schema: {
      description: 'Generate or regenerate order invoice manually for an order. Keeps existing automatic invoice generation flows unchanged.',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID (database ID) or order number (orderid)' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        required: ['inventory_user_id'],
        properties: {
          inventory_user_id: { type: 'number', description: 'Inventory user ID who triggered invoice generation' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, ordersController.generateOrderInvoice.bind(ordersController));

  // PATCH /v1/orders/:id/mark-shipped - Mark order as shipped (backward compatibility / manual override)
  // NOTE: For EKART orders, this endpoint is NOT called in normal flow.
  // EKART webhook automatically sets 'shipped' status when pickup is confirmed.
  // This endpoint is kept for backward compatibility and manual override scenarios.
  fastify.patch('/:id/mark-shipped', {
    schema: {
      description: 'Mark order as shipped (backward compatibility / manual override). NOTE: For EKART orders, shipped status is automatically set by webhook - this endpoint is NOT called in normal flow.',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        required: ['inventory_user_id'],
        properties: {
          inventory_user_id: { type: 'number', description: 'Inventory user ID who performed the action' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, ordersController.markShipped.bind(ordersController));

  // GET /v1/orders/:id/track - Track order by order ID (customer-facing)
  fastify.get('/:id/track', {
    schema: {
      description: 'Track order by order ID or order number (customer-facing)',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID (database ID) or order number (orderid)' }
        },
        required: ['id']
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
                order_id: { type: 'number' },
                order_number: { type: 'string' },
                order_status: { type: 'string' },
                tracking_id: { type: 'string', nullable: true },
                vendor: { type: 'string', nullable: true },
                public_tracking_link: { type: 'string', nullable: true },
                tracking_available: { type: 'boolean' },
                ekart_tracking: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    current_location: { type: 'string' },
                    description: { type: 'string' },
                    estimated_delivery: { type: 'string', format: 'date-time', nullable: true },
                    status_history: { type: 'array' },
                    ndr_status: { type: 'string', nullable: true },
                    ndr_actions: { type: 'array', nullable: true },
                    attempts: { type: 'number', nullable: true }
                  }
                },
                shipmozo_tracking: {
                  type: 'object',
                  additionalProperties: true,
                  nullable: true
                },
                normalized_tracking: {
                  type: 'object',
                  additionalProperties: true,
                  nullable: true
                }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, ordersController.trackOrder.bind(ordersController));

  // GET /v1/orders/:id/return-eligibility - Evaluate return/replacement eligibility per order item
  fastify.get('/:id/return-eligibility', {
    schema: {
      description: 'Evaluate return and replacement eligibility for each order item, including remaining quantity, allowed reasons, resolutions, and evidence requirements',
      tags: ['Orders'],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Order database ID or order number' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', additionalProperties: true }
          }
        }
      }
    }
  }, ordersController.getReturnEligibility.bind(ordersController));

  // GET /v1/orders/:id/details - Get order details with orderlines and address (Inventory App)
  fastify.get('/:id/details', {
    schema: {
      description: 'Get order details with orderlines and address for inventory app',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID (database ID) or order number (orderid)' }
        },
        required: ['id']
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
                order: {
                  type: 'object',
                  description: 'Order details',
                  properties: {
                    id: { type: 'number' },
                    orderid: { type: 'string', nullable: true, description: 'Order number string (e.g., ORD-1234567890)' },
                    createddate: { type: 'number', nullable: true },
                    modifieddate: { type: 'number', nullable: true },
                    orderamount: { type: 'number', nullable: true },
                    orderstatus: { type: 'string', nullable: true },
                    fulfillment_status: { type: 'string', nullable: true },
                    effective_status: { type: 'string', nullable: true },
                    workflow_type: { type: 'string', nullable: true },
                    workflow_request_id: { type: 'number', nullable: true },
                    delivereddate: { type: 'number', nullable: true },
                    cancelleddate: { type: 'number', nullable: true },
                    returneddate: { type: 'number', nullable: true },
                    quantity: { type: 'number', nullable: true },
                    transactionid: { type: 'string', nullable: true },
                    productid: { type: 'array', items: { type: 'number' }, nullable: true, description: 'Array of product IDs' },
                    productamount: { type: 'number', nullable: true },
                    discountamount: { type: 'number', nullable: true },
                    ispaymentsucceed: { type: 'boolean', nullable: true },
                    merchanttransactionid: { type: 'string', nullable: true },
                    paymentfaileddate: { type: 'number', nullable: true },
                    mode: { type: 'string', nullable: true },
                    username: { type: 'string', nullable: true },
                    useremail: { type: 'string', nullable: true },
                    usermobilenumber: { type: 'number', nullable: true },
                    promotion_discount_total: { type: 'number', nullable: true },
                    wallet_discount_total: { type: 'number', nullable: true, description: 'Legacy persisted wallet allocation amount' },
                    wallet_amount_applied: { type: 'number', nullable: true, description: 'Wallet payment allocated to this order' },
                    original_total: { type: 'number', nullable: true },
                    shipping_cost: { type: 'number', nullable: true },
                    items_total: { type: 'number', nullable: true },
                    total_taxable_amount: { type: 'number', nullable: true },
                    total_cgst_amount: { type: 'number', nullable: true },
                    total_sgst_amount: { type: 'number', nullable: true },
                    total_igst_amount: { type: 'number', nullable: true },
                    total_gst_amount: { type: 'number', nullable: true },
                    tax_amount: { type: 'number', nullable: true },
                    tracking_id: { type: 'string', nullable: true },
                    vendor: { type: 'string', nullable: true },
                    barcodes: { type: 'object', nullable: true },
                    label_url: { type: 'string', nullable: true },
                    order_invoice_url: { type: 'string', nullable: true },
                    public_tracking_link: { type: 'string', nullable: true },
                    shipment_created_at: { type: 'number', nullable: true },
                    shipdate: { type: 'number', nullable: true },
                    cod_payment_received_date: { type: 'number', nullable: true },
                    cod_transaction_reference: { type: 'string', nullable: true },
                    cod_amount: { type: 'number', nullable: true },
                    refund_transaction_id: { type: 'string', nullable: true, description: 'PhonePe or payment gateway refund transaction ID' },
                    refund_amount: { type: 'number', nullable: true, description: 'Amount refunded to customer' },
                    refund_reference: { type: 'string', nullable: true, description: 'Bank or payment gateway confirmation reference' },
                    refund_initiated_date: { type: 'number', nullable: true, description: 'Timestamp when refund was initiated (epoch ms)' },
                    refund_completed_date: { type: 'number', nullable: true, description: 'Timestamp when refund was completed (epoch ms)' },
                    status_history: {
                      type: 'array',
                      nullable: true,
                      items: {
                        type: 'object',
                        properties: {
                          previous_status: { type: 'string' },
                          new_status: { type: 'string' },
                          changed_date: { type: 'number' },
                          source: { type: 'string' },
                          inventory_user_id: { type: 'number', nullable: true },
                          username: { type: 'string', nullable: true },
                          is_active: { type: 'boolean' }
                        }
                      }
                    }
                  }
                },
                orderlines: {
                  type: 'array',
                  description: 'Array of orderlines',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'number' },
                      productamount: { type: 'number', nullable: true, description: 'Product amount AFTER product discounts (TOTAL for line item)' },
                      discountamount: { type: 'number', nullable: true, description: 'Total discounts (product + promotion)' },
                      orderamount: { type: 'number', nullable: true, description: 'Final amount for orderline (TOTAL, excludes shipping)' },
                      quantity: { type: 'number', nullable: true },
                      productid: { type: 'number', nullable: true },
                      sku_number: { type: 'string', nullable: true, description: 'Inventory SKU/PUC for carrier integrations' },
                      productname: { type: 'string', nullable: true },
                      productcategory: { type: 'string', nullable: true },
                      hsn_code: { type: 'string', nullable: true },
                      orderstatus: { type: 'string', nullable: true },
                      original_price: { type: 'number', nullable: true, description: 'Base price PER-UNIT (not multiplied by quantity)' },
                      product_discount_amount: { type: 'number', nullable: true, description: 'Product discount TOTAL for line item' },
                      promotion_discount_amount: { type: 'number', nullable: true, description: 'Promotion discount TOTAL for line item' },
                      promotion_id: { type: 'number', nullable: true },
                      promotion_adjustment_id: { type: 'string', nullable: true },
                      promotion_unit_discount: { type: 'number', nullable: true },
                      shipping_cost: { type: 'number', nullable: true, description: 'Pro-rata shipping cost for this orderline' },
                      gst_rate: { type: 'number', nullable: true, description: 'GST percentage (e.g., 5.00)' },
                      taxable_amount: { type: 'number', nullable: true, description: 'Taxable base amount (orderamount / (1 + gst_rate/100))' },
                      cgst_amount: { type: 'number', nullable: true, description: 'Central GST (INTRA-STATE only)' },
                      sgst_amount: { type: 'number', nullable: true, description: 'State GST (INTRA-STATE only)' },
                      igst_amount: { type: 'number', nullable: true, description: 'Integrated GST (INTER-STATE only)' },
                      total_gst_amount: { type: 'number', nullable: true, description: 'Total GST amount (cgst + sgst OR igst)' },
                      iscombo: {
                        type: 'boolean',
                        nullable: true,
                        description: 'True if this orderline is for a combo product'
                      },
                      components: {
                        type: 'array',
                        nullable: true,
                        description: 'Component products (only present if iscombo is true)',
                        items: {
                          type: 'object',
                          properties: {
                            componentproductid: {
                              type: 'number',
                              description: 'Component product ID'
                            },
                            productname: {
                              type: 'string',
                              nullable: true,
                              description: 'Component product name'
                            },
                            productcategory: {
                              type: 'string',
                              nullable: true,
                              description: 'Component product category'
                            },
                            subcategory: {
                              type: 'string',
                              nullable: true,
                              description: 'Component product subcategory'
                            },
                            requiredqty: {
                              type: 'number',
                              description: 'Required quantity of this component per combo pack'
                            }
                          },
                          required: ['componentproductid', 'requiredqty']
                        }
                      },
                      status_history: {
                        type: 'array',
                        nullable: true,
                        items: {
                          type: 'object',
                          properties: {
                            previous_status: { type: 'string' },
                            new_status: { type: 'string' },
                            changed_date: { type: 'number' },
                            source: { type: 'string' },
                            inventory_user_id: { type: 'number', nullable: true },
                            username: { type: 'string', nullable: true },
                            is_active: { type: 'boolean' }
                          }
                        }
                      }
                    }
                  }
                },
                wallet_usage: {
                  type: 'array',
                  description: 'Wallet credit allocations used to pay for the order',
                  items: {
                    type: 'object',
                    properties: {
                      reservation_id: { type: 'number' },
                      credit_id: { type: 'number' },
                      coupon_code: { type: 'string', nullable: true },
                      coupon_name: { type: 'string', nullable: true },
                      amount: { type: 'number' },
                      status: { type: 'string' },
                      consumed_at: { type: 'number', nullable: true },
                      reversed_at: { type: 'number', nullable: true },
                      reversal_reason: { type: 'string', nullable: true },
                      expires_at: { type: 'number', nullable: true },
                      restoration_status: { type: 'string', nullable: true }
                    }
                  }
                },
                refund_operations: {
                  type: 'array',
                  description: 'Source-aware cancellation and return refund operations',
                  items: { type: 'object', additionalProperties: true }
                },
                promotion_breakdown: {
                  type: 'object',
                  nullable: true,
                  description: 'Promotion evaluation, campaign and adjustment breakdown used to price the order',
                  properties: {
                    evaluation_id: { type: 'string', nullable: true },
                    status: { type: 'string', nullable: true },
                    schema_version: { type: 'number' },
                    original_total: { type: 'number' },
                    discounted_total: { type: 'number' },
                    promotions: {
                      type: 'array',
                      items: { type: 'object', additionalProperties: true }
                    }
                  }
                },
                address: {
                  type: 'object',
                  nullable: true,
                  description: 'Delivery address (from orderline.addressid)',
                  properties: {
                    name: { type: 'string', nullable: true },
                    mobilenumber: { type: 'string', nullable: true },
                    pincode: { type: 'string', nullable: true },
                    doornumber: { type: 'string', nullable: true },
                    address: { type: 'string', nullable: true },
                    landmark: { type: 'string', nullable: true },
                    state: { type: 'string', nullable: true },
                    city: { type: 'string', nullable: true }
                  }
                }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, ordersController.getOrderDetails.bind(ordersController));

  // GET /v1/orders/user/:userid/details - Get orders by user ID with orderlines and address
  fastify.get('/user/:userid/details', {
    schema: {
      description: 'Get orders by user ID with orderlines and address details',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          userid: { type: 'string', description: 'User ID' }
        },
        required: ['userid']
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Page number (default: 1)' },
          limit: { type: 'string', description: 'Items per page (default: 10)' },
          orderstatus: { type: 'string', description: 'Filter by order status (comma-separated for multiple statuses, e.g., "order_placed,payment_completed")' },

          // Date range filters
          date_range: {
            type: 'string',
            enum: ['last_7_days', 'last_30_days', 'last_3_months', 'last_6_months', 'last_1_year'],
            description: 'Predefined date range filter'
          },
          start_date: { type: 'string', description: 'Custom start date (Unix timestamp in milliseconds)' },
          end_date: { type: 'string', description: 'Custom end date (Unix timestamp in milliseconds)' },

          // Payment method filter
          mode: { type: 'string', description: 'Filter by payment method: "cod", "phonepe", or comma-separated "cod,phonepe"' },

          // Amount range filters
          amount_range: {
            type: 'string',
            enum: ['under_500', '500_1000', '1000_2500', '2500_5000', 'above_5000'],
            description: 'Predefined amount range filter'
          },
          min_amount: { type: 'string', description: 'Custom minimum order amount' },
          max_amount: { type: 'string', description: 'Custom maximum order amount' }
        }
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
                  id: { type: 'number' },
                  orderamount: { type: 'number', nullable: true },
                  orderid: { type: 'string', nullable: true },
                  orderstatus: { type: 'string', nullable: true },
                  fulfillment_status: { type: 'string', nullable: true },
                  effective_status: { type: 'string', nullable: true },
                  workflow_type: { type: 'string', nullable: true },
                  workflow_request_id: { type: 'number', nullable: true },
                  quantity: { type: 'number', nullable: true },
                  productid: { type: 'array', items: { type: 'number' }, nullable: true, description: 'Array of product IDs' },
                  productamount: { type: 'number', nullable: true },
                  discountamount: { type: 'number', nullable: true },
                  ispaymentsucceed: { type: 'boolean', nullable: true },
                  mode: { type: 'string', nullable: true },
                  promotion_discount_total: { type: 'number', nullable: true },
                  wallet_discount_total: { type: 'number', nullable: true, description: 'Legacy persisted wallet allocation amount' },
                  wallet_amount_applied: { type: 'number', nullable: true, description: 'Wallet payment allocated to this order' },
                  original_total: { type: 'number', nullable: true },
                  shipping_cost: { type: 'number', nullable: true },
                  items_total: { type: 'number', nullable: true },
                  total_taxable_amount: { type: 'number', nullable: true },
                  total_cgst_amount: { type: 'number', nullable: true },
                  total_sgst_amount: { type: 'number', nullable: true },
                  total_igst_amount: { type: 'number', nullable: true },
                  total_gst_amount: { type: 'number', nullable: true },
                  tracking_id: { type: 'string', nullable: true },
                  vendor: { type: 'string', nullable: true },
                  label_url: { type: 'string', nullable: true },
                  order_invoice_url: { type: 'string', nullable: true },
                  public_tracking_link: { type: 'string', nullable: true },
                  shipment_created_at: { type: 'number', nullable: true },
                  shipdate: { type: 'number', nullable: true },
                  cod_payment_received_date: { type: 'number', nullable: true },
                  cod_transaction_reference: { type: 'string', nullable: true },
                  cod_amount: { type: 'number', nullable: true },
                  createddate: { type: 'number', nullable: true },
                  modifieddate: { type: 'number', nullable: true },
                  refund_transaction_id: { type: 'string', nullable: true, description: 'PhonePe or payment gateway refund transaction ID' },
                  refund_amount: { type: 'number', nullable: true, description: 'Amount refunded to customer' },
                  refund_reference: { type: 'string', nullable: true, description: 'Bank or payment gateway confirmation reference' },
                  refund_initiated_date: { type: 'number', nullable: true, description: 'Timestamp when refund was initiated (epoch ms)' },
                  refund_completed_date: { type: 'number', nullable: true, description: 'Timestamp when refund was completed (epoch ms)' },
                  status_history: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        previous_status: { type: 'string' },
                        new_status: { type: 'string' },
                        changed_date: { type: 'number' },
                        source: { type: 'string' },
                        inventory_user_id: { type: 'number', nullable: true },
                        username: { type: 'string', nullable: true },
                        is_active: { type: 'boolean' }
                      }
                    }
                  },
                  orderlines: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        productname: { type: 'string', nullable: true },
                        productcategory: { type: 'string', nullable: true },
                        productid: { type: 'number', nullable: true },
                        orderstatus: { type: 'string', nullable: true },
                        productamount: { type: 'number', nullable: true, description: 'Product amount AFTER product discounts (TOTAL)' },
                        discountamount: { type: 'number', nullable: true, description: 'Total discounts (product + promotion)' },
                        orderamount: { type: 'number', nullable: true, description: 'Final amount for orderline (TOTAL)' },
                        quantity: { type: 'number', nullable: true },
                        original_price: { type: 'number', nullable: true, description: 'Base price PER-UNIT' },
                        product_discount_amount: { type: 'number', nullable: true, description: 'Product discount TOTAL' },
                        promotion_discount_amount: { type: 'number', nullable: true, description: 'Promotion discount TOTAL' },
                        shipping_cost: { type: 'number', nullable: true, description: 'Pro-rata shipping cost' },
                        gst_rate: { type: 'number', nullable: true, description: 'GST percentage' },
                        taxable_amount: { type: 'number', nullable: true, description: 'Taxable base amount' },
                        cgst_amount: { type: 'number', nullable: true, description: 'Central GST (INTRA-STATE)' },
                        sgst_amount: { type: 'number', nullable: true, description: 'State GST (INTRA-STATE)' },
                        igst_amount: { type: 'number', nullable: true, description: 'Integrated GST (INTER-STATE)' },
                        total_gst_amount: { type: 'number', nullable: true, description: 'Total GST amount' },
                        createddate: { type: 'number', nullable: true },
                        modifieddate: { type: 'number', nullable: true },
                        status_history: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              previous_status: { type: 'string' },
                              new_status: { type: 'string' },
                              changed_date: { type: 'number' },
                              source: { type: 'string' },
                              inventory_user_id: { type: 'number', nullable: true },
                              username: { type: 'string', nullable: true },
                              is_active: { type: 'boolean' }
                            }
                          }
                        }
                      }
                    }
                  },
                  address: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      name: { type: 'string', nullable: true },
                      mobilenumber: { type: 'string', nullable: true },
                      doornumber: { type: 'string', nullable: true },
                      address: { type: 'string', nullable: true },
                      pincode: { type: 'string', nullable: true },
                      state: { type: 'string', nullable: true },
                      city: { type: 'string', nullable: true }
                    }
                  }
                }
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
                hasPrev: { type: 'boolean' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, ordersController.getOrdersByUserIdWithDetails.bind(ordersController));

  // POST /v1/orders/:id/cancel - Cancel order (customer or admin initiated)
  fastify.post('/:id/cancel', {
    schema: {
      description: 'Cancel order (customer or admin initiated)',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID (database ID) or order number (orderid)' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          userid: { type: 'number', description: 'Customer user ID (for customer cancellations)' },
          inventory_user_id: { type: 'number', description: 'Inventory user ID (for admin cancellations)' },
          cancellation_reason: { type: 'string', description: 'Reason for cancellation' }
        },
        required: ['cancellation_reason']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        },
        403: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, ordersController.cancelOrder.bind(ordersController));

  fastify.get('/:id/cancellation-refund-preview', {
    schema: {
      description: 'Preview source-aware cancellation refund allocation (admin-only)',
      tags: ['Orders'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      response: { 200: { type: 'object', additionalProperties: true } }
    }
  }, ordersController.getCancellationRefundPreview.bind(ordersController));

  fastify.post('/:id/cancellation-refund', {
    schema: {
      description: 'Initiate a source-aware cancellation refund (admin-only)',
      tags: ['Orders'],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      body: {
        type: 'object',
        properties: {
          destination: { type: 'string', enum: ['original_sources', 'wallet'] },
          consent_accepted: { type: 'boolean' },
          consent_channel: { type: 'string', enum: ['call', 'whatsapp', 'email', 'support_ticket', 'in_app', 'other'] },
          consent_reference: { type: 'string', maxLength: 500 },
          consent_notes: { type: 'string', maxLength: 3000 },
          admin_user_id: { type: 'number' }
        },
        required: ['destination']
      },
      response: { 200: { type: 'object', additionalProperties: true } }
    }
  }, ordersController.initiateCancellationRefund.bind(ordersController));

  // PATCH /v1/orders/:id/refund-status - Update refund status for cancelled orders (admin-only)
  fastify.patch('/:id/refund-status', {
    schema: {
      description: 'Update refund status for cancelled orders with optional structured refund data (admin-only operation)',
      tags: ['Orders'],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Order ID (database ID) or order number (orderid)' }
        },
        required: ['id']
      },
      body: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['cancelled_refund_processing', 'cancelled_refunded', 'cancelled_completed'],
            description: 'New refund status'
          },
          admin_user_id: {
            type: 'number',
            description: 'Inventory user ID performing the action'
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the refund (free-form text for additional details)'
          },
          // NEW: Optional structured refund fields
          refund_transaction_id: {
            type: 'string',
            description: 'PhonePe or payment gateway refund transaction ID (e.g., PE_REFUND_123456789)'
          },
          refund_amount: {
            type: 'number',
            description: 'Amount refunded (should match order amount, with ₹1 tolerance for fees)'
          },
          refund_reference: {
            type: 'string',
            description: 'Bank reference or payment gateway confirmation number (e.g., HDFC123456)'
          }
        },
        required: ['status', 'admin_user_id']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              additionalProperties: true
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            statusCode: { type: 'number' }
          }
        }
      }
    }
  }, ordersController.updateRefundStatus.bind(ordersController));

} 
