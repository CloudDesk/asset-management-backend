import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { amazonListingScopeService } from './amazon-listing-scope.service.js';
import { amazonOrderImportService } from './amazon-order-import.service.js';

export type AmazonOrderJobTrigger = 'MANUAL' | 'SCHEDULED' | 'NOTIFICATION';

const serializeJob = (job: any) => ({
  id: String(job.id),
  sellerId: job.sellerId,
  marketplaceId: job.marketplaceId,
  mode: job.mode,
  trigger: job.trigger,
  status: job.status,
  fetched: job.fetched,
  created: job.created,
  updated: job.updated,
  unmapped: job.unmapped,
  cancelled: job.cancelled,
  pagesProcessed: job.pagesProcessed,
  searchStart: job.searchStart?.toISOString() ?? null,
  errorMessage: job.errorMessage,
  startedAt: job.startedAt?.toISOString() ?? null,
  finishedAt: job.finishedAt?.toISOString() ?? null,
  createdAt: job.createdAt.toISOString(),
  updatedAt: job.updatedAt.toISOString(),
});

export class AmazonOrderJobService {
  private running = new Set<string>();

  async enqueue(input: {
    sellerId: string;
    marketplaceId: string;
    fullHistory?: boolean;
    trigger: AmazonOrderJobTrigger;
    requestedByUserId?: number;
    requestedByUserType?: string;
  }) {
    const activeKey = `${input.sellerId}:${input.marketplaceId}`;
    const existing = await prisma.amazonOrderImportJob.findUnique({ where: { activeKey } });
    if (existing) return { job: serializeJob(existing), existing: true };

    try {
      const job = await prisma.amazonOrderImportJob.create({
        data: {
          sellerId: input.sellerId,
          marketplaceId: input.marketplaceId,
          mode: input.fullHistory ? 'FULL_HISTORY' : 'INCREMENTAL',
          trigger: input.trigger,
          status: 'QUEUED',
          activeKey,
          ...(input.requestedByUserId !== undefined ? { requestedByUserId: input.requestedByUserId } : {}),
          ...(input.requestedByUserType !== undefined ? { requestedByUserType: input.requestedByUserType } : {}),
        },
      });
      queueMicrotask(() => void this.run(job.id));
      return { job: serializeJob(job), existing: false };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrent = await prisma.amazonOrderImportJob.findUnique({ where: { activeKey } });
        if (concurrent) return { job: serializeJob(concurrent), existing: true };
      }
      throw error;
    }
  }

  async run(jobId: bigint) {
    const key = String(jobId);
    if (this.running.has(key)) return;
    this.running.add(key);
    try {
      const job = await prisma.amazonOrderImportJob.findUnique({ where: { id: jobId } });
      if (!job || !['QUEUED', 'RUNNING'].includes(job.status)) return;
      await prisma.amazonOrderImportJob.update({
        where: { id: job.id },
        data: { status: 'RUNNING', startedAt: job.startedAt ?? new Date(), errorMessage: null },
      });
      const scope = await amazonListingScopeService.resolveForSeller(job.sellerId, job.marketplaceId);
      const result = await amazonOrderImportService.importOrders(scope, {
        ...(job.requestedByUserId !== null ? { requestedByUserId: job.requestedByUserId } : {}),
        ...(job.requestedByUserType !== null ? { requestedByUserType: job.requestedByUserType } : {}),
      }, { fullHistory: job.mode === 'FULL_HISTORY' }, async (progress) => {
        await prisma.amazonOrderImportJob.update({
          where: { id: job.id },
          data: {
            fetched: progress.fetched,
            created: progress.created,
            updated: progress.updated,
            unmapped: progress.unmapped,
            cancelled: progress.cancelled,
            pagesProcessed: progress.pagesProcessed,
            searchStart: new Date(progress.searchStart),
          },
        });
      });
      await prisma.$transaction([
        prisma.amazonOrderImportJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            activeKey: null,
            fetched: result.fetched,
            created: result.created,
            updated: result.updated,
            unmapped: result.unmapped,
            cancelled: result.cancelled,
            pagesProcessed: result.pagesProcessed,
            searchStart: new Date(result.searchStart),
            finishedAt: new Date(),
          },
        }),
        prisma.amazonOrderNotification.updateMany({
          where: { jobId: job.id },
          data: { status: 'PROCESSED', processedAt: new Date(), errorMessage: null },
        }),
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Amazon order import job failed';
      await prisma.$transaction([
        prisma.amazonOrderImportJob.update({
          where: { id: jobId },
          data: { status: 'FAILED', activeKey: null, errorMessage: message, finishedAt: new Date() },
        }),
        prisma.amazonOrderNotification.updateMany({
          where: { jobId },
          data: { status: 'FAILED', errorMessage: message, processedAt: new Date() },
        }),
      ]).catch(() => undefined);
    } finally {
      this.running.delete(key);
    }
  }

  async getJob(jobId: string, sellerId: string, marketplaceId: string) {
    if (!/^\d+$/.test(jobId)) return null;
    const job = await prisma.amazonOrderImportJob.findFirst({
      where: { id: BigInt(jobId), sellerId, marketplaceId },
    });
    return job ? serializeJob(job) : null;
  }

  async getLatestJob(sellerId: string, marketplaceId: string) {
    const job = await prisma.amazonOrderImportJob.findFirst({
      where: { sellerId, marketplaceId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return job ? serializeJob(job) : null;
  }

  async recoverPendingJobs() {
    const pending = await prisma.amazonOrderImportJob.findMany({
      where: { status: { in: ['QUEUED', 'RUNNING'] } },
      orderBy: { createdAt: 'asc' },
    });
    for (const job of pending) {
      await prisma.amazonOrderImportJob.update({
        where: { id: job.id },
        data: {
          status: 'QUEUED',
          startedAt: null,
          finishedAt: null,
          fetched: 0,
          created: 0,
          updated: 0,
          unmapped: 0,
          cancelled: 0,
          pagesProcessed: 0,
          searchStart: null,
          errorMessage: null,
        },
      });
      queueMicrotask(() => void this.run(job.id));
    }
  }
}

export const amazonOrderJobService = new AmazonOrderJobService();
