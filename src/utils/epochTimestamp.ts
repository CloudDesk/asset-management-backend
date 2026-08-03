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
