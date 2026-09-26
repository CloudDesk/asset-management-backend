export interface PromotionEvaluationVersionRow {
  evaluation_id: string;
  context: unknown;
}

export function isV2PromotionEvaluationContext(context: unknown): boolean {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return false;
  return Number((context as Record<string, unknown>).schema_version) === 2;
}

export function legacyPromotionEvaluationIds(rows: PromotionEvaluationVersionRow[]): string[] {
  return rows
    .filter((row) => !isV2PromotionEvaluationContext(row.context))
    .map((row) => row.evaluation_id);
}
