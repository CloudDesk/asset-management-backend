import cron, { ScheduledTask } from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../models/prisma.js';
import { amazonOrderJobService } from './amazon-order-job.service.js';
import { amazonListingScopeService } from './amazon-listing-scope.service.js';

let scheduledTask: ScheduledTask | null = null;

const enqueueConfiguredScopes = async () => {
  const connections = await prisma.amazonConnection.findMany({
    select: { sellerId: true, marketplaceId: true },
    distinct: ['sellerId', 'marketplaceId'],
  });
  const scopes = new Map(connections.map((connection) => [`${connection.sellerId}:${connection.marketplaceId}`, connection]));
  try {
    const fallback = await amazonListingScopeService.resolve();
    scopes.set(`${fallback.sellerId}:${fallback.marketplaceId}`, fallback);
  } catch {
    // Stored OAuth scopes can still be scheduled when no environment fallback exists.
  }
  for (const scope of scopes.values()) {
    await amazonOrderJobService.enqueue({
      sellerId: scope.sellerId,
      marketplaceId: scope.marketplaceId,
      trigger: 'SCHEDULED',
    });
  }
};

export const startAmazonOrderScheduler = async () => {
  await amazonOrderJobService.recoverPendingJobs();
  if (!env.AMAZON_ORDER_AUTO_SYNC_ENABLED || scheduledTask) return;
  if (!cron.validate(env.AMAZON_ORDER_SYNC_CRON)) {
    logger.error({ cron: env.AMAZON_ORDER_SYNC_CRON }, 'Amazon order scheduler has an invalid cron expression');
    return;
  }
  scheduledTask = cron.schedule(env.AMAZON_ORDER_SYNC_CRON, () => {
    void enqueueConfiguredScopes().catch((error) => logger.error({ error }, 'Scheduled Amazon order sync failed'));
  });
  logger.info({ cron: env.AMAZON_ORDER_SYNC_CRON }, 'Amazon order scheduler started');
  void enqueueConfiguredScopes().catch((error) => logger.error({ error }, 'Initial Amazon order sync failed'));
};

export const stopAmazonOrderScheduler = () => {
  scheduledTask?.stop();
  scheduledTask = null;
};
