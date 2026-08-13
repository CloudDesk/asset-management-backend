import { amazonListingRepository } from '../repositories/amazon-listing.repository.js';
import {
  AmazonListingMappingError,
  amazonListingMappingService,
} from './amazon-listing-mapping.service.js';

type ListingScope = { sellerId: string; marketplaceId: string };
type Actor = { requestedByUserId?: number; requestedByUserType?: string };

export class AmazonListingWorkspaceService {
  async getDetails(listingId: string, scope: ListingScope) {
    const details = await amazonListingRepository.getListingDetails({ listingId, ...scope });
    if (!details) throw this.notFound();
    return details;
  }

  async getSuggestions(listingId: string, scope: ListingScope) {
    const suggestions = await amazonListingRepository.suggestProducts({ listingId, ...scope });
    if (!suggestions) throw this.notFound();
    return suggestions;
  }

  async getAudits(listingId: string, scope: ListingScope) {
    const audits = await amazonListingRepository.listMappingAudits({ listingId, ...scope });
    if (!audits) throw this.notFound();
    return audits;
  }

  async bulkMap(
    items: Array<{ listingId: string; productId: string; unitsPerListing: number; allowRemap: boolean }>,
    scope: ListingScope,
    actor: Actor
  ) {
    const results: Array<{
      listingId: string;
      success: boolean;
      listing?: Record<string, unknown>;
      code?: string;
      message?: string;
    }> = [];

    for (const item of items) {
      try {
        const listing = await amazonListingMappingService.mapListing({ ...item, ...scope, ...actor });
        results.push({ listingId: item.listingId, success: true, listing });
      } catch (error) {
        const mappingError = error instanceof AmazonListingMappingError
          ? error
          : new AmazonListingMappingError('Amazon listing mapping failed', 500, 'AMAZON_LISTING_MAPPING_FAILED');
        results.push({
          listingId: item.listingId,
          success: false,
          code: mappingError.code,
          message: mappingError.message,
        });
      }
    }

    const succeeded = results.filter((result) => result.success).length;
    return { total: results.length, succeeded, failed: results.length - succeeded, results };
  }

  private notFound() {
    return new AmazonListingMappingError(
      'Amazon production listing was not found',
      404,
      'AMAZON_LISTING_NOT_FOUND'
    );
  }
}

export const amazonListingWorkspaceService = new AmazonListingWorkspaceService();
