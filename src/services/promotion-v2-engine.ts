import { randomUUID } from 'node:crypto';
import type { PromotionBenefit, PromotionRuleV2 } from '../schemas/promotions-v2.schema.js';

export type PromotionChannel = 'web' | 'mobile' | 'nivapp' | 'amazon' | 'flipkart' | 'instore';

export interface PromotionCatalogProduct {
  id: string;
  name?: string;
  active?: boolean;
  unitPricePaise: number;
  stock?: number;
  catalogVersion?: string;
  facets: Partial<Record<'CATEGORY' | 'SUBCATEGORY', string[]>>;
  // Future facet keys intentionally disabled: FRAGRANCE, BRAND, COLLECTION,
  // TAG and SUBSUBCATEGORY.
}

export interface PromotionCartLine extends PromotionCatalogProduct {
  cartRecordId?: string | undefined;
  quantity: number;
  isGift?: boolean;
}

export interface PromotionCampaign {
  promotionId: number;
  ruleVersion: number;
  name: string;
  rule: PromotionRuleV2;
}

export interface PromotionAdjustment {
  adjustment_id: string;
  promotion_id: number;
  rule_version: number;
  type: 'PERCENT_DISCOUNT' | 'FIXED_AMOUNT_DISCOUNT' | 'FREE_ITEM' | 'FREE_SHIPPING';
  cart_record_id?: string | undefined;
  product_id?: string | undefined;
  affected_quantity: number;
  list_amount: number;
  amount: number;
  payable_amount: number;
  source_product_ids: string[];
  metadata: Record<string, unknown>;
}

export interface PromotionRejection {
  promotion_id: number;
  reason_code: 'MINIMUM_QUANTITY_NOT_MET' | 'MINIMUM_VALUE_NOT_MET' | 'GIFT_OUT_OF_STOCK' | 'CONFLICTED_WITH_BETTER_OFFER' | 'INVALID_REWARD_SELECTION' | 'NO_ELIGIBLE_PRODUCTS' | 'USAGE_LIMIT_REACHED' | 'BUDGET_EXHAUSTED' | 'CUSTOMER_NOT_ELIGIBLE' | 'CHANNEL_NOT_ELIGIBLE';
  details?: Record<string, unknown>;
}

export interface PromotionNextTierProgress {
  promotion_id: number;
  current: number;
  next_minimum: number;
  remaining: number;
  metric: PromotionRuleV2['qualifier']['metric'];
}

export interface PromotionQuote {
  schema_version: 2;
  evaluation_id: string;
  currency: 'INR';
  original_total: number;
  shipping_amount: number;
  discount_total: number;
  payable_total: number;
  adjustments: PromotionAdjustment[];
  applied_promotions: Array<{ promotion_id: number; name: string; saving: number }>;
  eligible_alternatives: Array<{ promotion_id: number; name: string; saving: number }>;
  rejected_candidates: PromotionRejection[];
  next_tier_progress: PromotionNextTierProgress[];
  gift_choices: Array<{ promotion_id: number; product_ids: string[] }>;
  expires_at: string;
}

interface Candidate {
  campaign: PromotionCampaign;
  adjustments: PromotionAdjustment[];
  saving: number;
  consumedUnits: Set<string>;
  globalExclusive: boolean;
}

interface EvaluationOptions {
  shippingAmount?: number;
  rewardSelections?: Record<string, string> | undefined;
  now?: Date;
  ttlSeconds?: number;
}

const normalise = (value: string): string => value.trim().toLocaleLowerCase('en-IN');

function lineHasFacet(line: PromotionCartLine, facet: string, values: string[]): boolean {
  if (facet === 'ENTIRE_CART') return true;
  if (facet === 'PRODUCT') return values.map(String).includes(line.id);
  const actual = line.facets[facet as keyof PromotionCartLine['facets']] ?? [];
  const wanted = new Set(values.map(normalise));
  return actual.some((value) => wanted.has(normalise(value)));
}

export function isLineInPromotionScope(line: PromotionCartLine, rule: PromotionRuleV2): boolean {
  if (line.isGift || line.active === false) return false;
  const { include, exclude, group_operator: operator } = rule.qualifier.scope;
  const included = include.length === 0 || (operator === 'AND'
    ? include.every((group) => lineHasFacet(line, group.facet, group.values))
    : include.some((group) => lineHasFacet(line, group.facet, group.values)));
  const excluded = exclude.some((group) => lineHasFacet(line, group.facet, group.values));
  return included && !excluded;
}

