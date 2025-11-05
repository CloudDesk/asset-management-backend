# 🐛 PhonePe Orderline Discount Bug - Deep Analysis & Fix

**Issue ID**: PHONEPE-ORDERLINE-001  
**Date**: November 5, 2025  
**Severity**: HIGH  
**Status**: Root Cause Identified - Fix Provided

---

## 📋 Executive Summary

**Problem**: Order-level discount fields (`discountamount`, `promotion_discount_total`, `shipping_cost`) are correctly populated, but orderline records have `product_discount_amount`, `promotion_discount_amount`, and `shipping_cost` set to 0.

**Root Cause**: The `createOrderlinesFromOrderItems` method in OrdersService (lines 374-427) does NOT include promotion/discount fields when creating orderline records. It only maps basic fields from the `originalPayload.order` data.

**Impact**: 
- Orderline-level reporting is inaccurate
- Cannot track per-product discounts or promotions
- Refund calculations at orderline level will be incorrect
- Analytics and dashboards show incorrect product-level discount data

---

## 🔍 Investigation Results

### 1. Code Flow Mapping

#### Payment Success Callback Flow
```
PhonePe Callback (phonepe.route.ts:483-889)
    ↓
phonePeController.createOrderAfterPayment() (phonepe.controller.ts:1982-2783)
    ├── Fetch transaction data
    ├── Fetch evaluationData (includes cart_data & applied_promotions)
    ├── Calculate order-level totals:
    │   ├── originalTotal
    │   ├── productDiscountTotal
    │   ├── promotionDiscountTotal
    │   ├── shippingCost
    │   └── taxAmount
    ├── Build orderData with all fields
    └── Call ordersService.create(orderData)
        ↓
OrdersService.create() (orders.service.ts:98-185)
    ├── Create order record (✅ order-level discounts saved)
    └── Call createOrderlinesFromOrderItems() (line 139)
        ↓
createOrderlinesFromOrderItems() (orders.service.ts:374-427)
    └── ❌ BUG: Does NOT map discount fields to orderlines
```

### 2. Exact Bug Location

**File**: `src/services/orders.service.ts`  
**Method**: `createOrderlinesFromOrderItems`  
**Lines**: 374-427

**Current Code** (BUGGY):
```typescript
async createOrderlinesFromOrderItems(
  orderId: number,
  orderItems: any[],
  orderidString: string,
  currentTime: number
) {
  const orderlines = [];
  
  for (let i = 0; i < orderItems.length; i++) {
    const orderItem = orderItems[i];
    
    const orderlineData = {
      orderid: orderId,
      productid: orderItem.productid,
      userid: parseInt(orderItem.userid?.toString() || '0') || null,
      addressid: parseInt(orderItem.addressid?.toString() || '0') || null,
      productamount: parseFloat(orderItem.productamount?.toString() || '0') || null,
      discountamount: parseFloat(orderItem.discountamount?.toString() || '0') || null,
      orderamount: parseFloat(orderItem.orderamount?.toString() || '0') || null,
      quantity: parseInt(orderItem.quantity?.toString() || '1') || 1,
      productname: orderItem.productname || null,
      productcategory: orderItem.productcategory || null,
      orderstatus: 'payment_completed',
      uniqueordderid: orderidString,
      createddate: currentTime,
      modifieddate: currentTime,
      ordereddate: currentTime
      // ❌ MISSING: product_discount_amount
      // ❌ MISSING: promotion_discount_amount  
      // ❌ MISSING: shipping_cost
      // ❌ MISSING: original_price
      // ❌ MISSING: evaluation_id
    };

    try {
      const orderline = await dynamicCreate('orderline', orderlineData);
      orderlines.push(orderline);
    } catch (error) {
      logger.error({ error, orderItem }, 'Failed to create orderline');
      throw error;
    }
  }

  return orderlines;
}
```

### 3. Why originalPayload.order Doesn't Have Discount Breakdowns

**Data Source**: `transaction.transactiondata.originalPayload.order`

This is the raw order data sent from the **frontend** during payment initiation. It contains:
- `productid`, `productamount`, `quantity`, `discountamount`, `orderamount`
- But NOT per-line breakdown of: `product_discount_amount`, `promotion_discount_amount`, `shipping_cost`

