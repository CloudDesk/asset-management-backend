# 🔧 PhonePe Orderline Discount Fix - Implementation Guide

**Date**: November 5, 2025  
**Related Analysis**: PHONEPE_ORDERLINE_DISCOUNT_BUG_ANALYSIS.md

---

## Quick Summary

This fix adds per-line discount distribution to orderlines by:
1. Enriching orderItems with discount data from evaluationData before order creation
2. Updating OrdersService to persist these fields to orderlines

---

## 🔨 Implementation Steps

### Step 1: Update PhonePe Controller

**File**: `src/controllers/phonepe.controller.ts`  
**Action**: Insert enrichment logic BEFORE building orderData  
**Location**: After line 2255, before line 2257

#### Code to Insert:

```typescript
      // ============================================
      // BUGFIX: Enrich orderItems with per-line discount data
      // Issue: PHONEPE-ORDERLINE-001
      // Date: 2025-11-05
      // ============================================
      logger.info(
        {
          transactionId,
          hasEvaluationData: !!evaluationData,
          originalOrderDataCount: originalOrderData.length,
          validProductIdsCount: validProductIds.length,
          orderLevelTotals: {
            originalTotal,
            productDiscountTotal,
            promotionDiscountTotal,
            shippingCost
          }
        },
        "Starting orderItems enrichment with per-line discount data"
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
          } else {
            // Fallback: Pro-rata distribution if evaluationData not available
            logger.warn({
              transactionId,
              productId,
              message: "No evaluationData - using pro-rata distribution (less accurate)"
            }, "Falling back to pro-rata discount distribution");
            
            const totalProductAmount = originalOrderData
              .filter((i: any) => validProductIds.includes(i.productid))
              .reduce((sum: number, i: any) => 
                sum + parseFloat(i.productamount?.toString() || '0'), 0
              );
            
            if (totalProductAmount > 0) {
              const proRataFactor = itemProductAmount / totalProductAmount;
              productDiscountAmount = productDiscountTotal * proRataFactor;
              promotionDiscountAmount = promotionDiscountTotal * proRataFactor;
              originalPrice = itemProductAmount + (productDiscountAmount + promotionDiscountAmount);
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

      // ============================================
      // END BUGFIX
      // ============================================
```

#### Code to Replace:

**OLD** (lines 2305-2307):
```typescript
        orderItems: originalOrderData.filter((item: any) =>
          validProductIds.includes(item.productid)
        ),
```

**NEW**:
```typescript
        orderItems: enrichedOrderItems,  // BUGFIX: Use enriched items with discount data
```

---

### Step 2: Update OrdersService

**File**: `src/services/orders.service.ts`  
**Method**: `createOrderlinesFromOrderItems`  
**Lines to Replace**: 374-427

#### Complete Replacement:

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
        // ✅ BUGFIX: Add promotion/discount fields with proper null handling
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

## 🧪 Testing After Implementation

### 1. Test with Existing PhonePe Transaction

```bash
# Trigger a test payment
curl -X POST http://localhost:3000/v1/phonepe/initiate \
  -H "Content-Type: application/json" \
  -d @test_payload.json
```

### 2. Check Logs

Look for these log messages:
- ✅ "Starting orderItems enrichment with per-line discount data"
- ✅ "Order items enrichment completed - validating totals"
- ✅ "Orderline created successfully with discount fields"

### 3. Validate Database

```sql
-- Check most recent orderlines
SELECT 
  ol.id,
  ol.productid,
  ol.productname,
  ol.quantity,
  ol.original_price,
  ol.product_discount_amount,
  ol.promotion_discount_amount,
  ol.shipping_cost,
  ol.evaluation_id,
  o.id as order_id,
  o.orderid as order_string_id
FROM orderline ol
JOIN orders o ON ol.orderid = o.id
WHERE o.merchanttransactionid IS NOT NULL
ORDER BY ol.createddate DESC
LIMIT 20;
```

