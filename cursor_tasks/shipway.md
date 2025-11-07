🚚 Nivaana — Order Fulfillment & Shipway Integration Flow (Final Developer Guide)
Overview

This document defines the full lifecycle for order fulfillment integrated with Shipway.
It explains how your Mobile App, Backend (Orders + Inventory), and Shipway APIs work together from checkout → shipping → tracking.

All API structures are based on official Shipway documentation:
🔗 https://apidocs.shipway.com

🧭 SYSTEM OVERVIEW

| Component | Role |
|-----------|------|
| Mobile App | Handles checkout flow — checks courier serviceability, gets shipping rate, and sends final order request |
| Backend (Node.js / Fastify) | Maintains Orders, Stock, and Shipments, and calls Shipway APIs |
| Inventory Module | Handles product allocation, packaging, dispatch, and status updates |
| Shipway | Provides carrier rates, order booking, label generation, pickup, and tracking APIs |

---

## 🏢 WAREHOUSE SETUP (FIRST TIME ONLY)

### Step 1: Register Your Warehouse in Shipway

Before you can create shipments, you **MUST** register your warehouse/pickup address in Shipway:

1. **Login to Shipway Dashboard**
   - URL: https://app.shipway.com
   - Use your Shipway account credentials

2. **Navigate to Warehouse Management**
   - Go to **Settings** → **Manage Warehouse Address** (or **Pickup Addresses**)

3. **Add New Warehouse Address**
   ```
   Warehouse Name: Nivaana Warehouse
   Address: Plot 123, Industrial Area
   City: Mumbai
   State: Maharashtra
   Pincode: 400703
   Phone: 8888888888
   Email: warehouse@nivaana.com
   ```

4. **Get Pickup Address ID (warehouse_id)**
   - After saving, you will see your warehouse listed
   - Each warehouse has a unique **Pickup Address ID** (e.g., 123456)
   - **This ID is your `warehouse_id`** - COPY IT!

5. **Add to Environment Variables**
   ```bash
   WAREHOUSE_ID=123456
   ```

### ⚠️ Important Notes:

- `warehouse_id` is **REQUIRED** for POST /v2orders (label generation API)
- Without a valid `warehouse_id`, shipment creation will **fail**
- The `pickup_pincode` in your order must match the pincode of the registered warehouse
- You can have multiple warehouses, each with a unique `warehouse_id`

---

🧩 STEP-BY-STEP FLOW
🟩 STEP 1 — Checkout (Before Order Placement)

### 1️⃣ Check courier serviceability and get shipping rate

Use Shipway's Pincode Serviceability + Rate API before the order is placed.

**API Endpoint:**

```http
GET https://app.shipway.com/api/getshipwaycarrierrates?fromPincode={seller_pincode}&toPincode={customer_pincode}&paymentType={prepaid|cod}
```

**Request Example:**

```http
GET https://app.shipway.com/api/getshipwaycarrierrates?fromPincode=400703&toPincode=400706&paymentType=prepaid
```

**Success Response (200 OK):**

```json
{
  "success": "success",
  "rate_card": [
    {
      "carrier_id": 7377,
      "courier_name": "Shipway Bluedart Express (0.5kg)",
      "delivery_charge": 50,
      "rto_charge": 50,
      "charged_weight": 0.5,
      "zone": 1,
      "estimated_delivery_days": "2-3"
    },
    {
      "carrier_id": 7378,
      "courier_name": "Shipway Delhivery Surface (0.5kg)",
      "delivery_charge": 35,
      "rto_charge": 35,
      "charged_weight": 0.5,
      "zone": 1,
      "estimated_delivery_days": "4-5"
    },
    {
      "carrier_id": 7379,
      "courier_name": "Shipway Ecom Express (0.5kg)",
      "delivery_charge": 40,
      "rto_charge": 40,
      "charged_weight": 0.5,
      "zone": 1,
      "estimated_delivery_days": "3-4"
    }
  ]
}
```

**Error Response (Service Not Available):**

```json
{
  "success": "failure",
  "message": "No carriers available for this route",
  "error_code": "NO_SERVICEABILITY"
}
```

**Error Response (Invalid Pincode):**

```json
{
  "success": "failure",
  "message": "Invalid destination pincode",
  "error_code": "INVALID_PINCODE"
}
```

### 2️⃣ Show available couriers in the app

Display options like "Bluedart – ₹50 (0.5 kg)" or best rate automatically.

**Mobile App UI Data Format:**

```json
{
  "availableCouriers": [
    {
      "id": 7377,
      "name": "Bluedart Express",
      "price": 50,
      "weight": "0.5kg",
      "deliveryTime": "2-3 days",
      "recommended": true
    },
    {
      "id": 7378,
      "name": "Delhivery Surface",
      "price": 35,
      "weight": "0.5kg",
      "deliveryTime": "4-5 days",
      "recommended": false
    }
  ],
  "selectedCarrier": 7378
}
```

### 3️⃣ Include delivery charge in total order amount

```javascript
orderAmount = productTotal + delivery_charge;
```

**Calculation Example:**

```json
{
  "cartItems": [
    {
      "product_id": "PROD001",
      "name": "Lavender Incense Sticks",
      "quantity": 2,
      "unit_price": 150,
      "subtotal": 300
    },
    {
      "product_id": "PROD002",
      "name": "Scented Candle",
      "quantity": 1,
      "unit_price": 200,
      "subtotal": 200
    }
  ],
  "productTotal": 500,
  "selectedCarrier": {
    "carrier_id": 7378,
    "name": "Delhivery Surface",
    "delivery_charge": 35
  },
  "orderAmount": 535,
  "paymentType": "prepaid"
}
```

### 4️⃣ When the user places order

Send carrier_id, delivery_charge, and paymentType along with order details to your backend.

**Mobile App → Backend Request:**

```json
{
  "customer_id": "CUST001",
  "customer_name": "John Doe",
  "customer_phone": "9999999999",
  "customer_email": "john@example.com",
  "delivery_address": {
    "address_line_1": "123 Street Name",
    "address_line_2": "Near Landmark",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400706",
    "country": "India"
  },
  "payment_mode": "prepaid",
  "payment_status": "completed",
  "items": [
    {
      "product_id": "PROD001",
      "sku": "LAV-INC-100",
      "name": "Lavender Incense Sticks",
      "quantity": 2,
      "unit_price": 150,
      "subtotal": 300
    },
    {
      "product_id": "PROD002",
      "sku": "SCENT-CANDLE-01",
      "name": "Scented Candle",
      "quantity": 1,
      "unit_price": 200,
      "subtotal": 200
    }
  ],
  "shipping": {
    "carrier_id": 7378,
    "carrier_name": "Delhivery Surface",
    "delivery_charge": 35,
    "estimated_delivery_days": "4-5"
  },
  "order_summary": {
    "subtotal": 500,
    "shipping_charge": 35,
    "tax": 0,
    "discount": 0,
    "total_amount": 535
  }
}
```

✅ **At this point:**
- You've confirmed serviceability
- You've selected the carrier to be used later in shipment creation
- Order data includes all necessary shipping information

🟨 STEP 2 — Order Creation in Backend

When the order request arrives from the app:

1. **Create order & orderlines**
2. **Save shipping information:** carrier_id, delivery_charge, payment_mode (prepaid / cod)
3. **Validate stock** (you already restrict 0-stock in app)
4. **Set status** = "pending_fulfillment"

### Database Record: Orders Table

