# Order Amount Calculation - Complete Guide

**Version 1.0** — January 2025  
*Comprehensive guide covering all combinations of shipping, promotions, and product discounts*

---

## 📋 Overview

This document provides a **complete reference** for calculating order amounts considering all possible combinations of:
- ✅ **Product Discounts** (may or may not exist)
- ✅ **Promotional Discounts** (may or may not exist)
- ✅ **Shipping Cost** (free shipping OR shipping fee)

---

## 🎯 Master Formula

### Order-Level Calculation

```typescript
// STEP 1: Calculate base totals
original_total = Σ(orderline.original_price × orderline.quantity)

// STEP 2: Apply product discounts
product_discount_total = Σ(orderline.product_discount_amount)
productamount = original_total - product_discount_total

// STEP 3: Apply promotional discounts
promotion_discount_total = Σ(orderline.promotion_discount_amount)
discountamount = product_discount_total + promotion_discount_total

// STEP 4: Calculate final order amount
items_total = productamount - promotion_discount_total  // Product-only (excludes shipping)
orderamount = items_total + shipping_cost              // Final amount (includes shipping)
```

### Orderline-Level Calculation

```typescript
// PER-UNIT (stored as-is, NOT multiplied)
original_price = base_price

// TOTALS (multiplied by quantity)
product_discount_amount = product_discount × quantity
productamount = (original_price × quantity) - product_discount_amount
promotion_discount_amount = (from breakdown) OR (pro-rata distribution)
discountamount = product_discount_amount + promotion_discount_amount
orderamount = productamount - promotion_discount_amount  // Excludes shipping
shipping_cost = (total_shipping × productamount) / total_productamount  // Pro-rata
```

---

## 📊 Scenario Matrix

### All Possible Combinations

| # | Product Discount | Promotion Discount | Shipping | Description |
|---|------------------|-------------------|----------|-------------|
| 1 | ❌ No | ❌ No | ❌ Free | No discounts, free shipping |
| 2 | ❌ No | ❌ No | ✅ Fee | No discounts, shipping fee |
| 3 | ❌ No | ✅ Yes | ❌ Free | Promotion only, free shipping |
| 4 | ❌ No | ✅ Yes | ✅ Fee | Promotion only, shipping fee |
| 5 | ✅ Yes | ❌ No | ❌ Free | Product discount only, free shipping |
| 6 | ✅ Yes | ❌ No | ✅ Fee | Product discount only, shipping fee |
| 7 | ✅ Yes | ✅ Yes | ❌ Free | All discounts, free shipping |
| 8 | ✅ Yes | ✅ Yes | ✅ Fee | All discounts, shipping fee |

---

## 📝 Detailed Scenarios

### Scenario 1: No Discounts, Free Shipping

**Example:**
- Product: ₹500 × 2 qty
- Product Discount: ₹0
- Promotion Discount: ₹0
- Shipping: ₹0 (Free)

**Calculation:**
```
Orderline:
  original_price = ₹500 (per-unit)
  product_discount_amount = ₹0
  productamount = (500 × 2) - 0 = ₹1000
  promotion_discount_amount = ₹0
  orderamount = 1000 - 0 = ₹1000
  shipping_cost = ₹0

Order:
  original_total = ₹1000
  productamount = ₹1000
  promotion_discount_total = ₹0
  discountamount = ₹0
  shipping_cost = ₹0
  items_total = ₹1000
  orderamount = ₹1000 + ₹0 = ₹1000 ✅
```

**Stored Values:**
```json
{
  "order": {
    "original_total": 1000,
    "productamount": 1000,
    "discountamount": 0,
    "promotion_discount_total": 0,
    "shipping_cost": 0,
    "items_total": 1000,
    "orderamount": 1000
  },
  "orderline": {
    "original_price": 500,
    "quantity": 2,
    "product_discount_amount": 0,
    "productamount": 1000,
    "promotion_discount_amount": 0,
    "orderamount": 1000,
    "shipping_cost": 0
  }
}
```

---

### Scenario 2: No Discounts, Shipping Fee

**Example:**
- Product: ₹500 × 2 qty
- Product Discount: ₹0
- Promotion Discount: ₹0
- Shipping: ₹150

