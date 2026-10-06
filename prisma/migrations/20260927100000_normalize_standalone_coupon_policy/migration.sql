-- Standalone Coupon Wallet coupons are customer-assigned instruments that can
-- be claimed from either Ecom Web or Mobile. Channel and generic promotion
-- stacking are backend-owned policy, not Admin configuration.

UPDATE "promotion_assignments" AS assignment
SET "delivery_channel" = 'all'
FROM "promotions" AS promotion
WHERE assignment."promotion_id" = promotion."id"
  AND promotion."visibility" = 'private'
  AND promotion."description" LIKE 'Private discount rule created for coupon %'
  AND assignment."delivery_channel" IS DISTINCT FROM 'all';

UPDATE "promotions"
SET
  "applicable_channel" = 'all',
  "stackable" = false
WHERE "visibility" = 'private'
  AND "description" LIKE 'Private discount rule created for coupon %'
  AND (
    "applicable_channel" IS DISTINCT FROM 'all'
    OR "stackable" IS DISTINCT FROM false
  );
