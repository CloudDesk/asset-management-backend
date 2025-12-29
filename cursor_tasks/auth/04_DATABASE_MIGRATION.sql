-- ============================================================================
-- Authentication Sessions Table - Database Migration Script
-- ============================================================================
-- Purpose: Create auth_sessions table for JWT refresh token management
-- Compatible with: PostgreSQL 13+
-- Created: December 2024
-- Last Updated: December 26, 2024
-- ============================================================================

-- ============================================================================
-- 1. CREATE TABLE: auth_sessions
-- ============================================================================
-- Stores refresh token sessions for both inventory and e-commerce users
-- Supports token rotation, revocation, and automatic cleanup
-- ============================================================================

CREATE TABLE auth_sessions (
    id SERIAL NOT NULL,
    "userId" integer NOT NULL,
    "userType" varchar(20) NOT NULL,
    "refreshTokenHash" text NOT NULL,
    "expiresAt" bigint NOT NULL,
    "isRevoked" boolean NOT NULL DEFAULT false,
    "ipAddress" varchar(45),
    "userAgent" text,
    createddate bigint,
    modifieddate bigint,
    PRIMARY KEY (id),
    CONSTRAINT auth_sessions_usertype_check CHECK (
        (
            ("userType")::text = ANY (
                (
                    ARRAY[
                        'inventory'::character varying,
                        'ecommerce'::character varying
                    ]
                )::text []
            )
        )
    )
);

-- ============================================================================
-- 2. CREATE INDEXES
-- ============================================================================
-- Optimized indexes for common query patterns
-- ============================================================================

CREATE INDEX auth_sessions_userid_usertype_idx ON public.auth_sessions USING btree ("userId", "userType");

CREATE INDEX auth_sessions_refreshtokenhash_idx ON public.auth_sessions USING btree ("refreshTokenHash");

CREATE INDEX auth_sessions_userid_usertype_isrevoked_idx ON public.auth_sessions USING btree (
    "userId",
    "userType",
    "isRevoked"
);

CREATE INDEX auth_sessions_expiresat_idx ON public.auth_sessions USING btree ("expiresAt");

CREATE INDEX auth_sessions_ipaddress_createddate_idx ON public.auth_sessions USING btree ("ipAddress", createddate);
-- ============================================================================
-- 3. CREATE TRIGGER FUNCTIONS
-- ============================================================================
-- Automatic timestamp management
-- ============================================================================

-- Function: Set createddate on INSERT
CREATE OR REPLACE FUNCTION public.set_auth_sessions_createddate()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF NEW."createddate" IS NULL THEN
        NEW."createddate" = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
    END IF;

    NEW."modifieddate" = NEW."createddate";
    RETURN NEW;
END;
$function$


-- Trigger: Auto-set createddate on INSERT

CREATE TRIGGER trigger_auth_sessions_createddate
BEFORE INSERT ON auth_sessions
FOR EACH ROW
EXECUTE FUNCTION set_auth_sessions_createddate();

-- Function: Update modifieddate on UPDATE
CREATE OR REPLACE FUNCTION public.update_auth_sessions_modifieddate()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW."modifieddate" = (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
    RETURN NEW;
END;
$function$


-- Trigger: Auto-update modifieddate on UPDATE

CREATE TRIGGER trigger_auth_sessions_modifieddate
BEFORE UPDATE ON auth_sessions
FOR EACH ROW
EXECUTE FUNCTION update_auth_sessions_modifieddate();

-- ============================================================================
-- 4. CLEANUP FUNCTION (Optional - for manual cleanup)
-- ============================================================================
-- Can be called manually or scheduled via pg_cron if available
-- Note: The application uses node-cron for automated cleanup
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_auth_sessions()
RETURNS TABLE (
    deleted_count INTEGER,
    cleanup_timestamp BIGINT
) AS $$
DECLARE
    v_deleted_count INTEGER;
    v_timestamp BIGINT;
BEGIN
    -- Get current timestamp
    v_timestamp := (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;
    
    -- Delete expired or old revoked sessions
    DELETE FROM auth_sessions 
    WHERE 
        -- Expired sessions
        expires_at < v_timestamp
        OR 
        -- Revoked sessions older than 30 days
        (is_revoked = true AND modifieddate < v_timestamp - (30 * 24 * 60 * 60 * 1000));
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Return results
    RETURN QUERY SELECT v_deleted_count, v_timestamp;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. USAGE EXAMPLES
-- ============================================================================

-- Example 1: Manual cleanup (if needed)
-- SELECT * FROM cleanup_expired_auth_sessions();

-- Example 2: Check active sessions for a user
-- SELECT * FROM auth_sessions
-- WHERE user_id = 123
--   AND user_type = 'inventory'
--   AND is_revoked = false
--   AND expires_at > (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT;

-- Example 3: Revoke all sessions for a user
-- UPDATE auth_sessions
-- SET is_revoked = true
-- WHERE user_id = 123 AND user_type = 'inventory';

-- Example 4: Count sessions by user type
-- SELECT user_type, COUNT(*) as session_count
-- FROM auth_sessions
-- WHERE is_revoked = false
-- GROUP BY user_type;

-- ============================================================================
-- END OF MIGRATION SCRIPT
-- ============================================================================