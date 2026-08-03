-- Restore the product field limits used before the July 2026 expansion.
-- This migration is safe only when no existing values exceed these limits.
ALTER TABLE "product"
  ALTER COLUMN "remarks" TYPE VARCHAR(255),
  ALTER COLUMN "name" TYPE VARCHAR(500);
