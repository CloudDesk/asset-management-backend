CREATE TABLE IF NOT EXISTS "return_credit_notes" (
  "id" SERIAL PRIMARY KEY,
  "credit_note_number" VARCHAR(100) NOT NULL UNIQUE,
  "return_request_id" INTEGER NOT NULL,
  "resolution_action_id" INTEGER,
  "original_order_id" INTEGER,
  "original_order_number" VARCHAR(500),
  "original_invoice_number" VARCHAR(500),
  "original_invoice_url" VARCHAR(1000),
  "reason_code" VARCHAR(100),
  "resolution" VARCHAR(100),
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "refund_amount" DECIMAL(10, 2) NOT NULL,
  "taxable_amount" DECIMAL(10, 2),
  "gst_rate" DECIMAL(5, 2),
  "cgst_amount" DECIMAL(10, 2),
  "sgst_amount" DECIMAL(10, 2),
  "igst_amount" DECIMAL(10, 2),
  "total_gst_amount" DECIMAL(10, 2),
  "hsn_code" VARCHAR(50),
  "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
  "metadata" JSONB,
  "notes" TEXT,
  "created_by" INTEGER,
  "issued_by" INTEGER,
  "createddate" BIGINT,
  "modifieddate" BIGINT,
  "issueddate" BIGINT,
  CONSTRAINT "return_credit_notes_return_request_id_fkey"
    FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "return_credit_notes_resolution_action_id_fkey"
    FOREIGN KEY ("resolution_action_id") REFERENCES "return_resolution_actions"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION
);

CREATE INDEX IF NOT EXISTS "idx_return_credit_notes_request"
  ON "return_credit_notes"("return_request_id");

CREATE INDEX IF NOT EXISTS "idx_return_credit_notes_resolution_action"
  ON "return_credit_notes"("resolution_action_id");

CREATE INDEX IF NOT EXISTS "idx_return_credit_notes_status"
  ON "return_credit_notes"("status");
