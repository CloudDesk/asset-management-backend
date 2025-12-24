# Stock Allocation Implementation Review

## ✅ Implementation Status: **MOSTLY CORRECT** with Minor Fixes Needed

### Overall Assessment
The implementation follows the plan correctly with all three scenarios supported. There are a few minor issues to address:

---

## ✅ **Correctly Implemented**

### 1. Route Schema (`src/routes/orders.route.ts`)
- ✅ Supports `inventory_user_id` (required)
- ✅ Supports optional `stock_mapping` array
- ✅ Each mapping supports:
  - ✅ `orderline_id` (required)
  - ✅ `stock_ids` (array of numbers)
  - ✅ `skus` (array of strings)
  - ✅ `batch_filter` (object with `batchno`, `supplierid`, `poid`)

### 2. Controller (`src/controllers/orders.controller.ts`)
- ✅ Accepts `stock_mapping` parameter
- ✅ Passes to service method correctly
- ✅ Error handling in place

### 3. Stock Allocation Logic (`src/services/orders.service.ts`)

#### Scenario 1: FIFO Auto-Select (Only `inventory_user_id`)
- ✅ Automatically selects stocks for all orderlines
- ✅ Uses FIFO ordering (`orderBy: 'createddate', orderDirection: 'ASC'`)
- ✅ Filters by `puc`, `platform`, `stockstatus = 'available'`
- ✅ Validates product match via `puc`
- ✅ Validates stock status

#### Scenario 2: Manual Selection (`stock_ids` or `skus`)
- ✅ Supports both `stock_ids` and `skus`
- ✅ Validates quantity matches orderline quantity
- ✅ Validates stock exists
- ✅ Validates stock status and product match

#### Scenario 3: Batch Filtering (`batch_filter`)
- ✅ Supports `batchno`, `supplierid`, `poid` filters
- ✅ Uses FIFO within filtered batch
- ✅ **Correctly implements strict validation** (no FIFO fallback)
- ✅ Error message includes batch info

### 4. Stock Updates
- ✅ Updates `stockstatus` to 'sold'
- ✅ Sets `orderid` (String) correctly
- ✅ Sets `orderlinenumber` (String) correctly
- ✅ Sets `solddate` timestamp

### 5. Quantity Updates
- ✅ **Correctly aggregates** by product/platform to avoid duplicate updates
- ✅ PlatformStock: `orderedqty` ↓, `soldqty` ↑
- ✅ Product: `orderedquantity` ↓, `soldquantity` ↑
- ✅ **Correctly does NOT change** `availableqty`/`availablequantity`
- ✅ Updates `modifieddate` for all records

### 6. Transaction Safety
- ✅ All updates wrapped in `prisma.$transaction`
- ✅ Rollback on any error
- ✅ All-or-nothing approach

### 7. Error Handling
- ✅ Stock availability validation
- ✅ Product match validation
- ✅ Quantity mismatch validation
- ✅ Detailed error messages
- ✅ Proper logging

---

## ⚠️ **Issues to Fix**

### Issue 1: Data Type for `modifieddate` and `solddate`

**Problem:**
According to the plan (line 555) and schema:
- `Stock.modifieddate`: `BigInt?`
- `Stock.solddate`: `BigInt?`
- `PlatformStock.modifieddate`: `BigInt?`
- `Product.modifieddate`: `BigInt?`

But the implementation uses `Date.now()` (returns `number`) instead of `BigInt(Date.now())`.

**Location:**
- `src/services/orders.service.ts` lines 895, 949, 950, 973, 1001

**Fix Required:**
```typescript
// Current (line 895):
const currentTimestamp = Date.now();

// Should be:
const currentTimestamp = BigInt(Date.now());

// Or use Date.now() and convert when updating:
await dynamicUpdate('stock', { id: stock.id }, {
  stockstatus: 'sold',
  orderid: order.orderid || orderId.toString(),
  orderlinenumber: orderline.orderlinenumber,
  solddate: BigInt(currentTimestamp),
  modifieddate: BigInt(currentTimestamp)
});
```

