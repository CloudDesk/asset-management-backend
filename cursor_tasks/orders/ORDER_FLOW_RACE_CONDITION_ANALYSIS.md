# Complete Order Flow & Race Condition Analysis

**Version 1.0** — December 2024  
*Complete analysis of order flow, stock management, and concurrent order handling*

---

## 📋 Table of Contents

1. [Complete Order Flow Overview](#1-complete-order-flow-overview)
2. [Entities Involved in Order Flow](#2-entities-involved-in-order-flow)
3. [Stock Quantity Fields Explained](#3-stock-quantity-fields-explained)
4. [Race Condition Protection Mechanism](#4-race-condition-protection-mechanism)
5. [Scenario Analysis: Concurrent Orders](#5-scenario-analysis-concurrent-orders)
6. [Complete Flow Diagrams](#6-complete-flow-diagrams)
7. [Stock State Transitions](#7-stock-state-transitions)

---

## 1️⃣ Complete Order Flow Overview

### High-Level Flow

```
User Initiates Payment
  ↓
[1] Validation (Products, Stock, Promotions)
  ↓
[2] Stock Locking (SELECT FOR UPDATE)
  ├─ PlatformStock.availableqty ↓
  └─ PlatformStock.lockqty ↑
  ↓
[3] Transaction Created
  ↓
[4] Mode-Specific Logic
  ├─ PhonePe: Redirect to payment page
  └─ COD: Create order immediately
  ↓
[5] Payment Completion (PhonePe callback or COD immediate)
  ↓
[6] Order & Orderline Creation
  ↓
[7] Stock Conversion (Lock → Order)
  ├─ PlatformStock.lockqty ↓
  ├─ PlatformStock.orderedqty ↑
  ├─ Product.availablequantity ↓
  └─ Product.orderedquantity ↑
  ↓
[8] Promotion Redemption
  ↓
[9] Order Complete
```

---

## 2️⃣ Entities Involved in Order Flow

### 2.1 Product Table

**Purpose:** Master product catalog with overall inventory

**Key Fields:**
- `id`: Product ID
- `availablequantity`: Total available quantity across all platforms
- `orderedquantity`: Total ordered quantity across all platforms
- `soldquantity`: Total sold/delivered quantity
- `productstatus`: `in_stock`, `low_stock`, `out_of_stock`

**Stock Updates:**
- **During Initiate:** ❌ No change
- **During Payment Success:** ✅ `availablequantity ↓`, `orderedquantity ↑`

---

### 2.2 PlatformStock Table

**Purpose:** Platform-specific inventory (nivapp platform)

**Key Fields:**
- `productid`: Foreign key to Product
- `platform`: `'nivapp'`
- `availableqty`: Available quantity for this platform
- `lockqty`: Locked quantity (reserved during checkout)
- `orderedqty`: Confirmed ordered quantity
- `soldqty`: Delivered quantity
- `platformstatus`: `in_stock`, `low_stock`, `out_of_stock`

**Stock Updates:**
- **During Initiate:** ✅ `availableqty ↓`, `lockqty ↑`
- **During Payment Success:** ✅ `lockqty ↓`, `orderedqty ↑` (availableqty unchanged)

---

### 2.3 Stock Table (Individual Items)

**Purpose:** Track individual physical items (RFID/barcode level)

**Key Fields:**
- `productid`: Foreign key to Product
- `stockstatus`: `Available`, `Locked`, `Ordered`, `Sold`
- `orderid`: Order ID (when ordered)
- `orderlinenumber`: Orderline ID (when ordered)
- `solddate`: When item was sold

**Stock Updates:**
- **During Ready for Dispatch:** ✅ `stockstatus: 'Ordered'`, `orderid`, `orderlinenumber` set
- **During Delivery:** ✅ `stockstatus: 'Sold'`, `solddate` set

---

### 2.4 Transaction Table

**Purpose:** Track payment transactions

**Key Fields:**
- `merchanttransactionid`: Unique transaction ID
- `userid`: User who initiated payment
- `amount`: Transaction amount
- `status`: `INITIATED`, `SUCCESS`, `FAILED`, `EXPIRED`, `CANCELLED`
- `transactiondata`: JSON with order items, evaluation IDs, etc.

**Lifecycle:**
- Created during payment initiation
- Updated during callback
- Status tracks payment state

---

### 2.5 Orders Table

**Purpose:** Order container (one order = multiple orderlines)

**Key Fields:**
- `id`: Database ID
- `orderid`: Display order ID (e.g., "ORDER_TXN_123_1701234567890")
- `userid`: Customer ID
- `orderstatus`: Derived from orderline statuses
- `orderamount`: Total order amount after discounts
- `mode`: `'phonepe'` or `'cod'`
- `ispaymentsucceed`: Payment success flag
- `merchanttransactionid`: Reference to transaction

**Creation:**
- Created after payment success (PhonePe callback) or immediately (COD)

---

### 2.6 Orderline Table

**Purpose:** Individual product items in an order

**Key Fields:**
- `id`: Database ID
- `orderid`: Foreign key to Orders
- `productid`: Product ID
- `quantity`: Quantity ordered
- `orderstatus`: Item-level status
- `orderamount`: Line item amount after discounts
- `productamount`: Line item amount after product discounts
- `discountamount`: Total discount for this line
- `original_price`: Original price before discounts
- `product_discount_amount`: Product-level discount
- `promotion_discount_amount`: Promotion discount
- `evaluation_id`: Promotion evaluation ID

**Creation:**
- Automatically created when order is created (one per product in order)

---

## 3️⃣ Stock Quantity Fields Explained

### 3.1 PlatformStock Fields

| Field | Description | When Updated | Example |
|-------|-------------|--------------|---------|
| `availableqty` | Available for new orders | Decreases during locking | 10 → 6 (after locking 4) |
| `lockqty` | Reserved during checkout | Increases during locking, decreases after payment | 0 → 4 (locked) → 0 (converted) |
| `orderedqty` | Confirmed orders | Increases after payment success | 0 → 4 (after payment) |
| `soldqty` | Delivered items | Increases after delivery | 0 → 4 (after delivery) |

### 3.2 Product Fields

| Field | Description | When Updated | Example |
|-------|-------------|--------------|---------|
| `availablequantity` | Total available across all platforms | Decreases after payment success | 10 → 6 (after payment) |
| `orderedquantity` | Total ordered across all platforms | Increases after payment success | 0 → 4 (after payment) |
| `soldquantity` | Total sold/delivered | Increases after delivery | 0 → 4 (after delivery) |

### 3.3 Stock Calculation Logic

**Available Stock Check:**
```typescript
// During validation (before locking)
actualAvailable = platformStock.availableqty - platformStock.lockqty

// After locking
actualAvailable = platformStock.availableqty  // (lockqty already accounted for)
```

**Why `availableqty` is reduced during locking:**
- `availableqty` represents stock available for NEW orders
- When stock is locked, it's no longer available for other users
- So `availableqty` is reduced immediately during locking
- `lockqty` tracks how much is locked (for cleanup if payment fails)

---

## 4️⃣ Race Condition Protection Mechanism

### 4.1 The Problem

**Without Protection:**
```
Time    User A                    User B                    Database State
─────────────────────────────────────────────────────────────────────────
T1      Read: availableqty = 4    Read: availableqty = 4    availableqty = 4
T2      Calculate: 4 - 4 = 0     Calculate: 4 - 4 = 0      (both see same value)
T3      Update: availableqty = 0  (waiting)                 availableqty = 0, lockqty = 4
T4      (committed)               Update: availableqty = 0  availableqty = 0, lockqty = 8 ❌
T5      (done)                    (committed)                OVER-LOCKED! ❌
```

**Result:** Both users get stock, but only 4 units exist → **OVER-SELLING**

---

### 4.2 The Solution: SELECT FOR UPDATE

**With Protection:**
```
Time    User A                              User B                              Database State
─────────────────────────────────────────────────────────────────────────────────────────────
T1      SELECT ... FOR UPDATE               (waiting for lock)                 availableqty = 4
        (acquires row lock)                 
T2      Read: availableqty = 4              (blocked)                         (locked by User A)
T3      Calculate: 4 - 4 = 0               (still blocked)                   
T4      Update: availableqty = 0            (still blocked)                   availableqty = 0, lockqty = 4
T5      COMMIT (releases lock)               (now can proceed)                 
T6      (done)                               SELECT ... FOR UPDATE             availableqty = 0, lockqty = 4
                                             (acquires row lock)               
T7      (done)                               Read: availableqty = 0             (locked by User B)
T8      (done)                               Check: 0 < 4 → ERROR ❌           (validation fails)
T9      (done)                               ROLLBACK                          availableqty = 0, lockqty = 4
T10     (done)                               Return 400 error                   ✅ CORRECT!
```

**Result:** User A gets stock, User B gets error → **NO OVER-SELLING**

---

### 4.3 Implementation Details

**Code Location:** `src/controllers/phonepe.controller.ts:876-963`

```typescript
// Step 1: Acquire row lock (prevents concurrent reads)
const platformStockResult = await tx.$queryRaw<Array<{
  availableqty: number;
  lockqty: number;
  // ...
}>>`
  SELECT * FROM "platformstock"
  WHERE "productid" = ${BigInt(productId)}
    AND "platform" = ${PLATFORM_NAME}
  FOR UPDATE  -- ← CRITICAL: Acquires exclusive lock
`;

// Step 2: Read fresh data (with lock held)
const currentAvailableQty = Number(platformStockResult[0].availableqty) || 0;
const currentLockQty = Number(platformStockResult[0].lockqty) || 0;

// Step 3: Double-check availability (with fresh data)
if (currentAvailableQty < requestedQuantity) {
  throw new Error(`Insufficient stock: Available ${currentAvailableQty}, Requested ${requestedQuantity}`);
}

// Step 4: Calculate and update (still holding lock)
const newAvailableQty = currentAvailableQty - requestedQuantity;
const newLockQty = currentLockQty + requestedQuantity;

await tx.platformStock.update({
  where: { productid_platform: {...} },
  data: {
    availableqty: newAvailableQty,
    lockqty: newLockQty,
    modifieddate: BigInt(Date.now())
  }
});

// Step 5: COMMIT (releases lock)
// Transaction automatically commits at end of prisma.$transaction()
```

**Key Points:**
1. ✅ `SELECT FOR UPDATE` acquires exclusive row lock
2. ✅ Second transaction **waits** until first commits
3. ✅ Second transaction reads **fresh data** after first commits
4. ✅ Validation happens with **fresh data** (prevents over-selling)
5. ✅ All operations in single transaction (atomic)

---

## 5️⃣ Scenario Analysis: Concurrent Orders

### Scenario 1: Both Users Try to Order 4 Units (availableqty = 4)

**Initial State:**
```
PlatformStock:
  availableqty: 4
  lockqty: 0
  orderedqty: 0
```

**Timeline:**

| Time | User A (Qty: 4) | User B (Qty: 4) | Database State |
|------|-----------------|-----------------|----------------|
| T1 | POST /initiate | POST /initiate | availableqty: 4, lockqty: 0 |
| T2 | Validation: ✅ 4 >= 4 | Validation: ✅ 4 >= 4 | (both pass validation) |
| T3 | **SELECT FOR UPDATE** (acquires lock) | (waiting) | (locked by User A) |
| T4 | Read: availableqty = 4 | (blocked) | (locked) |
| T5 | Check: 4 >= 4 ✅ | (blocked) | (locked) |
| T6 | Update: availableqty = 0, lockqty = 4 | (blocked) | availableqty: 0, lockqty: 4 |
| T7 | **COMMIT** (releases lock) | (now can proceed) | availableqty: 0, lockqty: 4 |
| T8 | ✅ Success (redirect to payment) | **SELECT FOR UPDATE** (acquires lock) | (locked by User B) |
| T9 | (payment in progress) | Read: availableqty = 0 | (locked) |
| T10 | (payment in progress) | Check: 0 < 4 ❌ | (locked) |
| T11 | (payment in progress) | **ERROR**: Insufficient stock | (locked) |
| T12 | (payment in progress) | **ROLLBACK** | availableqty: 0, lockqty: 4 |
| T13 | (payment in progress) | **400 Error Response** | availableqty: 0, lockqty: 4 |

**Result:**
- ✅ User A: Stock locked successfully, proceeds to payment
- ❌ User B: Gets 400 error "Insufficient stock"
- ✅ Database: Correct state (4 units locked for User A)

**If User A Payment Fails:**
```
T14 | Payment fails/expires | (already failed) | availableqty: 0, lockqty: 4
T15 | Cleanup task runs | (already failed) | 
T16 | Release lock | (already failed) | availableqty: 4, lockqty: 0
T17 | ✅ Stock restored | (already failed) | (User B can retry)
```

---

### Scenario 2: User A Orders 3, User B Orders 2 (availableqty = 4)

**Initial State:**
```
PlatformStock:
  availableqty: 4
  lockqty: 0
  orderedqty: 0
```

**Timeline:**

| Time | User A (Qty: 3) | User B (Qty: 2) | Database State |
|------|-----------------|-----------------|----------------|
| T1 | POST /initiate | POST /initiate | availableqty: 4, lockqty: 0 |
| T2 | Validation: ✅ 4 >= 3 | Validation: ✅ 4 >= 2 | (both pass validation) |
| T3 | **SELECT FOR UPDATE** (acquires lock) | (waiting) | (locked by User A) |
| T4 | Read: availableqty = 4 | (blocked) | (locked) |
| T5 | Check: 4 >= 3 ✅ | (blocked) | (locked) |
| T6 | Update: availableqty = 1, lockqty = 3 | (blocked) | availableqty: 1, lockqty: 3 |
| T7 | **COMMIT** (releases lock) | (now can proceed) | availableqty: 1, lockqty: 3 |
| T8 | ✅ Success (redirect to payment) | **SELECT FOR UPDATE** (acquires lock) | (locked by User B) |
| T9 | (payment in progress) | Read: availableqty = 1 | (locked) |
| T10 | (payment in progress) | Check: 1 >= 2 ❌ | (locked) |
| T11 | (payment in progress) | **ERROR**: Insufficient stock | (locked) |
| T12 | (payment in progress) | **ROLLBACK** | availableqty: 1, lockqty: 3 |
| T13 | (payment in progress) | **400 Error Response** | availableqty: 1, lockqty: 3 |

**Result:**
- ✅ User A: Stock locked successfully (3 units), proceeds to payment
- ❌ User B: Gets 400 error "Insufficient stock" (only 1 unit available, needs 2)
- ✅ Database: Correct state (3 units locked for User A, 1 unit available)

**Alternative: User B Orders 1 Unit Instead**

| Time | User A (Qty: 3) | User B (Qty: 1) | Database State |
|------|-----------------|-----------------|----------------|
| T1-T7 | (same as above) | (same as above) | availableqty: 1, lockqty: 3 |
| T8 | ✅ Success | **SELECT FOR UPDATE** (acquires lock) | (locked by User B) |
| T9 | (payment in progress) | Read: availableqty = 1 | (locked) |
| T10 | (payment in progress) | Check: 1 >= 1 ✅ | (locked) |
| T11 | (payment in progress) | Update: availableqty = 0, lockqty = 4 | (locked) |
| T12 | (payment in progress) | **COMMIT** (releases lock) | availableqty: 0, lockqty: 4 |
| T13 | (payment in progress) | ✅ Success (redirect to payment) | availableqty: 0, lockqty: 4 |

**Result:**
- ✅ User A: Stock locked (3 units), proceeds to payment
- ✅ User B: Stock locked (1 unit), proceeds to payment
- ✅ Database: All 4 units locked (3 for User A, 1 for User B)

---

### Scenario 3: User A Orders 2, User B Orders 2 (availableqty = 4)

**Initial State:**
```
PlatformStock:
  availableqty: 4
  lockqty: 0
  orderedqty: 0
```

**Timeline:**

| Time | User A (Qty: 2) | User B (Qty: 2) | Database State |
|------|-----------------|-----------------|----------------|
| T1 | POST /initiate | POST /initiate | availableqty: 4, lockqty: 0 |
| T2 | Validation: ✅ 4 >= 2 | Validation: ✅ 4 >= 2 | (both pass validation) |
| T3 | **SELECT FOR UPDATE** (acquires lock) | (waiting) | (locked by User A) |
| T4 | Read: availableqty = 4 | (blocked) | (locked) |
| T5 | Check: 4 >= 2 ✅ | (blocked) | (locked) |
| T6 | Update: availableqty = 2, lockqty = 2 | (blocked) | availableqty: 2, lockqty: 2 |
| T7 | **COMMIT** (releases lock) | (now can proceed) | availableqty: 2, lockqty: 2 |
| T8 | ✅ Success (redirect to payment) | **SELECT FOR UPDATE** (acquires lock) | (locked by User B) |
| T9 | (payment in progress) | Read: availableqty = 2 | (locked) |
| T10 | (payment in progress) | Check: 2 >= 2 ✅ | (locked) |
| T11 | (payment in progress) | Update: availableqty = 0, lockqty = 4 | (locked) |
| T12 | (payment in progress) | **COMMIT** (releases lock) | availableqty: 0, lockqty: 4 |
| T13 | (payment in progress) | ✅ Success (redirect to payment) | availableqty: 0, lockqty: 4 |

**Result:**
- ✅ User A: Stock locked (2 units), proceeds to payment
- ✅ User B: Stock locked (2 units), proceeds to payment
- ✅ Database: All 4 units locked (2 for User A, 2 for User B)

---

## 6️⃣ Complete Flow Diagrams

### 6.1 PhonePe Prepaid Flow (With Race Condition Protection)

```
User A Initiates Payment (Qty: 4)
  ↓
[1] Validation
  ├─ Product exists? ✅
  ├─ Stock available? ✅ (availableqty: 4 >= 4)
  └─ Promotions valid? ✅
  ↓
[2] Stock Locking (Transaction)
  ├─ SELECT FOR UPDATE (acquires row lock)
  ├─ Read: availableqty = 4, lockqty = 0
  ├─ Check: 4 >= 4 ✅
  ├─ Update: availableqty = 0, lockqty = 4
  └─ COMMIT (releases lock)
  ↓
[3] Transaction Created
  └─ status: "INITIATED"
  ↓
[4] PhonePe API Call
  └─ Get redirect URL
  ↓
[5] Return Response
  └─ redirectUrl: "https://phonepe.com/pay/..."
  ↓
[User A completes payment on PhonePe]
  ↓
[6] PhonePe Callback
  ├─ Check payment status: SUCCESS ✅
  └─ Create order
  ↓
[7] Order Creation
  ├─ Create Orders record
  ├─ Create Orderline records (auto)
  └─ Update promotion data
  ↓
[8] Stock Conversion (Lock → Order)
  ├─ PlatformStock:
  │   ├─ availableqty: 0 (unchanged)
  │   ├─ lockqty: 4 → 0 (unlock)
  │   └─ orderedqty: 0 → 4 (confirm)
  └─ Product:
      ├─ availablequantity: 10 → 6
      └─ orderedquantity: 0 → 4
  ↓
[9] Promotion Redemption
  └─ Mark promotions as redeemed
  ↓
[10] Order Complete ✅
```

---

### 6.2 Concurrent User Flow (User A vs User B)

```
Time    User A Flow                          User B Flow
─────────────────────────────────────────────────────────────────────
T1      POST /initiate (Qty: 4)              POST /initiate (Qty: 4)
        ↓                                    ↓
T2      Validation: ✅                       Validation: ✅
        ↓                                    ↓
T3      SELECT FOR UPDATE                    (waiting...)
        (acquires lock)                      ↓
        ↓                                    (blocked by User A)
T4      Read: availableqty = 4              (still blocked)
        ↓                                    ↓
T5      Check: 4 >= 4 ✅                     (still blocked)
        ↓                                    ↓
T6      Update: availableqty = 0            (still blocked)
              lockqty = 4                   ↓
        ↓                                    ↓
T7      COMMIT                              (lock released)
        (releases lock)                      ↓
        ↓                                    SELECT FOR UPDATE
T8      ✅ Success                          (acquires lock)
        (redirect to payment)                ↓
        ↓                                    Read: availableqty = 0
T9      (payment in progress)                ↓
        ↓                                    Check: 0 < 4 ❌
T10     (payment in progress)                ↓
        ↓                                    ERROR: Insufficient stock
T11     (payment in progress)                ↓
        ↓                                    ROLLBACK
T12     (payment in progress)                ↓
        ↓                                    400 Error Response ❌
T13     Payment Success ✅                   
        ↓                                   
T14     Order Created ✅                     
        ↓                                   
T15     Stock Converted ✅                  
```

---

## 7️⃣ Stock State Transitions

### 7.1 PlatformStock State Machine

```
Initial State:
  availableqty: 4
  lockqty: 0
  orderedqty: 0

After User A Locks (Qty: 4):
  availableqty: 0  ← Reduced (no longer available)
  lockqty: 4       ← Increased (reserved)
  orderedqty: 0    ← Unchanged

After User A Payment Success:
  availableqty: 0  ← Unchanged (already reduced)
  lockqty: 0       ← Decreased (unlocked)
  orderedqty: 4    ← Increased (confirmed)

After User A Payment Fails/Expires:
  availableqty: 4  ← Restored (released back)
  lockqty: 0       ← Decreased (unlocked)
  orderedqty: 0    ← Unchanged
```

### 7.2 Product State Machine

```
Initial State:
  availablequantity: 10
  orderedquantity: 0
  soldquantity: 0

After User A Payment Success (Qty: 4):
  availablequantity: 6   ← Decreased
  orderedquantity: 4     ← Increased
  soldquantity: 0        ← Unchanged

After User A Delivery:
  availablequantity: 6   ← Unchanged
  orderedquantity: 0     ← Decreased (moved to sold)
  soldquantity: 4        ← Increased
```

---

## 8️⃣ Key Takeaways

### 8.1 Race Condition Protection

✅ **SELECT FOR UPDATE** ensures:
- Only one transaction can lock stock at a time
- Second transaction waits and reads fresh data
- Prevents over-selling
- Atomic operations (all-or-nothing)

### 8.2 Stock Locking Logic

✅ **During Initiate:**
- `availableqty` decreases immediately (no longer available)
- `lockqty` increases (reserved for this transaction)
- If payment fails, lock is released back to `availableqty`

✅ **During Payment Success:**
- `lockqty` decreases (unlocked)
- `orderedqty` increases (confirmed)
- `availableqty` unchanged (already reduced)

### 8.3 Concurrent Order Scenarios

| Scenario | User A | User B | Result |
|----------|--------|--------|--------|
| Both order 4 (available: 4) | ✅ Gets 4 | ❌ Error | Correct |
| A orders 3, B orders 2 (available: 4) | ✅ Gets 3 | ❌ Error | Correct |
| A orders 3, B orders 1 (available: 4) | ✅ Gets 3 | ✅ Gets 1 | Correct |
| A orders 2, B orders 2 (available: 4) | ✅ Gets 2 | ✅ Gets 2 | Correct |

### 8.4 Error Handling

✅ **Insufficient Stock:**
- Returns 400 error immediately
- No stock locked
- User can retry with lower quantity

✅ **Payment Failure:**
- Lock released after timeout (15 minutes default)
- Stock restored to `availableqty`
- Other users can order

---

## 9️⃣ Database Transaction Isolation

### 9.1 Transaction Isolation Level

**Default:** `READ COMMITTED` (PostgreSQL default)

**SELECT FOR UPDATE Behavior:**
- Acquires **exclusive row lock**
- Other transactions **wait** until lock is released
- Ensures **serializable** behavior for stock locking

### 9.2 Lock Duration

**Lock Held:**
- From `SELECT FOR UPDATE` until transaction commits/rolls back
- Typically: < 100ms (validation + update)

**Lock Released:**
- On `COMMIT` (success)
- On `ROLLBACK` (error)

---

## 🔟 Summary

### Complete Order Flow Entities

1. **Product** → Master catalog (overall inventory)
2. **PlatformStock** → Platform-specific inventory (nivapp)
3. **Stock** → Individual items (RFID/barcode level)
4. **Transaction** → Payment transaction tracking
5. **Orders** → Order container
6. **Orderline** → Individual items in order

### Race Condition Protection

✅ **SELECT FOR UPDATE** prevents:
- Over-selling
- Stale data reads
- Lost updates

✅ **Transaction Atomicity** ensures:
- All-or-nothing operations
- Rollback on errors
- Data consistency

### Stock Quantity Flow

```
Initiate:     availableqty ↓, lockqty ↑
Payment:      lockqty ↓, orderedqty ↑
Delivery:     orderedqty ↓, soldqty ↑
Cancellation: orderedqty ↓, availableqty ↑
```

---

**Document Version:** 1.0  
**Last Updated:** December 2024  
**Status:** Complete Analysis

