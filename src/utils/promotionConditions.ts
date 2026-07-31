/**
 * Promotion condition values are allowed to be stored as either a scalar or
 * an array. Normalize both representations before evaluating IN conditions.
 */
export function normalizePromotionConditionValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== null && item !== undefined)
      .map((item) => String(item));
  }

  if (value === null || value === undefined || value === '') {
    return [];
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((item) => item !== null && item !== undefined)
            .map((item) => String(item));
        }
      } catch {
        // The value is an ordinary scalar string, not serialized JSON.
      }
    }
    return trimmed ? [trimmed] : [];
  }

  return [String(value)];
}
