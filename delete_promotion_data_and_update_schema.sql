-- Delete all promotion data and update schema to use BIGINT timestamps
-- This script handles foreign key constraints by deleting in the correct order

-- Step 1: Delete all records from promotion_redemptions first (child table)
DELETE FROM promotion_redemptions;

-- Step 2: Delete all records from promotion_evaluations (parent table)
DELETE FROM promotion_evaluations;

-- Step 3: Drop the existing indexes that reference the timestamp columns
DROP INDEX IF EXISTS idx_promotion_evaluations_user_created;
DROP INDEX IF EXISTS idx_promotion_evaluations_expires;

-- Step 4: Add new columns for BIGINT timestamps
ALTER TABLE promotion_evaluations 
ADD COLUMN created_at_bigint BIGINT,
ADD COLUMN expires_at_bigint BIGINT;

-- Step 5: Convert existing DateTime data to BIGINT (if any data exists)
-- This will populate the new columns with UTC timestamps as BIGINT
UPDATE promotion_evaluations 
SET 
  created_at_bigint = EXTRACT(EPOCH FROM created_at)::BIGINT * 1000,
  expires_at_bigint = EXTRACT(EPOCH FROM expires_at)::BIGINT * 1000
WHERE created_at IS NOT NULL AND expires_at IS NOT NULL;

-- Step 6: Drop the old DateTime columns
ALTER TABLE promotion_evaluations 
DROP COLUMN created_at,
DROP COLUMN expires_at;

-- Step 7: Rename the new columns to the original names
ALTER TABLE promotion_evaluations 
RENAME COLUMN created_at_bigint TO created_at;

ALTER TABLE promotion_evaluations 
RENAME COLUMN expires_at_bigint TO expires_at;

-- Step 8: Make the columns NOT NULL with appropriate defaults
ALTER TABLE promotion_evaluations 
ALTER COLUMN created_at SET NOT NULL,
ALTER COLUMN expires_at SET NOT NULL;

-- Step 9: Recreate the indexes with the new BIGINT columns
CREATE INDEX idx_promotion_evaluations_user_created
  ON promotion_evaluations (user_id, created_at);

CREATE INDEX idx_promotion_evaluations_expires
  ON promotion_evaluations (expires_at);

-- Step 10: Verify the table structure
\d promotion_evaluations;
