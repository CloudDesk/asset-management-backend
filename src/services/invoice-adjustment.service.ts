import { prisma } from '../models/prisma.js';
import { logger } from '../config/logger.js';
import { NotFoundError, ValidationError } from '../utils/errorHandler.js';
import axios from 'axios';

type DbClient = typeof prisma | any;

type CreditNoteLink = {
  id?: number | null;
  creditNoteNumber?: string | null;
  credit_note_number?: string | null;
};

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'object' && typeof (value as { toNumber?: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  const parsed = Number(String(value).replace(/[^0-9.-]+/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const roundCurrency = (value: number) =>
  Number((Math.round((value + Number.EPSILON) * 100) / 100).toFixed(2));

const toDecimalNumber = (value: unknown): number => roundCurrency(toNumber(value));

const jsonSafe = (value: unknown): unknown => {
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, jsonSafe(entry)])
    );
  }
  return value;
};

export class InvoiceAdjustmentService {
  async recordOrderCancellation(orderId: number, data: {
    actorId?: number | null;
    source?: string | null;
    database?: DbClient;
  } = {}) {
    const database = data.database || prisma;
    const order = await database.orders.findUnique({
      where: { id: orderId },
      include: { orderline: true },
    });

    if (!order) {
      logger.warn({ orderId }, 'Invoice adjustment skipped because order was not found');
      return null;
    }

    const orderlines = order.orderline || [];
    const totalLines = orderlines.length;
    const returnFlow = String(data.source || '').includes('return');
    const affectedStatus = returnFlow ? 'returned' : 'cancelled';
    const affectedLines = orderlines.filter((line: any) => line.orderstatus === affectedStatus);
    const fullCancellation = totalLines > 0 && affectedLines.length === totalLines;
    const reversedAmount = roundCurrency(
      (fullCancellation ? orderlines : affectedLines)
        .reduce((sum: number, line: any) => sum + toNumber(line.orderamount || line.productamount), 0)
    );
    const originalAmount = roundCurrency(toNumber(order.orderamount) || orderlines.reduce(
      (sum: number, line: any) => sum + toNumber(line.orderamount || line.productamount),
      0
    ));
    const remainingItems = fullCancellation
      ? []
      : orderlines.filter((line: any) => line.orderstatus !== affectedStatus);
    const remainingAmount = fullCancellation
      ? 0
      : roundCurrency(remainingItems.reduce((sum: number, line: any) => sum + toNumber(line.orderamount || line.productamount), 0));

    return this.upsertAdjustment(database, {
      adjustmentNumber: fullCancellation
        ? `IA-${returnFlow ? 'RETURN' : 'CANCEL'}-FULL-${order.id}`
        : `IA-${returnFlow ? 'RETURN' : 'CANCEL'}-OVERRIDE-${order.id}`,
      adjustmentType: fullCancellation ? 'invoice_cancellation' : 'invoice_override',
      sourceAction: fullCancellation
        ? (returnFlow ? 'full_return' : 'full_order_cancellation')
        : (returnFlow ? 'partial_return' : 'partial_cancellation'),
      status: fullCancellation ? 'cancelled' : 'issued',
      orderId: order.id,
      orderNumber: order.orderid,
      originalInvoiceNumber: order.orderid,
      originalInvoiceUrl: order.order_invoice_url,
      originalInvoiceAmount: originalAmount,
      remainingAmount,
      reversedAmount,
      gstReversalApplicable: false,
      metadata: {
        trigger: data.source || 'order_cancellation',
        originalInvoiceRetained: true,
        totalLines,
        affectedStatus,
        affectedLines: affectedLines.length,
        remainingItems: remainingItems.map((line: any) => this.mapLine(line)),
        reversedItems: (fullCancellation ? orderlines : affectedLines).map((line: any) => this.mapLine(line)),
      },
      notes: fullCancellation
        ? `${returnFlow ? 'Full return completed' : 'Full invoiced order cancelled'}; original invoice retained for audit.`
        : `Partial ${returnFlow ? 'return' : 'order cancellation'}; override invoice represents remaining active items.`,
      createdBy: data.actorId || null,
    });
  }

