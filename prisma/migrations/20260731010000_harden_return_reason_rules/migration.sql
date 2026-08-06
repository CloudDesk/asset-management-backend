DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'return_reason_rules'
      AND column_name = 'minimumraisewindowhours'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'return_reason_rules'
      AND column_name = 'raise_within_hours'
  ) THEN
    ALTER TABLE "return_reason_rules"
      RENAME COLUMN "minimumraisewindowhours" TO "raise_within_hours";
  END IF;
END $$;

ALTER TABLE "return_reason_rules"
  ADD COLUMN IF NOT EXISTS "schema_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "evidence_rules" JSONB,
  ADD COLUMN IF NOT EXISTS "resolution_timing" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "stock_unavailable_resolution" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "pickup_trigger_mode" VARCHAR(100) NOT NULL DEFAULT 'manual_admin',
  ADD COLUMN IF NOT EXISTS "notify_customer_on_stock_fallback" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "return_requests"
  ADD COLUMN IF NOT EXISTS "policy_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "reason_rule_snapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "reason_rule_version" INTEGER;

UPDATE "return_reason_rules"
SET
  "reasoncode" = 'changed_mind',
  "reasonname" = 'Changed Mind',
  "aliases" = ARRAY['Changed Mind', 'Wrongly Ordered'],
  "allowedresolutions" = ARRAY['complete_return', 'refund'],
  "evidence_rules" = '[{"type":"product_photo","required":true,"minimum":1},{"type":"package_photo","required":true,"minimum":1}]'::jsonb,
  "photorequired" = true,
  "packagephotorequired" = true,
  "videorequired" = false,
  "packagephotooptional" = false,
  "unboxingvideorequired" = false,
  "unboxingvideooptional" = false,
  "openedpackageallowed" = false,
  "pickuprequired" = true,
  "evidencefirstapproval" = true,
  "autocreatepickup" = false,
  "reverseshippingchargebearer" = 'nivaana',
  "resolution_timing" = 'after_warehouse_verification',
  "stock_unavailable_resolution" = NULL,
  "pickup_trigger_mode" = 'manual_admin',
  "notify_customer_on_stock_fallback" = true,
  "notes" = 'Package must be unopened. Evidence approval is required before pickup. Nivaana bears reverse shipping.',
  "schema_version" = 1
WHERE "reasoncode" = 'wrongly_ordered'
  AND NOT EXISTS (
    SELECT 1 FROM "return_reason_rules" WHERE "reasoncode" = 'changed_mind'
  );

UPDATE "return_reason_rules"
SET
  "status" = 'inactive',
  "notes" = CONCAT_WS(E'\n', NULLIF("notes", ''), 'Inactive duplicate after Changed Mind reason-rule migration.')
WHERE "reasoncode" = 'wrongly_ordered';

UPDATE "return_reason_rules"
SET
  "reasonname" = 'Changed Mind',
  "aliases" = ARRAY['Changed Mind', 'Wrongly Ordered'],
  "allowedresolutions" = ARRAY['complete_return', 'refund'],
  "evidence_rules" = '[{"type":"product_photo","required":true,"minimum":1},{"type":"package_photo","required":true,"minimum":1}]'::jsonb,
  "photorequired" = true,
  "packagephotorequired" = true,
  "videorequired" = false,
  "packagephotooptional" = false,
  "unboxingvideorequired" = false,
  "unboxingvideooptional" = false,
  "openedpackageallowed" = false,
  "pickuprequired" = true,
  "evidencefirstapproval" = true,
  "autocreatepickup" = false,
  "reverseshippingchargebearer" = 'nivaana',
  "resolution_timing" = 'after_warehouse_verification',
  "stock_unavailable_resolution" = NULL,
  "pickup_trigger_mode" = 'manual_admin',
  "notify_customer_on_stock_fallback" = true,
  "notes" = 'Package must be unopened. Evidence approval is required before pickup. Nivaana bears reverse shipping.',
  "schema_version" = 1
WHERE "reasoncode" = 'changed_mind';

UPDATE "return_reason_rules"
SET
  "reasoncode" = 'wrong_product',
  "reasonname" = 'Wrong Product',
  "aliases" = ARRAY['Wrong Product', 'Wrong Item Received'],
  "allowedresolutions" = ARRAY['replacement', 'refund'],
  "evidence_rules" = '[{"type":"product_photo","required":true,"minimum":1}]'::jsonb,
  "photorequired" = true,
  "packagephotorequired" = false,
  "videorequired" = false,
  "openedpackageallowed" = true,
  "pickuprequired" = true,
  "evidencefirstapproval" = false,
  "autocreatepickup" = false,
  "reverseshippingchargebearer" = 'nivaana',
  "resolution_timing" = 'after_warehouse_verification',
  "stock_unavailable_resolution" = 'refund',
  "pickup_trigger_mode" = 'manual_admin',
  "notify_customer_on_stock_fallback" = true,
  "schema_version" = 1
WHERE "reasoncode" = 'wrong_item_received'
  AND NOT EXISTS (
    SELECT 1 FROM "return_reason_rules" WHERE "reasoncode" = 'wrong_product'
  );

UPDATE "return_reason_rules"
SET
  "status" = 'inactive',
  "notes" = CONCAT_WS(E'\n', NULLIF("notes", ''), 'Inactive duplicate after Wrong Product reason-rule migration.')
WHERE "reasoncode" = 'wrong_item_received';

