-- A courier is assigned only after a shipment is successfully created.
ALTER TABLE "orders"
  ALTER COLUMN "vendor" DROP DEFAULT;

-- Clear legacy EKART values that came only from the former column default.
-- Genuine shipments retain their provider because they have shipment evidence.
UPDATE "orders"
SET "vendor" = NULL
WHERE UPPER(TRIM("vendor")) = 'EKART'
  AND "tracking_id" IS NULL
  AND "shipment_created_at" IS NULL
  AND "barcodes" IS NULL
  AND "label_url" IS NULL
  AND "public_tracking_link" IS NULL
  AND "shipment_tracking_status" IS NULL;
