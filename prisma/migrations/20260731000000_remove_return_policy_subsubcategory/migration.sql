DROP INDEX IF EXISTS "idx_return_replacement_policy_scope";

UPDATE "return_replacement_policies"
SET "scopekey" = 'phase0-return-policy-scope-cleanup-' || "id";

WITH ranked_policies AS (
  SELECT
    "id",
    LOWER(TRIM("category")) || '|' || COALESCE(NULLIF(LOWER(TRIM("subcategory")), ''), '*') AS canonical_scopekey,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(TRIM("category")), COALESCE(NULLIF(LOWER(TRIM("subcategory")), ''), '*')
      ORDER BY "isactive" DESC, "modifieddate" DESC NULLS LAST, "createddate" DESC NULLS LAST, "id" ASC
    ) AS scope_rank
  FROM "return_replacement_policies"
)
UPDATE "return_replacement_policies" AS policy
SET
  "scopekey" = CASE
    WHEN ranked.scope_rank = 1 THEN ranked.canonical_scopekey
    ELSE ranked.canonical_scopekey || '|legacy-duplicate-' || policy."id"
  END,
  "isactive" = CASE
    WHEN ranked.scope_rank = 1 THEN policy."isactive"
    ELSE false
  END,
  "notes" = CASE
    WHEN ranked.scope_rank = 1 THEN policy."notes"
    ELSE CONCAT_WS(
      E'\n',
      NULLIF(policy."notes", ''),
      'Deactivated during Phase 0 return policy scope cleanup because Sub-subcategory is no longer supported.'
    )
  END
FROM ranked_policies AS ranked
WHERE ranked."id" = policy."id";

ALTER TABLE "return_replacement_policies"
  DROP COLUMN IF EXISTS "subsubcategory";

CREATE INDEX IF NOT EXISTS "idx_return_replacement_policy_scope"
  ON "return_replacement_policies" ("category", "subcategory");
