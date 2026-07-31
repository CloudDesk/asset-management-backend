-- One successful PhonePe transaction must map to at most one order.
--
-- Preserve historical rows while choosing the most advanced/latest order as
-- the canonical transaction-linked record. Older duplicates remain available
-- for audit, but no longer claim the gateway transaction ID.
WITH ranked_orders AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY merchanttransactionid
      ORDER BY
        CASE LOWER(COALESCE(orderstatus, ''))
          WHEN 'delivered' THEN 100
          WHEN 'out_for_delivery' THEN 90
          WHEN 'in_transit' THEN 80
          WHEN 'shipped' THEN 70
          WHEN 'ready_for_dispatch' THEN 60
          WHEN 'payment_completed' THEN 50
          WHEN 'order_confirmed' THEN 40
          ELSE 0
        END DESC,
        modifieddate DESC NULLS LAST,
        id DESC
    ) AS duplicate_rank
  FROM orders
  WHERE merchanttransactionid IS NOT NULL
    AND BTRIM(merchanttransactionid) <> ''
)
UPDATE orders AS duplicate_order
SET merchanttransactionid = NULL
FROM ranked_orders
WHERE duplicate_order.id = ranked_orders.id
  AND ranked_orders.duplicate_rank > 1;

UPDATE orders
SET merchanttransactionid = NULL
WHERE merchanttransactionid IS NOT NULL
  AND BTRIM(merchanttransactionid) = '';

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_orders_merchanttransactionid"
ON "orders"("merchanttransactionid");
