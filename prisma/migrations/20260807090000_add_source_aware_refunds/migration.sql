ALTER TABLE "wallet_credits"
  ALTER COLUMN "assignment_id" DROP NOT NULL,
  ADD COLUMN "source_reference" VARCHAR(150),
  ADD COLUMN "label" VARCHAR(255),
  ADD COLUMN "source_order_id" INTEGER,
  ADD COLUMN "source_return_request_id" INTEGER;

ALTER TABLE "wallet_credits" DROP CONSTRAINT IF EXISTS "wallet_credits_source_type_check";
ALTER TABLE "wallet_credits"
  ADD CONSTRAINT "wallet_credits_source_type_check"
  CHECK ("source_type" IN ('coupon', 'cancellation_refund', 'return_refund'));

CREATE UNIQUE INDEX "wallet_credits_source_reference_key"
  ON "wallet_credits"("source_reference") WHERE "source_reference" IS NOT NULL;
CREATE INDEX "wallet_credits_source_order_id_idx" ON "wallet_credits"("source_order_id");
CREATE INDEX "wallet_credits_source_return_request_id_idx" ON "wallet_credits"("source_return_request_id");

CREATE TABLE "refund_operations" (
  "id" SERIAL PRIMARY KEY,
  "operation_number" VARCHAR(120) NOT NULL UNIQUE,
  "idempotency_key" VARCHAR(200) NOT NULL UNIQUE,
  "order_id" INTEGER NOT NULL,
  "return_request_id" INTEGER,
  "resolution_action_id" INTEGER,
  "customer_id" INTEGER NOT NULL,
  "trigger_type" VARCHAR(30) NOT NULL,
  "destination" VARCHAR(30) NOT NULL,
  "approved_amount" DECIMAL(10,2) NOT NULL,
  "original_wallet_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "eligible_wallet_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "expired_wallet_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "online_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "non_expiring_wallet_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "wallet_credited_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "phonepe_refund_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "wallet_status" VARCHAR(30) NOT NULL DEFAULT 'pending',
  "phonepe_status" VARCHAR(30) NOT NULL DEFAULT 'not_required',
  "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
  "phonepe_refund_id" VARCHAR(500),
  "consent_accepted" BOOLEAN NOT NULL DEFAULT false,
  "consent_channel" VARCHAR(50),
  "consent_reference" VARCHAR(500),
  "consent_notes" TEXT,
  "consent_at" BIGINT,
  "breakdown" JSONB,
  "failure_reason" TEXT,
  "created_by" INTEGER,
  "createddate" BIGINT NOT NULL,
  "modifieddate" BIGINT NOT NULL,
  "completeddate" BIGINT,
  CONSTRAINT "refund_operations_trigger_check" CHECK ("trigger_type" IN ('cancellation', 'return')),
  CONSTRAINT "refund_operations_destination_check" CHECK ("destination" IN ('original_sources', 'wallet')),
  CONSTRAINT "refund_operations_status_check" CHECK ("status" IN ('pending', 'processing', 'completed', 'partial_failed', 'failed')),
  CONSTRAINT "refund_operations_order_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT,
  CONSTRAINT "refund_operations_customer_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX "refund_operations_order_id_idx" ON "refund_operations"("order_id");
CREATE INDEX "refund_operations_return_request_id_idx" ON "refund_operations"("return_request_id");
CREATE INDEX "refund_operations_customer_id_idx" ON "refund_operations"("customer_id");
CREATE INDEX "refund_operations_status_idx" ON "refund_operations"("status");

CREATE TABLE "refund_wallet_allocations" (
  "id" SERIAL PRIMARY KEY,
  "refund_operation_id" INTEGER NOT NULL,
  "reservation_id" INTEGER,
  "source_credit_id" INTEGER,
  "target_credit_id" INTEGER,
  "allocation_type" VARCHAR(40) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" VARCHAR(30) NOT NULL,
  "expires_at" BIGINT,
  "metadata" JSONB,
  "createddate" BIGINT NOT NULL,
  "modifieddate" BIGINT NOT NULL,
  CONSTRAINT "refund_wallet_allocations_operation_fkey" FOREIGN KEY ("refund_operation_id") REFERENCES "refund_operations"("id") ON DELETE CASCADE,
  CONSTRAINT "refund_wallet_allocations_reservation_fkey" FOREIGN KEY ("reservation_id") REFERENCES "wallet_reservations"("id") ON DELETE RESTRICT,
  CONSTRAINT "refund_wallet_allocations_source_credit_fkey" FOREIGN KEY ("source_credit_id") REFERENCES "wallet_credits"("id") ON DELETE RESTRICT,
  CONSTRAINT "refund_wallet_allocations_target_credit_fkey" FOREIGN KEY ("target_credit_id") REFERENCES "wallet_credits"("id") ON DELETE RESTRICT,
  CONSTRAINT "refund_wallet_allocations_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "refund_wallet_allocations_status_check" CHECK ("status" IN ('pending', 'completed', 'skipped_expired', 'failed'))
);

CREATE UNIQUE INDEX "refund_wallet_allocation_unique"
  ON "refund_wallet_allocations"("refund_operation_id", "reservation_id", "allocation_type");
CREATE INDEX "refund_wallet_allocations_operation_idx" ON "refund_wallet_allocations"("refund_operation_id");
CREATE INDEX "refund_wallet_allocations_reservation_idx" ON "refund_wallet_allocations"("reservation_id");
CREATE INDEX "refund_wallet_allocations_source_credit_idx" ON "refund_wallet_allocations"("source_credit_id");
