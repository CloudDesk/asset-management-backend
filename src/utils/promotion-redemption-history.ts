export const PROMOTION_REDEMPTION_MILLISECONDS_THRESHOLD = 1_000_000_000_000n;

export const promotionRedemptionTimestampMilliseconds = (
  value: bigint | number | string,
): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric < Number(PROMOTION_REDEMPTION_MILLISECONDS_THRESHOLD)
    ? numeric * 1000
    : numeric;
};

export const promotionRedemptionTimestampSeconds = (milliseconds: number): bigint =>
  BigInt(Math.floor(milliseconds / 1000));

export const sortPromotionRedemptionsNewestFirst = <T extends {
  redeemed_at: bigint | number | string;
  id: string;
}>(redemptions: T[]): T[] => [...redemptions].sort((left, right) => {
  const timestampDifference = promotionRedemptionTimestampMilliseconds(right.redeemed_at)
    - promotionRedemptionTimestampMilliseconds(left.redeemed_at);
  return timestampDifference || right.id.localeCompare(left.id);
});