**Why?**: These detailed discount breakdowns are calculated **server-side** during promotion evaluation and stored in `evaluationData.cart_data` and `evaluationData.applied_promotions`.

### 4. Data Available But Not Used

In `phonepe.controller.ts:createOrderAfterPayment()`, the following data IS available:

1. **Order-level totals** (lines 2126-2252):
   - `promotionDiscountTotal` - Total promotion discounts
   - `productDiscountTotal` - Total product discounts
   - `shippingCost` - Total shipping cost
   - `originalTotal` - Original cart total

2. **Evaluation Data** (lines 2126-2252):
   - `evaluationData.cart_data` - Contains per-product discount info
   - `evaluationData.applied_promotions` - Contains promotion breakdown by product

3. **Original Order Items** (line 2107):
   - `originalOrderData` - Basic order item data from frontend

**Problem**: This rich discount data is NOT being distributed/mapped to individual orderlines.

---

## 💡 Solution Design

### Approach: Pro-Rata Distribution with EvaluationData Enhancement

We need to:
1. **Enhance orderItems** in PhonePe controller with per-line discount data from evaluationData
2. **Update createOrderlinesFromOrderItems** to accept and save these fields
3. **Add fallback pro-rata distribution** when evaluationData is not available

### Solution Components

#### Component 1: Enhance orderItems in PhonePe Controller

**Location**: `phonepe.controller.ts:createOrderAfterPayment()` - Before calling `ordersService.create()`

Add logic to enrich `orderItems` with per-line discount data:

```typescript
// After line 2252 - enrich orderItems with discount data
const enrichedOrderItems = originalOrderData
  .filter((item: any) => validProductIds.includes(item.productid))
  .map((item: any) => {
    const productId = item.productid;
    const quantity = parseInt(item.quantity?.toString() || '1');
    
    // Get per-product discount data from evaluation
    let productDiscountAmount = 0;
    let promotionDiscountAmount = 0;
    let originalPrice = parseFloat(item.productamount?.toString() || '0');
    
    if (evaluationData) {
      // Get from evaluation cart_data
      const cartItem = (evaluationData.cart_data as any[])?.find(
        (ci: any) => parseInt(ci.product_id?.toString()) === productId
      );
      
      if (cartItem) {
        originalPrice = parseFloat(cartItem.base_price?.toString() || '0') * quantity;
        productDiscountAmount = parseFloat(cartItem.product_discount?.toString() || '0') * quantity;
      }
      
      // Get from applied promotions breakdown
      const appliedPromotions = (evaluationData.applied_promotions as any[]) || [];
      for (const promo of appliedPromotions) {
        if (promo.breakdown && Array.isArray(promo.breakdown)) {
          const promoItem = promo.breakdown.find(
            (b: any) => parseInt(b.product_id?.toString()) === productId
          );
          if (promoItem) {
            promotionDiscountAmount += parseFloat(promoItem.total_discount?.toString() || '0');
          }
        }
      }
    }
    
    // Calculate pro-rata shipping cost
    const productAmountTotal = originalOrderData.reduce(
      (sum: number, i: any) => sum + parseFloat(i.productamount?.toString() || '0'),
      0
    );
    const shippingCostForItem = productAmountTotal > 0
      ? (shippingCost * parseFloat(item.productamount?.toString() || '0')) / productAmountTotal
      : 0;
    
    return {
      ...item,
      original_price: originalPrice,
      product_discount_amount: productDiscountAmount,
      promotion_discount_amount: promotionDiscountAmount,
      shipping_cost: shippingCostForItem,
      evaluation_id: primaryEvaluationId
    };
  });
```

**Then update orderData.orderItems** (line 2305):
```typescript
orderItems: enrichedOrderItems  // Use enriched items instead of filtered items
```

#### Component 2: Update createOrderlinesFromOrderItems

**Location**: `orders.service.ts:374-427`

