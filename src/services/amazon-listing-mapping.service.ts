import { logger } from '../config/logger.js';
import {
  AmazonListingMappingPersistence,
  amazonListingRepository,
} from '../repositories/amazon-listing.repository.js';
import {
  AmazonListingsReadClient,
  amazonProductionListingsClient,
} from './amazon-production-listings.client.js';

export class AmazonListingMappingError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = 'AmazonListingMappingError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

type AmazonListingMappingServiceOptions = {
  repository?: AmazonListingMappingPersistence;
  connection?: Pick<AmazonListingsReadClient, 'getSellerId' | 'getMarketplaceId'>;
};

export class AmazonListingMappingService {
  private readonly repository: AmazonListingMappingPersistence;
  private readonly connection: Pick<AmazonListingsReadClient, 'getSellerId' | 'getMarketplaceId'>;

  constructor(options: AmazonListingMappingServiceOptions = {}) {
    this.repository = options.repository ?? amazonListingRepository;
    this.connection = options.connection ?? amazonProductionListingsClient;
  }

  async mapListing(input: {
    listingId: string;
    productId: string;
    unitsPerListing: number;
    allowRemap: boolean;
    requestedByUserId?: number;
    requestedByUserType?: string;
  }) {
    const result = await this.repository.mapListing({
      ...input,
      sellerId: this.connection.getSellerId(),
      marketplaceId: this.connection.getMarketplaceId(),
    });

    if (result.status === 'LISTING_NOT_FOUND') {
      throw new AmazonListingMappingError(
        'Amazon production listing was not found',
        404,
        'AMAZON_LISTING_NOT_FOUND'
      );
    }
    if (result.status === 'PRODUCT_NOT_FOUND') {
      throw new AmazonListingMappingError(
        'Nivaana product was not found',
        404,
        'NIVAANA_PRODUCT_NOT_FOUND'
      );
    }
    if (result.status === 'REMAP_REQUIRES_CONFIRMATION') {
      throw new AmazonListingMappingError(
        `Listing is already mapped to product ${result.currentProductId}; set allowRemap=true to replace it`,
        409,
        'AMAZON_LISTING_REMAP_CONFIRMATION_REQUIRED'
      );
    }

    logger.info(
      {
        listingId: input.listingId,
        productId: input.productId,
        unitsPerListing: input.unitsPerListing,
        remapConfirmed: input.allowRemap,
      },
      'Amazon listing mapped to Nivaana product without changing inventory'
    );
    return result.listing;
  }

  async unmapListing(
    listingId: string,
    context: { requestedByUserId?: number; requestedByUserType?: string } = {}
  ) {
    const listing = await this.repository.unmapListing({
      listingId,
      sellerId: this.connection.getSellerId(),
      marketplaceId: this.connection.getMarketplaceId(),
      ...context,
    });
    if (!listing) {
      throw new AmazonListingMappingError(
        'Amazon production listing was not found',
        404,
        'AMAZON_LISTING_NOT_FOUND'
      );
    }

    logger.info({ listingId }, 'Amazon listing unmapped without changing inventory');
    return listing;
  }
}

export const amazonListingMappingService = new AmazonListingMappingService();
