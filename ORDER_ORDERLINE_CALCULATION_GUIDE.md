# Order and Orderline Calculation Guide (Without GST)

## 📋 Overview

This document explains how **order** and **orderline** values are calculated in the PhonePe payment flow, **excluding GST calculations**. All amounts are in INR (₹).

## 🎯 Quick Reference Table

### ORDER TABLE

| Field | Formula | Example |
|-------|---------|---------|
| `original_total` | `Σ(base_price × quantity)` | ₹1400 |
| `productamount` | `original_total - productDiscountTotal` | ₹1350 |
| `discountamount` | `productDiscountTotal + promotionDiscountTotal` | ₹550 |
| `promotion_discount_total` | `Σ(applied_promotions.discount_amount)` | ₹500 |
| `orderamount` | `transaction.amount` (from PhonePe) | ₹1000 |
| `quantity` | `Σ(orderline.quantity)` | 3 |
| `shipping_cost` | `originalPayload.shippingCost` | ₹150 |

### ORDERLINE TABLE

| Field | Formula | Example (qty=2, unit=₹500) |
|-------|---------|----------------------------|
| `productamount` | `originalPrice - productDiscountAmount` (TOTAL) | ₹950 |
| `discountamount` | `productDiscountAmount + promotionDiscountAmount` (TOTAL) | ₹401.85 |
| `orderamount` | `itemProductAmount - promotionDiscountAmount` (TOTAL) | ₹598.15 |
| `quantity` | `item.quantity` | 2 |
| `shipping_cost` | `(totalShipping × itemProductAmount) / totalProductAmount` | ₹105.56 |

**⚠️ CRITICAL:** All orderline amounts (`productamount`, `discountamount`, `orderamount`) are **TOTALS** for the line item, not per-unit!

---

## 🏗️ Calculation Flow

### Step 1: Extract Base Data from Transaction

When `createOrderAfterPayment()` is called, it extracts:

1. **Original Order Data** from `transaction.transactiondata.originalPayload.order[]`
2. **Evaluation Data** (if `evaluation_id` exists) from `promotion_evaluations` table

---

## 📊 ORDER TABLE CALCULATIONS

### Data Sources

| Field | Source | Calculation Method |
|-------|--------|-------------------|
| `original_total` | Evaluation `cart_data` or `originalPayload` | Sum of `base_price × quantity` for all items |
| `productamount` | Calculated | `original_total - productDiscountTotal` |
| `discountamount` | Calculated | `productDiscountTotal + promotionDiscountTotal` |
| `promotion_discount_total` | Evaluation `applied_promotions` | Sum of `discount_amount` from all promotions |
| `orderamount` | Transaction | `transaction.amount` (final amount paid) |
| `quantity` | Sum of orderlines | `Σ(orderline.quantity)` |
| `shipping_cost` | `originalPayload` | `originalPayload.shippingCost` |

### Detailed Calculation

#### 1. `original_total`

**Source Priority:**
1. **If evaluation data exists:** From `evaluationData.cart_data[]`
   ```typescript
   originalTotal = evaluationCartData.reduce((total, item) => {
     const basePrice = parseFloat(item.base_price || '0');
     const quantity = parseInt(item.quantity || '1');
     return total + (basePrice * quantity);
   }, 0);
   ```

2. **If no evaluation data:** From `originalPayload.order[]`
   ```typescript
   originalTotal = originalOrderData.reduce((total, item) => {
     return total + parseFloat(item.productamount || '0');
   }, 0);
   ```

**Example:**
```
Product 1: base_price = ₹500, quantity = 2 → ₹1000
Product 2: base_price = ₹400, quantity = 1 → ₹400
─────────────────────────────────────────────
original_total = ₹1400
```

#### 2. `productDiscountTotal`

**Source:** From `evaluationData.cart_data[]` (if available)

```typescript
productDiscountTotal = evaluationCartData.reduce((total, item) => {
  const productDiscount = parseFloat(item.product_discount || '0');
  const quantity = parseInt(item.quantity || '1');
  return total + (productDiscount * quantity);
}, 0);
```

**Example:**
```
Product 1: product_discount = ₹25, quantity = 2 → ₹50
Product 2: product_discount = ₹0, quantity = 1 → ₹0
────────────────────────────────────────────────────
productDiscountTotal = ₹50
```

#### 3. `promotionDiscountTotal`

**Source:** From `evaluationData.applied_promotions[]`

```typescript
promotionDiscountTotal = appliedPromotions.reduce((total, promo) => {
  return total + parseFloat(promo.discount_amount || '0');
}, 0);
```

**Example:**
```
Promotion 1: discount_amount = ₹500
───────────────────────────────────
promotionDiscountTotal = ₹500
```

