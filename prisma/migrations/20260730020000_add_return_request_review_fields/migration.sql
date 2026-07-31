ALTER TABLE "return_requests"
  ADD COLUMN "request_review_status" VARCHAR(50),
  ADD COLUMN "request_review_remarks" TEXT,
  ADD COLUMN "request_rejection_reason" TEXT,
  ADD COLUMN "request_reviewed_by" INTEGER,
  ADD COLUMN "request_reviewed_date" BIGINT;

CREATE INDEX "idx_return_requests_review_status"
  ON "return_requests" ("request_review_status");

