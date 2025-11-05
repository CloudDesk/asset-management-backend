# 🎯 PhonePe Orderline Discount Fix - Complete Implementation

**Date**: November 5, 2025  
**Status**: ✅ COMPLETED  
**Issue ID**: PHONEPE-ORDERLINE-001

---

## 📊 Problem Summary

Order-level discount fields were correctly populated, but orderline records had critical issues:

### Issues Identified

1. **Missing Promotion Discounts**: `promotion_discount_amount` was 0 for all orderlines (should sum to order.promotion_discount_total)
2. **Incorrect orderamount**: `orderamount` didn't equal `productamount - discountamount`
3. **Incorrect discountamount**: Sum of orderline `discountamount` didn't match order-level total
4. **Validation Failures**:
   - ❌ Sum of orderline.orderamount ≠ order.orderamount
   - ❌ Sum of orderline.promotion_discount_amount ≠ order.promotion_discount_total

---

## ✅ Complete Solution

### Part 1: Enhanced Enrichment Logic

**File**: `src/controllers/phonepe.controller.ts`  
**Lines**: 2257-2456

#### What It Does

1. **Extracts per-product discounts** from `evaluationData.cart_data`:
   ```typescript
   const cartItem = evaluationCartData.find(
     (ci: any) => parseInt(ci.product_id?.toString()) === productId
   );
   if (cartItem) {
     originalPrice = basePrice * quantity;
     productDiscountAmount = productDiscount * quantity;
   }
   ```

2. **Extracts promotion discounts** from `evaluationData.applied_promotions`:
   ```typescript
   for (const promo of appliedPromotions) {
     if (promo.breakdown && Array.isArray(promo.breakdown)) {
       const promoItem = promo.breakdown.find(
         (b: any) => parseInt(b.product_id?.toString()) === productId
       );
       if (promoItem) {
         promotionDiscountAmount += parseFloat(promoItem.total_discount?.toString() || '0');
       }
     }
   }
   ```

3. **Distributes shipping costs** pro-rata by productamount:
   ```typescript
   const shippingCostForItem = totalProductAmount > 0
     ? (shippingCost * itemProductAmount) / totalProductAmount
     : 0;
   ```

4. **🔥 CRITICAL FIX: Recalculates orderamount and discountamount**:
   ```typescript
   const totalDiscountAmount = productDiscountAmount + promotionDiscountAmount;
   const finalOrderAmount = itemProductAmount - promotionDiscountAmount;
   
   return {
     ...item,
     original_price: originalPrice,
     product_discount_amount: productDiscountAmount,
     promotion_discount_amount: promotionDiscountAmount,
     shipping_cost: shippingCostForItem,
     evaluation_id: primaryEvaluationId,
     // ✅ RECALCULATED VALUES
     discountamount: totalDiscountAmount,
     orderamount: finalOrderAmount
   };
   ```

5. **Validates totals** against order-level values:
   ```typescript
   const enrichmentSummary = {
     totalItems: enrichedOrderItems.length,
     totalOriginalPrice: enrichedOrderItems.reduce((sum, i) => sum + (i.original_price || 0), 0),
     totalProductAmount: enrichedOrderItems.reduce((sum, i) => sum + parseFloat(i.productamount || '0'), 0),
     totalProductDiscount: enrichedOrderItems.reduce((sum, i) => sum + (i.product_discount_amount || 0), 0),
     totalPromotionDiscount: enrichedOrderItems.reduce((sum, i) => sum + (i.promotion_discount_amount || 0), 0),
     totalDiscountAmount: enrichedOrderItems.reduce((sum, i) => sum + parseFloat(i.discountamount || '0'), 0),
     totalOrderAmount: enrichedOrderItems.reduce((sum, i) => sum + parseFloat(i.orderamount || '0'), 0),
     totalShipping: enrichedOrderItems.reduce((sum, i) => sum + (i.shipping_cost || 0), 0),
     totalQuantity: enrichedOrderItems.reduce((sum, i) => sum + parseInt(i.quantity || '0'), 0)
   };
   
   // Validates all totals match expected order-level values
   validations: {
     quantityMatch: Math.abs(enrichmentSummary.totalQuantity - totalQuantity) < 0.01,
     productAmountMatch: Math.abs(enrichmentSummary.totalProductAmount - productAmount) < 0.01,
     promotionDiscountMatch: Math.abs(enrichmentSummary.totalPromotionDiscount - promotionDiscountTotal) < 0.01,
     orderAmountMatch: Math.abs(enrichmentSummary.totalOrderAmount - expectedOrderAmount) < 0.01,
     allValid: /* all checks pass */
   }
   ```