**Calculation:**
```
Orderline:
  original_price = ₹500 (per-unit)
  product_discount_amount = ₹0
  productamount = (500 × 2) - 0 = ₹1000
  promotion_discount_amount = ₹0
  orderamount = 1000 - 0 = ₹1000
  shipping_cost = ₹150 (pro-rata: 100%)

Order:
  original_total = ₹1000
  productamount = ₹1000
  promotion_discount_total = ₹0
  discountamount = ₹0
  shipping_cost = ₹150
  items_total = ₹1000
  orderamount = ₹1000 + ₹150 = ₹1150 ✅
```

**Stored Values:**
```json
{
  "order": {
    "original_total": 1000,
    "productamount": 1000,
    "discountamount": 0,
    "promotion_discount_total": 0,
    "shipping_cost": 150,
    "items_total": 1000,
    "orderamount": 1150
  },
  "orderline": {
    "original_price": 500,
    "quantity": 2,
    "product_discount_amount": 0,
    "productamount": 1000,
    "promotion_discount_amount": 0,
    "orderamount": 1000,
    "shipping_cost": 150
  }
}
```

---

### Scenario 3: Promotion Only, Free Shipping

**Example:**
- Product: ₹500 × 2 qty
- Product Discount: ₹0
- Promotion Discount: ₹200 (flat off coupon)
- Shipping: ₹0 (Free)

**Calculation:**
```
Orderline:
  original_price = ₹500 (per-unit)
  product_discount_amount = ₹0
  productamount = (500 × 2) - 0 = ₹1000
  promotion_discount_amount = ₹200 (100% of promotion)
  orderamount = 1000 - 200 = ₹800
  shipping_cost = ₹0

Order:
  original_total = ₹1000
  productamount = ₹1000
  promotion_discount_total = ₹200
  discountamount = ₹0 + ₹200 = ₹200
  shipping_cost = ₹0
  items_total = ₹1000 - ₹200 = ₹800
  orderamount = ₹800 + ₹0 = ₹800 ✅
```

**Stored Values:**
```json
{
  "order": {
    "original_total": 1000,
    "productamount": 1000,
    "discountamount": 200,
    "promotion_discount_total": 200,
    "shipping_cost": 0,
    "items_total": 800,
    "orderamount": 800
  },
  "orderline": {
    "original_price": 500,
    "quantity": 2,
    "product_discount_amount": 0,
    "productamount": 1000,
    "promotion_discount_amount": 200,
    "orderamount": 800,
    "shipping_cost": 0
  }
}
```

---

### Scenario 4: Promotion Only, Shipping Fee

**Example:**
- Product: ₹500 × 2 qty
- Product Discount: ₹0
- Promotion Discount: ₹200 (flat off coupon)
- Shipping: ₹150

**Calculation:**
```
Orderline:
  original_price = ₹500 (per-unit)
  product_discount_amount = ₹0
  productamount = (500 × 2) - 0 = ₹1000
  promotion_discount_amount = ₹200
  orderamount = 1000 - 200 = ₹800
  shipping_cost = ₹150 (pro-rata: 100%)

Order:
  original_total = ₹1000
  productamount = ₹1000
  promotion_discount_total = ₹200
  discountamount = ₹0 + ₹200 = ₹200
  shipping_cost = ₹150
  items_total = ₹1000 - ₹200 = ₹800
  orderamount = ₹800 + ₹150 = ₹950 ✅
```

**Stored Values:**
```json
{
  "order": {
    "original_total": 1000,
    "productamount": 1000,
    "discountamount": 200,
    "promotion_discount_total": 200,
    "shipping_cost": 150,
    "items_total": 800,
    "orderamount": 950
  },
  "orderline": {
    "original_price": 500,
    "quantity": 2,
    "product_discount_amount": 0,
    "productamount": 1000,
    "promotion_discount_amount": 200,
    "orderamount": 800,
    "shipping_cost": 150
  }
}
```

---

### Scenario 5: Product Discount Only, Free Shipping

**Example:**
- Product: ₹500 × 2 qty
- Product Discount: ₹25 per unit = ₹50 total
- Promotion Discount: ₹0
- Shipping: ₹0 (Free)

