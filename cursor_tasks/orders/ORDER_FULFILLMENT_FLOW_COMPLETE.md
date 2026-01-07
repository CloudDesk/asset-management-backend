**Version 2.0** - 07 Jan 2026  

# Order Fulfillment Flow - Complete Documentation

## Overview
This document describes the complete order fulfillment flow after an order is created, covering all internal system changes and external system interactions. This includes:

1. **Ready-for-Dispatch** - Stock allocation and preparation
2. **Create Shipment** - EKART shipment creation (automated) OR Manual shipment details (manual vendors)
3. **Download Label** - Shipping label download and storage (EKART only)
4. **Mark-as-Shipped** - Final shipping confirmation and invoice generation (vendor-agnostic)
5. **Track Order** - Order tracking and status updates (works for both vendor types)
6. **Status Updates** - EKART webhook (automatic) OR Manual status updates (manual vendors)
7. **Other EKART Operations** - Connection, addresses, rates, etc.

**Note:** This document covers both **EKART** (automated) and **Manual Vendor** (manual) fulfillment flows. For detailed manual vendor implementation, see `MANUAL_VENDOR_FULFILLMENT_COMPLETE.md` in this same directory.

For each flow, we document:
- **Internal System Changes** (database tables, fields, status updates)
- **External System Interactions** (EKART API, Storage Backend)
- **Request/Response Formats**
- **Error Handling**

---

## Flow 1: Ready-for-Dispatch

**Endpoint:** `PATCH /v1/orders/:id/ready-for-dispatch`  
**Controller:** `OrdersController.markReadyForDispatch()`  
**Service:** `OrdersService.markReadyForDispatch()`

### When This Flow Runs
- Inventory user marks order as ready for dispatch
- All products are collected and boxed
- Physical items are ready to be shipped

### Request Format
```json
{
  "inventory_user_id": 123,
  "stock_mapping": [
    {
      "orderline_id": 456,
      "stock_ids": [789, 790],  // Optional: specific stock IDs
      // OR
      "skus": ["SKU-001", "SKU-002"],  // Optional: specific SKUs
      // OR
      "batch_filter": {  // Optional: auto-select from batch
        "batchno": "BATCH-2024-01",
        "supplierid": 10,
        "poid": 20
      }
    }
  ]
}
```

**Note:** If `stock_mapping` is not provided, system auto-selects stock using FIFO (First In First Out).

---

### Internal System Changes

#### 1. Stock Allocation (`allocateStockToOrderlines`)
**What Happens:**
- For each orderline, system selects available stock items
- Selection logic:
  - If `stock_mapping` provided → Use specified stock IDs/SKUs or batch filter
  - If no `stock_mapping` → Auto-select oldest available stock (FIFO)
- For combo products, allocates component products based on `requiredqty`

**Database Tables Affected:**
- **Stock Table** - Stock items are identified and linked (not yet updated)
- **Orderline Table** - Stock allocation is prepared

#### 2. Stock Status Update (`updateStockForDispatch`)
**What Happens:**
- Stock items are marked as **sold** (no longer available)
- Stock records are linked to order and orderline

**Stock Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `stockstatus` | ✅ Changed | `'available'` → `'sold'` |
| `orderid` | ✅ Set | Order ID (String from `orders.orderid`) |
| `orderlinenumber` | ✅ Set | Orderline number (String) |
| `solddate` | ✅ Set | Current timestamp |
| `modifieddate` | ✅ Updated | Current timestamp |