**Updated Method**:
```typescript
async createOrderlinesFromOrderItems(
  orderId: number,
  orderItems: any[],
  orderidString: string,
  currentTime: number
) {
  const orderlines = [];
  
  logger.info({
    orderId,
    orderItemsCount: orderItems.length,
    sampleOrderItem: orderItems[0] ? {
      productid: orderItems[0].productid,
      hasOriginalPrice: 'original_price' in orderItems[0],
      hasProductDiscount: 'product_discount_amount' in orderItems[0],
      hasPromotionDiscount: 'promotion_discount_amount' in orderItems[0],
      hasShippingCost: 'shipping_cost' in orderItems[0]
    } : null
  }, 'Creating orderlines from enriched order items');
  
  for (let i = 0; i < orderItems.length; i++) {
    const orderItem = orderItems[i];
    
    const orderlineData = {
      orderid: orderId,
      productid: orderItem.productid,
      userid: parseInt(orderItem.userid?.toString() || '0') || null,
      addressid: parseInt(orderItem.addressid?.toString() || '0') || null,
      productamount: parseFloat(orderItem.productamount?.toString() || '0') || null,
      discountamount: parseFloat(orderItem.discountamount?.toString() || '0') || null,
      orderamount: parseFloat(orderItem.orderamount?.toString() || '0') || null,
      quantity: parseInt(orderItem.quantity?.toString() || '1') || 1,
      productname: orderItem.productname || null,
      productcategory: orderItem.productcategory || null,
      orderstatus: 'payment_completed',
      uniqueordderid: orderidString,
      createddate: currentTime,
      modifieddate: currentTime,
      ordereddate: currentTime,
      // ✅ NEW: Add promotion/discount fields
      original_price: parseFloat(orderItem.original_price?.toString() || '0') || null,
      product_discount_amount: parseFloat(orderItem.product_discount_amount?.toString() || '0') || null,
      promotion_discount_amount: parseFloat(orderItem.promotion_discount_amount?.toString() || '0') || null,
      shipping_cost: parseFloat(orderItem.shipping_cost?.toString() || '0') || null,
      evaluation_id: orderItem.evaluation_id || null
    };

    try {
      logger.debug({
        productid: orderItem.productid,
        orderlineData: {
          original_price: orderlineData.original_price,
          product_discount_amount: orderlineData.product_discount_amount,
          promotion_discount_amount: orderlineData.promotion_discount_amount,
          shipping_cost: orderlineData.shipping_cost,
          evaluation_id: orderlineData.evaluation_id
        }
      }, 'Creating orderline with discount fields');
      
      const orderline = await dynamicCreate('orderline', orderlineData);
      
      logger.info({
        orderlineId: orderline.id,
        productid: orderline.productid,
        product_discount_amount: orderline.product_discount_amount,
        promotion_discount_amount: orderline.promotion_discount_amount,
        shipping_cost: orderline.shipping_cost
      }, 'Orderline created successfully with discount fields');
      
      orderlines.push(orderline);
    } catch (error: any) {
      logger.error({ 
        error: error.message,
        stack: error.stack,
        orderItem,
        orderlineData 
      }, 'Failed to create orderline');
      throw error;
    }
  }

  logger.info({
    orderId,
    orderlinesCreated: orderlines.length,
    totalProductDiscount: orderlines.reduce((sum, ol) => sum + (parseFloat(ol.product_discount_amount?.toString() || '0')), 0),
    totalPromotionDiscount: orderlines.reduce((sum, ol) => sum + (parseFloat(ol.promotion_discount_amount?.toString() || '0')), 0),
    totalShipping: orderlines.reduce((sum, ol) => sum + (parseFloat(ol.shipping_cost?.toString() || '0')), 0)
  }, 'All orderlines created with discount breakdown');

  return orderlines;
}
```

---

## 🔧 Complete Implementation Patch

### File 1: `src/controllers/phonepe.controller.ts`

**Location**: After line 2252, before building `orderData`

