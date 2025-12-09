# GST Implementation Guide - Complete Reference

## 📋 Overview

This document provides a complete reference for implementing GST (Goods and Services Tax) calculation in the order system.

---

## 🎯 Why This Implementation?

### The Problem:
- Product prices are **GST-inclusive** (customer sees final price including GST)
- We need to **extract and store GST breakdown** for invoicing and compliance
- We need to determine **CGST/SGST vs IGST** based on delivery location

### The Solution:
- Add new fields to store GST breakdown at both orderline and order level
- Create `gst_hsn_mapping` table to store GST rates by product category
- Use delivery address pincode to determine if same state (Tamil Nadu) or different state

---

## 📊 Understanding `items_total`

### The Key Insight:

```
ORDER.orderamount = ₹1000 = Products (₹850) + Shipping (₹150)

⚠️ GST should be calculated on PRODUCTS ONLY, not on shipping!

Therefore: items_total = orderamount - shipping_cost
                       = ₹1000 - ₹150 = ₹850 ← GST calculated on this
```

### Visual Representation:

```
┌──────────────────────────────────────────────────────────────────┐
│           orderamount = ₹1000 (What customer pays)               │
└──────────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┴────────────────┐
          │                                 │
          ▼                                 ▼
┌──────────────────────┐        ┌──────────────────────┐
│  items_total = ₹850  │        │ shipping_cost = ₹150 │
│   (products only)    │        │   NOT in GST calc    │
│   GST calculated     │        │                      │
│   on this amount     │        │                      │
└──────────────────────┘        └──────────────────────┘
          │
          ▼
┌──────────────────────────────────────────────────────┐
│  GST BREAKDOWN:                                      │
│  ├── total_taxable_amount = ₹783.10 (base, no GST)  │
│  └── total_gst_amount     = ₹66.90  (GST portion)   │
│                                                      │
│  VERIFY: ₹783.10 + ₹66.90 = ₹850 = items_total ✅   │
└──────────────────────────────────────────────────────┘
```

---

## 📋 All New Database Fields

### ORDERLINE Table (7 new fields):

| Field | Type | Formula/Source | Description |
|-------|------|----------------|-------------|
| `hsn_code` | VARCHAR(50) | From `gst_hsn_mapping` | HSN code (null if not found) |
| `gst_rate` | DECIMAL(5,2) | From `gst_hsn_mapping` | GST % (default: 18%) |
| `taxable_amount` | DECIMAL(10,2) | `orderamount / (1 + gst_rate/100)` | Base amount WITHOUT GST |
| `cgst_amount` | DECIMAL(10,2) | `total_gst / 2` (Tamil Nadu) | Central GST |
| `sgst_amount` | DECIMAL(10,2) | `total_gst / 2` (Tamil Nadu) | State GST |
| `igst_amount` | DECIMAL(10,2) | `total_gst` (other states) | Integrated GST |
| `total_gst_amount` | DECIMAL(10,2) | `orderamount - taxable_amount` | Total GST for line |

### ORDER Table (6 new fields):

| Field | Type | Formula/Source | Description |
|-------|------|----------------|-------------|
| `items_total` ⭐ | DECIMAL(10,2) | `orderamount - shipping_cost` | Product-only total (GST base) |
| `total_taxable_amount` | DECIMAL(10,2) | `Σ(orderline.taxable_amount)` | Sum of all base amounts |
| `total_cgst_amount` | DECIMAL(10,2) | `Σ(orderline.cgst_amount)` | Sum of all CGST |
| `total_sgst_amount` | DECIMAL(10,2) | `Σ(orderline.sgst_amount)` | Sum of all SGST |
| `total_igst_amount` | DECIMAL(10,2) | `Σ(orderline.igst_amount)` | Sum of all IGST |
| `total_gst_amount` | DECIMAL(10,2) | `Σ(orderline.total_gst_amount)` | Sum of all GST |

---

## 🧮 Calculation Formulas

### Step 1: Get GST Rate and HSN Code

```
GST Lookup Priority:
1. If product has subsubcategory → lookup by subsubcategory_value
2. Else → lookup by subcategory_value
3. If no match → default to 18% GST, null HSN
```

### Step 2: Calculate GST for Each Orderline