**Note:** `dynamicUpdate` may handle the conversion automatically, but to match the plan exactly and ensure type safety, we should use `BigInt()`.

---

### Issue 2: Error Message for Batch Filter Insufficient Stock

**Current Implementation (line 726-728):**
```typescript
throw new Error(
  `Insufficient available stock: Need ${quantity}, Found ${stocks?.length || 0}${batchInfo}`
);
```

**Plan Recommendation (line 1025-1032):**
```typescript
throw new Error(
  `Insufficient stock in batch filter: ` +
  `Need ${quantity}, Found ${stocks?.length || 0}. ` +
  `Batch: ${batchFilter.batchno || 'N/A'}, ` +
  `Supplier: ${batchFilter.supplierid || 'N/A'}, ` +
  `PO: ${batchFilter.poid || 'N/A'}. ` +
  `Please select different batch or use manual stock_ids.`
);
```

**Fix Required:**
Enhance the error message to include all batch filter details and helpful guidance.

---

## 📋 **Verification Checklist**

### Route Schema
- [x] `inventory_user_id` required
- [x] `stock_mapping` optional array
- [x] `stock_ids` array of numbers
- [x] `skus` array of strings
- [x] `batch_filter` object with optional fields

### Stock Allocation
- [x] Scenario 1: FIFO auto-select works
- [x] Scenario 2: Manual selection by IDs works
- [x] Scenario 2: Manual selection by SKUs works
- [x] Scenario 3: Batch filtering works
- [x] Product validation via `puc` works
- [x] Quantity validation works
- [x] Stock status validation works

### Updates
- [x] Stock status updated to 'sold'
- [x] Stock linked to order/orderline
- [x] PlatformStock quantities updated correctly
- [x] Product quantities updated correctly
- [x] No duplicate quantity updates
- [ ] **FIX:** `modifieddate` should use `BigInt(Date.now())`
- [ ] **FIX:** `solddate` should use `BigInt(Date.now())`

### Transaction & Error Handling
- [x] Transaction safety implemented
- [x] Error handling comprehensive
- [x] Logging detailed
- [ ] **ENHANCE:** Batch filter error message

---

## 🔧 **Recommended Fixes**

### Fix 1: Update Data Types for Timestamps

```typescript
// In updateStockForDispatch method (line 895):
const currentTimestamp = BigInt(Date.now());

// Then use directly (BigInt is already correct):
await dynamicUpdate('stock', { id: stock.id }, {
  stockstatus: 'sold',
  orderid: order.orderid || orderId.toString(),
  orderlinenumber: orderline.orderlinenumber,
  solddate: currentTimestamp,  // Now BigInt
  modifieddate: currentTimestamp  // Now BigInt
});
```

### Fix 2: Enhance Batch Filter Error Message

```typescript
// In autoSelectStocks method (line 722-728):
if (!stocks || stocks.length < quantity) {
  const batchInfo = batchFilter 
    ? `. Batch: ${batchFilter.batchno || 'N/A'}, ` +
      `Supplier: ${batchFilter.supplierid || 'N/A'}, ` +
      `PO: ${batchFilter.poid || 'N/A'}. ` +
      `Please select different batch or use manual stock_ids.`
    : '';
  throw new Error(
    `Insufficient available stock: Need ${quantity}, Found ${stocks?.length || 0}${batchInfo}`
  );
}
```

---

## ✅ **Summary**

**Overall:** The implementation is **95% correct** and follows the plan accurately. The main issues are:

1. **Data Type Consistency:** Use `BigInt(Date.now())` for `modifieddate` and `solddate` fields to match schema and plan
2. **Error Message Enhancement:** Improve batch filter error message to include all filter details

**Recommendation:** Apply the two fixes above, then the implementation will be 100% aligned with the plan.

