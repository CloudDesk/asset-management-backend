# PhonePe Orderline Discount Fix

This note consolidates the investigation, implementation, and verification steps for the orderline discount mismatch (issue `PHONEPE-ORDERLINE-001`).

---

## 1. Problem Statement

- Order headers displayed correct `orderamount`, `discountamount`, `promotion_discount_total`, and `original_total`.
- Orderlines always stored `promotion_discount_amount = 0` and `orderamount = productamount`.
- Result: sum of orderline amounts did not equal order totals; promotion data was missing in line items.

---

## 2. Root Causes

1. **Incomplete enrichment** – enrichment phase collected `product_discount_amount`, `promotion_discount_amount`, `shipping_cost`, but failed to recompute derived fields (`discountamount`, `orderamount`).
2. **Promotion breakdown gaps** – when `evaluationData.applied_promotions` lacked per-product breakdown, promotion discounts remained at 0 (no fallback).
3. **Orderline re-fetch** – the post-creation pass did not select monetary columns, leading to zero totals during redistribution.
4. **Rounding drift** – floating-point rounding caused ±₹0.01 diffs between order and orderlines.

---

## 3. Solution Overview

Implementation lives in `phonepe.controller.ts` (see `createOrderAfterPayment`). Key steps:

1. **Enrichment with recalculation**
   - Determine `original_price`, `product_discount_amount` from `evaluationData.cart_data`.
   - Determine `promotion_discount_amount` from `applied_promotions.breakdown`.
   - Apply **pro-rata fallback** when breakdown is missing (based on product amount weight).
   - Recalculate:
     ```text
     discountamount = product_discount_amount + promotion_discount_amount
     orderamount = productamount - promotion_discount_amount
     ```
   - Store enriched items in `orderItems` payload.

2. **Validation logging**
   - Aggregates totals and logs `validations.allValid` (within 0.01 tolerance).

3. **Service layer mapping**
   - `OrdersService.createOrderlinesFromOrderItems` maps enriched fields directly into DB columns.

4. **Post-create reconciliation**
   - Re-query orderlines including all monetary fields.
   - Distribute any residual rounding difference to the last orderline using `roundToTwo` helper to guarantee exact totals.

---

## 4. Validation Rules

### Per-orderline

```text
discountamount = product_discount_amount + promotion_discount_amount
orderamount = productamount - promotion_discount_amount
productamount = (original_price × quantity) - product_discount_amount
```

### Aggregation (Σ over orderlines)

```text
quantity = order.quantity
productamount = order.productamount
promotion_discount_amount = order.promotion_discount_total
discountamount = order.discountamount
orderamount = order.orderamount
shipping_cost = order.shipping_cost
productamount + product_discount_amount = order.original_total
```

All checks must pass within ±₹0.01. Larger diffs trigger `validations.allValid: false` in logs.

---

## 5. Verification Script

Use `sql/verify_orderline_fix.sql` (previously `verify_orderline_fix.sql`). Sample snippets:

```sql
-- Promotion discount alignment
SELECT
  o.id,
  o.promotion_discount_total AS order_promo,
  SUM(ol.promotion_discount_amount) AS line_promo,
  ABS(o.promotion_discount_total - SUM(ol.promotion_discount_amount)) AS diff
FROM orders o
JOIN orderline ol ON o.id = ol.orderid
WHERE o.id = $1
GROUP BY o.id;

-- Order amount alignment
SELECT
  o.id,
  o.orderamount AS order_total,
  SUM(ol.orderamount) AS line_total,
  ABS(o.orderamount - SUM(ol.orderamount)) AS diff
FROM orders o
JOIN orderline ol ON o.id = ol.orderid
WHERE o.id = $1
GROUP BY o.id;
```

`diff` must be `< 0.01` to pass.

---

## 6. Deployment & Testing Checklist

1. `npm run build` and redeploy backend.
2. Create a fresh PhonePe order (post-deploy) – older orders remain inconsistent.
3. Confirm logs show `Order items enrichment completed...` with `validations.allValid: true`.
4. Run SQL verification for the new order ID.
5. Monitor for any warnings in `Orderline promotion data mapping completed` log block.

---

## 7. Follow-up Tasks

| Task | Status |
| --- | --- |
| Unit tests for enrichment and rounding logic | Pending |
| Integration test covering pro-rata fallback | Pending |
| Alerting on `validations.allValid=false` occurrences | Pending |

---

## 8. Revision History

| Date | Change |
| --- | --- |
| 2025‑11‑05 | Consolidated investigation, fix, and runbook |
| 2025‑11‑04 | Rounding remainder distribution added |
| 2025‑11‑03 | Promotion pro-rata fallback implemented |


