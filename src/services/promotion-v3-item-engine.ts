import { randomUUID } from 'node:crypto';
import type { PromotionPredicate, PromotionRuleV3 } from '../schemas/promotions-v3.schema.js';

export interface PromotionV3CartLine {
  cart_record_id?: string;
  product_id: string;
  quantity: number;
  unit_price_paise: number;
  available_quantity?: number;
  facets: Partial<Record<'CATEGORY' | 'SUBCATEGORY', string[]>>;
}

export interface PromotionV3ItemCampaign {
  promotion_id: number;
  rule_version: number;
  name?: string | undefined;
  rule: PromotionRuleV3;
}

export interface PromotionV3UnitAdjustment {
  adjustment_id: string;
  promotion_id: number;
  rule_version: number;
  cart_record_id?: string;
  product_id: string;
  affected_quantity: number;
  unit_keys: string[];
  list_amount: number;
  amount: number;
  payable_amount: number;
  adjustment_type?: 'ITEM_PERCENTAGE_DISCOUNT' | 'ITEM_FIXED_DISCOUNT' | 'FREE_ITEM';
  metadata?: Record<string, unknown>;
}

export interface PromotionV3Gift {
  promotion_id: number;
  product_id: string;
  paid_quantity: number;
  free_quantity: number;
  total_quantity: number;
  added_quantity: number;
  fulfilment: 'AUTO_ADD' | 'DISCOUNT_EXISTING';
  editable: false;
}

export interface PromotionV3GiftEntitlement {
  promotion_id: number;
  rule_version: number;
  gift_quantity: number;
  reward_mode: 'PACKER_SELECTED_SURPRISE_GIFT';
  allowed_scope: PromotionRuleV3['qualifier']['scope'] | null;
  status: 'PENDING_PACKING';
  source_unit_keys: string[];
}

export interface PromotionV3ItemEvaluation {
  eligible: boolean;
  adjustments: PromotionV3UnitAdjustment[];
  discount_total: number;
  affected_quantity: number;
  reason_codes: string[];
  progress: Array<{ field: PromotionPredicate['field']; current: number; required: number; remaining: number }>;
  matched_tier_minimum?: number;
  gifts: PromotionV3Gift[];
  quantity_breakdown: Array<{ product_id: string; paid_quantity: number; free_quantity: number; total_quantity: number }>;
  entitlements: PromotionV3GiftEntitlement[];
}

export interface PromotionV3EvaluationContext {
  channel: 'web' | 'mobile' | 'nivapp' | 'amazon' | 'flipkart' | 'instore';
  shipping_amount?: number;
  remaining_cart_value?: number;
  customer_segments?: string[];
  unavailable_unit_keys?: ReadonlySet<string>;
  reward_catalog?: PromotionV3CartLine[];
}

interface LogicalUnit {
  line: PromotionV3CartLine;
  unitKey: string;
  unitIndex: number;
}

type PromotionV3Benefit = PromotionRuleV3['tiers'][number]['benefit'];

const normalise = (value: string): string => value.trim().toLocaleLowerCase('en-IN');

function lineMatchesScope(line: PromotionV3CartLine, rule: PromotionRuleV3): boolean {
  const matchesGroup = (group: PromotionRuleV3['qualifier']['scope']['include'][number]): boolean => {
    if (group.facet === 'ENTIRE_CART') return true;
    if (group.facet === 'PRODUCT') return group.values.map(String).includes(line.product_id);
    const actual = line.facets[group.facet] ?? [];
    const expected = new Set(group.values.map(normalise));
    return actual.some((value) => expected.has(normalise(value)));
  };
  const { include, exclude, group_operator: operator } = rule.qualifier.scope;
  const included = include.length === 0 || (operator === 'AND' ? include.every(matchesGroup) : include.some(matchesGroup));
  return included && !exclude.some(matchesGroup);
}

function expandUnits(lines: PromotionV3CartLine[]): LogicalUnit[] {
  return lines
    .map((line, inputIndex) => ({ line, inputIndex }))
    .sort((left, right) => left.line.product_id.localeCompare(right.line.product_id)
      || (left.line.cart_record_id ?? '').localeCompare(right.line.cart_record_id ?? '')
      || left.inputIndex - right.inputIndex)
    .flatMap(({ line, inputIndex }) => Array.from({ length: line.quantity }, (_, unitIndex) => ({
      line,
      unitIndex,
      unitKey: `${line.cart_record_id ?? `${line.product_id}:line:${inputIndex}`}:unit:${unitIndex}`,
    })));
}

