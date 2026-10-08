-- Lifecycle timestamps are absolute instants. The legacy status triggers
-- converted the India wall clock to epoch seconds, shifting every value
-- 19,800 seconds into the future. They also rewrote orderline dates on any
-- later update while the line remained in the same status.

CREATE OR REPLACE FUNCTION public.update_order_status_date()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
    IF NEW.orderstatus = 'delivered' THEN
        NEW.delivereddate := COALESCE(
            CASE WHEN ABS(NEW.delivereddate) >= 100000000000
                THEN FLOOR(NEW.delivereddate / 1000.0)::BIGINT
                ELSE NEW.delivereddate
            END,
            FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT
        );
    ELSIF NEW.orderstatus = 'ready_to_dispatch' OR NEW.orderstatus = 'ready_for_dispatch' THEN
        NEW.readytodispatchdate := COALESCE(
            CASE WHEN ABS(NEW.readytodispatchdate) >= 100000000000
                THEN FLOOR(NEW.readytodispatchdate / 1000.0)::BIGINT
                ELSE NEW.readytodispatchdate
            END,
            FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT
        );
    ELSIF NEW.orderstatus = 'cancelled' THEN
        NEW.cancelleddate := COALESCE(
            CASE WHEN ABS(NEW.cancelleddate) >= 100000000000
                THEN FLOOR(NEW.cancelleddate / 1000.0)::BIGINT
                ELSE NEW.cancelleddate
            END,
            FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT
        );
    ELSIF NEW.orderstatus = 'returned' THEN
        NEW.returneddate := COALESCE(
            CASE WHEN ABS(NEW.returneddate) >= 100000000000
                THEN FLOOR(NEW.returneddate / 1000.0)::BIGINT
                ELSE NEW.returneddate
            END,
            FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT
        );
    ELSIF NEW.orderstatus = 'dispatched' THEN
        NEW.dispatcheddate := COALESCE(
            CASE WHEN ABS(NEW.dispatcheddate) >= 100000000000
                THEN FLOOR(NEW.dispatcheddate / 1000.0)::BIGINT
                ELSE NEW.dispatcheddate
            END,
            FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT
        );
    ELSIF NEW.orderstatus = 'payment_failed' THEN
        NEW.paymentfaileddate := COALESCE(
            CASE WHEN ABS(NEW.paymentfaileddate) >= 100000000000
                THEN FLOOR(NEW.paymentfaileddate / 1000.0)::BIGINT
                ELSE NEW.paymentfaileddate
            END,
            FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT
        );
    END IF;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_orderline_orderstatus_date()
RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
    IF OLD.orderstatus IS NOT DISTINCT FROM NEW.orderstatus THEN
        RETURN NEW;
    END IF;

    IF NEW.orderstatus = 'delivered' THEN
        NEW.delivereddate := COALESCE(
            CASE WHEN ABS(NEW.delivereddate) >= 100000000000
                THEN FLOOR(NEW.delivereddate / 1000.0)::BIGINT
                ELSE NEW.delivereddate
            END,
            FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT
        );
    ELSIF NEW.orderstatus = 'ready_to_dispatch' OR NEW.orderstatus = 'ready_for_dispatch' THEN
        NEW.readytodispatchdate := COALESCE(
            CASE WHEN ABS(NEW.readytodispatchdate) >= 100000000000
                THEN FLOOR(NEW.readytodispatchdate / 1000.0)::BIGINT
                ELSE NEW.readytodispatchdate
            END,
            FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT
        );
    ELSIF NEW.orderstatus = 'cancelled' THEN
        NEW.cancelleddate := COALESCE(
            CASE WHEN ABS(NEW.cancelleddate) >= 100000000000
                THEN FLOOR(NEW.cancelleddate / 1000.0)::BIGINT
                ELSE NEW.cancelleddate
            END,
            FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT
        );
    ELSIF NEW.orderstatus = 'returned' THEN
        NEW.returneddate := COALESCE(
            CASE WHEN ABS(NEW.returneddate) >= 100000000000
                THEN FLOOR(NEW.returneddate / 1000.0)::BIGINT
                ELSE NEW.returneddate
            END,
            FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT
        );
    ELSIF NEW.orderstatus = 'dispatched' THEN
        NEW.dispatcheddate := COALESCE(
            CASE WHEN ABS(NEW.dispatcheddate) >= 100000000000
                THEN FLOOR(NEW.dispatcheddate / 1000.0)::BIGINT
                ELSE NEW.dispatcheddate
            END,
            FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT
        );
    ELSIF NEW.orderstatus = 'ordered' THEN
        NEW.ordereddate := COALESCE(
            CASE WHEN ABS(NEW.ordereddate) >= 100000000000
                THEN FLOOR(NEW.ordereddate / 1000.0)::BIGINT
                ELSE NEW.ordereddate
            END,
            FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT
        );
    ELSIF NEW.orderstatus = 'payment_failed' THEN
        NEW.paymentfaileddate := COALESCE(
            CASE WHEN ABS(NEW.paymentfaileddate) >= 100000000000
                THEN FLOOR(NEW.paymentfaileddate / 1000.0)::BIGINT
                ELSE NEW.paymentfaileddate
            END,
            FLOOR(EXTRACT(EPOCH FROM clock_timestamp()))::BIGINT
        );
    END IF;
    RETURN NEW;
END;
$function$;

-- Repair delivered dates only where status history independently proves the
-- exact legacy +05:30 offset. Preserve modifieddate audit values while doing
-- the one-time correction.
ALTER TABLE public.orders DISABLE TRIGGER set_modified_date_trigger_orders;
ALTER TABLE public.orderline DISABLE TRIGGER set_modified_date_trigger_orderline;

UPDATE public.orders target
SET delivereddate = target.delivereddate - 19800
WHERE target.delivereddate IS NOT NULL
  AND jsonb_typeof(target.status_history) = 'array'
  AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(target.status_history) entry
      WHERE LOWER(entry ->> 'new_status') = 'delivered'
        AND target.delivereddate - CASE
            WHEN ABS((entry ->> 'changed_date')::NUMERIC) >= 100000000000
              THEN FLOOR((entry ->> 'changed_date')::NUMERIC / 1000)::BIGINT
            ELSE FLOOR((entry ->> 'changed_date')::NUMERIC)::BIGINT
          END BETWEEN 19700 AND 19900
  );

UPDATE public.orderline target
SET delivereddate = target.delivereddate - 19800
WHERE target.delivereddate IS NOT NULL
  AND jsonb_typeof(target.status_history) = 'array'
  AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(target.status_history) entry
      WHERE LOWER(entry ->> 'new_status') = 'delivered'
        AND target.delivereddate - CASE
            WHEN ABS((entry ->> 'changed_date')::NUMERIC) >= 100000000000
              THEN FLOOR((entry ->> 'changed_date')::NUMERIC / 1000)::BIGINT
            ELSE FLOOR((entry ->> 'changed_date')::NUMERIC)::BIGINT
          END BETWEEN 19700 AND 19900
  );

-- Some older lines have no usable status history. Their parent order does,
-- so after correcting the parent the same offset is independently visible
-- between the line and order delivery timestamps.
UPDATE public.orderline target
SET delivereddate = target.delivereddate - 19800
FROM public.orders parent
WHERE target.orderid = parent.id
  AND target.delivereddate IS NOT NULL
  AND parent.delivereddate IS NOT NULL
  AND LOWER(COALESCE(target.orderstatus, '')) IN ('delivered', 'cod_payment_received')
  AND target.delivereddate - parent.delivereddate BETWEEN 19700 AND 19900;

ALTER TABLE public.orders ENABLE TRIGGER set_modified_date_trigger_orders;
ALTER TABLE public.orderline ENABLE TRIGGER set_modified_date_trigger_orderline;
