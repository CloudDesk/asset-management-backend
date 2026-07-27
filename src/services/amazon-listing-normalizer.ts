import {
  AmazonFbaInventorySummary,
  AmazonListingSummary,
  AmazonRawListing,
} from './amazon-production-listings.client.js';

export type AmazonFulfilmentChannel = 'MFN' | 'EASY_SHIP' | 'FBA' | 'UNKNOWN';

export type NormalizedAmazonListing = {
  marketplace: 'AMAZON';
  environment: 'PRODUCTION';
  marketplaceId: string;
  sellerId: string;
  sellerSku: string | null;
  asin: string | null;
  fnSku: string | null;
  title: string | null;
  productType: string | null;
  listingStatus: string;
  originalFulfilmentValue: string | null;
  fulfilmentChannel: AmazonFulfilmentChannel;
  publishedQuantity: number | null;
  fbaFulfillableQuantity: number | null;
  fbaReservedQuantity: number | null;
  fbaPendingOrderQuantity: number | null;
  fbaTotalQuantity: number | null;
  price: string | null;
  currency: string | null;
  amazonLastUpdatedAt: Date | null;
};

const uniqueStrings = (values: Array<string | null | undefined>): string[] => (
  [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))]
);

const normalizedDate = (value?: string): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizedPrice = (value?: string | number): string | null => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed.toFixed(2) : null;
};

const normalizedQuantity = (value?: number): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : null;

type AmazonAvailabilityValue = {
  fulfillmentChannelCode?: unknown;
  fulfillment_channel_code?: unknown;
  quantity?: unknown;
};

const availabilityQuantity = (availability: AmazonAvailabilityValue): number | null => {
  const channel = String(
    availability.fulfillmentChannelCode
      ?? availability.fulfillment_channel_code
      ?? ''
  ).trim().toUpperCase();
  const isSellerFulfilled = !channel
    || channel === 'DEFAULT'
    || channel === 'MFN'
    || channel === 'FBM'
    || channel.includes('EASY_SHIP');
  return isSellerFulfilled && typeof availability.quantity === 'number'
    ? normalizedQuantity(availability.quantity)
    : null;
};

export const extractAmazonSellerQuantity = (raw: AmazonRawListing): number | null => {
  for (const availability of raw.fulfillmentAvailability ?? []) {
    const quantity = availabilityQuantity(availability);
    if (quantity !== null) return quantity;
  }

  const attributeAvailability = raw.attributes?.fulfillment_availability;
  if (Array.isArray(attributeAvailability)) {
    for (const availability of attributeAvailability) {
      if (!availability || typeof availability !== 'object') continue;
      const quantity = availabilityQuantity(availability as AmazonAvailabilityValue);
      if (quantity !== null) return quantity;
    }
  }

  return null;
};

const extractRelevantAttributeValues = (attributes?: Record<string, unknown>): string[] => {
  if (!attributes) return [];
  const results: string[] = [];

  for (const [key, value] of Object.entries(attributes)) {
    if (!/(fulfil|fulfill|shipping_group|merchant_shipping|easy_ship)/i.test(key)) continue;

    const visit = (current: unknown): void => {
      if (typeof current === 'string' || typeof current === 'number' || typeof current === 'boolean') {
        results.push(`${key}=${String(current)}`);
        return;
      }
      if (Array.isArray(current)) {
        current.forEach(visit);
        return;
      }
      if (current && typeof current === 'object') {
        Object.values(current as Record<string, unknown>).forEach(visit);
      }
    };

    visit(value);
  }

  return uniqueStrings(results);
};

export const classifyAmazonFulfilment = (
  originalValue: string | null,
  hasFbaInventory: boolean,
  hasSellerManagedQuantity = false
): AmazonFulfilmentChannel => {
  const normalized = originalValue?.toUpperCase().replace(/[\s-]+/g, '_') ?? '';

  if (hasFbaInventory || /(^|[^A-Z])(FBA|AFN|AMAZON_(NA|EU|FE|IN))([^A-Z]|$)/.test(normalized)) {
    return 'FBA';
  }
  if (normalized.includes('EASY_SHIP') || normalized.includes('EASYSHIP')) {
    return 'EASY_SHIP';
  }
  if (
    /(^|[^A-Z])(MFN|FBM|MERCHANT_FULFILLED|MERCHANT)([^A-Z]|$)/.test(normalized)
    || /FULFILLMENT(?:CHANNELCODE|_CHANNEL_CODE|_AVAILABILITY)=DEFAULT/.test(normalized)
    || normalized === 'DEFAULT'
    || hasSellerManagedQuantity
  ) {
    return 'MFN';
  }
  return 'UNKNOWN';
};