function compareNumber(actual: number, operator: 'GT' | 'GTE' | 'EQ' | 'LTE' | 'LT', expected: number): boolean {
  if (operator === 'GT') return actual > expected;
  if (operator === 'GTE') return actual >= expected;
  if (operator === 'EQ') return actual === expected;
  if (operator === 'LTE') return actual <= expected;
  return actual < expected;
}

function numericPredicateValue(
  field: Exclude<PromotionPredicate['field'], 'CHANNEL' | 'CUSTOMER_SEGMENT'>,
  eligible: PromotionV3CartLine[],
  allLines: PromotionV3CartLine[],
  context: PromotionV3EvaluationContext,
): number {
  const eligibleSubtotal = eligible.reduce((sum, line) => sum + line.unit_price_paise * line.quantity, 0);
  const cartSubtotal = allLines.reduce((sum, line) => sum + line.unit_price_paise * line.quantity, 0);
  if (field === 'ELIGIBLE_QUANTITY') return eligible.reduce((sum, line) => sum + line.quantity, 0);
  if (field === 'DISTINCT_PRODUCT_COUNT') return new Set(eligible.map((line) => line.product_id)).size;
  if (field === 'QUALIFYING_SUBTOTAL') return eligibleSubtotal;
  if (field === 'CART_SUBTOTAL') return cartSubtotal;
  if (field === 'REMAINING_CART_VALUE') return context.remaining_cart_value ?? cartSubtotal;
  return cartSubtotal + (context.shipping_amount ?? 0);
}

function predicateFailure(
  predicate: PromotionPredicate,
  eligible: PromotionV3CartLine[],
  allLines: PromotionV3CartLine[],
  context: PromotionV3EvaluationContext,
): { reason?: string; progress?: PromotionV3ItemEvaluation['progress'][number] } {
  if (predicate.field === 'CHANNEL') {
    const contains = predicate.value.includes(context.channel);
    const passed = predicate.operator === 'IN' ? contains : !contains;
    return passed ? {} : { reason: 'CHANNEL_NOT_ELIGIBLE' };
  }
  if (predicate.field === 'CUSTOMER_SEGMENT') {
    const actual = new Set((context.customer_segments ?? []).map(normalise));
    const contains = predicate.value.some((segment) => actual.has(normalise(segment)));
    const passed = predicate.operator === 'IN' ? contains : !contains;
    return passed ? {} : { reason: 'CUSTOMER_NOT_ELIGIBLE' };
  }
  const current = numericPredicateValue(predicate.field, eligible, allLines, context);
  if (compareNumber(current, predicate.operator, predicate.value)) return {};
  const valuePredicate = ['QUALIFYING_SUBTOTAL', 'CART_SUBTOTAL', 'REMAINING_CART_VALUE', 'ORDER_TOTAL'].includes(predicate.field);
  return {
    reason: valuePredicate ? 'MINIMUM_VALUE_NOT_MET' : 'MINIMUM_QUANTITY_NOT_MET',
    ...(['GT', 'GTE'].includes(predicate.operator) ? {
      progress: {
        field: predicate.field,
        current,
        required: predicate.operator === 'GT' ? predicate.value + 1 : predicate.value,
        remaining: Math.max(0, (predicate.operator === 'GT' ? predicate.value + 1 : predicate.value) - current),
      },
    } : {}),
  };
}

function qualifyingSetSize(rule: PromotionRuleV3, matchedTierMinimum?: number): number {
  if (matchedTierMinimum !== undefined) return matchedTierMinimum;
  const predicate = rule.qualifier.predicates.find((item) => item.field === 'ELIGIBLE_QUANTITY' && ['GT', 'GTE', 'EQ'].includes(item.operator));
  if (!predicate || typeof predicate.value !== 'number') return 1;
  return Math.max(1, predicate.operator === 'GT' ? predicate.value + 1 : predicate.value);
}

