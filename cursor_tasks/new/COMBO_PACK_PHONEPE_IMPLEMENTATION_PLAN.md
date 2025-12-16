# Combo Pack PhonePe Implementation Plan

## 📋 Review of Your Plan (Untitled-2)

### ✅ What You've Already Implemented

1. **Database Schema:**
   - ✅ Added `iscombo` flag in `product` table
   - ✅ Created `productbundlemap` table with:
     - `bundleproductid` (combo product ID)
     - `componentproductid` (component product ID)
     - `requiredqty` (quantity needed per combo)
     - `isactive` flag

2. **Product Display:**
   - ✅ Added combo pack support in mobile app routes:
     - `GET /v1/products/platform/:platform`
     - `GET /v1/products/:id/platform/:platform`
   - ✅ Returns components with platform stock information

3. **Add to Cart Validation:**
   - ✅ Frontend validates: `platformStock.availableqty - platformStock.lockqty > min_requiredqty`
   - ✅ Minimum `requiredqty` is calculated from `productbundlemap` table
   - ✅ Combo availability calculated on frontend using existing route data

**Existing Route:** `GET /v1/products/:id/platform/:platform`

**Frontend Calculation (Mobile App):**
```typescript
// Mobile app code - Calculate combo availability from API response
const calculateComboAvailability = (components) => {
  if (!components || components.length === 0) return 0;
  
  return Math.min(
    ...components.map(c => {
      const actualAvailable = c.platformStock.availableqty - c.platformStock.lockqty;
      return Math.floor(actualAvailable / c.requiredqty);
    })
  );
};

// Usage:
const product = await fetch(`/v1/products/${productId}/platform/nivapp`);
const comboAvailable = calculateComboAvailability(product.data.components);
// Result: Maximum combo packs available (e.g., 1, 3, 14, etc.)
```

**Note:** ✅ **No new route needed** - Frontend calculates availability from existing route response


### 🎯 What Needs to Be Implemented

**PhonePe Payment Flow:**
- ❌ **Initiate**: Lock stock for combo components (currently only handles single products)
- ❌ **Callback**: Convert combo component locks to orders (currently only handles single products)

---

## 🔒 PHASE 1: PhonePe Initiate - Combo Pack Stock Locking

### Current Single Product Logic (Reference)

**Location:** `src/controllers/phonepe.controller.ts` (Lines 509-685)

**Current Flow:**
```typescript
// For each order item:
1. Validate product exists
2. Validate platformstock exists
3. Check availability: availableqty - lockqty >= requestedQuantity
4. Lock stock atomically (SELECT FOR UPDATE):
   - availableqty = availableqty - requestedQuantity
   - lockqty = lockqty + requestedQuantity
```

### New Combo Pack Logic (To Implement)

**Location:** `src/controllers/phonepe.controller.ts` - `initiatePayment()` method

**Flow:**
```typescript
// For each order item:
1. Check if product.iscombo === true
2. IF COMBO:
   a. Get all components from productbundlemap
   b. Validate ALL components have enough stock
   c. Lock ALL components atomically (transaction)
3. IF SINGLE PRODUCT:
   a. Use existing logic (no changes)
```

---

## 📝 Implementation Details: PhonePe Initiate

### Step 1: Detect Combo Product

**Location:** `src/controllers/phonepe.controller.ts` - Around line 510 (inside stock locking transaction)

**Code:**
```typescript
// Inside the stock locking transaction (prisma.$transaction)
for (const orderItem of requestBody.order) {
  const productId = orderItem.productid;
  const requestedQuantity = orderItem.quantity;

  // ✅ NEW: Check if product is combo
  const product = await tx.product.findUnique({
    where: { id: BigInt(productId) },
    select: {
      id: true,
      iscombo: true,
      name: true,
    },
  });

  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  if (product.iscombo) {
    // ✅ COMBO LOGIC: Lock all components
    await lockComboComponents(tx, productId, requestedQuantity, orderItem);
  } else {
    // ✅ SINGLE PRODUCT: Existing logic (no changes)
    await lockSingleProduct(tx, productId, requestedQuantity, orderItem);
  }
}
```

---

### Step 2: Create `lockComboComponents()` Function

**Location:** `src/controllers/phonepe.controller.ts` - Add as private method

**Function Signature:**
```typescript
/**
 * Lock stock for all components of a combo product
 * @param tx - Prisma transaction client
 * @param comboProductId - Combo product ID
 * @param comboQuantity - Number of combo packs ordered
 * @param orderItem - Original order item (for logging)
 */
private async lockComboComponents(
  tx: any, // Prisma transaction client
  comboProductId: number,
  comboQuantity: number,
  orderItem: any
): Promise<void>
```

