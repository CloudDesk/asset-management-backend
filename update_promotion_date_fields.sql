-- Update promotion date fields to handle Unix timestamps (bigint) properly
-- This script safely updates existing date fields to Unix timestamp fields

-- Step 1: Drop existing timestamp columns if they exist (from previous attempts)
ALTER TABLE promotions DROP COLUMN IF EXISTS start_timestamp;
ALTER TABLE promotions DROP COLUMN IF EXISTS end_timestamp;

-- Step 2: Add new bigint columns for Unix timestamps
ALTER TABLE promotions ADD COLUMN start_timestamp BIGINT;
ALTER TABLE promotions ADD COLUMN end_timestamp BIGINT;

-- Step 3: Migrate existing data
-- Convert existing date fields to Unix timestamps (seconds since epoch)
UPDATE promotions 
SET 
  start_timestamp = CASE 
    WHEN start_date IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (start_date::text || ' 00:00:00')::timestamp)::bigint
    ELSE NULL 
  END,
  end_timestamp = CASE 
    WHEN end_date IS NOT NULL THEN 
      EXTRACT(EPOCH FROM (end_date::text || ' 23:59:59')::timestamp)::bigint
    ELSE NULL 
  END
WHERE start_date IS NOT NULL OR end_date IS NOT NULL;

-- Step 4: Drop old date columns (after confirming data migration)
ALTER TABLE promotions DROP COLUMN IF EXISTS start_date;
ALTER TABLE promotions DROP COLUMN IF EXISTS end_date;

-- Step 5: Rename new columns to original names
ALTER TABLE promotions RENAME COLUMN start_timestamp TO start_date;
ALTER TABLE promotions RENAME COLUMN end_timestamp TO end_date;

-- Show the updated table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'promotions' 
AND column_name IN ('start_date', 'end_date', 'start_timestamp', 'end_timestamp')
ORDER BY ordinal_position;
