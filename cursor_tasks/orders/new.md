┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORDER FULFILLMENT FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

Step 1: READY FOR DISPATCH (✅ You are here)
─────────────────────────────────────────────
Route:   PATCH /v1/orders/:id/ready-for-dispatch
Body:    { "inventory_user_id": 123 }
Status:  order_placed/payment_completed → ready_for_dispatch

                              ↓

Step 2: CREATE SHIPMENT (🎯 Next step)
─────────────────────────────────────────────
Route:   POST /v1/ekart/shipments/forward
Body:    {
           "seller_name": "Nivaana",
           "seller_address": "...",
           "order_number": "ORDER_xxx",
           "consignee_name": "Customer Name",
           "payment_mode": "Prepaid" | "COD",
           "total_amount": 1500,
           "drop_location": {
             "name": "Customer",
             "address": "...",
             "city": "Chennai",
             "state": "Tamil Nadu",
             "pin": 600001,
             "phone": 9876543210
           },
           ...
         }
Returns: { tracking_id, vendor, barcodes, ... }
Effect:  Stores tracking_id in orders table

                              ↓

Step 3: DOWNLOAD LABEL
─────────────────────────────────────────────
Route:   POST /v1/ekart/shipments/label
Body:    { "trackingIds": ["FMPC001234567890"] }
Returns: PDF file (binary)
Effect:  Get shipping label to print

                              ↓

Step 4: MARK AS SHIPPED
─────────────────────────────────────────────
Route:   PATCH /v1/orders/:id/mark-shipped
Body:    { "inventory_user_id": 123 }
Status:  ready_for_dispatch → shipped
Effect:  Updates order & orderlines to "shipped", sets shipdate

                              ↓

Step 5+: EKART WEBHOOKS (Automatic)
─────────────────────────────────────────────
in_transit → out_for_delivery → delivered
(These come from EKART automatically via webhooks)