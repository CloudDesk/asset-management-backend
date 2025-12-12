# Stock Allocation Plan for Ready-for-Dispatch

## Current State

### Database Structure
- **Stock Table**: Individual stock items with `stockstatus` (available, sold, damaged), `sku`, `orderid`, `orderlinenumber`
  - `puc` → Links to `Product.puc` (NOT Product.id)
- **PlatformStock Table**: Aggregated quantities per platform (`availableqty`, `orderedqty`, `soldqty`, `totalqty`, `lockqty`)
  - `productid` → Links to `Product.id`
- **Product Table**: Overall product quantities (`availablequantity`, `orderedquantity`, `soldquantity`)
  - `id` → Primary key (used by orderline.productid)
  - `puc` → Unique identifier (used by stock.puc)
- **Orderline Table**: Has `productid`, `quantity`, `orderlinenumber` (unique identifier)
  - `productid` → Links to `Product.id`

### Important Relationship

**Key Points:**
- **Orderline.productid** = **Product.id** (direct relationship)
- **Stock.puc** = **Product.puc** (NOT Product.id)
- **Stock does NOT have productid field** - it only has `puc`

**To find Stock for an Orderline:**
1. Get Product: `Product.id = orderline.productid`
2. Get Product.puc from that Product
3. Search Stock: `Stock.puc = Product.puc`

**Example Flow:**
```
Orderline.productid = 56
  ↓
Product WHERE id = 56 → Product.puc = "PUC-12345"
  ↓
Stock WHERE puc = "PUC-12345" AND stockstatus = 'available'
```

### Current Flow
1. Order created → Stock locked (PlatformStock: `availableqty` ↓, `lockqty` ↑)
2. Payment success → Stock converted (PlatformStock: `lockqty` ↓, `orderedqty` ↑)
3. Ready for dispatch → Only updates order/orderline status (NO stock changes)

## Proposed Changes

### Goal
When marking order as "ready_for_dispatch":
1. Map specific stock items to orderlines
2. Change stock status: `available` → `sold`
3. Update quantities in Stock, PlatformStock, and Product tables

---

## Option 1: Auto-Select Stock (Recommended)

### Request Body
```json
{
  "inventory_user_id": 123
}
```

