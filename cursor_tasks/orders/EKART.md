# Nivaana Inventory → Ekart Logistics Integration Guide

**Version 1.0** — Complete End-to-End Technical Documentation  
*Last Updated: December 3, 2025*

## 🧭 Table of Contents

1. [Overview](#1-overview)
2. [Terminology](#2-terminology)
3. [Prerequisites](#3-prerequisites)
4. [Authentication](#4-authentication)
5. [API Usage Guide](#5-api-usage-guide)
6. [Warehouse Handling (Autofill Pickup/Return Location)](#6-warehouse-handling-autofill-pickupreturn-location)
7. [Packaging Templates](#7-packaging-templates)
8. [Forward Shipment Flow (Seller → Customer)](#8-forward-shipment-flow-seller--customer)
9. [Reverse Shipment Flow (Customer → Seller – Returns)](#9-reverse-shipment-flow-customer--seller--returns)
10. [Reverse Shipments with QC (Optional)](#10-reverse-shipments-with-qc-optional)
11. [Label Download & Storage Flow](#11-label-download--storage-flow)
12. [Tracking Flow](#12-tracking-flow)
13. [API Payload Mapping](#13-api-payload-mapping)
14. [Database Schema](#14-database-schema-recommended)
15. [Node.js Integration Structure](#15-nodejs-integration-structure)
16. [UI Flow (Frontend)](#16-ui-flow-frontend)
17. [Complete Sequence Diagrams](#17-complete-sequence-diagrams)
18. [Additional API Endpoints (Cancel & Rates)](#18-additional-api-endpoints)
19. [Final Summary](#19-final-summary)

---

## 1️⃣ Overview

This documentation explains how Nivaana Inventory integrates with Ekart Logistics using the official API.

**Official API Documentation:** https://app.elite.ekartlogistics.in/api/docs#tag/Shipments

**API Base URL:** `https://app.elite.ekartlogistics.in/api`

This integration supports:

- Create Forward Shipments (Seller → Customer)
- Create Reverse Shipments (Customer → Seller)
- Download Shipping Labels (PDF)
- Track Shipment Status
- Handle Returns & Refund Flow

Integration supports COD, Prepaid, and Pickup (reverse) shipments.

---

## 2️⃣ Terminology

| Term | Meaning |
|------|---------|
| Forward Shipment | Shipment from seller → customer |
| Reverse Shipment | Shipment from customer → seller (return) |
| tracking_id | Ekart's primary shipment identifier |
| Label PDF | Shipping label printed and pasted on the parcel |
| Pickup Location | Your warehouse address |
| Drop Location | Customer delivery address |
| Return Location | Warehouse address for RTO or reverse returns |

---

## 3️⃣ Prerequisites

Before integrating, ensure:

### ✔ Ekart Account Setup

- API access enabled
- One or multiple warehouse addresses registered
- Package templates created (optional)
- Label download permission enabled

### ✔ Credentials

- Bearer Token
- API Base URL

### ✔ Infrastructure

- GCP Bucket for storing label PDFs
- Database tables for saving shipment details
- Secure backend for storing credentials

---

## 4️⃣ Authentication

Ekart uses Bearer token authentication. You need to obtain an `access_token` before making API requests.

### **Get Access Token**

**Endpoint:** `POST https://app.elite.ekartlogistics.in/integrations/v2/auth/token/{client_id}`

**Official Documentation:** https://app.elite.ekartlogistics.in/api/docs#operation/get_access_token_v2

**Path Parameters:**

- `client_id` (required): Client ID provided by Ekart during onboarding

**Request Body:**

```json
{
  "username": "string",
  "password": "string"
}
```

**Success Response (200):**

```json
{
  "access_token": "abc123",
  "token_type": "Bearer",
  "expires_in": 86400,
  "scope": "core:all"
}
```

**Response Fields:**

- `access_token`: Token to use in Authorization header
- `token_type`: Usually "Bearer"
- `expires_in`: Token validity in seconds (generally 24 hours / 86400 seconds)
- `scope`: Always "core:all"

### **Using the Access Token**

For all protected API calls, include the access token in the Authorization header:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Example:**

If `access_token` is `abc123` and `token_type` is `Bearer`, the header will be:

```http
Authorization: Bearer abc123
```

### **Important Notes:**

- This API works with both v1 and v2 APIs
- This is a **caching API** - it will return the same token for a period of 24 hours
- The `expires_in` value will keep decreasing appropriately with subsequent fetches
- Tokens are generally valid for 24 hours
- Store the token and expiry time to avoid unnecessary API calls
- Refresh the token before it expires

### **Authentication Flow Pattern (Similar to AWS SDK)**

**Yes, you need to connect initially to get the Bearer token, then use it for all API calls.**

**Recommended Pattern:**

1. **Initial Connection** → Get access_token and store it
2. **Store Credentials** → Cache token with expiry time (in-memory or database)
3. **Use Stored Token** → Include in all API request headers
4. **Auto-Refresh** → Automatically reconnect when token expires

### **Implementation Best Practices:**

#### **1. Token Storage Strategy:**

- **In-Memory Cache** (Redis/Memory): Fast access, lost on restart
- **Database**: Persistent across restarts, shared across instances
- **Environment Variables**: Not recommended (tokens expire)

#### **2. Token Refresh Strategy:**

- Check token validity before each API call
- Refresh proactively when token expires within 1 hour
- Handle 401 errors gracefully and auto-retry with new token

#### **3. Complete Implementation Example:**

```javascript
class EkartClient {
  constructor(clientId, username, password) {
    this.clientId = clientId;
    this.username = username;
    this.password = password;
    this.baseURL = 'https://app.elite.ekartlogistics.in/api';
    
    // Token cache
    this.tokenCache = {
      access_token: null,
      token_type: 'Bearer',
      expires_at: null
    };
  }

  /**
   * Step 1: Initial connection to get token
   * Call this once at startup or when token expires
   */
  async connect() {
    try {
      const response = await fetch(
        `https://app.elite.ekartlogistics.in/integrations/v2/auth/token/${this.clientId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: this.username,
            password: this.password
          })
        }
      );

      if (!response.ok) {
        throw new Error(`Auth failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Store token with expiry
      this.tokenCache = {
        access_token: data.access_token,
        token_type: data.token_type || 'Bearer',
        expires_at: Date.now() + (data.expires_in * 1000)
      };

      console.log(`✅ Connected to Ekart. Token expires in ${data.expires_in}s`);
      return this.tokenCache;
    } catch (error) {
      console.error('❌ Ekart connection failed:', error);
      throw error;
    }
  }

  /**
   * Step 2: Get valid token (auto-refresh if needed)
   * This is called automatically before each API request
   */
  async getValidToken() {
    const now = Date.now();
    const bufferTime = 60 * 60 * 1000; // 1 hour buffer

    // Check if token exists and is still valid (with 1 hour buffer)
    if (
      this.tokenCache.access_token &&
      this.tokenCache.expires_at &&
      (this.tokenCache.expires_at - bufferTime) > now
    ) {
      return this.tokenCache.access_token;
    }

    // Token expired or doesn't exist - reconnect
    console.log('🔄 Token expired or missing. Reconnecting...');
    await this.connect();
    return this.tokenCache.access_token;
  }

  /**
   * Step 3: Make API request with automatic token management
   */
  async apiRequest(endpoint, options = {}) {
    // Ensure we have a valid token
    const token = await this.getValidToken();

    // Make request with Bearer token
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    // Handle 401 - token might have expired during request
    if (response.status === 401) {
      console.log('🔄 Got 401, refreshing token and retrying...');
      await this.connect(); // Force refresh
      const newToken = this.tokenCache.access_token;
      
      // Retry request with new token
      return fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${newToken}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
    }

    return response;
  }

  /**
   * Example: Create shipment (uses apiRequest which handles auth automatically)
   */
  async createShipment(payload) {
    const response = await this.apiRequest('/v1/package/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return response.json();
  }
}

// Usage:
const ekart = new EkartClient(
  process.env.EKART_CLIENT_ID,
  process.env.EKART_USERNAME,
  process.env.EKART_PASSWORD
);

// Step 1: Connect initially (optional - will auto-connect on first API call)
await ekart.connect();

// Step 2: Use API - token management is automatic
const shipment = await ekart.createShipment({
  seller_name: "Nivaana Store",
  // ... rest of payload
});
```

#### **4. Database Storage Pattern (For Multi-Instance Deployments):**

```javascript
// Store token in database
async function getTokenFromDB() {
  const tokenRecord = await db.ekartTokens.findOne({
    where: { client_id: clientId }
  });

  if (tokenRecord && tokenRecord.expires_at > new Date()) {
    return tokenRecord.access_token;
  }

  // Token expired - fetch new one
  const newToken = await fetchNewToken();
  
  // Update database
  await db.ekartTokens.upsert({
    client_id: clientId,
    access_token: newToken.access_token,
    token_type: newToken.token_type,
    expires_at: new Date(Date.now() + newToken.expires_in * 1000)
  });

  return newToken.access_token;
}
```

### **Summary:**

✅ **Initial Connection Required:** Yes, call `/auth/{client_id}` first to get token  
✅ **Store Token:** Cache in memory/database with expiry time  
✅ **Auto-Refresh:** Check validity before each API call, reconnect if expired  
✅ **Pattern:** Similar to AWS SDK - credentials managed automatically  
✅ **Error Handling:** Handle 401 errors and auto-retry with fresh token

### **API Base URL:**

**API Base URL:** `https://app.elite.ekartlogistics.in/api`

**Note:** All API endpoints are prefixed with `/v1/` or `/v2/`

---

## 5️⃣ Warehouse Handling (Autofill Pickup/Return Location)

Ekart allows you to register one or more warehouses.

### ✔ CASE A — You Have ONLY ONE Warehouse (Your current situation)

You DO NOT need to send `pickup_location` or `return_location` in Create Shipment API.

Ekart automatically fills them.

**Forward Shipment Payload Example:**

```json
{
  "seller_name": "Nivaana Store",
  "order_number": "ORD-10001",
  "drop_location": { "...customer address..." }
}
```

Ekart internally assigns:

- `pickup_location` = your registered warehouse
- `return_location` = same as pickup

### ✔ CASE B — You Have MULTIPLE Warehouses (Future)

You must send the warehouse alias:

```json
{
  "pickup_location": {
    "name": "WH-BLR"   // alias registered with Ekart
  },
  "return_location": {
    "name": "WH-BLR"   // optional, defaults to pickup_location if not sent
  }
}
```

**Notes:**

- Only send alias (not full address)
- If `return_location` is missing → Ekart auto-fills same as pickup
- `drop_location` MUST always be sent

---

## 6️⃣ Packaging Templates

Packaging templates allow you to define box sizes in the Ekart dashboard.

**Example templates:**

| Template Name | L | W | H | Weight |
|---------------|---|---|---|--------|
| Template #1 | 20 | 15 | 5 | 450g |
| SmallBox | 12 | 10 | 4 | 300g |

### ✔ Using a template:

```json
{
  "templateName": "Template #1"
}
```

Ekart will auto-fill:

- `length`
- `width`
- `height`
- `weight`

### ❗ Important Rules

Send ONLY ONE of these:

- `"templateName"` OR
- `length, width, height`

- ❌ Sending both → Ekart rejects request
- ❌ Sending `templateName` that doesn't exist → rejected

---

## 8️⃣ Forward Shipment Flow (Seller → Customer)

Triggered when order is packed and marked "Ready to Dispatch".

### **Complete API Payload Structure:**

The following shows all available fields in the Create Shipment API. Fields marked with ✅ are required, others are optional.

```json
{
  // Seller Information (Required)
  "seller_name": "string",                    // ✅ Required
  "seller_address": "string",                  // ✅ Required
  "seller_gst_tin": "string",                  // ✅ Required
  "seller_gst_amount": 0,                      // Optional
  
  // Order Information (Required)
  "order_number": "string",                   // ✅ Required
  "invoice_number": "string",                  // ✅ Required
  "invoice_date": "string",                    // ✅ Required (YYYY-MM-DD)
  "ewbn": "string",                            // Optional: External Waybill Number
  "document_number": "string",                 // Optional
  "document_date": "string",                   // Optional
  
  // Consignee Information (Required)
  "consignee_name": "string",                 // ✅ Required
  "consignee_gst_tin": "string",               // Optional
  "consignee_gst_amount": 0,                   // Optional
  "integrated_gst_amount": 0,                  // Optional
  
  // Product Information (Required)
  "products_desc": "string",                  // ✅ Required
  "category_of_goods": "string",               // Optional
  "hsn_code": "string",                        // Optional
  
  // Payment Information (Required)
  "payment_mode": "COD" | "Prepaid",          // ✅ Required
  "cod_amount": 49999,                         // Required if payment_mode is COD
  
  // Financial Information (Required)
  "total_amount": 1,                           // ✅ Required
  "tax_value": 0,                              // ✅ Required
  "taxable_amount": 1,                         // ✅ Required
  "commodity_value": "string",                 // ✅ Required (string format)
  "quantity": 1,                               // ✅ Required
  
  // Dimensions & Weight (Required - choose one)
  "templateName": "string",                   // Use template OR dimensions
  "weight": 1,                                 // ✅ Required (in grams)
  "length": 1,                                 // Required if no templateName
  "height": 1,                                 // Required if no templateName
  "width": 1,                                  // Required if no templateName
  
  // Location Information (Required)
  "drop_location": {                          // ✅ Required
    "location_type": "Home" | "Office",        // Optional
    "name": "string",                          // ✅ Required
    "address": "string",                       // ✅ Required
    "city": "string",                          // ✅ Required
    "state": "string",                         // ✅ Required
    "country": "string",                       // Optional (default: "India")
    "pin": 0,                                  // ✅ Required (numeric)
    "phone": 1000000000                        // ✅ Required (numeric)
  },
  "pickup_location": {                         // Optional (auto-filled if single warehouse)
    "name": "string"                           // Alias if multiple warehouses
  },
  "return_location": {                         // Optional (defaults to pickup_location)
    "name": "string"                           // Alias if multiple warehouses
  },
  
  // QC Information (Optional)
  "qc_details": {                              // Optional
    "qc_shipment": true,                       // Required if sending qc_details
    "product_name": "string",                  // Required if qc_shipment is true
    "product_desc": "string",
    "product_sku": "string",
    "product_color": "string",
    "product_size": "string",
    "brand_name": "string",
    "product_category": "string",
    "ean_barcode": "string",
    "serial_number": "string",
    "imei_number": "string",
    "product_images": ["string"]
  },
  
  // Line Items (Optional - alternative to products_desc)
  "items": [
    {
      "product_name": "string",
      "sku": "string",
      "taxable_value": 1,
      "description": "string",
      "quantity": 1,
      "length": 0,
      "height": 0,
      "breadth": 0,
      "weight": 0,
      "hsn_code": "string",
      "cgst_tax_value": 0,
      "sgst_tax_value": 0,
      "igst_tax_value": 0
    }
  ],
  
  // Additional
  "what3words_address": "string"              // Optional: What3Words format
}
```

**Endpoint:** `POST https://app.elite.ekartlogistics.in/api/v1/package/create`

### **Required fields:**

- `seller_name`
- `seller_address`
- `seller_gst_tin`
- `order_number`
- `invoice_number`
- `invoice_date`
- `consignee_name`
- `drop_location` (complete address structure)
- `payment_mode` (COD / Prepaid)
- dimensions (`length, width, height`) OR `templateName`
- `weight`
- `products_desc`
- `total_amount`
- `tax_value`
- `taxable_amount`
- `commodity_value`
- `quantity`

### **Optional fields:**

- `seller_gst_amount`
- `consignee_gst_amount`
- `integrated_gst_amount`
- `consignee_gst_tin`
- `ewbn` (External Waybill Number)
- `document_number`
- `document_date`
- `hsn_code`
- `category_of_goods`
- `cod_amount` (required if `payment_mode` is COD)
- `items[]` (detailed line items array)
- `what3words_address`
- `pickup_location` (auto-filled if single warehouse)
- `return_location` (auto-filled if single warehouse)

### **Example Forward Payload (Prepaid):**

```json
{
  "seller_name": "Nivaana Store",
  "seller_address": "Warehouse Address, City, State, PIN",
  "seller_gst_tin": "29ABCDE1234F2Z5",
  "order_number": "INV1001",
  "invoice_number": "INV1001",
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

### **Example Forward Payload (COD):**

```json
{
  "seller_name": "Nivaana Store",
  "seller_address": "Warehouse Address",
  "seller_gst_tin": "29ABCDE1234F2Z5",
  "order_number": "INV1002",
  "invoice_number": "INV1002",
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

### **Important Notes:**

- `drop_location.name` is generally the same as `consignee_name`
- Exception: when a different person receives the shipment at `drop_location`
- `location_type` can be "Home", "Office", etc.
- `pin` and `phone` should be numbers (not strings)
- `cod_amount` must be 0 for Prepaid shipments
- `cod_amount` must equal `total_amount` for COD shipments
- Only send `templateName` OR `length/width/height`, not both

### **Ekart Success Response:**

```json
{
  "status": true,
  "remark": "Successfully created shipment",
  "tracking_id": "500999A3408005",
  "vendor": "EKART",
  "barcodes": {
    "wbn": "vendor_waybill_plain_text",
    "order": "order_number",
    "cod": "vendor_cod_waybill_plain_text"
  }
}
```

### **Ekart Error Response:**

```json
{
  "statusCode": 0,
  "code": "string",
  "message": "string",
  "description": "string",
  "severity": "string"
}
```

### **Public Tracking Link Format:**

```
https://app.elite.ekartlogistics.in/track/{tracking_id}
```

Example: `https://app.elite.ekartlogistics.in/track/500999A3408005`

### **Save to Database:**

- `tracking_id` (primary identifier)
- `vendor`
- `barcodes` (JSON object)
- `label_url` (after step 2)
- `order_number` (for reference)

---

## 9️⃣ Reverse Shipment Flow (Customer → Seller – Returns)

Triggered when customer submits a return request.

### Step 1 — Create Reverse Shipment

- `payment_mode` = `"Pickup"`

### Key Rules:

- `drop_location` = customer address
- `pickup_location` = warehouse
- `return_location` optional
- `return_reason` MUST be sent

### **Important Notes for Reverse Shipments:**

- Semantically opposite to forward shipments
- `drop_location` = customer address (where pickup happens)
- `pickup_location` = seller warehouse (where item returns)
- `return_location` can be ignored (defaults to `pickup_location`)

### **Example Reverse Payload:**

```json
{
  "seller_name": "Nivaana Store",
  "seller_address": "Warehouse Address",
  "seller_gst_tin": "29ABCDE1234F2Z5",
  "order_number": "RET-INV1001",
  "invoice_number": "INV1001",
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

---

## 🔟 Reverse Shipments with QC (Optional)

Ekart handles QC physically during pickup.

### ✔ Your responsibility:

- Send QC details.

### ✔ Ekart responsibility:

Delivery agent:

- Inspects item
- Matches IMEI/SKU
- Confirms correct product

### **QC Shipment Requirements:**

- `qc_shipment`: `true` (must be set)
- `qc_details.product_name`: **Required**
- Other QC fields are optional

### **Example QC Payload:**

```json
{
  "qc_shipment": true,
  "qc_details": {
    "product_name": "Bluetooth Earbuds",
    "product_desc": "Wireless Bluetooth 5.0 Earbuds",
    "product_sku": "BE900",
    "product_color": "Black",
    "product_size": "One Size",
    "brand_name": "TechBrand",
    "product_category": "Electronics",
    "ean_barcode": "1234567890123",
    "serial_number": "SN123456789",
    "imei_number": "1234567890",
    "product_images": [
      "https://example.com/image1.jpg",
      "https://example.com/image2.jpg"
    ]
  }
}
```

### **QC Details Field Reference:**

| Field | Required | Description |
|-------|----------|-------------|
| product_name | ✅ Yes | Product name |
| product_desc | ❌ No | Product description |
| product_sku | ❌ No | SKU code |
| product_color | ❌ No | Product color |
| product_size | ❌ No | Product size |
| brand_name | ❌ No | Brand name |
| product_category | ❌ No | Category |
| ean_barcode | ❌ No | EAN barcode |
| serial_number | ❌ No | Serial number |
| imei_number | ❌ No | IMEI (for electronics) |
| product_images | ❌ No | Array of image URLs |

---

## 1️⃣1️⃣ Label Download & Storage Flow

### **Step 1 — Download Label**

**Endpoint:** `POST https://app.elite.ekartlogistics.in/api/v1/package/label`

**Payload:**

```json
{
  "ids": [
    "500999AT876841",
    "500999AT876842"
  ]
}
```

**Note:** You can request multiple labels in a single call.

### **Successful Response (200):**

- Content-Type: `application/octet-stream`
- Ekart returns binary PDF file
- **No JSON response** - direct PDF binary

### **On Failure:**

Ekart returns JSON with:

```json
{
  "statusCode": 0,
  "code": "string",
  "message": "string",
  "description": "string",
  "severity": "string"
}
```

### **Step 2 — Store PDF**

Upload to GCP:

```
gs://nivaana-labels/{tracking_id}.pdf
```

Save URL in orders/shipments table.

### **Implementation Note:**

- Handle binary response correctly (not JSON)
- Set appropriate Content-Type headers when uploading to GCP
- Store both GCP path and public URL if needed

---

## 1️⃣2️⃣ Tracking Flow

**Endpoint:** `GET https://app.elite.ekartlogistics.in/api/v1/track/{tracking_id}`

**Note:** This is an open API (no authentication required for public tracking).

### **Success Response (200):**

```json
{
  "_id": "string",
  "track": {
    "status": "Order Placed",
    "ctime": 1701234567890,
    "pickupTime": 1701234567890,
    "desc": "Shipment picked up from warehouse",
    "location": "Bangalore",
    "ndrStatus": "Unknown Exception",
    "attempts": 1,
    "ndrActions": [
      "Re-Attempt"
    ],
    "details": [
      {
        "status": "Order Placed",
        "ctime": 1701234567890,
        "desc": "Shipment created",
        "location": "Bangalore",
        "ndrStatus": "string"
      }
    ]
  },
  "edd": 1701234567890,
  "order_number": "INV1001"
}
```

### **Common Status Values:**

- Order Placed / CREATED
- PICKUP_SCHEDULED
- PICKED_UP
- IN_TRANSIT
- OUT_FOR_DELIVERY
- DELIVERED
- RTO_INITIATED (Return to Origin)
- RTO_DELIVERED

### **NDR (Non-Delivery Report) Statuses:**

Certain statuses can have an associated `ndrStatus` with possible `ndrActions`. These can be used with the NDR API for handling delivery exceptions.

### **Error Response:**

```json
{
  "statusCode": 0,
  "code": "string",
  "message": "string",
  "description": "string",
  "severity": "string"
}
```

### **Fields Explanation:**

- `track.status`: Current shipment status
- `track.ctime`: Current status timestamp (Unix epoch in milliseconds)
- `track.pickupTime`: Pickup timestamp
- `track.desc`: Status description
- `track.location`: Current location
- `track.ndrStatus`: NDR status (if applicable)
- `track.attempts`: Number of delivery attempts
- `track.ndrActions`: Available actions for NDR (e.g., "Re-Attempt")
- `track.details[]`: Array of all status history
- `edd`: Estimated Delivery Date (Unix epoch in milliseconds)
- `order_number`: Your order number

---

## 1️⃣3️⃣ API Payload Mapping

| Inventory Field | Ekart Field | Notes |
|----------------|-------------|-------|
| order.id | order_number | Unique order identifier |
| invoice_no | invoice_number | Invoice number |
| invoice_date | invoice_date | Format: YYYY-MM-DD |
| customer.name | consignee_name | Recipient name |
| customer.name | drop_location.name | Usually same as consignee_name |
| customer.phone | drop_location.phone | Numeric value |
| customer.address | drop_location.address | Full address |
| customer.city | drop_location.city | City name |
| customer.state | drop_location.state | State name |
| customer.pincode | drop_location.pin | Numeric value |
| product summary | products_desc | Product description |
| total | total_amount | Total order value |
| gst | tax_value | GST amount |
| total - gst | taxable_amount | Amount before tax |
| taxable_amount | commodity_value | String value |
| warehouse alias | pickup_location.name | Only if multiple warehouses |
| standard dimensions | length/width/height | OR use templateName |
| weight | weight | In grams |
| payment type | payment_mode | COD / Prepaid / Pickup |
| return reason | return_reason | Required for reverse shipments |

### **Additional Optional Fields:**

| Inventory Field | Ekart Field | Notes |
|----------------|-------------|-------|
| seller_gst_amount | seller_gst_amount | Optional GST breakdown |
| consignee_gst_amount | consignee_gst_amount | Optional |
| integrated_gst_amount | integrated_gst_amount | Optional |
| consignee_gst_tin | consignee_gst_tin | Customer GST number |
| hsn_code | hsn_code | HSN code for products |
| category | category_of_goods | Product category |
| line_items[] | items[] | Detailed line items array |
| what3words | what3words_address | What3Words address format |
| ewbn | ewbn | External Waybill Number |
| document_number | document_number | Additional document number |
| document_date | document_date | Additional document date |

### **Items Array Structure (Optional):**

Instead of using `products_desc`, you can send detailed line items:

```json
{
  "items": [
    {
      "product_name": "Mens Shirt",
      "sku": "MS-001-M",
      "taxable_value": 475,
      "description": "Mens Cotton Shirt - Medium",
      "quantity": 1,
      "length": 20,
      "height": 15,
      "breadth": 10,
      "weight": 450,
      "hsn_code": "6109",
      "cgst_tax_value": 12,
      "sgst_tax_value": 12,
      "igst_tax_value": 0
    }
  ]
}
```

**Note:** If using `items[]`, you can still include `products_desc` for summary, but detailed tax breakdown per item is available in items array.

---

## 1️⃣4️⃣ Database Schema (Recommended)

### **shipments Table**

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Internal primary key |
| order_id | UUID/String | Nivaana order ID (foreign key) |
| tracking_id | String | Ekart shipment ID (unique) |
| vendor | String | "EKART" |
| barcodes | JSON | {wbn, order, cod} |
| label_url | String | GCP URL to PDF label |
| status | String | Current shipment status |
| direction | String | "forward" / "reverse" |
| payment_mode | String | "COD" / "Prepaid" / "Pickup" |
| return_reason | String | For reverse shipments |
| ekart_response | JSON | Full response from Ekart API |
| error_details | JSON | Error info if creation failed |
| created_at | Timestamp | Record creation time |
| updated_at | Timestamp | Last update time |

### **Error Handling Best Practices:**

1. **Always check response status:**

   ```javascript
   if (response.status === true) {
     // Success - save tracking_id
   } else {
     // Error - log and handle
   }
   ```

2. **Store error details:**

   - Save `statusCode`, `code`, `message`, `description`, `severity` in database
   - Log full error response for debugging

3. **Common Error Scenarios:**

   - Invalid `templateName` → Check template exists in dashboard
   - Missing required fields → Validate payload before API call
   - Invalid pincode → Validate pincode format
   - Authentication failure → Check API token
   - Duplicate `order_number` → Ensure unique order numbers

4. **Retry Logic:**

   - Implement retry for network errors (not for validation errors)
   - Use exponential backoff
   - Maximum 3 retries recommended

5. **Label Download Errors:**

   - Check if `tracking_id` exists before downloading
   - Handle binary vs JSON response correctly
   - Retry label download if initial attempt fails

---

## 1️⃣5️⃣ Node.js Integration Structure

### **Recommended File Structure:**

```
/services/ekart-auth.js
  - connect()                    // Initial connection to get token
  - getValidToken()             // Get token (auto-refresh if needed)
  - refreshToken()              // Force token refresh
  - Token caching & expiry management

/services/ekart.js
  - apiRequest(endpoint, options) // Base method with auto-auth
  - createShipment(payload, direction)
  - createForwardShipment(orderData)
  - createReverseShipment(returnData)
  - downloadLabel(trackingIds[])
  - trackShipment(trackingId)
  - cancelShipment(trackingId)
  - getShippingRates(rateRequest)

/controllers/shipment.js
  - POST /api/shipments/forward
  - POST /api/shipments/reverse
  - GET /api/shipments/:trackingId/label
  - GET /api/shipments/:trackingId/track
  - DELETE /api/shipments/:trackingId/cancel
  - POST /api/shipments/rates

/utils/storage.js
  - uploadPDFtoGCP(buffer, filename)
  - getPublicURL(gcsPath)

/utils/ekart-validator.js
  - validateForwardPayload(payload)
  - validateReversePayload(payload)
  - validateLocation(location)
```

### **Configuration:**

```javascript
// Environment Variables
const EKART_BASE_URL = 'https://app.elite.ekartlogistics.in/api';
const EKART_CLIENT_ID = process.env.EKART_CLIENT_ID;
const EKART_USERNAME = process.env.EKART_USERNAME;
const EKART_PASSWORD = process.env.EKART_PASSWORD;

// Initialize on app startup
const ekartAuth = new EkartAuth(EKART_CLIENT_ID, EKART_USERNAME, EKART_PASSWORD);
await ekartAuth.connect(); // Initial connection

// Use in services
const ekartService = new EkartService(ekartAuth);
```

### **Authentication Integration:**

All API methods in `/services/ekart.js` should use the auth service:

```javascript
// services/ekart.js
class EkartService {
  constructor(authService) {
    this.auth = authService;
    this.baseURL = 'https://app.elite.ekartlogistics.in/api';
  }

  async apiRequest(endpoint, options = {}) {
    const token = await this.auth.getValidToken(); // Auto-refreshes if needed
    
    return fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
  }

  async createShipment(payload) {
    const response = await this.apiRequest('/v1/package/create', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return response.json();
  }
}
```

---

## 1️⃣5️⃣ UI Flow

### Forward Shipment

1. Ready to Dispatch → create shipment
2. Display `tracking_id`
3. Button: Download Label
4. Print & paste
5. Pickup by Ekart

### Reverse Shipment

1. Customer requests return
2. Admin approves → create reverse shipment
3. Return `tracking_id`
4. Ekart picks item → returns to warehouse
5. Warehouse receives → Refund initiated

---

## 1️⃣7️⃣ Sequence Diagrams

### **Forward Shipment Flow:**

```
User → UI: Ready to Dispatch
UI → Backend: POST /api/shipments/forward
Backend → Ekart: POST /v1/package/create
Ekart → Backend: {tracking_id, vendor, barcodes}
Backend → DB: Save shipment record
Backend → Ekart: POST /v1/package/label (with tracking_id)
Ekart → Backend: PDF binary
Backend → GCP: Upload PDF to bucket
Backend → DB: Update label_url
Backend → UI: {tracking_id, label_url, public_tracking_link}
UI → User: Display tracking info & download label button
Courier → Warehouse: Pickup scheduled
Courier → Customer: Delivery
```

### **Reverse Shipment Flow:**

```
Customer → UI: Request return
Admin → UI: Approve return
UI → Backend: POST /api/shipments/reverse
Backend → Ekart: POST /v1/package/create (payment_mode: "Pickup")
Ekart → Backend: {tracking_id, vendor, barcodes}
Backend → DB: Save reverse shipment record
Backend → UI: {tracking_id, public_tracking_link}
Courier → Customer: Pickup from customer
Courier → Warehouse: Return to warehouse
Warehouse → System: Mark as received
System → Finance: Initiate refund
```

---

## 1️⃣8️⃣ Additional API Endpoints

### **Cancel Shipment**

**Endpoint:** `DELETE https://app.elite.ekartlogistics.in/api/v1/package/cancel?tracking_id={tracking_id}`

**Query Parameter:**

- `tracking_id` (required): The shipment ID to cancel

**Success Response (200):**

```json
{
  "status": true,
  "remark": "string",
  "tracking_id": "string"
}
```

**Error Response:**

```json
{
  "statusCode": 0,
  "code": "string",
  "message": "string",
  "description": "string",
  "severity": "string"
}
```

**Use Case:** Cancel a shipment before it's picked up.

---

### **Get Shipping Rates**

**Endpoint:** `POST https://app.elite.ekartlogistics.in/data/pricing/estimate`

**Note:** This endpoint is also available via backend route: `POST /v1/ekart/shipments/rates` (see Section 5.8)

**Payload:**

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
  "type": "WEIGHT_BASED",
  "zone": "string",
  "volumetricWeight": "string",
  "billingWeight": "string",
  "shippingCharge": "string",
  "rtoCharge": "string",
  "fuelSurcharge": "string",
  "codCharge": "string",
  "qcCharge": "string",
  "taxes": "string",
  "total": "string",
  "rid": "string",
  "rSnapshotId": "string"
}
```

**Use Case:** Get estimated shipping costs before creating shipment.

**Service Types:** SURFACE, AIR, etc.

---

## 1️⃣9️⃣ Final Summary

### ✔ **Forward shipments:**

- `payment_mode` = COD / Prepaid
- `drop_location` = customer address
- `pickup_location` = auto-filled (1 warehouse) or send alias (multiple warehouses)
- `return_location` = auto-filled (same as pickup) if not sent

### ✔ **Reverse shipments:**

- `payment_mode` = Pickup
- `drop_location` = customer address (where pickup happens)
- `pickup_location` = seller warehouse (where item returns)
- `return_reason` = **Required**
- `return_location` = can be ignored (defaults to `pickup_location`)

### ✔ **Packaging templates:**

- Use `templateName` OR dimensions (`length, width, height`)
- **Not both** - sending both will cause rejection
- `templateName` must exist in Ekart dashboard

### ✔ **QC (Quality Check):**

- Set `qc_shipment` = `true`
- `product_name` is required in `qc_details`
- Ekart handles QC physically during pickup
- All other QC fields are optional

### ✔ **Label download:**

- PDF binary response (`application/octet-stream`)
- Store in GCP bucket
- Can request multiple labels in one call

### ✔ **Tracking:**

- Use `tracking_id` with `/v1/track/{tracking_id}`
- Public tracking link: `https://app.elite.ekartlogistics.in/track/{tracking_id}`
- NDR statuses available for delivery exceptions

### ✔ **Location structure:**

- Include `location_type` (Home/Office)
- Include `country` field
- `pin` and `phone` should be numbers (not strings)
- `drop_location.name` usually same as `consignee_name`

### ✔ **Additional features:**

- Cancel shipment before pickup
- Get shipping rates estimate
- Detailed line items array (`items[]`)
- Multiple optional GST fields
- HSN code support
- `what3words_address` support

---

## Quick Reference

- **Create Shipment:** `POST /v1/package/create`
- **Download Label:** `POST /v1/package/label`
- **Track Shipment:** `GET /v1/track/{tracking_id}`
- **Cancel Shipment:** `DELETE /v1/package/cancel?tracking_id={tracking_id}`
- **Get Rates:** `POST /data/pricing/estimate`
- **Public Tracking:** `https://app.elite.ekartlogistics.in/track/{tracking_id}`

---

**Document Version:** 1.0  
**Last Updated:** December 3, 2025  
**API Base URL:** `https://app.elite.ekartlogistics.in/api`
