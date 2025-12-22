# Order Cancellation Flow

**Version 3.0** — December 2024  
*Last Updated: 22 December 2024*

## 📋 Overview

This document defines the complete order cancellation flow for the Nivaana e-commerce platform. Cancellation is primarily a **customer-initiated action** through the mobile app, with rare admin-initiated cancellations through the inventory system.

### Key Concepts

- **Customer Cancellations**: Users cancel their own orders via mobile app (90%+ of cases)
- **Admin Cancellations**: Inventory users cancel orders (rare cases, e.g., out of stock)
- **Full Order Cancellation**: No partial cancellation - entire order is cancelled
- **Status-Based Logic**: Different stock reversal logic based on order status
- **Allowed Until Dispatch**: Cancellation only allowed before shipment is picked up

---

## 🚫 Cancellation Rules

### Allowed Order Statuses

Cancellation is **ONLY** permitted for orders with these statuses:

| Status | Description | Can Cancel? |
|--------|-------------|-------------|
| `order_placed` | Order created, payment pending | ✅ Yes |
| `payment_completed` | Payment successful (PhonePe) | ✅ Yes |
| `order_confirmed` | Order confirmed by system | ✅ Yes |
| `packed` | Items packed in box | ✅ Yes |
| `ready_for_dispatch` | Box ready, stock allocated | ✅ Yes |
| `shipped` | EKART shipment created & picked up | ❌ No - Use RTO |
| `in_transit` | Package in transit | ❌ No - Use RTO |
| `out_for_delivery` | Out for delivery | ❌ No - Use RTO |
| `delivered` | Delivered to customer | ❌ No - Use Return |

### Non-Cancellable Statuses

**Why can't shipped orders be cancelled?**
- Physical package is with courier
- Cannot be retrieved once picked up
- Customer must wait for delivery and initiate return
- Or RTO (Return to Origin) if delivery fails

---

## 🔄 Cancellation Paths

There are **TWO distinct cancellation paths** based on order lifecycle stage:

### Path 1: Pre-Ready-for-Dispatch Cancellation

**Applies to:** `order_placed`, `payment_completed`, `order_confirmed`, `packed`

**Stock State:**
- Stock is in `orderedqty` (reserved but not allocated to specific stock units)
- No physical stock allocation exists

**Reversal Logic:**

```
PlatformStock:
  availableqty ↑  (add back quantity)
  orderedqty ↓    (subtract quantity)
  soldqty         (no change)

Product:
  availablequantity ↑  (add back quantity)
  orderedquantity ↓    (subtract quantity)
  soldquantity         (no change)
```

**Flow Diagram:**

```
BEFORE CANCELLATION:
┌─────────────────────────────────────┐
│ Order Status: payment_completed     │
│ PlatformStock:                      │
│   availableqty: 97                  │
│   orderedqty: 3    ← RESERVED       │
│   soldqty: 50                       │
└─────────────────────────────────────┘

              ↓ CANCEL ORDER ↓

AFTER CANCELLATION:
┌─────────────────────────────────────┐
│ Order Status: cancelled             │
│ PlatformStock:                      │
│   availableqty: 100  ← RESTORED     │
│   orderedqty: 0      ← RELEASED     │
│   soldqty: 50                       │
└─────────────────────────────────────┘
```

---

### Path 2: Ready-for-Dispatch Cancellation

**Applies to:** `ready_for_dispatch`

**Stock State:**
- Stock is in `soldqty` (allocated to specific stock units)
- Physical stock allocation records exist in `stockallocation` table
- Stock records marked as `stockstatus: 'sold'` with `orderid` and `orderlinenumber`

**Reversal Logic:**

```
1. Stock Records (via stockallocation):
   stockstatus: 'sold' → 'available'
   orderid: <order_id> → NULL
   orderlinenumber: <number> → NULL
   solddate: <timestamp> → NULL

2. PlatformStock:
   availableqty ↑  (add back quantity)
   soldqty ↓       (subtract quantity)
   orderedqty      (no change)

3. Product:
   availablequantity ↑  (add back quantity)
   soldquantity ↓       (subtract quantity)
   orderedquantity      (no change)
```

**Flow Diagram:**

```
BEFORE CANCELLATION:
┌─────────────────────────────────────────────────────┐
│ Order Status: ready_for_dispatch                     │
│                                                      │
│ Stock Allocation:                                   │
│   Stock #123: stockstatus='sold', orderid=185       │
│   Stock #124: stockstatus='sold', orderid=185       │
│   Stock #125: stockstatus='sold', orderid=185       │
│                                                      │
│ PlatformStock:                                      │
│   availableqty: 97                                  │
│   orderedqty: 0                                     │
│   soldqty: 53      ← ALLOCATED                      │
└─────────────────────────────────────────────────────┘

              ↓ CANCEL ORDER ↓

AFTER CANCELLATION:
┌─────────────────────────────────────────────────────┐
│ Order Status: cancelled                              │
│                                                      │
│ Stock Allocation:                                   │
│   Stock #123: stockstatus='available', orderid=NULL │
│   Stock #124: stockstatus='available', orderid=NULL │
│   Stock #125: stockstatus='available', orderid=NULL │
│                                                      │
│ PlatformStock:                                      │
│   availableqty: 100  ← RESTORED                     │
│   orderedqty: 0                                     │
│   soldqty: 50        ← RELEASED                     │
└─────────────────────────────────────────────────────┘
```

