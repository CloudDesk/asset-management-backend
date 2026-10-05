/**
 * Promotion "type" as Inventory Admin shows it: the same options, in the same
 * order, as the create form (PROMOTION_MODULE_TYPE_OPTIONS in the admin app),
 * plus OTHER for records the form no longer creates (BOGO, free product,
 * quantity/Buy X templates, older item offers without a rule).
 *
 * Product, category and subcategory offers are all saved as PERCENT_OFF_ITEM /
 * FIXED_AMOUNT_OFF_ITEM, so they are told apart by their latest V2 rule, using
 * the same inference as the admin table badge (inferTemplateFromRule).
 */
export const PROMOTION_LIST_TYPES = [
  'FREE_SHIPPING',
  'FIXED_AMOUNT_OFF_CART',
  'PERCENT_OFF_CART',
  'PERCENT_OFF_SUBCATEGORIES',
  'PERCENT_OFF_CATEGORIES',
  'PERCENT_OFF_PRODUCTS',
  'FIXED_AMOUNT_OFF_PRODUCTS',
  'OTHER',
] as const;

export type PromotionListType = (typeof PROMOTION_LIST_TYPES)[number];

const TYPE_DECIDED_BY_PROMOTION = new Set<string>(['FREE_SHIPPING', 'FIXED_AMOUNT_OFF_CART', 'PERCENT_OFF_CART']);
const RULE_TEMPLATES = new Set<string>([
  'PERCENT_OFF_SUBCATEGORIES',
  'PERCENT_OFF_CATEGORIES',
  'PERCENT_OFF_PRODUCTS',
  'FIXED_AMOUNT_OFF_PRODUCTS',
]);
const KNOWN_TEMPLATES = new Set<string>([
  ...RULE_TEMPLATES,
  'BUY_X_GET_Y_FREE',
  'BUY_X_PERCENT_OFF',
  'QUANTITY_TIERED_PERCENT_OFF',
]);

export const isPromotionListType = (value: unknown): value is PromotionListType =>
  typeof value === 'string' && (PROMOTION_LIST_TYPES as readonly string[]).includes(value);

type RuleLike = {
  presentation?: { template_type?: unknown } | null;
  qualifier?: { scope?: { include?: Array<{ facet?: unknown }> }; minimum_quantity?: unknown } | null;
  benefit?: { type?: unknown } | null;
  tiers?: unknown[] | null;
} | null | undefined;

/** Mirrors the admin app's inferTemplateFromRule (without its legacy fallback). */
const templateFromRule = (rule: RuleLike): string | undefined => {
  if (!rule) return undefined;
  const declared = rule.presentation?.template_type;
  if (typeof declared === 'string' && KNOWN_TEMPLATES.has(declared)) return declared;
  const facet = rule.qualifier?.scope?.include?.find((group) => group.facet !== 'ENTIRE_CART')?.facet;
  if (rule.benefit?.type === 'FREE_ITEM') return 'BUY_X_GET_Y_FREE';
  if ((rule.tiers?.length ?? 0) >= 1) return 'QUANTITY_TIERED_PERCENT_OFF';
  if (rule.benefit?.type === 'PERCENT_OFF' && Number(rule.qualifier?.minimum_quantity ?? 0) > 1) return 'BUY_X_PERCENT_OFF';
  if (rule.benefit?.type === 'FIXED_AMOUNT_OFF' && facet === 'PRODUCT') return 'FIXED_AMOUNT_OFF_PRODUCTS';
  if (facet === 'CATEGORY') return 'PERCENT_OFF_CATEGORIES';
  if (facet === 'SUBCATEGORY') return 'PERCENT_OFF_SUBCATEGORIES';
  if (facet === 'PRODUCT') return 'PERCENT_OFF_PRODUCTS';
  return undefined;
};

/** List type for one promotion, given its saved type and latest V2 rule (if any). */
export const promotionListType = (promotionType: unknown, latestRule?: RuleLike): PromotionListType => {
  const type = String(promotionType ?? '').trim().toUpperCase();
  if (TYPE_DECIDED_BY_PROMOTION.has(type)) return type as PromotionListType;
  const template = templateFromRule(latestRule);
  return template && RULE_TEMPLATES.has(template) ? (template as PromotionListType) : 'OTHER';
};
