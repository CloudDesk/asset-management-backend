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

  // PATCH /v1/orders/:id/mark-shipped - Mark order as shipped (after label printed)
  fastify.patch('/:id/mark-shipped', {
    schema: {
      description: 'Mark order as shipped (label printed and stuck on box)',
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
                    promotion_discount_total: { type: 'number', nullable: true },
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
                    public_tracking_link: { type: 'string', nullable: true },
                    shipment_created_at: { type: 'number', nullable: true },
                    shipdate: { type: 'number', nullable: true },
                    cod_payment_received_date: { type: 'number', nullable: true },
                    cod_transaction_reference: { type: 'string', nullable: true },
                    cod_amount: { type: 'number', nullable: true },
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
                      productname: { type: 'string', nullable: true },
                      productcategory: { type: 'string', nullable: true },
                      hsn_code: { type: 'string', nullable: true },
                      orderstatus: { type: 'string', nullable: true },
                      original_price: { type: 'number', nullable: true, description: 'Base price PER-UNIT (not multiplied by quantity)' },
                      product_discount_amount: { type: 'number', nullable: true, description: 'Product discount TOTAL for line item' },
                      promotion_discount_amount: { type: 'number', nullable: true, description: 'Promotion discount TOTAL for line item' },
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
          limit: { type: 'string', description: 'Items per page (default: 50)' }
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
                  quantity: { type: 'number', nullable: true },
                  productid: { type: 'array', items: { type: 'number' }, nullable: true, description: 'Array of product IDs' },
                  productamount: { type: 'number', nullable: true },
                  discountamount: { type: 'number', nullable: true },
                  ispaymentsucceed: { type: 'boolean', nullable: true },
                  mode: { type: 'string', nullable: true },
                  promotion_discount_total: { type: 'number', nullable: true },
                  original_total: { type: 'number', nullable: true },
                  shipping_cost: { type: 'number', nullable: true },
                  items_total: { type: 'number', nullable: true },
                  total_taxable_amount: { type: 'number', nullable: true },
                  total_cgst_amount: { type: 'number', nullable: true },
                  total_sgst_amount: { type: 'number', nullable: true },
                  total_igst_amount: { type: 'number', nullable: true },
                  total_gst_amount: { type: 'number', nullable: true },
                  createddate: { type: 'number', nullable: true },
                  modifieddate: { type: 'number', nullable: true },
                  status_history: {
                    type: 'array',
                    items: { type: 'object' }
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
                          items: { type: 'object' }
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

} 