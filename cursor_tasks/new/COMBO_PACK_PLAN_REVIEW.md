# Combo Pack Implementation Plan - Review & Analysis

## Executive Summary

This document reviews the proposed combo/bundle product implementation plan against the existing quantity lifecycle system. The plan proposes a **virtual inventory model** for combo products, which is a sound approach but requires careful integration with the current order flow.

---

## ✅ Plan Strengths

1. **Virtual Inventory Model** - Industry standard approach, avoids physical bundling issues
2. **Zero Breaking Changes** - Maintains existing single product flow
3. **Recipe-Based Design** - Flexible and scalable
4. **Clear Separation** - Single products = physical, Combos = virtual

---

## ⚠️ Critical Issues & Gaps

### 1. **Order Initiate Flow - Missing Component Validation**

**Problem:** Plan says "For each component: platformstock.lockqty += required_qty" but doesn't address:

- ❌ **What if one component is out of stock?**
- ❌ **What if components are on different platforms?**
- ❌ **How to validate combo availability BEFORE locking?**

**Current Single Product Flow:**
```typescript
// phonepe.controller.ts:592-608
// Validates availability FIRST, then locks
if (actualAvailableQty < requestedQuantity) {
  throw new Error("Insufficient stock");
}
// Then locks
platformstock.lockqty += requestedQuantity;
```

**Required for Combo:**
```typescript
// PSEUDOCODE - NEEDS IMPLEMENTATION
async function validateAndLockCombo(comboProductId, quantity) {
  const components = await getBundleComponents(comboProductId);
  
  // Validate ALL components have sufficient stock
  for (const component of components) {
    const platformStock = await getPlatformStock(component.productId, 'nivapp');
    const requiredQty = component.required_qty * quantity;
    const available = platformStock.availableqty - platformStock.lockqty;
    
    if (available < requiredQty) {
      throw new Error(`Insufficient stock for component: ${component.productId}`);
    }
  }
  
  // Lock ALL components atomically (transaction)
  await prisma.$transaction(async (tx) => {
    for (const component of components) {
      await tx.platformStock.update({
        where: { productid_platform: {...} },
        data: {
          lockqty: { increment: component.required_qty * quantity },
          availableqty: { decrement: component.required_qty * quantity }
        }
      });
    }
  });
}
```

---

### 2. **Combo Quantity Calculation - PlatformStock Integration**

**Problem:** Plan says "Do NOT maintain platformstock for combo" but this creates issues:

**Issue A: Order Initiate Validation**
- Current flow validates `PlatformStock.availableqty` for single products
- Combo products won't have PlatformStock records
- Need to calculate availability on-the-fly from components

**Issue B: Locking Mechanism**
- Current flow locks at PlatformStock level
- Combo locking must happen at component level
- Need to track which locks belong to which combo order

**Recommended Solution:**
```typescript
// Calculate combo availability dynamically
async function getComboAvailability(comboProductId, platform = 'nivapp') {
  const components = await getBundleComponents(comboProductId);
  const availabilities = [];
  
  for (const component of components) {
    const platformStock = await getPlatformStock(component.productId, platform);
    const available = platformStock.availableqty - platformStock.lockqty;
    const maxComboQty = Math.floor(available / component.required_qty);
    availabilities.push(maxComboQty);
  }
  
  return Math.min(...availabilities); // MIN of all components
}
```

---

### 3. **Order Callback Flow - Component Quantity Updates**

**Problem:** Plan shows component updates but doesn't address Product table updates:

**Current Single Product Flow:**
```typescript
// phonepe.controller.ts:4134-4191
// Updates Product.orderedquantity and Product.availablequantity
product.orderedquantity += requestedQuantity;
product.availablequantity -= requestedQuantity;
```

