-- =========================================================================================
-- Migration: Add Flipkart FSN to Nivaana products
-- Date: 2026-10-29
-- Ref: FKT-PLAN-02 / decision D3 (docs/Flipkart/Flipkart_Master.md), FIX-2026-10-29-177, release checklist 4b
--
-- Why:
--   Flipkart seller SKUs (Nivaana_BlackOudh_Single, Auora_…_Pack3) do not match Nivaana PUCs, so
--   mapping a Flipkart listing relies on name matching. With the product's FSN (Flipkart Serial
--   Number, the listing's product_id, 16 characters) stored here, a listing with the same FSN is
--   suggested as a Strong match. Same idea as product.asin for Amazon.
--
-- What it does:
--   1. Adds nullable column "product"."fsn" (VARCHAR(20); an FSN is 16 characters).
--   2. Adds a non-unique index for the FSN lookup during listing mapping.
--   No existing row is changed: every product starts with fsn = NULL. No backfill.
--
-- Safe to run more than once (IF NOT EXISTS). Runs in one transaction.
--
-- Where / when (run BEFORE deploying the backend that reads product.fsn — once the Prisma
-- schema has the field, every product query selects it and fails if the column is missing):
--   Dev + SIT : assetmanagement_dev   (shared database: one run covers both)
--   UAT       : assetmanagement_uat   (with the SIT → UAT merge)
--   Prod      : railway               (with the UAT → Prod release; take a backup first)
--
-- How to run:
--   psql "$TARGET_DB_URL" -f scripts/migrations/20261029_add_product_fsn.sql
--   or: DATABASE_URL="$TARGET_DB_URL" npx prisma db execute --file scripts/migrations/20261029_add_product_fsn.sql --schema prisma/schema.prisma
--   Confirm the target database name before running (SELECT current_database();).
-- =========================================================================================

BEGIN;

-- Step 1: column
ALTER TABLE "product"
  ADD COLUMN IF NOT EXISTS "fsn" VARCHAR(20);

-- Step 2: lookup index (not unique: two products sharing an FSN would be a data mistake the
-- app warns about, not something that should make a product save fail)
CREATE INDEX IF NOT EXISTS "product_fsn_idx" ON "product" ("fsn");

COMMIT;

-- =========================================================================================
-- Verification (run after the script; expected values in comments)
-- =========================================================================================
-- Column exists, nullable, varchar(20)  →  1 row: fsn | character varying | 20 | YES
-- SELECT column_name, data_type, character_maximum_length, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'product' AND column_name = 'fsn';
--
-- Index exists  →  1 row: product_fsn_idx
-- SELECT indexname FROM pg_indexes WHERE tablename = 'product' AND indexname = 'product_fsn_idx';
--
-- No data changed  →  products_with_fsn = 0 right after the first run
-- SELECT COUNT(*) AS products, COUNT("fsn") AS products_with_fsn FROM "product";

-- =========================================================================================
-- Rollback (only if this change is withdrawn; deploy a backend without product.fsn first)
-- =========================================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS "product_fsn_idx";
-- ALTER TABLE "product" DROP COLUMN IF EXISTS "fsn";
-- COMMIT;
