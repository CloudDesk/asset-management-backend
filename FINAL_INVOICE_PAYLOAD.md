# Final Invoice Data Payload - With Seller Information

## ✅ UPDATED: Complete Request Body Format

When `PATCH /v1/orders/:id/mark-shipped` is called, the following data is sent to `POST ${STORAGE_BACKEND_URL}/order/invoice`:

## Complete Payload Structure

```json
{
  "order": { /* order object */ },
  "orderlines": [ /* array of orderline objects */ ],
  "address": { /* customer shipping address */ },
  "seller": { /* seller/business address from EKART */ }
}
```

## Full Example Payload

```json
{
  "order": {
    "id": 123,
    "orderid": "ORD-1735531200000-123",
    "createddate": 1735531200000,
    "modifieddate": 1735617600000,
    "orderamount": 2360,
    "orderstatus": "shipped",
    "quantity": 2,
    "productid": [101, 102],
    "productamount": 2000,
    "discountamount": 0,
    "ispaymentsucceed": true,
    "merchanttransactionid": "MUID123456789012345678901234567890",
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
    "label_url": "https://storage.googleapis.com/.../EKART123456789.pdf",
    "public_tracking_link": "https://app.elite.ekartlogistics.in/track/EKART123456789",
    "shipment_created_at": 1735617500000,
    "shipdate": 1735617600000
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
      "total_gst_amount": 152.54
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
      "gst_rate": 18,
      "taxable_amount": 847.46,
      "cgst_amount": 76.27,
      "sgst_amount": 76.27,
      "total_gst_amount": 152.54
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
  },
  "seller": {
    "alias": "VIP98 - SALES OFFICE",
    "phone": 9003879665,
    "address_line1": "968, 1ST FLOOR 4TH HOUSE, TNHB 1ST MAIN ROAD, VELACHERY , CHENNAI - 600042 . OPP.TO PURPLE HARMACY",
    "pincode": 600042,
    "city": "Chennai",
    "state": "Tamil Nadu",
    "country": "India"
  }
}
```

## Seller Data Details

### Source
The seller data is fetched from: **`http://localhost:5600/v1/ekart/addresses`**

### EKART Addresses Response Format
```json
{
  "success": true,
  "message": "Addresses fetched successfully",
  "data": [
    {
      "alias": "VIP98 - SALES OFFICE",
      "phone": 9003879665,
      "address_line1": "968, 1ST FLOOR 4TH HOUSE, TNHB 1ST MAIN ROAD, VELACHERY , CHENNAI - 600042 . OPP.TO PURPLE HARMACY",
      "pincode": 600042,
      "city": "Chennai",
      "state": "Tamil Nadu",
      "country": "India"
    }
  ]
}
```

### Implementation Notes

1. **Seller data is fetched automatically** when `markShipped()` is called
2. **First address is used** - The first address from the EKART response is selected (main sales office)
3. **Graceful fallback** - If seller data fetch fails, invoice generation continues with `seller: null`
4. **Separate timeout** - Seller fetch has a 10-second timeout, independent of invoice generation
5. **Environment variable**: `EKART_BACKEND_URL` (defaults to `http://localhost:5600`)

## Seller Object Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `alias` | string | Business/office name | `"VIP98 - SALES OFFICE"` |
| `phone` | number | Contact phone number | `9003879665` |
| `address_line1` | string | Complete address | `"968, 1ST FLOOR..."` |
| `pincode` | number | PIN code | `600042` |
| `city` | string | City name | `"Chennai"` |
| `state` | string | State name | `"Tamil Nadu"` |
| `country` | string | Country name | `"India"` |

## Environment Variables Required

Add to `.env`:
```bash
# Storage backend for invoice generation
STORAGE_BACKEND_URL=http://localhost:4500

# EKART backend for seller addresses
EKART_BACKEND_URL=http://localhost:5600
```

## Testing the Complete Payload

### Using curl with sample file
```bash
curl -X POST http://localhost:4500/order/invoice \
  -H "Content-Type: application/json" \
  -d @sample-invoice-data.json
```

### Expected Success Response
```json
{
  "success": true,
  "message": "Order invoice generated successfully",
  "invoiceUrl": "https://storage.googleapis.com/niv_order_invoice/ORD-123/ORD-123.pdf",
  "orderId": "ORD-123"
}
```

### Database Update
The service automatically performs the following update after receiving the success response:
- **Table**: `orders`
- **Field**: `order_invoice_url`
- **Source**: `invoiceUrl` from response


## Sample Files

- **`sample-invoice-data.json`** - Updated with seller data
- **`INVOICE_DATA_FORMAT.md`** - Original detailed documentation (now includes seller)
- **`INVOICE_QUICK_REFERENCE.md`** - Quick reference guide
- **This file** - Final updated payload documentation

---

**Last Updated**: December 30, 2025  
**Version**: 2.0 (Added seller data)
