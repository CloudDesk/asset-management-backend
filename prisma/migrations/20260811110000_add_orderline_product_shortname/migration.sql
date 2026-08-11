ALTER TABLE "orderline"
ADD COLUMN IF NOT EXISTS "productshortname" VARCHAR(160);

UPDATE "orderline" AS ol
SET "productshortname" = BTRIM(p."shortname")
FROM "product" AS p
WHERE ol."productid" = p."id"
  AND NULLIF(BTRIM(p."shortname"), '') IS NOT NULL
  AND NULLIF(BTRIM(ol."productshortname"), '') IS NULL;
