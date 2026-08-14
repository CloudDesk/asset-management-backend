import cron, { ScheduledTask } from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { shipmozoTrackingSyncService } from '../services/shipmozo-tracking-sync.service.js';

let running = false;

export function scheduleShipmozoTrackingSync(): ScheduledTask | null {
  if (env.SHIPMOZO_TRACKING_SYNC_ENABLED !== 'true') {
    logger.info('Shipmozo tracking scheduler is disabled');
    return null;
  }
  if (!cron.validate(env.SHIPMOZO_TRACKING_SYNC_CRON)) {
    throw new Error(`Invalid SHIPMOZO_TRACKING_SYNC_CRON: ${env.SHIPMOZO_TRACKING_SYNC_CRON}`);
  }

  const task = cron.schedule(env.SHIPMOZO_TRACKING_SYNC_CRON, async () => {
    if (running) {
      logger.warn('Skipping overlapping Shipmozo tracking sync run');
      return;
    }
    running = true;
    try {
      const result = await shipmozoTrackingSyncService.runBatch();
      logger.info(result, 'Scheduled Shipmozo tracking sync completed');
    } catch (error) {
      logger.error({ error }, 'Scheduled Shipmozo tracking sync failed');
    } finally {
      running = false;
    }
  });

  logger.info(
    { cron: env.SHIPMOZO_TRACKING_SYNC_CRON, batchSize: env.SHIPMOZO_TRACKING_SYNC_BATCH_SIZE },
    'Shipmozo tracking scheduler started'
  );
  return task;
}
