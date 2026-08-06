export type PromotionApplicationConfiguration = {
  auto_apply?: unknown;
  application_mode?: unknown;
};

export type AppliedPromotionState = {
  is_auto?: unknown;
};

export type PromotionUsageState = {
  customerPromotionUsage: number;
  perCustomerLimit?: number | null | undefined;
  assignmentUsage: number;
  assignmentLimit?: number | null | undefined;
  campaignUsage: number;
  campaignLimit?: number | null | undefined;
};

/**
 * Automatic checkout application is opt-in twice: the boolean flag and the
 * canonical application mode must agree. This prevents legacy or partially
 * updated records from silently applying a customer-action promotion.
 */
export const isPromotionConfiguredAutomatic = (
  promotion: PromotionApplicationConfiguration | null | undefined
): boolean =>
  promotion?.auto_apply === true && promotion?.application_mode === 'automatic';

/**
 * Manual selections may survive a refetch of the exact same cart, but never a
 * cart-signature change. A changed cart must start from automatic offers only.
 */
export const getRetainedManualPromotionCandidates = <T extends AppliedPromotionState>(
  appliedPromotions: T[],
  retainManualPromotions: boolean
): T[] =>
  retainManualPromotions
    ? appliedPromotions.filter((promotion) => promotion.is_auto !== true)
    : [];

const hasReachedLimit = (usage: number, limit?: number | null): boolean =>
  typeof limit === 'number' && limit > 0 && usage >= limit;

/** Excludes exhausted offers before they reach recommendation or cart UI. */
export const isPromotionUsageExhausted = (usage: PromotionUsageState): boolean =>
  hasReachedLimit(usage.customerPromotionUsage, usage.perCustomerLimit) ||
  hasReachedLimit(usage.assignmentUsage, usage.assignmentLimit) ||
  hasReachedLimit(usage.campaignUsage, usage.campaignLimit);