```typescript
// GST-INCLUSIVE PRICING FORMULA:
// Given: orderamount (GST-inclusive price)
// Given: gst_rate (e.g., 5% or 18%)

taxable_amount = orderamount / (1 + gst_rate/100)
total_gst_amount = orderamount - taxable_amount

// Example: orderamount = ₹598.15, gst_rate = 5%
taxable_amount = 598.15 / 1.05 = ₹569.67
total_gst_amount = 598.15 - 569.67 = ₹28.48
```

### Step 3: Split into CGST/SGST or IGST

```typescript
// Tamil Nadu pincodes: 60xxxx - 64xxxx

if (isTamilNadu) {
  cgst_amount = total_gst_amount / 2  // ₹14.24
  sgst_amount = total_gst_amount / 2  // ₹14.24
  igst_amount = 0
} else {
  cgst_amount = 0
  sgst_amount = 0
  igst_amount = total_gst_amount      // ₹28.48
}
```

### Step 4: Aggregate to Order Level

```typescript
items_total = Σ(orderline.orderamount)  // = orderamount - shipping_cost
total_taxable_amount = Σ(orderline.taxable_amount)
total_cgst_amount = Σ(orderline.cgst_amount)
total_sgst_amount = Σ(orderline.sgst_amount)
total_igst_amount = Σ(orderline.igst_amount)
total_gst_amount = Σ(orderline.total_gst_amount)
```

---

## 🗺️ Tamil Nadu Pincode Detection

```typescript
function isTamilNaduPincode(pincode: string | number): boolean {
  const pin = pincode.toString().trim();
  if (pin.length !== 6) return false;
  
  const prefix = parseInt(pin.substring(0, 2));
  // Tamil Nadu pincodes: 60xxxx to 64xxxx
  return prefix >= 60 && prefix <= 64;
}

// Examples:
isTamilNaduPincode('600001')  // true (Chennai)
isTamilNaduPincode('641001')  // true (Coimbatore)
isTamilNaduPincode('110001')  // false (Delhi)
isTamilNaduPincode('400001')  // false (Mumbai)
```

---

## 📊 Complete Example

### Scenario:

```
Product 1: Incense Sticks (5% GST)
  - orderamount = ₹598.15

Product 2: Essential Oils (18% GST)
  - orderamount = ₹251.85

Delivery: Chennai (600001) - Tamil Nadu
Shipping: ₹150
```

### Calculation:

```
ORDERLINE 1 (5% GST, Tamil Nadu):
─────────────────────────────────
hsn_code        = '33074100'
gst_rate        = 5.00
taxable_amount  = 598.15 / 1.05 = ₹569.67
total_gst_amount = 598.15 - 569.67 = ₹28.48
cgst_amount     = 28.48 / 2 = ₹14.24
sgst_amount     = 28.48 / 2 = ₹14.24
igst_amount     = ₹0.00


ORDERLINE 2 (18% GST, Tamil Nadu):
─────────────────────────────────
hsn_code        = '33012990'
gst_rate        = 18.00
taxable_amount  = 251.85 / 1.18 = ₹213.43
total_gst_amount = 251.85 - 213.43 = ₹38.42
cgst_amount     = 38.42 / 2 = ₹19.21
sgst_amount     = 38.42 / 2 = ₹19.21
igst_amount     = ₹0.00


ORDER AGGREGATION:
─────────────────────────────────
items_total          = 598.15 + 251.85 = ₹850.00 ⭐
shipping_cost        = ₹150.00 (NOT in GST)
orderamount          = ₹1000.00 (UNCHANGED)

total_taxable_amount = 569.67 + 213.43 = ₹783.10
total_cgst_amount    = 14.24 + 19.21 = ₹33.45
total_sgst_amount    = 14.24 + 19.21 = ₹33.45
total_igst_amount    = ₹0.00
total_gst_amount     = 28.48 + 38.42 = ₹66.90


VERIFICATION:
─────────────────────────────────
① items_total (₹850) = orderamount (₹1000) - shipping (₹150) ✅
② taxable + gst (₹783.10 + ₹66.90) = items_total (₹850) ✅
③ cgst + sgst (₹33.45 + ₹33.45) = total_gst (₹66.90) ✅
```

---