  async recordReturnResolution(request: any, action: any, data: {
    creditNote?: CreditNoteLink | null;
    gstReversalApplicable?: boolean;
    actorId?: number | null;
    database?: DbClient;
  } = {}) {
    const database = data.database || prisma;
    const order = request.order || request.orderline?.orders;
    const orderId = Number(request.orderid || order?.id || request.orderline?.orderid || 0);

    if (!orderId) {
      logger.warn({ returnRequestId: request.id }, 'Invoice adjustment skipped because return request has no order');
      return null;
    }

    const orderlines = await database.orderline.findMany({ where: { orderid: orderId } });
    const targetOrderlineId = Number(request.orderlineid || request.orderline?.id || 0);
    const targetLine = orderlines.find((line: any) => Number(line.id) === targetOrderlineId) || request.orderline || {};
    const requestedQuantity = Math.max(1, Math.trunc(Number(action.quantity || request.requestedquantity || 1)));
    const targetLineQuantity = Math.max(1, Math.trunc(Number(targetLine.quantity || 1)));
    const targetLineAmount = toNumber(targetLine.orderamount || targetLine.productamount || action.amount);
    const reversedAmount = roundCurrency(toNumber(action.amount) || Math.min(1, requestedQuantity / targetLineQuantity) * targetLineAmount);
    const originalAmount = roundCurrency(toNumber(order?.orderamount) || orderlines.reduce(
      (sum: number, line: any) => sum + toNumber(line.orderamount || line.productamount),
      0
    ));

    const remainingItems = orderlines
      .map((line: any) => {
        const isReturnedLine = Number(line.id) === targetOrderlineId;
        if (!isReturnedLine) return this.mapLine(line);

        const remainingQuantity = Math.max(0, Number(line.quantity || 1) - requestedQuantity);
        if (remainingQuantity <= 0) return null;

        const quantityRatio = remainingQuantity / Math.max(1, Number(line.quantity || 1));
        return {
          ...this.mapLine(line),
          quantity: remainingQuantity,
          amount: roundCurrency(toNumber(line.orderamount || line.productamount) * quantityRatio),
        };
      })
      .filter(Boolean);
    const remainingAmount = roundCurrency(remainingItems.reduce((sum: number, line: any) => sum + toNumber((line as any).amount), 0));
    const fullReturn = remainingAmount <= 0;
    const creditNoteNumber = data.creditNote?.creditNoteNumber || data.creditNote?.credit_note_number || null;

    return this.upsertAdjustment(database, {
      adjustmentNumber: fullReturn
        ? `IA-RETURN-FULL-${request.id}-${action.id}`
        : `IA-RETURN-OVERRIDE-${request.id}-${action.id}`,
      adjustmentType: fullReturn ? 'invoice_cancellation' : 'invoice_override',
      sourceAction: fullReturn ? 'full_return' : 'partial_return',
      status: fullReturn ? 'cancelled' : 'issued',
      orderId,
      orderNumber: order?.orderid || targetLine.uniqueordderid || null,
      returnRequestId: request.id,
      resolutionActionId: action.id,
      originalInvoiceNumber: order?.orderid || targetLine.uniqueordderid || null,
      originalInvoiceUrl: order?.order_invoice_url || null,
      originalInvoiceAmount: originalAmount,
      remainingAmount,
      reversedAmount,
      creditNoteId: data.creditNote?.id || null,
      creditNoteNumber,
      gstReversalApplicable: Boolean(data.gstReversalApplicable),
      metadata: {
        returnRequestNumber: request.requestnumber,
        requestType: request.requesttype,
        requestedResolution: request.requestedresolution,
        originalInvoiceRetained: true,
        remainingItems,
        reversedItems: [{
          ...this.mapLine(targetLine),
          quantity: requestedQuantity,
          amount: reversedAmount,
        }],
      },
      notes: fullReturn
        ? 'Full return completed; original invoice retained and invoice marked cancelled for audit.'
        : 'Partial return completed; override invoice represents remaining active items.',
      createdBy: data.actorId || null,
    });
  }