**Implementation:**
```typescript
private async lockComboComponents(
  tx: any,
  comboProductId: number,
  comboQuantity: number,
  orderItem: any
): Promise<void> {
  const PLATFORM_NAME = "nivapp";
  const logger = this.logger; // Use controller's logger

  logger.info(
    {
      comboProductId,
      comboQuantity,
      orderItem: {
        productid: orderItem.productid,
        productname: orderItem.productname,
        quantity: orderItem.quantity,
      },
    },
    "Starting combo component stock locking"
  );

  // Step 1: Get all active components for this combo
  const components = await tx.productBundleMap.findMany({
    where: {
      bundleproductid: BigInt(comboProductId),
      isactive: true,
    },
    include: {
      componentproduct: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!components || components.length === 0) {
    throw new Error(
      `No active components found for combo product ${comboProductId}`
    );
  }

  logger.info(
    {
      comboProductId,
      componentCount: components.length,
      components: components.map((c: any) => ({
        componentproductid: c.componentproductid,
        requiredqty: c.requiredqty,
        productname: c.componentproduct?.name,
      })),
    },
    "Retrieved combo components for stock locking"
  );

  // Step 2: Validate ALL components have enough stock
  const validationErrors: string[] = [];
  const componentStockInfo: Array<{
    componentproductid: number;
    requiredqty: number;
    totalNeeded: number;
    available: number;
    lockqty: number;
  }> = [];

  for (const component of components) {
    const componentProductId = Number(component.componentproductid);
    const requiredQty = component.requiredqty || 1;
    const totalNeeded = requiredQty * comboQuantity;

    // Use SELECT FOR UPDATE to acquire row lock (prevents race conditions)
    const platformStockResult = await tx.$queryRaw<Array<{
      id: bigint;
      productid: bigint;
      platform: string;
      availableqty: number;
      lockqty: number;
      orderedqty: number;
    }>>`
      SELECT * FROM "platformstock"
      WHERE "productid" = ${BigInt(componentProductId)}
        AND "platform" = ${PLATFORM_NAME}
      FOR UPDATE
    `;

    if (!platformStockResult || platformStockResult.length === 0) {
      validationErrors.push(
        `PlatformStock not found for component ${componentProductId} (${component.componentproduct?.name || "Unknown"})`
      );
      continue;
    }

    const platformStock = platformStockResult[0];
    const currentAvailableQty = Number(platformStock.availableqty) || 0;
    const currentLockQty = Number(platformStock.lockqty) || 0;
    const actualAvailable = currentAvailableQty - currentLockQty;

    componentStockInfo.push({
      componentproductid: componentProductId,
      requiredqty: requiredQty,
      totalNeeded: totalNeeded,
      available: actualAvailable,
      lockqty: currentLockQty,
    });

    // Validate availability
    if (actualAvailable < totalNeeded) {
      validationErrors.push(
        `Insufficient stock for component ${componentProductId} (${component.componentproduct?.name || "Unknown"}). ` +
        `Need ${totalNeeded} units (${requiredQty} per combo × ${comboQuantity} combos), ` +
        `but only ${actualAvailable} available (${currentAvailableQty} total - ${currentLockQty} locked)`
      );
    }
  }

  // If any component fails validation, throw error (rollback transaction)
  if (validationErrors.length > 0) {
    logger.error(
      {
        comboProductId,
        comboQuantity,
        validationErrors,
        componentStockInfo,
      },
      "Combo component stock validation failed"
    );

    throw new ValidationError(
      `Insufficient stock for combo product ${comboProductId}. ` +
      `Components with insufficient stock: ${validationErrors.join("; ")}`,
      "INSUFFICIENT_COMBO_STOCK",
      {
        comboProductId,
        comboQuantity,
        validationErrors,
        componentStockInfo,
      }
    );
  }

  // Step 3: Lock ALL components atomically (already in transaction)
  const lockResults: Array<{
    componentproductid: number;
    productname: string;
    requiredqty: number;
    totalNeeded: number;
    before: { availableqty: number; lockqty: number };
    after: { availableqty: number; lockqty: number };
  }> = [];

  for (const component of components) {
    const componentProductId = Number(component.componentproductid);
    const requiredQty = component.requiredqty || 1;
    const totalNeeded = requiredQty * comboQuantity;

    // Get platform stock (already locked by SELECT FOR UPDATE above)
    const platformStockResult = await tx.$queryRaw<Array<{
      id: bigint;
      productid: bigint;
      platform: string;
      availableqty: number;
      lockqty: number;
      orderedqty: number;
    }>>`
      SELECT * FROM "platformstock"
      WHERE "productid" = ${BigInt(componentProductId)}
        AND "platform" = ${PLATFORM_NAME}
      FOR UPDATE
    `;

    const platformStock = platformStockResult[0];
    const currentAvailableQty = Number(platformStock.availableqty) || 0;
    const currentLockQty = Number(platformStock.lockqty) || 0;

    // Calculate new quantities
    const newAvailableQty = Math.max(0, currentAvailableQty - totalNeeded);
    const newLockQty = currentLockQty + totalNeeded;

    // Update platformstock
    await tx.platformStock.update({
      where: {
        productid_platform: {
          productid: BigInt(componentProductId),
          platform: PLATFORM_NAME,
        },
      },
      data: {
        availableqty: newAvailableQty,
        lockqty: newLockQty,
        modifieddate: BigInt(Date.now()),
      },
    });

    lockResults.push({
      componentproductid: componentProductId,
      productname: component.componentproduct?.name || "Unknown",
      requiredqty: requiredQty,
      totalNeeded: totalNeeded,
      before: {
        availableqty: currentAvailableQty,
        lockqty: currentLockQty,
      },
      after: {
        availableqty: newAvailableQty,
        lockqty: newLockQty,
      },
    });

    logger.info(
      {
        comboProductId,
        componentProductId,
        componentName: component.componentproduct?.name,
        requiredQty,
        comboQuantity,
        totalNeeded,
        before: {
          availableqty: currentAvailableQty,
          lockqty: currentLockQty,
        },
        after: {
          availableqty: newAvailableQty,
          lockqty: newLockQty,
        },
      },
      "Locked stock for combo component"
    );
  }

  logger.info(
    {
      comboProductId,
      comboQuantity,
      componentsLocked: lockResults.length,
      lockResults,
    },
    "Successfully locked stock for all combo components"
  );

  // Return lock results for response (optional)
  return lockResults;
}
```

