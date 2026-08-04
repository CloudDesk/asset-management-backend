ALTER TABLE "promotion_assignments"
DROP CONSTRAINT IF EXISTS "promotion_assignments_target_check";

ALTER TABLE "promotion_assignments"
ADD COLUMN "claimed_by_customer_id" INTEGER,
ADD COLUMN "claimed_at" BIGINT,
ADD COLUMN "dispatched_order_id" VARCHAR(500),
ADD COLUMN "reserved_by_customer_id" INTEGER,
ADD COLUMN "reservation_reference" VARCHAR(100),
ADD COLUMN "reservation_expires_at" BIGINT;

ALTER TABLE "promotion_assignments"
ADD CONSTRAINT "promotion_assignments_target_check" CHECK (
  ("assignment_type" = 'customer' AND "customer_id" IS NOT NULL AND "customer_group_id" IS NULL)
  OR
  ("assignment_type" = 'customer_group' AND "customer_id" IS NULL AND "customer_group_id" IS NOT NULL)
  OR
  ("assignment_type" = 'anyone' AND "customer_id" IS NULL AND "customer_group_id" IS NULL)
);

ALTER TABLE "promotion_assignments"
ADD CONSTRAINT "promotion_assignments_claimed_by_customer_id_fkey"
FOREIGN KEY ("claimed_by_customer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "promotion_assignments_claimed_by_customer_id_idx"
ON "promotion_assignments"("claimed_by_customer_id");

CREATE INDEX "promotion_assignments_reservation_expires_at_idx"
ON "promotion_assignments"("reservation_expires_at");