  async generateAdjustmentInvoiceById(adjustmentId: number, data: {
    actorId?: number | null;
    database?: DbClient;
  } = {}) {
    if (!Number.isInteger(adjustmentId) || adjustmentId <= 0) {
      throw new ValidationError('Invalid invoice adjustment', 'A valid invoice adjustment ID is required');
    }

    const database = data.database || prisma;
    await this.ensureAdjustmentInvoiceUrlColumn(database);

    const rows = await database.$queryRaw<any[]>`
      SELECT *
      FROM "invoice_adjustments"
      WHERE "id" = ${adjustmentId}
      LIMIT 1
    `;
    const adjustment = rows[0] || null;

    if (!adjustment) {
      throw new NotFoundError('Invoice adjustment not found');
    }

    if (!['invoice_cancellation', 'invoice_override'].includes(adjustment.adjustment_type)) {
      throw new ValidationError(
        'Invoice adjustment PDF is not supported',
        'Only invoice cancellation and invoice override documents can be generated here'
      );
    }

    if (adjustment.adjustment_invoice_url) {
      return adjustment;
    }

    const adjustmentInvoiceUrl = await this.generateAdjustmentInvoicePdf(database, {
      adjustmentNumber: adjustment.adjustment_number,
      adjustmentType: adjustment.adjustment_type,
      sourceAction: adjustment.source_action,
      status: adjustment.status,
      orderId: adjustment.order_id,
      orderNumber: adjustment.order_number,
      remainingAmount: adjustment.remaining_amount,
      reversedAmount: adjustment.reversed_amount,
      metadata: adjustment.metadata || {},
    }, { throwOnFailure: true });

    if (!adjustmentInvoiceUrl) {
      throw new ValidationError(
        'Unable to generate return invoice PDF',
        'The invoice PDF service did not return a document URL'
      );
    }

    const updatedRows = await database.$queryRaw<any[]>`
      UPDATE "invoice_adjustments"
      SET
        "adjustment_invoice_url" = ${adjustmentInvoiceUrl},
        "modifieddate" = ${Date.now()}
      WHERE "id" = ${adjustmentId}
      RETURNING *
    `;

    logger.info(
      {
        adjustmentId,
        adjustmentNumber: adjustment.adjustment_number,
        actorId: data.actorId || null,
      },
      'Invoice adjustment PDF generated'
    );

    return updatedRows[0] || { ...adjustment, adjustment_invoice_url: adjustmentInvoiceUrl };
  }

  private async upsertAdjustment(database: DbClient, data: {
    adjustmentNumber: string;
    adjustmentType: string;
    sourceAction: string;
    status: string;
    orderId?: number | null;
    orderNumber?: string | null;
    returnRequestId?: number | null;
    resolutionActionId?: number | null;
    originalInvoiceNumber?: string | null;
    originalInvoiceUrl?: string | null;
    originalInvoiceAmount?: number | null;
    remainingAmount?: number | null;
    reversedAmount?: number | null;
    creditNoteId?: number | null;
    creditNoteNumber?: string | null;
    gstReversalApplicable?: boolean;
    metadata?: Record<string, unknown>;
    notes?: string | null;
    createdBy?: number | null;
  }) {
    const timestamp = Date.now();
    await this.ensureAdjustmentInvoiceUrlColumn(database);
    const rows = await database.$queryRaw<any[]>`
      INSERT INTO "invoice_adjustments" (
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
        "adjustment_invoice_url",
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
      ) VALUES (
        ${data.adjustmentNumber},
        ${data.adjustmentType},
        ${data.sourceAction},
        ${data.status},
        ${data.orderId || null},
        ${data.orderNumber || null},
        ${data.returnRequestId || null},
        ${data.resolutionActionId || null},
        ${data.originalInvoiceNumber || null},
        ${data.originalInvoiceUrl || null},
        ${null},
        ${data.originalInvoiceAmount ?? null},
        ${data.remainingAmount ?? null},
        ${data.reversedAmount ?? null},
        ${data.creditNoteId || null},
        ${data.creditNoteNumber || null},
        ${Boolean(data.gstReversalApplicable)},
        ${JSON.stringify(jsonSafe(data.metadata || {}))}::jsonb,
        ${data.notes || null},
        ${data.createdBy || null},
        ${timestamp},
        ${timestamp}
      )
      ON CONFLICT ("adjustment_number") DO UPDATE SET
        "status" = EXCLUDED."status",
        "original_invoice_url" = COALESCE("invoice_adjustments"."original_invoice_url", EXCLUDED."original_invoice_url"),
        "remaining_amount" = EXCLUDED."remaining_amount",
        "reversed_amount" = EXCLUDED."reversed_amount",
        "credit_note_id" = COALESCE(EXCLUDED."credit_note_id", "invoice_adjustments"."credit_note_id"),
        "credit_note_number" = COALESCE(EXCLUDED."credit_note_number", "invoice_adjustments"."credit_note_number"),
        "gst_reversal_applicable" = EXCLUDED."gst_reversal_applicable",
        "metadata" = EXCLUDED."metadata",
        "notes" = EXCLUDED."notes",
        "modifieddate" = EXCLUDED."modifieddate"
      RETURNING *
    `;

    let adjustment = rows[0] || null;
    if (adjustment && !adjustment.adjustment_invoice_url && ['invoice_cancellation', 'invoice_override'].includes(data.adjustmentType)) {
      const adjustmentInvoiceUrl = await this.generateAdjustmentInvoicePdf(database, data);
      if (adjustmentInvoiceUrl) {
        const updatedRows = await database.$queryRaw<any[]>`
          UPDATE "invoice_adjustments"
          SET
            "adjustment_invoice_url" = ${adjustmentInvoiceUrl},
            "modifieddate" = ${Date.now()}
          WHERE "id" = ${adjustment.id}
          RETURNING *
        `;
        adjustment = updatedRows[0] || { ...adjustment, adjustment_invoice_url: adjustmentInvoiceUrl };
      }
    }
    logger.info(
      {
        adjustmentNumber: data.adjustmentNumber,
        adjustmentType: data.adjustmentType,
        sourceAction: data.sourceAction,
        orderId: data.orderId,
        returnRequestId: data.returnRequestId,
      },
      'Invoice adjustment saved'
    );
    return adjustment;
  }

