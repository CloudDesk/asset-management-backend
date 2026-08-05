CREATE TABLE "wallet_credits" (
  "id" SERIAL NOT NULL,
  "customer_id" INTEGER NOT NULL,
  "assignment_id" INTEGER NOT NULL,
  "source_type" VARCHAR(30) NOT NULL DEFAULT 'coupon',
  "original_amount" DECIMAL(10,2) NOT NULL,
  "remaining_amount" DECIMAL(10,2) NOT NULL,
  "minimum_cart_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status" VARCHAR(30) NOT NULL DEFAULT 'active',
  "expires_at" BIGINT,
  "createddate" BIGINT NOT NULL,
  "modifieddate" BIGINT NOT NULL,

  CONSTRAINT "wallet_credits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wallet_credits_assignment_id_key" UNIQUE ("assignment_id"),
  CONSTRAINT "wallet_credits_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "wallet_credits_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "promotion_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wallet_credits_source_type_check" CHECK ("source_type" = 'coupon'),
  CONSTRAINT "wallet_credits_amount_check" CHECK (
    "original_amount" > 0
    AND "remaining_amount" >= 0
    AND "remaining_amount" <= "original_amount"
    AND "minimum_cart_amount" >= 0
  ),
  CONSTRAINT "wallet_credits_status_check" CHECK ("status" IN ('active', 'partially_used', 'used', 'expired'))
);

CREATE INDEX "wallet_credits_customer_id_status_idx" ON "wallet_credits"("customer_id", "status");
CREATE INDEX "wallet_credits_expires_at_idx" ON "wallet_credits"("expires_at");
