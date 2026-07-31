CREATE TABLE "return_inspections" (
  "id" SERIAL PRIMARY KEY,
  "return_request_id" INTEGER NOT NULL,
  "inspected_by_inventory_user_id" INTEGER NOT NULL,
  "received_quantity" INTEGER NOT NULL,
  "approved_quantity" INTEGER NOT NULL DEFAULT 0,
  "rejected_quantity" INTEGER NOT NULL DEFAULT 0,
  "condition" VARCHAR(100) NOT NULL,
  "inspection_notes" TEXT,
  "restock_action" VARCHAR(100) NOT NULL DEFAULT 'none',
  "createddate" BIGINT,
  "modifieddate" BIGINT,
  CONSTRAINT "return_inspections_request_fkey"
    FOREIGN KEY ("return_request_id") REFERENCES "return_requests" ("id")
    ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "return_inspections_received_quantity_check"
    CHECK ("received_quantity" > 0),
  CONSTRAINT "return_inspections_approved_quantity_check"
    CHECK ("approved_quantity" >= 0),
  CONSTRAINT "return_inspections_rejected_quantity_check"
    CHECK ("rejected_quantity" >= 0),
  CONSTRAINT "return_inspections_total_quantity_check"
    CHECK (("approved_quantity" + "rejected_quantity") <= "received_quantity"),
  CONSTRAINT "return_inspections_condition_check"
    CHECK ("condition" IN ('resellable', 'damaged', 'incorrect_product', 'other')),
  CONSTRAINT "return_inspections_restock_action_check"
    CHECK ("restock_action" IN ('available', 'damaged', 'quarantine', 'none'))
);

CREATE INDEX "idx_return_inspections_request"
  ON "return_inspections" ("return_request_id");

CREATE INDEX "idx_return_inspections_inspector"
  ON "return_inspections" ("inspected_by_inventory_user_id");

CREATE INDEX "idx_return_inspections_condition"
  ON "return_inspections" ("condition");

CREATE INDEX "idx_return_inspections_restock_action"
  ON "return_inspections" ("restock_action");
