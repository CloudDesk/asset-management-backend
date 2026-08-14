-- The legacy shared timestamp functions convert the India wall-clock time to
-- epoch seconds. That makes freshly-created users appear 5 hours 30 minutes
-- in the future and causes new-customer promotion checks to reject them.
--
-- Keep this correction scoped to users. Other tables still using the legacy
-- shared functions are intentionally not changed by this migration.

CREATE OR REPLACE FUNCTION public.set_user_epochcreateddate_utc()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.createddate := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_user_epochmodifieddate_utc()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.modifieddate := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT;
    RETURN NEW;
END;
$function$;

-- Backfill only when the users table is still connected to the known faulty
-- Asia/Kolkata trigger functions. The promotion form permits at most a
-- 365-day new-customer window, so limiting the correction to 366 days avoids
-- rewriting unrelated historical customer data.
DO $migration$
DECLARE
    uses_shifted_user_timestamp_trigger BOOLEAN := FALSE;
    current_epoch BIGINT := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT;
    india_offset_seconds CONSTANT BIGINT := 19800;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_trigger trigger_definition
        JOIN pg_class target_table
          ON target_table.oid = trigger_definition.tgrelid
        JOIN pg_namespace target_schema
          ON target_schema.oid = target_table.relnamespace
        JOIN pg_proc trigger_function
          ON trigger_function.oid = trigger_definition.tgfoid
        WHERE NOT trigger_definition.tgisinternal
          AND target_schema.nspname = 'public'
          AND target_table.relname = 'users'
          AND trigger_function.proname IN (
              'set_epochcreateddate',
              'set_epochmodifieddate'
          )
          AND pg_get_functiondef(trigger_function.oid) LIKE '%Asia/Kolkata%'
    ) INTO uses_shifted_user_timestamp_trigger;

    IF uses_shifted_user_timestamp_trigger THEN
        UPDATE public.users
        SET
            createddate = CASE
                WHEN createddate BETWEEN current_epoch - (366 * 86400) AND current_epoch + india_offset_seconds + 300
                    THEN createddate - india_offset_seconds
                ELSE createddate
            END,
            modifieddate = CASE
                WHEN modifieddate BETWEEN current_epoch - (366 * 86400) AND current_epoch + india_offset_seconds + 300
                    THEN modifieddate - india_offset_seconds
                ELSE modifieddate
            END
        WHERE
            createddate BETWEEN current_epoch - (366 * 86400) AND current_epoch + india_offset_seconds + 300
            OR modifieddate BETWEEN current_epoch - (366 * 86400) AND current_epoch + india_offset_seconds + 300;
    END IF;
END;
$migration$;

DROP TRIGGER IF EXISTS set_created_date_trigger_users ON public.users;
DROP TRIGGER IF EXISTS set_modified_date_trigger_users ON public.users;

CREATE TRIGGER set_created_date_trigger_users
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_user_epochcreateddate_utc();

CREATE TRIGGER set_modified_date_trigger_users
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_user_epochmodifieddate_utc();
