export const epochToMilliseconds = (value: bigint | number | string | null | undefined): number => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return Number.NaN;

  // Legacy database timestamps are stored in a mixture of epoch seconds and
  // epoch milliseconds. Values below this threshold are safely epoch seconds.
  return Math.abs(numericValue) < 100_000_000_000
    ? numericValue * 1000
    : numericValue;
};

export const epochToDate = (value: bigint | number | string | null | undefined): Date | null => {
  const milliseconds = epochToMilliseconds(value);
  if (!Number.isFinite(milliseconds)) return null;

  const date = new Date(milliseconds);
  return Number.isNaN(date.getTime()) ? null : date;
};

const INDIA_UTC_OFFSET_MILLISECONDS = 5.5 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MILLISECONDS = 5 * 60 * 1000;

/**
 * Promotions written by the legacy PostgreSQL trigger used
 * `CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata'` before extracting epoch
 * seconds. That incorrectly moves an absolute timestamp 05:30 into the
 * future. Normalize only values that are currently in that narrow future
 * window; ordinary historical timestamps and genuinely invalid far-future
 * values remain untouched.
 */
export const normalizeLegacyIndiaShiftedEpochMilliseconds = (
  value: bigint | number | string | null | undefined,
  nowMilliseconds = Date.now()
): number => {
  const milliseconds = epochToMilliseconds(value);
  if (!Number.isFinite(milliseconds)) return Number.NaN;

  const isInLegacyShiftWindow =
    milliseconds > nowMilliseconds + MAX_CLOCK_SKEW_MILLISECONDS &&
    milliseconds <=
      nowMilliseconds + INDIA_UTC_OFFSET_MILLISECONDS + MAX_CLOCK_SKEW_MILLISECONDS;

  return isInLegacyShiftWindow
    ? milliseconds - INDIA_UTC_OFFSET_MILLISECONDS
    : milliseconds;
};