---

## 🔌 API Endpoint

### POST `/v1/orders/:id/cancel`

**Description:** Cancel an order (customer or admin initiated)

**Parameters:**
- `id` (path): Order ID or Order Number (e.g., `185` or `NIVAANA-0000000185`)

**Request Body:**

```json
{
  "userid": 456,                          // Customer user ID (for customer cancellations)
  "inventory_user_id": 123,               // Inventory user ID (for admin cancellations)
  "cancellation_reason": "Changed my mind" // Required
}
```

**Validation Rules:**
1. At least one of `userid` OR `inventory_user_id` must be provided
2. If `userid` is provided, it must match the order's `userid`
3. `cancellation_reason` is always required
4. Order status must be in allowed list

**Response (Success - 200):**

```json
{
  "success": true,
  "message": "Order cancelled successfully",
  "data": {
    "id": 185,
    "orderid": "NIVAANA-0000000185",
    "orderstatus": "cancelled",
    "cancelleddate": 1734682800000,
    "status_history": [
      {
        "previous_status": "payment_completed",
        "new_status": "cancelled",
        "changed_date": 1734682800000,
        "source": "customer",
        "userid": 456,
        "cancellation_reason": "Changed my mind"
      }
    ]
  }
}
```

**Response (Error - 400):**

```json
{
  "success": false,
  "message": "Order cannot be cancelled. Current status: shipped",
  "statusCode": 400
}
```

**Response (Error - 403):**

```json
{
  "success": false,
  "message": "Unauthorized: userid does not match order owner",
  "statusCode": 403
}
```

---

## 📊 Database Changes

### Orders Table

| Field | Before Cancel | After Cancel |
|-------|--------------|--------------|
| `orderstatus` | `payment_completed` | `cancelled` |
| `cancelleddate` | `NULL` | `1734682800000` |
| `status_history` | `[...]` | `[..., {new_status: "cancelled", ...}]` |
| `modifieddate` | `<old>` | `<current_timestamp>` |

### Orderline Table

| Field | Before Cancel | After Cancel |
|-------|--------------|--------------|
| `orderstatus` | `payment_completed` | `cancelled` |
| `cancelleddate` | `NULL` | `1734682800000` |
| `status_history` | `[...]` | `[..., {new_status: "cancelled", ...}]` |
| `modifieddate` | `<old>` | `<current_timestamp>` |

### Stock Table (Ready-for-Dispatch Only)

| Field | Before Cancel | After Cancel |
|-------|--------------|--------------|
| `stockstatus` | `'sold'` | `'available'` |
| `orderid` | `'NIVAANA-0000000185'` | `NULL` |
| `orderlinenumber` | `'OL-001'` | `NULL` |
| `solddate` | `1734682700000` | `NULL` |
| `modifieddate` | `<old>` | `<current_timestamp>` |

### PlatformStock Table

**Path 1 (Pre-Ready-for-Dispatch):**
| Field | Before Cancel | After Cancel | Change |
|-------|--------------|--------------|--------|
| `availableqty` | `97` | `100` | ↑ +3 |
| `orderedqty` | `3` | `0` | ↓ -3 |
| `soldqty` | `50` | `50` | No change |

**Path 2 (Ready-for-Dispatch):**
| Field | Before Cancel | After Cancel | Change |
|-------|--------------|--------------|--------|
| `availableqty` | `97` | `100` | ↑ +3 |
| `orderedqty` | `0` | `0` | No change |
| `soldqty` | `53` | `50` | ↓ -3 |

### Product Table

**Path 1 (Pre-Ready-for-Dispatch):**
| Field | Before Cancel | After Cancel | Change |
|-------|--------------|--------------|--------|
| `availablequantity` | `97` | `100` | ↑ +3 |
| `orderedquantity` | `3` | `0` | ↓ -3 |
| `soldquantity` | `50` | `50` | No change |

**Path 2 (Ready-for-Dispatch):**
| Field | Before Cancel | After Cancel | Change |
|-------|--------------|--------------|--------|
| `availablequantity` | `97` | `100` | ↑ +3 |
| `orderedquantity` | `0` | `0` | No change |
| `soldquantity` | `53` | `50` | ↓ -3 |

---

## 👤 Customer vs Admin Cancellation

### Customer Cancellation (Primary Use Case)

**When:** User cancels their order via mobile app

**Request:**
```json
{
  "userid": 456,
  "cancellation_reason": "Changed my mind"
}
```

