import { CloudTasksClient } from "@google-cloud/tasks";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { logger } from '../config/logger.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// GCP Configuration from environment variables
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'nivaana';
const GCP_PROJECT_QUEUE = process.env.GCP_PROJECT_QUEUE || 'nivaana-dev';
const GCP_PROJECT_LOCATION = process.env.GCP_PROJECT_LOCATION || 'asia-south1';
const API_BASE_URL = process.env.API_BASE_URL || '=https://nivaana-dev-715569764663.asia-south1.run.app';
// Lock cleanup configuration
const LOCK_CLEANUP_DELAY_SECONDS = parseInt(process.env.LOCK_CLEANUP_DELAY_SECONDS || '120'); // 2 minutes default (changed from 15 minutes)
let client;
// Initialize CloudTasksClient
try {
    client = new CloudTasksClient();
    logger.info('CloudTasksClient initialized successfully');
}
catch (error) {
    logger.error({ error: error.message }, 'Error initializing CloudTasksClient');
    // Don't exit - let app continue without GCP Tasks (will log errors on task creation)
}
/**
 * Create HTTP Task for Lock Cleanup
 *
 * @param merchantTransactionId - The merchant transaction ID to cleanup
 * @param delayInSeconds - Delay before task execution (default: 120 seconds = 2 minutes)
 * @returns Promise with task creation result
 */
export async function createLockCleanupTask(merchantTransactionId, delayInSeconds = LOCK_CLEANUP_DELAY_SECONDS) {
    try {
        if (!client) {
            throw new Error('CloudTasksClient not initialized');
        }
        if (!GCP_PROJECT_ID || !GCP_PROJECT_QUEUE || !GCP_PROJECT_LOCATION) {
            throw new Error('GCP configuration missing. Check environment variables.');
        }
        logger.info({
            merchantTransactionId,
            delayInSeconds,
            queue: GCP_PROJECT_QUEUE,
            location: GCP_PROJECT_LOCATION
        }, 'Creating lock cleanup task');
        // Prepare payload
        const payload = {
            merchantTransactionId,
            createdAt: new Date().toISOString(),
            action: 'release_expired_lock'
        };
        const payloadString = JSON.stringify(payload);
        // Queue path
        const parent = client.queuePath(GCP_PROJECT_ID, GCP_PROJECT_LOCATION, GCP_PROJECT_QUEUE);
        // Task URL - your backend cleanup endpoint
        const taskUrl = `${API_BASE_URL}/v1/phonepe/cleanup-lock`;
        // Create task
        const task = {
            httpRequest: {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payloadString).toString(),
                },
                httpMethod: 'POST',
                url: taskUrl,
                body: Buffer.from(payloadString).toString('base64'),
            },
        };
        // Schedule task with delay
        if (delayInSeconds && delayInSeconds > 0) {
            task.scheduleTime = {
                seconds: Math.floor(Date.now() / 1000) + delayInSeconds,
            };
        }
        const request = { parent, task };
        // Create the task
        const [response] = await client.createTask(request);
        logger.info({
            merchantTransactionId,
            taskName: response.name,
            scheduledTime: response.scheduleTime,
            delayInSeconds
        }, 'Lock cleanup task created successfully');
        return {
            success: true,
            taskName: response.name || undefined
        };
    }
    catch (error) {
        logger.error({
            error: error.message,
            stack: error.stack,
            merchantTransactionId,
            delayInSeconds
        }, 'Error creating lock cleanup task');
        return {
            success: false,
            error: error.message
        };
    }
}
/**
 * Create generic HTTP Task
 * Legacy support for your existing implementation
 *
 * @param merchantid - Transaction ID
 * @param inSeconds - Delay in seconds
 * @returns Promise with task creation result
 */
export async function createHttpTask(merchantid, inSeconds = 120) {
    try {
        logger.info({ merchantid, inSeconds }, 'INSIDE TASK - Legacy createHttpTask');
        if (!client) {
            throw new Error('CloudTasksClient not initialized');
        }
        const payloadString = JSON.stringify({ merchantid });
        const parent = client.queuePath(GCP_PROJECT_ID, GCP_PROJECT_LOCATION, GCP_PROJECT_QUEUE);
        const url = process.env.GCP_TASK_URL || `${API_BASE_URL}/v1/phonepe/cleanup-lock`;
        const task = {
            httpRequest: {
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payloadString).toString(),
                },
                httpMethod: 'POST',
                url,
                body: Buffer.from(payloadString).toString('base64'),
            },
        };
        if (inSeconds) {
            task.scheduleTime = {
                seconds: Math.floor(Date.now() / 1000) + parseInt(inSeconds.toString()),
            };
        }
        const request = { parent, task };
        const [response] = await client.createTask(request);
        logger.info({ merchantid, taskName: response.name }, 'Legacy task created successfully');
        return { success: true };
    }
    catch (error) {
        logger.error({ error: error.message, merchantid }, 'Error in createHttpTask');
        return { success: false, error };
    }
}
/**
 * Cancel/Delete a scheduled task
 *
 * @param taskName - Full task name from GCP
 * @returns Promise with deletion result
 */
export async function cancelTask(taskName) {
    try {
        if (!client) {
            throw new Error('CloudTasksClient not initialized');
        }
        await client.deleteTask({ name: taskName });
        logger.info({ taskName }, 'Task cancelled successfully');
        return { success: true };
    }
    catch (error) {
        logger.error({ error: error.message, taskName }, 'Error cancelling task');
        return { success: false, error: error.message };
    }
}
//# sourceMappingURL=gcpTasks.service.js.map