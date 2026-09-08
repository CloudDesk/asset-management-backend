ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "invoice_seller_address" JSONB;

UPDATE "orders"
SET "invoice_seller_address" = jsonb_build_object(
  'alias', 'VIP98 - SALES OFFICE',
  'phone', '9003879665',
  'address_line1', '968, 1ST FLOOR 4TH HOUSE, TNHB 1ST MAIN ROAD, VELACHERY',
  'address_line2', 'OPP. TO PURPLE PHARMACY',
  'pincode', '600042',
  'city', 'Chennai',
  'state', 'Tamil Nadu',
  'country', 'India',
  'gstin', '33AABCU9603R1ZX'
)
WHERE "invoice_seller_address" IS NULL;
