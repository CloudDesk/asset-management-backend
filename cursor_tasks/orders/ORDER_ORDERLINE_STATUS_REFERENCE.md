# Order & Orderline Status Reference

**Version 1.0** — December 2024  
*Last Updated: 22 December 2024*

---

## 📋 Overview

This document is the **single source of truth** for all order and orderline statuses in the Nivaana e-commerce platform. It covers the complete lifecycle from payment initiation through delivery, cancellation, and returns.

### Key Principles

- **NO PARTIAL CANCELLATION**: Entire order must be cancelled, not individual items
- **NO CANCELLATION AFTER SHIPMENT**: Use RTO (Return to Origin) flow
- **NO CANCELLATION AFTER DELIVERY**: Use return flow for damaged products only
- **Orderline statuses** drive **Order status** (derived automatically)

---

## 🔄 Complete Status Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHONEPE PAYMENT INITIATION                           │
└─────────────────────────────────────────────────────────────────────────┘
                                │
                    Stock Locked (availableqty ↓, lockqty ↑)
                                │
                ┌───────────────┴───────────────┐
                │                               │
         PhonePe Payment                    COD Payment
                │                               │
        ┌───────┴────────┐                      │
        │                │                      │
    SUCCESS          FAILED              order_placed
        │                │                      │
        │          Lock Released                │
        │         (Cleanup Task)          ← STOCK CONVERTED
        │                                   (lockqty → orderedqty)
        │                                       │
  ← STOCK CONVERTED                      order_confirmed
    (lockqty → orderedqty)                      │
        │                                       │
  payment_completed                             │
        │                                       │
        └────────────────┬─────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    ORDER FULFILLMENT FLOW                               │
└─────────────────────────────────────────────────────────────────────────┘
                         │
                 order_confirmed (system auto-confirms)
                         │
                    packed (warehouse)
                         │
             ready_for_dispatch (warehouse) ← STOCK ALLOCATED (orderedqty → soldqty)
                         │
                    shipped (EKART AWB created)
                         │
                    in_transit (EKART webhook)
                         │
               out_for_delivery (EKART webhook)
                         │
        ┌────────────────┴────────────────┐
        │                                 │
    delivered                         RTO
(EKART webhook)                   (delivery failed)
        │                                 │
cod_payment_received                rto_delivered
   (COD only)                      (back to warehouse)


┌─────────────────────────────────────────────────────────────────────────┐
│                    CANCELLATION FLOW                                    │
└─────────────────────────────────────────────────────────────────────────┘

ALLOWED STATUSES (pre-shipment):
  - order_placed
  - payment_completed
  - order_confirmed
  - packed
  - ready_for_dispatch

                 [CANCEL ORDER]
                     API Call
                         │
            ┌────────────┴────────────┐
            │                         │
      COD Order                  PhonePe Order
            │                         │
    Stock Reversed              Stock Reversed
  orderedqty → available      orderedqty → available
            │                         │
    Order Status:               Order Status:
    cancelled                    cancelled
            │                         │
            │                         │
    AUTO-COMPLETE              MANUAL REFUND
    (immediate)                (admin-driven)
            │                         │
            ▼                         ▼
  cancelled_completed    cancelled_refund_processing
                                     │
                           (Admin processes via PhonePe)
                                     │
                             cancelled_refunded


┌─────────────────────────────────────────────────────────────────────────┐
│                    RETURN FLOW (Post-Delivery)                          │
└─────────────────────────────────────────────────────────────────────────┘

delivered
    │
    │ (Damaged product - customer initiates return)
    │
return_initiated
    │
    │ (Reverse pickup by courier)
    │