```typescript
// ============================================
// ENHANCEMENT: Enrich orderItems with per-line discount data
// ============================================
logger.info(
  {
    transactionId,
    hasEvaluationData: !!evaluationData,
    originalOrderDataCount: originalOrderData.length,
    validProductIds: validProductIds.length,
    orderLevelTotals: {
      originalTotal,
      productDiscountTotal,
      promotionDiscountTotal,
      shippingCost
    }
  },
  "Starting orderItems enrichment with discount data"
);

const enrichedOrderItems = originalOrderData
  .filter((item: any) => validProductIds.includes(item.productid))
  .map((item: any, index: number) => {
    const productId = item.productid;
    const quantity = parseInt(item.quantity?.toString() || '1');
    const itemProductAmount = parseFloat(item.productamount?.toString() || '0');
    
    // Initialize discount values
    let productDiscountAmount = 0;
    let promotionDiscountAmount = 0;
    let originalPrice = itemProductAmount; // Default to productamount
    
    // Try to get accurate data from evaluationData
    if (evaluationData) {
      // Get from evaluation cart_data (most accurate source)
      const evaluationCartData = (evaluationData.cart_data as any[]) || [];
      const cartItem = evaluationCartData.find(
        (ci: any) => parseInt(ci.product_id?.toString() || '0') === productId
      );
      
      if (cartItem) {
        const basePrice = parseFloat(cartItem.base_price?.toString() || '0');
        const productDiscount = parseFloat(cartItem.product_discount?.toString() || '0');
        
        originalPrice = basePrice * quantity;
        productDiscountAmount = productDiscount * quantity;
        
        logger.debug({
          transactionId,
          productId,
          basePrice,
          productDiscount,
          quantity,
          calculatedOriginalPrice: originalPrice,
          calculatedProductDiscount: productDiscountAmount
        }, "Extracted product discount from evaluation cart_data");
      }
      
      // Get promotion discount from applied_promotions breakdown
      const appliedPromotions = (evaluationData.applied_promotions as any[]) || [];
      for (const promo of appliedPromotions) {
        if (promo.breakdown && Array.isArray(promo.breakdown)) {
          const promoItem = promo.breakdown.find(
            (b: any) => parseInt(b.product_id?.toString() || '0') === productId
          );
          if (promoItem) {
            const itemPromoDiscount = parseFloat(promoItem.total_discount?.toString() || '0');
            promotionDiscountAmount += itemPromoDiscount;
            
            logger.debug({
              transactionId,
              productId,
              promotionId: promo.promotion_id,
              promotionDiscount: itemPromoDiscount,
              totalPromotionDiscount: promotionDiscountAmount
            }, "Extracted promotion discount from applied_promotions");
          }
        }
      }
    }
    
    // Calculate pro-rata shipping cost based on product amount
    const totalProductAmount = originalOrderData
      .filter((i: any) => validProductIds.includes(i.productid))
      .reduce((sum: number, i: any) => 
        sum + parseFloat(i.productamount?.toString() || '0'), 0
      );
    
    const shippingCostForItem = totalProductAmount > 0
      ? (shippingCost * itemProductAmount) / totalProductAmount
      : 0;
    
    logger.debug({
      transactionId,
      productId,
      index,
      enrichment: {
        original_price: originalPrice,
        product_discount_amount: productDiscountAmount,
        promotion_discount_amount: promotionDiscountAmount,
        shipping_cost: shippingCostForItem,
        evaluation_id: primaryEvaluationId
      }
    }, "Order item enriched with discount data");
    
    return {
      ...item,
      original_price: originalPrice,
      product_discount_amount: productDiscountAmount,
      promotion_discount_amount: promotionDiscountAmount,
      shipping_cost: shippingCostForItem,
      evaluation_id: primaryEvaluationId
    };
  });

// Validation: Log enrichment results
const enrichmentSummary = {
  totalItems: enrichedOrderItems.length,
  totalOriginalPrice: enrichedOrderItems.reduce((sum, i) => sum + (i.original_price || 0), 0),
  totalProductDiscount: enrichedOrderItems.reduce((sum, i) => sum + (i.product_discount_amount || 0), 0),
  totalPromotionDiscount: enrichedOrderItems.reduce((sum, i) => sum + (i.promotion_discount_amount || 0), 0),
  totalShipping: enrichedOrderItems.reduce((sum, i) => sum + (i.shipping_cost || 0), 0)
};

logger.info(
  {
    transactionId,
    enrichmentSummary,
    expectedTotals: {
      productDiscountTotal,
      promotionDiscountTotal,
      shippingCost
    },
    discrepancies: {
      productDiscount: Math.abs(enrichmentSummary.totalProductDiscount - productDiscountTotal),
      promotionDiscount: Math.abs(enrichmentSummary.totalPromotionDiscount - promotionDiscountTotal),
      shipping: Math.abs(enrichmentSummary.totalShipping - shippingCost)
    }
  },
  "Order items enrichment completed - validating totals"
);
```

