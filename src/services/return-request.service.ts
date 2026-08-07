import { prisma } from '../models/prisma.js';
import {
  AddReturnRequestAttachmentInput,
  ApproveReturnRequestInput,
  CompleteReturnResolutionInput,
  CreateReturnCreditNoteInput,
  CreateReturnRequestInput,
  CreateRtoRequestInput,
  InspectReturnRequestInput,
  MarkReturnReceivedInput,
  MarkRtoReceivedInput,
  PreparePickupInput,
  RejectReturnRequestInput,
  ReturnRequestAttachmentInput,
  ReturnOperationsSummaryQuery,
  ReturnRequestQuery,
  UpdateReturnRefundStatusInput,
  UpdateReturnShipmentStatusInput,
  UpdateRtoStatusInput,
} from '../schemas/return-source.schema.js';
import { createPaginationResult, getPrismaSkipTake, PaginationResult } from '../utils/pagination.js';
import { NotFoundError, ValidationError } from '../utils/errorHandler.js';
import { ReturnReplacementPolicyService } from './return-replacement-policy.service.js';
import { ReturnReasonRuleService } from './return-reason-rule.service.js';
import { ReturnPolicyReasonRuleService } from './return-policy-reason-rule.service.js';
import { ProductService } from './product.service.js';
import { PlatformStockService } from './platformStock.service.js';
import { CustomerNotificationService } from './customer-notification.service.js';
import { CreateShipmentPayload, CreateShipmentResponse, ekartService } from './ekart.service.js';
import { RefundOperationService } from './refund-operation.service.js';
import { logger } from '../config/logger.js';
import { storageService } from './storage.service.js';
import { invoiceAdjustmentService } from './invoice-adjustment.service.js';
import {
  calculateCreditNoteTaxBreakup,
  hasActiveCreditNoteForResolution,
  resolveCreditNoteRefundAmount,
} from '../utils/returnFinance.js';
import { randomUUID } from 'crypto';
import ExcelJS from 'exceljs';
import { createReadStream } from 'fs';
import { access, mkdir, stat, writeFile } from 'fs/promises';
import path from 'path';
import { Storage } from '@google-cloud/storage';

type AuthUser = {
  id: number;
  userType?: 'inventory' | 'ecommerce';
};

type ReplacementStockAvailability = {
  productId: number | null;
  puc: string | null;
  requestedQuantity: number;
  availableQuantity: number;
  ecomPublishedAvailableQuantity: number;
  platformAvailableQuantity: number;
  platformEcomQuantity: number;
  hasEnoughStock: boolean;
  stockSource: string;
};

type EvidenceFileLocation = {
  stream?: any | undefined;
  redirectUrl?: string | undefined;
  contentType: string;
  contentLength?: number | undefined;
  objectPath: string;
  source: 'local' | 'gcs' | 'gcs_public';
};

const requestClient = () => prisma.returnRequest;
const attachmentClient = () => prisma.returnRequestAttachment;
const RETURN_REQUEST_INCLUDE = {
  attachments: true,
  orderline: { include: { product: true, address: true, orders: { include: { address: true } } } },
  order: { include: { address: true } },
  customer: true,
};

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const PDF_MIME_TYPES = new Set(['application/pdf']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const MAX_OTHER_BYTES = 15 * 1024 * 1024;
const DEFAULT_EVIDENCE_STORAGE_BUCKET = 'niv-return-attachments-dev';
const gcsStorage = new Storage();
const EVIDENCE_CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.pdf': 'application/pdf',
};

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
  warehouse_verification: ['rto_closed', 'closed'],
  rto_closed: [],
  closed: [],
};

const OUTBOUND_SHIPMENT_ACTIONS = new Set(['replacement_shipment', 'missing_item_shipment']);
const REFUND_ACTIONS = new Set(['refund', 'partial_refund']);

const TERMINAL_REQUEST_STATUSES = new Set([
  'completed',
  'cancelled',
  'rejected',
  'evidence_rejected',
  'inspection_rejected',
  'refund_completed',
  'replacement_shipped',
  'replacement_delivered',
  'missing_item_shipped',
  'rto_closed',
  'closed',
]);

const RETURN_STATUS_MESSAGES: Record<string, string> = {
  requested: 'Return/replacement request submitted',
  evidence_pending: 'Evidence submitted for review',
  evidence_approved: 'Evidence approved',
  evidence_rejected: 'Evidence rejected',
  approved: 'Request approved',
  rejected: 'Request rejected',
  pickup_prepared: 'Pickup prepared',
  pickup_created: 'Reverse pickup created',
  in_transit: 'Return shipment in transit',
  received_at_warehouse: 'Received at warehouse',
  inspection_pending: 'Warehouse inspection pending',
  inspection_approved: 'Warehouse inspection approved',
  inspection_rejected: 'Warehouse inspection rejected',
  refund_pending: 'Refund pending',
  refund_completed: 'Refund completed',
  refund_progress: 'Refund progress updated',
  replacement_pending: 'Replacement pending',
  replacement_shipped: 'Replacement shipped',
  replacement_delivered: 'Replacement delivered',
  missing_item_pending: 'Missing item shipment pending',
  missing_item_shipped: 'Missing item shipped',
  completed: 'Request completed',
  delivery_failed: 'Delivery failed',
  rto_initiated: 'RTO initiated',
  rto_in_transit: 'RTO in transit',
  rto_received: 'RTO received at warehouse',
  warehouse_verification: 'Warehouse verification completed',
  rto_closed: 'RTO closed',
  closed: 'Closed',
  shipment_progress: 'Fulfilment shipment progress updated',
};

