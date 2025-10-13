# Order Cancellation Flow - Complete Analysis

## 📋 Overview
This document provides a comprehensive analysis of what happens when an order is cancelled in the Asset Management system.

## 🔄 Cancellation Flow Diagram

```
User/Admin Cancels Order
         ↓
PATCH /v1/orders/:id/status (status = "cancelled")
         ↓
OrdersController.updateOrderStatus()
         ↓
OrdersService.updateOrderStatus()
         ↓
[Multiple Operations Execute]
```

## 📍 Entry Points

### 1. Order-Level Cancellation
**Endpoint:** `PATCH /v1/orders/:id/status`

**Request:**
```json
{
  "status": "cancelled",
  "additionalData": {
    "cancellation_reason": "Customer requested"
  }
}
```

**File:** `src/routes/orders.route.ts` → `ordersController.updateOrderStatus`

### 2. Orderline-Level Cancellation
**Endpoint:** `PATCH /v1/orderlines/:id/cancel` or `PATCH /v1/orderlines/:id/status`

**Request:**
```json
{
  "reason": "Product unavailable",
  "additionalData": {...}
}
```

**File:** `src/routes/orderline.route.ts` → `orderlineController.cancelOrderline`

---

## ✅ What Happens During Order Cancellation

### 1. **Order Status Update** (`src/services/orders.service.ts`)

```typescript
async updateOrderStatus(id: string, status: "cancelled", additionalData?) {
  // Updates performed:
  const updateData = {
    orderstatus: "cancelled",          // Set order status
    cancelleddate: Date.now(),         // Set cancellation timestamp
    modifieddate: Date.now(),          // Update modified date
    ...additionalData                  // Any additional fields
  };
  
  await this.update(id, updateData);
}
```

**Fields Updated:**
- ✅ `orderstatus` → "cancelled"
- ✅ `cancelleddate` → Current timestamp
- ✅ `modifieddate` → Current timestamp
- ✅ Any additional data (cancellation reason, notes, etc.)

**Note:** ⚠️ **Order-level cancellation does NOT automatically:**
- Cancel individual orderlines
- Restore stock quantities
- Process refunds
- Update promotions

---

### 2. **Orderline Cancellation** (`src/services/orderline.service.ts`)

When orderlines are cancelled (individually or as part of order cancellation):

```typescript
async updateOrderlineStatus(id: string, status: "cancelled", additionalData?) {
  // Step 1: Update orderline status
  const updateData = {
    orderstatus: "cancelled",
    cancelleddate: Date.now(),
    modifieddate: Date.now(),
    ...additionalData
  };
  
  // Step 2: Adjust product quantities
  await this.adjustProductQuantitiesOnCancellation(orderline);
  
  await this.update(id, updateData);
}
```

**Fields Updated:**
- ✅ `orderstatus` → "cancelled"
- ✅ `cancelleddate` → Current timestamp
- ✅ `modifieddate` → Current timestamp
- ✅ `cancellation_reason` (if provided)

---

### 3. **Product Inventory Restoration** (`src/services/orderline.service.ts`)

**CRITICAL:** Stock is ONLY restored when **orderlines** are cancelled, not orders!

```typescript
private async adjustProductQuantitiesOnCancellation(orderline: any) {
  const productId = orderline.productid;
  const cancelledQuantity = orderline.quantity || 1;
  
  // Get current product
  const product = await dynamicFindUnique('product', { id: productId });
  
  // Calculate new quantities
  const newOrderedQuantity = Math.max(0, 
    (product.orderedquantity || 0) - cancelledQuantity
  );
  const newAvailableQuantity = 
    (product.availablequantity || 0) + cancelledQuantity;
  
  // Determine product status
  let newProductStatus;
  if (newAvailableQuantity <= 0) {
    newProductStatus = "out_of_stock";
  } else if (newAvailableQuantity >= 1 && newAvailableQuantity <= 5) {
    newProductStatus = "low_stock";
  } else {
    newProductStatus = "in_stock";
  }
  
  // Update product
  await dynamicUpdate('product', { id: productId }, {
    orderedquantity: newOrderedQuantity,
    availablequantity: newAvailableQuantity,
    productstatus: newProductStatus,
    modifieddate: Date.now()
  });
}
```

**Inventory Adjustments:**

**Product Table:**
- ✅ **Decrease** `orderedquantity` by cancelled quantity
- ✅ **Increase** `availablequantity` by cancelled quantity
- ✅ **Update** `productstatus` based on available quantity:
  - `newAvailableQuantity <= 0` → "out_of_stock"
  - `1 <= newAvailableQuantity <= 5` → "low_stock"
  - `newAvailableQuantity > 5` → "in_stock"

