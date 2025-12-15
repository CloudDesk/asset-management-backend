# Ready for Dispatch API Documentation

## Endpoint

```
PATCH /v1/orders/:id/ready-for-dispatch
```

**Description:** Mark order as ready for dispatch (all products collected and box ready). This endpoint allocates stock items to orderlines and updates stock status to 'sold'.

---

## Request

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | Order ID (database ID) |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `inventory_user_id` | number | Yes | Inventory user ID who performed the action |
| `stock_mapping` | array | No | Optional stock mapping for manual selection or batch filtering |

#### `stock_mapping` Array Item Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `orderline_id` | number | Yes | Orderline ID to allocate stock for |
| `stock_ids` | number[] | No | Specific stock IDs (quantity = array length). Mutually exclusive with `skus` and `batch_filter` |
| `skus` | string[] | No | Specific stock SKUs (quantity = array length). Mutually exclusive with `stock_ids` and `batch_filter` |
| `batch_filter` | object | No | Auto-select from specific batch/supplier/PO. Mutually exclusive with `stock_ids` and `skus` |

#### `batch_filter` Object Structure

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `batchno` | string | No | Batch number filter |
| `supplierid` | number | No | Supplier ID filter |
| `poid` | number | No | Purchase Order ID filter |

**Note:** You can provide `batchno`, `supplierid`, and/or `poid` in any combination. All provided filters will be applied together.

---

## Scenarios

### Scenario 1: FIFO Auto-Select (No stock_mapping)

Automatically selects the oldest available stock items for all orderlines using FIFO (First In First Out).

**Request:**
```json
{
  "inventory_user_id": 123
}
```

**Behavior:**
- Automatically selects available stock for ALL orderlines
- Uses FIFO (oldest stock first)
- Filters by: `stockstatus = 'available'`, `platform = 'nivapp'`, matching product `puc`

---

### Scenario 2: Manual Selection by Stock IDs

Manually specify which stock items to allocate for specific orderlines.

**Request:**
```json
{
  "inventory_user_id": 123,
  "stock_mapping": [
    {
      "orderline_id": 215,
      "stock_ids": [1001, 1002, 1003]
    },
    {
      "orderline_id": 216,
      "stock_ids": [1004, 1005]
    }
  ]
}
```

**Behavior:**
- Uses the specified stock IDs
- Validates that stock count matches orderline quantity
- Validates stock is available and matches product

**Validation:**
- `stock_ids.length` must equal `orderline.quantity`
- All stocks must have `stockstatus = 'available'`
- All stocks must match the orderline's product

---

### Scenario 3: Manual Selection by SKUs

Manually specify which stock items to allocate using SKUs.

**Request:**
```json
{
  "inventory_user_id": 123,
  "stock_mapping": [
    {
      "orderline_id": 215,
      "skus": ["SKU-001", "SKU-002", "SKU-003"]
    }
  ]
}
```

**Behavior:**
- Uses the specified SKUs
- Validates that SKU count matches orderline quantity
- Validates stock is available and matches product

---

### Scenario 4: Batch Filtering (Auto-Select from Specific Batch)

Auto-select stock from a specific batch, supplier, or PO using FIFO within that filter.

**Request:**
```json
{
  "inventory_user_id": 123,
  "stock_mapping": [
    {
      "orderline_id": 215,
      "batch_filter": {
        "batchno": "BATCH-001"
      }
    },
    {
      "orderline_id": 216,
      "batch_filter": {
        "batchno": "BATCH-002",
        "supplierid": 5,
        "poid": 10
      }
    }
  ]
}
```

**Behavior:**
- Auto-selects from filtered batch using FIFO
- Quantity comes from `orderline.quantity`
- All filters are applied together (AND logic)
- If insufficient stock in batch, returns error (no fallback)

**Filter Combinations:**
- `batchno` only
- `supplierid` only
- `poid` only
- `batchno` + `supplierid`
- `batchno` + `poid`
- `supplierid` + `poid`
- All three together

---

### Scenario 5: Hybrid (Mix of Manual and Auto-Select)

You can mix manual selection and auto-select for different orderlines.

**Request:**
```json
{
  "inventory_user_id": 123,
  "stock_mapping": [
    {
      "orderline_id": 215,
      "stock_ids": [1001, 1002]  // Manual selection
    },
    {
      "orderline_id": 216,
      "batch_filter": {
        "batchno": "BATCH-001"  // Auto-select from batch
      }
    }
    // Orderline 217 will use FIFO auto-select (no mapping provided)
  ]
}
```

**Behavior:**
- Orderlines with mapping use specified method
- Orderlines without mapping use FIFO auto-select

