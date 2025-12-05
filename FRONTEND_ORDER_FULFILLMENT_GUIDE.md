# Frontend Guide - Order Fulfillment & EKART Integration

**Date:** January 2025  
**Version:** 1.0  
**Target Audience:** Frontend Developers (React, React Native, Web)

This guide provides complete business flow and API reference for implementing order fulfillment in the frontend application.

---

## 📋 Table of Contents

1. [Overview](#1-overview)
2. [Business Flow - Complete Journey](#2-business-flow---complete-journey)
3. [API Reference - Order Fulfillment](#3-api-reference---order-fulfillment)
4. [API Reference - EKART Integration](#4-api-reference---ekart-integration)
5. [Status Flow & UI States](#5-status-flow--ui-states)
6. [Error Handling](#6-error-handling)
7. [Code Examples](#7-code-examples)
8. [UI/UX Best Practices](#8-uiux-best-practices)

---

## 1️⃣ Overview

### What is Order Fulfillment?

Order fulfillment is the process of preparing and shipping customer orders. This includes:
- Collecting products from warehouse
- Packing items in a box
- Creating EKART shipment
- Printing and attaching shipping label
- Handing over to EKART for delivery

### Key Actors

- **Inventory App User** (Warehouse Staff): Performs physical actions (packing, label printing)
- **System**: Automatically updates statuses based on actions
- **EKART**: Handles shipping and delivery

### Technology Stack

- **Backend API:** RESTful API (Fastify)
- **Base URL:** `http://localhost:5600/v1` (or your production URL)
- **Authentication:** Bearer token (if required)
- **Response Format:** JSON (except label download which is PDF binary)

---

## 2️⃣ Business Flow - Complete Journey

### 2.1 Complete Fulfillment Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    ORDER FULFILLMENT FLOW                   │
└─────────────────────────────────────────────────────────────┘

Step 1: Order Created
  ├─ Status: payment_completed
  └─ Location: Customer App / PhonePe Payment

Step 2: Warehouse - Collect Products
  ├─ Action: Physical collection of all products
  └─ Status: Still payment_completed

Step 3: Warehouse - Pack Box
  ├─ Action: Pack all products in one box
  └─ Status: Still payment_completed (or packed if tracked)

Step 4: Inventory App - Mark Ready for Dispatch
  ├─ API: PATCH /v1/orders/:id/ready-for-dispatch
  ├─ Action: User clicks "Ready for Dispatch" button
  ├─ Status: ready_for_dispatch
  └─ UI: Show "Ready to Ship" badge

Step 5: Inventory App - Create EKART Shipment
  ├─ API: POST /v1/ekart/shipments/forward
  ├─ Action: User clicks "Create Shipment" button
  ├─ Status: Still ready_for_dispatch (not shipped yet)
  ├─ Data Stored: tracking_id, vendor, barcodes
  └─ UI: Show tracking_id, "Download Label" button appears

Step 6: Inventory App - Download Label
  ├─ API: POST /v1/ekart/shipments/label
  ├─ Action: User clicks "Download Label" button
  ├─ Response: PDF binary file
  ├─ Data Stored: label_url (GCP path)
  └─ UI: Download PDF, show "Print Label" button

Step 7: Warehouse - Print & Stick Label
  ├─ Action: Physical action (print PDF, stick on box)
  └─ Status: Still ready_for_dispatch

Step 8: Inventory App - Mark as Shipped
  ├─ API: PATCH /v1/orders/:id/mark-shipped
  ├─ Action: User clicks "Mark as Shipped" button (after label stuck)
  ├─ Status: shipped
  └─ UI: Show "Shipped" badge, enable tracking

Step 9: EKART - Pickup & Transit
  ├─ Status Updates: in_transit → out_for_delivery
  ├─ Source: EKART webhook/polling (automatic)
  └─ UI: Show tracking timeline

Step 10: EKART - Delivery
  ├─ Status: delivered
  ├─ COD: cod_payment_received (if COD order)
  └─ UI: Show "Delivered" badge, completion message
```

### 2.2 Step-by-Step Business Flow

#### **Step 1: Order Created (Customer Side)**

**Status:** `payment_completed`

**What Happens:**
- Customer places order via PhonePe (Prepaid) or COD
- Order and orderlines created in database
- Stock converted from `lockqty` → `orderedqty`

**Frontend Action:** None (happens in customer app)

---

#### **Step 2-3: Warehouse Physical Actions**

**Status:** `payment_completed` or `packed`

**What Happens:**
- Warehouse staff physically collects products
- Products packed in one box
- Box ready for shipping

**Frontend Action:** None (physical actions, not tracked in system)

---

#### **Step 4: Mark Ready for Dispatch** 🔴 **INVENTORY APP ACTION**

**Status Transition:** `payment_completed` → `ready_for_dispatch`

**Business Logic:**
- All products collected ✅
- Box packed and ready ✅
- Warehouse user confirms ready to ship

**User Action:**
1. User views order in inventory app
2. User clicks "Mark Ready for Dispatch" button
3. System updates all orderlines to `ready_for_dispatch`
4. Order status automatically becomes `ready_for_dispatch`

**UI State:**
- Button: "Mark Ready for Dispatch" (enabled)
- After click: Button disabled, show "Ready for Dispatch" badge
- Show timestamp: `readytodispatchdate`

---

#### **Step 5: Create EKART Shipment** 🔴 **INVENTORY APP ACTION**

**Status:** Still `ready_for_dispatch` (NOT `shipped` yet)

**Business Logic:**
- Order must be `ready_for_dispatch` before creating shipment
- EKART shipment created with order details
- Tracking ID (AWB) assigned
- Shipment data stored in database

**User Action:**
1. User clicks "Create EKART Shipment" button
2. System calls EKART API
3. System stores `tracking_id`, `vendor`, `barcodes` in database
4. All orderlines updated with `tracking_id`

**UI State:**
- Button: "Create Shipment" (enabled when status is `ready_for_dispatch`)
- After success: Show `tracking_id`, "Download Label" button appears
- Show public tracking link
- Status remains `ready_for_dispatch` (not shipped yet)

**Important:** Status does NOT change to `shipped` at this step. It remains `ready_for_dispatch` until label is printed and stuck.

---

#### **Step 6: Download Label** 🔴 **INVENTORY APP ACTION**

**Status:** Still `ready_for_dispatch`

**Business Logic:**
- Download PDF label from EKART
- Store PDF in GCP bucket
- Save `label_url` in database

**User Action:**
1. User clicks "Download Label" button
2. System downloads PDF from EKART
3. System uploads PDF to GCP
4. PDF file downloaded to user's device

**UI State:**
- Button: "Download Label" (enabled when `tracking_id` exists)
- After download: Show "Label Downloaded" message
- Show "Print Label" button or auto-open print dialog
- Status remains `ready_for_dispatch`

---

#### **Step 7: Print & Stick Label** (Physical Action)

**Status:** Still `ready_for_dispatch`

**What Happens:**
- User prints the downloaded PDF
- User sticks printed label on the box
- Physical action, not tracked in system

**Frontend Action:** None (physical action)

---

#### **Step 8: Mark as Shipped** 🔴 **INVENTORY APP ACTION**

**Status Transition:** `ready_for_dispatch` → `shipped`

**Business Logic:**
- User confirms label is printed and stuck
- All orderlines updated to `shipped`
- Order status automatically becomes `shipped`
- `shipdate` and `label_printed_at` timestamps set

**User Action:**
1. User clicks "Mark as Shipped" button (after label stuck)
2. System updates all orderlines to `shipped`
3. Order status automatically becomes `shipped`

**UI State:**
- Button: "Mark as Shipped" (enabled when `tracking_id` exists and label downloaded)
- After click: Button disabled, show "Shipped" badge
- Show timestamp: `shipdate`
- Enable tracking features

**Validation:**
- Must have `tracking_id` (shipment created)
- If no `tracking_id`, show error: "Shipment not created yet. Please create EKART shipment first."

---

#### **Step 9-10: EKART Tracking Updates** (Automatic)

**Status Transitions:** `shipped` → `in_transit` → `out_for_delivery` → `delivered`

**Business Logic:**
- EKART webhook or polling updates status
- System automatically updates orderlines
- Order status automatically recalculated

**Frontend Action:**
- Poll tracking API or listen to webhooks
- Update UI with latest status
- Show tracking timeline

---

### 2.3 Cancellation Flow (During Fulfillment)

#### **Cancel Before Shipment Created**

**Status:** `ready_for_dispatch` or earlier

**User Action:**
1. Customer clicks "Cancel Order" in customer app
2. System cancels orderline(s)
3. Stock automatically restored

**UI State:**
- Show "Cancelled" badge
- Disable all fulfillment actions

---

#### **Cancel After Shipment Created (Before Label Print)**

**Status:** `ready_for_dispatch` (shipment created)

**User Action:**
1. Customer clicks "Cancel Order"
2. System attempts to cancel EKART shipment
3. System cancels orderline(s)
4. Stock automatically restored

**UI State:**
- Show "Cancelled" badge
- Show warning if EKART cancellation fails
- Disable all fulfillment actions

---

#### **Cancel After Label Printed (In Transit)**

**Status:** `shipped` or `in_transit`

**User Action:**
1. Customer clicks "Cancel Order"
2. System attempts to cancel EKART shipment (may fail)
3. System cancels orderline(s) anyway
4. Stock automatically restored
5. EKART handles RTO automatically

**UI State:**
- Show "Cancelled" badge
- Show message: "Order cancelled. EKART will return item to warehouse."
- Disable all fulfillment actions

---

## 3️⃣ API Reference - Order Fulfillment

### 3.1 Get Orders List

**Endpoint:** `GET /v1/orders`

**Description:** Get all orders with pagination and filtering

**Request:**
```http
GET /v1/orders?page=1&limit=20&orderstatus=ready_for_dispatch
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `orderstatus` (optional): Filter by status (e.g., `ready_for_dispatch`, `shipped`)
- `userid` (optional): Filter by user ID
- `orderid` (optional): Filter by order number

**Success Response (200):**
```json
{
  "success": true,
  "message": "Orders retrieved successfully",
  "data": [
    {
      "id": 456,
      "orderid": "ORD-1001",
      "orderstatus": "ready_for_dispatch",
      "orderamount": 499,
      "quantity": 1,
      "tracking_id": null,
      "readytodispatchdate": 1701234567890,
      "createddate": 1701234000000,
      "status_history": [...]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "totalPages": 3,
    "hasNext": true,
    "hasPrev": false
  }
}
```

**Frontend Usage:**
```typescript
const fetchOrders = async (status?: string) => {
  const params = new URLSearchParams({
    page: '1',
    limit: '20',
    ...(status && { orderstatus: status })
  });
  
  const response = await fetch(`/v1/orders?${params}`);
  const data = await response.json();
  return data;
};
```

---

### 3.2 Get Order Details

**Endpoint:** `GET /v1/orders/:id`

**Description:** Get single order with all details

**Request:**
```http
GET /v1/orders/456
```

**Path Parameters:**
- `id` (required): Order database ID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Order retrieved successfully",
  "data": {
    "id": 456,
    "orderid": "ORD-1001",
    "orderstatus": "ready_for_dispatch",
    "orderamount": 499,
    "quantity": 1,
    "tracking_id": null,
    "vendor": null,
    "label_url": null,
    "public_tracking_link": null,
    "readytodispatchdate": 1701234567890,
    "shipdate": null,
    "label_printed_at": null,
    "status_history": [
      {
        "previous_status": "payment_completed",
        "new_status": "ready_for_dispatch",
        "changed_date": 1701234567890,
        "source": "inventoryuser",
        "inventory_user_id": 123
      }
    ]
  }
}
```

---

### 3.3 Mark Ready for Dispatch

**Endpoint:** `PATCH /v1/orders/:id/ready-for-dispatch`

**Description:** Mark order as ready for dispatch (all products collected and box ready)

**Request:**
```http
PATCH /v1/orders/456/ready-for-dispatch
Content-Type: application/json
```

**Request Body:**
```json
{
  "inventory_user_id": 123
}
```

**Path Parameters:**
- `id` (required): Order database ID

**Body Parameters:**
- `inventory_user_id` (required): ID of inventory user performing the action

**Success Response (200):**
```json
{
  "success": true,
  "message": "Order marked as ready for dispatch",
  "data": {
    "id": 456,
    "orderid": "ORD-1001",
    "orderstatus": "ready_for_dispatch",
    "readytodispatchdate": 1701234567890,
    "status_history": [
      {
        "previous_status": "payment_completed",
        "new_status": "ready_for_dispatch",
        "changed_date": 1701234567890,
        "source": "inventoryuser",
        "inventory_user_id": 123
      }
    ]
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "inventory_user_id is required",
  "statusCode": 400
}
```

**Frontend Usage:**
```typescript
const markReadyForDispatch = async (orderId: number, inventoryUserId: number) => {
  const response = await fetch(`/v1/orders/${orderId}/ready-for-dispatch`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inventory_user_id: inventoryUserId
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return response.json();
};
```

**UI Flow:**
```typescript
// In your React component
const handleReadyForDispatch = async () => {
  try {
    setLoading(true);
    const result = await markReadyForDispatch(order.id, currentUser.id);
    
    // Update local state
    setOrder(result.data);
    showSuccessToast('Order marked as ready for dispatch');
    
    // Update UI
    setShowReadyButton(false);
    setShowCreateShipmentButton(true);
  } catch (error) {
    showErrorToast(error.message);
  } finally {
    setLoading(false);
  }
};
```

---

### 3.4 Mark as Shipped

**Endpoint:** `PATCH /v1/orders/:id/mark-shipped`

**Description:** Mark order as shipped (after label printed and stuck on box)

**Request:**
```http
PATCH /v1/orders/456/mark-shipped
Content-Type: application/json
```

**Request Body:**
```json
{
  "inventory_user_id": 123
}
```

**Path Parameters:**
- `id` (required): Order database ID

**Body Parameters:**
- `inventory_user_id` (required): ID of inventory user performing the action

**Success Response (200):**
```json
{
  "success": true,
  "message": "Order marked as shipped",
  "data": {
    "id": 456,
    "orderid": "ORD-1001",
    "orderstatus": "shipped",
    "tracking_id": "500999A3408005",
    "shipdate": 1701234700000,
    "label_printed_at": 1701234700000,
    "status_history": [
      {
        "previous_status": "ready_for_dispatch",
        "new_status": "shipped",
        "changed_date": 1701234700000,
        "source": "inventoryuser",
        "inventory_user_id": 123
      }
    ]
  }
}
```

**Error Response (400):**
```json
{
  "success": false,
  "message": "Shipment not created yet. Please create EKART shipment first.",
  "statusCode": 400
}
```

**Frontend Usage:**
```typescript
const markShipped = async (orderId: number, inventoryUserId: number) => {
  const response = await fetch(`/v1/orders/${orderId}/mark-shipped`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inventory_user_id: inventoryUserId
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return response.json();
};
```

**UI Flow:**
```typescript
const handleMarkShipped = async () => {
  // Show confirmation dialog
  const confirmed = await showConfirmDialog(
    'Confirm Shipped',
    'Have you printed and stuck the label on the box?'
  );
  
  if (!confirmed) return;
  
  try {
    setLoading(true);
    const result = await markShipped(order.id, currentUser.id);
    
    // Update local state
    setOrder(result.data);
    showSuccessToast('Order marked as shipped');
    
    // Update UI
    setShowMarkShippedButton(false);
    setShowTrackingButton(true);
  } catch (error) {
    showErrorToast(error.message);
  } finally {
    setLoading(false);
  }
};
```

---

### 3.5 Track Order (Customer-Facing)

**Endpoint:** `GET /v1/orders/:id/track`

**Description:** Track order by order ID or order number (customer-facing)

**Request:**
```http
GET /v1/orders/456/track
```

**OR**

```http
GET /v1/orders/ORD-1001/track
```

**Path Parameters:**
- `id` (required): Order database ID OR order number (orderid)

**Success Response (200) - Order Not Shipped:**
```json
{
  "success": true,
  "message": "Order tracking information",
  "data": {
    "order_id": 456,
    "order_number": "ORD-1001",
    "order_status": "ready_for_dispatch",
    "tracking_id": null,
    "message": "Order has not been shipped yet",
    "tracking_available": false
  }
}
```

**Success Response (200) - Order Shipped:**
```json
{
  "success": true,
  "message": "Order tracking retrieved successfully",
  "data": {
    "order_id": 456,
    "order_number": "ORD-1001",
    "order_status": "shipped",
    "tracking_id": "500999A3408005",
    "vendor": "EKART",
    "public_tracking_link": "https://app.elite.ekartlogistics.in/track/500999A3408005",
    "tracking_available": true,
    "ekart_tracking": {
      "status": "Order Placed",
      "current_location": "Bangalore",
      "description": "Shipment created",
      "estimated_delivery": "2025-12-05T10:00:00.000Z",
      "status_history": [
        {
          "status": "Order Placed",
          "ctime": 1701234567890,
          "desc": "Shipment created",
          "location": "Bangalore"
        }
      ],
      "ndr_status": null,
      "ndr_actions": null,
      "attempts": 0
    }
  }
}
```

**Error Response (404):**
```json
{
  "success": false,
  "message": "Order not found",
  "statusCode": 404
}
```

**Frontend Usage:**
```typescript
const trackOrder = async (orderIdOrNumber: string | number) => {
  const response = await fetch(`/v1/orders/${orderIdOrNumber}/track`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return response.json();
};
```

---

## 4️⃣ API Reference - EKART Integration

### 4.1 Check EKART Connection Status

**Endpoint:** `GET /v1/ekart/connection-status`

**Description:** Check if EKART is connected (no connection attempt)

**Request:**
```http
GET /v1/ekart/connection-status
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Connection status retrieved successfully",
  "data": {
    "connected": true,
    "configured": true,
    "token_type": "Bearer",
    "expires_in": 86400,
    "expires_at": "2025-12-04T12:00:00.000Z",
    "is_valid": true,
    "message": "Ekart channel is connected and ready to use"
  }
}
```

**Frontend Usage:**
```typescript
const checkEkartStatus = async () => {
  const response = await fetch('/v1/ekart/connection-status');
  const data = await response.json();
  
  if (data.data.connected) {
    return { connected: true, ready: true };
  } else if (data.data.configured) {
    return { connected: false, ready: false, needsConnection: true };
  } else {
    return { connected: false, ready: false, needsConfiguration: true };
  }
};
```

---

### 4.2 Connect to EKART Channel

**Endpoint:** `POST /v1/ekart/connect-channel`

**Description:** Manually connect to EKART (optional - auto-connects on startup)

**Request:**
```http
POST /v1/ekart/connect-channel
Content-Type: application/json
```

**No request body required**

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully connected to Ekart channel",
  "data": {
    "connected": true,
    "token_type": "Bearer",
    "expires_in": 86400,
    "expires_at": "2025-12-04T12:00:00.000Z",
    "is_valid": true,
    "message": "Ekart channel is now connected and ready to use"
  }
}
```

**Frontend Usage:**
```typescript
const connectEkart = async () => {
  const response = await fetch('/v1/ekart/connect-channel', {
    method: 'POST'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return response.json();
};
```

---

### 4.3 Create Forward Shipment

**Endpoint:** `POST /v1/ekart/shipments/forward`

**Description:** Create EKART shipment for order

**Request:**
```http
POST /v1/ekart/shipments/forward
Content-Type: application/json
```

**Request Body:**
```json
{
  "seller_name": "Nivaana Store",
  "seller_address": "Warehouse Address, City, State, PIN",
  "seller_gst_tin": "29ABCDE1234F2Z5",
  "order_number": "ORD-1001",
  "invoice_number": "INV-1001",
  "invoice_date": "2025-12-03",
  "consignee_name": "John Doe",
  "products_desc": "Mens Shirt - M",
  "payment_mode": "Prepaid",
  "category_of_goods": "Fashion",
  "total_amount": 499,
  "tax_value": 24,
  "taxable_amount": 475,
  "commodity_value": "475",
  "cod_amount": 0,
  "quantity": 1,
  "weight": 450,
  "length": 20,
  "width": 15,
  "height": 5,
  "drop_location": {
    "location_type": "Home",
    "name": "John Doe",
    "address": "Street 1, Apartment 2B",
    "city": "Bangalore",
    "state": "Karnataka",
    "country": "India",
    "pin": 560001,
    "phone": 9876543210
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Forward shipment created successfully",
  "data": {
    "tracking_id": "500999A3408005",
    "vendor": "EKART",
    "barcodes": {
      "wbn": "vendor_waybill_plain_text",
      "order": "order_number",
      "cod": "vendor_cod_waybill_plain_text"
    },
    "public_tracking_link": "https://app.elite.ekartlogistics.in/track/500999A3408005",
    "order_number": "ORD-1001"
  }
}
```

**Error Response (500):**
```json
{
  "success": false,
  "message": "Failed to create shipment",
  "error": "EKART API error details"
}
```

**Frontend Usage:**
```typescript
const createShipment = async (orderData: any) => {
  // Prepare shipment payload from order data
  const payload = {
    seller_name: "Nivaana Store",
    seller_address: "Warehouse Address",
    seller_gst_tin: "29ABCDE1234F2Z5",
    order_number: orderData.orderid,
    invoice_number: `INV-${orderData.orderid}`,
    invoice_date: new Date().toISOString().split('T')[0],
    consignee_name: orderData.customerName,
    products_desc: orderData.productsDesc,
    payment_mode: orderData.mode === 'cod' ? 'COD' : 'Prepaid',
    total_amount: orderData.orderamount,
    tax_value: orderData.taxValue || 0,
    taxable_amount: orderData.taxableAmount || orderData.orderamount,
    commodity_value: String(orderData.taxableAmount || orderData.orderamount),
    cod_amount: orderData.mode === 'cod' ? orderData.orderamount : 0,
    quantity: orderData.quantity,
    weight: orderData.weight || 450,
    length: orderData.length || 20,
    width: orderData.width || 15,
    height: orderData.height || 5,
    drop_location: {
      location_type: "Home",
      name: orderData.customerName,
      address: orderData.customerAddress,
      city: orderData.customerCity,
      state: orderData.customerState,
      country: "India",
      pin: orderData.customerPin,
      phone: orderData.customerPhone
    }
  };
  
  const response = await fetch('/v1/ekart/shipments/forward', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create shipment');
  }
  
  return response.json();
};
```

**UI Flow:**
```typescript
const handleCreateShipment = async () => {
  try {
    setLoading(true);
    
    // Check EKART connection first
    const status = await checkEkartStatus();
    if (!status.ready) {
      if (status.needsConnection) {
        await connectEkart();
      } else {
        throw new Error('EKART is not configured');
      }
    }
    
    // Create shipment
    const result = await createShipment(order);
    
    // Update local state
    setOrder(prev => ({
      ...prev,
      tracking_id: result.data.tracking_id,
      vendor: result.data.vendor,
      barcodes: result.data.barcodes,
      public_tracking_link: result.data.public_tracking_link
    }));
    
    showSuccessToast(`Shipment created! Tracking ID: ${result.data.tracking_id}`);
    
    // Update UI
    setShowCreateShipmentButton(false);
    setShowDownloadLabelButton(true);
  } catch (error) {
    showErrorToast(error.message);
  } finally {
    setLoading(false);
  }
};
```

---

### 4.4 Download Label (PDF)

**Endpoint:** `POST /v1/ekart/shipments/label`

**Description:** Download shipping label as PDF

**Request:**
```http
POST /v1/ekart/shipments/label
Content-Type: application/json
```

**Request Body:**
```json
{
  "trackingIds": ["500999A3408005"]
}
```

**Success Response (200):**
- **Content-Type:** `application/pdf`
- **Body:** Binary PDF file
- **Headers:**
  - `Content-Disposition: attachment; filename="ekart-labels-<timestamp>.pdf"`

**Frontend Usage:**
```typescript
const downloadLabel = async (trackingId: string) => {
  const response = await fetch('/v1/ekart/shipments/label', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      trackingIds: [trackingId]
    })
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to download label');
  }
  
  // Handle PDF binary response
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ekart-label-${trackingId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
```

**React Native Usage:**
```typescript
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const downloadLabel = async (trackingId: string) => {
  const response = await fetch('/v1/ekart/shipments/label', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      trackingIds: [trackingId]
    })
  });
  
  if (!response.ok) {
    throw new Error('Failed to download label');
  }
  
  const blob = await response.blob();
  const base64 = await blobToBase64(blob);
  const fileUri = `${FileSystem.documentDirectory}label-${trackingId}.pdf`;
  
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64
  });
  
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri);
  }
};
```

**UI Flow:**
```typescript
const handleDownloadLabel = async () => {
  try {
    setLoading(true);
    await downloadLabel(order.tracking_id);
    showSuccessToast('Label downloaded successfully');
    
    // Update UI
    setShowDownloadLabelButton(false);
    setShowMarkShippedButton(true);
  } catch (error) {
    showErrorToast(error.message);
  } finally {
    setLoading(false);
  }
};
```

---

### 4.5 Track Shipment

**Endpoint:** `GET /v1/ekart/shipments/:trackingId/track`

**Description:** Get real-time tracking information from EKART

**Request:**
```http
GET /v1/ekart/shipments/500999A3408005/track
```

**Path Parameters:**
- `trackingId` (required): EKART tracking ID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Shipment tracking retrieved successfully",
  "data": {
    "tracking_id": "500999A3408005",
    "status": "Order Placed",
    "current_location": "Bangalore",
    "description": "Shipment created",
    "estimated_delivery": "2025-12-05T10:00:00.000Z",
    "order_number": "ORD-1001",
    "status_history": [
      {
        "status": "Order Placed",
        "ctime": 1701234567890,
        "desc": "Shipment created",
        "location": "Bangalore"
      }
    ],
    "ndr_status": null,
    "ndr_actions": null,
    "attempts": 0,
    "public_tracking_link": "https://app.elite.ekartlogistics.in/track/500999A3408005"
  }
}
```

**Frontend Usage:**
```typescript
const trackShipment = async (trackingId: string) => {
  const response = await fetch(`/v1/ekart/shipments/${trackingId}/track`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return response.json();
};
```

---

### 4.6 Cancel Shipment

**Endpoint:** `DELETE /v1/ekart/shipments/:trackingId/cancel`

**Description:** Cancel EKART shipment (before pickup)

**Request:**
```http
DELETE /v1/ekart/shipments/500999A3408005/cancel
```

**Path Parameters:**
- `trackingId` (required): EKART tracking ID to cancel

**Success Response (200):**
```json
{
  "success": true,
  "message": "Shipment cancelled successfully",
  "data": {
    "tracking_id": "500999A3408005",
    "remark": "Shipment cancelled successfully"
  }
}
```

**Frontend Usage:**
```typescript
const cancelShipment = async (trackingId: string) => {
  const response = await fetch(`/v1/ekart/shipments/${trackingId}/cancel`, {
    method: 'DELETE'
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }
  
  return response.json();
};
```

---

## 5️⃣ Status Flow & UI States

### 5.1 Order Status Flow

```
payment_completed
  ↓
[User Action: Mark Ready for Dispatch]
  ↓
ready_for_dispatch
  ↓
[User Action: Create EKART Shipment]
  ↓
ready_for_dispatch (tracking_id stored)
  ↓
[User Action: Download Label]
  ↓
ready_for_dispatch (label_url stored)
  ↓
[User Action: Mark as Shipped]
  ↓
shipped
  ↓
[EKART Automatic Updates]
  ↓
in_transit → out_for_delivery → delivered
```

### 5.2 UI State Machine

```typescript
interface OrderUIState {
  status: string;
  canMarkReady: boolean;
  canCreateShipment: boolean;
  canDownloadLabel: boolean;
  canMarkShipped: boolean;
  canTrack: boolean;
  canCancel: boolean;
}

const getUIState = (order: Order): OrderUIState => {
  const hasTrackingId = !!order.tracking_id;
  const hasLabelUrl = !!order.label_url;
  
  return {
    status: order.orderstatus,
    canMarkReady: ['payment_completed', 'packed'].includes(order.orderstatus),
    canCreateShipment: order.orderstatus === 'ready_for_dispatch' && !hasTrackingId,
    canDownloadLabel: hasTrackingId && !hasLabelUrl,
    canMarkShipped: hasTrackingId && order.orderstatus === 'ready_for_dispatch',
    canTrack: hasTrackingId && ['shipped', 'in_transit', 'out_for_delivery'].includes(order.orderstatus),
    canCancel: !['delivered', 'cancelled', 'returned'].includes(order.orderstatus)
  };
};
```

### 5.3 Status Badge Colors

```typescript
const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    'payment_completed': 'blue',
    'packed': 'purple',
    'ready_for_dispatch': 'orange',
    'shipped': 'teal',
    'in_transit': 'cyan',
    'out_for_delivery': 'indigo',
    'delivered': 'green',
    'cancelled': 'red',
    'partially_cancelled': 'yellow',
    'cod_payment_received': 'green'
  };
  
  return statusColors[status] || 'gray';
};
```

### 5.4 Status Timeline Display

```typescript
const StatusTimeline = ({ order }: { order: Order }) => {
  const statusHistory = order.status_history || [];
  
  const statusSteps = [
    { key: 'payment_completed', label: 'Payment Completed', icon: '💰' },
    { key: 'packed', label: 'Packed', icon: '📦' },
    { key: 'ready_for_dispatch', label: 'Ready for Dispatch', icon: '✅' },
    { key: 'shipped', label: 'Shipped', icon: '🚚' },
    { key: 'in_transit', label: 'In Transit', icon: '🚛' },
    { key: 'out_for_delivery', label: 'Out for Delivery', icon: '🏠' },
    { key: 'delivered', label: 'Delivered', icon: '✓' }
  ];
  
  const currentStatusIndex = statusSteps.findIndex(
    step => step.key === order.orderstatus
  );
  
  return (
    <div className="status-timeline">
      {statusSteps.map((step, index) => {
        const isCompleted = index <= currentStatusIndex;
        const historyEntry = statusHistory.find(
          entry => entry.new_status === step.key
        );
        
        return (
          <div key={step.key} className={`timeline-step ${isCompleted ? 'completed' : 'pending'}`}>
            <div className="step-icon">{step.icon}</div>
            <div className="step-label">{step.label}</div>
            {historyEntry && (
              <div className="step-date">
                {new Date(historyEntry.changed_date).toLocaleString()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
```

---

## 6️⃣ Error Handling

### 6.1 Common Error Scenarios

#### **Error: EKART Not Connected**

**When:** Trying to create shipment when EKART is not connected

**Error Response:**
```json
{
  "success": false,
  "message": "EKART channel is not connected",
  "statusCode": 500
}
```

**Frontend Handling:**
```typescript
try {
  await createShipment(order);
} catch (error) {
  if (error.message.includes('not connected')) {
    // Show connect button
    setShowConnectButton(true);
    showErrorToast('EKART is not connected. Please connect first.');
  }
}
```

#### **Error: Shipment Not Created**

**When:** Trying to mark as shipped without creating shipment first

**Error Response:**
```json
{
  "success": false,
  "message": "Shipment not created yet. Please create EKART shipment first.",
  "statusCode": 400
}
```

**Frontend Handling:**
```typescript
try {
  await markShipped(orderId, userId);
} catch (error) {
  if (error.message.includes('Shipment not created')) {
    showErrorToast('Please create EKART shipment first');
    // Redirect to create shipment step
    navigateToCreateShipment();
  }
}
```

#### **Error: Invalid Order Status**

**When:** Trying to perform action in wrong status

**Frontend Handling:**
```typescript
const validateAction = (order: Order, action: string): boolean => {
  const validStatuses: Record<string, string[]> = {
    'markReady': ['payment_completed', 'packed'],
    'createShipment': ['ready_for_dispatch'],
    'downloadLabel': ['ready_for_dispatch', 'shipped'],
    'markShipped': ['ready_for_dispatch']
  };
  
  const allowed = validStatuses[action] || [];
  return allowed.includes(order.orderstatus);
};

// Usage
if (!validateAction(order, 'createShipment')) {
  showErrorToast(`Cannot create shipment. Order status must be 'ready_for_dispatch'`);
  return;
}
```

### 6.2 Error Handling Best Practices

```typescript
const handleApiCall = async (apiCall: () => Promise<any>) => {
  try {
    setLoading(true);
    const result = await apiCall();
    return result;
  } catch (error: any) {
    // Log error for debugging
    console.error('API Error:', error);
    
    // Show user-friendly message
    const message = error.message || 'An error occurred';
    showErrorToast(message);
    
    // Handle specific error codes
    if (error.statusCode === 400) {
      // Bad request - show validation errors
    } else if (error.statusCode === 404) {
      // Not found - redirect or show message
    } else if (error.statusCode === 500) {
      // Server error - show generic message
      showErrorToast('Server error. Please try again later.');
    }
    
    throw error;
  } finally {
    setLoading(false);
  }
};
```

---

## 7️⃣ Code Examples

### 7.1 Complete React Component Example

```typescript
import React, { useState, useEffect } from 'react';

interface Order {
  id: number;
  orderid: string;
  orderstatus: string;
  tracking_id?: string;
  label_url?: string;
  status_history?: any[];
}

const OrderFulfillment: React.FC<{ orderId: number }> = ({ orderId }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [ekartConnected, setEkartConnected] = useState(false);

  // Fetch order details
  useEffect(() => {
    fetchOrder();
    checkEkartStatus();
  }, [orderId]);

  const fetchOrder = async () => {
    try {
      const response = await fetch(`/v1/orders/${orderId}`);
      const data = await response.json();
      setOrder(data.data);
    } catch (error) {
      console.error('Failed to fetch order:', error);
    }
  };

  const checkEkartStatus = async () => {
    try {
      const response = await fetch('/v1/ekart/connection-status');
      const data = await response.json();
      setEkartConnected(data.data.connected);
    } catch (error) {
      console.error('Failed to check EKART status:', error);
    }
  };

  const handleMarkReady = async () => {
    if (!order) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/v1/orders/${order.id}/ready-for-dispatch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory_user_id: getCurrentUserId() })
      });
      
      if (!response.ok) throw new Error('Failed to mark ready');
      
      const result = await response.json();
      setOrder(result.data);
      showSuccessToast('Order marked as ready for dispatch');
    } catch (error: any) {
      showErrorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!order) return;
    
    try {
      setLoading(true);
      
      // Check EKART connection
      if (!ekartConnected) {
        await connectEkart();
      }
      
      // Prepare shipment data
      const shipmentData = prepareShipmentData(order);
      
      // Create shipment
      const response = await fetch('/v1/ekart/shipments/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipmentData)
      });
      
      if (!response.ok) throw new Error('Failed to create shipment');
      
      const result = await response.json();
      
      // Update order with tracking info
      setOrder(prev => prev ? {
        ...prev,
        tracking_id: result.data.tracking_id,
        vendor: result.data.vendor,
        barcodes: result.data.barcodes,
        public_tracking_link: result.data.public_tracking_link
      } : null);
      
      showSuccessToast(`Shipment created! Tracking: ${result.data.tracking_id}`);
    } catch (error: any) {
      showErrorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadLabel = async () => {
    if (!order?.tracking_id) return;
    
    try {
      setLoading(true);
      const response = await fetch('/v1/ekart/shipments/label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingIds: [order.tracking_id] })
      });
      
      if (!response.ok) throw new Error('Failed to download label');
      
      // Handle PDF download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `label-${order.tracking_id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      showSuccessToast('Label downloaded successfully');
    } catch (error: any) {
      showErrorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkShipped = async () => {
    if (!order) return;
    
    const confirmed = await showConfirmDialog(
      'Confirm Shipped',
      'Have you printed and stuck the label on the box?'
    );
    
    if (!confirmed) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/v1/orders/${order.id}/mark-shipped`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory_user_id: getCurrentUserId() })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      
      const result = await response.json();
      setOrder(result.data);
      showSuccessToast('Order marked as shipped');
    } catch (error: any) {
      showErrorToast(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!order) {
    return <div>Loading order...</div>;
  }

  const uiState = getUIState(order);

  return (
    <div className="order-fulfillment">
      <div className="order-header">
        <h2>Order {order.orderid}</h2>
        <StatusBadge status={order.orderstatus} />
      </div>

      <StatusTimeline order={order} />

      <div className="fulfillment-actions">
        {uiState.canMarkReady && (
          <button onClick={handleMarkReady} disabled={loading}>
            Mark Ready for Dispatch
          </button>
        )}

        {uiState.canCreateShipment && (
          <button onClick={handleCreateShipment} disabled={loading || !ekartConnected}>
            Create EKART Shipment
          </button>
        )}

        {uiState.canDownloadLabel && (
          <button onClick={handleDownloadLabel} disabled={loading}>
            Download Label
          </button>
        )}

        {uiState.canMarkShipped && (
          <button onClick={handleMarkShipped} disabled={loading}>
            Mark as Shipped
          </button>
        )}

        {uiState.canTrack && order.tracking_id && (
          <button onClick={() => navigateToTracking(order.tracking_id)}>
            Track Shipment
          </button>
        )}
      </div>

      {order.tracking_id && (
        <div className="tracking-info">
          <p><strong>Tracking ID:</strong> {order.tracking_id}</p>
          <a href={order.public_tracking_link} target="_blank" rel="noopener noreferrer">
            View on EKART
          </a>
        </div>
      )}
    </div>
  );
};

export default OrderFulfillment;
```

### 7.2 React Native Example

```typescript
import React, { useState, useEffect } from 'react';
import { View, Text, Button, Alert, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const OrderFulfillmentScreen: React.FC<{ orderId: number }> = ({ orderId }) => {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  const handleMarkReady = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/v1/orders/${orderId}/ready-for-dispatch`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory_user_id: getCurrentUserId() })
      });
      
      if (!response.ok) throw new Error('Failed');
      
      const result = await response.json();
      setOrder(result.data);
      Alert.alert('Success', 'Order marked as ready for dispatch');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadLabel = async () => {
    if (!order?.tracking_id) return;
    
    try {
      setLoading(true);
      const response = await fetch('/v1/ekart/shipments/label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingIds: [order.tracking_id] })
      });
      
      if (!response.ok) throw new Error('Failed to download');
      
      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      const fileUri = `${FileSystem.documentDirectory}label-${order.tracking_id}.pdf`;
      
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64
      });
      
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      }
      
      Alert.alert('Success', 'Label downloaded');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      {loading && <ActivityIndicator />}
      
      <Text>Order: {order?.orderid}</Text>
      <Text>Status: {order?.orderstatus}</Text>
      
      {order?.orderstatus === 'payment_completed' && (
        <Button title="Mark Ready for Dispatch" onPress={handleMarkReady} />
      )}
      
      {order?.tracking_id && (
        <Button title="Download Label" onPress={handleDownloadLabel} />
      )}
    </View>
  );
};
```

---

## 8️⃣ UI/UX Best Practices

### 8.1 Button States

```typescript
// Disable buttons based on order status
const getButtonStates = (order: Order) => {
  return {
    markReady: {
      enabled: ['payment_completed', 'packed'].includes(order.orderstatus),
      tooltip: order.orderstatus !== 'payment_completed' 
        ? 'Order must be payment_completed or packed' 
        : 'Mark order as ready for dispatch'
    },
    createShipment: {
      enabled: order.orderstatus === 'ready_for_dispatch' && !order.tracking_id,
      tooltip: !order.tracking_id 
        ? 'Create EKART shipment' 
        : 'Shipment already created'
    },
    downloadLabel: {
      enabled: !!order.tracking_id && !order.label_url,
      tooltip: order.tracking_id 
        ? 'Download shipping label' 
        : 'Create shipment first'
    },
    markShipped: {
      enabled: order.orderstatus === 'ready_for_dispatch' && !!order.tracking_id,
      tooltip: order.tracking_id 
        ? 'Mark as shipped (after label stuck)' 
        : 'Create shipment first'
    }
  };
};
```

### 8.2 Loading States

```typescript
// Show loading indicators for async operations
const [loadingStates, setLoadingStates] = useState({
  markReady: false,
  createShipment: false,
  downloadLabel: false,
  markShipped: false
});

const setLoading = (action: string, value: boolean) => {
  setLoadingStates(prev => ({ ...prev, [action]: value }));
};

// Usage
<Button 
  disabled={loadingStates.markReady || !canMarkReady}
  loading={loadingStates.markReady}
  onClick={handleMarkReady}
>
  Mark Ready for Dispatch
</Button>
```

### 8.3 Confirmation Dialogs

```typescript
// Show confirmation for critical actions
const handleMarkShipped = async () => {
  const confirmed = await showConfirmDialog({
    title: 'Confirm Shipped',
    message: 'Have you printed and stuck the label on the box?',
    confirmText: 'Yes, Mark as Shipped',
    cancelText: 'Cancel'
  });
  
  if (!confirmed) return;
  
  // Proceed with action
  await markShipped(order.id, userId);
};
```

### 8.4 Success/Error Notifications

```typescript
// Show toast notifications for user feedback
const showSuccessToast = (message: string) => {
  // Use your toast library
  toast.success(message, { duration: 3000 });
};

const showErrorToast = (message: string) => {
  toast.error(message, { duration: 5000 });
};

// Usage
try {
  await createShipment(order);
  showSuccessToast('Shipment created successfully!');
} catch (error) {
  showErrorToast(error.message || 'Failed to create shipment');
}
```

### 8.5 Status History Timeline

```typescript
// Display status history as timeline
const StatusHistoryTimeline = ({ order }: { order: Order }) => {
  const history = order.status_history || [];
  
  return (
    <div className="status-timeline">
      {history.map((entry, index) => (
        <div key={index} className="timeline-entry">
          <div className="timeline-dot" />
          <div className="timeline-content">
            <div className="status-change">
              {entry.previous_status || 'Created'} → {entry.new_status}
            </div>
            <div className="status-meta">
              <span className="source">{entry.source}</span>
              <span className="date">
                {new Date(entry.changed_date).toLocaleString()}
              </span>
            </div>
            {entry.inventory_user_id && (
              <div className="user">User ID: {entry.inventory_user_id}</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
```

### 8.6 Real-time Updates

```typescript
// Poll for order status updates
useEffect(() => {
  if (!order || order.orderstatus === 'delivered') return;
  
  const interval = setInterval(async () => {
    try {
      const response = await fetch(`/v1/orders/${order.id}`);
      const data = await response.json();
      
      if (data.data.orderstatus !== order.orderstatus) {
        setOrder(data.data);
        showSuccessToast(`Order status updated: ${data.data.orderstatus}`);
      }
    } catch (error) {
      console.error('Failed to poll order status:', error);
    }
  }, 30000); // Poll every 30 seconds
  
  return () => clearInterval(interval);
}, [order]);
```

---

## 📊 Complete API Reference Summary

### Order Fulfillment APIs

| Method | Endpoint | Purpose | Required Status |
|--------|----------|---------|----------------|
| GET | `/v1/orders` | Get orders list | - |
| GET | `/v1/orders/:id` | Get order details | - |
| PATCH | `/v1/orders/:id/ready-for-dispatch` | Mark ready for dispatch | `payment_completed` or `packed` |
| PATCH | `/v1/orders/:id/mark-shipped` | Mark as shipped | `ready_for_dispatch` |
| GET | `/v1/orders/:id/track` | Track order | - |

### EKART Integration APIs

| Method | Endpoint | Purpose | Required Status |
|--------|----------|---------|----------------|
| GET | `/v1/ekart/connection-status` | Check connection | - |
| POST | `/v1/ekart/connect-channel` | Connect to EKART | - |
| POST | `/v1/ekart/shipments/forward` | Create shipment | `ready_for_dispatch` |
| POST | `/v1/ekart/shipments/label` | Download label | Shipment created |
| GET | `/v1/ekart/shipments/:trackingId/track` | Track shipment | Shipment created |
| DELETE | `/v1/ekart/shipments/:trackingId/cancel` | Cancel shipment | Before pickup |

---

## 🎯 Quick Reference Checklist

### For Inventory App Developers:

- [ ] Implement "Mark Ready for Dispatch" button
- [ ] Implement "Create EKART Shipment" button
- [ ] Implement "Download Label" button (PDF download)
- [ ] Implement "Mark as Shipped" button
- [ ] Show order status badge
- [ ] Display status history timeline
- [ ] Handle EKART connection status
- [ ] Show tracking information when available
- [ ] Implement error handling for all API calls
- [ ] Add loading states for async operations
- [ ] Show confirmation dialogs for critical actions

### For Customer App Developers:

- [ ] Implement "Track Order" feature
- [ ] Display order status timeline
- [ ] Show tracking information from EKART
- [ ] Implement "Cancel Order" feature
- [ ] Display cancellation status

---

## 🔗 Related Documentation

- **Complete Order Lifecycle:** `ORDER_ORDERLINE_LIFECYCLE_COMPLETE.md`
- **EKART Integration:** `cursor_tasks/EKART.md`
- **Customer Cancellation:** `CUSTOMER_CANCELLATION_GUIDE.md`

---

**End of Document**

