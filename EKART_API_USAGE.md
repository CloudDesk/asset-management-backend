# Ekart Logistics API - Complete Usage Guide

## 📋 Overview

This guide provides complete usage examples for all Ekart Logistics API endpoints.

**Base URL:** `/v1/ekart`

---

## 🔐 1. Check Connection Status

**Endpoint:** `GET /v1/ekart/connection-status`

**Description:** Check if Ekart channel is connected and get token status. This does NOT connect - it only checks the current status.

**Request:**
```http
GET /v1/ekart/connection-status
```

**No request body required** - just checks current connection state.

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
```

**Response when NOT connected:**
```json
{
  "success": true,
  "message": "Connection status retrieved successfully",
  "data": {
    "connected": false,
    "configured": true,
    "token_type": "Bearer",
    "expires_in": null,
    "expires_at": null,
    "is_valid": false,
    "message": "Ekart channel is not connected. Use POST /connect-channel to connect."
  }
}
```

**Response when NOT configured:**
```json
{
  "success": true,
  "message": "Connection status retrieved successfully",
  "data": {
    "connected": false,
    "configured": false,
    "token_type": "Bearer",
    "expires_in": null,
    "expires_at": null,
    "is_valid": false,
    "message": "Ekart credentials are not configured in environment variables"
  }
}
```

**Usage Example:**
```bash
curl -X GET http://localhost:5600/v1/ekart/connection-status
```

**Frontend Usage:**
```typescript
// Check connection status (no connection attempt)
const checkStatus = async () => {
  const response = await fetch('/v1/ekart/connection-status');
  const data = await response.json();
  
  if (data.data.connected) {
    console.log('✅ Ekart is connected');
  } else if (data.data.configured) {
    console.log('⚠️ Ekart is configured but not connected');
    // Show "Connect" button
  } else {
    console.log('❌ Ekart credentials not configured');
  }
};
```

---

## 🔐 2. Connect to Ekart Channel

**Endpoint:** `POST /v1/ekart/connect-channel`

**Description:** Manually connect to Ekart and obtain access token. This establishes the connection channel.

**Request:**
```http
POST /v1/ekart/connect-channel
Content-Type: application/json
```

**No request body required** - uses environment variables for credentials.

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

**Error Response (500):**
```json
{
  "success": false,
  "message": "Failed to connect to Ekart channel",
  "error": "Ekart credentials not configured..."
}
```

**Usage Example:**
```bash
curl -X POST http://localhost:5600/v1/ekart/connect-channel
```

**Frontend Usage:**
```typescript
// Connect to Ekart
const connect = async () => {
  try {
    const response = await fetch('/v1/ekart/connect-channel', {
      method: 'POST'
    });
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Connected successfully');
      // Update UI to show connected status
    }
  } catch (error) {
    console.error('❌ Connection failed:', error);
  }
};
```

**Note:** 
- This is optional - the system auto-connects on startup if credentials are configured
- Use this for manual reconnection or testing
- After connecting, all other routes will automatically use this token (no need to pass token from frontend)

---

## 📦 3. Create Forward Shipment

**Endpoint:** `POST /v1/ekart/shipments/forward`

**Description:** Create a forward shipment from seller to customer (COD or Prepaid).

**Request:**
```http
POST /v1/ekart/shipments/forward
Content-Type: application/json
```

**Note:** No `Authorization` header needed - token is automatically managed in backend.

**Request Body (Prepaid):**
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

**Request Body (COD):**
```json
{
  "seller_name": "Nivaana Store",
  "seller_address": "Warehouse Address",
  "seller_gst_tin": "29ABCDE1234F2Z5",
  "order_number": "ORD-1002",
  "invoice_number": "INV-1002",
  "invoice_date": "2025-12-03",
  "consignee_name": "Jane Smith",
  "products_desc": "Women's Dress - L",
  "payment_mode": "COD",
  "category_of_goods": "Fashion",
  "total_amount": 1299,
  "tax_value": 62,
  "taxable_amount": 1237,
  "commodity_value": "1237",
  "cod_amount": 1299,
  "quantity": 1,
  "weight": 350,
  "templateName": "Template #1",
  "drop_location": {
    "location_type": "Home",
    "name": "Jane Smith",
    "address": "123 Main Street",
    "city": "Mumbai",
    "state": "Maharashtra",
    "country": "India",
    "pin": 400001,
    "phone": 9876543211
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

**Usage Example:**
```bash
curl -X POST http://localhost:5600/v1/ekart/shipments/forward \
  -H "Content-Type: application/json" \
  -d '{
    "seller_name": "Nivaana Store",
    "seller_address": "Warehouse Address",
    "seller_gst_tin": "29ABCDE1234F2Z5",
    "order_number": "ORD-1001",
    "invoice_number": "INV-1001",
    "invoice_date": "2025-12-03",
    "consignee_name": "John Doe",
    "products_desc": "Mens Shirt - M",
    "payment_mode": "Prepaid",
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
      "name": "John Doe",
      "address": "Street 1",
      "city": "Bangalore",
      "state": "Karnataka",
      "pin": 560001,
      "phone": 9876543210
    }
  }'
```

---

## 🔄 4. Create Reverse Shipment

**Endpoint:** `POST /v1/ekart/shipments/reverse`

**Description:** Create a reverse shipment from customer to seller (return).

**Request:**
```http
POST /v1/ekart/shipments/reverse
Content-Type: application/json
```

**Note:** No `Authorization` header needed - token is automatically managed in backend.

**Request Body:**
```json
{
  "seller_name": "Nivaana Store",
  "seller_address": "Warehouse Address",
  "seller_gst_tin": "29ABCDE1234F2Z5",
  "order_number": "RET-ORD-1001",
  "invoice_number": "INV-1001",
  "invoice_date": "2025-12-03",
  "consignee_name": "John Doe",
  "products_desc": "Mens Shirt - M",
  "payment_mode": "Pickup",
  "return_reason": "Wrong size",
  "category_of_goods": "Fashion",
  "total_amount": 499,
  "tax_value": 24,
  "taxable_amount": 475,
  "commodity_value": "475",
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
  "message": "Reverse shipment created successfully",
  "data": {
    "tracking_id": "500999A3408006",
    "vendor": "EKART",
    "barcodes": {
      "wbn": "vendor_waybill_plain_text",
      "order": "order_number"
    },
    "public_tracking_link": "https://app.elite.ekartlogistics.in/track/500999A3408006",
    "order_number": "RET-ORD-1001"
  }
}
```

**Usage Example:**
```bash
curl -X POST http://localhost:5600/v1/ekart/shipments/reverse \
  -H "Content-Type: application/json" \
  -d '{
    "seller_name": "Nivaana Store",
    "seller_address": "Warehouse Address",
    "seller_gst_tin": "29ABCDE1234F2Z5",
    "order_number": "RET-ORD-1001",
    "invoice_number": "INV-1001",
    "invoice_date": "2025-12-03",
    "consignee_name": "John Doe",
    "products_desc": "Mens Shirt - M",
    "payment_mode": "Pickup",
    "return_reason": "Wrong size",
    "total_amount": 499,
    "tax_value": 24,
    "taxable_amount": 475,
    "commodity_value": "475",
    "quantity": 1,
    "weight": 450,
    "length": 20,
    "width": 15,
    "height": 5,
    "drop_location": {
      "name": "John Doe",
      "address": "Street 1",
      "city": "Bangalore",
      "state": "Karnataka",
      "pin": 560001,
      "phone": 9876543210
    }
  }'
```

---

## 🏷️ 5. Download Label (PDF)

**Endpoint:** `POST /v1/ekart/shipments/label`

**Description:** Download shipping labels as PDF for one or more tracking IDs.

**Request:**
```http
POST /v1/ekart/shipments/label
Content-Type: application/json
```

**Note:** No `Authorization` header needed - token is automatically managed in backend.

**Request Body:**
```json
{
  "trackingIds": [
    "500999A3408005",
    "500999A3408006"
  ]
}
```

**Success Response (200):**
- **Content-Type:** `application/pdf`
- **Body:** Binary PDF file
- **Headers:**
  - `Content-Disposition: attachment; filename="ekart-labels-<timestamp>.pdf"`
  - `Content-Length: <file_size>`

**Error Response (500):**
```json
{
  "statusCode": 0,
  "code": "string",
  "message": "string",
  "description": "string",
  "severity": "string"
}
```

**Usage Example:**
```bash
# Download single label
curl -X POST http://localhost:5600/v1/ekart/shipments/label \
  -H "Content-Type: application/json" \
  -d '{
    "trackingIds": ["500999A3408005"]
  }' \
  --output label.pdf

# Download multiple labels
curl -X POST http://localhost:5600/v1/ekart/shipments/label \
  -H "Content-Type: application/json" \
  -d '{
    "trackingIds": ["500999A3408005", "500999A3408006", "500999A3408007"]
  }' \
  --output labels.pdf
```

**JavaScript/TypeScript Example:**
```typescript
const response = await fetch('/v1/ekart/shipments/label', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
    // No Authorization header needed - backend handles it automatically
  },
  body: JSON.stringify({
    trackingIds: ['500999A3408005']
  })
});

const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'ekart-label.pdf';
a.click();
```

---

## 📍 6. Track Shipment

**Endpoint:** `GET /v1/ekart/shipments/:trackingId/track`

**Description:** Track shipment status by tracking ID.

**Request:**
```http
GET /v1/ekart/shipments/{trackingId}/track
```

**Note:** No `Authorization` header needed - token is automatically managed in backend.

**Path Parameters:**
- `trackingId` (required): Ekart tracking ID

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

**Usage Example:**
```bash
curl -X GET http://localhost:5600/v1/ekart/shipments/500999A3408005/track
```

**Common Status Values:**
- `Order Placed` / `CREATED`
- `PICKUP_SCHEDULED`
- `PICKED_UP`
- `IN_TRANSIT`
- `OUT_FOR_DELIVERY`
- `DELIVERED`
- `RTO_INITIATED` (Return to Origin)
- `RTO_DELIVERED`

---

## ❌ 7. Cancel Shipment

**Endpoint:** `DELETE /v1/ekart/shipments/:trackingId/cancel`

**Description:** Cancel a shipment before it is picked up.

**Request:**
```http
DELETE /v1/ekart/shipments/{trackingId}/cancel
```

**Note:** No `Authorization` header needed - token is automatically managed in backend.

**Path Parameters:**
- `trackingId` (required): Ekart tracking ID to cancel

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

**Error Response (400/500):**
```json
{
  "statusCode": 0,
  "code": "string",
  "message": "string",
  "description": "string",
  "severity": "string"
}
```

**Usage Example:**
```bash
curl -X DELETE http://localhost:5600/v1/ekart/shipments/500999A3408005/cancel
```

**Note:** Can only cancel shipments that haven't been picked up yet.

---

## 💰 8. Get Shipping Rates

**Endpoint:** `POST /v1/ekart/shipments/rates`

**Description:** Get estimated shipping rates for a shipment before creating it.

**Request:**
```http
POST /v1/ekart/shipments/rates
Content-Type: application/json
```

**Note:** No `Authorization` header needed - token is automatically managed in backend.

**Request Body:**
```json
{
  "pickupPincode": 560001,
  "dropPincode": 400001,
  "invoiceAmount": 1000,
  "weight": 500,
  "length": 20,
  "height": 15,
  "width": 10,
  "serviceType": "SURFACE",
  "codAmount": 0,
  "packages": [
    {
      "length": 20,
      "height": 15,
      "width": 10,
      "count": "1"
    }
  ]
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Shipping rates retrieved successfully",
  "data": {
    "type": "WEIGHT_BASED",
    "zone": "A",
    "volumetric_weight": "2.5",
    "billing_weight": "500",
    "shipping_charge": "45.00",
    "rto_charge": "25.00",
    "fuel_surcharge": "5.00",
    "cod_charge": "0.00",
    "qc_charge": "0.00",
    "taxes": "9.00",
    "total": "84.00",
    "rid": "rate_id_123",
    "r_snapshot_id": "snapshot_456"
  }
}
```

**Usage Example:**
```bash
curl -X POST http://localhost:5600/v1/ekart/shipments/rates \
  -H "Content-Type: application/json" \
  -d '{
    "pickupPincode": 560001,
    "dropPincode": 400001,
    "invoiceAmount": 1000,
    "weight": 500,
    "length": 20,
    "height": 15,
    "width": 10,
    "serviceType": "SURFACE",
    "codAmount": 0,
    "packages": [
      {
        "length": 20,
        "height": 15,
        "width": 10,
        "count": "1"
      }
    ]
  }'
```

**Service Types:**
- `SURFACE` - Surface shipping (default)
- `AIR` - Air shipping (faster, more expensive)

---

## 📊 Complete API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|----------------|
| GET | `/v1/ekart/connection-status` | Check connection status | ❌ No |
| POST | `/v1/ekart/connect-channel` | Connect to Ekart channel | ❌ No |
| POST | `/v1/ekart/shipments/forward` | Create forward shipment | ✅ Yes (Auto) |
| POST | `/v1/ekart/shipments/reverse` | Create reverse shipment | ✅ Yes (Auto) |
| POST | `/v1/ekart/shipments/label` | Download label PDF | ✅ Yes (Auto) |
| GET | `/v1/ekart/shipments/:trackingId/track` | Track shipment | ✅ Yes (Auto) |
| DELETE | `/v1/ekart/shipments/:trackingId/cancel` | Cancel shipment | ✅ Yes (Auto) |
| POST | `/v1/ekart/shipments/rates` | Get shipping rates | ✅ Yes (Auto) |

**Note:** All routes marked "✅ Yes (Auto)" automatically handle authentication in the backend. You don't need to pass any token from the frontend.

---

## 🔄 Complete Workflow Example

### Step 1: Check Connection Status (Recommended)
```bash
GET /v1/ekart/connection-status
```

**Response if connected:**
```json
{
  "data": {
    "connected": true,
    "is_valid": true
  }
}
```

**Response if not connected:**
```json
{
  "data": {
    "connected": false,
    "configured": true,
    "message": "Ekart channel is not connected. Use POST /connect-channel to connect."
  }
}
```

### Step 2: Connect Channel (Only if not connected)
```bash
POST /v1/ekart/connect-channel
```

### Step 3: Get Shipping Rates (Optional - to estimate cost)
```bash
POST /v1/ekart/shipments/rates
{
  "pickupPincode": 560001,
  "dropPincode": 400001,
  "invoiceAmount": 499,
  "weight": 450,
  "length": 20,
  "height": 15,
  "width": 10,
  "serviceType": "SURFACE",
  "codAmount": 0,
  "packages": [{"length": 20, "height": 15, "width": 10, "count": "1"}]
}
```

### Step 4: Create Forward Shipment
```bash
POST /v1/ekart/shipments/forward
{
  "seller_name": "Nivaana Store",
  "seller_address": "Warehouse Address",
  "seller_gst_tin": "29ABCDE1234F2Z5",
  "order_number": "ORD-1001",
  "invoice_number": "INV-1001",
  "invoice_date": "2025-12-03",
  "consignee_name": "John Doe",
  "products_desc": "Mens Shirt - M",
  "payment_mode": "Prepaid",
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
    "name": "John Doe",
    "address": "Street 1",
    "city": "Bangalore",
    "state": "Karnataka",
    "pin": 560001,
    "phone": 9876543210
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tracking_id": "500999A3408005",
    "vendor": "EKART",
    "barcodes": {...},
    "public_tracking_link": "https://app.elite.ekartlogistics.in/track/500999A3408005"
  }
}
```

### Step 5: Download Label
```bash
POST /v1/ekart/shipments/label
{
  "trackingIds": ["500999A3408005"]
}
```

### Step 6: Track Shipment
```bash
GET /v1/ekart/shipments/500999A3408005/track
```

### Step 7: (If needed) Cancel Shipment
```bash
DELETE /v1/ekart/shipments/500999A3408005/cancel
```

---

## 🔑 Authentication

### ✅ **IMPORTANT: Token Management is Automatic in Backend**

**All protected endpoints automatically handle authentication in the backend. You do NOT need to pass any token from the frontend.**

**How it works:**
1. **Backend automatically manages tokens:**
   - Token is obtained on startup if credentials are configured
   - Token is automatically refreshed when expired
   - All API calls to Ekart use the token automatically

2. **Frontend doesn't need to handle tokens:**
   - Just call the API endpoints directly
   - No `Authorization` header needed from frontend
   - Backend handles all token management internally

3. **Connection Flow:**
   - **Check Status:** `GET /connection-status` - Check if connected (no connection attempt)
   - **Connect:** `POST /connect-channel` - Manually connect if needed
   - **Use APIs:** All other routes work automatically once connected

**Example Frontend Code:**
```typescript
// ✅ CORRECT - No token needed
const createShipment = async () => {
  const response = await fetch('/v1/ekart/shipments/forward', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
      // ❌ NO Authorization header needed!
    },
    body: JSON.stringify(shipmentData)
  });
  return response.json();
};

// ❌ WRONG - Don't do this
const createShipmentWrong = async () => {
  const response = await fetch('/v1/ekart/shipments/forward', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer <token>' // ❌ NOT NEEDED!
    },
    body: JSON.stringify(shipmentData)
  });
};
```

**Token Lifecycle:**
- **Auto-connect on startup:** If `EKART_CLIENT_ID`, `EKART_USERNAME`, `EKART_PASSWORD` are set
- **Auto-refresh:** Token refreshes 1 hour before expiry
- **Manual refresh:** Call `POST /connect-channel` to force refresh
- **Status check:** Call `GET /connection-status` to check without connecting

---

## ⚠️ Important Notes

1. **Dimensions:** Use either `templateName` OR `length/width/height`, not both
2. **COD Amount:** Must equal `total_amount` for COD shipments, must be 0 for Prepaid
3. **Return Reason:** Required for reverse shipments
4. **Location Fields:** `pin` and `phone` must be numbers (not strings)
5. **Label Download:** Returns binary PDF, not JSON
6. **Tracking:** Public tracking link format: `https://app.elite.ekartlogistics.in/track/{tracking_id}`

---

## 🧪 Testing with cURL

### Complete Test Flow

```bash
# 1. Connect
curl -X POST http://localhost:5600/v1/ekart/connect-channel

# 1. Check Connection Status
curl -X GET http://localhost:5600/v1/ekart/connection-status

# 2. Connect (if not connected)
curl -X POST http://localhost:5600/v1/ekart/connect-channel

# 3. Get Rates
curl -X POST http://localhost:5600/v1/ekart/shipments/rates \
  -H "Content-Type: application/json" \
  -d '{"pickupPincode": 560001, "dropPincode": 400001, "invoiceAmount": 1000, "weight": 500, "length": 20, "height": 15, "width": 10, "serviceType": "SURFACE", "codAmount": 0, "packages": [{"length": 20, "height": 15, "width": 10, "count": "1"}]}'

# 4. Create Shipment
curl -X POST http://localhost:5600/v1/ekart/shipments/forward \
  -H "Content-Type: application/json" \
  -d '{...shipment payload...}'

# 5. Download Label
curl -X POST http://localhost:5600/v1/ekart/shipments/label \
  -H "Content-Type: application/json" \
  -d '{"trackingIds": ["500999A3408005"]}' \
  --output label.pdf

# 6. Track
curl -X GET http://localhost:5600/v1/ekart/shipments/500999A3408005/track

# 7. Cancel (if needed)
curl -X DELETE http://localhost:5600/v1/ekart/shipments/500999A3408005/cancel
```

---

**For more details, see:** `cursor_tasks/EKART.md`