---

## Success Response

**Status Code:** `200 OK`

**Response Body:**
```json
{
  "success": true,
  "message": "Order marked as ready for dispatch",
  "data": {
    "id": 160,
    "orderid": "NIVAANA-0000000160",
    "orderstatus": "ready_for_dispatch",
    "orderamount": 450,
    "quantity": 2,
    "productamount": 400,
    "discountamount": 0,
    "ispaymentsucceed": true,
    "mode": "phonepe",
    "promotion_discount_total": 0,
    "original_total": 400,
    "shipping_cost": 50,
    "createddate": 1765379833,
    "modifieddate": 1765379839,
    "readytodispatchdate": 1765379839,
    "status_history": [
      {
        "previous_status": "payment_completed",
        "new_status": "ready_for_dispatch",
        "changed_date": 1765379839,
        "source": "inventoryuser",
        "inventory_user_id": 123,
        "is_active": true
      }
    ],
    // ... other order fields
  }
}
```

---

## Error Responses

### 400 Bad Request - Missing Required Field

**Response:**
```json
{
  "success": false,
  "message": "inventory_user_id is required",
  "statusCode": 400
}
```

---

### 400 Bad Request - Stock Count Mismatch

**Response:**
```json
{
  "success": false,
  "message": "Stock count mismatch for orderline 215: Expected 3, got 2",
  "statusCode": 400
}
```

**When:** Manual selection (`stock_ids` or `skus`) count doesn't match orderline quantity.

---

### 400 Bad Request - Stock Not Available

**Response:**
```json
{
  "success": false,
  "message": "Stock 1001 is not available (status: sold)",
  "statusCode": 400
}
```

**When:** Selected stock is not in 'available' status.

---

### 400 Bad Request - Product Mismatch

**Response:**
```json
{
  "success": false,
  "message": "Stock 1001 (puc: PUC-12345) does not match orderline product (productid: 56, Product.puc: PUC-67890)",
  "statusCode": 400
}
```

**When:** Selected stock doesn't match the orderline's product.

---

### 400 Bad Request - Insufficient Stock (FIFO)

**Response:**
```json
{
  "success": false,
  "message": "Insufficient available stock: Need 5, Found 3",
  "statusCode": 400
}
```

**When:** Not enough available stock for FIFO auto-select.

---

### 400 Bad Request - Insufficient Stock in Batch

**Response:**
```json
{
  "success": false,
  "message": "Insufficient available stock: Need 5, Found 3. Batch: BATCH-001, Supplier: 5, PO: 10. Please select different batch or use manual stock_ids.",
  "statusCode": 400
}
```

**When:** Not enough stock available in the specified batch filter.

---

### 400 Bad Request - Stock Not Found

**Response:**
```json
{
  "success": false,
  "message": "Stock with ID 1001 not found",
  "statusCode": 400
}
```

**When:** Stock ID doesn't exist.

---

### 400 Bad Request - SKU Not Found

**Response:**
```json
{
  "success": false,
  "message": "Stock with SKU SKU-001 not found",
  "statusCode": 400
}
```

**When:** Stock SKU doesn't exist.

---

### 500 Internal Server Error

**Response:**
```json
{
  "success": false,
  "error": "Error marking order as ready for dispatch",
  "statusCode": 500
}
```

**When:** Unexpected server error (transaction rollback, database error, etc.).

---

## Frontend Implementation Examples

### Example 1: Simple FIFO Auto-Select

```typescript
const markReadyForDispatch = async (orderId: number, inventoryUserId: number) => {
  const response = await fetch(`/v1/orders/${orderId}/ready-for-dispatch`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      inventory_user_id: inventoryUserId
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to mark order as ready for dispatch');
  }

  return response.json();
};

// Usage
try {
  const result = await markReadyForDispatch(160, 123);
  console.log('Order marked as ready:', result.data);
} catch (error) {
  console.error('Error:', error.message);
}
```

---

### Example 2: Manual Selection by Stock IDs

```typescript
const markReadyForDispatchWithStockIds = async (
  orderId: number,
  inventoryUserId: number,
  stockMapping: Array<{
    orderline_id: number;
    stock_ids: number[];
  }>
) => {
  const response = await fetch(`/v1/orders/${orderId}/ready-for-dispatch`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      inventory_user_id: inventoryUserId,
      stock_mapping: stockMapping
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to mark order as ready for dispatch');
  }

  return response.json();
};

// Usage
const stockMapping = [
  {
    orderline_id: 215,
    stock_ids: [1001, 1002, 1003]
  },
  {
    orderline_id: 216,
    stock_ids: [1004, 1005]
  }
];

try {
  const result = await markReadyForDispatchWithStockIds(160, 123, stockMapping);
  console.log('Order marked as ready:', result.data);
} catch (error) {
  console.error('Error:', error.message);
}
```