function metricValue(rule: PromotionRuleV2, eligible: PromotionCartLine[], allLines: PromotionCartLine[], shippingAmount: number): number {
  switch (rule.qualifier.metric) {
    case 'DISTINCT_PRODUCT_COUNT': return new Set(eligible.map((line) => line.id)).size;
    case 'PER_PRODUCT_QUANTITY': return eligible.length ? Math.max(...eligible.map((line) => line.quantity)) : 0;
    case 'QUALIFYING_SUBTOTAL': return eligible.reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0);
    case 'CART_SUBTOTAL': return allLines.filter((line) => !line.isGift).reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0);
    case 'ORDER_TOTAL': return allLines.filter((line) => !line.isGift).reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0) + shippingAmount;
    case 'ELIGIBLE_QUANTITY': return eligible.reduce((sum, line) => sum + line.quantity, 0);
  }
}

function thresholdFor(rule: PromotionRuleV2): number {
  if (['QUALIFYING_SUBTOTAL', 'CART_SUBTOTAL', 'ORDER_TOTAL'].includes(rule.qualifier.metric)) return rule.qualifier.minimum_value ?? 0;
  return rule.qualifier.minimum_quantity ?? 1;
}

function matchingBenefit(rule: PromotionRuleV2, metric: number): { benefit?: PromotionBenefit | undefined; minimum: number; next?: number | undefined } {
  if (rule.tiers.length) {
    const matched = [...rule.tiers].reverse().find((tier) => metric >= tier.minimum);
    const next = rule.tiers.find((tier) => tier.minimum > metric)?.minimum;
    return { benefit: matched?.benefit, minimum: matched?.minimum ?? rule.tiers[0]!.minimum, next };
  }
  const minimum = thresholdFor(rule);
  return { benefit: metric >= minimum ? rule.benefit : undefined, minimum, next: metric < minimum ? minimum : undefined };
}

function unitKeys(lines: PromotionCartLine[], maximum?: number): Set<string> {
  const result = new Set<string>();
  let remaining = maximum ?? Number.MAX_SAFE_INTEGER;
  for (const line of [...lines].sort((a, b) => a.id.localeCompare(b.id))) {
    for (let index = 0; index < line.quantity && remaining > 0; index += 1, remaining -= 1) result.add(`${line.id}:${index}`);
  }
  return result;
}

function atomicCandidates(candidate: Candidate): Candidate[] {
  if (candidate.globalExclusive || candidate.adjustments.some((adjustment) => adjustment.type === 'FREE_ITEM' || adjustment.type === 'FREE_SHIPPING')) return [candidate];
  const result: Candidate[] = [];
  for (const adjustment of candidate.adjustments) {
    const quantity = Math.max(1, adjustment.affected_quantity);
    let remainder = adjustment.amount;
    for (let index = 0; index < quantity; index += 1) {
      const remainingUnits = quantity - index;
      const amount = Math.floor(remainder / remainingUnits);
      remainder -= amount;
      if (amount <= 0) continue;
      const unitAdjustment: PromotionAdjustment = {
        ...adjustment,
        adjustment_id: randomUUID(),
        affected_quantity: 1,
        list_amount: Math.floor(adjustment.list_amount / quantity),
        amount,
        payable_amount: Math.max(0, Math.floor(adjustment.list_amount / quantity) - amount),
        metadata: { ...adjustment.metadata, unit_index: index },
      };
      result.push({
        ...candidate,
        adjustments: [unitAdjustment],
        saving: amount,
        consumedUnits: new Set([`${adjustment.product_id}:${index}`]),
      });
    }
  }
  return result;
}

function qualificationBuckets(rule: PromotionRuleV2, eligible: PromotionCartLine[]): PromotionCartLine[][] {
  const facetForAggregation: Partial<Record<PromotionRuleV2['qualifier']['aggregation'], keyof PromotionCartLine['facets']>> = {
    PER_CATEGORY: 'CATEGORY', PER_SUBCATEGORY: 'SUBCATEGORY',
    // PER_FRAGRANCE: 'FRAGRANCE', // Outside the approved scope.
  };
  if (rule.qualifier.aggregation === 'PER_PRODUCT' || rule.qualifier.metric === 'PER_PRODUCT_QUANTITY') {
    return [...new Set(eligible.map((line) => line.id))].sort().map((id) => eligible.filter((line) => line.id === id));
  }
  const facet = facetForAggregation[rule.qualifier.aggregation];
  if (!facet) return [eligible];
  const keys = [...new Set(eligible.flatMap((line) => line.facets[facet] ?? []))].sort();
  return keys.map((key) => eligible.filter((line) => (line.facets[facet] ?? []).includes(key)));
}

