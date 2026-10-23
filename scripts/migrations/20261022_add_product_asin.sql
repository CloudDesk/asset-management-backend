-- =========================================================================================
-- Migration: Add Amazon ASIN to Nivaana products
-- Date: 2026-10-22
-- Ref: Amazon gap D4 / AMZ-PLAN-17 (docs/Amazon/Amazon_Master.md), release checklist 4b
--
-- Why:
--   Amazon seller SKUs (VQ-…, KRAFT-…) do not match Nivaana PUCs (NIV-…, KRA-…), so mapping an
--   Amazon listing to a product relies on name matching ("Possible" at best). With the product's
--   ASIN stored here, a listing with the same ASIN is suggested as a Strong match.
--
-- What it does:
--   1. Adds nullable column "product"."asin" (VARCHAR(20); an ASIN is 10 characters).
--   2. Adds a non-unique index for the ASIN lookup during listing import / mapping.
--   No existing row is changed: every product starts with asin = NULL. No backfill.
--
-- Safe to run more than once (IF NOT EXISTS). Runs in one transaction.
--
-- Where / when (run BEFORE deploying the backend that reads product.asin — once the Prisma
-- schema has the field, every product query selects it and fails if the column is missing):
--   Dev + SIT : assetmanagement_dev   (shared database: one run covers both)
--   UAT       : assetmanagement_uat   (with the SIT → UAT merge)
--   Prod      : railway               (with the UAT → Prod release; take a backup first)
--
-- How to run:
--   psql "$TARGET_DB_URL" -f scripts/migrations/20261022_add_product_asin.sql
--   or: DATABASE_URL="$TARGET_DB_URL" npx prisma db execute --file scripts/migrations/20261022_add_product_asin.sql --schema prisma/schema.prisma
--   Confirm the target database name before running (SELECT current_database();).
-- =========================================================================================

BEGIN;

-- Step 1: column
ALTER TABLE "product"
  ADD COLUMN IF NOT EXISTS "asin" VARCHAR(20);

-- Step 2: lookup index (not unique: two products sharing an ASIN would be a data mistake the
-- app warns about, not something that should make a product save fail)
CREATE INDEX IF NOT EXISTS "product_asin_idx" ON "product" ("asin");

COMMIT;

-- =========================================================================================
-- Verification (run after the script; expected values in comments)
-- =========================================================================================
-- Column exists, nullable, varchar(20)  →  1 row: asin | character varying | 20 | YES
-- SELECT column_name, data_type, character_maximum_length, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'product' AND column_name = 'asin';
--
-- Index exists  →  1 row: product_asin_idx
-- SELECT indexname FROM pg_indexes WHERE tablename = 'product' AND indexname = 'product_asin_idx';
--
-- No data changed  →  products_with_asin = 0 right after the first run
-- SELECT COUNT(*) AS products, COUNT("asin") AS products_with_asin FROM "product";

-- =========================================================================================
-- Rollback (only if this change is withdrawn; deploy a backend without product.asin first)
-- =========================================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS "product_asin_idx";
-- ALTER TABLE "product" DROP COLUMN IF EXISTS "asin";
-- COMMIT;
