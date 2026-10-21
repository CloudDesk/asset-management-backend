import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../models/prisma.js';
import { amazonOperationsService } from './amazon-operations.service.js';
import { amazonOrderJobService } from './amazon-order-job.service.js';

test('duplicate queued retries reuse one job and concurrent runners claim once', async () => {
  const restores: Array<() => void> = [];
  const replace = (target: any, key: string, value: any) => {
    const original = target[key]; target[key] = value; restores.push(() => { target[key] = original; });
  };
  let job: any = null;
  let enqueueCalls = 0;
  const scope: any = { sellerId: 'SELLER', marketplaceId: 'MARKET' };
  try {
    replace(prisma, '$transaction', async (work: any) => work(prisma));
    replace(prisma, '$executeRaw', async () => 1);
    replace(prisma.amazonRetryJob, 'findFirst', async () => job ? { ...job } : null);
    replace(prisma.amazonRetryJob, 'create', async ({ data }: any) => {
      job = { ...data, id: 1n, status: 'QUEUED', attempts: 0, nextAttemptAt: new Date(),
        requestedByUserId: null, requestedByUserType: null }; return job;
    });
    replace(prisma.amazonRetryJob, 'updateMany', async () => {
      if (job.status !== 'QUEUED') return { count: 0 };
      job.status = 'RUNNING'; return { count: 1 };
    });
    replace(prisma.amazonRetryJob, 'update', async ({ data }: any) => Object.assign(job, data));
    replace(amazonOrderJobService, 'enqueue', async () => {
      ++enqueueCalls; await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const input = { type: 'ORDER_IMPORT', resourceId: '1' };
    const first = await amazonOperationsService.enqueueRetry(scope, input, {});
    const second = await amazonOperationsService.enqueueRetry(scope, input, {});
    assert.equal(first.id, second.id);
    await Promise.all([amazonOperationsService.runRetry(scope, first.id), amazonOperationsService.runRetry(scope, first.id)]);
    assert.equal(enqueueCalls, 1);
    assert.equal(job.status, 'SUCCEEDED');
  } finally { restores.reverse().forEach((restore) => restore()); }
});