### Expected Results:
- ✅ `original_price` > 0
- ✅ `product_discount_amount` NOT NULL (may be 0 if no product discount)
- ✅ `promotion_discount_amount` NOT NULL (may be 0 if no promotion)
- ✅ `shipping_cost` > 0 (distributed pro-rata)
- ✅ `evaluation_id` populated if promotion applied

---

## 🔍 Troubleshooting

### Issue: Discount fields still 0 or NULL

**Check**:
1. Is `evaluationData` being fetched? Check logs for "Evaluation data retrieved"
2. Does `evaluation.cart_data` have data? Log it
3. Does `evaluation.applied_promotions` have breakdown? Log it

**Fix**: Add more detailed logging in enrichment block

### Issue: Discrepancy between order and orderline totals

**Check**:
1. Log entry: "Order items enrichment completed - validating totals"
2. Check `discrepancies` object in logs
3. Common cause: Rounding or missing items

**Fix**: Adjust rounding logic or investigate missing cart items

### Issue: Errors during orderline creation

**Check**:
1. Database schema has all fields (run migration if needed)
2. Field types match (BigInt vs Int)
3. Check dynamicCreate allows extra fields

**Fix**: Update schema or adjust data types in orderlineData

---

## 📊 Monitoring Queries

### Daily Health Check

```sql
-- Count orderlines with missing discount data (created after fix deployment)
SELECT 
  COUNT(*) as total_orderlines,
  COUNT(CASE WHEN product_discount_amount IS NULL OR product_discount_amount = 0 THEN 1 END) as missing_product_discount,
  COUNT(CASE WHEN promotion_discount_amount IS NULL OR promotion_discount_amount = 0 THEN 1 END) as missing_promotion_discount,
  COUNT(CASE WHEN shipping_cost IS NULL OR shipping_cost = 0 THEN 1 END) as missing_shipping
FROM orderline ol
JOIN orders o ON ol.orderid = o.id
WHERE o.createddate > EXTRACT(EPOCH FROM TIMESTAMP '2025-11-05 00:00:00') * 1000
  AND o.merchanttransactionid IS NOT NULL;
```

### Discount Total Validation

```sql
-- Validate orderline totals match order totals
WITH orderline_sums AS (
  SELECT 
    orderid,
    SUM(product_discount_amount) as orderline_product_discount_sum,
    SUM(promotion_discount_amount) as orderline_promotion_discount_sum,
    SUM(shipping_cost) as orderline_shipping_sum
  FROM orderline
  WHERE createddate > EXTRACT(EPOCH FROM TIMESTAMP '2025-11-05 00:00:00') * 1000
  GROUP BY orderid
)
SELECT 
  o.id,
  o.orderid,
  o.promotion_discount_total,
  os.orderline_promotion_discount_sum,
  ABS(o.promotion_discount_total - os.orderline_promotion_discount_sum) as promo_diff,
  o.shipping_cost,
  os.orderline_shipping_sum,
  ABS(o.shipping_cost - os.orderline_shipping_sum) as shipping_diff
FROM orders o
JOIN orderline_sums os ON o.id = os.orderid
WHERE ABS(o.promotion_discount_total - os.orderline_promotion_discount_sum) > 1
   OR ABS(o.shipping_cost - os.orderline_shipping_sum) > 1
ORDER BY o.createddate DESC
LIMIT 50;
```

---

## ✅ Deployment Checklist

- [ ] Code changes reviewed and approved
- [ ] Tested locally with sample PhonePe transactions
- [ ] Logs show enrichment working correctly
- [ ] Database validation queries pass
- [ ] Staging deployment completed
- [ ] Staging tested with real PhonePe sandbox
- [ ] Monitoring queries set up
- [ ] Alert thresholds configured
- [ ] Production deployment approved
- [ ] Post-deployment validation completed
- [ ] Team notified of fix deployment

---

**Implementation Guide Version**: 1.0  
**Date**: November 5, 2025  
**Status**: Ready for Deployment