UPDATE "return_reason_rules"
SET
  "reasonname" = 'Wrong Product',
  "aliases" = ARRAY['Wrong Product', 'Wrong Item Received'],
  "allowedresolutions" = ARRAY['replacement', 'refund'],
  "evidence_rules" = '[{"type":"product_photo","required":true,"minimum":1}]'::jsonb,
  "photorequired" = true,
  "packagephotorequired" = false,
  "videorequired" = false,
  "openedpackageallowed" = true,
  "pickuprequired" = true,
  "evidencefirstapproval" = false,
  "autocreatepickup" = false,
  "reverseshippingchargebearer" = 'nivaana',
  "resolution_timing" = 'after_warehouse_verification',
  "stock_unavailable_resolution" = 'refund',
  "pickup_trigger_mode" = 'manual_admin',
  "notify_customer_on_stock_fallback" = true,
  "schema_version" = 1
WHERE "reasoncode" = 'wrong_product';

UPDATE "return_reason_rules"
SET
  "reasonname" = 'Damaged Product',
  "aliases" = ARRAY['Damaged Product'],
  "allowedresolutions" = ARRAY['replacement'],
  "raise_within_hours" = 48,
  "evidence_rules" = '[{"type":"product_photo","required":true,"minimum":1},{"type":"package_photo","required":false,"minimum":0},{"type":"unboxing_video","required":false,"minimum":0}]'::jsonb,
  "photorequired" = true,
  "packagephotorequired" = false,
  "packagephotooptional" = true,
  "unboxingvideorequired" = false,
  "unboxingvideooptional" = true,
  "videorequired" = false,
  "openedpackageallowed" = true,
  "pickuprequired" = true,
  "evidencefirstapproval" = true,
  "autocreatepickup" = false,
  "reverseshippingchargebearer" = 'nivaana',
  "resolution_timing" = 'after_warehouse_verification',
  "stock_unavailable_resolution" = 'refund',
  "pickup_trigger_mode" = 'manual_admin',
  "notify_customer_on_stock_fallback" = true,
  "schema_version" = 1
WHERE "reasoncode" = 'damaged_product';

UPDATE "return_reason_rules"
SET
  "reasonname" = 'Missing Product',
  "aliases" = ARRAY['Missing Product'],
  "allowedresolutions" = ARRAY['ship_missing_item', 'partial_refund', 'complete_return'],
  "evidence_rules" = '[{"type":"product_photo","required":true,"minimum":1},{"type":"package_photo","required":true,"minimum":1}]'::jsonb,
  "photorequired" = true,
  "packagephotorequired" = true,
  "videorequired" = false,
  "openedpackageallowed" = true,
  "pickuprequired" = false,
  "evidencefirstapproval" = true,
  "autocreatepickup" = false,
  "reverseshippingchargebearer" = 'nivaana',
  "resolution_timing" = 'after_team_verification',
  "stock_unavailable_resolution" = NULL,
  "pickup_trigger_mode" = 'manual_admin',
  "notify_customer_on_stock_fallback" = true,
  "schema_version" = 1
WHERE "reasoncode" = 'missing_product';

UPDATE "return_reason_rules"
SET
  "reasonname" = 'Defective Product',
  "aliases" = ARRAY['Defective Product'],
  "allowedresolutions" = ARRAY['replacement', 'refund'],
  "evidence_rules" = '[{"type":"product_photo","required":true,"minimum":1},{"type":"defect_video","required":true,"minimum":1}]'::jsonb,
  "photorequired" = true,
  "videorequired" = true,
  "packagephotorequired" = false,
  "openedpackageallowed" = true,
  "pickuprequired" = true,
  "evidencefirstapproval" = true,
  "autocreatepickup" = false,
  "reverseshippingchargebearer" = 'nivaana',
  "resolution_timing" = 'after_warehouse_verification',
  "stock_unavailable_resolution" = 'refund',
  "pickup_trigger_mode" = 'manual_admin',
  "notify_customer_on_stock_fallback" = true,
  "schema_version" = 1
WHERE "reasoncode" = 'defective_product';

UPDATE "return_reason_rules"
SET
  "reasonname" = 'Leakage / Broken Bottle',
  "aliases" = ARRAY['Leakage / Broken Bottle', 'Leakage', 'Broken Bottle'],
  "allowedresolutions" = ARRAY['replacement', 'refund'],
  "evidence_rules" = '[{"type":"product_photo","required":true,"minimum":1},{"type":"defect_video","required":true,"minimum":1}]'::jsonb,
  "photorequired" = true,
  "videorequired" = true,
  "packagephotorequired" = false,
  "openedpackageallowed" = true,
  "pickuprequired" = true,
  "evidencefirstapproval" = true,
  "autocreatepickup" = false,
  "reverseshippingchargebearer" = 'nivaana',
  "resolution_timing" = 'after_warehouse_verification',
  "stock_unavailable_resolution" = 'refund',
  "pickup_trigger_mode" = 'manual_admin',
  "notify_customer_on_stock_fallback" = true,
  "schema_version" = 1
WHERE "reasoncode" = 'leakage_broken_bottle';

UPDATE "return_reason_rules"
SET
  "evidence_rules" = COALESCE("evidence_rules", '[]'::jsonb),
  "autocreatepickup" = false,
  "pickup_trigger_mode" = 'manual_admin',
  "schema_version" = COALESCE("schema_version", 1)
WHERE "source" IN ('delivery_partner', 'admin', 'both');