**PlatformStock Table (NIVAPP):**
- ✅ **Decrease** `orderedqty` by cancelled quantity
- ✅ **Increase** `availableqty` by cancelled quantity
- ✅ **Update** `platformstatus` based on available quantity:
  - `newAvailableQty <= 0` → "out_of_stock"
  - `1 <= newAvailableQty <= 5` → "low_stock"
  - `newAvailableQty > 5` → "in_stock"

---

### 4. **Refund Processing** (Manual Process)

**Endpoint:** `POST /v1/phonepe/refund/:merchantTransactionId`

**File:** `src/controllers/phonepe.controller.ts` → `processRefund`

```typescript
async processRefund(merchantTransactionId, refundAmount?, reason?) {
  // Step 1: Get original transaction
  const transaction = await transactionService.findByMerchantId(merchantTransactionId);
  
  // Step 2: Initiate PhonePe refund
  const refundId = `REFUND-${Date.now()}-${merchantTransactionId}`;
  const response = await phonePeAPI.refund({
    merchantTransactionId: refundId,
    originalTransactionId: merchantTransactionId,
    amount: refundAmount || transaction.amount,
    // ... PhonePe payload
  });
  
  // Step 3: Create refund transaction record
  await transactionService.create({
    transactionid: refundId,
    merchanttransactionid: refundId,
    amount: refundAmount,
    transactionfor: 'refund',
    transactiondata: {
      status: 'REFUND_INITIATED',
      originalTransactionId: merchantTransactionId,
      reason
    }
  });
}
```

**Refund Details:**
- ⚠️ **NOT automatic** - requires separate API call
- ✅ Creates new transaction record with `transactionfor: 'refund'`
- ✅ Links to original transaction via `originalTransactionId`
- ✅ Stores refund status: `REFUND_INITIATED`, `REFUND_SUCCESS`, `REFUND_FAILED`
- ✅ Integrates with PhonePe payment gateway

---

### 5. **Promotion/Evaluation Handling** (Currently Limited)

**Current State:**
- ❌ Evaluations are NOT automatically cancelled when order is cancelled
- ❌ Promotion redemptions are NOT automatically reversed
- ✅ Evaluations can be manually cancelled via `cancelAllActiveEvaluationsForUser()`

**Available Methods:**
```typescript
// src/services/promotion-evaluation.service.ts

// Cancel all active evaluations for a user
async cancelAllActiveEvaluationsForUser(userId: string) {
  await prisma.promotion_evaluations.updateMany({
    where: {
      user_id: userId,
      status: 'active'
    },
    data: {
      status: 'cancelled',
      modifieddate: Date.now()
    }
  });
}
```

**Database Fields:**
- `orders.evaluation_id` - Links order to promotion evaluation
- `promotion_evaluations.status` - "active", "redeemed", "cancelled", "expired"
- `promotion_redemptions` - Tracks promotion usage

---

## 🔍 Current Limitations & Gaps

### ❌ What Does NOT Happen Automatically:

1. **Orderline Cancellation**
   - Order-level cancellation does NOT cancel orderlines
   - Must cancel each orderline separately

2. **Stock Restoration**
   - Only happens for orderline cancellation
   - Order-level cancellation does NOT restore stock

3. **Refund Processing**
   - Must be triggered manually via separate API call
   - Not part of order cancellation flow

4. **Promotion Reversal**
   - Evaluations remain active
   - Redemptions are not reversed
   - Promotion usage counts not decremented

5. **Platform Stock Updates**
   - ✅ `platformstock` (NIVAPP) automatically updated when orderline cancelled
   - ❌ `lockqty` (locked quantity) not released automatically

6. **Stock Status Updates**
   - Individual stock items (with SKU/RFID) not updated
   - `stockstatus` remains unchanged

7. **Email Notifications**
   - No automatic email to customer about cancellation
   - No notification to admin/warehouse

8. **Analytics/Reporting**
   - Cancelled orders still count in sales metrics
   - No separate cancellation tracking

---

## 🎯 Recommended Complete Cancellation Flow

### **Scenario 1: Full Order Cancellation**

```javascript
// Step 1: Cancel all orderlines
const order = await ordersService.findById(orderId);
for (const orderline of order.orderlines) {
  await orderlineService.updateOrderlineStatus(
    orderline.id, 
    'cancelled',
    { cancellation_reason: 'Order cancelled by customer' }
  );
  // This automatically restores stock
}

// Step 2: Cancel order
await ordersService.updateOrderStatus(orderId, 'cancelled', {
  cancellation_reason: 'Customer requested',
  cancelled_by: userId
});

// Step 3: Process refund (if payment succeeded)
if (order.ispaymentsucceed) {
  await phonePeService.refundPayment(
    order.merchanttransactionid,
    order.orderamount,
    'Order cancellation refund'
  );
}

// Step 4: Cancel promotion evaluation (if used)
if (order.evaluation_id) {
  await promotionEvaluationService.cancelEvaluation(order.evaluation_id);
  // TODO: Reverse promotion redemptions
}

// Step 5: Send notification email
await emailService.sendOrderCancellationEmail(
  user.email,
  order,
  'Your order has been cancelled'
);
```