**Calculation:**
```
Orderline:
  original_price = ₹500 (per-unit)
  product_discount_amount = ₹25 × 2 = ₹50
  productamount = (500 × 2) - 50 = ₹950
  promotion_discount_amount = ₹0
  orderamount = 950 - 0 = ₹950
  shipping_cost = ₹0

Order:
  original_total = ₹1000
  productamount = ₹950
  promotion_discount_total = ₹0
  discountamount = ₹50 + ₹0 = ₹50
  shipping_cost = ₹0
  items_total = ₹950 - ₹0 = ₹950
  orderamount = ₹950 + ₹0 = ₹950 ✅
```

**Stored Values:**
```json
{
  "order": {
    "original_total": 1000,
    "productamount": 950,
    "discountamount": 50,
    "promotion_discount_total": 0,
    "shipping_cost": 0,
    "items_total": 950,
    "orderamount": 950
  },
  "orderline": {
    "original_price": 500,
    "quantity": 2,
    "product_discount_amount": 50,
    "productamount": 950,
    "promotion_discount_amount": 0,
    "orderamount": 950,
    "shipping_cost": 0
  }
}
```

---

### Scenario 6: Product Discount Only, Shipping Fee

**Example:**
- Product: ₹500 × 2 qty
- Product Discount: ₹25 per unit = ₹50 total
- Promotion Discount: ₹0
- Shipping: ₹150

**Calculation:**
```
Orderline:
  original_price = ₹500 (per-unit)
  product_discount_amount = ₹25 × 2 = ₹50
  productamount = (500 × 2) - 50 = ₹950
  promotion_discount_amount = ₹0
  orderamount = 950 - 0 = ₹950
  shipping_cost = ₹150 (pro-rata: 100%)

Order:
  original_total = ₹1000
  productamount = ₹950
  promotion_discount_total = ₹0
  discountamount = ₹50 + ₹0 = ₹50
  shipping_cost = ₹150
  items_total = ₹950 - ₹0 = ₹950
  orderamount = ₹950 + ₹150 = ₹1100 ✅
```

**Stored Values:**
```json
{
  "order": {
    "original_total": 1000,
    "productamount": 950,
    "discountamount": 50,
    "promotion_discount_total": 0,
    "shipping_cost": 150,
    "items_total": 950,
    "orderamount": 1100
  },
  "orderline": {
    "original_price": 500,
    "quantity": 2,
    "product_discount_amount": 50,
    "productamount": 950,
    "promotion_discount_amount": 0,
    "orderamount": 950,
    "shipping_cost": 150
  }
}
```

---

### Scenario 7: All Discounts, Free Shipping

**Example:**
- Product: ₹500 × 2 qty
- Product Discount: ₹25 per unit = ₹50 total
- Promotion Discount: ₹200 (flat off coupon)
- Shipping: ₹0 (Free)

**Calculation:**
```
Orderline:
  original_price = ₹500 (per-unit)
  product_discount_amount = ₹25 × 2 = ₹50
  productamount = (500 × 2) - 50 = ₹950
  promotion_discount_amount = ₹200
  orderamount = 950 - 200 = ₹750
  shipping_cost = ₹0

Order:
  original_total = ₹1000
  productamount = ₹950
  promotion_discount_total = ₹200
  discountamount = ₹50 + ₹200 = ₹250
  shipping_cost = ₹0
  items_total = ₹950 - ₹200 = ₹750
  orderamount = ₹750 + ₹0 = ₹750 ✅
```

**Stored Values:**
```json
{
  "order": {
    "original_total": 1000,
    "productamount": 950,
    "discountamount": 250,
    "promotion_discount_total": 200,
    "shipping_cost": 0,
    "items_total": 750,
    "orderamount": 750
  },
  "orderline": {
    "original_price": 500,
    "quantity": 2,
    "product_discount_amount": 50,
    "productamount": 950,
    "promotion_discount_amount": 200,
    "orderamount": 750,
    "shipping_cost": 0
  }
}
```

---

### Scenario 8: All Discounts, Shipping Fee (Most Complex)

**Example:**
- Product: ₹500 × 2 qty
- Product Discount: ₹25 per unit = ₹50 total
- Promotion Discount: ₹200 (flat off coupon)
- Shipping: ₹150