---

### Step 3: Update Stock Locking Transaction

**Location:** `src/controllers/phonepe.controller.ts` - Lines 509-685

**Changes:**
```typescript
// Inside prisma.$transaction(async (tx) => { ... })
for (const orderItem of requestBody.order) {
  const productId = orderItem.productid;
  const requestedQuantity = orderItem.quantity;

  // ✅ NEW: Check if product is combo
  const product = await tx.product.findUnique({
    where: { id: BigInt(productId) },
    select: {
      id: true,
      iscombo: true,
      name: true,
    },
  });

  if (!product) {
    throw new Error(`Product ${productId} not found`);
  }

  if (product.iscombo) {
    // ✅ COMBO LOGIC: Lock all components
    await this.lockComboComponents(tx, productId, requestedQuantity, orderItem);
    
    // Add to stock locking results (for response)
    stockLockingResults.push({
      productId: productId,
      productName: product.name,
      productType: "combo",
      quantity: requestedQuantity,
      note: `Combo product - locked ${components.length} components`,
      components: lockResults, // From lockComboComponents return
    });
  } else {
    // ✅ SINGLE PRODUCT: Existing logic (no changes)
    // ... existing single product locking code ...
  }
}
```

---

## 💳 PHASE 2: PhonePe Callback - Combo Pack Lock to Order Conversion

### Current Single Product Logic (Reference)

**Location:** `src/controllers/phonepe.controller.ts` - `updateProductQuantitiesAfterOrder()` (Lines 3801-4358)

**Current Flow:**
```typescript
// For each order item:
1. Get platformstock (already locked during initiate)
2. Convert lock to order:
   - availableqty: NO CHANGE (already reduced)
   - lockqty: DECREASE (unlock)
   - orderedqty: INCREASE
3. Update product table:
   - availablequantity: DECREASE
   - orderedquantity: INCREASE
```

### New Combo Pack Logic (To Implement)

**Location:** `src/controllers/phonepe.controller.ts` - `updateProductQuantitiesAfterOrder()` method

**Flow:**
```typescript
// For each order item:
1. Check if product.iscombo === true
2. IF COMBO:
   a. Get all components from productbundlemap
   b. Convert ALL component locks to orders
   c. Update ALL component Product quantities
   d. Combo product itself: NO UPDATES (virtual product)
3. IF SINGLE PRODUCT:
   a. Use existing logic (no changes)
```

---

## 📝 Implementation Details: PhonePe Callback

### Step 1: Detect Combo Product in Callback

**Location:** `src/controllers/phonepe.controller.ts` - `updateProductQuantitiesAfterOrder()` - Around line 3850

