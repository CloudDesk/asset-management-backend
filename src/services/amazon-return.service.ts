import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { AmazonListingScope, amazonListingScopeService } from './amazon-listing-scope.service.js';
import { amazonInventorySyncService } from './amazon-inventory-sync.service.js';

export type AmazonReturnFulfilmentType = 'FBA' | 'FBM';
export type AmazonReturnQcDisposition = 'RESTOCKABLE' | 'DAMAGED' | 'UNSELLABLE';
type Actor = { requestedByUserId?: number; requestedByUserType?: string };

const reportTypeFor = (type: AmazonReturnFulfilmentType) =>
  type === 'FBA'
    ? 'GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA'
    : 'GET_FLAT_FILE_RETURNS_DATA_BY_RETURN_DATE';

const value = (row: Record<string, string>, ...keys: string[]) => {
  for (const key of keys) {
    const found = row[key];
    if (found?.trim()) return found.trim();
  }
  return null;
};

const parseDate = (input: string | null) => {
  const parsed = input ? new Date(input) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const parsePositiveInt = (input: string | null) => {
  const parsed = Number.parseInt(input ?? '0', 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

// Amazon reports are tab-delimited and may quote fields containing tabs or newlines.
export const parseAmazonReturnReport = (text: string): Array<Record<string, string>> => {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === '\t' && !quoted) {
      record.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      record.push(field);
      if (record.some((item) => item.length > 0)) records.push(record);
      record = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const headers = (records.shift() ?? []).map((header) => header.trim().toLowerCase());
  return records.map((fields) => Object.fromEntries(headers.map((header, index) => [header, fields[index] ?? ''])));
};

const serialize = (item: any) => ({
  id: String(item.id),
  fulfilmentType: item.fulfilmentType,
  amazonOrderId: item.amazonOrderId,
  amazonRmaId: item.amazonRmaId,
  returnDate: item.returnDate.toISOString(),
  sellerSku: item.sellerSku,
  asin: item.asin,
  fnSku: item.fnSku,
  quantity: item.quantity,
  amazonStatus: item.amazonStatus,
  disposition: item.disposition,
  reason: item.reason,
  fulfillmentCenterId: item.fulfillmentCenterId,
  customerComments: item.customerComments,
  inventoryAction: item.inventoryAction,
  quantityReceived: item.quantityReceived,
  qcDisposition: item.qcDisposition,
  receivedAt: item.receivedAt?.toISOString() ?? null,
  product: item.product ? { id: String(item.product.id), puc: item.product.puc, name: item.product.name } : null,
  listing: item.listing ? { id: String(item.listing.id), sellerSku: item.listing.sellerSku, title: item.listing.title } : null,
});

export class AmazonReturnError extends Error {
  constructor(message: string, readonly statusCode = 400, readonly code = 'AMAZON_RETURN_ERROR') {
    super(message);
    this.name = 'AmazonReturnError';
  }
}

export class AmazonReturnService {
  private running = new Set<string>();

  async enqueue(scope: AmazonListingScope, fulfilmentType: AmazonReturnFulfilmentType, actor: Actor = {}) {
    if (!scope.client.createReport || !scope.client.getReport || !scope.client.downloadReportDocument) {
      throw new AmazonReturnError('Amazon Reports API client is unavailable', 503, 'AMAZON_REPORTS_UNAVAILABLE');
    }
    const activeKey = `${scope.sellerId}:${scope.marketplaceId}:RETURNS:${fulfilmentType}`;
    const existing = await prisma.amazonReturnImportJob.findUnique({ where: { activeKey } });
    if (existing) return { job: this.serializeJob(existing), existing: true };
    const job = await prisma.amazonReturnImportJob.create({
      data: {
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        fulfilmentType,
        reportType: reportTypeFor(fulfilmentType),
        status: 'QUEUED',
        activeKey,
        ...(actor.requestedByUserId !== undefined ? { requestedByUserId: actor.requestedByUserId } : {}),
        ...(actor.requestedByUserType !== undefined ? { requestedByUserType: actor.requestedByUserType } : {}),
      },
    });
    queueMicrotask(() => void this.run(job.id));
    return { job: this.serializeJob(job), existing: false };
  }

  private async run(jobId: bigint) {
    const key = String(jobId);
    if (this.running.has(key)) return;
    this.running.add(key);
    try {
      const job = await prisma.amazonReturnImportJob.findUnique({ where: { id: jobId } });
      if (!job || !['QUEUED', 'REQUESTED', 'PROCESSING'].includes(job.status)) return;
      const scope = await amazonListingScopeService.resolveForSeller(job.sellerId, job.marketplaceId);
      if (!scope.client.createReport || !scope.client.getReport || !scope.client.downloadReportDocument) {
        throw new AmazonReturnError('Amazon Reports API client is unavailable', 503, 'AMAZON_REPORTS_UNAVAILABLE');
      }
      await prisma.amazonReturnImportJob.update({
        where: { id: job.id },
        data: { status: 'REQUESTED', startedAt: job.startedAt ?? new Date(), errorMessage: null },
      });
      const end = new Date();
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - 60);
      const requested = job.amazonReportId
        ? { reportId: job.amazonReportId }
        : await scope.client.createReport({
            reportType: job.reportType,
            dataStartTime: start.toISOString(),
            dataEndTime: end.toISOString(),
          });
      if (!job.amazonReportId) {
        await prisma.amazonReturnImportJob.update({
          where: { id: job.id },
          data: { amazonReportId: requested.reportId, status: 'PROCESSING' },
        });
      }
      let report = await scope.client.getReport(requested.reportId);
      for (let attempt = 0; !['DONE', 'CANCELLED', 'FATAL'].includes(report.processingStatus) && attempt < 30; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        report = await scope.client.getReport(requested.reportId);
      }
      if (report.processingStatus !== 'DONE' || !report.reportDocumentId) {
        throw new AmazonReturnError(
          report.processingStatus === 'CANCELLED' || report.processingStatus === 'FATAL'
            ? `Amazon return report ended with ${report.processingStatus}`
            : 'Amazon return report is still processing; retry the import shortly',
          502,
          'AMAZON_RETURN_REPORT_NOT_READY'
        );
      }
      const rows = parseAmazonReturnReport(await scope.client.downloadReportDocument(report.reportDocumentId));
      const summary = await this.persistRows(scope, job.fulfilmentType as AmazonReturnFulfilmentType, job.reportType, rows);
      await prisma.amazonReturnImportJob.update({
        where: { id: job.id },
        data: { status: 'COMPLETED', activeKey: null, ...summary, finishedAt: new Date() },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Amazon return import failed';
      await prisma.amazonReturnImportJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', activeKey: null, errorMessage: message, finishedAt: new Date() },
      }).catch(() => undefined);
    } finally {
      this.running.delete(key);
    }
  }

  private async persistRows(
    scope: AmazonListingScope,
    fulfilmentType: AmazonReturnFulfilmentType,
    reportType: string,
    rows: Array<Record<string, string>>
  ) {
    let created = 0;
    let updated = 0;
    let unmapped = 0;
    for (const row of rows) {
      const amazonOrderId = value(row, 'order-id', 'amazon-order-id');
      const sellerSku = value(row, 'sku', 'merchant-sku', 'seller-sku');
      const fnSku = value(row, 'fnsku', 'fulfillment-channel-sku');
      const asin = value(row, 'asin');
      const quantity = parsePositiveInt(value(row, 'quantity', 'return-quantity'));
      if (!amazonOrderId || quantity < 1) continue;
      const returnDate = parseDate(value(row, 'return-date', 'return-request-date'));
      const amazonRmaId = value(row, 'amazon-rma-id');
      const fingerprint = createHash('sha256').update([
        scope.sellerId, scope.marketplaceId, fulfilmentType, amazonOrderId, amazonRmaId ?? '',
        sellerSku ?? '', fnSku ?? '', returnDate.toISOString(), String(quantity),
      ].join('|')).digest('hex');
      const [order, listing] = await Promise.all([
        prisma.amazonMarketplaceOrder.findUnique({
          where: { sellerId_marketplaceId_amazonOrderId: {
            sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, amazonOrderId,
          } },
          select: { id: true },
        }),
        prisma.marketplaceListing.findFirst({
          where: {
            sellerId: scope.sellerId,
            marketplaceId: scope.marketplaceId,
            marketplace: 'AMAZON',
            OR: [
              ...(sellerSku ? [{ sellerSku }] : []),
              ...(fnSku ? [{ fnSku }] : []),
              ...(asin ? [{ asin }] : []),
            ],
          },
          select: { id: true, productId: true },
        }),
      ]);
      if (!listing?.productId) unmapped += 1;
      const existing = await prisma.amazonReturnEvent.findUnique({ where: { fingerprint }, select: { id: true } });
      const externalData = {
        amazonStatus: value(row, 'status', 'return-request-status'),
        disposition: value(row, 'detailed-disposition', 'resolution'),
        reason: value(row, 'reason', 'return-reason-code'),
        fulfillmentCenterId: value(row, 'fulfillment-center-id'),
        licensePlateNumber: value(row, 'license-plate-number'),
        customerComments: value(row, 'customer-comments'),
        rawData: row as Prisma.InputJsonValue,
      };
      await prisma.amazonReturnEvent.upsert({
        where: { fingerprint },
        create: {
          fingerprint, sellerId: scope.sellerId, marketplaceId: scope.marketplaceId,
          fulfilmentType, reportType, amazonOrderId, amazonRmaId, returnDate,
          sellerSku, asin, fnSku, quantity, ...externalData,
          orderId: order?.id ?? null, listingId: listing?.id ?? null, productId: listing?.productId ?? null,
          inventoryAction: fulfilmentType === 'FBA' ? 'REMOTE_ONLY' : 'AWAITING_RECEIPT',
        },
        update: {
          ...externalData, orderId: order?.id ?? null, listingId: listing?.id ?? null,
          productId: listing?.productId ?? null,
        },
      });
      if (existing) updated += 1; else created += 1;
    }
    return { fetched: rows.length, created, updated, unmapped };
  }

  async list(scope: AmazonListingScope, input: {
    page: number; limit: number; fulfilmentType?: string; inventoryAction?: string; search?: string;
  }) {
    const where: Prisma.AmazonReturnEventWhereInput = {
      sellerId: scope.sellerId,
      marketplaceId: scope.marketplaceId,
      ...(input.fulfilmentType ? { fulfilmentType: input.fulfilmentType } : {}),
      ...(input.inventoryAction ? { inventoryAction: input.inventoryAction } : {}),
      ...(input.search ? { OR: [
        { amazonOrderId: { contains: input.search, mode: 'insensitive' } },
        { sellerSku: { contains: input.search, mode: 'insensitive' } },
        { asin: { contains: input.search, mode: 'insensitive' } },
      ] } : {}),
    };
    const [items, total, fba, fbm, awaitingReceipt] = await Promise.all([
      prisma.amazonReturnEvent.findMany({
        where, include: { product: { select: { id: true, puc: true, name: true } }, listing: { select: { id: true, sellerSku: true, title: true } } },
        orderBy: [{ returnDate: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.limit, take: input.limit,
      }),
      prisma.amazonReturnEvent.count({ where }),
      prisma.amazonReturnEvent.count({ where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, fulfilmentType: 'FBA' } }),
      prisma.amazonReturnEvent.count({ where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, fulfilmentType: 'FBM' } }),
      prisma.amazonReturnEvent.count({ where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, inventoryAction: 'AWAITING_RECEIPT' } }),
    ]);
    return { items: items.map(serialize), pagination: { page: input.page, limit: input.limit, total }, summary: { total: fba + fbm, fba, fbm, awaitingReceipt } };
  }

  async latestJob(scope: AmazonListingScope, fulfilmentType?: string) {
    const job = await prisma.amazonReturnImportJob.findFirst({
      where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, ...(fulfilmentType ? { fulfilmentType } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return job ? this.serializeJob(job) : null;
  }

  async receive(
    returnId: string,
    scope: AmazonListingScope,
    input: { quantityReceived: number; qcDisposition: AmazonReturnQcDisposition },
    actor: Actor
  ) {
    if (!/^[1-9]\d*$/.test(returnId)) throw new AmazonReturnError('Invalid return ID');
    let platformStockId: bigint | null = null;
    const result = await prisma.$transaction(async (transaction) => {
      const item = await transaction.amazonReturnEvent.findFirst({
        where: { id: BigInt(returnId), sellerId: scope.sellerId, marketplaceId: scope.marketplaceId },
      });
      if (!item) throw new AmazonReturnError('Amazon return was not found', 404, 'AMAZON_RETURN_NOT_FOUND');
      if (item.fulfilmentType !== 'FBM') throw new AmazonReturnError('FBA returns remain in Amazon-owned inventory and cannot restock Nivaana');
      if (item.inventoryAction !== 'AWAITING_RECEIPT') throw new AmazonReturnError('This return has already been processed', 409, 'AMAZON_RETURN_ALREADY_PROCESSED');
      if (!item.productId) throw new AmazonReturnError('Map the returned SKU to a Nivaana product before receiving it', 409, 'AMAZON_RETURN_UNMAPPED');
      if (input.quantityReceived < 1 || input.quantityReceived > item.quantity) {
        throw new AmazonReturnError(`Received quantity must be between 1 and ${item.quantity}`);
      }
      let inventoryAction = input.qcDisposition === 'RESTOCKABLE' ? 'RESTOCKED' : 'QUARANTINED';
      if (input.qcDisposition === 'RESTOCKABLE') {
        const stock = await transaction.platformStock.findFirst({
          where: { productid: item.productId, platform: { equals: 'amazon', mode: 'insensitive' } },
        });
        if (!stock) throw new AmazonReturnError('Amazon platform stock is missing for the returned product', 409, 'AMAZON_PLATFORM_STOCK_MISSING');
        const changed = await transaction.platformStock.updateMany({
          where: { id: stock.id, soldqty: { gte: input.quantityReceived } },
          data: {
            availableqty: { increment: input.quantityReceived },
            soldqty: { decrement: input.quantityReceived },
            modifieddate: BigInt(Date.now()),
          },
        });
        if (changed.count !== 1) throw new AmazonReturnError('Returned quantity exceeds sold Amazon stock', 409, 'AMAZON_RETURN_STOCK_CONFLICT');
        platformStockId = stock.id;
      }
      return transaction.amazonReturnEvent.update({
        where: { id: item.id },
        data: {
          inventoryAction, quantityReceived: input.quantityReceived, qcDisposition: input.qcDisposition,
          receivedAt: new Date(), processedAt: new Date(),
          ...(actor.requestedByUserId !== undefined ? { processedByUserId: actor.requestedByUserId } : {}),
          ...(actor.requestedByUserType !== undefined ? { processedByUserType: actor.requestedByUserType } : {}),
        },
        include: { product: { select: { id: true, puc: true, name: true } }, listing: { select: { id: true, sellerSku: true, title: true } } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (platformStockId !== null) await amazonInventorySyncService.syncPlatformStockById(platformStockId).catch(() => undefined);
    return serialize(result);
  }

  private serializeJob(job: any) {
    return {
      id: String(job.id), fulfilmentType: job.fulfilmentType, status: job.status,
      fetched: job.fetched, created: job.created, updated: job.updated, unmapped: job.unmapped,
      errorMessage: job.errorMessage, startedAt: job.startedAt?.toISOString() ?? null,
      finishedAt: job.finishedAt?.toISOString() ?? null,
    };
  }
}

export const amazonReturnService = new AmazonReturnService();
