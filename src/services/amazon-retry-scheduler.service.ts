import cron, { ScheduledTask } from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../models/prisma.js';
import { amazonListingScopeService } from './amazon-listing-scope.service.js';
import { amazonOperationsService } from './amazon-operations.service.js';

let task: ScheduledTask | null = null;
let running = false;

const processDue = async () => {
  if (running) return;
  running = true;
  try {
    const jobs = await prisma.amazonRetryJob.findMany({ where: { status: 'QUEUED', nextAttemptAt: { lte: new Date() } }, orderBy: { nextAttemptAt: 'asc' }, take: 10 });
    for (const job of jobs) {
      try {
        const scope = await amazonListingScopeService.resolveForSeller(job.sellerId, job.marketplaceId);
        await amazonOperationsService.runRetry(scope, String(job.id));
      } catch (error) {
        logger.warn({ error, retryJobId: String(job.id) }, 'Amazon retry job failed');
      }
    }
  } finally { running = false; }
};

export const startAmazonRetryScheduler = () => {
  if (!env.AMAZON_RETRY_WORKER_ENABLED || task) return;
  if (!cron.validate(env.AMAZON_RETRY_WORKER_CRON)) {
    logger.error({ cron: env.AMAZON_RETRY_WORKER_CRON }, 'Amazon retry scheduler has an invalid cron expression');
    return;
  }
  task = cron.schedule(env.AMAZON_RETRY_WORKER_CRON, () => void processDue());
  logger.info({ cron: env.AMAZON_RETRY_WORKER_CRON }, 'Amazon retry scheduler started');
};

export const stopAmazonRetryScheduler = () => { task?.stop(); task = null; };