**Then update line 2305**:
```typescript
// OLD:
// orderItems: originalOrderData.filter((item: any) => validProductIds.includes(item.productid)),

// NEW:
orderItems: enrichedOrderItems,  // Use enriched order items with discount data
```

---

### File 2: `src/services/orders.service.ts`

**Replace lines 374-427 with**:

```typescript
async createOrderlinesFromOrderItems(
  orderId: number,
  orderItems: any[],
  orderidString: string,
  currentTime: number
) {
  const orderlines = [];
  
  logger.info({
    orderId,
    orderidString,
    orderItemsCount: orderItems.length,
    sampleOrderItem: orderItems.length > 0 ? {
      productid: orderItems[0].productid,
      hasOriginalPrice: 'original_price' in orderItems[0],
      hasProductDiscount: 'product_discount_amount' in orderItems[0],
      hasPromotionDiscount: 'promotion_discount_amount' in orderItems[0],
      hasShippingCost: 'shipping_cost' in orderItems[0],
      hasEvaluationId: 'evaluation_id' in orderItems[0]
    } : null
  }, 'Starting orderline creation from enriched order items');
  
  for (let i = 0; i < orderItems.length; i++) {
    const orderItem = orderItems[i];
    
    const orderlineData = {
      orderid: orderId,
      productid: orderItem.productid,
      userid: parseInt(orderItem.userid?.toString() || '0') || null,
      addressid: parseInt(orderItem.addressid?.toString() || '0') || null,
      productamount: parseFloat(orderItem.productamount?.toString() || '0') || null,
      discountamount: parseFloat(orderItem.discountamount?.toString() || '0') || null,
      orderamount: parseFloat(orderItem.orderamount?.toString() || '0') || null,
      quantity: parseInt(orderItem.quantity?.toString() || '1') || 1,
      productname: orderItem.productname || null,
      productcategory: orderItem.productcategory || null,
      orderstatus: 'payment_completed',
      uniqueordderid: orderidString,
      createddate: currentTime,
      modifieddate: currentTime,
      ordereddate: currentTime,
      // ✅ NEW: Add promotion/discount fields with proper null handling
      original_price: orderItem.original_price !== undefined 
        ? parseFloat(orderItem.original_price?.toString() || '0') 
        : null,
      product_discount_amount: orderItem.product_discount_amount !== undefined 
        ? parseFloat(orderItem.product_discount_amount?.toString() || '0') 
        : null,
      promotion_discount_amount: orderItem.promotion_discount_amount !== undefined 
        ? parseFloat(orderItem.promotion_discount_amount?.toString() || '0') 
        : null,
      shipping_cost: orderItem.shipping_cost !== undefined 
        ? parseFloat(orderItem.shipping_cost?.toString() || '0') 
        : null,
      evaluation_id: orderItem.evaluation_id || null,
      merchanttransactionid: orderItem.merchanttransactionid || null
    };

    try {
      logger.debug({
        orderId,
        productid: orderItem.productid,
        orderlineIndex: i,
        discountFields: {
          original_price: orderlineData.original_price,
          product_discount_amount: orderlineData.product_discount_amount,
          promotion_discount_amount: orderlineData.promotion_discount_amount,
          shipping_cost: orderlineData.shipping_cost,
          evaluation_id: orderlineData.evaluation_id
        }
      }, 'Creating orderline with discount fields');
      
      const orderline = await dynamicCreate('orderline', orderlineData);
      
      if (!orderline) {
        throw new Error('dynamicCreate returned null/undefined for orderline');
      }
      
      logger.info({
        orderlineId: orderline.id,
        productid: orderline.productid,
        orderlinenumber: orderline.orderlinenumber || orderline.uniqueordderid,
        savedDiscountFields: {
          original_price: orderline.original_price,
          product_discount_amount: orderline.product_discount_amount,
          promotion_discount_amount: orderline.promotion_discount_amount,
          shipping_cost: orderline.shipping_cost,
          evaluation_id: orderline.evaluation_id
        }
      }, 'Orderline created successfully with discount fields');
      
      orderlines.push(orderline);
    } catch (error: any) {
      logger.error({ 
        error: error.message,
        stack: error.stack,
        orderItem,
        orderlineData,
        orderId,
        productid: orderItem.productid
      }, 'Failed to create orderline from order item');
      
      // Don't throw - continue with other orderlines but track the error
      orderlines.push({
        error: true,
        productid: orderItem.productid,
        errorMessage: error.message
      });
    }
  }

  // Calculate and log totals for validation
  const successfulOrderlines = orderlines.filter(ol => !ol.error);
  const totals = {
    totalOriginalPrice: successfulOrderlines.reduce((sum, ol) => 
      sum + (parseFloat(ol.original_price?.toString() || '0') || 0), 0),
    totalProductDiscount: successfulOrderlines.reduce((sum, ol) => 
      sum + (parseFloat(ol.product_discount_amount?.toString() || '0') || 0), 0),
    totalPromotionDiscount: successfulOrderlines.reduce((sum, ol) => 
      sum + (parseFloat(ol.promotion_discount_amount?.toString() || '0') || 0), 0),
    totalShipping: successfulOrderlines.reduce((sum, ol) => 
      sum + (parseFloat(ol.shipping_cost?.toString() || '0') || 0), 0)
  };

  logger.info({
    orderId,
    orderidString,
    orderlinesCreated: successfulOrderlines.length,
    orderlinesFailed: orderlines.filter(ol => ol.error).length,
    calculatedTotals: totals
  }, 'Orderline creation completed with discount field distribution');

  return orderlines;
}
```

