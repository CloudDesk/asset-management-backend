/**
 * Redemption history is sorted and filtered against JavaScript/ISO dates, so
 * persisted redemption timestamps must always use epoch milliseconds.
 */
export const promotionRedemptionTimestamp = (now: number = Date.now()): bigint => {
  if (!Number.isFinite(now) || now < 0) {
    throw new Error('Promotion redemption timestamp must be a positive finite number');
  }
  return BigInt(Math.trunc(now));
};
