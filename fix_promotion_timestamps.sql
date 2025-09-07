-- Fix promotion evaluation and redemption timestamps to use BIGINT
-- This script updates the services to use UTC timestamps in milliseconds

-- First, let's check current data types
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name IN ('promotion_evaluations', 'promotion_redemptions')
AND column_name IN ('created_at', 'expires_at', 'redeemed_at')
ORDER BY table_name, column_name;