### Behavior
- Automatically selects available stock items based on:
  - Orderline `productid` and `quantity`
  - Stock `stockstatus = 'available'`
  - Stock `platform = 'nivapp'` (or order's platform)
- Selects oldest available stock first (by `createddate`)

### Pros
- Simple API (no changes needed)
- Automatic allocation
- FIFO (First In First Out) inventory management

### Cons
- No control over which specific items are allocated
- Cannot handle special cases (e.g., damaged items, specific batches)

---

## Option 2: Manual Stock Selection

### Request Body
```json
{
  "inventory_user_id": 123,
  "stock_mapping": [
    {
      "orderline_id": 215,
      "stock_ids": [1001, 1002, 1003]  // OR "skus": ["SKU-001", "SKU-002"]
    },
    {
      "orderline_id": 216,
      "stock_ids": [1004, 1005]
    }
  ]
}
```

### Behavior
- Uses provided stock IDs/SKUs
- Validates:
  - Stock exists and is available
  - Stock matches orderline product
  - Quantity matches orderline quantity

### Pros
- Full control over stock allocation
- Can handle special cases
- Better for inventory management

### Cons
- More complex API
- Frontend needs to know stock IDs/SKUs
- Requires additional UI for stock selection

---

## Option 3: Hybrid Approach (Best of Both)

### Request Body
```json
{
  "inventory_user_id": 123,
  "stock_mapping": [
    {
      "orderline_id": 215,
      "stock_ids": [1001, 1002]  // Optional: if provided, use these; if not, auto-select
    },
    {
      "orderline_id": 216
      // No stock_ids: auto-select for this orderline
    }
  ]
}
```

### Behavior
- If `stock_mapping` provided:
  - Use specified stocks where provided
  - Auto-select for orderlines without stock mapping
- If `stock_mapping` not provided:
  - Auto-select for all orderlines

### Pros
- Flexible: supports both auto and manual
- Backward compatible (works without stock_mapping)
- Best for gradual rollout

### Cons
- More complex implementation
- Need to handle partial mappings

---

## Recommended: Option 3 (Hybrid)

### Implementation Plan

#### Step 1: Update Request Schema
```typescript
// src/routes/orders.route.ts
body: {
  type: 'object',
  required: ['inventory_user_id'],
  properties: {
    inventory_user_id: { type: 'number' },
    stock_mapping: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          orderline_id: { type: 'number' },
          stock_ids: { 
            type: 'array',
            items: { type: 'number' },
            description: 'Specific stock IDs (quantity = array length)'
          },
          skus: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific stock SKUs (quantity = array length)'
          },
          batch_filter: {
            type: 'object',
            properties: {
              batchno: { type: 'string' },
              supplierid: { type: 'number' },
              poid: { type: 'number' }
            },
            description: 'Auto-select from specific batch/supplier/PO (quantity from orderline)'
          }
        },
        // Either stock_ids OR skus OR batch_filter (or none for full auto-select)
      }
    }
  }
}
```

#### Step 2: Stock Allocation Logic

```typescript
async allocateStockToOrderlines(
  orderId: number,
  stockMapping?: StockMapping[]
): Promise<AllocationResult[]> {
  
  // Get all orderlines
  const orderlines = await getOrderlines(orderId);
  
  const allocations: AllocationResult[] = [];
  
  for (const orderline of orderlines) {
    const mapping = stockMapping?.find(m => m.orderline_id === orderline.id);
    
    let stocks: Stock[];
    
    if (mapping?.stock_ids) {
      // Manual selection by stock IDs
      stocks = await getStocksByIds(mapping.stock_ids);
      // Validate quantity matches orderline
      if (stocks.length !== orderline.quantity) {
        throw new Error(
          `Stock count mismatch for orderline ${orderline.id}: ` +
          `Expected ${orderline.quantity}, got ${stocks.length}`
        );
      }
    } else if (mapping?.skus) {
      // Manual selection by SKUs
      stocks = await getStocksBySKUs(mapping.skus);
      // Validate quantity matches orderline
      if (stocks.length !== orderline.quantity) {
        throw new Error(
          `Stock count mismatch for orderline ${orderline.id}: ` +
          `Expected ${orderline.quantity}, got ${stocks.length}`
        );
      }
    } else if (mapping?.batch_filter) {
      // Auto-select from specific batch/filter
      stocks = await autoSelectStocks(
        orderline.productid,
        orderline.quantity,  // Use orderline quantity
        orderline.platform || 'nivapp',
        mapping.batch_filter
      );
    } else {
      // Auto-select available stocks (no filter)
      stocks = await autoSelectStocks(
        orderline.productid,
        orderline.quantity,  // Use orderline quantity
        orderline.platform || 'nivapp'
      );
    }
    
    // Validate stock status and product match
    for (const stock of stocks) {
      if (stock.stockstatus !== 'available') {
        throw new Error(`Stock ${stock.id} is not available`);
      }
      // Validate: Get Product by id = orderline.productid, then check Stock.puc = Product.puc
      // Note: Stock does NOT have productid field - we match via puc
      const orderlineProduct = await dynamicFindUnique('product', { id: orderline.productid });
      if (!orderlineProduct || stock.puc !== orderlineProduct.puc) {
        throw new Error(`Stock ${stock.id} (puc: ${stock.puc}) does not match orderline product (productid: ${orderline.productid}, Product.puc: ${orderlineProduct?.puc || 'N/A'})`);
      }
    }
    
    allocations.push({
      orderline_id: orderline.id,
      stocks: stocks
    });
  }
  
  return allocations;
}

async autoSelectStocks(
  productId: number,  // This is Product.id (orderline.productid = Product.id)
  quantity: number,  // From orderline.quantity
  platform: string,
  batchFilter?: {
    batchno?: string;
    supplierid?: number;
    poid?: number;
  }
): Promise<Stock[]> {
  
  // Get Product by id to get puc
  // Relationship: Product.id = orderline.productid, Stock.puc = Product.puc
  const product = await dynamicFindUnique('product', { id: productId });
  if (!product || !product.puc) {
    throw new Error(`Product not found or missing PUC for productid: ${productId}`);
  }
  
  const filters: any = {
    puc: product.puc,  // Stock.puc = Product.puc (where Product.id = productId)
    platform: platform,
    stockstatus: 'available'
  };
  
  // Apply batch filters if provided
  if (batchFilter?.batchno) {
    filters.batchno = batchFilter.batchno;
  }
  if (batchFilter?.supplierid) {
    filters.supplierid = batchFilter.supplierid;
  }
  if (batchFilter?.poid) {
    filters.poid = batchFilter.poid;
  }
  
  // Get available stocks
  const { data: stocks } = await dynamicFindManyWithFilters('stock', filters, {
    orderBy: 'createddate',  // FIFO within filtered batch
    orderDirection: 'ASC',
    take: quantity
  });
  
  if (!stocks || stocks.length < quantity) {
    throw new Error(
      `Insufficient available stock: Need ${quantity}, Found ${stocks?.length || 0}` +
      (batchFilter?.batchno ? ` (filtered by batch: ${batchFilter.batchno})` : '')
    );
  }
  
  return stocks.slice(0, quantity);
}
```

#### Step 3: Update Stock Status and Quantities

```typescript
async updateStockForDispatch(
  allocations: AllocationResult[],
  orderId: number,  // orders.id (Int type)
  order: any         // Full order object to get order.orderid (String)
): Promise<void> {
  
  const currentTimestamp = Date.now();
  
  for (const allocation of allocations) {
    const orderline = await getOrderlineById(allocation.orderline_id);
    
    for (const stock of allocation.stocks) {
      // 1. Update Stock record
      // Note: Stock.orderid is String (references orders.orderid, not orders.id)
      // Note: Stock.orderlinenumber is String (references orderline.orderlinenumber)
      await dynamicUpdate('stock', { id: stock.id }, {
        stockstatus: 'sold',
        orderid: order.orderid || orderId.toString(),  // Use orders.orderid (String) if available, else convert
        orderlinenumber: orderline.orderlinenumber,    // String type
        solddate: currentTimestamp,
        modifieddate: currentTimestamp
      });
      
      // 2. Get Product by puc to get productid (PlatformStock uses productid, not puc)
      const product = await dynamicFindUnique('product', { puc: stock.puc });
      if (!product || !product.id) {
        throw new Error(`Product not found for puc: ${stock.puc}`);
      }
      const productId = Number(product.id);
      
      // 3. Get PlatformStock record to update quantities
      const { data: platformStocks } = await dynamicFindManyWithFilters('platformstock', {
        productid: productId.toString(),
        platform: stock.platform
      }, { take: 1, useAllColumns: true });
      
      if (platformStocks && platformStocks.length > 0) {
        const platformStock = platformStocks[0];
        const orderlineQuantity = orderline.quantity || 1;
        
        // Update PlatformStock: decrease orderedqty, increase soldqty
        // Note: availableqty and platformstatus don't change (already done during order creation)
        const newOrderedQty = Math.max(0, (platformStock.orderedqty || 0) - orderlineQuantity);
        const newSoldQty = (platformStock.soldqty || 0) + orderlineQuantity;
        
        await dynamicUpdate('platformstock', { id: platformStock.id }, {
          orderedqty: newOrderedQty,
          soldqty: newSoldQty,
          modifieddate: currentTimestamp
        });
      }
      
      // 4. Get Product to update quantities
      const productForUpdate = await dynamicFindUnique('product', { puc: stock.puc });
      if (productForUpdate) {
        const orderlineQuantity = orderline.quantity || 1;
        
        // Update Product: decrease orderedquantity, increase soldquantity
        // Note: availablequantity doesn't change (already done during order creation)
        const newOrderedQuantity = Math.max(0, (productForUpdate.orderedquantity || 0) - orderlineQuantity);
        const newSoldQuantity = (productForUpdate.soldquantity || 0) + orderlineQuantity;
        
        await dynamicUpdate('product', { id: productForUpdate.id }, {
          orderedquantity: newOrderedQuantity,
          soldquantity: newSoldQuantity,
          modifieddate: currentTimestamp
        });
      }
    }
  }
}
```

#### Step 4: Update markReadyForDispatch Service

```typescript
async markReadyForDispatch(
  orderId: number, 
  inventoryUserId: number,
  stockMapping?: StockMapping[]
): Promise<any> {
  
  // 1. Get full order object (needed for order.orderid String)
  const order = await this.findById(orderId);
  
  // 2. Allocate stock to orderlines
  const allocations = await this.allocateStockToOrderlines(orderId, stockMapping);
  
  // 3. Update stock status and quantities
  await this.updateStockForDispatch(allocations, orderId, order);
  
  // 3. Update orderlines status (existing logic)
  // ... existing code ...
  
  // 4. Recalculate order status (existing logic)
  // ... existing code ...
}
```

---

## Quantity Update Logic

### Summary: What Fields Are Updated?

**Important:** During order creation, `availableqty` and `availablequantity` are already reduced. During dispatch, we only convert from `ordered` to `sold`.

#### PlatformStock Fields Updated:
1. **`availableqty`** - ❌ **NO CHANGE** (already reduced during order creation)
2. **`orderedqty`** - ✅ **DECREASES by orderline quantity** (manual update required)
3. **`soldqty`** - ✅ **INCREASES by orderline quantity** (manual update required)
4. **`platformstatus`** - ❌ **NO CHANGE** (already updated during order placement)
5. **`modifieddate`** - ✅ **UPDATED** to current timestamp

#### Product Fields Updated:
1. **`availablequantity`** - ❌ **NO CHANGE** (already reduced during order creation)
2. **`orderedquantity`** - ✅ **DECREASES by orderline quantity** (manual update required)
3. **`soldquantity`** - ✅ **INCREASES by orderline quantity** (manual update required)
4. **`modifieddate`** - ✅ **UPDATED** to current timestamp

**Note:** Other fields like `quantity`, `ecompublishedquantity`, `productstatus` are NOT updated during dispatch.

### How to Get PlatformStock Record

**PlatformStock uses composite unique key: `[productid, platform]`**

```typescript
// Method 1: Using dynamicFindManyWithFilters (Recommended)
const { data: platformStocks } = await dynamicFindManyWithFilters('platformstock', {
  productid: productId.toString(),  // Product.id (BigInt converted to string)
  platform: stock.platform           // e.g., 'nivapp'
}, { 
  take: 1, 
  useAllColumns: true 
});

if (platformStocks && platformStocks.length > 0) {
  const platformStock = platformStocks[0];
  // Use platformStock.id, platformStock.availableqty, etc.
}

// Method 2: Using PlatformStockService helper method
const platformStockService = new PlatformStockService();
const platformStock = await platformStockService.getByProductAndPlatform(
  productId,      // number (Product.id)
  stock.platform  // string (e.g., 'nivapp')
);

// Method 3: Using dynamicFindMany (alternative syntax)
const platformStocks = await dynamicFindMany('platformstock', {
  where: {
    productid: productId,
    platform: stock.platform,
  },
  take: 1
});
```

**Important Notes:**
- PlatformStock is identified by **`productid` (Product.id) + `platform`** combination
- We get `productid` by: `Product WHERE puc = stock.puc` → get `Product.id`
- PlatformStock does NOT use `puc` - it uses `productid` (Product.id)

### Schema Data Types Reference

**Key Fields for Filtering and Updates:**

#### PlatformStock Table
| Field | Type | Notes |
|-------|------|-------|
| `id` | `BigInt` | Primary key |
| `productid` | `BigInt` | Foreign key to Product.id - **Use string or number in filters** |
| `platform` | `String` | e.g., 'nivapp', 'amazon', 'flipkart' |
| `availableqty` | `Int` | Quantity field |
| `orderedqty` | `Int` | Quantity field |
| `soldqty` | `Int` | Quantity field |
| `modifieddate` | `BigInt?` | Timestamp (epoch milliseconds) |

#### Product Table
| Field | Type | Notes |
|-------|------|-------|
| `id` | `BigInt` | Primary key |
| `puc` | `String` | Unique identifier - **Use string in filters** |
| `orderedquantity` | `Int?` | Quantity field |
| `soldquantity` | `Int?` | Quantity field |
| `availablequantity` | `Int?` | Quantity field |
| `modifieddate` | `BigInt?` | Timestamp (epoch milliseconds) |

#### Stock Table
| Field | Type | Notes |
|-------|------|-------|
| `id` | `BigInt` | Primary key |
| `puc` | `String` | Links to Product.puc - **Use string in filters** |
| `platform` | `String` | e.g., 'nivapp', 'amazon', 'flipkart' |
| `stockstatus` | `String` | 'available', 'sold', 'damaged' |
| `orderid` | `String?` | **String type** (not Int!) - Links to orders.orderid |
| `orderlinenumber` | `String?` | **String type** - Links to orderline.orderlinenumber |
| `batchno` | `String?` | Batch number filter |
| `supplierid` | `Int?` | Supplier ID filter |
| `poid` | `Int?` | Purchase Order ID filter |
| `modifieddate` | `BigInt?` | Timestamp (epoch milliseconds) |

#### orders Table
| Field | Type | Notes |
|-------|------|-------|
| `id` | `Int` | Primary key - **Int type** (not BigInt!) |
| `orderid` | `String?` | Unique order identifier (e.g., 'NIVAANA-0000000160') |
| `modifieddate` | `BigInt?` | Timestamp (epoch milliseconds) |

#### orderline Table
| Field | Type | Notes |
|-------|------|-------|
| `id` | `Int` | Primary key - **Int type** (not BigInt!) |
| `orderid` | `Int` | Foreign key to orders.id - **Int type** |
| `orderlinenumber` | `String?` | Unique identifier - **String type** |
| `productid` | `BigInt?` | Foreign key to Product.id - **Use string or number in filters** |
| `quantity` | `Int?` | Orderline quantity |
| `modifieddate` | `BigInt?` | Timestamp (epoch milliseconds) |

**Filtering Best Practices:**
- **BigInt fields** (`id`, `productid`): Can pass as `string` or `number` - `dynamicFindManyWithFilters` handles conversion
- **Int fields** (`orderid` in orders/orderline): Pass as `number` or `string`
- **String fields** (`puc`, `platform`, `orderid` in orders, `orderlinenumber`): Pass as `string`
- **For updates**: Use `BigInt(Date.now())` for `modifieddate` fields

### When Stock Status Changes: `available` → `sold`

#### PlatformStock Update Flow
```typescript
// Step 1: Get Product.id from Stock.puc
const product = await dynamicFindUnique('product', { puc: stock.puc });
const productId = Number(product.id);

// Step 2: Get PlatformStock record
const { data: platformStocks } = await dynamicFindManyWithFilters('platformstock', {
  productid: productId.toString(),
  platform: stock.platform
}, { take: 1, useAllColumns: true });

// Step 3: Update PlatformStock quantities
if (platformStocks && platformStocks.length > 0) {
  const platformStock = platformStocks[0];
  const orderlineQuantity = orderline.quantity || 1;
  
  // Decrease orderedqty, increase soldqty by orderline quantity
  const newOrderedQty = Math.max(0, (platformStock.orderedqty || 0) - orderlineQuantity);
  const newSoldQty = (platformStock.soldqty || 0) + orderlineQuantity;
  
  await dynamicUpdate('platformstock', { id: platformStock.id }, {
    orderedqty: newOrderedQty,
    soldqty: newSoldQty,
    modifieddate: Date.now()
  });
  // Note: availableqty and platformstatus remain unchanged
}
```

#### Product Update Flow
```typescript
// Step 1: Get Product by puc
const product = await dynamicFindUnique('product', { puc: stock.puc });

// Step 2: Update Product quantities
if (product) {
  const orderlineQuantity = orderline.quantity || 1;
  
  // Decrease orderedquantity, increase soldquantity by orderline quantity
  const newOrderedQuantity = Math.max(0, (product.orderedquantity || 0) - orderlineQuantity);
  const newSoldQuantity = (product.soldquantity || 0) + orderlineQuantity;
  
  await dynamicUpdate('product', { id: product.id }, {
    orderedquantity: newOrderedQuantity,
    soldquantity: newSoldQuantity,
    modifieddate: Date.now()
  });
  // Note: availablequantity remains unchanged
}
```

#### Before/After Example
```typescript
// Example: Orderline with quantity = 3

// PlatformStock - Before (after order creation):
availableqty: 7   // Already reduced by 3 during order creation
orderedqty: 3     // Set during payment success
soldqty: 0
platformstatus: 'low_stock'  // Already calculated

// PlatformStock - After (ready-for-dispatch):
availableqty: 7   // NO CHANGE (already reduced)
orderedqty: 0     // Decrease by 3 (orderline quantity)
soldqty: 3        // Increase by 3 (orderline quantity)
platformstatus: 'low_stock'  // NO CHANGE

// Product - Before (after order creation):
availablequantity: 7   // Already reduced by 3
orderedquantity: 3     // Set during payment success
soldquantity: 0

// Product - After (ready-for-dispatch):
availablequantity: 7   // NO CHANGE (already reduced)
orderedquantity: 0     // Decrease by 3 (orderline quantity)
soldquantity: 3        // Increase by 3 (orderline quantity)
```

---

## Error Handling

### Scenarios to Handle
1. **Insufficient Stock**: Not enough available stock for orderline
2. **Stock Already Sold**: Selected stock is no longer available
3. **Product Mismatch**: Stock doesn't match orderline product
4. **Quantity Mismatch**: Provided stock count doesn't match orderline quantity
5. **Invalid Stock IDs/SKUs**: Stock IDs/SKUs don't exist

### Validation Order
1. Validate order exists and has orderlines
2. Validate stock mapping (if provided)
3. Validate stock availability
4. Validate product matches
5. Validate quantities match
6. Perform updates in transaction

---

## Transaction Safety

All updates should be in a database transaction:
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Update stock records
  // 2. Update platformstock quantities
  // 3. Update product quantities
  // 4. Update orderlines
  // 5. Update order
});
```

---

## Important Business Considerations

### 1. Batch/Supplier/PO Tracking for Quality Control

**Requirement**: Track which batch, supplier, and PO was used for each order (for recalls, quality issues)

**Current Stock Fields**:
- `batchno` - Batch number
- `supplierid` - Supplier ID
- `poid` - Purchase Order ID
- `orderid` - Order ID (set when allocated)
- `orderlinenumber` - Orderline number (set when allocated)

**Tracking Capability**:
- ✅ **Even with FIFO**: We can track which batch was used because we link stock to order
- ✅ **Query Example**: Find all stock from batch "BATCH-001" dispatched in Dec 1st week
  ```sql
  SELECT * FROM stock 
  WHERE batchno = 'BATCH-001' 
    AND orderid IN (
      SELECT orderid FROM orders 
      WHERE shipdate BETWEEN '2024-12-01' AND '2024-12-07'
    )
  ```

**However**:
- ❌ **FIFO Limitation**: Cannot proactively select specific batches
- ❌ **Issue**: If you want to dispatch oldest batch first, FIFO works. But if you want to avoid a specific batch, FIFO won't help.

### 2. Product-Specific Stock (Home Fragrance, Aromatherapy, Personal Care)

**Question**: Are all stock items under the same product identical?

**If YES** (same product, same specifications):
- ✅ FIFO is fine - any stock item works
- ✅ No need to worry about "wrong stock"

**If NO** (different batches, suppliers, expiry dates):
- ⚠️ Need manual selection or batch filtering
- ⚠️ FIFO might select wrong batch

### 3. Small Scale Business Recommendation

**For Small Scale Business**:
- **Manual Selection** is often better because:
  - ✅ Low volume = easy to manage manually
  - ✅ Full control over batch selection
  - ✅ Better for quality control
  - ✅ Can avoid specific batches if needed
  - ✅ Easier to track and audit

**When to use Auto-Select**:
- High volume orders
- All stock items are identical
- No batch tracking requirements

---

## Updated Recommendation: Manual Selection with Batch Filtering

### Enhanced Request Body
```json
{
  "inventory_user_id": 123,
  "stock_mapping": [
    {
      "orderline_id": 215,
      "stock_ids": [1001, 1002]  // Specific stock IDs (quantity = stock_ids.length)
    },
    {
      "orderline_id": 216,
      "batch_filter": {
        "batchno": "BATCH-001",  // Select from specific batch
        "supplierid": 5,          // Optional: filter by supplier
        "poid": 10                // Optional: filter by PO
      }
      // quantity comes from orderline.quantity - no need to specify
    }
  ]
}
```

**Note**: 
- For `stock_ids`: Quantity is determined by the number of stock IDs provided
- For `batch_filter`: Quantity comes from `orderline.quantity` (fetched from database)
- No need to pass `quantity` in payload - it's redundant

### Auto-Select with Batch Priority
```typescript
async autoSelectStocks(
  productId: number,  // Product.id (orderline.productid = Product.id)
  quantity: number,
  platform: string,
  batchFilter?: {
    batchno?: string;
    supplierid?: number;
    poid?: number;
  }
): Promise<Stock[]> {
  
  // Get Product by id to get puc
  // Relationship: Product.id = orderline.productid, Stock.puc = Product.puc
  const product = await dynamicFindUnique('product', { id: productId });
  if (!product || !product.puc) {
    throw new Error(`Product not found or missing PUC for productid: ${productId}`);
  }
  
  const filters: any = {
    puc: product.puc,  // Stock.puc = Product.puc (where Product.id = productId)
    platform: platform,
    stockstatus: 'available'
  };
  
  // Apply batch filters if provided
  if (batchFilter?.batchno) {
    filters.batchno = batchFilter.batchno;
  }
  if (batchFilter?.supplierid) {
    filters.supplierid = batchFilter.supplierid;
  }
  if (batchFilter?.poid) {
    filters.poid = batchFilter.poid;
  }
  
  // Get available stocks
  const { data: stocks } = await dynamicFindManyWithFilters('stock', filters, {
    orderBy: 'createddate',  // FIFO within filtered batch
    orderDirection: 'ASC',
    take: quantity
  });
  
  if (!stocks || stocks.length < quantity) {
    throw new Error(`Insufficient stock: Need ${quantity}, Found ${stocks?.length || 0}`);
  }
  
  return stocks.slice(0, quantity);
}
```

---

## Questions for Discussion

1. **Stock Selection**: 
   - ✅ **Recommended for Small Scale**: Manual selection with batch filtering
   - Alternative: Hybrid (manual for critical products, auto for others)

2. **Platform**: Should we filter by order's platform or always use 'nivapp'?
   - ✅ **Recommended**: Use order's platform or default to 'nivapp'

3. **FIFO vs Manual**:
   - ✅ **For Small Scale**: Manual selection (better control)
   - ✅ **For High Volume**: Auto-select with FIFO
   - ✅ **Best Solution**: Hybrid with batch filtering

4. **Batch Tracking**:
   - ✅ **Solution**: Link stock to order (already in schema)
   - ✅ **Query**: Can always find which batch was used for any order
   - ✅ **Proactive Selection**: Use batch filter in request

5. **Partial Allocation**: What if some orderlines can be allocated but others can't?
   - ✅ **Recommended**: All-or-nothing (transaction rollback)
   - Alternative: Partial success with detailed error reporting

6. **Rollback**: If one orderline fails, should we rollback all or continue with others?
   - ✅ **Recommended**: Rollback all (transaction safety)

---

## Final Recommendation

### For Your Business (Small Scale, Batch Tracking Required):

**Use Manual Selection with Batch Filtering**:

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
        "batchno": "BATCH-001"  // Auto-select from specific batch
      }
      // quantity comes from orderline.quantity
    }
  ]
}
```

