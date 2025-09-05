-- Migration: Add promotion_id and other fields to promotion_evaluations table
-- This enables individual promotion tracking instead of JSON arrays

-- Step 1: Add new columns
ALTER TABLE promotion_evaluations 
ADD COLUMN promotion_id INTEGER,
ADD COLUMN total_discount DECIMAL(10,2),
ADD COLUMN discount_breakdown JSON;

-- Step 2: Add foreign key constraint
ALTER TABLE promotion_evaluations 
ADD CONSTRAINT fk_promotion_evaluations_promotion_id 
FOREIGN KEY (promotion_id) REFERENCES promotions(id);

-- Step 3: Add index for better query performance
CREATE INDEX idx_promotion_evaluations_promotion_id ON promotion_evaluations(promotion_id);

-- Step 4: Update existing records (if any) to extract promotion_id from applied_promotions JSON
-- This is a one-time migration for existing data
UPDATE promotion_evaluations 
SET promotion_id = (applied_promotions->0->>'promotion_id')::INTEGER,
    total_discount = (applied_promotions->0->>'discount_amount')::DECIMAL(10,2)
WHERE applied_promotions IS NOT NULL 
  AND jsonb_array_length(applied_promotions) > 0
  AND applied_promotions->0->>'promotion_id' IS NOT NULL;

-- Step 5: Verify the migration
SELECT 
  evaluation_id,
  user_id,
  promotion_id,
  original_total,
  discounted_total,
  total_discount,
  status,
  created_at
FROM promotion_evaluations 
WHERE promotion_id IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Step 6: Show summary of updated records
SELECT 
  COUNT(*) as total_evaluations,
  COUNT(promotion_id) as evaluations_with_promotion_id,
  COUNT(*) - COUNT(promotion_id) as evaluations_without_promotion_id
FROM promotion_evaluations;
