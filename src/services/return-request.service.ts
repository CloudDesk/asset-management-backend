import { prisma } from '../models/prisma.js';
import {
  AddReturnRequestAttachmentInput,
  ApproveReturnRequestInput,
  CreateReturnRequestInput,
  CreateRtoRequestInput,
  EvidenceReviewInput,
  InspectReturnRequestInput,
  MarkReturnReceivedInput,
  MarkRtoReceivedInput,
  PreparePickupInput,
  RejectReturnRequestInput,
  ReturnRequestAttachmentInput,
  ReturnRequestQuery,
  UpdateRtoStatusInput,
} from '../schemas/return-source.schema.js';
import { createPaginationResult, getPrismaSkipTake, PaginationResult } from '../utils/pagination.js';
import { NotFoundError, ValidationError } from '../utils/errorHandler.js';
import { ReturnReplacementPolicyService } from './return-replacement-policy.service.js';
import { ReturnReasonRuleService } from './return-reason-rule.service.js';
import { ProductService } from './product.service.js';
import { PlatformStockService } from './platformStock.service.js';
import { logger } from '../config/logger.js';
import { storageService } from './storage.service.js';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

type AuthUser = {
  id: number;
  userType?: 'inventory' | 'ecommerce';
};

const requestClient = () => (prisma as any).returnRequest;
const attachmentClient = () => (prisma as any).returnRequestAttachment;

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const PDF_MIME_TYPES = new Set(['application/pdf']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const MAX_OTHER_BYTES = 15 * 1024 * 1024;

const NON_CONSUMING_STATUSES = new Set([
  'rejected',
  'cancelled',
  'evidence_rejected',
  'inspection_rejected',
]);

const RTO_TRANSITIONS: Record<string, string[]> = {
  delivery_failed: ['rto_initiated'],
  rto_initiated: ['rto_in_transit', 'rto_received'],
  rto_in_transit: ['rto_received'],
  rto_received: ['warehouse_verification'],
  warehouse_verification: ['closed'],
  closed: [],
};

const TERMINAL_REQUEST_STATUSES = new Set([
  'completed',
  'cancelled',
  'rejected',
  'evidence_rejected',
  'inspection_approved',
  'inspection_rejected',
  'refund_completed',
  'replacement_shipped',
  'missing_item_shipped',
  'closed',
]);

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function nowMillis() {
  return Date.now();
}

function toMillis(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return numeric < 1000000000000 ? numeric * 1000 : numeric;
}

function normalizeCode(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function generateRequestNumber(prefix = 'RR') {
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${Date.now()}-${random}`;
}

function sanitizeFileName(value: string) {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'evidence-file';
}

function getAttachmentTypes(attachments: ReturnRequestAttachmentInput[]) {
  return new Set(attachments.map((attachment) => attachment.attachmenttype));
}

export class ReturnRequestService {
  private policyService = new ReturnReplacementPolicyService();
  private reasonRuleService = new ReturnReasonRuleService();
  private productStockService = new ProductService();
  private platformStockService = new PlatformStockService();

  async findMany(query: ReturnRequestQuery, page: number, limit: number): Promise<PaginationResult<any>> {
    const { skip, take } = getPrismaSkipTake(page, limit);
    const where: Record<string, any> = {};

    if (query.orderid) {
      where.orderid = parseInt(query.orderid, 10);
    }
    if (query.orderlineid) {
      where.orderlineid = parseInt(query.orderlineid, 10);
    }
    if (query.customerid) {
      where.customerid = parseInt(query.customerid, 10);
    }
    if (query.requesttype) {
      where.requesttype = query.requesttype;
    }
    if (query.source) {
      where.source = query.source;
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.reasoncode) {
      where.reasoncode = query.reasoncode;
    }

    const [requests, total] = await Promise.all([
      requestClient().findMany({
        where,
        skip,
        take,
        include: { attachments: true, orderline: { include: { product: true } }, order: true, customer: true },
        orderBy: { createddate: 'desc' },
      }),
      requestClient().count({ where }),
    ]);

    return createPaginationResult(await this.attachInspectionsToRequests(requests), total, page, limit);
  }

  async findById(id: string) {
    const request = await requestClient().findUnique({
      where: { id: parseInt(id, 10) },
      include: { attachments: true, orderline: { include: { product: true } }, order: true, customer: true },
    });

    if (!request) {
      throw new NotFoundError(`Return request with ID ${id} not found`);
    }

    return this.attachInspectionsToRequest(request);
  }

  async createCustomerRequest(data: CreateReturnRequestInput, authUser?: AuthUser) {
    const orderline = await (prisma as any).orderline.findUnique({
      where: { id: data.orderlineid },
      include: { product: true, orders: true },
    });

    if (!orderline) {
      throw new NotFoundError(`Orderline with ID ${data.orderlineid} not found`);
    }

    if (authUser?.userType === 'ecommerce' && orderline.userid !== authUser.id) {
      throw new ValidationError('Orderline does not belong to customer', 'Customers can only create returns for their own order items');
    }

    this.validateDeliveredOrderline(orderline);

    const eligibility = await this.policyService.resolveEligibility({
      orderlineid: data.orderlineid,
      requesttype: data.requesttype,
    });

    if (!eligibility.eligible) {
      throw new ValidationError('Return policy does not allow this request', eligibility.reason);
    }

    this.validatePolicyWindow(orderline, eligibility.windowdays, data.requesttype);

    const reasonValue = data.reasoncode || data.reason || '';
    const reasonRule = await this.reasonRuleService.findActiveByCodeOrAlias(reasonValue, 'customer');
    this.validateReasonRule(data, reasonRule, orderline);

    await this.validateQuantity(data.orderlineid, data.requestedquantity, orderline.quantity || 1);

    const timestamp = nowSeconds();
    const requestNumber = generateRequestNumber(data.requesttype === 'replacement' ? 'REP' : 'RET');
    const pickupRequired = reasonRule.pickuprequired || data.requestedresolution === 'complete_return';

    const requestPayload = {
      requestnumber: requestNumber,
      orderid: orderline.orderid,
      orderlineid: orderline.id,
      customerid: orderline.userid,
      requesttype: data.requesttype,
      source: authUser?.userType === 'inventory' ? 'admin' : 'customer',
      reason: reasonRule.reasonname,
      reasoncode: reasonRule.reasoncode,
      requestedquantity: data.requestedquantity,
      requestedresolution: data.requestedresolution,
      ispackageopened: data.ispackageopened ?? null,
      additionalremarks: data.additionalremarks || null,
      evidenceReviewStatus: reasonRule.photorequired || reasonRule.videorequired ? 'pending' : 'not_required',
      pickupflow: reasonRule.evidencefirstapproval ? 'evidence_first' : 'pickup_first',
      autoCreatePickup: false,
      pickupCreatedBy: null,
      logisticsProviderSource: null,
      reverseShippingChargeBearer: reasonRule.reverseshippingchargebearer || null,
      reverseShippingChargeAdjustment: reasonRule.reverseshippingchargebearer === 'customer' ? 'undecided' : 'none',
      status: reasonRule.evidencefirstapproval ? 'evidence_pending' : 'requested',
      createdby: authUser?.userType === 'inventory' ? authUser.id : null,
      modifiedby: authUser?.userType === 'inventory' ? authUser.id : null,
      createddate: timestamp,
      modifieddate: timestamp,
    };

    return prisma.$transaction(async (tx: any) => {
      const created = await tx.returnRequest.create({ data: requestPayload });

      if (data.attachments.length > 0) {
        await tx.returnRequestAttachment.createMany({
          data: data.attachments.map((attachment) => ({
            returnrequestid: created.id,
            attachmenttype: attachment.attachmenttype,
            fileurl: attachment.fileurl,
            isrequired: attachment.isrequired ?? this.isAttachmentRequired(attachment.attachmenttype, reasonRule),
            uploadedbycustomerid: authUser?.userType === 'ecommerce' ? authUser.id : orderline.userid,
            uploadeddate: timestamp,
            status: 'active',
          })),
        });
      }

      logger.info(
        {
          requestId: created.id,
          requestNumber,
          orderlineId: data.orderlineid,
          pickupRequired,
        },
        'Return/replacement request created'
      );

      return tx.returnRequest.findUnique({
        where: { id: created.id },
        include: { attachments: true, orderline: { include: { product: true } }, order: true, customer: true },
      });
    });
  }

  async createRtoRequest(data: CreateRtoRequestInput, authUser?: AuthUser) {
    const { order, orderline } = await this.resolveRtoOrderContext(data);
    const reason = await this.resolveRtoReason(data.reasoncode || data.reason || '');
    const timestamp = nowSeconds();
    const quantity = data.requestedquantity || orderline?.quantity || order?.quantity || 1;

    const created = await requestClient().create({
      data: {
        requestnumber: generateRequestNumber('RTO'),
        orderid: order?.id || orderline?.orderid || null,
        orderlineid: orderline?.id || null,
        customerid: orderline?.userid || order?.userid || null,
        requesttype: 'rto',
        source: 'delivery_partner',
        reason: reason.reasonname,
        reasoncode: reason.reasoncode,
        requestedquantity: quantity,
        requestedresolution: null,
        ispackageopened: null,
        additionalremarks: data.additionalremarks || null,
        evidenceReviewStatus: 'not_required',
        pickupflow: null,
        autoCreatePickup: false,
        pickupCreatedBy: null,
        logisticsProviderSource: 'original_forward_provider',
        reverseShippingChargeBearer: null,
        reverseShippingChargeAdjustment: 'none',
        status: data.status,
        createdby: authUser?.userType === 'inventory' ? authUser.id : null,
        modifiedby: authUser?.userType === 'inventory' ? authUser.id : null,
        createddate: timestamp,
        modifieddate: timestamp,
      },
    });

    return this.findById(created.id.toString());
  }

  async updateRtoStatus(id: string, data: UpdateRtoStatusInput, authUser?: AuthUser) {
    const request = await this.findById(id);
    this.validateRtoRequest(request);

    const currentStatus = request.status;
    if (currentStatus === data.status) {
      return request;
    }

    const allowedNextStatuses = RTO_TRANSITIONS[currentStatus] || [];
    if (!allowedNextStatuses.includes(data.status)) {
      throw new ValidationError(
        'Invalid RTO status transition',
        `Cannot move RTO from ${currentStatus} to ${data.status}. Allowed next statuses: ${allowedNextStatuses.join(', ') || 'none'}`
      );
    }

    const timestamp = nowSeconds();
    const updated = await requestClient().update({
      where: { id: request.id },
      data: {
        status: data.status,
        additionalremarks: data.additionalremarks || request.additionalremarks,
        reverseShipmentTrackingId: data.reverse_shipment_tracking_id || request.reverseShipmentTrackingId,
        reverseShipmentProvider: data.reverse_shipment_provider || request.reverseShipmentProvider,
        modifiedby: authUser?.userType === 'inventory' ? authUser.id : request.modifiedby,
        modifieddate: timestamp,
      },
    });

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        previousStatus: currentStatus,
        status: data.status,
      },
      'RTO status updated'
    );

    return this.findById(updated.id.toString());
  }

  async markRtoReceived(id: string, data: MarkRtoReceivedInput, authUser?: AuthUser) {
    const request = await this.findById(id);
    this.validateRtoRequest(request);

    if (request.status === 'rto_received') {
      return request;
    }

    if (!['rto_initiated', 'rto_in_transit'].includes(request.status)) {
      throw new ValidationError(
        'Invalid RTO receive transition',
        `RTO can be marked received only from rto_initiated or rto_in_transit. Current status: ${request.status}`
      );
    }

    const timestamp = nowSeconds();
    const updated = await requestClient().update({
      where: { id: request.id },
      data: {
        status: 'rto_received',
        additionalremarks: data.additionalremarks || request.additionalremarks,
        reverseShipmentTrackingId: data.reverse_shipment_tracking_id || request.reverseShipmentTrackingId,
        reverseShipmentProvider: data.reverse_shipment_provider || request.reverseShipmentProvider,
        modifiedby: authUser?.userType === 'inventory' ? authUser.id : request.modifiedby,
        modifieddate: timestamp,
      },
    });

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        previousStatus: request.status,
      },
      'RTO marked received at warehouse'
    );

    return this.findById(updated.id.toString());
  }

  async reviewEvidence(id: string, data: EvidenceReviewInput, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const request = await this.findById(id);
    if (request.requesttype === 'rto') {
      throw new ValidationError('Evidence review is not applicable to RTO', 'RTO follows warehouse verification flow');
    }

    if (['completed', 'cancelled', 'rejected', 'inspection_approved', 'inspection_rejected'].includes(request.status)) {
      throw new ValidationError('Return request is not reviewable', `Current status ${request.status} cannot be evidence-reviewed`);
    }

    const reasonRule = await this.getReasonRuleForRequest(request);
    if (!reasonRule) {
      throw new ValidationError('Reason rule unavailable', 'Cannot review evidence because the reason rule no longer exists');
    }

    if (data.decision === 'approved') {
      this.validateExistingEvidenceForApproval(request, reasonRule);
    }

    const timestamp = nowSeconds();
    const updated = await requestClient().update({
      where: { id: request.id },
      data: {
        evidenceReviewStatus: data.decision,
        evidenceReviewRemarks: data.remarks || null,
        evidenceRejectionReason: data.decision === 'rejected' ? data.rejectionreason || null : null,
        evidenceReviewedBy: authUser!.id,
        evidenceReviewedDate: timestamp,
        status: data.decision === 'approved' ? 'evidence_approved' : 'evidence_rejected',
        modifiedby: authUser!.id,
        modifieddate: timestamp,
      },
    });

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        decision: data.decision,
        reviewedBy: authUser!.id,
      },
      'Return request evidence reviewed'
    );

    return this.findById(updated.id.toString());
  }

  async approveRequest(id: string, data: ApproveReturnRequestInput, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const request = await this.findById(id);
    this.validateCustomerReturnRequestForAdminDecision(request);

    const reasonRule = await this.getReasonRuleForRequest(request);
    if (!reasonRule) {
      throw new ValidationError('Reason rule unavailable', 'Cannot approve request because the reason rule no longer exists');
    }

    if (reasonRule.evidencefirstapproval && request.evidenceReviewStatus !== 'approved') {
      throw new ValidationError(
        'Evidence approval required',
        'This reason requires evidence approval before request approval'
      );
    }

    if (request.evidenceReviewStatus === 'rejected') {
      throw new ValidationError('Evidence was rejected', 'Request cannot be approved after evidence rejection');
    }

    if (reasonRule.pickuprequired || request.requestedresolution === 'complete_return') {
      this.validateExistingEvidenceForApproval(request, reasonRule);
    }

    const timestamp = nowSeconds();
    const updated = await requestClient().update({
      where: { id: request.id },
      data: {
        requestReviewStatus: 'approved',
        requestReviewRemarks: data.remarks || null,
        requestRejectionReason: null,
        requestReviewedBy: authUser!.id,
        requestReviewedDate: timestamp,
        status: 'approved',
        modifiedby: authUser!.id,
        modifieddate: timestamp,
      },
    });

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        reviewedBy: authUser!.id,
      },
      'Return request approved by admin'
    );

    return this.findById(updated.id.toString());
  }

  async rejectRequest(id: string, data: RejectReturnRequestInput, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const request = await this.findById(id);
    this.validateCustomerReturnRequestForAdminDecision(request);

    const timestamp = nowSeconds();
    const updated = await requestClient().update({
      where: { id: request.id },
      data: {
        requestReviewStatus: 'rejected',
        requestReviewRemarks: data.remarks || null,
        requestRejectionReason: data.rejectionreason,
        requestReviewedBy: authUser!.id,
        requestReviewedDate: timestamp,
        status: 'rejected',
        modifiedby: authUser!.id,
        modifieddate: timestamp,
      },
    });

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        reviewedBy: authUser!.id,
      },
      'Return request rejected by admin'
    );

    return this.findById(updated.id.toString());
  }

  async preparePickup(id: string, data: PreparePickupInput, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const request = await this.findById(id);
    this.validateCustomerReturnRequestForAdminDecisionTarget(request, 'pickup preparation');

    if (request.requestReviewStatus !== 'approved' || !['approved', 'pickup_prepared'].includes(request.status)) {
      throw new ValidationError(
        'Return request is not approved for pickup',
        'Admin request approval is required before pickup preparation'
      );
    }

    const reasonRule = await this.getReasonRuleForRequest(request);
    if (!reasonRule) {
      throw new ValidationError('Reason rule unavailable', 'Cannot prepare pickup because the reason rule no longer exists');
    }

    const pickupRequired = reasonRule.pickuprequired || request.requestedresolution === 'complete_return';
    if (!pickupRequired) {
      throw new ValidationError(
        'Pickup is not required for this request',
        'The selected reason/resolution does not require physical return pickup'
      );
    }

    const timestamp = nowSeconds();
    const hasTracking = Boolean(data.reverse_shipment_tracking_id);
    const updated = await requestClient().update({
      where: { id: request.id },
      data: {
        autoCreatePickup: data.auto_create_pickup,
        pickupCreatedBy: data.pickup_created_by,
        pickupPreparedBy: authUser!.id,
        pickupPreparedDate: timestamp,
        pickupRemarks: data.remarks || null,
        logisticsProviderSource: data.logistics_provider_source,
        reverseShippingChargeBearer: data.reverse_shipping_charge_bearer,
        reverseShippingChargeAdjustment: data.reverse_shipping_charge_adjustment,
        reverseShipmentTrackingId: data.reverse_shipment_tracking_id || request.reverseShipmentTrackingId,
        reverseShipmentProvider: data.reverse_shipment_provider || request.reverseShipmentProvider,
        status: hasTracking ? 'pickup_created' : 'pickup_prepared',
        modifiedby: authUser!.id,
        modifieddate: timestamp,
      },
    });

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        preparedBy: authUser!.id,
        hasTracking,
      },
      'Return pickup preparation saved'
    );

    return this.findById(updated.id.toString());
  }

  async markReceivedAtWarehouse(id: string, data: MarkReturnReceivedInput, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const request = await this.findById(id);
    if (TERMINAL_REQUEST_STATUSES.has(request.status)) {
      throw new ValidationError(
        'Return request is not receivable',
        `Current status ${request.status} cannot be marked received`
      );
    }

    const requestedQuantity = request.requestedquantity || 1;
    const receivedQuantity = data.receivedquantity || requestedQuantity;
    if (receivedQuantity > requestedQuantity) {
      throw new ValidationError(
        'Received quantity exceeds requested quantity',
        `Requested quantity: ${requestedQuantity}, received quantity: ${receivedQuantity}`
      );
    }

    if (request.requesttype !== 'rto') {
      this.validateCustomerReturnRequestForAdminDecisionTarget(request, 'warehouse receipt');

      if (!['approved', 'pickup_prepared', 'pickup_created', 'in_transit', 'received_at_warehouse'].includes(request.status)) {
        throw new ValidationError(
          'Return request is not ready for warehouse receipt',
          'Request must be approved or in pickup flow before it can be marked received'
        );
      }
    }

    const timestamp = nowSeconds();
    const updated = await requestClient().update({
      where: { id: request.id },
      data: {
        receivedQuantity,
        receivedCondition: data.receivedcondition,
        receivedRemarks: data.remarks || null,
        receivedLocation: data.receivedlocation || null,
        receivedBy: authUser!.id,
        receivedDate: timestamp,
        status: request.requesttype === 'rto' ? 'rto_received' : 'received_at_warehouse',
        modifiedby: authUser!.id,
        modifieddate: timestamp,
      },
    });

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        requestType: request.requesttype,
        receivedQuantity,
        receivedBy: authUser!.id,
      },
      'Return/RTO received at warehouse intake completed'
    );

    return this.findById(updated.id.toString());
  }

  async inspectReturn(id: string, data: InspectReturnRequestInput, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const request = await this.findById(id);
    const isRto = this.isRtoRequest(request);

    if (TERMINAL_REQUEST_STATUSES.has(request.status)) {
      throw new ValidationError(
        'Return request is not inspectable',
        `Current status ${request.status} cannot be inspected`
      );
    }

    const inspectableStatuses = isRto
      ? ['rto_received', 'warehouse_verification']
      : ['received_at_warehouse', 'inspection_pending'];

    if (!inspectableStatuses.includes(request.status)) {
      throw new ValidationError(
        'Return request is not ready for inspection',
        isRto
          ? 'RTO must be received before warehouse verification'
          : 'Request must be received at warehouse before authorized inspection'
      );
    }

    const receivedQuantity = data.receivedquantity || request.receivedQuantity;
    if (!receivedQuantity || receivedQuantity <= 0) {
      throw new ValidationError(
        'Received quantity is required',
        'Mark the return as received at warehouse before inspection'
      );
    }

    if (receivedQuantity > (request.receivedQuantity || receivedQuantity)) {
      throw new ValidationError(
        'Inspection received quantity exceeds warehouse receipt',
        `Warehouse received quantity: ${request.receivedQuantity || 0}, inspection received quantity: ${receivedQuantity}`
      );
    }

    const approvedQuantity = data.approvedquantity || 0;
    const rejectedQuantity = data.rejectedquantity || 0;
    const currentInspectionQuantity = approvedQuantity + rejectedQuantity;
    const existingInspectionTotals = this.getInspectionTotals(request.inspections || []);
    const remainingQuantity = receivedQuantity - existingInspectionTotals.inspectedQuantity;

    if (existingInspectionTotals.inspectedQuantity >= receivedQuantity) {
      throw new ValidationError(
        'Return request already fully inspected',
        `Received quantity: ${receivedQuantity}, already inspected quantity: ${existingInspectionTotals.inspectedQuantity}`
      );
    }

    if (currentInspectionQuantity > remainingQuantity) {
      throw new ValidationError(
        'Inspection quantity exceeds remaining received quantity',
        `Received quantity: ${receivedQuantity}, already inspected quantity: ${existingInspectionTotals.inspectedQuantity}, remaining quantity: ${remainingQuantity}, requested inspection quantity: ${currentInspectionQuantity}`
      );
    }

    const cumulativeApprovedQuantity = existingInspectionTotals.approvedQuantity + approvedQuantity;
    const cumulativeRejectedQuantity = existingInspectionTotals.rejectedQuantity + rejectedQuantity;
    const cumulativeInspectedQuantity = cumulativeApprovedQuantity + cumulativeRejectedQuantity;
    const approvedQuantitiesByRestockAction = this.getApprovedQuantitiesByRestockAction(request.inspections || []);

    if (approvedQuantity > 0 && data.restockaction !== 'none') {
      approvedQuantitiesByRestockAction[data.restockaction] += approvedQuantity;
    }

    const isFullyInspected = cumulativeInspectedQuantity >= receivedQuantity;
    const status = isRto
      ? 'warehouse_verification'
      : cumulativeInspectedQuantity < receivedQuantity
        ? 'inspection_pending'
        : cumulativeApprovedQuantity > 0
          ? 'inspection_approved'
          : 'inspection_rejected';
    const shouldApplyStockActions = isFullyInspected && cumulativeApprovedQuantity > 0;
    const timestamp = nowSeconds();
    let stockMovements: Array<Record<string, any>> = [];

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "return_inspections" (
          "return_request_id",
          "inspected_by_inventory_user_id",
          "received_quantity",
          "approved_quantity",
          "rejected_quantity",
          "condition",
          "inspection_notes",
          "restock_action",
          "createddate",
          "modifieddate"
        ) VALUES (
          ${request.id},
          ${authUser!.id},
          ${receivedQuantity},
          ${approvedQuantity},
          ${rejectedQuantity},
          ${data.condition},
          ${data.inspectionnotes || null},
          ${data.restockaction},
          ${timestamp},
          ${timestamp}
        )
      `;

      if (shouldApplyStockActions) {
        stockMovements = await this.applyApprovedInspectionStockActions(
          tx,
          request,
          approvedQuantitiesByRestockAction,
          BigInt(nowMillis())
        );
      }

      const requestUpdateData: Record<string, any> = {
        status,
        modifiedby: authUser!.id,
        modifieddate: timestamp,
      };

      if (isRto && !request.receivedQuantity) {
        requestUpdateData.receivedQuantity = receivedQuantity;
        requestUpdateData.receivedBy = authUser!.id;
        requestUpdateData.receivedDate = request.receivedDate || timestamp;
      }

      await (tx as any).returnRequest.update({
        where: { id: request.id },
        data: requestUpdateData,
      });
    });

    await this.refreshMovedStockTotals(stockMovements);

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        inspectorId: authUser!.id,
        receivedQuantity,
        approvedQuantity,
        rejectedQuantity,
        priorApprovedQuantity: existingInspectionTotals.approvedQuantity,
        priorRejectedQuantity: existingInspectionTotals.rejectedQuantity,
        cumulativeApprovedQuantity,
        cumulativeRejectedQuantity,
        cumulativeInspectedQuantity,
        remainingQuantityAfterInspection: receivedQuantity - cumulativeInspectedQuantity,
        isRto,
        stockMovements,
        condition: data.condition,
        restockAction: data.restockaction,
        status,
        stockUpdated: stockMovements.length > 0,
      },
      'Return inspection saved'
    );

    return this.findById(request.id.toString());
  }

  async addAttachments(id: string, data: AddReturnRequestAttachmentInput, authUser?: AuthUser) {
    const request = await this.findById(id);
    this.validateRequestAccess(request, authUser);
    const timestamp = nowSeconds();
    const reasonRule = await this.getReasonRuleForRequest(request);

    await attachmentClient().createMany({
      data: data.attachments.map((attachment) => ({
        returnrequestid: request.id,
        attachmenttype: attachment.attachmenttype,
        fileurl: attachment.fileurl,
        isrequired: attachment.isrequired ?? this.isAttachmentRequired(attachment.attachmenttype, reasonRule),
        uploadedbycustomerid: authUser?.userType === 'ecommerce' ? authUser.id : request.customerid,
        uploadeddate: timestamp,
        status: 'active',
      })),
    });

    await this.refreshEvidenceStatus(request.id);
    return this.findById(id);
  }

  async uploadEvidenceFile(data: {
    attachmenttype: string;
    fileBuffer: Buffer;
    filename: string;
    mimetype: string;
    returnRequestNumber?: string | null;
  }) {
    this.validateEvidenceFile(data.attachmenttype, data.fileBuffer, data.mimetype);

    const safeFileName = sanitizeFileName(data.filename);
    const pathPrefix = data.returnRequestNumber
      ? `returns/evidence/${data.returnRequestNumber}`
      : `returns/evidence/uploads/${new Date().toISOString().slice(0, 10)}`;
    const filePath = `${pathPrefix}/${randomUUID()}-${safeFileName}`;
    const bucket = process.env.RETURN_EVIDENCE_BUCKET || process.env.GCP_STORAGE_BUCKET;
    let fileurl: string;

    if (!process.env.STORAGE_API_URL && process.env.NODE_ENV !== 'production') {
      fileurl = await this.saveEvidenceFileLocally(filePath, data.fileBuffer);
    } else {
      try {
        fileurl = await storageService.uploadFileToBucket(
          data.fileBuffer,
          filePath,
          data.mimetype,
          bucket
        );
      } catch (error: any) {
      logger.warn(
        { error: error.message, filePath },
        'Storage backend upload failed for return evidence; saving locally'
      );
      fileurl = await this.saveEvidenceFileLocally(filePath, data.fileBuffer);
      }
    }

    return {
      attachmenttype: data.attachmenttype,
      fileurl,
      filename: safeFileName,
      mimetype: data.mimetype,
      filesize: data.fileBuffer.length,
      objectpath: filePath,
      bucket: bucket || null,
    };
  }

  private async saveEvidenceFileLocally(filePath: string, fileBuffer: Buffer) {
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const absolutePath = path.join(process.cwd(), 'uploads', normalizedPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, fileBuffer);

    const apiBaseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5600}`;
    return `${apiBaseUrl.replace(/\/$/, '')}/uploads/${normalizedPath}`;
  }

  async uploadAndAttachEvidence(
    id: string,
    data: {
      attachmenttype: string;
      fileBuffer: Buffer;
      filename: string;
      mimetype: string;
    },
    authUser?: AuthUser
  ) {
    const request = await this.findById(id);
    this.validateRequestAccess(request, authUser);
    const uploaded = await this.uploadEvidenceFile({
      ...data,
      returnRequestNumber: request.requestnumber,
    });

    const reasonRule = await this.getReasonRuleForRequest(request);
    const timestamp = nowSeconds();

    await attachmentClient().create({
      data: {
        returnrequestid: request.id,
        attachmenttype: uploaded.attachmenttype,
        fileurl: uploaded.fileurl,
        isrequired: this.isAttachmentRequired(uploaded.attachmenttype, reasonRule),
        uploadedbycustomerid: authUser?.userType === 'ecommerce' ? authUser.id : request.customerid,
        uploadeddate: timestamp,
        status: 'active',
      },
    });

    await this.refreshEvidenceStatus(request.id);
    return this.findById(id);
  }

  async getOrderReturnEligibility(orderId: string, authUser?: AuthUser) {
    const order = await this.resolveOrderForEligibility(orderId);

    if (authUser?.userType === 'ecommerce' && order.userid !== authUser.id) {
      throw new ValidationError('Order does not belong to customer', 'Customers can only view return eligibility for their own orders');
    }

    const reasonRules = await (prisma as any).returnReasonRule.findMany({
      where: {
        status: 'active',
        OR: [{ source: 'customer' }, { source: 'both' }],
      },
      orderBy: { reasonname: 'asc' },
    });

    const orderlines = Array.isArray(order.orderline) ? order.orderline : [];
    const items = await Promise.all(
      orderlines.map((orderline: any) => this.buildOrderlineEligibility(orderline, order, reasonRules))
    );

    const eligibleItemCount = items.filter((item: any) => item.eligible).length;

    return {
      order: {
        id: order.id,
        orderid: order.orderid,
        orderstatus: order.orderstatus,
        delivereddate: order.delivereddate,
        userid: order.userid,
      },
      eligibleitemcount: eligibleItemCount,
      itemcount: items.length,
      items,
    };
  }

  private validateDeliveredOrderline(orderline: any) {
    const status = (orderline.orderstatus || '').toLowerCase();
    const deliveredDate = toMillis(orderline.delivereddate || orderline.orders?.delivereddate);

    if (!['delivered', 'cod_payment_received'].includes(status) && !deliveredDate) {
      throw new ValidationError('Return request allowed only after delivery', 'The selected order item is not delivered yet');
    }

    if (!deliveredDate) {
      throw new ValidationError('Delivery date unavailable', 'The selected order item does not have a delivery date for return window validation');
    }
  }

  private async resolveOrderForEligibility(orderId: string) {
    const where = /^\d+$/.test(orderId)
      ? { id: parseInt(orderId, 10) }
      : { orderid: orderId };

    const order = await (prisma as any).orders.findFirst({
      where,
      include: {
        orderline: {
          include: {
            product: true,
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundError(`Order ${orderId} not found`);
    }

    return order;
  }

  private async buildOrderlineEligibility(orderline: any, order: any, reasonRules: any[]) {
    const orderedQuantity = orderline.quantity || 1;
    const consumedQuantity = await this.getConsumedQuantity(orderline.id);
    const remainingEligibleQuantity = Math.max(0, orderedQuantity - consumedQuantity);
    const deliveryCheck = this.getDeliveryEligibilityReason(orderline, order);
    const returnEligibility = await this.evaluatePolicyEligibility(orderline, 'return', deliveryCheck.eligible);
    const replacementEligibility = await this.evaluatePolicyEligibility(orderline, 'replacement', deliveryCheck.eligible);
    const returnWindow = this.evaluateWindow(orderline, order, returnEligibility.windowdays, 'return');
    const replacementWindow = this.evaluateWindow(orderline, order, replacementEligibility.windowdays, 'replacement');

    const canReturn = deliveryCheck.eligible
      && returnEligibility.eligible
      && returnWindow.eligible
      && remainingEligibleQuantity > 0;
    const canReplace = deliveryCheck.eligible
      && replacementEligibility.eligible
      && replacementWindow.eligible
      && remainingEligibleQuantity > 0;

    const allowedReasons = reasonRules
      .map((rule: any) => this.serializeReasonForEligibility(rule, canReturn, canReplace))
      .filter(Boolean);

    const blockers = [
      !deliveryCheck.eligible ? deliveryCheck.reason : null,
      remainingEligibleQuantity <= 0 ? 'No remaining eligible quantity' : null,
      !returnEligibility.eligible && !replacementEligibility.eligible
        ? 'Policy does not allow return or replacement for this item'
        : null,
      returnEligibility.eligible && !returnWindow.eligible ? returnWindow.reason : null,
      replacementEligibility.eligible && !replacementWindow.eligible ? replacementWindow.reason : null,
    ].filter(Boolean);

    return {
      orderlineid: orderline.id,
      orderlinenumber: orderline.orderlinenumber,
      productid: orderline.productid,
      productname: orderline.productname || orderline.product?.name || null,
      category: orderline.product?.category || orderline.productcategory || null,
      subcategory: orderline.product?.subcategory || null,
      subsubcategory: orderline.product?.subsubcategory || null,
      orderstatus: orderline.orderstatus,
      delivereddate: orderline.delivereddate || order.delivereddate || null,
      orderedquantity: orderedQuantity,
      activeorconsumedquantity: consumedQuantity,
      remainingeligiblequantity: remainingEligibleQuantity,
      eligible: canReturn || canReplace,
      return: {
        eligible: canReturn,
        policyeligible: returnEligibility.eligible,
        windowdays: returnEligibility.windowdays,
        allowedrefundmethods: returnEligibility.allowedrefundmethods,
        reason: canReturn ? 'Return can be requested' : returnWindow.reason || returnEligibility.reason || deliveryCheck.reason,
      },
      replacement: {
        eligible: canReplace,
        policyeligible: replacementEligibility.eligible,
        windowdays: replacementEligibility.windowdays,
        reason: canReplace ? 'Replacement can be requested' : replacementWindow.reason || replacementEligibility.reason || deliveryCheck.reason,
      },
      allowedreasons: allowedReasons,
      blockers,
    };
  }

  private async getConsumedQuantity(orderlineId: number) {
    const requests = await requestClient().findMany({
      where: {
        orderlineid: orderlineId,
        requesttype: { in: ['return', 'replacement'] },
      },
      select: {
        requestedquantity: true,
        status: true,
      },
    });

    return requests
      .filter((request: any) => !NON_CONSUMING_STATUSES.has(request.status))
      .reduce((sum: number, request: any) => sum + (request.requestedquantity || 0), 0);
  }

  private getDeliveryEligibilityReason(orderline: any, order: any) {
    const status = (orderline.orderstatus || order.orderstatus || '').toLowerCase();
    const deliveredDate = toMillis(orderline.delivereddate || order.delivereddate);

    if (['cancelled', 'returned', 'rto_initiated', 'rto_delivered'].includes(status)) {
      return {
        eligible: false,
        reason: `Item is already in ${status} status`,
      };
    }

    if (!['delivered', 'cod_payment_received'].includes(status) && !deliveredDate) {
      return {
        eligible: false,
        reason: 'Item is not delivered yet',
      };
    }

    if (!deliveredDate) {
      return {
        eligible: false,
        reason: 'Delivery date unavailable',
      };
    }

    return {
      eligible: true,
      reason: 'Item delivered',
    };
  }

  private async evaluatePolicyEligibility(orderline: any, requesttype: 'return' | 'replacement', deliveryEligible: boolean) {
    if (!deliveryEligible) {
      return {
        eligible: false,
        windowdays: null,
        allowedrefundmethods: [],
        reason: 'Item is not delivery-eligible',
      };
    }

    try {
      return await this.policyService.resolveEligibility({
        orderlineid: orderline.id,
        requesttype,
      });
    } catch (error: any) {
      return {
        eligible: false,
        windowdays: null,
        allowedrefundmethods: [],
        reason: error.message || `Unable to evaluate ${requesttype} policy`,
      };
    }
  }

  private evaluateWindow(orderline: any, order: any, windowDays: number | null, requestType: 'return' | 'replacement') {
    if (windowDays === null || windowDays === undefined) {
      return {
        eligible: true,
        reason: `${requestType} window does not have a day limit`,
      };
    }

    const deliveredAt = toMillis(orderline.delivereddate || order.delivereddate);
    if (!deliveredAt) {
      return {
        eligible: false,
        reason: 'Delivery date unavailable',
      };
    }

    const deadline = deliveredAt + windowDays * 24 * 60 * 60 * 1000;
    if (nowMillis() > deadline) {
      return {
        eligible: false,
        reason: `${requestType === 'return' ? 'Return' : 'Replacement'} window expired`,
      };
    }

    return {
      eligible: true,
      reason: `${requestType === 'return' ? 'Return' : 'Replacement'} window is active`,
    };
  }

  private serializeReasonForEligibility(rule: any, canReturn: boolean, canReplace: boolean) {
    const allowedResolutions = Array.isArray(rule.allowedresolutions) ? rule.allowedresolutions : [];
    const usableResolutions = allowedResolutions.filter((resolution: string) => {
      if (resolution === 'replacement') {
        return canReplace;
      }

      return canReturn;
    });

    if (usableResolutions.length === 0) {
      return null;
    }

    return {
      reasoncode: rule.reasoncode,
      reasonname: rule.reasonname,
      aliases: rule.aliases || [],
      allowedresolutions: usableResolutions,
      minimumraisewindowhours: rule.minimumraisewindowhours,
      evidencerequirements: {
        photorequired: rule.photorequired,
        videorequired: rule.videorequired,
        packagephotorequired: rule.packagephotorequired,
        packagephotooptional: rule.packagephotooptional,
        unboxingvideorequired: rule.unboxingvideorequired,
        unboxingvideooptional: rule.unboxingvideooptional,
      },
      openedpackageallowed: rule.openedpackageallowed,
      pickuprequired: rule.pickuprequired,
      pickupflow: rule.evidencefirstapproval ? 'evidence_first' : 'pickup_first',
      reverseshippingchargebearer: rule.reverseshippingchargebearer,
    };
  }

  private validatePolicyWindow(orderline: any, windowDays: number | null, requestType: 'return' | 'replacement') {
    if (windowDays === null || windowDays === undefined) {
      return;
    }

    const deliveredAt = toMillis(orderline.delivereddate || orderline.orders?.delivereddate);
    if (!deliveredAt) {
      throw new ValidationError('Delivery date unavailable', 'Cannot validate return window without delivery date');
    }

    const deadline = deliveredAt + windowDays * 24 * 60 * 60 * 1000;
    if (nowMillis() > deadline) {
      throw new ValidationError(
        `${requestType === 'return' ? 'Return' : 'Replacement'} window expired`,
        `The ${windowDays}-day window from delivery has expired`
      );
    }
  }

  private validateReasonRule(data: CreateReturnRequestInput, reasonRule: any, orderline: any) {
    if (!Array.isArray(reasonRule.allowedresolutions) || !reasonRule.allowedresolutions.includes(data.requestedresolution)) {
      throw new ValidationError(
        'Resolution not allowed for selected reason',
        `${data.requestedresolution} is not allowed for ${reasonRule.reasonname}`
      );
    }

    if (data.ispackageopened === true && !reasonRule.openedpackageallowed) {
      throw new ValidationError('Opened package is not eligible', `${reasonRule.reasonname} requires unopened package`);
    }

    if (reasonRule.minimumraisewindowhours) {
      const deliveredAt = toMillis(orderline.delivereddate || orderline.orders?.delivereddate);
      const deadline = deliveredAt ? deliveredAt + reasonRule.minimumraisewindowhours * 60 * 60 * 1000 : null;

      if (!deadline || nowMillis() > deadline) {
        throw new ValidationError(
          'Reason-specific raise window expired',
          `${reasonRule.reasonname} must be raised within ${reasonRule.minimumraisewindowhours} hours from delivery`
        );
      }
    }

    this.validateEvidence(data.attachments, reasonRule);
  }

  private validateEvidence(attachments: ReturnRequestAttachmentInput[], reasonRule: any) {
    const types = getAttachmentTypes(attachments);
    const hasAnyPhoto = types.has('product_photo') || types.has('package_photo');
    const hasAnyVideo = types.has('defect_video') || types.has('unboxing_video');

    if (reasonRule.photorequired && !hasAnyPhoto) {
      throw new ValidationError('Photo evidence required', `${reasonRule.reasonname} requires at least one photo`);
    }
    if (reasonRule.packagephotorequired && !types.has('package_photo')) {
      throw new ValidationError('Package photo required', `${reasonRule.reasonname} requires package photo evidence`);
    }
    if (reasonRule.videorequired && !hasAnyVideo) {
      throw new ValidationError('Video evidence required', `${reasonRule.reasonname} requires video evidence`);
    }
    if (reasonRule.unboxingvideorequired && !types.has('unboxing_video')) {
      throw new ValidationError('Unboxing video required', `${reasonRule.reasonname} requires unboxing video evidence`);
    }
  }

  private validateEvidenceFile(attachmentType: string, fileBuffer: Buffer, mimetype: string) {
    if (fileBuffer.length === 0) {
      throw new ValidationError('Empty file uploaded', 'The evidence file appears to be empty');
    }

    const isPhotoType = attachmentType === 'product_photo' || attachmentType === 'package_photo';
    const isVideoType = attachmentType === 'defect_video' || attachmentType === 'unboxing_video';

    if (isPhotoType) {
      if (!IMAGE_MIME_TYPES.has(mimetype)) {
        throw new ValidationError('Invalid photo evidence type', 'Photo evidence must be JPEG, PNG, or WebP');
      }
      if (fileBuffer.length > MAX_IMAGE_BYTES) {
        throw new ValidationError('Photo evidence too large', 'Photo evidence must be 8 MB or smaller');
      }
      return;
    }

    if (isVideoType) {
      if (!VIDEO_MIME_TYPES.has(mimetype)) {
        throw new ValidationError('Invalid video evidence type', 'Video evidence must be MP4, MOV, or WebM');
      }
      if (fileBuffer.length > MAX_VIDEO_BYTES) {
        throw new ValidationError('Video evidence too large', 'Video evidence must be 60 MB or smaller');
      }
      return;
    }

    const allowedOther = IMAGE_MIME_TYPES.has(mimetype) || VIDEO_MIME_TYPES.has(mimetype) || PDF_MIME_TYPES.has(mimetype);
    if (!allowedOther) {
      throw new ValidationError('Invalid evidence file type', 'Evidence must be an image, video, or PDF');
    }
    if (fileBuffer.length > MAX_OTHER_BYTES) {
      throw new ValidationError('Evidence file too large', 'Evidence files must be 15 MB or smaller unless uploaded as a video evidence type');
    }
  }

  private isAttachmentRequired(attachmentType: string, reasonRule: any) {
    if (!reasonRule) {
      return false;
    }

    if (attachmentType === 'package_photo') {
      return Boolean(reasonRule.packagephotorequired);
    }
    if (attachmentType === 'product_photo') {
      return Boolean(reasonRule.photorequired);
    }
    if (attachmentType === 'defect_video') {
      return Boolean(reasonRule.videorequired);
    }
    if (attachmentType === 'unboxing_video') {
      return Boolean(reasonRule.unboxingvideorequired);
    }

    return false;
  }

  private validateRequestAccess(request: any, authUser?: AuthUser) {
    if (authUser?.userType === 'ecommerce' && request.customerid !== authUser.id) {
      throw new ValidationError('Return request does not belong to customer', 'Customers can only update their own return requests');
    }
  }

  private async attachInspectionsToRequest(request: any) {
    const [requestWithInspections] = await this.attachInspectionsToRequests([request]);
    return requestWithInspections;
  }

  private async attachInspectionsToRequests(requests: any[]) {
    if (!Array.isArray(requests) || requests.length === 0) {
      return requests;
    }

    const requestIds = requests
      .map((request) => Number(request.id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (requestIds.length === 0) {
      return requests.map((request) => ({ ...request, inspections: [] }));
    }

    const inspections = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        "id",
        "return_request_id",
        "inspected_by_inventory_user_id",
        "received_quantity",
        "approved_quantity",
        "rejected_quantity",
        "condition",
        "inspection_notes",
        "restock_action",
        "createddate",
        "modifieddate"
      FROM "return_inspections"
      WHERE "return_request_id" IN (${requestIds.join(',')})
      ORDER BY "createddate" DESC NULLS LAST, "id" DESC
    `);

    const inspectionsByRequestId = new Map<number, any[]>();
    inspections.forEach((inspection) => {
      const returnRequestId = Number(inspection.return_request_id);
      const mappedInspection = {
        id: inspection.id,
        returnRequestId,
        inspectedByInventoryUserId: inspection.inspected_by_inventory_user_id,
        receivedQuantity: inspection.received_quantity,
        approvedQuantity: inspection.approved_quantity,
        rejectedQuantity: inspection.rejected_quantity,
        condition: inspection.condition,
        inspectionNotes: inspection.inspection_notes,
        restockAction: inspection.restock_action,
        createddate: inspection.createddate,
        modifieddate: inspection.modifieddate,
      };

      const existing = inspectionsByRequestId.get(returnRequestId) || [];
      existing.push(mappedInspection);
      inspectionsByRequestId.set(returnRequestId, existing);
    });

    return requests.map((request) => ({
      ...request,
      inspections: inspectionsByRequestId.get(Number(request.id)) || [],
    }));
  }

  private getInspectionTotals(inspections: any[]) {
    return inspections.reduce(
      (totals, inspection) => {
        const approvedQuantity = Number(inspection.approvedQuantity || inspection.approved_quantity || 0);
        const rejectedQuantity = Number(inspection.rejectedQuantity || inspection.rejected_quantity || 0);

        totals.approvedQuantity += Number.isFinite(approvedQuantity) ? approvedQuantity : 0;
        totals.rejectedQuantity += Number.isFinite(rejectedQuantity) ? rejectedQuantity : 0;
        totals.inspectedQuantity = totals.approvedQuantity + totals.rejectedQuantity;

        return totals;
      },
      { approvedQuantity: 0, rejectedQuantity: 0, inspectedQuantity: 0 }
    );
  }

  private getApprovedQuantitiesByRestockAction(inspections: any[]) {
    const quantities: Record<'available' | 'damaged' | 'quarantine', number> = {
      available: 0,
      damaged: 0,
      quarantine: 0,
    };

    inspections.forEach((inspection) => {
      const restockAction = inspection.restockAction || inspection.restock_action;
      const approvedQuantity = Number(inspection.approvedQuantity || inspection.approved_quantity || 0);

      if (
        ['available', 'damaged', 'quarantine'].includes(restockAction) &&
        Number.isFinite(approvedQuantity) &&
        approvedQuantity > 0
      ) {
        quantities[restockAction as 'available' | 'damaged' | 'quarantine'] += approvedQuantity;
      }
    });

    return quantities;
  }

  private async applyApprovedInspectionStockActions(
    tx: any,
    request: any,
    quantitiesByRestockAction: Record<'available' | 'damaged' | 'quarantine', number>,
    modifiedDate: bigint
  ) {
    const orderStockId = request.order?.orderid || (request.orderid ? String(request.orderid) : null);
    const orderlineNumber = request.orderline?.orderlinenumber;

    if (!orderStockId || !orderlineNumber) {
      throw new ValidationError(
        'Return stock allocation not found',
        'Return inspection requires an order number and orderline number to move allocated stock'
      );
    }

    const movements: Array<Record<string, any>> = [];
    const actions: Array<{ restockAction: 'available' | 'damaged' | 'quarantine'; stockstatus: string }> = [
      { restockAction: 'available', stockstatus: 'available' },
      { restockAction: 'damaged', stockstatus: 'damaged' },
      { restockAction: 'quarantine', stockstatus: 'quarantine' },
    ];

    for (const action of actions) {
      const quantity = quantitiesByRestockAction[action.restockAction];
      if (!quantity) {
        continue;
      }

      const stocks = await tx.$queryRaw<any[]>`
        SELECT "id", "puc", "platform", "stockstatus", "ecompublish"
        FROM "stock"
        WHERE "orderid" = ${orderStockId}
          AND "orderlinenumber" = ${orderlineNumber}
          AND LOWER("stockstatus") = 'sold'
          AND COALESCE("isdeleted", false) = false
          AND COALESCE("isarchive", false) = false
        ORDER BY "solddate" NULLS LAST, "id" ASC
        LIMIT ${quantity}
      `;

      if (!Array.isArray(stocks) || stocks.length < quantity) {
        throw new ValidationError(
          'Insufficient sold stock allocated to return',
          `Required ${quantity} stock item(s) for ${action.restockAction}, found ${stocks?.length || 0}`
        );
      }

      for (const stock of stocks) {
        await tx.$executeRaw`
          UPDATE "stock"
          SET
            "stockstatus" = ${action.stockstatus},
            "orderid" = NULL,
            "orderlinenumber" = NULL,
            "solddate" = NULL,
            "modifieddate" = ${modifiedDate}
          WHERE "id" = ${stock.id}
        `;

        movements.push({
          stockId: stock.id,
          puc: stock.puc,
          platform: stock.platform,
          fromStatus: stock.stockstatus,
          toStatus: action.stockstatus,
          restockAction: action.restockAction,
        });
      }
    }

    return movements;
  }

  private async refreshMovedStockTotals(stockMovements: Array<Record<string, any>>) {
    if (!Array.isArray(stockMovements) || stockMovements.length === 0) {
      return;
    }

    const pucs = Array.from(new Set(stockMovements.map((movement) => movement.puc).filter(Boolean)));
    for (const puc of pucs) {
      await this.productStockService.updateStockTotals(String(puc));
    }

    const platformPairs = new Map<string, { puc: string; platform: string }>();
    stockMovements.forEach((movement) => {
      if (movement.puc && movement.platform) {
        platformPairs.set(`${movement.puc}:${movement.platform}`, {
          puc: String(movement.puc),
          platform: String(movement.platform),
        });
      }
    });

    for (const pair of platformPairs.values()) {
      const product = await (prisma as any).product.findFirst({
        where: { puc: pair.puc },
      });

      if (product?.id) {
        await this.platformStockService.recalculatePlatformStockQuantities(Number(product.id), pair.platform);
      }
    }
  }

  private validateInventoryUser(authUser?: AuthUser) {
    if (!authUser || authUser.userType !== 'inventory') {
      throw new ValidationError('Inventory administrator access required', 'Only inventory/admin users can perform this action');
    }
  }

  private validateRtoRequest(request: any) {
    if (request.requesttype !== 'rto' || request.source !== 'delivery_partner') {
      throw new ValidationError(
        'Not an RTO record',
        'This endpoint can update only delivery-partner RTO records'
      );
    }
  }

  private isRtoRequest(request: any) {
    return request.requesttype === 'rto' || request.source === 'delivery_partner';
  }

  private validateCustomerReturnRequestForAdminDecision(request: any) {
    this.validateCustomerReturnRequestForAdminDecisionTarget(request, 'approval decision');

    if (request.requestReviewStatus === 'approved') {
      throw new ValidationError('Return request already approved', 'This request has already been accepted');
    }
  }

  private validateCustomerReturnRequestForAdminDecisionTarget(request: any, actionName: string) {
    if (request.requesttype === 'rto' || request.source === 'delivery_partner') {
      throw new ValidationError(
        `Admin ${actionName} is not applicable to RTO`,
        'RTO follows delivery-partner warehouse verification flow'
      );
    }

    if (TERMINAL_REQUEST_STATUSES.has(request.status)) {
      throw new ValidationError(
        'Return request is not reviewable',
        `Current status ${request.status} cannot be used for ${actionName}`
      );
    }
  }

  private async getReasonRuleForRequest(request: any) {
    return (prisma as any).returnReasonRule.findFirst({
      where: {
        reasoncode: request.reasoncode,
      },
    });
  }

  private async refreshEvidenceStatus(requestId: number) {
    const request = await requestClient().findUnique({
      where: { id: requestId },
      include: { attachments: true },
    });

    if (!request || request.requesttype === 'rto') {
      return;
    }

    const reasonRule = await this.getReasonRuleForRequest(request);
    if (!reasonRule) {
      return;
    }

    const activeAttachments = (request.attachments || []).filter((attachment: any) => attachment.status === 'active');
    const types = getAttachmentTypes(activeAttachments);
    const hasPhoto = types.has('product_photo') || types.has('package_photo');
    const hasVideo = types.has('defect_video') || types.has('unboxing_video');
    const hasRequiredEvidence =
      (!reasonRule.photorequired || hasPhoto)
      && (!reasonRule.packagephotorequired || types.has('package_photo'))
      && (!reasonRule.videorequired || hasVideo)
      && (!reasonRule.unboxingvideorequired || types.has('unboxing_video'));

    const needsEvidence = reasonRule.photorequired
      || reasonRule.packagephotorequired
      || reasonRule.videorequired
      || reasonRule.unboxingvideorequired;

    const updateData: Record<string, any> = {
      modifieddate: nowSeconds(),
    };

    if (!needsEvidence) {
      updateData.evidenceReviewStatus = 'not_required';
    } else {
      updateData.evidenceReviewStatus = 'pending';
      if (hasRequiredEvidence && request.status === 'requested' && reasonRule.evidencefirstapproval) {
        updateData.status = 'evidence_pending';
      }
    }

    await requestClient().update({
      where: { id: requestId },
      data: updateData,
    });
  }

  private validateExistingEvidenceForApproval(request: any, reasonRule: any) {
    const activeAttachments = (request.attachments || []).filter((attachment: any) => attachment.status === 'active');
    const types = getAttachmentTypes(activeAttachments);
    const hasPhoto = types.has('product_photo') || types.has('package_photo');
    const hasVideo = types.has('defect_video') || types.has('unboxing_video');

    if (reasonRule.photorequired && !hasPhoto) {
      throw new ValidationError('Photo evidence required', `${reasonRule.reasonname} requires at least one photo before approval`);
    }
    if (reasonRule.packagephotorequired && !types.has('package_photo')) {
      throw new ValidationError('Package photo required', `${reasonRule.reasonname} requires package photo evidence before approval`);
    }
    if (reasonRule.videorequired && !hasVideo) {
      throw new ValidationError('Video evidence required', `${reasonRule.reasonname} requires video evidence before approval`);
    }
    if (reasonRule.unboxingvideorequired && !types.has('unboxing_video')) {
      throw new ValidationError('Unboxing video required', `${reasonRule.reasonname} requires unboxing video before approval`);
    }
  }

  private async validateQuantity(orderlineId: number, requestedQuantity: number, orderedQuantity: number) {
    const existingRequests = await requestClient().findMany({
      where: {
        orderlineid: orderlineId,
      },
      select: {
        requestedquantity: true,
        status: true,
      },
    });

    const consumedQuantity = existingRequests
      .filter((request: any) => !NON_CONSUMING_STATUSES.has(request.status))
      .reduce((sum: number, request: any) => sum + (request.requestedquantity || 0), 0);

    const remainingQuantity = Math.max(0, orderedQuantity - consumedQuantity);

    if (requestedQuantity > remainingQuantity) {
      throw new ValidationError(
        'Requested quantity exceeds remaining eligible quantity',
        `Ordered quantity: ${orderedQuantity}, already consumed or active: ${consumedQuantity}, remaining: ${remainingQuantity}`
      );
    }
  }

  private async resolveRtoOrderContext(data: CreateRtoRequestInput) {
    if (data.orderlineid) {
      const orderline = await (prisma as any).orderline.findUnique({
        where: { id: data.orderlineid },
        include: { orders: true },
      });

      if (!orderline) {
        throw new NotFoundError(`Orderline with ID ${data.orderlineid} not found`);
      }

      return { order: orderline.orders, orderline };
    }

    if (data.orderid) {
      const order = await (prisma as any).orders.findUnique({
        where: { id: data.orderid },
        include: { orderline: true },
      });

      if (!order) {
        throw new NotFoundError(`Order with ID ${data.orderid} not found`);
      }

      return { order, orderline: order.orderline?.[0] || null };
    }

    const order = await (prisma as any).orders.findFirst({
      where: { tracking_id: data.trackingid },
      include: { orderline: true },
    });

    if (!order) {
      throw new NotFoundError(`Order with tracking ID ${data.trackingid} not found`);
    }

    return { order, orderline: order.orderline?.[0] || null };
  }

  private async resolveRtoReason(value: string) {
    try {
      return await this.reasonRuleService.findActiveByCodeOrAlias(value, 'delivery_partner');
    } catch (error) {
      return {
        reasoncode: normalizeCode(value),
        reasonname: value,
      };
    }
  }
}
