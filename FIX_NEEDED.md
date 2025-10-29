# Fix Needed for OrderLine Promotion Discount Distribution

## 🐛 Problem

The user reported that promotion discounts (₹500) are showing on the order level but NOT distributed to orderlines. All orderline records show `promotion_discount_amount = 0`.

## 📊 Current Data

**Order Table**:
- `orderamount`: 2250
- `productamount`: 2750
- `discountamount`: 500
- `promotion_discount_total`: 500.00 ✅
- `original_total`: 2750.00
- `shipping_cost`: 0.00

**OrderLine Records** (3 total):
- All show `promotion_discount_amount`: 0.00 ❌
- All show `product_discount_amount`: 0.00
- All show `shipping_cost`: 0.00
- `productamount`: 500, 1250, 1000 (total = 2750 ✅)
- `orderamount`: 500, 1250, 1000 (should be discounted)

## ✅ Expected

The ₹500 promotion discount should be distributed proportionally:
- Product A (500/2750 = 18.18%): ₹90.91
- Product B (1250/2750 = 45.45%): ₹227.27
- Product C (1000/2750 = 36.36%): ₹181.82
Total: ₹500 ✅

## 🔧 Root Cause

The code in `createOrderAfterPayment` has duplicate/conflicting logic:
1. Lines 2471-2517: Check if no evaluationData, calculate proportionally
2. Lines 2591-2639: Same check again (duplicate!)
3. Lines 2640-2712: Only runs if `evaluationData` exists AND the condition is false

**Issue**: The code structure is broken with nested if/else statements that don't work correctly.

## 🛠️ Solution

The code needs to be restructured to:
1. Check if evaluationData exists
2. If YES: Use evaluation data to calculate discounts
3. If NO but promotionDiscountTotal > 0: Calculate proportional discounts based on orderline values
4. Update all orderlines with the calculated discounts

## 📝 Files to Fix

- `src/controllers/phonepe.controller.ts` (lines 2468-2713)

## ⚠️ Critical

The current code has syntax errors due to improper if/else structure. Need to:
1. Remove duplicate logic
2. Fix indentation and structure
3. Ensure the fallback proportional calculation runs when needed
4. Fix the `totalShippingCost` variable name issue (should be `shippingCost`)

