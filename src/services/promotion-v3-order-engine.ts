import { randomUUID } from 'node:crypto';
import type { PromotionPredicate, PromotionRuleV3 } from '../schemas/promotions-v3.schema.js';
import type { PromotionV3CartLine, PromotionV3EvaluationContext, PromotionV3ItemCampaign } from './promotion-v3-item-engine.js';

type OrderBenefit = PromotionRuleV3['tiers'][number]['benefit'];

export interface PromotionV3OrderAdjustment {
  adjustment_id: string;
  promotion_id: number;
  rule_version: number;
  adjustment_type: 'CART_PERCENTAGE_DISCOUNT' | 'ORDER_FIXED_DISCOUNT';
  basis_amount: number;
  amount: number;
  payable_amount: number;
}

export interface PromotionV3OrderEvaluation {
  eligible: boolean;
  adjustment?: PromotionV3OrderAdjustment;
  discount_total: number;
  reason_codes: string[];
  progress: Array<{ field: PromotionPredicate['field']; current: number; required: number; remaining: number }>;
  matched_tier_minimum?: number;
}

const compare = (actual: number, operator: 'GT' | 'GTE' | 'EQ' | 'LTE' | 'LT', expected: number): boolean => {
  if (operator === 'GT') return actual > expected;
  if (operator === 'GTE') return actual >= expected;
  if (operator === 'EQ') return actual === expected;
  if (operator === 'LTE') return actual <= expected;
  return actual < expected;
};

const normalise = (value: string): string => value.trim().toLocaleLowerCase('en-IN');

function predicateValue(
  predicate: Exclude<PromotionPredicate, { field: 'CHANNEL' | 'CUSTOMER_SEGMENT' }>,
  lines: PromotionV3CartLine[],
  remainingCartValue: number,
  context: PromotionV3EvaluationContext,
): number {
  const originalSubtotal = lines.reduce((sum, line) => sum + line.unit_price_paise * line.quantity, 0);
  if (predicate.field === 'ELIGIBLE_QUANTITY') return lines.reduce((sum, line) => sum + line.quantity, 0);
  if (predicate.field === 'DISTINCT_PRODUCT_COUNT') return new Set(lines.map((line) => line.product_id)).size;
  if (predicate.field === 'REMAINING_CART_VALUE') return remainingCartValue;
  if (predicate.field === 'ORDER_TOTAL') return remainingCartValue + (context.shipping_amount ?? 0);
  return originalSubtotal;
}

function failures(
  rule: PromotionRuleV3,
  lines: PromotionV3CartLine[],
  remainingCartValue: number,
  context: PromotionV3EvaluationContext,
): { reason_codes: string[]; progress: PromotionV3OrderEvaluation['progress'] } {
  const reasonCodes: string[] = [];
  const progress: PromotionV3OrderEvaluation['progress'] = [];
  for (const predicate of rule.qualifier.predicates) {
    if (predicate.field === 'CHANNEL') {
      const includes = predicate.value.includes(context.channel);
      if ((predicate.operator === 'IN') !== includes) reasonCodes.push('CHANNEL_NOT_ELIGIBLE');
      continue;
    }
    if (predicate.field === 'CUSTOMER_SEGMENT') {
      const segments = new Set((context.customer_segments ?? []).map(normalise));
      const includes = predicate.value.some((segment) => segments.has(normalise(segment)));
      if ((predicate.operator === 'IN') !== includes) reasonCodes.push('CUSTOMER_NOT_ELIGIBLE');
      continue;
    }
    const current = predicateValue(predicate, lines, remainingCartValue, context);
    if (compare(current, predicate.operator, predicate.value)) continue;
    const isValue = ['QUALIFYING_SUBTOTAL', 'CART_SUBTOTAL', 'REMAINING_CART_VALUE', 'ORDER_TOTAL'].includes(predicate.field);
    reasonCodes.push(isValue ? 'MINIMUM_VALUE_NOT_MET' : 'MINIMUM_QUANTITY_NOT_MET');
    if (predicate.operator === 'GT' || predicate.operator === 'GTE') {
      const required = predicate.operator === 'GT' ? predicate.value + 1 : predicate.value;
      progress.push({ field: predicate.field, current, required, remaining: Math.max(0, required - current) });
    }
  }
  return { reason_codes: [...new Set(reasonCodes)], progress };
}

