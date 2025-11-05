# 🚨 CRITICAL FIX: Promotion Discount Pro-Rata Fallback

**Date**: November 5, 2025  
**Issue**: Orderline `promotion_discount_amount` was 0 even when order had `promotion_discount_total` > 0  
**Status**: ✅ FIXED

---

## 🐛 The Bug

Even after the initial enrichment fix, orderlines were still showing:
```json
{
  "promotion_discount_amount": 0.00,  // ❌ WRONG (should be pro-rata share)
  "discountamount": 50.00,            // ❌ Missing promotion discount
  "orderamount": 1150.00              // ❌ Not accounting for promotion
}
```

While the order had:
```json
{
  "promotion_discount_total": 500.00  // Order has promotion, but not in orderlines
}
```

And other enriched fields WERE working:
- ✅ `original_price` was populated correctly
- ✅ `product_discount_amount` was populated correctly
- ❌ `promotion_discount_amount` was 0

---

## 🔍 Root Cause

The enrichment code had this logic flow:

```typescript
if (evaluationData) {
  // Extract product discount from cart_data ✅ WORKS
  
  // Extract promotion discount from applied_promotions breakdown
  for (const promo of appliedPromotions) {
    if (promo.breakdown && Array.isArray(promo.breakdown)) {
      // Extract from breakdown ✅ WORKS IF BREAKDOWN EXISTS
    }
  }
  // ❌ BUG: If no breakdown, promotion stays 0 (no fallback)
  
} else {
  // Fallback: Pro-rata distribution ✅ WORKS
  // But this only runs if evaluationData doesn't exist at all
}
```

**The Problem**: 
- If `evaluationData` exists → enters the if block
- If `applied_promotions` doesn't have `breakdown` → no extraction happens
- `promotionDiscountAmount` stays 0
- No fallback to pro-rata because we're inside the if block

---

## ✅ The Fix

Added a **secondary fallback** that uses pro-rata distribution when `evaluationData` exists but has no per-product promotion breakdown:

```typescript
// Get promotion discount from applied_promotions breakdown
const appliedPromotions = (evaluationData.applied_promotions as any[]) || [];
let foundPromotionBreakdown = false;

for (const promo of appliedPromotions) {
  if (promo.breakdown && Array.isArray(promo.breakdown)) {
    const promoItem = promo.breakdown.find(
      (b: any) => parseInt(b.product_id?.toString() || '0') === productId
    );
    if (promoItem) {
      promotionDiscountAmount += parseFloat(promoItem.total_discount?.toString() || '0');
      foundPromotionBreakdown = true;
    }
  }
}

// ✅ NEW: If no breakdown found but we have promotionDiscountTotal, use pro-rata
if (!foundPromotionBreakdown && promotionDiscountTotal > 0) {
  const totalProductAmount = originalOrderData
    .filter((i: any) => validProductIds.includes(i.productid))
    .reduce((sum: number, i: any) => 
      sum + parseFloat(i.productamount?.toString() || '0'), 0
    );
  
  if (totalProductAmount > 0) {
    promotionDiscountAmount = (promotionDiscountTotal * itemProductAmount) / totalProductAmount;
    
    logger.warn({
      transactionId,
      productId,
      promotionDiscountTotal,
      itemProductAmount,
      totalProductAmount,
      calculatedPromotionDiscount: promotionDiscountAmount,
      reason: "applied_promotions has no per-product breakdown"
    }, "Using pro-rata distribution for promotion discount");
  }
}
```

---

## 📊 Scenarios Handled

### Scenario 1: Full Breakdown Available ✅
```
evaluationData exists
  └─ cart_data exists → extract product discount
  └─ applied_promotions[].breakdown exists → extract promotion discount
Result: Accurate per-product data from evaluation
```

### Scenario 2: No Promotion Breakdown (THE BUG) ✅ NOW FIXED
```
evaluationData exists
  └─ cart_data exists → extract product discount
  └─ applied_promotions exists but NO breakdown
      └─ ✅ NEW FIX: Use pro-rata for promotion discount
Result: Accurate product data + estimated promotion data
```

### Scenario 3: No Evaluation Data ✅
```
evaluationData doesn't exist
  └─ Use pro-rata for both product and promotion discounts
Result: All estimated (fallback)
```

---

## 🎯 Expected Results

### Before Fix:
```json
// Order id: 141, promotion_discount_total: 500
[
  {
    "productid": 44,
    "productamount": 1150,
    "promotion_discount_amount": 0.00,      // ❌ WRONG
    "discountamount": 50.00,                // ❌ Missing 221.15
    "orderamount": 1150.00                  // ❌ Should be 928.85
  },
  {
    "productid": 40,
    "productamount": 700,
    "promotion_discount_amount": 0.00,      // ❌ WRONG
    "discountamount": 50.00,                // ❌ Missing 134.62
    "orderamount": 700.00                   // ❌ Should be 565.38
  },
  {
    "productid": 47,
    "productamount": 750,
    "promotion_discount_amount": 0.00,      // ❌ WRONG
    "discountamount": 0.00,                 // ❌ Missing 144.23
    "orderamount": 750.00                   // ❌ Should be 605.77
  }
]
// Sum of promotion_discount_amount = 0 ❌ (should be 500)
```

