# Manual Vendor Fulfillment - Frontend Implementation Guide

**Version 2.0** - January 2025  
**Single Source of Truth for Frontend Developers**

This document provides complete API specifications, request/response formats, error handling, and implementation guidelines for the Manual Vendor Fulfillment flow in the frontend application.

---

## Table of Contents

1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Request/Response Formats](#requestresponse-formats)
4. [Error Handling](#error-handling)
5. [Status Values & Transitions](#status-values--transitions)
6. [UI/UX Implementation Guide](#uiux-implementation-guide)
7. [Code Examples](#code-examples)
8. [Best Practices](#best-practices)

---

## Overview

### What is Manual Vendor Fulfillment?

Manual Vendor Fulfillment allows orders to be shipped via logistics providers other than EKART (e.g., Delhivery, Shiprocket, Xpressbees). Unlike EKART's automated flow, manual vendors require:

- **Manual entry** of tracking ID (AWB) and vendor name
- **Optional status change** to `shipped` (controlled by `shipped` boolean in payload)
- **Manual status updates** (no webhook automation)

### Use Cases

1. **Fresh Orders with Manual Vendors**
   - Order is ready for dispatch
   - Admin manually enters tracking ID and vendor
   - **Optionally** sets status to `shipped` (via `shipped: true` in payload)

2. **EKART Refused Orders**
   - EKART shipment was created but EKART refuses to collect
   - Admin switches to another vendor (e.g., Delhivery)
   - System updates vendor and tracking ID
   - **Optionally** sets status to `shipped` (via `shipped: true` in payload)

### Key Differences from EKART

| Aspect | EKART | Manual Vendors |
|--------|-------|----------------|
| **Shipment Creation** | Automated via API | Manual entry |
| **Status Updates** | Webhook (automatic) | Manual update only |
| **Workflow** | 3 steps (create → label → webhook sets shipped) | 1-2 steps (manual-ship with optional shipped, or separate status update) |
| **Status After Shipment** | `shipped` (via webhook) | `shipped` (if `shipped: true` in `manual-ship` OR via `shipment-status` endpoint) OR `ready_for_dispatch` (if `shipped: false` or not provided) |
| **Setting Shipped Status** | Automatic (webhook) | Two options: 1) `manual-ship` with `shipped: true` (one-step), 2) `shipment-status` with `status: "shipped"` (two-step, requires tracking_id and vendor) |

---

## API Endpoints

### Base URL

```
https://api.yourdomain.com/v1/orders
```

### Authentication

All endpoints require authentication. Include authentication token in headers:

```
Authorization: Bearer <token>
Content-Type: application/json
```

---

## 1. Manual Ship (Shipment Details Update)

**Endpoint:** `PATCH /v1/orders/:id/manual-ship`

**Purpose:** Manually enter shipment details (tracking ID, vendor, public tracking link). Status change to `shipped` is **optional** and controlled by the `shipped` boolean in the payload.

**When to Use:**
- Order is in `ready_for_dispatch` status
- Using a manual vendor (not EKART)
- Need to enter tracking ID and vendor name
- **Optionally** want to mark order as shipped immediately (via `shipped: true`)

**URL Parameters:**
- `id` (string, required): Order ID (database ID) or order number (e.g., "ORD-1234567890")

**Request Body:**
```typescript
{
  tracking_id: string;           // Required: Tracking ID (AWB) from vendor
  vendor: string;                // Required: Vendor name (e.g., "Delhivery", "Shiprocket")
  inventory_user_id: number;     // Required: Inventory user ID performing the action
  public_tracking_link?: string; // Optional: Public tracking URL (auto-generated if not provided)
  shipped?: boolean;             // Optional: If true, sets order status to shipped. If false or not provided, status remains ready_for_dispatch
}
```

**Request Examples:**

**Example 1: Ship immediately (sets shipped status)**
```json
{
  "tracking_id": "DEL123456789",
  "vendor": "Delhivery",
  "inventory_user_id": 123,
  "public_tracking_link": "https://www.delhivery.com/track/DEL123456789",
  "shipped": true
}
```

**Example 2: Just update shipment details (keeps ready_for_dispatch)**
```json
{
  "tracking_id": "DEL123456789",
  "vendor": "Delhivery",
  "inventory_user_id": 123,
  "public_tracking_link": "https://www.delhivery.com/track/DEL123456789",
  "shipped": false
}
```

**Example 3: Just update shipment details (shipped not provided - defaults to no status change)**
```json
{
  "tracking_id": "DEL123456789",
  "vendor": "Delhivery",
  "inventory_user_id": 123,
  "public_tracking_link": "https://www.delhivery.com/track/DEL123456789"
}
```

**Success Response (200) - When shipped: true:**

```json
{
  "success": true,
  "message": "Shipment details updated and order marked as shipped",
  "data": {
    "id": 123,
    "orderid": "ORD-1234567890",
    "tracking_id": "DEL123456789",
    "vendor": "Delhivery",
    "public_tracking_link": "https://www.delhivery.com/track/DEL123456789",
    "orderstatus": "shipped",
    "shipdate": 1234567890000,
    "shipment_created_at": 1234567890000,
    "label_printed_at": 1234567890000,
    "status_history": [
      {
        "previous_status": "ready_for_dispatch",
        "new_status": "shipped",
        "changed_date": 1234567890000,
        "source": "inventoryuser",
        "inventory_user_id": 123,
        "is_active": true
      }
    ]
  }
}
```

**Success Response (200) - When shipped: false or not provided:**

```json
{
  "success": true,
  "message": "Shipment details updated",
  "data": {
    "id": 123,
    "orderid": "ORD-1234567890",
    "tracking_id": "DEL123456789",
    "vendor": "Delhivery",
    "public_tracking_link": "https://www.delhivery.com/track/DEL123456789",
    "orderstatus": "ready_for_dispatch",
    "shipment_created_at": 1234567890000,
    "status_history": [
      // No new entry - status unchanged
    ]
  }
}
```

**Error Responses:**

**400 Bad Request - Invalid Order Status:**
```json
{
  "success": false,
  "message": "Order must be in 'ready_for_dispatch' or 'shipped' status. Current status: cancelled",
  "statusCode": 400
}
```

**400 Bad Request - Cancelled Order:**
```json
{
  "success": false,
  "message": "Cannot update shipment details for cancelled order",
  "statusCode": 400
}
```

**400 Bad Request - Other Cancelled Statuses:**
```json
{
  "success": false,
  "message": "Cannot update shipment details for cancelled_refund_processing order",
  "statusCode": 400
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Order not found",
  "statusCode": 404
}
```

---

## 2. Manual Status Update

**Endpoint:** `PATCH /v1/orders/:id/shipment-status`

**Purpose:** Manually update shipment tracking status. Works for ALL vendors (EKART + manual vendors). Can also set `shipped` status from `ready_for_dispatch` when tracking_id exists.

**When to Use:**
- **Setting `shipped` from `ready_for_dispatch`:** Order has `tracking_id` and `vendor` but status is still `ready_for_dispatch` (alternative to using `manual-ship` with `shipped: true`)
- **Updating status after shipped:** Order is already in `shipped` or later status, need to update tracking status (e.g., `in_transit`, `delivered`)
- **Manual vendor updates:** Vendor is manual (no webhook) OR EKART webhook failed

**URL Parameters:**
- `id` (string, required): Order ID (database ID) or order number

**Request Body:**
```typescript
{
  status: string;                // Required: Status value (see allowed values below)
  inventory_user_id: number;     // Required: Inventory user ID performing the action
  location?: string;             // Optional: Current location of shipment
  description?: string;           // Optional: Status description or notes
}
```

**Allowed Status Values:**
- `shipped` - Shipment picked up/dispatched (can be set from `ready_for_dispatch`)
- `in_transit` - Package in transit
- `out_for_delivery` - Out for delivery
- `delivered` - Delivered to customer
- `rto_initiated` - Return to origin started
- `rto_delivered` - RTO delivered to warehouse
- `cod_payment_received` - COD payment collected (COD orders only)

**Request Examples:**

**Example 1: Set shipped from ready_for_dispatch (when tracking_id exists)**
```json
{
  "status": "shipped",
  "inventory_user_id": 123,
  "location": "Warehouse",
  "description": "Package picked up by courier"
}
```

**Example 2: Update status after shipped**
```json
{
  "status": "delivered",
  "inventory_user_id": 123,
  "location": "Mumbai Hub",
  "description": "Delivered to customer at doorstep"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Shipment status updated successfully",
  "data": {
    "id": 123,
    "orderid": "ORD-1234567890",
    "orderstatus": "delivered",
    "shipment_tracking_status": "delivered",
    "vendor": "Delhivery",
    "delivereddate": 1234567890000,
    "status_history": [
      {
        "previous_status": "out_for_delivery",
        "new_status": "delivered",
        "changed_date": 1234567890000,
        "source": "inventoryuser",
        "inventory_user_id": 123,
        "location": "Mumbai Hub",
        "description": "Delivered to customer at doorstep",
        "is_active": true
      }
    ]
  }
}
```

**Error Responses:**

**400 Bad Request - Invalid Status:**
```json
{
  "success": false,
  "message": "Invalid shipment status: invalid_status. Allowed statuses: shipped, in_transit, out_for_delivery, delivered, rto_initiated, rto_delivered, cod_payment_received",
  "statusCode": 400
}
```

**400 Bad Request - Invalid Transition:**
```json
{
  "success": false,
  "message": "Invalid status transition from shipped to delivered. Allowed transitions: in_transit, out_for_delivery, rto_initiated",
  "statusCode": 400
}
```

**400 Bad Request - Missing Tracking ID:**
```json
{
  "success": false,
  "message": "Order must have tracking_id to update shipment status",
  "statusCode": 400
}
```

**400 Bad Request - Cannot Set Shipped from ready_for_dispatch:**
```json
{
  "success": false,
  "message": "Order must have tracking_id and vendor to set shipped status from ready_for_dispatch",
  "statusCode": 400
}
```

**400 Bad Request - Invalid Status from ready_for_dispatch:**
```json
{
  "success": false,
  "message": "Cannot update to in_transit from ready_for_dispatch. Only 'shipped' status is allowed.",
  "statusCode": 400
}
```

**400 Bad Request - Cancelled Order:**
```json
{
  "success": false,
  "message": "Cannot update shipment status for cancelled order",
  "statusCode": 400
}
```

**400 Bad Request - Other Cancelled Statuses:**
```json
{
  "success": false,
  "message": "Cannot update shipment status for cancelled_refund_processing order",
  "statusCode": 400
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Order not found",
  "statusCode": 404
}
```

---

## Status Values & Transitions

### Allowed Status Values

After `ready_for_dispatch`, the following statuses can be set:

| Status | Description | Can Update From | Special Notes |
|--------|-------------|-----------------|---------------|
| `shipped` | Shipment picked up/dispatched | `ready_for_dispatch` | Can be set via `manual-ship` (shipped: true) OR `shipment-status` endpoint |
| `in_transit` | Package in transit | `shipped` | - |
| `out_for_delivery` | Out for delivery | `in_transit` or `shipped` | Can skip `in_transit` |
| `delivered` | Delivered to customer | `out_for_delivery` or `in_transit` | Can skip `out_for_delivery` |
| `rto_initiated` | Return to origin started | `in_transit`, `out_for_delivery`, or `shipped` | Delivery failed |
| `rto_delivered` | RTO delivered to warehouse | `rto_initiated` only | Terminal status |
| `cod_payment_received` | COD payment collected | `delivered` only | COD orders only |

**Important:**
- ✅ `shipped` can be set via:
  - `manual-ship` endpoint with `shipped: true` (one-step: enter details + mark shipped)
  - `shipment-status` endpoint with `status: "shipped"` (two-step: enter details first, then mark shipped separately)
- ✅ To set `shipped` via `shipment-status`, order must be in `ready_for_dispatch` with `tracking_id` and `vendor` already set
- ✅ Status values are **case-sensitive** (use lowercase with underscores)
- ✅ Some transitions can skip intermediate stages (flexible)

### Valid Status Transitions

| Current Status | Allowed Next Statuses |
|----------------|----------------------|
| `ready_for_dispatch` | `shipped` (via `shipment-status` endpoint, **only if tracking_id and vendor exist**) |
| `shipped` | `in_transit`, `out_for_delivery`, `rto_initiated` |
| `in_transit` | `out_for_delivery`, `delivered`, `rto_initiated` |
| `out_for_delivery` | `delivered`, `rto_initiated` |
| `delivered` | `cod_payment_received` (COD only) |
| `rto_initiated` | `rto_delivered` |
| `rto_delivered` | ❌ None (terminal status) |

### Flexible Transitions

The API allows some flexible transitions (skipping intermediate stages):

- `shipped` → `out_for_delivery` (can skip `in_transit`)
- `in_transit` → `delivered` (can skip `out_for_delivery`)

### Invalid Transitions (Will Be Rejected)

- ❌ Going backwards (e.g., `in_transit` → `shipped`)
- ❌ Invalid combinations (e.g., `delivered` → `in_transit`)
- ❌ Terminal status updates (e.g., `rto_delivered` → any status)
- ❌ COD payment for non-COD orders
- ❌ RTO delivered from non-RTO status
- ❌ **Cancelled orders:** Cannot update shipment status for any cancelled-related status:
  - `cancelled`
  - `cancelled_refund_processing`
  - `cancelled_refunded`
  - `cancelled_completed`
- ❌ **Returned orders:** Cannot update shipment status for `returned` orders

---

## Error Handling

### Common Error Scenarios

#### 1. Order Not in Ready State

**Error:** Order must be in `ready_for_dispatch` or `shipped` status

**When:** Calling `manual-ship` on order that's not ready

**Frontend Action:**
- Show error message to user
- Check current order status
- Guide user to correct workflow step

```typescript
if (error.message.includes('ready_for_dispatch')) {
  // Show: "Order must be ready for dispatch before shipping"
  // Display current status and required steps
}
```

#### 2. Invalid Status Transition

**Error:** Invalid status transition from X to Y

**When:** Trying to update to a status that's not allowed from current status

**Frontend Action:**
- Show error message with allowed transitions
- Update UI to show only valid next statuses
- Provide guidance on correct status flow

```typescript
if (error.message.includes('Invalid status transition')) {
  // Extract allowed transitions from error message
  // Update status dropdown to show only valid options
}
```

#### 3. Missing Tracking ID

**Error:** Order must have tracking_id to update shipment status

**When:** Calling `shipment-status` on order without tracking ID

**Frontend Action:**
- Show error message
- Redirect to `manual-ship` endpoint first
- Guide user to enter tracking ID

#### 4. Cancelled Order

**Error:** Cannot update shipment status/details for cancelled order

**When:** Attempting to update shipment for an order in any cancelled-related status:
- `cancelled`
- `cancelled_refund_processing`
- `cancelled_refunded`
- `cancelled_completed`
- `returned`

**Frontend Action:**
- Show error message: "This order has been cancelled and cannot be updated"
- Disable shipment update actions in UI
- Hide/disable kebab menu items for shipment updates
- Show order status badge clearly indicating cancelled state
- Guide user to refund status update endpoint if applicable

```typescript
const cancelledStatuses = [
  'cancelled',
  'cancelled_refund_processing',
  'cancelled_refunded',
  'cancelled_completed',
  'returned'
];

if (cancelledStatuses.includes(order.orderstatus)) {
  // Disable all shipment-related actions
  // Show message: "Order is cancelled - shipment updates not allowed"
}
```

#### 5. Order Not Found

**Error:** Order not found

**When:** Invalid order ID or order number

**Frontend Action:**
- Show error message
- Verify order ID/number
- Allow user to search for correct order

### Error Response Structure

All error responses follow this structure:

```typescript
{
  success: false;
  message: string;      // Human-readable error message
  statusCode: number;   // HTTP status code (400, 404, etc.)
}
```

### Error Handling Best Practices

1. **Always check `success` field** before accessing `data`
2. **Display user-friendly messages** from `message` field
3. **Handle network errors** separately (timeout, connection issues)
4. **Validate input** on frontend before API call
5. **Show loading states** during API calls
6. **Provide retry mechanism** for transient errors

---

## UI/UX Implementation Guide

### Kebab Menu Design (Primary UI Pattern)

**IMPORTANT:** All manual shipment-related actions MUST be placed inside a **vertical kebab (⋮) menu** in the Order Details screen. No primary buttons should be shown directly on the screen.

#### Kebab Menu Placement
- Location: Order Details action area (top-right or header section)
- Icon: Vertical three dots (⋮) - `fas fa-ellipsis-v` or `fas fa-ellipsis-vertical`
- Behavior: Click to open dropdown menu with contextual actions
- Disable: If no actions are available for current order status

#### Menu Item Visibility Matrix

| Order Status | Kebab Menu Items | Notes |
|--------------|------------------|-------|
| `ready_for_dispatch` | **Add Shipment Details** | Only if no tracking_id exists |
| `ready_for_dispatch` (with tracking_id) | **Mark as Shipped** | If tracking_id exists but not shipped yet |
| `shipped` | **Update Shipment Status** | Only if tracking_id exists |
| `in_transit` | **Update Shipment Status** | Only if tracking_id exists |
| `out_for_delivery` | **Update Shipment Status** | Only if tracking_id exists |
| `delivered` | _(No shipment actions)_ | Terminal status |
| `rto_initiated` | **Update Shipment Status** | Only if tracking_id exists |
| `rto_delivered` | _(No shipment actions)_ | Terminal status |
| `cod_payment_received` | _(No shipment actions)_ | Terminal status |
| `cancelled` | _(No shipment actions)_ | ❌ Blocked - Cannot update cancelled orders |
| `cancelled_refund_processing` | _(No shipment actions)_ | ❌ Blocked - Cannot update cancelled orders |
| `cancelled_refunded` | _(No shipment actions)_ | ❌ Blocked - Cannot update cancelled orders |
| `cancelled_completed` | _(No shipment actions)_ | ❌ Blocked - Cannot update cancelled orders |
| `returned` | _(No shipment actions)_ | ❌ Blocked - Cannot update returned orders |

#### Kebab Menu Implementation

```typescript
// Kebab menu should be conditionally rendered
// First, check if order is cancelled or returned (block all actions)
const cancelledStatuses = [
  'cancelled',
  'cancelled_refund_processing',
  'cancelled_refunded',
  'cancelled_completed',
  'returned'
];

const isCancelledOrReturned = cancelledStatuses.includes(order.orderstatus);

const hasManualShipmentActions = !isCancelledOrReturned && (
  (order.orderstatus === 'ready_for_dispatch' && !order.tracking_id) ||
  (order.orderstatus === 'ready_for_dispatch' && order.tracking_id && order.orderstatus !== 'shipped') ||
  (['shipped', 'in_transit', 'out_for_delivery', 'rto_initiated'].includes(order.orderstatus) && order.tracking_id)
);

// Menu items should be contextual
const getKebabMenuItems = (order: Order) => {
  const items = [];
  
  // Block all actions for cancelled or returned orders
  const cancelledStatuses = [
    'cancelled',
    'cancelled_refund_processing',
    'cancelled_refunded',
    'cancelled_completed',
    'returned'
  ];
  
  if (cancelledStatuses.includes(order.orderstatus)) {
    // No shipment actions available for cancelled/returned orders
    return items;
  }
  
  if (order.orderstatus === 'ready_for_dispatch' && !order.tracking_id) {
    items.push({
      id: 'add_shipment_details',
      label: 'Add Shipment Details',
      icon: 'fas fa-truck',
      onClick: () => openManualShipmentModal()
    });
  }
  
  if (order.orderstatus === 'ready_for_dispatch' && order.tracking_id && order.orderstatus !== 'shipped') {
    items.push({
      id: 'mark_as_shipped',
      label: 'Mark as Shipped',
      icon: 'fas fa-check-circle',
      onClick: () => openMarkShippedModal()
    });
  }
  
  if (['shipped', 'in_transit', 'out_for_delivery', 'rto_initiated'].includes(order.orderstatus) && order.tracking_id) {
    items.push({
      id: 'update_shipment_status',
      label: 'Update Shipment Status',
      icon: 'fas fa-sync-alt',
      onClick: () => openStatusUpdateModal()
    });
  }
  
  return items;
};
```

#### UX Guardrails

1. **Disable kebab menu** if no actions are available
2. **Show warning (non-blocking)** if:
   - Vendor = EKART and manual status update is triggered
   - Message: "This order uses EKART. Status updates may be overwritten by webhook."
3. **Treat duplicate status selection as no-op** (prevent unnecessary API calls)
4. **Show inline validation errors** in modal forms
5. **Disable menu during API calls** (loading state)

---

### 1. Manual Ship Form

**When to Show:**
- Order status is `ready_for_dispatch`
- User clicks "Add Shipment Details" from kebab menu
- No tracking_id exists for the order

**Form Fields:**

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| Tracking ID | Text Input | ✅ Yes | Min 1 char, alphanumeric | AWB number from vendor |
| Vendor | Dropdown/Select | ✅ Yes | Not "EKART" | Pre-populate common vendors |
| Public Tracking Link | Text Input | ❌ No | Valid URL format | Auto-generate if not provided |
| **Mark as Shipped** | Checkbox/Toggle | ❌ No | Boolean | If checked, sets `shipped: true` in payload |
| Inventory User ID | Hidden/Auto | ✅ Yes | Current user ID | Auto-populate from session |

**Vendor Dropdown Options:**
- Delhivery
- Shiprocket
- Xpressbees
- BlueDart
- DTDC
- FedEx
- Shadowfax
- Ecom Express
- Other (custom input)

**Form Validation:**
```typescript
// Frontend validation before API call
const validateManualShipForm = (formData) => {
  const errors = {};
  
  if (!formData.tracking_id || formData.tracking_id.trim().length === 0) {
    errors.tracking_id = 'Tracking ID is required';
  }
  
  if (!formData.vendor || formData.vendor.trim().length === 0) {
    errors.vendor = 'Vendor is required';
  }
  
  if (formData.vendor === 'EKART') {
    errors.vendor = 'Cannot use EKART. Use EKART shipment creation instead.';
  }
  
  if (formData.public_tracking_link && !isValidUrl(formData.public_tracking_link)) {
    errors.public_tracking_link = 'Invalid URL format';
  }
  
  return errors;
};
```

**Success Flow:**
1. Show loading spinner
2. Call API `PATCH /v1/orders/:id/manual-ship` with `shipped: true/false` based on checkbox
3. On success:
   - Show success message: "Shipment details updated" (or "Order shipped successfully" if shipped: true)
   - Close modal
   - Update order status in UI (if shipped: true, show `shipped`, else keep `ready_for_dispatch`)
   - Display tracking ID and vendor
   - Show tracking link (if available)
   - Refresh order details
   - Update kebab menu items based on new status

**Error Flow:**
1. Show loading spinner
2. Call API
3. On error:
   - Show error message from API
   - Highlight invalid fields
   - Keep form data for retry
   - Provide actionable guidance

### 2. Status Update Form

**When to Show:**
- **For setting `shipped`:** Order status is `ready_for_dispatch` with `tracking_id` and `vendor` already set
- **For updating status:** Order status is `shipped` or later (`shipped`, `in_transit`, `out_for_delivery`, `rto_initiated`)
- User clicks "Update Shipment Status" or "Mark as Shipped" from kebab menu
- Order has `tracking_id` (required for status updates)

**Form Fields:**

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| Status | Dropdown/Select | ✅ Yes | Must be in allowed list | Show only valid next statuses |
| Location | Text Input | ❌ No | Max 200 chars | Current shipment location |
| Description | Textarea | ❌ No | Max 500 chars | Status description/notes |
| Inventory User ID | Hidden/Auto | ✅ Yes | Current user ID | Auto-populate from session |

**Status Dropdown Logic:**
```typescript
// Determine valid next statuses based on current status
const getValidNextStatuses = (
  currentStatus: string, 
  isCodOrder: boolean, 
  hasTrackingId: boolean,
  hasVendor: boolean
) => {
  const transitions: Record<string, string[]> = {
    ready_for_dispatch: hasTrackingId && hasVendor ? ['shipped'] : [], // Only if tracking_id and vendor exist
    shipped: ['in_transit', 'out_for_delivery', 'rto_initiated'],
    in_transit: ['out_for_delivery', 'delivered', 'rto_initiated'],
    out_for_delivery: ['delivered', 'rto_initiated'],
    delivered: isCodOrder ? ['cod_payment_received'] : [],
    rto_initiated: ['rto_delivered'],
    rto_delivered: [] // Terminal
  };
  
  return transitions[currentStatus] || [];
};
```

**Status Labels (User-Friendly):**
```typescript
const statusLabels = {
  shipped: 'Shipped',
  in_transit: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  rto_initiated: 'RTO Initiated',
  rto_delivered: 'RTO Delivered',
  cod_payment_received: 'COD Payment Received'
};
```

**Form Validation:**
```typescript
const validateStatusUpdateForm = (formData, currentStatus: string, isCodOrder: boolean) => {
  const errors = {};
  
  if (!formData.status) {
    errors.status = 'Status is required';
  } else {
    const validStatuses = getValidNextStatuses(currentStatus, isCodOrder);
    if (!validStatuses.includes(formData.status)) {
      errors.status = `Invalid status. Allowed: ${validStatuses.join(', ')}`;
    }
  }
  
  // Special validation for COD payment
  if (formData.status === 'cod_payment_received' && !isCodOrder) {
    errors.status = 'COD payment status is only allowed for COD orders';
  }
  
  return errors;
};
```

**Success Flow:**
1. Show loading spinner
2. Call API `PATCH /v1/orders/:id/shipment-status`
3. On success:
   - Show success message: "Status updated successfully"
   - Close modal
   - Update order status in UI
   - Update shipment tracking status
   - Refresh order details
   - Show updated status in timeline/history
   - Update kebab menu items (if status changed to terminal state)

**Error Flow:**
1. Show loading spinner
2. Call API
3. On error:
   - Show error message from API
   - Update status dropdown to show only valid options
   - Provide guidance on correct status flow

### 3. Order Status Display

**Status Badge Colors:**
```typescript
const statusColors = {
  ready_for_dispatch: 'blue',
  shipped: 'purple',
  in_transit: 'orange',
  out_for_delivery: 'yellow',
  delivered: 'green',
  rto_initiated: 'red',
  rto_delivered: 'gray',
  cod_payment_received: 'green'
};
```

**Status Timeline:**
Display status history in chronological order:

```typescript
// Sort status_history by changed_date (newest first)
const sortedHistory = order.status_history
  .sort((a, b) => b.changed_date - a.changed_date)
  .map(entry => ({
    ...entry,
    date: new Date(entry.changed_date),
    statusLabel: statusLabels[entry.new_status] || entry.new_status,
    sourceLabel: getSourceLabel(entry.source)
  }));
```

---

## Code Examples

### React/TypeScript Example

#### Manual Ship Component

```typescript
import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';

interface ManualShipFormData {
  tracking_id: string;
  vendor: string;
  public_tracking_link?: string;
  inventory_user_id: number;
  shipped?: boolean; // NEW: Optional shipped flag
}

const ManualShipForm: React.FC<{ orderId: string | number; onSuccess: () => void }> = ({ 
  orderId, 
  onSuccess 
}) => {
  const [formData, setFormData] = useState<ManualShipFormData>({
    tracking_id: '',
    vendor: '',
    public_tracking_link: '',
    inventory_user_id: getCurrentUserId(), // From auth context
    shipped: false // Default: don't set shipped
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const manualShipMutation = useMutation({
    mutationFn: async (data: ManualShipFormData) => {
      const response = await fetch(`/v1/orders/${orderId}/manual-ship`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update shipment details');
      }

      return response.json();
    },
    onSuccess: (data) => {
      onSuccess();
      const message = data.data.orderstatus === 'shipped' 
        ? 'Order shipped successfully' 
        : 'Shipment details updated';
      showSuccessToast(message);
    },
    onError: (error: Error) => {
      setErrors({ general: error.message });
      showErrorToast(error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Frontend validation
    const validationErrors = validateManualShipForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Only include shipped in payload if explicitly set to true
    const payload = {
      tracking_id: formData.tracking_id,
      vendor: formData.vendor,
      inventory_user_id: formData.inventory_user_id,
      ...(formData.public_tracking_link && { public_tracking_link: formData.public_tracking_link }),
      ...(formData.shipped && { shipped: true }) // Only include if true
    };

    manualShipMutation.mutate(payload);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Tracking ID *</label>
        <input
          type="text"
          value={formData.tracking_id}
          onChange={(e) => setFormData({ ...formData, tracking_id: e.target.value })}
          required
        />
        {errors.tracking_id && <span className="error">{errors.tracking_id}</span>}
      </div>

      <div>
        <label>Vendor *</label>
        <select
          value={formData.vendor}
          onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
          required
        >
          <option value="">Select vendor</option>
          <option value="Delhivery">Delhivery</option>
          <option value="Shiprocket">Shiprocket</option>
          <option value="Xpressbees">Xpressbees</option>
          {/* Add more vendors */}
        </select>
        {errors.vendor && <span className="error">{errors.vendor}</span>}
      </div>

      <div>
        <label>Public Tracking Link (Optional)</label>
        <input
          type="url"
          value={formData.public_tracking_link}
          onChange={(e) => setFormData({ ...formData, public_tracking_link: e.target.value })}
        />
        {errors.public_tracking_link && <span className="error">{errors.public_tracking_link}</span>}
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={formData.shipped}
            onChange={(e) => setFormData({ ...formData, shipped: e.target.checked })}
          />
          Mark as Shipped
        </label>
        <small>If checked, order status will be set to "shipped". If unchecked, status remains "ready_for_dispatch".</small>
      </div>

      {errors.general && <div className="error">{errors.general}</div>}

      <button type="submit" disabled={manualShipMutation.isPending}>
        {manualShipMutation.isPending ? 'Updating...' : formData.shipped ? 'Ship Order' : 'Save Shipment Details'}
      </button>
    </form>
  );
};
```

#### Status Update Component

```typescript
import React, { useState, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';

interface StatusUpdateFormData {
  status: string;
  location?: string;
  description?: string;
  inventory_user_id: number;
}

const StatusUpdateForm: React.FC<{ 
  orderId: string | number; 
  currentStatus: string;
  isCodOrder: boolean;
  hasTrackingId: boolean;
  hasVendor: boolean; // NEW: Check if vendor exists (required for ready_for_dispatch → shipped)
  onSuccess: () => void;
}> = ({ orderId, currentStatus, isCodOrder, hasTrackingId, hasVendor, onSuccess }) => {
  const [formData, setFormData] = useState<StatusUpdateFormData>({
    status: '',
    location: '',
    description: '',
    inventory_user_id: getCurrentUserId()
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get valid next statuses based on current status
  const validStatuses = useMemo(() => {
    // Only show 'shipped' if order is ready_for_dispatch with tracking_id AND vendor
    if (currentStatus === 'ready_for_dispatch' && hasTrackingId && hasVendor) {
      return ['shipped'];
    }
    return getValidNextStatuses(currentStatus, isCodOrder, hasTrackingId, hasVendor);
  }, [currentStatus, isCodOrder, hasTrackingId, hasVendor]);
  
  // Note: hasVendor should be passed as prop: hasVendor={!!order.vendor}

  const statusUpdateMutation = useMutation({
    mutationFn: async (data: StatusUpdateFormData) => {
      const response = await fetch(`/v1/orders/${orderId}/shipment-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update status');
      }

      return response.json();
    },
    onSuccess: (data) => {
      onSuccess();
      showSuccessToast('Status updated successfully');
    },
    onError: (error: Error) => {
      setErrors({ general: error.message });
      showErrorToast(error.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Frontend validation
    const validationErrors = validateStatusUpdateForm(formData, currentStatus, isCodOrder);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    statusUpdateMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Status *</label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          required
        >
          <option value="">Select status</option>
          {validStatuses.map(status => (
            <option key={status} value={status}>
              {statusLabels[status] || status}
            </option>
          ))}
        </select>
        {errors.status && <span className="error">{errors.status}</span>}
      </div>

      <div>
        <label>Location (Optional)</label>
        <input
          type="text"
          value={formData.location}
          onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          maxLength={200}
        />
      </div>

      <div>
        <label>Description (Optional)</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          maxLength={500}
          rows={3}
        />
      </div>

      {errors.general && <div className="error">{errors.general}</div>}

      <button type="submit" disabled={statusUpdateMutation.isPending || validStatuses.length === 0}>
        {statusUpdateMutation.isPending ? 'Updating...' : 'Update Status'}
      </button>
    </form>
  );
};
```

### Axios Example

```typescript
import axios from 'axios';

const API_BASE_URL = 'https://api.yourdomain.com/v1';

// Manual Ship
export const manualShipOrder = async (
  orderId: string | number,
  data: {
    tracking_id: string;
    vendor: string;
    inventory_user_id: number;
    public_tracking_link?: string;
    shipped?: boolean; // NEW: Optional shipped flag
  }
) => {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/orders/${orderId}/manual-ship`,
      data,
      {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error: any) {
    if (error.response) {
      // API error response
      throw new Error(error.response.data.message || 'Failed to ship order');
    } else if (error.request) {
      // Network error
      throw new Error('Network error. Please check your connection.');
    } else {
      // Other error
      throw error;
    }
  }
};

// Update Shipment Status
export const updateShipmentStatus = async (
  orderId: string | number,
  data: {
    status: string;
    inventory_user_id: number;
    location?: string;
    description?: string;
  }
) => {
  try {
    const response = await axios.patch(
      `${API_BASE_URL}/orders/${orderId}/shipment-status`,
      data,
      {
        headers: {
          'Authorization': `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error: any) {
    if (error.response) {
      throw new Error(error.response.data.message || 'Failed to update status');
    } else if (error.request) {
      throw new Error('Network error. Please check your connection.');
    } else {
      throw error;
    }
  }
};
```

---

## Best Practices

### 1. Order ID Handling

**Accept Both Formats:**
- Database ID: `123` (number)
- Order Number: `"ORD-1234567890"` (string)

**Frontend Implementation:**
```typescript
// Use order number for display, but accept both
const orderId = order.orderid || order.id; // Prefer orderid (order number)
```

### 2. Vendor Selection

**Recommended Approach:**
- Provide dropdown with common vendors
- Allow "Other" option with custom input
- Validate vendor name (not empty, not "EKART")
- Show vendor-specific tracking URL format hint

### 3. Status Update UI

**Recommended Approach:**
- Show current status prominently
- Display only valid next statuses in dropdown
- Show status transition diagram/flow
- Disable form if no valid transitions available
- Show warning for EKART orders (webhook may overwrite)
- **For `ready_for_dispatch` with tracking_id AND vendor:** Show "Mark as Shipped" option (only `shipped` status allowed)
- **Validation:** Ensure both `tracking_id` and `vendor` exist before allowing `shipped` status from `ready_for_dispatch`

### 4. Error Handling

**Recommended Approach:**
- Always check `success` field before accessing `data`
- Display user-friendly error messages
- Provide actionable guidance (e.g., "Order must be ready for dispatch")
- Log errors for debugging
- Implement retry mechanism for network errors

### 5. Loading States

**Recommended Approach:**
- Show loading spinner during API calls
- Disable form inputs during submission
- Show progress indicator for long operations
- Provide cancel option for long-running requests

### 6. Data Refresh

**Recommended Approach:**
- Refresh order details after successful update
- Update local state/cache
- Show success message with updated data
- Refresh order list if on list page

### 7. Validation

**Recommended Approach:**
- Validate on frontend before API call
- Show inline validation errors
- Highlight invalid fields
- Provide helpful hints (e.g., "Tracking ID format: ABC123456789")

### 8. User Experience

**Recommended Approach:**
- Show confirmation dialog for critical actions
- Provide undo option where possible
- Show status history timeline
- Display tracking link as clickable URL
- Show vendor name prominently
- **Make `shipped` checkbox clear:** Explain that checking it will set status to shipped, unchecking keeps it as ready_for_dispatch

---

## Complete Flow Examples

### Scenario 1: Manual Vendor Shipment (One-Step with Shipped)

```typescript
// Step 1: User selects order in ready_for_dispatch status
const order = {
  id: 123,
  orderid: "ORD-1234567890",
  orderstatus: "ready_for_dispatch",
  vendor: null,
  tracking_id: null
};

// Step 2: User fills manual ship form with shipped: true
const formData = {
  tracking_id: "DEL123456789",
  vendor: "Delhivery",
  inventory_user_id: 456,
  public_tracking_link: "", // Optional, will be auto-generated
  shipped: true // Sets status to shipped
};

// Step 3: Call manual-ship API
const response = await manualShipOrder(order.id, formData);

// Step 4: Order is now shipped
// response.data.orderstatus = "shipped"
// response.data.tracking_id = "DEL123456789"
// response.data.vendor = "Delhivery"

// Step 5: Later, update status to delivered
const statusUpdate = {
  status: "delivered",
  inventory_user_id: 456,
  location: "Mumbai Hub",
  description: "Delivered to customer"
};

await updateShipmentStatus(order.id, statusUpdate);
```

### Scenario 2: Manual Vendor Shipment (Two-Step: Details First, Then Shipped via shipment-status)

```typescript
// Step 1: User selects order in ready_for_dispatch status
const order = {
  id: 123,
  orderid: "ORD-1234567890",
  orderstatus: "ready_for_dispatch",
  vendor: null,
  tracking_id: null
};

// Step 2: User fills manual ship form WITHOUT shipped flag (or shipped: false)
const formData = {
  tracking_id: "DEL123456789",
  vendor: "Delhivery",
  inventory_user_id: 456,
  public_tracking_link: "",
  shipped: false // Or omit - keeps status as ready_for_dispatch
};

// Step 3: Call manual-ship API
const response = await manualShipOrder(order.id, formData);

// Step 4: Order still in ready_for_dispatch, but has tracking_id and vendor
// response.data.orderstatus = "ready_for_dispatch"
// response.data.tracking_id = "DEL123456789"
// response.data.vendor = "Delhivery"

// Step 5: Later, mark as shipped via shipment-status endpoint
const shippedUpdate = {
  status: "shipped",
  inventory_user_id: 456,
  location: "Warehouse",
  description: "Package picked up by courier"
};

await updateShipmentStatus(order.id, shippedUpdate);

// Step 6: Order is now shipped
// response.data.orderstatus = "shipped"
// response.data.shipdate = 1234567890000
// Now can update to in_transit, delivered, etc.
```

### Scenario 3: Setting Shipped from ready_for_dispatch (Alternative Two-Step Flow)

This scenario shows using `shipment-status` endpoint to set `shipped` when order already has tracking_id and vendor:

```typescript
// Step 1: Order already has tracking_id and vendor (from previous manual-ship call)
const order = {
  id: 123,
  orderid: "ORD-1234567890",
  orderstatus: "ready_for_dispatch",
  vendor: "Delhivery",
  tracking_id: "DEL123456789"
};

// Step 2: Use shipment-status endpoint to mark as shipped
const shippedUpdate = {
  status: "shipped",
  inventory_user_id: 456,
  location: "Warehouse",
  description: "Package picked up by courier"
};

await updateShipmentStatus(order.id, shippedUpdate);

// Step 3: Order is now shipped
// response.data.orderstatus = "shipped"
// response.data.shipdate = 1234567890000
// response.data.label_printed_at = 1234567890000

// Step 4: Continue with normal status updates
const inTransitUpdate = {
  status: "in_transit",
  inventory_user_id: 456,
  location: "Mumbai Hub",
  description: "Package in transit"
};

await updateShipmentStatus(order.id, inTransitUpdate);
```

---

## Testing Checklist

### Manual Ship Endpoint

- [ ] Successfully ship order with `shipped: true` (status changes to shipped)
- [ ] Successfully update shipment details with `shipped: false` (status remains ready_for_dispatch)
- [ ] Successfully update shipment details without `shipped` field (status remains ready_for_dispatch)
- [ ] Reject if order not in `ready_for_dispatch` or `shipped`
- [ ] Reject cancelled orders (`cancelled`, `cancelled_refund_processing`, `cancelled_refunded`, `cancelled_completed`)
- [ ] Reject returned orders (`returned`)
- [ ] Reject if tracking_id is empty
- [ ] Reject if vendor is empty
- [ ] Reject if vendor is "EKART"
- [ ] Auto-generate tracking link if not provided
- [ ] Handle order not found (404)
- [ ] Handle network errors gracefully
- [ ] Show loading state during API call
- [ ] Refresh order details after success
- [ ] Update UI based on `shipped` flag (show correct status)

### Status Update Endpoint

- [ ] Successfully update status with valid transition
- [ ] Successfully set `shipped` from `ready_for_dispatch` (if tracking_id AND vendor exist)
- [ ] Reject setting `shipped` from `ready_for_dispatch` if tracking_id missing
- [ ] Reject setting `shipped` from `ready_for_dispatch` if vendor missing
- [ ] Reject setting non-shipped status from `ready_for_dispatch` (only `shipped` allowed)
- [ ] Reject cancelled orders (`cancelled`, `cancelled_refund_processing`, `cancelled_refunded`, `cancelled_completed`)
- [ ] Reject returned orders (`returned`)
- [ ] Reject invalid status values
- [ ] Reject invalid status transitions
- [ ] Reject if order has no tracking_id
- [ ] Reject COD payment for non-COD orders
- [ ] Allow flexible transitions (shipped → out_for_delivery)
- [ ] Store location and description in status_history
- [ ] Handle order not found (404)
- [ ] Show warning for EKART orders
- [ ] Refresh order details after success

---

## Support & Resources

### Related Documentation

- `MANUAL_VENDOR_FULFILLMENT_COMPLETE.md` - Complete backend implementation details
- `ORDER_FULFILLMENT_FLOW_COMPLETE.md` - EKART fulfillment flow (for comparison)
- `ORDER_ORDERLINE_STATUS_REFERENCE.md` - Complete status reference

### API Base URL

```
Production: https://api.yourdomain.com/v1
Staging: https://api-staging.yourdomain.com/v1
Development: http://localhost:3000/v1
```

### Support Contacts

- Backend Team: [Contact Info]
- Frontend Team Lead: [Contact Info]

---

**Last Updated:** January 2025  
**Version:** 2.0