**Required for Combo:**
```typescript
// PSEUDOCODE - NEEDS IMPLEMENTATION
async function updateComboAfterPayment(comboProductId, quantity) {
  const components = await getBundleComponents(comboProductId);
  
  // Update each component's Product table
  for (const component of components) {
    const requiredQty = component.required_qty * quantity;
    
    await prisma.product.update({
      where: { id: component.productId },
      data: {
        orderedquantity: { increment: requiredQty },
        availablequantity: { decrement: requiredQty }
      }
    });
  }
  
  // Combo product itself: NO updates (virtual, no physical stock)
  // But might want to track combo.orderedquantity for reporting
}
```

---

### 4. **Dispatch Flow - Stock Allocation for Components**

**Problem:** Plan says "Allocate real stock rows" but doesn't specify:

- ❌ **How to allocate multiple components?**
- ❌ **What if one component stock is unavailable?**
- ❌ **How to link combo orderline to component stocks?**

**Current Single Product Dispatch:**
```typescript
// orders.service.ts:944-955
// Allocates stock for ONE product
for (const stock of allocation.stocks) {
  await dynamicUpdate('stock', { id: stock.id }, {
    stockstatus: 'sold',
    orderid: order.orderid,
    orderlinenumber: orderline.orderlinenumber
  });
}
```

**Required for Combo:**
```typescript
// PSEUDOCODE - NEEDS IMPLEMENTATION
async function allocateComboStock(orderlineId, comboProductId, quantity) {
  const components = await getBundleComponents(comboProductId);
  const orderline = await getOrderline(orderlineId);
  
  // Allocate stock for EACH component
  for (const component of components) {
    const requiredQty = component.required_qty * quantity;
    
    // Get available stocks for this component
    const stocks = await getAvailableStocks(
      component.productId, 
      requiredQty,
      'nivapp'
    );
    
    if (stocks.length < requiredQty) {
      throw new Error(`Insufficient stock for component: ${component.productId}`);
    }
    
    // Mark stocks as sold
    for (const stock of stocks) {
      await dynamicUpdate('stock', { id: stock.id }, {
        stockstatus: 'sold',
        orderid: orderline.orderid,
        orderlinenumber: orderline.orderlinenumber, // Same orderline for all components
        solddate: Date.now()
      });
    }
    
    // Update component Product quantities
    await updateProductQuantities(component.productId, requiredQty, 'dispatch');
  }
}
```

---

### 5. **Combo Product Table Fields - Missing Specifications**

**Problem:** Plan says "Add is_combo flag" but doesn't specify:

- ❌ **What values should combo products have?**
- ❌ **How to calculate combo.availablequantity?**
- ❌ **Should combo have orderedquantity/soldquantity?**

**Recommended Schema:**
```sql
-- For combo products (is_combo = true):
quantity = 0                    -- No physical stock
availablequantity = MIN(components) -- Calculated dynamically
orderedquantity = 0            -- OR track separately for reporting
soldquantity = 0               -- OR track separately for reporting
ecompublishedquantity = MIN(components) -- Calculated dynamically
productstatus = 'in_stock' | 'low_stock' | 'out_of_stock' -- Based on availability
```

**Implementation:**
```typescript
// Calculate combo quantities on-demand (not stored)
async function getComboQuantities(comboProductId) {
  if (!product.is_combo) {
    return product; // Return as-is for single products
  }
  
  const availability = await getComboAvailability(comboProductId);
  
  return {
    ...product,
    availablequantity: availability,
    ecompublishedquantity: availability,
    productstatus: calculateStatus(availability),
    quantity: 0, // Always 0 for combos
    orderedquantity: 0, // Or calculate from component orders
    soldquantity: 0 // Or calculate from component sales
  };
}
```

---

### 6. **Orderline Structure - Combo vs Single Product**

**Problem:** Plan doesn't address orderline structure:

**Current Orderline:**
```typescript
{
  productid: 123,        // Single product ID
  quantity: 2,           // Quantity of product
  productname: "Vanilla"
}
```

**Combo Orderline Options:**

**Option A: Single Orderline (Recommended)**
```typescript
{
  productid: 456,        // Combo product ID
  quantity: 1,          // Quantity of combos
  productname: "Vanilla + Oudh Combo",
  is_combo: true,       // Flag to indicate combo
  // Components tracked separately in orderline_components table
}
```

