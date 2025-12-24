# Deep Analysis: Quantity & Status Field Updates Across Product, Stock, and PlatformStock Lifecycle

## Executive Summary

This document provides a comprehensive analysis of how quantity and status fields are updated across **Product**, **Stock**, and **PlatformStock** tables during the entire product lifecycle. Each operation is analyzed to explain **when**, **why**, and **how** each field is updated.

---

## Table of Contents

1. [Quick Reference: Field Update Snapshots](#quick-reference-field-update-snapshots)
2. [Product Creation](#1-product-creation)
3. [Stock Creation](#2-stock-creation)
4. [Order Placement - PhonePe Initiate](#3-order-placement---phonepe-initiate)
5. [Order Placement - PhonePe Callback](#4-order-placement---phonepe-callback)
6. [Order Dispatch (Ready for Dispatch)](#5-order-dispatch-ready-for-dispatch)
7. [Product Update](#6-product-update)
8. [Product Deletion](#7-product-deletion)
9. [Stock Deletion](#8-stock-deletion)
10. [Field Definitions & Business Rules](#9-field-definitions--business-rules)
11. [Summary Tables](#10-summary-tables)

---

## Quick Reference: Field Update Snapshots

### 📦 Product Creation
| Table | Fields Updated | Change |
|-------|---------------|--------|
| **Product** | `quantity`, `availablequantity`, `orderedquantity`, `soldquantity`, `ecompublishedquantity` | ✅ Set to `0` |
| **Product** | `productstatus` | ✅ Set to `'out_of_stock'` |
| **PlatformStock** | `availableqty`, `orderedqty`, `soldqty`, `totalqty`, `lockqty` | ✅ Set to `0` (all platforms) |
| **PlatformStock** | `platformstatus` | ✅ Set to `'out_of_stock'` |
| **Stock** | - | ❌ No updates |

---

### 📥 Stock Creation
| Table | Fields Updated | Change |
|-------|---------------|--------|
| **Stock** | `stockstatus`, `ecompublish`, `puc`, `platform` | ✅ Set from request |
| **Product** | `quantity` | ✅ Recalculated (count all stocks) |
| **Product** | `availablequantity` | ✅ Recalculated (formula) |
| **Product** | `soldquantity` | ✅ Recalculated (count sold stocks) |
| **Product** | `ecompublishedquantity` | ✅ Recalculated (count available + ecompublish) |
| **Product** | `productstatus` | ✅ Recalculated |
| **PlatformStock** | `availableqty`, `totalqty` | ✅ Increases (+1 if available + ecompublish) |
| **PlatformStock** | `platformstatus` | ✅ Recalculated |

---

### 🔒 Order Initiate (PhonePe)
| Table | Fields Updated | Change |
|-------|---------------|--------|
| **PlatformStock** | `availableqty` | ✅ **DECREASES** (by order qty) |
| **PlatformStock** | `lockqty` | ✅ **INCREASES** (by order qty) |
| **PlatformStock** | `modifieddate` | ✅ Updated |
| **Product** | All fields | ❌ **NO CHANGE** (updated in callback) |
| **Stock** | All fields | ❌ **NO CHANGE** |

---

### ✅ Order Callback (Payment Success)
| Table | Fields Updated | Change |
|-------|---------------|--------|
| **PlatformStock** | `availableqty` | ❌ **NO CHANGE** (already reduced) |
| **PlatformStock** | `lockqty` | ✅ **DECREASES** (converted to order) |
| **PlatformStock** | `orderedqty` | ✅ **INCREASES** (confirmed order) |
| **PlatformStock** | `platformstatus` | ✅ Recalculated |
| **Product** | `availablequantity` | ✅ **DECREASES** (by order qty) |
| **Product** | `orderedquantity` | ✅ **INCREASES** (by order qty) |
| **Product** | `productstatus` | ✅ Recalculated |
| **Stock** | All fields | ❌ **NO CHANGE** (updated in dispatch) |

---

### 🚚 Order Dispatch (Ready for Dispatch)
| Table | Fields Updated | Change |
|-------|---------------|--------|
| **Stock** | `stockstatus` | ✅ Changes to `'sold'` |
| **Stock** | `orderid`, `orderlinenumber`, `solddate` | ✅ Set |
| **PlatformStock** | `orderedqty` | ✅ **DECREASES** (by dispatch qty) |
| **PlatformStock** | `soldqty` | ✅ **INCREASES** (by dispatch qty) |
| **PlatformStock** | `availableqty` | ❌ **NO CHANGE** (already reduced) |
| **Product** | `orderedquantity` | ✅ **DECREASES** (by dispatch qty) |
| **Product** | `soldquantity` | ✅ **INCREASES** (by dispatch qty) |
| **Product** | `availablequantity` | ❌ **NO CHANGE** (already reduced) |

---

### ✏️ Product Update
| Table | Fields Updated | Change |
|-------|---------------|--------|
| **Product** | All fields | ⚠️ **CONDITIONAL** (only if provided in request) |
| **Product** | `modifieddate` | ✅ Always updated |
| **PlatformStock** | All fields | ❌ **NO CHANGE** |
| **Stock** | All fields | ❌ **NO CHANGE** |

---

### 🗑️ Product Deletion
| Table | Fields Updated | Change |
|-------|---------------|--------|
| **Product** | All fields | ✅ **DELETED** |
| **PlatformStock** | All fields | ⚠️ **CASCADE DELETE** (depends on FK) |
| **Stock** | All fields | ⚠️ **CASCADE DELETE** (all stocks deleted) |

---

### 🗑️ Stock Deletion
| Table | Fields Updated | Change |
|-------|---------------|--------|
| **Stock** | All fields | ✅ **DELETED** |
| **Product** | `quantity`, `availablequantity`, `soldquantity`, `ecompublishedquantity` | ✅ Recalculated (decreased) |
| **Product** | `productstatus` | ✅ Recalculated |
| **PlatformStock** | `availableqty`, `totalqty`, `soldqty` | ✅ Decreased (if stock was available/sold) |
| **PlatformStock** | `platformstatus` | ✅ Recalculated |

---

### 📊 Order Lifecycle Summary (Initiate → Callback → Dispatch)
| Phase | PlatformStock.availableqty | PlatformStock.lockqty | PlatformStock.orderedqty | PlatformStock.soldqty | Product.availablequantity | Product.orderedquantity | Product.soldquantity |
|-------|---------------------------|----------------------|------------------------|---------------------|-------------------------|----------------------|---------------------|
| **INITIATE** | ⬇️ DECREASES | ⬆️ INCREASES | ➡️ NO CHANGE | ➡️ NO CHANGE | ➡️ NO CHANGE | ➡️ NO CHANGE | ➡️ NO CHANGE |
| **CALLBACK** | ➡️ NO CHANGE | ⬇️ DECREASES | ⬆️ INCREASES | ➡️ NO CHANGE | ⬇️ DECREASES | ⬆️ INCREASES | ➡️ NO CHANGE |
| **DISPATCH** | ➡️ NO CHANGE | ➡️ NO CHANGE | ⬇️ DECREASES | ⬆️ INCREASES | ➡️ NO CHANGE | ⬇️ DECREASES | ⬆️ INCREASES |

**Legend:** ⬆️ Increases | ⬇️ Decreases | ➡️ No Change

---

## 1. Product Creation

**Endpoint:** `POST /v1/products`  
**Location:** `src/services/product.service.ts` → `create()` method (lines 231-284)

### When
- New product is created via API
- Product record is inserted into database

### Why
- Initialize product with default values
- Create default platform stock records for all platforms (amazon, flipkart, nivapp)
- Set up initial quantity tracking structure

### How Fields Are Updated

#### Product Table

| Field | Update | Value | Calculation Method |
|-------|--------|-------|-------------------|
| `quantity` | ✅ Set | `0` | Initial value (no stocks yet) |
| `availablequantity` | ✅ Set | `0` | Initial value |
| `orderedquantity` | ✅ Set | `0` | Initial value |
| `soldquantity` | ✅ Set | `0` | Initial value |
| `ecompublishedquantity` | ✅ Set | `0` | Initial value |
| `productstatus` | ✅ Set | `'out_of_stock'` | Calculated: `availablequantity = 0` → `'out_of_stock'` |
| `modifieddate` | ✅ Set | Current timestamp | `BigInt(Date.now())` |

**Code Reference:**
```typescript
// src/services/product.service.ts:231-284
const product = await dynamicCreate('product', data);
await this.createDefaultPlatformStocks(product.id);
```

#### PlatformStock Table (Auto-Created)

For each platform (`amazon`, `flipkart`, `nivapp`):

| Field | Update | Value | Calculation Method |
|-------|--------|-------|-------------------|
| `availableqty` | ✅ Set | `0` | Initial value |
| `orderedqty` | ✅ Set | `0` | Initial value |
| `soldqty` | ✅ Set | `0` | Initial value |
| `totalqty` | ✅ Set | `0` | Initial value |
| `lockqty` | ✅ Set | `0` | Initial value |
| `platformstatus` | ✅ Set | `'out_of_stock'` | Calculated: `availableqty = 0` → `'out_of_stock'` |
| `createddate` | ✅ Set | Current timestamp | `BigInt(Date.now())` |
| `modifieddate` | ✅ Set | Current timestamp | `BigInt(Date.now())` |

**Code Reference:**
```typescript
// src/services/product.service.ts:917-969
private async createDefaultPlatformStocks(productId: number | string) {
  const platformStockDefaults = {
    productid: numericId,
    availableqty: 0,
    orderedqty: 0,
    soldqty: 0,
    totalqty: 0,
    lockqty: 0,
    platformstatus: this.calculatePlatformStatus(0), // 'out_of_stock'
  };
  
  for (const platform of DEFAULT_PLATFORM_STOCK_PLATFORMS) {
    await dynamicCreate('platformstock', {
      ...platformStockDefaults,
      platform,
    });
  }
}
```

#### Stock Table
- ❌ **No updates** - Stock records are created separately

---

## 2. Stock Creation

**Endpoint:** `POST /v1/stocks` or `POST /v1/stocks/bulk-insert`  
**Location:** `src/services/stock.service.ts` → `create()` method (lines 252-445)

### When
- New stock record is created (single or bulk)
- Stock is linked to product via `puc` (Product Unique Code)

### Why
- Add physical inventory items to system
- Update product quantities based on new stock
- Update platform-specific quantities if stock has platform and ecompublish flags

### How Fields Are Updated

#### Stock Table

| Field | Update | Value | Source |
|-------|--------|-------|--------|
| `stockstatus` | ✅ Set | `'available'` (default) | From request or default |
| `ecompublish` | ✅ Set | `false` (default) | From request or default |
| `puc` | ✅ Set | Product PUC | From request (required) |
| `platform` | ✅ Set | Platform name | From request (required) |
| `createddate` | ✅ Set | Current timestamp | `BigInt(Date.now())` |
| `modifieddate` | ✅ Set | Current timestamp | `BigInt(Date.now())` |

**Code Reference:**
```typescript
// src/services/stock.service.ts:252-445
const stock = await dynamicCreate("stock", data);
```

#### Product Table

**Recalculation Trigger:** After stock creation, `updateStockTotals()` is called

| Field | Update | Calculation Method |
|-------|--------|-------------------|
| `quantity` | ✅ Recalculated | **Count of ALL stock records** (regardless of status) |
| `availablequantity` | ✅ Recalculated | **Formula:** `ecompublishedquantity - orderedquantity - soldquantity` |
| `soldquantity` | ✅ Recalculated | **Count of stocks** where `stockstatus = 'sold'` |
| `ecompublishedquantity` | ✅ Recalculated | **Count of stocks** where `stockstatus = 'available'` AND `ecompublish = true` |
| `orderedquantity` | ⚠️ Conditional | Only updated if stock status changes to 'sold' (decreases by 1) |
| `productstatus` | ✅ Recalculated | Based on `availablequantity`: `> 5` = `'in_stock'`, `1-5` = `'low_stock'`, `0` = `'out_of_stock'` |
| `modifieddate` | ✅ Updated | `BigInt(Date.now())` |

**Business Logic:**
```typescript
// src/services/product.service.ts:359-574
// Count each stock record as 1 unit
stocks.forEach(stock => {
  totalQuantity += 1; // Count all stocks
  
  if (stock.stockstatus?.toLowerCase() === 'available') {
    if (stock.ecompublish === true) {
      totalEcomPublished += 1;
      totalAvailable += 1;
    }
  } else if (stock.stockstatus?.toLowerCase() === 'sold') {
    totalSold += 1;
  }
});

// Calculate availablequantity using business formula
const calculatedAvailableQuantity = Math.max(0, 
  totals.totalEcomPublished - orderedQuantity - totals.totalSold
);
```

**Code Reference:**
```typescript
// src/services/stock.service.ts:338
const updateResult = await this.productService.updateStockTotals(
  productIdentifier, 
  insertedStockInfo
);
```

#### PlatformStock Table

**Update Trigger:** If stock has `platform` and product ID is found

| Field | Update | Calculation Method |
|-------|--------|-------------------|
| `availableqty` | ✅ Updated | **Increases by 1** if `stockstatus = 'available'` AND `ecompublish = true` |
| `totalqty` | ✅ Updated | **Increases by 1** if `stockstatus = 'available'` |
| `soldqty` | ❌ No Change | Not updated during stock creation |
| `orderedqty` | ❌ No Change | Not updated during stock creation |
| `lockqty` | ❌ No Change | Not updated during stock creation |
| `platformstatus` | ✅ Recalculated | Based on new `availableqty`: `> 5` = `'in_stock'`, `1-5` = `'low_stock'`, `0` = `'out_of_stock'` |
| `modifieddate` | ✅ Updated | `BigInt(Date.now())` |

**Code Reference:**
```typescript
// src/services/stock.service.ts:376-385
await this.platformStockService.updatePlatformStockQuantities(
  Number(linkedProduct.id),
  stock.platform,
  {
    ecompublish: stock.ecompublish,
    stockstatus: stock.stockstatus,
    quantity: stock.quantity || 1,
    operation: 'create'
  }
);
```

**PlatformStock Update Logic:**
```typescript
// src/services/platformStock.service.ts:393-401
case 'create':
  const quantityToAdd = stockInfo.quantity || 1;
  if (stockInfo.stockstatus === 'available') {
    totalQtyChange = quantityToAdd; // +1
    if (stockInfo.ecompublish) {
      availableQtyChange = quantityToAdd; // +1
    }
  }
  break;
```

---

## 3. Order Placement - PhonePe Initiate

**Endpoint:** `POST /v1/phonepe/initiate`  
**Location:** `src/controllers/phonepe.controller.ts` → `initiatePayment()` method (lines 200-700)

### When
- User initiates payment (PhonePe or COD)
- After all validations pass (promotions, products, stock availability)
- **BEFORE** payment gateway redirect or COD order creation

### Why
- **Reserve stock** to prevent race conditions (multiple users buying same product)
- Lock inventory during payment process
- Prevent overselling

### How Fields Are Updated

#### PlatformStock Table

| Field | Update | Calculation Method |
|-------|--------|-------------------|
| `availableqty` | ✅ **DECREASES** | `currentAvailableQty - requestedQuantity` |
| `lockqty` | ✅ **INCREASES** | `currentLockQty + requestedQuantity` |
| `orderedqty` | ❌ **NO CHANGE** | Not updated during initiate (updated in callback) |
| `soldqty` | ❌ **NO CHANGE** | Not updated during initiate |
| `totalqty` | ❌ **NO CHANGE** | Not updated during initiate |
| `platformstatus` | ❌ **NO CHANGE** | Not recalculated during initiate |
| `modifieddate` | ✅ **UPDATED** | `BigInt(Date.now())` |

**Code Reference:**
```typescript
// src/controllers/phonepe.controller.ts:592-608
const newAvailableQty = currentAvailableQty - requestedQuantity;
const newLockQty = currentLockQty + requestedQuantity;

await tx.platformStock.update({
  where: { productid_platform: {...} },
  data: {
    availableqty: newAvailableQty,  // DECREASES
    lockqty: newLockQty,             // INCREASES
    modifieddate: BigInt(Date.now())
  }
});
```

**Important Notes:**
- Uses **row-level locking** (`SELECT FOR UPDATE`) to prevent race conditions
- Transaction ensures atomicity (all products locked or none)
- Stock is **reserved but not yet ordered** (order created in callback)

#### Product Table

| Field | Update | Notes |
|-------|--------|-------|
| `availablequantity` | ❌ **NO CHANGE** | Updated in callback after payment success |
| `orderedquantity` | ❌ **NO CHANGE** | Updated in callback after payment success |
| `soldquantity` | ❌ **NO CHANGE** | Not updated during initiate |
| `quantity` | ❌ **NO CHANGE** | Not updated during initiate |
| `ecompublishedquantity` | ❌ **NO CHANGE** | Not updated during initiate |
| `productstatus` | ❌ **NO CHANGE** | Not updated during initiate |
| `modifieddate` | ❌ **NO CHANGE** | Not updated during initiate |

**Why Product is NOT Updated:**
- Payment might fail or be abandoned
- Stock lock will be released if payment doesn't complete
- Product quantities updated only after **confirmed payment** (in callback)

#### Stock Table

| Field | Update | Notes |
|-------|--------|-------|
| `stockstatus` | ❌ **NO CHANGE** | Stock status unchanged during initiate |
| `ecompublish` | ❌ **NO CHANGE** | Not updated during initiate |
| `orderid` | ❌ **NO CHANGE** | Order not created yet |
| `orderlinenumber` | ❌ **NO CHANGE** | Orderline not created yet |

---

## 4. Order Placement - PhonePe Callback

**Endpoint:** `POST /v1/phonepe/callback/:transactionId`  
**Location:** `src/controllers/phonepe.controller.ts` → callback handler (lines 495-902) and `updateProductQuantitiesAfterOrder()` (lines 3801-4358)

### When
- PhonePe redirects user back after payment
- Payment status is **SUCCESS**
- Order and orderlines are created
- **AFTER** payment is confirmed

### Why
- Convert **locked stock** to **ordered stock**
- Update product quantities to reflect confirmed order
- Track ordered vs available inventory

### How Fields Are Updated

#### PlatformStock Table

| Field | Update | Calculation Method |
|-------|--------|-------------------|
| `availableqty` | ❌ **NO CHANGE** | Already reduced during initiate (line 3969) |
| `lockqty` | ✅ **DECREASES** | `currentLockQty - quantityToConvert` (converted to order) |
| `orderedqty` | ✅ **INCREASES** | `currentOrderedQty + quantityToConvert` |
| `soldqty` | ❌ **NO CHANGE** | Not updated during callback (updated in dispatch) |
| `totalqty` | ❌ **NO CHANGE** | Not updated during callback |
| `platformstatus` | ✅ **RECALCULATED** | Based on `availableqty`: `> 5` = `'in_stock'`, `1-5` = `'low_stock'`, `0` = `'out_of_stock'` |
| `modifieddate` | ✅ **UPDATED** | `BigInt(Date.now())` |

**Code Reference:**
```typescript
// src/controllers/phonepe.controller.ts:3967-4056
// NOTE: Stock was already locked during payment initiation
// availableqty: NO CHANGE (already reduced during locking)
// lockqty: DECREASE to 0 (unlock - convert to order)
// orderedqty: INCREASE (confirm order)

const newPlatformAvailableQty = Math.max(0, currentAvailableQty); // NO CHANGE
const newPlatformLockQty = Math.max(0, currentLockQty - quantityToConvert); // DECREASES
const newPlatformOrderedQty = currentOrderedQty + quantityToConvert; // INCREASES

await prisma.platformStock.update({
  data: {
    availableqty: newPlatformAvailableQty,  // NO CHANGE
    lockqty: newPlatformLockQty,            // DECREASES
    orderedqty: newPlatformOrderedQty,       // INCREASES
    platformstatus: newPlatformStatus,       // RECALCULATED
    modifieddate: BigInt(Date.now())
  }
});
```

#### Product Table

| Field | Update | Calculation Method |
|-------|--------|-------------------|
| `availablequantity` | ✅ **DECREASES** | `currentAvailableQuantity - requestedQuantity` |
| `orderedquantity` | ✅ **INCREASES** | `currentOrderedQuantity + requestedQuantity` |
| `soldquantity` | ❌ **NO CHANGE** | Not updated during callback (updated in dispatch) |
| `quantity` | ❌ **NO CHANGE** | Not updated during callback |
| `ecompublishedquantity` | ❌ **NO CHANGE** | Not updated during callback |
| `productstatus` | ✅ **RECALCULATED** | Based on `availablequantity`: `> 5` = `'in_stock'`, `1-5` = `'low_stock'`, `0` = `'out_of_stock'` |
| `modifieddate` | ✅ **UPDATED** | `BigInt(Date.now())` |

**Code Reference:**
```typescript
// src/controllers/phonepe.controller.ts:4134-4191
const newProductOrderedQuantity = 
  currentProductOrderedQuantity + requestedQuantity; // INCREASES
const newProductAvailableQuantity = Math.max(0,
  currentProductAvailableQuantity - requestedQuantity // DECREASES
);

await prisma.product.update({
  where: { id: BigInt(productId) },
  data: {
    orderedquantity: newProductOrderedQuantity,      // INCREASES
    availablequantity: newProductAvailableQuantity,  // DECREASES
    productstatus: newProductStatus,                  // RECALCULATED
    modifieddate: BigInt(Date.now())
  }
});
```

**Important Notes:**
- Product `availablequantity` is **manually decreased** (not recalculated from stocks)
- This is because stock records are not yet marked as "sold" (they remain "available" until dispatch)
- Product quantities track **overall inventory state** across all platforms

#### Stock Table

| Field | Update | Notes |
|-------|--------|-------|
| `stockstatus` | ❌ **NO CHANGE** | Remains `'available'` until dispatch |
| `ecompublish` | ❌ **NO CHANGE** | Not updated during callback |
| `orderid` | ❌ **NO CHANGE** | Not linked to order yet (linked in dispatch) |
| `orderlinenumber` | ❌ **NO CHANGE** | Not linked to orderline yet (linked in dispatch) |

---

## 5. Order Dispatch (Ready for Dispatch)

**Endpoint:** `PATCH /v1/orders/:id/ready-for-dispatch`  
**Location:** `src/services/orders.service.ts` → `markReadyForDispatch()` (lines 1027-1099) and `updateStockForDispatch()` (lines 890-1022)

### When
- Inventory user marks order as ready for dispatch
- Stock items are allocated to orderlines
- Physical items are collected and boxed

### Why
- Mark stock items as **sold** (no longer available)
- Convert **ordered** quantities to **sold** quantities
- Link stock records to order and orderline

### How Fields Are Updated

#### Stock Table

| Field | Update | Value |
|-------|--------|-------|
| `stockstatus` | ✅ **CHANGED** | `'available'` → `'sold'` |
| `orderid` | ✅ **SET** | Order ID (String from `orders.orderid`) |
| `orderlinenumber` | ✅ **SET** | Orderline number (String) |
| `solddate` | ✅ **SET** | Current timestamp |
| `modifieddate` | ✅ **UPDATED** | Current timestamp |

**Code Reference:**
```typescript
// src/services/orders.service.ts:944-955
for (const stock of allocation.stocks) {
  await dynamicUpdate('stock', { id: stock.id }, {
    stockstatus: 'sold',
    orderid: order.orderid || orderId.toString(),
    orderlinenumber: orderline.orderlinenumber,
    solddate: currentTimestamp,
    modifieddate: currentTimestamp
  });
}
```

#### PlatformStock Table

| Field | Update | Calculation Method |
|-------|--------|-------------------|
| `availableqty` | ❌ **NO CHANGE** | Already reduced during order creation |
| `orderedqty` | ✅ **DECREASES** | `currentOrderedQty - orderlineQuantity` |
| `soldqty` | ✅ **INCREASES** | `currentSoldQty + orderlineQuantity` |
| `lockqty` | ❌ **NO CHANGE** | Should be 0 (already converted in callback) |
| `totalqty` | ❌ **NO CHANGE** | Not updated during dispatch |
| `platformstatus` | ❌ **NO CHANGE** | Not recalculated (already correct) |
| `modifieddate` | ✅ **UPDATED** | Current timestamp |

**Code Reference:**
```typescript
// src/services/orders.service.ts:968-977
// Update PlatformStock: decrease orderedqty, increase soldqty
// Note: availableqty and platformstatus don't change (already done during order creation)
const newOrderedQty = Math.max(0, (platformStock.orderedqty || 0) - update.quantity);
const newSoldQty = (platformStock.soldqty || 0) + update.quantity;

await dynamicUpdate('platformstock', { id: platformStock.id }, {
  orderedqty: newOrderedQty,  // DECREASES
  soldqty: newSoldQty,         // INCREASES
  modifieddate: currentTimestamp
});
```

#### Product Table

| Field | Update | Calculation Method |
|-------|--------|-------------------|
| `availablequantity` | ❌ **NO CHANGE** | Already reduced during order creation |
| `orderedquantity` | ✅ **DECREASES** | `currentOrderedQuantity - quantity` |
| `soldquantity` | ✅ **INCREASES** | `currentSoldQuantity + quantity` |
| `quantity` | ❌ **NO CHANGE** | Total quantity unchanged |
| `ecompublishedquantity` | ❌ **NO CHANGE** | Not updated during dispatch |
| `productstatus` | ❌ **NO CHANGE** | Not recalculated (already correct) |
| `modifieddate` | ✅ **UPDATED** | Current timestamp |

**Code Reference:**
```typescript
// src/services/orders.service.ts:998-1005
// Update Product: decrease orderedquantity, increase soldquantity
// Note: availablequantity doesn't change (already done during order creation)
const newOrderedQuantity = Math.max(0, (productForUpdate.orderedquantity || 0) - quantity);
const newSoldQuantity = (productForUpdate.soldquantity || 0) + quantity;

await dynamicUpdate('product', { id: productForUpdate.id }, {
  orderedquantity: newOrderedQuantity,  // DECREASES
  soldquantity: newSoldQuantity,          // INCREASES
  modifieddate: currentTimestamp
});
```

**Important Notes:**
- Stock status changes from `'available'` to `'sold'`
- This triggers product quantity recalculation if `updateStockTotals()` is called
- However, in dispatch flow, product quantities are **manually updated** (not recalculated)

---

## 6. Product Update

**Endpoint:** `PUT /v1/products/:id` or `PATCH /v1/products/:id`  
**Location:** `src/services/product.service.ts` → `update()` method (lines 286-309)

### When
- Product information is updated (name, price, description, etc.)
- Product quantities are manually adjusted

### Why
- Update product metadata
- Manually correct quantity discrepancies
- Update product status based on new data

### How Fields Are Updated

#### Product Table

| Field | Update | Notes |
|-------|--------|-------|
| `quantity` | ⚠️ **CONDITIONAL** | Updated if provided in request |
| `availablequantity` | ⚠️ **CONDITIONAL** | Updated if provided in request |
| `orderedquantity` | ⚠️ **CONDITIONAL** | Updated if provided in request |
| `soldquantity` | ⚠️ **CONDITIONAL** | Updated if provided in request |
| `ecompublishedquantity` | ⚠️ **CONDITIONAL** | Updated if provided in request |
| `productstatus` | ⚠️ **CONDITIONAL** | Updated if provided OR recalculated if `availablequantity` changes |
| `modifieddate` | ✅ **ALWAYS UPDATED** | `BigInt(Date.now())` |

**Code Reference:**
```typescript
// src/services/product.service.ts:286-309
const product = await dynamicUpdate('product', { id }, data);
```

**Important Notes:**
- Product update is **direct field update** (no automatic recalculation)
- If quantities are updated, **no automatic recalculation** from stocks occurs
- To recalculate from stocks, must call `updateStockTotals()` separately

#### PlatformStock Table

| Field | Update | Notes |
|-------|--------|-------|
| All fields | ❌ **NO CHANGE** | Not updated during product update |

#### Stock Table

| Field | Update | Notes |
|-------|--------|-------|
| All fields | ❌ **NO CHANGE** | Not updated during product update |

---

## 7. Product Deletion

**Endpoint:** `DELETE /v1/products/:id`  
**Location:** `src/services/product.service.ts` → `delete()` method (lines 311-329)

### When
- Product is deleted via API
- Product record is removed from database

### Why
- Remove product from catalog
- Clean up product data

### How Fields Are Updated

#### Product Table

| Field | Update | Notes |
|-------|--------|-------|
| All fields | ✅ **DELETED** | Entire product record is deleted |

**Code Reference:**
```typescript
// src/services/product.service.ts:311-329
const success = await dynamicDelete('product', { id });
```

#### PlatformStock Table

**Behavior:** Depends on database foreign key constraints

| Scenario | Behavior |
|----------|----------|
| **CASCADE DELETE** | All PlatformStock records for product are **automatically deleted** |
| **RESTRICT DELETE** | Deletion is **blocked** if PlatformStock records exist |
| **SET NULL** | PlatformStock records remain but `productid` is set to NULL |

**Code Reference:**
```typescript
// Database schema determines behavior
// prisma/schema.prisma - check foreign key constraints
```

#### Stock Table

**Behavior:** Depends on database foreign key constraints

| Scenario | Behavior |
|----------|----------|
| **CASCADE DELETE** | All Stock records with matching `puc` are **automatically deleted** |
| **RESTRICT DELETE** | Deletion is **blocked** if Stock records exist |
| **SET NULL** | Stock records remain but `puc` is set to NULL |

**Code Reference:**
```typescript
// prisma/schema.prisma:115
// Stock.product relation has onDelete: Cascade
product Product? @relation(
  fields: [puc], 
  references: [puc], 
  onDelete: Cascade
)
```

**Important Notes:**
- **Stock records are CASCADE DELETED** when product is deleted (due to foreign key constraint)
- This means all physical inventory items are removed when product is deleted
- **PlatformStock records** may or may not be cascade deleted (check schema)

---

## 8. Stock Deletion

**Endpoint:** `DELETE /v1/stocks/:id`  
**Location:** `src/services/stock.service.ts` → `delete()` method (lines 1503-1614)

### When
- Stock record is deleted via API
- Physical item is removed from inventory

### Why
- Remove damaged/lost items
- Correct inventory discrepancies
- Clean up stock data

### How Fields Are Updated

#### Stock Table

| Field | Update | Notes |
|-------|--------|-------|
| All fields | ✅ **DELETED** | Entire stock record is deleted |

**Code Reference:**
```typescript
// src/services/stock.service.ts:1503-1614
const success = await dynamicDelete("stock", { id });
```

#### Product Table

**Recalculation Trigger:** After stock deletion, `updateStockTotals()` is called

| Field | Update | Calculation Method |
|-------|--------|-------------------|
| `quantity` | ✅ **RECALCULATED** | **Count of remaining stock records** (decreased by 1) |
| `availablequantity` | ✅ **RECALCULATED** | **Formula:** `ecompublishedquantity - orderedquantity - soldquantity` |
| `soldquantity` | ✅ **RECALCULATED** | **Count of remaining stocks** where `stockstatus = 'sold'` |
| `ecompublishedquantity` | ✅ **RECALCULATED** | **Count of remaining stocks** where `stockstatus = 'available'` AND `ecompublish = true` |
| `orderedquantity` | ⚠️ **CONDITIONAL** | Decreased by 1 if deleted stock was `'sold'` |
| `productstatus` | ✅ **RECALCULATED** | Based on new `availablequantity` |
| `modifieddate` | ✅ **UPDATED** | `BigInt(Date.now())` |

**Code Reference:**
```typescript
// src/services/stock.service.ts:1535
const updateResult = await this.productService.updateStockTotals(productIdentifier);
```

#### PlatformStock Table

**Update Trigger:** If deleted stock had `platform` and product ID is found

| Field | Update | Calculation Method |
|-------|--------|-------------------|
| `availableqty` | ✅ **DECREASED** | **Decreases by 1** if deleted stock was `stockstatus = 'available'` AND `ecompublish = true` |
| `totalqty` | ✅ **DECREASED** | **Decreases by 1** if deleted stock was `stockstatus = 'available'` |
| `soldqty` | ✅ **DECREASED** | **Decreases by 1** if deleted stock was `stockstatus = 'sold'` |
| `orderedqty` | ❌ **NO CHANGE** | Not updated during stock deletion |
| `lockqty` | ❌ **NO CHANGE** | Not updated during stock deletion |
| `platformstatus` | ✅ **RECALCULATED** | Based on new `availableqty` |
| `modifieddate` | ✅ **UPDATED** | `BigInt(Date.now())` |

**Code Reference:**
```typescript
// src/services/stock.service.ts:1559-1567
await this.platformStockService.updatePlatformStockQuantities(
  Number(product.id),
  existingStock.platform,
  {
    ecompublish: existingStock.ecompublish,
    stockstatus: existingStock.stockstatus,
    operation: 'delete'
  }
);
```

**PlatformStock Update Logic:**
```typescript
// src/services/platformStock.service.ts:404-415
case 'delete':
  const quantityToRemove = stockInfo.quantity || 1;
  if (stockInfo.stockstatus === 'available') {
    totalQtyChange = -quantityToRemove; // -1
    if (stockInfo.ecompublish) {
      availableQtyChange = -quantityToRemove; // -1
    }
  } else if (stockInfo.stockstatus === 'sold') {
    soldQtyChange = -quantityToRemove; // -1
    totalQtyChange = -quantityToRemove; // -1
  }
  break;
```

---

## 9. Field Definitions & Business Rules

### Product Table Fields

| Field | Type | Definition | Business Rule |
|-------|------|-----------|---------------|
| `quantity` | INT | Total count of all stock records | Sum of ALL stocks (regardless of status) |
| `availablequantity` | INT | Available for new orders | **Formula:** `ecompublishedquantity - orderedquantity - soldquantity` |
| `orderedquantity` | INT | Confirmed orders (not yet dispatched) | Manually tracked (increases on order, decreases on dispatch) |
| `soldquantity` | INT | Dispatched/sold items | Count of stocks with `stockstatus = 'sold'` |
| `ecompublishedquantity` | INT | Published to e-commerce | Count of stocks where `stockstatus = 'available'` AND `ecompublish = true` |
| `productstatus` | STRING | Product availability status | `'in_stock'` (> 5), `'low_stock'` (1-5), `'out_of_stock'` (0) |

### PlatformStock Table Fields

| Field | Type | Definition | Business Rule |
|-------|------|-----------|---------------|
| `availableqty` | INT | Available for new orders on platform | `totalqty - lockqty - orderedqty - soldqty` |
| `orderedqty` | INT | Confirmed orders (not yet dispatched) | Manually tracked (increases on order, decreases on dispatch) |
| `soldqty` | INT | Dispatched/sold items | Manually tracked (increases on dispatch) |
| `totalqty` | INT | Total inventory on platform | Count of stocks with `platform = X` AND `stockstatus = 'available'` |
| `lockqty` | INT | Reserved during checkout | Manually tracked (increases on initiate, decreases on callback) |
| `platformstatus` | STRING | Platform availability status | `'in_stock'` (> 5), `'low_stock'` (1-5), `'out_of_stock'` (0) |

### Stock Table Fields

| Field | Type | Definition | Business Rule |
|-------|------|-----------|---------------|
| `stockstatus` | STRING | Physical item status | `'available'` (default), `'sold'`, `'damaged'`, etc. |
| `ecompublish` | BOOLEAN | Published to e-commerce | `true` = visible on platforms, `false` = not visible |
| `puc` | STRING | Product Unique Code | Links stock to product (foreign key) |
| `platform` | STRING | Platform assignment | `'amazon'`, `'flipkart'`, `'nivapp'` |
| `orderid` | STRING | Order ID | Set when stock is allocated to order (in dispatch) |
| `orderlinenumber` | STRING | Orderline number | Set when stock is allocated to orderline (in dispatch) |

---

## 10. Summary Tables

### Complete Lifecycle Flow: Order Placement → Dispatch

| Phase | Table | Field | INITIATE | CALLBACK | DISPATCH |
|-------|-------|-------|----------|----------|----------|
| **PlatformStock** | `availableqty` | ✅ DECREASES | ❌ NO CHANGE | ❌ NO CHANGE |
| **PlatformStock** | `lockqty` | ✅ INCREASES | ✅ DECREASES | ❌ NO CHANGE |
| **PlatformStock** | `orderedqty` | ❌ NO CHANGE | ✅ INCREASES | ✅ DECREASES |
| **PlatformStock** | `soldqty` | ❌ NO CHANGE | ❌ NO CHANGE | ✅ INCREASES |
| **PlatformStock** | `platformstatus` | ❌ NO CHANGE | ✅ RECALCULATED | ❌ NO CHANGE |
| **Product** | `availablequantity` | ❌ NO CHANGE | ✅ DECREASES | ❌ NO CHANGE |
| **Product** | `orderedquantity` | ❌ NO CHANGE | ✅ INCREASES | ✅ DECREASES |
| **Product** | `soldquantity` | ❌ NO CHANGE | ❌ NO CHANGE | ✅ INCREASES |
| **Product** | `productstatus` | ❌ NO CHANGE | ✅ RECALCULATED | ❌ NO CHANGE |
| **Stock** | `stockstatus` | ❌ NO CHANGE | ❌ NO CHANGE | ✅ CHANGES to 'sold' |

### Stock Creation Impact

| Operation | Product | PlatformStock | Stock |
|-----------|---------|---------------|-------|
| **Stock Created** | ✅ Quantities Recalculated | ✅ Quantities Updated (if platform exists) | ✅ Record Created |
| **Stock Deleted** | ✅ Quantities Recalculated | ✅ Quantities Updated (if platform exists) | ✅ Record Deleted |
| **Product Created** | ✅ Record Created | ✅ Default Records Created (all platforms) | ❌ No Impact |
| **Product Deleted** | ✅ Record Deleted | ⚠️ Depends on FK constraints | ⚠️ CASCADE DELETE (all stocks deleted) |

### Quantity Calculation Methods

| Field | Calculation Method | When Recalculated |
|-------|-------------------|-------------------|
| **Product.quantity** | Count of ALL stock records | Stock create/delete |
| **Product.availablequantity** | `ecompublishedquantity - orderedquantity - soldquantity` | Stock create/delete, Order callback |
| **Product.soldquantity** | Count of stocks with `stockstatus = 'sold'` | Stock create/delete, Dispatch |
| **Product.ecompublishedquantity** | Count of stocks with `stockstatus = 'available'` AND `ecompublish = true` | Stock create/delete |
| **PlatformStock.availableqty** | `totalqty - lockqty - orderedqty - soldqty` | Stock create/delete, Order initiate/callback |
| **PlatformStock.totalqty** | Count of stocks with `platform = X` AND `stockstatus = 'available'` | Stock create/delete |

---

## Key Takeaways

1. **Product quantities are recalculated** from stock records during stock create/delete operations
2. **PlatformStock quantities are updated** when stock has a platform assignment
3. **Order flow uses a two-phase approach:**
   - **Initiate:** Lock stock (availableqty ↓, lockqty ↑)
   - **Callback:** Convert lock to order (lockqty ↓, orderedqty ↑)
   - **Dispatch:** Convert order to sold (orderedqty ↓, soldqty ↑)
4. **Product deletion CASCADE deletes** all related stock records
5. **Stock status changes** trigger product quantity recalculations
6. **PlatformStock tracks platform-specific** inventory separately from overall product quantities

---

## Related Documentation

- `PHONEPE_STOCK_UPDATE_COMPARISON.md` - PhonePe flow comparison
- `STOCK_LOCKQTY_COMPLETE_GUIDE.md` - Lock quantity management
- `STOCK_ALLOCATION_PLAN.md` - Stock allocation during dispatch
- `COMPLETE_STOCK_PRODUCT_INTEGRATION_DOCUMENTATION.md` - Stock-Product integration

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-15  
**Author:** System Analysis

----
1️⃣ Product Creation
| Entity                        | Column                | Value                     |
| ----------------------------- | --------------------- | ------------------------- |
| product                       | soldquantity          | 0                         |
| product                       | availablequantity     | 0                         |
| product                       | quantity              | 0                         |
| product                       | ecompublishedquantity | 0                         |
| product                       | orderedquantity       | 0                         |
| product                       | productstatus         | `inactive / out_of_stock` |
| platformstock (all platforms) | availableqty          | 0                         |
| platformstock                 | orderedqty            | 0                         |
| platformstock                 | soldqty               | 0                         |
| platformstock                 | totalqty              | 0                         |
| platformstock                 | lockqty               | 0                         |
| platformstock                 | platformstatus        | `inactive / out_of_stock` |


2️⃣ Stock Creation (Stock added with Platform + PUC)

Input: stock_insert_qty, platform, ecom = true

| Column                | Update Logic                                        |
| --------------------- | --------------------------------------------------- |
| availablequantity     | `+= stock_insert_qty`                               |
| quantity              | `+= stock_insert_qty`                               |
| ecompublishedquantity | `+= stock_insert_qty`                               |
| productstatus         | `availablequantity > 5 ? "available" : "low_stock"` |


PlatformStock Table Updates
| Column         | Update Logic                                   |
| -------------- | ---------------------------------------------- |
| availableqty   | `+= stock_insert_qty`                          |
| totalqty       | `+= stock_insert_qty`                          |
| platformstatus | `availableqty > 5 ? "available" : "low_stock"` |


Stock Table

| Column      | Value       |
| ----------- | ----------- |
| stockstatus | `available` |

Order Placement – Validation (Before Payment)

Condition to allow order

| Entity        | Condition                               |
| ------------- | --------------------------------------- |
| platformstock | `(availableqty - lockqty) >= order_qty` |
No DB update yet

4️⃣ Order Initiated (Payment Started)
PlatformStock Table

| Column  | Update Logic   |
| ------- | -------------- |
| lockqty | `+= order_qty` |


5️⃣ Payment Confirmed (Order Created)
PlatformStock Table

| Column         | Update Logic                                   |
| -------------- | ---------------------------------------------- |
| orderedqty     | `+= order_qty`                                 |
| lockqty        | `-= order_qty`                                 |
| availableqty   | `-= order_qty`                                 |
| totalqty       | `-= order_qty`                                 |
| platformstatus | `availableqty > 5 ? "available" : "low_stock"` |

Product Table

| Column            | Update Logic                                        |
| ----------------- | --------------------------------------------------- |
| orderedquantity   | `+= order_qty`                                      |
| availablequantity | `-= order_qty`                                      |
| productstatus     | `availablequantity > 5 ? "available" : "low_stock"` |


6️⃣ Ready for Dispatch

PlatformStock Table

| Column         | Update Logic                                   |
| -------------- | ---------------------------------------------- |
| soldqty        | `+= order_qty`                                 |
| orderedqty     | `-= order_qty`                                 |
| platformstatus | `availableqty > 5 ? "available" : "low_stock"` |

Product Table

| Column            | Update Logic                                        |
| ----------------- | --------------------------------------------------- |
| soldquantity      | `+= order_qty`                                      |
| availablequantity | `-= order_qty`                                      |
| productstatus     | `availablequantity > 5 ? "available" : "low_stock"` |


Stock Table

| Column      | Value  |
| ----------- | ------ |
| stockstatus | `sold` |


