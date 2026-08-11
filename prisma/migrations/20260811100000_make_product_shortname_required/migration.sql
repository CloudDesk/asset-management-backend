DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "product"
    WHERE "shortname" IS NULL
       OR BTRIM("shortname") = ''
  ) THEN
    RAISE EXCEPTION 'Cannot require product.shortname while null or blank values exist';
  END IF;
END $$;

ALTER TABLE "product"
  ALTER COLUMN "shortname" SET NOT NULL;

ALTER TABLE "product"
  ADD CONSTRAINT "product_shortname_not_blank"
  CHECK (BTRIM("shortname") <> '');
