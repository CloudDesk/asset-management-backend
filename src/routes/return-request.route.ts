import { FastifyInstance } from 'fastify';
import { ReturnRequestController } from '../controllers/return-request.controller.js';

const resolutionEnum = ['replacement', 'refund', 'partial_refund', 'ship_missing_item', 'complete_return'];
const attachmentTypeEnum = ['product_photo', 'package_photo', 'unboxing_video', 'defect_video', 'other'];
const rtoStatusEnum = ['delivery_failed', 'rto_initiated', 'rto_in_transit', 'rto_received', 'warehouse_verification', 'rto_closed', 'closed'];
const inspectionConditionEnum = ['resellable', 'damaged', 'incorrect_product', 'other'];
const restockActionEnum = ['available', 'damaged', 'quarantine', 'on_hold', 'none'];

const attachmentInputSchema = {
  type: 'object',
  required: ['attachmenttype', 'fileurl'],
  properties: {
    attachmenttype: { type: 'string', enum: attachmentTypeEnum },
    fileurl: { type: 'string' },
    isrequired: { type: 'boolean' },
  },
  additionalProperties: false,
};

export async function returnRequestRoutes(fastify: FastifyInstance) {
  const controller = new ReturnRequestController();

  fastify.get('/', {
    schema: {
      description: 'List return, replacement, and RTO records',
      tags: ['Returns'],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string' },
          limit: { type: 'string' },
          orderid: { type: 'string' },
          orderlineid: { type: 'string' },
          customerid: { type: 'string' },
          requesttype: { type: 'string', enum: ['return', 'replacement', 'rto'] },
          source: { type: 'string', enum: ['customer', 'delivery_partner', 'admin'] },
          status: { type: 'string' },
          reasoncode: { type: 'string' },
        },
      },
    },
  }, controller.getRequests);

  fastify.post('/rto', {
    schema: {
      description: 'Create internal RTO operational record. This does not create a customer return request or reverse shipment.',
      tags: ['Returns'],
      body: {
        type: 'object',
        properties: {
          orderid: { type: 'number' },
          orderlineid: { type: 'number' },
          trackingid: { type: 'string' },
          reasoncode: { type: 'string' },
          reason: { type: 'string' },
          requestedquantity: { type: 'number' },
          status: { type: 'string', enum: ['delivery_failed', 'rto_initiated', 'rto_in_transit', 'rto_received'] },
          additionalremarks: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, controller.createRtoRequest);

  fastify.post('/evidence/upload', {
    schema: {
      description: 'Upload a return evidence file and receive a file URL. Use this URL in POST /v1/returns attachments for required evidence.',
      tags: ['Returns'],
      consumes: ['multipart/form-data'],
      body: {
        type: 'object',
        required: ['file'],
        properties: {
          file: { type: 'object', description: 'Evidence file upload field' },
          attachmenttype: {
            anyOf: [
              { type: 'string', enum: attachmentTypeEnum },
              { type: 'object', additionalProperties: true },
            ],
            default: 'product_photo',
          },
        },
      },
    },
  }, controller.uploadEvidence);

  fastify.get('/operations/summary', {
    schema: {
      description: 'Get inventory operations queue and SLA summary for return, replacement, and RTO records.',
      tags: ['Returns'],
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Created date lower bound as epoch seconds or milliseconds' },
          to: { type: 'string', description: 'Created date upper bound as epoch seconds or milliseconds' },
          requesttype: { type: 'string', enum: ['return', 'replacement', 'rto'] },
          source: { type: 'string', enum: ['customer', 'delivery_partner', 'admin'] },
          status: { type: 'string' },
          reasoncode: { type: 'string' },
        },
      },
    },
  }, controller.getOperationsSummary);

  fastify.get('/evidence-file/*', {
    schema: {
      description: 'Stream a return evidence image, video, or PDF from durable storage/local fallback.',
      tags: ['Returns'],
      params: {
        type: 'object',
        additionalProperties: true,
      },
    },
  }, controller.getEvidenceFile);

  fastify.get('/:id/evidence-health', {
    schema: {
      description: 'Check whether each attached return evidence file is reachable and whether its stored URL should be repaired.',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, controller.getEvidenceHealth);

  fastify.patch('/:id/evidence-links/repair', {
    schema: {
      description: 'Normalize stored evidence attachment URLs to the protected evidence-file endpoint when the underlying file exists.',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, controller.repairEvidenceLinks);

  fastify.get('/:id', {
    schema: {
      description: 'Get return request by ID',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, controller.getRequest);

  fastify.post('/', {
    schema: {
      description: 'Create customer return or replacement request for an orderline',
      tags: ['Returns'],
      body: {
        type: 'object',
        required: ['orderlineid', 'requesttype', 'requestedresolution'],
        properties: {
          orderlineid: { type: 'number' },
          requesttype: { type: 'string', enum: ['return', 'replacement'] },
          policyreasonruleid: { type: 'number' },
          reasoncode: { type: 'string' },
          reason: { type: 'string' },
          requestedquantity: { type: 'number' },
          requestedresolution: { type: 'string', enum: resolutionEnum },
          ispackageopened: { type: 'boolean' },
          additionalremarks: { type: 'string' },
          attachments: {
            type: 'array',
            items: attachmentInputSchema,
          },
        },
        additionalProperties: false,
      },
    },
  }, controller.createRequest);

  fastify.post('/:id/attachments', {
    schema: {
      description: 'Add attachment URLs to a return request',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['attachments'],
        properties: {
          attachments: {
            type: 'array',
            minItems: 1,
            items: attachmentInputSchema,
          },
        },
        additionalProperties: false,
      },
    },
  }, controller.addAttachments);

  fastify.get('/:id/resolution-preview', {
    schema: {
      description: 'Preview the allowed resolution closure action and replacement stock fallback decision for a return/replacement request.',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, controller.getResolutionPreview);

  fastify.post('/:id/attachments/upload', {
    schema: {
      description: 'Upload an evidence file and attach it directly to an existing return request',
      tags: ['Returns'],
      consumes: ['multipart/form-data'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['file'],
        properties: {
          file: { type: 'object', description: 'Evidence file upload field' },
          attachmenttype: {
            anyOf: [
              { type: 'string', enum: attachmentTypeEnum },
              { type: 'object', additionalProperties: true },
            ],
            default: 'product_photo',
          },
        },
      },
    },
  }, controller.uploadAndAttachEvidence);

  fastify.post('/:id/attachments/:attachmentId/replace', {
    schema: {
      description: 'Replace a specific evidence attachment file while preserving the attachment record and return request flow.',
      tags: ['Returns'],
      consumes: ['multipart/form-data'],
      params: {
        type: 'object',
        required: ['id', 'attachmentId'],
        properties: {
          id: { type: 'string' },
          attachmentId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['file'],
        properties: {
          file: { type: 'object', description: 'Replacement evidence file upload field' },
          attachmenttype: {
            anyOf: [
              { type: 'string', enum: attachmentTypeEnum },
              { type: 'object', additionalProperties: true },
            ],
            default: 'product_photo',
          },
        },
      },
    },
  }, controller.replaceEvidenceAttachment);

  fastify.patch('/:id/evidence-review', {
    schema: {
      description: 'Approve or reject customer evidence for a return/replacement request. Does not update stock, create refund, or complete warehouse inspection.',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['decision'],
        properties: {
          decision: { type: 'string', enum: ['approved', 'rejected'] },
          remarks: { type: 'string' },
          rejectionreason: { type: 'string', description: 'Required when decision is rejected' },
        },
        additionalProperties: false,
      },
    },
  }, controller.reviewEvidence);

  fastify.patch('/:id/approve', {
    schema: {
      description: 'Admin approval for a customer return/replacement request. Prepares the request for pickup/warehouse flow; does not create shipment, refund, or stock update.',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          remarks: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, controller.approveRequest);

  fastify.patch('/:id/reject', {
    schema: {
      description: 'Admin rejection for a customer return/replacement request. Rejected requests no longer consume eligible quantity.',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['rejectionreason'],
        properties: {
          rejectionreason: { type: 'string' },
          remarks: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, controller.rejectRequest);

  fastify.patch('/:id/pickup-preparation', {
    schema: {
      description: 'Prepare pickup metadata for an approved customer return/replacement request. Admin can optionally create an Ekart reverse shipment; pickup is never auto-created from policy evaluation.',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          auto_create_pickup: { type: 'boolean', enum: [false], default: false },
          pickup_created_by: { type: 'string', enum: ['admin'], default: 'admin' },
          create_reverse_shipment: { type: 'boolean', default: false },
          logistics_provider_source: {
            type: 'string',
            enum: ['original_forward_provider', 'configured_provider', 'manual', 'undecided'],
            default: 'undecided',
          },
          reverse_shipping_charge_bearer: {
            type: 'string',
            enum: ['nivaana'],
            default: 'nivaana',
          },
          reverse_shipping_charge_adjustment: {
            type: 'string',
            enum: ['none'],
            default: 'none',
          },
          reverse_shipment_tracking_id: { type: 'string' },
          reverse_shipment_provider: { type: 'string' },
          seller_name: { type: 'string' },
          seller_address: { type: 'string' },
          seller_gst_tin: { type: 'string' },
          seller_location_alias: { type: 'string' },
          pickup_location_name: { type: 'string' },
          return_location_name: { type: 'string' },
          invoice_number: { type: 'string' },
          invoice_date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          item_description: { type: 'string' },
          return_reason: { type: 'string' },
          length: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
          weight: { type: 'number' },
          qc_shipment: { type: 'boolean' },
          remarks: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, controller.preparePickup);

  fastify.patch('/:id/received', {
    schema: {
      description: 'Mark a customer return/replacement or RTO record as physically received at warehouse. This is intake only; stock and verification are handled in Part 3.',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          receivedquantity: { type: 'number' },
          receivedcondition: {
            type: 'string',
            enum: ['unknown', 'apparently_resellable', 'apparently_damaged', 'package_damaged', 'mismatch'],
            default: 'unknown',
          },
          receivedlocation: { type: 'string' },
          remarks: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, controller.markReceived);

  fastify.patch('/:id/inspection', {
    schema: {
      description: 'Save authorized warehouse inspection for a received customer return/replacement or RTO record. Quantities are for the current inspection pass and are validated cumulatively against warehouse received quantity. Customer requests move to inspection statuses; RTO records stay in warehouse_verification until closed. When inspection is fully approved, the selected restock action updates allocated stock.',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['condition'],
        properties: {
          receivedquantity: {
            type: 'number',
            description: 'Defaults to the warehouse received quantity stored on the return request. Required for RTO records that were marked received without quantity.',
          },
          approvedquantity: { type: 'number', default: 0, description: 'Quantity approved in this inspection pass' },
          rejectedquantity: { type: 'number', default: 0, description: 'Quantity rejected in this inspection pass' },
          condition: { type: 'string', enum: inspectionConditionEnum },
          restockaction: { type: 'string', enum: restockActionEnum, default: 'none' },
          inspectionnotes: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, controller.inspectReturn);

  fastify.patch('/:id/resolution', {
    schema: {
      description: 'Record and transition the post-verification refund, partial refund, replacement shipment, or missing-item shipment closure for a customer return/replacement request.',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['action_type'],
        properties: {
          action_type: {
            type: 'string',
            enum: ['refund', 'partial_refund', 'replacement_shipment', 'missing_item_shipment'],
          },
          status: {
            type: 'string',
            enum: ['pending', 'completed', 'failed', 'cancelled'],
            default: 'completed',
          },
          amount: { type: 'number' },
          refund_method: { type: 'string', enum: ['original_payment', 'wallet', 'manual'] },
          process_original_payment_refund: { type: 'boolean', default: false },
          external_reference: { type: 'string' },
          shipment_tracking_id: { type: 'string' },
          shipment_provider: { type: 'string' },
          quantity: { type: 'number' },
          stock_fallback_applied: { type: 'boolean', default: false },
          metadata: { type: 'object', additionalProperties: true },
          notes: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, controller.completeResolution);

  fastify.patch('/:id/shipment-status', {
    schema: {
      description: 'Update outbound replacement or missing-item fulfilment shipment progress. Delivered replacement shipments move to replacement_delivered; delivered missing-item shipments complete the request.',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          resolution_action_id: { type: 'number' },
          shipment_tracking_id: { type: 'string' },
          shipment_provider: { type: 'string' },
          status: {
            type: 'string',
            enum: ['shipped', 'in_transit', 'delivered', 'failed', 'returned'],
          },
          event_time: { type: 'number' },
          remarks: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true },
        },
        additionalProperties: false,
      },
    },
  }, controller.updateShipmentStatus);

  fastify.patch('/:id/refund-status', {
    schema: {
      description: 'Update refund or partial-refund processing progress. Completed refunds move the request to refund_completed; pending/failed/cancelled updates keep it in refund_pending.',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          resolution_action_id: { type: 'number' },
          external_reference: { type: 'string' },
          status: {
            type: 'string',
            enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
          },
          event_time: { type: 'number' },
          remarks: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true },
        },
        additionalProperties: false,
      },
    },
  }, controller.updateRefundStatus);

  fastify.post('/:id/credit-note', {
    schema: {
      description: 'Create a GST-ready credit note record for a completed refund or partial-refund resolution action.',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          resolution_action_id: { type: 'number' },
          status: { type: 'string', enum: ['draft', 'issued'], default: 'draft' },
          refund_amount: { type: 'number' },
          taxable_amount: { type: 'number' },
          gst_rate: { type: 'number' },
          cgst_amount: { type: 'number' },
          sgst_amount: { type: 'number' },
          igst_amount: { type: 'number' },
          total_gst_amount: { type: 'number' },
          hsn_code: { type: 'string' },
          original_invoice_number: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true },
          notes: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, controller.createCreditNote);

  fastify.patch('/:id/rto-status', {
    schema: {
      description: 'Update RTO operational status. Does not update stock, refund, or inspection results.',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: rtoStatusEnum },
          additionalremarks: { type: 'string' },
          reverse_shipment_tracking_id: { type: 'string' },
          reverse_shipment_provider: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, controller.updateRtoStatus);

  fastify.patch('/:id/rto-received', {
    schema: {
      description: 'Mark an RTO record as received at warehouse. Manual warehouse verification and stock action are handled in the next module step.',
      tags: ['Returns'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          additionalremarks: { type: 'string' },
          reverse_shipment_tracking_id: { type: 'string' },
          reverse_shipment_provider: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  }, controller.markRtoReceived);
}
