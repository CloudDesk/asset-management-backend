import type { PromotionRuleV2 } from '../schemas/promotions-v2.schema.js';
import type { PromotionCampaign } from '../services/promotion-v2-engine.js';

/**
 * Calculation group of the seven admin promotion types
 * (PLAN-2026-10-12-107):
 * - CART_FIXED: "Fixed amount of entire cart value", on the full cart value.
 * - CART_PERCENT: "Percent of entire cart value", only on items that did not
 *   get a product promotion.
 * - PRODUCT: Percentage Off Subcategories / Categories / Selected Products and
 *   Fixed Amount Off Selected Products, each on its own items only. On the
 *   same item, getProductPromotionRank decides (PLAN-2026-10-15-116).
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
 * Priority of a PRODUCT promotion when two of them match the same item
 * (PLAN-2026-10-15-116), lower wins: 1 Fixed Amount Off Selected Products,
 * 2 Percentage Off Selected Products, 3 Percentage Off Categories,
 * 4 Percentage Off Subcategories. Worked out from the scope facet and benefit,
 * so older records get a rank too. Undefined for other groups.
 */
export function getProductPromotionRank(campaign: Pick<PromotionCampaign, 'group' | 'rule'>): number | undefined {
  if (campaign.group !== 'PRODUCT') return undefined;
  const facets = new Set(campaign.rule.qualifier.scope.include.map((group) => group.facet));
  const benefit = campaign.rule.benefit ?? campaign.rule.tiers[0]?.benefit;
  if (facets.has('PRODUCT')) return benefit?.type === 'FIXED_AMOUNT_OFF' ? 1 : 2;
  if (facets.has('CATEGORY')) return 3;
  if (facets.has('SUBCATEGORY')) return 4;
  return undefined;
}

/**
 * Campaigns to evaluate for one promotion card in Cart / Checkout. Cards are
 * worked out one promotion at a time, but "Percent of entire cart value"
 * depends on which items get a product promotion, so its card is evaluated
 * with the product promotions present. A product promotion card is evaluated
 * with the higher-priority product promotions present, so it does not show a
 * saving on items another promotion takes. The saving shown then matches the
 * final price.
 */
export function eligibilityCardCampaigns(campaign: PromotionCampaign, active: PromotionCampaign[]): PromotionCampaign[] {
  if (campaign.group === 'CART_PERCENT') return [campaign, ...active.filter((item) => item.group === 'PRODUCT')];
  const rank = getProductPromotionRank(campaign);
  if (rank === undefined) return [campaign];
  return [campaign, ...active.filter((item) => item !== campaign && (getProductPromotionRank(item) ?? Infinity) < rank)];
}