**Code:**
```typescript
for (const orderItem of originalOrderItems) {
  const productId = orderItem.productid;
  const requestedQuantity = orderItem.quantity || 1;

  // ✅ NEW: Check if product is combo
  const product = await prisma.product.findUnique({
    where: { id: BigInt(productId) },
    select: {
      id: true,
      iscombo: true,
      name: true,
    },
  });

  if (!product) {
    logger.warn(
      {
        orderId: orderData.id,
        productId: productId,
      },
      "Product not found for quantity update"
    );
    updateResults.push({
      productId: productId,
      success: false,
      error: "Product not found",
    });
    continue;
  }

  if (product.iscombo) {
    // ✅ COMBO LOGIC: Convert component locks to orders
    await this.convertComboLocksToOrders(
      productId,
      requestedQuantity,
      orderItem,
      orderData,
      updateResults
    );
  } else {
    // ✅ SINGLE PRODUCT: Existing logic (no changes)
    // ... existing single product conversion code ...
  }
}
```

---

### Step 2: Create `convertComboLocksToOrders()` Function

**Location:** `src/controllers/phonepe.controller.ts` - Add as private method

**Function Signature:**
```typescript
/**
 * Convert locked stock to ordered stock for all components of a combo product
 * @param comboProductId - Combo product ID
 * @param comboQuantity - Number of combo packs ordered
 * @param orderItem - Original order item (for logging)
 * @param orderData - Order data (for logging)
 * @param updateResults - Array to push results to
 */
private async convertComboLocksToOrders(
  comboProductId: number,
  comboQuantity: number,
  orderItem: any,
  orderData: any,
  updateResults: any[]
): Promise<void>
```