function allocateAmount(lines: PromotionCartLine[], total: number, type: PromotionAdjustment['type'], campaign: PromotionCampaign): PromotionAdjustment[] {
  const eligibleTotal = lines.reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0);
  let remainder = Math.min(total, eligibleTotal);
  return [...lines].sort((a, b) => a.id.localeCompare(b.id)).map((line, index, ordered) => {
    const lineTotal = line.unitPricePaise * line.quantity;
    const amount = index === ordered.length - 1 ? remainder : Math.min(remainder, Math.floor(total * lineTotal / Math.max(eligibleTotal, 1)));
    remainder -= amount;
    return {
      adjustment_id: randomUUID(), promotion_id: campaign.promotionId, rule_version: campaign.ruleVersion,
      type, cart_record_id: line.cartRecordId, product_id: line.id, affected_quantity: line.quantity,
      list_amount: lineTotal, amount, payable_amount: lineTotal - amount, source_product_ids: lines.map((item) => item.id), metadata: {},
    };
  }).filter((adjustment) => adjustment.amount > 0);
}

function selectGift(
  benefit: PromotionBenefit,
  campaign: PromotionCampaign,
  eligible: PromotionCartLine[],
  catalog: Map<string, PromotionCatalogProduct>,
  selection?: string,
): PromotionCatalogProduct | undefined {
  if (benefit.target === 'CUSTOMER_SELECTED_REWARD_GROUP') {
    if (!selection || !benefit.reward_group?.includes(selection)) return undefined;
    return catalog.get(selection);
  }
  if (benefit.target === 'SPECIFIC_PRODUCTS') {
    return benefit.product_ids?.map((id) => catalog.get(id)).find((product) => product && (product.stock ?? 0) > 0);
  }
  const ordered = [...eligible].sort((a, b) => a.unitPricePaise - b.unitPricePaise || a.id.localeCompare(b.id));
  if (benefit.target === 'MOST_EXPENSIVE_QUALIFYING_UNIT') ordered.reverse();
  return ordered[0];
}

