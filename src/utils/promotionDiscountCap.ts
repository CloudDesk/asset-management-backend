export interface LegacyAppliedPromotion {
  discount_amount?: number | string | null;
  breakdown?: Array<{
    quantity?: number | string | null;
    discount_per_item?: number | string | null;
    final_price_per_item?: number | string | null;
    original_price?: number | string | null;
    total_discount?: number | string | null;
    [key: string]: unknown;
  }> | null;
  is_free_shipping?: boolean;
  promotion_type?: string | null;
  [key: string]: unknown;
}

export const isShippingPromotion = (promotion: LegacyAppliedPromotion): boolean =>
  promotion.is_free_shipping === true || promotion.promotion_type === 'FREE_SHIPPING';

function capBreakdown<T extends LegacyAppliedPromotion>(
  promotion: T,
  appliedDiscount: number,
): T {
  if (!Array.isArray(promotion.breakdown) || promotion.breakdown.length === 0) {
    return { ...promotion, discount_amount: appliedDiscount };
  }

  const weights = promotion.breakdown.map((line) =>
    Math.max(0, Number(line.total_discount) || 0),
  );
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (totalWeight <= 0) {
    return { ...promotion, discount_amount: appliedDiscount };
  }

  const targetCents = Math.round(appliedDiscount * 100);
  const exactShares = weights.map((weight) => targetCents * weight / totalWeight);
  const allocatedCents = exactShares.map(Math.floor);
  let remainingCents = targetCents - allocatedCents.reduce((sum, value) => sum + value, 0);
  const allocationOrder = exactShares
    .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let cursor = 0; remainingCents > 0; cursor += 1, remainingCents -= 1) {
    const allocation = allocationOrder[cursor % allocationOrder.length];
    if (!allocation) break;
    allocatedCents[allocation.index] = (allocatedCents[allocation.index] ?? 0) + 1;
  }

  return {
    ...promotion,
    discount_amount: appliedDiscount,
    breakdown: promotion.breakdown.map((line, index) => {
      const totalDiscount = (allocatedCents[index] ?? 0) / 100;
      const quantity = Math.max(0, Number(line.quantity) || 0);
      const discountPerItem = quantity > 0 ? totalDiscount / quantity : totalDiscount;
      const originalPrice = Math.max(0, Number(line.original_price) || 0);
      return {
        ...line,
        total_discount: totalDiscount,
        discount_per_item: discountPerItem,
        final_price_per_item: Math.max(0, originalPrice - discountPerItem),
      };
    }),
  } as T;
}

/**
 * Limits stacked merchandise promotions to the merchandise subtotal.
 * Shipping promotions are deliberately kept outside this balance: only a
 * shipping promotion may reduce shipping, while cart/item promotions may
 * never consume it.
 */
export function capLegacyMerchandisePromotions<T extends LegacyAppliedPromotion>(
  promotions: T[],
  merchandiseSubtotal: number,
): T[] {
  let remainingMerchandise = Math.max(0, Number(merchandiseSubtotal) || 0);

  return promotions.flatMap((promotion): T[] => {
    if (isShippingPromotion(promotion)) return [promotion];

    const requestedDiscount = Math.max(0, Number(promotion.discount_amount) || 0);

    // Preserve non-monetary free-product benefits. A zero-value monetary
    // promotion is not actually applied and must not be persisted as one.
    if (requestedDiscount === 0) {
      return promotion.promotion_type === 'FREE_PRODUCT' ? [promotion] : [];
    }

    const appliedDiscount = Math.min(requestedDiscount, remainingMerchandise);
    remainingMerchandise -= appliedDiscount;

    // A promotion with no remaining monetary benefit must not be presented or
    // persisted as applied.
    if (appliedDiscount === 0) return [];

    return [capBreakdown(promotion, appliedDiscount)];
  });
}

export function sumLegacyMerchandiseDiscounts(
  promotions: LegacyAppliedPromotion[],
): number {
  return promotions
    .filter((promotion) => !isShippingPromotion(promotion))
    .reduce(
      (sum, promotion) => sum + Math.max(0, Number(promotion.discount_amount) || 0),
      0,
    );
}
