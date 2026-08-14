ALTER TABLE "product"
  ALTER COLUMN "name" TYPE VARCHAR(1200),
  ALTER COLUMN "remarks" TYPE VARCHAR(1000);

UPDATE "product"
SET "remarks" = CASE
  WHEN CARDINALITY(STRING_TO_ARRAY("name", ' - ')) >= 3
    THEN ARRAY_TO_STRING((STRING_TO_ARRAY("name", ' - '))[3:], ' - ')
  WHEN CARDINALITY(STRING_TO_ARRAY("name", ' - ')) >= 2
    THEN ARRAY_TO_STRING((STRING_TO_ARRAY("name", ' - '))[2:], ' - ')
  ELSE "name"
END
WHERE "remarks" IS NULL
   OR BTRIM("remarks") = ''
   OR LOWER(BTRIM("remarks")) = 'false';

ALTER TABLE "product"
  ALTER COLUMN "remarks" SET NOT NULL;

ALTER TABLE "orderline"
  ALTER COLUMN "productname" TYPE VARCHAR(1200);

ALTER TABLE "tickets"
  ALTER COLUMN "productname" TYPE VARCHAR(1200);
