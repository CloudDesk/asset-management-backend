ALTER TABLE "orders"
ADD COLUMN "wallet_discount_total" DECIMAL(10,2) DEFAULT 0;

CREATE TABLE "wallet_reservations" (
  "id" SERIAL NOT NULL,
  "customer_id" INTEGER NOT NULL,
  "wallet_credit_id" INTEGER NOT NULL,
  "merchant_transaction_id" VARCHAR(500) NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'reserved',
  "expires_at" BIGINT NOT NULL,
  "order_id" INTEGER,
  "createddate" BIGINT NOT NULL,
  "modifieddate" BIGINT NOT NULL,
  CONSTRAINT "wallet_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wallet_reservations_credit_transaction_key" UNIQUE ("wallet_credit_id", "merchant_transaction_id"),
  CONSTRAINT "wallet_reservations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "wallet_reservations_wallet_credit_id_fkey" FOREIGN KEY ("wallet_credit_id") REFERENCES "wallet_credits"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wallet_reservations_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "wallet_reservations_status_check" CHECK ("status" IN ('reserved', 'consumed', 'released'))
);

CREATE INDEX "wallet_reservations_customer_id_status_idx" ON "wallet_reservations"("customer_id", "status");
CREATE INDEX "wallet_reservations_merchant_transaction_id_idx" ON "wallet_reservations"("merchant_transaction_id");
CREATE INDEX "wallet_reservations_expires_at_idx" ON "wallet_reservations"("expires_at");
