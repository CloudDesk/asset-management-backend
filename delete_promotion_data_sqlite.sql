-- SQLite script to delete all promotion data and update schema
-- This script handles foreign key constraints by deleting in the correct order

-- Step 1: Delete all records from promotion_redemptions first (child table)
DELETE FROM promotion_redemptions;

-- Step 2: Delete all records from promotion_evaluations (parent table)
DELETE FROM promotion_evaluations;

-- Step 3: Drop the existing indexes that reference the timestamp columns
DROP INDEX IF EXISTS idx_promotion_evaluations_user_created;
DROP INDEX IF EXISTS idx_promotion_evaluations_expires;

-- Step 4: Create new table with BIGINT timestamps
CREATE TABLE promotion_evaluations_new (
  evaluation_id      VARCHAR(36) PRIMARY KEY,
  user_id            TEXT,
  cart_data          JSON,
  original_total     DECIMAL(10, 2),
  discounted_total   DECIMAL(10, 2),
  applied_promotions JSON,
  ineligible_coupons JSON,
  context            JSON, -- channel, geo, payment_method
  created_at         BIGINT NOT NULL,
  expires_at         BIGINT NOT NULL,
  status             VARCHAR(50) DEFAULT 'active',
  createddate        BIGINT,
  modifieddate       BIGINT
);

-- Step 5: Copy any existing data (if any) with timestamp conversion
INSERT INTO promotion_evaluations_new 
SELECT 
  evaluation_id,
  user_id,
  cart_data,
  original_total,
  discounted_total,
  applied_promotions,
  ineligible_coupons,
  context,
  CAST(strftime('%s', created_at) AS INTEGER) * 1000 as created_at,
  CAST(strftime('%s', expires_at) AS INTEGER) * 1000 as expires_at,
  status,
  createddate,
  modifieddate
FROM promotion_evaluations;

-- Step 6: Drop the old table
DROP TABLE promotion_evaluations;

-- Step 7: Rename the new table
ALTER TABLE promotion_evaluations_new RENAME TO promotion_evaluations;

-- Step 8: Recreate the indexes
CREATE INDEX idx_promotion_evaluations_user_created
  ON promotion_evaluations (user_id, created_at);

CREATE INDEX idx_promotion_evaluations_expires
  ON promotion_evaluations (expires_at);

-- Step 9: Verify the table structure
.schema promotion_evaluations

-- Step 10: Check record counts
SELECT 'promotion_evaluations' as table_name, COUNT(*) as record_count FROM promotion_evaluations
UNION ALL
SELECT 'promotion_redemptions' as table_name, COUNT(*) as record_count FROM promotion_redemptions;
