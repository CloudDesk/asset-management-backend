import type { PromotionRuleV2 } from '../schemas/promotions-v2.schema.js';
import type { PromotionCampaign } from '../services/promotion-v2-engine.js';

/**
 * Calculation group of the seven admin promotion types
 * (PLAN-2026-10-12-107):
 * - CART_FIXED: "Fixed amount of entire cart value", on the full cart value.
 * - CART_PERCENT: "Percent of entire cart value", only on items that did not
 *   get a product promotion.
 * - PRODUCT: Percentage Off Subcategories / Categories / Selected Products and
 *   Fixed Amount Off Selected Products, each on its own items only.
 * - SHIPPING: Free Shipping, on the shipping charge only.
 */
export type PromotionGroup = 'CART_FIXED' | 'CART_PERCENT' | 'PRODUCT' | 'SHIPPING';

const PRODUCT_FACETS = new Set(['PRODUCT', 'CATEGORY', 'SUBCATEGORY']);

/**
 * Returns undefined for records outside the seven types (legacy BOGO, Free
 * Product, item offers without a product scope). The engine keeps today's
 * behaviour for those.
 */
export function getPromotionGroup(promotion: { type?: string | null; rule: PromotionRuleV2 }): PromotionGroup | undefined {
  const type = String(promotion.type ?? '').trim().toUpperCase();
  const benefits = [promotion.rule.benefit, ...promotion.rule.tiers.map((tier) => tier.benefit)].filter((benefit) => benefit !== undefined);
  if (type === 'FREE_SHIPPING' || benefits.some((benefit) => benefit.type === 'FREE_SHIPPING')) return 'SHIPPING';
  if (type === 'FIXED_AMOUNT_OFF_CART') return 'CART_FIXED';
  if (type === 'PERCENT_OFF_CART') return 'CART_PERCENT';
  const productScoped = promotion.rule.qualifier.scope.include.some((group) => PRODUCT_FACETS.has(group.facet));
  const discountOnly = benefits.length > 0 && benefits.every((benefit) => benefit.type === 'PERCENT_OFF' || benefit.type === 'FIXED_AMOUNT_OFF');
  return productScoped && discountOnly ? 'PRODUCT' : undefined;
}

/**
 * Campaigns to evaluate for one promotion card in Cart / Checkout. Cards are
 * worked out one promotion at a time, but "Percent of entire cart value"
 * depends on which items get a product promotion, so its card is evaluated
 * with the product promotions present. The saving shown then matches the
 * final price.
 */
export function eligibilityCardCampaigns(campaign: PromotionCampaign, active: PromotionCampaign[]): PromotionCampaign[] {
  if (campaign.group !== 'CART_PERCENT') return [campaign];
  return [campaign, ...active.filter((item) => item.group === 'PRODUCT')];
}
