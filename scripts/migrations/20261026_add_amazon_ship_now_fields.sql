-- =========================================================================================
-- Migration: Amazon Self Ship "Ship now" and delivery status fields
-- Date: 2026-10-26
-- Ref: AMZ-PLAN-25 / FIX-2026-10-26-162 (docs/Amazon/Amazon_Order_Fulfillment.md), release checklist 4b
--
-- Why:
--   Amazon Self Ship orders are now shipped from Nivaana through Ekart, Shipmozo or a manual
--   courier (like website orders), and their delivery status (In transit → Delivered / RTO)
--   comes from the courier webhooks or a manual update. The Amazon fulfilment row needs to know
--   which provider booked the parcel and keep the latest delivery status.
--
-- What it does (table "amazon_order_fulfillments", all new columns nullable, no data change):
--   shippingProvider       EKART | SHIPMOZO | MANUAL
--   providerOrderId        Shipmozo's own order ID (needed for labels / support)
--   publicTrackingLink     courier tracking page
--   deliveryStatus         shipped | in_transit | out_for_delivery | delivered | rto_initiated | rto_delivered
--   deliveryStatusSource   EKART | SHIPMOZO | MANUAL
--   deliveryProviderStatus courier's own status text
--   deliveryUpdatedAt      when deliveryStatus last changed
--   deliveredAt            when it was delivered
--   deliveryNextSyncAt     next scheduled Shipmozo tracking check (NULL = no more checks)
--   + index on "trackingNumber" (webhooks find the Amazon order by AWB)
--   The buyer's address is NOT stored (Amazon PII rules; it goes straight to the courier).
--
-- Safe to run more than once (IF NOT EXISTS). Runs in one transaction.
--
-- Where / when (run BEFORE deploying the backend with these fields in the Prisma schema —
-- every Amazon order query selects them and fails if they are missing):
--   Dev + SIT : assetmanagement_dev   (shared database: one run covers both)
--   UAT       : assetmanagement_uat   (with the SIT → UAT merge)
--   Prod      : railway               (with the UAT → Prod release; take a backup first)
--
-- How to run:
--   npm run db:sql -- <sit|uat|prod> --apply   (Prod also --confirm=NIVAANA_PROD_SQL)
--   or: DATABASE_URL="$TARGET_DB_URL" npx prisma db execute --file scripts/migrations/20261026_add_amazon_ship_now_fields.sql --schema prisma/schema.prisma
--   Confirm the target database name before running (SELECT current_database();).
-- =========================================================================================

BEGIN;

ALTER TABLE "amazon_order_fulfillments"
  ADD COLUMN IF NOT EXISTS "shippingProvider" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "providerOrderId" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "publicTrackingLink" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryStatus" VARCHAR(40),
  ADD COLUMN IF NOT EXISTS "deliveryStatusSource" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "deliveryProviderStatus" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "deliveryUpdatedAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMPTZ(3),
  ADD COLUMN IF NOT EXISTS "deliveryNextSyncAt" TIMESTAMPTZ(3);

CREATE INDEX IF NOT EXISTS "amazon_order_fulfillment_tracking_idx"
  ON "amazon_order_fulfillments" ("trackingNumber");

COMMIT;

-- =========================================================================================
-- Verification (run after the script; expected values in comments)
-- =========================================================================================
-- 9 new columns  →  9 rows
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'amazon_order_fulfillments'
--    AND column_name IN ('shippingProvider','providerOrderId','publicTrackingLink','deliveryStatus',
--                        'deliveryStatusSource','deliveryProviderStatus','deliveryUpdatedAt',
--                        'deliveredAt','deliveryNextSyncAt');
--
-- Index exists  →  1 row
-- SELECT indexname FROM pg_indexes
--  WHERE tablename = 'amazon_order_fulfillments' AND indexname = 'amazon_order_fulfillment_tracking_idx';
--
-- No data changed  →  with_provider = 0 right after the first run
-- SELECT COUNT(*) AS fulfillments, COUNT("shippingProvider") AS with_provider FROM "amazon_order_fulfillments";

-- =========================================================================================
-- Rollback (only if this change is withdrawn; deploy a backend without these fields first)
-- =========================================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS "amazon_order_fulfillment_tracking_idx";
-- ALTER TABLE "amazon_order_fulfillments"
--   DROP COLUMN IF EXISTS "shippingProvider", DROP COLUMN IF EXISTS "providerOrderId",
--   DROP COLUMN IF EXISTS "publicTrackingLink", DROP COLUMN IF EXISTS "deliveryStatus",
--   DROP COLUMN IF EXISTS "deliveryStatusSource", DROP COLUMN IF EXISTS "deliveryProviderStatus",
--   DROP COLUMN IF EXISTS "deliveryUpdatedAt", DROP COLUMN IF EXISTS "deliveredAt",
--   DROP COLUMN IF EXISTS "deliveryNextSyncAt";
-- COMMIT;