**Status History:**
```json
{
  "previous_status": "payment_completed",
  "new_status": "cancelled",
  "changed_date": 1734682800000,
  "source": "customer",
  "userid": 456,
  "cancellation_reason": "Changed my mind"
}
```

**Validation:**
- ✅ Verify `userid` matches `order.userid`
- ✅ Return 403 if user tries to cancel someone else's order

---

### Admin Cancellation (Rare Use Case)

**When:** Inventory user cancels order (e.g., out of stock, quality issue)

**Request:**
```json
{
  "inventory_user_id": 123,
  "cancellation_reason": "Product out of stock"
}
```

**Status History:**
```json
{
  "previous_status": "payment_completed",
  "new_status": "cancelled",
  "changed_date": 1734682800000,
  "source": "inventoryuser",
  "inventory_user_id": 123,
  "cancellation_reason": "Product out of stock"
}
```

**Validation:**
- ✅ Inventory user must be authenticated
- ✅ No userid validation required

---

## 🔁 Complete Cancellation Flow

### Customer Cancellation Example

```
1. Customer opens order in mobile app
   Order #185: status = 'payment_completed'
   
2. Customer taps "Cancel Order" button
   
3. App prompts for cancellation reason
   Customer selects: "Changed my mind"
   
4. App sends POST request:
   POST /v1/orders/185/cancel
   {
     "userid": 456,
     "cancellation_reason": "Changed my mind"
   }
   
5. Backend validates:
   ✓ Order exists
   ✓ userid (456) matches order.userid (456)
   ✓ Order status is 'payment_completed' (cancellable)
   
6. Backend determines cancellation path:
   → Path 1 (Pre-Ready-for-Dispatch)
   
7. Backend reverses stock:
   - PlatformStock: orderedqty ↓, availableqty ↑
   - Product: orderedquantity ↓, availablequantity ↑
   
8. Backend updates order & orderlines:
   - orderstatus → 'cancelled'
   - cancelleddate → current timestamp
   - status_history → append cancellation entry
   
9. Backend returns success response
   
10. App shows confirmation:
    "Order cancelled successfully. 
     Refund will be processed in 5-7 business days."
```

---

## 🧪 Testing Scenarios

### Test Case 1: Customer Cancels Payment_Completed Order

**Setup:**
- Create order via PhonePe (ensure payment completes)
- Order ID: 185
- User ID: 456
- Status: `payment_completed`

**Test:**
```bash
curl -X POST http://localhost:5600/v1/orders/185/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "userid": 456,
    "cancellation_reason": "Changed my mind"
  }'
```

**Expected:**
- ✅ Status 200
- ✅ `orderstatus`: `cancelled`
- ✅ `status_history` contains customer entry
- ✅ Stock quantities restored

---

### Test Case 2: Customer Cancels Ready_For_Dispatch Order

**Setup:**
- Create order and mark as `ready_for_dispatch`
- Stock allocated in `stockallocation` table

**Test:**
```bash
curl -X POST http://localhost:5600/v1/orders/185/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "userid": 456,
    "cancellation_reason": "No longer needed"
  }'
```

**Expected:**
- ✅ Status 200
- ✅ Stock allocations cleared
- ✅ Stock status changed to `available`
- ✅ PlatformStock `soldqty` decreased
- ✅ Product `soldquantity` decreased

---

### Test Case 3: Reject Cancellation for Shipped Order

**Setup:**
- Order status: `shipped`

**Test:**
```bash
curl -X POST http://localhost:5600/v1/orders/185/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "userid": 456,
    "cancellation_reason": "Test"
  }'
```

**Expected:**
- ✅ Status 400
- ✅ Error: "Order cannot be cancelled. Current status: shipped"
- ✅ No changes to order or stock

---

### Test Case 4: Reject Unauthorized Cancellation

**Setup:**
- Order belongs to userid 456
- Different user (999) attempts cancellation

**Test:**
```bash
curl -X POST http://localhost:5600/v1/orders/185/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "userid": 999,
    "cancellation_reason": "Test"
  }'
```

**Expected:**
- ✅ Status 403
- ✅ Error: "Unauthorized: userid does not match order owner"
- ✅ No changes to order or stock

---

### Test Case 5: Admin Cancellation

**Setup:**
- Order status: `payment_completed`
- Admin user ID: 123

**Test:**
```bash
curl -X POST http://localhost:5600/v1/orders/185/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "inventory_user_id": 123,
    "cancellation_reason": "Product out of stock"
  }'
```

**Expected:**
- ✅ Status 200
- ✅ `status_history` source: `inventoryuser`
- ✅ `status_history` contains `inventory_user_id: 123`
- ✅ Stock quantities restored

---

---

## � Implementation Status (December 2024)

### ✅ Phase 1: Combo Product Support - COMPLETE

**Status:** Production Ready  
**Implementation Date:** 22 December 2024

**Key Changes:**

1. **Combo Product Detection**
   ```typescript
   if (product.iscombo === true) {
     // Get components from productbundlemap
     // Reverse component stock only
   }
   ```