  private async ensureAdjustmentInvoiceUrlColumn(database: DbClient) {
    await database.$executeRawUnsafe(`
      ALTER TABLE "invoice_adjustments"
      ADD COLUMN IF NOT EXISTS "adjustment_invoice_url" VARCHAR(1000)
    `);
  }

  private async loadInvoiceAddress(database: DbClient, order: any) {
    const fallbackAddress = {
      name: '-',
      mobilenumber: '-',
      pincode: '-',
      doornumber: '',
      address: '-',
      landmark: '',
      state: '',
      city: '',
    };

    const addressId = Number(order?.addressid || 0);
    let resolvedAddressId = Number.isInteger(addressId) && addressId > 0 ? addressId : 0;

    if (!resolvedAddressId && order?.id) {
      const orderlines = await database.orderline.findMany({
        where: { orderid: Number(order.id) },
        take: 1,
      });
      resolvedAddressId = Number(orderlines[0]?.addressid || 0);
    }

    if (!resolvedAddressId) {
      return fallbackAddress;
    }

    const address = await database.address.findUnique({ where: { id: resolvedAddressId } });
    if (!address) {
      return fallbackAddress;
    }

    return {
      name: address.name || '-',
      mobilenumber: address.mobilenumber || '-',
      pincode: address.pincode || '-',
      doornumber: address.doornumber || (address as any).addressline1 || '',
      address: (address as any).addressline2 || address.address || '-',
      landmark: address.landmark || '',
      state: address.state || '',
      city: address.city || '',
    };
  }

  private async loadInvoiceSeller() {
    try {
      const { ekartService } = await import('./ekart.service.js');
      const addresses = await ekartService.getAddresses();
      return addresses && addresses.length > 0 ? addresses[0] : {};
    } catch (sellerError: any) {
      logger.warn({ error: sellerError.message }, 'Failed to fetch seller data for invoice adjustment PDF');
      return {
        alias: process.env.SELLER_NAME || 'Nivaana',
        address_line1: process.env.SELLER_ADDRESS || 'Chennai, Tamil Nadu, India',
        city: '',
        state: '',
        pincode: '',
        country: 'India',
        phone: process.env.SELLER_PHONE || '+91-1234567890',
      };
    }
  }