---

## 🧪 Testing & Validation

### Test Case 1: Order with Multiple Products and Promotions

**Sample Order Data**:
```json
{
  "order_id": 131,
  "quantity": 15,
  "productamount": 2750,
  "discountamount": 500,
  "orderamount": 2250,
  "promotion_discount_total": 300,
  "shipping_cost": 200,
  "products": [
    {
      "productid": 1,
      "quantity": 5,
      "productamount": 500,
      "original_price": 100,
      "product_discount_amount": 50,
      "promotion_discount_amount": 100
    },
    {
      "productid": 2,
      "quantity": 5,
      "productamount": 1250,
      "original_price": 250,
      "product_discount_amount": 100,
      "promotion_discount_amount": 150
    },
    {
      "productid": 3,
      "quantity": 5,
      "productamount": 1000,
      "original_price": 200,
      "product_discount_amount": 50,
      "promotion_discount_amount": 50
    }
  ]
}
```

**Expected Orderline Records**:
```sql
-- Product 1
SELECT 
  productid,
  quantity,
  productamount,
  original_price,
  product_discount_amount,
  promotion_discount_amount,
  shipping_cost,
  orderamount
FROM orderline 
WHERE orderid = 131 AND productid = 1;

-- Expected:
-- productid: 1
-- quantity: 5
-- productamount: 500
-- original_price: 500 (100 * 5)
-- product_discount_amount: 50
-- promotion_discount_amount: 100
-- shipping_cost: ~36.36 (pro-rata: 200 * 500/2750)
-- orderamount: 350 (500 - 50 - 100)
```

### SQL Validation Queries

#### Query 1: Check Orderline Discount Fields
```sql
SELECT 
  ol.id,
  ol.orderid,
  ol.productid,
  ol.productname,
  ol.quantity,
  ol.productamount,
  ol.original_price,
  ol.product_discount_amount,
  ol.promotion_discount_amount,
  ol.shipping_cost,
  ol.discountamount,
  ol.orderamount,
  ol.evaluation_id,
  o.orderid as order_string_id,
  o.promotion_discount_total as order_promo_discount,
  o.shipping_cost as order_shipping,
  o.discountamount as order_total_discount
FROM orderline ol
JOIN orders o ON ol.orderid = o.id
WHERE o.id IN (131, 134)
ORDER BY o.id, ol.productid;
```

