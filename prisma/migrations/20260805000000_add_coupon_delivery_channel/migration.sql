ALTER TABLE "promotion_assignments"
ADD COLUMN "delivery_channel" VARCHAR(20) NOT NULL DEFAULT 'all';

ALTER TABLE "promotion_assignments"
ADD CONSTRAINT "promotion_assignments_delivery_channel_check"
CHECK ("delivery_channel" IN ('all', 'web', 'mobile', 'print'));

UPDATE "promotion_assignments"
SET "delivery_channel" = COALESCE(
  (SELECT "applicable_channel" FROM "promotions" WHERE "promotions"."id" = "promotion_assignments"."promotion_id"),
  'all'
);
