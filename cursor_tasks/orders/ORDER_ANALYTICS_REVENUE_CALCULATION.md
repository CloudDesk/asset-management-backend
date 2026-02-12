# Order Analytics - Revenue Calculation Logic

**Version 1.0** — December 2024  
*Revenue calculation with cancellation and refund handling*

---

## 📊 Revenue Calculation Overview

The `/v1/analytics/orders` endpoint calculates revenue by **excluding all cancelled and refunded orders** to provide accurate business metrics.

---

## 💰 Total Revenue Calculation

### ⚠️ Important: How Revenue is Calculated

**`total_revenue` is NOT calculated as "Gross Revenue - Cancelled Revenue"**

Instead, `total_revenue` is calculated by **directly excluding cancelled orders from the database query**. This means:

1. **Database Query Level Exclusion:**
   - Query filters out cancelled orders using `orderstatus: { notIn: excludedRevenueStatuses }`
   - Only non-cancelled orders are summed
   - This is more efficient and accurate

2. **Independent Calculation:**
   - `total_revenue` = Sum of order amounts (excluding cancelled orders)
   - `cancelled_revenue` = Sum of cancelled order amounts (calculated separately)
   - `gross_revenue` = `total_revenue + cancelled_revenue` (for reference)

3. **Why This Approach:**
   - ✅ More accurate (no risk of calculation errors)
   - ✅ More efficient (database does the filtering)
   - ✅ Handles edge cases better (null values, etc.)

### Excluded Statuses (NOT counted as revenue)

Based on `ORDER_CANCELLATION_FLOW.md`, the following statuses are **excluded** from revenue:

| Status | Reason | Money Status |
|--------|--------|--------------|
| `cancelled` | Order cancelled, awaiting refund | Will be refunded |
| `cancelled_refund_processing` | Refund in progress | Being returned |
| `cancelled_refunded` | Refund completed | Money returned ✅ |
| `cancelled_completed` | COD cancellation complete | No payment collected |
| `payment_failed` | Payment never succeeded | No money received |
| `partially_cancelled` | Some items cancelled | Partial refund |

### Included Statuses (COUNTED as revenue)

All other statuses are **included** in revenue:

- `order_placed`
- `payment_completed` ✅
- `order_confirmed` ✅
- `packed` ✅
- `ready_for_dispatch` ✅
- `shipped` ✅
- `in_transit` ✅
- `out_for_delivery` ✅
- `delivered` ✅
- `cod_payment_received` ✅
- `return_initiated` ✅ (Money not yet returned)
- `returned` ⚠️ (Consider excluding if refunded)
- `rto_initiated` ✅
- `rto_delivered` ✅

---

## 🔄 Cancellation Flow Impact on Revenue

### Scenario 1: PhonePe Order Cancellation

```
Order Created: payment_completed
  → Revenue: ₹1000 ✅ (INCLUDED)

Customer Cancels:
  → Status: cancelled
  → Revenue: ₹0 ❌ (EXCLUDED - will be refunded)

Admin Starts Refund:
  → Status: cancelled_refund_processing
  → Revenue: ₹0 ❌ (EXCLUDED - refund in progress)

Admin Completes Refund:
  → Status: cancelled_refunded
  → Revenue: ₹0 ❌ (EXCLUDED - money returned)
```

**Revenue Timeline:**
- **Before Cancellation:** ₹1000 counted
- **After Cancellation:** ₹0 counted (excluded)
- **Net Revenue Impact:** -₹1000

---

### Scenario 2: COD Order Cancellation

```
Order Created: order_confirmed
  → Revenue: ₹1000 ✅ (INCLUDED - payment pending)

Customer Cancels:
  → Status: cancelled
  → Revenue: ₹0 ❌ (EXCLUDED - no payment collected)

Auto-Complete:
  → Status: cancelled_completed
  → Revenue: ₹0 ❌ (EXCLUDED - no payment collected)
```

**Revenue Timeline:**
- **Before Cancellation:** ₹1000 counted (pending payment)
- **After Cancellation:** ₹0 counted (excluded)
- **Net Revenue Impact:** -₹1000

---

### Scenario 3: Payment Failed Order

```
Order Initiated: order_placed
  → Revenue: ₹0 ❌ (EXCLUDED - payment failed)

Payment Fails:
  → Status: payment_failed
  → Revenue: ₹0 ❌ (EXCLUDED - no money received)
```

**Revenue Timeline:**
- **Never counted:** ₹0 (payment never succeeded)

---

