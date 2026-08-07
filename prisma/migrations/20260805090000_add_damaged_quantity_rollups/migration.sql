ALTER TABLE "product"
  ADD COLUMN IF NOT EXISTS "damagedquantity" INTEGER DEFAULT 0;

ALTER TABLE "platformstock"
  ADD COLUMN IF NOT EXISTS "damagedqty" INTEGER NOT NULL DEFAULT 0;

UPDATE "product" AS p
SET "damagedquantity" = COALESCE(summary."damagedquantity", 0)
FROM (
  SELECT
    "puc",
    COUNT(*) FILTER (WHERE LOWER("stockstatus") = 'damaged')::int AS "damagedquantity"
  FROM "stock"
  WHERE COALESCE("isdeleted", false) = false
    AND COALESCE("isarchive", false) = false
  GROUP BY "puc"
) AS summary
WHERE p."puc" = summary."puc";

UPDATE "product"
SET "damagedquantity" = 0
WHERE "damagedquantity" IS NULL;

UPDATE "platformstock" AS ps
SET "damagedqty" = COALESCE((
  SELECT COUNT(*)::int
  FROM "stock" AS s
  JOIN "product" AS p ON p."puc" = s."puc"
  WHERE p."id" = ps."productid"
    AND LOWER(s."platform") = LOWER(ps."platform")
    AND LOWER(s."stockstatus") = 'damaged'
    AND COALESCE(s."isdeleted", false) = false
    AND COALESCE(s."isarchive", false) = false
), 0);
