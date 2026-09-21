import {
  evaluateV3ItemPromotion,
  type PromotionV3CartLine,
  type PromotionV3EvaluationContext,
  type PromotionV3ItemCampaign,
  type PromotionV3ItemEvaluation,
  type PromotionV3Gift,
  type PromotionV3GiftEntitlement,
  type PromotionV3UnitAdjustment,
} from './promotion-v3-item-engine.js';
import { evaluateV3OrderPromotion, isOrderLevelCampaign, type PromotionV3OrderAdjustment } from './promotion-v3-order-engine.js';

export interface PromotionV3ResolvedPromotion {
  promotion_id: number;
  name: string;
  saving: number;
  affected_quantity: number;
}

export interface PromotionV3MultiEvaluation {
  schema_version: 3;
  original_merchandise_total: number;
  discount_total: number;
  item_discount_total: number;
  order_discount_total: number;
  payable_merchandise_total: number;
  adjustments: PromotionV3UnitAdjustment[];
  order_adjustments: PromotionV3OrderAdjustment[];
  remaining_cart_value: number;
  applied_promotions: PromotionV3ResolvedPromotion[];
  eligible_alternatives: PromotionV3ResolvedPromotion[];
  rejected_candidates: Array<{ promotion_id: number; reason_codes: string[] }>;
  progress: Array<{ promotion_id: number; field: string; current: number; required: number; remaining: number }>;
  gifts: PromotionV3Gift[];
  quantity_breakdown: Array<{ product_id: string; paid_quantity: number; free_quantity: number; total_quantity: number }>;
  gift_entitlements: PromotionV3GiftEntitlement[];
}

interface EvaluatedCampaign {
  campaign: PromotionV3ItemCampaign;
  evaluation: PromotionV3ItemEvaluation;
}

const hasBenefit = (evaluation: PromotionV3ItemEvaluation): boolean => evaluation.discount_total > 0 || evaluation.entitlements.length > 0;
const consumedKeys = (evaluation: PromotionV3ItemEvaluation): string[] => [
  ...evaluation.adjustments.flatMap((adjustment) => adjustment.unit_keys),
  ...evaluation.entitlements.flatMap((entitlement) => entitlement.source_unit_keys),
];

const resolvedPromotion = ({ campaign, evaluation }: EvaluatedCampaign): PromotionV3ResolvedPromotion => ({
  promotion_id: campaign.promotion_id,
  name: campaign.name ?? `Promotion ${campaign.promotion_id}`,
  saving: evaluation.discount_total,
  affected_quantity: evaluation.affected_quantity,
});

function orderGroup(candidates: EvaluatedCampaign[]): EvaluatedCampaign[] {
  const useBestValue = candidates.every(({ campaign }) => campaign.rule.conflict_policy.selection_strategy === 'BEST_CUSTOMER_VALUE');
  return [...candidates].sort((left, right) => {
    if (useBestValue && left.evaluation.discount_total !== right.evaluation.discount_total) {
      return right.evaluation.discount_total - left.evaluation.discount_total;
    }
    const priority = left.campaign.rule.conflict_policy.priority - right.campaign.rule.conflict_policy.priority;
    if (priority !== 0) return priority;
    if (left.evaluation.discount_total !== right.evaluation.discount_total) return right.evaluation.discount_total - left.evaluation.discount_total;
    return left.campaign.promotion_id - right.campaign.promotion_id;
  });
}