#### Query 2: Validate Discount Totals Match
```sql
WITH orderline_totals AS (
  SELECT 
    orderid,
    SUM(product_discount_amount) as total_product_discount,
    SUM(promotion_discount_amount) as total_promotion_discount,
    SUM(shipping_cost) as total_shipping
  FROM orderline
  WHERE orderid IN (131, 134)
  GROUP BY orderid
)
SELECT 
  o.id,
  o.orderid,
  o.discountamount as order_total_discount,
  o.promotion_discount_total as order_promotion_discount,
  o.shipping_cost as order_shipping,
  ot.total_product_discount as orderline_product_discount_sum,
  ot.total_promotion_discount as orderline_promotion_discount_sum,
  ot.total_shipping as orderline_shipping_sum,
  -- Check for discrepancies
  ABS(o.promotion_discount_total - ot.total_promotion_discount) as promo_discount_diff,
  ABS(o.shipping_cost - ot.total_shipping) as shipping_diff
FROM orders o
LEFT JOIN orderline_totals ot ON o.id = ot.orderid
WHERE o.id IN (131, 134);
```

#### Query 3: Identify Problematic Records
```sql
-- Find orderlines with missing discount data
SELECT 
  ol.id,
  ol.orderid,
  ol.productid,
  ol.productamount,
  CASE 
    WHEN ol.product_discount_amount IS NULL THEN 'MISSING'
    WHEN ol.product_discount_amount = 0 THEN 'ZERO'
    ELSE 'OK'
  END as product_discount_status,
  CASE 
    WHEN ol.promotion_discount_amount IS NULL THEN 'MISSING'
    WHEN ol.promotion_discount_amount = 0 THEN 'ZERO'
    ELSE 'OK'
  END as promotion_discount_status,
  CASE 
    WHEN ol.shipping_cost IS NULL THEN 'MISSING'
    WHEN ol.shipping_cost = 0 THEN 'ZERO'
    ELSE 'OK'
  END as shipping_status
FROM orderline ol
JOIN orders o ON ol.orderid = o.id
WHERE o.merchanttransactionid IS NOT NULL
  AND o.createddate > EXTRACT(EPOCH FROM NOW() - INTERVAL '7 days') * 1000
  AND (
    ol.product_discount_amount IS NULL OR ol.product_discount_amount = 0 OR
    ol.promotion_discount_amount IS NULL OR ol.promotion_discount_amount = 0 OR
    ol.shipping_cost IS NULL OR ol.shipping_cost = 0
  )
ORDER BY o.createddate DESC
LIMIT 100;
```

### Manual Test Steps

1. **Trigger PhonePe Payment**:
   ```bash
   curl -X POST http://localhost:3000/v1/phonepe/initiate \
     -H "Content-Type: application/json" \
     -d '{
       "mode": "phonepe",
       "evaluation_ids": ["eval_test_123"],
       "order": [
         {
           "productid": 1,
           "quantity": 5,
           "productamount": 500,
           "discountamount": 0,
           "orderamount": 500,
           ...
         }
       ],
       "transaction": {
         "amount": 2250,
         ...
       }
     }'
   ```

2. **Complete Payment via PhonePe Callback**:
   - Simulate callback or complete real payment
   - Check logs for "Order items enrichment completed"
   - Check logs for "Orderline created successfully with discount fields"

3. **Validate Database**:
   ```sql
   SELECT * FROM orderline WHERE orderid = (
     SELECT id FROM orders ORDER BY id DESC LIMIT 1
   );
   ```

4. **Check Discount Fields**:
   - `product_discount_amount` should NOT be 0 or NULL
   - `promotion_discount_amount` should match applied promotions
   - `shipping_cost` should be distributed pro-rata
   - Sum of orderline discounts should match order-level totals

---

## 📊 Logging Enhancements

### Additional Log Points

