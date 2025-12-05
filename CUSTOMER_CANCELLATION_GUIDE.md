# Customer Cancellation Guide - Complete Steps

**Date:** January 2025

## 📋 Overview

This document explains how customers can cancel their orders/orderlines and what happens during the cancellation process.

---

## ✅ Available Routes for Customer Cancellation

### 1. **Cancel Orderline** (Recommended)

**Route:** `PATCH /v1/orderlines/:id/cancel`

**Status:** ✅ **Available for Customers**

**Location:** `src/routes/orderline.route.ts:119`

**Request:**
```http
PATCH /v1/orderlines/:id/cancel
Content-Type: application/json
```

**Request Body:**
```json
{
  "reason": "Changed my mind",
  "additionalData": {
    "source": "customer",
    "cancelled_by": "user_123",
    "notes": "Customer requested cancellation"
  }
}
```

**Response (200):**
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
    "cancellation_reason": "Changed my mind",
    "status_history": [
      {
        "previous_status": "payment_completed",
        "new_status": "cancelled",
        "changed_date": 1701234567890,
        "source": "customer"
      }
    ]
  }
}
```

---

## 🔄 Complete Cancellation Flow

### Step-by-Step Process

```
1. Customer Initiates Cancellation
   ↓
   PATCH /v1/orderlines/:id/cancel
   {
     "reason": "Changed my mind",
     "additionalData": {
       "source": "customer"
     }
   }
   ↓
2. System Checks for EKART Shipment
   ↓
   - Finds order by orderline.orderid
   - Checks if order.tracking_id exists
   ↓
3. Cancel EKART Shipment (if exists)
   ↓
   - Calls DELETE /v1/ekart/shipments/:trackingId/cancel
   - Logs success or warning (continues even if fails)
   ↓
4. Update Orderline Status
   ↓
   - Sets orderstatus = "cancelled"
   - Sets cancelleddate = current timestamp
   - Updates status_history
   ↓
5. Restore Stock Quantities
   ↓
   - Updates Product table:
     * availablequantity ↑ (increased)
     * orderedquantity ↓ (decreased)
   - Updates PlatformStock table:
     * availableqty ↑ (increased)
     * orderedqty ↓ (decreased)
   - Recalculates productstatus/platformstatus
   ↓
6. Recalculate Order Status
   ↓
   - Fetches all orderlines for the order
   - Calculates new order status:
     * If all orderlines cancelled → "cancelled"
     * If some orderlines cancelled → "partially_cancelled"
     * Otherwise → Uses lowest common status
   - Updates order.status_history
   ↓
7. Return Response to Customer
```

---

## 📝 Detailed Implementation

### What Happens During Cancellation

#### 1. **EKART Shipment Cancellation** (If Applicable)

**When:** Order has `tracking_id` (shipment created)

**Action:**
```typescript
// Automatically handled in OrderlineService.updateOrderlineStatus()
if (status === 'cancelled' && order.tracking_id) {
  try {
    await ekartService.cancelShipment(order.tracking_id);
    // Success - EKART shipment cancelled
  } catch (error) {
    // Warning logged, but cancellation continues
    // Orderline will still be cancelled even if EKART cancellation fails
  }
}
```

**Note:** 
- ✅ EKART cancellation is attempted first
- ✅ If EKART cancellation fails, orderline cancellation still proceeds
- ✅ Stock is restored regardless of EKART cancellation result

#### 2. **Orderline Status Update**

**Fields Updated:**
- `orderstatus` → `"cancelled"`
- `cancelleddate` → Current timestamp
- `status_history` → New entry added:
  ```json
  {
    "previous_status": "payment_completed",
    "new_status": "cancelled",
    "changed_date": 1701234567890,
    "source": "customer"
  }
  ```
- `modifieddate` → Current timestamp
- `cancellation_reason` → From request body

#### 3. **Stock Restoration**

**Product Table:**
```sql
UPDATE product
SET availablequantity = availablequantity + cancelled_quantity,
    orderedquantity = orderedquantity - cancelled_quantity,
    productstatus = CASE
      WHEN availablequantity <= 0 THEN 'out_of_stock'
      WHEN availablequantity <= 5 THEN 'low_stock'
      ELSE 'in_stock'
    END
WHERE id = product_id;
```

**PlatformStock Table:**
```sql
UPDATE platformstock
SET availableqty = availableqty + cancelled_quantity,
    orderedqty = orderedqty - cancelled_quantity,
    platformstatus = CASE
      WHEN availableqty <= 0 THEN 'out_of_stock'
      WHEN availableqty <= 5 THEN 'low_stock'
      ELSE 'in_stock'
    END
