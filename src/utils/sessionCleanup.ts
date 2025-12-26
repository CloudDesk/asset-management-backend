import cron from 'node-cron';
import { authSessionService } from '../services/authsession.service.js';
import { logger } from '../config/logger.js';

/**
 * Session Cleanup Scheduler
 * 
 * This replaces the need for pg_cron extension.
 * Runs cleanup tasks at scheduled intervals using node-cron.
 */

/**
 * Clean up expired sessions
 * Runs daily at 2:00 AM
 */
export const scheduleSessionCleanup = () => {
    // Run every day at 2:00 AM
    // Cron format: minute hour day month weekday
    const cleanupTask = cron.schedule('0 2 * * *', async () => {
        try {
            logger.info('Starting scheduled session cleanup...');
            const result = await authSessionService.cleanupExpiredSessions();
            logger.info(
                {
                    deletedCount: result.deletedCount,
                    deletedExpired: result.deletedExpired,
                    deletedRevoked: result.deletedRevoked,
                },
                'Session cleanup completed successfully'
            );
        } catch (error) {
            logger.error({ error }, 'Error during scheduled session cleanup');
        }
    });

    logger.info('Session cleanup scheduler started (runs daily at 2:00 AM)');

    return cleanupTask;
};

/**
 * Run cleanup immediately (useful for manual triggers or startup)
 */
export const runCleanupNow = async () => {
    try {
        logger.info('Running manual session cleanup...');
        const result = await authSessionService.cleanupExpiredSessions();
        logger.info(result, 'Manual session cleanup completed');
        return result;
    } catch (error) {
        logger.error({ error }, 'Error during manual session cleanup');
        throw error;
    }
};

/**
 * Optional: More aggressive cleanup - every 6 hours
 * Uncomment if you want more frequent cleanup
 */
/*
export const scheduleFrequentCleanup = () => {
  const cleanupTask = cron.schedule('0 *\/6 * * *', async () => {
    try {
      logger.info('Starting frequent session cleanup...');
      const result = await authSessionService.cleanupExpiredSessions();
      logger.info(result, 'Frequent session cleanup completed');
    } catch (error) {
      logger.error({ error }, 'Error during frequent session cleanup');
    }
  });

  logger.info('Frequent cleanup scheduler started (runs every 6 hours)');

  return cleanupTask;
};
*/

/**
 * Stop all scheduled tasks
 */
export const stopAllScheduledTasks = (tasks: cron.ScheduledTask[]) => {
    tasks.forEach(task => task.stop());
    logger.info('All scheduled session cleanup tasks stopped');
};
