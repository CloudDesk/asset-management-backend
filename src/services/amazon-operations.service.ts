import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../models/prisma.js';
import { AmazonListingScope, amazonListingScopeService } from './amazon-listing-scope.service.js';
import { amazonOrderJobService } from './amazon-order-job.service.js';
import { amazonProductionInventoryService } from './amazon-production-inventory.service.js';
import { amazonProductionWriteGuardService } from './amazon-production-write-guard.service.js';
import { amazonApiTelemetryService } from './amazon-api-telemetry.service.js';
import { amazonNotificationSubscriptionService } from './amazon-notification-subscription.service.js';

type Actor = { requestedByUserId?: number; requestedByUserType?: string };

const iso = (value: Date | null | undefined) => value?.toISOString() ?? null;
const stringify = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value ?? '');
const csvCell = (value: unknown) => `"${stringify(value).replace(/"/g, '""')}"`;
const csv = (headers: string[], rows: unknown[][]) => [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');

export class AmazonOperationsService {
  async dashboard(scope: AmazonListingScope, userId?: number) {
    const [writeStatus, setting, latestListing, latestOrder, latestNotification, counts, activities, failures, retries, rateLimit, subscriptions] = await Promise.all([
      amazonProductionWriteGuardService.status(scope.sellerId, scope.marketplaceId),
      prisma.amazonOperationsSetting.findUnique({ where: { sellerId_marketplaceId: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId } } }),
      prisma.channelSyncLog.findFirst({ where: { marketplace: 'AMAZON', environment: 'PRODUCTION', sellerId: scope.sellerId, marketplaceId: scope.marketplaceId }, orderBy: { startedAt: 'desc' } }),
      prisma.amazonOrderImportJob.findFirst({ where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId }, orderBy: { createdAt: 'desc' } }),
      prisma.amazonOrderNotification.findFirst({ where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId }, orderBy: { eventTime: 'desc' } }),
      Promise.all([
        prisma.marketplaceListing.count({ where: { marketplace: 'AMAZON', environment: 'PRODUCTION', sellerId: scope.sellerId, marketplaceId: scope.marketplaceId } }),
        prisma.marketplaceListing.count({ where: { marketplace: 'AMAZON', environment: 'PRODUCTION', sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, mappingStatus: { not: 'MAPPED' } } }),
        prisma.amazonMarketplaceOrder.count({ where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId } }),
        prisma.amazonOrderFulfillmentException.count({ where: { status: 'OPEN', order: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId } } }),
        prisma.amazonRetryJob.count({ where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, status: { in: ['QUEUED', 'RUNNING', 'FAILED'] } } }),
        prisma.amazonConnection.count({ where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId } }),
      ]),
      this.activity(scope, 20),
      this.failures(scope, 20),
      prisma.amazonRetryJob.findMany({ where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      amazonApiTelemetryService.health(scope.sellerId, scope.marketplaceId),
      amazonNotificationSubscriptionService.status(scope),
    ]);

    return {
      scope: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId },
      health: {
        overall: failures.length > 0 ? 'ATTENTION' : latestListing || latestOrder ? 'HEALTHY' : 'NO_ACTIVITY',
        writes: writeStatus,
        authorization: { source: counts[5] > 0 ? 'ENCRYPTED_OAUTH_CONNECTION' : 'ENVIRONMENT_FALLBACK', status: counts[5] > 0 ? 'STORED' : 'NOT_CONNECTED', note: 'Token validity is confirmed by the latest successful Amazon API operation.' },
        listingImport: { enabled: env.AMAZON_LISTING_IMPORT_ENABLED, scheduled: env.AMAZON_LISTING_AUTO_SYNC_ENABLED, cron: env.AMAZON_LISTING_SYNC_CRON, lastStatus: latestListing?.status ?? null, lastRunAt: iso(latestListing?.startedAt) },
        orderImport: { scheduled: env.AMAZON_ORDER_AUTO_SYNC_ENABLED, cron: env.AMAZON_ORDER_SYNC_CRON, lastStatus: latestOrder?.status ?? null, lastRunAt: iso(latestOrder?.startedAt ?? latestOrder?.createdAt) },
        notifications: {
          ingestionConfigured: Boolean(env.AMAZON_NOTIFICATION_INGEST_SECRET),
          sqsDestinationConfigured: Boolean(env.AMAZON_NOTIFICATION_SQS_DESTINATION_ID || env.AMAZON_NOTIFICATION_DESTINATION_ID),
          eventBridgeDestinationConfigured: Boolean(env.AMAZON_NOTIFICATION_EVENTBRIDGE_DESTINATION_ID || env.AMAZON_NOTIFICATION_DESTINATION_ID),
          desiredTypes: subscriptions.map((item) => item.notificationType),
          subscriptions,
          lastStatus: latestNotification?.status ?? null,
          lastEventAt: iso(latestNotification?.eventTime),
        },
        retryWorker: { enabled: env.AMAZON_RETRY_WORKER_ENABLED, cron: env.AMAZON_RETRY_WORKER_CRON },
        rateLimit,
      },
      counts: { listings: counts[0], unmappedListings: counts[1], orders: counts[2], openFulfillmentExceptions: counts[3], retryQueue: counts[4] },
      settings: { productionWritesPaused: setting?.productionWritesPaused ?? false, pauseReason: setting?.pauseReason ?? null, pausedAt: iso(setting?.pausedAt) },
      permissions: userId ? await this.permissions(userId) : null,
      activities,
      failures,
      retries: retries.map((job) => ({ ...job, id: String(job.id), createdAt: job.createdAt.toISOString(), updatedAt: job.updatedAt.toISOString(), nextAttemptAt: job.nextAttemptAt.toISOString(), startedAt: iso(job.startedAt), finishedAt: iso(job.finishedAt) })),
    };
  }

  private async permissions(userId: number) {
    const { getUserPermissions } = await import('../utils/permissionChecker.js');
    const channel = (await getUserPermissions(userId)).permissions.channels;
    const custom = channel?.customactions ?? {};
    const fallback = (keys: string[]) => keys.some((key) => (channel as Record<string, unknown> | undefined)?.[key] === true);
    return {
      listingImport: custom.amazon_listing_import ?? fallback(['import', 'create']),
      mapping: custom.amazon_mapping ?? fallback(['create', 'edit', 'modifyall']),
      inventorySync: custom.amazon_inventory_sync ?? fallback(['edit', 'modifyall']),
      orderSync: custom.amazon_order_sync ?? fallback(['import', 'create']),
      shipmentConfirmation: custom.amazon_shipment_confirmation ?? fallback(['edit', 'modifyall']),
      productUpdate: custom.amazon_product_update ?? fallback(['edit', 'modifyall']),
      operationsAdmin: custom.amazon_operations_admin ?? fallback(['modifyall']),
      retryFailures: custom.amazon_retry_failures ?? fallback(['edit', 'modifyall']),
      export: custom.amazon_export ?? fallback(['read']),
    };
  }

  async setPaused(scope: AmazonListingScope, paused: boolean, reason: string, actor: Actor) {
    const actorFields = {
      ...(actor.requestedByUserId !== undefined ? { pausedByUserId: actor.requestedByUserId } : {}),
      ...(actor.requestedByUserType !== undefined ? { pausedByUserType: actor.requestedByUserType } : {}),
    };
    const setting = await prisma.amazonOperationsSetting.upsert({
      where: { sellerId_marketplaceId: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId } },
      create: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, productionWritesPaused: paused, pauseReason: paused ? reason : null, pausedAt: paused ? new Date() : null, ...actorFields },
      update: { productionWritesPaused: paused, pauseReason: paused ? reason : null, pausedAt: paused ? new Date() : null, ...actorFields },
    });
    await prisma.amazonOperationsAudit.create({ data: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, action: paused ? 'PRODUCTION_WRITES_PAUSED' : 'PRODUCTION_WRITES_RESUMED', outcome: 'SUCCESS', details: { reason }, ...actor } });
    return { productionWritesPaused: setting.productionWritesPaused, pauseReason: setting.pauseReason, pausedAt: iso(setting.pausedAt) };
  }

  async activity(scope: AmazonListingScope, limit = 50) {
    const [ops, syncs, imports, audits] = await Promise.all([
      prisma.amazonOperationsAudit.findMany({ where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId }, orderBy: { createdAt: 'desc' }, take: limit }),
      prisma.channelSyncLog.findMany({ where: { marketplace: 'AMAZON', environment: 'PRODUCTION', sellerId: scope.sellerId, marketplaceId: scope.marketplaceId }, orderBy: { startedAt: 'desc' }, take: limit }),
      prisma.amazonOrderImportJob.findMany({ where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId }, orderBy: { createdAt: 'desc' }, take: limit }),
      prisma.marketplaceListingAudit.findMany({ where: { marketplace: 'AMAZON', environment: 'PRODUCTION', sellerId: scope.sellerId, marketplaceId: scope.marketplaceId }, orderBy: { createdAt: 'desc' }, take: limit }),
    ]);
    return [
      ...ops.map((item) => ({ id: `operation-${item.id}`, category: 'OPERATIONS', action: item.action, status: item.outcome, message: item.details, occurredAt: item.createdAt.toISOString() })),
      ...syncs.map((item) => ({ id: `listing-sync-${item.id}`, category: 'LISTINGS', action: item.operation, status: item.status, message: item.errorMessage || `${item.totalFetched} fetched`, occurredAt: item.startedAt.toISOString() })),
      ...imports.map((item) => ({ id: `order-import-${item.id}`, category: 'ORDERS', action: `${item.trigger}_${item.mode}`, status: item.status, message: item.errorMessage || `${item.fetched} fetched`, occurredAt: item.createdAt.toISOString() })),
      ...audits.map((item) => ({ id: `listing-audit-${item.id}`, category: 'LISTINGS', action: item.operation, status: item.operation.includes('FAILED') ? 'FAILED' : 'SUCCESS', message: item.sellerSku, occurredAt: item.createdAt.toISOString() })),
    ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit);
  }

  async failures(scope: AmazonListingScope, limit = 50) {
    const [syncs, imports, inventory, exceptions, audits] = await Promise.all([
      prisma.channelSyncLog.findMany({ where: { marketplace: 'AMAZON', environment: 'PRODUCTION', sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, OR: [{ status: { in: ['FAILED', 'PARTIAL'] } }, { failed: { gt: 0 } }] }, orderBy: { startedAt: 'desc' }, take: limit }),
      prisma.amazonOrderImportJob.findMany({ where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, status: 'FAILED' }, orderBy: { createdAt: 'desc' }, take: limit }),
      prisma.amazonInventorySyncAttempt.findMany({ where: { status: 'FAILED', listing: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, marketplace: 'AMAZON', environment: 'PRODUCTION' } }, include: { listing: { select: { sellerSku: true } } }, orderBy: { createdAt: 'desc' }, take: limit }),
      prisma.amazonOrderFulfillmentException.findMany({ where: { status: 'OPEN', order: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId } }, include: { order: { select: { amazonOrderId: true } } }, orderBy: { createdAt: 'desc' }, take: limit }),
      prisma.marketplaceListingAudit.findMany({ where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, operation: { contains: 'FAILED' } }, orderBy: { createdAt: 'desc' }, take: limit }),
    ]);
    return [
      ...syncs.map((x) => ({ id: `listing-sync:${x.id}`, type: 'LISTING_IMPORT', resourceId: String(x.id), label: x.operation, error: x.errorMessage || `${x.failed} listing(s) failed`, occurredAt: x.startedAt.toISOString(), retryable: true })),
      ...imports.map((x) => ({ id: `order-import:${x.id}`, type: 'ORDER_IMPORT', resourceId: String(x.id), label: x.mode, error: x.errorMessage, occurredAt: x.createdAt.toISOString(), retryable: true })),
      ...inventory.map((x) => ({ id: `inventory:${x.id}`, type: 'INVENTORY_SYNC', resourceId: String(x.id), listingId: String(x.listingId), label: x.listing.sellerSku, error: x.errorMessage, occurredAt: x.createdAt.toISOString(), retryable: true })),
      ...exceptions.map((x) => ({ id: `fulfillment:${x.id}`, type: 'FULFILLMENT_EXCEPTION', resourceId: String(x.id), orderId: String(x.orderId), label: x.order.amazonOrderId, error: x.message, occurredAt: x.createdAt.toISOString(), retryable: true })),
      ...audits.map((x) => ({ id: `offer:${x.id}`, type: 'OFFER_UPDATE', resourceId: String(x.id), label: x.sellerSku, error: 'Offer update failed; create a new preview before retrying.', occurredAt: x.createdAt.toISOString(), retryable: false })),
    ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, limit);
  }

  async enqueueRetry(scope: AmazonListingScope, input: { type: string; resourceId: string; listingId?: string; orderId?: string }, actor: Actor) {
    const supported = ['ORDER_IMPORT', 'INVENTORY_SYNC', 'FULFILLMENT_EXCEPTION'];
    if (!supported.includes(input.type)) throw new Error('This failure requires a fresh preview or manual correction and cannot be queued.');
    const job = await prisma.amazonRetryJob.create({ data: {
      sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, operation: input.type,
      resourceType: input.type, resourceId: input.resourceId,
      payload: { listingId: input.listingId, orderId: input.orderId } as Prisma.InputJsonValue,
      ...actor,
    } });
    return { id: String(job.id), status: job.status, nextAttemptAt: job.nextAttemptAt.toISOString() };
  }

  async runRetry(scope: AmazonListingScope, jobId: string) {
    const job = await prisma.amazonRetryJob.findFirst({ where: { id: BigInt(jobId), sellerId: scope.sellerId, marketplaceId: scope.marketplaceId } });
    if (!job) throw new Error('Retry job was not found');
    if (!['QUEUED', 'FAILED'].includes(job.status)) return { id: jobId, status: job.status };
    await prisma.amazonRetryJob.update({ where: { id: job.id }, data: { status: 'RUNNING', attempts: { increment: 1 }, startedAt: new Date(), lastError: null } });
    try {
      const payload = (job.payload || {}) as Record<string, string | undefined>;
      const inventoryActor = {
        ...(job.requestedByUserId !== null ? { requestedByUserId: job.requestedByUserId } : {}),
        ...(job.requestedByUserType !== null ? { requestedByUserType: job.requestedByUserType } : {}),
      };
      const fulfillmentActor = {
        ...(job.requestedByUserId !== null ? { userId: job.requestedByUserId } : {}),
        ...(job.requestedByUserType !== null ? { userType: job.requestedByUserType } : {}),
      };
      if (job.operation === 'ORDER_IMPORT') {
        await amazonOrderJobService.enqueue({ sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, trigger: 'MANUAL', fullHistory: false, ...inventoryActor });
      } else if (job.operation === 'INVENTORY_SYNC' && payload.listingId) {
        await amazonProductionInventoryService.retry(payload.listingId, job.resourceId, scope, inventoryActor);
      } else if (job.operation === 'FULFILLMENT_EXCEPTION' && payload.orderId) {
        const { amazonOrderFulfillmentService } = await import('./amazon-order-fulfillment.service.js');
        await amazonOrderFulfillmentService.retryException(payload.orderId, job.resourceId, scope, fulfillmentActor);
      } else throw new Error('Retry job payload is incomplete');
      await prisma.amazonRetryJob.update({ where: { id: job.id }, data: { status: 'SUCCEEDED', finishedAt: new Date() } });
      return { id: jobId, status: 'SUCCEEDED' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Retry failed';
      const attempts = job.attempts + 1;
      const terminal = attempts >= job.maxAttempts;
      await prisma.amazonRetryJob.update({ where: { id: job.id }, data: { status: terminal ? 'FAILED' : 'QUEUED', lastError: message, nextAttemptAt: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60_000), finishedAt: terminal ? new Date() : null } });
      throw error;
    }
  }

  async export(scope: AmazonListingScope, type: string) {
    if (type === 'listings' || type === 'mappings') {
      const rows = await prisma.marketplaceListing.findMany({ where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, marketplace: 'AMAZON', environment: 'PRODUCTION', ...(type === 'mappings' ? { mappingStatus: 'MAPPED' } : {}) }, include: { product: { select: { id: true, name: true, puc: true } } }, orderBy: { sellerSku: 'asc' } });
      return csv(['Seller SKU', 'ASIN', 'Title', 'Status', 'Fulfilment', 'Price', 'Currency', 'Mapping status', 'Nivaana product ID', 'Nivaana product'], rows.map((x) => [x.sellerSku, x.asin, x.title, x.listingStatus, x.fulfilmentChannel, x.price, x.currency, x.mappingStatus, x.productId, x.product?.name]));
    }
    if (type === 'inventory') {
      const rows = await prisma.amazonInventorySyncAttempt.findMany({ where: { listing: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId } }, include: { listing: { select: { sellerSku: true } } }, orderBy: { createdAt: 'desc' } });
      return csv(['Seller SKU', 'Operation', 'Status', 'Amazon quantity', 'Nivaana quantity', 'Target quantity', 'Error', 'Created'], rows.map((x) => [x.listing.sellerSku, x.operation, x.status, x.amazonQuantity, x.nivaanaQuantity, x.targetQuantity, x.errorMessage, x.createdAt.toISOString()]));
    }
    if (type === 'orders') {
      const rows = await prisma.amazonMarketplaceOrder.findMany({ where: { sellerId: scope.sellerId, marketplaceId: scope.marketplaceId }, include: { items: true }, orderBy: { purchaseDate: 'desc' } });
      return csv(['Amazon order ID', 'Purchased', 'Status', 'Fulfilment', 'Sync state', 'Items', 'Quantity'], rows.map((x) => [x.amazonOrderId, x.purchaseDate.toISOString(), x.orderStatus, x.fulfilmentType, x.syncState, x.items.length, x.items.reduce((sum, item) => sum + item.quantityOrdered, 0)]));
    }
    throw new Error('Export type must be listings, mappings, inventory, or orders');
  }
}

export const amazonOperationsService = new AmazonOperationsService();
