-- Migration: Remove deprecated sessiontoken column from inventoryusers table
-- Date: 2026-01-06
-- Reason: Session management now handled by auth_sessions table
--         The sessiontoken field is no longer used in the application
--         Note: resettoken and resettokenexpires are kept for password reset functionality

-- Remove sessiontoken column (deprecated - session management in auth_sessions table)
ALTER TABLE inventoryusers DROP COLUMN IF EXISTS sessiontoken;

-- Note: This is a safe operation as:
-- 1. sessiontoken: No longer read, verified, set, or cleared in the application
-- 2. Session management is fully handled by auth_sessions table
-- 3. resettoken and resettokenexpires are kept for password reset functionality


ALTER TABLE orders
ADD COLUMN shipment_tracking_status VARCHAR(500);

