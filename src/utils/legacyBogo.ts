export interface LegacyBogoAction {
  buy_quantity?: unknown;
  get_quantity?: unknown;
  max_free_items?: unknown;
  product_ids?: unknown;
}

export interface LegacyBogoItem {
  product_id: string;
  quantity: number;
  price: number;
}

export interface LegacyBogoAllocation {
  item: LegacyBogoItem;
  freeItems: number;
  discount: number;
}

const positiveInteger = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const productIds = (value: unknown): Set<string> => {
  if (Array.isArray(value)) return new Set(value.map(String));
  if (typeof value !== 'string' || !value.trim()) return new Set();
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return new Set(parsed.map(String));
  } catch {
    // Fall through to the comma-separated legacy representation.
  }
  return new Set(value.split(',').map((item) => item.trim()).filter(Boolean));
};

/**
 * Legacy carts include both the paid and free units in item.quantity.
 * A Buy X Get Y application therefore consumes X + Y displayed units.
 */
export function allocateLegacyBogoDiscounts(
  action: LegacyBogoAction | null | undefined,
  items: LegacyBogoItem[],
): LegacyBogoAllocation[] {
  const buyQuantity = positiveInteger(action?.buy_quantity, 1);
  const getQuantity = positiveInteger(action?.get_quantity, 1);
  const unitsPerApplication = buyQuantity + getQuantity;
  const eligibleProductIds = productIds(action?.product_ids);
  const configuredMaximum = Number(action?.max_free_items);
  let remainingFreeItems = Number.isFinite(configuredMaximum) && configuredMaximum > 0
    ? Math.floor(configuredMaximum)
    : Number.MAX_SAFE_INTEGER;

  const candidates = items
    .filter((item) => eligibleProductIds.size === 0 || eligibleProductIds.has(String(item.product_id)))
    .map((item, index) => ({
      item,
      index,
      requestedFreeItems: Math.floor(Math.max(0, Number(item.quantity)) / unitsPerApplication) * getQuantity,
    }))
    .filter((candidate) => candidate.requestedFreeItems > 0)
    .sort((left, right) => Number(right.item.price) - Number(left.item.price) || left.index - right.index);

  const allocations: LegacyBogoAllocation[] = [];
  for (const candidate of candidates) {
    if (remainingFreeItems <= 0) break;
    const freeItems = Math.min(candidate.requestedFreeItems, remainingFreeItems);
    remainingFreeItems -= freeItems;
    allocations.push({
      item: candidate.item,
      freeItems,
      discount: freeItems * Math.max(0, Number(candidate.item.price)),
    });
  }
  return allocations;
}

