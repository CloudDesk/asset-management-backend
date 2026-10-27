-- =========================================================================================
-- Migration: Amazon combo listings — one stock reservation per combo component
-- Date: 2026-10-27
-- Ref: AMZ-PLAN-27 / FIX-2026-10-27-168 (docs/Amazon/Amazon_Master.md section 9), release checklist 4b
--
-- Why:
--   A combo product has no stock of its own (virtual stock: C = 1 x A + 1 x B is available as
--   min(A, B)). An Amazon order for a combo listing must reserve, sell and release each
--   component, so one Amazon order item now has one reservation row per component.
--
-- What it does (table "amazon_order_stock_reservations", no data change):
--   + comboProductId  BIGINT NULL  the mapped combo product when the row is one of its components
--                                  (NULL for single products, i.e. every existing row)
--   unique key (orderId, amazonOrderItemId)  →  (orderId, amazonOrderItemId, productId)
--   Existing rows have one row per order item, so the new key holds for them.
--
-- Safe to run more than once (IF NOT EXISTS / IF EXISTS). Runs in one transaction.
--
-- Where / when (run BEFORE deploying the backend with comboProductId in the Prisma schema —
-- every Amazon order query selects it and fails if it is missing):
--   Dev + SIT : assetmanagement_dev   (shared database: one run covers both)
--   UAT       : assetmanagement_uat   (with the SIT → UAT merge)
--   Prod      : railway               (with the UAT → Prod release; take a backup first)
--
-- How to run:
--   npm run db:sql -- <sit|uat|prod> --apply   (Prod also --confirm=NIVAANA_PROD_SQL)
--   Confirm the target database name before running (SELECT current_database();).
-- =========================================================================================

BEGIN;

ALTER TABLE "amazon_order_stock_reservations"
  ADD COLUMN IF NOT EXISTS "comboProductId" BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'amazon_order_stock_reservations_comboProductId_fkey'
  ) THEN
    ALTER TABLE "amazon_order_stock_reservations"
      ADD CONSTRAINT "amazon_order_stock_reservations_comboProductId_fkey"
      FOREIGN KEY ("comboProductId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS "amazon_order_stock_reservations_order_item_unique";

CREATE UNIQUE INDEX IF NOT EXISTS "amazon_order_stock_reservations_order_item_product_unique"
  ON "amazon_order_stock_reservations" ("orderId", "amazonOrderItemId", "productId");

COMMIT;

-- =========================================================================================
-- Verification (run after the script; expected values in comments)
-- =========================================================================================
-- Column exists  →  1 row
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'amazon_order_stock_reservations' AND column_name = 'comboProductId';
--
-- New unique index exists, old one gone  →  1 row: ..._order_item_product_unique
-- SELECT indexname FROM pg_indexes WHERE tablename = 'amazon_order_stock_reservations'
--    AND indexname LIKE 'amazon_order_stock_reservations_order_item%';
--
-- No data changed  →  with_combo = 0 right after the first run
-- SELECT COUNT(*) AS reservations, COUNT("comboProductId") AS with_combo FROM "amazon_order_stock_reservations";

-- =========================================================================================
-- Rollback (only if this change is withdrawn; deploy a backend without comboProductId first,
-- and only while no order has combo rows — the old key allows one row per order item)
-- =========================================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS "amazon_order_stock_reservations_order_item_product_unique";
-- CREATE UNIQUE INDEX "amazon_order_stock_reservations_order_item_unique"
--   ON "amazon_order_stock_reservations" ("orderId", "amazonOrderItemId");
-- ALTER TABLE "amazon_order_stock_reservations" DROP CONSTRAINT IF EXISTS "amazon_order_stock_reservations_comboProductId_fkey";
-- ALTER TABLE "amazon_order_stock_reservations" DROP COLUMN IF EXISTS "comboProductId";
-- COMMIT;