**Implementation:**
```typescript
private async convertComboLocksToOrders(
  comboProductId: number,
  comboQuantity: number,
  orderItem: any,
  orderData: any,
  updateResults: any[]
): Promise<void> {
  const PLATFORM_NAME = "nivapp";

  try {
    logger.info(
      {
        orderId: orderData.id,
        comboProductId,
        comboQuantity,
        orderItem: {
          productid: orderItem.productid,
          productname: orderItem.productname,
          quantity: orderItem.quantity,
        },
      },
      "Starting combo component lock-to-order conversion"
    );

    // Step 1: Get all active components for this combo
    const components = await prisma.productBundleMap.findMany({
      where: {
        bundleproductid: BigInt(comboProductId),
        isactive: true,
      },
      include: {
        componentproduct: {
          select: {
            id: true,
            name: true,
            orderedquantity: true,
            availablequantity: true,
          },
        },
      },
    });

    if (!components || components.length === 0) {
      throw new Error(
        `No active components found for combo product ${comboProductId}`
      );
    }

    logger.info(
      {
        orderId: orderData.id,
        comboProductId,
        componentCount: components.length,
        components: components.map((c: any) => ({
          componentproductid: c.componentproductid,
          requiredqty: c.requiredqty,
          productname: c.componentproduct?.name,
        })),
      },
      "Retrieved combo components for lock-to-order conversion"
    );

    const componentUpdateResults: Array<{
      componentproductid: number;
      productname: string;
      requiredqty: number;
      totalNeeded: number;
      success: boolean;
      error?: string;
      platformUpdate?: any;
      productUpdate?: any;
    }> = [];

    // Step 2: Convert ALL component locks to orders
    for (const component of components) {
      try {
        const componentProductId = Number(component.componentproductid);
        const requiredQty = component.requiredqty || 1;
        const totalNeeded = requiredQty * comboQuantity;

        // Get platform stock (already locked during initiate)
        const platformStock = await prisma.platformStock.findUnique({
          where: {
            productid_platform: {
              productid: BigInt(componentProductId),
              platform: PLATFORM_NAME,
            },
          },
          select: {
            id: true,
            availableqty: true,
            lockqty: true,
            orderedqty: true,
            soldqty: true,
            platformstatus: true,
          },
        });

        if (!platformStock) {
          throw new Error(
            `PlatformStock not found for component ${componentProductId}`
          );
        }

        const currentAvailableQty = platformStock.availableqty || 0;
        const currentLockQty = platformStock.lockqty || 0;
        const currentOrderedQty = platformStock.orderedqty || 0;

        // Calculate quantity to convert (minimum of locked qty and needed qty)
        const quantityToConvert = Math.min(totalNeeded, currentLockQty);

        // Warn if trying to unlock more than locked
        if (totalNeeded > currentLockQty) {
          logger.warn(
            {
              orderId: orderData.id,
              componentProductId,
              totalNeeded,
              currentLockQty,
              quantityToConvert,
              warning:
                "Requested quantity exceeds locked quantity - using locked quantity only",
            },
            "Lock quantity mismatch detected for combo component"
          );
        }

        // Calculate new quantities
        // availableqty: NO CHANGE (already reduced during locking)
        const newPlatformAvailableQty = Math.max(0, currentAvailableQty);
        // lockqty: DECREASE (unlock - convert to order)
        const newPlatformLockQty = Math.max(0, currentLockQty - quantityToConvert);
        // orderedqty: INCREASE (confirm order)
        const newPlatformOrderedQty = currentOrderedQty + quantityToConvert;

        // Determine platform status
        let newPlatformStatus: string;
        if (newPlatformAvailableQty <= 0) {
          newPlatformStatus = "out_of_stock";
        } else if (newPlatformAvailableQty >= 1 && newPlatformAvailableQty <= 5) {
          newPlatformStatus = "low_stock";
        } else {
          newPlatformStatus = "in_stock";
        }

        // Update platformstock
        const updatedPlatformStock = await prisma.platformStock.update({
          where: {
            productid_platform: {
              productid: BigInt(componentProductId),
              platform: PLATFORM_NAME,
            },
          },
          data: {
            availableqty: newPlatformAvailableQty,
            lockqty: newPlatformLockQty,
            orderedqty: newPlatformOrderedQty,
            platformstatus: newPlatformStatus,
            modifieddate: BigInt(Date.now()),
          },
        });

        logger.info(
          {
            orderId: orderData.id,
            componentProductId,
            componentName: component.componentproduct?.name,
            beforePlatformUpdate: {
              availableqty: currentAvailableQty,
              lockqty: currentLockQty,
              orderedqty: currentOrderedQty,
            },
            afterPlatformUpdate: {
              availableqty: newPlatformAvailableQty,
              lockqty: newPlatformLockQty,
              orderedqty: newPlatformOrderedQty,
              platformstatus: newPlatformStatus,
            },
            quantityToConvert,
          },
          "Converted combo component lock to order (PlatformStock)"
        );

        // Step 3: Update component Product table
        const componentProduct = component.componentproduct;
        if (!componentProduct) {
          throw new Error(
            `Component product ${componentProductId} not found`
          );
        }

        const currentProductOrderedQuantity = componentProduct.orderedquantity || 0;
        const currentProductAvailableQuantity = componentProduct.availablequantity || 0;

        // Update product quantities
        const newProductOrderedQuantity = currentProductOrderedQuantity + quantityToConvert;
        const newProductAvailableQuantity = Math.max(
          0,
          currentProductAvailableQuantity - quantityToConvert
        );

        // Determine product status
        let newProductStatus: string;
        if (newProductAvailableQuantity <= 0) {
          newProductStatus = "out_of_stock";
        } else if (
          newProductAvailableQuantity >= 1 &&
          newProductAvailableQuantity <= 5
        ) {
          newProductStatus = "low_stock";
        } else {
          newProductStatus = "in_stock";
        }

        const updatedProduct = await prisma.product.update({
          where: { id: BigInt(componentProductId) },
          data: {
            orderedquantity: newProductOrderedQuantity,
            availablequantity: newProductAvailableQuantity,
            productstatus: newProductStatus,
            modifieddate: BigInt(Date.now()),
          },
        });

        logger.info(
          {
            orderId: orderData.id,
            componentProductId,
            componentName: componentProduct.name,
            beforeProductUpdate: {
              orderedquantity: currentProductOrderedQuantity,
              availablequantity: currentProductAvailableQuantity,
            },
            afterProductUpdate: {
              orderedquantity: newProductOrderedQuantity,
              availablequantity: newProductAvailableQuantity,
              productstatus: newProductStatus,
            },
            quantityToConvert,
          },
          "Updated combo component product quantities"
        );

        componentUpdateResults.push({
          componentproductid: componentProductId,
          productname: componentProduct.name,
          requiredqty: requiredQty,
          totalNeeded: totalNeeded,
          success: true,
          platformUpdate: {
            before: {
              availableqty: currentAvailableQty,
              lockqty: currentLockQty,
              orderedqty: currentOrderedQty,
            },
            after: {
              availableqty: newPlatformAvailableQty,
              lockqty: newPlatformLockQty,
              orderedqty: newPlatformOrderedQty,
              platformstatus: newPlatformStatus,
            },
          },
          productUpdate: {
            before: {
              orderedquantity: currentProductOrderedQuantity,
              availablequantity: currentProductAvailableQuantity,
            },
            after: {
              orderedquantity: newProductOrderedQuantity,
              availablequantity: newProductAvailableQuantity,
              productstatus: newProductStatus,
            },
          },
        });
      } catch (componentError: any) {
        logger.error(
          {
            orderId: orderData.id,
            comboProductId,
            componentProductId: component.componentproductid,
            error: componentError.message,
            stack: componentError.stack,
          },
          "Error converting combo component lock to order"
        );

        componentUpdateResults.push({
          componentproductid: Number(component.componentproductid),
          productname: component.componentproduct?.name || "Unknown",
          requiredqty: component.requiredqty || 1,
          totalNeeded: (component.requiredqty || 1) * comboQuantity,
          success: false,
          error: componentError.message,
        });
      }
    }

    // Step 4: Add combo result to updateResults
    const successfulComponents = componentUpdateResults.filter((r) => r.success);
    const failedComponents = componentUpdateResults.filter((r) => !r.success);

    updateResults.push({
      productId: comboProductId,
      productName: orderItem.productname || "Combo Product",
      productType: "combo",
      success: failedComponents.length === 0, // Success if all components succeeded
      comboQuantity: comboQuantity,
      componentCount: components.length,
      successfulComponents: successfulComponents.length,
      failedComponents: failedComponents.length,
      componentUpdateResults: componentUpdateResults,
      note: failedComponents.length > 0
        ? `Some components failed: ${failedComponents.map((f) => f.error).join("; ")}`
        : "All components converted successfully",
    });

    logger.info(
      {
        orderId: orderData.id,
        comboProductId,
        comboQuantity,
        componentCount: components.length,
        successfulComponents: successfulComponents.length,
        failedComponents: failedComponents.length,
      },
      "Completed combo component lock-to-order conversion"
    );
  } catch (error: any) {
    logger.error(
      {
        orderId: orderData.id,
        comboProductId,
        error: error.message,
        stack: error.stack,
      },
      "Error in combo component lock-to-order conversion"
    );

    updateResults.push({
      productId: comboProductId,
      productName: orderItem.productname || "Combo Product",
      productType: "combo",
      success: false,
      error: error.message,
    });
  }
}
```

