-- ============================================
-- Orderline Discount Fix Verification Script
-- ============================================
-- Run this AFTER creating a new PhonePe order with promotions
-- ============================================

-- Step 1: Find the most recent order with promotions
SELECT 
    o.id AS order_id,
    o.orderid AS order_display_id,
    o.merchanttransactionid,
    o.orderamount,
    o.productamount,
    o.discountamount,
    o.promotion_discount_total,
    o.original_total,
    o.quantity,
    o.createddate,
    o.mode
FROM orders o
WHERE o.promotion_discount_total > 0
ORDER BY o.createddate DESC
LIMIT 5;

-- ============================================
-- Step 2: Check orderlines for the most recent order
-- Replace [ORDER_ID] with the id from Step 1
-- ============================================

-- Example: Check order 141 (your current order)
SELECT 
    ol.id,
    ol.orderid,
    ol.productid,
    ol.productname,
    ol.quantity,
    ol.productamount,
    ol.product_discount_amount,
    ol.promotion_discount_amount,
    ol.discountamount,
    ol.orderamount,
    ol.shipping_cost,
    ol.original_price,
    -- Validation checks
    (ol.product_discount_amount + ol.promotion_discount_amount) AS calculated_discountamount,
    ABS(ol.discountamount - (ol.product_discount_amount + ol.promotion_discount_amount)) AS discount_diff,
    (ol.productamount - ol.promotion_discount_amount) AS calculated_orderamount,
    ABS(ol.orderamount - (ol.productamount - ol.promotion_discount_amount)) AS orderamount_diff
FROM orderline ol
WHERE ol.orderid = 142  -- Replace with your order ID
ORDER BY ol.productid;

-- ============================================
-- Step 3: Verify totals match between order and orderlines
-- Replace [ORDER_ID] with the id from Step 1
-- ============================================

SELECT 
    'Order Level' AS level,
    o.id AS order_id,
    o.quantity AS total_quantity,
    o.productamount AS total_productamount,
    o.promotion_discount_total AS total_promotion_discount,
    o.discountamount AS total_discountamount,
    o.orderamount AS total_orderamount,
    o.shipping_cost AS total_shipping
FROM orders o
WHERE o.id = 142

UNION ALL

SELECT 
    'Orderlines Sum' AS level,
    ol.orderid AS order_id,
    SUM(ol.quantity) AS total_quantity,
    SUM(ol.productamount) AS total_productamount,
    SUM(ol.promotion_discount_amount) AS total_promotion_discount,
    SUM(ol.discountamount) AS total_discountamount,
    SUM(ol.orderamount) AS total_orderamount,
    SUM(ol.shipping_cost) AS total_shipping
FROM orderline ol
WHERE ol.orderid = 142
GROUP BY ol.orderid;

-- ============================================
-- Step 4: Check for any mismatches (SHOULD BE EMPTY after fix)
-- ============================================

SELECT 
    o.id AS order_id,
    o.orderid AS display_id,
    o.merchanttransactionid,
    o.promotion_discount_total AS order_promotion,
    SUM(ol.promotion_discount_amount) AS sum_orderline_promotion,
    ABS(o.promotion_discount_total - COALESCE(SUM(ol.promotion_discount_amount), 0)) AS promotion_diff,
    o.orderamount AS order_amount,
    SUM(ol.orderamount) AS sum_orderline_amount,
    ABS(o.orderamount - COALESCE(SUM(ol.orderamount), 0)) AS orderamount_diff,
    CASE 
        WHEN ABS(o.promotion_discount_total - COALESCE(SUM(ol.promotion_discount_amount), 0)) < 0.01 THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS promotion_check,
    CASE 
        WHEN ABS(o.orderamount - COALESCE(SUM(ol.orderamount), 0)) < 0.01 THEN '✅ PASS'
        ELSE '❌ FAIL'
    END AS orderamount_check
FROM orders o
LEFT JOIN orderline ol ON o.id = ol.orderid
WHERE o.id = 142  -- Replace with your order ID
GROUP BY o.id, o.orderid, o.merchanttransactionid, o.promotion_discount_total, o.orderamount;

-- ============================================
-- Expected Results AFTER FIX:
-- ============================================
-- Step 2: Each orderline should have:
--   - promotion_discount_amount > 0 (if order has promotion)
--   - discount_diff < 0.01
--   - orderamount_diff < 0.01
--
-- Step 3: Both rows should have matching values
--
-- Step 4: Both checks should show ✅ PASS
-- ============================================

