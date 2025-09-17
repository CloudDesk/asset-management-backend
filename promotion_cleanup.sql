-- Promotion Cleanup Script
-- 1. Check all fields exist
-- 2. Delete redundant fields (discount_type, discount_value)
-- 3. Update actions array [] to single object {}

-- Step 1: Check current table structure
SELECT 
  'Current table structure:' as info,
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'promotions' 
ORDER BY ordinal_position;

-- Step 2: Show current data count and sample
SELECT 
  'Current data:' as info,
  COUNT(*) as total_records
FROM promotions;

-- Show sample data before cleanup
SELECT 
  'Sample data before cleanup:' as info,
  id,
  name,
  type,
  discount_type,
  discount_value,
  actions
FROM promotions 
LIMIT 5;

-- Step 3: Add new action column (single object)
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS action JSONB;

-- Step 4: Convert actions array to single action object
UPDATE promotions 
SET action = CASE 
    WHEN actions IS NOT NULL AND jsonb_array_length(actions) > 0 THEN
        actions->0  -- Take first element from array: [{"type":"PERCENT_OFF","value":20}] -> {"type":"PERCENT_OFF","value":20}
    ELSE NULL
END
WHERE actions IS NOT NULL AND jsonb_array_length(actions) > 0;

-- Step 5: Show conversion results
SELECT 
  'Conversion results:' as info,
  COUNT(*) as total_promotions,
  COUNT(action) as converted_actions,
  COUNT(*) - COUNT(action) as null_actions
FROM promotions;

-- Step 6: Show sample converted data
SELECT 
  'Sample converted data:' as info,
  id,
  name,
  type,
  action
FROM promotions 
WHERE action IS NOT NULL
LIMIT 5;

-- Step 7: Delete redundant columns
ALTER TABLE promotions DROP COLUMN IF EXISTS discount_type;
ALTER TABLE promotions DROP COLUMN IF EXISTS discount_value;
ALTER TABLE promotions DROP COLUMN IF EXISTS actions;

-- Step 8: Final verification - show updated structure
SELECT 
  'Final table structure:' as info,
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'promotions' 
ORDER BY ordinal_position;

-- Step 9: Show final sample data
SELECT 
  'Final sample data:' as info,
  id,
  name,
  type,
  action
FROM promotions 
LIMIT 5;

-- Step 10: Summary
SELECT 
  'Cleanup Summary:' as info,
  '✅ Added action column (single object)' as step1,
  '✅ Converted actions[] to action{}' as step2,
  '✅ Deleted discount_type column' as step3,
  '✅ Deleted discount_value column' as step4,
  '✅ Deleted actions column' as step5;
