ALTER TABLE "return_requests"
  ADD COLUMN "received_quantity" INTEGER,
  ADD COLUMN "received_condition" VARCHAR(100),
  ADD COLUMN "received_remarks" TEXT,
  ADD COLUMN "received_location" VARCHAR(255),
  ADD COLUMN "received_by" INTEGER,
  ADD COLUMN "received_date" BIGINT;

CREATE INDEX "idx_return_requests_received_date"
  ON "return_requests" ("received_date");

