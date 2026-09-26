import {
  capLegacyMerchandisePromotions,
  isShippingPromotion,
  type LegacyAppliedPromotion,
  sumLegacyMerchandiseDiscounts,
} from './promotionDiscountCap.js';

export const STANDARD_CHECKOUT_SHIPPING_AMOUNT = 150;

const money = (value: number): number =>
  Math.round((Math.max(0, Number(value) || 0) + Number.EPSILON) * 100) / 100;

export const checkoutAmountsMatch = (submitted: number, expected: number): boolean =>
  Math.round(Number(submitted) * 100) === Math.round(Number(expected) * 100);

export const uniqueCheckoutEvaluationIds = (evaluationIds: string[]): string[] =>
  [...new Set(evaluationIds)];

export function checkoutCartQuantitiesMatch(
  orderItems: Array<{ productid: number; quantity: number }>,
  quotedItems: Array<{ product_id?: unknown; productid?: unknown; quantity?: unknown }>,
): boolean {
  const aggregate = (
    items: Array<{ product_id?: unknown; productid?: unknown; quantity?: unknown }>,
  ) => {
    const quantities = new Map<number, number>();
    for (const item of items) {
      const productId = Number(item.product_id ?? item.productid);
      const quantity = Number(item.quantity);
      if (!Number.isInteger(productId) || productId <= 0) continue;
      if (!Number.isInteger(quantity) || quantity <= 0) continue;
      quantities.set(productId, (quantities.get(productId) || 0) + quantity);
    }
    return quantities;
  };

  const requested = aggregate(orderItems);
  const quoted = aggregate(quotedItems);
  return requested.size === quoted.size &&
    [...requested].every(([productId, quantity]) => quoted.get(productId) === quantity);
}

export interface V2CheckoutQuoteSnapshot {
  merchandise_subtotal?: number;
  merchandise_discount_total?: number;
  shipping_amount?: number;
  shipping_discount_total?: number;
  adjustments?: Array<{
    type?: string;
    amount?: number;
    metadata?: { fulfilment?: string };
  }>;
}

export interface CheckoutPricingInput {
  merchandiseSubtotal: number;
  shippingAmount?: number;
  legacyPromotions?: LegacyAppliedPromotion[];
  v2Quote?: V2CheckoutQuoteSnapshot | null;
}

export interface CheckoutPricing {
  merchandise_subtotal: number;
  merchandise_discount: number;
  merchandise_payable: number;
  shipping_amount: number;
  shipping_discount: number;
  shipping_payable: number;
  payable_before_wallet: number;
  applied_promotions: LegacyAppliedPromotion[];
}

/**
 * Resolve the monetary value that must be written to each legacy redemption.
 * Merchandise promotions use their capped checkout value. A free-shipping
 * promotion owns the shipping saving instead of recording a misleading zero.
 */
export function resolvePromotionRedemptionAmounts(
  evaluatedPromotions: LegacyAppliedPromotion[],
  checkoutPricing?: Partial<CheckoutPricing> | null,
): Map<number, number> {
  const resolved = new Map<number, number>();
  const authoritativeById = new Map<number, LegacyAppliedPromotion>();

  for (const promotion of checkoutPricing?.applied_promotions ?? []) {
    const promotionId = Number(promotion.promotion_id);
    if (Number.isInteger(promotionId) && promotionId > 0) {
      authoritativeById.set(promotionId, promotion);
    }
  }

  const shippingPromotions = evaluatedPromotions.filter(isShippingPromotion);
  const shippingOwnerId = Number(shippingPromotions[0]?.promotion_id || 0);
  const shippingSaving = money(Number(checkoutPricing?.shipping_discount || 0));

  for (const promotion of evaluatedPromotions) {
    const promotionId = Number(promotion.promotion_id);
    if (!Number.isInteger(promotionId) || promotionId <= 0) continue;

    if (isShippingPromotion(promotion)) {
      resolved.set(
        promotionId,
        promotionId === shippingOwnerId
          ? shippingSaving || money(Number(promotion.discount_amount || 0))
          : 0,
      );
      continue;
    }

    const authoritative = authoritativeById.get(promotionId);
    resolved.set(
      promotionId,
      money(Number(authoritative?.discount_amount ?? promotion.discount_amount ?? 0)),
    );
  }

  return resolved;
}

