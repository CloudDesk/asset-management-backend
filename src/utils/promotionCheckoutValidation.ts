import type { PromotionQuote } from '../services/promotion-v2-engine.js';

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nestedValue]) => [key, stableValue(nestedValue)])
    );
  }
  return value;
};

export const promotionQuoteCheckoutSnapshot = (quote: PromotionQuote) => stableValue({
  schema_version: quote.schema_version,
  currency: quote.currency,
  original_total: quote.original_total,
  shipping_amount: quote.shipping_amount,
  discount_total: quote.discount_total,
  payable_total: quote.payable_total,
  applied_promotions: [...quote.applied_promotions]
    .sort((left, right) => left.promotion_id - right.promotion_id),
  adjustments: quote.adjustments
    .map(({ adjustment_id: _adjustmentId, ...adjustment }) => adjustment)
    .sort((left, right) => JSON.stringify(stableValue(left)).localeCompare(JSON.stringify(stableValue(right)))),
  gift_choices: [...quote.gift_choices]
    .map((choice) => ({ ...choice, product_ids: [...choice.product_ids].sort() }))
    .sort((left, right) => left.promotion_id - right.promotion_id),
});

export const promotionQuotesMatchForCheckout = (
  storedQuote: PromotionQuote,
  refreshedQuote: PromotionQuote
): boolean => JSON.stringify(promotionQuoteCheckoutSnapshot(storedQuote))
  === JSON.stringify(promotionQuoteCheckoutSnapshot(refreshedQuote));
