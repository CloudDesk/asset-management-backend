-- Simple script to just delete all promotion data
-- Run this first to clear the foreign key constraint issues

-- Delete all records from promotion_redemptions first (child table)
DELETE FROM promotion_redemptions;

-- Delete all records from promotion_evaluations (parent table)  
DELETE FROM promotion_evaluations;

-- Verify deletion
SELECT 'promotion_evaluations' as table_name, COUNT(*) as record_count FROM promotion_evaluations
UNION ALL
SELECT 'promotion_redemptions' as table_name, COUNT(*) as record_count FROM promotion_redemptions;
