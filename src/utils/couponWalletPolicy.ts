export const STANDALONE_COUPON_DESCRIPTION_PREFIX = 'Private discount rule created for coupon ';
export const STANDALONE_COUPON_DELIVERY_CHANNEL = 'all' as const;
export const STANDALONE_COUPON_STACKABLE = false as const;

export type StandaloneCouponUseState =
  | 'available'
  | 'scheduled'
  | 'reserved'
  | 'claimed'
  | 'redeemed'
  | 'expired'
  | 'inactive'
  | 'revoked';

export interface StandaloneCouponStateInput {
  status?: string | null;
  start_date?: bigint | number | string | null;
  end_date?: bigint | number | string | null;
  claimed_at?: bigint | number | string | null;
  claimed_by_customer_id?: number | null;
  wallet_credit?: unknown | null;
  redemption_count?: number;
  used_count?: number;
  usage_limit?: number | null;
  reservation_reference?: string | null;
  reservation_expires_at?: bigint | number | string | null;
}

const toBigInt = (value: StandaloneCouponStateInput[keyof StandaloneCouponStateInput]): bigint | null => {
  if (value === null || value === undefined || value === '') return null;
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    return null;
  }
};

export const isStandaloneCouponPromotion = (promotion: {
  visibility?: string | null;
  description?: string | null;
} | null | undefined): boolean =>
  promotion?.visibility === 'private' &&
  String(promotion?.description || '').startsWith(STANDALONE_COUPON_DESCRIPTION_PREFIX);

export const resolveStandaloneCouponUseState = (
  assignment: StandaloneCouponStateInput,
  now = Date.now(),
): StandaloneCouponUseState => {
  if (assignment.status === 'revoked') return 'revoked';
  if (assignment.status === 'inactive') return 'inactive';
  if (assignment.status === 'expired') return 'expired';
  if (assignment.status !== 'active') return 'inactive';

  const nowSeconds = BigInt(Math.floor(now / 1000));
  const nowMilliseconds = BigInt(now);
  const endDate = toBigInt(assignment.end_date);
  const startDate = toBigInt(assignment.start_date);
  const reservationExpiresAt = toBigInt(assignment.reservation_expires_at);
  const redemptionCount = Math.max(
    Number(assignment.redemption_count || 0),
    Number(assignment.used_count || 0),
  );

  if (endDate !== null && endDate < nowSeconds) return 'expired';
  if (startDate !== null && startDate > nowSeconds) return 'scheduled';
  if (assignment.claimed_by_customer_id || assignment.claimed_at || assignment.wallet_credit) return 'claimed';
  if (redemptionCount > 0) return 'redeemed';
  if (assignment.usage_limit && redemptionCount >= assignment.usage_limit) return 'redeemed';
  if (
    assignment.reservation_reference &&
    reservationExpiresAt !== null &&
    reservationExpiresAt > nowMilliseconds
  ) return 'reserved';
  return 'available';
};

export const couponUseStateErrorCode = (state: Exclude<StandaloneCouponUseState, 'available'>): string => {
  if (state === 'claimed') return 'COUPON_ALREADY_CLAIMED';
  if (state === 'redeemed') return 'COUPON_ALREADY_REDEEMED';
  return `COUPON_${state.toUpperCase()}`;
};

export const buildCouponClaimLockWhere = (
  assignmentId: number,
  customerId: number,
  now = Date.now(),
) => ({
  id: assignmentId,
  customer_id: customerId,
  claimed_by_customer_id: null,
  claimed_at: null,
  status: 'active',
  used_count: 0,
  OR: [
    { reservation_reference: null },
    { reservation_expires_at: null },
    { reservation_expires_at: { lte: BigInt(now) } },
  ],
});
