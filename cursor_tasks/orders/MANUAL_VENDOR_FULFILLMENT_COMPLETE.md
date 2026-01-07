# Manual Vendor Fulfillment - Complete Guide

**Version 1.0** - 07 Jan 2026  
**Single Source of Truth** for manual vendor fulfillment implementation

This document consolidates all manual vendor fulfillment documentation including design, implementation, clarifications, and status rules.

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Reference: EKART Doesn't Collect](#quick-reference-ekart-doesnt-collect)
3. [Current EKART Flow (Reference)](#current-ekart-flow-reference)
4. [Manual Vendor Support - Complete Design](#manual-vendor-support-complete-design)
5. [API Endpoints](#api-endpoints)
6. [Status Rules & Validation](#status-rules--validation)
7. [Implementation Details](#implementation-details)
8. [Testing Checklist](#testing-checklist)

---

## Overview

### Purpose

This document describes the complete implementation for supporting **manual logistics vendors** (e.g., Shipway, Shiprocket) alongside the existing EKART integration. Manual vendors require:
- Manual entry of tracking ID (AWB) and vendor name
- Manual status updates (no webhook automation)

**Key Use Case:** If EKART shipment is created but EKART doesn't collect the product, you can switch to a manual vendor using `PATCH /v1/orders/:id/manual-ship`.

---

## Quick Reference: EKART Doesn't Collect

**Scenario:** You created EKART shipment via `POST /v1/ekart/shipments/forward`, but EKART doesn't collect the product.

**What Happens:**
- Order remains in `ready_for_dispatch` status (no webhook received)
- EKART shipment exists but not collected
- `mark-shipped` is NOT called (webhook would have set shipped, but no webhook came)

**Solution:** Switch to manual vendor

**API Call:**
```http
PATCH /v1/orders/:id/manual-ship
Content-Type: application/json

{
  "tracking_id": "DEL123456789",  // New manual vendor tracking ID
  "vendor": "Delhivery",          // New manual vendor name
  "inventory_user_id": 123
}
```

**What Gets Updated:**
- ✅ `tracking_id` → New manual vendor tracking ID
- ✅ `vendor` → New manual vendor name
- ✅ `public_tracking_link` → New manual vendor URL
- ✅ `orderstatus` → `shipped` (automatic)
- ✅ All orderlines → `shipped`
- ✅ `status_history` → Updated
- ✅ **EKART fields reset:** `label_url`, `barcodes`, `shipment_tracking_status` → `null`

**Result:** Order is now shipped with manual vendor, ready for manual status updates.

**See:** [EKART-to-Manual Vendor Switch Flow](#ekart-to-manual-vendor-switch-flow) for complete details.

---

### Key Principles

1. **Vendor-Agnostic Design:** Same endpoints work for both EKART and manual vendors where applicable
2. **No Breaking Changes:** EKART flow remains completely unchanged
3. **Clear Separation:** Vendor field differentiates EKART vs manual vendors
4. **Status Ownership:** `shipped` is always set by our system, regardless of vendor type
5. **EKART-to-Manual Switch:** Supports switching from EKART to manual vendor if EKART doesn't collect

---

## Current EKART Flow (Reference)

### Flow Summary

```
ready_for_dispatch
    ↓
[Create EKART Shipment] ← POST /v1/ekart/shipments/forward
    - Updates: tracking_id, vendor="EKART", barcodes, public_tracking_link
    - NO status change (remains ready_for_dispatch)
    ↓
[Download Label] ← POST /v1/ekart/shipments/label
    - Updates: label_url
    - NO status change
    ↓
[Mark-as-Shipped] ← PATCH /v1/orders/:id/mark-shipped
    - Updates: orderstatus → "shipped", shipdate, label_printed_at
    - Updates: status_history
    ↓
[EKART Webhook] ← POST /v1/ekart/webhook/track-status
    - Updates: shipment_tracking_status
    - May update: orderstatus (in_transit, out_for_delivery, delivered)
    ↓
in_transit → out_for_delivery → delivered
```

### Key Characteristics

- ✅ Automated shipment creation via EKART API
- ✅ Automatic status updates via webhook
- ✅ `shipped` status set by system (`mark-shipped` endpoint)
- ✅ Vendor always `"EKART"`

---

## Manual Vendor Support - Complete Design

### Flow Summary

```
ready_for_dispatch
    ↓
[Manual Ship] ← PATCH /v1/orders/:id/manual-ship
    - Updates: tracking_id, vendor="Shipway", public_tracking_link
    - Updates: orderstatus → "shipped" (AUTOMATIC)
    - Updates: All orderlines → "shipped"
    - Updates: status_history
    - One-step process (no separate mark-shipped needed)
    ↓
[Manual Status Update] ← PATCH /v1/orders/:id/shipment-status
    - Updates: shipment_tracking_status, orderstatus
    - Updates: status_history
    - Admin manually updates status
    ↓
in_transit → out_for_delivery → delivered
```

### Key Differences from EKART

| Aspect | EKART | Manual Vendors |
|--------|-------|----------------|
| **Shipment Creation** | Automated via API (`POST /v1/ekart/shipments/forward`) | Manual entry (`PATCH /v1/orders/:id/manual-ship`) |
| **`shipped` Status** | **Webhook sets automatically** (first webhook after pickup) | System sets via `manual-ship` (automatic, one-step) |
| **Status Updates** | Webhook (automatic) | Manual update only |
| **Vendor Field** | `"EKART"` | `"Shipway"`, `"Shiprocket"`, etc. |
| **Workflow** | Create shipment → Download label → **Webhook sets shipped** | One-step (manual-ship auto-sets shipped) |
| **`mark-shipped` Endpoint** | **NOT called in normal flow** (kept for backward compatibility) | Not used |

---

## API Endpoints

### 1. Manual Shipment Details Update

**Endpoint:** `PATCH /v1/orders/:id/manual-ship`

**Purpose:** Manually update tracking ID, vendor, and public tracking URL for non-EKART shipments. Status change to `shipped` is controlled by the `shipped` boolean in the payload.

**Request:**
```json
{
  "tracking_id": "DEL123456789",
  "vendor": "Delhivery",  // Actual logistics provider (not aggregator)
  "public_tracking_link": "https://www.delhivery.com/track/DEL123456789",  // Optional (auto-generated if not provided)
  "inventory_user_id": 123,  // Required
  "shipped": true  // Optional: If true, sets order status to shipped. If false or not provided, status remains ready_for_dispatch
}
```

**Status Behavior:**
- ✅ `shipped: true` → Sets order status to `shipped` (and all orderlines)
- ✅ `shipped: false` or not provided → Status remains `ready_for_dispatch` (no change)
- ✅ Matches user's flow: "No status for shipment created" (unless explicitly set via `shipped: true`)

**Important Notes on `vendor` and `public_tracking_link`:**
- ✅ **`vendor` field:** Should be the **actual logistics provider** (e.g., "Delhivery", "Shiprocket", "Xpressbees")
- ✅ **`public_tracking_link`:** Will be **auto-generated** based on vendor if not provided
- ✅ **Auto-generation:** System generates vendor-specific tracking URL (e.g., Delhivery → `https://www.delhivery.com/track/{tracking_id}`)
- ⚠️ **Aggregators:** If you use an aggregator platform (e.g., Shipway), set `vendor` to the **actual courier** (e.g., "Delhivery"), not the aggregator name
- ✅ **Manual override:** You can provide `public_tracking_link` manually if vendor-specific URL doesn't match your tracking ID format

**Validation:**
- ✅ Order must be in `ready_for_dispatch` OR `shipped` status
- ✅ `tracking_id` must be provided
- ✅ `vendor` must be provided and NOT `"EKART"` (reject if EKART)
- ✅ `inventory_user_id` must be provided (for status update)
- ✅ **EKART-to-Manual Switch:** If order is `shipped` with vendor="EKART", allows switching to manual vendor

**Database Updates:**

**For Fresh Manual Vendor Orders (ready_for_dispatch):**
- ✅ `tracking_id` ← Provided tracking ID
- ✅ `vendor` ← Provided vendor name (actual logistics provider, e.g., "Delhivery", "Shiprocket")
- ✅ `public_tracking_link` ← Provided or auto-generated (vendor-specific tracking URL)
- ✅ `shipment_created_at` ← Current timestamp
- ✅ **Status Behavior:**
  - If `shipped: true` → `orderstatus` → `"shipped"`, `shipdate` set, all orderlines → `"shipped"`
  - If `shipped: false` or not provided → `orderstatus` remains `ready_for_dispatch` (no change)
- ✅ **Matches user's flow:** "No status for shipment created" (unless `shipped: true` is provided)

**For EKART-to-Manual Vendor Switch (EKART didn't collect):**
- ✅ `tracking_id` ← New manual vendor tracking ID (replaces EKART tracking ID)
- ✅ `vendor` ← New manual vendor name (replaces "EKART")
- ✅ `public_tracking_link` ← New manual vendor tracking URL (replaces EKART tracking URL)
- ✅ `label_url` ← **RESET to null** (EKART label no longer valid)
- ✅ `barcodes` ← **RESET to null** (EKART barcodes no longer valid)
- ✅ `shipment_tracking_status` ← **RESET to null** (EKART tracking status cleared)
- ✅ `shipment_created_at` ← Current timestamp (if order is `ready_for_dispatch`)
- ✅ `shipdate` ← Current timestamp (if order is `ready_for_dispatch`)
- ✅ `label_printed_at` ← Current timestamp (if order is `ready_for_dispatch` OR if switching after shipped)
- ✅ `orderstatus` → `"shipped"` (if order is `ready_for_dispatch`, otherwise remains `shipped`)
- ✅ `status_history` ← Appended entry (if status changes)
- ✅ `modifieddate` ← Current timestamp

**Key Point:** When switching from EKART to manual vendor, all EKART-specific fields are reset to ensure clean data for the new vendor.

**Orderline Updates:**

**For Fresh Manual Vendor Orders (ready_for_dispatch):**
- ✅ Update all orderlines with `tracking_id`
- ✅ Update all orderlines status → `"shipped"`
- ✅ Update all orderlines `status_history` ← Appended entry
- ✅ Update all orderlines `shipdate` ← Current timestamp

**For EKART-to-Manual Vendor Switch:**
- ✅ Update all orderlines with new `tracking_id` (replaces EKART tracking ID)
- ✅ Update all orderlines status → `"shipped"` (if order is `ready_for_dispatch`)
- ✅ Update all orderlines `status_history` ← Appended entry (if status changes)
- ✅ Update all orderlines `shipdate` ← Current timestamp (if order is `ready_for_dispatch`)

**Response:**
```json
{
  "success": true,
  "message": "Shipment details updated and order marked as shipped",
  "data": {
    "id": 123,
    "orderid": "ORD-1234567890",
    "tracking_id": "SHIPWAY123456789",
    "vendor": "Shipway",
    "public_tracking_link": "https://shipway.com/track/SHIPWAY123456789",
    "orderstatus": "shipped",  // Automatically set to shipped
    "shipdate": 1234567890000
  }
}
```

**Key Benefits:**
- ✅ **One-step process** for manual vendors (simpler workflow)
- ✅ **No separate `mark-shipped` call needed** for manual vendors
- ✅ **EKART flow unchanged** (EKART doesn't use this endpoint)
- ✅ **Consistent with workflow:** Once tracking ID is entered, package is shipped

**Note:** For manual vendors, this endpoint combines shipment details update + mark-as-shipped in one call. EKART flow remains separate (uses EKART API endpoint + mark-shipped). For EKART mark-shipped details, see `ORDER_FULFILLMENT_FLOW_COMPLETE.md`.

---

### 2. Manual Status Update

**Endpoint:** `PATCH /v1/orders/:id/shipment-status`

**Purpose:** Manually update shipment tracking status (works for ALL vendors)

**Request:**
```json
{
  "status": "in_transit",  // or "out_for_delivery", "delivered", etc.
  "location": "Mumbai Hub",  // Optional
  "description": "Shipment is in transit",  // Optional
  "inventory_user_id": 123  // Required
}
```

**Validation:**
- ✅ Order must have `tracking_id`
- ✅ Order must be in `shipped` or later status
- ✅ Status must be in allowed list (see [Status Rules](#status-rules--validation))
- ✅ Valid status transition (see [Status Rules](#status-rules--validation))
- ⚠️ **Warning (logged) if vendor = "EKART"** (may be overwritten by webhook)

**Database Updates:**
- ✅ `shipment_tracking_status` ← Provided status
- ✅ `orderstatus` ← Updated based on status (e.g., `delivered` → `orderstatus = "delivered"`)
- ✅ `status_history` ← Appended entry
- ✅ All orderlines updated with same status

**Response:**
```json
{
  "success": true,
  "message": "Shipment status updated successfully",
  "data": {
    "id": 123,
    "orderid": "ORD-1234567890",
    "orderstatus": "in_transit",
    "shipment_tracking_status": "in_transit",
    "vendor": "Shipway"
  }
}
```

**Works For:**
- ✅ **EKART orders:** Manual update allowed (with warning)
- ✅ **Manual vendor orders:** Normal operation

---

## Status Rules & Validation

### Allowed Shipment Statuses

After `shipped`, vendors can update to these statuses **ONLY**:

| Status | Description | Can Update From | Notes |
|--------|-------------|-----------------|-------|
| `in_transit` | Package in transit | `shipped` | Vendor can update |
| `out_for_delivery` | Out for delivery | `in_transit` or `shipped` | Vendor can update |
| `delivered` | Delivered to customer | `out_for_delivery` or `in_transit` | Vendor can update |
| `rto_initiated` | Return to origin started | `in_transit`, `out_for_delivery`, or `shipped` | Vendor can update (delivery failed) |
| `rto_delivered` | RTO delivered to warehouse | `rto_initiated` | Vendor can update |
| `cod_payment_received` | COD payment collected | `delivered` | Vendor can update (COD orders only) |

**Important:**
- ❌ `shipped` is **NOT** in this list - it's set by system via `mark-shipped`
- ✅ Status values are **case-sensitive** (use lowercase with underscores)

### Status Transition Rules

**Valid Transitions:**

| Current Status | Allowed Next Statuses |
|----------------|----------------------|
| `shipped` | `in_transit`, `out_for_delivery`, `rto_initiated` |
| `in_transit` | `out_for_delivery`, `delivered`, `rto_initiated` |
| `out_for_delivery` | `delivered`, `rto_initiated` |
| `delivered` | `cod_payment_received` (COD only) |
| `rto_initiated` | `rto_delivered` |
| `rto_delivered` | ❌ None (terminal) |

**Invalid Transitions (Rejected):**
- ❌ Going backwards (e.g., `in_transit` → `shipped`)
- ❌ Skipping stages (e.g., `shipped` → `delivered` without `in_transit`)
- ❌ Invalid combinations (e.g., `delivered` → `in_transit`)

### Validation Flow

**Step 1: Prerequisites**
- ✅ Order exists
- ✅ Order has `tracking_id`
- ✅ Order is not `cancelled` or `returned`
- ✅ Order is `ready_for_dispatch` or later

**Step 2: Status Value Validation**
- ✅ Status is in allowed list
- ✅ Status is not `shipped` (system-controlled)

**Step 3: Transition Validation**
- ✅ Current status allows transition to new status
- ✅ No backwards transitions
- ✅ No invalid combinations

**Step 4: Special Case Validation**
- ✅ COD payment only for COD orders
- ✅ RTO delivered only from `rto_initiated`
- ✅ Terminal statuses cannot be updated

**Step 5: Idempotency Check**
- ✅ If status unchanged, return early (no-op)

---

## System vs Vendor Responsibility

### System-Controlled Statuses (Pre-Dispatch)

| Status | Set By | Endpoint/Flow |
|--------|--------|---------------|
| `order_placed` | System | Order creation |
| `payment_completed` | System | PhonePe callback / COD acceptance |
| `order_confirmed` | System | Auto-confirmation |
| `packed` | Inventory User | Warehouse packing |
| `ready_for_dispatch` | Inventory User | `PATCH /v1/orders/:id/ready-for-dispatch` |

**Boundary:** `ready_for_dispatch` is the **last system-controlled status**.

### Vendor-Controlled Statuses (Post-Dispatch)

After `ready_for_dispatch`, status updates come from:

| Status | Set By | Method | Applies To |
|--------|--------|--------|------------|
| `shipped` | **Our System** | `PATCH /v1/orders/:id/mark-shipped` (EKART) OR `PATCH /v1/orders/:id/manual-ship` (Manual) | **EKART uses mark-shipped, Manual uses manual-ship** |
| `in_transit` | **Vendor** | EKART webhook OR manual update | Both vendor types |
| `out_for_delivery` | **Vendor** | EKART webhook OR manual update | Both vendor types |
| `delivered` | **Vendor** | EKART webhook OR manual update | Both vendor types |
| `rto_initiated` | **Vendor** | EKART webhook OR manual update | Both vendor types |
| `rto_delivered` | **Vendor** | EKART webhook OR manual update | Both vendor types |
| `cod_payment_received` | **Vendor** | EKART webhook OR manual update | Both vendor types |

**Key Rule:**
- ✅ **After `ready_for_dispatch`:** Vendor updates only (webhook or manual)
- ✅ **Exception:** `shipped` is **ALWAYS** set by **our system**, but via different endpoints:
  - **EKART orders:** System sets `shipped` via `PATCH /v1/orders/:id/mark-shipped` (after EKART shipment created and label printed)
  - **Manual vendor orders:** System sets `shipped` automatically via `PATCH /v1/orders/:id/manual-ship` (one-step process)
  - **Different endpoints:** EKART uses `mark-shipped`, Manual vendors use `manual-ship`
- ✅ **After `shipped`:** All subsequent statuses are vendor-controlled

---

## Implementation Details

### Database Schema

**No schema changes required!** ✅

All necessary fields already exist:
- `tracking_id` (String?, VarChar(500)) - Can store any vendor's tracking ID
- `vendor` (String?, VarChar(100), default: "EKART") - Can store any vendor name
- `shipment_tracking_status` (String?, VarChar(500)) - Can store status from any vendor
- `public_tracking_link` (String?) - Can store any vendor's tracking URL

### Vendor Differentiation

**Logic:**
- `vendor = "EKART"` → EKART flow (automated)
- `vendor != "EKART"` → Manual vendor flow (manual updates)

**Benefits:**
- ✅ No schema changes needed
- ✅ Clean separation of concerns
- ✅ Easy to identify vendor type
- ✅ Backward compatible

### Public Tracking Link Management

**Strategy for `public_tracking_link`:**

1. **EKART Orders:**
   - ✅ Auto-generated: `https://app.elite.ekartlogistics.in/track/{tracking_id}`
   - ✅ Managed by EKART API integration

2. **Manual Vendor Orders:**
   - ✅ **Auto-generation:** System generates vendor-specific tracking URL based on `vendor` field
   - ✅ **Manual override:** Can provide `public_tracking_link` in request payload
   - ✅ **Vendor field:** Should be the **actual logistics provider** (e.g., "Delhivery", "Shiprocket", "Xpressbees")

**Important Rules:**
- ✅ **Use actual courier name:** Set `vendor` to the actual logistics provider (e.g., "Delhivery"), not aggregator platforms
- ✅ **Auto-generation:** If `public_tracking_link` not provided, system generates based on vendor mapping
- ✅ **Manual override:** You can provide `public_tracking_link` manually if:
  - Vendor-specific URL format doesn't match your tracking ID
  - You're using a custom tracking portal
  - You're using an aggregator platform's tracking URL

**Common Vendor Tracking URLs (Auto-Generated):**
- `Delhivery` → `https://www.delhivery.com/track/{tracking_id}`
- `Shiprocket` → `https://shiprocket.co/tracking/{tracking_id}`
- `Xpressbees` → `https://www.xpressbees.com/track/{tracking_id}`
- `BlueDart` → `https://www.bluedart.com/track/{tracking_id}`
- `DTDC` → `https://www.dtdc.in/tracking/{tracking_id}`
- `FedEx` → `https://www.fedex.com/apps/fedextrack/?tracknumbers={tracking_id}`
- `Shadowfax` → `https://shadowfax.in/track/{tracking_id}`

**Example Scenarios:**

**Scenario 1: Direct Courier (Recommended)**
```json
{
  "tracking_id": "DEL123456789",
  "vendor": "Delhivery",  // Actual courier
  // public_tracking_link auto-generated: https://www.delhivery.com/track/DEL123456789
}
```

**Scenario 2: Using Aggregator Platform**
```json
{
  "tracking_id": "SR123456789",
  "vendor": "Shiprocket",  // Actual courier (not aggregator name)
  // public_tracking_link auto-generated: https://shiprocket.co/tracking/SR123456789
}
```

**Scenario 3: Custom Tracking URL (Manual Override)**
```json
{
  "tracking_id": "CUSTOM123456",
  "vendor": "CustomCourier",
  "public_tracking_link": "https://custom-tracking-portal.com/track/CUSTOM123456"  // Manual override
}
```

**Note:** Do NOT use aggregator tracking pages (e.g., `https://shipway.in/delhivery`) as `public_tracking_link`. Use the actual courier's tracking URL for direct customer access.

### EKART Webhook Protection

**Modification:** EKART webhook handler only processes EKART orders

```typescript
// After finding order by tracking_id
if (order.vendor !== 'EKART') {
  logger.info(
    { orderId: order.id, vendor: order.vendor, trackingId },
    'Ekart webhook received for non-EKART order - ignoring (manual vendor)'
  );
  return reply.code(200).send(
    createSuccessResponse(
      'Webhook received but order is not EKART - no action taken',
      { orderId: order.id, vendor: order.vendor }
    )
  );
}
// Continue with EKART webhook processing...
```

### Track Order Enhancement

**Endpoint:** `GET /v1/orders/:id/track`

**Behavior:**
- **EKART orders:** Calls EKART API for real-time tracking
- **Manual vendors:** Returns stored tracking info (shipment_tracking_status, public_tracking_link)

---

## Complete Flow Comparison

### EKART Flow (2 Steps + Webhook-Driven Status Updates)

```
ready_for_dispatch
    ↓
1. POST /v1/ekart/shipments/forward
    - tracking_id, vendor="EKART" stored
    - Invoice generated automatically
    - NO status change (metadata only, remains ready_for_dispatch)
    ↓
2. POST /v1/ekart/shipments/label (optional)
    - label_url stored
    - NO status change (metadata only)
    ↓
3. POST /v1/ekart/webhook/track-status (automatic - "Shipped" or "Pick Up")
    - Stores: shipment_tracking_status = "Shipped" (original)
    - Updates: orderstatus → shipped (mapped)
    - Updates: All orderlines → shipped
    - Updates: status_history
    - Sets: shipdate (from pickupTime)
    ↓
shipped
    ↓
4. POST /v1/ekart/webhook/track-status (automatic - subsequent updates)
    - shipment_tracking_status updated (original EKART status)
    - orderstatus updated (mapped system status)
    - All orderlines updated
    - status_history updated
    ↓
in_transit → out_for_delivery → delivered
```

**Important Notes:**
- ✅ **`mark-shipped` endpoint is NOT called** in normal EKART flow
- ✅ **Webhook automatically sets `shipped` status** when pickup is confirmed
- ✅ **If EKART doesn't collect:** Order remains `ready_for_dispatch`, can switch to manual vendor

### Manual Vendor Flow (1 Step + Manual Updates)

```
ready_for_dispatch
    ↓
1. PATCH /v1/orders/:id/manual-ship
    - tracking_id, vendor="Shipway" stored
    - orderstatus → "shipped" (AUTOMATIC)
    - All orderlines → "shipped"
    - One-step process (no mark-shipped needed)
    ↓
shipped
    ↓
2. PATCH /v1/orders/:id/shipment-status (manual)
    - shipment_tracking_status updated
    - orderstatus updated (in_transit, delivered, etc.)
    ↓
in_transit → out_for_delivery → delivered
```

**Key Differences:**
- **EKART:** 2-step process (create shipment → download label) + webhook-driven status updates
- **Manual Vendors:** 1-step process (manual-ship automatically sets shipped) + manual status updates
- **Invoice generation:** Moved to create shipment (EKART) - happens automatically
- **`shipped` status:** Set by EKART webhook (first webhook after pickup) for EKART orders
- **`mark-shipped` endpoint:** Kept for backward compatibility and manual override (not required for normal EKART flow)

### EKART-to-Manual Vendor Switch Flow

**Scenario:** EKART shipment created via `POST /v1/ekart/shipments/forward` but EKART doesn't collect the product (refuses to pick up)

**When This Happens:**
- Order is in `ready_for_dispatch` status
- EKART shipment created successfully (tracking_id, vendor="EKART", label_url stored)
- Label downloaded and printed
- **EKART doesn't collect** - No pickup, no webhook received
- Order remains in `ready_for_dispatch` status (webhook never came)

**Solution:** Switch to manual vendor using `PATCH /v1/orders/:id/manual-ship`

**Complete Flow:**
```
ready_for_dispatch
    ↓
[1. Create EKART Shipment] ← POST /v1/ekart/shipments/forward
    - tracking_id: "EKART123" stored
    - vendor: "EKART" stored
    - barcodes: {wbn, order, cod} stored
    - public_tracking_link: EKART tracking URL stored
    - Invoice generated automatically
    - Status: ready_for_dispatch (NO CHANGE - metadata only)
    ↓
[2. Download Label] ← POST /v1/ekart/shipments/label (optional)
    - label_url: GCP Storage URL stored
    - Status: ready_for_dispatch (NO CHANGE - metadata only)
    ↓
[3. EKART Doesn't Collect] ← No pickup, no webhook received
    - Order still in: ready_for_dispatch
    - No status change (webhook never came)
    - EKART shipment exists but not collected
    ↓
[4. Switch to Manual Vendor] ← PATCH /v1/orders/:id/manual-ship
    Request:
    {
      "tracking_id": "DEL123456789",  // New manual vendor tracking ID
      "vendor": "Delhivery",          // New manual vendor name
      "inventory_user_id": 123
    }
    
    Database Updates:
    - tracking_id: "EKART123" → "DEL123456789" (replaced)
    - vendor: "EKART" → "Delhivery" (replaced)
    - public_tracking_link: Updated to Delhivery URL
    - label_url: RESET to null (EKART label no longer valid)
    - barcodes: RESET to null (EKART barcodes no longer valid)
    - shipment_tracking_status: RESET to null (EKART status cleared)
    - shipment_created_at: Updated to current timestamp
    - shipdate: Updated to current timestamp
    - label_printed_at: Updated to current timestamp
    - orderstatus: ready_for_dispatch → shipped (AUTOMATIC)
    - status_history: Updated with status change
    - All orderlines: tracking_id updated, status → shipped
    ↓
shipped (vendor="Delhivery")
    ↓
[5. Manual Status Updates] ← PATCH /v1/orders/:id/shipment-status (manual)
    - shipment_tracking_status updated
    - orderstatus updated (in_transit, delivered, etc.)
    ↓
in_transit → out_for_delivery → delivered
```

**Key Points:**
- ✅ **`mark-shipped` is NOT called** - Webhook would have set shipped, but since EKART didn't collect, no webhook came
- ✅ **Order remains `ready_for_dispatch`** until manual vendor switch
- ✅ **All EKART fields reset** - Clean data for new vendor
- ✅ **One-step switch** - `manual-ship` automatically sets shipped status
- ✅ **Works for both scenarios:**
  - `ready_for_dispatch` → Switch to manual vendor (EKART didn't collect)
  - `shipped` → Switch to manual vendor (EKART collected but refused later)

**Important:** When switching from EKART to manual vendor, all EKART-specific fields are reset to ensure clean data for the new vendor.

---

## Testing Checklist

### Shipment Details Update
- [ ] Manual shipment details update (tracking_id + vendor)
- [ ] Reject EKART vendor in manual-ship endpoint
- [ ] Reject if order not in ready_for_dispatch
- [ ] Verify status automatically changes to "shipped"
- [ ] Verify orderlines tracking_id updated
- [ ] Verify orderlines status updated to "shipped"

### Mark-as-Shipped
- [ ] Mark EKART order as shipped
- [ ] Mark manual vendor order as shipped
- [ ] Reject if no tracking_id
- [ ] Verify status changes to "shipped"
- [ ] Verify status_history updated

### Status Updates
- [ ] Manual status update for EKART orders (with warning)
- [ ] Manual status update for manual vendor orders
- [ ] Reject invalid status values
- [ ] Reject invalid transitions
- [ ] Allow valid transitions
- [ ] Reject COD payment for non-COD orders
- [ ] Allow idempotent updates

### Webhook Protection
- [ ] EKART webhook ignores non-EKART orders
- [ ] EKART webhook processes EKART orders

### Track Order
- [ ] Track EKART order (API call)
- [ ] Track manual vendor order (stored data)

---

## Summary

### Key Points

1. **`manual-ship` endpoint (Manual Vendors):**
   - ✅ Updates metadata (tracking_id, vendor, public_tracking_link)
   - ✅ **Automatically sets `shipped` status** (one-step process)
   - ✅ Updates all orderlines to `shipped`
   - ✅ Updates `status_history`
   - ✅ **Simplified workflow** for manual vendors (no separate mark-shipped needed)

2. **`mark-shipped` endpoint (Backward Compatibility):**
   - ⚠️ **NOT called in normal EKART flow** - Webhook automatically sets `shipped` status
   - ✅ **Kept for backward compatibility** and manual override scenarios only
   - ❌ **NOT used for manual vendors:** Manual vendors use `manual-ship` endpoint instead
   - ✅ **Clear separation:** EKART uses webhook, Manual vendors use `manual-ship`

3. **`shipment-status` endpoint:**
   - ✅ Updates status **after** `shipped`
   - ✅ Works for **all vendors** (EKART + manual)
   - ✅ Updates both `shipment_tracking_status` and `orderstatus`

4. **Status Ownership:**
   - ✅ `shipped` is **ALWAYS** set by our system (regardless of vendor type)
   - ✅ **EKART:** Set automatically via webhook (first webhook after pickup confirms shipment)
   - ✅ **Manual vendors:** Set automatically via `manual-ship` endpoint (one-step process)
   - ✅ **Different methods:** EKART uses webhook, Manual vendors use `manual-ship`
   - ✅ After `shipped`, vendors control subsequent statuses

5. **EKART-to-Manual Vendor Switch:**
   - ✅ **Scenario:** EKART shipment created (`POST /v1/ekart/shipments/forward`) but EKART doesn't collect
   - ✅ **Solution:** Use `PATCH /v1/orders/:id/manual-ship` to switch to manual vendor
   - ✅ **Works when:** Order is `ready_for_dispatch` (EKART didn't collect, no webhook)
   - ✅ **Also works when:** Order is `shipped` (EKART collected but refused later)
   - ✅ **All EKART fields reset:** label_url, barcodes, shipment_tracking_status cleared

### Required Code Updates

#### 1. New Service Method: `updateShipmentDetails`

**File:** `src/services/orders.service.ts`

**New Method:**
```typescript
async updateShipmentDetails(
  orderIdOrNumber: string | number,
  trackingId: string,
  vendor: string,
  inventoryUserId: number,
  publicTrackingLink?: string
): Promise<any> {
  // Find order
  let order;
  if (typeof orderIdOrNumber === 'string' && isNaN(Number(orderIdOrNumber))) {
    order = await this.findByOrderNumber(orderIdOrNumber);
  } else {
    order = await this.findById(Number(orderIdOrNumber));
  }

  if (!order) {
    throw new Error(`Order not found`);
  }

  // Validate order status
  if (order.orderstatus !== 'ready_for_dispatch') {
    throw new Error(`Order must be in 'ready_for_dispatch' status. Current status: ${order.orderstatus}`);
  }

  // Validate vendor
  if (vendor === 'EKART') {
    throw new Error('Cannot manually update EKART shipments. Use POST /v1/ekart/shipments/forward instead.');
  }

  // Generate public tracking link if not provided
  const finalTrackingLink = publicTrackingLink || this.generateTrackingLink(vendor, trackingId);

  const currentTimestamp = Date.now();

  // Update order with shipment details
  await dynamicUpdate('orders', { id: order.id }, {
    tracking_id: trackingId,
    vendor: vendor,
    public_tracking_link: finalTrackingLink,
    shipment_created_at: currentTimestamp,
    shipdate: currentTimestamp,  // Set shipdate
    label_printed_at: currentTimestamp,  // Set label_printed_at (same as shipdate for manual vendors)
    modifieddate: currentTimestamp
    // Status will be updated via updateOrderStatus below
  });

  // Update all orderlines with tracking_id
  const { OrderlineService } = await import('./orderline.service.js');
  const orderlineService = new OrderlineService();
  const { data: orderlines } = await orderlineService.findMany(
    { orderid: order.id.toString() },
    1,
    1000
  );

  if (orderlines && orderlines.length > 0) {
    // Update all orderlines to shipped status
    for (const orderline of orderlines) {
      await orderlineService.updateOrderlineStatus(
        orderline.id.toString(),
        'shipped',
        {
          tracking_id: trackingId,
          shipdate: currentTimestamp,
          source: 'inventoryuser',
          inventory_user_id: inventoryUserId
        }
      );
    }
  }

  // Update order status to shipped (triggers status_history update)
  await this.updateOrderStatus(
    order.id.toString(),
    'shipped',
    {
      source: 'inventoryuser',
      inventory_user_id: inventoryUserId
    }
  );

  return await this.findById(order.id);
}

private generateTrackingLink(vendor: string, trackingId: string): string {
  // Vendor-specific tracking link generation
  // IMPORTANT: Use the ACTUAL vendor's tracking URL, not aggregator sites
  // The vendor field should match the actual logistics provider (e.g., "Delhivery", "Shiprocket", not "Shipway" aggregator)
  
  const vendorLinks: Record<string, string> = {
    // Logistics Providers (Direct)
    'Delhivery': `https://www.delhivery.com/track/${trackingId}`,
    'Shiprocket': `https://shiprocket.co/tracking/${trackingId}`,
    'Xpressbees': `https://www.xpressbees.com/track/${trackingId}`,
    'BlueDart': `https://www.bluedart.com/track/${trackingId}`,
    'DTDC': `https://www.dtdc.in/tracking/${trackingId}`,
    'FedEx': `https://www.fedex.com/apps/fedextrack/?tracknumbers=${trackingId}`,
    'Shadowfax': `https://shadowfax.in/track/${trackingId}`,
    'Ecom Express': `https://ecomexpress.in/track/${trackingId}`,
    
    // Aggregator Platforms (if vendor field is the aggregator itself)
    'Shipway': `https://shipway.in/track/${trackingId}`,  // Only if Shipway is the actual vendor
    'Vamaship': `https://vamaship.com/track/${trackingId}`,
    'IthinkLogistics': `https://ithinklogistics.com/track/${trackingId}`,
    
    // Add more vendors as needed
  };

  // If vendor not found in map, generate generic URL
  // Note: This is a fallback - prefer explicit vendor mapping above
  return vendorLinks[vendor] || `https://tracking.${vendor.toLowerCase().replace(/\s+/g, '')}.com/${trackingId}`;
}
```

**Note:** For EKART `mark-shipped` implementation details, see `ORDER_FULFILLMENT_FLOW_COMPLETE.md`. Manual vendors do NOT use the `mark-shipped` endpoint.

---

## Related Documentation

- `ORDER_FULFILLMENT_FLOW_COMPLETE.md` - Complete EKART fulfillment flow
- `ORDER_ORDERLINE_STATUS_REFERENCE.md` - Complete status reference

