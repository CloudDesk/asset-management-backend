# Routes Status Summary - Tracking, Cancellation & RTO

**Date:** January 2025

## 📋 Current Status

### ✅ **Existing Routes**

#### 1. **EKART Tracking** (Requires Tracking ID)
- **Route:** `GET /v1/ekart/shipments/:trackingId/track`
- **Status:** ✅ Exists
- **Location:** `src/routes/ekart.route.ts:294`
- **Controller:** `src/controllers/ekart.controller.ts:trackShipment`
- **Issue:** Requires `tracking_id` - customers may not have this, they have `orderid` or `order_number`

#### 2. **EKART Cancel Shipment**
- **Route:** `DELETE /v1/ekart/shipments/:trackingId/cancel`
- **Status:** ✅ Exists
- **Location:** `src/routes/ekart.route.ts:334`
- **Controller:** `src/controllers/ekart.controller.ts:cancelShipment`
- **Issue:** Only cancels EKART shipment, doesn't update internal order/orderline status

#### 3. **Orderline Cancel** (Customer/Admin)
- **Route:** `PATCH /v1/orderlines/:id/cancel`
- **Status:** ✅ Exists
- **Location:** `src/routes/orderline.route.ts:119`
- **Controller:** `src/controllers/orderline.controller.ts:cancelOrderline`
- **Features:**
  - ✅ Restores stock automatically
  - ✅ Updates status history
  - ✅ Recalculates order status
  - ❌ **Missing:** EKART shipment cancellation integration

#### 4. **Order Status Update**
- **Route:** `PATCH /v1/orders/:id/status`
- **Status:** ✅ Exists
- **Location:** `src/routes/orders.route.ts:406`
- **Issue:** Order-level cancellation doesn't restore stock (only orderline does)

---

### ❌ **Missing Routes**

#### 1. **Customer Order Tracking** (By Order ID/Number)
- **Route:** `GET /v1/orders/:id/track`
- **Status:** ✅ **IMPLEMENTED**
- **Purpose:** Allow customers to track orders using their order ID/order number
- **Features:**
  - ✅ Accepts order database ID or order number (orderid)
  - ✅ Finds order automatically
  - ✅ Gets tracking_id from order
  - ✅ Calls EKART tracking API
  - ✅ Returns tracking information with order details
  - ✅ Handles cases where order not shipped yet
  - ✅ Handles EKART API failures gracefully

#### 2. **Enhanced Customer Cancellation** (With EKART Integration)
- **Route:** `PATCH /v1/orderlines/:id/cancel`
- **Status:** ✅ **IMPLEMENTED** (Enhanced with EKART integration)
- **Purpose:** Cancel orderline and also cancel EKART shipment if exists
- **Features:**
  - ✅ Checks if order has `tracking_id`
  - ✅ Cancels EKART shipment first (if exists)
  - ✅ Cancels orderline(s) and restores stock
  - ✅ Updates status history
  - ✅ Recalculates order status
  - ✅ Handles EKART cancellation failures gracefully

#### 3. **EKART Webhook/Status Update Route**
- **Route:** `POST /v1/ekart/webhook` or `POST /v1/ekart/status-update`
- **Status:** 🔮 **FUTURE IMPLEMENTATION** (Not implemented yet)
- **Purpose:** Receive status updates from EKART (including RTO)
- **Planned Features:**
  - Accept EKART webhook payload
  - Find order by `tracking_id`
  - Map EKART status to internal status:
    - `PICKED_UP` / `IN_TRANSIT` → `in_transit`
    - `OUT_FOR_DELIVERY` → `out_for_delivery`
    - `DELIVERED` → `delivered`
    - `COD_COLLECTED` → `cod_payment_received`
    - `RTO_INITIATED` → `rto_initiated` (restore stock)
    - `RTO_DELIVERED` → `rto_delivered`
  - Update all orderlines with matching `tracking_id`
  - Recalculate order status
  - Update status history
- **Note:** This will be implemented in the future when EKART webhook is configured

---

## 🔧 Required Implementations

### 1. Customer Order Tracking Route

**Route:** `GET /v1/orders/:id/track`

**Implementation:**
```typescript
// src/routes/orders.route.ts
fastify.get('/:id/track', {
  schema: {
    description: 'Track order by order ID (customer-facing)',
    tags: ['Orders'],
    params: {
      type: 'object',
      properties: {
        id: { type: 'string' } // Can be order.id or order.orderid
      }
    }
  }
}, ordersController.trackOrder.bind(ordersController));
```

**Controller Method:**
```typescript
// src/controllers/orders.controller.ts
trackOrder = asyncHandler(async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) => {
  const { id } = request.params;
  
  // Find order by ID or orderid
  let order;
  if (isNaN(Number(id))) {
    order = await this.ordersService.findByOrderNumber(id);
  } else {
    order = await this.ordersService.findById(Number(id));
  }
  
  if (!order) {
    return reply.code(404).send({
      success: false,
      message: 'Order not found'
    });
  }
  
  if (!order.tracking_id) {
    return reply.code(400).send({
      success: false,
      message: 'Order has not been shipped yet'
    });
  }
  
  // Get EKART tracking info
  const { ekartService } = await import('../services/ekart.service.js');
  const trackingInfo = await ekartService.trackShipment(order.tracking_id);
  
  return reply.code(200).send(createSuccessResponse('Order tracking retrieved', {
    order_id: order.id,
    order_number: order.orderid,
    tracking_id: order.tracking_id,
    current_status: order.orderstatus,
    ekart_tracking: trackingInfo,
    public_tracking_link: order.public_tracking_link
  }));
});
```

