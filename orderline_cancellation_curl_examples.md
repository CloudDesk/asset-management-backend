# Orderline Cancellation API Examples

## Prerequisites

- Server running on http://localhost:3000
- Valid orderline ID (replace `{orderlineId}` with actual ID)
- Valid order ID (replace `{orderId}` with actual ID)

## API Examples

### 1. Cancel an Orderline

```bash
curl -X PATCH http://localhost:3000/v1/orderlines/{orderlineId}/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer request"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Orderline cancelled successfully",
  "data": {
    "orderline": {
      "id": 123,
      "orderstatus": "cancelled",
      "cancelleddate": 1703123456789,
      "cancellation_reason": "Customer request"
    },
    "productUpdates": [
      {
        "productId": 1,
        "success": true,
        "productName": "Test Product",
        "quantityRestored": 2,
        "oldQuantities": {
          "ordered": 10,
          "available": 5,
          "status": "low_stock"
        },
        "newQuantities": {
          "ordered": 8,
          "available": 7,
          "status": "in_stock"
        }
      }
    ],
    "orderStatusUpdated": false,
    "cancellationDetails": {
      "orderlineId": "123",
      "productId": 1,
      "orderId": 456,
      "restoredQuantity": 2,
      "reason": "Customer request"
    }
  }
}
```

### 2. Cancel Orderline Without Reason

```bash
curl -X PATCH http://localhost:3000/v1/orderlines/{orderlineId}/cancel \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 3. Cancel Already Cancelled Orderline

```bash
curl -X PATCH http://localhost:3000/v1/orderlines/{orderlineId}/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Duplicate attempt"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "message": "Orderline is already cancelled",
  "data": {
    "orderline": {
      "id": 123,
      "orderstatus": "cancelled"
    },
    "productUpdates": [],
    "orderStatusUpdated": false,
    "cancellationDetails": {
      "orderlineId": "123",
      "productId": 1,
      "orderId": 456,
      "restoredQuantity": 0,
      "reason": "Duplicate attempt"
    }
  }
}
```

### 4. Cancel Non-existent Orderline

```bash
curl -X PATCH http://localhost:3000/v1/orderlines/99999/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Test non-existent"
  }'
```

**Expected Response:**

```json
{
  "success": false,
  "message": "Orderline not found",
  "details": "Orderline not found",
  "statusCode": 404
}
```

### 5. Cancel with Invalid ID

```bash
curl -X PATCH http://localhost:3000/v1/orderlines/invalid-id/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Test invalid ID"
  }'
```

**Expected Response:**

```json
{
  "success": false,
  "message": "Invalid orderline ID",
  "details": "Invalid orderline ID",
  "statusCode": 400
}
```

## Complete Workflow Example

### Step 1: Create Test Order

```bash
curl -X POST http://localhost:3000/v1/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userid": 1,
    "addressid": 1,
    "orderamount": 1500,
    "orderid": "TEST-ORDER-123",
    "orderstatus": "order_processing",
    "quantity": 3,
    "productid": [1, 2, 3],
    "createddate": 1703123456789,
    "modifieddate": 1703123456789
  }'
```

### Step 2: Create Orderlines

```bash
# Create first orderline
curl -X POST http://localhost:3000/v1/orderlines \
  -H "Content-Type: application/json" \
  -d '{
    "orderid": 1,
    "productid": 1,
    "userid": 1,
    "quantity": 2,
    "productamount": 500,
    "orderamount": 1000,
    "orderstatus": "order_processing",
    "orderlinenumber": "TEST-OL-1",
    "createddate": 1703123456789,
    "modifieddate": 1703123456789
  }'

# Create second orderline
curl -X POST http://localhost:3000/v1/orderlines \
  -H "Content-Type: application/json" \
  -d '{
    "orderid": 1,
    "productid": 2,
    "userid": 1,
    "quantity": 1,
    "productamount": 300,
    "orderamount": 300,
    "orderstatus": "order_processing",
    "orderlinenumber": "TEST-OL-2",
    "createddate": 1703123456789,
    "modifieddate": 1703123456789
  }'
```

### Step 3: Cancel Orderlines Sequentially

```bash
# Cancel first orderline
curl -X PATCH http://localhost:3000/v1/orderlines/1/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Customer request"
  }'

# Cancel second orderline (should trigger order cancellation)
curl -X PATCH http://localhost:3000/v1/orderlines/2/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Out of stock"
  }'
```

### Step 4: Verify Results

```bash
# Check order status
curl http://localhost:3000/v1/orders/1

# Check orderline statuses
curl http://localhost:3000/v1/orderlines/1
curl http://localhost:3000/v1/orderlines/2

# Check product quantities
curl http://localhost:3000/v1/products/1
curl http://localhost:3000/v1/products/2
```

## Testing with JavaScript

```javascript
const axios = require("axios");

async function testOrderlineCancellation() {
  const BASE_URL = "http://localhost:3000/v1";

  try {
    // Cancel orderline
    const response = await axios.patch(`${BASE_URL}/orderlines/1/cancel`, {
      reason: "Customer request",
    });

    console.log("Cancellation successful:", response.data);

    // Verify product quantities were restored
    const productResponse = await axios.get(`${BASE_URL}/products/1`);
    console.log("Product quantities:", productResponse.data.data);

    // Verify order status
    const orderResponse = await axios.get(`${BASE_URL}/orders/1`);
    console.log("Order status:", orderResponse.data.data.orderstatus);
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
  }
}

testOrderlineCancellation();
```

## Notes

- Replace `{orderlineId}`, `{orderId}`, and `{productId}` with actual IDs from your database
- The server must be running on http://localhost:3000
- All timestamps are in milliseconds since epoch
- Product quantities are automatically restored when orderlines are cancelled
- Order status is automatically updated to "cancelled" when all orderlines are cancelled
