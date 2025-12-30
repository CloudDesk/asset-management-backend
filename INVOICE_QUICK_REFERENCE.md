# Invoice Generation - Quick Reference

## What Happens When You Call `PATCH /v1/orders/:id/mark-shipped`

```
┌─────────────────────────────────────────────────────────────┐
│  PATCH /v1/orders/:id/mark-shipped                         │
│  Body: { "inventory_user_id": 5 }                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  markShipped() in orders.service.ts                         │
│  1. Update order status to "shipped"                        │
│  2. Update all orderlines to "shipped"                      │
│  3. Set shipdate timestamp                                  │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Generate Invoice (NEW)                                     │
│  1. Fetch complete order data via getOrderDetails()         │
│  2. POST to ${STORAGE_BACKEND_URL}/order/invoice            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Request Body Sent to Storage Backend                       │
│                                                             │
│  {                                                          │
│    "order": { /* 40+ fields */ },                          │
│    "orderlines": [ /* array of orderlines */ ],            │
│    "address": { /* customer address */ }                   │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Storage Backend Response (Expected)                        │
│                                                             │
│  {                                                          │
│    "success": true,                                         │
│    "invoice_url": "https://storage.../invoice.pdf",        │
│    "message": "Invoice generated successfully"             │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

## Data Sent to `/order/invoice`

### 📦 Order Object (40+ fields)
```javascript
{
  id: 123,                              // Internal order ID
  orderid: "ORD-1735531200000-123",    // Customer-facing order number
  orderamount: 2360,                    // Total including tax
  orderstatus: "shipped",               // Current status
  quantity: 2,                          // Total items
  
  // Financial breakdown
  items_total: 2000,                    // Subtotal
  shipping_cost: 0,                     // Shipping charges
  total_taxable_amount: 2000,           // Before GST
  total_cgst_amount: 180,               // Central GST
  total_sgst_amount: 180,               // State GST
  total_igst_amount: 0,                 // Integrated GST
  total_gst_amount: 360,                // Total GST
  
  // Payment info
  mode: "phonepe",                      // Payment method
  ispaymentsucceed: true,               // Payment status
  merchanttransactionid: "MUID...",     // Transaction ID
  
  // Shipping info
  tracking_id: "EKART123456789",        // Tracking number
  vendor: "EKART",                      // Logistics vendor
  label_url: "https://...",             // Shipping label PDF
  shipdate: 1735617600000,              // Ship timestamp
  
  // Arrays
  productid: [101, 102],                // Product IDs in order
  status_history: [...]                 // Status change history
}
```

### 📋 Orderlines Array
```javascript
[
  {
    id: 456,                            // Orderline ID
    productid: 101,                     // Product ID
    productname: "Samsung Galaxy S23",   // Product name
    productcategory: "Mobiles",         // Category
    quantity: 1,                        // Quantity
    
    // Pricing (all TOTAL amounts, not per-unit)
    original_price: 1000,               // Base price per unit
    product_discount_amount: 0,         // Product discount (total)
    promotion_discount_amount: 0,       // Promo discount (total)
    orderamount: 1000,                  // Final amount (total)
    
    // Tax details
    hsn_code: "8517",                   // HSN code
    gst_rate: 18,                       // GST percentage
    taxable_amount: 847.46,             // Before GST
    cgst_amount: 76.27,                 // Central GST
    sgst_amount: 76.27,                 // State GST
    total_gst_amount: 152.54,           // Total GST
    
    orderstatus: "shipped"              // Line status
  },
  // ... more orderlines
]
```

### 🏠 Address Object
```javascript
{
  name: "John Doe",
  mobilenumber: "9876543210",
  pincode: "600001",
  doornumber: "12/A",
  address: "Anna Nagar West, Chennai",
  landmark: "Near Anna Arch",
  state: "Tamil Nadu",
  city: "Chennai"
}
```

## Testing the Endpoint

### Using the Sample File
```bash
curl -X POST http://localhost:4500/order/invoice \
  -H "Content-Type: application/json" \
  -d @sample-invoice-data.json
```

### Using Inline JSON
```bash
curl -X POST http://localhost:4500/order/invoice \
  -H "Content-Type: application/json" \
  -d '{
    "order": {
      "id": 123,
      "orderid": "ORD-TEST",
      "orderamount": 2360,
      "orderstatus": "shipped"
    },
    "orderlines": [
      {
        "id": 456,
        "productname": "Test Product",
        "quantity": 1,
        "orderamount": 2000
      }
    ],
    "address": {
      "name": "Test User",
      "city": "Chennai"
    }
  }'
```

## Files Created for Reference

1. **`INVOICE_DATA_FORMAT.md`** - Complete documentation with all fields
2. **`sample-invoice-data.json`** - Sample JSON for testing
3. **`test-invoice-generation.sh`** - Test script
4. **This file** - Quick reference guide

## Important Notes

✅ **All numeric values are numbers**, not strings (e.g., `2360`, not `"2360"`)  
✅ **All timestamps are Unix epoch milliseconds** (e.g., `1735617600000`)  
✅ **Orderline amounts are TOTAL**, not per-unit (price × quantity)  
✅ **GST fields**: Use CGST+SGST for same state, IGST for different state  
✅ **Null values are included** for optional fields (e.g., `cancelleddate: null`)  
✅ **Combo products** have additional `iscombo` and `components` fields  

❌ **Current Status**: Endpoint responds but fails due to missing `Revo.pdf` template