2. **Component Stock Reversal**
   - Query `productbundlemap` for components
   - Calculate: `componentQty = requiredqty × orderline.quantity`
   - Reverse component `PlatformStock` and `Product` quantities
   - **IMPORTANT:** Combo product itself is NOT reversed (virtual product)

3. **Example:**
   ```
   Order: 2x Combo Pack (Product 88)
   Components:
     - Product 86: requiredqty = 1 → Reverse 2 units
     - Product 87: requiredqty = 1 → Reverse 2 units
   
   Product 88 (combo): NO stock change ✅
   ```

**Files Modified:**
- `src/services/orders.service.ts` (Lines 1918-1992, 2146-2227)

---

### ✅ Phase 2: Transaction Wrapping - COMPLETE

**Status:** Production Ready  
**Implementation Date:** 22 December 2024

**Key Changes:**

1. **Prisma Transaction Wrapper**
   ```typescript
   await prisma.$transaction(async (tx) => {
     // All cancellation operations
   }, {
     timeout: 30000,  // 30 seconds
     maxWait: 5000    // 5 seconds
   });
   ```

2. **Transaction Scope (Atomic):**
   - Stock reversal (pre-dispatch OR post-dispatch)
   - Orderline status updates
   - Order status update
   - Fetch updated order

3. **Benefits:**
   - ✅ **Automatic Rollback:** If ANY step fails, ALL changes revert
   - ✅ **Data Integrity:** No partial updates possible
   - ✅ **Production Safe:** Handles network/database failures gracefully

**Files Modified:**
- `src/services/orders.service.ts` (Lines 1824-1876)

---

### ✅ Phase 3: Idempotency - COMPLETE

**Status:** Production Ready  
**Implementation Date:** 22 December 2024

**Key Changes:**

1. **Duplicate Cancellation Handling**
   ```typescript
   if (order.orderstatus === 'cancelled') {
     logger.info('Order already cancelled - returning existing state');
     return order;  // No error, just return
   }
   ```

2. **Behavior:**
   - Second cancellation returns existing cancelled order
   - No error thrown (200 status)
   - No duplicate status history entries
   - Logged for monitoring

**Files Modified:**
- `src/services/orders.service.ts` (Lines 1780-1789)

---

### ✅ Phase 4: Manual Refund Workflow + Transaction Tracking - PRODUCTION READY

**Status:** Production Ready  
**Implementation Date:** 22 December 2024

**Key Features:**

1. **NO Automatic Refund Processing**
   - Order cancellation ONLY handles stock reversal and status update
   - Refunds must be manually processed by admins via PhonePe portal
   - Clear status progression tracking for refund lifecycle

2. **Auto-Complete COD Orders** ✅ NEW
   - COD orders automatically transition to `cancelled_completed` after cancellation
   - No admin action needed (no refund required)
   - Saves admin time and effort

3. **Transaction Table Updates** ✅ NEW
   - `transaction.transactiondata` updated with cancellation info
   - Complete audit trail for financial reconciliation
   - Tracks refund progression through all statuses
   - Non-blocking: errors logged but don't fail cancellation

4. **New Order Statuses:**
   - `cancelled`: Order cancelled, stock reversed, awaiting admin refund action (PhonePe only)
   - `cancelled_refund_processing`: Admin processing refund via PhonePe portal
   - `cancelled_refunded`: Refund completed, customer credited (final status)
   - `cancelled_completed`: COD order cancellation complete (final status)

5. **Status Progression:**
   ```
   PhonePe Orders:
   payment_completed → [Cancel] → cancelled 
                    → [Admin: Start Refund] → cancelled_refund_processing
                    → [Admin: Refund Complete] → cancelled_refunded
   
   COD Orders:
   order_confirmed → [Cancel] → cancelled → AUTOMATIC → cancelled_completed
   (No admin action required - auto-completed immediately)
   ```

6. **Admin Workflow:**
   
   **PhonePe Orders:**
   - Customer/Admin cancels order → Status: `cancelled`
   - Transaction updated: `order_status: "CANCELLED_AWAITING_REFUND"`
   - Admin logs into PhonePe portal
   - Admin initiates refund → Updates status to `cancelled_refund_processing`
   - Transaction updated: `order_status: "REFUND_PROCESSING"`
   - PhonePe processes refund (5-7 business days)
   - Admin confirms completion → Updates status to `cancelled_refunded`
   - Transaction updated: `order_status: "REFUNDED"`
   
   **COD Orders:**
   - Customer/Admin cancels order → Transaction processes all cancellation steps
   - Stock reversed, order/orderlines updated to `cancelled`
   - Transaction updated: `order_status: "ORDER_CANCELLED"`
   - Transaction commits successfully
   - **AUTOMATIC** (at end of all services) → Status changes to `cancelled_completed`
   - Transaction updated: `order_status: "CANCELLATION_COMPLETED"`
   - No admin action required ✅