**Calculation:**
```
Orderline:
  original_price = ₹500 (per-unit)
  product_discount_amount = ₹25 × 2 = ₹50
  productamount = (500 × 2) - 50 = ₹950
  promotion_discount_amount = ₹200
  orderamount = 950 - 200 = ₹750
  shipping_cost = ₹150 (pro-rata: 100%)

Order:
  original_total = ₹1000
  productamount = ₹950
  promotion_discount_total = ₹200
  discountamount = ₹50 + ₹200 = ₹250
  shipping_cost = ₹150
  items_total = ₹950 - ₹200 = ₹750
  orderamount = ₹750 + ₹150 = ₹900 ✅
```

**Stored Values:**
```json
{
  "order": {
    "original_total": 1000,
    "productamount": 950,
    "discountamount": 250,
    "promotion_discount_total": 200,
    "shipping_cost": 150,
    "items_total": 750,
    "orderamount": 900
  },
  "orderline": {
    "original_price": 500,
    "quantity": 2,
    "product_discount_amount": 50,
    "productamount": 950,
    "promotion_discount_amount": 200,
    "orderamount": 750,
    "shipping_cost": 150
  }
}
```

---

## 🔢 Multi-Product Example (All Discounts + Shipping)

**Example:**
- Product 1: ₹500 × 2 qty, Product Discount: ₹25/unit
- Product 2: ₹400 × 1 qty, Product Discount: ₹0
- Promotion Discount: ₹200 (flat off)
- Shipping: ₹150

**Calculation:**

### Orderline 1 (Product 1)
```
original_price = ₹500 (per-unit)
product_discount_amount = ₹25 × 2 = ₹50
productamount = (500 × 2) - 50 = ₹950
promotion_discount_amount = (950 / 1350) × 200 = ₹140.74 (pro-rata)
orderamount = 950 - 140.74 = ₹809.26
shipping_cost = (150 × 950) / 1350 = ₹105.56 (pro-rata)
```

### Orderline 2 (Product 2)
```
original_price = ₹400 (per-unit)
product_discount_amount = ₹0 × 1 = ₹0
productamount = (400 × 1) - 0 = ₹400
promotion_discount_amount = (400 / 1350) × 200 = ₹59.26 (pro-rata)
orderamount = 400 - 59.26 = ₹340.74
shipping_cost = (150 × 400) / 1350 = ₹44.44 (pro-rata)
```

### Order Totals
```
original_total = (500 × 2) + (400 × 1) = ₹1400
productamount = 950 + 400 = ₹1350
product_discount_total = 50 + 0 = ₹50
promotion_discount_total = 140.74 + 59.26 = ₹200
discountamount = 50 + 200 = ₹250
shipping_cost = 105.56 + 44.44 = ₹150
items_total = 1350 - 200 = ₹1150
orderamount = 1150 + 150 = ₹1300 ✅

Verification:
  Σ(orderline.orderamount) = 809.26 + 340.74 = ₹1150 ✅
  Σ(orderline.shipping_cost) = 105.56 + 44.44 = ₹150 ✅
  orderamount = 1150 + 150 = ₹1300 ✅
```

---

## 📐 Formula Reference

### Universal Formula (All Scenarios)

```typescript
// ORDERLINE LEVEL
original_price = base_price  // PER-UNIT

product_discount_amount = product_discount × quantity  // TOTAL
productamount = (original_price × quantity) - product_discount_amount  // TOTAL

promotion_discount_amount = (from breakdown) OR (pro-rata)  // TOTAL
orderamount = productamount - promotion_discount_amount  // TOTAL (excludes shipping)

shipping_cost = (total_shipping × productamount) / total_productamount  // TOTAL (pro-rata)
// OR shipping_cost = 0 if free shipping

// ORDER LEVEL
original_total = Σ(orderline.original_price × orderline.quantity)

productamount = Σ(orderline.productamount)
product_discount_total = Σ(orderline.product_discount_amount)

promotion_discount_total = Σ(orderline.promotion_discount_amount)
discountamount = product_discount_total + promotion_discount_total

shipping_cost = Σ(orderline.shipping_cost)  // OR 0 if free shipping

items_total = productamount - promotion_discount_total  // Product-only (excludes shipping)
orderamount = items_total + shipping_cost  // Final amount (includes shipping)
```

### Key Rules

