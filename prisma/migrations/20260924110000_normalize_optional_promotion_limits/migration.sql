-- NULL is the canonical representation for an unlimited optional constraint.
-- Preserve every positive limit explicitly configured by an administrator.
UPDATE "promotions"
SET "budget" = NULL
WHERE "budget" IS NOT NULL
  AND "budget" <= 0;

UPDATE "promotions"
SET "max_redemptions" = NULL
WHERE "max_redemptions" IS NOT NULL
  AND "max_redemptions" <= 0;

UPDATE "promotions"
SET "per_user_limit" = NULL
WHERE "per_user_limit" IS NOT NULL
  AND "per_user_limit" <= 0;

-- Older code automatically wrote this derived availability state. Promotion
-- availability is now calculated from live usage while configured status stays
-- under administrator control.
UPDATE "promotions"
SET "status" = 'active',
    "modifieddate" = CAST(EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000 AS BIGINT)
WHERE "status" = 'exhausted';