const OPERATIONS_QUEUE_BUCKETS = [
  {
    key: 'needsRequestApproval',
    label: 'Needs Request Approval',
    statuses: ['requested', 'evidence_pending', 'evidence_approved'],
    slaHours: 24,
  },
  {
    key: 'readyForPickup',
    label: 'Ready For Pickup',
    statuses: ['approved', 'pickup_prepared'],
    slaHours: 24,
  },
  {
    key: 'awaitingWarehouseReceipt',
    label: 'Awaiting Warehouse Receipt',
    statuses: ['pickup_created', 'in_transit', 'rto_in_transit'],
    slaHours: 48,
  },
  {
    key: 'readyForInspection',
    label: 'Ready For Inspection',
    statuses: ['received_at_warehouse', 'inspection_pending', 'rto_received', 'warehouse_verification'],
    slaHours: 24,
  },
  {
    key: 'readyForResolution',
    label: 'Ready For Resolution',
    statuses: ['inspection_approved', 'refund_pending', 'replacement_pending', 'missing_item_pending', 'replacement_shipped', 'missing_item_shipped'],
    slaHours: 48,
  },
] as const;

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function epochSeconds(value?: number | bigint | null) {
  const timestamp = Number(value || 0);
  if (!timestamp) return nowSeconds();
  return timestamp > 1000000000000 ? Math.floor(timestamp / 1000) : Math.floor(timestamp);
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

function generateCreditNoteNumber(requestNumber: string) {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CN-${requestNumber}-${Date.now()}-${random}`.slice(0, 100);
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

function normalizeEvidenceAttachmentType(type: string) {
  const normalized = normalizeCode(type);
  if (normalized === 'package_photo') return 'product_photo';
  if (normalized === 'unboxing_video') return 'defect_video';
  return normalized;
}

function toJsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(toJsonSafe);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, toJsonSafe(entry)])
    );
  }
  return value;
}

function getEvidenceRules(reasonRule: any): Array<{ type: string; required: boolean; minimum: number }> {
  const normalizeRules = (rules: Array<{ type: string; required: boolean; minimum: number }>) => {
    const byType = new Map<string, { type: string; required: boolean; minimum: number }>();

    rules.forEach((rule) => {
      const type = normalizeEvidenceAttachmentType(rule.type);
      if (!['product_photo', 'defect_video'].includes(type)) {
        return;
      }

      const existing = byType.get(type);
      byType.set(type, {
        type,
        required: Boolean(existing?.required || rule.required),
        minimum: Math.max(Number(existing?.minimum || 0), Number(rule.minimum || 0)),
      });
    });

    return ['product_photo', 'defect_video']
      .map((type) => byType.get(type))
      .filter(Boolean) as Array<{ type: string; required: boolean; minimum: number }>;
  };

  if (Array.isArray(reasonRule?.evidencerules) && reasonRule.evidencerules.length > 0) {
    return normalizeRules(reasonRule.evidencerules
      .map((rule: any) => ({
        type: normalizeCode(String(rule?.type || '')),
        required: Boolean(rule?.required),
        minimum: Number.isFinite(Number(rule?.minimum)) ? Number(rule.minimum) : (rule?.required ? 1 : 0),
      }))
      .filter((rule: any) => rule.type));
  }

  const rules: Array<{ type: string; required: boolean; minimum: number }> = [];
  if (reasonRule?.photorequired) {
    rules.push({ type: 'product_photo', required: true, minimum: 1 });
  }
  if (reasonRule?.packagephotorequired) {
    rules.push({ type: 'package_photo', required: true, minimum: 1 });
  }
  if (reasonRule?.videorequired) {
    rules.push({ type: 'defect_video', required: true, minimum: 1 });
  }
  if (reasonRule?.unboxingvideorequired) {
    rules.push({ type: 'unboxing_video', required: true, minimum: 1 });
  }
  return normalizeRules(rules);
}

function hasRequiredEvidenceRules(reasonRule: any) {
  return getEvidenceRules(reasonRule).some((rule) => rule.required && rule.minimum > 0);
}

function countAttachmentsByType(attachments: Array<{ attachmenttype: string }>) {
  return attachments.reduce<Record<string, number>>((counts, attachment) => {
    const type = normalizeEvidenceAttachmentType(attachment.attachmenttype);
    counts[type] = (counts[type] || 0) + 1;
    return counts;
  }, {});
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    const text = String(value).trim();
    if (text) {
      return text;
    }
  }
  return '';
}

function numberFromUnknown(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'object' && typeof (value as { toNumber?: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  const normalized = String(value).replace(/[^0-9.-]+/g, '');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function positiveNumber(value: unknown, fallback: number) {
  const numeric = numberFromUnknown(value);
  return numeric && numeric > 0 ? numeric : fallback;
}

function integerFromUnknown(value: unknown): number | null {
  const numeric = numberFromUnknown(value);
  if (!numeric || numeric <= 0) {
    return null;
  }
  return Math.trunc(numeric);
}

function phoneFromUnknown(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const digits = String(value).replace(/\D+/g, '');
  if (!digits) {
    return null;
  }
  const normalized = digits.length > 10 ? digits.slice(-10) : digits;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function formatInvoiceDate(value: unknown) {
  const millis = toMillis(value) || Date.now();
  return new Date(millis).toISOString().slice(0, 10);
}

function formatExcelDate(value: unknown) {
  const millis = toMillis(value);
  return millis ? new Date(millis).toISOString().replace('T', ' ').slice(0, 19) : '';
}

function buildAddressLine(address: any) {
  return [
    firstText(address?.doornumber),
    firstText(address?.address),
    firstText(address?.landmark),
  ].filter(Boolean).join(', ');
}

export class ReturnRequestService {
  private policyService = new ReturnReplacementPolicyService();
  private reasonRuleService = new ReturnReasonRuleService();
  private policyReasonRuleService = new ReturnPolicyReasonRuleService();
  private productStockService = new ProductService();
  private platformStockService = new PlatformStockService();
  private customerNotificationService = new CustomerNotificationService();
  private refundOperationService = new RefundOperationService();

  async findMany(query: ReturnRequestQuery, page: number, limit: number, authUser?: AuthUser): Promise<PaginationResult<any>> {
    const { skip, take } = getPrismaSkipTake(page, limit);
    const where: Record<string, any> = {};

    if (authUser?.userType === 'ecommerce') {
      where.customerid = authUser.id;
      where.source = 'customer';
    }

    if (query.orderid) {
      where.orderid = parseInt(query.orderid, 10);
    }
    if (query.orderlineid) {
      where.orderlineid = parseInt(query.orderlineid, 10);
    }
    if (query.customerid && authUser?.userType !== 'ecommerce') {
      where.customerid = parseInt(query.customerid, 10);
    }
    if (query.requesttype) {
      where.requesttype = query.requesttype;
    }
    if (query.source && authUser?.userType !== 'ecommerce') {
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
        include: RETURN_REQUEST_INCLUDE,
        orderBy: { createddate: 'desc' },
      }),
      requestClient().count({ where }),
    ]);

    return createPaginationResult(await this.attachInspectionsToRequests(requests), total, page, limit);
  }

  async getOperationsSummary(query: ReturnOperationsSummaryQuery, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const where: Record<string, any> = {};
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
    if (query.from || query.to) {
      where.createddate = {};
      if (query.from) {
        where.createddate.gte = BigInt(epochSeconds(query.from));
      }
      if (query.to) {
        where.createddate.lte = BigInt(epochSeconds(query.to));
      }
    }

    const activeWhere: Record<string, any> = { ...where };
    if (!query.status) {
      activeWhere.status = { notIn: Array.from(TERMINAL_REQUEST_STATUSES) };
    } else if (TERMINAL_REQUEST_STATUSES.has(query.status)) {
      activeWhere.status = '__no_active_status__';
    }

    const [total, statusRows, sourceRows, typeRows, reasonRows, activeRequests] = await Promise.all([
      requestClient().count({ where }),
      requestClient().groupBy({ by: ['status'], where, _count: { _all: true } }),
      requestClient().groupBy({ by: ['source'], where, _count: { _all: true } }),
      requestClient().groupBy({ by: ['requesttype'], where, _count: { _all: true } }),
      requestClient().groupBy({ by: ['reasoncode'], where, _count: { _all: true } }),
      requestClient().findMany({
        where: activeWhere,
        select: {
          id: true,
          requestnumber: true,
          requesttype: true,
          source: true,
          reason: true,
          reasoncode: true,
          requestedresolution: true,
          status: true,
          createddate: true,
          modifieddate: true,
        },
        orderBy: { createddate: 'asc' },
      }),
    ]);

    const toCountMap = (rows: any[], key: string) =>
      rows.reduce<Record<string, number>>((counts, row) => {
        const bucket = String(row[key] || 'unknown');
        counts[bucket] = Number(row._count?._all || 0);
        return counts;
      }, {});

    const statusCounts = toCountMap(statusRows, 'status');
    const sourceCounts = toCountMap(sourceRows, 'source');
    const requestTypeCounts = toCountMap(typeRows, 'requesttype');
    const reasonCounts = toCountMap(reasonRows, 'reasoncode');
    const currentSeconds = nowSeconds();

    const queueBuckets = OPERATIONS_QUEUE_BUCKETS.map((bucket) => {
      const bucketStatuses = new Set<string>(bucket.statuses);
      const matchingRequests = activeRequests.filter((request: any) => bucketStatuses.has(request.status));
      const overdueRequests = matchingRequests.filter((request: any) => {
        const lastTouched = epochSeconds(request.modifieddate || request.createddate);
        return ((currentSeconds - lastTouched) / 3600) > bucket.slaHours;
      });
      const oldest = matchingRequests[0];

      return {
        key: bucket.key,
        label: bucket.label,
        statuses: [...bucket.statuses],
        count: matchingRequests.length,
        overdueCount: overdueRequests.length,
        slaHours: bucket.slaHours,
        oldestRequest: oldest
          ? {
            id: oldest.id,
            requestnumber: oldest.requestnumber,
            status: oldest.status,
            requesttype: oldest.requesttype,
            source: oldest.source,
            reasoncode: oldest.reasoncode,
            reason: oldest.reason,
            requestedresolution: oldest.requestedresolution,
            ageHours: Math.round(((currentSeconds - epochSeconds(oldest.createddate)) / 3600) * 10) / 10,
            lastTouchedHours: Math.round(((currentSeconds - epochSeconds(oldest.modifieddate || oldest.createddate)) / 3600) * 10) / 10,
          }
          : null,
      };
    });

    const queueCounts = queueBuckets.reduce<Record<string, number>>((counts, bucket) => {
      counts[bucket.key] = bucket.count;
      return counts;
    }, {});
    const overdueCount = queueBuckets.reduce((sum, bucket) => sum + bucket.overdueCount, 0);

    return {
      generatedAt: currentSeconds,
      filters: {
        from: query.from ? epochSeconds(query.from) : null,
        to: query.to ? epochSeconds(query.to) : null,
        requesttype: query.requesttype || null,
        source: query.source || null,
        status: query.status || null,
        reasoncode: query.reasoncode || null,
      },
      totals: {
        total,
        active: activeRequests.length,
        terminal: Math.max(0, total - activeRequests.length),
        overdue: overdueCount,
      },
      queue: {
        ...queueCounts,
        refundPending: statusCounts.refund_pending || 0,
        shipmentPending:
          (statusCounts.replacement_pending || 0) +
          (statusCounts.missing_item_pending || 0) +
          (statusCounts.replacement_shipped || 0) +
          (statusCounts.missing_item_shipped || 0),
      },
      counts: {
        status: statusCounts,
        source: sourceCounts,
        requesttype: requestTypeCounts,
        reasoncode: reasonCounts,
      },
      slaBuckets: queueBuckets,
    };
  }

  async exportCreditNotesExcel(authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        credit."credit_note_number",
        credit."status",
        credit."createddate",
        credit."issueddate",
        credit."original_invoice_number",
        credit."original_order_number",
        credit."reason_code",
        credit."resolution",
        credit."quantity",
        credit."refund_amount",
        credit."taxable_amount",
        credit."gst_rate",
        credit."cgst_amount",
        credit."sgst_amount",
        credit."igst_amount",
        credit."total_gst_amount",
        credit."hsn_code",
        request."requestnumber" AS "return_reference",
        request."requesttype",
        line."productname",
        adjustment."adjustment_number",
        adjustment."adjustment_type",
        adjustment."source_action",
        adjustment."remaining_amount",
        adjustment."reversed_amount",
        adjustment."gst_reversal_applicable"
      FROM "return_credit_notes" AS credit
      LEFT JOIN "return_requests" AS request
        ON request."id" = credit."return_request_id"
      LEFT JOIN "orderline" AS line
        ON line."id" = request."orderlineid"
      LEFT JOIN "invoice_adjustments" AS adjustment
        ON adjustment."credit_note_id" = credit."id"
        OR adjustment."credit_note_number" = credit."credit_note_number"
      WHERE credit."status" <> 'void'
      ORDER BY credit."createddate" DESC NULLS LAST, credit."id" DESC
    `;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Return Credit Notes');
    worksheet.columns = [
      { header: 'Credit Note Number', key: 'credit_note_number', width: 28 },
      { header: 'Credit Note Status', key: 'status', width: 16 },
      { header: 'Credit Note Date', key: 'created_date', width: 20 },
      { header: 'Issued Date', key: 'issued_date', width: 20 },
      { header: 'Original Invoice Number', key: 'original_invoice_number', width: 28 },
      { header: 'Order Number', key: 'original_order_number', width: 24 },
      { header: 'Return Reference', key: 'return_reference', width: 24 },
      { header: 'Request Type', key: 'requesttype', width: 16 },
      { header: 'Returned Product', key: 'productname', width: 36 },
      { header: 'Returned Quantity', key: 'quantity', width: 18 },
      { header: 'HSN Code', key: 'hsn_code', width: 16 },
      { header: 'Original GST Rate', key: 'gst_rate', width: 18 },
      { header: 'Taxable Value', key: 'taxable_amount', width: 18 },
      { header: 'CGST Amount', key: 'cgst_amount', width: 18 },
      { header: 'SGST Amount', key: 'sgst_amount', width: 18 },
      { header: 'IGST Amount', key: 'igst_amount', width: 18 },
      { header: 'GST Amount', key: 'total_gst_amount', width: 18 },
      { header: 'Total Credit Amount', key: 'refund_amount', width: 22 },
      { header: 'Invoice Adjustment', key: 'adjustment_number', width: 28 },
      { header: 'Adjustment Type', key: 'adjustment_type', width: 22 },
      { header: 'Adjustment Source', key: 'source_action', width: 24 },
      { header: 'Remaining Invoice Amount', key: 'remaining_amount', width: 24 },
      { header: 'Reversed Invoice Amount', key: 'reversed_amount', width: 24 },
      { header: 'GST Reversal Applicable', key: 'gst_reversal_applicable', width: 24 },
    ];

    rows.forEach((row) => {
      worksheet.addRow({
        ...row,
        created_date: formatExcelDate(row.createddate),
        issued_date: row.issueddate ? formatExcelDate(row.issueddate) : '',
        gst_reversal_applicable: row.gst_reversal_applicable ? 'Yes' : 'No',
      });
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    return workbook.xlsx.writeBuffer();
  }

  async findById(id: string) {
    const request = await requestClient().findUnique({
      where: { id: parseInt(id, 10) },
      include: RETURN_REQUEST_INCLUDE,
    });

    if (!request) {
      throw new NotFoundError(`Return request with ID ${id} not found`);
    }

    return this.attachInspectionsToRequest(request);
  }

  async getResolutionPreview(id: string, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const request = await this.findById(id);
    this.validateCustomerReturnRequestForAdminDecisionTarget(request, 'resolution preview');

    const reasonRule = await this.getReasonRuleForRequest(request);
    if (!reasonRule) {
      throw new ValidationError('Reason rule unavailable', 'Cannot preview closure because the reason rule no longer exists');
    }

    return this.buildResolutionPreview(request, reasonRule);
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

    const { mapping, reasonRule } = await this.resolvePolicyReasonRuleForRequest(data, eligibility.policy);
    this.validatePolicyResolution(data, eligibility.policy, reasonRule);
    this.validateReasonRule(data, reasonRule, orderline);

    const hasRejectedRequest = await requestClient().findFirst({
      where: {
        orderlineid: data.orderlineid,
        status: { in: ['rejected', 'evidence_rejected', 'inspection_rejected'] },
      },
    });

    if (hasRejectedRequest) {
      throw new ValidationError(
        'Return/replacement request already rejected',
        'A previous return or replacement request for this item has been rejected by the administrator'
      );
    }

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
      evidenceReviewStatus: hasRequiredEvidenceRules(reasonRule) ? 'pending' : 'not_required',
      pickupflow: 'pickup_first',
      appliedPolicyId: eligibility.policy?.id || null,
      appliedPolicyVersion: this.getPolicyVersion(eligibility.policy),
      policyReasonRuleId: mapping.id,
      policyReasonRuleVersion: mapping.configurationVersion || reasonRule.schemaversion || 1,
      policysnapshot: toJsonSafe(eligibility.policy || null),
      reasonrulesnapshot: toJsonSafe({
        policyReasonRuleId: mapping.id,
        policyId: mapping.policyId,
        reasonId: mapping.reasonId,
        schemaVersion: mapping.schemaVersion || reasonRule.schemaversion || 1,
        configurationVersion: mapping.configurationVersion || 1,
        configuration: reasonRule.configuration || null,
        runtimeRule: reasonRule,
      }),
      reasonruleversion: mapping.configurationVersion || reasonRule.schemaversion || 1,
      autoCreatePickup: false,
      pickupCreatedBy: null,
      logisticsProviderSource: null,
      reverseShippingChargeBearer: 'nivaana',
      reverseShippingChargeAdjustment: 'none',
      status: 'requested',
      createdby: authUser?.userType === 'inventory' ? authUser.id : null,
      modifiedby: authUser?.userType === 'inventory' ? authUser.id : null,
      createddate: timestamp,
      modifieddate: timestamp,
    };

    const createdRequest = await prisma.$transaction(async (tx: any) => {
      const created = await tx.returnRequest.create({ data: requestPayload });
      await this.recordStatusTimeline(tx, {
        returnRequestId: created.id,
        previousStatus: null,
        status: created.status,
        eventType: 'request_created',
        authUser,
        message: RETURN_STATUS_MESSAGES[created.status],
        metadata: {
          requestType: created.requesttype,
          requestedResolution: created.requestedresolution,
          policyReasonRuleId: mapping.id,
        },
        timestamp,
      });

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
        include: RETURN_REQUEST_INCLUDE,
      });
    });

    await this.notifyCustomerReturnStatus(createdRequest, createdRequest.status);

    return createdRequest;
  }

  async createRtoRequest(data: CreateRtoRequestInput, authUser?: AuthUser) {
    const { order, orderline } = await this.resolveRtoOrderContext(data);
    const reason = await this.resolveRtoReason(data.reasoncode || data.reason || '');
    const timestamp = nowSeconds();
    const quantity = data.requestedquantity || orderline?.quantity || order?.quantity || 1;

    const created = await prisma.$transaction(async (tx: any) => {
      const request = await tx.returnRequest.create({
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

      await this.recordStatusTimeline(tx, {
        returnRequestId: request.id,
        previousStatus: null,
        status: request.status,
        eventType: 'rto_created',
        authUser,
        message: RETURN_STATUS_MESSAGES[request.status],
        metadata: {
          trackingId: data.trackingid || null,
          quantity,
        },
        timestamp,
      });

      return request;
    });

    return this.findById(created.id.toString());
  }

  async updateRtoStatus(id: string, data: UpdateRtoStatusInput, authUser?: AuthUser) {
    const request = await this.findById(id);
    this.validateRtoRequest(request);

    const currentStatus = request.status;
    const nextStatus = data.status === 'closed' ? 'rto_closed' : data.status;
    if (currentStatus === nextStatus) {
      return request;
    }

    const allowedNextStatuses = RTO_TRANSITIONS[currentStatus] || [];
    if (!allowedNextStatuses.includes(nextStatus) && !(data.status === 'closed' && allowedNextStatuses.includes('closed'))) {
      throw new ValidationError(
        'Invalid RTO status transition',
        `Cannot move RTO from ${currentStatus} to ${nextStatus}. Allowed next statuses: ${allowedNextStatuses.join(', ') || 'none'}`
      );
    }

    const timestamp = nowSeconds();
    const updated = await requestClient().update({
      where: { id: request.id },
      data: {
        status: nextStatus,
        additionalremarks: data.additionalremarks || request.additionalremarks,
        reverseShipmentTrackingId: data.reverse_shipment_tracking_id || request.reverseShipmentTrackingId,
        reverseShipmentProvider: data.reverse_shipment_provider || request.reverseShipmentProvider,
        modifiedby: authUser?.userType === 'inventory' ? authUser.id : request.modifiedby,
        modifieddate: timestamp,
      },
    });
    await this.recordStatusTimeline(prisma, {
      returnRequestId: request.id,
      previousStatus: currentStatus,
      status: updated.status,
      eventType: 'rto_status_updated',
      authUser,
      message: RETURN_STATUS_MESSAGES[updated.status],
      metadata: {
        remarks: data.additionalremarks || null,
        reverseShipmentTrackingId: data.reverse_shipment_tracking_id || null,
        reverseShipmentProvider: data.reverse_shipment_provider || null,
      },
      timestamp,
    });

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        previousStatus: currentStatus,
        status: updated.status,
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
    await this.recordStatusTimeline(prisma, {
      returnRequestId: request.id,
      previousStatus: request.status,
      status: updated.status,
      eventType: 'rto_received',
      authUser,
      message: RETURN_STATUS_MESSAGES[updated.status],
      metadata: {
        remarks: data.additionalremarks || null,
        reverseShipmentTrackingId: data.reverse_shipment_tracking_id || null,
        reverseShipmentProvider: data.reverse_shipment_provider || null,
      },
      timestamp,
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

  async approveRequest(id: string, data: ApproveReturnRequestInput, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const request = await this.findById(id);
    this.validateCustomerReturnRequestForAdminDecision(request);

    const reasonRule = await this.getReasonRuleForRequest(request);
    if (!reasonRule) {
      throw new ValidationError('Reason rule unavailable', 'Cannot approve request because the reason rule no longer exists');
    }

    await this.validateExistingEvidenceForApproval(request, reasonRule);

    const timestamp = nowSeconds();
    let updated: any;
    const productId = request.orderline?.productid;

    await prisma.$transaction(async (tx: any) => {
      if (request.requesttype === 'replacement') {
        const orderline = request.orderline || {};
        const product = orderline.product || {};
        const puc = firstText(product.puc, orderline.puc, orderline.productpuc);
        if (!puc) {
          throw new ValidationError('Product identifier missing', 'PUC is required to locate stock for replacement');
        }

        const quantity = Math.max(1, Math.trunc(request.requestedquantity || 1));

        const stocks = await tx.$queryRaw<any[]>`
          SELECT "id", "puc", "platform", "stockstatus"
          FROM "stock"
          WHERE "puc" = ${puc}
            AND LOWER("stockstatus") = 'available'
            AND "orderid" IS NULL
            AND "orderlinenumber" IS NULL
            AND COALESCE("isdeleted", false) = false
            AND COALESCE("isarchive", false) = false
          ORDER BY "id" ASC
          LIMIT ${quantity}
          FOR UPDATE
        `;

        if (!Array.isArray(stocks) || stocks.length < quantity) {
          throw new ValidationError(
            'Replacement stock unavailable',
            `Insufficient available stock for replacement. Required: ${quantity}, Available: ${stocks?.length || 0}`
          );
        }

        const replacementAllocationRef = this.getReplacementAllocationReference(request);
        const replacementAllocationLineRef = this.getReplacementAllocationLineReference(request);
        const reservedOrderRef = firstText(request.order?.orderid, orderline.uniqueordderid);
        const reservedOrderlineRef = firstText(orderline.orderlinenumber);
        if (!reservedOrderRef || !reservedOrderlineRef) {
          throw new ValidationError(
            'Order reference missing',
            'Original order and order line references are required to reserve replacement stock'
          );
        }
        const timestampMs = BigInt(Date.now());

        for (const stock of stocks) {
          await tx.$executeRaw`
            UPDATE "stock"
            SET
              "orderid" = ${reservedOrderRef},
              "orderlinenumber" = ${reservedOrderlineRef},
              "platformhistory" = COALESCE("platformhistory"::jsonb, '{}'::jsonb)
                || jsonb_build_object(
                  'replacement_return_request_id', ${String(request.id)},
                  'replacement_allocation_ref', ${replacementAllocationRef},
                  'replacement_allocation_line_ref', ${replacementAllocationLineRef}
                ),
              "modifieddate" = ${timestampMs}
            WHERE "id" = ${stock.id}
          `;
        }

        if (productId) {
          const platform = request.order?.deliveryfrom || product.platform || 'nivapp';
          await tx.$executeRaw`
            UPDATE "product"
            SET
              "orderedquantity" = COALESCE("orderedquantity", 0) + ${quantity},
              "availablequantity" = GREATEST(0, COALESCE("ecompublishedquantity", 0) - (COALESCE("orderedquantity", 0) + ${quantity})),
              "modifieddate" = ${timestampMs}
            WHERE "id" = ${productId}
          `;

          await tx.$executeRaw`
            UPDATE "platformstock"
            SET
              "orderedqty" = COALESCE("orderedqty", 0) + ${quantity},
              "availableqty" = GREATEST(0, COALESCE("ecomqty", 0) - (COALESCE("orderedqty", 0) + ${quantity}) - COALESCE("lockqty", 0)),
              "modifieddate" = ${timestampMs}
            WHERE "productid" = ${productId}
              AND LOWER("platform") = LOWER(${platform})
          `;
        }
      }

      updated = await tx.returnRequest.update({
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

      await this.recordStatusTimeline(tx, {
        returnRequestId: request.id,
        previousStatus: request.status,
        status: updated.status,
        eventType: 'request_approved',
        authUser,
        message: RETURN_STATUS_MESSAGES[updated.status],
        metadata: {
          remarks: data.remarks || null,
          replacementAllocationRef: request.requesttype === 'replacement'
            ? this.getReplacementAllocationReference(request)
            : null,
          replacementAllocationLineRef: request.requesttype === 'replacement'
            ? this.getReplacementAllocationLineReference(request)
            : null,
        },
        timestamp,
      });
    });

    if (request.requesttype === 'replacement' && productId) {
      try {
        await this.productStockService.updateStockTotals(String(productId));
      } catch (err) {
        logger.warn({ err, productId }, 'Deferred stock refresh failed during replacement approval');
      }
    }

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        reviewedBy: authUser!.id,
      },
      'Return request approved by admin'
    );

    await this.notifyCustomerReturnStatus(request, updated.status);

    return this.findById(updated.id.toString());
  }

  async rejectRequest(id: string, data: RejectReturnRequestInput, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const request = await this.findById(id);
    this.validateCustomerReturnRequestForAdminDecision(request);

    const timestamp = nowSeconds();
    let updated: any;
    const productId = request.orderline?.productid;

    await prisma.$transaction(async (tx: any) => {
      if (request.requesttype === 'replacement') {
        const replacementAllocationRef = this.getReplacementAllocationReference(request);
        const legacyReplacementOrderRef = this.getLegacyReplacementOrderReference(request);
        const reservedStocks = await tx.$queryRaw<any[]>`
          SELECT "id"
          FROM "stock"
          WHERE (
              ("platformhistory"::jsonb ->> 'replacement_return_request_id') = ${String(request.id)}
              OR "orderid" = ${replacementAllocationRef}
              OR "orderid" = ${legacyReplacementOrderRef}
            )
            AND COALESCE("isdeleted", false) = false
            AND COALESCE("isarchive", false) = false
          FOR UPDATE
        `;

        if (Array.isArray(reservedStocks) && reservedStocks.length > 0) {
          const quantity = reservedStocks.length;
          const timestampMs = BigInt(Date.now());

          await tx.$executeRaw`
            UPDATE "stock"
            SET
              "orderid" = NULL,
              "orderlinenumber" = NULL,
              "platformhistory" = COALESCE("platformhistory"::jsonb, '{}'::jsonb)
                - 'replacement_return_request_id'
                - 'replacement_allocation_ref'
                - 'replacement_allocation_line_ref',
              "modifieddate" = ${timestampMs}
            WHERE ("platformhistory"::jsonb ->> 'replacement_return_request_id') = ${String(request.id)}
               OR "orderid" = ${replacementAllocationRef}
               OR "orderid" = ${legacyReplacementOrderRef}
          `;

          if (productId) {
            const platform = request.order?.deliveryfrom || request.orderline?.product?.platform || 'nivapp';
            await tx.$executeRaw`
              UPDATE "product"
              SET
                "orderedquantity" = GREATEST(0, COALESCE("orderedquantity", 0) - ${quantity}),
                "availablequantity" = GREATEST(0, COALESCE("ecompublishedquantity", 0) - GREATEST(0, COALESCE("orderedquantity", 0) - ${quantity})),
                "modifieddate" = ${timestampMs}
              WHERE "id" = ${productId}
            `;

            await tx.$executeRaw`
              UPDATE "platformstock"
              SET
                "orderedqty" = GREATEST(0, COALESCE("orderedqty", 0) - ${quantity}),
                "availableqty" = GREATEST(0, COALESCE("ecomqty", 0) - GREATEST(0, COALESCE("orderedqty", 0) - ${quantity}) - COALESCE("lockqty", 0)),
                "modifieddate" = ${timestampMs}
              WHERE "productid" = ${productId}
                AND LOWER("platform") = LOWER(${platform})
            `;
          }
        }
      }

      updated = await tx.returnRequest.update({
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

      await this.recordStatusTimeline(tx, {
        returnRequestId: request.id,
        previousStatus: request.status,
        status: updated.status,
        eventType: 'request_rejected',
        authUser,
        message: RETURN_STATUS_MESSAGES[updated.status],
        metadata: {
          rejectionReason: data.rejectionreason,
          remarks: data.remarks || null,
        },
        timestamp,
      });
    });

    if (request.requesttype === 'replacement' && productId) {
      try {
        await this.productStockService.updateStockTotals(String(productId));
      } catch (err) {
        logger.warn({ err, productId }, 'Deferred stock refresh failed during replacement rejection');
      }
    }

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        reviewedBy: authUser!.id,
      },
      'Return request rejected by admin'
    );

    await this.notifyCustomerReturnStatus(request, updated.status);

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
    let reverseShipmentTrackingId = data.reverse_shipment_tracking_id || request.reverseShipmentTrackingId || null;
    let reverseShipmentProvider = data.reverse_shipment_provider || request.reverseShipmentProvider || null;
    let ekartResponse: CreateShipmentResponse | null = null;

    if (data.create_reverse_shipment && !reverseShipmentTrackingId) {
      try {
        const payload = await this.buildEkartReverseShipmentPayload(request, reasonRule, data);
        ekartResponse = await ekartService.createReverseShipment(payload);
        reverseShipmentTrackingId = ekartResponse.tracking_id || ekartResponse.barcodes?.wbn || null;
        reverseShipmentProvider = ekartResponse.vendor || 'EKART';
      } catch (error: any) {
        logger.error(
          {
            returnRequestId: request.id,
            requestNumber: request.requestnumber,
            error: error?.message,
            stack: error?.stack,
          },
          'Failed to create Ekart reverse shipment for return request'
        );
        throw new ValidationError(
          'Reverse shipment creation failed',
          error?.message || 'Ekart did not create a reverse shipment'
        );
      }

      if (!reverseShipmentTrackingId) {
        throw new ValidationError(
          'Reverse shipment creation failed',
          'Ekart response did not include a reverse shipment tracking id'
        );
      }
    }

    if (data.create_reverse_shipment && reverseShipmentTrackingId && !reverseShipmentProvider) {
      reverseShipmentProvider = 'EKART';
    }

    const hasTracking = Boolean(reverseShipmentTrackingId);
    const updated = await requestClient().update({
      where: { id: request.id },
      data: {
        autoCreatePickup: false,
        pickupCreatedBy: 'admin',
        pickupPreparedBy: authUser!.id,
        pickupPreparedDate: timestamp,
        pickupRemarks: data.remarks || null,
        logisticsProviderSource: data.create_reverse_shipment ? 'configured_provider' : data.logistics_provider_source,
        reverseShippingChargeBearer: 'nivaana',
        reverseShippingChargeAdjustment: 'none',
        reverseShipmentTrackingId,
        reverseShipmentProvider,
        status: hasTracking ? 'pickup_created' : 'pickup_prepared',
        modifiedby: authUser!.id,
        modifieddate: timestamp,
      },
    });
    await this.recordStatusTimeline(prisma, {
      returnRequestId: request.id,
      previousStatus: request.status,
      status: updated.status,
      eventType: hasTracking ? 'reverse_pickup_created' : 'pickup_prepared',
      authUser,
      message: RETURN_STATUS_MESSAGES[updated.status],
      metadata: {
        logisticsProviderSource: data.create_reverse_shipment ? 'configured_provider' : data.logistics_provider_source,
        reverseShipmentTrackingId,
        reverseShipmentProvider,
        createdEkartShipment: Boolean(ekartResponse),
        remarks: data.remarks || null,
      },
      timestamp,
    });

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        preparedBy: authUser!.id,
        hasTracking,
        createdEkartShipment: Boolean(ekartResponse),
        reverseShipmentTrackingId,
        reverseShipmentProvider,
      },
      'Return pickup preparation saved'
    );

    await this.notifyCustomerReturnStatus(request, updated.status, {
      trackingId: reverseShipmentTrackingId,
    });

    return this.findById(updated.id.toString());
  }

  private async buildEkartReverseShipmentPayload(
    request: any,
    reasonRule: any,
    data: PreparePickupInput
  ): Promise<CreateShipmentPayload> {
    const customer = request.customer || {};
    const orderline = request.orderline || {};
    const order = request.order || orderline.orders || {};
    const product = orderline.product || {};
    const address = orderline.address || order.address || orderline.orders?.address || {};

    const customerName = firstText(
      address.name,
      [customer.firstname, customer.lastname].filter(Boolean).join(' '),
      customer.useremail,
      'Nivaana Customer'
    );
    const customerAddress = buildAddressLine(address);
    const customerCity = firstText(address.city);
    const customerState = firstText(address.state);
    const customerPin = integerFromUnknown(address.pincode);
    const customerPhone = phoneFromUnknown(address.mobilenumber) || phoneFromUnknown(customer.usermobilenumber);

    const missingCustomerFields = [
      !customerAddress ? 'customer address' : '',
      !customerCity ? 'customer city' : '',
      !customerState ? 'customer state' : '',
      !customerPin ? 'customer pincode' : '',
      !customerPhone ? 'customer phone' : '',
    ].filter(Boolean);

    if (missingCustomerFields.length > 0) {
      throw new ValidationError(
        'Customer pickup address is incomplete',
        `Missing ${missingCustomerFields.join(', ')} for Ekart reverse shipment`
      );
    }

    const ekartSellerInfo = data.seller_name && data.seller_address
      ? null
      : await ekartService.getDefaultSellerAddress(data.seller_location_alias);
    const sellerName = firstText(data.seller_name, ekartSellerInfo?.seller_name);
    const sellerAddress = firstText(data.seller_address, ekartSellerInfo?.seller_address);

    if (!sellerName || !sellerAddress) {
      throw new ValidationError(
        'Seller return location is incomplete',
        'Provide seller_name and seller_address, or configure/fetch an Ekart seller address'
      );
    }

    const amount = positiveNumber(orderline.orderamount, positiveNumber(order.orderamount, 1));
    const taxValue = Math.max(0, numberFromUnknown(orderline.total_gst_amount) || numberFromUnknown(order.tax_amount) || 0);
    const taxableAmount = positiveNumber(orderline.taxable_amount, Math.max(amount - taxValue, 1));
    const length = positiveNumber(data.length, 10);
    const width = positiveNumber(data.width, 10);
    const height = positiveNumber(data.height, 10);
    const weight = positiveNumber(data.weight, 0.5);
    const quantity = Math.max(1, Math.trunc(request.requestedquantity || orderline.quantity || order.quantity || 1));
    const productName = firstText(
      data.item_description,
      orderline.productname,
      product.productname,
      product.name,
      'Nivaana Product'
    );

    const payload: CreateShipmentPayload = {
      seller_name: sellerName,
      seller_address: sellerAddress,
      seller_gst_tin: firstText(data.seller_gst_tin),
      order_number: request.requestnumber,
      invoice_number: firstText(data.invoice_number, order.orderid, orderline.orderlinenumber, request.requestnumber),
      invoice_date: data.invoice_date || formatInvoiceDate(order.createddate || orderline.ordereddate || request.createddate),
      consignee_name: customerName,
      products_desc: productName,
      payment_mode: 'Pickup',
      total_amount: amount,
      tax_value: taxValue,
      taxable_amount: taxableAmount,
      commodity_value: amount.toFixed(2),
      quantity,
      weight,
      length,
      width,
      height,
      drop_location: {
        location_type: 'Home',
        name: customerName,
        address: customerAddress,
        city: customerCity,
        state: customerState,
        country: 'India',
        pin: customerPin!,
        phone: customerPhone!,
      },
      return_reason: firstText(data.return_reason, request.reason, reasonRule.reasonname, request.reasoncode),
      pickup_location: {
        name: firstText(data.pickup_location_name, customerName),
      },
      return_location: {
        name: firstText(data.return_location_name, sellerName),
      },
      hsn_code: firstText(orderline.hsn_code, product.hsn_code),
      category_of_goods: firstText(orderline.productcategory, product.category, product.categoryname),
      items: [{
        product_name: productName,
        sku: firstText(orderline.orderlinenumber, orderline.productid, product.sku, product.id, request.requestnumber),
        taxable_value: taxableAmount,
        description: productName,
        quantity,
        length,
        height,
        breadth: width,
        weight,
        hsn_code: firstText(orderline.hsn_code, product.hsn_code),
        cgst_tax_value: Math.max(0, numberFromUnknown(orderline.cgst_amount) || 0),
        sgst_tax_value: Math.max(0, numberFromUnknown(orderline.sgst_amount) || 0),
        igst_tax_value: Math.max(0, numberFromUnknown(orderline.igst_amount) || 0),
      }],
    };

    if (data.qc_shipment) {
      payload.qc_details = {
        qc_shipment: true,
        product_name: productName,
        product_desc: firstText(product.description, orderline.productcategory),
        product_sku: firstText(orderline.orderlinenumber, orderline.productid, product.sku),
        product_color: firstText(orderline.productcolour, product.colour, product.color),
        product_category: firstText(orderline.productcategory, product.category, product.categoryname),
      };
    }

    return payload;
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
    await this.recordStatusTimeline(prisma, {
      returnRequestId: request.id,
      previousStatus: request.status,
      status: updated.status,
      eventType: request.requesttype === 'rto' ? 'rto_received_at_warehouse' : 'received_at_warehouse',
      authUser,
      message: RETURN_STATUS_MESSAGES[updated.status],
      metadata: {
        receivedQuantity,
        receivedCondition: data.receivedcondition,
        receivedLocation: data.receivedlocation || null,
        remarks: data.remarks || null,
      },
      timestamp,
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

    await this.notifyCustomerReturnStatus(request, updated.status);

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
    const inspectionRestockAction =
      rejectedQuantity > 0 && approvedQuantity === 0 && data.restockaction === 'none'
        ? 'on_hold'
        : data.restockaction;
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

    if (approvedQuantity > 0 && ['available', 'damaged', 'quarantine'].includes(inspectionRestockAction)) {
      approvedQuantitiesByRestockAction[inspectionRestockAction as 'available' | 'damaged' | 'quarantine'] += approvedQuantity;
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
    const shouldMoveRejectedStockToOnHold = isFullyInspected && cumulativeRejectedQuantity > 0;
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
          ${['available', 'damaged', 'quarantine', 'none'].includes(inspectionRestockAction) ? inspectionRestockAction : 'none'},
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

      if (shouldMoveRejectedStockToOnHold) {
        const onHoldMovements = await this.moveRejectedInspectionStockToOnHold(
          tx,
          request,
          cumulativeRejectedQuantity,
          BigInt(nowMillis())
        );
        stockMovements.push(...onHoldMovements);
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

      await this.recordStatusTimeline(tx, {
        returnRequestId: request.id,
        previousStatus: request.status,
        status,
        eventType: isRto ? 'rto_warehouse_verified' : 'warehouse_inspected',
        authUser,
        message: RETURN_STATUS_MESSAGES[status],
        metadata: {
          receivedQuantity,
          approvedQuantity,
          rejectedQuantity,
          condition: data.condition,
          restockAction: inspectionRestockAction,
          isFullyInspected,
          stockMovements,
          inspectionNotes: data.inspectionnotes || null,
        },
        timestamp,
      });
    });

    await this.refreshMovedStockTotals(stockMovements);

    if (shouldMoveRejectedStockToOnHold && !isRto && request.customerid) {
      await this.notifyWarehouseInspectionRejected(request, data.inspectionnotes || data.condition);
    } else {
      await this.notifyCustomerReturnStatus(request, status);
    }

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
        restockAction: inspectionRestockAction,
        status,
        stockUpdated: stockMovements.length > 0,
      },
      'Return inspection saved'
    );

    return this.findById(request.id.toString());
  }

  async completeResolution(id: string, data: CompleteReturnResolutionInput, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const request = await this.findById(id);
    this.validateCustomerReturnRequestForAdminDecisionTarget(request, 'resolution closure');

    if (request.requestReviewStatus !== 'approved') {
      throw new ValidationError(
        'Return request is not approved for closure',
        'Admin request approval is required before refund or fulfilment closure'
      );
    }

    const reasonRule = await this.getReasonRuleForRequest(request);
    const actionType = this.resolveClosureActionType(request, reasonRule, data);
    const existingCompletedAction = (request.resolutionActions || []).find((action: any) =>
      action.actionType === actionType && action.status === 'completed'
    );

    if (existingCompletedAction) {
      throw new ValidationError(
        'Resolution already completed',
        `${actionType.replace(/_/g, ' ')} was already completed for this request`
      );
    }

    this.validateClosureReadiness(request, actionType);
    const resolutionPreview = await this.buildResolutionPreview(request, reasonRule);
    this.validateClosureStockDecision(request, actionType, data, resolutionPreview);

    const refundAmount = ['refund', 'partial_refund'].includes(actionType)
      ? this.calculateClosureRefundAmount(request, data)
      : null;
    const actionAmount = OUTBOUND_SHIPMENT_ACTIONS.has(actionType)
      ? this.calculateFulfilmentShipmentAmount(request)
      : refundAmount;
    let externalReference = data.external_reference || null;
    let actionStatus = data.status;
    let metadata: Record<string, unknown> = {
      ...(data.metadata || {}),
      requestedResolution: request.requestedresolution,
      reverseShippingChargeBearer: 'nivaana',
      reverseShippingChargeDeducted: false,
      resolutionPreview,
    };
    const sourceAwareRefund = REFUND_ACTIONS.has(actionType)
      && ['original_payment', 'wallet'].includes(String(data.refund_method || ''));
    const refundDestination = data.refund_method === 'wallet' ? 'wallet' : 'original_sources';
    if (sourceAwareRefund) {
      if (data.refund_destination && data.refund_destination !== refundDestination) {
        throw new ValidationError('Refund destination does not match refund method');
      }
      actionStatus = 'pending';
      const sourceAwareAllocation = await this.refundOperationService.previewReturnRefund(
        Number(request.orderid),
        Number(request.id),
        Number(refundAmount || 0),
      );
      if (Number(sourceAwareAllocation.approved_amount) !== Number(refundAmount || 0)) {
        throw new ValidationError(
          'Refund exceeds remaining payment sources',
          `Only ${sourceAwareAllocation.approved_amount} remains refundable for this order`,
        );
      }
      if (
        refundDestination === 'wallet'
        && sourceAwareAllocation.wallet.consent_required
        && (!data.consent_accepted || !data.consent_channel)
      ) {
        throw new ValidationError(
          'Customer consent required',
          'Record customer consent and the consent channel before converting online payment into wallet credit',
        );
      }
      metadata = {
        ...metadata,
        sourceAwareRefund: true,
        refundDestination,
        refundAllocation: sourceAwareAllocation,
      };
    }

    const nextRequestStatus = this.getClosureRequestStatus(actionType, actionStatus);
    const timestamp = nowSeconds();
    let createdResolutionAction: any = null;
    let createdCreditNote: any = null;

    await prisma.$transaction(async (tx: any) => {
      if (request.requesttype === 'replacement') {
        const replacementAllocationRef = this.getReplacementAllocationReference(request);
        const replacementAllocationLineRef = this.getReplacementAllocationLineReference(request);
        const legacyReplacementOrderRef = this.getLegacyReplacementOrderReference(request);
        const quantity = Math.max(1, Math.trunc(request.requestedquantity || 1));
        const productId = request.orderline?.productid;
        const platform = request.order?.deliveryfrom || request.orderline?.product?.platform || 'nivapp';
        const timestampMs = BigInt(Date.now());

        if (actionType === 'replacement_shipment') {
          const replacementStocks = await tx.$queryRaw<any[]>`
            SELECT "id", "ecompublish"
            FROM "stock"
            WHERE (
                ("platformhistory"::jsonb ->> 'replacement_return_request_id') = ${String(request.id)}
                OR "orderid" = ${replacementAllocationRef}
                OR "orderid" = ${legacyReplacementOrderRef}
              )
              AND COALESCE("isdeleted", false) = false
              AND COALESCE("isarchive", false) = false
            FOR UPDATE
          `;

          if (!Array.isArray(replacementStocks) || replacementStocks.length < quantity) {
            throw new ValidationError(
              'Replacement stock unavailable',
              `Reserved replacement stock is not available. Required: ${quantity}, Reserved: ${replacementStocks?.length || 0}`
            );
          }

          const replacementEcomQuantity = replacementStocks.filter((stock) => Boolean(stock.ecompublish)).length;

          await tx.$executeRaw`
            UPDATE "stock"
            SET
                "stockstatus" = 'sold',
                "solddate" = ${timestampMs},
                "platformhistory" = COALESCE("platformhistory"::jsonb, '{}'::jsonb)
                  - 'replacement_return_request_id'
                  - 'replacement_allocation_ref'
                  - 'replacement_allocation_line_ref',
                "modifieddate" = ${timestampMs}
            WHERE ("platformhistory"::jsonb ->> 'replacement_return_request_id') = ${String(request.id)}
               OR "orderid" = ${replacementAllocationRef}
               OR "orderid" = ${legacyReplacementOrderRef}
          `;

          if (productId) {
            await tx.$executeRaw`
              UPDATE "product"
              SET
                "quantity" = GREATEST(0, COALESCE("quantity", 0) - ${quantity}),
                "orderedquantity" = GREATEST(0, COALESCE("orderedquantity", 0) - ${quantity}),
                "soldquantity" = COALESCE("soldquantity", 0) + ${quantity},
                "ecompublishedquantity" = GREATEST(0, COALESCE("ecompublishedquantity", 0) - ${replacementEcomQuantity}),
                "availablequantity" = GREATEST(
                  0,
                  GREATEST(0, COALESCE("ecompublishedquantity", 0) - ${replacementEcomQuantity})
                  - GREATEST(0, COALESCE("orderedquantity", 0) - ${quantity})
                ),
                "modifieddate" = ${timestampMs}
              WHERE "id" = ${productId}
            `;

            await tx.$executeRaw`
              UPDATE "platformstock"
              SET
                "orderedqty" = GREATEST(0, COALESCE("orderedqty", 0) - ${quantity}),
                "soldqty" = COALESCE("soldqty", 0) + ${quantity},
                "ecomqty" = GREATEST(0, COALESCE("ecomqty", 0) - ${replacementEcomQuantity}),
                "availableqty" = GREATEST(
                  0,
                  GREATEST(0, COALESCE("ecomqty", 0) - ${replacementEcomQuantity})
                  - GREATEST(0, COALESCE("orderedqty", 0) - ${quantity})
                  - COALESCE("lockqty", 0)
                ),
                "modifieddate" = ${timestampMs}
              WHERE "productid" = ${productId}
                AND LOWER("platform") = LOWER(${platform})
            `;
          }

          metadata = {
            ...metadata,
            replacementFulfillment: {
              allocationRef: replacementAllocationRef,
              allocationLineRef: replacementAllocationLineRef,
              originalOrderId: request.orderid,
              originalOrderNumber: request.order?.orderid || request.orderline?.uniqueordderid || null,
              quantity,
              amount: actionAmount,
              shipmentTrackingId: data.shipment_tracking_id || null,
              shipmentProvider: data.shipment_provider || null,
              latestShipmentStatus: 'shipped',
            },
          };
        } else if (actionType === 'refund') {
          const reservedStocks = await tx.$queryRaw<any[]>`
            SELECT "id"
            FROM "stock"
            WHERE (
                ("platformhistory"::jsonb ->> 'replacement_return_request_id') = ${String(request.id)}
                OR "orderid" = ${replacementAllocationRef}
                OR "orderid" = ${legacyReplacementOrderRef}
              )
              AND COALESCE("isdeleted", false) = false
              AND COALESCE("isarchive", false) = false
            FOR UPDATE
          `;
          const reservedQuantity = Array.isArray(reservedStocks) && reservedStocks.length > 0
            ? reservedStocks.length
            : quantity;

          await tx.$executeRaw`
            UPDATE "stock"
            SET
              "orderid" = NULL,
              "orderlinenumber" = NULL,
              "platformhistory" = COALESCE("platformhistory"::jsonb, '{}'::jsonb)
                - 'replacement_return_request_id'
                - 'replacement_allocation_ref'
                - 'replacement_allocation_line_ref',
              "modifieddate" = ${timestampMs}
            WHERE ("platformhistory"::jsonb ->> 'replacement_return_request_id') = ${String(request.id)}
               OR "orderid" = ${replacementAllocationRef}
               OR "orderid" = ${legacyReplacementOrderRef}
          `;

          if (productId) {
            await tx.$executeRaw`
              UPDATE "product"
              SET
                "orderedquantity" = GREATEST(0, COALESCE("orderedquantity", 0) - ${reservedQuantity}),
                "availablequantity" = GREATEST(0, COALESCE("ecompublishedquantity", 0) - GREATEST(0, COALESCE("orderedquantity", 0) - ${reservedQuantity})),
                "modifieddate" = ${timestampMs}
              WHERE "id" = ${productId}
            `;

            await tx.$executeRaw`
              UPDATE "platformstock"
              SET
                "orderedqty" = GREATEST(0, COALESCE("orderedqty", 0) - ${reservedQuantity}),
                "availableqty" = GREATEST(0, COALESCE("ecomqty", 0) - GREATEST(0, COALESCE("orderedqty", 0) - ${reservedQuantity}) - COALESCE("lockqty", 0)),
                "modifieddate" = ${timestampMs}
              WHERE "productid" = ${productId}
                AND LOWER("platform") = LOWER(${platform})
            `;
          }

          metadata = {
            ...metadata,
            replacementFulfillment: {
              allocationRef: replacementAllocationRef,
              allocationLineRef: replacementAllocationLineRef,
              originalOrderId: request.orderid,
              originalOrderNumber: request.order?.orderid || request.orderline?.uniqueordderid || null,
              released: true,
              releaseReason: 'refund_fallback',
              quantity: reservedQuantity,
            },
          };
        }
      }

      const insertedActions = await tx.$queryRaw<any[]>`
        INSERT INTO "return_resolution_actions" (
          "return_request_id",
          "action_type",
          "status",
          "amount",
          "refund_method",
          "external_reference",
          "shipment_tracking_id",
          "shipment_provider",
          "quantity",
          "stock_fallback_applied",
          "no_reverse_charge_deduction",
          "metadata",
          "notes",
          "created_by",
          "completed_by",
          "createddate",
          "modifieddate",
          "completeddate"
        ) VALUES (
          ${request.id},
          ${actionType},
          ${actionStatus},
          ${actionAmount},
          ${data.refund_method || null},
          ${externalReference},
          ${data.shipment_tracking_id || null},
          ${data.shipment_provider || null},
          ${data.quantity || request.requestedquantity || 1},
          ${data.stock_fallback_applied},
          ${true},
          ${JSON.stringify(toJsonSafe(metadata))}::jsonb,
          ${data.notes || null},
          ${authUser!.id},
          ${actionStatus === 'completed' ? authUser!.id : null},
          ${timestamp},
          ${timestamp},
          ${actionStatus === 'completed' ? timestamp : null}
        )
        RETURNING *
      `;
      createdResolutionAction = insertedActions?.[0] || null;

      if (createdResolutionAction && actionStatus === 'completed' && REFUND_ACTIONS.has(actionType)) {
        createdCreditNote = await this.createCreditNoteRecord(tx, request, {
          id: createdResolutionAction.id,
          actionType,
          amount: refundAmount,
          status: actionStatus,
          quantity: data.quantity || request.requestedquantity || 1,
          refundMethod: data.refund_method || null,
          externalReference,
          noReverseChargeDeduction: true,
        }, {
          status: 'issued',
          metadata: {
            autoCreated: true,
            source: 'resolution_closure',
          },
          notes: 'Auto-created from completed return refund resolution.',
        }, authUser, {
          autoSkipWithoutGst: true,
          suppressTimeline: false,
        });

        await invoiceAdjustmentService.recordReturnResolution(request, {
          id: createdResolutionAction.id,
          actionType,
          amount: refundAmount,
          quantity: data.quantity || request.requestedquantity || 1,
        }, {
          creditNote: createdCreditNote,
          gstReversalApplicable: Boolean(createdCreditNote),
          actorId: authUser!.id,
          database: tx,
        });
      }

      await (tx as any).returnRequest.update({
        where: { id: request.id },
        data: {
          status: nextRequestStatus,
          modifiedby: authUser!.id,
          modifieddate: timestamp,
        },
      });

      await this.recordStatusTimeline(tx, {
        returnRequestId: request.id,
        previousStatus: request.status,
        status: nextRequestStatus,
        eventType: 'resolution_closed',
        authUser,
        message: RETURN_STATUS_MESSAGES[nextRequestStatus],
        metadata: {
          actionType,
          actionStatus,
          refundAmount,
          actionAmount,
          refundMethod: data.refund_method || null,
          externalReference,
          shipmentTrackingId: data.shipment_tracking_id || null,
          shipmentProvider: data.shipment_provider || null,
          stockFallbackApplied: data.stock_fallback_applied,
          noReverseChargeDeduction: true,
        },
        timestamp,
      });
    });

    if (sourceAwareRefund && createdResolutionAction && refundAmount) {
      const operation = await this.refundOperationService.initiateReturnRefund(Number(request.orderid), {
        destination: refundDestination,
        approved_amount: refundAmount,
        return_request_id: Number(request.id),
        resolution_action_id: Number(createdResolutionAction.id),
        return_request_number: request.requestnumber,
        consent_accepted: data.consent_accepted,
        consent_channel: data.consent_channel,
        consent_reference: data.consent_reference,
        consent_notes: data.consent_notes || data.notes,
        admin_user_id: authUser!.id,
      });
      const refundReference = operation.destination === 'original_sources'
        ? null
        : operation.operationNumber;
      await prisma.$executeRaw`
        UPDATE "return_resolution_actions"
        SET
          "external_reference" = ${refundReference},
          "metadata" = COALESCE("metadata"::jsonb, '{}'::jsonb)
            || ${JSON.stringify(toJsonSafe({
              refundOperationId: operation.id,
              refundOperationNumber: operation.operationNumber,
              refundDestination: operation.destination,
            }))}::jsonb,
          "modifieddate" = ${nowSeconds()}
        WHERE "id" = ${createdResolutionAction.id}
          AND "return_request_id" = ${request.id}
      `;
      const refundStatus = operation.status === 'completed'
        ? 'completed'
        : operation.status === 'failed'
          ? 'failed'
          : 'pending';
      const updatedRefundRequest = await this.updateRefundStatus(request.id.toString(), {
        resolution_action_id: Number(createdResolutionAction.id),
        external_reference: refundReference,
        status: refundStatus,
        remarks: operation.failureReason || `Source-aware refund ${String(operation.status).replace(/_/g, ' ')}`,
        metadata: {
          refundOperationId: operation.id,
          refundOperationNumber: operation.operationNumber,
          walletCreditedAmount: Number(operation.walletCreditedAmount || 0),
          phonepeRefundAmount: Number(operation.phonepeRefundAmount || 0),
          expiredWalletAmount: Number(operation.expiredWalletAmount || 0),
        },
      }, authUser);
      if (request.orderline?.productid) {
        try {
          await this.productStockService.updateStockTotals(String(request.orderline.productid));
        } catch (err) {
          logger.warn({ err, productId: request.orderline.productid }, 'Deferred stock refresh failed after return refund initiation');
        }
      }
      return updatedRefundRequest;
    }

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        actionType,
        actionStatus,
        refundAmount,
        actionAmount,
        externalReference,
        nextRequestStatus,
        actorId: authUser!.id,
      },
      'Return resolution action saved'
    );

    await this.notifyCustomerReturnStatus(request, nextRequestStatus, {
      trackingId: data.shipment_tracking_id || null,
      amount: refundAmount,
    });

    if (request.requesttype !== 'rto' && request.orderline?.productid) {
      try {
        await this.productStockService.updateStockTotals(String(request.orderline.productid));
      } catch (err) {
        logger.warn({ err, productId: request.orderline.productid }, 'Deferred stock refresh failed during resolution closure');
      }
    }

    return this.findById(request.id.toString());
  }

  async updateShipmentStatus(id: string, data: UpdateReturnShipmentStatusInput, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const request = await this.findById(id);
    this.validateCustomerReturnRequestForShipmentStatusUpdate(request);

    const shipmentActions = (request.resolutionActions || []).filter((action: any) =>
      OUTBOUND_SHIPMENT_ACTIONS.has(action.actionType)
    );
    const action = data.resolution_action_id
      ? shipmentActions.find((entry: any) => Number(entry.id) === Number(data.resolution_action_id))
      : shipmentActions.find((entry: any) => entry.shipmentTrackingId && entry.shipmentTrackingId === data.shipment_tracking_id);

    if (!action) {
      throw new ValidationError(
        'Fulfilment shipment action not found',
        'Close the request with a replacement or missing-item shipment before updating delivery status'
      );
    }

    if (action.status !== 'completed') {
      throw new ValidationError(
        'Fulfilment shipment is not shipped',
        'Only completed shipment actions can receive carrier delivery updates'
      );
    }

    const currentStatus = request.status;
    let nextRequestStatus = currentStatus;
    if (data.status === 'delivered') {
      if (action.actionType === 'replacement_shipment') {
        if (!['replacement_shipped', 'replacement_delivered'].includes(currentStatus)) {
          throw new ValidationError(
            'Replacement shipment is not in shipped state',
            'Replacement delivery can only be confirmed after the request reaches replacement_shipped'
          );
        }
        nextRequestStatus = 'replacement_delivered';
      } else {
        if (!['missing_item_shipped', 'completed'].includes(currentStatus)) {
          throw new ValidationError(
            'Missing item shipment is not in shipped state',
            'Missing-item delivery can only be confirmed after the request reaches missing_item_shipped'
          );
        }
        nextRequestStatus = 'completed';
      }
    }

    const timestamp = epochSeconds(data.event_time);
    const metadata = (action.metadata && typeof action.metadata === 'object' && !Array.isArray(action.metadata))
      ? { ...(action.metadata as Record<string, unknown>) }
      : {};
    const shipmentStatusHistory = Array.isArray((metadata as any).shipmentStatusHistory)
      ? [...((metadata as any).shipmentStatusHistory as unknown[])]
      : [];
    const trackingId = data.shipment_tracking_id || action.shipmentTrackingId || null;
    const provider = data.shipment_provider || action.shipmentProvider || null;
    const shipmentAmount = this.calculateFulfilmentShipmentAmount(request);
    const shipmentEvent = {
      status: data.status,
      trackingId,
      provider,
      remarks: data.remarks || null,
      eventTime: timestamp,
      recordedBy: authUser!.id,
      metadata: data.metadata || {},
    };

    const nextMetadata = {
      ...metadata,
      latestShipmentStatus: data.status,
      latestShipmentStatusAt: timestamp,
      latestShipmentRemarks: data.remarks || null,
      shipmentStatusHistory: [...shipmentStatusHistory, shipmentEvent],
    };
    const eventType = data.status === 'delivered'
      ? 'fulfillment_shipment_delivered'
      : data.status === 'failed' || data.status === 'returned'
        ? 'fulfillment_shipment_exception'
        : 'fulfillment_shipment_progress';

    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`
        UPDATE "return_resolution_actions"
        SET
          "shipment_tracking_id" = COALESCE(${trackingId}, "shipment_tracking_id"),
          "shipment_provider" = COALESCE(${provider}, "shipment_provider"),
          "amount" = COALESCE("amount", ${shipmentAmount}),
          "metadata" = ${JSON.stringify(toJsonSafe(nextMetadata))}::jsonb,
          "modifieddate" = ${timestamp}
        WHERE "id" = ${action.id}
          AND "return_request_id" = ${request.id}
      `;

      await this.syncReplacementFulfilmentOrderStatus(tx, request, action, {
        status: data.status,
        trackingId,
        provider,
        remarks: data.remarks || null,
        eventTimeSeconds: timestamp,
        recordedBy: authUser!.id,
      });

      if (nextRequestStatus !== currentStatus) {
        await (tx as any).returnRequest.update({
          where: { id: request.id },
          data: {
            status: nextRequestStatus,
            modifiedby: authUser!.id,
            modifieddate: timestamp,
          },
        });
      }

      await this.recordStatusTimeline(tx, {
        returnRequestId: request.id,
        previousStatus: currentStatus,
        status: nextRequestStatus,
        eventType,
        authUser,
        message: data.status === 'delivered'
          ? RETURN_STATUS_MESSAGES[nextRequestStatus]
          : `Fulfilment shipment ${data.status.replace(/_/g, ' ')}`,
        metadata: {
          resolutionActionId: action.id,
          actionType: action.actionType,
          shipmentStatus: data.status,
          shipmentTrackingId: trackingId,
          shipmentProvider: provider,
          remarks: data.remarks || null,
          requestStatusChanged: nextRequestStatus !== currentStatus,
          ...(data.metadata || {}),
        },
        timestamp,
      });
    });

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        resolutionActionId: action.id,
        actionType: action.actionType,
        shipmentStatus: data.status,
        trackingId,
        provider,
        previousStatus: currentStatus,
        nextRequestStatus,
        actorId: authUser!.id,
      },
      'Return fulfilment shipment status saved'
    );

    if (nextRequestStatus !== currentStatus || ['failed', 'returned'].includes(data.status)) {
      const notificationStatus = ['failed', 'returned'].includes(data.status)
        ? action.actionType === 'replacement_shipment'
          ? 'replacement_shipment_failed'
          : 'missing_item_shipment_failed'
        : nextRequestStatus;
      await this.notifyCustomerReturnStatus(request, notificationStatus, {
        trackingId,
      });
    }

    return this.findById(request.id.toString());
  }

  async updateRefundStatus(id: string, data: UpdateReturnRefundStatusInput, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const request = await this.findById(id);
    this.validateCustomerReturnRequestForRefundStatusUpdate(request);

    const refundActions = (request.resolutionActions || []).filter((action: any) =>
      REFUND_ACTIONS.has(action.actionType)
    );
    const action = data.resolution_action_id
      ? refundActions.find((entry: any) => Number(entry.id) === Number(data.resolution_action_id))
      : refundActions.find((entry: any) => entry.externalReference && entry.externalReference === data.external_reference);

    if (!action) {
      throw new ValidationError(
        'Refund action not found',
        'Close the request with a refund or partial-refund action before updating refund status'
      );
    }

    if (this.normalizeRefundProcessingStatus(data.status) === 'completed') {
      await this.refundOperationService.completeReturnRefundOperation(
        Number(request.id),
        Number(action.id),
        data.external_reference || action.externalReference || null,
      );
    }

    await this.applyRefundStatusUpdate(request, action, {
      status: data.status,
      eventTime: data.event_time,
      remarks: data.remarks,
      metadata: data.metadata,
      authUser,
      source: 'admin',
    });

    return this.findById(request.id.toString());
  }

  async reconcileRefundStatusByReference(
    refundReference: string,
    status: string,
    metadata: Record<string, unknown> = {}
  ) {
    const reference = refundReference?.trim();
    if (!reference) {
      return null;
    }

    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        action."id" AS "action_id",
        action."return_request_id"
      FROM "return_resolution_actions" AS action
      WHERE action."external_reference" = ${reference}
        AND action."action_type" IN ('refund', 'partial_refund')
      ORDER BY action."id" DESC
      LIMIT 1
    `;

    const match = rows[0];
    if (!match) {
      logger.warn({ refundReference: reference, status }, 'No return refund action found for payment reference');
      return null;
    }

    const request = await this.findById(String(match.return_request_id));
    const action = (request.resolutionActions || []).find((entry: any) => Number(entry.id) === Number(match.action_id));
    if (!action) {
      logger.warn({ refundReference: reference, returnRequestId: match.return_request_id }, 'Matched refund action was not attached to return request');
      return null;
    }

    await this.applyRefundStatusUpdate(request, action, {
      status,
      metadata: {
        ...metadata,
        externalReference: reference,
      },
      source: 'payment_gateway',
    });

    return this.findById(String(match.return_request_id));
  }

  async reconcileRefundStatusByOperation(
    returnRequestId: number,
    resolutionActionId: number,
    status: string,
    refundReference?: string | null,
    metadata: Record<string, unknown> = {}
  ) {
    const request = await this.findById(String(returnRequestId));
    const action = (request.resolutionActions || []).find(
      (entry: any) => Number(entry.id) === resolutionActionId && REFUND_ACTIONS.has(entry.actionType)
    );
    if (!action) {
      logger.warn({ returnRequestId, resolutionActionId, status }, 'No return refund action found for refund operation');
      return null;
    }
    if (this.normalizeRefundProcessingStatus(status) === 'completed') {
      await this.refundOperationService.completeReturnRefundOperation(
        returnRequestId,
        resolutionActionId,
        refundReference || action.externalReference || null,
      );
    }
    if (refundReference && action.externalReference !== refundReference) {
      await prisma.$executeRaw`
        UPDATE "return_resolution_actions"
        SET "external_reference" = ${refundReference}, "modifieddate" = ${nowSeconds()}
        WHERE "id" = ${resolutionActionId} AND "return_request_id" = ${returnRequestId}
      `;
      action.externalReference = refundReference;
    }
    await this.applyRefundStatusUpdate(request, action, {
      status,
      metadata: { ...metadata, externalReference: refundReference || action.externalReference || null },
      source: 'payment_gateway',
    });
    return this.findById(String(returnRequestId));
  }

  async createCreditNote(id: string, data: CreateReturnCreditNoteInput, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const request = await this.findById(id);
    if (request.requesttype === 'rto' || request.source === 'delivery_partner') {
      throw new ValidationError(
        'Credit note is not valid for RTO',
        'Delivery-partner RTO records do not create customer refund credit notes'
      );
    }

    const refundActions = (request.resolutionActions || [])
      .filter((action: any) => ['refund', 'partial_refund'].includes(action.actionType));
    const action = data.resolution_action_id
      ? refundActions.find((entry: any) => Number(entry.id) === Number(data.resolution_action_id))
      : refundActions.find((entry: any) => entry.status === 'completed');

    if (!action) {
      throw new ValidationError(
        'Completed refund resolution required',
        'Close the request with a refund or partial-refund resolution before creating a credit note'
      );
    }

    if (action.status !== 'completed') {
      throw new ValidationError(
        'Refund resolution is not completed',
        'Credit notes can only be created for completed refund or partial-refund actions'
      );
    }

    if (hasActiveCreditNoteForResolution(request.creditNotes, action.id)) {
      const activeCreditNote = (request.creditNotes || []).find((creditNote: any) =>
        Number(creditNote.resolutionActionId) === Number(action.id) && creditNote.status !== 'void'
      );
      throw new ValidationError(
        'Credit note already exists',
        `Credit note ${activeCreditNote?.creditNoteNumber || 'already saved'} is already linked to this refund resolution`
      );
    }

    const creditNote = await this.createCreditNoteRecord(prisma, request, action, data, authUser, {
      autoSkipWithoutGst: false,
      suppressTimeline: false,
    });

    await invoiceAdjustmentService.recordReturnResolution(request, action, {
      creditNote,
      gstReversalApplicable: Boolean(creditNote),
      actorId: authUser!.id,
    });

    return this.findById(request.id.toString());
  }

  private async createCreditNoteRecord(
    database: any,
    request: any,
    action: any,
    data: Partial<CreateReturnCreditNoteInput> = {},
    authUser?: AuthUser,
    options: { autoSkipWithoutGst?: boolean; suppressTimeline?: boolean } = {}
  ) {
    if (request.requesttype === 'rto' || request.source === 'delivery_partner') {
      if (options.autoSkipWithoutGst) {
        return null;
      }
      throw new ValidationError(
        'Credit note is not valid for RTO',
        'Delivery-partner RTO records do not create customer refund credit notes'
      );
    }

    const existingCreditNote = (request.creditNotes || []).find((creditNote: any) =>
      Number(creditNote.resolutionActionId) === Number(action.id) && creditNote.status !== 'void'
    );
    if (existingCreditNote) {
      return {
        id: existingCreditNote.id,
        credit_note_number: existingCreditNote.creditNoteNumber,
      };
    }

    const existingRows = await database.$queryRaw<any[]>`
      SELECT "id", "credit_note_number"
      FROM "return_credit_notes"
      WHERE "resolution_action_id" = ${action.id}
        AND "status" <> 'void'
      ORDER BY "id" DESC
      LIMIT 1
    `;
    if (existingRows[0]) {
      return existingRows[0];
    }

    let refundAmount: number;
    try {
      refundAmount = resolveCreditNoteRefundAmount(action, data as CreateReturnCreditNoteInput);
    } catch {
      if (options.autoSkipWithoutGst) {
        logger.warn(
          { returnRequestId: request.id, resolutionActionId: action.id },
          'Auto credit note skipped because refund amount is unavailable'
        );
        return null;
      }
      throw new ValidationError(
        'Refund amount required',
        'Completed refund action does not have an amount; enter the credit note amount manually'
      );
    }

    const taxBreakup = calculateCreditNoteTaxBreakup(request, refundAmount, data as CreateReturnCreditNoteInput);
    const gstRate = Number(taxBreakup.gstRate || 0);
    if (!Number.isFinite(gstRate) || gstRate <= 0) {
      if (options.autoSkipWithoutGst) {
        logger.info(
          { returnRequestId: request.id, resolutionActionId: action.id },
          'Auto credit note skipped because original orderline GST rate is unavailable'
        );
        return null;
      }
      throw new ValidationError(
        'GST rate unavailable',
        'GST credit note can be created only when a valid GST rate exists on the original order item or is provided explicitly'
      );
    }

    const timestamp = nowSeconds();
    const creditNoteNumber = generateCreditNoteNumber(request.requestnumber);
    const creditNoteStatus = data.status || 'draft';
    const orderline = request.orderline || {};
    const order = request.order || {};
    const metadata = {
      ...(data.metadata || {}),
      returnRequestNumber: request.requestnumber,
      orderlineId: request.orderlineid,
      resolutionActionId: action.id,
      resolutionActionType: action.actionType,
      refundMethod: action.refundMethod || null,
      externalReference: action.externalReference || null,
      noReverseChargeDeduction: action.noReverseChargeDeduction ?? true,
      gstReversalApplicable: true,
    };

    const rows = await database.$queryRaw<any[]>`
      INSERT INTO "return_credit_notes" (
        "credit_note_number",
        "return_request_id",
        "resolution_action_id",
        "original_order_id",
        "original_order_number",
        "original_invoice_number",
        "original_invoice_url",
        "reason_code",
        "resolution",
        "quantity",
        "refund_amount",
        "taxable_amount",
        "gst_rate",
        "cgst_amount",
        "sgst_amount",
        "igst_amount",
        "total_gst_amount",
        "hsn_code",
        "status",
        "metadata",
        "notes",
        "created_by",
        "issued_by",
        "createddate",
        "modifieddate",
        "issueddate"
      ) VALUES (
        ${creditNoteNumber},
        ${request.id},
        ${action.id},
        ${request.orderid || null},
        ${firstText(order.orderid, orderline.uniqueordderid) || null},
        ${data.original_invoice_number || firstText(order.orderid, orderline.uniqueordderid) || null},
        ${firstText(order.order_invoice_url) || null},
        ${request.reasoncode || null},
        ${request.requestedresolution || action.actionType},
        ${action.quantity || request.requestedquantity || 1},
        ${refundAmount},
        ${taxBreakup.taxableAmount},
        ${taxBreakup.gstRate},
        ${taxBreakup.cgstAmount},
        ${taxBreakup.sgstAmount},
        ${taxBreakup.igstAmount},
        ${taxBreakup.totalGstAmount},
        ${taxBreakup.hsnCode},
        ${creditNoteStatus},
        ${JSON.stringify(toJsonSafe(metadata))}::jsonb,
        ${data.notes || null},
        ${authUser?.id || null},
        ${creditNoteStatus === 'issued' ? authUser?.id || null : null},
        ${timestamp},
        ${timestamp},
        ${creditNoteStatus === 'issued' ? timestamp : null}
      )
      ON CONFLICT ("credit_note_number") DO UPDATE SET
        "status" = EXCLUDED."status",
        "metadata" = EXCLUDED."metadata",
        "modifieddate" = EXCLUDED."modifieddate"
      RETURNING *
    `;

    const creditNote = rows[0] || null;

    if (!options.suppressTimeline) {
      await this.recordStatusTimeline(database, {
        returnRequestId: request.id,
        previousStatus: request.status,
        status: request.status,
        eventType: creditNoteStatus === 'issued' ? 'credit_note_issued' : 'credit_note_created',
        authUser,
        message: creditNoteStatus === 'issued' ? 'Credit note issued' : 'Credit note drafted',
        metadata: {
          creditNoteNumber,
          resolutionActionId: action.id,
          refundAmount,
          taxableAmount: taxBreakup.taxableAmount,
          totalGstAmount: taxBreakup.totalGstAmount,
          status: creditNoteStatus,
        },
        timestamp,
      });
    }

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        resolutionActionId: action.id,
        creditNoteNumber,
        status: creditNoteStatus,
        refundAmount,
        taxableAmount: taxBreakup.taxableAmount,
        totalGstAmount: taxBreakup.totalGstAmount,
        actorId: authUser?.id || null,
      },
      'Return credit note saved'
    );

    return creditNote;
  }

  async addAttachments(id: string, data: AddReturnRequestAttachmentInput, authUser?: AuthUser) {
    const request = await this.findById(id);
    this.validateRequestAccess(request, authUser);
    const timestamp = nowSeconds();
    const reasonRule = await this.getReasonRuleForRequest(request);

    const createdAttachments = await Promise.all(data.attachments.map((attachment) =>
      attachmentClient().create({
        data: {
        returnrequestid: request.id,
        attachmenttype: attachment.attachmenttype,
        fileurl: attachment.fileurl,
        isrequired: attachment.isrequired ?? this.isAttachmentRequired(attachment.attachmenttype, reasonRule),
        uploadedbycustomerid: authUser?.userType === 'ecommerce' ? authUser.id : request.customerid,
        uploadeddate: timestamp,
        status: 'active',
        },
      })
    ));

    await this.refreshEvidenceStatus(request.id, {
      authUser,
      reopenRejected: true,
      eventReason: 'evidence_attachment_added',
    });
    const refreshedRequest = await this.findById(id);
    await this.recordEvidenceAttachmentTimeline(refreshedRequest, {
      eventType: 'evidence_attachment_added',
      authUser,
      message: `${createdAttachments.length} evidence attachment(s) added`,
      timestamp,
      metadata: {
        attachmentIds: createdAttachments.map((attachment: any) => attachment.id),
        attachmentTypes: createdAttachments.map((attachment: any) => attachment.attachmenttype),
        source: 'url_attachment',
      },
    });

    return refreshedRequest;
  }

  async uploadEvidenceFile(data: {
    attachmenttype: string;
    fileBuffer: Buffer;
    filename: string;
    mimetype: string;
    orderIdentifier?: string | number | null;
    returnRequestNumber?: string | null;
  }) {
    this.validateEvidenceFile(data.attachmenttype, data.fileBuffer, data.mimetype);

    const safeFileName = sanitizeFileName(data.filename);
    const storageRequestKey = data.orderIdentifier
      ? sanitizeFileName(String(data.orderIdentifier))
      : data.returnRequestNumber
        ? sanitizeFileName(data.returnRequestNumber)
        : 'unassigned';
    const pathPrefix = storageRequestKey;
    const filePath = `${pathPrefix}/${randomUUID()}-${safeFileName}`;
    const bucket = this.getEvidenceBucketName();
    let fileurl: string;
    let uploadedBucket: string | null = bucket || null;
    let uploadedObjectPath = filePath;

    try {
      const uploaded = await storageService.uploadReturnEvidenceFile(
        data.fileBuffer,
        safeFileName,
        data.mimetype,
        storageRequestKey
      );

      uploadedObjectPath = uploaded.objectKey;
      uploadedBucket = uploaded.bucket || uploadedBucket;
      fileurl = this.buildEvidenceFileUrl(uploadedObjectPath);

      return {
        attachmenttype: data.attachmenttype,
        fileurl,
        filename: uploaded.filename || safeFileName,
        mimetype: uploaded.mimetype || data.mimetype,
        filesize: uploaded.size || data.fileBuffer.length,
        objectpath: uploadedObjectPath,
        bucket: uploadedBucket,
      };
    } catch (error: any) {
      const storageRouteUnavailable =
        Number(error?.upstreamStatusCode) === 404
        && /route\s+.*not found/i.test(String(error?.message || ''));

      logger.warn(
        {
          error: error.message,
          upstreamStatusCode: error?.upstreamStatusCode,
          filePath,
          bucket,
          fallbackEnabled: storageRouteUnavailable,
        },
        'File-Upload service upload failed for return evidence'
      );

      // During rolling deployments, the configured upload service may still be
      // on a revision that predates the dedicated evidence route. Only that
      // compatibility case may use the existing GCS/local evidence fallback;
      // authentication, validation, and storage failures must remain visible.
      if (process.env.STORAGE_BACKEND_URL && !storageRouteUnavailable) {
        throw new ValidationError(
          'Evidence storage upload failed',
          error.message || 'Unable to upload return evidence to the configured storage backend'
        );
      }
    }

    if (bucket) {
      try {
        await this.saveEvidenceFileToGcs(bucket, filePath, data.fileBuffer, data.mimetype);
        fileurl = this.buildEvidenceFileUrl(filePath);
      } catch (error: any) {
        logger.warn(
          { error: error.message, filePath, bucket },
          'GCS upload failed for return evidence; trying configured storage backend or local fallback'
        );
        fileurl = await this.saveEvidenceFileWithFallback(filePath, data.fileBuffer, data.mimetype, bucket);
      }
    } else if (!process.env.STORAGE_API_URL && process.env.NODE_ENV !== 'production') {
      fileurl = await this.saveEvidenceFileLocally(filePath, data.fileBuffer);
    } else {
      fileurl = await this.saveEvidenceFileWithFallback(filePath, data.fileBuffer, data.mimetype, bucket);
    }

    return {
      attachmenttype: data.attachmenttype,
      fileurl,
      filename: safeFileName,
      mimetype: data.mimetype,
      filesize: data.fileBuffer.length,
      objectpath: uploadedObjectPath,
      bucket: uploadedBucket,
    };
  }

  private async saveEvidenceFileWithFallback(
    filePath: string,
    fileBuffer: Buffer,
    mimetype: string,
    bucket?: string
  ) {
    if (process.env.STORAGE_API_URL) {
      try {
        return await storageService.uploadFileToBucket(
          fileBuffer,
          filePath,
          mimetype,
          bucket
        );
      } catch (error: any) {
        logger.warn(
          { error: error.message, filePath },
          'Storage backend upload failed for return evidence; saving locally'
        );
      }
    }

    return this.saveEvidenceFileLocally(filePath, fileBuffer);
  }

  private async saveEvidenceFileToGcs(bucket: string, filePath: string, fileBuffer: Buffer, mimetype: string) {
    await gcsStorage.bucket(bucket).file(filePath).save(fileBuffer, {
      resumable: false,
      metadata: {
        contentType: mimetype,
        cacheControl: 'private, max-age=3600',
      },
    });
  }

  private buildEvidenceFileUrl(filePath: string) {
    const apiBaseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5600}`;
    const encodedPath = filePath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .split('/')
      .filter(Boolean)
      .map(encodeURIComponent)
      .join('/');
    return `${apiBaseUrl.replace(/\/$/, '')}/v1/returns/evidence-file/${encodedPath}`;
  }

  private async saveEvidenceFileLocally(filePath: string, fileBuffer: Buffer) {
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const absolutePath = path.join(process.cwd(), 'uploads', normalizedPath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, fileBuffer);

    return this.buildEvidenceFileUrl(normalizedPath);
  }

  async openEvidenceFile(rawPath: string) {
    return this.locateEvidenceFile(rawPath, true);
  }

  async getEvidenceHealth(id: string, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const request = await this.findById(id);
    const attachments = Array.isArray(request.attachments)
      ? request.attachments.filter((attachment: any) => attachment.status !== 'inactive')
      : [];
    const checkedAt = nowSeconds();
    const healthItems = await Promise.all(
      attachments.map((attachment: any) => this.buildEvidenceHealthItem(attachment, checkedAt))
    );

    return {
      requestId: request.id,
      requestNumber: request.requestnumber,
      checkedAt,
      totals: {
        attached: healthItems.length,
        available: healthItems.filter((item) => item.available).length,
        missing: healthItems.filter((item) => !item.available).length,
        repairable: healthItems.filter((item) => item.repairable).length,
        legacy: healthItems.filter((item) => item.legacyUrl).length,
      },
      attachments: healthItems,
    };
  }

  async repairEvidenceLinks(id: string, authUser?: AuthUser) {
    this.validateInventoryUser(authUser);

    const health = await this.getEvidenceHealth(id, authUser);
    const repairableItems = health.attachments.filter((item) => item.available && item.repairable && item.resolvedUrl);

    for (const item of repairableItems) {
      await attachmentClient().update({
        where: { id: item.attachmentId },
        data: { fileurl: item.resolvedUrl },
      });
    }

    if (repairableItems.length > 0) {
      await this.refreshEvidenceStatus(health.requestId, {
        authUser,
        reopenRejected: true,
        eventReason: 'evidence_link_repaired',
      });

      logger.info(
        {
          returnRequestId: health.requestId,
          requestNumber: health.requestNumber,
          repairedCount: repairableItems.length,
          attachmentIds: repairableItems.map((item) => item.attachmentId),
          actorId: authUser?.id || null,
        },
        'Return evidence attachment links repaired'
      );
    }

    const refreshedRequest = await this.findById(id);
    if (repairableItems.length > 0) {
      await this.recordEvidenceAttachmentTimeline(refreshedRequest, {
        eventType: 'evidence_link_repaired',
        authUser,
        message: `${repairableItems.length} evidence link(s) repaired`,
        metadata: {
          attachmentIds: repairableItems.map((item) => item.attachmentId),
          repairedLinks: repairableItems.map((item) => ({
            attachmentId: item.attachmentId,
            attachmentType: item.attachmenttype,
            previousUrl: item.fileurl,
            resolvedUrl: item.resolvedUrl,
            objectPath: item.objectPath,
            source: item.source,
          })),
        },
      });
    }
    const refreshedHealth = await this.getEvidenceHealth(id, authUser);

    return {
      request: refreshedRequest,
      health: refreshedHealth,
      repairedCount: repairableItems.length,
      skippedCount: health.attachments.length - repairableItems.length,
      repairedAttachmentIds: repairableItems.map((item) => item.attachmentId),
    };
  }

  private async buildEvidenceHealthItem(attachment: any, checkedAt: number) {
    let primaryObjectPath = 'evidence-file';
    try {
      primaryObjectPath = this.normalizeEvidenceObjectPath(attachment.fileurl);
    } catch {
      primaryObjectPath = sanitizeFileName(path.basename(String(attachment.fileurl || 'evidence-file')));
    }

    try {
      const location = await this.locateEvidenceFile(attachment.fileurl, false);
      const resolvedUrl = this.buildEvidenceFileUrl(location.objectPath);
      const legacyUrl = this.isLegacyEvidenceUrl(attachment.fileurl, location.objectPath);

      return {
        attachmentId: attachment.id,
        attachmenttype: attachment.attachmenttype,
        fileurl: attachment.fileurl,
        objectPath: location.objectPath,
        resolvedUrl,
        source: location.source,
        available: true,
        contentType: location.contentType,
        contentLength: location.contentLength,
        checkedAt,
        legacyUrl,
        repairable: legacyUrl,
        message: legacyUrl
          ? 'File is available, but the attachment still points to an older evidence URL format.'
          : 'File is available.',
      };
    } catch (error: any) {
      return {
        attachmentId: attachment.id,
        attachmenttype: attachment.attachmenttype,
        fileurl: attachment.fileurl,
        objectPath: primaryObjectPath,
        resolvedUrl: null,
        source: 'missing',
        available: false,
        contentType: this.getEvidenceContentType(primaryObjectPath),
        contentLength: null,
        checkedAt,
        legacyUrl: this.isLegacyEvidenceUrl(attachment.fileurl, primaryObjectPath),
        repairable: false,
        message: error?.message || 'Evidence file was not found in local or durable storage.',
      };
    }
  }

  private async locateEvidenceFile(rawPath: string, includeStream: boolean): Promise<EvidenceFileLocation> {
    const candidates = this.getEvidenceObjectPathCandidates(rawPath);
    const uploadsRoot = path.resolve(process.cwd(), 'uploads');

    for (const candidate of candidates) {
      const absolutePath = path.resolve(uploadsRoot, candidate);
      if (!absolutePath.startsWith(uploadsRoot + path.sep) && absolutePath !== uploadsRoot) {
        continue;
      }

      try {
        await access(absolutePath);
        const stats = await stat(absolutePath);
        if (stats.isFile()) {
          return {
            stream: includeStream ? createReadStream(absolutePath) : undefined,
            contentType: this.getEvidenceContentType(candidate),
            contentLength: stats.size,
            objectPath: candidate,
            source: 'local',
          };
        }
      } catch {
        // Try the next local/GCS candidate.
      }
    }

    const bucket = this.getEvidenceBucketName();
    if (bucket) {
      for (const candidate of candidates) {
        try {
          const file = gcsStorage.bucket(bucket).file(candidate);
          const [exists] = await file.exists();
          if (exists) {
            const [metadata] = await file.getMetadata();
            return {
              stream: includeStream ? file.createReadStream() : undefined,
              contentType: String(metadata.contentType || this.getEvidenceContentType(candidate)),
              contentLength: metadata.size ? Number(metadata.size) : undefined,
              objectPath: candidate,
              source: 'gcs',
            };
          }
        } catch (error: any) {
          logger.warn(
            { error: error?.message || 'Unknown error', bucket, objectPath: candidate },
            'Unable to read return evidence through GCS client; trying public object URL'
          );
        }

        const publicUrl = `https://storage.googleapis.com/${bucket}/${candidate.split('/').map(encodeURIComponent).join('/')}`;
        try {
          const response = await fetch(publicUrl, { method: 'HEAD' });
          if (response.ok) {
            return {
              redirectUrl: publicUrl,
              contentType: response.headers.get('content-type') || this.getEvidenceContentType(candidate),
              contentLength: response.headers.get('content-length') ? Number(response.headers.get('content-length')) : undefined,
              objectPath: candidate,
              source: 'gcs_public',
            };
          }
        } catch {
          // Public object fallback is best-effort only.
        }
      }
    }

    throw new NotFoundError('Evidence file not found');
  }

  private isLegacyEvidenceUrl(fileurl: string, resolvedObjectPath: string) {
    try {
      const url = new URL(String(fileurl || ''), process.env.API_BASE_URL || 'http://localhost');
      if (!url.pathname.startsWith('/v1/returns/evidence-file/')) {
        return true;
      }
    } catch {
      return true;
    }

    try {
      return this.normalizeEvidenceObjectPath(fileurl) !== resolvedObjectPath;
    } catch {
      return true;
    }
  }

  private getEvidenceObjectPathCandidates(rawPath: string) {
    const normalized = this.normalizeEvidenceObjectPath(rawPath);
    const candidates = new Set<string>([normalized]);
    const fileName = path.basename(normalized);

    if (normalized.startsWith('uploads/')) {
      candidates.add(normalized.replace(/^uploads\/+/, ''));
    }
    if (normalized.startsWith('returns/evidence/uploads/')) {
      const uploadTail = normalized.replace(/^returns\/evidence\/uploads\/+/, '');
      candidates.add(`uploads/${uploadTail}`);
      candidates.add(uploadTail);
      candidates.add(`returns/evidence/${uploadTail}`);
      candidates.add(`uploads/returns/evidence/uploads/${uploadTail}`);
    }
    if (!normalized.startsWith('returns/evidence/')) {
      candidates.add(`returns/evidence/${normalized}`);
    }
    if (fileName && fileName !== normalized) {
      candidates.add(fileName);
    }

    return Array.from(candidates).filter(Boolean);
  }

  private getEvidenceBucketName() {
    return process.env.RETURN_REPLACEMENT_BUCKET
      || process.env.RETURN_EVIDENCE_BUCKET
      || process.env.CATEGORY_IMAGES_BUCKET
      || DEFAULT_EVIDENCE_STORAGE_BUCKET;
  }

  private normalizeEvidenceObjectPath(rawPath: string) {
    const decoded = decodeURIComponent(String(rawPath || ''));
    let pathname = decoded;
    try {
      pathname = new URL(decoded).pathname;
    } catch {
      // rawPath is already a path, not a full URL.
    }

    const normalized = pathname
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/^uploads\/+/, '')
      .replace(/^v1\/returns\/evidence-file\/+/, '')
      .replace(/\?.*$/, '');

    if (!normalized || normalized.includes('..')) {
      throw new ValidationError('Invalid evidence file path', 'Evidence file path is not valid');
    }

    return normalized;
  }

  private getEvidenceContentType(filePath: string) {
    return EVIDENCE_CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
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
      orderIdentifier: request.order?.orderid || request.orderline?.orders?.orderid || request.orderid || request.orderline?.orderid,
      returnRequestNumber: request.requestnumber,
    });

    const reasonRule = await this.getReasonRuleForRequest(request);
    const timestamp = nowSeconds();

    const createdAttachment = await attachmentClient().create({
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

    await this.refreshEvidenceStatus(request.id, {
      authUser,
      reopenRejected: true,
      eventReason: 'evidence_attachment_uploaded',
    });
    const refreshedRequest = await this.findById(id);
    await this.recordEvidenceAttachmentTimeline(refreshedRequest, {
      eventType: 'evidence_attachment_uploaded',
      authUser,
      message: 'Evidence attachment uploaded',
      metadata: {
        attachmentId: createdAttachment.id,
        attachmentType: uploaded.attachmenttype,
        filename: uploaded.filename,
        mimetype: uploaded.mimetype,
        filesize: uploaded.filesize,
        objectPath: uploaded.objectpath,
        bucket: uploaded.bucket,
      },
    });

    return refreshedRequest;
  }

  async replaceEvidenceAttachment(
    id: string,
    attachmentId: string,
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

    const existingAttachment = (request.attachments || []).find(
      (attachment: any) => Number(attachment.id) === Number(attachmentId)
    );
    if (!existingAttachment) {
      throw new NotFoundError(`Evidence attachment with ID ${attachmentId} not found for this return request`);
    }

    const uploaded = await this.uploadEvidenceFile({
      ...data,
      orderIdentifier: request.order?.orderid || request.orderline?.orders?.orderid || request.orderid || request.orderline?.orderid,
      returnRequestNumber: request.requestnumber,
    });
    const reasonRule = await this.getReasonRuleForRequest(request);

    const timestamp = nowSeconds();
    await attachmentClient().update({
      where: { id: Number(attachmentId) },
      data: {
        attachmenttype: uploaded.attachmenttype,
        fileurl: uploaded.fileurl,
        isrequired: this.isAttachmentRequired(uploaded.attachmenttype, reasonRule),
        uploadedbycustomerid: authUser?.userType === 'ecommerce' ? authUser.id : request.customerid,
        uploadeddate: timestamp,
        status: 'active',
      },
    });

    await this.refreshEvidenceStatus(request.id, {
      authUser,
      reopenRejected: true,
      eventReason: 'evidence_attachment_replaced',
    });
    const refreshedRequest = await this.findById(id);
    await this.recordEvidenceAttachmentTimeline(refreshedRequest, {
      eventType: 'evidence_attachment_replaced',
      authUser,
      message: 'Evidence attachment replaced',
      timestamp,
      metadata: {
        attachmentId: Number(attachmentId),
        previousAttachmentType: existingAttachment.attachmenttype,
        attachmentType: uploaded.attachmenttype,
        previousUrl: existingAttachment.fileurl,
        filename: uploaded.filename,
        mimetype: uploaded.mimetype,
        filesize: uploaded.filesize,
        objectPath: uploaded.objectpath,
        bucket: uploaded.bucket,
      },
    });

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        attachmentId: Number(attachmentId),
        attachmentType: uploaded.attachmenttype,
        actorId: authUser?.id || null,
        actorType: authUser?.userType || null,
      },
      'Return evidence attachment replaced'
    );

    return refreshedRequest;
  }

  async getOrderReturnEligibility(orderId: string, authUser?: AuthUser) {
    const order = await this.resolveOrderForEligibility(orderId);

    if (authUser?.userType === 'ecommerce' && order.userid !== authUser.id) {
      throw new ValidationError('Order does not belong to customer', 'Customers can only view return eligibility for their own orders');
    }

    const orderlines = Array.isArray(order.orderline) ? order.orderline : [];
    const items = await Promise.all(
      orderlines.map((orderline: any) => this.buildOrderlineEligibility(orderline, order))
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

  private async buildOrderlineEligibility(orderline: any, order: any) {
    const orderedQuantity = orderline.quantity || 1;
    const consumedQuantity = await this.getConsumedQuantity(orderline.id);
    const remainingEligibleQuantity = Math.max(0, orderedQuantity - consumedQuantity);
    const deliveryCheck = this.getDeliveryEligibilityReason(orderline, order);
    const returnEligibility = await this.evaluatePolicyEligibility(orderline, 'return');
    const replacementEligibility = await this.evaluatePolicyEligibility(orderline, 'replacement');
    const returnWindow = this.evaluateWindow(orderline, order, returnEligibility.windowdays, 'return');
    const replacementWindow = this.evaluateWindow(orderline, order, replacementEligibility.windowdays, 'replacement');

    const existingRequests = await requestClient().findMany({
      where: { orderlineid: orderline.id },
      select: { status: true },
    });
    const hasRejected = existingRequests.some((req: any) =>
      ['rejected', 'evidence_rejected', 'inspection_rejected'].includes(req.status)
    );

    const canReturn = !hasRejected
      && deliveryCheck.eligible
      && returnEligibility.eligible
      && returnWindow.eligible
      && remainingEligibleQuantity > 0;
    const canReplace = !hasRejected
      && deliveryCheck.eligible
      && replacementEligibility.eligible
      && replacementWindow.eligible
      && remainingEligibleQuantity > 0;

    const policy = returnEligibility.policy || replacementEligibility.policy || null;
    const policyReasonRules = policy?.id
      ? await this.policyReasonRuleService.findMappingsForPolicy(policy.id)
      : [];

    const allowedReasons = policyReasonRules
      .filter((mapping: any) => this.isActivePolicyReasonMapping(mapping))
      .map((mapping: any) => this.serializePolicyReasonMappingForEligibility(
        mapping,
        policy,
        orderline,
        order,
        canReturn,
        canReplace
      ))
      .filter(Boolean);

    const blockers = [
      !deliveryCheck.eligible ? deliveryCheck.reason : null,
      hasRejected ? 'Return/replacement request has been rejected by admin' : (remainingEligibleQuantity <= 0 ? 'No remaining eligible quantity' : null),
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
      orderstatus: orderline.orderstatus,
      delivereddate: orderline.delivereddate || order.delivereddate || null,
      orderedquantity: orderedQuantity,
      activeorconsumedquantity: consumedQuantity,
      remainingeligiblequantity: remainingEligibleQuantity,
      eligible: canReturn || canReplace,
      return: {
        eligible: canReturn,
        policyeligible: returnEligibility.eligible,
        policyid: returnEligibility.policy?.id || null,
        policyversion: this.getPolicyVersion(returnEligibility.policy),
        windowdays: returnEligibility.windowdays,
        allowedrefundmethods: returnEligibility.allowedrefundmethods,
        reason: canReturn ? 'Return can be requested' : returnWindow.reason || returnEligibility.reason || deliveryCheck.reason,
      },
      replacement: {
        eligible: canReplace,
        policyeligible: replacementEligibility.eligible,
        policyid: replacementEligibility.policy?.id || null,
        policyversion: this.getPolicyVersion(replacementEligibility.policy),
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

  private async evaluatePolicyEligibility(orderline: any, requesttype: 'return' | 'replacement') {
    try {
      return await this.policyService.resolveEligibility({
        orderlineid: orderline.id,
        requesttype,
      });
    } catch (error: any) {
      return {
        requesttype,
        eligible: false,
        category: null,
        subcategory: null,
        windowdays: null,
        allowedrefundmethods: [],
        policy: null,
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

  private serializePolicyReasonMappingForEligibility(
    mapping: any,
    policy: any,
    orderline: any,
    order: any,
    canReturn: boolean,
    canReplace: boolean
  ) {
    const rule = this.buildRuntimeReasonRuleFromPolicyMapping(mapping);
    const raiseWindow = this.evaluateReasonRaiseWindow(orderline, order, rule.raisewithinhours);

    if (!raiseWindow.eligible) {
      return null;
    }

    const serialized = this.serializeReasonForEligibility(rule, canReturn, canReplace);
    if (!serialized) {
      return null;
    }

    return {
      ...serialized,
      policyid: policy?.id || mapping.policyId || null,
      policyversion: this.getPolicyVersion(policy),
      policyreasonruleid: mapping.id,
      configurationversion: mapping.configurationVersion || rule.configurationversion || 1,
      reasondeadline: raiseWindow.deadline,
      remainingclaimmilliseconds: raiseWindow.remainingMilliseconds,
      configuration: rule.configuration || null,
    };
  }

  private evaluateReasonRaiseWindow(orderline: any, order: any, raiseWithinHours: number | null | undefined) {
    if (!raiseWithinHours) {
      return {
        eligible: true,
        deadline: null,
        remainingMilliseconds: null,
        reason: 'Reason does not have a shorter raise window',
      };
    }

    const deliveredAt = toMillis(orderline.delivereddate || orderline.orders?.delivereddate || order.delivereddate);
    const deadline = deliveredAt ? deliveredAt + raiseWithinHours * 60 * 60 * 1000 : null;

    if (!deadline) {
      return {
        eligible: false,
        deadline: null,
        remainingMilliseconds: null,
        reason: 'Delivery date unavailable',
      };
    }

    const remainingMilliseconds = deadline - nowMillis();
    return {
      eligible: remainingMilliseconds >= 0,
      deadline,
      remainingMilliseconds: Math.max(0, remainingMilliseconds),
      reason: remainingMilliseconds >= 0 ? 'Reason-specific raise window is active' : 'Reason-specific raise window expired',
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
      raisewithinhours: rule.raisewithinhours,
      schemaversion: rule.schemaversion || 1,
      evidencerules: getEvidenceRules(rule),
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
      resolutiontiming: rule.resolutiontiming,
      stockunavailableresolution: rule.stockunavailableresolution,
      pickuptriggermode: rule.pickuptriggermode || 'manual_admin',
      notifycustomeronstockfallback: rule.notifycustomeronstockfallback,
      reverseshippingchargebearer: 'nivaana',
    };
  }

  private async resolvePolicyReasonRuleForRequest(data: CreateReturnRequestInput, policy: any) {
    if (!policy?.id) {
      throw new ValidationError(
        'Return policy mapping unavailable',
        'A matched active policy is required before selecting a return reason'
      );
    }

    const policyReasonRuleId = this.getRequestedPolicyReasonRuleId(data);
    const reasonValue = normalizeCode(data.reasoncode || data.reason || '');
    const mappings = await this.policyReasonRuleService.findMappingsForPolicy(policy.id);
    const activeMappings = mappings.filter((mapping: any) => this.isActivePolicyReasonMapping(mapping));

    const mapping = policyReasonRuleId
      ? activeMappings.find((entry: any) => Number(entry.id) === policyReasonRuleId)
      : activeMappings.find((entry: any) => {
          const rule = this.buildRuntimeReasonRuleFromPolicyMapping(entry);
          const aliases = Array.isArray(rule.aliases) ? rule.aliases : [];
          const candidates = [rule.reasoncode, rule.reasonname, ...aliases]
            .filter(Boolean)
            .map((value: string) => normalizeCode(value));
          return candidates.includes(reasonValue);
        });

    if (!mapping) {
      throw new ValidationError(
        'Reason not configured for matched policy',
        policyReasonRuleId
          ? 'The selected policy reason mapping is inactive or does not belong to this policy'
          : 'The selected reason is not active for this item policy'
      );
    }

    return {
      mapping,
      reasonRule: this.buildRuntimeReasonRuleFromPolicyMapping(mapping),
    };
  }

  private getRequestedPolicyReasonRuleId(data: CreateReturnRequestInput) {
    const rawValue = (data as any).policyreasonruleid ?? (data as any).policyReasonRuleId;
    const numericValue = Number(rawValue);
    return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
  }

  private isActivePolicyReasonMapping(mapping: any) {
    return mapping?.isActive !== false && mapping?.reason?.status === 'active';
  }

  private buildRuntimeReasonRuleFromPolicyMapping(mapping: any) {
    const configuration = mapping?.configuration || {};
    const legacyFields = configuration.legacyFields || {};
    const pickup = configuration.pickup || {};
    const approvalMode = configuration.approvalMode || (legacyFields.evidencefirstapproval ? 'evidence_first' : 'pickup_first');

    return {
      id: mapping?.reasonId || mapping?.reason?.id || null,
      policyreasonruleid: mapping?.id || null,
      policyid: mapping?.policyId || null,
      configurationversion: mapping?.configurationVersion || 1,
      reasoncode: configuration.reasonCode || mapping?.reason?.reasoncode,
      reasonname: configuration.reasonName || mapping?.reason?.reasonname,
      aliases: Array.isArray(configuration.aliases) ? configuration.aliases : [],
      allowedresolutions: Array.isArray(configuration.allowedResolutions) ? configuration.allowedResolutions : [],
      raisewithinhours: configuration.raiseWithinHours ?? null,
      evidencerules: Array.isArray(configuration.evidence) ? configuration.evidence : [],
      photorequired: legacyFields.photorequired ?? true,
      videorequired: Boolean(legacyFields.videorequired),
      packagephotorequired: Boolean(legacyFields.packagephotorequired),
      packagephotooptional: Boolean(legacyFields.packagephotooptional),
      unboxingvideorequired: Boolean(legacyFields.unboxingvideorequired),
      unboxingvideooptional: Boolean(legacyFields.unboxingvideooptional),
      openedpackageallowed: configuration.openedPackageAllowed !== false,
      pickuprequired: pickup.required ?? legacyFields.pickuprequired ?? true,
      evidencefirstapproval: approvalMode === 'evidence_first',
      autocreatepickup: false,
      pickuptriggermode: pickup.triggerMode || legacyFields.pickuptriggermode || 'manual_admin',
      reverseshippingchargebearer: 'nivaana',
      resolutiontiming: configuration.resolutionTiming ?? null,
      stockunavailableresolution: configuration.stockUnavailableResolution ?? null,
      notifycustomeronstockfallback: configuration.notifyCustomerOnStockFallback !== false,
      schemaversion: mapping?.schemaVersion || configuration.schemaVersion || 1,
      configuration,
    };
  }

  private buildRuntimeReasonRuleFromSnapshot(request: any) {
    const snapshot = request?.reasonrulesnapshot;
    if (!snapshot || typeof snapshot !== 'object') {
      return null;
    }

    if ((snapshot as any).runtimeRule) {
      return (snapshot as any).runtimeRule;
    }

    if ((snapshot as any).configuration) {
      return this.buildRuntimeReasonRuleFromPolicyMapping({
        id: (snapshot as any).policyReasonRuleId || request.policyReasonRuleId,
        policyId: (snapshot as any).policyId || request.appliedPolicyId,
        reasonId: (snapshot as any).reasonId || null,
        schemaVersion: (snapshot as any).schemaVersion || request.reasonruleversion || 1,
        configurationVersion: (snapshot as any).configurationVersion || request.policyReasonRuleVersion || request.reasonruleversion || 1,
        configuration: (snapshot as any).configuration,
        reason: {
          id: (snapshot as any).reasonId || null,
          reasoncode: request.reasoncode,
          reasonname: request.reason,
          status: 'active',
        },
      });
    }

    return snapshot;
  }

  private validatePolicyResolution(data: CreateReturnRequestInput, policy: any, reasonRule: any) {
    if (data.requestedresolution === 'replacement') {
      if (!policy?.replacementallowed) {
        throw new ValidationError(
          'Replacement not allowed by matched policy',
          `${reasonRule.reasonname} allows replacement, but the matched item policy does not`
        );
      }
      return;
    }

    if (!policy?.returnallowed) {
      throw new ValidationError(
        'Return resolution not allowed by matched policy',
        `${reasonRule.reasonname} allows ${data.requestedresolution}, but the matched item policy does not allow returns`
      );
    }
  }

  private getPolicyVersion(policy: any) {
    const version = policy?.modifieddate || policy?.createddate || null;
    return version ? Number(version) : null;
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
    if (data.requesttype === 'replacement' && data.requestedresolution !== 'replacement') {
      throw new ValidationError(
        'Request type and resolution mismatch',
        'Replacement requests must use the replacement resolution'
      );
    }

    if (data.requesttype === 'return' && data.requestedresolution === 'replacement') {
      throw new ValidationError(
        'Request type and resolution mismatch',
        'Return requests cannot use the replacement resolution'
      );
    }

    if (!Array.isArray(reasonRule.allowedresolutions) || !reasonRule.allowedresolutions.includes(data.requestedresolution)) {
      throw new ValidationError(
        'Resolution not allowed for selected reason',
        `${data.requestedresolution} is not allowed for ${reasonRule.reasonname}`
      );
    }

    if (data.ispackageopened === true && !reasonRule.openedpackageallowed) {
      throw new ValidationError('Opened package is not eligible', `${reasonRule.reasonname} requires unopened package`);
    }

    const raiseWithinHours = reasonRule.raisewithinhours;
    if (raiseWithinHours) {
      const deliveredAt = toMillis(orderline.delivereddate || orderline.orders?.delivereddate);
      const deadline = deliveredAt ? deliveredAt + raiseWithinHours * 60 * 60 * 1000 : null;

      if (!deadline || nowMillis() > deadline) {
        throw new ValidationError(
          'Reason-specific raise window expired',
          `${reasonRule.reasonname} must be raised within ${raiseWithinHours} hours from delivery`
        );
      }
    }

    this.validateEvidence(data.attachments, reasonRule);
  }

  private validateEvidence(attachments: ReturnRequestAttachmentInput[], reasonRule: any) {
    const counts = countAttachmentsByType(attachments);
    const rules = getEvidenceRules(reasonRule);

    for (const rule of rules) {
      if (!rule.required || rule.minimum <= 0) {
        continue;
      }

      const uploadedCount = counts[rule.type] || 0;
      if (uploadedCount < rule.minimum) {
        throw new ValidationError(
          'Evidence requirement not met',
          `${reasonRule.reasonname} requires ${rule.minimum} ${rule.type.replace(/_/g, ' ')} file(s)`
        );
      }
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

  private resolveClosureActionType(request: any, reasonRule: any, data: CompleteReturnResolutionInput) {
    const requestedResolution = request.requestedresolution;
    const expectedActionByResolution: Record<string, string> = {
      replacement: 'replacement_shipment',
      refund: 'refund',
      complete_return: 'refund',
      partial_refund: 'partial_refund',
      ship_missing_item: 'missing_item_shipment',
    };
    const expectedAction = expectedActionByResolution[requestedResolution || ''];

    if (!expectedAction) {
      throw new ValidationError(
        'Resolution closure unavailable',
        `Request resolution ${requestedResolution || 'unknown'} cannot be closed by this flow`
      );
    }

    const isReplacementRefundFallback =
      requestedResolution === 'replacement'
      && data.action_type === 'refund'
      && data.stock_fallback_applied
      && reasonRule?.stockunavailableresolution === 'refund';

    if (data.action_type !== expectedAction && !isReplacementRefundFallback) {
      throw new ValidationError(
        'Closure action does not match requested resolution',
        `Expected ${expectedAction.replace(/_/g, ' ')} for ${requestedResolution}, received ${data.action_type.replace(/_/g, ' ')}`
      );
    }

    return data.action_type;
  }

  private async buildResolutionPreview(request: any, reasonRule: any) {
    const requestedResolution = request.requestedresolution || null;
    const expectedActionByResolution: Record<string, string> = {
      replacement: 'replacement_shipment',
      refund: 'refund',
      complete_return: 'refund',
      partial_refund: 'partial_refund',
      ship_missing_item: 'missing_item_shipment',
    };
    const expectedAction = expectedActionByResolution[requestedResolution || ''] || null;
    const allowedClosureActions: string[] = expectedAction ? [expectedAction] : [];
    let replacementStock: ReplacementStockAvailability | null = null;
    let recommendedAction = expectedAction;
    let stockFallbackRequired = false;
    let fallbackResolution = null as string | null;
    let reason = expectedAction
      ? `Close this request with ${expectedAction.replace(/_/g, ' ')}`
      : 'No closure action is available for this requested resolution';

    if (requestedResolution === 'replacement') {
      replacementStock = await this.getReplacementStockAvailability(request);
      const hasReplacementStock = replacementStock.availableQuantity >= Math.max(1, Number(request.requestedquantity || 1));
      fallbackResolution = reasonRule?.stockunavailableresolution || null;

      if (hasReplacementStock) {
        recommendedAction = 'replacement_shipment';
        reason = 'Replacement stock is available';
      } else if (fallbackResolution === 'refund') {
        recommendedAction = 'refund';
        stockFallbackRequired = true;
        if (!allowedClosureActions.includes('refund')) {
          allowedClosureActions.push('refund');
        }
        reason = 'Replacement stock is unavailable; refund fallback is configured';
      } else {
        recommendedAction = 'manual_review';
        reason = 'Replacement stock is unavailable and no refund fallback is configured';
      }
    }

    const estimatedRefundAmount = ['refund', 'partial_refund'].includes(String(recommendedAction))
      ? this.calculateClosureRefundAmount(request, { amount: undefined } as CompleteReturnResolutionInput)
      : null;
    const refundAllocation = estimatedRefundAmount && request.orderid
      ? await this.refundOperationService.previewReturnRefund(
          Number(request.orderid),
          Number(request.id),
          estimatedRefundAmount,
        )
      : null;

    return {
      requestId: request.id,
      requestNumber: request.requestnumber,
      requestedResolution,
      requestedQuantity: Math.max(1, Number(request.requestedquantity || 1)),
      expectedAction,
      recommendedAction,
      allowedClosureActions,
      readyForClosure: this.isClosureReady(request, recommendedAction || expectedAction),
      stockFallbackRequired,
      fallbackResolution,
      notifyCustomerOnStockFallback: reasonRule?.notifycustomeronstockfallback !== false,
      estimatedRefundAmount,
      refundAllocation,
      replacementStock,
      reason,
    };
  }

  private async getReplacementStockAvailability(request: any): Promise<ReplacementStockAvailability> {
    const requestedQuantity = Math.max(1, Number(request.requestedquantity || 1));
    const product = request.orderline?.product || {};
    const productId = integerFromUnknown(request.orderline?.productid || product.id);
    const puc = firstText(product.puc, request.orderline?.puc, request.orderline?.productpuc);

    if (!puc) {
      return {
        productId,
        puc: null,
        requestedQuantity,
        availableQuantity: 0,
        ecomPublishedAvailableQuantity: 0,
        platformAvailableQuantity: 0,
        platformEcomQuantity: 0,
        hasEnoughStock: false,
        stockSource: 'unavailable_product_identifier',
      };
    }

    const [stockRows, platformRows] = await Promise.all([
      prisma.$queryRaw<any[]>`
        SELECT
          COUNT(*) FILTER (WHERE LOWER("stockstatus") = 'available')::int AS "available_quantity",
          COUNT(*) FILTER (WHERE LOWER("stockstatus") = 'available' AND COALESCE("ecompublish", false) = true)::int AS "ecom_published_available_quantity"
        FROM "stock"
        WHERE "puc" = ${puc}
          AND COALESCE("isdeleted", false) = false
          AND COALESCE("isarchive", false) = false
          AND COALESCE("removefromrecyclebin", false) = false
      `,
      productId
        ? prisma.$queryRaw<any[]>`
            SELECT
              COALESCE(SUM("availableqty"), 0)::int AS "platform_available_quantity",
              COALESCE(SUM("ecomqty"), 0)::int AS "platform_ecom_quantity"
            FROM "platformstock"
            WHERE "productid" = ${BigInt(productId)}
          `
        : Promise.resolve([]),
    ]);

    const availableQuantity = Number(stockRows[0]?.available_quantity || 0);
    const ecomPublishedAvailableQuantity = Number(stockRows[0]?.ecom_published_available_quantity || 0);
    const platformAvailableQuantity = Number(platformRows[0]?.platform_available_quantity || 0);
    const platformEcomQuantity = Number(platformRows[0]?.platform_ecom_quantity || 0);

    return {
      productId,
      puc,
      requestedQuantity,
      availableQuantity,
      ecomPublishedAvailableQuantity,
      platformAvailableQuantity,
      platformEcomQuantity,
      hasEnoughStock: availableQuantity >= requestedQuantity,
      stockSource: 'stock',
    };
  }

  private validateClosureStockDecision(
    request: any,
    actionType: string,
    data: CompleteReturnResolutionInput,
    resolutionPreview: any
  ) {
    if (request.requestedresolution !== 'replacement') {
      return;
    }

    const stock = resolutionPreview?.replacementStock;
    const hasEnoughStock = Boolean(stock?.hasEnoughStock);
    if (actionType === 'replacement_shipment' && !hasEnoughStock) {
      throw new ValidationError(
        'Replacement stock unavailable',
        'Use refund with stock fallback for this replacement request, or replenish stock before shipping a replacement'
      );
    }

    if (actionType === 'refund' && data.stock_fallback_applied && hasEnoughStock) {
      throw new ValidationError(
        'Replacement stock is available',
        'Stock fallback refund can only be used when replacement stock is unavailable'
      );
    }

    if (actionType === 'refund' && resolutionPreview?.stockFallbackRequired && !data.stock_fallback_applied) {
      throw new ValidationError(
        'Stock fallback confirmation required',
        'Confirm stock_fallback_applied when refunding a replacement request because stock is unavailable'
      );
    }
  }

  private isClosureReady(request: any, actionType?: string | null) {
    if (!actionType || actionType === 'manual_review' || TERMINAL_REQUEST_STATUSES.has(request.status)) {
      return false;
    }

    const inspectionRequired = ['refund', 'replacement_shipment'].includes(actionType)
      && !['partial_refund', 'ship_missing_item'].includes(request.requestedresolution || '');

    if (inspectionRequired) {
      return request.status === 'inspection_approved';
    }

    return ['approved', 'evidence_approved', 'inspection_approved'].includes(request.status);
  }

  private validateClosureReadiness(request: any, actionType: string) {
    if (TERMINAL_REQUEST_STATUSES.has(request.status)) {
      throw new ValidationError(
        'Return request is already terminal',
        `Current status ${request.status} cannot be closed again`
      );
    }

    const inspectionRequired = ['refund', 'replacement_shipment'].includes(actionType)
      && !['partial_refund', 'ship_missing_item'].includes(request.requestedresolution || '');

    if (inspectionRequired && request.status !== 'inspection_approved') {
      throw new ValidationError(
        'Warehouse approval is required before closure',
        'Refunds and replacement shipments that require physical return must be closed after approved warehouse inspection'
      );
    }

    if (!inspectionRequired && !['approved', 'evidence_approved', 'inspection_approved'].includes(request.status)) {
      throw new ValidationError(
        'Return request is not ready for closure',
        'Missing-item shipment and partial-refund closure require an approved request'
      );
    }
  }

  private calculateClosureRefundAmount(request: any, data: CompleteReturnResolutionInput) {
    const requestedQuantity = Math.max(1, Number(request.requestedquantity || 1));
    const orderlineQuantity = Math.max(1, Number(request.orderline?.quantity || requestedQuantity));
    const linePaidAmount = positiveNumber(
      request.orderline?.orderamount,
      positiveNumber(request.orderline?.productamount, positiveNumber(request.order?.orderamount, 0))
    );
    const defaultRefundAmount = Number(((linePaidAmount / orderlineQuantity) * requestedQuantity).toFixed(2));

    if (data.amount !== undefined) {
      const suppliedAmount = Number(data.amount.toFixed(2));
      if (defaultRefundAmount > 0 && suppliedAmount > defaultRefundAmount) {
        throw new ValidationError(
          'Refund amount exceeds paid item value',
          `Maximum refundable amount for this request is ${defaultRefundAmount}`
        );
      }
      return suppliedAmount;
    }

    if (data.action_type === 'partial_refund') {
      throw new ValidationError(
        'Partial refund amount required',
        'Enter the approved partial refund amount'
      );
    }

    if (defaultRefundAmount <= 0) {
      throw new ValidationError(
        'Refund amount unavailable',
        'Paid orderline amount is missing; enter the approved refund amount manually'
      );
    }

    return defaultRefundAmount;
  }

  private calculateFulfilmentShipmentAmount(request: any) {
    const requestedQuantity = Math.max(1, Number(request.requestedquantity || 1));
    const orderlineQuantity = Math.max(1, Number(request.orderline?.quantity || requestedQuantity));
    const lineAmount = positiveNumber(
      request.orderline?.orderamount,
      positiveNumber(
        request.orderline?.productamount,
        positiveNumber(request.orderline?.product?.price, positiveNumber(request.order?.orderamount, 0))
      )
    );

    if (lineAmount <= 0) return null;
    return Number(((lineAmount / orderlineQuantity) * requestedQuantity).toFixed(2));
  }

  private mapFulfilmentShipmentStatusToOrderStatus(status: string) {
    return ['shipped', 'in_transit', 'out_for_delivery', 'delivered'].includes(status)
      ? status
      : null;
  }

  private parseStatusHistory(value: unknown): any[] {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    return [];
  }

  private buildFulfilmentOrderStatusHistory(
    existingHistory: unknown,
    previousStatus: string | null | undefined,
    nextStatus: string,
    eventTimeMs: number,
    event: {
      trackingId?: string | null;
      provider?: string | null;
      remarks?: string | null;
      recordedBy?: number | null;
    }
  ) {
    if (previousStatus === nextStatus) {
      return this.parseStatusHistory(existingHistory);
    }

    const deactivatedHistory = this.parseStatusHistory(existingHistory).map((entry) => ({
      ...entry,
      is_active: false,
    }));

    return [
      ...deactivatedHistory,
      {
        previous_status: previousStatus || 'unknown',
        new_status: nextStatus,
        changed_date: eventTimeMs,
        source: 'return_fulfilment',
        inventory_user_id: event.recordedBy || null,
        tracking_id: event.trackingId || null,
        provider: event.provider || null,
        description: event.remarks || null,
        is_active: true,
      },
    ];
  }

  private async syncReplacementFulfilmentOrderStatus(
    _tx: any,
    request: any,
    action: any,
    event: {
      status: string;
      trackingId?: string | null;
      provider?: string | null;
      remarks?: string | null;
      eventTimeSeconds: number;
      recordedBy?: number | null;
    }
  ) {
    if (action.actionType !== 'replacement_shipment') {
      return;
    }

    const orderStatus = this.mapFulfilmentShipmentStatusToOrderStatus(event.status);
    if (!orderStatus) {
      return;
    }

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        originalOrderId: request.orderid,
        fulfilmentOrderStatus: orderStatus,
        shipmentStatus: event.status,
      },
      'Replacement fulfilment shipment is tracked on the return request; original order status is retained'
    );
  }

  private getReplacementAllocationReference(request: any) {
    return `REPL-${request.requestnumber}`;
  }

  private getReplacementAllocationLineReference(request: any) {
    return `REPL-${request.requestnumber}-1`;
  }

  private getLegacyReplacementOrderReference(request: any) {
    return `REP-${request.requestnumber}`;
  }

  private calculateReplacementOrderFinancials(request: any, quantity: number) {
    const requestedQuantity = Math.max(1, Math.trunc(quantity || request.requestedquantity || 1));
    const orderlineQuantity = Math.max(1, Number(request.orderline?.quantity || requestedQuantity));
    const productUnitPrice = positiveNumber(request.orderline?.product?.price, 0);
    const roundMoney = (value: number) => Number(value.toFixed(2));
    const proratePositive = (value: unknown) => {
      const amount = positiveNumber(value, 0);
      return amount > 0 ? roundMoney((amount / orderlineQuantity) * requestedQuantity) : 0;
    };
    const nullableProrate = (value: unknown) => {
      const amount = proratePositive(value);
      return amount > 0 ? amount : null;
    };

    const productAmount = proratePositive(request.orderline?.productamount)
      || (productUnitPrice > 0 ? roundMoney(productUnitPrice * requestedQuantity) : 0);
    const discountAmount = proratePositive(request.orderline?.discountamount);
    const orderAmount = proratePositive(request.orderline?.orderamount)
      || Math.max(0, roundMoney(productAmount - discountAmount));
    const originalPrice = positiveNumber(request.orderline?.original_price, productUnitPrice) || null;

    return {
      orderAmount,
      productAmount,
      discountAmount,
      originalTotal: productAmount,
      originalPrice,
      productDiscountAmount: proratePositive(request.orderline?.product_discount_amount),
      promotionDiscountAmount: proratePositive(request.orderline?.promotion_discount_amount),
      hsnCode: firstText(request.orderline?.hsn_code) || null,
      gstRate: numberFromUnknown(request.orderline?.gst_rate),
      taxableAmount: nullableProrate(request.orderline?.taxable_amount),
      cgstAmount: nullableProrate(request.orderline?.cgst_amount),
      sgstAmount: nullableProrate(request.orderline?.sgst_amount),
      igstAmount: nullableProrate(request.orderline?.igst_amount),
      totalGstAmount: nullableProrate(request.orderline?.total_gst_amount),
    };
  }

  private getClosureRequestStatus(actionType: string, actionStatus: string) {
    if (actionType === 'refund' || actionType === 'partial_refund') {
      return actionStatus === 'completed' ? 'refund_completed' : 'refund_pending';
    }
    if (actionType === 'replacement_shipment') {
      return actionStatus === 'completed' ? 'replacement_shipped' : 'replacement_pending';
    }
    if (actionType === 'missing_item_shipment') {
      return actionStatus === 'completed' ? 'missing_item_shipped' : 'missing_item_pending';
    }
    return 'completed';
  }

  private isAttachmentRequired(attachmentType: string, reasonRule: any) {
    if (!reasonRule) {
      return false;
    }

    return getEvidenceRules(reasonRule).some(
      (rule) => rule.type === normalizeEvidenceAttachmentType(attachmentType) && rule.required && rule.minimum > 0
    );
  }

  private validateRequestAccess(request: any, authUser?: AuthUser) {
    if (authUser?.userType === 'ecommerce' && request.customerid !== authUser.id) {
      throw new ValidationError('Return request does not belong to customer', 'Customers can only update their own return requests');
    }
  }

  private normalizeRefundProcessingStatus(status: string) {
    const normalized = String(status || '').trim().toLowerCase();
    if (['completed', 'complete', 'success', 'successful', 'payment_success', 'refund_success'].includes(normalized)) {
      return 'completed';
    }
    if (['failed', 'failure', 'error', 'payment_failed', 'refund_failed'].includes(normalized)) {
      return 'failed';
    }
    if (['cancelled', 'canceled'].includes(normalized)) {
      return 'cancelled';
    }
    if (['processing', 'process', 'initiated', 'pending'].includes(normalized)) {
      return normalized === 'processing' ? 'processing' : 'pending';
    }
    return 'pending';
  }

  private async applyRefundStatusUpdate(
    request: any,
    action: any,
    data: {
      status: string;
      eventTime?: number | null | undefined;
      remarks?: string | null | undefined;
      metadata?: Record<string, unknown> | null | undefined;
      authUser?: AuthUser | undefined;
      source: 'admin' | 'payment_gateway';
    }
  ) {
    if (!REFUND_ACTIONS.has(action.actionType)) {
      throw new ValidationError('Resolution action is not a refund', 'Only refund or partial-refund actions can receive refund status updates');
    }

    const normalizedStatus = this.normalizeRefundProcessingStatus(data.status);
    let actionStatus = normalizedStatus === 'processing' ? 'pending' : normalizedStatus;
    const alreadyCompleted = action.status === 'completed' || request.status === 'refund_completed';
    if (alreadyCompleted && actionStatus !== 'completed') {
      actionStatus = 'completed';
    }

    const nextRequestStatus = actionStatus === 'completed' ? 'refund_completed' : 'refund_pending';
    const currentRequestStatus = request.status;
    const timestamp = epochSeconds(data.eventTime);
    const metadata = (action.metadata && typeof action.metadata === 'object' && !Array.isArray(action.metadata))
      ? { ...(action.metadata as Record<string, unknown>) }
      : {};
    const refundStatusHistory = Array.isArray((metadata as any).refundStatusHistory)
      ? [...((metadata as any).refundStatusHistory as unknown[])]
      : [];
    const refundEvent = {
      status: normalizedStatus,
      actionStatus,
      source: data.source,
      reference: action.externalReference || null,
      remarks: data.remarks || null,
      eventTime: timestamp,
      recordedBy: data.authUser?.id || null,
      metadata: data.metadata || {},
    };
    const nextMetadata = {
      ...metadata,
      latestRefundStatus: normalizedStatus,
      latestRefundStatusAt: timestamp,
      latestRefundRemarks: data.remarks || null,
      latestRefundSource: data.source,
      refundStatusHistory: [...refundStatusHistory, refundEvent],
    };
    const eventType = actionStatus === 'completed'
      ? 'refund_completed'
      : actionStatus === 'failed' || actionStatus === 'cancelled'
        ? 'refund_exception'
        : 'refund_progress';

    await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`
        UPDATE "return_resolution_actions"
        SET
          "status" = ${actionStatus},
          "metadata" = ${JSON.stringify(toJsonSafe(nextMetadata))}::jsonb,
          "modifieddate" = ${timestamp},
          "completed_by" = CASE
            WHEN ${actionStatus} = 'completed' THEN COALESCE(${data.authUser?.id || null}, "completed_by")
            ELSE "completed_by"
          END,
          "completeddate" = CASE
            WHEN ${actionStatus} = 'completed' THEN COALESCE("completeddate", ${timestamp})
            ELSE "completeddate"
          END
        WHERE "id" = ${action.id}
          AND "return_request_id" = ${request.id}
      `;

      if (nextRequestStatus !== currentRequestStatus) {
        await tx.$executeRaw`
          UPDATE "return_requests"
          SET
            "status" = ${nextRequestStatus},
            "modifiedby" = COALESCE(${data.authUser?.id || null}, "modifiedby"),
            "modifieddate" = ${timestamp}
          WHERE "id" = ${request.id}
        `;
      }

      await this.recordStatusTimeline(tx, {
        returnRequestId: request.id,
        previousStatus: currentRequestStatus,
        status: nextRequestStatus,
        eventType,
        authUser: data.authUser,
        message: actionStatus === 'completed'
          ? RETURN_STATUS_MESSAGES.refund_completed
          : `Refund ${normalizedStatus.replace(/_/g, ' ')}`,
        metadata: {
          resolutionActionId: action.id,
          actionType: action.actionType,
          refundStatus: normalizedStatus,
          actionStatus,
          refundMethod: action.refundMethod || null,
          externalReference: action.externalReference || null,
          amount: action.amount || null,
          source: data.source,
          remarks: data.remarks || null,
          requestStatusChanged: nextRequestStatus !== currentRequestStatus,
          ...(data.metadata || {}),
        },
        timestamp,
      });

      if (actionStatus === 'completed') {
        const creditNote = await this.createCreditNoteRecord(tx, request, {
          ...action,
          status: actionStatus,
        }, {
          status: 'issued',
          metadata: {
            autoCreated: true,
            source: 'refund_status_update',
          },
          notes: 'Auto-created from completed refund status.',
        }, data.authUser, {
          autoSkipWithoutGst: true,
          suppressTimeline: false,
        });

        await invoiceAdjustmentService.recordReturnResolution(request, {
          ...action,
          status: actionStatus,
        }, {
          creditNote,
          gstReversalApplicable: Boolean(creditNote),
          actorId: data.authUser?.id || null,
          database: tx,
        });
      }
    });

    logger.info(
      {
        returnRequestId: request.id,
        requestNumber: request.requestnumber,
        resolutionActionId: action.id,
        actionType: action.actionType,
        refundStatus: normalizedStatus,
        actionStatus,
        previousStatus: currentRequestStatus,
        nextRequestStatus,
        source: data.source,
        actorId: data.authUser?.id || null,
      },
      'Return refund status saved'
    );

    const refundNotificationStatus = actionStatus === 'failed'
      ? 'refund_failed'
      : actionStatus === 'cancelled'
        ? 'refund_cancelled'
        : nextRequestStatus;
    await this.notifyCustomerReturnStatus(request, refundNotificationStatus, {
      amount: action.amount,
    });
  }

  private async recordStatusTimeline(
    database: any,
    data: {
      returnRequestId: number;
      previousStatus?: string | null | undefined;
      status: string;
      eventType: string;
      authUser?: AuthUser | undefined;
      message?: string | null | undefined;
      metadata?: Record<string, unknown> | null | undefined;
      timestamp?: number | undefined;
    }
  ) {
    const timestamp = data.timestamp || nowSeconds();
    await database.$executeRaw`
      INSERT INTO "return_status_timeline" (
        "return_request_id",
        "previous_status",
        "status",
        "event_type",
        "actor_type",
        "actor_id",
        "message",
        "metadata",
        "createddate"
      ) VALUES (
        ${data.returnRequestId},
        ${data.previousStatus || null},
        ${data.status},
        ${data.eventType},
        ${data.authUser?.userType || 'system'},
        ${data.authUser?.id || null},
        ${data.message || RETURN_STATUS_MESSAGES[data.status] || data.status},
        ${JSON.stringify(toJsonSafe(data.metadata || {}))}::jsonb,
        ${timestamp}
      )
    `;
  }

  private async recordEvidenceAttachmentTimeline(
    request: any,
    data: {
      eventType: string;
      authUser?: AuthUser | undefined;
      message: string;
      metadata?: Record<string, unknown> | null | undefined;
      timestamp?: number | undefined;
    }
  ) {
    await this.recordStatusTimeline(prisma, {
      returnRequestId: request.id,
      previousStatus: request.status,
      status: request.status,
      eventType: data.eventType,
      authUser: data.authUser,
      message: data.message,
      metadata: {
        requestNumber: request.requestnumber,
        statusUnchanged: true,
        ...(data.metadata || {}),
      },
      timestamp: data.timestamp || nowSeconds(),
    });
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
      return requests.map((request) => ({ ...request, inspections: [], resolutionActions: [], creditNotes: [], invoiceAdjustments: [], statusTimeline: [] }));
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

    const resolutionActions = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        "id",
        "return_request_id",
        "action_type",
        "status",
        "amount",
        "refund_method",
        "external_reference",
        "shipment_tracking_id",
        "shipment_provider",
        "quantity",
        "stock_fallback_applied",
        "no_reverse_charge_deduction",
        "metadata",
        "notes",
        "created_by",
        "completed_by",
        "createddate",
        "modifieddate",
        "completeddate"
      FROM "return_resolution_actions"
      WHERE "return_request_id" IN (${requestIds.join(',')})
      ORDER BY "createddate" DESC NULLS LAST, "id" DESC
    `);

    const creditNotes = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        "id",
        "credit_note_number",
        "return_request_id",
        "resolution_action_id",
        "original_order_id",
        "original_order_number",
        "original_invoice_number",
        "original_invoice_url",
        "reason_code",
        "resolution",
        "quantity",
        "refund_amount",
        "taxable_amount",
        "gst_rate",
        "cgst_amount",
        "sgst_amount",
        "igst_amount",
        "total_gst_amount",
        "hsn_code",
        "status",
        "metadata",
        "notes",
        "created_by",
        "issued_by",
        "createddate",
        "modifieddate",
        "issueddate"
      FROM "return_credit_notes"
      WHERE "return_request_id" IN (${requestIds.join(',')})
      ORDER BY "createddate" DESC NULLS LAST, "id" DESC
    `);

    const invoiceAdjustments = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        "id",
        "adjustment_number",
        "adjustment_type",
        "source_action",
        "status",
        "order_id",
        "order_number",
        "return_request_id",
        "resolution_action_id",
        "original_invoice_number",
        "original_invoice_url",
        to_jsonb("invoice_adjustments") ->> 'adjustment_invoice_url' AS "adjustment_invoice_url",
        "original_invoice_amount",
        "remaining_amount",
        "reversed_amount",
        "credit_note_id",
        "credit_note_number",
        "gst_reversal_applicable",
        "metadata",
        "notes",
        "created_by",
        "createddate",
        "modifieddate"
      FROM "invoice_adjustments"
      WHERE "return_request_id" IN (${requestIds.join(',')})
      ORDER BY "createddate" DESC NULLS LAST, "id" DESC
    `);

    const statusTimeline = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        "id",
        "return_request_id",
        "previous_status",
        "status",
        "event_type",
        "actor_type",
        "actor_id",
        "message",
        "metadata",
        "createddate"
      FROM "return_status_timeline"
      WHERE "return_request_id" IN (${requestIds.join(',')})
      ORDER BY "createddate" ASC NULLS FIRST, "id" ASC
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

    const resolutionActionsByRequestId = new Map<number, any[]>();
    resolutionActions.forEach((action) => {
      const returnRequestId = Number(action.return_request_id);
      const mappedAction = {
        id: action.id,
        returnRequestId,
        actionType: action.action_type,
        status: action.status,
        amount: action.amount === null || action.amount === undefined ? null : Number(action.amount),
        refundMethod: action.refund_method,
        externalReference: action.external_reference,
        shipmentTrackingId: action.shipment_tracking_id,
        shipmentProvider: action.shipment_provider,
        quantity: action.quantity,
        stockFallbackApplied: action.stock_fallback_applied,
        noReverseChargeDeduction: action.no_reverse_charge_deduction,
        metadata: action.metadata,
        notes: action.notes,
        createdBy: action.created_by,
        completedBy: action.completed_by,
        createddate: action.createddate,
        modifieddate: action.modifieddate,
        completeddate: action.completeddate,
      };

      const existing = resolutionActionsByRequestId.get(returnRequestId) || [];
      existing.push(mappedAction);
      resolutionActionsByRequestId.set(returnRequestId, existing);
    });

    const creditNotesByRequestId = new Map<number, any[]>();
    creditNotes.forEach((creditNote) => {
      const returnRequestId = Number(creditNote.return_request_id);
      const mappedCreditNote = {
        id: creditNote.id,
        creditNoteNumber: creditNote.credit_note_number,
        returnRequestId,
        resolutionActionId: creditNote.resolution_action_id,
        originalOrderId: creditNote.original_order_id,
        originalOrderNumber: creditNote.original_order_number,
        originalInvoiceNumber: creditNote.original_invoice_number,
        originalInvoiceUrl: creditNote.original_invoice_url,
        reasonCode: creditNote.reason_code,
        resolution: creditNote.resolution,
        quantity: creditNote.quantity,
        refundAmount: Number(creditNote.refund_amount),
        taxableAmount: creditNote.taxable_amount === null || creditNote.taxable_amount === undefined ? null : Number(creditNote.taxable_amount),
        gstRate: creditNote.gst_rate === null || creditNote.gst_rate === undefined ? null : Number(creditNote.gst_rate),
        cgstAmount: creditNote.cgst_amount === null || creditNote.cgst_amount === undefined ? null : Number(creditNote.cgst_amount),
        sgstAmount: creditNote.sgst_amount === null || creditNote.sgst_amount === undefined ? null : Number(creditNote.sgst_amount),
        igstAmount: creditNote.igst_amount === null || creditNote.igst_amount === undefined ? null : Number(creditNote.igst_amount),
        totalGstAmount: creditNote.total_gst_amount === null || creditNote.total_gst_amount === undefined ? null : Number(creditNote.total_gst_amount),
        hsnCode: creditNote.hsn_code,
        status: creditNote.status,
        metadata: creditNote.metadata,
        notes: creditNote.notes,
        createdBy: creditNote.created_by,
        issuedBy: creditNote.issued_by,
        createddate: creditNote.createddate,
        modifieddate: creditNote.modifieddate,
        issueddate: creditNote.issueddate,
      };

      const existing = creditNotesByRequestId.get(returnRequestId) || [];
      existing.push(mappedCreditNote);
      creditNotesByRequestId.set(returnRequestId, existing);
    });

    const statusTimelineByRequestId = new Map<number, any[]>();
    statusTimeline.forEach((entry) => {
      const returnRequestId = Number(entry.return_request_id);
      const mappedEntry = {
        id: entry.id,
        returnRequestId,
        previousStatus: entry.previous_status,
        status: entry.status,
        eventType: entry.event_type,
        actorType: entry.actor_type,
        actorId: entry.actor_id,
        message: entry.message,
        metadata: entry.metadata,
        createddate: entry.createddate,
      };

      const existing = statusTimelineByRequestId.get(returnRequestId) || [];
      existing.push(mappedEntry);
      statusTimelineByRequestId.set(returnRequestId, existing);
    });

    const invoiceAdjustmentsByRequestId = new Map<number, any[]>();
    invoiceAdjustments.forEach((adjustment) => {
      const returnRequestId = Number(adjustment.return_request_id);
      const mappedAdjustment = {
        id: adjustment.id,
        adjustmentNumber: adjustment.adjustment_number,
        adjustmentType: adjustment.adjustment_type,
        sourceAction: adjustment.source_action,
        status: adjustment.status,
        orderId: adjustment.order_id,
        orderNumber: adjustment.order_number,
        returnRequestId,
        resolutionActionId: adjustment.resolution_action_id,
        originalInvoiceNumber: adjustment.original_invoice_number,
        originalInvoiceUrl: adjustment.original_invoice_url,
        adjustmentInvoiceUrl: adjustment.adjustment_invoice_url,
        originalInvoiceAmount: adjustment.original_invoice_amount === null || adjustment.original_invoice_amount === undefined ? null : Number(adjustment.original_invoice_amount),
        remainingAmount: adjustment.remaining_amount === null || adjustment.remaining_amount === undefined ? null : Number(adjustment.remaining_amount),
        reversedAmount: adjustment.reversed_amount === null || adjustment.reversed_amount === undefined ? null : Number(adjustment.reversed_amount),
        creditNoteId: adjustment.credit_note_id,
        creditNoteNumber: adjustment.credit_note_number,
        gstReversalApplicable: adjustment.gst_reversal_applicable,
        metadata: adjustment.metadata,
        notes: adjustment.notes,
        createdBy: adjustment.created_by,
        createddate: adjustment.createddate,
        modifieddate: adjustment.modifieddate,
      };

      const existing = invoiceAdjustmentsByRequestId.get(returnRequestId) || [];
      existing.push(mappedAdjustment);
      invoiceAdjustmentsByRequestId.set(returnRequestId, existing);
    });

    return requests.map((request) => ({
      ...request,
      inspections: inspectionsByRequestId.get(Number(request.id)) || [],
      resolutionActions: resolutionActionsByRequestId.get(Number(request.id)) || [],
      creditNotes: creditNotesByRequestId.get(Number(request.id)) || [],
      invoiceAdjustments: invoiceAdjustmentsByRequestId.get(Number(request.id)) || [],
      statusTimeline: statusTimelineByRequestId.get(Number(request.id)) || [],
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
        const ecompublishVal = action.stockstatus === 'available' ? true : false;
        const availableIncrement = action.stockstatus === 'available' ? 1 : 0;
        const damagedIncrement = action.stockstatus === 'damaged' ? 1 : 0;
        await tx.$executeRaw`
          UPDATE "stock"
          SET
            "stockstatus" = ${action.stockstatus},
            "ecompublish" = ${ecompublishVal},
            "orderid" = NULL,
            "orderlinenumber" = NULL,
            "solddate" = NULL,
            "modifieddate" = ${modifiedDate}
          WHERE "id" = ${stock.id}
        `;

        await tx.$executeRaw`
          UPDATE "product"
          SET
            "quantity" = COALESCE("quantity", 0) + 1,
            "soldquantity" = GREATEST(0, COALESCE("soldquantity", 0) - 1),
            "availablequantity" = COALESCE("availablequantity", 0) + ${availableIncrement},
            "ecompublishedquantity" = COALESCE("ecompublishedquantity", 0) + ${availableIncrement},
            "damagedquantity" = COALESCE("damagedquantity", 0) + ${damagedIncrement},
            "modifieddate" = ${modifiedDate}
          WHERE "puc" = ${stock.puc}
        `;

        await tx.$executeRaw`
          UPDATE "platformstock" AS ps
          SET
            "soldqty" = GREATEST(0, COALESCE(ps."soldqty", 0) - 1),
            "availableqty" = COALESCE(ps."availableqty", 0) + ${availableIncrement},
            "ecomqty" = COALESCE(ps."ecomqty", 0) + ${availableIncrement},
            "damagedqty" = COALESCE(ps."damagedqty", 0) + ${damagedIncrement},
            "modifieddate" = ${modifiedDate}
          FROM "product" AS p
          WHERE ps."productid" = p."id"
            AND p."puc" = ${stock.puc}
            AND LOWER(ps."platform") = LOWER(${stock.platform})
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

  private async moveRejectedInspectionStockToOnHold(
    tx: any,
    request: any,
    rejectedQuantity: number,
    modifiedDate: bigint
  ) {
    const orderStockId = request.order?.orderid || (request.orderid ? String(request.orderid) : null);
    const orderlineNumber = request.orderline?.orderlinenumber;

    if (!orderStockId || !orderlineNumber) {
      throw new ValidationError(
        'Rejected return stock allocation not found',
        'Rejected inspection requires an order number and orderline number to move stock to On Hold'
      );
    }

    if (!Number.isFinite(rejectedQuantity) || rejectedQuantity <= 0) {
      return [];
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
      LIMIT ${rejectedQuantity}
    `;

    if (!Array.isArray(stocks) || stocks.length < rejectedQuantity) {
      throw new ValidationError(
        'Insufficient sold stock allocated to rejected return',
        `Required ${rejectedQuantity} stock item(s) for On Hold, found ${stocks?.length || 0}`
      );
    }

    const movements: Array<Record<string, any>> = [];
    for (const stock of stocks) {
      await tx.$executeRaw`
        UPDATE "stock"
        SET
          "stockstatus" = 'on_hold',
          "ecompublish" = false,
          "orderid" = NULL,
          "orderlinenumber" = NULL,
          "solddate" = NULL,
          "modifieddate" = ${modifiedDate}
        WHERE "id" = ${stock.id}
      `;

      await tx.$executeRaw`
        UPDATE "product"
        SET
          "quantity" = COALESCE("quantity", 0) + 1,
          "soldquantity" = GREATEST(0, COALESCE("soldquantity", 0) - 1),
          "modifieddate" = ${modifiedDate}
        WHERE "puc" = ${stock.puc}
      `;

      await tx.$executeRaw`
        UPDATE "platformstock" AS ps
        SET
          "soldqty" = GREATEST(0, COALESCE(ps."soldqty", 0) - 1),
          "modifieddate" = ${modifiedDate}
        FROM "product" AS p
        WHERE ps."productid" = p."id"
          AND p."puc" = ${stock.puc}
          AND LOWER(ps."platform") = LOWER(${stock.platform})
      `;

      movements.push({
        stockId: stock.id,
        puc: stock.puc,
        platform: stock.platform,
        fromStatus: stock.stockstatus,
        toStatus: 'on_hold',
        restockAction: 'on_hold',
      });
    }

    return movements;
  }

  private async notifyWarehouseInspectionRejected(request: any, reason?: string | null) {
    try {
      await this.customerNotificationService.notifyReturnInspectionRejected({
        userId: request.customerid,
        orderId: request.orderid || request.order?.id,
        orderNumber: request.order?.orderid || (request.orderid ? String(request.orderid) : null),
        returnRequestNumber: request.requestnumber,
        reason,
      });
    } catch (error: any) {
      logger.warn(
        {
          error: error?.message || 'Unknown error',
          returnRequestId: request.id,
          requestNumber: request.requestnumber,
          customerId: request.customerid,
        },
        'Failed to send warehouse inspection rejection notification'
      );
    }
  }

  private async notifyCustomerReturnStatus(
    request: any,
    status: string,
    options: {
      trackingId?: string | null | undefined;
      amount?: unknown;
    } = {}
  ) {
    if (!request || request.requesttype === 'rto' || request.source === 'delivery_partner' || !request.customerid) {
      return;
    }

    try {
      await this.customerNotificationService.notifyReturnStatus({
        userId: request.customerid,
        orderId: request.orderid || request.order?.id || request.orderline?.orderid,
        orderNumber: request.order?.orderid || request.orderline?.orders?.orderid || (request.orderid ? String(request.orderid) : null),
        returnRequestId: request.id,
        returnRequestNumber: request.requestnumber,
        status,
        requestType: request.requesttype,
        resolution: request.requestedresolution,
        reason: request.reason || request.reasoncode,
        trackingId: options.trackingId,
        amount: options.amount,
      });
    } catch (error: any) {
      logger.warn(
        {
          error: error?.message || 'Unknown error',
          returnRequestId: request.id,
          requestNumber: request.requestnumber,
          status,
          customerId: request.customerid,
        },
        'Failed to send return status notification'
      );
    }
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

  private validateCustomerReturnRequestForRefundStatusUpdate(request: any) {
    if (request.requesttype === 'rto' || request.source === 'delivery_partner') {
      throw new ValidationError(
        'Refund status update is not applicable to RTO',
        'RTO follows delivery-partner warehouse verification flow'
      );
    }

    if (!['refund_pending', 'refund_completed'].includes(request.status)) {
      throw new ValidationError(
        'Return request is not in refund flow',
        `Current status ${request.status} cannot be used for refund status update`
      );
    }
  }

  private validateCustomerReturnRequestForShipmentStatusUpdate(request: any) {
    if (request.requesttype === 'rto' || request.source === 'delivery_partner') {
      throw new ValidationError(
        'Fulfilment shipment status update is not applicable to RTO',
        'RTO follows delivery-partner warehouse verification flow'
      );
    }

    if (!['replacement_shipped', 'replacement_delivered', 'missing_item_shipped', 'completed'].includes(request.status)) {
      throw new ValidationError(
        'Return request is not in fulfilment shipment flow',
        `Current status ${request.status} cannot be used for fulfilment shipment status update`
      );
    }
  }

  private async getReasonRuleForRequest(request: any) {
    const snapshotRule = this.buildRuntimeReasonRuleFromSnapshot(request);
    if (snapshotRule) {
      return snapshotRule;
    }

    if (request.policyReasonRuleId) {
      const mapping = await this.policyReasonRuleService.findMappingById(request.policyReasonRuleId);
      if (mapping) {
        return this.buildRuntimeReasonRuleFromPolicyMapping(mapping);
      }
    }

    return (prisma as any).returnReasonRule.findFirst({
      where: {
        reasoncode: request.reasoncode,
      },
    });
  }

  private async refreshEvidenceStatus(
    requestId: number,
    options: {
      authUser?: AuthUser | undefined;
      reopenRejected?: boolean | undefined;
      eventReason?: string | undefined;
    } = {}
  ) {
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
    const counts = countAttachmentsByType(activeAttachments);
    const requiredRules = getEvidenceRules(reasonRule).filter((rule) => rule.required && rule.minimum > 0);
    const hasRequiredEvidence = requiredRules.every((rule) => (counts[rule.type] || 0) >= rule.minimum);
    const needsEvidence = requiredRules.length > 0;

    const updateData: Record<string, any> = {
      modifieddate: nowSeconds(),
    };
    const shouldReopenRejectedEvidence =
      Boolean(options.reopenRejected)
      && hasRequiredEvidence
      && (request.status === 'evidence_rejected' || request.evidenceReviewStatus === 'rejected');

    if (!needsEvidence) {
      updateData.evidenceReviewStatus = 'not_required';
    } else {
      updateData.evidenceReviewStatus = 'pending';
      if (shouldReopenRejectedEvidence) {
        updateData.status = 'requested';
        updateData.evidenceRejectionReason = null;
        updateData.evidenceReviewRemarks = null;
        updateData.evidenceReviewedBy = null;
        updateData.evidenceReviewedDate = null;
      }
    }

    const updated = await requestClient().update({
      where: { id: requestId },
      data: updateData,
    });

    if (shouldReopenRejectedEvidence && updated.status !== request.status) {
      const timestamp = nowSeconds();
      await this.recordStatusTimeline(prisma, {
        returnRequestId: request.id,
        previousStatus: request.status,
        status: updated.status,
        eventType: 'request_reopened',
        authUser: options.authUser,
        message: 'Request reopened for approval',
        metadata: {
          eventReason: options.eventReason || null,
          evidenceReviewStatus: updated.evidenceReviewStatus,
          requiredEvidenceSatisfied: hasRequiredEvidence,
          clearedPreviousRejection: true,
        },
        timestamp,
      });
    }
  }

  private async validateExistingEvidenceForApproval(request: any, reasonRule: any) {
    const activeAttachments = (request.attachments || []).filter((attachment: any) => attachment.status === 'active');
    const availableCounts: Record<string, number> = {};
    const unavailableAttachments: Array<{ id: number; type: string; message: string }> = [];

    await Promise.all(activeAttachments.map(async (attachment: any) => {
      try {
        await this.locateEvidenceFile(attachment.fileurl, false);
        const evidenceType = normalizeEvidenceAttachmentType(attachment.attachmenttype);
        availableCounts[evidenceType] = (availableCounts[evidenceType] || 0) + 1;
      } catch (error: any) {
        unavailableAttachments.push({
          id: attachment.id,
          type: normalizeEvidenceAttachmentType(attachment.attachmenttype),
          message: error?.message || 'Evidence file was not reachable',
        });
      }
    }));

    for (const rule of getEvidenceRules(reasonRule)) {
      if (!rule.required || rule.minimum <= 0) {
        continue;
      }

      const availableCount = availableCounts[rule.type] || 0;
      if (availableCount < rule.minimum) {
        const unavailableForType = unavailableAttachments.filter((attachment) => attachment.type === rule.type);
        throw new ValidationError(
          'Evidence files are not available',
          `${reasonRule.reasonname} requires ${rule.minimum} reachable ${rule.type.replace(/_/g, ' ')} file(s) before approval. Found ${availableCount}.${
            unavailableForType.length > 0
              ? ` Replace or repair attachment(s): ${unavailableForType.map((attachment) => `#${attachment.id}`).join(', ')}`
              : ''
          }`
        );
      }
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
