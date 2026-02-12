#!/bin/bash

# This is a test script to show what the invoice generation request would look like
# Based on the implementation in orders.service.ts markShipped method

echo "=== Invoice Generation Test ==="
echo ""
echo "Endpoint: POST ${STORAGE_BACKEND_URL:-http://localhost:4500}/order/invoice"
echo ""
echo "Sample Request Body (this would be sent from markShipped):"
echo ""

cat <<'EOF'
{
  "order": {
    "id": 123,
    "orderid": "ORD-1234567890",
    "createddate": 1735531200000,
    "orderamount": 2360,
    "orderstatus": "shipped",
    "quantity": 2,
    "productamount": 2000,
    "discountamount": 0,
    "ispaymentsucceed": true,
    "merchanttransactionid": "MT123456",
    "mode": "online",
    "shipping_cost": 0,
    "items_total": 2000,
    "total_taxable_amount": 2000,
    "total_cgst_amount": 180,
    "total_sgst_amount": 180,
    "total_igst_amount": 0,
    "total_gst_amount": 360,
    "tracking_id": "TRACK123",
    "vendor": "EKART"
  },
  "orderlines": [
    {
      "id": 456,
      "productamount": 2000,
      "orderamount": 2000,
      "quantity": 2,
      "productid": 789,
      "productname": "Test Product",
      "productcategory": "Electronics",
      "hsn_code": "8517",
      "orderstatus": "shipped",
      "original_price": 1000,
      "gst_rate": 18,
      "taxable_amount": 1694.92,
      "cgst_amount": 152.54,
      "sgst_amount": 152.54,
      "igst_amount": 0,
      "total_gst_amount": 305.08
    }
  ],
  "address": {
    "name": "Test Customer",
    "mobilenumber": "9876543210",
    "pincode": "600001",
    "doornumber": "123",
    "address": "Test Street, Test Area",
    "landmark": "Near Test Landmark",
    "state": "Tamil Nadu",
    "city": "Chennai"
  }
}
EOF

echo ""
echo ""
echo "=== Testing with curl ==="
echo ""

# Test the actual endpoint
curl -X POST "${STORAGE_BACKEND_URL:-http://localhost:4500}/order/invoice" \
  -H "Content-Type: application/json" \
  -d '{
    "order": {
      "id": 123,
      "orderid": "ORD-TEST-1234",
      "orderamount": 2360
    },
    "orderlines": [
      {
        "id": 456,
        "productname": "Test Product",
        "quantity": 2,
        "orderamount": 2000
      }
    ],
    "address": {
      "name": "Test Customer",
      "city": "Chennai"
    }
  }' \
  -w "\n\nHTTP Status: %{http_code}\n" \
  2>&1

echo ""
echo "=== Test Complete ===" 
