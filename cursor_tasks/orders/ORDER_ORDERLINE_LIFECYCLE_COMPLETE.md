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
12. [Database Schema (Prisma)](#12-database-schema-prisma)
13. [Orderline Cancellation](#13-orderline-cancellation)
14. [Order Fulfillment & EKART Integration](#14-order-fulfillment--ekart-integration)
15. [EKART Shipment Validation Requirements](#15-ekart-shipment-validation-requirements)
16. [GCP Label Storage Policy](#16-gcp-label-storage-policy)
17. [Status Handling Clarifications](#17-status-handling-clarifications)
18. [COD Order Tracking & Payment Management](#18-cod-order-tracking--payment-management)
19. [FAQ](#19-faq)

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
| **`cancellation_requested`** | Cancellation requested (shipped order) | Customer | `cancellationrequesteddate` | None (wait for RTO) | Wait for RTO |
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
| **`cancellation_requested`** | Cancellation requested (waiting for RTO) |
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

❗ **Cancellation rules depend on the shipment stage.**

#### 6.1.1 Cancellation BEFORE Shipment (Pre-Shipped)

**When:** Order status is `order_confirmed`, `packed`, or `ready_for_dispatch` (before EKART shipment created)

**Action:**
1. Cancel orderline(s) directly
2. Restore stock immediately
3. No EKART action needed

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

#### 6.1.2 Cancellation AFTER Shipment Created (Post-Shipped)

**When:** Order has `tracking_id` (EKART shipment created)

**⚠️ IMPORTANT:** Two scenarios with different handling:

##### **Scenario A: Shipment NOT Picked Up by EKART**

**When:** EKART status is `CREATED` but NOT yet `PICKED_UP`

**Action:**
1. Call EKART Cancel API: `DELETE /v1/package/cancel?tracking_id={tracking_id}`
2. If EKART cancellation succeeds:
   - Update orderline status to `cancelled`
   - Restore stock immediately
   - Clear `tracking_id` from order
3. If EKART cancellation fails:
   - Log error but proceed with internal cancellation
   - Stock may need manual reconciliation

```
Order status: shipped (EKART CREATED, not picked up)
  ↓
Customer requests cancellation
  ↓
Call EKART Cancel API
  ↓
If success:
  - Orderline status: cancelled
  - Stock restored
  - Order status: cancelled or partially_cancelled
```

##### **Scenario B: Shipment Already Picked Up (In Transit)**

**When:** EKART status is `PICKED_UP`, `IN_TRANSIT`, or `OUT_FOR_DELIVERY`

**⚠️ CANNOT CANCEL directly.** Shipment is physically with courier.

**Action:**
1. Mark orderline as `cancellation_requested` (intermediate status)
2. Wait for EKART delivery attempt:
   - If customer **refuses delivery** → EKART initiates RTO
   - If delivery **fails** (customer not available, address issue) → EKART initiates RTO
3. On RTO:
   - EKART sends `RTO_INITIATED` status
   - Update orderline to `rto_initiated`
   - Restore stock at `rto_initiated`
4. When package returns to warehouse:
   - EKART sends `RTO_DELIVERED` status
   - Update orderline to `rto_delivered`

```
Order status: in_transit / out_for_delivery
  ↓
Customer requests cancellation
  ↓
Orderline status: cancellation_requested ⏳
  ↓
Wait for EKART...
  ↓
EKART RTO_INITIATED
  ↓
Orderline status: rto_initiated (Stock restored)
  ↓
EKART RTO_DELIVERED
  ↓
Orderline status: rto_delivered (Complete)
```

**Key Point:** You CANNOT force-cancel a shipment that's already in transit. It must go through RTO flow.

#### 6.1.3 Cancellation After Delivery

**When:** Order status is `delivered`

**⚠️ CANNOT CANCEL.** Customer already received the package.

**Action:** Use **Return Flow** instead (Section 6.2)

### 6.2 Return Flow

**When:** Customer wants to return items AFTER delivery.

#### 6.2.1 Return Initiation

**Trigger:** Customer requests return via app/website

**Action:**
1. Update orderline status to `return_initiated`
2. **MUST** create EKART Reverse Shipment:
   - Call `POST /v1/package/create` with `payment_mode: "Pickup"`
   - Pass `return_reason` (required)
3. Store reverse `tracking_id` in orderline
4. Wait for EKART to pickup from customer

```
Orderline status: delivered
  ↓
Customer requests return
  ↓
Orderline status: return_initiated
  ↓
Create EKART Reverse Shipment (payment_mode: "Pickup")
  ↓
EKART picks up from customer
  ↓
EKART delivers to warehouse
  ↓
Orderline status: returned (Stock restored)
```

#### 6.2.2 EKART Reverse Shipment Integration

**Required API Call:**

```typescript
// When orderline.orderstatus = 'return_initiated'
const reversePayload = {
  seller_name: "Nivaana Store",
  seller_address: "Warehouse Address",
  seller_gst_tin: "GST_NUMBER",
  order_number: `RET-${order.orderid}`,
  invoice_number: order.orderid,
  invoice_date: new Date().toISOString().split('T')[0],
  consignee_name: customer.name,
  products_desc: orderline.productname,
  payment_mode: "Pickup",  // ✅ REQUIRED for reverse shipment
  return_reason: "Customer return request",  // ✅ REQUIRED
  total_amount: orderline.orderamount,
  // ... other required fields
  drop_location: {
    name: customer.name,
    address: customer.address,
    city: customer.city,
    state: customer.state,
    pin: customer.pincode,
    phone: customer.phone
  }
};

const response = await ekartService.createShipment(reversePayload);
// Store response.tracking_id in orderline
```

#### 6.2.3 Order Status

| Situation | Order Status |
|-----------|-------------|
| Some returned | `partially_returned` |
| All returned | `returned` |

**Stock Restoration:** Stock is restored when orderline status changes to `returned` (after EKART confirms reverse delivery to warehouse).

### 6.3 RTO Flow (Return to Origin)

**When:** Delivery fails and EKART returns package to warehouse.

**Triggers:**
- Customer not available
- Wrong address
- Customer refuses delivery
- Multiple delivery attempts failed
- Customer requested cancellation after shipped (Scenario B)

```
rto_initiated  (EKART starts return to warehouse)
  ↓ (Stock restored here)
rto_delivered  (Package delivered back to warehouse)
```

**Stock rules:**
- Stock restored at `rto_initiated` (not at `rto_delivered`)
- This is because the item is no longer with customer at `rto_initiated`

### 6.4 Cancellation Summary Table

| Order Stage | Can Cancel? | EKART Action | Stock Action |
|-------------|-------------|--------------|--------------|
| `order_confirmed` | ✅ Yes | None | Restore immediately |
| `packed` | ✅ Yes | None | Restore immediately |
| `ready_for_dispatch` | ✅ Yes | None | Restore immediately |
| `shipped` (not picked up) | ✅ Yes | Cancel AWB | Restore if AWB cancelled |
| `shipped` (picked up) | ⚠️ Partial | Wait for RTO | Restore at `rto_initiated` |
| `in_transit` | ⚠️ Partial | Wait for RTO | Restore at `rto_initiated` |
| `out_for_delivery` | ⚠️ Partial | Wait for RTO | Restore at `rto_initiated` |
| `delivered` | ❌ No | Use Return | Restore at `returned` |

### 6.5 New Status: `cancellation_requested`

**Purpose:** Track cancellation requests for shipped orders that cannot be immediately cancelled.

**Usage:**
```typescript
// When customer cancels after shipment is picked up
if (orderline.orderstatus === 'in_transit' || orderline.orderstatus === 'out_for_delivery') {
  // Cannot cancel directly, mark as requested
  orderline.orderstatus = 'cancellation_requested';
  orderline.cancellation_requested_date = Date.now();
  orderline.cancellation_reason = reason;
  
  // Wait for EKART RTO...
  // When EKART sends RTO_INITIATED:
  // orderline.orderstatus = 'rto_initiated';
  // Restore stock here
}
```

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

**For Inventory User Actions (inventory_user_id is REQUIRED):**
```json
{
  "previous_status": "payment_completed",
  "new_status": "packed",
  "changed_date": 1712345678901,
  "source": "inventoryuser",
  "inventory_user_id": 123
}
```

**Important:** When `source` is `inventoryuser`, the `inventory_user_id` field is **required** and must contain the ID of the inventory app user who performed the action.

#### Field Explanation

| Field | Meaning |
|-------|---------|
| `previous_status` | Old status before change (null for first status) |
| `new_status` | New status after change |
| `changed_date` | Timestamp (epoch milliseconds) when the change happened |
| `source` | Who triggered the change: `system`, `customer`, `ekart`, `phonepe`, `inventoryuser` |
| `inventory_user_id` | (Required when `source` is `inventoryuser`) Inventory user ID who performed the action |

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
    "source": "inventoryuser",
    "inventory_user_id": 123
  },
  {
    "previous_status": "packed",
    "new_status": "ready_for_dispatch",
    "changed_date": 1712346000000,
    "source": "inventoryuser",
    "inventory_user_id": 123
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

| Source | When Used | Inventory User ID Required? |
|--------|-----------|----------------------------|
| `system` | Internal automated updates (order creation, status aggregation) | No |
| `phonepe` | Prepaid payment updates (payment_completed, payment_failed) | No |
| `ekart` | Webhook updates (shipped, in_transit, out_for_delivery, delivered, rto_initiated, etc.) | No |
| `customer` | Customer-initiated actions via mobile/web app (cancellation, return initiation) | No |
| `inventoryuser` | Inventory app user actions (packing, shipment creation, status updates, ready_for_dispatch) | **Yes** - Must include `inventory_user_id` |

### 9.6 Implementation Example

```typescript
// When updating order status
async updateOrderStatus(
  id: string, 
  newStatus: string, 
  source: string = 'system',
  inventoryUserId?: number
) {
  // Get current order
  const order = await this.findById(id);
  const previousStatus = order.orderstatus;
  
  // Prepare status history entry
  const historyEntry: any = {
    previous_status: previousStatus,
    new_status: newStatus,
    changed_date: Date.now(),
    source: source
  };
  
  // Add inventory_user_id if source is inventoryuser (REQUIRED)
  if (source === 'inventoryuser') {
    if (!inventoryUserId) {
      throw new Error('inventory_user_id is required when source is inventoryuser');
    }
    historyEntry.inventory_user_id = inventoryUserId;
  }
  
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

Same structure applies to orderline. **IMPORTANT:** Status history must be updated whenever orderline status changes.

**Complete Implementation:**

```typescript
// src/services/orderline.service.ts

async updateOrderlineStatus(
  id: string, 
  status: string, 
  additionalData?: Record<string, any>
) {
  try {
    // Get current orderline
    const currentOrderline = await this.findById(id);
    if (!currentOrderline) {
      throw new Error(`Orderline with ID ${id} not found`);
    }

    const previousStatus = currentOrderline.orderstatus;
    const source = additionalData?.source || 'system';
    const inventoryUserId = additionalData?.inventory_user_id;

    // Prepare status history entry
    const existingHistory = currentOrderline.status_history || [];
    const historyEntry: any = {
      previous_status: previousStatus,
      new_status: status,
      changed_date: Date.now(),
      source: source
    };
    
    // Add inventory_user_id if source is inventoryuser (REQUIRED)
    if (source === 'inventoryuser') {
      if (!inventoryUserId) {
        throw new Error('inventory_user_id is required when source is inventoryuser');
      }
      historyEntry.inventory_user_id = inventoryUserId;
    }
    
    const updatedHistory = [...existingHistory, historyEntry];

    const updateData: Record<string, any> = {
      orderstatus: status,
      status_history: updatedHistory, // ✅ ADD STATUS HISTORY
      modifieddate: Date.now(),
      ...additionalData
    };

    // Set specific date fields based on status
    const currentTimestamp = Date.now();
    switch (status.toLowerCase()) {
      case 'delivered':
        updateData.delivereddate = currentTimestamp;
        break;
      case 'cancelled':
        updateData.cancelleddate = currentTimestamp;
        await this.adjustProductQuantitiesOnCancellation(currentOrderline);
        break;
      case 'returned':
        updateData.returneddate = currentTimestamp;
        await this.adjustProductQuantitiesOnCancellation(currentOrderline);
        break;
      case 'dispatched':
        updateData.dispatcheddate = currentTimestamp;
        break;
      case 'ready_to_dispatch':
        updateData.readytodispatchdate = currentTimestamp;
        break;
      case 'payment_failed':
        updateData.paymentfaileddate = currentTimestamp;
        break;
    }

    const orderline = await this.update(id, updateData);

    // ✅ IMPORTANT: Recalculate order status after orderline update
    if (orderline.orderid) {
      const ordersService = new OrdersService();
      await ordersService.recalculateOrderStatus(parseInt(orderline.orderid.toString()));
    }

    return orderline;
  } catch (error) {
    logger.error({ error, orderlineId: id, status }, 'Error in orderline status update');
    throw error;
  }
}
```

**Key Points:**
- ✅ Status history is **automatically updated** whenever orderline status changes
- ✅ Source tracking helps identify who/what triggered the change
- ✅ Order status is **automatically recalculated** after orderline status update
- ✅ Order status history is also updated when order status changes (via `recalculateOrderStatus`)

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
// payment_completed → packed (Inventory User #123, Dec 3, 2:00 PM)
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
7. **Inventory User ID**: When `source` is `inventoryuser`, **must** include `inventory_user_id` in the history entry
8. **Order Status Recalculation**: When orderline status changes, order status is automatically recalculated and its history is updated

### 9.11 Database Schema Requirements

**Required Migration:**

```sql
-- Add status_history column to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;

-- Add status_history column to orderline table
ALTER TABLE orderline 
ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb;

-- Create index for faster queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_orders_status_history ON orders USING GIN (status_history);
CREATE INDEX IF NOT EXISTS idx_orderline_status_history ON orderline USING GIN (status_history);
```

### 9.12 Integration with Order Status Recalculation

**When orderline status changes, order status must be recalculated:**

```typescript
// src/services/orders.service.ts

/**
 * Recalculate order status based on all orderline statuses
 * This automatically updates order status history
 */
async recalculateOrderStatus(orderId: number): Promise<void> {
  try {
    // Get all orderlines for this order
    const orderlines = await dynamicFindManyWithFilters('orderline', {
      orderid: orderId.toString()
    }, { useAllColumns: true });

    if (!orderlines.data || orderlines.data.length === 0) {
      logger.warn({ orderId }, 'No orderlines found for order');
      return;
    }

    const orderlineStatuses = orderlines.data.map(ol => ol.orderstatus);

    // Calculate new order status based on aggregation rules
    let newOrderStatus: string;

    // Check for cancellation scenarios first
    const cancelledCount = orderlineStatuses.filter(s => s === 'cancelled').length;
    const totalCount = orderlineStatuses.length;

    if (cancelledCount === totalCount) {
      newOrderStatus = 'cancelled';
    } else if (cancelledCount > 0) {
      newOrderStatus = 'partially_cancelled';
    } else {
      // Check for return scenarios
      const returnedCount = orderlineStatuses.filter(s => s === 'returned').length;
      
      if (returnedCount === totalCount) {
        newOrderStatus = 'returned';
      } else if (returnedCount > 0) {
        newOrderStatus = 'partially_returned';
      } else {
        // All orderlines have same status
        const uniqueStatuses = [...new Set(orderlineStatuses)];
        
        if (uniqueStatuses.length === 1) {
          newOrderStatus = uniqueStatuses[0];
        } else {
          // Mixed statuses - use priority ladder (lowest progress stage)
          const statusPriority = [
            'order_placed',
            'payment_completed',
            'order_confirmed',
            'packed',
            'ready_for_dispatch',
            'shipped',
            'in_transit',
            'out_for_delivery',
            'delivered',
            'cod_payment_received',
            'cancelled',
            'returned',
            'rto_initiated',
            'rto_delivered'
          ];

          // Find the lowest priority status
          let lowestPriority = 999;
          let lowestStatus = uniqueStatuses[0];

          for (const status of uniqueStatuses) {
            const priority = statusPriority.indexOf(status);
            if (priority !== -1 && priority < lowestPriority) {
              lowestPriority = priority;
              lowestStatus = status;
            }
          }

          newOrderStatus = lowestStatus;
        }
      }
    }

    // Get current order to check if status changed
    const currentOrder = await this.findById(orderId);
    const previousStatus = currentOrder.orderstatus;

    // Only update if status changed
    if (previousStatus !== newOrderStatus) {
      // ✅ Update status history for order
      const existingHistory = currentOrder.status_history || [];
      const historyEntry: any = {
        previous_status: previousStatus,
        new_status: newOrderStatus,
        changed_date: Date.now(),
        source: 'system' // Auto-calculated from orderlines
      };
      // Note: inventory_user_id not needed for system-calculated status
      const updatedHistory = [...existingHistory, historyEntry];

      // Update order with new status and history
      await this.update(orderId.toString(), {
        orderstatus: newOrderStatus,
        status_history: updatedHistory,
        modifieddate: Date.now()
      });

      logger.info({
        orderId,
        previousStatus,
        newOrderStatus,
        orderlineStatuses
      }, 'Order status recalculated and history updated');
    }
  } catch (error) {
    logger.error({ error, orderId }, 'Error recalculating order status');
    throw error;
  }
}
```

### 9.13 Real-World Status History Examples

#### Example 1: Normal Order Flow with History

```json
// Orderline Status History
[
  {
    "previous_status": null,
    "new_status": "payment_completed",
    "changed_date": 1701234567890,
    "source": "phonepe"
  },
  {
    "previous_status": "payment_completed",
    "new_status": "packed",
    "changed_date": 1701234900000,
    "source": "inventoryuser",
    "inventory_user_id": 123
  },
  {
    "previous_status": "packed",
    "new_status": "shipped",
    "changed_date": 1701235200000,
    "source": "ekart"
  },
  {
    "previous_status": "shipped",
    "new_status": "in_transit",
    "changed_date": 1701235500000,
    "source": "ekart"
  },
  {
    "previous_status": "in_transit",
    "new_status": "delivered",
    "changed_date": 1701235800000,
    "source": "ekart"
  }
]

// Order Status History (automatically derived)
[
  {
    "previous_status": null,
    "new_status": "payment_completed",
    "changed_date": 1701234567890,
    "source": "system"
  },
  {
    "previous_status": "payment_completed",
    "new_status": "packed",
    "changed_date": 1701234900000,
    "source": "system"
  },
  {
    "previous_status": "packed",
    "new_status": "shipped",
    "changed_date": 1701235200000,
    "source": "system"
  },
  {
    "previous_status": "shipped",
    "new_status": "in_transit",
    "changed_date": 1701235500000,
    "source": "system"
  },
  {
    "previous_status": "in_transit",
    "new_status": "delivered",
    "changed_date": 1701235800000,
    "source": "system"
  }
]
```

#### Example 2: Cancellation with History

```json
// Orderline Status History (after cancellation)
[
  {
    "previous_status": null,
    "new_status": "payment_completed",
    "changed_date": 1701234567890,
    "source": "phonepe"
  },
  {
    "previous_status": "payment_completed",
    "new_status": "shipped",
    "changed_date": 1701235200000,
    "source": "ekart"
  },
  {
    "previous_status": "shipped",
    "new_status": "cancelled",
    "changed_date": 1701236000000,
    "source": "customer"
  }
]

// Order Status History (automatically updated)
[
  {
    "previous_status": null,
    "new_status": "payment_completed",
    "changed_date": 1701234567890,
    "source": "system"
  },
  {
    "previous_status": "payment_completed",
    "new_status": "shipped",
    "changed_date": 1701235200000,
    "source": "system"
  },
  {
    "previous_status": "shipped",
    "new_status": "partially_cancelled", // or "cancelled" if all orderlines cancelled
    "changed_date": 1701236000000,
    "source": "system"
  }
]
```

### 9.14 Implementation Checklist

**When implementing status history, ensure:**

- [ ] Database migration adds `status_history` JSONB column to both `orders` and `orderline` tables
- [ ] `updateOrderlineStatus()` method updates status history automatically
- [ ] `recalculateOrderStatus()` method updates order status history when order status changes
- [ ] Source is correctly specified (`customer`, `inventoryuser`, `ekart`, `phonepe`, `system`)
- [ ] When `source` is `inventoryuser`, `inventory_user_id` is **required** and included in the history entry
- [ ] Inventory user ID is validated before storing in history
- [ ] Status history is never modified or deleted (append-only)
- [ ] First entry has `previous_status: null`
- [ ] All status changes are tracked (no exceptions)

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

## 1️⃣3️⃣ Orderline Cancellation

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
   const previousStatus = currentOrderline.orderstatus;
   const source = additionalData?.source || 'customer'; // or 'inventoryuser'
   const inventoryUserId = additionalData?.inventory_user_id;
   
   // Prepare status history entry
   const existingHistory = currentOrderline.status_history || [];
   const historyEntry: any = {
     previous_status: previousStatus,
     new_status: 'cancelled',
     changed_date: Date.now(),
     source: source
   };
   
   // Add inventory_user_id if source is inventoryuser
   if (source === 'inventoryuser' && inventoryUserId) {
     historyEntry.inventory_user_id = inventoryUserId;
   }
   const updatedHistory = [...existingHistory, historyEntry];
   
   const updateData = {
     orderstatus: 'cancelled',
     status_history: updatedHistory, // ✅ Update status history
     cancelleddate: Date.now(),
     modifieddate: Date.now(),
     cancellation_reason: reason,
     ...additionalData
   };
   ```
3. **CRITICAL:** Call `adjustProductQuantitiesOnCancellation()` to restore stock
4. Update orderline record
5. **CRITICAL:** Call `recalculateOrderStatus()` to update order status and its history

**Database Operations:**
- **Read:** `orderline` table (get current orderline)
- **Write:** Update `orderline` table (status, status_history, cancelleddate)
- **Read:** All orderlines for the order (for status recalculation)
- **Write:** Update `orders` table (orderstatus, status_history)

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

## 1️⃣1️⃣ Database Operations Summary

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

## 1️⃣2️⃣ Database Schema (Prisma)

This section provides the complete Prisma schema definitions for the `orders` and `orderline` models, including all fields, relationships, and constraints.

### 12.1 Orderline Model

```prisma
model orderline {
  id              Int       @id @default(autoincrement())
  orderid         Int  
  orderlinenumber String?   @unique(map: "unique_orderlinenumber") @db.VarChar(500)
  productid       BigInt?
  quantity        Int?
  createddate     BigInt?
  modifieddate    BigInt?
  userid          Int?
  addressid       Int?
  productamount   Decimal?  @db.Decimal(10,2)
  discountamount  Decimal?  @db.Decimal(10,2)
  orderamount     Decimal?  @db.Decimal(10,2)
  merchanttransactionid String? @db.VarChar(500)
  productname     String?   @db.VarChar(500)
  productcategory String?   @db.VarChar(500)
  productcolour   String?   @db.VarChar(500)
  readytodispatchdate BigInt?
  delivereddate   BigInt?
  cancelleddate   BigInt?
  returneddate    BigInt?
  orderstatus     String?   @db.VarChar(500)
  uniqueordderid  String?   @db.VarChar(500)
  deliveryfrom    String?   @db.VarChar(500)
  location        String?   @db.VarChar(500)
  dispatcheddate  BigInt?
  ordereddate     BigInt?
  paymentfaileddate BigInt?
  evaluation_id   String?   @db.VarChar(36)
  original_price  Decimal?  @db.Decimal(10,2)
  product_discount_amount  Decimal? @db.Decimal(10,2) @default(0)
  promotion_discount_amount Decimal? @db.Decimal(10,2) @default(0)
  shipping_cost            Decimal? @db.Decimal(10,2) @default(0)
  // EKART Shipment Information (shared with order)
  tracking_id             String?   @db.VarChar(500)
  shipdate                BigInt?
  address         address?  @relation(fields: [addressid], references: [id], onDelete: NoAction, onUpdate: NoAction)
  product         Product?  @relation(fields: [productid], references: [id], onDelete: NoAction, onUpdate: NoAction)
  users           users?    @relation(fields: [userid], references: [id], onDelete: NoAction, onUpdate: NoAction)
  rating          rating[]
  stock           Stock[]
  tickets         tickets[] @ignore
  orders          orders?   @relation(fields: [orderid], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@map("orderline")
}
```

### 12.2 Orders Model

```prisma
model orders {
  id                    Int                      @id @default(autoincrement())
  userid                Int?
  addressid             Int?
  createddate           BigInt?
  modifieddate          BigInt?
  orderamount           Decimal?                 @db.Decimal
  orderid               String?                  @unique(map: "uniq_orderid") @db.VarChar(500)
  orderstatus           String?                  @db.VarChar(500)
  delivereddate         BigInt?
  cancelleddate         BigInt?
  returneddate          BigInt?
  quantity              Int?
  transactionid         String?                  @db.VarChar(500)
  readytodispatchdate   BigInt?
  dispatcheddate        BigInt?
  productamount         Decimal?                 @db.Decimal
  discountamount        Decimal?                 @db.Decimal
  deliveryfrom          String?                  @db.VarChar(200)
  orderprocessingtime   BigInt?
  ispaymentsucceed      Boolean?                 @default(false)
  merchanttransactionid String?                  @db.VarChar(250)
  productid             Int[]
  evaluation_id         String?                   @db.VarChar(36) @unique
  promotion_discount_total    Decimal?            @db.Decimal(10,2) @default(0) // order-level + item-level promo discounts
  original_total        Decimal?                  @db.Decimal(10,2)   // subtotal of items before any discount
  shipping_cost         Decimal?                  @db.Decimal(10,2) @default(0)
  tax_amount            Decimal?                  @db.Decimal(10,2) @default(0)
  paymentfaileddate     BigInt?
  searchtext            Unsupported("tsvector")?
  // Payment Mode & COD Tracking
  mode                        String?   @db.VarChar(50)  // 'cod' | 'phonepe'
  cod_payment_received_date   BigInt?                    // When COD payment collected (epoch milliseconds)
  cod_transaction_reference   String?   @db.VarChar(500) // EKART/payment gateway transaction reference
  cod_amount                  Decimal?  @db.Decimal(10,2) // COD amount for verification and reconciliation
  // EKART Shipment Information
  tracking_id           String?                   @db.VarChar(500)
  vendor                String?                   @db.VarChar(100) @default("EKART")
  barcodes              Json?
  label_url             String?                   @db.VarChar(1000)
  public_tracking_link  String?                   @db.VarChar(1000)
  shipment_created_at   BigInt?
  label_downloaded_at   BigInt?
  label_printed_at      BigInt?
  shipdate              BigInt?
  orderline             orderline[]
  address               address?                 @relation(fields: [addressid], references: [id], onDelete: Cascade, onUpdate: NoAction, map: "fk_addressid_orders")
  transaction           transaction?             @relation(fields: [transactionid], references: [transactionid], onDelete: Cascade, onUpdate: NoAction, map: "fk_transactionid")
  users                 users?                   @relation(fields: [userid], references: [id], onDelete: Cascade, onUpdate: NoAction, map: "fk_userid_orders")
  revoinvoice           revoinvoice[]
  stock                 Stock[]
}
```

### 12.3 Key Field Descriptions

#### **Orderline Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Int` | Primary key (auto-increment) |
| `orderid` | `Int` | Foreign key to `orders.id` |
| `orderlinenumber` | `String?` | Unique orderline identifier |
| `productid` | `BigInt?` | Foreign key to `product.id` |
| `quantity` | `Int?` | Quantity of items in this orderline |
| `orderstatus` | `String?` | Current status of this orderline (see Section 2) |
| `tracking_id` | `String?` | EKART tracking ID (shared with order) |
| `shipdate` | `BigInt?` | Timestamp when orderline was shipped |
| `original_price` | `Decimal?` | Original price before discounts |
| `product_discount_amount` | `Decimal?` | Product-level discount amount |
| `promotion_discount_amount` | `Decimal?` | Promotion discount amount |
| `shipping_cost` | `Decimal?` | Shipping cost for this orderline |

#### **Orders Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `Int` | Primary key (auto-increment) |
| `orderid` | `String?` | Unique order number (display ID) |
| `orderstatus` | `String?` | Current order status (derived from orderlines) |
| `orderamount` | `Decimal?` | Total order amount after all discounts |
| `mode` | `String?` | Payment mode: `'cod'` or `'phonepe'` |
| `ispaymentsucceed` | `Boolean?` | Payment success flag (false for COD initially) |
| `cod_payment_received_date` | `BigInt?` | When COD payment was collected |
| `cod_transaction_reference` | `String?` | EKART/payment gateway transaction reference |
| `cod_amount` | `Decimal?` | COD amount for verification |
| `tracking_id` | `String?` | EKART tracking ID (AWB) |
| `vendor` | `String?` | Shipping vendor (default: "EKART") |
| `barcodes` | `Json?` | EKART barcodes (wbn, order, cod) |
| `label_url` | `String?` | GCP URL to shipping label PDF |
| `public_tracking_link` | `String?` | Public EKART tracking URL |
| `shipment_created_at` | `BigInt?` | When EKART shipment was created |
| `label_downloaded_at` | `BigInt?` | When label was downloaded |
| `label_printed_at` | `BigInt?` | When label was printed |

### 12.4 Relationships

**Orderline → Orders:**
- `orderline.orderid` → `orders.id` (Many-to-One)
- One order can have multiple orderlines
- Cascade delete: If order is deleted, orderlines are NOT automatically deleted (onDelete: NoAction)

**Orders → Address:**
- `orders.addressid` → `address.id` (Many-to-One)
- Cascade delete: If address is deleted, orders are deleted (onDelete: Cascade)

**Orders → Transaction:**
- `orders.transactionid` → `transaction.transactionid` (Many-to-One)
- Cascade delete: If transaction is deleted, orders are deleted (onDelete: Cascade)

**Orders → Users:**
- `orders.userid` → `users.id` (Many-to-One)
- Cascade delete: If user is deleted, orders are deleted (onDelete: Cascade)

**Orderline → Product:**
- `orderline.productid` → `product.id` (Many-to-One)
- No cascade delete: If product is deleted, orderline remains (onDelete: NoAction)

**Orderline → Address:**
- `orderline.addressid` → `address.id` (Many-to-One)
- No cascade delete: If address is deleted, orderline remains (onDelete: NoAction)

**Orderline → Users:**
- `orderline.userid` → `users.id` (Many-to-One)
- No cascade delete: If user is deleted, orderline remains (onDelete: NoAction)

### 12.5 Important Notes

1. **Status History:** Both `orders` and `orderline` tables should have a `status_history` JSONB column (not shown in Prisma schema above, but required - see Section 9 for details).

2. **Timestamps:** All date fields use `BigInt` to store epoch milliseconds (not PostgreSQL timestamps).

3. **Unique Constraints:**
   - `orders.orderid` is unique (display order number)
   - `orders.evaluation_id` is unique (promotion evaluation)
   - `orderline.orderlinenumber` is unique

4. **Nullable Fields:** Most fields are nullable to support legacy data and optional information.

5. **EKART Fields:** Both `orders` and `orderline` have `tracking_id` and `shipdate` fields. The `orders.tracking_id` is the primary one, and `orderline.tracking_id` is typically copied from the order.

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
[4] Update Orderline Status History
  └─ UPDATE orderline (status_history) ✅ Append history entry
  ↓
[5] Check All Orderlines for Order Status
  └─ SELECT FROM orderline WHERE orderid = ?
  ↓
[6] Calculate Order Status
  ├─ If all orderlines cancelled → Order status: 'cancelled'
  ├─ If some orderlines cancelled → Order status: 'partially_cancelled'
  └─ If no orderlines cancelled → Order status unchanged
  ↓
[7] Update Order Status (if needed)
  ├─ UPDATE orders (orderstatus)
  └─ UPDATE orders (status_history) ✅ Append history entry
  ↓
[8] Return Response
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

## 1️⃣5️⃣ EKART Shipment Validation Requirements

**⚠️ CRITICAL:** Before calling EKART Create Shipment API, ALL validations must pass.

### 15.1 Pre-Shipment Validation Checklist

The system MUST validate the following before calling `POST /v1/package/create`:

#### **1. Order Status Validation**

| Check | Requirement | Error if Failed |
|-------|-------------|-----------------|
| Order not cancelled | `orderstatus !== 'cancelled'` | "Cannot create shipment for cancelled order" |
| Order not already shipped | `tracking_id === null` | "Shipment already created for this order" |
| All orderlines ready | All orderlines = `ready_for_dispatch` | "Not all orderlines are ready for dispatch" |

#### **2. Orderline Validation**

| Check | Requirement | Error if Failed |
|-------|-------------|-----------------|
| All orderlines packed | All `orderstatus === 'ready_for_dispatch'` | "Some orderlines are not ready" |
| Single box design | All orderlines in one shipment | "Multi-box shipments not supported" |
| No cancelled orderlines | No `orderstatus === 'cancelled'` among active items | "Order has cancelled items, repack required" |

#### **3. Customer Address Validation**

| Field | Required | Validation |
|-------|----------|------------|
| `name` | ✅ Yes | Non-empty string |
| `address` | ✅ Yes | Non-empty string |
| `city` | ✅ Yes | Non-empty string |
| `state` | ✅ Yes | Non-empty string |
| `pin` | ✅ Yes | Valid 6-digit pincode (numeric) |
| `phone` | ✅ Yes | Valid 10-digit phone number (numeric) |

```typescript
// Example validation
function validateAddress(address: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!address.name?.trim()) errors.push('Customer name is required');
  if (!address.address?.trim()) errors.push('Address is required');
  if (!address.city?.trim()) errors.push('City is required');
  if (!address.state?.trim()) errors.push('State is required');
  if (!address.pin || !/^\d{6}$/.test(address.pin.toString())) 
    errors.push('Valid 6-digit pincode is required');
  if (!address.phone || !/^\d{10}$/.test(address.phone.toString())) 
    errors.push('Valid 10-digit phone number is required');
  
  return { valid: errors.length === 0, errors };
}
```

#### **4. Package Dimensions & Weight**

| Field | Required | Validation |
|-------|----------|------------|
| `weight` | ✅ Yes | > 0 (in grams) |
| `length` OR `templateName` | ✅ One required | If no template, dimensions required |
| `width` OR `templateName` | ✅ One required | If no template, dimensions required |
| `height` OR `templateName` | ✅ One required | If no template, dimensions required |

**⚠️ IMPORTANT:** Send ONLY `templateName` OR dimensions. NOT both.

```typescript
// Example validation
function validatePackage(pkg: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!pkg.weight || pkg.weight <= 0) 
    errors.push('Weight must be greater than 0 grams');
  
  if (pkg.templateName && (pkg.length || pkg.width || pkg.height)) {
    errors.push('Cannot send both templateName and dimensions');
  }
  
  if (!pkg.templateName && (!pkg.length || !pkg.width || !pkg.height)) {
    errors.push('Either templateName or dimensions (length, width, height) required');
  }
  
  return { valid: errors.length === 0, errors };
}
```

#### **5. COD Amount Validation (COD Orders Only)**

| Check | Requirement | Error if Failed |
|-------|-------------|-----------------|
| COD amount set | `cod_amount > 0` for COD orders | "COD amount must be greater than 0" |
| COD matches order | `cod_amount === orderamount` | "COD amount must match order amount" |
| Mode is COD | `mode === 'cod'` | "Payment mode must be COD for COD shipment" |

```typescript
// Example validation for COD
function validateCodOrder(order: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (order.mode === 'cod') {
    if (!order.cod_amount || order.cod_amount <= 0) {
      errors.push('COD amount must be greater than 0');
    }
    if (order.cod_amount !== order.orderamount) {
      errors.push('COD amount must match order amount');
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

#### **6. Financial Validation**

| Check | Requirement |
|-------|-------------|
| `total_amount` | Must be > 0 |
| `taxable_amount` | Must be >= 0 |
| `tax_value` | Must be >= 0 |
| `commodity_value` | Must be set (string) |

### 15.2 Complete Validation Function

```typescript
/**
 * Validate order before creating EKART shipment
 * @returns { valid: boolean, errors: string[] }
 */
async function validateBeforeEkartShipment(orderId: number): Promise<{
  valid: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  
  // 1. Get order with orderlines
  const order = await ordersService.findById(orderId);
  const orderlines = await orderlineService.findByOrderId(orderId);
  
  // 2. Order status validation
  if (order.orderstatus === 'cancelled') {
    errors.push('Cannot create shipment for cancelled order');
  }
  if (order.tracking_id) {
    errors.push('Shipment already created for this order');
  }
  
  // 3. Orderline validation
  const activeOrderlines = orderlines.filter(ol => ol.orderstatus !== 'cancelled');
  if (activeOrderlines.length === 0) {
    errors.push('No active orderlines in order');
  }
  const notReady = activeOrderlines.filter(ol => ol.orderstatus !== 'ready_for_dispatch');
  if (notReady.length > 0) {
    errors.push(`${notReady.length} orderline(s) not ready for dispatch`);
  }
  
  // 4. Address validation
  const address = await addressService.findById(order.addressid);
  const addressValidation = validateAddress(address);
  errors.push(...addressValidation.errors);
  
  // 5. Package validation (using default or order-level settings)
  // Add your package validation here
  
  // 6. COD validation
  if (order.mode === 'cod') {
    const codValidation = validateCodOrder(order);
    errors.push(...codValidation.errors);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

### 15.3 API Response for Validation Failure

When validation fails, return a clear error response:

```typescript
// In controller
const validation = await validateBeforeEkartShipment(orderId);
if (!validation.valid) {
  return reply.code(400).send({
    success: false,
    message: 'Order validation failed',
    errors: validation.errors,
    statusCode: 400
  });
}

// Proceed with EKART shipment creation...
```

---

## 1️⃣6️⃣ GCP Label Storage Policy

### 16.1 Why Store Labels in GCP?

**✅ ALWAYS store label PDFs in GCP (Google Cloud Storage).**

**Reasons:**
1. **Reliability:** GCP provides 99.999999999% (11 9's) durability
2. **Performance:** Faster serving of labels to users
3. **Backup:** Labels available even if EKART API is down
4. **Audit Trail:** Required for tax filing and compliance
5. **Reprint:** Users can reprint labels without calling EKART again
6. **Analytics:** Track label downloads and prints

### 16.2 Storage Structure

```
gs://nivaana-labels/
├── {year}/
│   ├── {month}/
│   │   ├── {order_id}_{tracking_id}.pdf
│   │   └── ...
│   └── ...
└── ...

Example:
gs://nivaana-labels/2025/01/ORD-1001_500999A3408005.pdf
```

### 16.3 Label Storage Implementation

```typescript
/**
 * Download and store EKART label in GCP
 */
async function downloadAndStoreLabel(trackingId: string, orderId: string): Promise<string> {
  try {
    // 1. Download label from EKART (returns binary PDF)
    const labelBuffer = await ekartService.downloadLabel([trackingId]);
    
    // 2. Generate GCP path
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const filename = `${orderId}_${trackingId}.pdf`;
    const gcsPath = `${year}/${month}/${filename}`;
    
    // 3. Upload to GCP
    const bucket = storage.bucket('nivaana-labels');
    const file = bucket.file(gcsPath);
    
    await file.save(labelBuffer, {
      contentType: 'application/pdf',
      metadata: {
        trackingId,
        orderId,
        uploadedAt: Date.now().toString()
      }
    });
    
    // 4. Generate signed URL (or public URL)
    const labelUrl = `https://storage.googleapis.com/nivaana-labels/${gcsPath}`;
    
    // 5. Update order with label URL
    await ordersService.update(orderId, {
      label_url: labelUrl,
      label_downloaded_at: Date.now()
    });
    
    logger.info({ trackingId, orderId, gcsPath }, 'Label stored in GCP');
    
    return labelUrl;
  } catch (error) {
    logger.error({ error, trackingId }, 'Failed to store label in GCP');
    throw error;
  }
}
```

### 16.4 Retention Policy

| Label Type | Retention Period | Reason |
|------------|------------------|--------|
| **Delivered Orders** | 7 years | Tax/audit compliance |
| **Cancelled Orders** | 1 year | Dispute resolution |
| **RTO Orders** | 3 years | Dispute resolution |
| **Failed Labels** | 30 days | Debugging |

### 16.5 Lifecycle Rules (GCP)

Configure lifecycle rules in GCP to auto-delete old labels:

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "age": 2555,  // 7 years for delivered
          "matchesPrefix": ["delivered/"]
        }
      },
      {
        "action": {
          "type": "Delete"
        },
        "condition": {
          "age": 365,  // 1 year for cancelled
          "matchesPrefix": ["cancelled/"]
        }
      }
    ]
  }
}
```

### 16.6 Label Access Control

1. **Private Bucket:** Labels should be in a private bucket
2. **Signed URLs:** Generate time-limited signed URLs for access
3. **Auth Required:** Only authenticated users can download labels

```typescript
/**
 * Generate signed URL for label download (valid for 1 hour)
 */
async function getSignedLabelUrl(labelPath: string): Promise<string> {
  const bucket = storage.bucket('nivaana-labels');
  const file = bucket.file(labelPath);
  
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000  // 1 hour
  });
  
  return signedUrl;
}
```

### 16.7 Database Fields for Label Tracking

| Field | Type | Description |
|-------|------|-------------|
| `label_url` | `String?` | GCP URL to stored label |
| `label_downloaded_at` | `BigInt?` | When label was downloaded from EKART |
| `label_printed_at` | `BigInt?` | When label was printed (from UI action) |

---

## 1️⃣7️⃣ Status Handling Clarifications

### 17.1 COD vs Prepaid Initial Status

**⚠️ IMPORTANT: Current vs Ideal Implementation**

#### Current Implementation (To Be Fixed)

```typescript
// Current (INCORRECT for COD)
const orderData = {
  orderstatus: 'payment_completed',  // ❌ Wrong for COD
  ispaymentsucceed: true,  // ❌ Wrong for COD
  mode: mode  // 'cod' or 'phonepe'
};
```

#### Ideal Implementation (RECOMMENDED)

```typescript
// CORRECT implementation
const orderData = {
  orderstatus: mode === 'cod' ? 'order_confirmed' : 'payment_completed',
  ispaymentsucceed: mode === 'cod' ? false : true,
  mode: mode  // 'cod' or 'phonepe'
};
```

**Why This Matters:**

| Aspect | Prepaid | COD (Ideal) | COD (Current - Wrong) |
|--------|---------|-------------|----------------------|
| Initial Status | `payment_completed` | `order_confirmed` | `payment_completed` ❌ |
| `ispaymentsucceed` | `true` | `false` | `true` ❌ |
| Analytics Impact | Correct revenue | Correct pending revenue | Inflated "paid" revenue ❌ |
| Tax Filing | Correct | Correct | Incorrect - shows payment before delivery ❌ |

**Fix Required:** Update `phonepe.controller.ts` to use correct COD initial status.

### 17.2 Status Priority for Analytics

| Priority | Status | Payment State | Stock State |
|----------|--------|---------------|-------------|
| 1 | `order_placed` | Pending | Reserved |
| 2 | `payment_failed` | Failed | Released |
| 3 | `payment_completed` | Completed (Prepaid) | Ordered |
| 4 | `order_confirmed` | Pending (COD) or Completed (Prepaid) | Ordered |
| 5 | `packed` | Same as above | Ordered |
| 6 | `ready_for_dispatch` | Same as above | Ordered |
| 7 | `shipped` | Same as above | Ordered |
| 8 | `in_transit` | Same as above | Ordered |
| 9 | `out_for_delivery` | Same as above | Ordered |
| 10 | `delivered` | Same as above | Ordered |
| 11 | `cod_payment_received` | Completed (COD) | Ordered |
| 12 | `cancellation_requested` | Pending | Ordered |
| 13 | `cancelled` | Refunded/N/A | Restored |
| 14 | `return_initiated` | Refund Pending | Ordered |
| 15 | `returned` | Refunded | Restored |
| 16 | `rto_initiated` | Refund Pending | Restored |
| 17 | `rto_delivered` | Refunded | Restored |

---

## 1️⃣8️⃣ COD Order Tracking & Payment Management

See Section 16 for COD Order Tracking details. This section was merged into the COD Tracking & Payment Management section.

**Key Points:**
- Use `mode` field to identify COD vs Prepaid orders
- `cod_payment_received_date` tracks when payment was collected
- `cod_transaction_reference` stores EKART/gateway reference
- `cod_amount` for verification and reconciliation
- COD orders should start with `order_confirmed` and `ispaymentsucceed: false`

---

## 1️⃣9️⃣ FAQ

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

**Q9: How do I identify COD orders?**  
A: Use the `mode` field: `SELECT * FROM orders WHERE mode = 'cod'`. Do NOT rely solely on `ispaymentsucceed` flag, as COD orders have `ispaymentsucceed: false` initially and `true` after delivery.

**Q10: When is COD payment tracked?**  
A: COD payment is tracked when:
- EKART sends `COD_COLLECTED` webhook
- Order status changes to `cod_payment_received`
- Manually marked via API endpoint

The `cod_payment_received_date`, `cod_transaction_reference`, and `cod_amount` fields are automatically updated.

**Q11: Can I cancel an order after it's shipped?**  
A: It depends on the shipment status:
- **Not picked up yet:** Yes, cancel via EKART API
- **Already picked up/in transit:** No direct cancellation. Mark as `cancellation_requested` and wait for RTO
- **Delivered:** Cannot cancel. Use return flow instead.

**Q12: What happens to stock when RTO is initiated?**  
A: Stock is restored at `rto_initiated` status, NOT at `rto_delivered`. This is because the item is no longer with the customer once RTO starts.

**Q13: What validations are required before creating EKART shipment?**  
A: See Section 15 for complete validation checklist:
- Order not cancelled
- All orderlines ready for dispatch
- Valid customer address (name, address, city, state, 6-digit pincode, 10-digit phone)
- Weight and dimensions (or template name)
- COD amount matches order amount (for COD orders)

---

## ✅ Summary

### Global Status System

**Orderline Statuses: 17 Total** (Actual Item Lifecycle)
- `order_placed`, `payment_completed`, `payment_failed`, `order_confirmed`
- `packed`, `ready_for_dispatch`, `shipped`, `in_transit`, `out_for_delivery`, `delivered`
- `cod_payment_received`, `cancellation_requested`, `cancelled`, `return_initiated`, `returned`
- `rto_initiated`, `rto_delivered`

**Order Statuses: 17 Total** (Derived from Orderlines)
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
   - ✅ Status history tracking (orderline + order)

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

10. **Status History Tracking:**
   - ✅ Complete audit trail of all status changes
   - ✅ Tracks source of each change (customer, inventoryuser, ekart, warehouse, phonepe, system)
   - ✅ Stores inventory_user_id for inventory user actions
   - ✅ JSONB storage for fast queries
   - ✅ Automatic updates on every status change
   - ✅ Timeline display ready for UI

11. **Industry Standards:**
   - ✅ Matches Amazon/Flipkart standards
   - ✅ Fully normalized status model
   - ✅ Clean separation of business, payment & logistics
   - ✅ Works perfectly with Ekart APIs
   - ✅ Allows future support for multi-box orders, multi-warehouse, multi-shipment

12. **COD Order Tracking:**
   - ✅ Payment mode identification (`mode` field)
   - ✅ COD payment received date tracking
   - ✅ Transaction reference for reconciliation
   - ✅ COD amount verification
   - ✅ Dashboard analytics support
   - ✅ Tax filing support with payment date tracking

13. **EKART Shipment Validation:**
   - ✅ Complete validation before calling EKART API
   - ✅ Order status validation (not cancelled, not already shipped)
   - ✅ All orderlines must be `ready_for_dispatch`
   - ✅ Customer address validation (name, address, city, state, pincode, phone)
   - ✅ Package dimensions/weight validation
   - ✅ COD amount validation for COD orders
   - ✅ Clear error messages for validation failures

14. **GCP Label Storage:**
   - ✅ All labels stored in GCP Cloud Storage
   - ✅ Organized by year/month/order structure
   - ✅ Retention policies (7 years for delivered, 1 year for cancelled)
   - ✅ Signed URLs for secure access
   - ✅ Label reprint capability

15. **Cancellation After Shipment:**
   - ✅ Differentiated handling: not-picked-up vs already-picked-up
   - ✅ EKART AWB cancellation for not-yet-picked-up shipments
   - ✅ `cancellation_requested` intermediate status for in-transit shipments
   - ✅ RTO flow integration for picked-up shipments
   - ✅ Proper stock restoration timing

16. **Return Flow with EKART Integration:**
   - ✅ `return_initiated` triggers EKART Reverse Shipment
   - ✅ `payment_mode: "Pickup"` for reverse shipments
   - ✅ `return_reason` required for EKART API
   - ✅ Stock restoration at `returned` status

**For complete PhonePe payment flow, see:** `PHONEPE_PAYMENT_FLOW_COMPLETE.md`  
**For Ekart integration details, see:** `cursor_tasks/EKART.md`

---

## ✔ Final Notes

This status model is:
- ✅ **Fully normalized**
- ✅ **Matches Amazon/Flipkart standards**
- ✅ **Works perfectly with Ekart APIs**
- ✅ **Clean separation of business, payment & logistics**
- ✅ **Allows future support for multi-box orders, multi-warehouse, multi-shipment**

