import { env } from '../config/env.js';
import { prisma } from '../models/prisma.js';

export class AmazonProductionWriteDisabledError extends Error {
  readonly statusCode = 409;
  readonly code = 'AMAZON_PRODUCTION_WRITES_DISABLED';

  constructor(readonly reason: string) {
    super(`Amazon production writes are disabled${reason ? `: ${reason}` : ''}`);
    this.name = 'AmazonProductionWriteDisabledError';
  }
}

export class AmazonProductionWriteGuardService {
  async status(sellerId: string, marketplaceId: string) {
    const setting = await prisma.amazonOperationsSetting.findUnique({
      where: { sellerId_marketplaceId: { sellerId, marketplaceId } },
    });
    const environmentEnabled = env.AMAZON_PRODUCTION_WRITES_ENABLED && env.AMAZON_ENVIRONMENT === 'PRODUCTION';
    const paused = setting?.productionWritesPaused ?? false;
    return {
      environmentEnabled,
      paused,
      effectiveEnabled: environmentEnabled && !paused,
      pauseReason: setting?.pauseReason ?? null,
      pausedAt: setting?.pausedAt?.toISOString() ?? null,
    };
  }

  async assertEnabled(sellerId: string, marketplaceId: string) {
    const status = await this.status(sellerId, marketplaceId);
    if (!status.effectiveEnabled) {
      throw new AmazonProductionWriteDisabledError(
        status.paused ? status.pauseReason || 'paused in Operations' : 'backend environment switch is off'
      );
    }
    return status;
  }
}

export const amazonProductionWriteGuardService = new AmazonProductionWriteGuardService();
