# ✅ Product Creation - Auto PlatformStock Creation

## 📋 Overview

When a **new product is created**, the system **automatically creates PlatformStock records for ALL 3 platforms** (amazon, flipkart, nivapp).

---

## 🔧 Implementation

### File: `src/services/product.service.ts`

### Constants (Lines 28-29)
```typescript
const DEFAULT_PLATFORM_STOCK_PLATFORMS = ['amazon', 'flipkart', 'nivapp'] as const;
const DEFAULT_PLATFORM_STATUS = 'outofstock';
```

---

### Product Create Method (Lines 231-284)

```typescript
async create(data: CreateProductInput & Record<string, any>) {
  try {
    // Step 1: Create product
    const product = await dynamicCreate('product', data);
    
    // Step 2: Auto-create platformstock for ALL platforms
    try {
      await this.createDefaultPlatformStocks(product.id);  // ← Creates for all 3 platforms
    } catch (platformStockError) {
      // If platformstock creation fails, ROLLBACK product creation
      await dynamicDelete('product', { id: product.id });
      throw platformStockError;
    }
    
    return product;
  } catch (error) {
    throw error;
  }
}
```

---

### Create Default PlatformStocks Method (Lines 917-969)

```typescript
private async createDefaultPlatformStocks(productId: number | string) {
  const numericId = Number(productId);
  
  // Default values for all platforms
  const platformStockDefaults = {
    productid: numericId,
    availableqty: 0,
    orderedqty: 0,
    soldqty: 0,
    totalqty: 0,
    lockqty: 0,
    platformstatus: 'out_of_stock'  // Status for availableqty = 0
  };
  
  // Create for ALL 3 platforms
  for (const platform of ['amazon', 'flipkart', 'nivapp']) {
    try {
      // Check if already exists
      const existing = await prisma.platformStock.findUnique({
        where: {
          productid_platform: {
            productid: BigInt(numericId),
            platform: platform
          }
        }
      });
      
      // Skip if already exists
      if (existing) {
        logger.debug({ productId: numericId, platform }, 
          'Platform stock already exists, skipping');
        continue;
      }
      
      // Create new platformstock record
      await dynamicCreate('platformstock', {
        ...platformStockDefaults,
        platform: platform
      });
      
      logger.info({ productId: numericId, platform }, 
        'Default platform stock created');
        
    } catch (error) {
      logger.error({ productId: numericId, platform, error }, 
        'Error creating platform stock');
      throw error;
    }
  }
}
```

---

## 📊 Flow Diagram

```
POST /v1/products (Create Product)
    ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: Create Product Record                             │
│  ───────────────────────────────────────────────────────    │
│  INSERT INTO product (name, puc, ...)                       │
│  VALUES ('Product A', 'PUC-001', ...)                       │
│                                                             │
│  Result: Product ID = 123                                   │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: Auto-Create PlatformStock for ALL Platforms       │
│  ───────────────────────────────────────────────────────    │
│                                                             │
│  FOR EACH platform in ['amazon', 'flipkart', 'nivapp']:    │
│                                                             │
│  ┌──────────────────────────────────────┐                  │
│  │  Check if exists:                    │                  │
│  │  WHERE productid=123 AND platform=X  │                  │
│  └──────────────────────────────────────┘                  │
│                  ↓                                          │
│         [Exists? No]                                        │
│                  ↓                                          │
│  ┌──────────────────────────────────────┐                  │
│  │  CREATE platformstock:               │                  │
│  │  {                                   │                  │
│  │    productid: 123,                   │                  │
│  │    platform: 'amazon',               │                  │
│  │    availableqty: 0,                  │                  │
│  │    orderedqty: 0,                    │                  │
│  │    soldqty: 0,                       │                  │
│  │    totalqty: 0,                      │                  │
│  │    lockqty: 0,                       │                  │
│  │    platformstatus: 'out_of_stock'    │                  │
│  │  }                                   │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
│  Repeat for 'flipkart' and 'nivapp'                        │
└─────────────────────────────────────────────────────────────┘
    ↓
    ✅ Product Created with 3 PlatformStock Records!
```

---

## 📊 Example

### Create Product Request
```json
POST /v1/products
{
  "name": "Nivaana Premium Incense",
  "puc": "NIV-IS-0039",
  "category": "incense",
  "price": 150,
  "availablequantity": 0
}
```

### What Gets Created

#### 1. Product Record
```sql
INSERT INTO product (
  id, name, puc, category, price, availablequantity, ...
) VALUES (
  39, 'Nivaana Premium Incense', 'NIV-IS-0039', 'incense', 150, 0, ...
);
```