7. **API Endpoint:**
   ```typescript
   PATCH /v1/orders/:id/refund-status
   {
     "status": "cancelled_refund_processing" | "cancelled_refunded" | "cancelled_completed",
     "admin_user_id": 123,
     "notes": "Refund processed via PhonePe portal, txn: PE_123456"
   }
   ```

8. **Validation:**
   - Only `cancelled` or `cancelled_refund_processing` can be updated
   - Final statuses (`cancelled_refunded`, `cancelled_completed`) cannot be changed
   - Admin user ID required for audit trail
   - Status progression logged in `status_history`

9. **Transaction Table Updates:**
   - All cancellations update `transaction.transactiondata` with:
     - `order_cancelled: true`
     - `cancelled_date`, `cancellation_source`, `cancellation_reason`
     - `order_status` based on payment mode and refund stage
   - Refund status updates also tracked in transaction
   - See "Transaction Table Updates" section below for details

**Files Modified:**
- `src/services/orders.service.ts` (Lines 1921-1960, 1973-1982, 2095-2280)
- `src/controllers/orders.controller.ts` (Lines 404-511)
- `src/routes/orders.route.ts` (Lines 668-722)

---

## 🔧 Service Implementation Details

### Stock Reversal Service Methods

**Location:** `src/services/orders.service.ts`

#### 1. `cancelOrderBeforeReadyForDispatch(orderId, orderlines)`
**Lines:** 2020-2137  
**Purpose:** Reverse `orderedqty` → `availableqty`  
**Combo Support:** ✅ Yes (Lines 1918-1992)

```typescript
private async cancelOrderBeforeReadyForDispatch(
  orderId: number,
  orderlines: any[]
): Promise<void>
```

**Logic:**
1. Aggregate quantities by product
2. **If combo:** Query components, calculate totals
3. Update `PlatformStock`: `availableqty ↑`, `orderedqty ↓`
4. Update `Product`: `availablequantity ↑`, `orderedquantity ↓`

---

#### 2. `cancelOrderAfterReadyForDispatch(orderId, orderlines)`
**Lines:** 2219-2369  
**Purpose:** Reverse stock allocations + `soldqty` → `availableqty`  
**Combo Support:** ✅ Yes (Lines 2146-2227)

```typescript
private async cancelOrderAfterReadyForDispatch(
  orderId: number,
  orderlines: any[]
): Promise<void>
```

**Logic:**
1. Find allocated `stock` records (by `orderid` + `orderlinenumber`)
2. Reset stock: `stockstatus → 'available'`, clear `orderid`, `orderlinenumber`
3. **If combo:** Query components, calculate totals
4. Update `PlatformStock`: `availableqty ↑`, `soldqty ↓`
5. Update `Product`: `availablequantity ↑`, `soldquantity ↓`

---

#### 3. `handleCancellationRefundAndNotification(order, reason)`
**Lines:** 1907-2018  
**Purpose:** Trigger refund + email after successful cancellation  
**Runs:** Outside transaction (non-blocking)

```typescript
private async handleCancellationRefundAndNotification(
  order: any,
  cancellationReason?: string
): Promise<void>
```

**Logic:**
1. Fetch transaction record
2. Determine payment mode (COD vs PhonePe)
3. Check PhonePe SUCCESS status
4. Log refund integration point
5. Log email integration point
6. Errors logged but don't block cancellation

---

## 🧪 Testing Checklist

### Prerequisites
- Order with combo product (ID 88, components 86 & 87)
- PhonePe payment (successful transaction)
- COD order

### Test Scenarios

#### ✅ Combo Product Cancellation (Pre-Dispatch)
```bash
# 1. Create order with 2x Product 88
# 2. Check component stock decreased
# 3. Cancel order
curl -X POST http://localhost:5600/v1/orders/{id}/cancel \
  -d '{"userid": 41, "cancellation_reason": "Test combo"}'
# 4. Verify: Components 86 & 87 stock restored
# 5. Verify: Product 88 stock unchanged
```

#### ✅ Combo Product Cancellation (Post-Dispatch)
```bash
# 1. Create order, mark ready_for_dispatch
# 2. Verify stock records allocated
# 3. Cancel order
# 4. Verify: Stock records cleared
# 5. Verify: Component soldqty restored
```