returned (stock restored)
```

---

## 📊 Orderline Statuses (Item-Level)

Orderline statuses track the lifecycle of **individual products** in an order.

| Status | Description | Set By | Date Field | Stock Action | EKART | Cancellable? |
|--------|-------------|--------|------------|--------------|-------|--------------|
| **`order_placed`** | Order item created, pending payment | System | `ordereddate` | availableqty ↓, lockqty ↑ | - | ✅ Yes |
| **`payment_completed`** | Payment successful (PhonePe) OR COD accepted | System | `paymentcompleteddate` | lockqty → orderedqty | - | ✅ Yes |
| **`payment_failed`** | PhonePe payment failed | System | `paymentfaileddate` | Release lock (cleanup) | - | N/A |
| **`order_confirmed`** | System auto-confirmed order | System | `orderconfirmeddate` | None | - | ✅ Yes |
| **`packed`** | Item packed by warehouse | Warehouse | `packeddate` | None | - | ✅ Yes |
| **`ready_for_dispatch`** | Ready for pickup, manifest created | Warehouse | `readytodispatchdate` | orderedqty → soldqty | - | ✅ Yes (last chance) |
| **`shipped`** | Shipment picked up/dispatched | **Webhook (EKART)** OR **Manual Status Update** | `shipdate` | None | ✅ AWB/Tracking | ❌ No - Use RTO |
| **`in_transit`** | Package in transit | EKART Webhook | None | None | ✅ Tracking | ❌ No - Use RTO |
| **`out_for_delivery`** | Out for delivery to customer | EKART Webhook | None | None | ✅ Tracking | ❌ No - Use RTO |
| **`delivered`** | Delivered to customer | EKART Webhook | `delivereddate` | None | ✅ POD | ❌ No - Use Return |
| **`cod_payment_received`** | COD payment collected | EKART Webhook | `paymentreceiveddate` | None | ✅ Settlement | N/A |
| **`cancelled`** | Item cancelled, stock restored | System/Customer | `cancelleddate` | ✅ Restore stock | Optional Cancel AWB | N/A |
| **`cancelled_refund_processing`** | Admin processing PhonePe refund | Admin | None | None | - | N/A |
| **`cancelled_refunded`** | Refund completed (PhonePe) | Admin | None | None | - | N/A |
| **`cancelled_completed`** | COD cancellation complete | System | None | None | - | N/A |
| **`return_initiated`** | Customer started return (damaged) | Customer | `returninitiateddate` | None | Optional Reverse | N/A |
| **`returned`** | Item returned, stock restored | EKART Webhook | `returneddate` | ✅ Restore stock | Reverse AWB | N/A |
| **`rto_initiated`** | Return to origin started | EKART Webhook | None | ✅ Restore stock | RTO Tracking | N/A |
| **`rto_delivered`** | RTO delivered to warehouse | EKART Webhook | None | None | RTO Complete | N/A |

---

## 📦 Order Statuses (Order-Level - Derived)

Order status is **always derived** from orderline statuses. **Never manually set**.

| Status | Meaning | How Derived |
|--------|---------|-------------|
| **`order_placed`** | Order created, payment pending | All orderlines = `order_placed` |
| **`payment_completed`** | Payment done (PhonePe) OR COD accepted | All orderlines = `payment_completed` |
| **`payment_failed`** | Payment failed | Any orderline = `payment_failed` |
| **`order_confirmed`** | Order confirmed by system | All orderlines = `order_confirmed` |
| **`packed`** | All items packed | All orderlines = `packed` |
| **`ready_for_dispatch`** | All items ready | All orderlines = `ready_for_dispatch` |
| **`shipped`** | All items shipped (single AWB) | All orderlines = `shipped` |
| **`in_transit`** | All items in transit | All orderlines = `in_transit` |
| **`out_for_delivery`** | All items out for delivery | All orderlines = `out_for_delivery` |
| **`delivered`** | All items delivered | All orderlines = `delivered` |
| **`cod_payment_received`** | COD payment collected (all items) | All orderlines = `cod_payment_received` |
| **`cancelled`** | All items cancelled | All orderlines = `cancelled` |
| **`cancelled_refund_processing`** | Refund being processed | All orderlines = `cancelled_refund_processing` |
| **`cancelled_refunded`** | Refund completed | All orderlines = `cancelled_refunded` |
| **`cancelled_completed`** | COD cancellation complete | All orderlines = `cancelled_completed` |
| **`return_initiated`** | Return started | Any orderline = `return_initiated` |
| **`returned`** | All items returned | All orderlines = `returned` |
| **`rto_initiated`** | RTO started | Any orderline = `rto_initiated` |
| **`rto_delivered`** | RTO complete | All orderlines = `rto_delivered` |

---

## 🔐 Stock Quantity Changes by Status

### PhonePe Initiation
**PlatformStock:**
```
availableqty ↓ (reduced by quantity)
lockqty ↑ (increased by quantity)
orderedqty → no change
```

**Product:**
```
No changes (stock reserved in platformstock only)
```

---

### PhonePe Callback (Success) / COD Order Creation
**PlatformStock:**
```
availableqty → no change (already reduced)
lockqty ↓ to 0 (released)
orderedqty ↑ (increased by quantity)
platformstatus → recalculated (out_of_stock/low_stock/in_stock)
```

**Product:**
```
orderedquantity ↑ (increased by quantity)
availablequantity ↓ (reduced by quantity)
productstatus → recalculated (out_of_stock/low_stock/in_stock)
```

---

### Ready for Dispatch (Stock Allocation)
**PlatformStock:**
```
orderedqty ↓ (reduced)
soldqty ↑ (increased)
availableqty → no change
```

**Product:**
```
orderedquantity ↓ (reduced)
soldquantity ↑ (increased)
availablequantity → no change
```

**Stock Table:**
```
stockstatus → 'sold'
orderid → order ID
orderlinenumber → orderline ID
solddate → current timestamp
```

---

### Cancellation (Pre-Ready-for-Dispatch)
**PlatformStock:**
```
availableqty ↑ (add back quantity)
orderedqty ↓ (subtract quantity)
soldqty → no change
platformstatus → recalculated
```

**Product:**
```
availablequantity ↑ (add back quantity)
orderedquantity ↓ (subtract quantity)
soldquantity → no change
productstatus → recalculated
```

---

### Cancellation (Post-Ready-for-Dispatch)
**PlatformStock:**
```
availableqty ↑ (add back quantity)
soldqty ↓ (subtract quantity)
orderedqty → no change
platformstatus → recalculated
```

**Product:**
```
availablequantity ↑ (add back quantity)
soldquantity ↓ (subtract quantity)
orderedquantity → no change
productstatus → recalculated
```

**Stock Table:**
```
stockstatus → 'Available'
orderid → null
orderlinenumber → null
solddate → null
```

---

### Return / RTO (Stock Restoration)
Same as "Cancellation (Post-Ready-for-Dispatch)" above.

---

## 🚫 Cancellation Rules

### ✅ **ALLOWED STATUSES** (Entire Order Only)

Cancellation is **ONLY** permitted for orders in these statuses:
- `order_placed`
- `payment_completed`
- `order_confirmed`
- `packed`
- `ready_for_dispatch`

### ❌ **NOT ALLOWED STATUSES**

| Status | Why Not Allowed | Alternative |
|--------|-----------------|-------------|
| `shipped` | Package picked up by courier | RTO (Return to Origin) |
| `in_transit` | Package in transit | RTO |
| `out_for_delivery` | Out for delivery | RTO |
| `delivered` | Already delivered | Return (damaged only) |

### ⚠️ **CRITICAL: NO PARTIAL CANCELLATION**

- ✅ **Allowed**: Cancel entire order (all orderlines)
- ❌ **NOT Allowed**: Cancel individual products
- **Reason**: Simplifies logistics, stock management, and refund processing

---

## 💰 Payment & Refund Flow

### COD Orders

```
Order Cancelled (any allowed status)
    ↓
