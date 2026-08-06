-- Epoch values must represent an absolute UTC instant. The legacy shared
-- triggers first converted the clock to Asia/Kolkata and then extracted an
-- epoch, shifting persisted order timestamps forward by 05:30.

CREATE OR REPLACE FUNCTION public.set_order_epochcreateddate_utc()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
    NEW.createddate := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_order_epochmodifieddate_utc()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
    NEW.modifieddate := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_orderline_epochcreateddate_utc()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
    NEW.createddate := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_orderline_epochmodifieddate_utc()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
    NEW.modifieddate := FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT;
    RETURN NEW;
END;
$function$;

-- A status-history entry is written by the application using Date.now(). Use
-- it as an independent reference and only backfill rows whose stored creation
-- time is demonstrably about 19,800 seconds ahead. This avoids touching valid
-- legacy/imported records.
WITH shifted_orders AS (
    SELECT id
    FROM public.orders
    WHERE jsonb_typeof(status_history) = 'array'
      AND jsonb_array_length(status_history) > 0
      AND createddate - FLOOR(((status_history -> 0 ->> 'changed_date')::NUMERIC) / 1000)::BIGINT
          BETWEEN 19700 AND 19900
)
UPDATE public.orderline line
SET
    createddate = line.createddate - 19800,
    modifieddate = line.modifieddate - 19800
FROM shifted_orders shifted
WHERE line.orderid = shifted.id;

UPDATE public.orders
SET
    createddate = createddate - 19800,
    modifieddate = modifieddate - 19800
WHERE jsonb_typeof(status_history) = 'array'
  AND jsonb_array_length(status_history) > 0
  AND createddate - FLOOR(((status_history -> 0 ->> 'changed_date')::NUMERIC) / 1000)::BIGINT
      BETWEEN 19700 AND 19900;

DROP TRIGGER IF EXISTS set_created_date_trigger_orders ON public.orders;
DROP TRIGGER IF EXISTS set_modified_date_trigger_orders ON public.orders;
DROP TRIGGER IF EXISTS set_created_date_trigger_orderline ON public.orderline;
DROP TRIGGER IF EXISTS set_modified_date_trigger_orderline ON public.orderline;

CREATE TRIGGER set_created_date_trigger_orders
BEFORE INSERT ON public.orders FOR EACH ROW
EXECUTE FUNCTION public.set_order_epochcreateddate_utc();

CREATE TRIGGER set_modified_date_trigger_orders
BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW
EXECUTE FUNCTION public.set_order_epochmodifieddate_utc();

CREATE TRIGGER set_created_date_trigger_orderline
BEFORE INSERT ON public.orderline FOR EACH ROW
EXECUTE FUNCTION public.set_orderline_epochcreateddate_utc();

CREATE TRIGGER set_modified_date_trigger_orderline
BEFORE INSERT OR UPDATE ON public.orderline FOR EACH ROW
EXECUTE FUNCTION public.set_orderline_epochmodifieddate_utc();
