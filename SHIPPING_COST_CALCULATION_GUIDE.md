# Shipping Cost Calculation Guide

## 📋 Overview

This document explains how **shipping cost** is calculated and distributed in the PhonePe payment flow, based on `PHONEPE_PAYMENT_IMPLEMENTATION_GUIDE_PREVIOUS.md`.

---

## 🎯 Quick Summary

| Level | Field | Source | Calculation |
|-------|-------|--------|-------------|
| **Order** | `shipping_cost` | `originalPayload.shippingCost` | Direct from request payload |
| **Orderline** | `shipping_cost` | Pro-rata distribution | `(totalShipping × itemProductAmount) / totalProductAmount` |

---

## 📊 ORDER TABLE - Shipping Cost

### Source

**Field:** `orders.shipping_cost`

**Source:** `transaction.transactiondata.originalPayload.shippingCost`

**Calculation:**
```typescript
shippingCost = parseFloat(
  transaction.transactiondata?.originalPayload?.shippingCost?.toString() || "0"
);
```

**Example:**
```
originalPayload.shippingCost = ₹150
─────────────────────────────────────
order.shipping_cost = ₹150
```

**Key Points:**
- ✅ Shipping cost comes from the **frontend request payload**
- ✅ Stored at **order level** (total shipping for entire order)
- ✅ **NOT calculated** - taken directly from `originalPayload`

---

## 📦 ORDERLINE TABLE - Shipping Cost

### Source

**Field:** `orderline.shipping_cost`

**Source:** Pro-rata distribution from order-level shipping cost

**Calculation Method:** Pro-rata based on `productamount`

### Formula

```typescript
shippingCostForItem = (totalShipping × itemProductAmount) / totalProductAmount
```

**Where:**
- `totalShipping` = `order.shipping_cost` (from originalPayload)
- `itemProductAmount` = `orderline.productamount` (TOTAL for this line item)
- `totalProductAmount` = `Σ(all orderline.productamount)` = `order.productamount`

### Step-by-Step Calculation

#### Step 1: Calculate Total Product Amount

```typescript
const totalProductAmount = originalOrderData
  .filter((i: any) => validProductIds.includes(i.productid))
  .reduce((sum: number, i: any) => 
    sum + parseFloat(i.productamount?.toString() || '0'), 0
  );
```

**Example:**
```
Orderline 1: productamount = ₹950
Orderline 2: productamount = ₹400
─────────────────────────────────────
totalProductAmount = ₹1350
```

#### Step 2: Calculate Shipping for Each Orderline

```typescript
const shippingCostForItem = totalProductAmount > 0
  ? (shippingCost * itemProductAmount) / totalProductAmount
  : 0;
```

**Example:**
```
Total Shipping = ₹150
Total Product Amount = ₹1350

Orderline 1 (productamount = ₹950):
  shipping_cost = (150 × 950) / 1350 = ₹105.56

Orderline 2 (productamount = ₹400):
  shipping_cost = (150 × 400) / 1350 = ₹44.44
```

#### Step 3: Verification

```typescript
Σ(orderline.shipping_cost) = order.shipping_cost
```

**Example:**
```
₹105.56 + ₹44.44 = ₹150 ✅ = order.shipping_cost
```

---

## 📐 Complete Example

### Scenario

```
Product 1: base_price = ₹500, quantity = 2, product_discount = ₹25/unit
Product 2: base_price = ₹400, quantity = 1, product_discount = ₹0/unit
Shipping:  ₹150
```

### ORDER TABLE

```
original_total = (500 × 2) + (400 × 1) = ₹1400
productDiscountTotal = (25 × 2) + (0 × 1) = ₹50
─────────────────────────────────────────────────────
productamount = 1400 - 50 = ₹1350
shipping_cost = ₹150 (from originalPayload)
orderamount = productAmount + shipping_cost = 1350 + 150 = ₹1500
```

### ORDERLINE 1 (Product 1)

```
originalPrice = 500 × 2 = ₹1000
productDiscountAmount = 25 × 2 = ₹50
─────────────────────────────────────
productamount = 1000 - 50 = ₹950

Shipping (pro-rata):
totalProductAmount = ₹950 + ₹400 = ₹1350
shipping_cost = (150 × 950) / 1350 = ₹105.56
```

### ORDERLINE 2 (Product 2)

