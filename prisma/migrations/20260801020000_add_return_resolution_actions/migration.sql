CREATE TABLE IF NOT EXISTS "return_resolution_actions" (
  "id" SERIAL PRIMARY KEY,
  "return_request_id" INTEGER NOT NULL,
  "action_type" VARCHAR(100) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'pending',
  "amount" DECIMAL(10, 2),
  "refund_method" VARCHAR(100),
  "external_reference" VARCHAR(500),
  "shipment_tracking_id" VARCHAR(500),
  "shipment_provider" VARCHAR(100),
  "quantity" INTEGER,
  "stock_fallback_applied" BOOLEAN NOT NULL DEFAULT false,
  "no_reverse_charge_deduction" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "notes" TEXT,
  "created_by" INTEGER,
  "completed_by" INTEGER,
  "createddate" BIGINT,
  "modifieddate" BIGINT,
  "completeddate" BIGINT,
  CONSTRAINT "return_resolution_actions_request_fkey"
    FOREIGN KEY ("return_request_id")
    REFERENCES "return_requests"("id")
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT "return_resolution_actions_status_check"
    CHECK ("status" IN ('pending', 'completed', 'failed', 'cancelled')),
  CONSTRAINT "return_resolution_actions_action_type_check"
    CHECK ("action_type" IN ('refund', 'partial_refund', 'replacement_shipment', 'missing_item_shipment')),
  CONSTRAINT "return_resolution_actions_quantity_check"
    CHECK ("quantity" IS NULL OR "quantity" > 0),
  CONSTRAINT "return_resolution_actions_amount_check"
    CHECK ("amount" IS NULL OR "amount" >= 0)
);

CREATE INDEX IF NOT EXISTS "idx_return_resolution_actions_request"
  ON "return_resolution_actions" ("return_request_id");

CREATE INDEX IF NOT EXISTS "idx_return_resolution_actions_action_type"
  ON "return_resolution_actions" ("action_type");

CREATE INDEX IF NOT EXISTS "idx_return_resolution_actions_status"
  ON "return_resolution_actions" ("status");