function selectedBenefit(rule: PromotionRuleV3, quantity: number): { benefit?: OrderBenefit; matchedTierMinimum?: number; nextTierMinimum?: number } {
  const matched = [...rule.tiers].reverse().find((tier) => quantity >= tier.minimum_quantity);
  const next = rule.tiers.find((tier) => tier.minimum_quantity > quantity);
  const benefit = matched?.benefit ?? rule.benefit;
  return {
    ...(benefit ? { benefit } : {}),
    ...(matched ? { matchedTierMinimum: matched.minimum_quantity } : {}),
    ...(next ? { nextTierMinimum: next.minimum_quantity } : {}),
  };
}

export function isOrderLevelCampaign(campaign: PromotionV3ItemCampaign): boolean {
  const benefits = [campaign.rule.benefit, ...campaign.rule.tiers.map((tier) => tier.benefit)].filter((item): item is OrderBenefit => item !== undefined);
  return benefits.length > 0 && benefits.every((benefit) => benefit.application_level === 'ORDER');
}

export function evaluateV3OrderPromotion(
  lines: PromotionV3CartLine[],
  campaign: PromotionV3ItemCampaign,
  context: PromotionV3EvaluationContext,
  remainingCartValue: number,
): PromotionV3OrderEvaluation {
  const failed = failures(campaign.rule, lines, remainingCartValue, context);
  if (failed.reason_codes.length) return { eligible: false, discount_total: 0, ...failed };

  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const selected = selectedBenefit(campaign.rule, quantity);
  if (!selected.benefit) {
    const required = selected.nextTierMinimum ?? campaign.rule.tiers[0]?.minimum_quantity ?? 1;
    return {
      eligible: false,
      discount_total: 0,
      reason_codes: ['MINIMUM_QUANTITY_NOT_MET'],
      progress: [{ field: 'ELIGIBLE_QUANTITY', current: quantity, required, remaining: Math.max(0, required - quantity) }],
    };
  }
  const benefit = selected.benefit;
  if (benefit.application_level !== 'ORDER' || !['PERCENT_OFF', 'FIXED_AMOUNT_OFF'].includes(benefit.type)) {
    throw new Error('Order evaluation requires an order-level percentage or fixed discount');
  }
  const calculated = benefit.type === 'PERCENT_OFF'
    ? Math.floor(remainingCartValue * (benefit.value ?? 0) / 100)
    : Math.min(remainingCartValue, benefit.value ?? 0);
  const amount = Math.min(calculated, campaign.rule.limits.maximum_discount_amount ?? Number.MAX_SAFE_INTEGER);
  return {
    eligible: amount > 0,
    adjustment: {
      adjustment_id: randomUUID(),
      promotion_id: campaign.promotion_id,
      rule_version: campaign.rule_version,
      adjustment_type: benefit.type === 'PERCENT_OFF' ? 'CART_PERCENTAGE_DISCOUNT' : 'ORDER_FIXED_DISCOUNT',
      basis_amount: remainingCartValue,
      amount,
      payable_amount: remainingCartValue - amount,
    },
    discount_total: amount,
    reason_codes: amount > 0 ? [] : ['MINIMUM_VALUE_NOT_MET'],
    progress: selected.nextTierMinimum ? [{ field: 'ELIGIBLE_QUANTITY', current: quantity, required: selected.nextTierMinimum, remaining: selected.nextTierMinimum - quantity }] : [],
    ...(selected.matchedTierMinimum !== undefined ? { matched_tier_minimum: selected.matchedTierMinimum } : {}),
  };
}
