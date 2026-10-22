/**
 * Quantity Nivaana publishes to a seller-fulfilled Amazon listing:
 * Nivaana "amazon" platform stock ÷ units per listing (pack size), rounded down, never negative.
 * Shared by Stock Sync and the listing list so both always show the same target.
 */
export const calculateAmazonTargetQuantity = (availableQuantity: number, unitsPerListing: number) =>
  Math.floor(Math.max(0, Math.trunc(availableQuantity)) / Math.max(1, Math.trunc(unitsPerListing)));