---

## 🔄 Complete Flow Summary

### PhonePe Initiate Flow (Combo Pack)

```
User orders 2 combo packs (Vanilla + Sandal Combo)
  │
  ▼
POST /v1/phonepe/initiate
  │
  ▼
1. Validate Promotions ✅
  │
  ▼
2. Validate Products & Stock ✅
  │
  ▼
3. Lock Stock (Transaction)
  │
  ├─► Check: product.iscombo === true?
  │
  ├─► YES (Combo):
  │   ├─► Get components from productbundlemap
  │   ├─► Validate ALL components have enough stock
  │   │   ├─► Vanilla: Need 1 × 2 = 2 units ✅
  │   │   └─► Sandal: Need 1 × 2 = 2 units ✅
  │   │
  │   └─► Lock ALL components atomically:
  │       ├─► Vanilla PlatformStock:
  │       │   ├─► availableqty: 5 - 2 = 3 ✅
  │       │   └─► lockqty: 0 + 2 = 2 ✅
  │       │
  │       └─► Sandal PlatformStock:
  │           ├─► availableqty: 1 - 2 = -1 ❌ (Error: Insufficient stock)
  │           └─► OR: availableqty: 3 - 2 = 1 ✅, lockqty: 0 + 2 = 2 ✅
  │
  └─► NO (Single Product):
      └─► Use existing logic (no changes)
  │
  ▼
4. Create Transaction Record ✅
  │
  ▼
5. Call PhonePe API / Create COD Order ✅
  │
  ▼
6. Return Response ✅
```

### PhonePe Callback Flow (Combo Pack)

```
Payment Success → POST /v1/phonepe/callback/:transactionId
  │
  ▼
1. Check Payment Status ✅
  │
  ▼
2. Create Order ✅
  │
  ▼
3. Update Product Quantities
  │
  ├─► For each orderline:
  │   │
  │   ├─► Check: product.iscombo === true?
  │   │
  │   ├─► YES (Combo):
  │   │   ├─► Get components from productbundlemap
  │   │   ├─► Convert ALL component locks to orders:
  │   │   │   ├─► Vanilla PlatformStock:
  │   │   │   │   ├─► availableqty: 3 (NO CHANGE) ✅
  │   │   │   │   ├─► lockqty: 2 - 2 = 0 ✅
  │   │   │   │   └─► orderedqty: 0 + 2 = 2 ✅
  │   │   │   │
  │   │   │   └─► Sandal PlatformStock:
  │   │   │       ├─► availableqty: 1 (NO CHANGE) ✅
  │   │   │       ├─► lockqty: 2 - 2 = 0 ✅
  │   │   │       └─► orderedqty: 0 + 2 = 2 ✅
  │   │   │
  │   │   ├─► Update ALL component Product tables:
  │   │   │   ├─► Vanilla Product:
  │   │   │   │   ├─► availablequantity: 10 - 2 = 8 ✅
  │   │   │   │   └─► orderedquantity: 0 + 2 = 2 ✅
  │   │   │   │
  │   │   │   └─► Sandal Product:
  │   │   │       ├─► availablequantity: 5 - 2 = 3 ✅
  │   │   │       └─► orderedquantity: 0 + 2 = 2 ✅
  │   │   │
  │   │   └─► Combo Product: NO UPDATES (virtual product) ✅
  │   │
  │   └─► NO (Single Product):
  │       └─► Use existing logic (no changes)
  │
  ▼
4. Redirect to Success Page ✅
```

