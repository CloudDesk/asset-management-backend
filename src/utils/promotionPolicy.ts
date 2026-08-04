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

export type PromotionAssignmentTarget = {
  assignmentType: string;
  customerId?: number | null;
  customerGroupId?: number | null;
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
  limit !== null && limit !== undefined && usage >= limit;

/** Excludes exhausted offers before they reach recommendation or cart UI. */
export const isPromotionUsageExhausted = (usage: PromotionUsageState): boolean =>
  hasReachedLimit(usage.customerPromotionUsage, usage.perCustomerLimit) ||
  hasReachedLimit(usage.assignmentUsage, usage.assignmentLimit) ||
  hasReachedLimit(usage.campaignUsage, usage.campaignLimit);

/** Audience changes create a new assignment instead of rewriting ownership. */
export const hasPromotionAssignmentTargetChanged = (
  current: PromotionAssignmentTarget,
  requested: PromotionAssignmentTarget
): boolean =>
  current.assignmentType !== requested.assignmentType ||
  (current.customerId ?? null) !== (requested.customerId ?? null) ||
  (current.customerGroupId ?? null) !== (requested.customerGroupId ?? null);

/** Usage belongs to each customer independently across the whole promotion. */
export const getRemainingPromotionUses = (
  perCustomerLimit: number | null | undefined,
  customerPromotionUsage: number
): number | null =>
  perCustomerLimit === null || perCustomerLimit === undefined
    ? null
    : Math.max(0, perCustomerLimit - customerPromotionUsage);