```json
{
  "id": "ORD12345",
  "customer_id": "CUST001",
  "customer_name": "John Doe",
  "customer_phone": "9999999999",
  "customer_email": "john@example.com",
  "delivery_address": "123 Street Name, Near Landmark, Mumbai, Maharashtra - 400706",
  "delivery_pincode": "400706",
  "pickup_pincode": "400703",
  "payment_mode": "prepaid",
  "payment_status": "completed",
  "order_amount": 535,
  "subtotal": 500,
  "shipping_charge": 35,
  "tax_amount": 0,
  "discount_amount": 0,
  "carrier_id": 7378,
  "carrier_name": "Delhivery Surface",
  "estimated_delivery_days": "4-5",
  "status": "pending_fulfillment",
  "created_at": "2025-11-07T10:30:00Z",
  "updated_at": "2025-11-07T10:30:00Z"
}
```

### Database Record: OrderLines Table

```json
[
  {
    "id": "OL001",
    "order_id": "ORD12345",
    "product_id": "PROD001",
    "sku": "LAV-INC-100",
    "product_name": "Lavender Incense Sticks",
    "quantity": 2,
    "unit_price": 150,
    "subtotal": 300,
    "status": "pending",
    "created_at": "2025-11-07T10:30:00Z"
  },
  {
    "id": "OL002",
    "order_id": "ORD12345",
    "product_id": "PROD002",
    "sku": "SCENT-CANDLE-01",
    "product_name": "Scented Candle",
    "quantity": 1,
    "unit_price": 200,
    "subtotal": 200,
    "status": "pending",
    "created_at": "2025-11-07T10:30:00Z"
  }
]
```

### Backend API Response to Mobile App

```json
{
  "success": true,
  "message": "Order created successfully",
  "data": {
    "order_id": "ORD12345",
    "order_number": "NIV-2025-12345",
    "status": "pending_fulfillment",
    "total_amount": 535,
    "estimated_delivery": "11-12 Nov 2025",
    "payment_status": "completed",
    "items_count": 2,
    "tracking_url": null
  }
}
```

🟧 STEP 3 — Inventory Fulfillment

Once warehouse team starts processing:

### Phase 1: Pick Stock

**Select stock items** (each item = individual stock entry)

**API Request: Get Pickable Stock**

```json
GET /api/inventory/pickable?order_id=ORD12345

Response:
{
  "order_id": "ORD12345",
  "items_to_pick": [
    {
      "orderline_id": "OL001",
      "sku": "LAV-INC-100",
      "product_name": "Lavender Incense Sticks",
      "quantity_required": 2,
      "available_stock": [
        {
          "stock_id": "STK001",
          "location": "Rack-A-01",
          "batch_no": "BATCH001",
          "expiry_date": "2026-12-31"
        },
        {
          "stock_id": "STK002",
          "location": "Rack-A-01",
          "batch_no": "BATCH001",
          "expiry_date": "2026-12-31"
        }
      ]
    },
    {
      "orderline_id": "OL002",
      "sku": "SCENT-CANDLE-01",
      "product_name": "Scented Candle",
      "quantity_required": 1,
      "available_stock": [
        {
          "stock_id": "STK003",
          "location": "Rack-B-05",
          "batch_no": "BATCH002",
          "expiry_date": "2027-06-30"
        }
      ]
    }
  ]
}
```

**API Request: Mark Items as Picked**

```json
POST /api/inventory/pick

Request Body:
{
  "order_id": "ORD12345",
  "picked_items": [
    {
      "stock_id": "STK001",
      "orderline_id": "OL001",
      "sku": "LAV-INC-100",
      "picked_by": "USER_WAREHOUSE_01",
      "picked_at": "2025-11-07T11:00:00Z"
    },
    {
      "stock_id": "STK002",
      "orderline_id": "OL001",
      "sku": "LAV-INC-100",
      "picked_by": "USER_WAREHOUSE_01",
      "picked_at": "2025-11-07T11:01:00Z"
    },
    {
      "stock_id": "STK003",
      "orderline_id": "OL002",
      "sku": "SCENT-CANDLE-01",
      "picked_by": "USER_WAREHOUSE_01",
      "picked_at": "2025-11-07T11:02:00Z"
    }
  ]
}

Response:
{
  "success": true,
  "message": "All items picked successfully",
  "order_id": "ORD12345",
  "status": "picked",
  "items_picked": 3
}
```

**Database Update: Stock Table**

```json
[
  {
    "id": "STK001",
    "sku": "LAV-INC-100",
    "status": "picked",
    "order_id": "ORD12345",
    "picked_by": "USER_WAREHOUSE_01",
    "picked_at": "2025-11-07T11:00:00Z"
  },
  {
    "id": "STK002",
    "sku": "LAV-INC-100",
    "status": "picked",
    "order_id": "ORD12345",
    "picked_by": "USER_WAREHOUSE_01",
    "picked_at": "2025-11-07T11:01:00Z"
  },
  {
    "id": "STK003",
    "sku": "SCENT-CANDLE-01",
    "status": "picked",
    "order_id": "ORD12345",
    "picked_by": "USER_WAREHOUSE_01",
    "picked_at": "2025-11-07T11:02:00Z"
  }
]
```

### Phase 2: Pack Items

**Add package weight / dimensions and scan SKU → verify**

**API Request: Create Package**

```json
POST /api/inventory/pack

Request Body:
{
  "order_id": "ORD12345",
  "package_details": {
    "package_id": "PKG12345",
    "actual_weight": 0.45,
    "charged_weight": 0.5,
    "length": 15,
    "breadth": 10,
    "height": 5,
    "package_content": "Incense sticks and candles",
    "fragile": false,
    "packed_by": "USER_WAREHOUSE_01",
    "packed_at": "2025-11-07T11:30:00Z"
  },
  "verified_items": [
    {
      "stock_id": "STK001",
      "sku": "LAV-INC-100",
      "verified": true
    },
    {
      "stock_id": "STK002",
      "sku": "LAV-INC-100",
      "verified": true
    },
    {
      "stock_id": "STK003",
      "sku": "SCENT-CANDLE-01",
      "verified": true
    }
  ]
}

Response:
{
  "success": true,
  "message": "Package created successfully",
  "order_id": "ORD12345",
  "package_id": "PKG12345",
  "status": "packed",
  "ready_for_dispatch": true
}
```

**Database Record: Packages Table**

```json
{
  "id": "PKG12345",
  "order_id": "ORD12345",
  "actual_weight": 0.45,
  "charged_weight": 0.5,
  "length": 15,
  "breadth": 10,
  "height": 5,
  "package_content": "Incense sticks and candles",
  "fragile": false,
  "packed_by": "USER_WAREHOUSE_01",
  "packed_at": "2025-11-07T11:30:00Z",
  "status": "ready_for_dispatch"
}
```

### Phase 3: Ready for Dispatch

**Update order status → ready_for_dispatch**

**Database Update: Orders Table**

```json
{
  "id": "ORD12345",
  "status": "ready_for_dispatch",
  "package_id": "PKG12345",
  "updated_at": "2025-11-07T11:30:00Z"
}
```

🟥 STEP 4 — Create Shipment with Shipway

Now create the shipment in Shipway using the same carrier_id from checkout.

### ⚠️ Prerequisites

Before creating a shipment, ensure you have:

1. **Warehouse registered in Shipway dashboard**
   - Login to https://app.shipway.com
   - Navigate to **Settings → Manage Warehouse Address**
   - Add your pickup address (warehouse) if not already added
   - Note down the **Pickup Address ID** (this is your `warehouse_id`)

2. **Required information from previous steps:**
   - `carrier_id` (from Step 1: Rate API)
   - `order_id` (from Step 2: Order Creation)
   - `package_id` (from Step 3: Packing)

**API Endpoint:**

```http
POST https://app.shipway.com/api/v2orders
Content-Type: application/json
```

**Complete Request Payload:**