Transaction updated: order_status = "ORDER_CANCELLED"
    ↓
Order status → cancelled
    ↓
AUTOMATIC (end of all services)
    ↓
Transaction updated: order_status = "CANCELLATION_COMPLETED"
    ↓
Order status → cancelled_completed
    ↓
✅ DONE (no refund needed)
```

---

### PhonePe Orders

```
Order Cancelled (any allowed status)
    ↓
Transaction updated: order_status = "CANCELLED_AWAITING_REFUND"
    ↓
Order status → cancelled
    ↓
Admin logs into PhonePe portal
    ↓
Admin initiates refund
    ↓
Admin updates via API: PATCH /v1/orders/:id/refund-status
    ↓
Transaction updated: order_status = "REFUND_PROCESSING"
    ↓
Order status → cancelled_refund_processing
    ↓
PhonePe processes refund (5-7 business days)
    ↓
Admin confirms completion via API
    ↓
Transaction updated: order_status = "REFUNDED"
    ↓
Order status → cancelled_refunded
    ↓
✅ DONE
```

---

## 🔄 Return Flow (Post-Delivery)

**Applies To**: Damaged products only  
**Timeline**: After delivery (`delivered` status)

### Return Statuses

1. **`return_initiated`**
   - Customer reports damaged product
   - Reverse pickup scheduled
   - Stock: No change yet

2. **`returned`**
   - Item received at warehouse
   - Quality check confirms damage
   - **Stock Restored**: soldqty ↓, availableqty ↑
   - Status updated in `stock` table
   - Product/PlatformStock status recalculated

### Return API Flow

```
POST /v1/orders/:id/return
{
  "userid": 456,
  "return_reason": "damaged_product",
  "description": "Product arrived broken"
}