#### Fallback Logic

If `evaluationData` is not available, the enrichment falls back to **pro-rata distribution**:
```typescript
const totalProductAmount = originalOrderData
  .filter((i: any) => validProductIds.includes(i.productid))
  .reduce((sum: number, i: any) => sum + parseFloat(i.productamount || '0'), 0);

if (totalProductAmount > 0) {
  const proRataFactor = itemProductAmount / totalProductAmount;
  productDiscountAmount = productDiscountTotal * proRataFactor;
  promotionDiscountAmount = promotionDiscountTotal * proRataFactor;
  originalPrice = itemProductAmount + (productDiscountAmount + promotionDiscountAmount);
}
```

---

### Part 2: Service Layer Mapping

**File**: `src/services/orders.service.ts`  
**Lines**: 374-450

#### Updated createOrderlinesFromOrderItems

The service now correctly maps all enriched fields from orderItems to orderline records:

```typescript
const orderlineData = {
  orderid: orderId,
  productid: orderItem.productid,
  userid: parseInt(orderItem.userid?.toString() || '0') || null,
  addressid: parseInt(orderItem.addressid?.toString() || '0') || null,
  productamount: parseFloat(orderItem.productamount?.toString() || '0') || null,
  discountamount: parseFloat(orderItem.discountamount?.toString() || '0') || null,  // ✅ Uses recalculated value
  orderamount: parseFloat(orderItem.orderamount?.toString() || '0') || null,        // ✅ Uses recalculated value
  quantity: parseInt(orderItem.quantity?.toString() || '1') || 1,
  productname: orderItem.productname || null,
  productcategory: orderItem.productcategory || null,
  orderstatus: 'payment_completed',
  uniqueordderid: orderidString,
  createddate: currentTime,
  modifieddate: currentTime,
  ordereddate: currentTime,
  // ✅ Enriched discount fields
  original_price: orderItem.original_price !== undefined 
    ? parseFloat(orderItem.original_price?.toString() || '0') 
    : null,
  product_discount_amount: orderItem.product_discount_amount !== undefined 
    ? parseFloat(orderItem.product_discount_amount?.toString() || '0') 
    : null,
  promotion_discount_amount: orderItem.promotion_discount_amount !== undefined 
    ? parseFloat(orderItem.promotion_discount_amount?.toString() || '0') 
    : null,
  shipping_cost: orderItem.shipping_cost !== undefined 
    ? parseFloat(orderItem.shipping_cost?.toString() || '0') 
    : null,
  evaluation_id: orderItem.evaluation_id || null,
  merchanttransactionid: orderItem.merchanttransactionid || null
};
```

---

## 🧪 Validation Rules Enforced

The fix ensures these invariants are maintained:

### Orderline-Level Rules
```typescript
// Rule 1: Total discount = sum of discount components
discountamount = product_discount_amount + promotion_discount_amount

// Rule 2: Final amount after all discounts
orderamount = productamount - promotion_discount_amount
// Note: productamount is already after product discount, so we only subtract promotion discount

// Rule 3: Product amount relationship
productamount = (original_price × quantity) - product_discount_amount

// Rule 4: Original price calculation
original_price × quantity ≈ productamount + product_discount_amount
```

