import cron, { ScheduledTask } from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../models/prisma.js';
import { amazonListingImportService } from './amazon-listing-import.service.js';
import { amazonListingScopeService } from './amazon-listing-scope.service.js';
import { amazonListingRepository } from '../repositories/amazon-listing.repository.js';

let task: ScheduledTask | null = null;

export const importConfiguredScopes = async () => {
  const connections = await prisma.amazonConnection.findMany({ select: { sellerId: true, marketplaceId: true }, distinct: ['sellerId', 'marketplaceId'] });
  const scopes = new Map(connections.map((connection) => [`${connection.sellerId}:${connection.marketplaceId}`, connection]));
  try {
    const fallback = await amazonListingScopeService.resolve();
    scopes.set(`${fallback.sellerId}:${fallback.marketplaceId}`, fallback);
  } catch { /* Stored connections can reconcile without environment credentials. */ }
  for (const connection of scopes.values()) {
    try {
      const scope = await amazonListingScopeService.resolveForSeller(connection.sellerId, connection.marketplaceId);
      await amazonListingImportService.importListings({ sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, client: scope.client });
    } catch (error) {
      logger.error({ error, sellerId: connection.sellerId, marketplaceId: connection.marketplaceId }, 'Scheduled Amazon listing import failed');
    }
  }
};

export const startAmazonListingScheduler = () => {
  // Always on startup (also when the schedule is off): imports cut off by the last stop are closed
  void amazonListingRepository.closeInterruptedSyncLogs()
    .then((count) => { if (count > 0) logger.warn({ count }, 'Closed Amazon listing imports interrupted by a server stop'); })
    .catch((error) => logger.error({ error: error instanceof Error ? error.message : 'Unknown error' }, 'Could not close interrupted Amazon listing imports'));
  if (!env.AMAZON_LISTING_AUTO_SYNC_ENABLED || !env.AMAZON_LISTING_IMPORT_ENABLED || task) return;
  if (!cron.validate(env.AMAZON_LISTING_SYNC_CRON)) {
    logger.error({ cron: env.AMAZON_LISTING_SYNC_CRON }, 'Amazon listing scheduler has an invalid cron expression');
    return;
  }
  task = cron.schedule(env.AMAZON_LISTING_SYNC_CRON, () => void importConfiguredScopes()
    .catch((error) => logger.error({ error: error instanceof Error ? error.message : 'Unknown reconciliation failure' },
      'Scheduled Amazon inventory reconciliation failed')));
  logger.info({ cron: env.AMAZON_LISTING_SYNC_CRON }, 'Amazon listing scheduler started');
};

export const stopAmazonListingScheduler = () => { task?.stop(); task = null; };
