// Moving Amazon listing mappings between databases (gap D7 / AMZ-PLAN-23).
// Product and listing IDs differ per database, so rows are matched by seller SKU (listing) and PUC (product).

export interface ExportedAmazonMapping {
  sellerId: string;
  marketplaceId: string;
  sellerSku: string;
  fulfilmentChannel: string;
  puc: string;
  productName: string;
  unitsPerListing: number;
}

export interface TargetListing {
  id: string;
  productId: string | null;
  unitsPerListing: number;
}

export type MappingTransferAction =
  | 'MAP'            // target listing unmapped → map it
  | 'UPDATE'         // already mapped to the same product, pack size differs
  | 'UNCHANGED'      // already identical
  | 'CONFLICT'       // mapped to a different product (applied only with --remap)
  | 'LISTING_MISSING' // target has not imported this listing (refresh Amazon listings there first)
  | 'PRODUCT_MISSING'; // no product with this PUC in the target

export interface MappingTransferStep {
  mapping: ExportedAmazonMapping;
  action: MappingTransferAction;
  listingId?: string;
  productId?: string;
}

export const listingKey = (sellerId: string, marketplaceId: string, sellerSku: string) =>
  `${sellerId}|${marketplaceId}|${sellerSku}`;

export const planMappingTransfer = (
  mappings: ExportedAmazonMapping[],
  targetListings: Map<string, TargetListing>,
  targetProductIdsByPuc: Map<string, string>,
): MappingTransferStep[] => mappings.map((mapping) => {
  const listing = targetListings.get(listingKey(mapping.sellerId, mapping.marketplaceId, mapping.sellerSku));
  if (!listing) return { mapping, action: 'LISTING_MISSING' };
  const productId = targetProductIdsByPuc.get(mapping.puc.trim().toUpperCase());
  if (!productId) return { mapping, action: 'PRODUCT_MISSING', listingId: listing.id };
  const base = { mapping, listingId: listing.id, productId };
  if (listing.productId === null) return { ...base, action: 'MAP' };
  if (listing.productId !== productId) return { ...base, action: 'CONFLICT' };
  return { ...base, action: listing.unitsPerListing === mapping.unitsPerListing ? 'UNCHANGED' : 'UPDATE' };
});

/** Steps that --apply writes; CONFLICT only with --remap */
export const stepsToApply = (steps: MappingTransferStep[], remap: boolean) =>
  steps.filter((step) => step.action === 'MAP' || step.action === 'UPDATE' || (remap && step.action === 'CONFLICT'));
