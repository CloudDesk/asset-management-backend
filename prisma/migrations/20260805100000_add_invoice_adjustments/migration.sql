CREATE TABLE IF NOT EXISTS "invoice_adjustments" (
  "id" SERIAL PRIMARY KEY,
  "adjustment_number" VARCHAR(120) NOT NULL UNIQUE,
  "adjustment_type" VARCHAR(100) NOT NULL,
  "source_action" VARCHAR(100) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
  "order_id" INTEGER,
  "order_number" VARCHAR(500),
  "return_request_id" INTEGER,
  "resolution_action_id" INTEGER,
  "original_invoice_number" VARCHAR(500),
  "original_invoice_url" VARCHAR(1000),
  "original_invoice_amount" DECIMAL(10, 2),
  "remaining_amount" DECIMAL(10, 2),
  "reversed_amount" DECIMAL(10, 2),
  "credit_note_id" INTEGER,
  "credit_note_number" VARCHAR(100),
  "gst_reversal_applicable" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "notes" TEXT,
  "created_by" INTEGER,
  "createddate" BIGINT,
  "modifieddate" BIGINT
);

CREATE INDEX IF NOT EXISTS "idx_invoice_adjustments_order"
  ON "invoice_adjustments" ("order_id");

CREATE INDEX IF NOT EXISTS "idx_invoice_adjustments_return_request"
  ON "invoice_adjustments" ("return_request_id");

CREATE INDEX IF NOT EXISTS "idx_invoice_adjustments_type"
  ON "invoice_adjustments" ("adjustment_type");

CREATE INDEX IF NOT EXISTS "idx_invoice_adjustments_source_action"
  ON "invoice_adjustments" ("source_action");
