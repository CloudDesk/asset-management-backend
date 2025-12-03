import { FastifyInstance } from 'fastify';
import { EkartController } from '../controllers/ekart.controller.js';

export async function ekartRoutes(fastify: FastifyInstance) {
  const ekartController = new EkartController();

  /**
   * Check Ekart Connection Status
   * GET /v1/ekart/connection-status
   */
  fastify.get('/connection-status', {
    schema: {
      description: 'Check Ekart connection status without connecting. Returns current token status.',
      tags: ['Ekart Logistics'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                connected: { type: 'boolean' },
                configured: { type: 'boolean' },
                token_type: { type: 'string' },
                expires_in: { type: 'number', nullable: true },
                expires_at: { type: 'string', format: 'date-time', nullable: true },
                is_valid: { type: 'boolean' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, ekartController.getConnectionStatus);

  /**
   * Connect to Ekart Channel
   * POST /v1/ekart/connect-channel
   */
  fastify.post('/connect-channel', {
    schema: {
      description: 'Connect to Ekart Logistics channel and obtain access token. No request body required.',
      tags: ['Ekart Logistics'],
      body: {
        type: 'object',
        properties: {},
        additionalProperties: true
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
                connected: { type: 'boolean' },
                token_type: { type: 'string' },
                expires_in: { type: 'number', nullable: true },
                expires_at: { type: 'string', format: 'date-time', nullable: true },
                is_valid: { type: 'boolean' },
                message: { type: 'string' }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, ekartController.connectChannel);

  /**
   * Create Forward Shipment (Seller → Customer)
   * POST /v1/ekart/shipments/forward
   */
  fastify.post('/shipments/forward', {
    schema: {
      description: 'Create a forward shipment from seller to customer',
      tags: ['Ekart Logistics'],
      body: {
        type: 'object',
        required: [
          'seller_name',
          'seller_address',
          'seller_gst_tin',
          'order_number',
          'invoice_number',
          'invoice_date',
          'consignee_name',
          'products_desc',
          'payment_mode',
          'total_amount',
          'tax_value',
          'taxable_amount',
          'commodity_value',
          'quantity',
          'weight',
          'drop_location'
        ],
        properties: {
          seller_name: { type: 'string' },
          seller_address: { type: 'string' },
          seller_gst_tin: { type: 'string' },
          order_number: { type: 'string' },
          invoice_number: { type: 'string' },
          invoice_date: { type: 'string', format: 'date' },
          consignee_name: { type: 'string' },
          products_desc: { type: 'string' },
          payment_mode: { type: 'string', enum: ['COD', 'Prepaid'] },
          total_amount: { type: 'number' },
          tax_value: { type: 'number' },
          taxable_amount: { type: 'number' },
          commodity_value: { type: 'string' },
          quantity: { type: 'number' },
          weight: { type: 'number' },
          drop_location: {
            type: 'object',
            required: ['name', 'address', 'city', 'state', 'pin', 'phone'],
            properties: {
              location_type: { type: 'string', enum: ['Home', 'Office'] },
              name: { type: 'string' },
              address: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              country: { type: 'string' },
              pin: { type: 'number' },
              phone: { type: 'number' }
            }
          },
          templateName: { type: 'string' },
          length: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          cod_amount: { type: 'number' },
          category_of_goods: { type: 'string' },
          hsn_code: { type: 'string' }
        }
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
                tracking_id: { type: 'string' },
                vendor: { type: 'string' },
                barcodes: { type: 'object' },
                public_tracking_link: { type: 'string' },
                order_number: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, ekartController.createForwardShipment);

  /**
   * Create Reverse Shipment (Customer → Seller)
   * POST /v1/ekart/shipments/reverse
   */
  fastify.post('/shipments/reverse', {
    schema: {
      description: 'Create a reverse shipment from customer to seller (return)',
      tags: ['Ekart Logistics'],
      body: {
        type: 'object',
        required: [
          'seller_name',
          'seller_address',
          'seller_gst_tin',
          'order_number',
          'invoice_number',
          'invoice_date',
          'consignee_name',
          'products_desc',
          'payment_mode',
          'return_reason',
          'total_amount',
          'tax_value',
          'taxable_amount',
          'commodity_value',
          'quantity',
          'weight',
          'drop_location'
        ],
        properties: {
          seller_name: { type: 'string' },
          seller_address: { type: 'string' },
          seller_gst_tin: { type: 'string' },
          order_number: { type: 'string' },
          invoice_number: { type: 'string' },
          invoice_date: { type: 'string', format: 'date' },
          consignee_name: { type: 'string' },
          products_desc: { type: 'string' },
          payment_mode: { type: 'string', enum: ['Pickup'] },
          return_reason: { type: 'string' },
          total_amount: { type: 'number' },
          tax_value: { type: 'number' },
          taxable_amount: { type: 'number' },
          commodity_value: { type: 'string' },
          quantity: { type: 'number' },
          weight: { type: 'number' },
          drop_location: {
            type: 'object',
            required: ['name', 'address', 'city', 'state', 'pin', 'phone'],
            properties: {
              location_type: { type: 'string', enum: ['Home', 'Office'] },
              name: { type: 'string' },
              address: { type: 'string' },
              city: { type: 'string' },
              state: { type: 'string' },
              country: { type: 'string' },
              pin: { type: 'number' },
              phone: { type: 'number' }
            }
          },
          templateName: { type: 'string' },
          length: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          category_of_goods: { type: 'string' }
        }
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
                tracking_id: { type: 'string' },
                vendor: { type: 'string' },
                barcodes: { type: 'object' },
                public_tracking_link: { type: 'string' },
                order_number: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, ekartController.createReverseShipment);

  /**
   * Download Label (PDF)
   * POST /v1/ekart/shipments/label
   */
  fastify.post('/shipments/label', {
    schema: {
      description: 'Download shipping labels as PDF for one or more tracking IDs',
      tags: ['Ekart Logistics'],
      body: {
        type: 'object',
        required: ['trackingIds'],
        properties: {
          trackingIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1
          }
        }
      },
      response: {
        200: {
          type: 'string',
          format: 'binary',
          description: 'PDF file containing shipping labels'
        }
      }
    }
  }, ekartController.downloadLabel);

  /**
   * Track Shipment
   * GET /v1/ekart/shipments/:trackingId/track
   */
  fastify.get('/shipments/:trackingId/track', {
    schema: {
      description: 'Track shipment status by tracking ID',
      tags: ['Ekart Logistics'],
      params: {
        type: 'object',
        required: ['trackingId'],
        properties: {
          trackingId: { type: 'string' }
        }
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
                tracking_id: { type: 'string' },
                status: { type: 'string' },
                current_location: { type: 'string' },
                description: { type: 'string' },
                estimated_delivery: { type: 'string', format: 'date-time' },
                order_number: { type: 'string' },
                status_history: { type: 'array' },
                public_tracking_link: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, ekartController.trackShipment);

  /**
   * Cancel Shipment
   * DELETE /v1/ekart/shipments/:trackingId/cancel
   */
  fastify.delete('/shipments/:trackingId/cancel', {
    schema: {
      description: 'Cancel a shipment before it is picked up',
      tags: ['Ekart Logistics'],
      params: {
        type: 'object',
        required: ['trackingId'],
        properties: {
          trackingId: { type: 'string' }
        }
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
                tracking_id: { type: 'string' },
                remark: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, ekartController.cancelShipment);

  /**
   * Get Shipping Rates
   * POST /v1/ekart/shipments/rates
   */
  fastify.post('/shipments/rates', {
    schema: {
      description: 'Get estimated shipping rates for a shipment',
      tags: ['Ekart Logistics'],
      body: {
        type: 'object',
        required: [
          'pickupPincode',
          'dropPincode',
          'invoiceAmount',
          'weight',
          'length',
          'height',
          'width',
          'serviceType',
          'codAmount',
          'packages'
        ],
        properties: {
          pickupPincode: { type: 'number' },
          dropPincode: { type: 'number' },
          invoiceAmount: { type: 'number' },
          weight: { type: 'number' },
          length: { type: 'number' },
          height: { type: 'number' },
          width: { type: 'number' },
          serviceType: { type: 'string' },
          codAmount: { type: 'number' },
          packages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                length: { type: 'number' },
                height: { type: 'number' },
                width: { type: 'number' },
                count: { type: 'string' }
              }
            }
          }
        }
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
                type: { type: 'string' },
                zone: { type: 'string' },
                total: { type: 'string' },
                shipping_charge: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, ekartController.getShippingRates);
}