/**
 * Authoritative checkout arithmetic shared by payment initiation tests and
 * the controller. Promotion discounts and shipping discounts have separate
 * balances, so one can never consume the other.
 */
export function calculateCheckoutPricing(input: CheckoutPricingInput): CheckoutPricing {
  const merchandiseSubtotal = money(input.merchandiseSubtotal);
  const shippingAmount = money(
    input.shippingAmount ?? STANDARD_CHECKOUT_SHIPPING_AMOUNT,
  );

  if (input.v2Quote) {
    const quoteMerchandiseSubtotal = money(
      Number(input.v2Quote.merchandise_subtotal || 0) / 100,
    );
    const quoteShippingAmount = money(Number(input.v2Quote.shipping_amount || 0) / 100);
    if (quoteMerchandiseSubtotal !== merchandiseSubtotal) {
      throw new Error('PROMOTION_CART_CHANGED');
    }
    if (quoteShippingAmount !== shippingAmount) {
      throw new Error('PROMOTION_SHIPPING_CHANGED');
    }

    const adjustments = input.v2Quote.adjustments ?? [];
    const derivedMerchandiseDiscount = adjustments
      .filter((adjustment) =>
        adjustment.type !== 'FREE_SHIPPING' &&
        (adjustment.type !== 'FREE_ITEM' || adjustment.metadata?.fulfilment === 'DISCOUNT_EXISTING')
      )
      .reduce((sum, adjustment) => sum + Math.max(0, Number(adjustment.amount) || 0), 0) / 100;
    const derivedShippingDiscount = adjustments
      .filter((adjustment) => adjustment.type === 'FREE_SHIPPING')
      .reduce((sum, adjustment) => sum + Math.max(0, Number(adjustment.amount) || 0), 0) / 100;
    const merchandiseDiscount = money(Math.min(
      merchandiseSubtotal,
      Number(input.v2Quote.merchandise_discount_total ?? derivedMerchandiseDiscount * 100) / 100,
    ));
    const shippingDiscount = money(Math.min(
      shippingAmount,
      Number(input.v2Quote.shipping_discount_total ?? derivedShippingDiscount * 100) / 100,
    ));
    const merchandisePayable = money(merchandiseSubtotal - merchandiseDiscount);
    const shippingPayable = money(shippingAmount - shippingDiscount);
    return {
      merchandise_subtotal: merchandiseSubtotal,
      merchandise_discount: merchandiseDiscount,
      merchandise_payable: merchandisePayable,
      shipping_amount: shippingAmount,
      shipping_discount: shippingDiscount,
      shipping_payable: shippingPayable,
      payable_before_wallet: money(merchandisePayable + shippingPayable),
      applied_promotions: [],
    };
  }

  const deduplicated = [...new Map(
    (input.legacyPromotions ?? []).map((promotion, index) => [
      String(promotion.promotion_id ?? `anonymous:${index}`),
      promotion,
    ]),
  ).values()];
  const cappedPromotions = capLegacyMerchandisePromotions(
    deduplicated,
    merchandiseSubtotal,
  );
  const merchandiseDiscount = money(
    sumLegacyMerchandiseDiscounts(cappedPromotions),
  );
  const hasFreeShipping = cappedPromotions.some(isShippingPromotion);
  const shippingDiscount = hasFreeShipping ? shippingAmount : 0;
  const merchandisePayable = money(merchandiseSubtotal - merchandiseDiscount);
  const shippingPayable = money(shippingAmount - shippingDiscount);

  return {
    merchandise_subtotal: merchandiseSubtotal,
    merchandise_discount: merchandiseDiscount,
    merchandise_payable: merchandisePayable,
    shipping_amount: shippingAmount,
    shipping_discount: shippingDiscount,
    shipping_payable: shippingPayable,
    payable_before_wallet: money(merchandisePayable + shippingPayable),
    applied_promotions: cappedPromotions,
  };
}