---

## ✅ Implementation Checklist

### Phase 1: PhonePe Initiate

- [ ] Add `lockComboComponents()` private method to `PhonePeController`
- [ ] Update stock locking transaction to detect combo products
- [ ] Add combo product validation (check components exist)
- [ ] Add component stock validation (check all components have enough stock)
- [ ] Add atomic component stock locking (all components in one transaction)
- [ ] Update stock locking results to include combo component details
- [ ] Add error handling for combo-specific errors
- [ ] Update response to show combo component locking details

### Phase 2: PhonePe Callback

- [ ] Add `convertComboLocksToOrders()` private method to `PhonePeController`
- [ ] Update `updateProductQuantitiesAfterOrder()` to detect combo products
- [ ] Add component lock-to-order conversion (all components)
- [ ] Add component Product table updates (all components)
- [ ] Ensure combo product itself is NOT updated (virtual product)
- [ ] Add error handling for component conversion failures
- [ ] Update response to show combo component conversion details

### Testing

- [ ] Test combo pack initiate with sufficient stock
- [ ] Test combo pack initiate with insufficient stock (one component)
- [ ] Test combo pack initiate with insufficient stock (all components)
- [ ] Test combo pack callback with successful payment
- [ ] Test combo pack callback with failed payment (locks should remain)
- [ ] Test mixed order (combo + single products)
- [ ] Test multiple combo packs in one order
- [ ] Test combo pack with different `requiredqty` values

---

## 🎯 Key Points

1. **Combo products are virtual** - No physical stock, no PlatformStock record
2. **Components are real products** - All stock operations happen on components
3. **All operations are atomic** - Lock/Order ALL components together (transaction)
4. **Single product logic unchanged** - Combo logic is separate code path
5. **Error handling** - If ANY component fails, entire operation fails (rollback)
6. **Calculation formula** - `totalNeeded = component.requiredqty × comboQuantity`

## ⚠️ CRITICAL CLARIFICATION: Lock Quantity Calculation

**When `order.quantity = 2` (ordering 2 combo packs):**

For **EACH component** (Product 40 and Product 47):
- `lockqty` increases by **2** (same as single product!)
- `availableqty` decreases by **2** (same as single product!)

**Formula:**
```typescript
// If component.requiredqty = 1 (most common):
lockqty += order.quantity    // ✅ SAME as single product!
availableqty -= order.quantity

// If component.requiredqty = 2 (less common):
lockqty += (component.requiredqty × order.quantity)
availableqty -= (component.requiredqty × order.quantity)
```

**Example from your scenarios:**
- Combo ID: 85
- Components: Product 47 (requiredqty: 1), Product 40 (requiredqty: 1)
- User orders: `order.quantity = 2`
- **Result:**
  - Product 47: `lockqty += 2` ✅
  - Product 40: `lockqty += 2` ✅
  - **This is EXACTLY the same as if Product 47 and Product 40 were ordered separately with quantity 2!**

---

## 📊 Examples: Real-World Scenarios

### Example 1: Order 2 Combo Packs (Combo ID: 85)

**Combo Components:**
- Product 47 (Spiritual Harmony): `requiredqty: 1`
- Product 40 (Kasturi): `requiredqty: 1`

**Initial Stock State:**
```
Product 47 PlatformStock:
  availableqty: 28
  lockqty: 0
  orderedqty: 74

Product 40 PlatformStock:
  availableqty: 14
  lockqty: 0
  orderedqty: 52
```

**User Orders:** `order.quantity = 2` (2 combo packs)