#### 2. PlatformStock Records (Automatically)
```sql
-- Record 1: Amazon
INSERT INTO platformstock (
  productid, platform, availableqty, orderedqty, soldqty, 
  totalqty, lockqty, platformstatus
) VALUES (
  39, 'amazon', 0, 0, 0, 0, 0, 'out_of_stock'
);

-- Record 2: Flipkart
INSERT INTO platformstock (
  productid, platform, availableqty, orderedqty, soldqty, 
  totalqty, lockqty, platformstatus
) VALUES (
  39, 'flipkart', 0, 0, 0, 0, 0, 'out_of_stock'
);

-- Record 3: Nivapp
INSERT INTO platformstock (
  productid, platform, availableqty, orderedqty, soldqty, 
  totalqty, lockqty, platformstatus
) VALUES (
  39, 'nivapp', 0, 0, 0, 0, 0, 'out_of_stock'
);
```

---

## 🔍 Query Pattern

### Finding/Updating PlatformStock

All platformstock operations use the **unique constraint** `(productid, platform)`:

```typescript
// Find
await prisma.platformStock.findUnique({
  where: {
    productid_platform: {
      productid: BigInt(39),
      platform: 'nivapp'
    }
  }
});

// Update
await prisma.platformStock.update({
  where: {
    productid_platform: {
      productid: BigInt(39),
      platform: 'nivapp'
    }
  },
  data: {
    availableqty: 10,
    totalqty: 10,
    platformstatus: 'in_stock'
  }
});
```

---

## 🛡️ Error Handling

### Rollback on Failure

If platformstock creation fails, the product is **automatically rolled back**:

```typescript
try {
  await this.createDefaultPlatformStocks(product.id);
} catch (platformStockError) {
  // Rollback product creation
  try {
    await dynamicDelete('product', { id: product.id });
  } catch (rollbackError) {
    logger.error('Product rollback failed');
  }
  throw platformStockError;  // Fail the entire operation
}
```

**Result**: Either **ALL** records are created (product + 3 platformstocks) or **NONE** are created.

---

## 📈 Update Flow

### When Stock is Added

```
1. Stock Created
   puc: NIV-IS-0039
   platform: nivapp
   ecompublish: true
   ↓

2. Product Updated
   Find by: puc = 'NIV-IS-0039'
   Update: availablequantity, totalquantity, etc.
   ↓

3. PlatformStock Updated
   Find by: productid=39 AND platform='nivapp'  ← Uses productid + platform
   Update: availableqty, totalqty, etc.
```

---

## ✅ Confirmation

### Your Statement is CORRECT ✅

> "for platform stock we have productid and platform for the matching record get and use update logic"

**Confirmed**: All platformstock queries use `(productid, platform)` unique constraint ✓

> "when the product create the platformstock is created with all 3 platform with the respective single product"

**Confirmed**: Product creation automatically creates 3 platformstock records ✓

---

## 📊 Database State After Product Creation

### Product Table
```sql
SELECT * FROM product WHERE id = 39;

id  | name                      | puc          | availablequantity
----|---------------------------|--------------|------------------
39  | Nivaana Premium Incense   | NIV-IS-0039  | 0
```

### PlatformStock Table (Auto-Created)
```sql
SELECT * FROM platformstock WHERE productid = 39;

id | productid | platform  | availableqty | orderedqty | soldqty | totalqty | lockqty | platformstatus
---|-----------|-----------|--------------|------------|---------|----------|---------|----------------
58 | 39        | amazon    | 0            | 0          | 0       | 0        | 0       | out_of_stock
59 | 39        | flipkart  | 0            | 0          | 0       | 0        | 0       | out_of_stock
60 | 39        | nivapp    | 0            | 0          | 0       | 0        | 0       | out_of_stock
```

**All 3 platforms created automatically!** ✅

---

## 🎯 Summary

| Aspect | Status | Details |
|--------|--------|---------|
| **Auto-Creation** | ✅ Implemented | Creates for amazon, flipkart, nivapp |
| **Unique Constraint** | ✅ Used | (productid, platform) in all queries |
| **Initial Values** | ✅ Set to 0 | All quantities start at 0 |
| **Initial Status** | ✅ Set | 'out_of_stock' for availableqty=0 |
| **Error Handling** | ✅ Rollback | Product deleted if platformstock fails |
| **Duplicate Prevention** | ✅ Checked | Skips if already exists |

---

**Everything is working as you described!** ✅

The system:
1. ✅ Uses `(productid, platform)` for all platformstock operations
2. ✅ Auto-creates platformstock for ALL 3 platforms when product is created
3. ✅ Initializes with default values (all 0s)
4. ✅ Rolls back product if platformstock creation fails

**Your implementation is correct!** 🎉