### After Fix:
```json
// Order id: 141, promotion_discount_total: 500
[
  {
    "productid": 44,
    "productamount": 1150,
    "promotion_discount_amount": 221.15,    // ✅ (1150/2600) × 500
    "discountamount": 271.15,               // ✅ 50 + 221.15
    "orderamount": 928.85                   // ✅ 1150 - 221.15
  },
  {
    "productid": 40,
    "productamount": 700,
    "promotion_discount_amount": 134.62,    // ✅ (700/2600) × 500
    "discountamount": 184.62,               // ✅ 50 + 134.62
    "orderamount": 565.38                   // ✅ 700 - 134.62
  },
  {
    "productid": 47,
    "productamount": 750,
    "promotion_discount_amount": 144.23,    // ✅ (750/2600) × 500
    "discountamount": 144.23,               // ✅ 0 + 144.23
    "orderamount": 605.77                   // ✅ 750 - 144.23
  }
]
// Sum of promotion_discount_amount = 500 ✅
```

---

## 🧪 Testing

### 1. Check Logs
After deploying, look for this log message:
```
"Using pro-rata distribution for promotion discount (evaluationData exists but no breakdown)"
```

If you see this, it means the fallback is working.

### 2. Query Database
```sql
SELECT 
  o.id AS order_id,
  o.promotion_discount_total AS order_promotion_total,
  SUM(ol.promotion_discount_amount) AS sum_orderline_promotion,
  ABS(o.promotion_discount_total - SUM(ol.promotion_discount_amount)) AS diff
FROM orders o
LEFT JOIN orderline ol ON o.id = ol.orderid
WHERE o.promotion_discount_total > 0
GROUP BY o.id
HAVING ABS(o.promotion_discount_total - SUM(ol.promotion_discount_amount)) > 0.01;
```

**Expected**: Empty result set (no orders with mismatched promotion totals)

### 3. Verify Calculations
```sql
SELECT 
  ol.id,
  ol.orderid,
  ol.productid,
  ol.productamount,
  ol.product_discount_amount,
  ol.promotion_discount_amount,
  ol.discountamount,
  ol.orderamount,
  -- Verify: discountamount = product_discount + promotion_discount
  (ol.product_discount_amount + ol.promotion_discount_amount) AS calculated_discount,
  ABS(ol.discountamount - (ol.product_discount_amount + ol.promotion_discount_amount)) AS discount_diff,
  -- Verify: orderamount = productamount - promotion_discount
  (ol.productamount - ol.promotion_discount_amount) AS calculated_orderamount,
  ABS(ol.orderamount - (ol.productamount - ol.promotion_discount_amount)) AS orderamount_diff
FROM orderline ol
WHERE ol.orderid IN (
  SELECT o.id FROM orders o WHERE o.promotion_discount_total > 0
);
```

**Expected**: 
- `discount_diff` < 0.01 for all rows
- `orderamount_diff` < 0.01 for all rows

---

## 📝 Files Changed

1. **`src/controllers/phonepe.controller.ts`** (lines 2336-2382)
   - Added `foundPromotionBreakdown` flag
   - Added secondary pro-rata fallback
   - Added detailed logging

2. **`ORDERLINE_FIX_SUMMARY.md`**
   - Updated with explanation of this fix

3. **`CRITICAL_FIX_PROMOTION_DISCOUNT.md`** (this file)
   - Complete documentation of the bug and fix

---

## 🚀 Deployment

1. ✅ Code changes completed
2. ✅ No linting errors
3. ⏳ Ready to deploy
4. ⏳ Test with real PhonePe transaction
5. ⏳ Verify logs show correct behavior
6. ⏳ Run SQL validation queries

---

## 🎓 Lessons Learned

### Bug Pattern: Incomplete Fallback Coverage
- **Symptom**: Some enriched fields work, others don't
- **Cause**: Fallback logic only covers one scenario (evaluationData doesn't exist)
- **Fix**: Add fallback for intermediate scenarios (evaluationData exists but incomplete)

### Key Insight
When implementing data extraction from optional sources:
```typescript
// ❌ BAD: Binary logic (has data OR fallback)
if (hasData) {
  extract();  // What if data is incomplete?
} else {
  fallback();
}

// ✅ GOOD: Tiered logic (try to extract, then fallback)
if (hasData) {
  extract();
  if (!extracted && needsData) {
    fallback();  // Fallback even when data exists
  }
} else {
  fallback();
}
```

---

**Status**: ✅ FIXED and DOCUMENTED  
**Ready for**: Deployment and Testing

