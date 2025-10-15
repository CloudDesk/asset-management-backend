/**
 * Create HTTP Task for Lock Cleanup
 *
 * @param merchantTransactionId - The merchant transaction ID to cleanup
 * @param delayInSeconds - Delay before task execution (default: 120 seconds = 2 minutes)
 * @returns Promise with task creation result
 */
export declare function createLockCleanupTask(merchantTransactionId: string, delayInSeconds?: number): Promise<{
    success: boolean;
    taskName?: string | undefined;
    error?: any;
}>;
/**
 * Create generic HTTP Task
 * Legacy support for your existing implementation
 *
 * @param merchantid - Transaction ID
 * @param inSeconds - Delay in seconds
 * @returns Promise with task creation result
 */
export declare function createHttpTask(merchantid: string, inSeconds?: number): Promise<{
    success: boolean;
    error?: any;
}>;
/**
 * Cancel/Delete a scheduled task
 *
 * @param taskName - Full task name from GCP
 * @returns Promise with deletion result
 */
export declare function cancelTask(taskName: string): Promise<{
    success: boolean;
    error?: any;
}>;
//# sourceMappingURL=gcpTasks.service.d.ts.map