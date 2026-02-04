# Product Quantity & Status Fields - Complete Deep Analysis

**Version 1.0** - January 2026  
**Last Updated:** January 2026

## 📋 Overview

This document provides a **comprehensive deep analysis** of all product quantity and status fields, their relationships to stock operations, and how they are updated across all scenarios including:

1. **Stock Addition** (including Platform Stock)
2. **Order Placement** (Single & Combo Orders)
3. **Order Dispatch** (Ready-for-Dispatch)
4. **Order Cancellation** (All Scenarios)

---

## 🗂️ Table of Contents

1. [Quantity Fields Definitions](#quantity-fields-definitions)
2. [Status Fields Definitions](#status-fields-definitions)
3. [Stock Addition Scenarios](#stock-addition-scenarios)
4. [Order Placement Scenarios](#order-placement-scenarios)
5. [Order Dispatch Scenarios](#order-dispatch-scenarios)
6. [Order Cancellation Scenarios](#order-cancellation-scenarios)
7. [Complete Flow Diagrams](#complete-flow-diagrams)
8. [Business Rules & Formulas](#business-rules--formulas)

---

## 📊 Quantity Fields Definitions

### Product Table Quantity Fields

| Field | Type | Description | Calculation Method |
|-------|------|-------------|-------------------|
| `quantity` | `INT` | **Total physical stock count** | Count of ALL stock records (excluding `sold` status) |
| `availablequantity` | `INT` | **Available for sale** | Calculated: `ecompublishedquantity - orderedquantity - soldquantity` |
| `orderedquantity` | `INT` | **Reserved for orders** | Sum of orderline quantities (before dispatch) |
| `soldquantity` | `INT` | **Sold/dispatched** | Count of stocks with `stockstatus = 'sold'` |
| `ecompublishedquantity` | `INT` | **E-commerce published** | Count of stocks where `stockstatus = 'available'` AND `ecompublish = true` |

**Key Formula:**
```
availablequantity = MAX(0, ecompublishedquantity - orderedquantity - soldquantity)
```

### PlatformStock Table Quantity Fields

| Field | Type | Description | Calculation Method |
|-------|------|-------------|-------------------|
| `availableqty` | `INT` | **Available for sale on platform** | Calculated: `ecomqty - orderedqty - soldqty - lockqty` |
| `ecomqty` | `INT` | **E-commerce published quantity** | Count of stocks where `stockstatus = 'available'` AND `ecompublish = true` |
| `orderedqty` | `INT` | **Reserved for orders** | Sum of orderline quantities (before dispatch) |
| `soldqty` | `INT` | **Sold/dispatched** | Count of allocated stocks |
| `totalqty` | `INT` | **Total stock on platform** | Count of ALL stocks for this product+platform (regardless of status or ecompublish) |
| `lockqty` | `INT` | **Locked in cart** | Temporary lock during cart operations (NIVAPP only) |

**Key Formula:**
```
availableqty = ecomqty - orderedqty - soldqty - lockqty
```

**Where:**
- `ecomqty` = Count of stocks where `stockstatus = 'available'` AND `ecompublish = true`
- `totalqty` = Count of ALL stocks (regardless of status or ecompublish)
- Only `ecompublish = true` stocks contribute to `availableqty` (matches Product table logic)

### Stock Table Status Field

| Field | Type | Description | Values |
|-------|------|-------------|--------|
| `stockstatus` | `STRING` | **Stock item status** | `'available'`, `'sold'`, `'damaged'`, `'ordered'` |

---

## 🏷️ Status Fields Definitions

### Product Status (`productstatus`)

| Status | Condition | Description |
|--------|-----------|-------------|
| `'in_stock'` | `availablequantity > 5` | Product has sufficient stock |
| `'low_stock'` | `1 <= availablequantity <= 5` | Product has low stock |
| `'out_of_stock'` | `availablequantity <= 0` | Product has no available stock |

**Calculation:**
```typescript
if (availablequantity > 5) {
  productstatus = 'in_stock'
} else if (availablequantity >= 1) {
  productstatus = 'low_stock'
} else {
  productstatus = 'out_of_stock'
}
```

**Code Reference:**
- `src/services/product.service.ts` → `updateStockTotals()` (Lines 1033-1039)

### PlatformStock Status (`platformstatus`)

| Status | Condition | Description |
|--------|-----------|-------------|
| `'in_stock'` | `availableqty > 5` | Platform has sufficient stock |
| `'low_stock'` | `1 <= availableqty <= 5` | Platform has low stock |
| `'out_of_stock'` | `availableqty <= 0` | Platform has no available stock |

---

## ➕ Stock Addition Scenarios

### Scenario 1: Add New Stock (Available, E-commerce Published)

**When:** New stock item is created with `stockstatus = 'available'` and `ecompublish = true`

**Stock Table:**
| Field | Value |
|-------|-------|
| `stockstatus` | `'available'` |
| `ecompublish` | `true` |
| `puc` | `'PUC-12345'` |
| `platform` | `'nivapp'` |

**Product Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `quantity` | ⬆️ +1 | Count of non-sold stocks |
| `ecompublishedquantity` | ⬆️ +1 | Available AND ecompublish=true |
| `availablequantity` | ⬆️ +1 | Recalculated: `ecompublishedquantity - orderedquantity - soldquantity` |
| `soldquantity` | ➡️ No change | Still 0 |
| `orderedquantity` | ➡️ No change | Still 0 |
| `productstatus` | ✅ Updated | Recalculated based on `availablequantity` |

**PlatformStock Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `totalqty` | ⬆️ +1 | Total stocks for product+platform (ALL stocks) |
| `ecomqty` | ⬆️ +1 | E-commerce published stocks (only if `ecompublish = true`) |
| `availableqty` | ⬆️ +1 | Recalculated: `ecomqty - orderedqty - soldqty - lockqty` |
| `orderedqty` | ➡️ No change | Still 0 |
| `soldqty` | ➡️ No change | Still 0 |
| `lockqty` | ➡️ No change | Still 0 |
| `platformstatus` | ✅ Updated | Recalculated based on `availableqty` |

**Code Reference:**
- `src/services/stock.service.ts` → `create()` (Lines 323-550)
- `src/services/product.service.ts` → `updateStockTotals()` (Lines 903-1123)
- `src/services/platformStock.service.ts` → `updatePlatformStockQuantities()` (Lines 365-575)

---

### Scenario 2: Add New Stock (Available, NOT E-commerce Published)

**When:** New stock item is created with `stockstatus = 'available'` and `ecompublish = false`

**Stock Table:**
| Field | Value |
|-------|-------|
| `stockstatus` | `'available'` |
| `ecompublish` | `false` |
| `puc` | `'PUC-12345'` |
| `platform` | `'nivapp'` |

**Product Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `quantity` | ⬆️ +1 | Count of non-sold stocks |
| `ecompublishedquantity` | ➡️ No change | NOT e-commerce published |
| `availablequantity` | ➡️ No change | Formula: `ecompublishedquantity - orderedquantity - soldquantity` (unchanged) |
| `soldquantity` | ➡️ No change | Still 0 |
| `orderedquantity` | ➡️ No change | Still 0 |
| `productstatus` | ➡️ No change | `availablequantity` unchanged |

**PlatformStock Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `totalqty` | ⬆️ +1 | Total stocks for product+platform (ALL stocks) |
| `ecomqty` | ➡️ No change | NOT e-commerce published (only `ecompublish = true` stocks counted) |
| `availableqty` | ➡️ No change | Recalculated: `ecomqty - orderedqty - soldqty - lockqty` (unchanged) |
| `orderedqty` | ➡️ No change | Still 0 |
| `soldqty` | ➡️ No change | Still 0 |
| `lockqty` | ➡️ No change | Still 0 |
| `platformstatus` | ➡️ No change | `availableqty` unchanged |

**Key Insight:** Stock with `ecompublish = false` increases `totalqty` in PlatformStock, but does NOT increase `ecomqty` or `availableqty` (matching Product table behavior). Only `ecompublish = true` stocks contribute to `ecomqty` and `availableqty`.

---

### Scenario 3: Add New Stock (Sold Status)

**When:** New stock item is created with `stockstatus = 'sold'` (rare, usually for manual entries)

**Stock Table:**
| Field | Value |
|-------|-------|
| `stockstatus` | `'sold'` |
| `ecompublish` | `false` (typically) |
| `puc` | `'PUC-12345'` |
| `platform` | `'nivapp'` |

**Product Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `quantity` | ➡️ No change | Sold stocks excluded from `quantity` |
| `ecompublishedquantity` | ➡️ No change | Sold stocks not e-commerce published |
| `availablequantity` | ➡️ No change | Formula unchanged |
| `soldquantity` | ⬆️ +1 | Count of sold stocks |
| `orderedquantity` | ➡️ No change | Still 0 |
| `productstatus` | ➡️ No change | `availablequantity` unchanged |

**PlatformStock Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `totalqty` | ⬆️ +1 | Total stocks for product+platform (ALL stocks) |
| `ecomqty` | ➡️ No change | Sold stocks are not e-commerce published |
| `availableqty` | ➡️ No change | Recalculated: `ecomqty - orderedqty - soldqty - lockqty` (soldqty increased) |
| `orderedqty` | ➡️ No change | Still 0 |
| `soldqty` | ⬆️ +1 | Count of sold stocks |
| `lockqty` | ➡️ No change | Still 0 |
| `platformstatus` | ➡️ No change | `availableqty` unchanged |

---

## 🛒 Order Placement Scenarios

### Scenario 4: Place Single Product Order (PhonePe Payment Success)

**When:** Customer places order with PhonePe payment, payment succeeds

**Order Flow:**
1. **Order Initiation** (Cart → Order Creation)
2. **Payment Initiation** (PhonePe API call)
3. **Payment Success Callback** (PhonePe webhook)

**Step 1: Order Initiation (Cart Lock - NIVAPP Only)**

**PlatformStock Table Updates (NIVAPP Platform):**
| Field | Change | Calculation |
|-------|--------|-------------|
| `lockqty` | ⬆️ +orderline.quantity | Temporary cart lock |
| `availableqty` | ⬇️ -orderline.quantity | Recalculated: `ecomqty - orderedqty - soldqty - lockqty` (lockqty increased) |
| `ecomqty` | ➡️ No change | Stocks still available, just locked |
| `totalqty` | ➡️ No change | Still same |
| `orderedqty` | ➡️ No change | Still 0 (not ordered yet) |
| `soldqty` | ➡️ No change | Still 0 |
| `platformstatus` | ✅ Updated | Recalculated based on `availableqty` |

**Product Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availablequantity` | ⬇️ -orderline.quantity | Formula: `ecompublishedquantity - orderedquantity - soldquantity` (unchanged, but lock affects availability) |
| `orderedquantity` | ➡️ No change | Still 0 (not ordered yet) |
| `soldquantity` | ➡️ No change | Still 0 |
| `ecompublishedquantity` | ➡️ No change | Still same |
| `quantity` | ➡️ No change | Still same |
| `productstatus` | ✅ Updated | Recalculated based on `availablequantity` |

**Step 2: Payment Success Callback**

**PlatformStock Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `lockqty` | ⬇️ -orderline.quantity | Cart lock released |
| `orderedqty` | ⬆️ +orderline.quantity | Now officially ordered |
| `ecomqty` | ➡️ No change | Stocks still available, just ordered |
| `availableqty` | ➡️ No change | Recalculated: `ecomqty - orderedqty - soldqty - lockqty` (lockqty decreased, orderedqty increased, net unchanged) |
| `totalqty` | ➡️ No change | Still same |
| `soldqty` | ➡️ No change | Still 0 |
| `platformstatus` | ✅ Updated | Recalculated based on `availableqty` |

**Product Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedquantity` | ⬆️ +orderline.quantity | Now officially ordered |
| `availablequantity` | ⬇️ -orderline.quantity | Formula: `ecompublishedquantity - orderedquantity - soldquantity` (orderedquantity increased) |
| `soldquantity` | ➡️ No change | Still 0 |
| `ecompublishedquantity` | ➡️ No change | Still same |
| `quantity` | ➡️ No change | Still same |
| `productstatus` | ✅ Updated | Recalculated based on `availablequantity` |

**Code Reference:**
- `src/controllers/phonepe.controller.ts` → `updateProductQuantitiesAfterOrder()` (Lines 4313-4983)
- `src/services/platformStock.service.ts` → `updatePlatformStockQuantities()` (Lines 365-575)

---

### Scenario 5: Place Combo Product Order (PhonePe Payment Success)

**When:** Customer places order with combo product, payment succeeds

**Combo Product Structure:**
- **Combo Product:** Product ID 88 (virtual product, no physical stock)
- **Component 1:** Product ID 86, `requiredqty = 1`
- **Component 2:** Product ID 87, `requiredqty = 1`

**Order:** 2x Combo Product (Product 88)

**Step 1: Order Initiation (Cart Lock - NIVAPP Only)**

**Component 1 (Product 86) - PlatformStock Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `lockqty` | ⬆️ +4 | `orderline.quantity (2) × requiredqty (1) × 2 components = 4` (actually: 2 × 1 = 2 per component) |
| `availableqty` | ⬇️ -2 | `totalqty - orderedqty - soldqty - lockqty` |
| `orderedqty` | ➡️ No change | Still 0 |

**Component 2 (Product 87) - PlatformStock Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `lockqty` | ⬆️ +2 | `orderline.quantity (2) × requiredqty (1) = 2` |
| `availableqty` | ⬇️ -2 | Recalculated: `ecomqty - orderedqty - soldqty - lockqty` (lockqty increased) |
| `ecomqty` | ➡️ No change | Stocks still available, just locked |
| `orderedqty` | ➡️ No change | Still 0 |

**Combo Product (Product 88) - PlatformStock Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `lockqty` | ➡️ No change | Combo product has no physical stock |
| `availableqty` | ➡️ No change | Combo product has no physical stock |
| `orderedqty` | ➡️ No change | Combo product has no physical stock |

**Step 2: Payment Success Callback**

**Component 1 (Product 86) - PlatformStock Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `lockqty` | ⬇️ -2 | Cart lock released |
| `orderedqty` | ⬆️ +2 | `orderline.quantity (2) × requiredqty (1) = 2` |
| `ecomqty` | ➡️ No change | Stocks still available, just ordered |
| `availableqty` | ➡️ No change | Recalculated: `ecomqty - orderedqty - soldqty - lockqty` (lockqty decreased, orderedqty increased, net unchanged) |

**Component 2 (Product 87) - PlatformStock Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `lockqty` | ⬇️ -2 | Cart lock released |
| `orderedqty` | ⬆️ +2 | `orderline.quantity (2) × requiredqty (1) = 2` |
| `ecomqty` | ➡️ No change | Stocks still available, just ordered |
| `availableqty` | ➡️ No change | Recalculated: `ecomqty - orderedqty - soldqty - lockqty` (lockqty decreased, orderedqty increased, net unchanged) |

**Combo Product (Product 88) - PlatformStock Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `lockqty` | ➡️ No change | Combo product has no physical stock |
| `orderedqty` | ➡️ No change | Combo product has no physical stock |
| `availableqty` | ➡️ No change | Combo product has no physical stock |

**Component 1 (Product 86) - Product Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedquantity` | ⬆️ +2 | `orderline.quantity (2) × requiredqty (1) = 2` |
| `availablequantity` | ⬇️ -2 | Formula: `ecompublishedquantity - orderedquantity - soldquantity` |

**Component 2 (Product 87) - Product Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedquantity` | ⬆️ +2 | `orderline.quantity (2) × requiredqty (1) = 2` |
| `availablequantity` | ⬇️ -2 | Formula: `ecompublishedquantity - orderedquantity - soldquantity` |

**Combo Product (Product 88) - Product Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedquantity` | ➡️ No change | Combo product has no physical stock |
| `availablequantity` | ➡️ No change | Combo product has no physical stock |

**Key Insight:** Combo products are virtual - only component products have stock updates.

**Code Reference:**
- `src/controllers/phonepe.controller.ts` → `convertComboComponentLocksToOrders()` (Lines 4460-4509)

---

### Scenario 6: Place COD Order (No Payment)

**When:** Customer places COD order (no payment required)

**Order Flow:**
1. **Order Creation** (Direct, no payment)
2. **Order Confirmation** (Auto-confirmed)

**PlatformStock Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedqty` | ⬆️ +orderline.quantity | Directly ordered (no lock step) |
| `availableqty` | ⬇️ -orderline.quantity | `totalqty - orderedqty - soldqty - lockqty` |
| `lockqty` | ➡️ No change | COD orders don't use cart lock |
| `totalqty` | ➡️ No change | Still same |
| `soldqty` | ➡️ No change | Still 0 |
| `platformstatus` | ✅ Updated | Recalculated based on `availableqty` |

**Product Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedquantity` | ⬆️ +orderline.quantity | Directly ordered |
| `availablequantity` | ⬇️ -orderline.quantity | Formula: `ecompublishedquantity - orderedquantity - soldquantity` |
| `soldquantity` | ➡️ No change | Still 0 |
| `ecompublishedquantity` | ➡️ No change | Still same |
| `quantity` | ➡️ No change | Still same |
| `productstatus` | ✅ Updated | Recalculated based on `availablequantity` |

**Key Difference:** COD orders skip the cart lock step - go directly to `orderedqty`.

---

## 🚚 Order Dispatch Scenarios

### Scenario 7: Ready-for-Dispatch (Single Product)

**When:** Inventory user marks order as ready for dispatch

**Order Status:** `payment_completed` → `ready_for_dispatch`

**Stock Allocation:**
- System selects available stock items (FIFO or manual selection)
- **IMPORTANT:** Only stocks with `ecompublish = true` are selected/allocated
- Stock items are linked to order and orderline

**Stock Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `stockstatus` | ✅ Changed | `'available'` → `'sold'` |
| `orderid` | ✅ Set | Order ID (String from `orders.orderid`) |
| `orderlinenumber` | ✅ Set | Orderline number (String) |
| `solddate` | ✅ Set | Current timestamp |
| `modifieddate` | ✅ Updated | Current timestamp |

**PlatformStock Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedqty` | ⬇️ -orderline.quantity | Decreases by orderline quantity |
| `soldqty` | ⬆️ +orderline.quantity | Increases by orderline quantity |
| `ecomqty` | ⬇️ -orderline.quantity | Decreases (only if stocks were e-commerce published) |
| `availableqty` | ➡️ Recalculated | Formula: `ecomqty - orderedqty - soldqty - lockqty` |
| `totalqty` | ➡️ No change | Still same |
| `lockqty` | ➡️ No change | Still 0 |
| `platformstatus` | ✅ Updated | Recalculated based on `availableqty` |
| `modifieddate` | ✅ Updated | Current timestamp |

**Note:** `ecomqty` decreases because sold stocks are no longer "available" for e-commerce (they were e-commerce published before being marked as sold).

**Product Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedquantity` | ⬇️ -orderline.quantity | Decreases by orderline quantity |
| `soldquantity` | ⬆️ +orderline.quantity | Increases by orderline quantity |
| `availablequantity` | ➡️ No change | Already reduced during order creation |
| `ecompublishedquantity` | ➡️ No change | Still same |
| `quantity` | ➡️ No change | Still same |
| `productstatus` | ➡️ No change | `availablequantity` unchanged |
| `modifieddate` | ✅ Updated | Current timestamp |

**Code Reference:**
- `src/services/orders.service.ts` → `updateStockForDispatch()` (Lines 1116-1275)

---

### Scenario 8: Ready-for-Dispatch (Combo Product)

**When:** Inventory user marks combo product order as ready for dispatch

**Order:** 2x Combo Product (Product 88)
- Component 1: Product 86, `requiredqty = 1`
- Component 2: Product 87, `requiredqty = 1`

**Stock Allocation:**
- System selects component stock items
- For each combo unit: selects `requiredqty` of each component

**Component 1 (Product 86) - Stock Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `stockstatus` | ✅ Changed | `'available'` → `'sold'` (2 stocks) |
| `orderid` | ✅ Set | Order ID |
| `orderlinenumber` | ✅ Set | Orderline number |
| `solddate` | ✅ Set | Current timestamp |

**Component 2 (Product 87) - Stock Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `stockstatus` | ✅ Changed | `'available'` → `'sold'` (2 stocks) |
| `orderid` | ✅ Set | Order ID |
| `orderlinenumber` | ✅ Set | Orderline number |
| `solddate` | ✅ Set | Current timestamp |

**Component 1 (Product 86) - PlatformStock Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedqty` | ⬇️ -2 | `orderline.quantity (2) × requiredqty (1) = 2` |
| `soldqty` | ⬆️ +2 | `orderline.quantity (2) × requiredqty (1) = 2` |
| `ecomqty` | ⬇️ -2 | Decreases (only if stocks were e-commerce published) |
| `availableqty` | ➡️ Recalculated | Formula: `ecomqty - orderedqty - soldqty - lockqty` |

**Component 2 (Product 87) - PlatformStock Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedqty` | ⬇️ -2 | `orderline.quantity (2) × requiredqty (1) = 2` |
| `soldqty` | ⬆️ +2 | `orderline.quantity (2) × requiredqty (1) = 2` |
| `ecomqty` | ⬇️ -2 | Decreases (only if stocks were e-commerce published) |
| `availableqty` | ➡️ Recalculated | Formula: `ecomqty - orderedqty - soldqty - lockqty` |

**Combo Product (Product 88) - PlatformStock Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedqty` | ➡️ No change | Combo product has no physical stock |
| `soldqty` | ➡️ No change | Combo product has no physical stock |
| `availableqty` | ➡️ No change | Combo product has no physical stock |

**Component 1 (Product 86) - Product Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedquantity` | ⬇️ -2 | `orderline.quantity (2) × requiredqty (1) = 2` |
| `soldquantity` | ⬆️ +2 | `orderline.quantity (2) × requiredqty (1) = 2` |
| `availablequantity` | ➡️ No change | Already reduced during order creation |

**Component 2 (Product 87) - Product Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedquantity` | ⬇️ -2 | `orderline.quantity (2) × requiredqty (1) = 2` |
| `soldquantity` | ⬆️ +2 | `orderline.quantity (2) × requiredqty (1) = 2` |
| `availablequantity` | ➡️ No change | Already reduced during order creation |

**Combo Product (Product 88) - Product Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedquantity` | ➡️ No change | Combo product has no physical stock |
| `soldquantity` | ➡️ No change | Combo product has no physical stock |
| `availablequantity` | ➡️ No change | Combo product has no physical stock |

**Code Reference:**
- `src/services/orders.service.ts` → `updateStockForDispatch()` (Lines 1116-1275)
- Combo product handling: Lines 1146-1204

---

## ❌ Order Cancellation Scenarios

### Scenario 9: Cancel Order (Before Ready-for-Dispatch)

**When:** Customer/admin cancels order before dispatch

**Order Status:** `payment_completed` → `cancelled`

**Stock State:** Stock is in `orderedqty` (reserved but not allocated to specific stock units)

**PlatformStock Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availableqty` | ⬆️ +orderline.quantity | Recalculated: `ecomqty - orderedqty - soldqty - lockqty` |
| `orderedqty` | ⬇️ -orderline.quantity | Decremented: `Math.max(0, currentOrderedQty - quantity)` |
| `ecomqty` | ➡️ No change | Stocks still available, just not ordered anymore |
| `soldqty` | ➡️ No change | Still 0 |
| `totalqty` | ➡️ No change | Still same |
| `lockqty` | ➡️ No change | Still 0 |
| `platformstatus` | ✅ Updated | Recalculated based on `availableqty` |

**Code Reference:**
- `src/services/orders.service.ts` → `cancelOrderBeforeReadyForDispatch()` (Lines 3852-4041)
- Lines 3989-3996: Direct increment/decrement updates

**Product Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availablequantity` | ⬆️ +orderline.quantity | Incremented directly: `currentAvailableQuantity + quantity` |
| `orderedquantity` | ⬇️ -orderline.quantity | Decremented: `Math.max(0, currentOrderedQuantity - quantity)` |
| `soldquantity` | ➡️ No change | Still 0 |
| `ecompublishedquantity` | ➡️ No change | Still same |
| `quantity` | ➡️ No change | Still same |
| `productstatus` | ✅ Updated | Recalculated based on `availablequantity` |

**Note:** `availablequantity` is incremented directly during cancellation (not recalculated using formula). This is mathematically equivalent since `orderedquantity` decreases, which increases `availablequantity` in the formula: `ecompublishedquantity - orderedquantity - soldquantity`.

**Stock Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `stockstatus` | ➡️ No change | Still `'available'` (no stock allocation) |
| `orderid` | ➡️ No change | Still `NULL` |
| `orderlinenumber` | ➡️ No change | Still `NULL` |

**Code Reference:**
- `src/services/orders.service.ts` → `cancelOrderBeforeReadyForDispatch()` (Lines 2020-2137)

---

### Scenario 10: Cancel Order (After Ready-for-Dispatch)

**When:** Customer/admin cancels order after dispatch

**Order Status:** `ready_for_dispatch` → `cancelled`

**Stock State:** Stock is in `soldqty` (allocated to specific stock units)

**Stock Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `stockstatus` | ✅ Changed | `'sold'` → `'available'` |
| `orderid` | ✅ Cleared | `NULL` |
| `orderlinenumber` | ✅ Cleared | `NULL` |
| `solddate` | ✅ Cleared | `NULL` |
| `modifieddate` | ✅ Updated | Current timestamp |

**PlatformStock Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availableqty` | ⬆️ +orderline.quantity | Recalculated: `ecomqty - orderedqty - soldqty - lockqty` |
| `soldqty` | ⬇️ -orderline.quantity | Decremented: `Math.max(0, currentSoldQty - quantity)` |
| `ecomqty` | ⬆️ +orderline.quantity | Increases (only if stocks were e-commerce published) |
| `orderedqty` | ➡️ No change | Still 0 (was already converted to soldqty) |
| `totalqty` | ➡️ No change | Still same |
| `lockqty` | ➡️ No change | Still 0 |
| `platformstatus` | ✅ Updated | Recalculated based on `availableqty` |

**Note:** `ecomqty` increases because stocks are back to 'available' status (if they were e-commerce published).

**Code Reference:**
- `src/services/orders.service.ts` → `cancelOrderAfterReadyForDispatch()` (Lines 4047-4284)
- Lines 4232-4239: Direct increment/decrement updates

**Product Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availablequantity` | ⬆️ +orderline.quantity | Incremented directly: `currentAvailableQuantity + quantity` |
| `soldquantity` | ⬇️ -orderline.quantity | Decremented: `Math.max(0, currentSoldQuantity - quantity)` |
| `orderedquantity` | ➡️ No change | Still 0 (was already converted to soldquantity) |
| `ecompublishedquantity` | ➡️ No change | Still same |
| `quantity` | ➡️ No change | Still same |
| `productstatus` | ✅ Updated | Recalculated based on `availablequantity` |

**Note:** `availablequantity` is incremented directly during cancellation (not recalculated using formula). This is mathematically equivalent since `soldquantity` decreases, which increases `availablequantity` in the formula: `ecompublishedquantity - orderedquantity - soldquantity`.

**Code Reference:**
- `src/services/orders.service.ts` → `cancelOrderAfterReadyForDispatch()` (Lines 4047-4284)

---

### Scenario 11: Cancel Combo Product Order (Before Ready-for-Dispatch)

**When:** Customer/admin cancels combo product order before dispatch

**Order:** 2x Combo Product (Product 88)
- Component 1: Product 86, `requiredqty = 1`
- Component 2: Product 87, `requiredqty = 1`

**Component 1 (Product 86) - PlatformStock Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availableqty` | ⬆️ +2 | Incremented: `currentAvailableQty + 2` (where 2 = `orderline.quantity (2) × requiredqty (1)`) |
| `orderedqty` | ⬇️ -2 | Decremented: `Math.max(0, currentOrderedQty - 2)` |
| `soldqty` | ➡️ No change | Still 0 |

**Component 2 (Product 87) - PlatformStock Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availableqty` | ⬆️ +2 | Recalculated: `ecomqty - orderedqty - soldqty - lockqty` |
| `orderedqty` | ⬇️ -2 | Decremented: `Math.max(0, currentOrderedQty - 2)` |
| `ecomqty` | ➡️ No change | Stocks still available, just not ordered anymore |
| `soldqty` | ➡️ No change | Still 0 |

**Combo Product (Product 88) - PlatformStock Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availableqty` | ➡️ No change | Combo product has no physical stock |
| `orderedqty` | ➡️ No change | Combo product has no physical stock |
| `soldqty` | ➡️ No change | Combo product has no physical stock |

**Component 1 (Product 86) - Product Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availablequantity` | ⬆️ +2 | Incremented: `currentAvailableQuantity + 2` (where 2 = `orderline.quantity (2) × requiredqty (1)`) |
| `orderedquantity` | ⬇️ -2 | Decremented: `Math.max(0, currentOrderedQuantity - 2)` |
| `soldquantity` | ➡️ No change | Still 0 |

**Component 2 (Product 87) - Product Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availablequantity` | ⬆️ +2 | Incremented: `currentAvailableQuantity + 2` (where 2 = `orderline.quantity (2) × requiredqty (1)`) |
| `orderedquantity` | ⬇️ -2 | Decremented: `Math.max(0, currentOrderedQuantity - 2)` |
| `soldquantity` | ➡️ No change | Still 0 |

**Combo Product (Product 88) - Product Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availablequantity` | ➡️ No change | Combo product has no physical stock |
| `orderedquantity` | ➡️ No change | Combo product has no physical stock |
| `soldquantity` | ➡️ No change | Combo product has no physical stock |

**Code Reference:**
- `src/services/orders.service.ts` → `cancelOrderBeforeReadyForDispatch()` (Lines 3852-4041)
- Combo product handling: Lines 3881-3957

---

### Scenario 12: Cancel Combo Product Order (After Ready-for-Dispatch)

**When:** Customer/admin cancels combo product order after dispatch

**Order:** 2x Combo Product (Product 88)
- Component 1: Product 86, `requiredqty = 1`
- Component 2: Product 87, `requiredqty = 1`

**Component 1 (Product 86) - Stock Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `stockstatus` | ✅ Changed | `'sold'` → `'available'` (2 stocks) |
| `orderid` | ✅ Cleared | `NULL` |
| `orderlinenumber` | ✅ Cleared | `NULL` |
| `solddate` | ✅ Cleared | `NULL` |

**Component 2 (Product 87) - Stock Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `stockstatus` | ✅ Changed | `'sold'` → `'available'` (2 stocks) |
| `orderid` | ✅ Cleared | `NULL` |
| `orderlinenumber` | ✅ Cleared | `NULL` |
| `solddate` | ✅ Cleared | `NULL` |

**Component 1 (Product 86) - PlatformStock Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availableqty` | ⬆️ +2 | Recalculated: `ecomqty - orderedqty - soldqty - lockqty` |
| `soldqty` | ⬇️ -2 | Decremented: `Math.max(0, currentSoldQty - 2)` |
| `ecomqty` | ⬆️ +2 | Increases (only if stocks were e-commerce published) |
| `orderedqty` | ➡️ No change | Still 0 (was already converted to soldqty) |

**Component 2 (Product 87) - PlatformStock Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availableqty` | ⬆️ +2 | Recalculated: `ecomqty - orderedqty - soldqty - lockqty` |
| `soldqty` | ⬇️ -2 | Decremented: `Math.max(0, currentSoldQty - 2)` |
| `ecomqty` | ⬆️ +2 | Increases (only if stocks were e-commerce published) |
| `orderedqty` | ➡️ No change | Still 0 (was already converted to soldqty) |

**Combo Product (Product 88) - PlatformStock Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availableqty` | ➡️ No change | Combo product has no physical stock |
| `soldqty` | ➡️ No change | Combo product has no physical stock |
| `orderedqty` | ➡️ No change | Combo product has no physical stock |

**Component 1 (Product 86) - Product Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availablequantity` | ⬆️ +2 | Incremented: `currentAvailableQuantity + 2` (where 2 = `orderline.quantity (2) × requiredqty (1)`) |
| `soldquantity` | ⬇️ -2 | Decremented: `Math.max(0, currentSoldQuantity - 2)` |
| `orderedquantity` | ➡️ No change | Still 0 (was already converted to soldquantity) |

**Component 2 (Product 87) - Product Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availablequantity` | ⬆️ +2 | Incremented: `currentAvailableQuantity + 2` (where 2 = `orderline.quantity (2) × requiredqty (1)`) |
| `soldquantity` | ⬇️ -2 | Decremented: `Math.max(0, currentSoldQuantity - 2)` |
| `orderedquantity` | ➡️ No change | Still 0 (was already converted to soldquantity) |

**Combo Product (Product 88) - Product Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availablequantity` | ➡️ No change | Combo product has no physical stock |
| `soldquantity` | ➡️ No change | Combo product has no physical stock |
| `orderedquantity` | ➡️ No change | Combo product has no physical stock |

**Code Reference:**
- `src/services/orders.service.ts` → `cancelOrderAfterReadyForDispatch()` (Lines 4047-4284)
- Combo product handling: Lines 4115-4200

---

## 📈 Complete Flow Diagrams

### Single Product Order - Complete Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. STOCK ADDITION                                                │
│    Stock: available, ecompublish=true                            │
│    Product: quantity +1, ecompublishedquantity +1,              │
│             availablequantity +1                                 │
│    PlatformStock: totalqty +1, availableqty +1                  │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. ORDER PLACEMENT (PhonePe)                                     │
│    Step 2a: Cart Lock (NIVAPP only)                              │
│      PlatformStock: lockqty +qty, availableqty -qty, ecomqty ➡️ │
│      Product: availablequantity -qty                             │
│    Step 2b: Payment Success                                      │
│      PlatformStock: lockqty -qty, orderedqty +qty, ecomqty ➡️   │
│      Product: orderedquantity +qty, availablequantity -qty       │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. READY-FOR-DISPATCH                                            │
│    Stock: stockstatus 'available' → 'sold' (only ecompublish=true)│
│           orderid, orderlinenumber set                           │
│    PlatformStock: orderedqty -qty, soldqty +qty, ecomqty -qty   │
│    Product: orderedquantity -qty, soldquantity +qty                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. ORDER SHIPPED (EKART Webhook)                                 │
│    Order: orderstatus 'ready_for_dispatch' → 'shipped'           │
│    (No quantity changes - already allocated)                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. ORDER DELIVERED (EKART Webhook)                               │
│    Order: orderstatus 'shipped' → 'delivered'                    │
│    (No quantity changes - already allocated)                     │
└─────────────────────────────────────────────────────────────────┘

ALTERNATIVE PATH: CANCELLATION
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6a. CANCEL (Before Dispatch)                                     │
│     PlatformStock: orderedqty -qty, availableqty +qty, ecomqty ➡️│
│     Product: orderedquantity -qty, availablequantity +qty        │
│     Stock: No changes (not allocated)                           │
└─────────────────────────────────────────────────────────────────┘
                            OR
┌─────────────────────────────────────────────────────────────────┐
│ 6b. CANCEL (After Dispatch)                                       │
│     Stock: stockstatus 'sold' → 'available'                      │
│            orderid, orderlinenumber cleared                      │
│     PlatformStock: soldqty -qty, ecomqty +qty, availableqty +qty │
│     Product: soldquantity -qty, availablequantity +qty           │
└─────────────────────────────────────────────────────────────────┘
```

---

### Combo Product Order - Complete Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. STOCK ADDITION (Components Only)                              │
│    Component 1 (Product 86):                                     │
│      Stock: available, ecompublish=true                          │
│      Product: quantity +1, ecompublishedquantity +1,             │
│               availablequantity +1                               │
│      PlatformStock: totalqty +1, ecomqty +1, availableqty +1     │
│    Component 2 (Product 87):                                     │
│      Stock: available, ecompublish=true                          │
│      Product: quantity +1, ecompublishedquantity +1,             │
│               availablequantity +1                               │
│      PlatformStock: totalqty +1, ecomqty +1, availableqty +1    │
│    Combo Product (Product 88):                                   │
│      NO STOCK CHANGES (virtual product)                         │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. ORDER PLACEMENT (PhonePe) - 2x Combo                          │
│    Step 2a: Cart Lock (NIVAPP only)                             │
│      Component 1: lockqty +2, availableqty -2, ecomqty ➡️       │
│      Component 2: lockqty +2, availableqty -2, ecomqty ➡️       │
│      Combo: NO CHANGES                                           │
│    Step 2b: Payment Success                                      │
│      Component 1: lockqty -2, orderedqty +2, ecomqty ➡️         │
│      Component 2: lockqty -2, orderedqty +2, ecomqty ➡️          │
│      Combo: NO CHANGES                                           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. READY-FOR-DISPATCH                                            │
│    Component 1:                                                  │
│      Stock: 2 stocks 'available' → 'sold' (only ecompublish=true) │
│      PlatformStock: orderedqty -2, soldqty +2, ecomqty -2       │
│      Product: orderedquantity -2, soldquantity +2                │
│    Component 2:                                                  │
│      Stock: 2 stocks 'available' → 'sold' (only ecompublish=true)│
│      PlatformStock: orderedqty -2, soldqty +2, ecomqty -2       │
│      Product: orderedquantity -2, soldquantity +2                │
│    Combo: NO CHANGES                                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. ORDER SHIPPED & DELIVERED                                     │
│    (Same as single product - no quantity changes)                │
└─────────────────────────────────────────────────────────────────┘

ALTERNATIVE PATH: CANCELLATION
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5a. CANCEL (Before Dispatch)                                     │
│     Component 1: orderedqty -2, availableqty +2, ecomqty ➡️     │
│     Component 2: orderedqty -2, availableqty +2, ecomqty ➡️      │
│     Combo: NO CHANGES                                            │
└─────────────────────────────────────────────────────────────────┘
                            OR
┌─────────────────────────────────────────────────────────────────┐
│ 5b. CANCEL (After Dispatch)                                      │
│     Component 1:                                                 │
│       Stock: 2 stocks 'sold' → 'available'                       │
│       PlatformStock: soldqty -2, ecomqty +2, availableqty +2    │
│       Product: soldquantity -2, availablequantity +2             │
│     Component 2:                                                 │
│       Stock: 2 stocks 'sold' → 'available'                       │
│       PlatformStock: soldqty -2, ecomqty +2, availableqty +2    │
│       Product: soldquantity -2, availablequantity +2              │
│     Combo: NO CHANGES                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📐 Business Rules & Formulas

### Product Available Quantity Formula

```
availablequantity = MAX(0, ecompublishedquantity - orderedquantity - soldquantity)
```

**Where:**
- `ecompublishedquantity` = Count of stocks where `stockstatus = 'available'` AND `ecompublish = true`
- `orderedquantity` = Sum of orderline quantities (before dispatch)
- `soldquantity` = Count of stocks where `stockstatus = 'sold'`

**Key Insight:** Available quantity is NOT a direct count - it's calculated using the formula above.

---

### PlatformStock Available Quantity Formula

**Conceptual Formula:**
```
availableqty = ecomqty - orderedqty - soldqty - lockqty
```

**Implementation:**
- `availableqty` is **recalculated** using the formula (not incremented directly)
- Updates use: `newAvailableQty = Math.max(0, newEcomQty - currentOrderedQty - newSoldQty - currentLockQty)`
- The formula ensures data integrity and consistency

**Where:**
- `ecomqty` = Count of stocks where `stockstatus = 'available'` AND `ecompublish = true`
- `totalqty` = Count of ALL stocks for this product+platform (regardless of status or ecompublish)
- `orderedqty` = Sum of orderline quantities (before dispatch)
- `soldqty` = Count of allocated stocks
- `lockqty` = Temporary cart lock (NIVAPP only)

**Code Reference:**
- `src/services/platformStock.service.ts` → `updatePlatformStockQuantities()` (Lines 365-575)
- Formula-based recalculation: `newAvailableQty = Math.max(0, newEcomQty - currentOrderedQty - newSoldQty - currentLockQty)`

---

### Combo Product Quantity Calculation

**For Order Quantity:**
```
componentQty = orderline.quantity × requiredqty
```

**Example:**
- Order: 2x Combo Product (Product 88)
- Component 1: `requiredqty = 1` → `componentQty = 2 × 1 = 2`
- Component 2: `requiredqty = 1` → `componentQty = 2 × 1 = 2`

**Key Rule:** Combo products are virtual - only component products have physical stock.

---

### Product Status Calculation

```typescript
if (availablequantity > 5) {
  productstatus = 'in_stock'
} else if (availablequantity >= 1) {
  productstatus = 'low_stock'
} else {
  productstatus = 'out_of_stock'
}
```

---

### PlatformStock Status Calculation

```typescript
if (availableqty === 0) {
  platformstatus = 'out_of_stock'
} else if (availableqty > 5) {
  platformstatus = 'in_stock'
} else {
  platformstatus = 'low_stock'
}
```

**Code Reference:**
- `src/services/platformStock.service.ts` → `calculatePlatformStatus()` (Lines 31-39)

---

## 🔄 Quantity Update Triggers

### Product Quantity Updates

**Triggered By:**
1. Stock creation (`StockService.create()`)
2. Stock update (`StockService.update()`)
3. Stock deletion (`StockService.delete()`)
4. Stock status change (`stockstatus` field)
5. Stock e-commerce publish change (`ecompublish` field)
6. Stock PUC change (product relationship change)

**Method:** `ProductService.updateStockTotals()`

---

### PlatformStock Quantity Updates

**Triggered By:**
1. Stock creation with platform (`StockService.create()`)
2. Stock update with platform change (`StockService.update()`)
3. Stock deletion with platform (`StockService.delete()`)
4. Stock status change (`stockstatus` field)
5. Stock e-commerce publish change (`ecompublish` field)
6. Stock platform transfer (`platform` field change)
7. Order placement (`PhonePeController.updateProductQuantitiesAfterOrder()`)
8. Order dispatch (`OrdersService.updateStockForDispatch()`)
9. Order cancellation (`OrdersService.cancelOrder()`)

**Method:** `PlatformStockService.updatePlatformStockQuantities()`

---

## ⚠️ Important Notes

### 1. Available Quantity Calculation

**Product Table:**
- `availablequantity` is **NOT** a direct count
- **Recalculated** in `updateStockTotals()`: `ecompublishedquantity - orderedquantity - soldquantity`
- **Incremented directly** during cancellation (mathematically equivalent)
- Stocks with `ecompublish = false` do NOT contribute to `availablequantity`

**PlatformStock Table:**
- `availableqty` is **recalculated** using formula: `ecomqty - orderedqty - soldqty - lockqty`
- **Implementation:** `newAvailableQty = Math.max(0, newEcomQty - currentOrderedQty - newSoldQty - currentLockQty)`
- **IMPORTANT:** Only stocks with `ecompublish = true` contribute to `ecomqty` and `availableqty` (matches Product table logic)
- `totalqty` includes ALL stocks (regardless of status or ecompublish)
- `ecomqty` = Count of stocks where `stockstatus = 'available'` AND `ecompublish = true`
- Formula-based recalculation ensures data integrity and consistency

---

### 2. Combo Product Handling

- Combo products are **virtual** - no physical stock
- Only **component products** have stock updates
- Component quantities calculated: `orderline.quantity × requiredqty`
- Combo product itself has **NO** stock changes

---

### 3. Order Placement Flow

**PhonePe Orders:**
1. Cart Lock (NIVAPP only) → `lockqty` increases
2. Payment Success → `lockqty` decreases, `orderedqty` increases

**COD Orders:**
1. Direct Order → `orderedqty` increases (no lock step)

---

### 4. Order Dispatch Flow

**Before Dispatch:**
- Stock in `orderedqty` (reserved, not allocated)

**After Dispatch:**
- Stock in `soldqty` (allocated to specific stock units)
- Stock records marked as `stockstatus = 'sold'`
- Stock records linked to order (`orderid`, `orderlinenumber`)

---

### 5. Order Cancellation Flow

**Before Dispatch:**
- Restore `orderedqty` → `availableqty`
- No stock record changes (not allocated)

**After Dispatch:**
- Restore `soldqty` → `availableqty`
- Stock records: `stockstatus = 'sold'` → `'available'`
- Stock records: Clear `orderid`, `orderlinenumber`, `solddate`

---

## 📚 Code References

### Key Files

1. **Product Quantity Updates:**
   - `src/services/product.service.ts` → `updateStockTotals()` (Lines 903-1123)

2. **PlatformStock Quantity Updates:**
   - `src/services/platformStock.service.ts` → `updatePlatformStockQuantities()` (Lines 365-575)

3. **Stock Operations:**
   - `src/services/stock.service.ts` → `create()`, `update()`, `delete()` (Lines 323-2160)

4. **Order Placement:**
   - `src/controllers/phonepe.controller.ts` → `updateProductQuantitiesAfterOrder()` (Lines 4313-4983)

5. **Order Dispatch:**
   - `src/services/orders.service.ts` → `updateStockForDispatch()` (Lines 1116-1275)

6. **Order Cancellation:**
   - `src/services/orders.service.ts` → `cancelOrderBeforeReadyForDispatch()` (Lines 3852-4041)
   - `src/services/orders.service.ts` → `cancelOrderAfterReadyForDispatch()` (Lines 4047-4284)

---

## 🧪 Testing Scenarios

### Test Case 1: Single Product Stock Addition
- [ ] Add stock with `ecompublish = true` → Verify `ecompublishedquantity` increases
- [ ] Add stock with `ecompublish = false` → Verify `ecompublishedquantity` unchanged
- [ ] Add stock with `stockstatus = 'sold'` → Verify `soldquantity` increases

### Test Case 2: Single Product Order Placement
- [ ] Place PhonePe order → Verify cart lock (NIVAPP)
- [ ] Payment success → Verify `orderedqty` increases, `lockqty` decreases
- [ ] Place COD order → Verify `orderedqty` increases (no lock)

### Test Case 3: Single Product Order Dispatch
- [ ] Mark ready-for-dispatch → Verify `orderedqty` decreases, `soldqty` increases
- [ ] Verify stock records: `stockstatus = 'sold'`, `orderid` set

### Test Case 4: Single Product Order Cancellation
- [ ] Cancel before dispatch → Verify `orderedqty` decreases, `availableqty` increases
- [ ] Cancel after dispatch → Verify `soldqty` decreases, `availableqty` increases, stock records cleared

### Test Case 5: Combo Product Order Placement
- [ ] Place combo order → Verify component `lockqty`/`orderedqty` updates
- [ ] Verify combo product has NO stock changes

### Test Case 6: Combo Product Order Dispatch
- [ ] Mark ready-for-dispatch → Verify component stock allocation
- [ ] Verify combo product has NO stock changes

### Test Case 7: Combo Product Order Cancellation
- [ ] Cancel before dispatch → Verify component `orderedqty` restoration
- [ ] Cancel after dispatch → Verify component stock restoration
- [ ] Verify combo product has NO stock changes

---

## 📝 Summary

This document provides a **complete deep analysis** of all product quantity and status fields, their relationships to stock operations, and how they are updated across all scenarios including:

✅ **Stock Addition** (Available, E-commerce Published, Sold)  
✅ **Order Placement** (Single Product, Combo Product, PhonePe, COD)  
✅ **Order Dispatch** (Single Product, Combo Product)  
✅ **Order Cancellation** (Before Dispatch, After Dispatch, Single Product, Combo Product)

All scenarios include:
- Detailed field-by-field updates
- Calculation formulas
- Code references
- Flow diagrams
- Business rules

---

**Document Version:** 1.0  
**Last Updated:** January 2026  
**Status:** Complete Analysis

