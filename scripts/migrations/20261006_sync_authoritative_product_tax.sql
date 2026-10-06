-- Sync the approved category tax table into gst_hsn_mapping and product.
-- A NULL value represents an explicitly unclassified value supplied as "-".

BEGIN;

ALTER TABLE "product"
  ADD COLUMN IF NOT EXISTS "hsn_code" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "gst_rate" DECIMAL(5, 2);

ALTER TABLE "product"
  ALTER COLUMN "hsn_code" DROP NOT NULL,
  ALTER COLUMN "gst_rate" DROP NOT NULL,
  ALTER COLUMN "hsn_code" DROP DEFAULT,
  ALTER COLUMN "gst_rate" DROP DEFAULT;

ALTER TABLE "gst_hsn_mapping"
  ALTER COLUMN "hsn_code" DROP NOT NULL,
  ALTER COLUMN "gst_rate" DROP NOT NULL;

CREATE TEMP TABLE authoritative_product_tax (
  subcategory_id INTEGER PRIMARY KEY,
  subcategory_value VARCHAR(255) NOT NULL UNIQUE,
  hsn_code VARCHAR(50),
  gst_rate DECIMAL(5, 2)
) ON COMMIT DROP;

INSERT INTO authoritative_product_tax
  (subcategory_id, subcategory_value, hsn_code, gst_rate)
VALUES
  (112, 'incense_sticks',         '33074100',  5.00),
  (113, 'dhoop_sticks',           '33074100',  5.00),
  (114, 'dhoop_cones',            '33074100',  5.00),
  (115, 'havan_cups',             '33074100',  5.00),
  (116, 'incense_accessories',    '69120090',  5.00),
  (118, 'home_diffusers',         '85167990', 18.00),
  (119, 'car_diffusers',          '85167990', 18.00),
  (120, 'reed_diffusers',         '70200090', 18.00),
  (121, 'air_fresheners',         '33074900', 18.00),
  (122, 'wardrobe_fragrance',     '33074900', 18.00),
  (123, 'fragrance_oils',         '33074900', 18.00),
  (124, 'cleaning_fragrances',    '33074900', 18.00),
  (125, 'scented_candles',        '34060090',  5.00),
  (126, 'bath_body',              '34011190', 18.00),
  (127, 'skincare',               '33049990', 18.00),
  (128, 'aromatherapy',           '33012990', 18.00),
  (130, 'traditional_fragrances', '33030050', 18.00),
  (131, 'everyday_perfumes',      '33030050', 18.00),
  (132, 'luxury_perfumes',        '33030050', 18.00),
  (134, 'fresh_mornings',         '33074100',  5.00),
  (135, 'relaxation_calm',        '33074100',  5.00),
  (136, 'dusky_evenings',          NULL,        NULL),
  (137, 'peaceful_nights',         NULL,        NULL),
  (139, 'festival_gifts',          NULL,       18.00),
  (140, 'wellness_gifts',          NULL,       18.00),
  (141, 'luxury_gifts',            NULL,       18.00),
  (142, 'decor',                   NULL,       18.00);

DO $$
DECLARE
  invalid_picklist_count INTEGER;
  unknown_product_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO invalid_picklist_count
  FROM authoritative_product_tax a
  LEFT JOIN picklist p
    ON p.id = a.subcategory_id
   AND p.object = 'product'
   AND p.fieldname = 'subcategory'
  WHERE p.id IS NULL;

  IF invalid_picklist_count > 0 THEN
    RAISE EXCEPTION 'Tax sync blocked: % authoritative subcategory IDs are missing from picklist', invalid_picklist_count;
  END IF;

  SELECT COUNT(*) INTO unknown_product_count
  FROM product p
  LEFT JOIN authoritative_product_tax a
    ON LOWER(TRIM(COALESCE(p.subcategory, ''))) = LOWER(a.subcategory_value)
  WHERE a.subcategory_value IS NULL;

  IF unknown_product_count > 0 THEN
    RAISE EXCEPTION 'Tax sync blocked: % products use subcategories absent from the approved tax table', unknown_product_count;
  END IF;
END $$;

UPDATE gst_hsn_mapping m
SET
  subcategory_value = a.subcategory_value,
  hsn_code = a.hsn_code,
  gst_rate = a.gst_rate,
  isactive = true,
  modifieddate = (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT
FROM authoritative_product_tax a
WHERE m.subcategory_id = a.subcategory_id
  AND m.subsubcategory_id IS NULL;

INSERT INTO gst_hsn_mapping (
  subcategory_id,
  subcategory_value,
  subsubcategory_id,
  subsubcategory_value,
  hsn_code,
  gst_rate,
  description,
  isactive,
  createddate,
  modifieddate
)
SELECT
  a.subcategory_id,
  a.subcategory_value,
  NULL,
  NULL,
  a.hsn_code,
  a.gst_rate,
  'Approved product tax table 2026-10-06',
  true,
  (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT,
  (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT
FROM authoritative_product_tax a
WHERE NOT EXISTS (
  SELECT 1
  FROM gst_hsn_mapping m
  WHERE m.subcategory_id = a.subcategory_id
    AND m.subsubcategory_id IS NULL
);

UPDATE product p
SET
  hsn_code = a.hsn_code,
  gst_rate = a.gst_rate
FROM authoritative_product_tax a
WHERE LOWER(TRIM(COALESCE(p.subcategory, ''))) = LOWER(a.subcategory_value);

COMMIT;

SELECT
  COUNT(*) AS total_products,
  COUNT(hsn_code) AS products_with_hsn,
  COUNT(gst_rate) AS products_with_gst,
  COUNT(*) FILTER (WHERE hsn_code IS NULL) AS products_with_blank_hsn,
  COUNT(*) FILTER (WHERE gst_rate IS NULL) AS products_with_blank_gst
FROM product;
