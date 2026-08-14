CREATE TABLE IF NOT EXISTS "return_policy_reason_rules" (
  "id" SERIAL PRIMARY KEY,
  "policy_id" INTEGER NOT NULL,
  "reason_id" INTEGER NOT NULL,
  "configuration" JSONB NOT NULL,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "configuration_version" INTEGER NOT NULL DEFAULT 1,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by" INTEGER,
  "modified_by" INTEGER,
  "created_date" BIGINT,
  "modified_date" BIGINT,
  CONSTRAINT "return_policy_reason_rules_policy_fkey"
    FOREIGN KEY ("policy_id") REFERENCES "return_replacement_policies" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "return_policy_reason_rules_reason_fkey"
    FOREIGN KEY ("reason_id") REFERENCES "return_reason_rules" ("id")
    ON DELETE RESTRICT ON UPDATE NO ACTION
);

CREATE UNIQUE INDEX IF NOT EXISTS "return_policy_reason_rules_policy_reason_unique"
  ON "return_policy_reason_rules" ("policy_id", "reason_id");

CREATE INDEX IF NOT EXISTS "idx_return_policy_reason_rules_policy"
  ON "return_policy_reason_rules" ("policy_id");

CREATE INDEX IF NOT EXISTS "idx_return_policy_reason_rules_reason"
  ON "return_policy_reason_rules" ("reason_id");

CREATE INDEX IF NOT EXISTS "idx_return_policy_reason_rules_is_active"
  ON "return_policy_reason_rules" ("is_active");

INSERT INTO "return_policy_reason_rules" (
  "policy_id",
  "reason_id",
  "configuration",
  "schema_version",
  "configuration_version",
  "is_active",
  "created_date",
  "modified_date"
)
SELECT
  policy."id",
  reason."id",
  jsonb_build_object(
    'schemaVersion', COALESCE(reason."schema_version", 1),
    'reasonCode', reason."reasoncode",
    'reasonName', reason."reasonname",
    'aliases', to_jsonb(COALESCE(reason."aliases", ARRAY[]::TEXT[])),
    'raiseWithinHours', reason."raise_within_hours",
    'evidence', COALESCE(reason."evidence_rules", '[]'::jsonb),
    'allowedResolutions', to_jsonb(COALESCE(reason."allowedresolutions", ARRAY[]::TEXT[])),
    'openedPackageAllowed', reason."openedpackageallowed",
    'approvalMode', CASE WHEN reason."evidencefirstapproval" THEN 'evidence_first' ELSE 'pickup_first' END,
    'resolutionTiming', reason."resolution_timing",
    'pickup', jsonb_build_object(
      'required', reason."pickuprequired",
      'triggerMode', COALESCE(reason."pickup_trigger_mode", 'manual_admin'),
      'chargeBearer', 'nivaana',
      'deductChargeFromRefund', false
    ),
    'stockUnavailableResolution', reason."stock_unavailable_resolution",
    'notifyCustomerOnStockFallback', COALESCE(reason."notify_customer_on_stock_fallback", true),
    'legacyFields', jsonb_build_object(
      'photorequired', reason."photorequired",
      'videorequired', reason."videorequired",
      'packagephotorequired', reason."packagephotorequired",
      'packagephotooptional', reason."packagephotooptional",
      'unboxingvideorequired', reason."unboxingvideorequired",
      'unboxingvideooptional', reason."unboxingvideooptional",
      'pickuprequired', reason."pickuprequired",
      'evidencefirstapproval', reason."evidencefirstapproval",
      'autocreatepickup', false,
      'reverseshippingchargebearer', 'nivaana'
    )
  ),
  COALESCE(reason."schema_version", 1),
  1,
  true,
  EXTRACT(EPOCH FROM NOW())::BIGINT,
  EXTRACT(EPOCH FROM NOW())::BIGINT
FROM "return_replacement_policies" AS policy
CROSS JOIN "return_reason_rules" AS reason
WHERE reason."status" = 'active'
  AND reason."source" IN ('customer', 'both')
  AND reason."reasoncode" IN (
    'wrong_product',
    'damaged_product',
    'missing_product',
    'defective_product',
    'leakage_broken_bottle',
    'changed_mind'
  )
ON CONFLICT ("policy_id", "reason_id") DO NOTHING;

DO $$
DECLARE
  incomplete_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO incomplete_count
  FROM (
    SELECT policy."id"
    FROM "return_replacement_policies" AS policy
    LEFT JOIN "return_policy_reason_rules" AS mapping
      ON mapping."policy_id" = policy."id"
    LEFT JOIN "return_reason_rules" AS reason
      ON reason."id" = mapping."reason_id"
      AND reason."status" = 'active'
      AND reason."source" IN ('customer', 'both')
      AND reason."reasoncode" IN (
        'wrong_product',
        'damaged_product',
        'missing_product',
        'defective_product',
        'leakage_broken_bottle',
        'changed_mind'
      )
    GROUP BY policy."id"
    HAVING COUNT(reason."id") <> 6
  ) AS incomplete_policies;

  IF incomplete_count > 0 THEN
    RAISE EXCEPTION 'Return policy reason-rule backfill incomplete: % policies do not have exactly six customer reason mappings', incomplete_count;
  END IF;
END $$;
