import { prisma } from '../models/prisma.js';

export type AmazonApiObservation = {
  sellerId: string;
  marketplaceId: string;
  method: string;
  path: string;
  statusCode: number;
  rateLimit: string | null;
  requestId: string | null;
  retryAfter: string | null;
};

export interface AmazonApiTelemetryRecorder {
  record(observation: AmazonApiObservation): Promise<void>;
}

export const normalizeAmazonOperation = (method: string, path: string) => {
  const normalizedPath = path
    .replace(/(\/listings\/2021-08-01\/items\/)[^/]+(\/[^/]+)?$/, '$1:resource$2')
    .replace(/(\/orders\/v0\/orders\/)[^/]+/, '$1:orderId')
    .replace(/(\/notifications\/v1\/subscriptions\/)[^/]+/, '$1:notificationType');
  return `${method.toUpperCase()} ${normalizedPath}`.slice(0, 120);
};

export class AmazonApiTelemetryService implements AmazonApiTelemetryRecorder {
  async record(observation: AmazonApiObservation) {
    const operation = normalizeAmazonOperation(observation.method, observation.path);
    const data = {
      method: observation.method.toUpperCase(),
      path: observation.path,
      statusCode: observation.statusCode,
      rateLimit: observation.rateLimit,
      requestId: observation.requestId,
      retryAfter: observation.retryAfter,
      throttled: observation.statusCode === 429,
      successful: observation.statusCode >= 200 && observation.statusCode < 300,
      observedAt: new Date(),
    };
    await prisma.amazonApiTelemetry.upsert({
      where: { sellerId_marketplaceId_operation: { sellerId: observation.sellerId, marketplaceId: observation.marketplaceId, operation } },
      create: { sellerId: observation.sellerId, marketplaceId: observation.marketplaceId, operation, ...data },
      update: data,
    });
  }

  async health(sellerId: string, marketplaceId: string) {
    const [latest, recentThrottles] = await Promise.all([
      prisma.amazonApiTelemetry.findMany({ where: { sellerId, marketplaceId }, orderBy: { observedAt: 'desc' }, take: 10 }),
      prisma.amazonApiTelemetry.count({ where: { sellerId, marketplaceId, throttled: true, observedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } }),
    ]);
    const lastWithLimit = latest.find((item) => item.rateLimit !== null);
    return {
      status: recentThrottles > 0 ? 'THROTTLED_RECENTLY' : latest.length ? 'OBSERVED' : 'NOT_OBSERVED',
      lastObservedLimit: lastWithLimit?.rateLimit ?? null,
      lastObservedAt: latest[0]?.observedAt.toISOString() ?? null,
      lastStatusCode: latest[0]?.statusCode ?? null,
      lastRequestId: latest[0]?.requestId ?? null,
      throttlesLastHour: recentThrottles,
      operations: latest.map((item) => ({
        operation: item.operation,
        statusCode: item.statusCode,
        rateLimit: item.rateLimit,
        requestId: item.requestId,
        throttled: item.throttled,
        observedAt: item.observedAt.toISOString(),
      })),
      note: lastWithLimit ? null : 'Amazon has not supplied x-amzn-RateLimit-Limit on an observed response yet.',
    };
  }
}

export const amazonApiTelemetryService = new AmazonApiTelemetryService();
