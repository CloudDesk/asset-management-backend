-- =========================================================================================
-- Migration: Amazon sales mark stock units sold
-- Date: 2026-10-28
-- Ref: AMZ-PLAN-28 / FIX-2026-10-28-174 (docs/Amazon/Amazon_Master.md section 9), release checklist 4b
--
-- Why:
--   A shipped Amazon (seller-fulfilled) order moved only the platformstock counters; the unit
--   rows in "stock" stayed 'available' and ecomqty was not lowered, so the next stock-in or
--   recount brought the sold units back. From FIX-174 the sale marks the oldest Amazon units
--   'sold' (like a website order at Ready for Dispatch) and links each unit to the Amazon
--   stock reservation, so a return can put the same units back.
--   stock.orderid / orderlinenumber cannot be used: they are foreign keys to the website
--   orders / orderline tables.
--
-- What it does (table "stock", no data change):
--   + amazonReservationId  BIGINT NULL  the Amazon stock reservation that sold this unit
--     FK → amazon_order_stock_reservations(id) ON DELETE SET NULL
--   + index idx_stock_amazon_reservation
--
-- Safe to run more than once (IF NOT EXISTS). Runs in one transaction.
--
-- Where / when (run BEFORE deploying the FIX-174 backend). The column is deliberately NOT in the
-- Prisma Stock model, so a missing column cannot break the Stocks screens or website orders;
-- only the Amazon unit code uses it (raw SQL) and checks it exists. Without it, Amazon sales keep
-- the old behaviour (counters only) and each sold order line shows "migration missing".
--
--   Dev + SIT : assetmanagement_dev   (shared database: one run covers both)
--   UAT       : assetmanagement_uat   (after 20261027_amazon_combo_stock_reservations.sql)
--   Prod      : railway               (take a backup first)
--
-- How to run:
--   npm run db:sql -- <sit|uat|prod> --file=20261028_amazon_sold_stock_units.sql            (dry run)
--   npm run db:sql -- <sit|uat|prod> --file=20261028_amazon_sold_stock_units.sql --apply    (Prod also --confirm=NIVAANA_PROD_SQL)
--   Confirm the target database name before running (SELECT current_database();).
-- =========================================================================================

BEGIN;

ALTER TABLE "stock"
  ADD COLUMN IF NOT EXISTS "amazonReservationId" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'stock_amazonReservationId_fkey'
  ) THEN
    ALTER TABLE "stock"
      ADD CONSTRAINT "stock_amazonReservationId_fkey"
      FOREIGN KEY ("amazonReservationId") REFERENCES "amazon_order_stock_reservations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_stock_amazon_reservation" ON "stock" ("amazonReservationId");

COMMIT;

-- =========================================================================================
-- Verification (run after the script; expected values in comments)
-- =========================================================================================
-- Column exists  →  1 row, bigint, nullable YES
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--  WHERE table_name = 'stock' AND column_name = 'amazonReservationId';
--
-- Foreign key and index  →  1 row each
-- SELECT conname FROM pg_constraint WHERE conname = 'stock_amazonReservationId_fkey';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'stock' AND indexname = 'idx_stock_amazon_reservation';
--
-- No data changed  →  linked = 0 right after the first run
-- SELECT COUNT("amazonReservationId") AS linked FROM "stock";

-- =========================================================================================
-- Rollback (only if this change is withdrawn; the FIX-174 backend then falls back to counters only.
-- Units already marked sold by Amazon orders stay sold — only the link to the order is lost.)
-- =========================================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS "idx_stock_amazon_reservation";
-- ALTER TABLE "stock" DROP CONSTRAINT IF EXISTS "stock_amazonReservationId_fkey";
-- ALTER TABLE "stock" DROP COLUMN IF EXISTS "amazonReservationId";
-- COMMIT;
