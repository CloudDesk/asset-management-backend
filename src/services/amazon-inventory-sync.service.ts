import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { amazonProductionInventoryService } from './amazon-production-inventory.service.js';

// Automatic Amazon stock sync after a Nivaana stock change. Only the production path exists:
// the Amazon sandbox branch (virtual FBA inventory) was removed with AMZ-PLAN-22 (FIX-137) — sandbox
// has no real data, and outside AMAZON_ENVIRONMENT=PRODUCTION nothing is published.

export type AmazonInventorySyncResult = {
  status: 'SYNCED' | 'SKIPPED' | 'FAILED';
  reason?: string;
  results?: Array<Record<string, unknown>>;
};

type AmazonInventorySyncServiceOptions = {
  enabled?: boolean;
  environment?: 'SANDBOX' | 'PRODUCTION';
  syncProduction?: (platformStockId: string) => Promise<AmazonInventorySyncResult>;
};

export class AmazonInventorySyncService {
  private readonly enabled: boolean;
  private readonly environment: 'SANDBOX' | 'PRODUCTION';
  private readonly syncProduction: (platformStockId: string) => Promise<AmazonInventorySyncResult>;

  constructor(options: AmazonInventorySyncServiceOptions = {}) {
    this.enabled = options.enabled ?? env.AMAZON_AUTO_SYNC_ENABLED;
    this.environment = options.environment ?? env.AMAZON_ENVIRONMENT;
    this.syncProduction = options.syncProduction
      ?? ((platformStockId) => amazonProductionInventoryService.syncAutomaticPlatformStock(platformStockId));
  }

  async syncAfterPlatformStockChange(platformStock: Record<string, unknown> | null): Promise<AmazonInventorySyncResult> {
    if (!this.enabled) {
      return { status: 'SKIPPED', reason: 'Amazon automatic inventory sync is disabled' };
    }

    const platform = String(platformStock?.platform ?? '').trim().toLowerCase();
    if (platform !== 'amazon') {
      return { status: 'SKIPPED', reason: 'Platform stock is not for Amazon' };
    }

    const platformStockId = platformStock?.id;
    if (platformStockId === undefined || platformStockId === null) {
      const result: AmazonInventorySyncResult = {
        status: 'FAILED',
        reason: 'Amazon platform stock has no identifier',
      };
      logger.error({ platform }, result.reason);
      return result;
    }

    try {
      return await this.syncPlatformStockById(String(platformStockId));
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'Amazon inventory synchronization failed';
      logger.error(
        { error: reason, platformStockId: String(platformStockId) },
        'Amazon inventory synchronization failed after Nivaana stock update'
      );

      return { status: 'FAILED', reason };
    }
  }

  async syncPlatformStockById(platformStockId: string | number | bigint): Promise<AmazonInventorySyncResult> {
    if (!this.enabled) {
      return { status: 'SKIPPED', reason: 'Amazon automatic inventory sync is disabled' };
    }
    if (this.environment !== 'PRODUCTION') {
      return { status: 'SKIPPED', reason: 'Amazon stock is published only with AMAZON_ENVIRONMENT=PRODUCTION' };
    }
    return this.syncProduction(String(platformStockId));
  }
}

export const amazonInventorySyncService = new AmazonInventorySyncService();
