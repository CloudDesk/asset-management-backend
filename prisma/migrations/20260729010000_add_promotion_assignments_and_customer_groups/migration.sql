CREATE TABLE "customer_groups" (
  "id" SERIAL NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "status" VARCHAR(30) NOT NULL DEFAULT 'active',
  "createddate" BIGINT,
  "modifieddate" BIGINT,
  CONSTRAINT "customer_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_groups_code_key" ON "customer_groups"("code");
CREATE INDEX "customer_groups_status_idx" ON "customer_groups"("status");

CREATE TABLE "customer_group_members" (
  "id" SERIAL NOT NULL,
  "customer_group_id" INTEGER NOT NULL,
  "customer_id" INTEGER NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'active',
  "createddate" BIGINT,
  "modifieddate" BIGINT,
  CONSTRAINT "customer_group_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_group_members_customer_group_id_customer_id_key"
ON "customer_group_members"("customer_group_id", "customer_id");
CREATE INDEX "customer_group_members_customer_id_idx" ON "customer_group_members"("customer_id");
CREATE INDEX "customer_group_members_status_idx" ON "customer_group_members"("status");

CREATE TABLE "promotion_assignments" (
  "id" SERIAL NOT NULL,
  "promotion_id" INTEGER NOT NULL,
  "assignment_type" VARCHAR(30) NOT NULL,
  "customer_id" INTEGER,
  "customer_group_id" INTEGER,
  "voucher_code" VARCHAR(100) NOT NULL,
  "usage_limit" INTEGER,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "start_date" BIGINT,
  "end_date" BIGINT,
  "status" VARCHAR(30) NOT NULL DEFAULT 'active',
  "createddate" BIGINT,
  "modifieddate" BIGINT,
  CONSTRAINT "promotion_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "promotion_assignments_target_check" CHECK (
    ("assignment_type" = 'customer' AND "customer_id" IS NOT NULL AND "customer_group_id" IS NULL)
    OR
    ("assignment_type" = 'customer_group' AND "customer_id" IS NULL AND "customer_group_id" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "promotion_assignments_voucher_code_key"
ON "promotion_assignments"("voucher_code");
CREATE INDEX "promotion_assignments_promotion_id_idx" ON "promotion_assignments"("promotion_id");
CREATE INDEX "promotion_assignments_customer_id_idx" ON "promotion_assignments"("customer_id");
CREATE INDEX "promotion_assignments_customer_group_id_idx" ON "promotion_assignments"("customer_group_id");
CREATE INDEX "promotion_assignments_status_idx" ON "promotion_assignments"("status");

ALTER TABLE "customer_group_members"
ADD CONSTRAINT "customer_group_members_customer_group_id_fkey"
FOREIGN KEY ("customer_group_id") REFERENCES "customer_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_group_members"
ADD CONSTRAINT "customer_group_members_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promotion_assignments"
ADD CONSTRAINT "promotion_assignments_promotion_id_fkey"
FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promotion_assignments"
ADD CONSTRAINT "promotion_assignments_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promotion_assignments"
ADD CONSTRAINT "promotion_assignments_customer_group_id_fkey"
FOREIGN KEY ("customer_group_id") REFERENCES "customer_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "promotion_redemptions"
ADD COLUMN "assignment_id" INTEGER,
ADD COLUMN "voucher_code" VARCHAR(100);

CREATE INDEX "promotion_redemptions_assignment_id_idx" ON "promotion_redemptions"("assignment_id");
CREATE INDEX "promotion_redemptions_voucher_code_idx" ON "promotion_redemptions"("voucher_code");
CREATE UNIQUE INDEX "promotion_redemptions_evaluation_id_promotion_id_key"
ON "promotion_redemptions"("evaluation_id", "promotion_id");

ALTER TABLE "promotion_redemptions"
ADD CONSTRAINT "promotion_redemptions_assignment_id_fkey"
FOREIGN KEY ("assignment_id") REFERENCES "promotion_assignments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
