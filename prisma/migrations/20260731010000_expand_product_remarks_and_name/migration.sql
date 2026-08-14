-- Widen product remarks and the generated product name that contains them.
ALTER TABLE "product"
  ALTER COLUMN "remarks" TYPE VARCHAR(1000),
  ALTER COLUMN "name" TYPE VARCHAR(1516);
