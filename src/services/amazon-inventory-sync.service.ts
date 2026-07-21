import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../models/prisma.js';
import {
  amazonSandboxInventoryService,
  AmazonSandboxInventoryService,
  SandboxInventoryResult,
} from './amazon-sandbox-inventory.service.js';
import { amazonProductionInventoryService } from './amazon-production-inventory.service.js';

export type AmazonInventorySyncAction =
  | 'CREATED'
  | 'INCREASED'
  | 'DECREASED'
  | 'UNCHANGED';

export type AmazonInventorySyncResult = {
  status: 'SYNCED' | 'SKIPPED' | 'FAILED';
  action?: AmazonInventorySyncAction;
  sellerSku?: string;
  previousQuantity?: number;
  targetQuantity?: number;
  reason?: string;
};

export type AmazonInventorySyncContext = {
  platformStockId: string;
  productId: string;
  platform: string;
  sellerSku: string;
  productName: string;
  targetQuantity: number;
};

export interface AmazonSandboxInventoryClient {
  getInventorySummaries(nextToken?: string, sellerSku?: string): Promise<SandboxInventoryResult>;
  createInventoryItem(input: { sellerSku: string; productName: string }): Promise<unknown>;
  addInventory(sellerSku: string, quantity: number, idempotencyToken?: string): Promise<unknown>;
  depleteInventory(sellerSku: string, quantity: number): Promise<unknown>;
}

type AmazonInventorySyncServiceOptions = {
  client?: AmazonSandboxInventoryClient;
  enabled?: boolean;
  environment?: 'SANDBOX' | 'PRODUCTION';
  loadContext?: (platformStockId: string) => Promise<AmazonInventorySyncContext | null>;
};

const normalizeQuantity = (quantity: number): number => {
  if (!Number.isFinite(quantity)) {
    return 0;
  }

  return Math.max(0, Math.trunc(quantity));
};

export const selectMappedAmazonSellerSku = (
  mappings: Array<{ sellerSku: string }>
): string => {
  if (mappings.length === 0) {
    throw new Error('No mapped Amazon listing exists for this Nivaana product');
  }
  if (mappings.length > 1) {
    throw new Error('Multiple Amazon listings are mapped to this product; select a listing explicitly before syncing');
  }

  const sellerSku = mappings[0]?.sellerSku.trim();
  if (!sellerSku) {
    throw new Error('The mapped Amazon listing has no seller SKU');
  }
  return sellerSku;
};

export class AmazonInventorySyncService {
  private readonly client: AmazonSandboxInventoryClient;
  private readonly enabled: boolean;
  private readonly environment: 'SANDBOX' | 'PRODUCTION';
  private readonly loadContext: (platformStockId: string) => Promise<AmazonInventorySyncContext | null>;
  private readonly skuQueues = new Map<string, Promise<unknown>>();

  constructor(options: AmazonInventorySyncServiceOptions = {}) {
    this.client = options.client ?? amazonSandboxInventoryService;
    this.enabled = options.enabled ?? env.AMAZON_AUTO_SYNC_ENABLED;
    this.environment = options.environment ?? env.AMAZON_ENVIRONMENT;
    this.loadContext = options.loadContext ?? this.loadContextFromDatabase.bind(this);
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
    } catch (error: any) {
      const reason = this.getErrorMessage(error);
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

    if (this.environment === 'PRODUCTION') {
      return amazonProductionInventoryService.syncAutomaticPlatformStock(String(platformStockId));
    }

    const context = await this.loadContext(String(platformStockId));
    if (!context) {
      throw new Error(`PlatformStock ${platformStockId} was not found`);
    }

    if (context.platform.trim().toLowerCase() !== 'amazon') {
      return { status: 'SKIPPED', reason: 'Platform stock is not for Amazon' };
    }

    return this.enqueueBySku(context.sellerSku, () => this.syncContextWithRetry(context));
  }