function buildCandidate(
  campaign: PromotionCampaign,
  benefit: PromotionBenefit,
  eligible: PromotionCartLine[],
  metric: number,
  catalog: Map<string, PromotionCatalogProduct>,
  shippingAmount: number,
  rewardSelection?: string,
  allLines: PromotionCartLine[] = eligible,
): { candidate?: Candidate; rejection?: PromotionRejection; giftChoices?: string[] } {
  const rule = campaign.rule;
  const qualifier = Math.max(1, thresholdFor(rule));
  const rewardComesFromQualifier = ['SAME_PRODUCT_AS_QUALIFIER', 'CHEAPEST_QUALIFYING_UNIT', 'MOST_EXPENSIVE_QUALIFYING_UNIT'].includes(benefit.target);
  const applicationUnitRequirement = benefit.type === 'FREE_ITEM' && benefit.fulfilment === 'DISCOUNT_EXISTING' && rewardComesFromQualifier
    ? qualifier + (benefit.quantity ?? 1)
    : qualifier;
  if (metric < applicationUnitRequirement) {
    return { rejection: { promotion_id: campaign.promotionId, reason_code: 'MINIMUM_QUANTITY_NOT_MET', details: { current: metric, required: applicationUnitRequirement, remaining: applicationUnitRequirement - metric } } };
  }
  const rawApplications = rule.repeat === 'PER_MULTIPLE' ? Math.floor(metric / applicationUnitRequirement) : 1;
  const applications = Math.max(1, Math.min(rawApplications, rule.limits.maximum_applications_per_order ?? rawApplications));
  let adjustments: PromotionAdjustment[] = [];
  let consumed = unitKeys(eligible);

  if (benefit.type === 'PERCENT_OFF') {
    const ordered = [...eligible].sort((a, b) => a.unitPricePaise - b.unitPricePaise || a.id.localeCompare(b.id));
    if (benefit.target === 'MOST_EXPENSIVE_QUALIFYING_UNIT') ordered.reverse();
    const discountedLines = ['CHEAPEST_QUALIFYING_UNIT', 'MOST_EXPENSIVE_QUALIFYING_UNIT'].includes(benefit.target) ? [{ ...ordered[0]!, quantity: 1 }] : eligible;
    const base = discountedLines.reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0);
    const amount = Math.min(Math.floor(base * (benefit.value ?? 0) / 100), rule.limits.maximum_discount_amount ?? Number.MAX_SAFE_INTEGER);
    adjustments = allocateAmount(discountedLines, amount, 'PERCENT_DISCOUNT', campaign);
    consumed = unitKeys(discountedLines);
  } else if (benefit.type === 'FIXED_AMOUNT_OFF') {
    const amount = Math.min(benefit.value ?? 0, rule.limits.maximum_discount_amount ?? Number.MAX_SAFE_INTEGER);
    adjustments = allocateAmount(eligible, amount, 'FIXED_AMOUNT_DISCOUNT', campaign);
  } else if (benefit.type === 'FREE_SHIPPING') {
    const amount = Math.min(shippingAmount, benefit.value || shippingAmount, rule.limits.maximum_discount_amount ?? Number.MAX_SAFE_INTEGER);
    adjustments = [{
      adjustment_id: randomUUID(), promotion_id: campaign.promotionId, rule_version: campaign.ruleVersion,
      type: 'FREE_SHIPPING', affected_quantity: 1, list_amount: shippingAmount, amount,
      payable_amount: shippingAmount - amount, source_product_ids: eligible.map((line) => line.id), metadata: {},
    }];
    consumed = new Set();
  } else {
    const choices = benefit.target === 'CUSTOMER_SELECTED_REWARD_GROUP' ? (benefit.reward_group ?? []).filter((id) => (catalog.get(id)?.stock ?? 0) > 0) : undefined;
    if (choices?.length && !rewardSelection) return { giftChoices: choices };
    const rewardPool = benefit.fulfilment === 'DISCOUNT_EXISTING' ? allLines.filter((line) => !line.isGift) : eligible;
    const rewardCatalog = benefit.fulfilment === 'DISCOUNT_EXISTING' ? new Map(rewardPool.map((line) => [line.id, line])) : catalog;
    let gift = selectGift(benefit, campaign, rewardComesFromQualifier ? eligible : rewardPool, rewardCatalog, rewardSelection);
    if (gift && (gift.stock ?? Number.MAX_SAFE_INTEGER) <= 0) gift = undefined;
    if (!gift) {
      if (benefit.out_of_stock_policy === 'CUSTOMER_SELECTS_ALTERNATIVE') {
        const alternatives = (benefit.reward_group ?? benefit.product_ids ?? []).filter((id) => (catalog.get(id)?.stock ?? 0) > 0);
        if (alternatives.length) return { giftChoices: alternatives };
      }
      if (benefit.out_of_stock_policy === 'CONVERT_TO_DISCOUNT' && (benefit.fallback_discount_amount ?? 0) > 0) {
        const amount = Math.min(benefit.fallback_discount_amount!, eligible.reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0));
        adjustments = allocateAmount(eligible, amount, 'FIXED_AMOUNT_DISCOUNT', campaign).map((adjustment) => ({
          ...adjustment, metadata: { gift_conversion: true, out_of_stock_policy: benefit.out_of_stock_policy },
        }));
        return { candidate: { campaign, adjustments, saving: amount, consumedUnits: unitKeys(eligible), globalExclusive: false } };
      }
      return { rejection: { promotion_id: campaign.promotionId, reason_code: rewardSelection ? 'INVALID_REWARD_SELECTION' : 'GIFT_OUT_OF_STOCK' } };
    }
    const requested = (benefit.quantity ?? 1) * applications;
    const freeQuantity = Math.min(requested, rule.limits.maximum_free_quantity ?? requested);
    const existingGiftLine = benefit.fulfilment === 'DISCOUNT_EXISTING' ? allLines.find((line) => line.id === gift!.id && !line.isGift) : undefined;
    if (benefit.fulfilment === 'DISCOUNT_EXISTING' && (!existingGiftLine || existingGiftLine.quantity < freeQuantity)) {
      return { rejection: { promotion_id: campaign.promotionId, reason_code: 'MINIMUM_QUANTITY_NOT_MET', details: { reward_product_id: gift.id, required_reward_quantity: freeQuantity } } };
    }
    if (benefit.fulfilment === 'AUTO_ADD' && (gift.stock ?? Number.MAX_SAFE_INTEGER) < freeQuantity) {
      return { rejection: { promotion_id: campaign.promotionId, reason_code: 'GIFT_OUT_OF_STOCK', details: { product_id: gift.id } } };
    }
    adjustments = [{
      adjustment_id: randomUUID(), promotion_id: campaign.promotionId, rule_version: campaign.ruleVersion,
      type: 'FREE_ITEM', product_id: gift.id, cart_record_id: existingGiftLine?.cartRecordId, affected_quantity: freeQuantity,
      list_amount: gift.unitPricePaise * freeQuantity, amount: gift.unitPricePaise * freeQuantity,
      payable_amount: 0, source_product_ids: eligible.map((line) => line.id),
      metadata: { fulfilment: benefit.fulfilment, out_of_stock_policy: benefit.out_of_stock_policy, return_policy: benefit.return_policy },
    }];
    consumed = unitKeys(eligible, applicationUnitRequirement * applications);
    if (existingGiftLine && !rewardComesFromQualifier) for (const key of unitKeys([{ ...existingGiftLine, quantity: freeQuantity }])) consumed.add(key);
  }

  const saving = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
  return {
    candidate: {
      campaign, adjustments, saving, consumedUnits: consumed,
      globalExclusive: rule.stacking.exclusive_group === 'ORDER_DISCOUNT' || rule.stacking.exclusive_group === 'SHIPPING_DISCOUNT',
    },
  };
}

