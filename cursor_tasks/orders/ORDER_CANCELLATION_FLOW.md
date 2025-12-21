# Order Cancellation Flow

**Version 1.0** — December 2024  
*Last Updated: 20 December 2024*

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

## 📝 Implementation Notes

1. **Atomic Operations**: All cancellation logic wrapped in database transaction
2. **Idempotency**: Cancelling an already cancelled order returns current state (no error)
3. **Refund Handling**: Cancellation triggers refund process (separate flow, not covered here)
4. **Notification**: Customer receives push notification + email on cancellation
5. **Analytics**: Track cancellation reasons for business insights
6. **Audit Trail**: Complete status history maintained for both order and orderlines

---

## 🔗 Related Documentation

- [ORDER_ORDERLINE_LIFECYCLE_COMPLETE.md](./ORDER_ORDERLINE_LIFECYCLE_COMPLETE.md) - Complete order lifecycle
- [PHONEPE_PAYMENT_IMPLEMENTATION_GUIDE.md](./PHONEPE_PAYMENT_IMPLEMENTATION_GUIDE.md) - Order creation flow
- [ORDER_ORDERLINE_FIELDS_MASTER_REFERENCE.md](./ORDER_ORDERLINE_FIELDS_MASTER_REFERENCE.md) - Field definitions

---

## ⚠️ Important Reminders

- ❌ **No Partial Cancellation**: Entire order is cancelled, not individual products
- ❌ **No Post-Shipment Cancellation**: Use RTO flow for shipped orders
- ✅ **Customer Ownership**: Always verify userid matches order owner
- ✅ **Stock Restoration**: Different logic for pre/post ready-for-dispatch
- ✅ **Status History**: Track who cancelled (customer vs admin) with reason

---

*Document Version: 1.0*  
*Last Updated: 20 December 2024*