## 📊 Different State Example (Delhi - 110001)

```
Same products, delivery to Delhi:

ORDERLINE 1:
cgst_amount = ₹0.00
sgst_amount = ₹0.00
igst_amount = ₹28.48 ✅

ORDERLINE 2:
cgst_amount = ₹0.00
sgst_amount = ₹0.00
igst_amount = ₹38.42 ✅

ORDER:
total_cgst_amount = ₹0.00
total_sgst_amount = ₹0.00
total_igst_amount = ₹66.90 ✅
total_gst_amount = ₹66.90 (same total, different split)
```

---

## 🗄️ Database Schema Changes

### ALTER Statements:

```sql
-- ORDERLINE table - Add 7 new columns
ALTER TABLE "orderline"
ADD COLUMN hsn_code VARCHAR(50),
ADD COLUMN gst_rate DECIMAL(5,2),
ADD COLUMN taxable_amount DECIMAL(10,2),
ADD COLUMN cgst_amount DECIMAL(10,2),
ADD COLUMN sgst_amount DECIMAL(10,2),
ADD COLUMN igst_amount DECIMAL(10,2),
ADD COLUMN total_gst_amount DECIMAL(10,2);

-- ORDERS table - Add 6 new columns
ALTER TABLE "orders"
ADD COLUMN items_total DECIMAL(10,2),
ADD COLUMN total_taxable_amount DECIMAL(10,2),
ADD COLUMN total_cgst_amount DECIMAL(10,2),
ADD COLUMN total_sgst_amount DECIMAL(10,2),
ADD COLUMN total_igst_amount DECIMAL(10,2),
ADD COLUMN total_gst_amount DECIMAL(10,2);
```

### Prisma Schema:

```prisma
model Orderline {
  // ... existing fields ...
  
  // GST fields (NEW)
  hsn_code          String?   @db.VarChar(50)
  gst_rate          Decimal?  @db.Decimal(5, 2)
  taxable_amount    Decimal?  @db.Decimal(10, 2)
  cgst_amount       Decimal?  @db.Decimal(10, 2)
  sgst_amount       Decimal?  @db.Decimal(10, 2)
  igst_amount       Decimal?  @db.Decimal(10, 2)
  total_gst_amount  Decimal?  @db.Decimal(10, 2)
  
  @@map("orderline")
}

model Orders {
  // ... existing fields ...
  
  // GST fields (NEW)
  items_total           Decimal?  @db.Decimal(10, 2)
  total_taxable_amount  Decimal?  @db.Decimal(10, 2)
  total_cgst_amount     Decimal?  @db.Decimal(10, 2)
  total_sgst_amount     Decimal?  @db.Decimal(10, 2)
  total_igst_amount     Decimal?  @db.Decimal(10, 2)
  total_gst_amount      Decimal?  @db.Decimal(10, 2)
  
  @@map("orders")
}
```

---

## ✅ Verification Equations

```
ORDERLINE LEVEL:
───────────────────────────────────────────────
① taxable_amount + total_gst_amount = orderamount ✅
② cgst + sgst + igst = total_gst_amount ✅
③ (cgst > 0) XOR (igst > 0) → never both ✅

ORDER LEVEL:
───────────────────────────────────────────────
① items_total = Σ(orderline.orderamount) ✅
② items_total = orderamount - shipping_cost ✅
③ total_taxable + total_gst = items_total ✅
④ orderamount = items_total + shipping (UNCHANGED) ✅
⑤ total_cgst + total_sgst + total_igst = total_gst ✅
```

---

## 📋 Summary

| Concept | Value | Notes |
|---------|-------|-------|
| `items_total` | ₹850 | Product-only total (GST base) |
| `orderamount` | ₹1000 | UNCHANGED (includes shipping) |
| GST Base | `orderline.orderamount` | Excludes shipping |
| Tamil Nadu | 60xxxx - 64xxxx | CGST + SGST |
| Other States | All others | IGST only |
| Default GST | 18% | If no mapping found |
| Default HSN | null | If no mapping found |

---

## 📁 Related Files

- `GST_HSN_MAPPING_PLAN.md` - Database schema and mapping table
- `PHONEPE_PAYMENT_IMPLEMENTATION_GUIDE.md` - Order creation flow