**PlatformStock Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedqty` | ✅ Decreases | Decreases by orderline quantity |
| `soldqty` | ✅ Increases | Increases by orderline quantity |
| `availableqty` | ❌ No change | Already reduced during order creation |
| `modifieddate` | ✅ Updated | Current timestamp |

**Product Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `orderedquantity` | ✅ Decreases | Decreases by orderline quantity |
| `soldquantity` | ✅ Increases | Increases by orderline quantity |
| `availablequantity` | ❌ No change | Already reduced during order creation |
| `modifieddate` | ✅ Updated | Current timestamp |

#### 3. Orderline Status Update
**What Happens:**
- All orderlines are updated to `ready_for_dispatch` status
- Status history is updated

**Orderline Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `orderstatus` | ✅ Changed | Previous status → `'ready_for_dispatch'` |
| `status_history` | ✅ Updated | New entry added with:
  - `previous_status`: Previous status
  - `new_status`: `'ready_for_dispatch'`
  - `changed_date`: Current timestamp
  - `source`: `'inventoryuser'`
  - `inventory_user_id`: Provided inventory user ID
  - `is_active`: `true` |
| `modifieddate` | ✅ Updated | Current timestamp |

#### 4. Order Status Recalculation
**What Happens:**
- Order status is recalculated based on all orderline statuses
- If all orderlines are `ready_for_dispatch`, order becomes `ready_for_dispatch`

**Orders Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `orderstatus` | ✅ Changed | Previous status → `'ready_for_dispatch'` |
| `readytodispatchdate` | ✅ Set | Current timestamp |
| `status_history` | ✅ Updated | New entry added with:
  - `previous_status`: Previous status
  - `new_status`: `'ready_for_dispatch'`
  - `changed_date`: Current timestamp
  - `source`: `'inventoryuser'`
  - `inventory_user_id`: Provided inventory user ID
  - `is_active`: `true` |
| `modifieddate` | ✅ Updated | Current timestamp |

---

### External System Interactions

**None** - This flow is purely internal. No external API calls are made.

---

## Flow 2: Create Shipment

### 2A: Create EKART Shipment (Called from Frontend)

**Endpoint:** `POST /v1/ekart/shipments/forward`  
**Controller:** `EkartController.createForwardShipment()`  
**Service:** `ekartService.createForwardShipment()`

### Prerequisites
- Order must be in `ready_for_dispatch` status
- EKART channel must be connected (token valid)
- Seller information must be provided from Frontend

### When This Flow Runs
- Frontend calls this endpoint after order is marked as ready for dispatch
- Before marking as shipped
- When inventory user creates EKART shipment from Frontend

### Request Format (from Frontend)

**Required Fields:**
```json
{
  "seller_name": "Company Name",              // Mandatory from FE
  "seller_address": "Full seller address",    // Mandatory from FE
  "seller_gst_tin": "GST123456789",           // Optional (can use ENV var)
  "order_number": "ORD-1234567890",
  "invoice_number": "INV-1234567890",
  "invoice_date": "2024-01-15",
  "consignee_name": "Customer Name",
  "products_desc": "Product description",
  "payment_mode": "COD",                      // or "Prepaid"
  "total_amount": 1500.00,
  "tax_value": 270.00,
  "taxable_amount": 1230.00,
  "commodity_value": "1500.00",
  "quantity": 2,
  "weight": 1.5,
  "drop_location": {
    "name": "Customer Name",
    "address": "Full customer address",
    "city": "City",
    "state": "State",
    "pin": 123456,
    "phone": 9876543210,
    "location_type": "Home",                   // Optional: "Home" or "Office"
    "country": "India"                        // Optional
  }
}
```

**Optional Fields:**
```json
{
  "cod_amount": 1500.00,                      // Required if payment_mode = "COD", must equal total_amount
  "templateName": "Standard",                  // OR use dimensions (length, width, height)
  "length": 10,                               // Required if no templateName
  "width": 10,                                // Required if no templateName
  "height": 10,                               // Required if no templateName
  "category_of_goods": "Electronics",
  "hsn_code": "85171200",
  "seller_gst_amount": 135.00,
  "consignee_gst_amount": 135.00,
  "consignee_gst_tin": "GST987654321"
}
```

**Important Validation Rules:**
- Either `templateName` OR (`length`, `width`, `height`) must be provided (not both)
- If `payment_mode = "COD"`, then `cod_amount` must equal `total_amount`
- If `payment_mode = "Prepaid"`, then `cod_amount` must be 0 or omitted
- `seller_name` and `seller_address` are **mandatory from Frontend** (not fetched from EKART)

---

### Internal System Changes

#### 1. Request Validation
**What Happens:**
- Validates request body against schema
- Checks seller information is provided
- Validates payment mode and COD amount rules
- Validates template/dimensions rules

#### 2. GST TIN Resolution
**What Happens:**
- If `seller_gst_tin` provided in payload → Use it
- If not provided → Use `SELLER_GST_TIN` from environment variables
- If neither available → Error thrown

#### 3. EKART API Call
**What Happens:**
- Calls EKART API to create shipment
- **⚠️ DEDUCTS MONEY FROM EKART ACCOUNT** (shipping charges)
- Returns tracking ID and shipment details

**EKART API Endpoint:** `PUT /v1/package/create`  
**Method:** `PUT`  
**Authentication:** Bearer token (auto-refreshed if expired)

**EKART Request Payload:**
- Same as Frontend request, with `seller_gst_tin` resolved

**EKART Response:**
```json
{
  "status": true,
  "remark": "Shipment created successfully",
  "tracking_id": "FMPC001234567890",
  "vendor": "EKART",
  "barcodes": {
    "wbn": "FMPC001234567890",
    "order": "ORD-1234567890",
    "cod": "FMPC001234567890"  // Only for COD orders
  }
}
```

#### 4. Database Updates (After EKART Success)
**What Happens:**
- Finds order by `order_number` (matches `orders.orderid` field)
- Updates orders table with shipment data
- Updates all orderlines with tracking_id
- **⚠️ NO STATUS CHANGE** - Status remains `ready_for_dispatch`

#### 5. Invoice Generation (Automatic - NEW)
**What Happens:**
- System automatically generates invoice after shipment data is stored
- Fetches complete order details (order, orderlines, address)
- Fetches seller data from EKART addresses API
- Calls Storage Backend invoice generation endpoint
- **Non-blocking** - Shipment creation succeeds even if invoice fails

**Orders Table Updates (if invoice generated successfully):**
| Field | Change | Value |
|-------|--------|-------|
| `order_invoice_url` | ✅ Set | Invoice PDF URL (if returned by storage backend) |
| `modifieddate` | ✅ Updated | Current timestamp |

**Note:** Invoice generation happens automatically after shipment creation, so invoice is ready before package is shipped. This was moved from `mark-shipped` endpoint.

#### 6. Response to Frontend

**Orders Table Updates (metadata only, NO status change):**
| Field | Change | Value |
|-------|--------|-------|
| `tracking_id` | ✅ Set | EKART tracking ID (e.g., "FMPC001234567890") |
| `vendor` | ✅ Set | `"EKART"` |
| `barcodes` | ✅ Set | JSON object: `{wbn, order, cod?}` |
| `public_tracking_link` | ✅ Set | `https://app.elite.ekartlogistics.in/track/{tracking_id}` |
| `shipment_created_at` | ✅ Set | Current timestamp |
| `orderstatus` | ❌ **NO CHANGE** | Remains `'ready_for_dispatch'` |
| `status_history` | ❌ **NO CHANGE** | Not updated (status doesn't change) |
| `modifieddate` | ✅ Updated | Current timestamp |

**Orderline Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `tracking_id` | ✅ Set | EKART tracking ID (same as order) |
| `orderstatus` | ❌ **NO CHANGE** | Remains `'ready_for_dispatch'` |
| `status_history` | ❌ **NO CHANGE** | Not updated (status doesn't change) |
| `modifieddate` | ✅ Updated | Current timestamp |

**What Happens:**
- Returns success response with tracking information

**Response Format:**
```json
{
  "success": true,
  "message": "Forward shipment created successfully",
  "data": {
    "tracking_id": "FMPC001234567890",
    "vendor": "EKART",
    "barcodes": {
      "wbn": "FMPC001234567890",
      "order": "ORD-1234567890",
      "cod": "FMPC001234567890"
    },
    "public_tracking_link": "https://app.elite.ekartlogistics.in/track/FMPC001234567890",
    "order_number": "ORD-1234567890"
  }
}
```

---

### External System Interactions

#### 1. EKART Package Creation API
**Endpoint:** `PUT /v1/package/create`  
**Base URL:** `https://app.elite.ekartlogistics.in/api`  
**Service:** `ekartService.createForwardShipment()`

**What Happens:**
- Creates shipment in EKART system
- **⚠️ DEDUCTS MONEY FROM EKART ACCOUNT** (shipping charges)
- Returns tracking ID and shipment details

**Authentication:**
- Uses Bearer token from `ekartAuthService`
- Auto-refreshes token if expired (401 response triggers retry)

**Request:**
- Full shipment payload with seller info from Frontend
- GST TIN resolved (payload or ENV)

**Response:**
- Tracking ID, vendor, barcodes

**Error Handling:**
- 401 → Auto-refresh token and retry
- 404 → Logged with troubleshooting suggestions
- Other errors → Logged and rethrown

---

### Error Handling

**Validation Errors:**
- Missing required fields → 400 Bad Request
- Invalid payment mode/COD amount → 400 Bad Request
- Missing template/dimensions → 400 Bad Request

**EKART API Errors:**
- 401 Unauthorized → Auto-retry with refreshed token
- 404 Not Found → Logged with troubleshooting info
- Other errors → Logged and rethrown

**Database Errors:**
- Order not found → Warning logged, but shipment still created in EKART
- Update failures → Error logged, but shipment still created in EKART
- **Note:** Shipment creation in EKART is not rolled back if database update fails

---

### 2B: Manual Shipment Details Update (Manual Vendors)

**Endpoint:** `PATCH /v1/orders/:id/manual-ship`  
**Controller:** `OrdersController.updateShipmentDetails()`  
**Service:** `OrdersService.updateShipmentDetails()`

### When This Flow Runs
- For orders fulfilled by manual vendors (Shipway, Shiprocket, etc.)
- After order is marked as ready for dispatch
- When admin manually enters tracking ID, vendor name, and optionally sets shipped status

### Request Format
```json
{
  "tracking_id": "SHIPWAY123456789",
  "vendor": "Shipway",
  "public_tracking_link": "https://shipway.com/track/SHIPWAY123456789",  // Optional
  "inventory_user_id": 123,  // Required
  "shipped": true  // Optional: If true, sets order status to shipped. If false or not provided, status remains ready_for_dispatch
}
```

**Status Behavior:**
- ✅ `shipped: true` → Sets order status to `shipped` (and all orderlines)
- ✅ `shipped: false` or not provided → Status remains `ready_for_dispatch` (no change)
- ✅ Matches user's flow: "No status for shipment created" (unless explicitly set via `shipped: true`)

### Request Format
```json
{
  "tracking_id": "SHIPWAY123456789",
  "vendor": "Shipway",
  "public_tracking_link": "https://shipway.com/track/SHIPWAY123456789",  // Optional
  "inventory_user_id": 123  // Required (for status update)
}
```

### Internal System Changes

#### 1. Validation
**What Happens:**
- Validates order exists and is in `ready_for_dispatch` status
- Validates `vendor` is NOT "EKART" (reject if EKART - use EKART API endpoint)
- Validates `tracking_id` is provided
- Validates `inventory_user_id` is provided (required for status update)

#### 2. Database Updates
**What Happens:**
- Updates order with shipment metadata (tracking_id, vendor, public_tracking_link)
- **Status Behavior:**
  - If `shipped: true` in payload → Sets `orderstatus` to `shipped`, sets `shipdate`, updates all orderlines to `shipped`
  - If `shipped: false` or not provided → Status remains `ready_for_dispatch` (no change)
- **Matches user's flow:** "No status for shipment created" (unless `shipped: true` is provided)

**Orders Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `tracking_id` | ✅ Set | Manual tracking ID (e.g., "SHIPWAY123456789") |
| `vendor` | ✅ Set | Manual vendor name (e.g., "Shipway") |
| `public_tracking_link` | ✅ Set | Provided or auto-generated based on vendor |
| `shipment_created_at` | ✅ Set | Current timestamp |
| `shipdate` | ✅ Set | Current timestamp |
| `label_printed_at` | ✅ Set | Current timestamp (same as shipdate for manual vendors) |
| `orderstatus` | ✅ Changed | `'ready_for_dispatch'` → `'shipped'` |
| `status_history` | ✅ Updated | New entry added with:
  - `previous_status`: `'ready_for_dispatch'`
  - `new_status`: `'shipped'`
  - `changed_date`: Current timestamp
  - `source`: `'inventoryuser'`
  - `inventory_user_id`: Provided inventory user ID
  - `is_active`: `true` |
| `modifieddate` | ✅ Updated | Current timestamp |

**Orderline Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `tracking_id` | ✅ Set | Manual tracking ID (same as order) |
| `orderstatus` | ✅ Changed | `'ready_for_dispatch'` → `'shipped'` |
| `shipdate` | ✅ Set | Current timestamp |
| `status_history` | ✅ Updated | New entry added (same as order) |
| `modifieddate` | ✅ Updated | Current timestamp |

**Key Benefits:**
- ✅ **One-step process** for manual vendors (simpler workflow)
- ✅ **No separate `mark-shipped` call needed**
- ✅ **EKART flow unchanged** (EKART doesn't use this endpoint)

### External System Interactions

**None** - This flow is purely internal. No external API calls are made.

### Error Handling

**Validation Errors:**
- Order not found → 404 Not Found
- Order not in `ready_for_dispatch` status → 400 Bad Request
- `vendor = "EKART"` → 400 Bad Request: "Cannot manually update EKART shipments. Use POST /v1/ekart/shipments/forward instead."
- Missing `tracking_id` → 400 Bad Request

---

## Flow 3: Download Shipping Label (EKART Only)

**Endpoint:** `POST /v1/ekart/shipments/label`  
**Controller:** `EkartController.downloadLabel()`  
**Service:** `ekartService.downloadLabel()`

### Prerequisites
- Shipment must be created (order must have `tracking_id`)
- EKART channel must be connected

### When This Flow Runs
- After shipment is created
- When inventory user wants to print shipping label
- Can download label for single or multiple tracking IDs

### Request Format
```json
{
  "tracking_ids": ["FMPC001234567890"]
}
```

**Note:** Can provide multiple tracking IDs for batch label download.

---

### Internal System Changes

#### 1. Label Download from EKART
**What Happens:**
- Calls EKART API to download label PDF
- Returns binary PDF buffer

#### 2. Upload to Storage Backend
**What Happens:**
- For each tracking ID:
  - Finds order by tracking_id
  - Uploads PDF to Storage Backend (GCP Storage)
  - Gets public URL for label PDF
  - Updates order with label URL

**Orders Table Updates (NO status change):**
| Field | Change | Value |
|-------|--------|-------|
| `label_url` | ✅ Set | GCP Storage URL for label PDF |
| `label_downloaded_at` | ✅ Set | Current timestamp |
| `orderstatus` | ❌ **NO CHANGE** | Remains `'ready_for_dispatch'` |
| `status_history` | ❌ **NO CHANGE** | Not updated |
| `modifieddate` | ✅ Updated | Current timestamp |

#### 3. Response
**What Happens:**
- Returns label URLs for each tracking ID

**Response Format (Single):**
```json
{
  "success": true,
  "message": "Labels uploaded successfully",
  "data": {
    "trackingId": "FMPC001234567890",
    "orderId": 123,
    "labelUrl": "https://storage.googleapis.com/.../labels/FMPC001234567890.pdf",
    "success": true
  }
}
```

**Response Format (Multiple):**
```json
{
  "success": true,
  "message": "Labels uploaded successfully",
  "data": [
    {
      "trackingId": "FMPC001234567890",
      "orderId": 123,
      "labelUrl": "https://storage.googleapis.com/.../labels/FMPC001234567890.pdf",
      "success": true
    },
    {
      "trackingId": "FMPC001234567891",
      "orderId": 124,
      "labelUrl": "https://storage.googleapis.com/.../labels/FMPC001234567891.pdf",
      "success": true
    }
  ]
}
```

---

### External System Interactions

#### 1. EKART Label Download API
**Endpoint:** `GET /v1/label/{trackingId}`  
**Service:** `ekartService.downloadLabel(trackingIds)`

**What Happens:**
- Downloads label PDF from EKART
- Returns binary PDF buffer (`application/octet-stream`)

**Request:**
- Single tracking ID (EKART API limitation - one at a time)
- Service handles multiple tracking IDs by calling API multiple times

**Response:**
- Binary PDF file (converted to Buffer)

#### 2. Storage Backend Label Upload
**Endpoint:** `POST ${STORAGE_BACKEND_URL}/shipping/label/{trackingId}`  
**URL:** From `STORAGE_BACKEND_URL` env variable (default: `http://localhost:4500`)

**What Happens:**
- Uploads PDF to GCP Storage (via Storage Backend)
- Returns public URL for label PDF

**Request:**
- `file`: PDF buffer (multipart/form-data)

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://storage.googleapis.com/.../labels/FMPC001234567890.pdf"
  }
}
```

---

### Error Handling

**EKART API Errors:**
- Label not available → Error logged, operation fails
- Invalid tracking ID → Error logged, operation fails

**Storage Backend Errors:**
- Upload failure → Error logged for that tracking ID, others continue
- Order not found → Warning logged, label URL not stored

**Note:** Partial failures are handled gracefully - successful uploads are returned even if some fail.

---

## Flow 4: Mark-as-Shipped (Backward Compatibility / Manual Override)

**Endpoint:** `PATCH /v1/orders/:id/mark-shipped`  
**Controller:** `OrdersController.markShipped()`  
**Service:** `OrdersService.markShipped()`

### ⚠️ IMPORTANT: This Endpoint is NOT Called in Normal EKART Flow

**For EKART Orders:**
- ✅ **`shipped` status is automatically set by webhook** when EKART confirms pickup
- ❌ **This endpoint is NOT called** in the normal EKART workflow
- ✅ **Kept for backward compatibility** and manual override scenarios only

**For Manual Vendors:**
- ❌ **Do NOT use this endpoint** - They use `PATCH /v1/orders/:id/manual-ship` instead

### When This Flow Runs (Edge Cases Only)

- **Manual override:** If webhook fails or needs manual intervention
- **Backward compatibility:** Legacy systems that still call this endpoint
- **Testing/debugging:** Manual testing scenarios

### Prerequisites
- Order must be in `ready_for_dispatch` status
- EKART shipment must be created (order must have `tracking_id` from EKART)
- Shipping label must be printed and stuck on box

### Implementation Status

**Vendor Scope:** ✅ **EKART-only** - This endpoint is designed exclusively for EKART orders

**Current Implementation:**
- ✅ Error message mentions "EKART shipment" (correct - this is EKART-only)
- ✅ No longer generates invoice (moved to create shipment)
- ✅ Works correctly for manual override scenarios

**Note:** 
- **Normal EKART flow:** Webhook automatically sets `shipped` status (no manual call needed)
- **Manual vendors:** Use `PATCH /v1/orders/:id/manual-ship` which automatically sets the `shipped` status in one step
- See `MANUAL_VENDOR_FULFILLMENT_COMPLETE.md` for manual vendor flow

### Request Format
```json
{
  "inventory_user_id": 123
}
```

---

### Internal System Changes

#### 1. Validation
**What Happens:**
- Checks if order exists
- Validates that `tracking_id` exists (EKART shipment must be created first)
- **Error message (line 1235):** `"Shipment not created yet. Please create EKART shipment first."`
  - ✅ Correct - This endpoint is EKART-only
  - ✅ Manual vendors use `manual-ship` endpoint instead

#### 2. Orderline Status Update
**What Happens:**
- All orderlines are updated to `shipped` status
- `shipdate` timestamp is set

**Orderline Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `orderstatus` | ✅ Changed | `'ready_for_dispatch'` → `'shipped'` |
| `shipdate` | ✅ Set | Current timestamp |
| `status_history` | ✅ Updated | New entry added with:
  - `previous_status`: `'ready_for_dispatch'`
  - `new_status`: `'shipped'`
  - `changed_date`: Current timestamp
  - `source`: `'inventoryuser'`
  - `inventory_user_id`: Provided inventory user ID
  - `is_active`: `true` |
| `modifieddate` | ✅ Updated | Current timestamp |

#### 3. Order Status Update
**What Happens:**
- Order is updated with shipping metadata
- Order status is recalculated (should become `shipped`)

**Orders Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `shipdate` | ✅ Set | Current timestamp |
| `label_printed_at` | ✅ Set | Current timestamp |
| `orderstatus` | ✅ Changed | `'ready_for_dispatch'` → `'shipped'` (via recalculation) |
| `status_history` | ✅ Updated | New entry added (via recalculation) |
| `modifieddate` | ✅ Updated | Current timestamp |

#### 4. Invoice Generation (REMOVED - Now in Create Shipment)
**What Happens:**
- ❌ **Invoice generation removed from mark-shipped**
- ✅ **Invoice generation moved to create shipment flow** (see Flow 2A)
- This endpoint now only updates order/orderline status to `shipped`
- **Note:** This endpoint is kept for backward compatibility and manual override. For EKART orders, `shipped` status is now set automatically via webhook.

---

### External System Interactions

#### 1. EKART Addresses API (for seller data)
**Endpoint:** `GET /v1/ekart/addresses`  
**Service:** `ekartService.getAddresses()`

**What Happens:**
- Fetches registered seller/pickup addresses from EKART
- Uses first address as seller data for invoice
- If fails, continues without seller data (non-blocking)

**Request:**
- No parameters required (uses EKART authentication)

**Response:**
```json
[
  {
    "alias": "Main Warehouse",
    "phone": 9876543210,
    "address_line1": "Address line 1",
    "address_line2": "Address line 2",
    "pincode": 123456,
    "city": "City",
    "state": "State",
    "country": "India",
    "geo": {
      "lat": 12.9716,
      "lon": 77.5946
    }
  }
]
```

#### 2. Storage Backend Invoice Generation
**Endpoint:** `POST ${STORAGE_BACKEND_URL}/order/invoice`  
**URL:** From `STORAGE_BACKEND_URL` env variable (default: `http://localhost:4500`)

**What Happens:**
- Sends complete order data to storage backend
- Storage backend generates PDF invoice
- Returns invoice URL (stored in `order_invoice_url`)

**Request Body:**
```json
{
  "order": {
    "id": 123,
    "orderid": "ORD-1234567890",
    "orderamount": 1500.00,
    "orderstatus": "shipped",
    "productamount": 1400.00,
    "discountamount": 100.00,
    "shipping_cost": 50.00,
    "total_gst_amount": 252.00,
    "createddate": 1234567890000,
    "shipdate": 1234567900000,
    ...
  },
  "orderlines": [
    {
      "id": 456,
      "productid": 789,
      "productname": "Product Name",
      "quantity": 2,
      "productamount": 700.00,
      "orderamount": 700.00,
      "gst_rate": 18.00,
      "cgst_amount": 63.00,
      "sgst_amount": 63.00,
      ...
    }
  ],
  "address": {
    "name": "Customer Name",
    "mobilenumber": "9876543210",
    "address": "Full address",
    "pincode": "123456",
    "city": "City",
    "state": "State"
  },
  "seller": {
    "alias": "Main Warehouse",
    "name": "Company Name",
    "address": "Full address",
    "gst_tin": "GST123456789",
    ...
  }
}
```

**Response:**
```json
{
  "success": true,
  "invoiceUrl": "https://storage.googleapis.com/.../invoices/ORD-1234567890.pdf",
  "message": "Invoice generated successfully"
}
```

**Error Handling:**
- If invoice generation fails, error is logged but order is still marked as shipped
- Timeout: 30 seconds

---

## Flow 5: Track Order

**Endpoint:** `GET /v1/orders/:id/track`  
**Controller:** `OrdersController.trackOrder()`

### When This Flow Runs
- Customer wants to track their order
- Frontend displays order tracking information
- Real-time status updates

### Request Format
```
GET /v1/orders/:id/track
```

**Path Parameter:**
- `id`: Order ID (database ID) or order number (orderid string)

---

### Internal System Changes

#### 1. Order Lookup
**What Happens:**
- Finds order by ID or order number
- Returns 404 if order not found

**Database Query:**
- If `id` is numeric → Query by `orders.id`
- If `id` is string → Query by `orders.orderid`

#### 2. Tracking Availability Check
**What Happens:**
- Checks if order has `tracking_id`
- If no `tracking_id`, returns basic order info (not shipped yet)

**Response (if not shipped):**
```json
{
  "success": true,
  "message": "Order tracking information",
  "data": {
    "order_id": 123,
    "order_number": "ORD-1234567890",
    "order_status": "ready_for_dispatch",
    "tracking_id": null,
    "message": "Order has not been shipped yet",
    "tracking_available": false
  }
}
```

---

### External System Interactions

#### 1. EKART Tracking API
**Endpoint:** `GET /v1/track/{trackingId}`  
**Service:** `ekartService.trackShipment(trackingId)`

**What Happens:**
- Calls EKART API to get real-time tracking information
- Returns shipment status, location, delivery estimate, etc.

**Request:**
- `trackingId`: From `orders.tracking_id`

**Response:**
```json
{
  "_id": "tracking_id",
  "track": {
    "status": "in_transit",
    "ctime": 1234567890000,
    "pickupTime": 1234567891000,
    "location": "Mumbai Hub",
    "desc": "Shipment is in transit",
    "ndrStatus": null,
    "attempts": 0,
    "ndrActions": null,
    "details": [
      {
        "status": "picked_up",
        "ctime": 1234567890000,
        "location": "Origin Hub",
        "desc": "Shipment picked up from seller"
      },
      {
        "status": "in_transit",
        "ctime": 1234567891000,
        "location": "Mumbai Hub",
        "desc": "Shipment is in transit"
      }
    ]
  },
  "edd": 1234568000000,
  "order_number": "ORD-1234567890"
}
```

**Full Response (if tracking available):**
```json
{
  "success": true,
  "message": "Order tracking retrieved successfully",
  "data": {
    "order_id": 123,
    "order_number": "ORD-1234567890",
    "order_status": "shipped",
    "tracking_id": "FMPC001234567890",
    "vendor": "EKART",
    "public_tracking_link": "https://app.elite.ekartlogistics.in/track/FMPC001234567890",
    "tracking_available": true,
    "ekart_tracking": {
      "status": "in_transit",
      "current_location": "Mumbai Hub",
      "description": "Shipment is in transit",
      "estimated_delivery": "2024-01-18T00:00:00.000Z",
      "status_history": [
        {
          "status": "picked_up",
          "ctime": 1234567890000,
          "location": "Origin Hub",
          "desc": "Shipment picked up from seller"
        }
      ],
      "ndr_status": null,
      "ndr_actions": null,
      "attempts": 0
    }
  }
}
```

**Error Handling:**
- If EKART tracking fails, returns order info with message: `"EKART tracking information temporarily unavailable"`
- Order tracking still available via `public_tracking_link`

---

## Flow 6: EKART Webhook (Automatic Status Updates)

**Endpoint:** `POST /v1/ekart/webhook/track-status`  
**Controller:** `EkartController.handleTrackStatusWebhook()`

### When This Flow Runs
- Automatically called by EKART when shipment status changes
- No manual intervention required
- Webhook is unauthenticated (HMAC verified)

### Webhook Payload (from EKART)
```json
{
  "wbn": "FMPC001234567890",        // Waybill Number (tracking_id)
  "status": "in_transit",            // New status
  "location": "Mumbai Hub",          // Current location
  "desc": "Shipment is in transit",  // Status description
  "ctime": 1234567890000,            // Timestamp
  "pickupTime": 1234567891000,       // Pickup timestamp (optional)
  "attempts": "0",                   // Delivery attempts (optional)
  "id": "internal_ref",              // Internal reference (not used)
  "orderNumber": "ORD-1234567890",   // Order number (optional)
  "edd": 1234568000000               // Estimated delivery date (optional)
}
```

**Headers:**
- `x-hmac` or `hmac`: HMAC signature for verification

---

### Internal System Changes

#### 1. HMAC Verification
**What Happens:**
- Verifies HMAC signature using secret: `"Nivaana-Ekart-Track-Status"`
- Invalid HMAC → Returns 401 Unauthorized

**HMAC Calculation:**
```javascript
const expectedHmac = crypto
  .createHmac('sha256', 'Nivaana-Ekart-Track-Status')
  .update(JSON.stringify(webhookPayload))
  .digest('hex');
```

#### 2. Order Lookup & Vendor Check
**What Happens:**
- Finds order by `tracking_id` (the `wbn` field in webhook)
- Returns 404 if order not found
- **Vendor Check:** Only processes EKART orders
  - If `order.vendor !== 'EKART'` → Returns order unchanged (ignores webhook)
  - Prevents webhook from affecting manual vendor orders

#### 3. Status Update (Complete)

**For Known/Configured Statuses:**
- Maps EKART webhook status to system status (handles all variations: "Shipped", "Pick Up", "In Transit", etc.)
- Stores original EKART status in `shipment_tracking_status`
- Updates `orderstatus` with mapped system status
- Updates all orderlines with same status
- Updates `status_history` for order and all orderlines with `is_active: true`

**For Unknown/Unconfigured Statuses:**
- Stores original EKART status in `shipment_tracking_status`
- **Does NOT update `orderstatus`** (current status preserved)
- **Does NOT update orderline `orderstatus`** (current status preserved)
- Adds entry to `status_history` with:
  - `previous_status`: Current orderstatus (unchanged)
  - `new_status`: Current orderstatus (unchanged)
  - `is_active`: `false` (does NOT affect status flow)
  - `is_webhook_status`: `true` (marked as webhook status)
  - `ekart_original_status`: Original unknown EKART status
  - `description`: `"Unknown EKART status: {status}"`
  - `webhook_payload`: Full original webhook payload (all fields from EKART)
  - `source`: `'ekart'`
  - `location`: webhookPayload.location (if provided)

**Status Mapping (Handles All Variations):**

The system normalizes EKART statuses (case-insensitive, handles spaces/underscores/hyphens) and maps them to internal system statuses:

**Normalization Process:**
1. Convert to lowercase
2. Trim whitespace
3. Replace spaces/underscores/hyphens with single space
4. Match against normalized status map

**Complete Status Mapping Table:**

| EKART Webhook Status (Original) | Normalized | Mapped System Status | Examples |
|----------------------------------|------------|---------------------|----------|
| `"Shipped"`, `"SHIPPED"`, `"shipped"` | `shipped` | `shipped` | Any casing |
| `"Pick Up"`, `"Pick Up"`, `"Picked Up"` | `pick up` | `shipped` | With spaces |
| `"picked-up"`, `"picked_up"`, `"Picked-Up"` | `pick up` | `shipped` | With hyphens/underscores |
| `"pickedup"`, `"Pickup"` | `pickup` | `shipped` | No spaces |
| `"In Transit"`, `"IN TRANSIT"` | `in transit` | `in_transit` | With spaces |
| `"in-transit"`, `"in_transit"` | `in transit` | `in_transit` | With hyphens/underscores |
| `"intransit"` | `intransit` | `in_transit` | No spaces |
| `"Out For Delivery"`, `"OUT FOR DELIVERY"` | `out for delivery` | `out_for_delivery` | With spaces |
| `"out-for-delivery"`, `"out_for_delivery"` | `out for delivery` | `out_for_delivery` | With hyphens/underscores |
| `"outfordelivery"` | `outfordelivery` | `out_for_delivery` | No spaces |
| `"Delivered"`, `"DELIVERED"` | `delivered` | `delivered` | Any casing |
| `"COD Collected"`, `"COD_COLLECTED"` | `cod collected` | `cod_payment_received` | With spaces |
| `"cod-collected"`, `"cod_collected"` | `cod collected` | `cod_payment_received` | With hyphens/underscores |
| `"codcollected"` | `codcollected` | `cod_payment_received` | No spaces |
| `"RTO Initiated"`, `"RTO_INITIATED"` | `rto initiated` | `rto_initiated` | With spaces |
| `"rto-initiated"`, `"rto_initiated"` | `rto initiated` | `rto_initiated` | With hyphens/underscores |
| `"rtoinitiated"` | `rtoinitiated` | `rto_initiated` | No spaces |
| `"RTO Delivered"`, `"RTO_DELIVERED"` | `rto delivered` | `rto_delivered` | With spaces |
| `"rto-delivered"`, `"rto_delivered"` | `rto delivered` | `rto_delivered` | With hyphens/underscores |
| `"rtodelivered"` | `rtodelivered` | `rto_delivered` | No spaces |

**Mapping Logic:**
- ✅ **Normalization:** lowercase → trim → replace `[_\-\s]+` with single space
- ✅ **Case-insensitive:** All variations handled
- ✅ **Format variations:** Spaces, underscores, hyphens all normalized
- ✅ **Unknown statuses:** 
  - Stored in `shipment_tracking_status` (original EKART status)
  - Added to `status_history` with `is_active: false` (does NOT affect status flow)
  - `orderstatus` remains unchanged (current status preserved)
  - Orderline `orderstatus` remains unchanged
  - Marked with `is_webhook_status: true` in history
- ✅ **Known statuses:** Update `orderstatus`, orderline statuses, and `status_history` with `is_active: true`
- ✅ **Idempotent:** Same status update is safe (no duplicate changes)

**Orders Table Updates (Known Statuses):**
| Field | Change | Value |
|-------|--------|-------|
| `shipment_tracking_status` | ✅ Updated | Original EKART status (e.g., "Shipped", "In Transit") |
| `orderstatus` | ✅ Updated | Mapped system status (e.g., `shipped`, `in_transit`) |
| `shipdate` | ✅ Set | If status is `shipped` (first time, from pickupTime) |
| `delivereddate` | ✅ Set | If status is `delivered` |
| `cod_payment_received_date` | ✅ Set | If status is `cod_payment_received` |
| `status_history` | ✅ Updated | New entry with:
  - `previous_status`: Previous orderstatus
  - `new_status`: Mapped system status
  - `changed_date`: webhookPayload.ctime or current timestamp
  - `source`: `'ekart'`
  - `location`: webhookPayload.location
  - `description`: webhookPayload.desc
  - `ekart_original_status`: Original EKART status
  - `is_active`: `true` |
| `modifieddate` | ✅ Updated | Current timestamp |

**Orderlines Table Updates (Known Statuses):**
| Field | Change | Value |
|-------|--------|-------|
| `orderstatus` | ✅ Updated | Same as order status |
| `shipdate` | ✅ Set | If status is `shipped` (first time) |
| `delivereddate` | ✅ Set | If status is `delivered` |
| `status_history` | ✅ Updated | Same as order status_history |
| `modifieddate` | ✅ Updated | Current timestamp |

**Orders Table Updates (Unknown Statuses):**
| Field | Change | Value |
|-------|--------|-------|
| `shipment_tracking_status` | ✅ Updated | Original unknown EKART status (e.g., "Custom Status", "Pending Review") |
| `orderstatus` | ❌ **NO CHANGE** | Current status preserved (e.g., `shipped`, `in_transit`) |
| `status_history` | ✅ Updated | New entry with:
  - `previous_status`: Current orderstatus (unchanged)
  - `new_status`: Current orderstatus (unchanged)
  - `changed_date`: webhookPayload.ctime or current timestamp
  - `source`: `'ekart'`
  - `location`: webhookPayload.location (if provided)
  - `description`: `"Unknown EKART status: {status}"` or webhookPayload.desc
  - `ekart_original_status`: Original unknown EKART status
  - `webhook_payload`: Full original webhook payload (all fields from EKART)
  - `is_active`: `false` (does NOT affect status flow)
  - `is_webhook_status`: `true` (marked as webhook status) |
| `modifieddate` | ✅ Updated | Current timestamp |

**Orderlines Table Updates (Unknown Statuses):**
| Field | Change | Value |
|-------|--------|-------|
| `orderstatus` | ❌ **NO CHANGE** | Current status preserved |
| `status_history` | ❌ **NO CHANGE** | Not updated (orderlines follow order status) |
| `modifieddate` | ❌ **NO CHANGE** | Not updated |

---

### External System Interactions

**None** - This is a webhook endpoint that receives updates from EKART.

---

### Error Handling

**Validation Errors:**
- Missing `wbn` or `status` → 400 Bad Request
- Invalid HMAC → 401 Unauthorized
- Order not found → 404 Not Found

**Processing Errors:**
- Database update failures → 500 Internal Server Error
- All errors are logged with full context

---

## Flow 7: Cancel Order

**Endpoint:** `POST /v1/orders/:id/cancel`  
**Controller:** `OrdersController.cancelOrder()`  
**Service:** `OrdersService.cancelOrder()`

### When This Flow Runs
- Customer requests order cancellation
- Admin cancels order on behalf of customer
- Order must be in cancellable status (before delivery)

### Prerequisites
- Order must be in cancellable status:
  - `order_placed`
  - `order_confirmed`
  - `payment_completed`
  - `packed`
  - `ready_for_dispatch`
- Cannot cancel if order is `shipped`, `in_transit`, `out_for_delivery`, or `delivered`

### Request Format
```json
{
  "userid": 123,                    // Required for customer cancellations
  "inventory_user_id": 456,         // Required for admin cancellations
  "cancellation_reason": "Customer requested cancellation"
}
```

**Note:** Either `userid` OR `inventory_user_id` must be provided (not both required, but at least one).

---

### Internal System Changes

#### 1. Validation
**What Happens:**
- Validates order exists
- Checks order is in cancellable status
- Verifies user authorization:
  - If `userid` provided → Must match order owner
  - If `inventory_user_id` provided → Admin can cancel any order
- Uses row-level lock to prevent race conditions (SELECT FOR UPDATE)

#### 2. Stock Restoration
**What Happens:**
- Restores stock quantities based on order status:
  - **Before `ready_for_dispatch`**: Restores `orderedqty` → `availableqty`
  - **After `ready_for_dispatch`**: Restores `soldqty` → `availableqty` (reverses stock allocation)

**Stock Restoration Logic:**

**If order status is `ready_for_dispatch`:**
- Stock items marked as `sold` are restored to `available`
- Stock `orderid` and `orderlinenumber` are cleared
- `solddate` is cleared

**If order status is before `ready_for_dispatch`:**
- Only quantity updates (no stock item status changes)

**Product Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availablequantity` | ✅ Increases | Increases by cancelled orderline quantity |
| `orderedquantity` | ✅ Decreases | Decreases by cancelled orderline quantity |
| `soldquantity` | ✅ Decreases | Decreases if order was `ready_for_dispatch` |
| `modifieddate` | ✅ Updated | Current timestamp |

**PlatformStock Table Updates:**
| Field | Change | Calculation |
|-------|--------|-------------|
| `availableqty` | ✅ Increases | Increases by cancelled orderline quantity |
| `orderedqty` | ✅ Decreases | Decreases by cancelled orderline quantity |
| `soldqty` | ✅ Decreases | Decreases if order was `ready_for_dispatch` |
| `modifieddate` | ✅ Updated | Current timestamp |

**Stock Table Updates (if order was `ready_for_dispatch`):**
| Field | Change | Value |
|-------|--------|-------|
| `stockstatus` | ✅ Changed | `'sold'` → `'available'` |
| `orderid` | ✅ Cleared | Set to `null` |
| `orderlinenumber` | ✅ Cleared | Set to `null` |
| `solddate` | ✅ Cleared | Set to `null` |
| `modifieddate` | ✅ Updated | Current timestamp |

#### 3. Orderline Status Update
**What Happens:**
- All orderlines are updated to `cancelled` status
- Cancellation reason is stored
- Status history is updated

**Orderline Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `orderstatus` | ✅ Changed | Previous status → `'cancelled'` |
| `cancelleddate` | ✅ Set | Current timestamp |
| `cancellation_reason` | ✅ Set | From request body |
| `status_history` | ✅ Updated | New entry added with:
  - `previous_status`: Previous status
  - `new_status`: `'cancelled'`
  - `changed_date`: Current timestamp
  - `source`: `'customer'` or `'inventoryuser'`
  - `userid` or `inventory_user_id`: Provided user ID
  - `is_active`: `true` |
| `modifieddate` | ✅ Updated | Current timestamp |

#### 4. Order Status Update
**What Happens:**
- Order status is updated to `cancelled`
- Cancellation date is set
- Status history is updated

**Orders Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `orderstatus` | ✅ Changed | Previous status → `'cancelled'` |
| `cancelleddate` | ✅ Set | Current timestamp |
| `cancellation_reason` | ✅ Set | From request body |
| `status_history` | ✅ Updated | New entry added with:
  - `previous_status`: Previous status
  - `new_status`: `'cancelled'`
  - `changed_date`: Current timestamp
  - `source`: `'customer'` or `'inventoryuser'`
  - `userid` or `inventory_user_id`: Provided user ID
  - `is_active`: `true` |
| `modifieddate` | ✅ Updated | Current timestamp |

---

### External System Interactions

**None** - This flow is purely internal. No external API calls are made during cancellation.

**Note:** If order has `tracking_id` (EKART shipment created), the EKART shipment cancellation is NOT automatically called. The order is cancelled internally, and EKART shipment cancellation should be handled separately if needed.

---

### Error Handling

**Validation Errors:**
- Order not found → 404 Not Found
- Order already cancelled → Returns existing cancelled order (idempotent)
- Order not in cancellable status → 400 Bad Request: `"Order cannot be cancelled. Current status: {status}"`
- Unauthorized (customer trying to cancel another customer's order) → 403 Forbidden: `"Unauthorized: userid does not match order owner"`

**Stock Restoration Errors:**
- Stock restoration failures → Transaction rolled back, cancellation fails
- All operations are atomic (transaction-based)

---

## Flow 8: Update Refund Status

**Endpoint:** `PATCH /v1/orders/:id/refund-status`  
**Controller:** `OrdersController.updateRefundStatus()`  
**Service:** `OrdersService.updateRefundStatus()`

### When This Flow Runs
- After order is cancelled
- Admin updates refund processing status
- Tracks refund progress through payment gateway

### Prerequisites
- Order must be in `cancelled` status
- Admin-only operation (requires `inventory_user_id`)

### Request Format
```json
{
  "status": "cancelled_refund_processing",  // or "cancelled_refunded" or "cancelled_completed"
  "admin_user_id": 123,
  "notes": "Refund initiated via PhonePe",   // Optional
  "refund_transaction_id": "PE_REFUND_123456789",  // Optional
  "refund_amount": 1500.00,                  // Optional
  "refund_reference": "HDFC123456"           // Optional
}
```

**Refund Status Flow:**
1. `cancelled_refund_processing` - Refund initiated, processing
2. `cancelled_refunded` - Refund completed, money returned to customer
3. `cancelled_completed` - Refund process fully completed (final status)

---

### Internal System Changes

#### 1. Validation
**What Happens:**
- Validates order exists
- Checks order is in `cancelled` status
- Validates status transition is allowed:
  - Cannot go backwards (e.g., `cancelled_refunded` → `cancelled_refund_processing`)
  - Cannot update if already in final status (`cancelled_completed`)

#### 2. Orderline Status Update
**What Happens:**
- All orderlines are updated to the new refund status
- Status history is updated with refund information

**Orderline Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `orderstatus` | ✅ Changed | Previous status → New refund status |
| `status_history` | ✅ Updated | New entry added with:
  - `previous_status`: Previous status
  - `new_status`: New refund status
  - `changed_date`: Current timestamp
  - `source`: `'inventoryuser'`
  - `inventory_user_id`: Provided admin user ID
  - `refund_transaction_id`: If provided
  - `refund_amount`: If provided
  - `refund_reference`: If provided
  - `notes`: If provided
  - `is_active`: `true` |
| `modifieddate` | ✅ Updated | Current timestamp |

#### 3. Order Status Update
**What Happens:**
- Order status is updated to new refund status
- Refund metadata is stored
- Timestamps are set based on status

**Orders Table Updates:**
| Field | Change | Value |
|-------|--------|-------|
| `orderstatus` | ✅ Changed | Previous status → New refund status |
| `refund_transaction_id` | ✅ Set | If provided in request |
| `refund_amount` | ✅ Set | If provided in request |
| `refund_reference` | ✅ Set | If provided in request |
| `refund_notes` | ✅ Set | If provided in request |
| `refund_initiated_date` | ✅ Set | If status is `cancelled_refund_processing` |
| `refund_completed_date` | ✅ Set | If status is `cancelled_refunded` |
| `refund_status_updated_date` | ✅ Set | Current timestamp |
| `status_history` | ✅ Updated | New entry added with refund details |
| `modifieddate` | ✅ Updated | Current timestamp |

**Timestamp Logic:**
- `cancelled_refund_processing` → Sets `refund_initiated_date`
- `cancelled_refunded` → Sets `refund_completed_date` (and `refund_initiated_date` if not already set)
- `cancelled_completed` → No additional timestamps

---

### External System Interactions

**None** - This flow is purely internal. It tracks refund status but does not initiate refunds.

**Note:** Actual refund processing happens through payment gateway (PhonePe, etc.). This endpoint is used to track and update the refund status after the refund is processed externally.

---

### Error Handling

**Validation Errors:**
- Order not found → 404 Not Found
- Order not in `cancelled` status → 400 Bad Request: `"Cannot update refund status. Order must be in 'cancelled' status"`
- Invalid status transition → 400 Bad Request: `"Cannot update refund status from {current} to {new}"`
- Already in final status → 400 Bad Request: `"Order is already in final status: cancelled_completed"`

**Processing Errors:**
- Database update failures → 500 Internal Server Error
- All errors are logged with full context

---

## Flow 9: Other EKART Operations

### 9.1 Check Connection Status
**Endpoint:** `GET /v1/ekart/connection-status`

**What Happens:**
- Checks if EKART channel is connected
- Returns token status without connecting

**Response:**
```json
{
  "success": true,
  "message": "Connection status retrieved successfully",
  "data": {
    "connected": true,
    "configured": true,
    "token_type": "Bearer",
    "expires_in": 3600,
    "expires_at": "2024-01-15T12:00:00.000Z",
    "is_valid": true,
    "message": "Ekart channel is connected and ready to use"
  }
}
```

---

### 9.2 Connect to EKART Channel
**Endpoint:** `POST /v1/ekart/connect-channel`

**What Happens:**
- Connects to EKART and obtains access token
- Token is cached and auto-refreshed

**Response:**
```json
{
  "success": true,
  "message": "Successfully connected to Ekart channel",
  "data": {
    "connected": true,
    "token_type": "Bearer",
    "expires_in": 3600,
    "expires_at": "2024-01-15T12:00:00.000Z",
    "is_valid": true,
    "message": "Ekart channel is now connected and ready to use"
  }
}
```

---

### 9.3 Get Addresses from EKART
**Endpoint:** `GET /v1/ekart/addresses`

**What Happens:**
- Fetches list of registered seller/pickup addresses from EKART
- Used for invoice generation and shipment creation

**Response:**
```json
{
  "success": true,
  "message": "Addresses fetched successfully",
  "data": [
    {
      "alias": "Main Warehouse",
      "phone": 9876543210,
      "address_line1": "Address line 1",
      "address_line2": "Address line 2",
      "pincode": 123456,
      "city": "City",
      "state": "State",
      "country": "India",
      "geo": {
        "lat": 12.9716,
        "lon": 77.5946
      }
    }
  ]
}
```

---

### 9.4 Get Shipping Rates
**Endpoint:** `POST /v1/ekart/shipments/rates`

**What Happens:**
- Gets estimated shipping rates for a shipment
- Used before creating shipment to show costs

**Request:**
```json
{
  "pickupPincode": 123456,
  "dropPincode": 654321,
  "invoiceAmount": 1500.00,
  "weight": 1.5,
  "length": 10,
  "height": 10,
  "width": 10,
  "serviceType": "Standard",
  "codAmount": 1500.00,
  "packages": [
    {
      "length": 10,
      "height": 10,
      "width": 10,
      "count": "1"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Shipping rates retrieved successfully",
  "data": {
    "type": "Standard",
    "zone": "A",
    "volumetric_weight": "1.2",
    "billing_weight": "1.5",
    "shipping_charge": "50.00",
    "rto_charge": "25.00",
    "fuel_surcharge": "5.00",
    "cod_charge": "15.00",
    "qc_charge": "0.00",
    "taxes": "12.00",
    "total": "107.00",
    "rid": "rate_id",
    "r_snapshot_id": "snapshot_id"
  }
}
```

---

### 9.5 Track Shipment (Direct EKART)
**Endpoint:** `GET /v1/ekart/shipments/:trackingId/track`

**What Happens:**
- Direct EKART tracking (not order-based)
- Returns same data as order tracking but by tracking ID

**Response:**
```json
{
  "success": true,
  "message": "Shipment tracking retrieved successfully",
  "data": {
    "tracking_id": "FMPC001234567890",
    "status": "in_transit",
    "current_location": "Mumbai Hub",
    "description": "Shipment is in transit",
    "estimated_delivery": "2024-01-18T00:00:00.000Z",
    "order_number": "ORD-1234567890",
    "status_history": [...],
    "ndr_status": null,
    "ndr_actions": null,
    "attempts": 0,
    "public_tracking_link": "https://app.elite.ekartlogistics.in/track/FMPC001234567890"
  }
}
```

---

---

## Complete Status Flow Diagram

### EKART Flow (2 Steps + Webhook-Driven Status Updates)
```
Order Created
    ↓
payment_completed (or order_confirmed for COD)
    ↓
[Ready-for-Dispatch Flow]
    ↓
ready_for_dispatch
    ↓
1. [Create EKART Shipment] ← POST /v1/ekart/shipments/forward
    - Updates: tracking_id, vendor="EKART", barcodes, public_tracking_link
    - Generates invoice automatically (NEW - moved from mark-shipped)
    - NO STATUS CHANGE (remains ready_for_dispatch)
    ↓
2. [Download Label] ← POST /v1/ekart/shipments/label
    - Updates: label_url
    - NO STATUS CHANGE (remains ready_for_dispatch)
    ↓
3. [EKART Webhook: "Shipped" or "Pick Up"] ← POST /v1/ekart/webhook/track-status (automatic)
    - Stores: shipment_tracking_status = "Shipped" (original EKART status)
    - Updates: orderstatus → shipped (mapped system status)
    - Updates: All orderlines → shipped
    - Updates: status_history (order + orderlines)
    - Sets: shipdate (from pickupTime)
    ↓
shipped
    ↓
4. [EKART Webhook: "In Transit"]
    - Stores: shipment_tracking_status = "In Transit" (original)
    - Updates: orderstatus → in_transit (mapped)
    - Updates: All orderlines → in_transit
    - Updates: status_history
    ↓
in_transit
    ↓
5. [EKART Webhook: "Out For Delivery"]
    - Stores: shipment_tracking_status = "Out For Delivery" (original)
    - Updates: orderstatus → out_for_delivery (mapped)
    - Updates: All orderlines → out_for_delivery
    - Updates: status_history
    ↓
out_for_delivery
    ↓
6. [EKART Webhook: "Delivered"]
    - Stores: shipment_tracking_status = "Delivered" (original)
    - Updates: orderstatus → delivered (mapped)
    - Updates: All orderlines → delivered
    - Updates: status_history
    - Sets: delivereddate
    ↓
delivered
    ↓
7. [EKART Webhook: "COD Collected"] (COD orders only)
    - Stores: shipment_tracking_status = "COD Collected" (original)
    - Updates: orderstatus → cod_payment_received (mapped)
    - Updates: All orderlines → cod_payment_received
    - Updates: status_history
    - Sets: cod_payment_received_date
```

**Key Changes:**
- ✅ **Invoice generation moved** to create shipment (Step 1)
- ✅ **`shipped` status set by webhook** (Step 3) - First webhook after pickup
- ✅ **All status updates via webhook** - No manual mark-shipped needed
- ✅ **`mark-shipped` endpoint kept** - For backward compatibility and manual override

### Manual Vendor Flow (1-2 Steps + Manual Updates)
```
Order Created
    ↓
payment_completed (or order_confirmed for COD)
    ↓
[Ready-for-Dispatch Flow]
    ↓
ready_for_dispatch
    ↓
1. [Manual Shipment Details] ← PATCH /v1/orders/:id/manual-ship
    - Updates: tracking_id, vendor, public_tracking_link
    - Status Behavior:
      * If shipped: true → ready_for_dispatch → shipped (AUTOMATIC)
      * If shipped: false or not provided → ready_for_dispatch (NO CHANGE)
    - Updates: All orderlines (status only if shipped: true)
    - Updates: status_history (only if status changes)
    ↓
ready_for_dispatch (if shipped: false/not provided)
    OR
shipped (if shipped: true)
    ↓
2a. [Manual Status Update: "shipped"] ← PATCH /v1/orders/:id/shipment-status (if not set in step 1)
    OR
2b. [Manual Status Updates] ← PATCH /v1/orders/:id/shipment-status (for subsequent statuses)
    ↓
in_transit
    ↓
out_for_delivery
    ↓
delivered
```

**Key Differences:**
- **EKART:** 2-step process (create shipment → download label) + webhook-driven status updates
- **Manual Vendors:** 1-2 step process (manual-ship with optional `shipped: true`, or separate manual status update) + manual status updates
- **`mark-shipped` endpoint:** Kept for backward compatibility and manual override (not required for normal EKART flow)

Alternative Flow (Cancellation):
    ↓
[Cancel Order Flow] ← Can happen at any cancellable status
    ↓
cancelled
    ↓
[Update Refund Status Flow]
    ↓
cancelled_refund_processing
    ↓
cancelled_refunded
    ↓
cancelled_completed
```

---

## Summary Table

| Flow | Endpoint | Internal Changes | External Interactions |
|------|----------|------------------|----------------------|
| **Ready-for-Dispatch** | `PATCH /v1/orders/:id/ready-for-dispatch` | • Stock: `available` → `sold`<br>• Stock linked to order/orderline<br>• PlatformStock/Product quantities updated<br>• Orderlines: status → `ready_for_dispatch`<br>• Order: status → `ready_for_dispatch` | None |
| **Create EKART Shipment** | `POST /v1/ekart/shipments/forward` | • Order: `tracking_id`, `vendor="EKART"`, `barcodes` set<br>• Orderlines: `tracking_id` set<br>• Order: `order_invoice_url` set (invoice generated automatically)<br>• **NO status change** | • EKART API: Create shipment (deducts money)<br>• EKART API: Get seller addresses<br>• Storage Backend: Generate invoice PDF |
| **Manual Shipment Details** | `PATCH /v1/orders/:id/manual-ship` | • Order: `tracking_id`, `vendor` (manual), `public_tracking_link` set<br>• Order: `orderstatus` → `"shipped"` (if `shipped: true` in payload) OR remains `ready_for_dispatch` (if `shipped: false` or not provided)<br>• Orderlines: `tracking_id` set, status → `"shipped"` (only if `shipped: true`)<br>• Order: `shipdate`, `label_printed_at` set (only if `shipped: true`)<br>• Order: `status_history` updated (only if status changes)<br>• **Resets EKART fields** if switching from EKART (label_url, barcodes, etc.) | None |
| **Download Label** | `POST /v1/ekart/shipments/label` | • Order: `label_url` set<br>• **NO status change** | • EKART API: Download label PDF<br>• Storage Backend: Upload PDF to GCP |
| **Mark-as-Shipped** | `PATCH /v1/orders/:id/mark-shipped` | • Orderlines: status → `shipped`<br>• Order: status → `shipped`, `shipdate` set<br>• **Note:** Kept for backward compatibility. For EKART orders, `shipped` status is now set automatically via webhook. | None (no longer generates invoice) |
| **Track Order** | `GET /v1/orders/:id/track` | None (read-only) | • EKART API: Get tracking info (EKART only)<br>• Returns stored data (manual vendors) |
| **EKART Webhook** | `POST /v1/ekart/webhook/track-status` | • Order: `shipment_tracking_status` updated (original EKART status)<br>• Order: `orderstatus` updated (mapped system status)<br>• All orderlines: status updated<br>• Order + Orderlines: `status_history` updated<br>• Order: `shipdate` set (on "Shipped" webhook)<br>• Order: `delivereddate` set (on "Delivered" webhook)<br>• Order: `cod_payment_received_date` set (on "COD Collected" webhook) | None (receives webhook) |
| **Manual Status Update** | `PATCH /v1/orders/:id/shipment-status` | • Order: `shipment_tracking_status` updated<br>• Order: `orderstatus` updated (if applicable)<br>• Order: `status_history` updated | None |
| **Cancel Order** | `POST /v1/orders/:id/cancel` | • Stock: Restored (sold/ordered → available)<br>• Orderlines: status → `cancelled`<br>• Order: status → `cancelled`<br>• Stock items: `sold` → `available` (if ready_for_dispatch) | None |
| **Update Refund Status** | `PATCH /v1/orders/:id/refund-status` | • Orderlines: status → refund status<br>• Order: status → refund status<br>• Order: Refund metadata stored (transaction_id, amount, reference)<br>• Order: Refund timestamps set | None |

---

## Key Points

1. **Status Changes Only on Specific Actions:**
   - `ready_for_dispatch` → Only when `ready-for-dispatch` endpoint is called
   - `shipped` → Set by:
     - **EKART orders:** `mark-shipped` endpoint (EKART-only, after shipment created and label printed)
     - **Manual vendors:** `manual-ship` endpoint (automatic, one-step - no mark-shipped needed)
   - EKART shipment creation and label download are **metadata updates only** (no status change)
   - Manual shipment details update **automatically sets shipped status** (one-step process)

2. **Stock Allocation:**
   - Happens during `ready-for-dispatch`
   - Stock is marked as `sold` and linked to order/orderline
   - Quantities are updated in PlatformStock and Product tables

3. **EKART Shipment Creation:**
   - **Called from Frontend** with seller information
   - **DEDUCTS MONEY FROM EKART ACCOUNT** (shipping charges)
   - Seller name and address are **mandatory from Frontend**
   - GST TIN can come from Frontend or ENV variable

4. **Invoice Generation:**
   - Automatic when order is marked as shipped
   - Non-blocking (order is shipped even if invoice fails)
   - Requires Storage Backend to be running

5. **Tracking:**
   - Real-time data from EKART API
   - Falls back gracefully if EKART API fails
   - Public tracking link always available

6. **Webhook Updates:**
   - Automatic status updates from EKART
   - HMAC verified for security
   - Updates order status based on EKART shipment status

7. **Order Cancellation:**
   - Can be initiated by customer or admin
   - Restores stock quantities (orderedqty/soldqty → availableqty)
   - Uses row-level locks to prevent race conditions
   - Atomic transaction ensures data consistency

8. **Refund Status Tracking:**
   - Admin-only operation for tracking refund progress
   - Three statuses: `cancelled_refund_processing` → `cancelled_refunded` → `cancelled_completed`
   - Stores refund transaction details (transaction_id, amount, reference)
   - Tracks refund timestamps (initiated_date, completed_date)

---

## Environment Variables Required

```bash
# EKART Integration
EKART_CLIENT_ID=your_client_id
EKART_USERNAME=your_username
EKART_PASSWORD=your_password
EKART_BASE_URL=https://app.elite.ekartlogistics.in/api

# Storage Backend (for invoice and label storage)
STORAGE_BACKEND_URL=http://localhost:4500
# OR for production:
# STORAGE_BACKEND_URL=https://your-storage-backend-url

# Seller GST TIN (for invoice generation and shipment creation)
SELLER_GST_TIN=GST123456789
```

---

## Error Handling Summary

### Ready-for-Dispatch
- **No stock available:** Throws error, order not marked as ready
- **Invalid orderline:** Throws error, transaction rolled back

### Create Shipment
- **Validation errors:** 400 Bad Request (missing fields, invalid payment mode, etc.)
- **EKART API 401:** Auto-refresh token and retry
- **EKART API 404:** Logged with troubleshooting suggestions
- **Database errors:** Warning logged, but shipment still created in EKART

### Download Label
- **EKART API errors:** Error logged, operation fails
- **Storage Backend errors:** Error logged for that tracking ID, others continue
- **Order not found:** Warning logged, label URL not stored

### Mark-as-Shipped
- **No tracking_id:** Throws error: `"Shipment not created yet"`
- **Invoice generation fails:** Logged but order is still marked as shipped

### Track Order
- **Order not found:** Returns 404
- **No tracking_id:** Returns basic order info (not shipped yet)
- **EKART API fails:** Returns order info with message (non-blocking)

### EKART Webhook
- **Missing fields:** 400 Bad Request
- **Invalid HMAC:** 401 Unauthorized
- **Order not found:** 404 Not Found
- **Processing errors:** 500 Internal Server Error

### Cancel Order
- **Order not found:** 404 Not Found
- **Order already cancelled:** Returns existing cancelled order (idempotent)
- **Order not cancellable:** 400 Bad Request: `"Order cannot be cancelled. Current status: {status}"`
- **Unauthorized:** 403 Forbidden: `"Unauthorized: userid does not match order owner"`
- **Stock restoration failures:** Transaction rolled back, cancellation fails

### Update Refund Status
- **Order not found:** 404 Not Found
- **Order not cancelled:** 400 Bad Request: `"Cannot update refund status. Order must be in 'cancelled' status"`
- **Invalid status transition:** 400 Bad Request: `"Cannot update refund status from {current} to {new}"`
- **Already in final status:** 400 Bad Request: `"Order is already in final status: cancelled_completed"`

---

## Testing Checklist

- [ ] Ready-for-dispatch with auto stock selection (FIFO)
- [ ] Ready-for-dispatch with manual stock selection (stock_ids)
- [ ] Ready-for-dispatch with batch filter
- [ ] Create EKART shipment from Frontend (verify tracking_id stored)
- [ ] Create EKART shipment with seller info from FE
- [ ] Create EKART shipment with GST TIN from ENV
- [ ] Download label (verify label_url stored)
- [ ] Download label for multiple tracking IDs
- [ ] Mark as shipped (verify status change and invoice generation)
- [ ] Track order (verify EKART tracking data)
- [ ] Track order without tracking_id (verify graceful handling)
- [ ] EKART webhook (verify status updates)
- [ ] EKART webhook with invalid HMAC (verify rejection)
- [ ] Cancel order by customer (verify stock restoration)
- [ ] Cancel order by admin (verify stock restoration)
- [ ] Cancel order after ready_for_dispatch (verify sold stock restored)
- [ ] Cancel order before ready_for_dispatch (verify ordered stock restored)
- [ ] Update refund status to cancelled_refund_processing
- [ ] Update refund status to cancelled_refunded (with refund details)
- [ ] Update refund status to cancelled_completed
- [ ] Error handling (no stock, no tracking_id, invalid status transitions, etc.)

---

---

## Shipment Status Rules & Validation

This section defines the **complete rules** for shipment status management, including system vs vendor responsibility boundaries, allowed shipment status values, status transition validation rules, and vendor-specific restrictions.

### Vendor-Driven Status Updates

**Rule:** After `ready_for_dispatch`, **ALL vendors** (EKART + manual vendors) can update shipment status.

**Behavior:**
- ✅ **EKART orders:** Updated via webhook (automatic) OR manual update (with warning)
- ✅ **Manual vendor orders:** Updated via manual update only
- ✅ **Uniform behavior:** Same validation rules apply to all vendors

**Vendor-Specific Considerations:**

| Vendor Type | Update Method | Notes |
|-------------|---------------|-------|
| **EKART** | Webhook (primary) + Manual (fallback) | Manual updates logged with warning (may be overwritten by webhook) |
| **Manual Vendors** | Manual only | No webhook, admin must update manually |

**No Vendor-Specific Restrictions:**
- ✅ Same allowed status values for all vendors
- ✅ Same validation rules for all vendors
- ✅ Same transition rules for all vendors

### Allowed Shipment Statuses

**Valid Shipment Statuses (Post-Dispatch):**

After `ready_for_dispatch`, vendors can update to these statuses **ONLY**:

| Status | Description | Can Update From | Notes |
|--------|-------------|-----------------|-------|
| **`shipped`** | Shipment picked up/dispatched | `ready_for_dispatch` | Set by system (`mark-shipped`), not vendor |
| **`in_transit`** | Package in transit | `shipped` | Vendor can update |
| **`out_for_delivery`** | Out for delivery | `in_transit` or `shipped` | Vendor can update |
| **`delivered`** | Delivered to customer | `out_for_delivery` or `in_transit` | Vendor can update |
| **`rto_initiated`** | Return to origin started | `in_transit`, `out_for_delivery` | Vendor can update (delivery failed) |
| **`rto_delivered`** | RTO delivered to warehouse | `rto_initiated` | Vendor can update |
| **`cod_payment_received`** | COD payment collected | `delivered` | Vendor can update (COD orders only) |

**Important Notes:**
- ❌ **`shipped`** is **NOT** set by vendors - it's set by **our system** via `mark-shipped` endpoint
- ✅ **For EKART:** `shipped` is set by system after EKART shipment created
- ✅ **For Manual Vendors:** `shipped` is ALSO set by system after manual shipment details updated
- ✅ **Both vendor types:** Use same `PATCH /v1/orders/:id/mark-shipped` endpoint (vendor-agnostic)
- ✅ Vendors can update statuses **after** `shipped` (in_transit, out_for_delivery, delivered, etc.)
- ✅ Status values are **case-sensitive** (use lowercase with underscores)

**Invalid Statuses (Rejected):**
- Any status not in the list above
- Pre-dispatch statuses (order_placed, payment_completed, packed, ready_for_dispatch)
- Cancellation statuses (cancelled, cancelled_refund_processing, etc.) - handled separately
- Return statuses (return_initiated, returned) - handled separately

### System vs Vendor Responsibility

**System-Controlled Statuses (Pre-Dispatch):**

| Status | Set By | Endpoint/Flow |
|--------|--------|---------------|
| `order_placed` | System | Order creation |
| `payment_completed` | System | PhonePe callback / COD acceptance |
| `order_confirmed` | System | Auto-confirmation |
| `packed` | Inventory User | Warehouse packing |
| `ready_for_dispatch` | Inventory User | `PATCH /v1/orders/:id/ready-for-dispatch` |

**Boundary:** `ready_for_dispatch` is the **last system-controlled status**.

**Vendor-Controlled Statuses (Post-Dispatch):**

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
  - **Different endpoints:** EKART uses `mark-shipped` (EKART-only), Manual vendors use `manual-ship`
- ✅ **After `shipped`:** All subsequent statuses are vendor-controlled

### Validation Rules

#### 1. Prerequisite Validation

**Before allowing any vendor status update:**
- ✅ Order must have `tracking_id` (shipment must be created)
- ✅ Order must be in `ready_for_dispatch` or later status
- ✅ Cannot update if order is `cancelled` or `returned`

#### 2. Allowed Status Values

**Only these statuses are allowed for vendor updates:**
```typescript
const ALLOWED_SHIPMENT_STATUSES = [
  'in_transit',
  'out_for_delivery',
  'delivered',
  'rto_initiated',
  'rto_delivered',
  'cod_payment_received'
];
```

**Note:** `shipped` is **NOT** in this list - it's set by system via `mark-shipped`.

#### 3. Status Transition Rules

**Valid Transitions (from current orderstatus):**

| Current Status | Allowed Next Statuses | Notes |
|----------------|----------------------|-------|
| `ready_for_dispatch` | ❌ None (vendor cannot update) | System must call `mark-shipped` first |
| `shipped` | `in_transit`, `out_for_delivery`, `rto_initiated` | Normal flow or RTO |
| `in_transit` | `out_for_delivery`, `delivered`, `rto_initiated` | Normal flow or RTO |
| `out_for_delivery` | `delivered`, `rto_initiated` | Normal delivery or RTO |
| `delivered` | `cod_payment_received` | Only for COD orders |
| `rto_initiated` | `rto_delivered` | RTO flow |
| `rto_delivered` | ❌ None | Terminal status |

**Invalid Transitions (Rejected):**
- ❌ Going backwards (e.g., `in_transit` → `shipped`)
- ❌ Skipping stages (e.g., `shipped` → `delivered` without `in_transit`)
- ❌ Invalid combinations (e.g., `delivered` → `in_transit`)

**Exception - Flexible Transitions:**
- ✅ `shipped` → `in_transit` OR `out_for_delivery` (vendor may skip in_transit)
- ✅ `in_transit` → `delivered` (vendor may skip out_for_delivery)
- ✅ `out_for_delivery` → `rto_initiated` (delivery failed, RTO initiated)

#### 4. Special Case Validations

**COD Payment Received:**
- ✅ Only allowed if order is `delivered`
- ✅ Only allowed if payment mode is `cod`
- ✅ Reject if payment mode is `phonepe` or `prepaid`

**RTO Statuses:**
- ✅ `rto_initiated` can come from `shipped`, `in_transit`, or `out_for_delivery`
- ✅ `rto_delivered` can only come from `rto_initiated`

#### 5. Idempotency

**Rule:** Same status update is allowed (idempotent).

**Behavior:**
- ✅ If status is already `delivered` and vendor updates to `delivered` again → Accept (no-op)
- ✅ Log info message: "Status already set to {status}, no change needed"
- ✅ Return success response

### Complete Validation Flow

**For `PATCH /v1/orders/:id/shipment-status`:**

**Step 1: Prerequisites**
- ✅ Order exists
- ✅ Order has tracking_id
- ✅ Order is not cancelled/returned
- ✅ Order is ready_for_dispatch or later

**Step 2: Status Value Validation**
- ✅ Status is in ALLOWED_SHIPMENT_STATUSES
- ✅ Status is not 'shipped' (system-controlled)

**Step 3: Transition Validation**
- ✅ Current status allows transition to new status
- ✅ No backwards transitions
- ✅ No invalid combinations

**Step 4: Special Case Validation**
- ✅ COD payment only for COD orders
- ✅ RTO delivered only from rto_initiated
- ✅ Terminal statuses cannot be updated

**Step 5: Idempotency Check**
- ✅ If status unchanged, return early (no-op)

---

## Related Documentation

- `cursor_tasks/orders/MANUAL_VENDOR_FULFILLMENT_COMPLETE.md` - **Complete manual vendor fulfillment guide (single source of truth)**
- `ORDER_ORDERLINE_STATUS_REFERENCE.md` - Status lifecycle reference
- `cursor_tasks/orders/create_shipment_payload.md` - Shipment creation payload details

