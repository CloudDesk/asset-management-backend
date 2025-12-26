-- ============================================================================
-- Auth Sessions Table - Prisma Compatible Migration
-- Run this if you prefer manual SQL execution instead of Prisma migrate
-- ============================================================================

-- Create auth_sessions table (Prisma compatible)
CREATE TABLE IF NOT EXISTS "auth_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" INTEGER NOT NULL,
    "userType" VARCHAR(20) NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(6) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "auth_sessions_userId_userType_idx" ON "auth_sessions"("userId", "userType");
CREATE INDEX IF NOT EXISTS "auth_sessions_refreshTokenHash_idx" ON "auth_sessions"("refreshTokenHash");
CREATE INDEX IF NOT EXISTS "auth_sessions_userId_userType_isRevoked_idx" ON "auth_sessions"("userId", "userType", "isRevoked");
CREATE INDEX IF NOT EXISTS "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");
CREATE INDEX IF NOT EXISTS "auth_sessions_ipAddress_createdAt_idx" ON "auth_sessions"("ipAddress", "createdAt");

-- Add check constraint for userType
ALTER TABLE "auth_sessions" 
ADD CONSTRAINT "auth_sessions_userType_check" 
CHECK ("userType" IN ('inventory', 'ecommerce'));

-- Trigger to auto-update updatedAt (compatible with Prisma)
CREATE OR REPLACE FUNCTION update_auth_sessions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_auth_sessions_timestamp_trigger
    BEFORE UPDATE ON "auth_sessions"
    FOR EACH ROW
    EXECUTE FUNCTION update_auth_sessions_timestamp();

-- Verification
SELECT 'Auth sessions table created successfully!' AS status;

-- Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns
WHERE table_name = 'auth_sessions'
ORDER BY ordinal_position;
