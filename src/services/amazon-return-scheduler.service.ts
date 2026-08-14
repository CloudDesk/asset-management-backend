import cron, { ScheduledTask } from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../models/prisma.js';
import { amazonListingScopeService } from './amazon-listing-scope.service.js';
import { amazonReturnService } from './amazon-return.service.js';

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
    // OAuth-backed scopes can still run without environment fallback credentials.
  }
  for (const item of scopes.values()) {
    const scope = await amazonListingScopeService.resolveForSeller(item.sellerId, item.marketplaceId);
    await Promise.allSettled([
      amazonReturnService.enqueue(scope, 'FBA'),
      amazonReturnService.enqueue(scope, 'FBM'),
    ]);
  }
};

export const startAmazonReturnScheduler = () => {
  if (!env.AMAZON_RETURN_AUTO_SYNC_ENABLED || scheduledTask) return;
  if (!cron.validate(env.AMAZON_RETURN_SYNC_CRON)) {
    logger.error({ cron: env.AMAZON_RETURN_SYNC_CRON }, 'Amazon return scheduler has an invalid cron expression');
    return;
  }
  scheduledTask = cron.schedule(env.AMAZON_RETURN_SYNC_CRON, () => {
    void enqueueConfiguredScopes().catch((error) => logger.error({ error }, 'Scheduled Amazon return import failed'));
  });
  logger.info({ cron: env.AMAZON_RETURN_SYNC_CRON }, 'Amazon return scheduler started');
};

export const stopAmazonReturnScheduler = () => {
  scheduledTask?.stop();
  scheduledTask = null;
};
