# Create Shipment - Exact Payload Example

## Route
**POST** `/v1/ekart/shipments/forward`

## Complete Payload Example

```json
{
  "seller_name": "Nivaana",
  "seller_address": "123 Warehouse Street, Industrial Area, Chennai, Tamil Nadu",
  "seller_gst_tin": "33AABCU9603R1ZX",
  "order_number": "ORDER_TXN1234567890_1733654400000",
  "invoice_number": "INV-2025-001234",
  "invoice_date": "2025-12-08",
  "consignee_name": "John Doe",
  "products_desc": "Premium Fragrance Candle - Vanilla, 200g",
  "payment_mode": "Prepaid",
  "total_amount": 1500.00,
  "tax_value": 270.00,
  "taxable_amount": 1230.00,
  "commodity_value": "Premium Home Fragrance",
  "quantity": 1,
  "weight": 500,
  "drop_location": {
    "location_type": "Home",
    "name": "John Doe",
    "address": "456 Customer Street, Apartment 2B",
    "city": "Chennai",
    "state": "Tamil Nadu",
    "country": "India",
    "pin": 600001,
    "phone": 9876543210
  },
  "length": 20,
  "width": 15,
  "height": 10,
  "category_of_goods": "Home & Living",
  "hsn_code": "3307"
}
```

## For COD Orders

```json
{
  "seller_name": "Nivaana",
  "seller_address": "123 Warehouse Street, Industrial Area, Chennai, Tamil Nadu",
  "seller_gst_tin": "33AABCU9603R1ZX",
  "order_number": "ORDER_TXN1234567890_1733654400000",
  "invoice_number": "INV-2025-001234",
  "invoice_date": "2025-12-08",
  "consignee_name": "Jane Smith",
  "products_desc": "Premium Fragrance Candle - Lavender, 200g",
  "payment_mode": "COD",
  "total_amount": 1500.00,
  "tax_value": 270.00,
  "taxable_amount": 1230.00,
  "commodity_value": "Premium Home Fragrance",
  "quantity": 1,
  "weight": 500,
  "cod_amount": 1500.00,
  "drop_location": {
    "location_type": "Home",
    "name": "Jane Smith",
    "address": "789 Delivery Road, House No. 5",
    "city": "Bangalore",
    "state": "Karnataka",
    "country": "India",
    "pin": 560001,
    "phone": 9876543211
  },
  "length": 20,
  "width": 15,
  "height": 10,
  "category_of_goods": "Home & Living",
  "hsn_code": "3307"
}
```

## Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `seller_name` | string | Your company name | "Nivaana" |
| `seller_address` | string | Warehouse address | "123 Warehouse Street..." |
| `seller_gst_tin` | string | GST number | "33AABCU9603R1ZX" |
| `order_number` | string | Order ID from your system | "ORDER_TXN1234567890_1733654400000" |
| `invoice_number` | string | Invoice number | "INV-2025-001234" |
| `invoice_date` | string | Invoice date (YYYY-MM-DD) | "2025-12-08" |
| `consignee_name` | string | Customer name | "John Doe" |
| `products_desc` | string | Product description | "Premium Fragrance Candle..." |
| `payment_mode` | enum | "Prepaid" or "COD" | "Prepaid" |
| `total_amount` | number | Order total amount | 1500.00 |
| `tax_value` | number | Tax amount | 270.00 |
| `taxable_amount` | number | Amount before tax | 1230.00 |
| `commodity_value` | string | Commodity description | "Premium Home Fragrance" |
| `quantity` | number | Number of items | 1 |
| `weight` | number | Package weight in grams | 500 |
| `drop_location` | object | Customer address | See below |

## Drop Location Object (Required)

```json
{
  "location_type": "Home" | "Office",  // Optional
  "name": "Customer Name",              // Required
  "address": "Full address",            // Required
  "city": "City Name",                  // Required
  "state": "State Name",                // Required
  "country": "India",                    // Optional (defaults to "India")
  "pin": 600001,                        // Required (number)
  "phone": 9876543210                   // Required (number)
}
```

## Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `templateName` | string | Package template name (use this OR dimensions) |
| `length` | number | Package length in cm (use this OR templateName) |
| `width` | number | Package width in cm (use this OR templateName) |
| `height` | number | Package height in cm (use this OR templateName) |
| `cod_amount` | number | COD amount (required if payment_mode = "COD", must equal total_amount) |
| `category_of_goods` | string | Product category |
| `hsn_code` | string | HSN code for tax |
| `seller_gst_amount` | number | Seller GST amount |
| `consignee_gst_amount` | number | Consignee GST amount |
| `consignee_gst_tin` | string | Consignee GST number |

## Response

```json
{
  "success": true,
  "message": "Forward shipment created successfully",
  "data": {
    "tracking_id": "FMPC001234567890",
    "vendor": "EKART",
    "barcodes": {
      "wbn": "FMPC001234567890",
      "order": "ORDER_TXN1234567890_1733654400000",
      "cod": "FMPC001234567890"  // Only for COD orders
    },
    "public_tracking_link": "https://app.elite.ekartlogistics.in/track/FMPC001234567890",
    "order_number": "ORDER_TXN1234567890_1733654400000"
  }
}
```

## What Gets Updated in Database

### Orders Table
- ✅ `tracking_id` - EKART tracking ID
- ✅ `vendor` - "EKART"
- ✅ `barcodes` - JSON object with wbn, order, cod
- ✅ `public_tracking_link` - Tracking URL
- ✅ `shipment_created_at` - Timestamp
- ✅ `modifieddate` - Updated timestamp
- ❌ `status_history` - **NOT updated** (status doesn't change)
- ❌ `orderstatus` - **NOT updated** (remains "ready_for_dispatch")

### Orderlines Table
- ✅ `tracking_id` - EKART tracking ID (same as order)
- ✅ `modifieddate` - Updated timestamp
- ❌ `status_history` - **NOT updated** (status doesn't change)
- ❌ `orderstatus` - **NOT updated** (remains "ready_for_dispatch")

## Status Flow

```
ready_for_dispatch  (after PATCH /v1/orders/:id/ready-for-dispatch)
        ↓
[Create Shipment]   ← NO STATUS CHANGE (just metadata: tracking_id, vendor, etc.)
        ↓
[Download Label]    ← NO STATUS CHANGE
        ↓
shipped             (after PATCH /v1/orders/:id/mark-shipped - label printed & handed to courier)
        ↓
in_transit          (EKART webhook)
        ↓
out_for_delivery    (EKART webhook)
        ↓
delivered           (EKART webhook)
```

**Important:** 
- ✅ `status_history` is **ONLY** updated when status actually changes
- ✅ Create shipment and label download are **metadata updates only** (tracking_id, vendor, etc.)
- ✅ Status changes to `shipped` **ONLY** when `mark-shipped` endpoint is called (after label is printed and handed to courier)


Create Shipment (POST /v1/ekart/shipments/forward):
* Updates metadata only: tracking_id, vendor, barcodes, public_tracking_link, shipment_created_at
* No status change (remains ready_for_dispatch)
* No status_history update

Download Label (POST /v1/ekart/shipments/label):
* Downloads PDF file from EKART API (single PDF for all tracking IDs)
  - EKART API returns `application/octet-stream` (binary string)
  - Converted to Buffer in `ekartService.downloadLabel()`
* Uploads one PDF per tracking ID to Storage (Firebase Storage / GCP Storage)
  - Uses `storageService.uploadShippingLabel()` method
  - Filename format: `shipping-labels/{trackingId}.pdf`
  - Each order gets its own unique `label_url`
* Updates orders table with `label_url` (public Storage URL) and `label_downloaded_at`
* Returns PDF binary for immediate download
* No status change (remains "ready_for_dispatch")
* No status_history update

**Storage Service:**
- Generic service at `src/services/storage.service.ts`
- Used for: product images, invoices, shipping labels, and other files
- Default bucket: `nivaana-storage` (configurable via `GCP_STORAGE_BUCKET` env var)
- Shipping labels bucket: `niv-shipping-lavel-dev` (configurable via `SHIPPING_BUCKET` env var)

Mark Shipped (PATCH /v1/orders/:id/mark-shipped):
* Status changes: ready_for_dispatch → shipped
* Updates status_history (with is_active: true)
* Sets shipdate timestamp