## 📈 Analytics Metrics Explained

### Overview Metrics

```json
{
  "overview": {
    "total_orders": 150,              // All orders (including cancelled)
    "total_revenue": 125000.50,       // Revenue from non-cancelled orders
    "average_order_value": 833.34,    // Average of non-cancelled orders
    "delivered_orders": 120,
    "cancelled_orders": 10,           // All cancellation statuses combined
    "returned_orders": 5,
    "refunded_orders": 8,             // Orders with refund completed
    "refund_processing_orders": 2,    // Orders with refund in progress
    "cancelled_revenue": 8500.00,     // Revenue lost due to cancellations
    "conversion_rate": "80.00%",
    "cancellation_rate": "6.67%",
    "return_rate": "3.33%",
    "refund_rate": "5.33%"
  }
}
```

### Key Metrics

1. **`total_revenue`**: 
   - Sum of `orderamount` for orders **NOT** in excluded statuses
   - Represents actual revenue (money kept, not refunded)

2. **`cancelled_revenue`**: 
   - Sum of `orderamount` for all cancelled orders
   - Represents revenue lost due to cancellations
   - Useful for understanding cancellation impact

3. **`refunded_orders`**: 
   - Count of orders with `cancelled_refunded` status
   - Money has been returned to customer

4. **`refund_processing_orders`**: 
   - Count of orders with `cancelled_refund_processing` status
   - Refund is being processed (money will be returned)

---

## 🧮 Revenue Calculation Examples

### Example 1: Mixed Order Statuses

```
Orders:
- Order 1: delivered, ₹1000
- Order 2: shipped, ₹500
- Order 3: cancelled, ₹300
- Order 4: cancelled_refunded, ₹200
- Order 5: payment_failed, ₹150

Total Revenue Calculation (Database Query):
✅ Order 1: ₹1000 (delivered - INCLUDED in query)
✅ Order 2: ₹500 (shipped - INCLUDED in query)
❌ Order 3: ₹0 (cancelled - EXCLUDED from query)
❌ Order 4: ₹0 (cancelled_refunded - EXCLUDED from query)
❌ Order 5: ₹0 (payment_failed - EXCLUDED from query)

Query Result: SUM(₹1000 + ₹500) = ₹1500

Cancelled Revenue Calculation (Separate Query):
❌ Order 3: ₹300 (cancelled)
❌ Order 4: ₹200 (cancelled_refunded)
Sum: ₹500

Final Metrics:
- total_revenue: ₹1500 (calculated by excluding cancelled from query)
- cancelled_revenue: ₹500 (calculated separately)
- gross_revenue: ₹2000 (₹1500 + ₹500)
```

---

### Example 2: Refund Processing

```
Orders:
- Order 1: delivered, ₹1000
- Order 2: cancelled_refund_processing, ₹500
- Order 3: cancelled_refunded, ₹300

Total Revenue Calculation:
✅ Order 1: ₹1000 (delivered - INCLUDED)
❌ Order 2: ₹0 (refund in progress - EXCLUDED)
❌ Order 3: ₹0 (refund completed - EXCLUDED)

Total Revenue: ₹1000
Cancelled Revenue: ₹800 (Order 2 + Order 3)
Refund Processing: 1 order (Order 2)
Refunded: 1 order (Order 3)
```

---

## 🔍 Implementation Details

### Code Location

**File:** `src/services/analytics.service.ts`  
**Lines:** 502-529

### Revenue Query

```typescript
// Excluded statuses (based on ORDER_CANCELLATION_FLOW.md)
const excludedRevenueStatuses = [
    'cancelled',                    // Initial cancellation
    'cancelled_refund_processing',   // Refund in progress (money will be returned)
    'cancelled_refunded',            // Refund completed (money returned)
    'cancelled_completed',           // COD cancellation complete (no payment collected)
    'payment_failed',                // Payment never succeeded
    'partially_cancelled',            // Partial cancellation (some items cancelled)
];

// Total revenue (excludes all cancellation statuses)
prisma.orders.aggregate({
    _sum: { orderamount: true },
    where: {
        ...whereClause,
        orderstatus: { notIn: excludedRevenueStatuses },
    },
})
```

### Cancelled Revenue Calculation

```typescript
// Calculate revenue lost due to cancellations/refunds
const cancelledRevenue = (statusBreakdown || [])
    .filter((s: any) => 
        s.orderstatus === 'cancelled' || 
        s.orderstatus === 'cancelled_refund_processing' ||
        s.orderstatus === 'cancelled_refunded' ||
        s.orderstatus === 'cancelled_completed' ||
        s.orderstatus === 'partially_cancelled'
    )
    .reduce((sum: number, s: any) => sum + Number(s._sum.orderamount || 0), 0);
```