#### ✅ Idempotency Test
```bash
# Cancel same order twice
curl -X POST http://localhost:5600/v1/orders/{id}/cancel \
  -d '{"userid": 41, "cancellation_reason": "First"}'
# Returns 200

curl -X POST http://localhost:5600/v1/orders/{id}/cancel \
  -d '{"userid": 41, "cancellation_reason": "Second"}'
# Also returns 200 (idempotent)
---

## 💰 Admin Refund Workflow

### Overview

After an order is cancelled, admins must manually process refunds via PhonePe portal and update the order status via API.

### Step-by-Step Process

#### Step 1: Order Cancellation
- Customer or admin cancels order via `POST /v1/orders/:id/cancel`
- Order status changes to `cancelled`
- Stock is automatically reversed
- **NO automatic refund is initiated**

#### Step 2: Admin Reviews Cancelled Orders
- Query cancelled orders: `GET /v1/orders?orderstatus=cancelled`
- Identify orders requiring refund (check `mode` and `ispaymentsucceed`)
  - **PhonePe SUCCESS**: Refund needed
  - **COD**: No refund needed (can skip to Step 5)

#### Step 3: Admin Initiates Refund (PhonePe Portal)
1. Log into PhonePe Merchant Portal
2. Navigate to Transactions → Refunds
3. Enter transaction details:
   - Merchant Transaction ID: `order.merchanttransactionid`
   - Refund Amount: `order.orderamount`
   - Reason: Customer cancellation
4. Submit refund request
5. **Update order status immediately** via API:

```bash
PATCH /v1/orders/{orderId}/refund-status
{
  "status": "cancelled_refund_processing",
  "admin_user_id": 123,
  "notes": "Refund initiated via PhonePe portal on 22-Dec-2024"
}
```

#### Step 4: Monitor Refund Processing
- PhonePe typically processes refunds within 5-7 business days
- Check PhonePe portal for refund status updates
- Customer's bank credits the amount (timing varies by bank)

#### Step 5: Mark Refund as Complete
Once refund is confirmed in PhonePe portal:

```bash
PATCH /v1/orders/{orderId}/refund-status
{
  "status": "cancelled_refunded",
  "admin_user_id": 123,
  "notes": "Refund completed, PhonePe txn: PE_123456789, credited on 29-Dec-2024"
}
```

**For COD Orders:**
```bash
PATCH /v1/orders/{orderId}/refund-status
{
  "status": "cancelled_completed",
  "admin_user_id": 123,
  "notes": "COD order cancellation complete, no refund needed"
}
```

---

### Status Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  CUSTOMER/ADMIN CANCELS ORDER                               │
│  POST /v1/orders/:id/cancel                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
          ┌──────────────────┐
          │   cancelled      │  Stock reversed ✅
          │ (Awaiting Admin) │  Refund: NOT started ❌
          └────────┬─────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
        ▼ (PhonePe)          ▼ (COD)
┌─────────────────────┐   ┌─────────────────────┐
│ Admin starts refund │   │  Admin marks done   │
│ in PhonePe portal   │   │  (no refund needed) │
└────────┬────────────┘   └────────┬────────────┘
         │                         │
         ▼                         ▼
┌────────────────────────────┐  ┌──────────────────────┐
│ cancelled_refund_processing│  │ cancelled_completed  │
│  (Refund in progress)      │  │  (FINAL STATUS)      │
└────────┬───────────────────┘  └──────────────────────┘
         │
         │ (5-7 business days)
         │
         ▼
┌─────────────────────┐
│ cancelled_refunded  │
│   (FINAL STATUS)    │
└─────────────────────┘
```

---

### API Reference

#### Update Refund Status
**Endpoint:** `PATCH /v1/orders/:id/refund-status`

**Request:**
```json
{
  "status": "cancelled_refund_processing | cancelled_refunded | cancelled_completed",
  "admin_user_id": 123,
  "notes": "Optional notes about refund processing"
}
```

**Response (Success - 200):**
```json
{
  "success": true,
  "message": "Refund status updated successfully",
  "data": {
    "id": 185,
    "orderid": "NIVAANA-0000000185",
    "orderstatus": "cancelled_refunded",
    "status_history": [
      {
        "previous_status": "cancelled_refund_processing",
        "new_status": "cancelled_refunded",
        "changed_date": 1735459200000,
        "source": "inventoryuser",
        "inventory_user_id": 123,
        "refund_notes": "Refund completed, PhonePe txn: PE_123456789"
      }
    ]
  }
}
```

**Response (Error - 400):**
```json
{
  "success": false,
  "message": "Cannot update refund status. Order must be in 'cancelled' or 'cancelled_refund_processing' status. Current status: shipped",
  "statusCode": 400
}
```

---

### Common Scenarios

#### Scenario 1: PhonePe Order - Full Refund Flow
```bash
# 1. Customer cancels
POST /v1/orders/185/cancel
# Result: orderstatus = "cancelled"

# 2. Admin initiates refund in PhonePe portal
# Then updates status:
PATCH /v1/orders/185/refund-status
{
  "status": "cancelled_refund_processing",
  "admin_user_id": 123,
  "notes": "Refund submitted to PhonePe"
}

# 3. Wait 5-7 days, confirm refund completed
# Then update:
PATCH /v1/orders/185/refund-status
{
  "status": "cancelled_refunded",
  "admin_user_id": 123,
  "notes": "Refund confirmed by PhonePe, customer credited"
}
```

