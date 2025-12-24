# Order and Orderline Amount Calculation - Confirmation

## ✅ Confirmed Formulas (After Latest Fix)

### 📦 ORDERLINE TABLE

#### Field Calculation Chain

```
Step 1: original_price = base_price (PER-UNIT, NOT multiplied) ✅
Step 2: product_discount_amount = product_discount × quantity (TOTAL)
Step 3: productamount = (original_price × quantity) - product_discount_amount (TOTAL)
Step 4: promotion_discount_amount = (from breakdown) OR (pro-rata distribution) (TOTAL)
Step 5: orderamount = productamount - promotion_discount_amount  ⭐ NO SHIPPING (TOTAL)
Step 6: shipping_cost = (total_shipping × productamount) / total_productamount  (pro-rata) (TOTAL)
```

#### Key Fields

| Field | Formula | Example (Product: ₹500 × 2 qty, ₹25 discount/unit, ₹50 promo) |
|-------|---------|----------------------------------------------------------------|
| `original_price` | `base_price` (PER-UNIT) ✅ | ₹500 (NOT ₹1000) |
| `product_discount_amount` | `product_discount × quantity` (TOTAL) | ₹25 × 2 = ₹50 |
| `productamount` | `(original_price × quantity) - product_discount_amount` (TOTAL) | (₹500 × 2) - ₹50 = ₹950 |
| `promotion_discount_amount` | From breakdown or pro-rata | ₹50 (example) |
| **`orderamount`** | **`productamount - promotion_discount_amount`** | **₹950 - ₹50 = ₹900** ⭐ |
| `shipping_cost` | Pro-rata distribution | ₹37.5 (example) |
| `discountamount` | `product_discount_amount + promotion_discount_amount` | ₹50 + ₹50 = ₹100 |

**⭐ CRITICAL:** `orderline.orderamount` = `productamount - promotion_discount_amount` 
- **DOES NOT include shipping**
- Shipping is stored separately in `shipping_cost` field

---

### 📋 ORDER TABLE

#### Field Calculation

| Field | Formula | Example |
|-------|---------|---------|
| `original_total` | `Σ(orderline.original_price × orderline.quantity)` ✅ | (₹500 × 2) + (₹400 × 1) = ₹1400 |
| `productamount` | `Σ(orderline.productamount)` | ₹950 + ₹400 = ₹1350 |
| `discountamount` | `Σ(orderline.discountamount)` | ₹100 + ₹0 = ₹100 |
| `promotion_discount_total` | `Σ(orderline.promotion_discount_amount)` | ₹50 + ₹0 = ₹50 |
| **`orderamount`** | **`Σ(orderline.orderamount) + shipping_cost`** | **₹900 + ₹100 + ₹50 = ₹1050** ⭐ |
| `shipping_cost` | From `originalPayload.shippingCost` | ₹50 |

**⭐ CRITICAL:** `order.orderamount` = `Σ(orderline.orderamount) + shipping_cost`
- Sum of all orderline orderamounts PLUS shipping cost
- This matches the `transaction.amount` from PhonePe (final amount paid)

---

## 🔍 Verification with Your Example

### Your Order Data

**Order:**
- `orderamount`: ₹450
- `productamount`: ₹400
- `shipping_cost`: ₹50

**Orderline 1 (Product 66):**
- `productamount`: ₹300
- `orderamount`: ₹300 ✅ (After fix - was ₹350 before)
- `shipping_cost`: ₹37.5

**Orderline 2 (Product 56):**
- `productamount`: ₹100
- `orderamount`: ₹100 ✅
- `shipping_cost`: ₹12.5

### Verification

```
✅ Orderline 1: orderamount = productamount - promotion_discount_amount
                = ₹300 - ₹0 = ₹300 ✅

✅ Orderline 2: orderamount = productamount - promotion_discount_amount
                = ₹100 - ₹0 = ₹100 ✅

✅ Order: orderamount = Σ(orderline.orderamount) + shipping_cost
            = (₹300 + ₹100) + ₹50
            = ₹400 + ₹50
            = ₹450 ✅
```

---

## 📝 Code References

### Orderline orderamount Calculation

**File:** `src/controllers/phonepe.controller.ts`

**Line 2451:** (Enrichment phase)
```typescript
const finalOrderAmount = itemProductAmount - promotionDiscountAmount;
// where itemProductAmount = productamount (original_price - product_discount_amount)
```

**Line 2990-2991:** (Update phase - non-last lines)
```typescript
let finalPriceTotal = roundToTwo(
  productAmountOnly - promotionDiscountAmount
);
```

**Line 3012-3014:** (Update phase - last line) ✅ FIXED
```typescript
// ✅ FIX: orderline.orderamount should NOT include shipping
finalPriceTotal = roundToTwo(
  productAmountOnly - promotionDiscountAmount
);
```

### Order orderamount

**Source:** `transaction.amount` from PhonePe (includes shipping)

**Verification:** 
```typescript
order.orderamount = Σ(orderline.orderamount) + shipping_cost
```

---

## ✅ Summary

1. **Orderline orderamount** = `productamount - promotion_discount_amount`
   - ✅ Does NOT include shipping
   - ✅ Shipping stored separately in `shipping_cost`

2. **Order orderamount** = `Σ(orderline.orderamount) + shipping_cost`
   - ✅ Sum of all orderline orderamounts PLUS shipping
   - ✅ Matches `transaction.amount` from PhonePe

3. **Amount Types:**
   - `orderline.original_price` = **PER-UNIT** (not multiplied by quantity) ✅
   - `orderline.productamount` = **TOTAL** for line item (includes quantity)
   - `orderline.orderamount` = **TOTAL** for line item (includes quantity, excludes shipping)
   - `order.original_total` = **TOTAL** = `Σ(orderline.original_price × orderline.quantity)` ✅

---

*Last Updated: After fix for last-line orderamount calculation bug*