1. **`original_price`** = PER-UNIT (never multiply by quantity)
2. **All other amounts** = TOTALS (include quantity)
3. **`orderamount`** (orderline) = excludes shipping
4. **`orderamount`** (order) = includes shipping
5. **`items_total`** = product-only (excludes shipping)
6. **Shipping** = pro-rata distribution OR 0 (free shipping)

---

## ✅ Verification Checklist

For any order calculation, verify:

1. ✅ `order.original_total = Σ(orderline.original_price × orderline.quantity)`
2. ✅ `order.productamount = Σ(orderline.productamount)`
3. ✅ `order.promotion_discount_total = Σ(orderline.promotion_discount_amount)`
4. ✅ `order.discountamount = product_discount_total + promotion_discount_total`
5. ✅ `order.shipping_cost = Σ(orderline.shipping_cost)` OR `0` (free shipping)
6. ✅ `order.items_total = order.productamount - order.promotion_discount_total`
7. ✅ `order.orderamount = order.items_total + order.shipping_cost`
8. ✅ `Σ(orderline.orderamount) = order.items_total`
9. ✅ `Σ(orderline.shipping_cost) = order.shipping_cost`

---

## 🔍 Edge Cases

### Edge Case 1: Free Shipping Promotion

**Scenario:** Promotion includes free shipping (shipping_cost = 0)

**Calculation:**
```
// Same as regular calculation, but shipping_cost = 0
orderamount = items_total + 0 = items_total
```

### Edge Case 2: 100% Promotion Discount

**Scenario:** Promotion discount equals or exceeds product amount

**Calculation:**
```
// Promotion discount cannot exceed product amount
promotion_discount_amount = min(promotion_total, productamount)
orderamount = max(0, productamount - promotion_discount_amount)
```

### Edge Case 3: Multiple Products, One Has Discount

**Scenario:** Product 1 has discount, Product 2 doesn't

**Calculation:**
```
// Each orderline calculated independently
// Promotion distributed pro-rata based on productamount
```

---

## 📊 Summary Table

| Scenario | original_total | productamount | promotion_discount | shipping_cost | items_total | orderamount |
|---------|---------------|---------------|---------------------|---------------|-------------|-------------|
| No discounts, free shipping | 1000 | 1000 | 0 | 0 | 1000 | 1000 |
| No discounts, shipping fee | 1000 | 1000 | 0 | 150 | 1000 | 1150 |
| Promotion only, free shipping | 1000 | 1000 | 200 | 0 | 800 | 800 |
| Promotion only, shipping fee | 1000 | 1000 | 200 | 150 | 800 | 950 |
| Product discount, free shipping | 1000 | 950 | 0 | 0 | 950 | 950 |
| Product discount, shipping fee | 1000 | 950 | 0 | 150 | 950 | 1100 |
| All discounts, free shipping | 1000 | 950 | 200 | 0 | 750 | 750 |
| All discounts, shipping fee | 1000 | 950 | 200 | 150 | 750 | 900 |

---

## 💻 Implementation Reference

### Code Location: `src/controllers/phonepe.controller.ts`

**Key Calculation Points:**

1. **Lines 2405-2448**: Order totals calculation
2. **Lines 2623-2854**: Orderline enrichment with discounts
3. **Lines 2808-2816**: Final order amount calculation

**Formula Implementation:**
```typescript
// Calculate order totals
const originalTotal = cartItems.reduce((total, item) => {
  return total + (item.base_price * item.quantity);
}, 0);

const productDiscountTotal = cartItems.reduce((total, item) => {
  return total + (item.product_discount * item.quantity);
}, 0);

const productAmount = originalTotal - productDiscountTotal;
const promotionDiscountTotal = appliedPromotions.reduce((sum, promo) => {
  return sum + promo.discount_amount;
}, 0);

// Final order amount
const itemsTotal = productAmount - promotionDiscountTotal;
const orderAmount = itemsTotal + shippingCost;
```

---

## ⚠️ Critical Notes

1. **Shipping is ALWAYS added at order level**, never at orderline level in final calculation
2. **`orderline.orderamount`** excludes shipping (product-only)
3. **`order.orderamount`** includes shipping (final amount)
4. **Free shipping** = `shipping_cost = 0` (not null, not undefined)
5. **Promotion discount** applies to `productamount`, not `original_total`
6. **Product discount** applies to `original_total` first, then promotion applies

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Status:** ✅ Complete Reference - All Scenarios Covered

