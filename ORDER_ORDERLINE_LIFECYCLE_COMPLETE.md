# Order & Orderline Lifecycle - Complete System Design

**Version 2.0** — December 2025  
*Applies to: PhonePe (Prepaid), COD, Ekart Forward/RTO, App Order Placement*

## 📋 Table of Contents

1. [Overview](#1-overview)
2. [Final Status List](#2-final-status-list)
3. [Status Aggregation Rules (Order ⇐ Orderline)](#3-status-aggregation-rules-order--orderline)
4. [Prepaid & COD Flows](#4-prepaid--cod-flows)
5. [End-to-End Status Flow](#5-end-to-end-status-flow)
6. [Cancellation, Return & RTO Logic](#6-cancellation-return--rto-logic)
7. [Ekart Status Mapping](#7-ekart-status-mapping)
8. [Stock Management Rules](#8-stock-management-rules)
9. [Status History Storage](#9-status-history-storage)
10. [Order & Orderline Creation (PhonePe Payment Flow)](#10-order--orderline-creation-phonepe-payment-flow)
11. [Database Operations Summary](#11-database-operations-summary)
12. [FAQ](#12-faq)

---

## 1️⃣ Overview

This document defines the complete lifecycle of:
- **Order** (container object)
- **Orderline** (physical product item in the order)

Includes full flows for:
- PhonePe Prepaid
- COD (Cash on Delivery)
- Ekart Shipment, Delivery, RTO
- Cancellation, Return
- Stock operations
- Box Packing (Single-box for full order)

### Key Concepts

- **Orderlines**: Track the actual movement of physical items (true lifecycle)
- **Orders**: Derived status from combination of all orderlines (computed summary)
- **Status Aggregation**: Order status is always derived from orderline statuses, never manually set
- **Single Box**: One order = one box = one Ekart shipment (one AWB)
- **Stock Management**: Lock → Order → Cancel/Return (with restoration)

---

## 2️⃣ Final Status List

**Orderline statuses** represent the true movement of the physical items.  
**Order status** is derived from the combination of all orderlines.

### 2.1 Orderline Statuses (Actual Item Lifecycle)

| Status | Description | Who Sets | Date Field | Stock Action | Ekart Integration |
|--------|-------------|----------|------------|--------------|-------------------|
| **`order_placed`** | Orderline created; stock reserved | System | `ordereddate` | Reserve stock | - |
| **`payment_completed`** | Payment done (Prepaid), OR COD accepted | System | `paymentcompleteddate` | Convert lock→order | - |
| **`payment_failed`** | Prepaid payment failed | System | `paymentfaileddate` | Release reserved stock | - |
| **`order_confirmed`** | Warehouse accepted orderline | System | `orderconfirmeddate` | None | - |
| **`packed`** | Orderline packed into box | Warehouse | `packeddate` | None | - |
| **`ready_for_dispatch`** | Box ready; manifest generated | Warehouse | `readytodispatchdate` | None | - |
| **`shipped`** | Ekart AWB created | System | `shipdate` | None | ✅ Ekart AWB created |
| **`in_transit`** | Ekart event | Ekart | None | None | ✅ Tracking |
| **`out_for_delivery`** | Ekart event | Ekart | None | None | ✅ Tracking |
| **`delivered`** | Delivered to customer | Ekart | `delivereddate` | None | ✅ Tracking |
| **`cod_payment_received`** | COD payment collected | Ekart | `paymentreceiveddate` | None | ✅ After delivery |
| **`cancelled`** | Orderline cancelled; stock restored | System / Customer | `cancelleddate` | ✅ Restore stock | Optional: Cancel AWB |
| **`return_initiated`** | Customer started return | Customer | `returninitiateddate` | None | Optional Ekart |
| **`returned`** | Reverse shipment delivered | Ekart | `returneddate` | ✅ Restore stock | Reverse AWB |
| **`rto_initiated`** | Delivery failed → Ekart returning | Ekart | None | ✅ Restore stock | Ekart RTO |
| **`rto_delivered`** | RTO item delivered to seller | Ekart | None | None | Ekart RTO |

### 2.2 Order Statuses (Derived, Not Manually Set)

| Status | Meaning |
|--------|---------|
| **`order_placed`** | Order created (all lines placed) |
| **`payment_completed`** | Prepaid done OR COD accepted |
| **`order_confirmed`** | All orderlines confirmed |
| **`packed`** | All orderlines packed in single box |
| **`ready_for_dispatch`** | All orderlines ready |
| **`shipped`** | All orderlines shipped (single AWB) |
| **`in_transit`** | All shipped and in transit |
| **`out_for_delivery`** | All OFD |
| **`delivered`** | All delivered |
| **`cod_payment_received`** | COD payment fully collected |
| **`partially_cancelled`** | Some orderlines cancelled |
| **`cancelled`** | All orderlines cancelled |
| **`partially_returned`** | Some returned |
| **`returned`** | All returned |
| **`rto_initiated`** | All RTO initiated |
| **`rto_delivered`** | All RTO delivered |

**Important:** Order status is **always derived** from orderline statuses, never manually set.

## 3️⃣ Status Aggregation Rules (Order ⇐ Orderline)

Order status is always derived, never manually set.

### 3.1 Primary Rule

**If all orderlines share the same status,**
→ **Order = that status**

**Example:**
```
OL1 = packed
OL2 = packed
OL3 = packed
→ Order = packed
```

### 3.2 Mixed Status Rule (Priority Order)

**If statuses vary, pick the lowest progress stage from this priority ladder:**

1. `order_placed`
2. `payment_completed`
3. `order_confirmed`
4. `packed`
5. `ready_for_dispatch`
6. `shipped`
7. `in_transit`
8. `out_for_delivery`
9. `delivered`
10. `cod_payment_received`
11. `cancelled`
12. `returned`
13. `rto_initiated`
14. `rto_delivered`

**Example:**
```
OL1 = shipped
OL2 = in_transit
→ Order = shipped   (lower stage)
```

### 3.3 Special Composite Rules

| Scenario | Order Status |
|----------|-------------|
| Some OL cancelled | `partially_cancelled` |
| All OL cancelled | `cancelled` |
| Some returned | `partially_returned` |
| All returned | `returned` |

### 3.4 Status Usage by Context

| Context | Order Status | Orderline Status | Notes |
|---------|-------------|------------------|-------|
| **PhonePe Initiate API - Prepaid** | `payment_completed` | `payment_completed` | Created in callback after PhonePe payment success, `mode="phonepe"`, `ispaymentsucceed: true` |
| **PhonePe Initiate API - COD** | `payment_completed` | `payment_completed` | Created immediately in initiate endpoint, `mode="cod"`, `ispaymentsucceed: true`<br>**Note**: Should ideally be `order_confirmed` with `ispaymentsucceed: false` |
| **PhonePe Payment Failed (Prepaid)** | `payment_failed` | `payment_failed` | Payment failed, stock released |
| **Order Confirmation (Prepaid)** | `order_confirmed` | `order_confirmed` | Auto after `payment_completed` (future enhancement) |
| **Packing** | `packed` | `packed` | All orderlines packed in one box |
| **Warehouse Ready** | `ready_for_dispatch` | `ready_for_dispatch` | After all orderlines packed and ready |
| **Ekart Shipment Created** | `shipped` | `shipped` | When Ekart forward shipment is created (AWB assigned) |
| **Ekart Tracking Updates** | `in_transit`, `out_for_delivery`, `delivered` | `in_transit`, `out_for_delivery`, `delivered` | From Ekart tracking API/webhook |
| **COD Payment Collection** | `cod_payment_received` | `cod_payment_received` | After COD payment collected on delivery |
| **Partial Cancellation** | `partially_cancelled` | `cancelled` (for cancelled items) | When one or more (but not all) orderlines are cancelled |
| **Full Cancellation** | `cancelled` | `cancelled` (all items) | When ALL orderlines in order are cancelled |
| **Packing** | `packed` | `packed` | All orderlines packed in one box |
| **Return Initiated** | `return_initiated` | `return_initiated` | Customer started return process |
| **Partial Return** | `partially_returned` | `returned` (for returned items) | When one or more (but not all) orderlines are returned |
| **Full Return** | `returned` | `returned` (all items) | When ALL orderlines in order are returned |
| **Ekart RTO** | `rto_initiated`, `rto_delivered` | `rto_initiated`, `rto_delivered` | From Ekart tracking (return to origin) |

## 4️⃣ Prepaid & COD Flows

### 4.1 PREPAID Flow (PhonePe)

```
order_placed
  ↓
payment_completed
  ↓
order_confirmed
  ↓
packed
  ↓
ready_for_dispatch
  ↓
shipped (Ekart AWB)
  ↓
in_transit
  ↓
out_for_delivery
  ↓
delivered
```

### 4.2 COD Flow

**Important:** COD does NOT start with `payment_completed`.

```
order_placed
  ↓
order_confirmed   (ispaymentsucceed = false)
  ↓
packed
  ↓
ready_for_dispatch
  ↓
shipped
  ↓
in_transit
  ↓
out_for_delivery
  ↓
delivered
  ↓
cod_payment_received   (ispaymentsucceed = true)
```

## 5️⃣ End-to-End Status Flow (Unified)

```
order_placed
  ├─ payment_failed  (prepaid only)
  ↓
payment_completed (prepaid)
order_confirmed (COD)
  ↓
packed
  ↓
ready_for_dispatch
  ↓
shipped (Ekart)
  ↓
in_transit
  ↓
out_for_delivery
  ↓
delivered
  └─ cod_payment_received (COD only)
```

**Alternative Flows:**
- `cancelled`
- `partially_cancelled`
- `return_initiated` → `returned`
- `rto_initiated` → `rto_delivered`

## 6️⃣ Cancellation, Return & RTO Logic

### 6.1 Cancellation Logic

❗ **Cancellation can happen ANY time before delivery.**

**Case A: One orderline cancelled**
```
OL1 = payment_completed
OL2 = cancelled  ✅ (Stock restored)
OL3 = payment_completed

Order = partially_cancelled
Stock restored for OL2 only
```

**Case B: All orderlines cancelled**
```
OL1 = cancelled  ✅ (Stock restored)
OL2 = cancelled  ✅ (Stock restored)
OL3 = cancelled  ✅ (Stock restored)

Order = cancelled
All stock restored
```

### 6.2 Return Flow

```
return_initiated
  ↓
returned
```

**Order Status:**

| Situation | Order Status |
|-----------|-------------|
| Some returned | `partially_returned` |
| All returned | `returned` |

### 6.3 RTO Flow

```
rto_initiated  (delivery failed)
  ↓
rto_delivered  (returned to warehouse)
```

**Stock rules:**
- Stock restored at `rto_initiated`

## 7️⃣ Ekart Status Mapping

| Ekart Status | Orderline Status |
|--------------|------------------|
| `CREATED` | `shipped` |
| `PICKED_UP` | `in_transit` |
| `IN_TRANSIT` | `in_transit` |
| `OFD` / `OUT_FOR_DELIVERY` | `out_for_delivery` |
| `DELIVERED` | `delivered` |
| `COD_COLLECTED` | `cod_payment_received` |
| `RTO_INITIATED` | `rto_initiated` |
| `RTO_DELIVERED` | `rto_delivered` |
| `CANCELLED` | `cancelled` |

## 8️⃣ Stock Management Rules

**At `order_placed`:**
- Reduce `availableqty`
- Increase `lockqty`

**At `payment_completed` (prepaid):**
- Move stock from `lockqty` → `orderedqty`

**At `order_confirmed` (COD):**
- Convert `lockqty` → `orderedqty`

**At `cancelled` / `returned` / `rto_initiated`:**
- Increase `availableqty`
- Decrease `orderedqty`

**Important:** Order-level cancellation does NOT restore stock. Only orderline cancellation restores stock.

## 9️⃣ Status History Storage

**Version Update: December 2025**

We have added a status history feature for both Orders and Orderlines. This allows us to keep a complete timeline of all status changes without needing a new table.

### 9.1 Why This Change

- ✅ To track the entire lifecycle of each order and orderline
- ✅ To show a timeline in the mobile/web UI (Placed → Packed → Shipped → Delivered)
- ✅ To preserve audit information (who changed, when changed, and from what → to what)
- ✅ To avoid extra tables and joins
- ✅ To keep implementation simple, fast, and scalable for our current needs

### 9.2 Status History Field (Order + Orderline)

A new column is added to both `orders` and `orderline` tables:

**`status_history`** (JSONB, default: `[]`)

This field stores an array of historical events, each representing a status change.

### 9.3 JSON Structure (One History Entry)

Each entry inside the `status_history` array has this structure:

```json
{
  "previous_status": "packed",
  "new_status": "shipped",
  "changed_date": 1712345678901,
  "source": "system"
}
```

#### Field Explanation

| Field | Meaning |
|-------|---------|
| `previous_status` | Old status before change (null for first status) |
| `new_status` | New status after change |
| `changed_date` | Timestamp (epoch milliseconds) when the change happened |
| `source` | Who triggered the change: `system`, `user`, `warehouse`, `ekart`, `phonepe`, `admin` |

### 9.4 Example: Full Status History Array

```json
[
  {
    "previous_status": null,
    "new_status": "order_placed",
    "changed_date": 1712345610000,
    "source": "system"
  },
  {
    "previous_status": "order_placed",
    "new_status": "payment_completed",
    "changed_date": 1712345635000,
    "source": "phonepe"
  },
  {
    "previous_status": "payment_completed",
    "new_status": "packed",
    "changed_date": 1712345900000,
    "source": "warehouse"
  },
  {
    "previous_status": "packed",
    "new_status": "shipped",
    "changed_date": 1712346200000,
    "source": "ekart"
  },
  {
    "previous_status": "shipped",
    "new_status": "in_transit",
    "changed_date": 1712346500000,
    "source": "ekart"
  },
  {
    "previous_status": "in_transit",
    "new_status": "out_for_delivery",
    "changed_date": 1712346800000,
    "source": "ekart"
  },
  {
    "previous_status": "out_for_delivery",
    "new_status": "delivered",
    "changed_date": 1712347100000,
    "source": "ekart"
  }
]
```

### 9.5 Behavior at Runtime

**✔ Whenever order or orderline status changes:**

1. Update the `orderstatus` (or orderline `orderstatus`)
2. Append an entry to `status_history` JSON array
3. `changed_date` uses current timestamp (`Date.now()`)
4. `source` is based on the actor:

| Source | When Used |
|--------|-----------|
| `system` | Internal automated updates (order creation, status aggregation) |
| `phonepe` | Prepaid payment updates (payment_completed, payment_failed) |
| `warehouse` | Packing & dispatch updates (packed, ready_for_dispatch) |
| `ekart` | Webhook updates (shipped, in_transit, out_for_delivery, delivered, rto_initiated, etc.) |
| `user` | Manual user actions (cancellation, return initiation) |
| `admin` | Admin panel actions (status overrides, manual updates) |

### 9.6 Implementation Example

```typescript
// When updating order status
async updateOrderStatus(id: string, newStatus: string, source: string = 'system') {
  // Get current order
  const order = await this.findById(id);
  const previousStatus = order.orderstatus;
  
  // Prepare status history entry
  const historyEntry = {
    previous_status: previousStatus,
    new_status: newStatus,
    changed_date: Date.now(),
    source: source
  };
  
  // Get existing history (or empty array)
  const existingHistory = order.status_history || [];
  
  // Append new entry
  const updatedHistory = [...existingHistory, historyEntry];
  
  // Update order
  await this.update(id, {
    orderstatus: newStatus,
    status_history: updatedHistory,
    modifieddate: Date.now()
  });
}
```

### 9.7 Status History for Orderline

Same structure applies to orderline:

```typescript
// When updating orderline status
async updateOrderlineStatus(id: string, newStatus: string, source: string = 'system') {
  const orderline = await this.findById(id);
  const previousStatus = orderline.orderstatus;
  
  const historyEntry = {
    previous_status: previousStatus,
    new_status: newStatus,
    changed_date: Date.now(),
    source: source
  };
  
  const existingHistory = orderline.status_history || [];
  const updatedHistory = [...existingHistory, historyEntry];
  
  await this.update(id, {
    orderstatus: newStatus,
    status_history: updatedHistory,
    modifieddate: Date.now()
  });
}
```

### 9.8 Querying Status History

**Get full timeline:**
```sql
SELECT status_history 
FROM orders 
WHERE id = 123;

-- Returns: JSON array of all status changes
```

**Get latest status change:**
```sql
SELECT status_history[array_length(status_history, 1)] 
FROM orders 
WHERE id = 123;

-- Returns: Last entry in the array
```

**Filter by source:**
```sql
SELECT status_history 
FROM orders 
WHERE id = 123 
  AND status_history @> '[{"source": "ekart"}]'::jsonb;

-- Returns: All entries where source is "ekart"
```

### 9.9 UI Timeline Display

The `status_history` array can be directly used to display a timeline in the mobile/web UI:

```typescript
// Example: Display timeline
const timeline = order.status_history.map(entry => ({
  from: entry.previous_status || 'Created',
  to: entry.new_status,
  date: new Date(entry.changed_date),
  source: entry.source
}));

// Render as:
// Created → order_placed (System, Dec 3, 10:00 AM)
// order_placed → payment_completed (PhonePe, Dec 3, 10:01 AM)
// payment_completed → packed (Warehouse, Dec 3, 2:00 PM)
// packed → shipped (Ekart, Dec 3, 3:00 PM)
// ...
```

### 9.10 Important Notes

1. **First Entry**: `previous_status` is `null` for the first status change
2. **Immutable History**: History entries are never modified or deleted (append-only)
3. **Performance**: JSONB is indexed and fast for querying
4. **No Separate Table**: All history stored in the same row as the order/orderline
5. **Automatic Updates**: History is automatically updated whenever status changes
6. **Source Tracking**: Always specify the correct `source` to track who/what triggered the change

---

### 8.1 Key Differences: Order vs Orderline Status

#### Stock Restoration

| Status | Order | Orderline |
|--------|-------|----------|
| `order_placed` | ✅ Reserves stock | ✅ Reserves stock |
| `payment_failed` | ✅ Releases reserved stock | ✅ Releases reserved stock |
| `partially_cancelled` | ❌ Does NOT restore stock | ✅ Cancelled orderlines: Restore stock |
| `cancelled` | ❌ Does NOT restore stock | ✅ **All orderlines: Restore stock** (Product + PlatformStock) |
| `partially_returned` | ❌ Does NOT restore stock | ✅ Returned orderlines: Restore stock |
| `returned` | ❌ Does NOT restore stock | ✅ **All orderlines: Restore stock** (Product + PlatformStock) |
| `rto_initiated` | ❌ Does NOT restore stock | ✅ **Restores stock** (Product + PlatformStock) |

#### Payment Flags & Mode Identification

| Status | Order | Orderline | Mode Field | Payment Flag |
|--------|-------|----------|------------|--------------|
| `payment_completed` | ✅ Sets `ispaymentsucceed: true`, `mode: "phonepe"` | ❌ No payment flag | `mode: "phonepe"` | `ispaymentsucceed: true` |
| `order_confirmed` | ✅ Prepaid: `ispaymentsucceed: true`, `mode: "phonepe"`<br>COD: `ispaymentsucceed: false`, `mode: "cod"` | ❌ No payment flag | `mode: "phonepe"` or `"cod"` | Prepaid: `true`<br>COD: `false` |
| `cod_payment_received` | ✅ Sets `ispaymentsucceed: true`, `mode: "cod"` | ❌ No payment flag | `mode: "cod"` | `ispaymentsucceed: true` |
| `payment_failed` | ✅ Sets `ispaymentsucceed: false`, `mode: "phonepe"` | ❌ No payment flag | `mode: "phonepe"` | `ispaymentsucceed: false` |

**🔑 Key Answer: How to Identify COD Orders**

**✅ CORRECT: Use `orders.mode` field**
```sql
-- Identify COD orders
SELECT * FROM orders WHERE mode = 'cod';

-- Identify Prepaid orders  
SELECT * FROM orders WHERE mode = 'phonepe';
```

**❌ INCORRECT: Don't use only `ispaymentsucceed` flag**
- COD orders have `ispaymentsucceed: false` initially (payment pending)
- COD orders have `ispaymentsucceed: true` after delivery (payment collected)
- Prepaid orders have `ispaymentsucceed: true` after payment
- **You cannot distinguish COD from Prepaid using only `ispaymentsucceed`**

**Implementation:**
- **PhonePe Initiate API** receives `mode` from customer/request: `"phonepe"` or `"cod"`
- **Mode is stored** in `orders.mode` field during order creation
- **Use `orders.mode`** to identify payment type throughout the system
- **`ispaymentsucceed`** indicates payment status, not payment type

### 2.5 Order Status Aggregation Logic

**Industry Best Practice:** Order status is derived from orderline statuses using aggregation rules.

#### Status Aggregation Rules

| Orderline Statuses | Order Status | Logic |
|-------------------|--------------|-------|
| **All orderlines: `payment_completed`** | `payment_completed` | All items paid/confirmed |
| **All orderlines: `packed`** | `packed` | All items packed in one box |
| **All orderlines: `ready_for_dispatch`** | `ready_for_dispatch` | All items ready |
| **All orderlines: `shipped`** | `shipped` | All items shipped |
| **All orderlines: `delivered`** | `delivered` | All items delivered |
| **All orderlines: `cancelled`** | `cancelled` | All items cancelled |
| **All orderlines: `returned`** | `returned` | All items returned |
| **Mixed: Some `cancelled`, others active** | `partially_cancelled` | Partial cancellation |
| **Mixed: Some `returned`, others active** | `partially_returned` | Partial return |
| **Mixed: Different active statuses** | **Lowest common status** | Use earliest stage status |

#### Cancellation Scenarios

**Scenario 1: Partial Cancellation (One Orderline Cancelled)**
```
Order: 3 orderlines
- Orderline 1: payment_completed
- Orderline 2: payment_completed → cancelled ✅ (Stock restored)
- Orderline 3: payment_completed

Result:
- Order status: partially_cancelled
- Orderline 2: cancelled (stock restored)
- Orderlines 1 & 3: payment_completed (unchanged)
```

**Scenario 2: Full Cancellation (All Orderlines Cancelled)**
```
Order: 3 orderlines
- Orderline 1: payment_completed → cancelled ✅ (Stock restored)
- Orderline 2: payment_completed → cancelled ✅ (Stock restored)
- Orderline 3: payment_completed → cancelled ✅ (Stock restored)

Result:
- Order status: cancelled
- All orderlines: cancelled (stock restored for all)
```

**Scenario 3: Cancellation After Packing**
```
Order: 3 orderlines
- Orderline 1: packed
- Orderline 2: packed → cancelled ✅ (Stock restored)
- Orderline 3: packed

Result:
- Order status: partially_cancelled
- Orderline 2: cancelled (stock restored)
- Orderlines 1 & 3: packed (unchanged)
- Note: Box may need repacking if cancelled item was already packed
```

**Scenario 4: Cancellation After Shipping**
```
Order: 3 orderlines (all in one box, already shipped)
- Orderline 1: shipped
- Orderline 2: shipped → cancelled ✅ (Stock restored, AWB may need cancellation)
- Orderline 3: shipped

Result:
- Order status: partially_cancelled
- Orderline 2: cancelled (stock restored)
- Orderlines 1 & 3: shipped (unchanged)
- Action: May need to cancel/update Ekart shipment
```

#### Return Scenarios

**Scenario 1: Partial Return**
```
Order: 3 orderlines (all delivered)
- Orderline 1: delivered
- Orderline 2: delivered → returned ✅ (Stock restored)
- Orderline 3: delivered

Result:
- Order status: partially_returned
- Orderline 2: returned (stock restored)
- Orderlines 1 & 3: delivered (unchanged)
```

**Scenario 2: Full Return**
```
Order: 3 orderlines (all delivered)
- Orderline 1: delivered → returned ✅ (Stock restored)
- Orderline 2: delivered → returned ✅ (Stock restored)
- Orderline 3: delivered → returned ✅ (Stock restored)

Result:
- Order status: returned
- All orderlines: returned (stock restored for all)
```

#### Packing & Dispatch Flow

**Single Box Packing (All Orderlines in One Box)**
```
Order: 3 orderlines
- All orderlines: payment_completed
  ↓
- All orderlines: packed (packed in one box)
  ↓
- Order status: packed
  ↓
- All orderlines: ready_for_dispatch
  ↓
- Order status: ready_for_dispatch
  ↓
- Ekart shipment created (one AWB for all items)
  ↓
- All orderlines: shipped
  ↓
- Order status: shipped
```

**Implementation Logic:**
```typescript
// When all orderlines are packed
if (allOrderlines.every(ol => ol.orderstatus === 'packed')) {
  order.orderstatus = 'packed';
}

// When all orderlines are ready for dispatch
if (allOrderlines.every(ol => ol.orderstatus === 'ready_for_dispatch')) {
  order.orderstatus = 'ready_for_dispatch';
}

// When checking for partial cancellation
const cancelledCount = orderlines.filter(ol => ol.orderstatus === 'cancelled').length;
const totalCount = orderlines.length;

if (cancelledCount > 0 && cancelledCount < totalCount) {
  order.orderstatus = 'partially_cancelled';
} else if (cancelledCount === totalCount) {
  order.orderstatus = 'cancelled';
}

// When checking for partial return
const returnedCount = orderlines.filter(ol => ol.orderstatus === 'returned').length;
if (returnedCount > 0 && returnedCount < totalCount) {
  order.orderstatus = 'partially_returned';
} else if (returnedCount === totalCount) {
  order.orderstatus = 'returned';
}
```

### 2.6 Complete Status Reference Table

| Scenario | Order Status | Orderline Statuses | Stock Action | Ekart Action |
|----------|-------------|-------------------|--------------|--------------|
| **Order Created (Prepaid)** | `payment_completed` | All: `payment_completed` | Stock converted (lock→order) | - |
| **Order Created (COD)** | `payment_completed` | All: `payment_completed` | Stock converted (lock→order) | - |
| **All Items Packed** | `packed` | All: `packed` | None | - |
| **All Items Ready** | `ready_for_dispatch` | All: `ready_for_dispatch` | None | - |
| **Ekart Shipment Created** | `shipped` | All: `shipped` | None | ✅ One AWB for all items |
| **One Item Cancelled** | `partially_cancelled` | 1: `cancelled`<br>Others: unchanged | ✅ Cancelled item: Stock restored | Optional: Cancel AWB if shipped |
| **All Items Cancelled** | `cancelled` | All: `cancelled` | ✅ All items: Stock restored | Optional: Cancel AWB |
| **One Item Returned** | `partially_returned` | 1: `returned`<br>Others: unchanged | ✅ Returned item: Stock restored | ✅ Reverse AWB for returned item |
| **All Items Returned** | `returned` | All: `returned` | ✅ All items: Stock restored | ✅ Reverse AWB for all items |
| **All Items Delivered** | `delivered` | All: `delivered` | None | ✅ Tracking complete |
| **COD Payment Collected** | `cod_payment_received` | All: `cod_payment_received` | None | ✅ COD_COLLECTED status |

#### Ekart Integration

| Status | Order | Orderline | Ekart Action |
|--------|-------|----------|-------------|
| `shipped` | ✅ Stores AWB/tracking_id | ✅ Stores AWB/tracking_id | Forward shipment created |
| `in_transit` | ✅ From Ekart tracking | ✅ From Ekart tracking | Status update from Ekart |
| `out_for_delivery` | ✅ From Ekart tracking | ✅ From Ekart tracking | Status update from Ekart |
| `delivered` | ✅ From Ekart tracking | ✅ From Ekart tracking | Status update from Ekart |
| `cod_payment_received` | ✅ From Ekart COD_COLLECTED | ✅ From Ekart COD_COLLECTED | Status update from Ekart |
| `return_initiated` | ✅ Manual/API trigger | ✅ Manual/API trigger | Optional: Create reverse shipment |
| `returned` | ✅ From Ekart return tracking | ✅ From Ekart return tracking | Reverse AWB delivered |
| `rto_initiated` | ✅ From Ekart tracking | ✅ From Ekart tracking + Restores stock | Status update from Ekart |
| `rto_delivered` | ✅ From Ekart tracking | ✅ From Ekart tracking | Status update from Ekart |

### 2.4 Complete Status Flow Diagrams

#### Order Status Flow (Prepaid/PhonePe)

```
[PhonePe Initiate API - mode="phonepe"]
  ↓
[Stock Locked]
  ↓
[Redirect to PhonePe Payment Page]
  ↓
[User Completes Payment]
  ↓
[PhonePe Callback Received]
  ↓
payment_completed ✅ (Order created in callback, mode="phonepe", ispaymentsucceed: true)
  ↓
packed ✅ (All orderlines packed in one box)
  ↓
ready_for_dispatch ✅ (Warehouse ready)
  ↓
[Ekart Shipment Created]
  ↓
shipped ✅ (AWB assigned)
  ↓
[Ekart Tracking Updates]
  ↓
in_transit ✅
  ↓
out_for_delivery ✅
  ↓
delivered ✅
  ↓
[Final State: Delivered]

[Alternative Paths:]
  ↓
payment_failed (during payment)
  ↓
[Stock Released] ✅
  ↓
[Final State: Failed]

  ↓
cancelled (can happen before shipping)
  ↓
[Final State: Cancelled]

  ↓
return_initiated (customer starts return)
  ↓
returned ✅ (Reverse AWB delivered)
  ↓
[Final State: Returned]

  ↓
rto_initiated (if delivery fails)
  ↓
rto_delivered ✅
  ↓
[Final State: RTO]
```

#### Order Status Flow (COD)

```
[PhonePe Initiate API - mode="cod"]
  ↓
[Stock Locked]
  ↓
[COD Order Created Immediately in Initiate Endpoint]
  ↓
payment_completed ✅ (Order created immediately, mode="cod", ispaymentsucceed: true)
  ↓
ready_for_dispatch ✅ (Warehouse packed)
  ↓
[Ekart Shipment Created]
  ↓
shipped ✅ (AWB assigned)
  ↓
[Ekart Tracking Updates]
  ↓
in_transit ✅
  ↓
out_for_delivery ✅
  ↓
delivered ✅
  ↓
cod_payment_received ✅ (Payment collected on delivery, ispaymentsucceed: true)
  ↓
[Final State: Delivered + Payment Received]

**Note**: Currently COD orders are created with `payment_completed` status. 
Ideally should be `order_confirmed` with `ispaymentsucceed: false` (payment pending).

[Alternative Paths:]
  ↓
cancelled (can happen before shipping)
  ↓
[Final State: Cancelled]

  ↓
return_initiated (customer starts return)
  ↓
returned ✅ (Reverse AWB delivered)
  ↓
[Final State: Returned]

  ↓
rto_initiated (if delivery fails)
  ↓
rto_delivered ✅
  ↓
[Final State: RTO]
```

#### Orderline Status Flow

```
[POST /v1/phonepe/initiate - Prepaid]
  ↓
[Stock Locked]
  ↓
[Redirect to PhonePe Payment Page]
  ↓
[User Pays on PhonePe]
  ↓
[GET /v1/phonepe/callback/:transactionId]
  ↓
payment_completed ✅ (Orderline created, mode="phonepe")
  ↓
order_confirmed ✅
  ↓
packed ✅ (Packed in box)
  ↓
ready_for_dispatch ✅
  ↓
[Ekart Shipment Created]
  ↓
shipped ✅ (AWB assigned)
  ↓
[Ekart Tracking Updates]
  ↓
in_transit ✅
  ↓
out_for_delivery ✅
  ↓
delivered ✅
  ↓
[Final State: Delivered]

[POST /v1/phonepe/initiate - COD]
  ↓
[Stock Locked]
  ↓
[Order Created Immediately in Initiate Endpoint]
  ↓
payment_completed ✅ (Orderline created, mode="cod")
  ↓
packed ✅ (Packed in box)
  ↓
ready_for_dispatch ✅
  ↓
[Ekart Shipment Created]
  ↓
shipped ✅ (AWB assigned)
  ↓
[Ekart Tracking Updates]
  ↓
in_transit ✅
  ↓
out_for_delivery ✅
  ↓
delivered ✅
  ↓
cod_payment_received ✅ (Payment collected)
  ↓
[Final State: Delivered + Payment Received]

[Alternative Paths:]
  ↓
payment_failed (Prepaid only)
  ↓
[Stock Released] ✅
  ↓
[Final State: Failed]

  ↓
cancelled (can happen at any stage)
  ↓
[Stock Restored] ✅
  ↓
[Final State: Cancelled]

  ↓
return_initiated (customer starts return)
  ↓
returned ✅ (Reverse AWB delivered)
  ↓
[Stock Restored] ✅
  ↓
[Final State: Returned]

  ↓
rto_initiated (if delivery fails)
  ↓
[Stock Restored] ✅
  ↓
rto_delivered ✅
  ↓
[Final State: RTO]
```

### 2.6 Ekart Status Mapping

| Ekart Status | Order/Orderline Status | Description | Action Required |
|--------------|----------------------|-------------|-----------------|
| `Order Placed` / `CREATED` | `shipped` | Shipment created in Ekart | Store AWB/tracking_id, set shipdate |
| `PICKUP_SCHEDULED` | `shipped` | Pickup scheduled | None |
| `PICKED_UP` | `in_transit` | Shipment picked up | Update status |
| `IN_TRANSIT` | `in_transit` | In transit to destination | Update status |
| `OUT_FOR_DELIVERY` | `out_for_delivery` | Out for delivery | Update status |
| `DELIVERED` | `delivered` | Delivered to customer | Update status, set delivereddate |
| `COD_COLLECTED` | `cod_payment_received` | COD payment collected | Update status, set paymentreceiveddate, set ispaymentsucceed: true |
| `RTO_INITIATED` | `rto_initiated` | Return to origin initiated | Update status, restore stock (orderline) |
| `RTO_DELIVERED` | `rto_delivered` | RTO delivered to warehouse | Update status |
| `CANCELLED` | `cancelled` | Shipment cancelled | Update status, restore stock (orderline) |

---

## 🔟 Order & Orderline Creation (PhonePe Payment Flow)

### 2.1 Creation Flow Overview

**Trigger:** Successful PhonePe payment callback or COD order creation

**Location:** `src/controllers/phonepe.controller.ts:1982-3142` (`createOrderAfterPayment`)

**Architecture:** Direct service calls (no HTTP routes)

```
Payment Success
  ↓
createOrderAfterPayment()
  ↓
ordersService.create(orderData)  ← DIRECT SERVICE CALL
  ↓
OrdersService.create()
  ↓
createOrderlinesFromOrderItems()  ← AUTOMATIC ORDERLINE CREATION
  ↓
dynamicCreate('orderline', ...)  ← DIRECT DATABASE CALL
  ↓
prisma.orderline.update()  ← PROMOTION DATA UPDATE
```

---

### 2.2 Step-by-Step Creation Process

#### **Step 1: Transaction Retrieval** (Lines 1994-2019)

**Purpose:** Get transaction data stored during payment initiation.

**Process:**
1. Query `transaction` table by `merchanttransactionid`
2. Extract data:
   - `userid`: User ID
   - `amount`: Transaction amount
   - `productid[]`: Array of product IDs
   - `transactiondata.originalPayload.order[]`: Original order items
   - `transactiondata.evaluation_ids[]`: Valid promotion evaluation IDs

**Database Operations:**
- **Read:** `transaction` table

**Code Location:** `src/controllers/phonepe.controller.ts:1994-2019`

---

#### **Step 2: Product Validation** (Lines 2021-2074)

**Purpose:** Validate all products exist before creating order.

**Process:**
1. Batch query `product` table for all product IDs
2. Filter valid vs invalid products
3. Block order creation if no valid products

**Database Operations:**
- **Read:** `product` table (batch query: `WHERE id IN (...)`)

**Code Location:** `src/controllers/phonepe.controller.ts:2021-2074`

---

#### **Step 3: Order Data Preparation** (Lines 2090-2556)

**Purpose:** Calculate all financial totals and enrich order items with discount data.

##### **3A. Calculate Order-Level Totals**

**From Transaction Data:**
- **Original Total**: Sum of `base_price * quantity` from cart items
- **Product Discount Total**: Sum of `product_discount * quantity`
- **Shipping Cost**: From `originalPayload.shippingCost`
- **Tax Amount**: From `originalPayload.taxAmount`

**From Promotion Evaluation Data:**
- **Promotion Discount Total**: Sum from `evaluationData.applied_promotions`
- **Primary Evaluation ID**: First valid evaluation ID

**Calculated Values:**
- **Product Amount**: `originalTotal - productDiscountTotal`
- **Order Amount**: `productAmount - promotionDiscountTotal`
- **Total Discount**: `productDiscountTotal + promotionDiscountTotal`

##### **3B. Enrich Order Items with Per-Line Discounts**

For each order item, calculate:

```typescript
{
  productid: 123,
  quantity: 1,
  
  // Original pricing
  original_price: 500,  // Base price per item * quantity
  
  // Discounts
  product_discount_amount: 30,  // Product-level discount * quantity
  promotion_discount_amount: 20,  // Promotion discount for this line
  
  // Calculated amounts
  discountamount: 50,  // productDiscount + promotionDiscount
  productamount: 470,  // originalPrice - productDiscount
  orderamount: 450,    // productAmount - promotionDiscount
  
  // Additional
  shipping_cost: 50,  // Pro-rata shipping for this line
  evaluation_id: "eval_123"
}
```

**Data Sources:**
1. **From Evaluation Cart Data** (most accurate):
   - `base_price` → `original_price`
   - `product_discount` → `product_discount_amount`
   - `applied_promotions.breakdown[]` → `promotion_discount_amount`

2. **Fallback (if no evaluation data)**:
   - Pro-rata distribution based on product amounts

**Code Location:** `src/controllers/phonepe.controller.ts:2285-2449`

---

#### **Step 4: Order Creation** (Lines 2584-2600)

**Purpose:** Create order record in database.

**Method:** Direct service call (NOT HTTP)

```typescript
// Direct service call - NO HTTP
const order = await this.ordersService.create(orderData);
```

**Order Data Structure:**
```typescript
{
  userid: 1,
  orderamount: 450,  // Final amount after all discounts
  orderid: "ORDER_TXN_123_1701234567890",  // Display order ID
  orderstatus: "payment_completed",
  quantity: 3,  // Sum of all line item quantities
  transactionid: "transaction_db_id",  // Reference to transaction.id
  productamount: 500,  // Amount after product discounts (before promotion)
  discountamount: 50,  // Total discount (product + promotion)
  ispaymentsucceed: true,
  merchanttransactionid: "TXN_...",
  productid: [123, 456],  // Valid product IDs
  mode: "phonepe" | "cod",
  createddate: 1701234567890,
  modifieddate: 1701234567890,
  
  // Promotion fields
  evaluation_id: "eval_123",  // Primary evaluation ID
  promotion_discount_total: 20,
  original_total: 550,
  shipping_cost: 50,
  tax_amount: 10,
  
  // Orderline creation data
  orderItems: [  // Enriched order items
    {
      productid: 123,
      quantity: 1,
      productamount: 470,
      discountamount: 50,
      orderamount: 450,
      original_price: 500,
      product_discount_amount: 30,
      promotion_discount_amount: 20,
      shipping_cost: 50,
      evaluation_id: "eval_123"
    }
  ]
}
```

**Database Operations:**
- **Write:** Insert into `orders` table

**Code Location:** 
- Controller: `src/controllers/phonepe.controller.ts:2584-2600`
- Service: `src/services/orders.service.ts:98-185`

---

#### **Step 5: Automatic Orderline Creation** (Inside OrdersService.create)

**Purpose:** Automatically create orderlines from `orderItems` array.

**Location:** `src/services/orders.service.ts:374-502` (`createOrderlinesFromOrderItems`)

**Process:**
1. Loop through `orderItems` array
2. For each item, create orderline record:

```typescript
const orderlineData = {
  orderid: order.id,  // References orders.id (database ID)
  productid: 123,
  quantity: 1,
  productname: "Mens Shirt",
  productamount: 470,  // After product discounts
  discountamount: 50,  // Total discount
  orderamount: 450,  // Final amount
  orderstatus: "payment_completed",
  orderlinenumber: "ORDER_TXN_123_1701234567890_LINE_1",  // Auto-generated
  merchanttransactionid: "TXN_...",
  userid: 1,
  addressid: 1,
  
  // Promotion fields (from enriched orderItems)
  original_price: 500,
  product_discount_amount: 30,
  promotion_discount_amount: 20,
  shipping_cost: 50,
  evaluation_id: "eval_123",
  
  ordereddate: BigInt(currentTime),
  createddate: BigInt(currentTime),
  modifieddate: BigInt(currentTime)
};

// Direct database call
const orderline = await dynamicCreate('orderline', orderlineData);
```

**Database Operations:**
- **Write:** Insert into `orderline` table (one per product in order)

**Code Location:** `src/services/orders.service.ts:374-502`

---

#### **Step 6: Promotion Redemption** (Lines 2603-2697)

**Purpose:** Mark promotions as redeemed after successful order.

**Process:**
1. Loop through `evaluationIds` array
2. For each evaluation:
   ```typescript
   await redemptionService.redeemPromotion({
     evaluation_id: evaluationId,
     order_id: order.id.toString(),
     user_id: transaction.userid.toString()
   });
   ```

**Database Operations:**
- **Write:** Insert into `promotionredemption` table
- **Write:** Update promotion usage counts

**Error Handling:**
- If redemption fails → Log error but don't fail order
- Order is already created, redemption is secondary

**Code Location:** `src/controllers/phonepe.controller.ts:2603-2697`

---

#### **Step 7: Orderline Promotion Data Update** (Lines 2726-3036)

**Purpose:** Update orderlines with detailed promotion discount breakdown.

**Process:**
1. Retrieve created orderlines from database
2. For each orderline:
   - Calculate `product_discount_amount` from evaluation cart_data
   - Calculate `promotion_discount_amount` from applied_promotions breakdown
   - Distribute promotion discount proportionally if no breakdown
   - Update orderline with all promotion fields

**Update Logic:**
```typescript
// Get orderline
const orderline = await prisma.orderline.findUnique({
  where: { id: orderlineId }
});

// Calculate per-line values
const originalPricePerItem = basePrice;  // From evaluation cart_data
const productDiscountPerItem = productDiscount;  // From evaluation cart_data
const productDiscountAmount = productDiscountPerItem * quantity;
const promotionDiscountAmount = /* from breakdown or pro-rata */;
const totalDiscount = productDiscountAmount + promotionDiscountAmount;
const finalOrderAmount = (originalPricePerItem * quantity) - totalDiscount;

// Update orderline
await prisma.orderline.update({
  where: { id: orderlineId },
  data: {
    original_price: originalPricePerItem,
    product_discount_amount: productDiscountAmount,
    promotion_discount_amount: promotionDiscountAmount,
    discountamount: totalDiscount,
    orderamount: finalOrderAmount,
    shipping_cost: lineShippingCost,
    evaluation_id: primaryEvaluationId,
    modifieddate: BigInt(currentTime)
  }
});
```

**Database Operations:**
- **Read:** `orderline` table (get created orderlines)
- **Write:** Update `orderline` table with promotion data

**Code Location:** `src/controllers/phonepe.controller.ts:2726-3036`

---

#### **Step 8: Stock Conversion (Lock → Order)** (Lines 687-754 in phonepe.route.ts)

**Purpose:** Convert locked stock to ordered stock after successful payment.

**Process:**
1. Get orderlines for the created order
2. Convert to orderItems format
3. Call `updateProductQuantitiesAfterOrder()`

**Stock Conversion Details:**
- See [Section 2.3: Stock Conversion](#23-stock-conversion-lock--order) below

**Code Location:** `src/routes/phonepe.route.ts:687-754`

---

### 2.3 Stock Conversion (Lock → Order)

**Purpose:** Convert locked stock to ordered stock after payment success.

**Location:** `src/controllers/phonepe.controller.ts:3709-4220` (`updateProductQuantitiesAfterOrder`)

#### **Step 1: PlatformStock Update**

**Current State (After Locking):**
- `availableqty`: Already reduced (e.g., 9)
- `lockqty`: Contains locked quantity (e.g., 1)
- `orderedqty`: 0

**Conversion Process:**
```typescript
// Get current values
currentAvailableQty = platformStock.availableqty  // 9 (already reduced)
currentLockQty = platformStock.lockqty  // 1 (locked)
currentOrderedQty = platformStock.orderedqty  // 0

// Convert lock to order
quantityToConvert = Math.min(requestedQuantity, currentLockQty)  // 1

// Calculate new values
newAvailableQty = currentAvailableQty  // 9 (NO CHANGE)
newLockQty = currentLockQty - quantityToConvert  // 0 (UNLOCK)
newOrderedQty = currentOrderedQty + quantityToConvert  // 1 (CONFIRM ORDER)
```

**Database Update:**
```sql
UPDATE platformstock
SET availableqty = 9,  -- No change (already reduced during locking)
    lockqty = 0,  -- Decrease (unlock)
    orderedqty = 1,  -- Increase (confirm order)
    platformstatus = CASE
      WHEN availableqty <= 0 THEN 'out_of_stock'
      WHEN availableqty <= 5 THEN 'low_stock'
      ELSE 'in_stock'
    END,
    modifieddate = NOW()
WHERE productid = ? AND platform = 'nivapp';
```

#### **Step 2: Product Table Update**

**Current State:**
- `orderedquantity`: 0
- `availablequantity`: 10

**Update Process:**
```typescript
// Get current values
currentProductOrderedQuantity = product.orderedquantity  // 0
currentProductAvailableQuantity = product.availablequantity  // 10

// Update overall product quantities
newProductOrderedQuantity = currentProductOrderedQuantity + requestedQuantity  // 1
newProductAvailableQuantity = Math.max(0, currentProductAvailableQuantity - requestedQuantity)  // 9
```

**Database Update:**
```sql
UPDATE product
SET orderedquantity = 1,  -- Increase
    availablequantity = 9,  -- Decrease
    productstatus = CASE
      WHEN availablequantity <= 0 THEN 'out_of_stock'
      WHEN availablequantity <= 5 THEN 'low_stock'
      ELSE 'in_stock'
    END,
    modifieddate = NOW()
WHERE id = ?;
```

**Stock Flow Summary:**

| Stage | PlatformStock.availableqty | PlatformStock.lockqty | PlatformStock.orderedqty | Product.availablequantity | Product.orderedquantity |
|-------|---------------------------|----------------------|-------------------------|---------------------------|------------------------|
| **Initial** | 10 | 0 | 0 | 10 | 0 |
| **After Locking** | 9 | 1 | 0 | 10 | 0 |
| **After Payment** | 9 | 0 | 1 | 9 | 1 |

**Code Location:** `src/controllers/phonepe.controller.ts:3709-4220`

---

## 1️⃣1️⃣ Order & Orderline Updates

### 3.1 Order Updates

**Note:** Order updates are **NOT used** in PhonePe payment flow. Orders are created once and not updated via HTTP routes.

**Available Update Operations (External Clients Only):**
- `PUT /v1/orders/:id` - Update order fields
- `PATCH /v1/orders/:id/status` - Update order status

**PhonePe Flow:** Uses direct service calls for internal operations only.

---

### 3.2 Orderline Updates

#### **3.2.1 Promotion Data Update (During Creation)**

**Location:** `src/controllers/phonepe.controller.ts:2726-3036`

**Purpose:** Update orderlines with detailed promotion discount breakdown after initial creation.

**Process:**
1. Retrieve created orderlines
2. Calculate per-line promotion discounts
3. Update each orderline with promotion data

**Update Fields:**
- `original_price`
- `product_discount_amount`
- `promotion_discount_amount`
- `discountamount` (recalculated)
- `orderamount` (recalculated)
- `shipping_cost`
- `evaluation_id`

**Database Operations:**
- **Read:** `orderline` table
- **Write:** Update `orderline` table

**Code Location:** `src/controllers/phonepe.controller.ts:2726-3036`

#### **3.2.2 Status Updates (External Clients)**

**Available Operations:**
- `PATCH /v1/orderlines/:id/status` - Update orderline status
- `PATCH /v1/orderlines/bulk-status` - Bulk update status

**Status Values:**
- `delivered` → Sets `delivereddate`
- `cancelled` → Sets `cancelleddate` + Restores stock
- `returned` → Sets `returneddate` + Restores stock
- `dispatched` → Sets `dispatcheddate`
- `ready_to_dispatch` → Sets `readytodispatchdate`
- `payment_failed` → Sets `paymentfaileddate`

**Note:** PhonePe flow does NOT use these HTTP routes. Updates happen via direct Prisma calls.

---

## 1️⃣2️⃣ Orderline Cancellation

### 4.1 Cancellation Flow Overview

**Endpoint:** `PATCH /v1/orderlines/:id/cancel`

**Location:** `src/routes/orderline.route.ts:668-729`

**Controller:** `src/controllers/orderline.controller.ts:156-170`

**Service:** `src/services/orderline.service.ts:231-287` (`updateOrderlineStatus`)

**Architecture:** HTTP endpoint (for external clients like mobile app)

```
Mobile App Request
  ↓
PATCH /v1/orderlines/:id/cancel
  ↓
OrderlineController.cancelOrderline()
  ↓
OrderlineService.updateOrderlineStatus('cancelled')
  ↓
adjustProductQuantitiesOnCancellation()
  ↓
Update Product + PlatformStock
```

---

### 4.2 Step-by-Step Cancellation Process

#### **Step 1: Request Handling** (Lines 156-170 in controller)

**Request Payload:**
```json
{
  "reason": "Product unavailable",
  "additionalData": {
    "cancelled_by": "user_123",
    "notes": "Customer requested cancellation"
  }
}
```

**Process:**
1. Parse orderline ID from URL params
2. Extract `reason` and `additionalData` from body
3. Prepare cancellation data:
   ```typescript
   const cancelData = {
     ...additionalData,
     cancellation_reason: reason
   };
   ```
4. Call `orderlineService.updateOrderlineStatus(id, 'cancelled', cancelData)`

**Code Location:** `src/controllers/orderline.controller.ts:156-170`

---

#### **Step 2: Orderline Status Update** (Lines 231-287 in service)

**Purpose:** Update orderline status and trigger stock restoration.

**Process:**
1. Get current orderline from database
2. Prepare update data:
   ```typescript
   const updateData = {
     orderstatus: 'cancelled',
     cancelleddate: Date.now(),
     modifieddate: Date.now(),
     cancellation_reason: reason,
     ...additionalData
   };
   ```
3. **CRITICAL:** Call `adjustProductQuantitiesOnCancellation()` to restore stock
4. Update orderline record

**Database Operations:**
- **Read:** `orderline` table (get current orderline)
- **Write:** Update `orderline` table

**Code Location:** `src/services/orderline.service.ts:231-287`

---

#### **Step 3: Product Inventory Restoration** (Lines 294-436 in service)

**Purpose:** Restore product quantities when orderline is cancelled.

**Location:** `src/services/orderline.service.ts:294-436` (`adjustProductQuantitiesOnCancellation`)

##### **3A. Product Table Update**

**Current State (After Order):**
- `orderedquantity`: 1
- `availablequantity`: 9

**Restoration Process:**
```typescript
const cancelledQuantity = orderline.quantity || 1;  // 1

// Get current product
const product = await dynamicFindUnique('product', { id: productId });

// Calculate new quantities
const newOrderedQuantity = Math.max(0, 
  (product.orderedquantity || 0) - cancelledQuantity  // 1 - 1 = 0
);
const newAvailableQuantity = 
  (product.availablequantity || 0) + cancelledQuantity  // 9 + 1 = 10
```

**Database Update:**
```sql
UPDATE product
SET orderedquantity = 0,  -- Decrease (restore)
    availablequantity = 10,  -- Increase (restore)
    productstatus = CASE
      WHEN availablequantity <= 0 THEN 'out_of_stock'
      WHEN availablequantity <= 5 THEN 'low_stock'
      ELSE 'in_stock'
    END,
    modifieddate = NOW()
WHERE id = ?;
```

##### **3B. PlatformStock Table Update (NIVAPP)**

**Current State (After Order):**
- `orderedqty`: 1
- `availableqty`: 9

**Restoration Process:**
```typescript
// Get platformstock for NIVAPP
const platformStock = await dynamicFindManyWithFilters('platformstock', {
  productid: productId.toString(),
  platform: 'nivapp'
});

const cancelledQuantity = orderline.quantity || 1;  // 1

// Calculate new platformstock quantities
const newPlatformOrderedQty = Math.max(0, 
  currentPlatformOrderedQty - cancelledQuantity  // 1 - 1 = 0
);
const newPlatformAvailableQty = 
  currentPlatformAvailableQty + cancelledQuantity  // 9 + 1 = 10
```

**Database Update:**
```sql
UPDATE platformstock
SET orderedqty = 0,  -- Decrease (restore)
    availableqty = 10,  -- Increase (restore)
    platformstatus = CASE
      WHEN availableqty <= 0 THEN 'out_of_stock'
      WHEN availableqty <= 5 THEN 'low_stock'
      ELSE 'in_stock'
    END,
    modifieddate = NOW()
WHERE productid = ? AND platform = 'nivapp';
```

**Important Notes:**
- ✅ **Both Product and PlatformStock are updated**
- ✅ **Stock is restored** (availablequantity/availableqty increased)
- ✅ **Ordered quantities are decreased** (orderedquantity/orderedqty decreased)
- ⚠️ **lockqty is NOT updated** (only orderedqty is restored)

**Stock Restoration Flow:**

| Stage | PlatformStock.availableqty | PlatformStock.orderedqty | Product.availablequantity | Product.orderedquantity |
|-------|---------------------------|-------------------------|---------------------------|------------------------|
| **After Order** | 9 | 1 | 9 | 1 |
| **After Cancellation** | 10 | 0 | 10 | 0 |

**Code Location:** `src/services/orderline.service.ts:294-436`

---

### 4.3 Cancellation Response

**Response Structure:**
```json
{
  "success": true,
  "message": "Orderline cancelled successfully",
  "data": {
    "id": 789,
    "orderid": 456,
    "productid": 123,
    "quantity": 1,
    "orderstatus": "cancelled",
    "cancelleddate": 1701234567890,
    "cancellation_reason": "Product unavailable",
    "modifieddate": 1701234567890,
    // ... other orderline fields
  }
}
```

---

## 1️⃣3️⃣ Database Operations Summary

### 5.1 Order Creation Operations

| Operation | Table | Fields Updated | When |
|-----------|-------|----------------|------|
| **Insert Order** | `orders` | All order fields | During `ordersService.create()` |
| **Insert Orderline** | `orderline` | All orderline fields | Automatic during order creation |
| **Update Orderline** | `orderline` | Promotion fields | After order creation (promotion data) |
| **Insert Redemption** | `promotionredemption` | Redemption record | After order creation |
| **Update PlatformStock** | `platformstock` | `lockqty↓`, `orderedqty↑` | After payment success |
| **Update Product** | `product` | `availablequantity↓`, `orderedquantity↑` | After payment success |

---

### 5.2 Orderline Cancellation Operations

| Operation | Table | Fields Updated | When |
|-----------|-------|----------------|------|
| **Update Orderline** | `orderline` | `orderstatus`, `cancelleddate`, `cancellation_reason` | During cancellation |
| **Update Product** | `product` | `availablequantity↑`, `orderedquantity↓`, `productstatus` | During cancellation |
| **Update PlatformStock** | `platformstock` | `availableqty↑`, `orderedqty↓`, `platformstatus` | During cancellation |

**Note:** `lockqty` is NOT updated during cancellation (only `orderedqty` is restored).

---

## 1️⃣4️⃣ Complete Flow Diagrams

### 6.1 Order Creation Flow (PhonePe Mode)

```
Payment Callback
  ↓
[1] Get Transaction Data
  ↓
[2] Validate Products
  ↓
[3] Prepare Order Data
  ├─ Calculate totals
  ├─ Enrich order items
  └─ Add promotion data
  ↓
[4] Create Order
  ├─ INSERT INTO orders
  └─ Auto-create orderlines
      └─ INSERT INTO orderline (for each product)
  ↓
[5] Redeem Promotions
  └─ INSERT INTO promotionredemption
  ↓
[6] Update Orderlines with Promotion Data
  └─ UPDATE orderline (promotion fields)
  ↓
[7] Convert Stock (Lock → Order)
  ├─ UPDATE platformstock (lockqty↓, orderedqty↑)
  └─ UPDATE product (availablequantity↓, orderedquantity↑)
```

### 6.2 Orderline Cancellation Flow

```
Mobile App Request
  ↓
PATCH /v1/orderlines/:id/cancel
  ↓
[1] Get Orderline
  └─ SELECT FROM orderline
  ↓
[2] Update Orderline Status
  └─ UPDATE orderline (status='cancelled', cancelleddate)
  ↓
[3] Restore Product Quantities
  ├─ UPDATE product
  │   ├─ availablequantity↑
  │   ├─ orderedquantity↓
  │   └─ productstatus
  └─ UPDATE platformstock
      ├─ availableqty↑
      ├─ orderedqty↓
      └─ platformstatus
  ↓
[4] Check All Orderlines for Order Status
  └─ SELECT FROM orderline WHERE orderid = ?
  ↓
[5] Calculate Order Status
  ├─ If all orderlines cancelled → Order status: 'cancelled'
  ├─ If some orderlines cancelled → Order status: 'partially_cancelled'
  └─ If no orderlines cancelled → Order status unchanged
  ↓
[6] Update Order Status (if needed)
  └─ UPDATE orders (orderstatus, cancelleddate)
  ↓
[7] Return Response
```

### 6.3 Packing & Dispatch Flow

```
Order with 3 Orderlines
  ↓
[1] All Orderlines: payment_completed
  ↓
[2] Warehouse Packs All Items in One Box
  ├─ Orderline 1: packed
  ├─ Orderline 2: packed
  └─ Orderline 3: packed
  ↓
[3] Check All Orderlines Status
  └─ All orderlines = 'packed'
  ↓
[4] Update Order Status
  └─ Order status: 'packed'
  ↓
[5] All Orderlines: ready_for_dispatch
  ├─ Orderline 1: ready_for_dispatch
  ├─ Orderline 2: ready_for_dispatch
  └─ Orderline 3: ready_for_dispatch
  ↓
[6] Update Order Status
  └─ Order status: 'ready_for_dispatch'
  ↓
[7] Create Ekart Shipment (One Box = One AWB)
  └─ POST /v1/ekart/shipments/forward
  ↓
[8] All Orderlines: shipped
  ├─ Orderline 1: shipped (AWB assigned)
  ├─ Orderline 2: shipped (same AWB)
  └─ Orderline 3: shipped (same AWB)
  ↓
[9] Update Order Status
  └─ Order status: 'shipped'
```

---

## 📊 Complete Data Flow Summary

### Order Creation Timeline

| Time | Action | Database Changes | Tables Affected |
|------|--------|------------------|-----------------|
| T0 | Payment Success | - | - |
| T1 | Get Transaction | Read `transaction` | `transaction` |
| T2 | Validate Products | Read `product` | `product` |
| T3 | Prepare Order Data | - | - |
| T4 | Create Order | Insert `orders` | `orders` |
| T5 | Auto-Create Orderlines | Insert `orderline` (multiple) | `orderline` |
| T6 | Redeem Promotions | Insert `promotionredemption` | `promotionredemption` |
| T7 | Update Orderlines | Update `orderline` (promotion data) | `orderline` |
| T8 | Convert Stock | Update `platformstock`, `product` | `platformstock`, `product` |

### Orderline Cancellation Timeline

| Time | Action | Database Changes | Tables Affected |
|------|--------|------------------|-----------------|
| T0 | Cancel Request | - | - |
| T1 | Get Orderline | Read `orderline` | `orderline` |
| T2 | Update Orderline | Update `orderline` (status, cancelleddate) | `orderline` |
| T3 | Restore Product | Update `product` (availablequantity↑, orderedquantity↓) | `product` |
| T4 | Restore PlatformStock | Update `platformstock` (availableqty↑, orderedqty↓) | `platformstock` |

---

## 🔍 Key Implementation Details

### Order Creation - Direct Service Calls

**PhonePe Flow:**
```typescript
// PhonePeController
public ordersService = new OrdersService();
public orderlineService = new OrderlineService();

// Direct service call (NO HTTP)
const order = await this.ordersService.create(orderData);

// Direct Prisma call (NO HTTP)
await prisma.orderline.update({
  where: { id: orderlineId },
  data: { promotion_discount_amount: ... }
});
```

**NOT Used:**
- ❌ `POST /v1/orders` HTTP endpoint
- ❌ `POST /v1/orderlines` HTTP endpoint
- ❌ `PUT /v1/orderlines/:id` HTTP endpoint

---

### Orderline Cancellation - HTTP Endpoint

**Mobile App Flow:**
```typescript
// HTTP Request
PATCH /v1/orderlines/:id/cancel
Body: { reason: "...", additionalData: {...} }

// Controller
cancelOrderline() {
  await orderlineService.updateOrderlineStatus(id, 'cancelled', cancelData);
}

// Service
updateOrderlineStatus() {
  await adjustProductQuantitiesOnCancellation(orderline);
  await update(id, updateData);
}
```

**Used By:**
- ✅ Mobile app (external client)
- ✅ Frontend (external client)
- ❌ NOT used by PhonePe flow (internal operations)

---

## 📝 Important Notes

### Order Creation

1. **Automatic Orderline Creation**: Orderlines are automatically created when order is created (via `orderItems` array)
2. **Promotion Data Update**: Orderlines are updated with promotion discount breakdown after creation
3. **Stock Conversion**: Converts `lockqty` → `orderedqty` (doesn't change `availableqty` again)
4. **Direct Service Calls**: PhonePe flow uses direct service calls, not HTTP routes
5. **Error Handling**: Order creation errors don't fail payment callback (payment was successful)

### Orderline Cancellation

1. **Stock Restoration**: Both Product and PlatformStock quantities are restored
2. **Ordered Quantity Decrease**: `orderedquantity` and `orderedqty` are decreased
3. **Available Quantity Increase**: `availablequantity` and `availableqty` are increased
4. **Status Updates**: Product and PlatformStock status are recalculated
5. **lockqty NOT Updated**: Only `orderedqty` is restored, `lockqty` remains unchanged
6. **HTTP Endpoint**: Used by external clients (mobile app), not by PhonePe flow
7. **Order Status Aggregation**: After orderline cancellation, check all orderlines:
   - If all cancelled → Order status: `cancelled`
   - If some cancelled → Order status: `partially_cancelled`
   - If none cancelled → Order status unchanged

### Order Status Aggregation

1. **Automatic Status Calculation**: Order status is automatically calculated based on orderline statuses
2. **Partial States**: `partially_cancelled` and `partially_returned` indicate mixed states
3. **Full States**: `cancelled` and `returned` indicate all orderlines have same status
4. **Packing**: All orderlines must be `packed` before order becomes `packed`
5. **Single Box**: All orderlines packed in one box → One Ekart shipment (one AWB)
6. **Status Priority**: When orderlines have different statuses, use lowest common status (earliest stage)

---

## 🔗 Related Files

### Order Creation
- **Controller:** `src/controllers/phonepe.controller.ts:1982-3142`
- **Service:** `src/services/orders.service.ts:98-185, 374-502`
- **Stock Update:** `src/controllers/phonepe.controller.ts:3709-4220`

### Orderline Cancellation
- **Route:** `src/routes/orderline.route.ts:668-729`
- **Controller:** `src/controllers/orderline.controller.ts:156-170`
- **Service:** `src/services/orderline.service.ts:231-287, 294-436`

---

## 1️⃣5️⃣ FAQ

**Q1: Why separate orderline and order statuses?**  
A: Because orderlines track real physical flow. Order status is only a computed summary.

**Q2: Why COD cannot start with `payment_completed`?**  
A: Because COD payment is pending until delivery. Use `order_confirmed` with `ispaymentsucceed: false` initially.

**Q3: Why single AWB?**  
A: Because one order = one box (your business rule). All orderlines packed together = one Ekart shipment.

**Q4: What happens if one orderline cancelled after packing?**  
A: Order becomes `partially_cancelled`. Warehouse must re-pack the box.

**Q5: How is order status calculated?**  
A: Automatically derived from orderline statuses using aggregation rules (see Section 3).

**Q6: Can order status be manually set?**  
A: No. Order status is always derived from orderline statuses. Only orderline statuses are manually updated.

**Q7: What's the difference between `partially_cancelled` and `cancelled`?**  
A: `partially_cancelled` = some (but not all) orderlines cancelled. `cancelled` = all orderlines cancelled.

**Q8: When is stock restored?**  
A: Only when individual orderlines are cancelled/returned/rto_initiated. Order-level cancellation does NOT restore stock.

---

## ✅ Summary

### Global Status System

**Orderline Statuses: 16 Total** (Actual Item Lifecycle)
- `order_placed`, `payment_completed`, `payment_failed`, `order_confirmed`
- `packed`, `ready_for_dispatch`, `shipped`, `in_transit`, `out_for_delivery`, `delivered`
- `cod_payment_received`, `cancelled`, `return_initiated`, `returned`
- `rto_initiated`, `rto_delivered`

**Order Statuses: 16 Total** (Derived from Orderlines)
- Same as orderline statuses, plus:
- `partially_cancelled` (when some orderlines cancelled)
- `partially_returned` (when some orderlines returned)

### Key Features

1. **Payment Mode Identification:**
   - **Use `orders.mode` field** (`"phonepe"` or `"cod"`) to identify payment type
   - **NOT just `ispaymentsucceed` flag** (COD has `false` initially, then `true` after delivery)
   - **Prepaid**: `mode="phonepe"`, `ispaymentsucceed: true` after payment → `order_confirmed`
   - **COD**: `mode="cod"`, `ispaymentsucceed: false` at creation → `order_confirmed` → `delivered` → `cod_payment_received` (`ispaymentsucceed: true`)

2. **PhonePe Initiate API Flow:**
   - **All orders** created via PhonePe initiate API (`POST /v1/phonepe/initiate`) - no manual order creation
   - **Prepaid Flow (PhonePe)**: 
     - `POST /v1/phonepe/initiate` (mode="phonepe") → Stock locked → Redirect to PhonePe payment page → User pays → `GET /v1/phonepe/callback/:transactionId` → Order created with `payment_completed` (`ispaymentsucceed: true`, `mode: "phonepe"`)
   - **COD Flow**: 
     - `POST /v1/phonepe/initiate` (mode="cod") → Stock locked → Order created immediately in initiate endpoint
     - **Current Implementation**: Sets `payment_completed` (`ispaymentsucceed: true`, `mode: "cod"`)
     - **Ideal Implementation**: Should set `order_confirmed` with `ispaymentsucceed: false` (payment pending until delivery)

3. **Ekart Integration:**
   - `shipped` when Ekart shipment is created (AWB assigned)
   - `in_transit`, `out_for_delivery`, `delivered` from Ekart tracking
   - `cod_payment_received` from Ekart COD_COLLECTED status
   - `return_initiated` (manual/API) → `returned` (from Ekart reverse shipment)
   - `rto_initiated`, `rto_delivered` for return to origin

4. **Stock Management:**
   - `order_placed`: Reserves stock
   - `payment_failed`: Releases reserved stock
   - Orderline `cancelled`/`returned`/`rto_initiated`: Automatically restores stock
   - Order cancellation does NOT restore stock (only orderline does)

5. **Status Naming Standards:**
   - Uses industry-standard terms: `shipped` (not `dispatched`), `order_placed`, `order_confirmed`
   - Clear separation: `return_initiated` (customer action) vs `returned` (completed)
   - Proper date fields: `ordereddate`, `paymentcompleteddate`, `orderconfirmeddate`, `shipdate`, `delivereddate`, `paymentreceiveddate`

6. **Order & Orderline Creation:**
   - ✅ Uses direct service calls (no HTTP)
   - ✅ Automatic orderline creation
   - ✅ Promotion data enrichment
   - ✅ Stock conversion (lock → order)

7. **Orderline Cancellation:**
   - ✅ Uses HTTP endpoint (for external clients)
   - ✅ Stock restoration (Product + PlatformStock)
   - ✅ Status updates
   - ✅ Cancellation reason tracking
   - ✅ Order status aggregation (partial vs full cancellation)

8. **Order Status Aggregation:**
   - ✅ Order status is **always derived** from orderline statuses (never manually set)
   - ✅ If all orderlines same status → Order = that status
   - ✅ If mixed statuses → Use lowest progress stage (priority ladder)
   - ✅ Special rules: `partially_cancelled`, `cancelled`, `partially_returned`, `returned`

9. **Packing & Dispatch:**
   - ✅ `packed`: All orderlines packed in one box
   - ✅ `ready_for_dispatch`: All orderlines ready
   - ✅ Single box = One Ekart shipment (one AWB)
   - ✅ All orderlines share same AWB/tracking_id

10. **Industry Standards:**
   - ✅ Matches Amazon/Flipkart standards
   - ✅ Fully normalized status model
   - ✅ Clean separation of business, payment & logistics
   - ✅ Works perfectly with Ekart APIs
   - ✅ Allows future support for multi-box orders, multi-warehouse, multi-shipment

**For complete PhonePe payment flow, see:** `PHONEPE_PAYMENT_FLOW_COMPLETE.md`  
**For Ekart integration details, see:** `EKART_API_USAGE.md` and `cursor_tasks/EKART.md`

---

## ✔ Final Notes

This status model is:
- ✅ **Fully normalized**
- ✅ **Matches Amazon/Flipkart standards**
- ✅ **Works perfectly with Ekart APIs**
- ✅ **Clean separation of business, payment & logistics**
- ✅ **Allows future support for multi-box orders, multi-warehouse, multi-shipment**

