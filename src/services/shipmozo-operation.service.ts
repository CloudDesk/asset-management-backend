import { Prisma } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { normalizeShipmozoRetryStage } from '../utils/shipmozo-workflow.js';

type OperationInput = {
  idempotencyKey: string;
  providerOrderId: string;
  orderId?: number | undefined;
  returnRequestId?: number | undefined;
  direction: 'forward' | 'reverse';
  operationType: string;
  requestPayload?: Record<string, unknown>;
};

const now = () => Date.now();

export class ShipmozoOperationConflictError extends Error {
  readonly statusCode = 409;

  constructor(message: string) {
    super(message);
    this.name = 'ShipmozoOperationConflictError';
  }
}

export class ShipmozoOperationService {
  async findLatest(filters: { providerOrderId?: string; awbNumber?: string; direction?: 'forward' | 'reverse' }) {
    return prisma.shipmozoOperation.findFirst({
      where: {
        ...(filters.providerOrderId ? { providerOrderId: filters.providerOrderId } : {}),
        ...(filters.awbNumber ? { awbNumber: filters.awbNumber } : {}),
        ...(filters.direction ? { direction: filters.direction } : {})
      },
      orderBy: { id: 'desc' }
    });
  }

  async begin(input: OperationInput) {
    const timestamp = now();
    const operation = await prisma.shipmozoOperation.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      create: {
        idempotencyKey: input.idempotencyKey,
        providerOrderId: input.providerOrderId,
        ...(input.orderId !== undefined ? { orderId: input.orderId } : {}),
        ...(input.returnRequestId !== undefined ? { returnRequestId: input.returnRequestId } : {}),
        direction: input.direction,
        operationType: input.operationType,
        ...(input.requestPayload ? { requestPayload: input.requestPayload as Prisma.InputJsonValue } : {}),
        createddate: timestamp,
        modifieddate: timestamp
      },
      update: {
        modifieddate: timestamp,
        failureReason: null
      }
    });

    const retryStage = normalizeShipmozoRetryStage(operation.stage);
    const claimed = await prisma.shipmozoOperation.updateMany({
      where: {
        id: operation.id,
        status: { in: ['pending', 'failed'] }
      },
      data: {
        status: 'syncing',
        stage: retryStage,
        modifieddate: timestamp,
        failureReason: null
      }
    });

    if (claimed.count !== 1) {
      throw new ShipmozoOperationConflictError(
        operation.status === 'syncing'
          ? `Shipmozo operation ${input.providerOrderId} is already being processed`
          : `Shipmozo operation ${input.providerOrderId} is already ${operation.status}`
      );
    }

    return prisma.shipmozoOperation.findUniqueOrThrow({ where: { id: operation.id } });
  }

  async stage(id: number, stage: string, data: {
    status?: string;
    awbNumber?: string;
    courierName?: string;
    providerReference?: string;
    providerResponse?: unknown;
    nextSyncAt?: number | null;
  } = {}) {
    if (stage.length > 50) throw new Error(`Invalid Shipmozo operation stage: ${stage}`);
    return prisma.shipmozoOperation.update({
      where: { id },
      data: {
        stage,
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.awbNumber !== undefined ? { awbNumber: data.awbNumber } : {}),
        ...(data.courierName !== undefined ? { courierName: data.courierName } : {}),
        ...(data.providerReference !== undefined ? { providerReference: data.providerReference } : {}),
        ...(data.providerResponse !== undefined ? { providerResponse: data.providerResponse as Prisma.InputJsonValue } : {}),
        ...(data.nextSyncAt !== undefined ? { nextSyncAt: data.nextSyncAt } : {}),
        modifieddate: now(),
        failureReason: null
      }
    });
  }

  async fail(id: number, stage: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const stableStage = normalizeShipmozoRetryStage(stage);
    return prisma.shipmozoOperation.update({
      where: { id },
      data: {
        stage: stableStage,
        status: 'failed',
        failureReason: message.slice(0, 4000),
        retryCount: { increment: 1 },
        modifieddate: now()
      }
    });
  }

  async complete(id: number, stage: string, status: 'completed' | 'cancelled' = 'completed') {
    const timestamp = now();
    return prisma.shipmozoOperation.update({
      where: { id },
      data: {
        stage,
        status,
        nextSyncAt: null,
        failureReason: null,
        completeddate: timestamp,
        modifieddate: timestamp
      }
    });
  }

  async list(filters: { status?: string | undefined; direction?: string | undefined; orderId?: number | undefined; returnRequestId?: number | undefined }) {
    return prisma.shipmozoOperation.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.direction ? { direction: filters.direction } : {}),
        ...(filters.orderId !== undefined ? { orderId: filters.orderId } : {}),
        ...(filters.returnRequestId !== undefined ? { returnRequestId: filters.returnRequestId } : {})
      },
      orderBy: { modifieddate: 'desc' },
      take: 100
    });
  }
}

export const shipmozoOperationService = new ShipmozoOperationService();