---

### 2. Enhanced Cancellation with EKART Integration

**Enhance Existing:** `PATCH /v1/orderlines/:id/cancel`

**Update Service Method:**
```typescript
// src/services/orderline.service.ts
async updateOrderlineStatus(id: string, status: string, additionalData?: Record<string, any>) {
  // ... existing code ...
  
  // If cancelling and order has tracking_id, cancel EKART shipment first
  if (status === 'cancelled') {
    const order = await ordersService.findById(currentOrderline.orderid.toString());
    
    if (order && order.tracking_id) {
      try {
        const { ekartService } = await import('./ekart.service.js');
        await ekartService.cancelShipment(order.tracking_id);
        logger.info({ trackingId: order.tracking_id }, 'EKART shipment cancelled');
      } catch (error: any) {
        logger.warn({ error: error.message, trackingId: order.tracking_id }, 'Failed to cancel EKART shipment - continuing with orderline cancellation');
        // Continue with cancellation anyway
      }
    }
  }
  
  // ... rest of existing code ...
}
```

---

### 3. EKART Webhook/Status Update Route

**Route:** `POST /v1/ekart/webhook`

**Implementation:**
```typescript
// src/routes/ekart.route.ts
fastify.post('/webhook', {
  schema: {
    description: 'Receive EKART webhook status updates (including RTO)',
    tags: ['Ekart Logistics'],
    body: {
      type: 'object',
      properties: {
        tracking_id: { type: 'string' },
        status: { type: 'string' },
        order_number: { type: 'string' },
        location: { type: 'string' },
        description: { type: 'string' },
        timestamp: { type: 'number' }
      }
    }
  }
}, ekartController.handleStatusUpdate.bind(ekartController));
```

**Controller Method:**
```typescript
// src/controllers/ekart.controller.ts
handleStatusUpdate = asyncHandler(async (
  request: FastifyRequest<{ Body: EkartWebhookPayload }>,
  reply: FastifyReply
) => {
  const { tracking_id, status, order_number, location, description } = request.body;
  
  // Find order by tracking_id
  const { OrdersService } = await import('../services/orders.service.js');
  const ordersService = new OrdersService();
  const order = await ordersService.findByTrackingId(tracking_id);
  
  if (!order) {
    logger.warn({ trackingId: tracking_id }, 'Order not found for tracking ID');
    return reply.code(404).send({
      success: false,
      message: 'Order not found'
    });
  }
  
  // Map EKART status to internal status
  const statusMap: Record<string, string> = {
    'PICKED_UP': 'in_transit',
    'IN_TRANSIT': 'in_transit',
    'OUT_FOR_DELIVERY': 'out_for_delivery',
    'DELIVERED': 'delivered',
    'COD_COLLECTED': 'cod_payment_received',
    'RTO_INITIATED': 'rto_initiated',
    'RTO_DELIVERED': 'rto_delivered'
  };
  
  const newStatus = statusMap[status] || status.toLowerCase();
  
  // Update all orderlines with matching tracking_id
  const { OrderlineService } = await import('../services/orderline.service.js');
  const orderlineService = new OrderlineService();
  
  const { data: orderlines } = await orderlineService.findMany(
    { orderid: order.id.toString() },
    1,
    1000
  );
  
  for (const orderline of orderlines || []) {
    await orderlineService.updateOrderlineStatus(
      orderline.id.toString(),
      newStatus,
      {
        source: 'ekart',
        ...(newStatus === 'delivered' && { delivereddate: Date.now() }),
        ...(newStatus === 'cod_payment_received' && { paymentreceiveddate: Date.now() })
      }
    );
  }
  
  // Recalculate order status (automatically updates status history)
  await ordersService.recalculateOrderStatus(order.id);
  
  return reply.code(200).send(createSuccessResponse('Status updated successfully', {
    order_id: order.id,
    tracking_id,
    new_status: newStatus
  }));
});
```

---

## 📊 Summary Table

| Route | Method | Endpoint | Status | Notes |
|-------|--------|----------|--------|-------|
| **EKART Tracking** | GET | `/v1/ekart/shipments/:trackingId/track` | ✅ Exists | Requires tracking_id |
| **Customer Order Tracking** | GET | `/v1/orders/:id/track` | ✅ **IMPLEMENTED** | Accepts order ID or order number |
| **EKART Cancel** | DELETE | `/v1/ekart/shipments/:trackingId/cancel` | ✅ Exists | Only cancels EKART shipment |
| **Orderline Cancel** | PATCH | `/v1/orderlines/:id/cancel` | ✅ **ENHANCED** | Now includes EKART cancellation |
| **EKART Webhook** | POST | `/v1/ekart/webhook` | 🔮 **FUTURE** | To be implemented when EKART webhook is configured |

---

## 🎯 Priority Actions

1. **High Priority:**
   - ✅ Create `GET /v1/orders/:id/track` route (customer-facing tracking)
   - ✅ Enhance `PATCH /v1/orderlines/:id/cancel` to handle EKART cancellation

2. **Medium Priority:**
   - ✅ Create `POST /v1/ekart/webhook` route for status updates (including RTO)

---

## 📝 Notes

- **Customer Tracking:** Currently customers need `tracking_id` to track, but they only have `orderid` or order number
- **Cancellation:** Orderline cancellation exists but doesn't cancel EKART shipment if one exists
- **RTO Handling:** No webhook route exists to receive RTO status updates from EKART
- **Status Updates:** Manual polling or webhook needed for EKART status updates

---

**End of Document**

