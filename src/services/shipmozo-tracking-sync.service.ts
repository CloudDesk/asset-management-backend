import { Prisma } from '@prisma/client';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../models/prisma.js';
import { canApplyShipmozoStatus, normalizeShipmozoTracking } from '../utils/shipmozo-status.js';
import { buildShipmozoPublicTrackingUrl, shipmozoService } from './shipmozo.service.js';
import { customerEmailNotificationService } from './customer-email-notification.service.js';

const TERMINAL_STATUSES = new Set(['delivered', 'rto_delivered', 'cancelled', 'returned']);
function parseHistory(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function nextSyncAt(status: string | null, retryCount = 0): number | null {
  if (status && TERMINAL_STATUSES.has(status)) return null;
  const baseMinutes = status === 'out_for_delivery' ? 30 : 60;
  const retryMultiplier = Math.min(2 ** retryCount, 6);
  return Date.now() + baseMinutes * retryMultiplier * 60_000;
}

export class ShipmozoTrackingSyncService {
  private async recordFailure(input: {
    direction: 'forward' | 'reverse';
    entityId: number;
    providerOrderId: string;
    awbNumber: string;
    error: unknown;
  }) {
    const timestamp = Date.now();
    const message = input.error instanceof Error ? input.error.message : String(input.error);
    const where = input.direction === 'forward'
      ? { orderId: input.entityId, direction: 'forward' }
      : { returnRequestId: input.entityId, direction: 'reverse' };
    const operation = await prisma.shipmozoOperation.findFirst({ where, orderBy: { id: 'desc' } });
    const retryCount = (operation?.retryCount || 0) + 1;
    const data = {
      stage: 'tracking_failed',
      status: 'active',
      awbNumber: input.awbNumber,
      failureReason: message.slice(0, 4000),
      retryCount,
      nextSyncAt: nextSyncAt(null, retryCount),
      modifieddate: timestamp
    };
    if (operation) {
      await prisma.shipmozoOperation.update({ where: { id: operation.id }, data });
      return;
    }
    await prisma.shipmozoOperation.create({
      data: {
        idempotencyKey: `${input.direction}:${input.providerOrderId}`,
        providerOrderId: input.providerOrderId,
        ...(input.direction === 'forward' ? { orderId: input.entityId } : { returnRequestId: input.entityId }),
        direction: input.direction,
        operationType: 'tracking_sync',
        createddate: timestamp,
        ...data
      }
    });
  }

  async syncOrder(orderId: number) {
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: { orderline: true }
    });
    if (!order) throw new Error(`Order ${orderId} not found`);
    if (String(order.vendor || '').toUpperCase() !== 'SHIPMOZO' || !order.tracking_id) {
      throw new Error(`Order ${orderId} is not an active Shipmozo shipment`);
    }

    const tracking = await shipmozoService.trackOrder(order.tracking_id);
    const normalized = normalizeShipmozoTracking(tracking);
    const currentStatus = String(order.orderstatus || 'ready_for_dispatch').toLowerCase();
    const canAdvance = Boolean(
      normalized.system_status && canApplyShipmozoStatus(currentStatus, normalized.system_status)
    );
    const appliedStatus = canAdvance ? normalized.system_status : null;
    const statusChanged = Boolean(appliedStatus && appliedStatus !== currentStatus);
    const providerCancelled = normalized.is_provider_cancelled;
    const timestamp = Date.now();

    await prisma.$transaction(async (tx) => {
      const orderHistory = parseHistory(order.status_history);
      const updatedOrderHistory = statusChanged
        ? [
            ...orderHistory.map((entry) => ({ ...entry, is_active: false })),
            {
              previous_status: currentStatus,
              new_status: appliedStatus,
              changed_date: timestamp,
              source: 'shipmozo',
              shipmozo_original_status: normalized.provider_status,
              is_active: true
            }
          ]
        : orderHistory;

      const existingMetadata = order.barcodes && typeof order.barcodes === 'object' && !Array.isArray(order.barcodes)
        ? order.barcodes as Record<string, any>
        : {};
      const existingCancellation = existingMetadata.cancellation && typeof existingMetadata.cancellation === 'object'
        ? existingMetadata.cancellation as Record<string, any>
        : {};

      await tx.orders.update({
        where: { id: order.id },
        data: {
          shipment_tracking_status: normalized.provider_status,
          public_tracking_link: providerCancelled
            ? null
            : order.public_tracking_link || buildShipmozoPublicTrackingUrl(order.tracking_id || ''),
          ...(providerCancelled ? {
            tracking_id: null,
            vendor: null,
            shipment_created_at: null,
            label_url: null,
            label_downloaded_at: null,
            label_printed_at: null,
            barcodes: {
              ...existingMetadata,
              cancellation: {
                ...existingCancellation,
                provider: 'SHIPMOZO',
                status: 'confirmed',
                tracking_id: order.tracking_id,
                confirmed_at: timestamp,
                confirmation_source: 'tracking'
              }
            }
          } : {}),
          ...(statusChanged ? { orderstatus: appliedStatus, status_history: updatedOrderHistory } : {}),
          ...(appliedStatus === 'shipped' && !order.shipdate ? { shipdate: timestamp } : {}),
          ...(appliedStatus === 'delivered' ? { delivereddate: timestamp } : {}),
          modifieddate: timestamp
        }
      });

      if (statusChanged || providerCancelled) {
        for (const line of order.orderline) {
          const lineHistory = parseHistory(line.status_history);
          await tx.orderline.update({
            where: { id: line.id },
            data: {
              ...(providerCancelled ? { tracking_id: null } : {}),
              ...(statusChanged ? {
                orderstatus: appliedStatus,
                status_history: [
                  ...lineHistory.map((entry) => ({ ...entry, is_active: false })),
                  {
                    previous_status: line.orderstatus,
                    new_status: appliedStatus,
                    changed_date: timestamp,
                    source: 'shipmozo',
                    shipmozo_original_status: normalized.provider_status,
                    is_active: true
                  }
                ]
              } : {}),
              ...(appliedStatus === 'shipped' && !line.shipdate ? { shipdate: timestamp } : {}),
              ...(appliedStatus === 'delivered' ? { delivereddate: timestamp } : {}),
              modifieddate: timestamp
            }
          });
        }
      }

      const operation = await tx.shipmozoOperation.findFirst({
        where: { orderId: order.id, direction: 'forward' },
        orderBy: { id: 'desc' }
      });
      const trackingComplete = Boolean(providerCancelled || (appliedStatus && TERMINAL_STATUSES.has(appliedStatus)));
      const operationData = {
        stage: providerCancelled ? 'shipment_cancelled' : trackingComplete ? 'tracking_complete' : 'tracking_synced',
        status: providerCancelled ? 'cancelled' : trackingComplete ? 'completed' : 'active',
        awbNumber: order.tracking_id,
        lastProviderStatus: normalized.provider_status,
        lastSystemStatus: appliedStatus || normalized.event_status || currentStatus,
        lastTrackingPayload: tracking as Prisma.InputJsonValue,
        lastSyncedAt: timestamp,
        nextSyncAt: providerCancelled
          ? null
          : nextSyncAt(appliedStatus || (currentStatus === 'cancelled' ? null : currentStatus)),
        retryCount: 0,
        failureReason: null,
        modifieddate: timestamp,
        ...(trackingComplete ? { completeddate: timestamp } : {})
      };
      if (operation) {
        await tx.shipmozoOperation.update({ where: { id: operation.id }, data: operationData });
      } else {
        await tx.shipmozoOperation.create({
          data: {
            idempotencyKey: `forward:${order.orderid || order.id}`,
            providerOrderId: order.orderid || String(order.id),
            orderId: order.id,
            direction: 'forward',
            operationType: 'tracking_sync',
            createddate: timestamp,
            ...operationData
          }
        });
      }
    });

    if (appliedStatus && statusChanged) {
      const kind = appliedStatus === 'delivered' ? 'delivery_confirmation' : 'shipment_update';
      customerEmailNotificationService.queueOrderEmail(order.id, kind, {
        status: appliedStatus,
        ...(normalized.provider_status ? { description: normalized.provider_status } : {}),
      });
    }

    return {
      order_id: order.id,
      order_number: order.orderid,
      tracking_id: order.tracking_id,
      previous_status: currentStatus,
      provider_status: normalized.provider_status,
      normalized_status: normalized.system_status,
      event_status: normalized.event_status,
      applied_status: appliedStatus,
      provider_cancellation_confirmed: providerCancelled,
      ignored_regression: Boolean(normalized.system_status && !canAdvance)
    };
  }

  async syncByAwb(awbNumber: string) {
    const normalizedAwb = String(awbNumber || '').trim();
    if (!normalizedAwb) throw new Error('AWB number is required');

    const order = await prisma.orders.findFirst({
      where: {
        tracking_id: normalizedAwb,
        vendor: { equals: 'SHIPMOZO', mode: 'insensitive' }
      },
      select: { id: true }
    });
    if (order) return { entity: 'order', ...(await this.syncOrder(order.id)) };

    const returnRequest = await prisma.returnRequest.findFirst({
      where: {
        reverseShipmentTrackingId: normalizedAwb,
        reverseShipmentProvider: { equals: 'SHIPMOZO', mode: 'insensitive' }
      },
      select: { id: true }
    });
    if (returnRequest) return { entity: 'return', ...(await this.syncReturn(returnRequest.id)) };

    return { entity: null, tracking_id: normalizedAwb, ignored: true, reason: 'tracking_id_not_found' };
  }

  async syncReturn(returnRequestId: number) {
    const request = await prisma.returnRequest.findUnique({ where: { id: returnRequestId } });
    if (!request || !request.reverseShipmentTrackingId || String(request.reverseShipmentProvider).toUpperCase() !== 'SHIPMOZO') {
      throw new Error(`Return request ${returnRequestId} is not an active Shipmozo reverse shipment`);
    }
    const tracking = await shipmozoService.trackOrder(request.reverseShipmentTrackingId);
    const normalized = normalizeShipmozoTracking(tracking);
    const timestamp = Date.now();
    const shouldMarkTransit = ['shipped', 'in_transit', 'out_for_delivery'].includes(normalized.system_status || '')
      && ['pickup_created', 'pickup_prepared', 'approved'].includes(request.status);

    await prisma.$transaction(async (tx) => {
      if (shouldMarkTransit) {
        await tx.returnRequest.update({
          where: { id: request.id },
          data: { status: 'in_transit', modifieddate: Math.floor(timestamp / 1000) }
        });
      }
      const operation = await tx.shipmozoOperation.findFirst({
        where: { returnRequestId: request.id, direction: 'reverse' },
        orderBy: { id: 'desc' }
      });
      const operationData = {
        stage: normalized.system_status === 'delivered' ? 'awaiting_warehouse_receipt' : 'tracking_synced',
        status: 'active',
        awbNumber: request.reverseShipmentTrackingId,
        lastProviderStatus: normalized.provider_status,
        lastSystemStatus: shouldMarkTransit ? 'in_transit' : request.status,
        lastTrackingPayload: tracking as Prisma.InputJsonValue,
        lastSyncedAt: timestamp,
        nextSyncAt: normalized.system_status === 'delivered' ? null : nextSyncAt(normalized.system_status),
        retryCount: 0,
        failureReason: null,
        modifieddate: timestamp
      };
      if (operation) {
        await tx.shipmozoOperation.update({ where: { id: operation.id }, data: operationData });
      } else {
        await tx.shipmozoOperation.create({
          data: {
            idempotencyKey: `reverse:${request.requestnumber}`,
            providerOrderId: request.requestnumber,
            returnRequestId: request.id,
            direction: 'reverse',
            operationType: 'tracking_sync',
            createddate: timestamp,
            ...operationData
          }
        });
      }
    });
    return {
      return_request_id: request.id,
      tracking_id: request.reverseShipmentTrackingId,
      provider_status: normalized.provider_status,
      normalized_status: normalized.system_status,
      applied_status: shouldMarkTransit ? 'in_transit' : null,
      warehouse_receipt_required: normalized.system_status === 'delivered'
    };
  }

  async runBatch(limit = env.SHIPMOZO_TRACKING_SYNC_BATCH_SIZE) {
    const now = Date.now();
    const forwardCandidates = await prisma.orders.findMany({
      where: {
        vendor: { equals: 'SHIPMOZO', mode: 'insensitive' },
        tracking_id: { not: null },
        OR: [
          { orderstatus: { notIn: [...TERMINAL_STATUSES] } },
          {
            orderstatus: 'cancelled',
            OR: [
              { barcodes: { path: ['cancellation', 'status'], equals: 'pending' } },
              { barcodes: { path: ['cancellation', 'status'], equals: 'failed' } }
            ]
          }
        ]
      },
      select: { id: true, orderid: true, tracking_id: true },
      take: limit * 3,
      orderBy: { modifieddate: 'asc' }
    });
    const forwardOperations = forwardCandidates.length
      ? await prisma.shipmozoOperation.findMany({
          where: { orderId: { in: forwardCandidates.map(({ id }) => id) }, direction: 'forward' },
          orderBy: { id: 'desc' }
        })
      : [];
    const forwardSchedule = new Map<number, bigint | null>();
    for (const operation of forwardOperations) {
      if (operation.orderId !== null && !forwardSchedule.has(operation.orderId)) {
        forwardSchedule.set(operation.orderId, operation.nextSyncAt);
      }
    }
    const forwardOrders = forwardCandidates
      .filter(({ id }) => {
        if (!forwardSchedule.has(id)) return true;
        const scheduledAt = forwardSchedule.get(id);
        return scheduledAt !== null && Number(scheduledAt) <= now;
      })
      .slice(0, limit);
    const remaining = Math.max(0, limit - forwardOrders.length);
    const reverseCandidates = remaining
      ? await prisma.returnRequest.findMany({
          where: {
            reverseShipmentProvider: { equals: 'SHIPMOZO', mode: 'insensitive' },
            reverseShipmentTrackingId: { not: null },
            status: { in: ['pickup_created', 'pickup_prepared', 'approved', 'in_transit'] }
          },
          select: { id: true, requestnumber: true, reverseShipmentTrackingId: true },
          take: remaining * 3,
          orderBy: { modifieddate: 'asc' }
        })
      : [];
    const reverseOperations = reverseCandidates.length
      ? await prisma.shipmozoOperation.findMany({
          where: { returnRequestId: { in: reverseCandidates.map(({ id }) => id) }, direction: 'reverse' },
          orderBy: { id: 'desc' }
        })
      : [];
    const reverseSchedule = new Map<number, bigint | null>();
    for (const operation of reverseOperations) {
      if (operation.returnRequestId !== null && !reverseSchedule.has(operation.returnRequestId)) {
        reverseSchedule.set(operation.returnRequestId, operation.nextSyncAt);
      }
    }
    const reverseRequests = reverseCandidates
      .filter(({ id }) => {
        if (!reverseSchedule.has(id)) return true;
        const scheduledAt = reverseSchedule.get(id);
        return scheduledAt !== null && Number(scheduledAt) <= now;
      })
      .slice(0, remaining);

    const results: unknown[] = [];
    for (const order of forwardOrders) {
      try {
        results.push(await this.syncOrder(order.id));
      } catch (error) {
        logger.warn({ error, orderId: order.id }, 'Shipmozo scheduled tracking sync failed');
        await this.recordFailure({
          direction: 'forward',
          entityId: order.id,
          providerOrderId: order.orderid || String(order.id),
          awbNumber: order.tracking_id || '',
          error
        });
        results.push({ order_id: order.id, success: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    for (const request of reverseRequests) {
      try {
        results.push(await this.syncReturn(request.id));
      } catch (error) {
        logger.warn({ error, returnRequestId: request.id }, 'Shipmozo reverse tracking sync failed');
        await this.recordFailure({
          direction: 'reverse',
          entityId: request.id,
          providerOrderId: request.requestnumber,
          awbNumber: request.reverseShipmentTrackingId || '',
          error
        });
        results.push({ return_request_id: request.id, success: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
    return { started_at: now, processed: results.length, results };
  }
}

export const shipmozoTrackingSyncService = new ShipmozoTrackingSyncService();
