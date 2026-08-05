CREATE TABLE "coupon_groups" (
  "id" SERIAL NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "status" VARCHAR(30) NOT NULL DEFAULT 'active',
  "createddate" BIGINT NOT NULL,
  "modifieddate" BIGINT NOT NULL,
  CONSTRAINT "coupon_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coupon_groups_code_key" UNIQUE ("code"),
  CONSTRAINT "coupon_groups_status_check" CHECK ("status" IN ('active', 'inactive'))
);

CREATE TABLE "coupon_group_members" (
  "id" SERIAL NOT NULL,
  "coupon_group_id" INTEGER NOT NULL,
  "customer_id" INTEGER NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'active',
  "createddate" BIGINT NOT NULL,
  "modifieddate" BIGINT NOT NULL,
  CONSTRAINT "coupon_group_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "coupon_group_members_group_customer_key" UNIQUE ("coupon_group_id", "customer_id"),
  CONSTRAINT "coupon_group_members_status_check" CHECK ("status" IN ('active', 'inactive')),
  CONSTRAINT "coupon_group_members_coupon_group_id_fkey" FOREIGN KEY ("coupon_group_id") REFERENCES "coupon_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "coupon_group_members_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "promotion_assignments"
ADD COLUMN "source_coupon_group_id" INTEGER;

ALTER TABLE "promotion_assignments"
ADD CONSTRAINT "promotion_assignments_source_coupon_group_id_fkey"
FOREIGN KEY ("source_coupon_group_id") REFERENCES "coupon_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "coupon_groups_status_idx" ON "coupon_groups"("status");
CREATE INDEX "coupon_group_members_customer_id_idx" ON "coupon_group_members"("customer_id");
CREATE INDEX "coupon_group_members_status_idx" ON "coupon_group_members"("status");
CREATE INDEX "promotion_assignments_source_coupon_group_id_idx" ON "promotion_assignments"("source_coupon_group_id");