**Benefits**:
- ✅ Full control over stock allocation
- ✅ Batch tracking for quality control
- ✅ Can avoid problematic batches
- ✅ Easy to audit and track
- ✅ Perfect for small scale operations

---

## Confirmed Understanding

### Scenario 1: Only `inventory_user_id` (FIFO Auto-Select)

**Request:**
```json
{
  "inventory_user_id": 123
}
```

**Flow:**
1. ✅ Get order and all orderlines
2. ✅ For each orderline:
   - Get `productid` and `quantity` from orderline
   - Get Product by `productid` to get `puc`
   - Query available stock: `stockstatus = 'available'` AND `platform = 'nivapp'` AND `puc = Product.puc`
   - Select oldest first (FIFO by `createddate`)
   - Select `quantity` number of stocks
3. ✅ Validate:
   - Stock status = 'available'
   - Stock platform = 'nivapp'
   - Stock product matches orderline product
   - Enough stock available (quantity matches)
4. ✅ Update Stock:
   - `stockstatus`: 'available' → 'sold'
   - `orderid`: Set to order ID
   - `orderlinenumber`: Set to orderline number
   - `solddate`: Current timestamp
5. ✅ Update PlatformStock:
   - `availableqty`: NO CHANGE (already reduced during order creation)
   - `orderedqty`: Decrease by orderline quantity (manual update)
   - `soldqty`: Increase by orderline quantity (manual update)
   - `platformstatus`: NO CHANGE (already updated during order placement)
   - `modifieddate`: Update to current timestamp