  private async loadContextFromDatabase(platformStockId: string): Promise<AmazonInventorySyncContext | null> {
    const platformStock = await prisma.platformStock.findUnique({
      where: { id: BigInt(platformStockId) },
      select: {
        id: true,
        productid: true,
        platform: true,
        availableqty: true,
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!platformStock) {
      return null;
    }

    const mappings = await prisma.marketplaceListing.findMany({
      where: {
        marketplace: 'AMAZON',
        environment: 'PRODUCTION',
        mappingStatus: 'MAPPED',
        productId: platformStock.productid,
        marketplaceId: env.AMAZON_MARKETPLACE_ID,
        ...(env.AMAZON_SELLER_ID ? { sellerId: env.AMAZON_SELLER_ID } : {}),
      },
      select: { sellerSku: true },
      orderBy: { id: 'asc' },
      take: 2,
    });
    const sellerSku = selectMappedAmazonSellerSku(mappings);

    return {
      platformStockId: String(platformStock.id),
      productId: String(platformStock.productid),
      platform: platformStock.platform,
      sellerSku,
      productName: platformStock.product.name,
      targetQuantity: normalizeQuantity(Number(platformStock.availableqty)),
    };
  }

  private enqueueBySku<T>(sellerSku: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.skuQueues.get(sellerSku) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(operation);
    const tracked = run.finally(() => {
      if (this.skuQueues.get(sellerSku) === tracked) {
        this.skuQueues.delete(sellerSku);
      }
    });

    this.skuQueues.set(sellerSku, tracked);
    return tracked;
  }

  private async syncContextWithRetry(context: AmazonInventorySyncContext): Promise<AmazonInventorySyncResult> {
    const idempotencyToken = randomUUID();
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.syncContext(context, idempotencyToken);
      } catch (error) {
        lastError = error;
        if (attempt === 3 || !this.isRetryable(error)) {
          throw error;
        }

        logger.warn(
          { attempt, sellerSku: context.sellerSku, error: this.getErrorMessage(error) },
          'Retrying Amazon inventory synchronization'
        );
        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
      }
    }

    throw lastError;
  }

  private async syncContext(
    context: AmazonInventorySyncContext,
    idempotencyToken: string
  ): Promise<AmazonInventorySyncResult> {
    const targetQuantity = normalizeQuantity(context.targetQuantity);
    const remote = await this.client.getInventorySummaries(undefined, context.sellerSku);
    const remoteItem = remote.items.find((item) => item.sellerSku === context.sellerSku);
    const previousQuantity = normalizeQuantity(remoteItem?.fulfillableQuantity ?? 0);

    if (!remoteItem) {
      await this.client.createInventoryItem({
        sellerSku: context.sellerSku,
        productName: context.productName,
      });

      if (targetQuantity > 0) {
        await this.client.addInventory(context.sellerSku, targetQuantity, idempotencyToken);
      }

      return this.logSuccess(context, 'CREATED', previousQuantity, targetQuantity);
    }

    if (targetQuantity === previousQuantity) {
      return this.logSuccess(context, 'UNCHANGED', previousQuantity, targetQuantity);
    }

    if (targetQuantity > previousQuantity) {
      await this.client.addInventory(
        context.sellerSku,
        targetQuantity - previousQuantity,
        idempotencyToken
      );
      return this.logSuccess(context, 'INCREASED', previousQuantity, targetQuantity);
    }

    await this.client.depleteInventory(context.sellerSku, previousQuantity - targetQuantity);
    return this.logSuccess(context, 'DECREASED', previousQuantity, targetQuantity);
  }

  private logSuccess(
    context: AmazonInventorySyncContext,
    action: AmazonInventorySyncAction,
    previousQuantity: number,
    targetQuantity: number
  ): AmazonInventorySyncResult {
    logger.info(
      {
        action,
        productId: context.productId,
        platformStockId: context.platformStockId,
        sellerSku: context.sellerSku,
        previousQuantity,
        targetQuantity,
        environment: this.environment,
      },
      'Amazon inventory synchronized from Nivaana platform stock'
    );

    return {
      status: 'SYNCED',
      action,
      sellerSku: context.sellerSku,
      previousQuantity,
      targetQuantity,
    };
  }

  private isRetryable(error: unknown): boolean {
    const status = (error as any)?.response?.status;
    return status === undefined || status === 429 || status >= 500;
  }

  private getErrorMessage(error: unknown): string {
    const amazonErrors = (error as any)?.response?.data?.errors;
    if (Array.isArray(amazonErrors)) {
      const messages = amazonErrors
        .map((item: any) => item?.message)
        .filter((message: unknown): message is string => typeof message === 'string' && message.length > 0);
      if (messages.length > 0) {
        return messages.join('; ');
      }
    }

    return (error as any)?.message || 'Unknown Amazon inventory synchronization error';
  }
}

export const amazonInventorySyncService = new AmazonInventorySyncService({
  client: amazonSandboxInventoryService as AmazonSandboxInventoryService,
});