function selectUnits(units: LogicalUnit[], rule: PromotionRuleV3, benefit: PromotionV3Benefit, unavailable: ReadonlySet<string>, matchedTierMinimum?: number): LogicalUnit[] {
  const available = units.filter((unit) => !unavailable.has(unit.unitKey));
  const setSize = qualifyingSetSize(rule, matchedTierMinimum);
  const applications = rule.repetition.mode === 'PER_QUALIFYING_SET'
    ? Math.min(Math.floor(units.length / setSize), rule.repetition.maximum_sets_per_order ?? Number.MAX_SAFE_INTEGER)
    : 1;
  const configuredQuantity = benefit.units_per_application;
  const maximum = rule.limits.maximum_affected_quantity ?? Number.MAX_SAFE_INTEGER;
  const targetQuantity = configuredQuantity === undefined
    ? available.length
    : Math.min(configuredQuantity * applications, maximum);
  const ordered = benefit.allocation === 'CHEAPEST_ELIGIBLE_UNIT'
    ? [...available].sort((left, right) => left.line.unit_price_paise - right.line.unit_price_paise || left.unitKey.localeCompare(right.unitKey))
    : available;
  return ordered.slice(0, Math.min(targetQuantity, maximum));
}

function adjustmentsForUnits(campaign: PromotionV3ItemCampaign, benefit: PromotionV3Benefit, units: LogicalUnit[]): PromotionV3UnitAdjustment[] {
  const maximumDiscount = campaign.rule.limits.maximum_discount_amount ?? Number.MAX_SAFE_INTEGER;
  let remainingFixed = benefit.type === 'FIXED_AMOUNT_OFF' ? Math.min(benefit.value ?? 0, maximumDiscount) : 0;
  let remainingCap = maximumDiscount;
  const unitDiscounts = units.map((unit) => {
    const calculated = benefit.type === 'PERCENT_OFF'
      ? Math.floor(unit.line.unit_price_paise * (benefit.value ?? 0) / 100)
      : Math.min(unit.line.unit_price_paise, remainingFixed);
    const amount = Math.min(calculated, remainingCap);
    remainingFixed -= amount;
    remainingCap -= amount;
    return { unit, amount };
  }).filter(({ amount }) => amount > 0);

  const grouped = new Map<string, typeof unitDiscounts>();
  for (const discount of unitDiscounts) {
    const key = discount.unit.line.cart_record_id ?? `product:${discount.unit.line.product_id}`;
    grouped.set(key, [...(grouped.get(key) ?? []), discount]);
  }
  return [...grouped.values()].map((discounts) => {
    const first = discounts[0]!;
    const listAmount = discounts.reduce((sum, { unit }) => sum + unit.line.unit_price_paise, 0);
    const amount = discounts.reduce((sum, discount) => sum + discount.amount, 0);
    return {
      adjustment_id: randomUUID(),
      promotion_id: campaign.promotion_id,
      rule_version: campaign.rule_version,
      ...(first.unit.line.cart_record_id ? { cart_record_id: first.unit.line.cart_record_id } : {}),
      product_id: first.unit.line.product_id,
      affected_quantity: discounts.length,
      unit_keys: discounts.map(({ unit }) => unit.unitKey),
      list_amount: listAmount,
      amount,
      payable_amount: listAmount - amount,
      adjustment_type: benefit.type === 'PERCENT_OFF' ? 'ITEM_PERCENTAGE_DISCOUNT' : 'ITEM_FIXED_DISCOUNT',
    };
  });
}