function evaluateItemCampaigns(
  lines: PromotionV3CartLine[],
  campaigns: PromotionV3ItemCampaign[],
  context: PromotionV3EvaluationContext,
): PromotionV3MultiEvaluation {
  const independent = campaigns
    .map((campaign) => ({ campaign, evaluation: evaluateV3ItemPromotion(lines, campaign, context) }))
    .sort((left, right) => left.campaign.promotion_id - right.campaign.promotion_id);
  const rejected: PromotionV3MultiEvaluation['rejected_candidates'] = independent
    .filter(({ evaluation }) => !evaluation.eligible)
    .map(({ campaign, evaluation }) => ({ promotion_id: campaign.promotion_id, reason_codes: evaluation.reason_codes }));
  const progress = independent.flatMap(({ campaign, evaluation }) => evaluation.progress.map((item) => ({
    promotion_id: campaign.promotion_id,
    ...item,
  })));
  const groups = new Map<string, EvaluatedCampaign[]>();
  for (const evaluated of independent.filter(({ evaluation }) => evaluation.eligible && hasBenefit(evaluation))) {
    const group = evaluated.campaign.rule.conflict_policy.exclusive_group;
    groups.set(group, [...(groups.get(group) ?? []), evaluated]);
  }

  const selected: EvaluatedCampaign[] = [];
  const alternatives: PromotionV3ResolvedPromotion[] = [];
  const usedUnitKeys = new Set<string>();
  for (const [, groupCandidates] of [...groups].sort(([left], [right]) => left.localeCompare(right))) {
    const ordered = orderGroup(groupCandidates);
    const configuredLimits = ordered
      .map(({ campaign }) => campaign.rule.conflict_policy.maximum_promotions_from_group)
      .filter((limit): limit is number => limit !== null);
    const groupLimit = configuredLimits.length ? Math.min(...configuredLimits) : Number.MAX_SAFE_INTEGER;
    const singlePromotionMode = groupLimit === 1 || ordered.some(({ campaign }) => !campaign.rule.conflict_policy.stackable);
    if (singlePromotionMode) {
      const winner = ordered[0]!;
      selected.push(winner);
      consumedKeys(winner.evaluation).forEach((key) => usedUnitKeys.add(key));
      alternatives.push(...ordered.slice(1).map(resolvedPromotion));
      rejected.push(...ordered.slice(1).map(({ campaign }) => ({
        promotion_id: campaign.promotion_id,
        reason_codes: ['CONFLICTED_WITH_BETTER_OFFER'],
      })));
      continue;
    }

    const selectedInGroup: EvaluatedCampaign[] = [];
    for (const candidate of ordered) {
      if (selectedInGroup.length >= groupLimit) {
        alternatives.push(resolvedPromotion(candidate));
        rejected.push({ promotion_id: candidate.campaign.promotion_id, reason_codes: ['CONFLICTED_WITH_BETTER_OFFER'] });
        continue;
      }
      const canReuse = candidate.campaign.rule.conflict_policy.item_reuse
        && selected.every(({ campaign }) => campaign.rule.conflict_policy.item_reuse);
      const evaluation = evaluateV3ItemPromotion(lines, candidate.campaign, {
        ...context,
        unavailable_unit_keys: canReuse ? new Set() : usedUnitKeys,
      });
      if (!evaluation.eligible || !hasBenefit(evaluation)) {
        alternatives.push(resolvedPromotion(candidate));
        rejected.push({ promotion_id: candidate.campaign.promotion_id, reason_codes: ['CONFLICTED_WITH_BETTER_OFFER'] });
        continue;
      }
      const applied = { campaign: candidate.campaign, evaluation };
      selected.push(applied);
      selectedInGroup.push(applied);
      consumedKeys(evaluation).forEach((key) => usedUnitKeys.add(key));
    }
  }

  const adjustments = selected.flatMap(({ evaluation }) => evaluation.adjustments);
  const gifts = selected.flatMap(({ evaluation }) => evaluation.gifts);
  const giftEntitlements = selected.flatMap(({ evaluation }) => evaluation.entitlements);
  const quantityBreakdown = selected.length > 0
    ? selected.flatMap(({ evaluation }) => evaluation.quantity_breakdown)
    : independent.length === 1 ? independent[0]!.evaluation.quantity_breakdown : [];
  const inputMerchandiseTotal = lines.reduce((sum, line) => sum + line.unit_price_paise * line.quantity, 0);
  const autoAddedGiftValue = adjustments
    .filter((adjustment) => adjustment.adjustment_type === 'FREE_ITEM')
    .reduce((sum, adjustment) => {
      const addedQuantity = Number(adjustment.metadata?.added_quantity ?? 0);
      const unitPrice = adjustment.affected_quantity > 0 ? Math.floor(adjustment.list_amount / adjustment.affected_quantity) : 0;
      return sum + unitPrice * addedQuantity;
    }, 0);
  const originalMerchandiseTotal = inputMerchandiseTotal + autoAddedGiftValue;
  const discountTotal = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
  return {
    schema_version: 3,
    original_merchandise_total: originalMerchandiseTotal,
    discount_total: discountTotal,
    item_discount_total: discountTotal,
    order_discount_total: 0,
    payable_merchandise_total: Math.max(0, originalMerchandiseTotal - discountTotal),
    adjustments,
    order_adjustments: [],
    remaining_cart_value: Math.max(0, originalMerchandiseTotal - discountTotal),
    applied_promotions: selected.map(resolvedPromotion).sort((left, right) => left.promotion_id - right.promotion_id),
    eligible_alternatives: alternatives.sort((left, right) => left.promotion_id - right.promotion_id),
    rejected_candidates: [...new Map(rejected.map((item) => [item.promotion_id, item])).values()].sort((left, right) => left.promotion_id - right.promotion_id),
    progress,
    gifts,
    gift_entitlements: giftEntitlements,
    quantity_breakdown: quantityBreakdown,
  };
}

