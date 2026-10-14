import { env } from '../config/env.js';
import { prisma } from '../models/prisma.js';
import { AmazonLwaTokenService } from './amazon-lwa-token.service.js';
import {
  AmazonListingsReadClient,
  AmazonProductionListingsClient,
  amazonProductionListingsClient,
} from './amazon-production-listings.client.js';
import { amazonTokenCryptoService } from './amazon-token-crypto.service.js';

export type AmazonListingScope = {
  sellerId: string;
  marketplaceId: string;
  client: AmazonListingsReadClient;
  source: 'OAUTH' | 'ENVIRONMENT_FALLBACK';
};

export class AmazonListingScopeError extends Error {
  readonly statusCode = 409;
  readonly code = 'AMAZON_CONNECTION_REQUIRED';
  constructor() { super('Connect your Amazon seller account before using Amazon integration'); }
}

export class AmazonListingScopeService {
  private scopeFromConnection(connection: { sellerId: string; marketplaceId: string; refreshToken: string }): AmazonListingScope {
    const refreshToken = amazonTokenCryptoService.decrypt(connection.refreshToken);
    const accessTokenProvider = new AmazonLwaTokenService({
      ...(env.AMAZON_CLIENT_ID ? { clientId: env.AMAZON_CLIENT_ID } : {}),
      ...(env.AMAZON_CLIENT_SECRET ? { clientSecret: env.AMAZON_CLIENT_SECRET } : {}),
      refreshToken,
    });
    return {
      sellerId: connection.sellerId,
      marketplaceId: connection.marketplaceId,
      client: new AmazonProductionListingsClient({
        accessTokenProvider,
        sellerId: connection.sellerId,
        marketplaceId: connection.marketplaceId,
      }),
      source: 'OAUTH',
    };
  }

  async resolve(userId?: number, userType?: string): Promise<AmazonListingScope> {
    const storedUserType = userType === 'ecommerce' ? 'users' : 'inventoryusers';
    const connection = userId === undefined
      ? null
      : await prisma.amazonConnection.findFirst({
          where: { userId, userType: storedUserType },
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        });

    if (connection) {
      return this.scopeFromConnection(connection);
    }

    // Preserve the configured shared-account flow when no personal OAuth
    // connection exists. Route authentication and channel permissions still apply.
    return {
      sellerId: amazonProductionListingsClient.getSellerId(),
      marketplaceId: amazonProductionListingsClient.getMarketplaceId(),
      client: amazonProductionListingsClient,
      source: 'ENVIRONMENT_FALLBACK',
    };
  }

  async resolveForSeller(sellerId: string, marketplaceId: string): Promise<AmazonListingScope> {
    const connection = await prisma.amazonConnection.findFirst({
      where: { sellerId, marketplaceId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    if (connection) return this.scopeFromConnection(connection);

    const fallback = await this.resolve();
    if (fallback.sellerId !== sellerId || fallback.marketplaceId !== marketplaceId) {
      throw new Error(`No Amazon OAuth connection is available for seller ${sellerId}`);
    }
    return fallback;
  }
}

export const amazonListingScopeService = new AmazonListingScopeService();