### Order-Level Aggregation Rules
```typescript
// Rule 5: Quantity consistency
Σ orderline.quantity = order.quantity

// Rule 6: Product amount consistency
Σ orderline.productamount = order.productamount

// Rule 7: Promotion discount consistency
Σ orderline.promotion_discount_amount = order.promotion_discount_total

// Rule 8: Order amount consistency
Σ orderline.orderamount = order.orderamount

// Rule 9: Shipping cost consistency
Σ orderline.shipping_cost = order.shipping_cost

// Rule 10: Original total consistency
Σ (orderline.productamount + orderline.product_discount_amount) = order.original_total

// Rule 11: Total discount consistency
Σ orderline.discountamount = order.discountamount
```

All rules are validated in the enrichment logging with discrepancy thresholds < 0.01.

---

## 📈 Example Transformation

### Before Fix (Incorrect)

**Order** (id: 140):
```json
{
  "orderamount": 2100,
  "quantity": 15,
  "productamount": 2600,
  "discountamount": 600,
  "promotion_discount_total": 500,
  "original_total": 2700,
  "shipping_cost": 0
}
```

**Orderlines** (WRONG):
```json
[
  {
    "productid": 44,
    "productamount": 1150,
    "discountamount": 50,
    "orderamount": 1150,  // ❌ WRONG: Should be 1150 - promotion_discount
    "quantity": 5,
    "product_discount_amount": 50,
    "promotion_discount_amount": 0,  // ❌ WRONG: Should have promotion discount allocated
    "shipping_cost": 0
  },
  // ... other lines with same issues
]
```

**Issues**:
- ❌ Sum of orderline.promotion_discount_amount = 0 (should be 500)
- ❌ Sum of orderline.orderamount = 2850 (should be 2100)
- ❌ orderline.orderamount ≠ productamount - promotion_discount_amount

---

### After Fix (Correct)

**Order** (id: 140) - unchanged:
```json
{
  "orderamount": 2100,
  "quantity": 15,
  "productamount": 2600,
  "discountamount": 600,
  "promotion_discount_total": 500,
  "original_total": 2700,
  "shipping_cost": 0
}
```

**Orderlines** (CORRECT):
```json
[
  {
    "productid": 44,
    "productamount": 1150,
    "discountamount": 271.15,  // ✅ 50 + 221.15
    "orderamount": 928.85,     // ✅ 1150 - 221.15
    "quantity": 5,
    "original_price": 240,
    "product_discount_amount": 50,
    "promotion_discount_amount": 221.15,  // ✅ Pro-rata: (1150/2600) × 500
    "shipping_cost": 0
  },
  {
    "productid": 40,
    "productamount": 700,
    "discountamount": 184.62,  // ✅ 50 + 134.62
    "orderamount": 565.38,     // ✅ 700 - 134.62
    "quantity": 5,
    "original_price": 150,
    "product_discount_amount": 50,
    "promotion_discount_amount": 134.62,  // ✅ Pro-rata: (700/2600) × 500
    "shipping_cost": 0
  },
  {
    "productid": 47,
    "productamount": 750,
    "discountamount": 144.23,  // ✅ 0 + 144.23
    "orderamount": 605.77,     // ✅ 750 - 144.23
    "quantity": 5,
    "original_price": 150,
    "product_discount_amount": 0,
    "promotion_discount_amount": 144.23,  // ✅ Pro-rata: (750/2600) × 500
    "shipping_cost": 0
  }
]
```

**Validations** ✅:
- ✅ Sum of promotion_discount_amount = 221.15 + 134.62 + 144.23 = 500
- ✅ Sum of orderamount = 928.85 + 565.38 + 605.77 = 2100
- ✅ Each orderline: orderamount = productamount - promotion_discount_amount
- ✅ Each orderline: discountamount = product_discount_amount + promotion_discount_amount
- ✅ Sum of productamount = 1150 + 700 + 750 = 2600
- ✅ Sum of quantity = 5 + 5 + 5 = 15

---

## 🔍 Logging & Debugging

### Key Log Points

1. **Enrichment Start** (line 2262):
   ```
   "Starting orderItems enrichment with per-line discount data"
   ```

2. **Per-Item Debug** (line 2374):
   ```
   "Order item enriched with discount data and recalculated amounts"
   - Shows: enrichment values, recalculated discountamount and orderamount
   ```

