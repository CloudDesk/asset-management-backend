import { PromotionRuleV2Schema, type PromotionRuleV2 } from '../schemas/promotions-v2.schema.js';

type LegacyCondition = { attribute?: string; operator?: string; value?: unknown };
type LegacyAction = Record<string, unknown>;

const strings = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try { const parsed: unknown = JSON.parse(value); if (Array.isArray(parsed)) return parsed.map(String); } catch { /* use comma-separated fallback */ }
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return value === undefined || value === null ? [] : [String(value)];
};

export function convertLegacyPromotionRule(input: {
  type?: string | null;
  conditions?: unknown;
  action?: unknown;
  priority?: number | null;
  stackable?: boolean | null;
  name?: string | null;
  description?: string | null;
}): PromotionRuleV2 {
  const conditions = (Array.isArray(input.conditions) ? input.conditions : []) as LegacyCondition[];
  const action = (input.action && typeof input.action === 'object' ? input.action : {}) as LegacyAction;
  const includes: Array<{ facet: 'PRODUCT' | 'CATEGORY' | 'SUBCATEGORY' | 'ENTIRE_CART'; values: string[] }> = [];
  let minimumQuantity: number | undefined;
  let minimumValue: number | undefined;
  let valueMetric: 'QUALIFYING_SUBTOTAL' | 'CART_SUBTOTAL' | 'ORDER_TOTAL' | undefined;

  for (const condition of conditions) {
    const attribute = (condition.attribute ?? '').toLowerCase();
    const values = strings(condition.value);
    if (attribute.includes('item_count') || attribute.includes('quantity')) minimumQuantity = Number(condition.value);
    else if (attribute.includes('total_value') || attribute.includes('order_total')) {
      minimumValue = Math.round(Number(condition.value) * 100);
      valueMetric = 'ORDER_TOTAL';
    }
    else if (attribute.includes('subtotal')) {
      minimumValue = Math.round(Number(condition.value) * 100);
      valueMetric = 'CART_SUBTOTAL';
    }
    else if (attribute.includes('subsubcategory') || attribute.includes('fragrance') || attribute.includes('scent') || attribute.includes('brand') || attribute.includes('collection') || attribute.includes('tag')) {
      // Former mappings are retained conceptually but disabled by scope:
      // FRAGRANCE <- fragrance/scent, BRAND <- brand, COLLECTION <- collection,
      // TAG <- tag, SUBSUBCATEGORY <- subsubcategory.
      throw new Error(`Legacy condition ${condition.attribute} is outside the Promotions V2 scope`);
    }
    else if (attribute.includes('subcategory')) includes.push({ facet: 'SUBCATEGORY', values });
    else if (attribute.includes('category')) includes.push({ facet: 'CATEGORY', values });
    else if (attribute.includes('product')) includes.push({ facet: 'PRODUCT', values });
  }

  const legacyType = String(action.type ?? input.type ?? '').toUpperCase();
  const buyQuantity = Math.max(1, Number(action.buy_quantity ?? minimumQuantity ?? (legacyType === 'BOGO' ? 1 : 1)));
  const productIds = strings(action.product_ids ?? action.free_product_id);
  let benefit: Record<string, unknown>;
  if (legacyType.includes('BOGO') || legacyType.includes('FREE_PRODUCT')) {
    benefit = {
      type: 'FREE_ITEM', quantity: Math.max(1, Number(action.get_quantity ?? 1)),
      target: productIds.length ? 'SPECIFIC_PRODUCTS' : 'SAME_PRODUCT_AS_QUALIFIER',
      ...(productIds.length ? { product_ids: productIds } : {}), fulfilment: 'AUTO_ADD', out_of_stock_policy: 'REMOVE_PROMOTION',
    };
  } else if (legacyType.includes('FREE_SHIPPING')) {
    benefit = { type: 'FREE_SHIPPING', target: 'ALL_QUALIFYING_UNITS' };
  } else if (legacyType.includes('FIXED')) {
    benefit = { type: 'FIXED_AMOUNT_OFF', value: Math.round(Number(action.value ?? 0) * 100), target: 'ALL_QUALIFYING_UNITS' };
  } else {
    benefit = { type: 'PERCENT_OFF', value: Number(action.value ?? 0), target: 'ALL_QUALIFYING_UNITS' };
  }

  return PromotionRuleV2Schema.parse({
    schema_version: 2,
    qualifier: {
      scope: { include: includes.length ? includes : [{ facet: 'ENTIRE_CART', values: ['*'] }], exclude: [], group_operator: 'OR' },
      metric: minimumValue !== undefined ? (valueMetric ?? 'QUALIFYING_SUBTOTAL') : 'ELIGIBLE_QUANTITY',
      aggregation: 'ACROSS_ELIGIBLE_PRODUCTS',
      ...(minimumValue !== undefined ? { minimum_value: minimumValue } : { minimum_quantity: buyQuantity }),
    },
    benefit,
    repeat: legacyType.includes('BOGO') ? 'PER_MULTIPLE' : 'ONCE',
    limits: {
      ...(action.max_discount ? { maximum_discount_amount: Math.round(Number(action.max_discount) * 100) } : {}),
      ...(action.max_free_items ? { maximum_free_quantity: Number(action.max_free_items) } : {}),
    },
    stacking: {
      stackable: input.stackable ?? false,
      priority: input.priority ?? 0,
      exclusive_group: legacyType.includes('FREE_SHIPPING')
        ? 'SHIPPING_DISCOUNT'
        : 'MERCHANDISE_DISCOUNT',
      item_reuse: legacyType.includes('FREE_SHIPPING') ? 'ALLOW' : 'DISALLOW',
    },
    presentation: { ...(input.name ? { title: input.name } : {}), ...(input.description ? { description: input.description } : {}) },
  });
}