export function evaluateV3ItemPromotions(
  lines: PromotionV3CartLine[],
  campaigns: PromotionV3ItemCampaign[],
  context: PromotionV3EvaluationContext,
): PromotionV3MultiEvaluation {
  const itemResult = evaluateItemCampaigns(lines, campaigns.filter((campaign) => !isOrderLevelCampaign(campaign)), context);
  const orderCampaigns = campaigns.filter(isOrderLevelCampaign);
  if (orderCampaigns.length === 0) return itemResult;

  let remainingCartValue = itemResult.payable_merchandise_total;
  const orderAdjustments: PromotionV3OrderAdjustment[] = [];
  const applied = [...itemResult.applied_promotions];
  const alternatives = [...itemResult.eligible_alternatives];
  const rejected = [...itemResult.rejected_candidates];
  const progress = [...itemResult.progress];
  const grouped = new Map<string, PromotionV3ItemCampaign[]>();
  for (const campaign of orderCampaigns) {
    const group = campaign.rule.conflict_policy.exclusive_group;
    grouped.set(group, [...(grouped.get(group) ?? []), campaign]);
  }

  for (const [, group] of [...grouped].sort(([left], [right]) => left.localeCompare(right))) {
    const initial = group.map((campaign) => ({
      campaign,
      evaluation: evaluateV3OrderPromotion(lines, campaign, context, remainingCartValue),
    }));
    const useBestValue = group.every((campaign) => campaign.rule.conflict_policy.selection_strategy === 'BEST_CUSTOMER_VALUE');
    const ordered = initial.sort((left, right) => {
      if (useBestValue && left.evaluation.discount_total !== right.evaluation.discount_total) return right.evaluation.discount_total - left.evaluation.discount_total;
      return left.campaign.rule.conflict_policy.priority - right.campaign.rule.conflict_policy.priority
        || right.evaluation.discount_total - left.evaluation.discount_total
        || left.campaign.promotion_id - right.campaign.promotion_id;
    });
    const configuredLimits = group.map((campaign) => campaign.rule.conflict_policy.maximum_promotions_from_group).filter((value): value is number => value !== null);
    const groupLimit = configuredLimits.length ? Math.min(...configuredLimits) : Number.MAX_SAFE_INTEGER;
    const allowed = group.some((campaign) => !campaign.rule.conflict_policy.stackable) ? 1 : groupLimit;
    let selectedCount = 0;
    for (const candidate of ordered) {
      const current = evaluateV3OrderPromotion(lines, candidate.campaign, context, remainingCartValue);
      if (!current.eligible || !current.adjustment) {
        rejected.push({ promotion_id: candidate.campaign.promotion_id, reason_codes: current.reason_codes });
        progress.push(...current.progress.map((item) => ({ promotion_id: candidate.campaign.promotion_id, ...item })));
        continue;
      }
      if (selectedCount >= allowed) {
        const resolved = { promotion_id: candidate.campaign.promotion_id, name: candidate.campaign.name ?? `Promotion ${candidate.campaign.promotion_id}`, saving: current.discount_total, affected_quantity: 0 };
        alternatives.push(resolved);
        rejected.push({ promotion_id: candidate.campaign.promotion_id, reason_codes: ['CONFLICTED_WITH_BETTER_OFFER'] });
        continue;
      }
      selectedCount += 1;
      orderAdjustments.push(current.adjustment);
      remainingCartValue = current.adjustment.payable_amount;
      applied.push({
        promotion_id: candidate.campaign.promotion_id,
        name: candidate.campaign.name ?? `Promotion ${candidate.campaign.promotion_id}`,
        saving: current.discount_total,
        affected_quantity: 0,
      });
      progress.push(...current.progress.map((item) => ({ promotion_id: candidate.campaign.promotion_id, ...item })));
    }
  }

  const orderDiscountTotal = orderAdjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
  return {
    ...itemResult,
    discount_total: itemResult.discount_total + orderDiscountTotal,
    order_discount_total: orderDiscountTotal,
    payable_merchandise_total: remainingCartValue,
    remaining_cart_value: remainingCartValue,
    order_adjustments: orderAdjustments,
    applied_promotions: applied.sort((left, right) => left.promotion_id - right.promotion_id),
    eligible_alternatives: alternatives.sort((left, right) => left.promotion_id - right.promotion_id),
    rejected_candidates: [...new Map(rejected.map((item) => [item.promotion_id, item])).values()].sort((left, right) => left.promotion_id - right.promotion_id),
    progress,
  };
}
