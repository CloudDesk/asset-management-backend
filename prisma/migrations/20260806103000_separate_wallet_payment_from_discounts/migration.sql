-- Wallet credit settles part of an order; it does not reduce product value.
-- Historical wallet orders stored product/promotion discounts plus the wallet
-- allocation in discountamount. Keep wallet_discount_total as the legacy
-- persisted wallet allocation field, but remove it from the discount total.

UPDATE public.orders
SET discountamount = GREATEST(
    0,
    COALESCE(discountamount, 0) - COALESCE(wallet_discount_total, 0)
)
WHERE COALESCE(wallet_discount_total, 0) > 0;
