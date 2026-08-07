ALTER TABLE "return_requests"
  ADD COLUMN IF NOT EXISTS "applied_policy_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "applied_policy_version" BIGINT,
  ADD COLUMN IF NOT EXISTS "policy_reason_rule_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "policy_reason_rule_version" INTEGER;

CREATE INDEX IF NOT EXISTS "idx_return_requests_applied_policy_id"
  ON "return_requests" ("applied_policy_id");

CREATE INDEX IF NOT EXISTS "idx_return_requests_policy_reason_rule_id"
  ON "return_requests" ("policy_reason_rule_id");