function sameProductGiftEvaluation(
  eligibleLines: PromotionV3CartLine[],
  allLines: PromotionV3CartLine[],
  campaign: PromotionV3ItemCampaign,
  context: PromotionV3EvaluationContext,
  benefit: PromotionV3Benefit,
): PromotionV3ItemEvaluation {
  const quantityPredicate = campaign.rule.qualifier.predicates.find((predicate) => predicate.field === 'ELIGIBLE_QUANTITY');
  const buyQuantity = quantityPredicate && typeof quantityPredicate.value === 'number'
    ? Math.max(1, quantityPredicate.operator === 'GT' ? quantityPredicate.value + 1 : quantityPredicate.value)
    : 1;
  const freePerSet = benefit.quantity ?? 1;
  const nonQuantityFailures = campaign.rule.qualifier.predicates
    .filter((predicate) => predicate.field !== 'ELIGIBLE_QUANTITY')
    .map((predicate) => predicateFailure(predicate, eligibleLines, allLines, context))
    .filter((failure) => failure.reason);
  if (nonQuantityFailures.length) {
    return {
      eligible: false, adjustments: [], discount_total: 0, affected_quantity: 0, gifts: [], quantity_breakdown: [], entitlements: [],
      reason_codes: [...new Set(nonQuantityFailures.flatMap((failure) => failure.reason ?? []))],
      progress: nonQuantityFailures.flatMap((failure) => failure.progress ?? []),
    };
  }

  let remainingSetLimit = campaign.rule.repetition.maximum_sets_per_order ?? Number.MAX_SAFE_INTEGER;
  const adjustments: PromotionV3UnitAdjustment[] = [];
  const gifts: PromotionV3Gift[] = [];
  const quantityBreakdown: PromotionV3ItemEvaluation['quantity_breakdown'] = [];
  const progress: PromotionV3ItemEvaluation['progress'] = [];
  let outOfStock = false;
  for (const line of [...eligibleLines].sort((left, right) => left.product_id.localeCompare(right.product_id))) {
    const cycle = buyQuantity + freePerSet;
    const possibleSets = campaign.rule.repetition.mode === 'ONCE'
      ? (line.quantity >= buyQuantity ? 1 : 0)
      : Math.floor((line.quantity + freePerSet) / cycle);
    const sets = Math.min(possibleSets, remainingSetLimit);
    if (sets <= 0) {
      quantityBreakdown.push({ product_id: line.product_id, paid_quantity: line.quantity, free_quantity: 0, total_quantity: line.quantity });
      progress.push({ field: 'ELIGIBLE_QUANTITY', current: line.quantity, required: buyQuantity, remaining: Math.max(0, buyQuantity - line.quantity) });
      continue;
    }
    remainingSetLimit -= sets;
    const freeQuantity = sets * freePerSet;
    const minimumPaid = sets * buyQuantity;
    const paidQuantity = Math.max(minimumPaid, line.quantity - freeQuantity);
    const totalQuantity = paidQuantity + freeQuantity;
    const addedQuantity = Math.max(0, totalQuantity - line.quantity);
    if ((line.available_quantity ?? Number.MAX_SAFE_INTEGER) < totalQuantity) {
      outOfStock = true;
      quantityBreakdown.push({ product_id: line.product_id, paid_quantity: line.quantity, free_quantity: 0, total_quantity: line.quantity });
      continue;
    }
    const paidUnitKeys = expandUnits([{ ...line, quantity: Math.min(line.quantity, paidQuantity) }]).map((unit) => unit.unitKey);
    adjustments.push({
      adjustment_id: randomUUID(), promotion_id: campaign.promotion_id, rule_version: campaign.rule_version,
      ...(line.cart_record_id ? { cart_record_id: line.cart_record_id } : {}),
      product_id: line.product_id, affected_quantity: freeQuantity, unit_keys: paidUnitKeys,
      list_amount: line.unit_price_paise * freeQuantity, amount: line.unit_price_paise * freeQuantity, payable_amount: 0,
      adjustment_type: 'FREE_ITEM',
      metadata: { reward_mode: 'SAME_PRODUCT', fulfilment: 'AUTO_ADD', added_quantity: addedQuantity, source_product_ids: [line.product_id] },
    });
    gifts.push({ promotion_id: campaign.promotion_id, product_id: line.product_id, paid_quantity: paidQuantity, free_quantity: freeQuantity, total_quantity: totalQuantity, added_quantity: addedQuantity, fulfilment: 'AUTO_ADD', editable: false });
    quantityBreakdown.push({ product_id: line.product_id, paid_quantity: paidQuantity, free_quantity: freeQuantity, total_quantity: totalQuantity });
  }
  const appliedGifts = gifts.filter((gift) => gift.free_quantity > 0);
  return {
    eligible: appliedGifts.length > 0,
    adjustments,
    discount_total: adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0),
    affected_quantity: appliedGifts.reduce((sum, gift) => sum + gift.free_quantity, 0),
    reason_codes: appliedGifts.length ? [] : [outOfStock ? 'GIFT_OUT_OF_STOCK' : 'MINIMUM_QUANTITY_NOT_MET'],
    progress,
    gifts,
    quantity_breakdown: quantityBreakdown,
    entitlements: [],
  };
}