6. ✅ Update Product:
   - `availablequantity`: NO CHANGE (already reduced during order creation)
   - `orderedquantity`: Decrease by orderline quantity (manual update)
   - `soldquantity`: Increase by orderline quantity (manual update)
   - `modifieddate`: Update to current timestamp
7. ✅ Existing implementation: Update orderlines status to 'ready_for_dispatch'

---

### Scenario 2: Pass `stock_ids` or `skus` (Manual Selection)

**Request:**
```json
{
  "inventory_user_id": 123,
  "stock_mapping": [
    {
      "orderline_id": 215,
      "stock_ids": [1001, 1002]  // OR "skus": ["SKU-001", "SKU-002"]
    }
  ]
}
```

**Flow:**
1. ✅ Get order and orderlines
2. ✅ For each orderline with mapping:
   - Get specific stocks by IDs or SKUs
   - Validate quantity: `stock_ids.length` or `skus.length` must equal `orderline.quantity`
3. ✅ Validate:
   - Stock exists
   - Stock status = 'available'
   - Stock platform = 'nivapp'
   - Stock `puc` matches Product `puc` (where Product `id` = orderline `productid`)
   - **Note**: Stock does NOT have productid - we search by `puc` after getting Product.puc
   - Quantity matches orderline quantity
4. ✅ Update Stock, PlatformStock, Product (same as Scenario 1)
5. ✅ Existing implementation: Update orderlines status