#### 4. `productamount`

```typescript
productAmount = originalTotal - productDiscountTotal
```

**Example:**
```
originalTotal = ₹1400
productDiscountTotal = ₹50
───────────────────────────
productamount = ₹1350
```

#### 5. `discountamount`

```typescript
discountamount = productDiscountTotal + promotionDiscountTotal
```

**Example:**
```
productDiscountTotal = ₹50
promotionDiscountTotal = ₹500
─────────────────────────────────
discountamount = ₹550
```

#### 6. `orderamount`

```typescript
orderamount = transaction.amount  // Final amount from PhonePe
```

**Note:** This is the **actual amount paid** by the customer, which may include shipping.

**Example:**
```
transaction.amount = ₹1000
───────────────────────────
orderamount = ₹1000
```

#### 7. `quantity`

```typescript
quantity = Σ(enrichedOrderItems.quantity)
```

**Example:**
```
Orderline 1: quantity = 2
Orderline 2: quantity = 1
───────────────────────────
quantity = 3
```

#### 8. `shipping_cost`

```typescript
shippingCost = parseFloat(originalPayload.shippingCost || '0')
```

**Example:**
```
originalPayload.shippingCost = ₹150
─────────────────────────────────────
shipping_cost = ₹150
```

---

## 📦 ORDERLINE TABLE CALCULATIONS

### Data Sources

| Field | Source | Calculation Method |
|-------|--------|-------------------|
| `productamount` | Enriched order item | `originalPrice - productDiscountAmount` (TOTAL for line) |
| `discountamount` | Enriched order item | `productDiscountAmount + promotionDiscountAmount` (TOTAL) |
| `orderamount` | Enriched order item | `itemProductAmount - promotionDiscountAmount` (TOTAL) |
| `quantity` | Original order item | `item.quantity` |
| `shipping_cost` | Pro-rata distribution | `(totalShipping × itemProductAmount) / totalProductAmount` |

### Detailed Calculation (Per Orderline)

#### Step 1: Extract Base Values

```typescript
const productId = item.productid;
const quantity = parseInt(item.quantity || '1');
const rawProductAmount = parseFloat(item.productamount || '0');
```

#### Step 2: Calculate from Evaluation Data (If Available)

**A. Original Price & Product Discount**

```typescript
if (evaluationData && cartItem) {
  const basePrice = parseFloat(cartItem.base_price || '0');
  const productDiscount = parseFloat(cartItem.product_discount || '0');
  
  originalPrice = basePrice * quantity;  // TOTAL
  productDiscountAmount = productDiscount * quantity;  // TOTAL
  itemProductAmount = originalPrice - productDiscountAmount;  // TOTAL
}
```

**B. Promotion Discount**

**Option 1: From Breakdown (Most Accurate)**
```typescript
if (promoItem in appliedPromotions.breakdown) {
  promotionDiscountAmount = parseFloat(promoItem.total_discount || '0');
  // This is already TOTAL for the line item
}
```

**Option 2: Pro-rata Distribution (If No Breakdown)**
```typescript
if (!foundPromotionBreakdown && promotionDiscountTotal > 0) {
  const totalProductAmount = Σ(itemProductAmount for all items);
  promotionDiscountAmount = (promotionDiscountTotal * itemProductAmount) / totalProductAmount;
}
```

#### Step 3: Calculate Shipping (Pro-rata)

```typescript
const totalProductAmount = Σ(itemProductAmount for all items);
const shippingCostForItem = (shippingCost * itemProductAmount) / totalProductAmount;
```

#### Step 4: Calculate Final Amounts

```typescript
const totalDiscountAmount = productDiscountAmount + promotionDiscountAmount;
const finalOrderAmount = itemProductAmount - promotionDiscountAmount;
```

#### Step 5: Store in Orderline

```typescript
orderlineData = {
  productamount: itemProductAmount,        // TOTAL (includes quantity)
  discountamount: totalDiscountAmount,      // TOTAL (includes quantity)
  orderamount: finalOrderAmount,            // TOTAL (includes quantity)
  quantity: quantity,                       // Quantity ordered
  shipping_cost: shippingCostForItem       // Pro-rata shipping
}
```

---

## 📐 COMPLETE EXAMPLE

### Scenario

```
Product 1: base_price = ₹500, quantity = 2, product_discount = ₹25/unit
Product 2: base_price = ₹400, quantity = 1, product_discount = ₹0/unit
Promotion: Flat ₹500 off (coupon)
Shipping: ₹150
```

### ORDER TABLE VALUES