export const isInactiveAmazonListing = (listingStatus: string): boolean => {
  const statuses = listingStatus.toUpperCase().split(',').map((value) => value.trim());
  return !statuses.some((status) => status === 'BUYABLE' || status === 'DISCOVERABLE' || status === 'ACTIVE');
};

export const normalizeAmazonListingStatus = (summaries?: AmazonListingSummary[]): string => {
  const summaryStatuses = (summaries ?? []).flatMap((summary) => (
    Array.isArray(summary.statuses)
      ? summary.statuses
      : Array.isArray(summary.status)
        ? summary.status
        : typeof summary.status === 'string'
          ? [summary.status]
          : []
  ));
  return uniqueStrings(summaryStatuses.map((status) => status.toUpperCase())).join(',') || 'UNKNOWN';
};

export const normalizeAmazonListing = (
  raw: AmazonRawListing,
  context: {
    sellerId: string;
    marketplaceId: string;
    fbaInventory?: AmazonFbaInventorySummary;
  }
): NormalizedAmazonListing => {
  const summary = raw.summaries?.find((item) => item.marketplaceId === context.marketplaceId)
    ?? raw.summaries?.[0];
  const offer = raw.offers?.find((item) => item.marketplaceId === context.marketplaceId)
    ?? raw.offers?.[0];
  const productType = raw.productTypes?.find((item) => item.marketplaceId === context.marketplaceId)
    ?? raw.productTypes?.[0];
  const fbaInventory = context.fbaInventory;

  const listingStatus = normalizeAmazonListingStatus(raw.summaries);

  const fulfilmentCodes = raw.fulfillmentAvailability?.map((item) => item.fulfillmentChannelCode) ?? [];
  const attributeValues = extractRelevantAttributeValues(raw.attributes);
  const originalValues = uniqueStrings([
    ...fulfilmentCodes,
    ...attributeValues,
    ...(fbaInventory ? ['FBA_INVENTORY'] : []),
  ]);
  const originalFulfilmentValue = originalValues.join('|') || null;
  const sellerQuantity = extractAmazonSellerQuantity(raw);
  const fulfilmentChannel = classifyAmazonFulfilment(
    originalFulfilmentValue,
    Boolean(fbaInventory),
    sellerQuantity !== null
  );
  const listingQuantities = (raw.fulfillmentAvailability ?? [])
    .map((item) => item.quantity)
    .filter((quantity): quantity is number => typeof quantity === 'number' && Number.isFinite(quantity));
  const fbaPublishedQuantity = normalizedQuantity(fbaInventory?.inventoryDetails?.fulfillableQuantity)
    ?? (listingQuantities.length > 0
      ? listingQuantities.reduce((total, quantity) => total + Math.max(0, Math.trunc(quantity)), 0)
      : normalizedQuantity(fbaInventory?.totalQuantity))
    ?? (fulfilmentCodes.some((code) => code?.toUpperCase().startsWith('AMAZON_')) ? 0 : null);
  const publishedQuantity = fulfilmentChannel === 'FBA'
    ? fbaPublishedQuantity
    : sellerQuantity !== null
      ? sellerQuantity
      : listingQuantities.length > 0
        ? listingQuantities.reduce((total, quantity) => total + Math.max(0, Math.trunc(quantity)), 0)
        : null;

  return {
    marketplace: 'AMAZON',
    environment: 'PRODUCTION',
    marketplaceId: context.marketplaceId,
    sellerId: context.sellerId,
    sellerSku: raw.sku?.trim() || null,
    asin: summary?.asin?.trim() || fbaInventory?.asin?.trim() || null,
    fnSku: fbaInventory?.fnSku?.trim() || null,
    title: summary?.itemName?.trim() || fbaInventory?.productName?.trim() || null,
    productType: productType?.productType?.trim() || summary?.productType?.trim() || null,
    listingStatus,
    originalFulfilmentValue,
    fulfilmentChannel,
    publishedQuantity,
    fbaFulfillableQuantity: normalizedQuantity(fbaInventory?.inventoryDetails?.fulfillableQuantity),
    fbaReservedQuantity: normalizedQuantity(fbaInventory?.inventoryDetails?.reservedQuantity?.totalReservedQuantity),
    fbaPendingOrderQuantity: normalizedQuantity(fbaInventory?.inventoryDetails?.reservedQuantity?.pendingCustomerOrderQuantity),
    fbaTotalQuantity: normalizedQuantity(fbaInventory?.totalQuantity),
    price: normalizedPrice(offer?.price?.amount),
    currency: offer?.price?.currencyCode?.trim() || null,
    amazonLastUpdatedAt: normalizedDate(summary?.lastUpdatedDate)
      ?? normalizedDate(fbaInventory?.lastUpdatedTime),
  };
};