#### Scenario 2: COD Order - No Refund Needed
```bash
# 1. Customer cancels
POST /v1/orders/186/cancel
# Result: orderstatus = "cancelled"

# 2. Admin marks as complete (no refund needed)
PATCH /v1/orders/186/refund-status
{
  "status": "cancelled_completed",
  "admin_user_id": 123,
  "notes": "COD order, no refund required"
}
```

#### Scenario 3: Query All Pending Refunds
```bash
# Find all cancelled orders awaiting refund processing
GET /v1/orders?orderstatus=cancelled&ispaymentsucceed=true&mode=phonepe
```

---

#### ✅ Transaction Rollback Test
```typescript
// Temporarily add error in transaction
throw new Error('TEST ROLLBACK');

// Expected: All changes rolled back
// Order status: unchanged
// Stock: unchanged
```

#### ✅ Refund Logic Test
```bash
# PhonePe SUCCESS order
curl -X POST http://localhost:5600/v1/orders/{id}/cancel \
  -d '{"userid": 41, "cancellation_reason": "Refund test"}'

# Check logs for:
# ✅ "PhonePe payment SUCCESS - refund will be initiated"
# ✅ "EMAIL INTEGRATION POINT: Send cancellation email"
```

---

## 📝 Implementation Notes

1. **Atomic Operations**: ✅ **IMPLEMENTED** - All cancellation logic wrapped in Prisma transaction (30s timeout)

2. **Idempotency**: ✅ **IMPLEMENTED** - Cancelling an already cancelled order returns current state (no error)

3. **Refund Handling**: ✅ **IMPLEMENTED** - Manual admin-driven refund workflow via PhonePe portal
   - COD orders: Auto-completed to `cancelled_completed`
   - PhonePe orders: Admin manually processes via `PATCH /v1/orders/:id/refund-status`