```json
{
  "username": "your_shipway_username",
  "password": "your_license_key",
  "carrier_id": 7378,
  "warehouse_id": 123456,
  "order_id": "ORD12345",
  "order_date": "2025-11-07",
  "pickup_pincode": "400703",
  "delivery_pincode": "400706",
  "payment_mode": "prepaid",
  "package_content": "Incense sticks and candles",
  "no_of_items": 2,
  "order_amount": 535,
  "actual_weight": 0.45,
  "charged_weight": 0.5,
  "length": 15,
  "breadth": 10,
  "height": 5,
  "customer_name": "John Doe",
  "customer_phone": "9999999999",
  "customer_email": "john@example.com",
  "customer_address": "123 Street, Near Landmark",
  "customer_address_2": "Mumbai, Maharashtra",
  "customer_city": "Mumbai",
  "customer_state": "Maharashtra",
  "customer_country": "India",
  "pickup_address_name": "Nivaana Warehouse",
  "pickup_name": "Warehouse Team",
  "pickup_phone": "8888888888",
  "pickup_email": "warehouse@nivaana.com",
  "pickup_address": "Plot 123, Industrial Area",
  "pickup_city": "Mumbai",
  "pickup_state": "Maharashtra",
  "pickup_country": "India",
  "reseller_name": "Nivaana",
  "invoice_number": "INV-12345",
  "invoice_date": "2025-11-07"
}
```

**Important Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `username` | Yes | Your Shipway account username |
| `password` | Yes | Your Shipway license key (not account password) |
| `carrier_id` | Yes | Carrier ID from rate API response |
| `warehouse_id` | **Yes** | **Pickup Address ID from Shipway dashboard** (Manage Warehouse Address) |
| `order_id` | Yes | Your unique order ID |
| `pickup_pincode` | Yes | Warehouse pincode (must match registered address) |
| `delivery_pincode` | Yes | Customer delivery pincode |
| `payment_mode` | Yes | 'prepaid' or 'cod' |
| `order_amount` | Yes | Total order amount including shipping |
| `actual_weight` | Yes | Actual package weight in kg |
| `charged_weight` | Yes | Charged weight from rate API |

**Success Response (200 OK):**

```json
{
  "success": true,
  "awb": "12971049012345",
  "label_url": "https://shipway.in/label/ORD12345.pdf",
  "carrier_id": 7378,
  "courier_name": "Delhivery Surface",
  "order_id": "ORD12345",
  "pickup_scheduled": true,
  "pickup_date": "2025-11-08",
  "estimated_delivery_date": "2025-11-12"
}
```

**Error Response (Duplicate Order):**

```json
{
  "success": false,
  "error": "Order ID already exists",
  "error_code": "DUPLICATE_ORDER",
  "existing_awb": "12971049012345"
}
```

**Error Response (Invalid Carrier):**

```json
{
  "success": false,
  "error": "Carrier not available for this route",
  "error_code": "CARRIER_NOT_AVAILABLE",
  "available_carriers": [7379, 7380]
}
```

**Error Response (Weight Mismatch):**

```json
{
  "success": false,
  "error": "Actual weight exceeds carrier limit",
  "error_code": "WEIGHT_EXCEEDED",
  "max_weight": 0.5,
  "provided_weight": 0.75
}
```

### Database Update: Shipments Table

```json
{
  "id": "SHIP12345",
  "order_id": "ORD12345",
  "package_id": "PKG12345",
  "carrier_id": 7378,
  "carrier_name": "Delhivery Surface",
  "awb": "12971049012345",
  "label_url": "https://shipway.in/label/ORD12345.pdf",
  "shipment_status": "booked",
  "pickup_scheduled": true,
  "pickup_date": "2025-11-08",
  "estimated_delivery_date": "2025-11-12",
  "created_at": "2025-11-07T12:00:00Z",
  "updated_at": "2025-11-07T12:00:00Z"
}
```

### Database Update: Orders Table

```json
{
  "id": "ORD12345",
  "status": "dispatched",
  "shipment_id": "SHIP12345",
  "awb": "12971049012345",
  "label_url": "https://shipway.in/label/ORD12345.pdf",
  "tracking_url": "https://shipway.in/track/12971049012345",
  "updated_at": "2025-11-07T12:00:00Z"
}
```

### Actions After Successful Shipment Creation:

✅ **Store AWB and label_url** in your database

✅ **Print the shipping label** and attach it to the package

✅ **Schedule pickup** via Shipway dashboard or API

✅ **Notify customer** via email/SMS with tracking link

**Customer Notification Example (SMS/Email):**

```json
{
  "order_id": "ORD12345",
  "message": "Your Nivaana order ORD12345 has been dispatched! Track your order: https://shipway.in/track/12971049012345",
  "awb": "12971049012345",
  "tracking_url": "https://shipway.in/track/12971049012345",
  "estimated_delivery": "12 Nov 2025"
}
```

🟦 STEP 5 — Update Inventory & Order Status

Once the shipment is confirmed:

### 1. Mark stock as sold

**Database Update: Stock Table**

```sql
UPDATE stock
SET status = 'sold', 
    order_id = 'ORD12345',
    sold_at = '2025-11-07T12:00:00Z'
WHERE id IN ('STK001', 'STK002', 'STK003');
```

**Stock Records After Update:**

```json
[
  {
    "id": "STK001",
    "sku": "LAV-INC-100",
    "product_id": "PROD001",
    "status": "sold",
    "order_id": "ORD12345",
    "picked_at": "2025-11-07T11:00:00Z",
    "sold_at": "2025-11-07T12:00:00Z"
  },
  {
    "id": "STK002",
    "sku": "LAV-INC-100",
    "product_id": "PROD001",
    "status": "sold",
    "order_id": "ORD12345",
    "picked_at": "2025-11-07T11:01:00Z",
    "sold_at": "2025-11-07T12:00:00Z"
  },
  {
    "id": "STK003",
    "sku": "SCENT-CANDLE-01",
    "product_id": "PROD002",
    "status": "sold",
    "order_id": "ORD12345",
    "picked_at": "2025-11-07T11:02:00Z",
    "sold_at": "2025-11-07T12:00:00Z"
  }
]
```

### 2. Decrease available quantity

**Database Update: Products/Inventory Summary**

```sql
UPDATE products
SET available_quantity = available_quantity - sold_quantity,
    updated_at = CURRENT_TIMESTAMP
WHERE id IN ('PROD001', 'PROD002');
```

**Products Inventory Before/After:**

```json
{
  "before": [
    {
      "id": "PROD001",
      "sku": "LAV-INC-100",
      "name": "Lavender Incense Sticks",
      "total_quantity": 100,
      "available_quantity": 85,
      "sold_quantity": 15
    },
    {
      "id": "PROD002",
      "sku": "SCENT-CANDLE-01",
      "name": "Scented Candle",
      "total_quantity": 50,
      "available_quantity": 30,
      "sold_quantity": 20
    }
  ],
  "after": [
    {
      "id": "PROD001",
      "sku": "LAV-INC-100",
      "name": "Lavender Incense Sticks",
      "total_quantity": 100,
      "available_quantity": 83,
      "sold_quantity": 17
    },
    {
      "id": "PROD002",
      "sku": "SCENT-CANDLE-01",
      "name": "Scented Candle",
      "total_quantity": 50,
      "available_quantity": 29,
      "sold_quantity": 21
    }
  ]
}
```

### 3. Update order status to dispatched

**Database Update: Orders Table**

```json
{
  "id": "ORD12345",
  "status": "dispatched",
  "dispatched_at": "2025-11-07T12:00:00Z",
  "updated_at": "2025-11-07T12:00:00Z"
}
```

### 4. Update OrderLines status

```json
[
  {
    "id": "OL001",
    "order_id": "ORD12345",
    "status": "dispatched"
  },
  {
    "id": "OL002",
    "order_id": "ORD12345",
    "status": "dispatched"
  }
]
```