```
originalPrice = 400 × 1 = ₹400
productDiscountAmount = 0 × 1 = ₹0
─────────────────────────────────────
productamount = 400 - 0 = ₹400

Shipping (pro-rata):
totalProductAmount = ₹950 + ₹400 = ₹1350
shipping_cost = (150 × 400) / 1350 = ₹44.44
```

### Verification

```
ORDER TOTALS:
─────────────────────────────────────────
Σ(productamount) = 950 + 400 = ₹1350 ✅ = order.productamount
Σ(shipping_cost) = 105.56 + 44.44 = ₹150 ✅ = order.shipping_cost
─────────────────────────────────────────
FINAL:
Σ(orderamount) + shipping = 1350 + 150 = ₹1500 ✅ = order.orderamount
```

---

## 🔍 Code Location

### Order-Level Shipping

**File:** `src/controllers/phonepe.controller.ts`  
**Line:** ~2170-2173

```typescript
shippingCost = parseFloat(
  transaction.transactiondata?.originalPayload?.shippingCost?.toString() || "0"
);
```

### Orderline-Level Shipping (Pro-rata)

**File:** `src/controllers/phonepe.controller.ts`  
**Line:** ~2411-2420

```typescript
// Calculate pro-rata shipping cost based on product amount
const totalProductAmount = originalOrderData
  .filter((i: any) => validProductIds.includes(i.productid))
  .reduce((sum: number, i: any) => 
    sum + parseFloat(i.productamount?.toString() || '0'), 0
  );

const shippingCostForItem = totalProductAmount > 0
  ? (shippingCost * itemProductAmount) / totalProductAmount
  : 0;
```

---

## ⚠️ Important Notes

### 1. Shipping is NOT Added to Orderline `orderamount`

**Key Point:**
- `orderline.orderamount` = Product amount after discounts (does NOT include shipping)
- `orderline.shipping_cost` = Pro-rata shipping (stored separately)

**Final Calculation:**
```
order.orderamount = Σ(orderline.orderamount) + Σ(orderline.shipping_cost)
```

**Example:**
```
Orderline 1: orderamount = ₹950, shipping_cost = ₹105.56
Orderline 2: orderamount = ₹400, shipping_cost = ₹44.44
─────────────────────────────────────────────────────────
Order: orderamount = 950 + 400 + 105.56 + 44.44 = ₹1500 ✅
```

### 2. Pro-rata Distribution

Shipping is **always** distributed proportionally based on `productamount`:

```typescript
proRataFactor = itemProductAmount / totalProductAmount
shipping_cost = proRataFactor × totalShippingCost
```

**Why?**
- Fair distribution based on product value
- Ensures `Σ(orderline.shipping_cost) = order.shipping_cost`

### 3. Shipping Source

**Order-level shipping:**
- Comes from **frontend request** (`originalPayload.shippingCost`)
- **NOT calculated** on backend
- Backend only **distributes** it to orderlines

**Orderline-level shipping:**
- **Calculated** on backend using pro-rata formula
- Based on `productamount` ratio

---

## 📊 Formula Summary

### Order Level

```
shipping_cost = originalPayload.shippingCost
```

### Orderline Level

```
shipping_cost = (totalShipping × itemProductAmount) / totalProductAmount
```

### Verification

```
Σ(orderline.shipping_cost) = order.shipping_cost
order.orderamount = Σ(orderline.orderamount) + Σ(orderline.shipping_cost)
```

---

## ✅ Validation Checks

After order creation, verify:

1. ✅ `order.shipping_cost` = Value from `originalPayload.shippingCost`
2. ✅ `Σ(orderline.shipping_cost)` = `order.shipping_cost`
3. ✅ `order.orderamount` = `Σ(orderline.orderamount) + order.shipping_cost`
4. ✅ Each `orderline.shipping_cost` is proportional to `orderline.productamount`

---

## 🎯 Key Takeaways

1. **Order shipping:** Comes from frontend request (not calculated)
2. **Orderline shipping:** Calculated using pro-rata distribution
3. **Distribution basis:** Based on `productamount` ratio
4. **Storage:** Shipping stored separately, not added to `orderamount` at line level
5. **Verification:** Sum of orderline shipping = order shipping

---

*Last Updated: 2025-12-10*  
*Based on: PHONEPE_PAYMENT_IMPLEMENTATION_GUIDE_PREVIOUS.md*