function configuredGiftEvaluation(
  eligibleLines: PromotionV3CartLine[],
  allLines: PromotionV3CartLine[],
  campaign: PromotionV3ItemCampaign,
  context: PromotionV3EvaluationContext,
  benefit: PromotionV3Benefit,
): PromotionV3ItemEvaluation {
  const failed = campaign.rule.qualifier.predicates.map((predicate) => predicateFailure(predicate, eligibleLines, allLines, context)).filter((item) => item.reason);
  if (failed.length) return {
    eligible: false, adjustments: [], discount_total: 0, affected_quantity: 0, gifts: [], quantity_breakdown: [], entitlements: [],
    reason_codes: [...new Set(failed.flatMap((item) => item.reason ?? []))], progress: failed.flatMap((item) => item.progress ?? []),
  };
  const threshold = qualifyingSetSize(campaign.rule);
  const eligibleQuantity = eligibleLines.reduce((sum, line) => sum + line.quantity, 0);
  const applications = campaign.rule.repetition.mode === 'PER_QUALIFYING_SET'
    ? Math.min(Math.floor(eligibleQuantity / threshold), campaign.rule.repetition.maximum_sets_per_order ?? Number.MAX_SAFE_INTEGER)
    : 1;
  const giftQuantity = (benefit.quantity ?? 1) * applications;
  const sourceUnits = expandUnits(eligibleLines).slice(0, Math.min(eligibleQuantity, threshold * applications));
  const reward = campaign.rule.reward!;

  if (reward.mode === 'PACKER_SELECTED_SURPRISE_GIFT') {
    return {
      eligible: true, adjustments: [], discount_total: 0, affected_quantity: giftQuantity, gifts: [], quantity_breakdown: [], reason_codes: [], progress: [],
      entitlements: [{ promotion_id: campaign.promotion_id, rule_version: campaign.rule_version, gift_quantity: giftQuantity, reward_mode: reward.mode, allowed_scope: reward.allowed_scope, status: 'PENDING_PACKING', source_unit_keys: sourceUnits.map((unit) => unit.unitKey) }],
    };
  }

  if (reward.mode === 'CHEAPEST_ELIGIBLE_CART_UNIT') {
    const selected = [...expandUnits(eligibleLines)]
      .filter((unit) => !(context.unavailable_unit_keys ?? new Set()).has(unit.unitKey))
      .sort((left, right) => left.line.unit_price_paise - right.line.unit_price_paise || left.unitKey.localeCompare(right.unitKey))
      .slice(0, giftQuantity);
    if (selected.length < giftQuantity) return { eligible: false, adjustments: [], discount_total: 0, affected_quantity: 0, gifts: [], quantity_breakdown: [], entitlements: [], reason_codes: ['MINIMUM_QUANTITY_NOT_MET'], progress: [] };
    const adjustments = adjustmentsForUnits(campaign, { ...benefit, type: 'PERCENT_OFF', value: 100 }, selected).map((item) => ({ ...item, adjustment_type: 'FREE_ITEM' as const, metadata: { reward_mode: reward.mode, fulfilment: 'DISCOUNT_EXISTING', added_quantity: 0, source_product_ids: eligibleLines.map((line) => line.product_id) } }));
    const byProduct = new Map<string, number>();
    for (const unit of selected) byProduct.set(unit.line.product_id, (byProduct.get(unit.line.product_id) ?? 0) + 1);
    const quantityBreakdown = eligibleLines.map((line) => {
      const free = byProduct.get(line.product_id) ?? 0;
      return { product_id: line.product_id, paid_quantity: line.quantity - free, free_quantity: free, total_quantity: line.quantity };
    });
    return { eligible: true, adjustments, discount_total: adjustments.reduce((sum, item) => sum + item.amount, 0), affected_quantity: giftQuantity, gifts: [], quantity_breakdown: quantityBreakdown, entitlements: [], reason_codes: [], progress: [] };
  }

  const catalog = context.reward_catalog ?? [];
  const giftProduct = reward.product_ids.map((id) => catalog.find((product) => product.product_id === id)).find((product) => product && (product.available_quantity ?? 0) >= giftQuantity);
  if (!giftProduct) return { eligible: false, adjustments: [], discount_total: 0, affected_quantity: 0, gifts: [], quantity_breakdown: [], entitlements: [], reason_codes: ['GIFT_OUT_OF_STOCK'], progress: [] };
  const adjustment: PromotionV3UnitAdjustment = {
    adjustment_id: randomUUID(), promotion_id: campaign.promotion_id, rule_version: campaign.rule_version,
    product_id: giftProduct.product_id, affected_quantity: giftQuantity, unit_keys: sourceUnits.map((unit) => unit.unitKey),
    list_amount: giftProduct.unit_price_paise * giftQuantity, amount: giftProduct.unit_price_paise * giftQuantity, payable_amount: 0,
    adjustment_type: 'FREE_ITEM', metadata: { reward_mode: reward.mode, fulfilment: 'AUTO_ADD', added_quantity: giftQuantity, source_product_ids: eligibleLines.map((line) => line.product_id) },
  };
  return {
    eligible: true, adjustments: [adjustment], discount_total: adjustment.amount, affected_quantity: giftQuantity, reason_codes: [], progress: [], entitlements: [], quantity_breakdown: [],
    gifts: [{ promotion_id: campaign.promotion_id, product_id: giftProduct.product_id, paid_quantity: 0, free_quantity: giftQuantity, total_quantity: giftQuantity, added_quantity: giftQuantity, fulfilment: 'AUTO_ADD', editable: false }],
  };
}

