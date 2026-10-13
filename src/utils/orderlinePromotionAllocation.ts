/**
 * Per-line promotion amounts for a Promotions V2 order (PLAN-2026-10-12-107).
 *
 * commitEvaluationToOrder has already written each order line's exact quote
 * amount (a product promotion only on its own items, "Percent of entire cart
 * value" only on the items without one, the fixed cart amount on all). The
 * order header total also holds the direct coupon, which no line carries yet.
 * This keeps the quote amounts and spreads only the coupon, in proportion to
 * what each line has left after promotions (the same basis the coupon is
 * calculated on). The wallet is a payment, never part of these amounts.
 *
 * Returns undefined when the stored line amounts do not match the quote or
 * the header (older / legacy orders), so the caller keeps its proportional
 * split.
 */
export interface V2PromotionLine {
  id: number;
  productId: string;
  /** List amount of the line (unit price x quantity, before any discount). */
  productAmount: number;
  productDiscountAmount: number;
  /** Amount written from the quote by commitEvaluationToOrder. */
  storedPromotionAmount: number;
}

export interface V2QuoteAdjustment {
  type?: string;
  product_id?: string | number | null;
  amount?: number;
  metadata?: { fulfilment?: string } | null;
}

const toCents = (rupees: number): number => Math.round((Number(rupees) || 0) * 100);

/** Quote amount per product in paise, as commitEvaluationToOrder writes it. */
export function quoteLineAmounts(adjustments: V2QuoteAdjustment[]): Map<string, number> {
  const amounts = new Map<string, number>();
  for (const adjustment of adjustments) {
    const isLineDiscount = adjustment.type === 'PERCENT_DISCOUNT' || adjustment.type === 'FIXED_AMOUNT_DISCOUNT'
      || (adjustment.type === 'FREE_ITEM' && adjustment.metadata?.fulfilment === 'DISCOUNT_EXISTING');
    if (!isLineDiscount || adjustment.product_id === null || adjustment.product_id === undefined) continue;
    const key = String(adjustment.product_id);
    amounts.set(key, (amounts.get(key) ?? 0) + Math.max(0, Number(adjustment.amount) || 0));
  }
  return amounts;
}

export function allocateV2OrderlinePromotions(
  lines: V2PromotionLine[],
  adjustments: V2QuoteAdjustment[],
  headerPromotionTotal: number,
): Map<number, number> | undefined {
  if (!lines.length) return undefined;
  const quoteAmounts = quoteLineAmounts(adjustments);
  const tolerance = lines.length; // one paisa of rounding per line
  const stored = lines.map((line) => toCents(line.storedPromotionAmount));
  const quoteForLines = new Map<string, number>();
  lines.forEach((line, index) => quoteForLines.set(line.productId, (quoteForLines.get(line.productId) ?? 0) + (stored[index] ?? 0)));
  for (const [productId, cents] of quoteForLines) {
    if (Math.abs(cents - (quoteAmounts.get(productId) ?? 0)) > tolerance) return undefined;
  }
  for (const [productId, cents] of quoteAmounts) {
    if (!quoteForLines.has(productId) && cents > 0) return undefined;
  }

  const storedTotal = stored.reduce((sum, cents) => sum + cents, 0);
  const couponCents = toCents(headerPromotionTotal) - storedTotal;
  if (couponCents < -tolerance) return undefined;

  const capacity = lines.map((line, index) =>
    Math.max(0, toCents(line.productAmount) - toCents(line.productDiscountAmount) - (stored[index] ?? 0)));
  const capacityTotal = capacity.reduce((sum, cents) => sum + cents, 0);
  const coupon = Math.max(0, couponCents);
  if (coupon > capacityTotal + tolerance) return undefined;

  const result = new Map<number, number>();
  let remaining = coupon;
  lines.forEach((line, index) => {
    const isLast = index === lines.length - 1;
    const share = isLast
      ? remaining
      : Math.min(remaining, capacity[index] ?? 0, Math.floor(coupon * (capacity[index] ?? 0) / Math.max(capacityTotal, 1)));
    remaining -= share;
    result.set(line.id, ((stored[index] ?? 0) + share) / 100);
  });
  // Rounding within the tolerance lands on the last line so the lines add up
  // to the header exactly.
  if (couponCents < 0) {
    const last = lines.at(-1)!;
    result.set(last.id, Math.max(0, (result.get(last.id) ?? 0) + couponCents / 100));
  }
  return result;
}