**Option B: Multiple Orderlines (Not Recommended)**
```typescript
// Creates separate orderlines for each component
// Problem: Loses combo relationship, harder to track
```

**Recommended: Add orderline_components table**
```sql
CREATE TABLE orderline_components (
  id BIGINT PRIMARY KEY,
  orderline_id BIGINT,           -- References orderline.id
  component_product_id BIGINT,    -- Component product ID
  required_qty INT,               -- Quantity needed
  allocated_stock_ids BIGINT[],   -- Stock IDs allocated
  createddate BIGINT,
  modifieddate BIGINT
);
```

---

### 7. **Cancellation Flow - Component Unlocking**

**Problem:** Plan mentions "Release component lockqty" but doesn't specify the flow:

**Current Single Product Cancellation:**
```typescript
// orderline.service.ts:358-424
// Restores availablequantity and orderedquantity
product.availablequantity += cancelledQuantity;
product.orderedquantity -= cancelledQuantity;
platformStock.availableqty += cancelledQuantity;
platformStock.orderedqty -= cancelledQuantity;
```

**Required for Combo:**
```typescript
// PSEUDOCODE - NEEDS IMPLEMENTATION
async function cancelComboOrder(orderlineId) {
  const orderline = await getOrderline(orderlineId);
  const components = await getOrderlineComponents(orderlineId);
  
  // Unlock/restore each component
  for (const component of components) {
    const requiredQty = component.required_qty * orderline.quantity;
    
    // If before dispatch: unlock
    if (orderline.status === 'pending' || orderline.status === 'confirmed') {
      await unlockComponentStock(component.productId, requiredQty);
    }
    
    // If after dispatch: reverse sold (if return allowed)
    if (orderline.status === 'dispatched') {
      await reverseComponentStock(component.productId, requiredQty);
    }
  }
}
```

---

## 📋 Integration Points with Current System

### Integration Point 1: PhonePe Initiate (`/v1/phonepe/initiate`)

**Current Code:** `src/controllers/phonepe.controller.ts:200-700`

**Required Changes:**
```typescript
// Add combo detection
if (product.is_combo) {
  // Validate combo availability
  const comboAvailability = await getComboAvailability(product.id, 'nivapp');
  if (comboAvailability < requestedQuantity) {
    throw new Error("Insufficient combo stock");
  }
  
  // Lock components (not combo itself)
  await lockComboComponents(product.id, requestedQuantity);
} else {
  // Existing single product flow
  await lockSingleProduct(product.id, requestedQuantity);
}
```

---

### Integration Point 2: PhonePe Callback (`/v1/phonepe/callback/:transactionId`)

**Current Code:** `src/controllers/phonepe.controller.ts:3801-4358`

**Required Changes:**
```typescript
// In updateProductQuantitiesAfterOrder()
for (const orderItem of originalOrderItems) {
  const product = await getProduct(orderItem.productid);
  
  if (product.is_combo) {
    // Update component products (not combo itself)
    await updateComboComponentQuantities(product.id, orderItem.quantity);
  } else {
    // Existing single product flow
    await updateSingleProductQuantities(product.id, orderItem.quantity);
  }
}
```

---

### Integration Point 3: Ready for Dispatch (`/v1/orders/:id/ready-for-dispatch`)

**Current Code:** `src/services/orders.service.ts:1027-1099`

**Required Changes:**
```typescript
// In markReadyForDispatch()
for (const orderline of orderlines) {
  const product = await getProduct(orderline.productid);
  
  if (product.is_combo) {
    // Allocate component stocks
    await allocateComboStocks(orderline.id, product.id, orderline.quantity);
  } else {
    // Existing single product allocation
    await allocateSingleProductStocks(orderline.id, product.id, orderline.quantity);
  }
}
```

---

## 🔧 Recommended Implementation Steps