**After Initiate (Stock Locking):**
```
Product 47 PlatformStock:
  availableqty: 28 - 2 = 26    ✅ DECREASED by 2
  lockqty: 0 + 2 = 2           ✅ INCREASED by 2 (same as single product!)
  orderedqty: 74               ➡️ NO CHANGE

Product 40 PlatformStock:
  availableqty: 14 - 2 = 12    ✅ DECREASED by 2
  lockqty: 0 + 2 = 2           ✅ INCREASED by 2 (same as single product!)
  orderedqty: 52               ➡️ NO CHANGE
```

**After Callback (Payment Success):**
```
Product 47 PlatformStock:
  availableqty: 26              ➡️ NO CHANGE (already reduced)
  lockqty: 2 - 2 = 0            ✅ DECREASED (unlocked)
  orderedqty: 74 + 2 = 76      ✅ INCREASED by 2

Product 47 Product:
  availablequantity: 100 - 2 = 98   ✅ DECREASED by 2
  orderedquantity: 50 + 2 = 52      ✅ INCREASED by 2

Product 40 PlatformStock:
  availableqty: 12              ➡️ NO CHANGE (already reduced)
  lockqty: 2 - 2 = 0            ✅ DECREASED (unlocked)
  orderedqty: 52 + 2 = 54      ✅ INCREASED by 2

Product 40 Product:
  availablequantity: 80 - 2 = 78   ✅ DECREASED by 2
  orderedquantity: 30 + 2 = 32     ✅ INCREASED by 2
```

**Key Point:** ✅ `lockqty` increases by `order.quantity` (2) for EACH component - **SAME as single product logic!**

---

### Example 2: Order 3 Combo Packs (With Existing Locks)

**Initial Stock State:**
```
Product 47 PlatformStock:
  availableqty: 10
  lockqty: 0
  orderedqty: 74

Product 40 PlatformStock:
  availableqty: 5
  lockqty: 2          ← Already locked by another order
  orderedqty: 52
```

**Availability Check:**
- Product 47: `availableqty - lockqty = 10 - 0 = 10` → Can make 10 combos
- Product 40: `availableqty - lockqty = 5 - 2 = 3` → Can make 3 combos
- **Max combos = MIN(10, 3) = 3 combos** ✅

**User Orders:** `order.quantity = 3` (3 combo packs)

**After Initiate (Stock Locking):**
```
Product 47 PlatformStock:
  availableqty: 10 - 3 = 7      ✅ DECREASED by 3
  lockqty: 0 + 3 = 3            ✅ INCREASED by 3
  orderedqty: 74                ➡️ NO CHANGE

Product 40 PlatformStock:
  availableqty: 5 - 3 = 2       ✅ DECREASED by 3
  lockqty: 2 + 3 = 5            ✅ INCREASED by 3 (added to existing lock)
  orderedqty: 52                ➡️ NO CHANGE
```

**Key Point:** ✅ `lockqty` increases by `order.quantity` (3) - **SAME as single product logic!**

---

### Example 3: Cannot Order (Insufficient Stock)

**Initial Stock State:**
```
Product 47 PlatformStock:
  availableqty: 10
  lockqty: 0
  orderedqty: 74

Product 40 PlatformStock:
  availableqty: 5
  lockqty: 5          ← All stock is locked
  orderedqty: 52
```

**Availability Check:**
- Product 47: `availableqty - lockqty = 10 - 0 = 10` → Can make 10 combos
- Product 40: `availableqty - lockqty = 5 - 5 = 0` → Can make 0 combos
- **Max combos = MIN(10, 0) = 0 combos** ❌

**User Tries to Order:** `order.quantity = 1` (1 combo pack)

**Result:** ❌ **ERROR - Insufficient stock**
```
Error: Insufficient stock for combo product 85.
Components with insufficient stock: 
  Product 40 (Kasturi). Need 1 units (1 per combo × 1 combos), 
  but only 0 available (5 total - 5 locked)
```

---

## 🎯 Key Calculation Formula

**For Combo Products:**
```typescript
// When user orders order.quantity combo packs:
for each component:
  totalNeeded = component.requiredqty × order.quantity
  
  // Lock stock (same as single product):
  lockqty += totalNeeded
  availableqty -= totalNeeded
  
  // If requiredqty = 1 (most common case):
  lockqty += order.quantity    // ✅ SAME as single product!
  availableqty -= order.quantity
```

**Example:**
- Combo: Product 47 (requiredqty: 1) + Product 40 (requiredqty: 1)
- User orders: `order.quantity = 2`
- Product 47: `lockqty += 2` ✅ (same as single product with quantity 2)
- Product 40: `lockqty += 2` ✅ (same as single product with quantity 2)

**This is EXACTLY the same as single product logic!** ✅

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-15  
**Status:** Ready for Implementation