4. **Transaction Table**: ✅ **IMPLEMENTED** - Complete audit trail in `transaction.transactiondata`
   - Cancellation info tracked (source, reason, date)
   - Refund progression tracked (status, admin user, notes)
   - Non-blocking updates (errors don't fail cancellation)

5. **Notification**: ⏸️ **FUTURE ENHANCEMENT** - Email notifications for refund stages not yet implemented

6. **Analytics**: 📝 **FUTURE ENHANCEMENT** - Track cancellation reasons for business insights

7. **Audit Trail**: ✅ **IMPLEMENTED** - Complete status history maintained for orders, orderlines, and transactions

8. **Combo Products**: ✅ **IMPLEMENTED** - Component stock reversal via `productbundlemap`, combo product itself not reversed

---

## � Transaction Table Updates

### Overview

The `transaction` table maintains a complete audit trail of order cancellations and refund processing by updating the `transactiondata` JSONB field with status progression.

---

### Transaction Status Flow

#### COD Orders
```
Initial: { status: "SUCCESS" }
    ↓ Cancel Order
Cancelled: { status: "SUCCESS", order_status: "ORDER_CANCELLED", ... }
    ↓ Auto-Complete
Completed: { status: "SUCCESS", order_status: "CANCELLATION_COMPLETED", ... }
```

#### PhonePe Orders
```
Initial: { status: "SUCCESS" }
    ↓ Cancel Order
Cancelled: { status: "SUCCESS", order_status: "CANCELLED_AWAITING_REFUND", ... }
    ↓ Admin Starts Refund
Processing: { status: "SUCCESS", order_status: "REFUND_PROCESSING", ... }
    ↓ Admin Completes Refund
Refunded: { status: "SUCCESS", order_status: "REFUNDED", ... }
```

---

### Transaction Status Values

| Status | Description | Payment Mode | Trigger |
|--------|-------------|--------------|---------|
| `ORDER_CANCELLED` | Order cancelled, no refund needed | COD | Automatic on cancel |
| `CANCELLED_AWAITING_REFUND` | Order cancelled, awaiting refund | PhonePe | Automatic on cancel |
| `REFUND_PROCESSING` | Admin processing refund | PhonePe | Admin updates status |
| `REFUNDED` | Refund completed | PhonePe | Admin updates status |
| `CANCELLATION_COMPLETED` | Cancellation process complete | COD | Auto after cancel |

---

### Fields in transactiondata

#### Added on Cancellation
```json
{
  "status": "SUCCESS",  // Original PhonePe/COD status
  "order_cancelled": true,
  "cancelled_date": 1734682800000,
  "cancellation_source": "customer",  // or "inventoryuser"
  "cancellation_reason": "Changed my mind",
  "order_status": "ORDER_CANCELLED"  // or "CANCELLED_AWAITING_REFUND"
}
```

#### Updated on Refund Status Change
```json
{
  // ... previous fields ...
  "order_status": "REFUND_PROCESSING",  // Updated status
  "refund_status_updated_date": 1735459200000,
  "refund_admin_user": 123,
  "refund_notes": "Refund submitted to PhonePe portal"
}
```

---

### Implementation Details

#### 1. cancelOrder() Method
**Location:** `src/services/orders.service.ts`

Updates transaction immediately after order cancellation:
- Fetches transaction by `merchanttransactionid`
- Merges cancellation info into existing `transactiondata`
- Updates `modifieddate` timestamp
- **Non-blocking:** Errors logged but don't fail cancellation

**Status Logic:**
- If `mode === 'cod'` → `order_status: "ORDER_CANCELLED"`
- If `mode === 'phonepe'` → `order_status: "CANCELLED_AWAITING_REFUND"`

#### 2. updateRefundStatus() Method
**Location:** `src/services/orders.service.ts`

Updates transaction when admin changes refund status:
- Fetches transaction by `merchanttransactionid`
- Maps order status to transaction status:
  - `cancelled_refund_processing` → `"REFUND_PROCESSING"`
  - `cancelled_refunded` → `"REFUNDED"`
  - `cancelled_completed` → `"CANCELLATION_COMPLETED"`
- Stores admin user ID and notes
- **Non-blocking:** Errors logged but don't fail status update

---

### Query Examples

#### Find Pending PhonePe Refunds
```sql
SELECT 
  id,
  merchanttransactionid,
  transactiondata->>'order_status' as order_status,
  transactiondata->>'cancelled_date' as cancelled_date
FROM transaction 
WHERE transactiondata->>'order_status' = 'CANCELLED_AWAITING_REFUND'
ORDER BY (transactiondata->>'cancelled_date')::bigint DESC;
```

#### Find Refunds In Progress
```sql
SELECT 
  id,
  merchanttransactionid,
  transactiondata->>'refund_admin_user' as admin_user,
  transactiondata->>'refund_notes' as notes
FROM transaction 
WHERE transactiondata->>'order_status' = 'REFUND_PROCESSING';
```

#### Cancellation Reason Statistics
```sql
SELECT 
  transactiondata->>'cancellation_reason' as reason,
  transactiondata->>'cancellation_source' as source,
  COUNT(*) as count
FROM transaction
WHERE (transactiondata->>'order_cancelled')::boolean = true
GROUP BY reason, source
ORDER BY count DESC;
```

#### Average Refund Processing Time
```sql
SELECT 
  AVG(
    (transactiondata->>'refund_status_updated_date')::bigint - 
    (transactiondata->>'cancelled_date')::bigint
  ) / 86400000 as avg_days_to_refund
FROM transaction
WHERE transactiondata->>'order_status' = 'REFUNDED';
```

---

### Benefits

1. **Complete Audit Trail**
   - Track every step of cancellation and refund
   - Know exactly when, why, and by whom

2. **Financial Reconciliation**
   - Match with payment gateway reports
   - Identify pending refunds instantly
   - Track refund completion timeline

3. **Customer Service**
   - Quick refund status lookup
   - Accurate information for customers
   - Historical data for disputes

4. **Business Analytics**
   - Analyze cancellation patterns
   - Measure refund processing efficiency
   - Identify common cancellation reasons

---

## �🔗 Related Documentation

- [ORDER_ORDERLINE_LIFECYCLE_COMPLETE.md](./ORDER_ORDERLINE_LIFECYCLE_COMPLETE.md) - Complete order lifecycle
- [PHONEPE_PAYMENT_IMPLEMENTATION_GUIDE.md](./PHONEPE_PAYMENT_IMPLEMENTATION_GUIDE.md) - Order creation flow
- [ORDER_ORDERLINE_FIELDS_MASTER_REFERENCE.md](./ORDER_ORDERLINE_FIELDS_MASTER_REFERENCE.md) - Field definitions

**Implementation Artifacts:**
- `/Users/jeyakumarn/.gemini/antigravity/brain/.../walkthrough.md` - Combo product implementation walkthrough
- `/Users/jeyakumarn/.gemini/antigravity/brain/.../combo_logic_corrected.md` - Combo logic diagram
- `/Users/jeyakumarn/.gemini/antigravity/brain/.../transaction_wrapping_summary.md` - Transaction implementation
- `/Users/jeyakumarn/.gemini/antigravity/brain/.../idempotency_refund_summary.md` - Idempotency & refund details

---

## ⚠️ Important Reminders

- ❌ **No Partial Cancellation**: Entire order is cancelled, not individual products
- ❌ **No Post-Shipment Cancellation**: Use RTO flow for shipped orders
- ✅ **Customer Ownership**: Always verify userid matches order owner
- ✅ **Stock Restoration**: Different logic for pre/post ready-for-dispatch
- ✅ **Status History**: Track who cancelled (customer vs admin) with reason
- ✅ **Combo Products**: Only component stock is reversed, NOT the combo product itself
- ✅ **Transaction Safety**: All operations are atomic, automatic rollback on failure
- ✅ **Idempotent**: Duplicate cancellations handled gracefully, no errors

---

*Document Version: 3.0*  
*Last Updated: 22 December 2024*  
*Implementation Complete: All Phases (Combo, Transaction Safety, Idempotency, Manual Refund, Transaction Tracking, Auto-COD)*

