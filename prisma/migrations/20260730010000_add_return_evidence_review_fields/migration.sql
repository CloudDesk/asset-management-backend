ALTER TABLE "return_requests"
  ADD COLUMN "evidence_rejection_reason" TEXT,
  ADD COLUMN "evidence_review_remarks" TEXT,
  ADD COLUMN "evidence_reviewed_by" INTEGER,
  ADD COLUMN "evidence_reviewed_date" BIGINT;

CREATE INDEX "idx_return_requests_evidence_review_status"
  ON "return_requests" ("evidence_review_status");

