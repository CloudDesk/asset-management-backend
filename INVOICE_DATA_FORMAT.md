# Invoice Data Format - Complete Sample

## What Gets Sent to `/order/invoice`

When `markShipped()` is called, it sends the complete order data from `getOrderDetails()` to the storage backend.

## Exact Request Body Structure

```json
{
  "order": { /* order object */ },
  "orderlines": [ /* array of orderline objects */ ],
  "address": { /* address object */ }
}
```

## Complete Sample with Real Data

This is the **exact format** that will be posted to `${STORAGE_BACKEND_URL}/order/invoice`:

```json
{
  "order": {
    "id": 123,
    "orderid": "ORD-1735531200000-123",
    "createddate": 1735531200000,
    "modifieddate": 1735617600000,
    "orderamount": 2360,
    "orderstatus": "shipped",
    "delivereddate": null,
    "cancelleddate": null,
    "returneddate": null,
    "quantity": 2,
    "transactionid": "T12345678901234567890",
    "productid": [101, 102],
    "productamount": 2000,
    "discountamount": 0,
    "ispaymentsucceed": true,
    "merchanttransactionid": "MUID123456789012345678901234567890",
    "paymentfaileddate": null,
    "mode": "phonepe",
    "promotion_discount_total": 0,
    "original_total": 2000,
    "shipping_cost": 0,
    "items_total": 2000,
    "total_taxable_amount": 2000,
    "total_cgst_amount": 180,
    "total_sgst_amount": 180,
    "total_igst_amount": 0,
    "total_gst_amount": 360,
    "tax_amount": 360,
    "tracking_id": "EKART123456789",
    "vendor": "EKART",
    "barcodes": {
      "awb_barcode": "data:image/png;base64,iVBORw0KGgoAAAANS...",
      "order_barcode": "data:image/png;base64,iVBORw0KGgoAAAANS..."
    },
    "label_url": "https://storage.googleapis.com/.../shipping-labels/EKART123456789.pdf",
    "public_tracking_link": "https://app.elite.ekartlogistics.in/track/EKART123456789",
    "shipment_created_at": 1735617500000,
    "shipdate": 1735617600000,
    "cod_payment_received_date": null,
    "cod_transaction_reference": null,
    "cod_amount": null,
    "refund_transaction_id": null,
    "refund_amount": null,
    "refund_reference": null,
    "refund_initiated_date": null,
    "refund_completed_date": null,
    "status_history": [
      {
        "previous_status": "ready_for_dispatch",
        "new_status": "shipped",
        "changed_date": 1735617600000,
        "source": "inventoryuser",
        "inventory_user_id": 5,
        "is_active": true
      },
      {
        "previous_status": "payment_success",
        "new_status": "ready_for_dispatch",
        "changed_date": 1735617400000,
        "source": "inventoryuser",
        "inventory_user_id": 5,
        "is_active": false
      }
    ]
  },
  "orderlines": [
    {
      "id": 456,
      "productamount": 1000,
      "discountamount": 0,
      "orderamount": 1000,
      "quantity": 1,
      "productid": 101,
      "productname": "Samsung Galaxy S23 Ultra",
      "productcategory": "Mobiles & Tablets",
      "hsn_code": "8517",
      "orderstatus": "shipped",
      "original_price": 1000,
      "product_discount_amount": 0,
      "promotion_discount_amount": 0,
      "shipping_cost": 0,
      "gst_rate": 18,
      "taxable_amount": 847.46,
      "cgst_amount": 76.27,
      "sgst_amount": 76.27,
      "igst_amount": 0,
      "total_gst_amount": 152.54,
      "status_history": [
        {
          "previous_status": "ready_for_dispatch",
          "new_status": "shipped",
          "changed_date": 1735617600000,
          "source": "inventoryuser",
          "inventory_user_id": 5,
          "is_active": true
        }
      ]
    },
    {
      "id": 457,
      "productamount": 1000,
      "discountamount": 0,
      "orderamount": 1000,
      "quantity": 1,
      "productid": 102,
      "productname": "Apple iPhone 15 Pro",
      "productcategory": "Mobiles & Tablets",
      "hsn_code": "8517",
      "orderstatus": "shipped",
      "original_price": 1000,
      "product_discount_amount": 0,
      "promotion_discount_amount": 0,
      "shipping_cost": 0,
      "gst_rate": 18,
      "taxable_amount": 847.46,
      "cgst_amount": 76.27,
      "sgst_amount": 76.27,
      "igst_amount": 0,
      "total_gst_amount": 152.54,
      "status_history": [
        {
          "previous_status": "ready_for_dispatch",
          "new_status": "shipped",
          "changed_date": 1735617600000,
          "source": "inventoryuser",
          "inventory_user_id": 5,
          "is_active": true
        }
      ]
    }
  ],
  "address": {
    "name": "John Doe",
    "mobilenumber": "9876543210",
    "pincode": "600001",
    "doornumber": "12/A",
    "address": "Anna Nagar West, Chennai",
    "landmark": "Near Anna Arch",
    "state": "Tamil Nadu",
    "city": "Chennai"
  }
}
```