🟪 STEP 6 — Tracking & Delivery Updates

Use one of the following methods to track progress:

## Option A — API Polling

**API Endpoint:**

```http
POST https://shipway.in/api/getOrderShipmentDetails
Content-Type: application/json
```

**Request Body:**

```json
{
  "username": "your_shipway_username",
  "password": "your_license_key",
  "order_id": "ORD12345"
}
```

**Success Response - In Transit:**

```json
{
  "success": true,
  "order_id": "ORD12345",
  "awb": "12971049012345",
  "carrier_name": "Delhivery Surface",
  "current_status": "In Transit",
  "current_status_code": "IT",
  "current_status_description": "Shipment is in transit to destination",
  "track_url": "https://shipway.in/track/12971049012345",
  "estimated_delivery_date": "2025-11-12",
  "last_update": "2025-11-09T15:30:00Z",
  "tracking_history": [
    {
      "status": "Booked",
      "status_code": "BK",
      "location": "Mumbai Hub",
      "timestamp": "2025-11-07T12:00:00Z",
      "description": "Shipment booked successfully"
    },
    {
      "status": "Picked Up",
      "status_code": "PP",
      "location": "Mumbai Hub",
      "timestamp": "2025-11-08T10:30:00Z",
      "description": "Shipment picked up from origin"
    },
    {
      "status": "In Transit",
      "status_code": "IT",
      "location": "Mumbai Sorting Center",
      "timestamp": "2025-11-09T08:15:00Z",
      "description": "Shipment in transit"
    },
    {
      "status": "In Transit",
      "status_code": "IT",
      "location": "Mumbai Destination Hub",
      "timestamp": "2025-11-09T15:30:00Z",
      "description": "Reached destination hub"
    }
  ]
}
```

**Success Response - Out for Delivery:**

```json
{
  "success": true,
  "order_id": "ORD12345",
  "awb": "12971049012345",
  "carrier_name": "Delhivery Surface",
  "current_status": "Out for Delivery",
  "current_status_code": "OFD",
  "current_status_description": "Shipment is out for delivery",
  "track_url": "https://shipway.in/track/12971049012345",
  "estimated_delivery_date": "2025-11-12",
  "delivery_person": {
    "name": "Ramesh Kumar",
    "phone": "9876543210"
  },
  "last_update": "2025-11-12T09:00:00Z"
}
```

**Success Response - Delivered:**

```json
{
  "success": true,
  "order_id": "ORD12345",
  "awb": "12971049012345",
  "carrier_name": "Delhivery Surface",
  "current_status": "Delivered",
  "current_status_code": "DL",
  "current_status_description": "Shipment delivered successfully",
  "track_url": "https://shipway.in/track/12971049012345",
  "delivered_at": "2025-11-12T14:30:00Z",
  "delivered_to": "John Doe",
  "signature_url": "https://shipway.in/pod/12971049012345.jpg",
  "delivery_person": {
    "name": "Ramesh Kumar",
    "phone": "9876543210"
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "error": "Order not found",
  "error_code": "ORDER_NOT_FOUND"
}
```

## Option B — Webhook (Recommended)

Shipway can directly call your endpoint whenever status changes (Picked, In-Transit, Out for Delivery, Delivered, RTO, etc.).

**Your Webhook Endpoint:**

```http
POST https://yourbackend.com/api/shipway/webhook
Content-Type: application/json
```

**Webhook Payload - Picked Up:**

```json
{
  "event": "status_update",
  "order_id": "ORD12345",
  "awb": "12971049012345",
  "carrier_id": 7378,
  "carrier_name": "Delhivery Surface",
  "status": "Picked Up",
  "status_code": "PP",
  "status_description": "Shipment picked up from origin",
  "location": "Mumbai Hub",
  "timestamp": "2025-11-08T10:30:00Z",
  "estimated_delivery_date": "2025-11-12"
}
```

**Webhook Payload - In Transit:**

```json
{
  "event": "status_update",
  "order_id": "ORD12345",
  "awb": "12971049012345",
  "carrier_id": 7378,
  "carrier_name": "Delhivery Surface",
  "status": "In Transit",
  "status_code": "IT",
  "status_description": "Shipment in transit to destination",
  "location": "Mumbai Destination Hub",
  "timestamp": "2025-11-09T15:30:00Z",
  "estimated_delivery_date": "2025-11-12"
}
```

**Webhook Payload - Out for Delivery:**

```json
{
  "event": "status_update",
  "order_id": "ORD12345",
  "awb": "12971049012345",
  "carrier_id": 7378,
  "carrier_name": "Delhivery Surface",
  "status": "Out for Delivery",
  "status_code": "OFD",
  "status_description": "Shipment is out for delivery",
  "location": "Mumbai Local Hub",
  "timestamp": "2025-11-12T09:00:00Z",
  "delivery_person": {
    "name": "Ramesh Kumar",
    "phone": "9876543210"
  },
  "estimated_delivery_time": "2025-11-12T14:00:00Z"
}
```

**Webhook Payload - Delivered:**

```json
{
  "event": "status_update",
  "order_id": "ORD12345",
  "awb": "12971049012345",
  "carrier_id": 7378,
  "carrier_name": "Delhivery Surface",
  "status": "Delivered",
  "status_code": "DL",
  "status_description": "Shipment delivered successfully",
  "location": "Customer Address",
  "timestamp": "2025-11-12T14:30:00Z",
  "delivered_to": "John Doe",
  "signature_url": "https://shipway.in/pod/12971049012345.jpg",
  "delivery_person": {
    "name": "Ramesh Kumar",
    "phone": "9876543210"
  }
}
```

**Webhook Payload - Delivery Failed:**

```json
{
  "event": "status_update",
  "order_id": "ORD12345",
  "awb": "12971049012345",
  "carrier_id": 7378,
  "carrier_name": "Delhivery Surface",
  "status": "Delivery Failed",
  "status_code": "DF",
  "status_description": "Customer not available",
  "location": "Customer Address",
  "timestamp": "2025-11-12T14:30:00Z",
  "failure_reason": "Customer not available",
  "retry_scheduled": true,
  "next_attempt_date": "2025-11-13"
}
```

**Webhook Payload - RTO (Return to Origin):**

```json
{
  "event": "status_update",
  "order_id": "ORD12345",
  "awb": "12971049012345",
  "carrier_id": 7378,
  "carrier_name": "Delhivery Surface",
  "status": "RTO",
  "status_code": "RTO",
  "status_description": "Shipment returning to origin",
  "location": "Mumbai Hub",
  "timestamp": "2025-11-15T10:00:00Z",
  "rto_reason": "Multiple delivery attempts failed",
  "estimated_return_date": "2025-11-18"
}
```

### Your Webhook Handler Response:

```json
{
  "success": true,
  "message": "Webhook received and processed",
  "order_id": "ORD12345"
}
```

### Database Update on Webhook Receipt:

```json
{
  "shipment_id": "SHIP12345",
  "order_id": "ORD12345",
  "status": "delivered",
  "delivered_at": "2025-11-12T14:30:00Z",
  "delivered_to": "John Doe",
  "signature_url": "https://shipway.in/pod/12971049012345.jpg",
  "updated_at": "2025-11-12T14:30:00Z"
}
```

🟫 STEP 7 — COD / Return Handling

## COD (Cash on Delivery) Handling

### 1. Order Creation with COD

**Order Request with COD:**

```json
{
  "order_id": "ORD12346",
  "customer_name": "Jane Smith",
  "payment_mode": "cod",
  "payment_status": "pending",
  "order_amount": 650,
  "cod_amount": 650,
  "items": [...]
}
```

### 2. After Delivery - COD Remittance

**Shipway Webhook - COD Delivered:**

