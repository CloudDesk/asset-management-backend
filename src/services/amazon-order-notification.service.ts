import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { amazonOrderJobService } from './amazon-order-job.service.js';

export class AmazonOrderNotificationService {
  async ingest(input: {
    notificationId: string;
    notificationType: string;
    sellerId: string;
    marketplaceId: string;
    eventTime: string;
    payload: unknown;
  }) {
    const existing = await prisma.amazonOrderNotification.findUnique({ where: { notificationId: input.notificationId } });
    if (existing) return { notificationId: existing.notificationId, status: existing.status, duplicate: true, jobId: existing.jobId ? String(existing.jobId) : null };

    const notification = await prisma.amazonOrderNotification.create({
      data: {
        notificationId: input.notificationId,
        notificationType: input.notificationType,
        sellerId: input.sellerId,
        marketplaceId: input.marketplaceId,
        eventTime: new Date(input.eventTime),
        payload: input.payload as Prisma.InputJsonValue,
        status: 'RECEIVED',
      },
    });
    try {
      const queued = await amazonOrderJobService.enqueue({
        sellerId: input.sellerId,
        marketplaceId: input.marketplaceId,
        trigger: 'NOTIFICATION',
      });
      await prisma.amazonOrderNotification.update({
        where: { id: notification.id },
        data: { status: 'QUEUED', jobId: BigInt(queued.job.id) },
      });
      return { notificationId: notification.notificationId, status: 'QUEUED', duplicate: false, jobId: queued.job.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to queue Amazon order notification';
      await prisma.amazonOrderNotification.update({
        where: { id: notification.id },
        data: { status: 'FAILED', errorMessage: message, processedAt: new Date() },
      });
      throw error;
    }
  }
}

export const amazonOrderNotificationService = new AmazonOrderNotificationService();
