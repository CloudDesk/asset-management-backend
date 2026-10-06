-- =========================================================================================
-- Migration & Backfill: Move HSN Code and GST Rate from Category Mapping to Product Level
-- Date: 2026-09-30
-- Description:
--   1. Adds `hsn_code` and `gst_rate` columns to the `product` table.
--   2. Backfills existing products from `gst_hsn_mapping` using subcategory / subsubcategory values.
--   3. If a product does not match a preset, abort until a reviewed value is assigned (no hardcoded 33074100 / 18% defaults).
--   4. Enforces NOT NULL after every product is classified.
-- =========================================================================================

BEGIN;

-- -----------------------------------------------------------------------------------------
-- Step 1: Add new columns to `product` table
-- -----------------------------------------------------------------------------------------
ALTER TABLE "product" 
  ADD COLUMN IF NOT EXISTS "hsn_code" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "gst_rate" DECIMAL(5, 2);

-- Ensure no hardcoded column defaults exist. Unmapped items must be explicitly
-- classified before this transaction can enforce NOT NULL and commit.
ALTER TABLE "product" 
  ALTER COLUMN "hsn_code" DROP DEFAULT,
  ALTER COLUMN "gst_rate" DROP DEFAULT;

-- -----------------------------------------------------------------------------------------
-- Step 2: Backfill existing products from `gst_hsn_mapping`
-- Matches against subcategory / subsubcategory values
-- -----------------------------------------------------------------------------------------
WITH ranked_matches AS (
  SELECT
    p.id AS product_id,
    m.hsn_code,
    m.gst_rate,
    ROW_NUMBER() OVER (
      PARTITION BY p.id
      ORDER BY
        CASE WHEN m.subsubcategory_value IS NOT NULL THEN 0 ELSE 1 END,
        m.id
    ) AS match_rank
  FROM "product" p
  JOIN "gst_hsn_mapping" m
    ON LOWER(TRIM(COALESCE(p.subcategory, ''))) = LOWER(TRIM(COALESCE(m.subcategory_value, '')))
   AND (
     m.subsubcategory_value IS NULL
     OR LOWER(TRIM(COALESCE(p.subsubcategory, ''))) = LOWER(TRIM(COALESCE(m.subsubcategory_value, '')))
   )
  WHERE COALESCE(m.isactive, true) = true
    AND p.hsn_code IS NULL
    AND p.gst_rate IS NULL
)
UPDATE "product" p
SET
  "hsn_code" = match.hsn_code,
  "gst_rate" = match.gst_rate
FROM ranked_matches match
WHERE p.id = match.product_id
  AND match.match_rank = 1;

-- Step 3: Refuse to finish until every unmatched product has been assigned
-- legally reviewed values. Do not invent a default HSN or GST rate.
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM "product"
  WHERE NULLIF(TRIM("hsn_code"), '') IS NULL
     OR "gst_rate" IS NULL
     OR "gst_rate" < 0
     OR "gst_rate" > 100;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'HSN/GST migration blocked: % products require explicit tax classification', missing_count;
  END IF;
END $$;

ALTER TABLE "product"
  ALTER COLUMN "hsn_code" SET NOT NULL,
  ALTER COLUMN "gst_rate" SET NOT NULL;

COMMIT;

-- -----------------------------------------------------------------------------------------
-- Summary Verification Query:
-- -----------------------------------------------------------------------------------------
SELECT 
  COUNT(*) as total_products,
  COUNT(hsn_code) as mapped_hsn_count,
  COUNT(gst_rate) as mapped_gst_count,
  COUNT(*) - COUNT(hsn_code) as unmapped_count
FROM "product";