```json
{
  "event": "status_update",
  "order_id": "ORD12346",
  "awb": "12971049067890",
  "status": "Delivered",
  "status_code": "DL",
  "payment_mode": "cod",
  "cod_amount_collected": 650,
  "delivered_at": "2025-11-13T16:00:00Z",
  "remittance_status": "pending"
}
```

### 3. COD Remittance Reconciliation API

**API Endpoint:**

```http
POST https://app.shipway.com/api/getCODRemittance
Content-Type: application/json
```

**Request:**

```json
{
  "username": "your_shipway_username",
  "password": "your_license_key",
  "from_date": "2025-11-01",
  "to_date": "2025-11-30"
}
```

**Response:**

```json
{
  "success": true,
  "remittance_data": [
    {
      "order_id": "ORD12346",
      "awb": "12971049067890",
      "cod_amount": 650,
      "remittance_amount": 650,
      "remittance_date": "2025-11-18",
      "remittance_status": "completed",
      "utr_number": "UTR2025111800123",
      "bank_reference": "REF123456"
    }
  ]
}
```

### 4. Database Update - COD Reconciliation

```json
{
  "order_id": "ORD12346",
  "payment_status": "completed",
  "cod_collected": 650,
  "cod_remitted": 650,
  "remittance_date": "2025-11-18",
  "utr_number": "UTR2025111800123",
  "updated_at": "2025-11-18T10:00:00Z"
}
```

## Return / RTO (Return to Origin) Handling

### 1. Automatic RTO - Delivery Failed

**Webhook - RTO Initiated:**

```json
{
  "event": "status_update",
  "order_id": "ORD12347",
  "awb": "12971049098765",
  "status": "RTO Initiated",
  "status_code": "RTOI",
  "status_description": "Return to origin initiated",
  "rto_reason": "Customer refused delivery",
  "timestamp": "2025-11-15T10:00:00Z"
}
```

**Webhook - RTO In Transit:**

```json
{
  "event": "status_update",
  "order_id": "ORD12347",
  "awb": "12971049098765",
  "status": "RTO In Transit",
  "status_code": "RTOT",
  "status_description": "Shipment returning to origin",
  "location": "Mumbai Hub",
  "timestamp": "2025-11-16T14:00:00Z",
  "estimated_return_date": "2025-11-18"
}
```

**Webhook - RTO Delivered:**

```json
{
  "event": "status_update",
  "order_id": "ORD12347",
  "awb": "12971049098765",
  "status": "RTO Delivered",
  "status_code": "RTOD",
  "status_description": "Shipment returned to origin successfully",
  "location": "Nivaana Warehouse",
  "timestamp": "2025-11-18T11:00:00Z",
  "rto_charges": 50
}
```

### 2. Customer Initiated Return (Exchange/Refund)

**Create Reverse Shipment API:**

```http
POST https://app.shipway.com/api/v2orders/reverse
Content-Type: application/json
```

**Request Payload:**

```json
{
  "username": "your_shipway_username",
  "password": "your_license_key",
  "original_order_id": "ORD12345",
  "original_awb": "12971049012345",
  "return_order_id": "RET12345",
  "carrier_id": 7378,
  "pickup_pincode": "400706",
  "delivery_pincode": "400703",
  "return_reason": "Product defective",
  "package_content": "Incense sticks (Return)",
  "no_of_items": 2,
  "order_amount": 300,
  "actual_weight": 0.45,
  "charged_weight": 0.5,
  "length": 15,
  "breadth": 10,
  "height": 5,
  "customer_name": "John Doe",
  "customer_phone": "9999999999",
  "customer_email": "john@example.com",
  "customer_address": "123 Street, Mumbai",
  "pickup_date": "2025-11-20",
  "delivery_address_name": "Nivaana Warehouse",
  "delivery_name": "Warehouse Team",
  "delivery_phone": "8888888888"
}
```

**Success Response:**

```json
{
  "success": true,
  "return_order_id": "RET12345",
  "awb": "12971049111222",
  "label_url": "https://shipway.in/label/RET12345.pdf",
  "pickup_scheduled": true,
  "pickup_date": "2025-11-20"
}
```

### 3. Database Records - Return Order

**Returns Table:**

```json
{
  "id": "RET12345",
  "original_order_id": "ORD12345",
  "return_type": "customer_return",
  "return_reason": "Product defective",
  "return_status": "pickup_scheduled",
  "return_awb": "12971049111222",
  "return_label_url": "https://shipway.in/label/RET12345.pdf",
  "pickup_date": "2025-11-20",
  "refund_amount": 300,
  "refund_status": "pending",
  "created_at": "2025-11-18T15:00:00Z"
}
```

### 4. Return Received - Inventory Update

**Webhook - Return Delivered to Warehouse:**

```json
{
  "event": "status_update",
  "order_id": "RET12345",
  "awb": "12971049111222",
  "status": "Delivered",
  "status_code": "DL",
  "status_description": "Return delivered to warehouse",
  "timestamp": "2025-11-22T10:30:00Z"
}
```

**Database Update - Stock Re-entry:**

```json
[
  {
    "id": "STK004",
    "sku": "LAV-INC-100",
    "product_id": "PROD001",
    "status": "returned",
    "return_id": "RET12345",
    "condition": "defective",
    "received_at": "2025-11-22T10:30:00Z"
  },
  {
    "id": "STK005",
    "sku": "LAV-INC-100",
    "product_id": "PROD001",
    "status": "returned",
    "return_id": "RET12345",
    "condition": "defective",
    "received_at": "2025-11-22T10:30:00Z"
  }
]
```

### 5. Process Refund

**Refund Processing:**

```json
{
  "return_id": "RET12345",
  "original_order_id": "ORD12345",
  "refund_amount": 300,
  "refund_method": "original_payment_source",
  "refund_status": "completed",
  "refund_date": "2025-11-23",
  "refund_reference": "REF2025112300456"
}
```

**Update Order Record:**

```json
{
  "order_id": "ORD12345",
  "status": "returned",
  "return_id": "RET12345",
  "refund_status": "completed",
  "updated_at": "2025-11-23T14:00:00Z"
}
```

📊 DATABASE SCHEMA

## Essential Tables for Shipway Integration

### 1. Orders Table

```sql
CREATE TABLE orders (
  id VARCHAR(50) PRIMARY KEY,
  order_number VARCHAR(100) UNIQUE NOT NULL,
  customer_id VARCHAR(50),
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  customer_email VARCHAR(255),
  delivery_address TEXT,
  delivery_pincode VARCHAR(10),
  pickup_pincode VARCHAR(10),
  payment_mode VARCHAR(20), -- 'prepaid' | 'cod'
  payment_status VARCHAR(20), -- 'pending' | 'completed' | 'failed'
  order_amount DECIMAL(10, 2),
  subtotal DECIMAL(10, 2),
  shipping_charge DECIMAL(10, 2),
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  carrier_id INTEGER,
  carrier_name VARCHAR(255),
  estimated_delivery_days VARCHAR(20),
  status VARCHAR(50), -- 'pending_fulfillment' | 'picked' | 'packed' | 'ready_for_dispatch' | 'dispatched' | 'delivered' | 'returned' | 'cancelled'
  shipment_id VARCHAR(50),
  package_id VARCHAR(50),
  awb VARCHAR(100),
  label_url TEXT,
  tracking_url TEXT,
  cod_amount DECIMAL(10, 2),
  cod_collected DECIMAL(10, 2),
  cod_remitted DECIMAL(10, 2),
  remittance_date DATE,
  utr_number VARCHAR(100),
  dispatched_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. OrderLines Table

```sql
CREATE TABLE orderlines (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) REFERENCES orders(id),
  product_id VARCHAR(50),
  sku VARCHAR(100),
  product_name VARCHAR(255),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2),
  subtotal DECIMAL(10, 2),
  status VARCHAR(50), -- 'pending' | 'picked' | 'packed' | 'dispatched' | 'delivered'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 3. Stock Table