  private async generateAdjustmentInvoicePdf(database: DbClient, data: {
    adjustmentNumber: string;
    adjustmentType: string;
    sourceAction: string;
    status: string;
    orderId?: number | null;
    orderNumber?: string | null;
    remainingAmount?: number | null;
    reversedAmount?: number | null;
    metadata?: Record<string, unknown>;
  }, options: { throwOnFailure?: boolean } = {}): Promise<string | null> {
    try {
      if (!data.orderId) return null;

      const order = await database.orders.findUnique({ where: { id: data.orderId } });
      if (!order) return null;

      const metadata = data.metadata || {};
      const documentLines = data.adjustmentType === 'invoice_override'
        ? ((metadata.remainingItems as any[]) || [])
        : ((metadata.reversedItems as any[]) || []);
      const documentAmount = data.adjustmentType === 'invoice_override'
        ? toDecimalNumber(data.remainingAmount)
        : toDecimalNumber(data.reversedAmount);

      const orderlines = documentLines.map((line: any, index: number) => {
        const quantity = Math.max(1, Math.trunc(Number(line.quantity || 1)));
        const lineAmount = toDecimalNumber(line.amount);
        const gstRate = toDecimalNumber(line.gstRate);
        const taxableAmount = gstRate > 0 ? roundCurrency(lineAmount / (1 + gstRate / 100)) : lineAmount;
        const gstAmount = roundCurrency(lineAmount - taxableAmount);

        return {
          id: line.orderlineId || index + 1,
          orderlinenumber: line.orderlineNumber || `${data.adjustmentNumber}-${index + 1}`,
          productid: line.productId || null,
          productname: line.productName || 'Returned item',
          productcategory: '',
          quantity,
          original_price: quantity > 0 ? roundCurrency(lineAmount / quantity) : lineAmount,
          product_discount_amount: 0,
          promotion_discount_amount: 0,
          taxable_amount: taxableAmount,
          gst_rate: gstRate,
          total_gst_amount: gstAmount,
          orderamount: lineAmount,
          productamount: lineAmount,
        };
      });

      const address = await this.loadInvoiceAddress(database, order);
      const seller = await this.loadInvoiceSeller();

      const adjustedOrder = {
        ...order,
        id: order.id,
        orderid: data.adjustmentNumber,
        createddate: Date.now(),
        mode: order.mode || 'prepaid',
        transactionid: data.orderNumber || order.orderid || '-',
        items_total: documentAmount,
        shipping_cost: 0,
        total_taxable_amount: orderlines.reduce((sum: number, line: any) => sum + toNumber(line.taxable_amount), 0),
        total_gst_amount: orderlines.reduce((sum: number, line: any) => sum + toNumber(line.total_gst_amount), 0),
        orderamount: documentAmount,
      };

      const storageBackendUrl = process.env.STORAGE_BACKEND_URL || 'http://localhost:4500';
      const response = await axios.post(`${storageBackendUrl}/order/invoice`, {
        order: jsonSafe(adjustedOrder),
        orderlines: jsonSafe(orderlines),
        address: jsonSafe(address),
        seller: jsonSafe(seller),
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
      });

      return response.data?.invoiceUrl || null;
    } catch (error: any) {
      logger.error({
        error: error.message,
        response: error.response?.data,
        adjustmentNumber: data.adjustmentNumber,
        adjustmentType: data.adjustmentType,
      }, 'Failed to generate invoice adjustment PDF');
      if (options.throwOnFailure) {
        const details = error.response?.data?.error
          || error.response?.data?.message
          || error.message
          || 'The invoice PDF service failed';
        throw new ValidationError('Unable to generate return invoice PDF', details);
      }
      return null;
    }
  }

  private mapLine(line: any) {
    return {
      orderlineId: line?.id || null,
      orderlineNumber: line?.orderlinenumber || null,
      productId: line?.productid || null,
      productName: line?.productname || line?.product?.name || null,
      quantity: Number(line?.quantity || 0),
      amount: roundCurrency(toNumber(line?.orderamount || line?.productamount)),
      hsnCode: line?.hsn_code || null,
      gstRate: line?.gst_rate === null || line?.gst_rate === undefined ? null : toNumber(line.gst_rate),
      status: line?.orderstatus || null,
    };
  }
}

export const invoiceAdjustmentService = new InvoiceAdjustmentService();