```
original_total = (500 × 2) + (400 × 1) = ₹1400
productDiscountTotal = (25 × 2) + (0 × 1) = ₹50
promotionDiscountTotal = ₹500
─────────────────────────────────────────────────────
productamount = 1400 - 50 = ₹1350
discountamount = 50 + 500 = ₹550
orderamount = ₹1000 (from transaction.amount)
quantity = 2 + 1 = 3
shipping_cost = ₹150
```

### ORDERLINE 1 (Product 1)

```
basePrice = ₹500
quantity = 2
productDiscount = ₹25/unit
─────────────────────────────────────
originalPrice = 500 × 2 = ₹1000
productDiscountAmount = 25 × 2 = ₹50
itemProductAmount = 1000 - 50 = ₹950

Promotion (pro-rata):
totalProductAmount = ₹950 + ₹400 = ₹1350
promotionDiscountAmount = (500 × 950) / 1350 = ₹351.85

Shipping (pro-rata):
shippingCostForItem = (150 × 950) / 1350 = ₹105.56
─────────────────────────────────────────────────────
productamount = ₹950 (TOTAL)
discountamount = 50 + 351.85 = ₹401.85 (TOTAL)
orderamount = 950 - 351.85 = ₹598.15 (TOTAL)
quantity = 2
shipping_cost = ₹105.56
```

### ORDERLINE 2 (Product 2)

```
basePrice = ₹400
quantity = 1
productDiscount = ₹0/unit
─────────────────────────────────────
originalPrice = 400 × 1 = ₹400
productDiscountAmount = 0 × 1 = ₹0
itemProductAmount = 400 - 0 = ₹400

Promotion (pro-rata):
totalProductAmount = ₹950 + ₹400 = ₹1350
promotionDiscountAmount = (500 × 400) / 1350 = ₹148.15

Shipping (pro-rata):
shippingCostForItem = (150 × 400) / 1350 = ₹44.44
─────────────────────────────────────────────────────
productamount = ₹400 (TOTAL)
discountamount = 0 + 148.15 = ₹148.15 (TOTAL)
orderamount = 400 - 148.15 = ₹251.85 (TOTAL)
quantity = 1
shipping_cost = ₹44.44
```

### Verification

```
ORDER TOTALS:
─────────────────────────────────────────
Σ(productamount) = 950 + 400 = ₹1350 ✅ = order.productamount
Σ(discountamount) = 401.85 + 148.15 = ₹550 ✅ = order.discountamount
Σ(orderamount) = 598.15 + 251.85 = ₹850
Σ(shipping_cost) = 105.56 + 44.44 = ₹150 ✅ = order.shipping_cost
─────────────────────────────────────────
Final: Σ(orderamount) + shipping = 850 + 150 = ₹1000 ✅ = order.orderamount
```

---

## ⚠️ IMPORTANT NOTES

### 1. All Amounts Are TOTALS (Not Per-Unit)

- `orderline.productamount` = **TOTAL** for the line item (includes quantity)
- `orderline.discountamount` = **TOTAL** for the line item (includes quantity)
- `orderline.orderamount` = **TOTAL** for the line item (includes quantity)
- `orderline.shipping_cost` = **TOTAL** for the line item (pro-rata)

**Example:**
```
If quantity = 3 and unit price = ₹100:
  orderamount = ₹300 (NOT ₹100)
```

### 2. Pro-rata Distribution

When promotion breakdown is not available, discounts are distributed proportionally:

```typescript
promotionDiscountAmount = (promotionTotal × itemProductAmount) / totalProductAmount
```

### 3. Shipping Distribution

Shipping is always distributed pro-rata:

```typescript
shippingCostForItem = (totalShipping × itemProductAmount) / totalProductAmount
```

### 4. Order Amount vs Orderline Amounts

```
order.orderamount = Σ(orderline.orderamount) + shipping_cost
```

**Note:** `order.orderamount` comes from `transaction.amount` (PhonePe), which is the **final amount paid**. The sum of orderlines + shipping should match this.

---

## 🔍 Code Locations

| Calculation | File | Line Range |
|-------------|------|------------|
| Order totals | `src/controllers/phonepe.controller.ts` | 2140-2261 |
| Orderline enrichment | `src/controllers/phonepe.controller.ts` | 2291-2489 |
| Order creation | `src/controllers/phonepe.controller.ts` | 2585-2614 |
| Orderline creation | `src/services/orders.service.ts` | 293-437 |

---

## ✅ Validation Checks

After order creation, the following should be true:

1. `Σ(orderline.productamount) = order.productamount`
2. `Σ(orderline.discountamount) = order.discountamount`
3. `Σ(orderline.orderamount) + shipping_cost = order.orderamount`
4. `Σ(orderline.quantity) = order.quantity`
5. `Σ(orderline.shipping_cost) = order.shipping_cost`

---

*Last Updated: 2025-12-10 - Excluding GST Calculations*