```sql
CREATE TABLE stock (
  id VARCHAR(50) PRIMARY KEY,
  sku VARCHAR(100) NOT NULL,
  product_id VARCHAR(50),
  status VARCHAR(50), -- 'available' | 'picked' | 'sold' | 'returned' | 'defective'
  location VARCHAR(100),
  batch_no VARCHAR(100),
  expiry_date DATE,
  order_id VARCHAR(50),
  return_id VARCHAR(50),
  picked_by VARCHAR(50),
  picked_at TIMESTAMP,
  sold_at TIMESTAMP,
  condition VARCHAR(50), -- 'good' | 'defective' | 'damaged'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4. Packages Table

```sql
CREATE TABLE packages (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) REFERENCES orders(id),
  actual_weight DECIMAL(5, 2),
  charged_weight DECIMAL(5, 2),
  length DECIMAL(5, 2),
  breadth DECIMAL(5, 2),
  height DECIMAL(5, 2),
  package_content TEXT,
  fragile BOOLEAN DEFAULT FALSE,
  packed_by VARCHAR(50),
  packed_at TIMESTAMP,
  status VARCHAR(50), -- 'ready_for_dispatch' | 'dispatched' | 'delivered'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5. Shipments Table

```sql
CREATE TABLE shipments (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) REFERENCES orders(id),
  package_id VARCHAR(50) REFERENCES packages(id),
  carrier_id INTEGER,
  carrier_name VARCHAR(255),
  awb VARCHAR(100) UNIQUE,
  label_url TEXT,
  shipment_status VARCHAR(50), -- 'booked' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'rto_initiated' | 'rto_delivered'
  current_location VARCHAR(255),
  pickup_scheduled BOOLEAN DEFAULT FALSE,
  pickup_date DATE,
  estimated_delivery_date DATE,
  delivered_at TIMESTAMP,
  delivered_to VARCHAR(255),
  signature_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6. Shipment Tracking History Table

```sql
CREATE TABLE shipment_tracking_history (
  id VARCHAR(50) PRIMARY KEY,
  shipment_id VARCHAR(50) REFERENCES shipments(id),
  order_id VARCHAR(50),
  awb VARCHAR(100),
  status VARCHAR(100),
  status_code VARCHAR(20),
  status_description TEXT,
  location VARCHAR(255),
  timestamp TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 7. Returns Table

```sql
CREATE TABLE returns (
  id VARCHAR(50) PRIMARY KEY,
  original_order_id VARCHAR(50) REFERENCES orders(id),
  return_type VARCHAR(50), -- 'customer_return' | 'rto' | 'exchange'
  return_reason VARCHAR(255),
  return_status VARCHAR(50), -- 'requested' | 'pickup_scheduled' | 'picked_up' | 'in_transit' | 'received' | 'processed'
  return_awb VARCHAR(100),
  return_label_url TEXT,
  carrier_id INTEGER,
  carrier_name VARCHAR(255),
  pickup_date DATE,
  received_at TIMESTAMP,
  refund_amount DECIMAL(10, 2),
  refund_status VARCHAR(50), -- 'pending' | 'processing' | 'completed' | 'failed'
  refund_date DATE,
  refund_reference VARCHAR(100),
  rto_charges DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 8. Products Table (Inventory Summary)

```sql
CREATE TABLE products (
  id VARCHAR(50) PRIMARY KEY,
  sku VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255),
  description TEXT,
  total_quantity INTEGER DEFAULT 0,
  available_quantity INTEGER DEFAULT 0,
  sold_quantity INTEGER DEFAULT 0,
  returned_quantity INTEGER DEFAULT 0,
  defective_quantity INTEGER DEFAULT 0,
  status VARCHAR(50), -- 'active' | 'inactive' | 'discontinued'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

⚙️ DEVELOPER CHECKLIST & BEST PRACTICES

| Area | Recommendation |
|------|----------------|
| **Warehouse Setup** | **First step:** Register warehouse in Shipway dashboard and get `warehouse_id` (Pickup Address ID) |
| **Checkout** | Always check serviceability and rate before confirming order |
| **carrier_id** | Must be passed from rate API → order creation → /v2orders |
| **warehouse_id** | **REQUIRED for label generation** - Get from Shipway Dashboard → Manage Warehouse Address |
| **Error handling** | If Shipway returns "No Carrier found", show message and prevent checkout |
| **Stock marking** | Mark sold only after successful AWB + pickup |
| **Retries** | Implement safe retries for /v2orders (avoid duplicate shipment) |
| **Tracking sync** | Prefer webhooks; fall back to periodic polling |
| **Data stored per order** | carrier_id, warehouse_id, delivery_charge, awb, label_url, shipway_status, tracking_url |
| **COD Reconciliation** | Regularly poll COD remittance API and update payment status |
| **RTO Handling** | Automatically update inventory when RTO delivered |
| **Webhook Security** | Validate webhook signatures/IP addresses |
| **Testing** | Test with Shipway sandbox before production |
💻 COMPLETE NODE.JS IMPLEMENTATION

## 1. Environment Setup

```javascript
// .env file
SHIPWAY_USERNAME=your_username
SHIPWAY_LICENSE_KEY=your_license_key
WAREHOUSE_ID=123456                    // Pickup address ID from Shipway dashboard
WAREHOUSE_PINCODE=400703
WAREHOUSE_NAME=Nivaana Warehouse
WAREHOUSE_PHONE=8888888888
WAREHOUSE_EMAIL=warehouse@nivaana.com
WAREHOUSE_ADDRESS=Plot 123, Industrial Area, Mumbai
```

### 📌 How to get Warehouse ID?

**Steps to find your `warehouse_id` (Pickup Address ID):**

1. Login to **Shipway Dashboard**: https://app.shipway.com
2. Navigate to **Settings** → **Manage Warehouse Address** (or **Pickup Addresses**)
3. You will see a list of registered warehouse/pickup addresses
4. Each address has a unique **Pickup Address ID** - this is your `warehouse_id`
5. Copy this ID and add it to your environment variables

**Example:**

```json
{
  "pickup_addresses": [
    {
      "warehouse_id": 123456,           // ← Use this ID
      "warehouse_name": "Nivaana Warehouse",
      "address": "Plot 123, Industrial Area",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400703",
      "phone": "8888888888",
      "email": "warehouse@nivaana.com"
    }
  ]
}
```

## 2. Shipway Service Class

```javascript
import axios from "axios";
import { prisma } from "./prisma"; // Or your database client

class ShipwayService {
  constructor() {
    this.username = process.env.SHIPWAY_USERNAME;
    this.password = process.env.SHIPWAY_LICENSE_KEY;
    this.warehouseId = process.env.WAREHOUSE_ID; // Pickup Address ID from Shipway
    this.warehousePincode = process.env.WAREHOUSE_PINCODE;
  }

  /**
   * Step 1: Get carrier rates before order placement
   */
  async getCarrierRates(toPincode, paymentType = "prepaid") {
    try {
      const { data } = await axios.get(
        `https://app.shipway.com/api/getshipwaycarrierrates`,
        {
          params: {
            fromPincode: this.warehousePincode,
            toPincode: toPincode,
            paymentType: paymentType
          }
        }
      );

      if (data.success === "success" && data.rate_card) {
        return {
          success: true,
          carriers: data.rate_card,
          cheapest: this.findCheapestCarrier(data.rate_card)
        };
      }

      return {
        success: false,
        error: "No carriers available",
        carriers: []
      };
    } catch (error) {
      console.error("Error fetching carrier rates:", error);
      throw new Error("Failed to fetch carrier rates");
    }
  }

  /**
   * Find cheapest carrier from rate card
   */
  findCheapestCarrier(rateCard) {
    if (!rateCard || rateCard.length === 0) return null;
    return rateCard.reduce((min, carrier) => 
      carrier.delivery_charge < min.delivery_charge ? carrier : min
    );
  }

  /**
   * Step 2: Create shipment with Shipway
   */
  async createShipment(orderId) {
    try {
      // Fetch order details from database
      const order = await prisma.orders.findUnique({
        where: { id: orderId },
        include: {
          orderlines: true,
          package: true
        }
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (!order.package) {
        throw new Error(`Order ${orderId} has not been packed yet`);
      }

      // Prepare Shipway payload
      const payload = {
        username: this.username,
        password: this.password,
        carrier_id: order.carrier_id,
        warehouse_id: parseInt(this.warehouseId), // REQUIRED: Pickup Address ID
        order_id: order.id,
        order_date: new Date().toISOString().split("T")[0],
        pickup_pincode: order.pickup_pincode,
        delivery_pincode: order.delivery_pincode,
        payment_mode: order.payment_mode,
        package_content: order.package.package_content,
        no_of_items: order.orderlines.length,
        order_amount: parseFloat(order.order_amount),
        actual_weight: parseFloat(order.package.actual_weight),
        charged_weight: parseFloat(order.package.charged_weight),
        length: parseFloat(order.package.length),
        breadth: parseFloat(order.package.breadth),
        height: parseFloat(order.package.height),
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_email: order.customer_email,
        customer_address: order.delivery_address,
        pickup_address_name: process.env.WAREHOUSE_NAME,
        pickup_name: process.env.WAREHOUSE_NAME,
        pickup_phone: process.env.WAREHOUSE_PHONE,
        pickup_email: process.env.WAREHOUSE_EMAIL
      };

      // Create shipment in Shipway
      const { data } = await axios.post(
        "https://app.shipway.com/api/v2orders",
        payload
      );

      if (!data.success) {
        throw new Error(data.error || "Failed to create shipment");
      }

      // Store shipment details in database
      const shipment = await prisma.shipments.create({
        data: {
          id: `SHIP_${Date.now()}`,
          order_id: order.id,
          package_id: order.package.id,
          carrier_id: order.carrier_id,
          carrier_name: order.carrier_name,
          awb: data.awb,
          label_url: data.label_url,
          shipment_status: "booked",
          pickup_scheduled: data.pickup_scheduled || false,
          pickup_date: data.pickup_date ? new Date(data.pickup_date) : null,
          estimated_delivery_date: data.estimated_delivery_date 
            ? new Date(data.estimated_delivery_date) 
            : null
        }
      });

      // Update order with shipment details
      await prisma.orders.update({
        where: { id: order.id },
        data: {
          status: "dispatched",
          shipment_id: shipment.id,
          awb: data.awb,
          label_url: data.label_url,
          tracking_url: `https://shipway.in/track/${data.awb}`,
          dispatched_at: new Date()
        }
      });

      // Mark stock as sold
      await prisma.stock.updateMany({
        where: { order_id: order.id, status: "picked" },
        data: {
          status: "sold",
          sold_at: new Date()
        }
      });

      return {
        success: true,
        shipment: shipment,
        awb: data.awb,
        label_url: data.label_url
      };
    } catch (error) {
      console.error("Error creating shipment:", error);
      throw error;
    }
  }

  /**
   * Step 3: Track shipment
   */
  async trackShipment(orderId) {
    try {
      const { data } = await axios.post(
        "https://shipway.in/api/getOrderShipmentDetails",
        {
          username: this.username,
          password: this.password,
          order_id: orderId
        }
      );

      if (!data.success) {
        throw new Error("Failed to fetch tracking details");
      }

      // Update shipment status in database
      await prisma.shipments.update({
        where: { order_id: orderId },
        data: {
          shipment_status: this.mapShipwayStatus(data.current_status_code),
          current_location: data.current_location || null
        }
      });

      return data;
    } catch (error) {
      console.error("Error tracking shipment:", error);
      throw error;
    }
  }

  /**
   * Step 4: Get COD Remittance
   */
  async getCODRemittance(fromDate, toDate) {
    try {
      const { data } = await axios.post(
        "https://app.shipway.com/api/getCODRemittance",
        {
          username: this.username,
          password: this.password,
          from_date: fromDate,
          to_date: toDate
        }
      );

      if (!data.success) {
        return { success: false, remittances: [] };
      }

      // Update orders with remittance data
      for (const remittance of data.remittance_data) {
        if (remittance.remittance_status === "completed") {
          await prisma.orders.update({
            where: { id: remittance.order_id },
            data: {
              payment_status: "completed",
              cod_remitted: remittance.remittance_amount,
              remittance_date: new Date(remittance.remittance_date),
              utr_number: remittance.utr_number
            }
          });
        }
      }

      return {
        success: true,
        remittances: data.remittance_data
      };
    } catch (error) {
      console.error("Error fetching COD remittance:", error);
      throw error;
    }
  }

  /**
   * Map Shipway status codes to internal status
   */
  mapShipwayStatus(statusCode) {
    const statusMap = {
      "BK": "booked",
      "PP": "picked_up",
      "IT": "in_transit",
      "OFD": "out_for_delivery",
      "DL": "delivered",
      "DF": "delivery_failed",
      "RTOI": "rto_initiated",
      "RTOT": "rto_in_transit",
      "RTOD": "rto_delivered"
    };
    return statusMap[statusCode] || statusCode;
  }
}

export default new ShipwayService();
```

## 3. Webhook Handler

```javascript
import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "./prisma";
import shipwayService from "./shipway.service";

/**
 * Shipway Webhook Handler
 * Route: POST /api/shipway/webhook
 */
export async function shipwayWebhookHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const payload = request.body as any;
    
    console.log("Shipway webhook received:", payload);

    const { order_id, awb, status, status_code, timestamp } = payload;

    // Find shipment
    const shipment = await prisma.shipments.findFirst({
      where: { awb: awb }
    });

    if (!shipment) {
      return reply.status(404).send({
        success: false,
        error: "Shipment not found"
      });
    }

    // Update shipment status
    await prisma.shipments.update({
      where: { id: shipment.id },
      data: {
        shipment_status: shipwayService.mapShipwayStatus(status_code),
        current_location: payload.location || null,
        updated_at: new Date()
      }
    });

    // Save tracking history
    await prisma.shipment_tracking_history.create({
      data: {
        id: `TRACK_${Date.now()}`,
        shipment_id: shipment.id,
        order_id: order_id,
        awb: awb,
        status: status,
        status_code: status_code,
        status_description: payload.status_description || "",
        location: payload.location || "",
        timestamp: new Date(timestamp)
      }
    });

    // Handle specific status updates
    switch (status_code) {
      case "DL": // Delivered
        await handleDelivered(order_id, payload);
        break;
      
      case "RTOI": // RTO Initiated
        await handleRTOInitiated(order_id, payload);
        break;
      
      case "RTOD": // RTO Delivered
        await handleRTODelivered(order_id, payload);
        break;
    }

    return reply.send({
      success: true,
      message: "Webhook processed successfully",
      order_id: order_id
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return reply.status(500).send({
      success: false,
      error: "Internal server error"
    });
  }
}

/**
 * Handle delivered status
 */
async function handleDelivered(orderId: string, payload: any) {
  await prisma.orders.update({
    where: { id: orderId },
    data: {
      status: "delivered",
      delivered_at: new Date(payload.timestamp)
    }
  });

  await prisma.shipments.update({
    where: { order_id: orderId },
    data: {
      delivered_at: new Date(payload.timestamp),
      delivered_to: payload.delivered_to || null,
      signature_url: payload.signature_url || null
    }
  });

  // Send delivery notification to customer
  // await notificationService.sendDeliveryConfirmation(orderId);
}

/**
 * Handle RTO initiated
 */
async function handleRTOInitiated(orderId: string, payload: any) {
  await prisma.orders.update({
    where: { id: orderId },
    data: {
      status: "rto_initiated"
    }
  });

  // Create return record
  await prisma.returns.create({
    data: {
      id: `RTO_${Date.now()}`,
      original_order_id: orderId,
      return_type: "rto",
      return_reason: payload.rto_reason || "Delivery failed",
      return_status: "in_transit",
      return_awb: payload.awb
    }
  });
}

/**
 * Handle RTO delivered (back to warehouse)
 */
async function handleRTODelivered(orderId: string, payload: any) {
  await prisma.orders.update({
    where: { id: orderId },
    data: {
      status: "rto_delivered"
    }
  });

  await prisma.returns.update({
    where: { original_order_id: orderId },
    data: {
      return_status: "received",
      received_at: new Date(payload.timestamp),
      rto_charges: payload.rto_charges || 0
    }
  });

  // Mark stock as returned/available
  await prisma.stock.updateMany({
    where: { order_id: orderId },
    data: {
      status: "returned",
      return_id: `RTO_${orderId}`
    }
  });

  // Update product inventory
  const orderLines = await prisma.orderlines.findMany({
    where: { order_id: orderId }
  });

  for (const line of orderLines) {
    await prisma.products.update({
      where: { id: line.product_id },
      data: {
        sold_quantity: { decrement: line.quantity },
        returned_quantity: { increment: line.quantity }
      }
    });
  }
}
```

## 4. API Routes Example (Fastify)

```javascript
import fastify from "fastify";
import shipwayService from "./shipway.service";
import { shipwayWebhookHandler } from "./shipway.webhook";

const app = fastify();

/**
 * Get carrier rates for checkout
 */
app.get("/api/shipping/rates", async (request, reply) => {
  const { pincode, payment_type } = request.query as any;
  
  try {
    const rates = await shipwayService.getCarrierRates(pincode, payment_type);
    return reply.send(rates);
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

/**
 * Create shipment
 */
app.post("/api/shipments/create", async (request, reply) => {
  const { order_id } = request.body as any;
  
  try {
    const shipment = await shipwayService.createShipment(order_id);
    return reply.send(shipment);
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

/**
 * Track shipment
 */
app.get("/api/shipments/track/:order_id", async (request, reply) => {
  const { order_id } = request.params as any;
  
  try {
    const tracking = await shipwayService.trackShipment(order_id);
    return reply.send(tracking);
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

/**
 * Shipway webhook endpoint
 */
app.post("/api/shipway/webhook", shipwayWebhookHandler);

/**
 * Get COD remittance
 */
app.post("/api/cod/remittance", async (request, reply) => {
  const { from_date, to_date } = request.body as any;
  
  try {
    const remittance = await shipwayService.getCODRemittance(from_date, to_date);
    return reply.send(remittance);
  } catch (error) {
    return reply.status(500).send({ error: error.message });
  }
});

app.listen({ port: 3000 }, () => {
  console.log("Server running on port 3000");
});
```

## 5. Example Usage

```javascript
// Example: Complete order flow
async function processOrder() {
  // 1. During checkout - Get rates
  const rates = await shipwayService.getCarrierRates("400706", "prepaid");
  console.log("Available carriers:", rates.carriers);
  console.log("Cheapest carrier:", rates.cheapest);

  // 2. After packing - Create shipment
  const shipment = await shipwayService.createShipment("ORD12345");
  console.log("Shipment created:", shipment);
  console.log("AWB:", shipment.awb);
  console.log("Label URL:", shipment.label_url);

  // 3. Track shipment
  const tracking = await shipwayService.trackShipment("ORD12345");
  console.log("Current status:", tracking.current_status);

  // 4. COD Reconciliation (run daily/weekly)
  const remittance = await shipwayService.getCODRemittance(
    "2025-11-01",
    "2025-11-30"
  );
  console.log("COD Remittances:", remittance.remittances);
}
```

---

## ✅ FINAL FLOW SUMMARY

| Stage | API Endpoint | Method | Description | Data Stored |
|-------|-------------|--------|-------------|-------------|
| **1. Checkout (Before Order)** | `/api/getshipwaycarrierrates` | GET | Check serviceability & delivery charge | `carrier_id`, `delivery_charge`, `estimated_delivery_days` |
| **2. Order Creation** | `/api/orders` | POST | Save carrier info and shipping fee | Order, OrderLines with `carrier_id`, `shipping_charge` |
| **3. Fulfillment - Pick** | `/api/inventory/pick` | POST | Pick stock items and link to order | Stock status = 'picked', `picked_at`, `order_id` |
| **4. Fulfillment - Pack** | `/api/inventory/pack` | POST | Create package with dimensions & weight | Package record with dimensions, weight |
| **5. Shipway Integration** | `/api/v2orders` | POST | Create shipment, get AWB + Label | Shipment with `awb`, `label_url`, `tracking_url` |
| **6. Inventory Update** | Internal | - | Mark stock sold + update quantities | Stock status = 'sold', Product quantities updated |
| **7. Tracking - Polling** | `/api/getOrderShipmentDetails` | POST | Fetch current shipment status | Tracking history records |
| **8. Tracking - Webhook** | `/api/shipway/webhook` | POST | Receive live delivery updates | Auto-update order & shipment status |
| **9. Delivery** | Webhook | POST | Update order as delivered | Order status = 'delivered', `delivered_at` |
| **10. COD Reconciliation** | `/api/getCODRemittance` | POST | Get COD payment details | `cod_remitted`, `utr_number`, `remittance_date` |
| **11. RTO Handling** | Webhook | POST | Handle return to origin | Return record, Stock status = 'returned' |
| **12. Customer Return** | `/api/v2orders/reverse` | POST | Create reverse shipment | Return order with new AWB |

---

## 📋 STATUS FLOW DIAGRAM

```
Order Lifecycle:
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  pending_fulfillment → picked → packed → ready_for_dispatch       │
│                                              ↓                      │
│                                        dispatched                   │
│                                              ↓                      │
│                         ┌────────────────────┴───────────────────┐ │
│                         ↓                                         ↓ │
│                   in_transit                              delivery_failed │
│                         ↓                                         ↓ │
│                 out_for_delivery                          rto_initiated │
│                         ↓                                         ↓ │
│                    delivered                              rto_delivered │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔑 KEY CONSIDERATIONS

### Security
- Store Shipway credentials in environment variables
- Validate webhook signatures/source IPs
- Use HTTPS for all webhook endpoints
- Sanitize all user inputs

### Error Handling
- Implement retry logic for API failures (max 3 retries)
- Handle duplicate shipment creation (check if AWB exists)
- Validate carrier_id before creating shipment
- Log all errors with context for debugging

### Performance
- Cache carrier rates for same pincode pairs (5 min TTL)
- Use database transactions for order + inventory updates
- Process webhooks asynchronously
- Implement rate limiting on Shipway API calls

### Monitoring
- Track API response times
- Monitor webhook delivery success rate
- Alert on failed shipment creations
- Daily reconciliation of COD orders

### Testing
- Use Shipway sandbox for development
- Test all status transition webhooks
- Verify inventory updates at each stage
- Load test with concurrent orders

---

## 📞 SUPPORT & RESOURCES

- **Shipway API Documentation**: https://apidocs.shipway.com
- **Shipway Support**: support@shipway.com
- **Shipway Dashboard**: https://app.shipway.com

---

**Document Version**: 2.0  
**Last Updated**: November 7, 2025  
**Maintained by**: Nivaana Development Team