---

## 📊 Business Insights

### Revenue Accuracy

✅ **Accurate Revenue Reporting:**
- Only counts orders where money is actually kept
- Excludes refunded orders (money returned)
- Excludes failed payments (no money received)

✅ **Cancellation Impact:**
- `cancelled_revenue` shows total revenue lost
- `refund_rate` shows percentage of orders refunded
- Helps identify cancellation patterns

### Financial Reconciliation

**For Accounting:**
- `total_revenue` = Actual revenue (money in bank)
- `cancelled_revenue` = Revenue lost (refunds given)
- `total_revenue + cancelled_revenue` = Gross revenue before cancellations

**Example:**
```
Gross Revenue: ₹150,000 (all orders)
Cancelled Revenue: ₹10,000 (refunded)
Net Revenue: ₹140,000 (actual revenue)
```

---

## ⚠️ Important Notes

1. **Revenue vs Gross Sales:**
   - `total_revenue` = Net revenue (after excluding cancellations)
   - To get gross sales, add `cancelled_revenue` to `total_revenue`

2. **Refund Status Tracking:**
   - `cancelled_refund_processing`: Money will be returned (excluded)
   - `cancelled_refunded`: Money has been returned (excluded)
   - Both are excluded from revenue

3. **COD Orders:**
   - `cancelled_completed`: No payment was ever collected (excluded)
   - Correctly excluded from revenue

4. **Partial Cancellations:**
   - `partially_cancelled`: Some items cancelled (excluded)
   - Entire order amount excluded (no partial revenue tracking)

5. **Returns:**
   - `returned` orders are **currently included** in revenue
   - Consider excluding if returns are refunded
   - Future enhancement: Add `returned_refunded` status

---

## 🔄 Status Flow Impact

### Revenue Counted at Each Stage

```
order_placed → ✅ Revenue counted (pending payment)
payment_completed → ✅ Revenue counted (payment received)
order_confirmed → ✅ Revenue counted
packed → ✅ Revenue counted
ready_for_dispatch → ✅ Revenue counted
shipped → ✅ Revenue counted
in_transit → ✅ Revenue counted
out_for_delivery → ✅ Revenue counted
delivered → ✅ Revenue counted (final)
cod_payment_received → ✅ Revenue counted (COD payment collected)

cancelled → ❌ Revenue EXCLUDED (will be refunded)
cancelled_refund_processing → ❌ Revenue EXCLUDED (refund in progress)
cancelled_refunded → ❌ Revenue EXCLUDED (money returned)
cancelled_completed → ❌ Revenue EXCLUDED (no payment collected)
payment_failed → ❌ Revenue EXCLUDED (no payment received)
```

---

## 📝 Summary

### Revenue Calculation Rules

1. ✅ **Include:** All active/fulfilled orders (delivered, shipped, etc.)
2. ❌ **Exclude:** All cancelled orders (all cancellation statuses)
3. ❌ **Exclude:** Payment failed orders
4. ❌ **Exclude:** Refunded orders (money returned)

### Key Metrics

- **`total_revenue`**: Net revenue (calculated by excluding cancelled orders from query)
  - **NOT** calculated as "gross - cancelled"
  - Directly sums non-cancelled orders
  - Represents actual revenue (money kept)

- **`gross_revenue`**: Total revenue including cancelled orders
  - Calculated as: `total_revenue + cancelled_revenue`
  - For reference only (shows total before cancellations)

- **`cancelled_revenue`**: Revenue lost (sum of cancelled order amounts)
  - Calculated separately from status breakdown
  - Shows impact of cancellations

- **`refunded_orders`**: Count of refunded orders
- **`refund_rate`**: Percentage of orders refunded

### Revenue Calculation Formula

```
total_revenue = SUM(orderamount) WHERE orderstatus NOT IN [cancelled statuses]
cancelled_revenue = SUM(orderamount) WHERE orderstatus IN [cancelled statuses]
gross_revenue = total_revenue + cancelled_revenue

✅ Verification: total_revenue + cancelled_revenue = gross_revenue
```

### Business Value

- ✅ Accurate financial reporting
- ✅ Track cancellation impact
- ✅ Monitor refund processing
- ✅ Understand revenue loss patterns

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Status:** Production Ready