---

### Example 3: Batch Filtering

```typescript
const markReadyForDispatchWithBatchFilter = async (
  orderId: number,
  inventoryUserId: number,
  stockMapping: Array<{
    orderline_id: number;
    batch_filter: {
      batchno?: string;
      supplierid?: number;
      poid?: number;
    };
  }>
) => {
  const response = await fetch(`/v1/orders/${orderId}/ready-for-dispatch`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      inventory_user_id: inventoryUserId,
      stock_mapping: stockMapping
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to mark order as ready for dispatch');
  }

  return response.json();
};

// Usage
const stockMapping = [
  {
    orderline_id: 215,
    batch_filter: {
      batchno: "BATCH-001",
      supplierid: 5
    }
  }
];

try {
  const result = await markReadyForDispatchWithBatchFilter(160, 123, stockMapping);
  console.log('Order marked as ready:', result.data);
} catch (error) {
  console.error('Error:', error.message);
}
```

---

### Example 4: React Hook Implementation

```typescript
import { useState } from 'react';

interface StockMapping {
  orderline_id: number;
  stock_ids?: number[];
  skus?: string[];
  batch_filter?: {
    batchno?: string;
    supplierid?: number;
    poid?: number;
  };
}

const useMarkReadyForDispatch = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const markReadyForDispatch = async (
    orderId: number,
    inventoryUserId: number,
    stockMapping?: StockMapping[]
  ) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/v1/orders/${orderId}/ready-for-dispatch`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          inventory_user_id: inventoryUserId,
          stock_mapping: stockMapping
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to mark order as ready for dispatch');
      }

      const result = await response.json();
      return result.data;
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { markReadyForDispatch, loading, error };
};

// Usage in component
const OrderDispatchComponent = ({ orderId, inventoryUserId }) => {
  const { markReadyForDispatch, loading, error } = useMarkReadyForDispatch();

  const handleDispatch = async () => {
    try {
      // Scenario 1: FIFO auto-select
      const order = await markReadyForDispatch(orderId, inventoryUserId);
      console.log('Order dispatched:', order);
    } catch (err) {
      console.error('Dispatch failed:', err);
    }
  };

  const handleDispatchWithStockIds = async (stockMapping: StockMapping[]) => {
    try {
      // Scenario 2: Manual selection
      const order = await markReadyForDispatch(orderId, inventoryUserId, stockMapping);
      console.log('Order dispatched:', order);
    } catch (err) {
      console.error('Dispatch failed:', err);
    }
  };

  return (
    <div>
      <button onClick={handleDispatch} disabled={loading}>
        {loading ? 'Processing...' : 'Mark Ready for Dispatch (FIFO)'}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
};
```

---

## Important Notes

1. **Transaction Safety:** All updates are wrapped in a database transaction. If any step fails, all changes are rolled back.

2. **Stock Status:** Stock items are automatically updated from `available` to `sold` when allocated.

3. **Quantity Updates:** 
   - `PlatformStock.orderedqty` decreases
   - `PlatformStock.soldqty` increases
   - `Product.orderedquantity` decreases
   - `Product.soldquantity` increases
   - `availableqty` and `availablequantity` do NOT change (already reduced during order creation)

4. **Order Status:** Order and all orderlines are automatically updated to `ready_for_dispatch` status.

5. **Validation:** The API validates:
   - Stock exists and is available
   - Stock matches orderline product
   - Quantity matches orderline quantity
   - Sufficient stock available (for FIFO and batch filter)

6. **Error Handling:** All errors include detailed messages to help identify the issue.

---

## Testing Examples

### cURL Examples

**FIFO Auto-Select:**
```bash
curl -X PATCH "http://localhost:5600/v1/orders/160/ready-for-dispatch" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "inventory_user_id": 123
  }'
```

**Manual Selection:**
```bash
curl -X PATCH "http://localhost:5600/v1/orders/160/ready-for-dispatch" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "inventory_user_id": 123,
    "stock_mapping": [
      {
        "orderline_id": 215,
        "stock_ids": [1001, 1002, 1003]
      }
    ]
  }'
```

**Batch Filter:**
```bash
curl -X PATCH "http://localhost:5600/v1/orders/160/ready-for-dispatch" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "inventory_user_id": 123,
    "stock_mapping": [
      {
        "orderline_id": 215,
        "batch_filter": {
          "batchno": "BATCH-001",
          "supplierid": 5
        }
      }
    ]
  }'
```

