-- Epoch values represent absolute instants and must not be adjusted for a
-- display timezone. The legacy shared triggers converted the India wall clock
-- to epoch seconds, shifting promotion timestamps forward by 05:30 and making
-- checkout validation believe a promotion changed after its evaluation.

CREATE OR REPLACE FUNCTION public.set_promotion_epochcreateddate_utc()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
    NEW.createddate := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_promotion_epochmodifieddate_utc()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
    NEW.modifieddate := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT;
    RETURN NEW;
END;
$function$;

-- Remove the faulty triggers before repairing rows. Otherwise either the
-- legacy trigger or its replacement would overwrite the historical value
-- during the repair UPDATE.
DROP TRIGGER IF EXISTS set_created_date_trigger_promotions ON public.promotions;
DROP TRIGGER IF EXISTS set_modified_date_trigger_promotions ON public.promotions;

-- Repair only timestamps that are demonstrably in the legacy +05:30 future
-- window. This fixes active SIT promotions without rewriting valid history.
DO $migration$
DECLARE
    current_epoch BIGINT := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT;
    india_offset_seconds CONSTANT BIGINT := 19800;
    allowed_clock_skew_seconds CONSTANT BIGINT := 300;
BEGIN
    UPDATE public.promotions
    SET
        createddate = CASE
            WHEN createddate > current_epoch + allowed_clock_skew_seconds
             AND createddate <= current_epoch + india_offset_seconds + allowed_clock_skew_seconds
                THEN createddate - india_offset_seconds
            ELSE createddate
        END,
        modifieddate = CASE
            WHEN modifieddate > current_epoch + allowed_clock_skew_seconds
             AND modifieddate <= current_epoch + india_offset_seconds + allowed_clock_skew_seconds
                THEN modifieddate - india_offset_seconds
            ELSE modifieddate
        END
    WHERE
        createddate > current_epoch + allowed_clock_skew_seconds
        OR modifieddate > current_epoch + allowed_clock_skew_seconds;
END;
$migration$;

-- Evaluations created before a corrected promotion timestamp are stale by
-- definition. Cancel only those affected evaluations so the storefront will
-- generate a fresh one instead of presenting a one-time validation warning.
UPDATE public.promotion_evaluations evaluation
SET
    status = 'cancelled',
    modifieddate = FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT
WHERE evaluation.status = 'active'
  AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
          COALESCE(evaluation.applied_promotions, '[]'::jsonb)
      ) applied
      JOIN public.promotions promotion
        ON promotion.id = CASE
            WHEN applied ->> 'promotion_id' ~ '^[0-9]+$'
                THEN (applied ->> 'promotion_id')::INTEGER
            ELSE NULL
        END
      WHERE evaluation.created_at < promotion.modifieddate * 1000
  );

CREATE TRIGGER set_created_date_trigger_promotions
BEFORE INSERT ON public.promotions FOR EACH ROW
EXECUTE FUNCTION public.set_promotion_epochcreateddate_utc();

CREATE TRIGGER set_modified_date_trigger_promotions
BEFORE INSERT OR UPDATE ON public.promotions FOR EACH ROW
EXECUTE FUNCTION public.set_promotion_epochmodifieddate_utc();