function candidatesConflict(left: Candidate, right: Candidate): boolean {
  if (left.campaign.rule.stacking.stackable && right.campaign.rule.stacking.stackable) return false;
  if (left.campaign.rule.stacking.exclusive_group !== right.campaign.rule.stacking.exclusive_group) return false;
  if (left.globalExclusive || right.globalExclusive) return true;
  if (left.campaign.rule.stacking.item_reuse === 'ALLOW' && right.campaign.rule.stacking.item_reuse === 'ALLOW') return false;
  return [...left.consumedUnits].some((unit) => right.consumedUnits.has(unit));
}

function betterSet(left: Candidate[], right: Candidate[]): Candidate[] {
  const saving = (items: Candidate[]) => items.reduce((sum, item) => sum + item.saving, 0);
  const leftSaving = saving(left);
  const rightSaving = saving(right);
  if (leftSaving !== rightSaving) return leftSaving > rightSaving ? left : right;
  const leftPriority = left.reduce((sum, item) => sum + item.campaign.rule.stacking.priority, 0);
  const rightPriority = right.reduce((sum, item) => sum + item.campaign.rule.stacking.priority, 0);
  if (leftPriority !== rightPriority) return leftPriority > rightPriority ? left : right;
  const signature = (items: Candidate[]) => items.map((item) => item.campaign.promotionId).sort((a, b) => a - b).join(',');
  return signature(left).localeCompare(signature(right)) <= 0 ? left : right;
}

function optimise(candidates: Candidate[]): Candidate[] {
  const ordered = [...candidates].sort((a, b) => a.campaign.promotionId - b.campaign.promotionId);
  if (ordered.length > 22) {
    return ordered.sort((a, b) => b.saving - a.saving || b.campaign.rule.stacking.priority - a.campaign.rule.stacking.priority || a.campaign.promotionId - b.campaign.promotionId)
      .reduce<Candidate[]>((selected, candidate) => selected.some((existing) => candidatesConflict(existing, candidate)) ? selected : [...selected, candidate], []);
  }
  let best: Candidate[] = [];
  const visit = (index: number, selected: Candidate[]): void => {
    if (index === ordered.length) { best = betterSet(best, selected); return; }
    visit(index + 1, selected);
    const candidate = ordered[index]!;
    if (!selected.some((existing) => candidatesConflict(existing, candidate))) visit(index + 1, [...selected, candidate]);
  };
  visit(0, []);
  return best;
}

