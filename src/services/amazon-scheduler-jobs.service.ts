import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../models/prisma.js';
import { amazonListingScopeService } from './amazon-listing-scope.service.js';
import { importConfiguredScopes } from './amazon-listing-scheduler.service.js';
import { amazonOrderJobService } from './amazon-order-job.service.js';
import { processDue } from './amazon-retry-scheduler.service.js';

// Cloud Scheduler jobs (FIX-124). Each call runs the same work as the matching node-cron
// scheduler but waits for it to finish, because Cloud Run throttles CPU once the response is sent.

export class AmazonSchedulerJobsService {
  // Same seller scopes the node-cron order scheduler uses: stored OAuth connections plus the .env account
  async configuredScopes(): Promise<Array<{ sellerId: string; marketplaceId: string }>> {
    const connections = await prisma.amazonConnection.findMany({
      select: { sellerId: true, marketplaceId: true },
      distinct: ['sellerId', 'marketplaceId'],
    });
    const scopes = new Map(connections.map((connection) => [`${connection.sellerId}:${connection.marketplaceId}`, connection]));
    try {
      const fallback = await amazonListingScopeService.resolve();
      scopes.set(`${fallback.sellerId}:${fallback.marketplaceId}`, { sellerId: fallback.sellerId, marketplaceId: fallback.marketplaceId });
    } catch {
      // Stored OAuth scopes can still be synced when no environment fallback exists.
    }
    return [...scopes.values()];
  }

  async runOrderSync() {
    const results = [];
    for (const scope of await this.configuredScopes()) {
      const { job, existing } = await amazonOrderJobService.enqueue({
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        trigger: 'SCHEDULED',
      }, { background: false });
      if (existing) {
        // Another run (manual, notification or node-cron) already owns this scope
        results.push({ sellerId: scope.sellerId, marketplaceId: scope.marketplaceId, jobId: job.id, status: job.status, skipped: true, errorMessage: null });
        continue;
      }
      await amazonOrderJobService.run(BigInt(job.id));
      const finished = await amazonOrderJobService.getJob(job.id, scope.sellerId, scope.marketplaceId);
      results.push({
        sellerId: scope.sellerId,
        marketplaceId: scope.marketplaceId,
        jobId: job.id,
        status: finished?.status ?? 'UNKNOWN',
        skipped: false,
        fetched: finished?.fetched ?? 0,
        errorMessage: finished?.errorMessage ?? null,
      });
    }
    const failed = results.filter((result) => result.status === 'FAILED').length;
    if (failed > 0) logger.error({ results }, 'Scheduled Amazon order sync finished with failures (Cloud Scheduler)');
    return { scopes: results.length, failed, results };
  }

  async runListingSync() {
    if (!env.AMAZON_LISTING_IMPORT_ENABLED) return { skipped: true, reason: 'AMAZON_LISTING_IMPORT_ENABLED is off' };
    await importConfiguredScopes();
    return { skipped: false };
  }

  async runRetryQueue() {
    return { processed: await processDue() };
  }
}

export const amazonSchedulerJobsService = new AmazonSchedulerJobsService();
