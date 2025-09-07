-- SQL script to update promotion tables data types
-- This script updates the schema to use BIGINT for all timestamp fields

-- Step 1: Update promotion_evaluations table
-- Add new BIGINT columns for timestamps
ALTER TABLE promotion_evaluations 
ADD COLUMN created_at_bigint BIGINT,
ADD COLUMN expires_at_bigint BIGINT;

-- Convert existing DateTime data to BIGINT (if any data exists)
UPDATE promotion_evaluations 
SET 
  created_at_bigint = EXTRACT(EPOCH FROM created_at)::BIGINT * 1000,
  expires_at_bigint = EXTRACT(EPOCH FROM expires_at)::BIGINT * 1000
WHERE created_at IS NOT NULL AND expires_at IS NOT NULL;

-- Drop the old DateTime columns
ALTER TABLE promotion_evaluations 
DROP COLUMN IF EXISTS created_at,
DROP COLUMN IF EXISTS expires_at;

-- Rename the new columns to the original names
ALTER TABLE promotion_evaluations 
RENAME COLUMN created_at_bigint TO created_at;

ALTER TABLE promotion_evaluations 
RENAME COLUMN expires_at_bigint TO expires_at;

-- Make the columns NOT NULL
ALTER TABLE promotion_evaluations 
ALTER COLUMN created_at SET NOT NULL,
ALTER COLUMN expires_at SET NOT NULL;

-- Step 2: Update promotion_redemptions table
-- Add new BIGINT column for redeemed_at
ALTER TABLE promotion_redemptions 
ADD COLUMN redeemed_at_bigint BIGINT;

-- Convert existing DateTime data to BIGINT (if any data exists)
UPDATE promotion_redemptions 
SET 
  redeemed_at_bigint = EXTRACT(EPOCH FROM redeemed_at)::BIGINT * 1000
WHERE redeemed_at IS NOT NULL;

-- Drop the old DateTime column
ALTER TABLE promotion_redemptions 
DROP COLUMN IF EXISTS redeemed_at;

-- Rename the new column to the original name
ALTER TABLE promotion_redemptions 
RENAME COLUMN redeemed_at_bigint TO redeemed_at;

-- Make the column NOT NULL
ALTER TABLE promotion_redemptions 
ALTER COLUMN redeemed_at SET NOT NULL;

-- Step 3: Recreate indexes for promotion_evaluations
DROP INDEX IF EXISTS idx_promotion_evaluations_user_created;
DROP INDEX IF EXISTS idx_promotion_evaluations_expires;

CREATE INDEX idx_promotion_evaluations_user_created
  ON promotion_evaluations (user_id, created_at);

CREATE INDEX idx_promotion_evaluations_expires
  ON promotion_evaluations (expires_at);

-- Step 4: Verify the changes
SELECT 'promotion_evaluations' as table_name, COUNT(*) as record_count FROM promotion_evaluations
UNION ALL
SELECT 'promotion_redemptions' as table_name, COUNT(*) as record_count FROM promotion_redemptions;

-- Show table structure
\d promotion_evaluations;
\d promotion_redemptions;
