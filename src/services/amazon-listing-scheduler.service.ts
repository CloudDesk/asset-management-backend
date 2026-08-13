import cron, { ScheduledTask } from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../models/prisma.js';
import { amazonListingImportService } from './amazon-listing-import.service.js';
import { amazonListingScopeService } from './amazon-listing-scope.service.js';

let task: ScheduledTask | null = null;

const importConfiguredScopes = async () => {
  const connections = await prisma.amazonConnection.findMany({ select: { sellerId: true, marketplaceId: true }, distinct: ['sellerId', 'marketplaceId'] });
  for (const connection of connections) {
    try {
      const scope = await amazonListingScopeService.resolveForSeller(connection.sellerId, connection.marketplaceId);
      await amazonListingImportService.importListings({ sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, client: scope.client });
    } catch (error) {
      logger.error({ error, sellerId: connection.sellerId, marketplaceId: connection.marketplaceId }, 'Scheduled Amazon listing import failed');
    }
  }
};

export const startAmazonListingScheduler = () => {
  if (!env.AMAZON_LISTING_AUTO_SYNC_ENABLED || !env.AMAZON_LISTING_IMPORT_ENABLED || task) return;
  if (!cron.validate(env.AMAZON_LISTING_SYNC_CRON)) {
    logger.error({ cron: env.AMAZON_LISTING_SYNC_CRON }, 'Amazon listing scheduler has an invalid cron expression');
    return;
  }
  task = cron.schedule(env.AMAZON_LISTING_SYNC_CRON, () => void importConfiguredScopes());
  logger.info({ cron: env.AMAZON_LISTING_SYNC_CRON }, 'Amazon listing scheduler started');
};

export const stopAmazonListingScheduler = () => { task?.stop(); task = null; };