### **Scenario 2: Partial Order Cancellation (Single Item)**

```javascript
// Step 1: Cancel specific orderline
await orderlineService.updateOrderlineStatus(
  orderlineId, 
  'cancelled',
  { cancellation_reason: 'Product unavailable' }
);
// Stock automatically restored

// Step 2: Recalculate order amounts
const remainingOrderlines = await orderlineService.findByOrderId(orderId);
const newOrderAmount = remainingOrderlines
  .filter(ol => ol.orderstatus !== 'cancelled')
  .reduce((sum, ol) => sum + ol.lineamount, 0);

await ordersService.update(orderId, {
  orderamount: newOrderAmount,
  // Update other amounts as needed
});

// Step 3: Process partial refund
const refundAmount = cancelledOrderline.lineamount;
await phonePeService.refundPayment(
  order.merchanttransactionid,
  refundAmount,
  'Partial refund - item cancelled'
);
```

---

## 📊 Database Tables Affected

### Direct Updates:
1. ✅ **orders** - status, cancelleddate, modifieddate
2. ✅ **orderline** - status, cancelleddate, modifieddate, cancellation_reason
3. ✅ **product** - orderedquantity, availablequantity, productstatus
4. ✅ **platformstock** (NIVAPP) - orderedqty, availableqty, platformstatus
5. ✅ **transaction** - new refund record created (manual)

### Should Be Updated (Currently Not):
6. ❌ **platformstock.lockqty** - locked quantity not released
7. ❌ **stock** - stockstatus (if specific items)
8. ❌ **promotion_evaluations** - status
9. ❌ **promotion_redemptions** - reversal/tracking

---

## 🛠️ Implementation Checklist

### ✅ Currently Working:
- [x] Order status update to "cancelled"
- [x] Orderline status update to "cancelled"
- [x] Product inventory restoration (via orderline cancellation)
- [x] PlatformStock (NIVAPP) inventory restoration (via orderline cancellation)
- [x] Manual refund processing via PhonePe
- [x] Cancellation timestamp tracking

### ❌ Missing/To Be Implemented:
- [ ] Automatic orderline cancellation when order is cancelled
- [ ] Automatic refund initiation
- [ ] Promotion evaluation cancellation
- [ ] Promotion redemption reversal
- [ ] PlatformStock lockqty release
- [ ] Individual stock item status update
- [ ] Customer email notification
- [ ] Admin/warehouse notification
- [ ] Cancellation analytics tracking
- [ ] Partial cancellation support
- [ ] Cancellation approval workflow (if needed)

---

## 📝 Usage Examples

### Example 1: Cancel Order via API
```bash
# Cancel order
curl -X PATCH http://localhost:5600/v1/orders/123/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "cancelled",
    "additionalData": {
      "cancellation_reason": "Customer changed mind",
      "cancelled_by": "user_456"
    }
  }'
```

### Example 2: Cancel Orderline via API
```bash
# Cancel orderline (restores stock automatically)
curl -X PATCH http://localhost:5600/v1/orderlines/789/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "cancelled",
    "additionalData": {
      "cancellation_reason": "Product out of stock"
    }
  }'
```

### Example 3: Process Refund
```bash
# Initiate refund
curl -X POST http://localhost:5600/v1/phonepe/refund/MERCHANT_TX_123 \
  -H "Content-Type: application/json" \
  -d '{
    "refundAmount": 1500.00,
    "reason": "Order cancellation"
  }'
```

---

## 🚨 Important Notes

1. **Stock Restoration**: Only works when orderlines are cancelled, NOT when order is cancelled directly
2. **Refunds**: Must be triggered manually - not automatic
3. **Promotions**: Evaluations and redemptions are not automatically handled
4. **Notifications**: No automatic emails sent
5. **Platform Stock**: Not synchronized during cancellation

## 🔗 Related Files

- `src/routes/orders.route.ts` - Order routes
- `src/controllers/orders.controller.ts` - Order controller
- `src/services/orders.service.ts` - Order service
- `src/services/orderline.service.ts` - Orderline service (includes stock restoration)
- `src/services/phonepe.service.ts` - Refund processing
- `src/services/promotion-evaluation.service.ts` - Promotion handling
- `prisma/schema.prisma` - Database schema

