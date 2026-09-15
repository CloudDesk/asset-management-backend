export const getRemainingPromotionBudget = (
  configuredBudget: unknown,
  totalBudgetUsed: number
): number | null => {
  if (configuredBudget === null || configuredBudget === undefined) return null;

  const budget = Number(configuredBudget);
  return Number.isFinite(budget) && budget > 0
    ? budget - totalBudgetUsed
    : null;
};