#### 1. In PhonePe Controller (Before Order Creation)
```typescript
logger.info({
  transactionId,
  step: "enrichment_validation",
  enrichedItemsCount: enrichedOrderItems.length,
  totals: {
    sumOriginalPrice: enrichedOrderItems.reduce((s, i) => s + (i.original_price || 0), 0),
    sumProductDiscount: enrichedOrderItems.reduce((s, i) => s + (i.product_discount_amount || 0), 0),
    sumPromotionDiscount: enrichedOrderItems.reduce((s, i) => s + (i.promotion_discount_amount || 0), 0),
    sumShipping: enrichedOrderItems.reduce((s, i) => s + (i.shipping_cost || 0), 0)
  },
  expectedTotals: {
    productDiscountTotal,
    promotionDiscountTotal,
    shippingCost
  }
}, "Validating enriched orderItems before order creation");
```

#### 2. In OrdersService (After Orderline Creation)
```typescript
logger.info({
  orderId,
  orderlinesCreated: orderlines.length,
  verification: {
    allHaveProductDiscount: orderlines.every(ol => ol.product_discount_amount !== null),
    allHavePromotionDiscount: orderlines.every(ol => ol.promotion_discount_amount !== null),
    allHaveShipping: orderlines.every(ol => ol.shipping_cost !== null)
  },
  calculatedTotals: {
    totalProductDiscount: orderlines.reduce((s, ol) => s + (parseFloat(ol.product_discount_amount || 0)), 0),
    totalPromotionDiscount: orderlines.reduce((s, ol) => s + (parseFloat(ol.promotion_discount_amount || 0)), 0),
    totalShipping: orderlines.reduce((s, ol) => s + (parseFloat(ol.shipping_cost || 0)), 0)
  }
}, "Orderlines created - discount field verification");
```

### Log Alerts for Issues

Add alerts for:
1. Discrepancy between order-level and orderline-sum totals > 1% or ₹10
2. Any orderline with all discount fields = 0 when order has discounts
3. Missing evaluationData when order has promotion_discount_total > 0

---

## 🚨 Backward Compatibility

### Handling Existing Orders

For orders already created with missing discount data:

**Migration Script** (optional):
```sql
-- Create backup
CREATE TABLE orderline_backup_20251105 AS 
SELECT * FROM orderline WHERE product_discount_amount IS NULL;

-- For recent orders with evaluationData, consider re-processing
-- This would require re-running the enrichment logic retroactively
```

**Recommendation**: Focus on fixing forward, not backward. Historical data can be annotated with a flag.

---

## ✅ Acceptance Criteria

- [ ] Orderlines created after fix have `product_discount_amount` populated
- [ ] Orderlines created after fix have `promotion_discount_amount` populated  
- [ ] Orderlines created after fix have `shipping_cost` populated pro-rata
- [ ] Sum of orderline `product_discount_amount` matches order `productDiscountTotal` (within rounding tolerance)
- [ ] Sum of orderline `promotion_discount_amount` matches order `promotion_discount_total` (within rounding tolerance)
- [ ] Sum of orderline `shipping_cost` matches order `shipping_cost` (within rounding tolerance)
- [ ] Logs show enrichment process working correctly
- [ ] SQL validation queries show no zero/null discount fields for new orders
- [ ] Manual test case passes with correct per-line discount values

---

## 📝 Deployment Checklist

1. **Code Review**: Review both controller and service changes
2. **Unit Tests**: Add tests for orderItems enrichment logic
3. **Integration Tests**: Test full PhonePe callback → order creation flow
4. **Staging Deployment**: Deploy to staging and test with real PhonePe sandbox
5. **Monitor Logs**: Check enrichment logs for 24 hours in staging
6. **SQL Validation**: Run validation queries on staging DB
7. **Production Deployment**: Deploy during low-traffic window
8. **Post-Deployment**: Monitor logs and run validation queries
9. **Alert Setup**: Set up alerts for discount field discrepancies

---

## 🔗 Related Issues

- **PHONEPE-001**: PhonePe payment callback implementation
- **PROMO-045**: Promotion discount tracking at orderline level
- **REFUND-023**: Refund calculation requires orderline-level discounts

---

**Analysis Completed By**: AI Assistant  
**Date**: November 5, 2025  
**Status**: Ready for Implementation  
**Estimated Fix Time**: 4-6 hours (development + testing)