## Sample with Combo Product

If the order contains combo products, the orderline will include `iscombo` and `components` fields:

```json
{
  "order": { /* same as above */ },
  "orderlines": [
    {
      "id": 458,
      "productamount": 2500,
      "discountamount": 100,
      "orderamount": 2400,
      "quantity": 1,
      "productid": 201,
      "productname": "Mobile Accessories Combo Pack",
      "productcategory": "Accessories",
      "hsn_code": "8517",
      "orderstatus": "shipped",
      "original_price": 2500,
      "product_discount_amount": 100,
      "promotion_discount_amount": 0,
      "shipping_cost": 0,
      "gst_rate": 18,
      "taxable_amount": 2033.90,
      "cgst_amount": 91.53,
      "sgst_amount": 91.53,
      "igst_amount": 0,
      "total_gst_amount": 183.06,
      "iscombo": true,
      "components": [
        {
          "componentproductid": 301,
          "productname": "USB Cable",
          "productcategory": "Cables",
          "subcategory": "Charging Cables",
          "requiredqty": 2
        },
        {
          "componentproductid": 302,
          "productname": "Phone Case",
          "productcategory": "Accessories",
          "subcategory": "Protection",
          "requiredqty": 1
        },
        {
          "componentproductid": 303,
          "productname": "Screen Protector",
          "productcategory": "Accessories",
          "subcategory": "Protection",
          "requiredqty": 1
        }
      ],
      "status_history": [ /* same as above */ ]
    }
  ],
  "address": { /* same as above */ }
}
```

## Field Descriptions

### Order Object Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | number | Internal order ID | `123` |
| `orderid` | string | Customer-facing order number | `"ORD-1735531200000-123"` |
| `orderamount` | number | Total order amount (including tax) | `2360` |
| `orderstatus` | string | Current order status | `"shipped"` |
| `quantity` | number | Total quantity of items | `2` |
| `productid` | number[] | Array of product IDs in order | `[101, 102]` |
| `mode` | string | Payment mode | `"phonepe"` or `"cod"` |
| `items_total` | number | Subtotal (excluding shipping) | `2000` |
| `shipping_cost` | number | Shipping charges | `0` |
| `total_taxable_amount` | number | Sum of taxable amounts | `2000` |
| `total_cgst_amount` | number | Total Central GST (intra-state) | `180` |
| `total_sgst_amount` | number | Total State GST (intra-state) | `180` |
| `total_igst_amount` | number | Total Integrated GST (inter-state) | `0` |
| `total_gst_amount` | number | Total GST amount | `360` |
| `tracking_id` | string | EKART tracking ID | `"EKART123456789"` |
| `label_url` | string | Shipping label PDF URL | `"https://..."` |

### Orderline Object Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `id` | number | Orderline ID | `456` |
| `productid` | number | Product ID | `101` |
| `productname` | string | Product name | `"Samsung Galaxy S23 Ultra"` |
| `quantity` | number | Quantity ordered | `1` |
| `original_price` | number | Base price per unit | `1000` |
| `product_discount_amount` | number | Product-level discount (total) | `0` |
| `promotion_discount_amount` | number | Promotion discount (total) | `0` |
| `orderamount` | number | Final amount for this line (total) | `1000` |
| `hsn_code` | string | HSN code for GST | `"8517"` |
| `gst_rate` | number | GST percentage | `18` |
| `taxable_amount` | number | Amount before GST | `847.46` |
| `cgst_amount` | number | Central GST | `76.27` |
| `sgst_amount` | number | State GST | `76.27` |
| `total_gst_amount` | number | Total GST for line | `152.54` |

**For Combo Products Only:**
- `iscombo`: `true`
- `components`: Array of component products with their required quantities

### Address Object Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Customer name | `"John Doe"` |
| `mobilenumber` | string | Mobile number | `"9876543210"` |
| `pincode` | string | PIN code | `"600001"` |
| `doornumber` | string | Door/flat number | `"12/A"` |
| `address` | string | Full address | `"Anna Nagar West, Chennai"` |
| `landmark` | string | Landmark | `"Near Anna Arch"` |
| `state` | string | State | `"Tamil Nadu"` |
| `city` | string | City | `"Chennai"` |

## Key Points

1. **All numeric values** (amounts, quantities, etc.) are sent as numbers, not strings
2. **All date/time values** are Unix timestamps in milliseconds (epoch)
3. **GST calculation**: 
   - Same state: `cgst_amount` + `sgst_amount` = `total_gst_amount`
   - Different state: `igst_amount` = `total_gst_amount`
4. **Orderline amounts** are TOTAL amounts (price × quantity), not per-unit
5. **status_history** is an array with the most recent entry having `is_active: true`
6. **Combo products** will have additional `iscombo` and `components` fields
7. **Null values** are included for optional fields

## Testing

You can test with this sample data:

```bash
curl -X POST http://localhost:4500/order/invoice \
  -H "Content-Type: application/json" \
  -d @sample-invoice-data.json
```

Where `sample-invoice-data.json` contains the complete JSON shown above.