---

### Scenario 3: Pass `batch_filter` (Batch/Supplier/PO Filter)

**Request:**
```json
{
  "inventory_user_id": 123,
  "stock_mapping": [
    {
      "orderline_id": 216,
      "batch_filter": {
        "batchno": "BATCH-001",  // OR supplierid, OR poid, OR combination
        "supplierid": 5,
        "poid": 10
      }
    }
  ]
}
```

**Flow:**
1. ✅ Get order and orderlines
2. ✅ For each orderline with batch_filter:
   - Get `productid` and `quantity` from orderline
   - **Get Product**: `Product WHERE id = orderline.productid` → get `Product.puc`
   - **Search Stock** with filters:
     - `stockstatus = 'available'`
     - `platform = 'nivapp'`
     - `puc = Product.puc` (NOT productid - Stock doesn't have productid field)
     - `batchno = 'BATCH-001'` (if provided)
     - `supplierid = 5` (if provided)
     - `poid = 10` (if provided)
   - Select oldest first (FIFO within filtered batch)
   - Select `orderline.quantity` number of stocks
3. ✅ Validate:
   - Stock status = 'available'
   - Stock platform = 'nivapp'
   - Stock product matches orderline product
   - Enough stock available in filtered batch

**⚠️ Edge Case: Insufficient Stock in Batch Filter**

**Question**: If orderline quantity is 5, but batch_filter only has 3 available stocks, what to do?

**Options:**

#### Option A: Strict Validation (Recommended)
- ❌ **Fail with error**: "Insufficient stock in batch BATCH-001: Need 5, Found 3"
- ✅ **Pros**: Prevents partial allocation, forces user to choose different batch
- ❌ **Cons**: User must manually select or choose different batch

#### Option B: Fallback to FIFO (Not Recommended)
- ⚠️ **Auto-fallback**: If batch filter has insufficient stock, fall back to FIFO from all available stock
- ❌ **Pros**: Always succeeds
- ❌ **Cons**: 
  - Defeats purpose of batch filter
  - User might get stock from unwanted batch
  - No control over which batch is selected
  - Breaks batch tracking requirement

#### Option C: Partial Allocation with Warning (Not Recommended)
- ⚠️ **Partial**: Allocate 3 from batch, leave 2 unallocated
- ❌ **Pros**: Some stock allocated
- ❌ **Cons**: 
  - Order partially fulfilled
  - Complex state management
  - User confusion

**✅ Recommended: Option A (Strict Validation)**

**Implementation:**
```typescript
if (!stocks || stocks.length < quantity) {
  throw new Error(
    `Insufficient stock in batch filter: ` +
    `Need ${quantity}, Found ${stocks?.length || 0}. ` +
    `Batch: ${batchFilter.batchno || 'N/A'}, ` +
    `Supplier: ${batchFilter.supplierid || 'N/A'}, ` +
    `PO: ${batchFilter.poid || 'N/A'}. ` +
    `Please select different batch or use manual stock_ids.`
  );
}
```

4. ✅ Update Stock, PlatformStock, Product (same as Scenario 1)
5. ✅ Existing implementation: Update orderlines status

---

## Summary Table

| Scenario | Selection Method | Validation | If Insufficient |
|----------|-----------------|------------|-----------------|
| 1. Only `inventory_user_id` | FIFO (all available) | `available`, `nivapp`, product match | Error (rollback) |
| 2. `stock_ids`/`skus` | Manual (specific) | `available`, `nivapp`, product match, quantity match | Error (quantity mismatch) |
| 3. `batch_filter` | FIFO (within batch) | `available`, `nivapp`, product match, batch match | Error (insufficient in batch) — no FIFO fallback |

---

## Next Steps

1. ✅ Review and approve plan
2. ⬜ Update request schema (add stock_mapping with batch_filter)
3. ⬜ Implement stock allocation logic (manual + batch filtering)
4. ⬜ Implement quantity update logic
5. ⬜ Add transaction safety
6. ⬜ Add error handling (strict validation - no FIFO fallback)
7. ⬜ Add logging (include batch/supplier/PO info)
8. ⬜ Test with various scenarios
9. ⬜ Add query helpers for batch tracking

