ALTER TABLE "invoice_adjustments"
  ADD COLUMN IF NOT EXISTS "adjustment_invoice_url" VARCHAR(1000);