WHERE productid = product_id AND platform = 'nivapp';
```

#### 4. **Order Status Recalculation**

**Logic:**
- Fetches all orderlines for the order
- Counts cancelled orderlines
- Updates order status:
  - All cancelled → `"cancelled"`
  - Some cancelled → `"partially_cancelled"`
  - None cancelled → Uses aggregation rules

**Status History:**
- Order `status_history` is automatically updated when order status changes

---

## 🎯 Customer Cancellation Scenarios

### Scenario 1: Cancel Before Shipment Created

**Order Status:** `ready_for_dispatch` or earlier

**Process:**
1. ✅ Cancel orderline
2. ✅ Restore stock
3. ✅ No EKART action needed (no tracking_id yet)

**Result:**
- Orderline: `cancelled`
- Order: `cancelled` or `partially_cancelled`
- Stock: Restored

---

### Scenario 2: Cancel After Shipment Created (Before Pickup)

**Order Status:** `ready_for_dispatch` (shipment created, label not printed yet)

**Process:**
1. ✅ Attempt to cancel EKART shipment
2. ✅ Cancel orderline
3. ✅ Restore stock

**Result:**
- EKART shipment: Cancelled (if successful)
- Orderline: `cancelled`
- Order: `cancelled` or `partially_cancelled`
- Stock: Restored

---

### Scenario 3: Cancel After Label Printed (In Transit)

**Order Status:** `shipped` or `in_transit`

**Process:**
1. ⚠️ Attempt to cancel EKART shipment (may fail if already in transit)
2. ✅ Cancel orderline (proceeds even if EKART cancellation fails)
3. ✅ Restore stock

**Result:**
- EKART shipment: May or may not be cancelled (depends on EKART status)
- Orderline: `cancelled`
- Order: `cancelled` or `partially_cancelled`
- Stock: Restored
- **Note:** If EKART cancellation fails, EKART will handle RTO automatically

---

## 📊 API Examples

### Example 1: Cancel Single Orderline

```bash
curl -X PATCH http://localhost:5600/v1/orderlines/789/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Changed my mind",
    "additionalData": {
      "source": "customer",
      "cancelled_by": "user_123"
    }
  }'
```

### Example 2: Cancel Multiple Orderlines (Same Order)

```bash
# Cancel first orderline
curl -X PATCH http://localhost:5600/v1/orderlines/789/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason": "Not needed", "additionalData": {"source": "customer"}}'

# Cancel second orderline
curl -X PATCH http://localhost:5600/v1/orderlines/790/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason": "Not needed", "additionalData": {"source": "customer"}}'
```

**Result:**
- If all orderlines cancelled → Order status: `"cancelled"`
- If some orderlines cancelled → Order status: `"partially_cancelled"`

---

## ⚠️ Important Notes

1. **Stock Restoration:**
   - ✅ Stock is **always restored** when orderline is cancelled
   - ✅ Works for both Product and PlatformStock tables
   - ✅ Product status is automatically recalculated

2. **EKART Integration:**
   - ✅ EKART shipment cancellation is attempted automatically
   - ✅ If EKART cancellation fails, orderline cancellation still proceeds
   - ✅ Stock is restored regardless of EKART cancellation result

3. **Order Status:**
   - ✅ Order status is automatically recalculated after orderline cancellation
   - ✅ Status history is updated for both orderline and order

4. **Partial Cancellation:**
   - ✅ Customer can cancel individual orderlines
   - ✅ Order status becomes `"partially_cancelled"` if some (but not all) orderlines are cancelled
   - ✅ Order status becomes `"cancelled"` if all orderlines are cancelled

5. **Cancellation After Shipping:**
   - ⚠️ If order is already shipped (`shipped`, `in_transit`), EKART cancellation may fail
   - ✅ Orderline cancellation still proceeds and stock is restored
   - ✅ EKART will handle RTO automatically if cancellation fails

---

## 🔗 Related Routes

| Route | Method | Purpose | Status |
|-------|--------|---------|--------|
| **Cancel Orderline** | `PATCH /v1/orderlines/:id/cancel` | Cancel individual orderline | ✅ Available |
| **Update Orderline Status** | `PATCH /v1/orderlines/:id/status` | Update orderline status (generic) | ✅ Available |
| **Get Orderlines** | `GET /v1/orderlines` | Get orderlines (filter by orderid) | ✅ Available |
| **Track Order** | `GET /v1/orders/:id/track` | Track order by order ID | ✅ Available |

---

## 📝 Request/Response Examples

### Success Response

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
    "cancellation_reason": "Changed my mind",
    "status_history": [
      {
        "previous_status": "payment_completed",
        "new_status": "cancelled",
        "changed_date": 1701234567890,
        "source": "customer"
      }
    ],
    "modifieddate": 1701234567890
  }
}
```

### Error Response (Orderline Not Found)

```json
{
  "success": false,
  "message": "Orderline with ID 999 not found",
  "statusCode": 404
}
```

---

## 🎯 Summary

**Customer Cancellation Route:**
- ✅ `PATCH /v1/orderlines/:id/cancel` - **Available and Ready**

**Features:**
- ✅ Automatic EKART shipment cancellation (if applicable)
- ✅ Automatic stock restoration
- ✅ Automatic order status recalculation
- ✅ Status history tracking
- ✅ Supports partial cancellation

**Steps:**
1. Customer calls `PATCH /v1/orderlines/:id/cancel` with reason
2. System cancels EKART shipment (if exists)
3. System cancels orderline and restores stock
4. System recalculates order status
5. Response returned to customer

---

**End of Document**