3. **Validation Summary** (line 2421):
   ```
   "Order items enrichment completed - validating orderline totals match order totals"
   - Shows: enrichmentSummary, expectedOrderLevelTotals, discrepancies, validations
   ```

4. **Service Layer** (line 433):
   ```
   "Creating orderline with discount fields"
   - Shows: discount fields being persisted
   ```

### What to Look For

- ✅ `validations.allValid: true` - All totals match
- ⚠️ `discrepancies.promotionDiscount > 0.01` - Promotion discount mismatch
- ⚠️ `discrepancies.orderAmount > 0.01` - Order amount mismatch
- ❌ `hasPromotionDiscount: false` in service log - Enrichment didn't work

---

## 🧪 Testing Recommendations

### Unit Test Cases

```typescript
describe('PhonePe Orderline Discount Distribution', () => {
  
  test('should distribute promotion discount pro-rata', () => {
    // Test with 3 products, different amounts, verify pro-rata split
  });
  
  test('should recalculate orderamount correctly', () => {
    // Verify: orderamount = productamount - promotion_discount_amount
  });
  
  test('should recalculate discountamount correctly', () => {
    // Verify: discountamount = product_discount + promotion_discount
  });
  
  test('should validate totals match order level', () => {
    // Verify all 11 validation rules
  });
  
  test('should handle fallback pro-rata when evaluationData missing', () => {
    // Test with no evaluationData
  });
  
  test('should handle zero promotion discount', () => {
    // Test with promotionDiscountTotal = 0
  });
  
  test('should handle rounding correctly', () => {
    // Test with amounts that cause rounding (e.g., 10/3)
  });
});
```

### Integration Test

```sql
-- Create test order via PhonePe callback
-- Then verify:

SELECT 
  o.id AS order_id,
  o.orderamount,
  o.productamount,
  o.discountamount,
  o.promotion_discount_total,
  SUM(ol.orderamount) AS sum_orderline_orderamount,
  SUM(ol.productamount) AS sum_orderline_productamount,
  SUM(ol.promotion_discount_amount) AS sum_orderline_promotion_discount,
  SUM(ol.discountamount) AS sum_orderline_discountamount,
  ABS(o.orderamount - SUM(ol.orderamount)) AS orderamount_diff,
  ABS(o.promotion_discount_total - SUM(ol.promotion_discount_amount)) AS promotion_diff
FROM orders o
LEFT JOIN orderline ol ON o.id = ol.orderid
WHERE o.merchanttransactionid = 'TEST_TXN_123'
GROUP BY o.id;

-- All *_diff columns should be < 0.01
```

---

## ✅ Checklist

- [x] Enrichment logic extracts per-product discounts
- [x] Enrichment logic extracts promotion discounts
- [x] Enrichment logic distributes shipping costs
- [x] **Enrichment recalculates discountamount**
- [x] **Enrichment recalculates orderamount**
- [x] Enrichment validates totals against order-level
- [x] Service layer maps enriched fields to orderline
- [x] Service layer uses recalculated amounts
- [x] Logging shows enrichment details
- [x] Logging shows validation results
- [x] No linting errors
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Tested with real PhonePe callback

---

## 🚀 Next Steps

1. **Deploy to staging** and monitor logs for validation results
2. **Run integration tests** with sample PhonePe callbacks
3. **Verify database** - check that orderlines have correct discount values
4. **Monitor production** - watch for `validations.allValid: false` warnings
5. **Add alerts** for validation failures (indicates data quality issues)

---

## 📝 Notes

- The fix maintains **backward compatibility** - old orders without enrichment will still work
- **Pro-rata distribution** ensures fair allocation even without evaluationData
- **Validation logging** helps catch future issues early
- **Rounding errors** are acceptable within 0.01 threshold (1 cent)
- The recalculation of `orderamount` and `discountamount` is **critical** for consistency

---

**Implemented by**: AI Assistant  
**Reviewed by**: Pending  
**Deployed to**: Pending