### Phase 1: Database Schema
1. ✅ Create `product_bundle_map` table
2. ✅ Add `is_combo` and `combo_type` to Product table
3. ✅ Create `orderline_components` table (optional, for tracking)

### Phase 2: Core Functions
1. ✅ `getBundleComponents(comboProductId)` - Get component list
2. ✅ `getComboAvailability(comboProductId, platform)` - Calculate availability
3. ✅ `validateComboStock(comboProductId, quantity, platform)` - Validate before order
4. ✅ `lockComboComponents(comboProductId, quantity, platform)` - Lock components
5. ✅ `unlockComboComponents(comboProductId, quantity, platform)` - Unlock on failure

### Phase 3: Order Flow Integration
1. ✅ Update PhonePe Initiate to handle combos
2. ✅ Update PhonePe Callback to update component quantities
3. ✅ Update Dispatch to allocate component stocks
4. ✅ Update Cancellation to unlock/restore components

### Phase 4: API Enhancements
1. ✅ Update Product GET endpoints to calculate combo availability
2. ✅ Update Product listing to show combo availability
3. ✅ Add combo validation in cart/checkout

### Phase 5: Testing & Migration
1. ✅ Unit tests for combo functions
2. ✅ Integration tests for order flow
3. ✅ Migrate existing combo products
4. ✅ Validate with real orders

---

## 📊 Quantity Update Matrix for Combo Products

| Operation | Combo Product | Component Products | Component PlatformStock |
|-----------|---------------|-------------------|------------------------|
| **Combo Created** | ✅ Set `is_combo = true` | ❌ No change | ❌ No change |
| **Component Stock Created** | ✅ Availability recalculated | ✅ Quantities updated | ✅ Quantities updated |
| **Order Initiate** | ❌ No change | ❌ No change | ✅ `lockqty` ↑ (per component) |
| **Order Callback** | ❌ No change | ✅ `orderedquantity` ↑, `availablequantity` ↓ | ✅ `lockqty` ↓, `orderedqty` ↑ |
| **Order Dispatch** | ❌ No change | ✅ `orderedquantity` ↓, `soldquantity` ↑ | ✅ `orderedqty` ↓, `soldqty` ↑ |
| **Order Cancel** | ❌ No change | ✅ Quantities restored | ✅ Quantities restored |

---

## ⚠️ Critical Considerations

### 1. **Transaction Safety**
- All component operations must be in transactions
- If one component fails, rollback all locks
- Use row-level locking for race condition prevention

### 2. **Platform Consistency**
- All components must be on same platform (or handle cross-platform)
- Combo availability = MIN of component availabilities
- Locking must happen atomically across all components

### 3. **Reporting & Analytics**
- Combo sales tracked via orderline
- Component consumption tracked via component products
- Need to link combo orders to component stock movements

### 4. **Edge Cases**
- What if component product is deleted?
- What if bundle map changes after orders placed?
- What if component stock becomes unavailable during dispatch?
- Partial component availability (some components available, some not)

---

## ✅ Final Recommendations

1. **Implement Combo Support Gradually**
   - Start with simple 2-component combos
   - Test thoroughly before adding complexity
   - Monitor for edge cases

2. **Maintain Backward Compatibility**
   - Keep existing single product flow unchanged
   - Add combo logic as separate code paths
   - Use feature flags for gradual rollout

3. **Add Comprehensive Logging**
   - Log all combo operations
   - Track component locking/unlocking
   - Monitor for discrepancies

4. **Create Helper Functions**
   - Centralize combo logic in service layer
   - Reusable functions for validation, locking, allocation
   - Easy to test and maintain

5. **Document Combo-Specific Flows**
   - Update API documentation
   - Create combo-specific flow diagrams
   - Document edge cases and handling

---

## 📝 Next Steps

1. **Review this analysis** with the team
2. **Clarify edge cases** (cross-platform, partial availability)
3. **Design orderline_components table** (if needed)
4. **Create detailed implementation plan** for each phase
5. **Set up test environment** for combo products
6. **Implement Phase 1** (database schema)

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-15  
**Reviewer:** System Analysis