export function evaluateV3ItemPromotion(
  lines: PromotionV3CartLine[],
  campaign: PromotionV3ItemCampaign,
  context: PromotionV3EvaluationContext,
): PromotionV3ItemEvaluation {
  const eligibleLines = lines.filter((line) => line.quantity > 0 && lineMatchesScope(line, campaign.rule));
  if (eligibleLines.length === 0) {
    return { eligible: false, adjustments: [], discount_total: 0, affected_quantity: 0, reason_codes: ['NO_ELIGIBLE_PRODUCTS'], progress: [], gifts: [], quantity_breakdown: [], entitlements: [] };
  }
  if (campaign.rule.benefit?.type === 'FREE_ITEM' && campaign.rule.reward?.mode === 'SAME_PRODUCT' && campaign.rule.reward.fulfilment === 'AUTO_ADD') {
    return sameProductGiftEvaluation(eligibleLines, lines, campaign, context, campaign.rule.benefit);
  }
  if (campaign.rule.benefit?.type === 'FREE_ITEM' && campaign.rule.reward && campaign.rule.reward.mode !== 'SAME_PRODUCT') {
    return configuredGiftEvaluation(eligibleLines, lines, campaign, context, campaign.rule.benefit);
  }
  const failures = campaign.rule.qualifier.predicates
    .map((predicate) => predicateFailure(predicate, eligibleLines, lines, context))
    .filter((failure) => failure.reason);
  if (failures.length) {
    return {
      eligible: false,
      adjustments: [],
      discount_total: 0,
      affected_quantity: 0,
      reason_codes: [...new Set(failures.flatMap((failure) => failure.reason ?? []))],
      progress: failures.flatMap((failure) => failure.progress ?? []),
      gifts: [], quantity_breakdown: [], entitlements: [],
    };
  }
  const eligibleQuantity = eligibleLines.reduce((sum, line) => sum + line.quantity, 0);
  const matchedTier = [...campaign.rule.tiers].reverse().find((tier) => eligibleQuantity >= tier.minimum_quantity);
  const nextTier = campaign.rule.tiers.find((tier) => tier.minimum_quantity > eligibleQuantity);
  const benefit = matchedTier?.benefit ?? campaign.rule.benefit;
  if (!benefit) {
    const firstTier = campaign.rule.tiers[0]!;
    return {
      eligible: false,
      adjustments: [],
      discount_total: 0,
      affected_quantity: 0,
      reason_codes: ['MINIMUM_QUANTITY_NOT_MET'],
      progress: [{ field: 'ELIGIBLE_QUANTITY', current: eligibleQuantity, required: firstTier.minimum_quantity, remaining: firstTier.minimum_quantity - eligibleQuantity }],
      gifts: [], quantity_breakdown: [], entitlements: [],
    };
  }
  if (benefit.type === 'FREE_ITEM' && campaign.rule.reward?.mode === 'SAME_PRODUCT' && campaign.rule.reward.fulfilment === 'AUTO_ADD') {
    return sameProductGiftEvaluation(eligibleLines, lines, campaign, context, benefit);
  }
  if (!['PERCENT_OFF', 'FIXED_AMOUNT_OFF'].includes(benefit.type)) {
    throw new Error('V3 item evaluation currently supports percentage and fixed-amount benefits only');
  }
  const units = selectUnits(expandUnits(eligibleLines), campaign.rule, benefit, context.unavailable_unit_keys ?? new Set(), matchedTier?.minimum_quantity);
  const adjustments = adjustmentsForUnits(campaign, benefit, units);
  return {
    eligible: true,
    adjustments,
    discount_total: adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0),
    affected_quantity: adjustments.reduce((sum, adjustment) => sum + adjustment.affected_quantity, 0),
    reason_codes: [],
    progress: nextTier ? [{
      field: 'ELIGIBLE_QUANTITY',
      current: eligibleQuantity,
      required: nextTier.minimum_quantity,
      remaining: nextTier.minimum_quantity - eligibleQuantity,
    }] : [],
    ...(matchedTier ? { matched_tier_minimum: matchedTier.minimum_quantity } : {}),
    gifts: [], quantity_breakdown: [], entitlements: [],
  };
}
