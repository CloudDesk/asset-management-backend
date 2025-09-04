-- Add missing fields to existing promotions table
-- This script safely adds new fields without deleting existing data

-- Add description field
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS description TEXT;

-- Add budget field
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS budget DECIMAL(10,2);

-- Add timezone field
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS timezone VARCHAR(50);

-- Add evaluation_expiry_minutes field
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS evaluation_expiry_minutes INTEGER DEFAULT 15;

-- Add discount_type field
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS discount_type VARCHAR(50);

-- Add discount_value field
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10,2);

-- Add conditions field (JSON)
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS conditions JSONB;

-- Add actions field (JSON)
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS actions JSONB;

-- Add is_active field
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Show the updated table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'promotions' 
ORDER BY ordinal_position;