export function evaluatePromotionQuote(
  lines: PromotionCartLine[],
  campaigns: PromotionCampaign[],
  catalogProducts: PromotionCatalogProduct[],
  options: EvaluationOptions = {},
): PromotionQuote {
  const shippingAmount = options.shippingAmount ?? 0;
  const catalog = new Map(catalogProducts.map((product) => [product.id, product]));
  const candidates: Candidate[] = [];
  const rejected: PromotionRejection[] = [];
  const progress: PromotionNextTierProgress[] = [];
  const giftChoices: Array<{ promotion_id: number; product_ids: string[] }> = [];

  for (const campaign of [...campaigns].sort((a, b) => a.promotionId - b.promotionId)) {
    const eligible = lines.filter((line) => isLineInPromotionScope(line, campaign.rule));
    if (!eligible.length) { rejected.push({ promotion_id: campaign.promotionId, reason_code: 'NO_ELIGIBLE_PRODUCTS' }); continue; }
    for (const bucket of qualificationBuckets(campaign.rule, eligible)) {
      const metric = metricValue(campaign.rule, bucket, lines, shippingAmount);
      const match = matchingBenefit(campaign.rule, metric);
      if (match.next !== undefined) progress.push({ promotion_id: campaign.promotionId, current: metric, next_minimum: match.next, remaining: match.next - metric, metric: campaign.rule.qualifier.metric });
      if (!match.benefit) {
        rejected.push({ promotion_id: campaign.promotionId, reason_code: ['QUALIFYING_SUBTOTAL', 'CART_SUBTOTAL', 'ORDER_TOTAL'].includes(campaign.rule.qualifier.metric) ? 'MINIMUM_VALUE_NOT_MET' : 'MINIMUM_QUANTITY_NOT_MET', details: { current: metric, required: match.minimum, remaining: Math.max(0, match.minimum - metric), product_ids: bucket.map((line) => line.id) } });
        continue;
      }
      const built = buildCandidate(campaign, match.benefit, bucket, metric, catalog, shippingAmount, options.rewardSelections?.[String(campaign.promotionId)], lines);
      if (built.rejection) rejected.push(built.rejection);
      if (built.giftChoices && !giftChoices.some((choice) => choice.promotion_id === campaign.promotionId)) giftChoices.push({ promotion_id: campaign.promotionId, product_ids: built.giftChoices });
      if (built.candidate?.saving) candidates.push(...atomicCandidates(built.candidate));
    }
  }

  const selected = optimise(candidates);
  const selectedIds = new Set(selected.map((candidate) => candidate.campaign.promotionId));
  for (const candidate of candidates) {
    if (!selectedIds.has(candidate.campaign.promotionId) && !rejected.some((item) => item.promotion_id === candidate.campaign.promotionId && item.reason_code === 'CONFLICTED_WITH_BETTER_OFFER')) {
      rejected.push({ promotion_id: candidate.campaign.promotionId, reason_code: 'CONFLICTED_WITH_BETTER_OFFER' });
    }
  }
  const adjustments = selected.flatMap((candidate) => candidate.adjustments);
  const merchandise = lines.filter((line) => !line.isGift).reduce((sum, line) => sum + line.unitPricePaise * line.quantity, 0);
  const autoAddedGiftValue = adjustments.filter((adjustment) => adjustment.type === 'FREE_ITEM' && adjustment.metadata.fulfilment === 'AUTO_ADD')
    .reduce((sum, adjustment) => sum + adjustment.list_amount, 0);
  const originalTotal = merchandise + shippingAmount + autoAddedGiftValue;
  const discountTotal = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
  const now = options.now ?? new Date();

  const appliedByPromotion = new Map<number, { promotion_id: number; name: string; saving: number }>();
  for (const candidate of selected) {
    const current = appliedByPromotion.get(candidate.campaign.promotionId);
    appliedByPromotion.set(candidate.campaign.promotionId, { promotion_id: candidate.campaign.promotionId, name: candidate.campaign.name, saving: (current?.saving ?? 0) + candidate.saving });
  }
  return {
    schema_version: 2, evaluation_id: randomUUID(), currency: 'INR', original_total: originalTotal,
    shipping_amount: shippingAmount, discount_total: discountTotal, payable_total: Math.max(0, originalTotal - discountTotal),
    adjustments,
    applied_promotions: [...appliedByPromotion.values()],
    eligible_alternatives: [...new Map(candidates.filter((candidate) => !selectedIds.has(candidate.campaign.promotionId)).map((candidate) => [candidate.campaign.promotionId, { promotion_id: candidate.campaign.promotionId, name: candidate.campaign.name, saving: candidate.saving }])).values()],
    rejected_candidates: rejected, next_tier_progress: progress, gift_choices: giftChoices,
    expires_at: new Date(now.getTime() + (options.ttlSeconds ?? 900) * 1000).toISOString(),
  };
}
