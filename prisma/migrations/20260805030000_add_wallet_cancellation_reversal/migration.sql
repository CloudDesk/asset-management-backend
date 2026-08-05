ALTER TABLE "wallet_reservations"
ADD COLUMN IF NOT EXISTS "consumed_at" BIGINT,
ADD COLUMN IF NOT EXISTS "reversed_at" BIGINT,
ADD COLUMN IF NOT EXISTS "reversal_reason" VARCHAR(100);

ALTER TABLE "wallet_reservations"
DROP CONSTRAINT IF EXISTS "wallet_reservations_status_check";

ALTER TABLE "wallet_reservations"
ADD CONSTRAINT "wallet_reservations_status_check"
CHECK ("status" IN ('reserved', 'consumed', 'released', 'reversed'));