Response:
{
  "success": true,
  "order_status": "return_initiated",
  "message": "Return request submitted"
}
```

---

## 📍 Status History Tracking

All status changes are recorded in `status_history` JSONB field:

```json
{
  "status_history": [
    {
      "status": "order_placed",
      "timestamp": 1734682800000,
      "source": "customer",
      "is_active": false
    },
    {
      "status": "payment_completed",
      "timestamp": 1734682900000,
      "source": "phonepe_callback",
      "is_active": false
    },
    {
      "status": "cancelled",
      "timestamp": 1734683000000,
      "source": "customer",
      "reason": "Changed my mind",
      "is_active": true
    }
  ]
}
```

**Fields:**
- `status`: Current status value
- `timestamp`: When status changed
- `source`: Who/what triggered the change
- `is_active`: `true` for current status, `false` for historical
- `reason`: Optional reason (cancellations, returns)
- `notes`: Optional admin notes (manual refund updates)

---

## 🔗 API Endpoints Summary

### Cancellation
```typescript
POST /v1/orders/:id/cancel
{
  "userid": 456,
  "cancellation_reason": "Changed my mind"
}
```

### Refund Status Update (Admin Only)
```typescript
PATCH /v1/orders/:id/refund-status
{
  "status": "cancelled_refund_processing" | "cancelled_refunded" | "cancelled_completed",
  "admin_user_id": 123,
  "notes": "Refund processed via PhonePe portal"
}
```

### Return Initiation
```typescript
POST /v1/orders/:id/return
{
  "userid": 456,
  "return_reason": "damaged_product",
  "description": "Product broken on arrival"
}
```

---

## 📚 Related Documentation

- [PHONEPE_PAYMENT_IMPLEMENTATION_GUIDE.md](./PHONEPE_PAYMENT_IMPLEMENTATION_GUIDE.md) - Payment flow details
- [ORDER_CANCELLATION_FLOW.md](./ORDER_CANCELLATION_FLOW.md) - Detailed cancellation logic
- [ORDER_ORDERLINE_LIFECYCLE_COMPLETE.md](./ORDER_ORDERLINE_LIFECYCLE_COMPLETE.md) - Complete lifecycle
- [ORDER_ORDERLINE_FIELDS_MASTER_REFERENCE.md](./ORDER_ORDERLINE_FIELDS_MASTER_REFERENCE.md) - Field definitions

---

## ⚠️ Important Reminders

1. ✅ **Order status is ALWAYS derived** - Never manually set
2. ❌ **NO partial cancellation** - Entire order only
3. ❌ **NO cancellation after shipment** - Use RTO instead
4. ❌ **NO cancellation after delivery** - Use return for damaged products
5. ✅ **Status history is immutable** - Append only, never delete
6. ✅ **Stock restoration is automatic** - Handled by service layer
7. ✅ **Transaction table tracking** - All cancellations/refunds logged
8. ✅ **Admin refunds are manual** - PhonePe portal + API update
9. ✅ **COD refunds are auto-completed** - No admin action needed

---

*Document Version: 1.0*  
*Last Updated: 22 December 2024*  
*Status: Production Ready*



## 📡 EKART Webhook Status Mapping

**Endpoint:** `POST /v1/ekart/webhook/track-status`

### Status Ownership & Control

| Status             | Who Controls It | Method | Why                 |
| ------------------ | --------------- | ------ | ------------------- |
| order_placed       | System          | Order creation | Customer action     |
| order_confirmed    | System          | Auto-confirmation | Payment/validation  |
| ready_for_dispatch | **YOU**         | `PATCH /v1/orders/:id/ready-for-dispatch` | Packing & labeling  |
| shipped            | **EKART Webhook** | `POST /v1/ekart/webhook/track-status` | Pickup confirmed (first webhook) |
| in_transit         | EKART Webhook   | `POST /v1/ekart/webhook/track-status` | Linehaul movement   |
| out_for_delivery   | EKART Webhook   | `POST /v1/ekart/webhook/track-status` | Last-mile           |
| delivered          | EKART Webhook   | `POST /v1/ekart/webhook/track-status` | POD                 |
| cod_payment_received | EKART Webhook | `POST /v1/ekart/webhook/track-status` | Cash reconciliation |
| rto_initiated      | EKART Webhook   | `POST /v1/ekart/webhook/track-status` | Delivery failed     |
| rto_delivered      | EKART Webhook   | `POST /v1/ekart/webhook/track-status` | RTO complete        |

### EKART Webhook Status Mapping

**Webhook receives:** Original EKART status (various formats)  
**System stores:** Original in `shipment_tracking_status`, mapped in `orderstatus`

| EKART Webhook Status (Original) | Mapped System Status | Notes |
|----------------------------------|---------------------|-------|
| `"Shipped"`, `"SHIPPED"`, `"shipped"` | `shipped` | Case-insensitive |
| `"Pick Up"`, `"Pick Up"`, `"Picked Up"`, `"picked-up"` | `shipped` | All pickup variations |
| `"In Transit"`, `"IN TRANSIT"`, `"in-transit"` | `in_transit` | Case-insensitive |
| `"Out For Delivery"`, `"OUT FOR DELIVERY"` | `out_for_delivery` | Case-insensitive |
| `"Delivered"`, `"DELIVERED"` | `delivered` | Case-insensitive |
| `"COD Collected"`, `"COD_COLLECTED"` | `cod_payment_received` | Case-insensitive |
| `"RTO Initiated"`, `"RTO_INITIATED"` | `rto_initiated` | Case-insensitive |
| `"RTO Delivered"`, `"RTO_DELIVERED"` | `rto_delivered` | Case-insensitive |

### Webhook Processing Flow

1. **HMAC Verification** - Verifies webhook authenticity
2. **Order Lookup** - Finds order by `tracking_id` (wbn from webhook)
3. **Vendor Check** - Only processes EKART orders (ignores manual vendors)
4. **Status Mapping** - Maps EKART status to system status (handles all variations)
5. **Database Updates:**
   - `shipment_tracking_status` ← Original EKART status
   - `orderstatus` ← Mapped system status
   - All orderlines `orderstatus` ← Same as order
   - `status_history` (order + orderlines) ← Complete entry with:
     - `source`: `'ekart'`
     - `location`: webhookPayload.location
     - `description`: webhookPayload.desc
     - `ekart_original_status`: Original EKART status
6. **Timestamp Updates:**
   - `shipped` → Sets `shipdate` (from pickupTime)
   - `delivered` → Sets `delivereddate`
   - `cod_payment_received` → Sets `cod_payment_received_date`

### Important Notes

- ✅ **`shipped` status is set by webhook** - First webhook after pickup confirms shipment
- ✅ **All status variations handled** - Case-insensitive, handles spaces/underscores/hyphens
- ✅ **Original status preserved** - Stored in `shipment_tracking_status` for reference
- ✅ **Manual vendors ignored** - Webhook only processes EKART orders
- ✅ **Idempotent** - Same status update is safe (no duplicate changes)

### Unknown/Unconfigured Status Handling

**When EKART sends a status that is NOT in our mapping:**

| Action | Behavior |
|--------|----------|
| `shipment_tracking_status` | ✅ Updated with original EKART status |
| `orderstatus` | ❌ **NOT updated** - Current status preserved |
| Orderline `orderstatus` | ❌ **NOT updated** - Current status preserved |
| `status_history` | ✅ Entry added with:
  - `is_active`: `false` (does NOT affect status flow)
  - `is_webhook_status`: `true` (marked as webhook status)
  - `ekart_original_status`: Original unknown status
  - `description`: `"Unknown EKART status: {status}"`
  - `webhook_payload`: Full original webhook payload (all fields from EKART)
  - `previous_status` = `new_status` = current orderstatus (no change) |

**Example:**
If EKART sends `"Custom Status"` or `"Pending Review"` (not in our mapping):
- `shipment_tracking_status` = `"Custom Status"`
- `orderstatus` = `"shipped"` (unchanged)
- `status_history` entry:
  ```json
  {
    "previous_status": "shipped",
    "new_status": "shipped",
    "changed_date": 1234567890000,
    "source": "ekart",
    "ekart_original_status": "Custom Status",
    "description": "Unknown EKART status: Custom Status",
    "is_active": false,
    "is_webhook_status": true,
    "webhook_payload": {
      "wbn": "FMPC001234567890",
      "status": "Custom Status",
      "location": "Mumbai Hub",
      "desc": "Custom status description",
      "ctime": 1234567890000,
      "pickupTime": 1234567891000,
      "attempts": "0",
      "id": "internal_ref",
      "orderNumber": "ORD-1234567890",
      "edd": 1234568000000
    }
  }
  ```

**Why this approach:**
- ✅ Preserves status flow integrity (only configured statuses change order status)
- ✅ Tracks all webhook events in history (for debugging/auditing)
- ✅ Allows future mapping additions without data loss
- ✅ Prevents unknown statuses from breaking order workflow
